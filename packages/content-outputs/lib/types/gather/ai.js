/**
 * AI processing for the gather write face: one explicit, controlled model
 * call per request behind the gather view's AI processing button. Calls ride
 * the shared `llm` Service Definition — no new model interface — through the
 * same hand-built one-shot pattern the session-title provider established.
 * The processor runs one call at a time (p-queue), retries only upstream
 * rate limits (p-retry: provider `Retry-After` first, else exponential
 * backoff capped at 30 s, at most four retries), and never persists
 * anything: the caller writes the structured result back into the manifest.
 */
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import { BlockAssembler, createUserMessage, deepFreeze, LlmError } from '@deepseek-ai/dsh-llm';
import { deadline } from '@deepseek-ai/dsh-timeout';
import PQueue from 'p-queue';
import pRetry from 'p-retry';
import { htmlToText } from "./sanitize.js";
/** Timeout reason code carried by aborted AI processing calls. */
export const GATHER_AI_TIMEOUT_CODE = 'GATHER_AI_TIMEOUT';
/**
 * Resolve the declared AI policy into its validated form, defaults applied.
 * Shared by every AI face of this gateway so the bounds live in one place.
 * @param config - the declared policy; every field optional.
 * @returns the validated policy, fail loud on out-of-range values.
 */
export function resolveAiConfig(config) {
    const timeoutMs = config.timeoutMs ?? 60_000;
    const maxOutputTokens = config.maxOutputTokens ?? 2000;
    const maxInputChars = config.maxInputChars ?? 12_000;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600_000)
        throw new Error('contentOutputs aiTimeoutMs must be an integer from 1000 through 600000');
    if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 32_000)
        throw new Error('contentOutputs aiMaxOutputTokens must be an integer from 256 through 32000');
    if (!Number.isInteger(maxInputChars) || maxInputChars < 1000 || maxInputChars > 100_000)
        throw new Error('contentOutputs aiMaxInputChars must be an integer from 1000 through 100000');
    return {
        provider: config.provider ?? 'deepseek',
        model: config.model ?? 'deepseek-chat',
        timeoutMs,
        maxOutputTokens,
        maxInputChars,
    };
}
/** Retry budget shared by the gather and competitor AI faces: rate limits only, four tries. */
export const AI_RETRY_MAX = 4;
/**
 * The error behind a p-retry v8 failure context. p-retry v8 hands
 * `shouldRetry` / `onFailedAttempt` a frozen context object
 * (`{ error, attemptNumber, retriesLeft, … }`), not the raw error; plain
 * errors (direct callers, tests) pass through unchanged.
 * @param error - the raw error or a p-retry failure context.
 * @returns the underlying thrown error.
 */
function underlyingError(error) {
    if (typeof error === 'object' && error !== null && 'error' in error) {
        const nested = error.error;
        if (nested instanceof Error)
            return nested;
    }
    return error;
}
/**
 * Honor a provider `Retry-After` before p-retry's own backoff runs.
 * @param failure - the failed attempt's error or its p-retry context.
 */
export async function honorRetryAfter(failure) {
    const delay = retryAfterMs(failure);
    if (delay !== undefined)
        await new Promise(resolve => setTimeout(resolve, delay));
}
/** System prompt: the gather view's built-in processing skill. */
const SYSTEM_PROMPT = [
    '你是内容创作工作台的信息收集助手。对给定的一条素材（标题、链接、正文或摘要）输出：',
    '1. summary：不超过 120 字的中文摘要，保留关键事实与数字；',
    '2. points：最多 5 条要点，每条不超过 40 字；',
    '3. score：选题分数 0-100 整数，衡量该素材作为创作选题的价值（时效性、话题性、受众相关性）；',
    '4. tags：最多 5 个简短主题标签。',
    '只输出一个 JSON 对象，形如 {"summary":"...","points":["..."],"score":88,"tags":["..."]}，不要输出其他任何文字。',
].join('\n');
/** Whether one thrown error (or its p-retry context) is an upstream rate limit worth retrying. */
export function isRateLimitError(failure) {
    const error = underlyingError(failure);
    if (error instanceof LlmError)
        return error.failure.code === 'RATE_LIMIT' || error.failure.status === 429;
    const code = error?.code;
    return code === 'RATE_LIMIT' || code === '429';
}
/** Provider-requested retry delay in milliseconds, capped so one source cannot pin the queue. */
export function retryAfterMs(failure) {
    const error = underlyingError(failure);
    if (error instanceof LlmError && error.failure.providerRetryAfterMs !== undefined) {
        return Math.min(error.failure.providerRetryAfterMs, 30_000);
    }
    return undefined;
}
/** Terminal model finish reasons that mean the call failed. */
export function finishError(finish) {
    switch (finish.kind) {
        case 'stop': return undefined;
        case 'error':
        case 'aborted': {
            const error = new Error(finish.failure.message);
            error.code = finish.failure.code;
            return error;
        }
        case 'max-tokens': return new Error('gather AI output reached the token cap');
        case 'tool-calls': return new Error('gather AI model unexpectedly requested a tool');
        default: return new Error(`gather AI unsupported finish reason "${String(finish.kind)}"`);
    }
}
/**
 * Parse the model's JSON answer into the structured result. Model output is
 * a JSON boundary: anything that is not the requested object rejects here.
 * @param text - exact model text output.
 * @returns the validated result.
 */
export function parseGatherAiOutput(text) {
    const fenced = text.trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '');
    const start = fenced.indexOf('{');
    const end = fenced.lastIndexOf('}');
    if (start === -1 || end <= start)
        throw new Error('gather AI output contains no JSON object');
    let parsed;
    try {
        parsed = JSON.parse(fenced.slice(start, end + 1));
    }
    catch {
        throw new Error('gather AI output is not valid JSON');
    }
    const record = parsed;
    const points = record.points;
    const tags = record.tags;
    if (typeof record.summary !== 'string' || record.summary.trim().length === 0)
        throw new Error('gather AI output has no summary');
    if (!Array.isArray(points) || !points.every(point => typeof point === 'string'))
        throw new Error('gather AI output has invalid points');
    if (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string'))
        throw new Error('gather AI output has invalid tags');
    if (typeof record.score !== 'number' || !Number.isFinite(record.score) || record.score < 0 || record.score > 100)
        throw new Error('gather AI output has invalid score');
    return {
        summary: record.summary.trim(),
        points: points.slice(0, 8).map(point => point.trim()).filter(point => point.length > 0),
        score: Math.round(record.score),
        tags: tags.slice(0, 8).map(tag => tag.trim()).filter(tag => tag.length > 0),
    };
}
/**
 * The queued AI processor owned by the content-outputs gateway; not itself a
 * cordis service — the gateway carries the `llm` injection and the config.
 */
export class GatherAiProcessor {
    ctx;
    /** Validated policy, defaults resolved once at construction. */
    resolved;
    /** Single-slot call queue: one model call at a time, per the gather policy. */
    queue = new PQueue({ concurrency: 1 });
    /**
     * @param ctx - context exposing the registered LLM service.
     * @param config - declared AI policy; defaults resolve here, fail loud.
     */
    constructor(ctx, config) {
        this.ctx = ctx;
        this.resolved = resolveAiConfig(config);
    }
    /**
     * Process one material through the model: summary, key points, topic
     * score, and tags. Rate limits retry with backoff; every other failure
     * surfaces immediately so the UI can offer its own retry button.
     * @param request - the material's display facts plus its snapshot reference.
     * @param readSnapshot - reads one snapshot file body (theme, file name) as text.
     * @returns the structured result for the caller to write back into the manifest.
     */
    async process(request, readSnapshot) {
        // The operation union will grow; today's wire schema only rejects what is
        // not a member yet, so this explicit guard stays the forward contract.
        // oxlint-disable-next-line typescript/no-unnecessary-condition
        if (request.operation !== 'process')
            throw new Error(`unsupported gather AI operation: ${String(request.operation)}`);
        const text = await this.collectInputText(request, readSnapshot);
        return await this.queue.add(() => this.processWithRetry(request, text));
    }
    /** Gather the model input: snapshot text when present, else the summary; never empty. */
    async collectInputText(request, readSnapshot) {
        let text = '';
        if (request.bodyFile !== undefined && request.theme !== undefined) {
            const raw = await readSnapshot(request.theme, request.bodyFile);
            text = raw === undefined ? '' : htmlToText(raw);
        }
        if (text.trim().length === 0 && request.summary !== undefined)
            text = request.summary;
        text = text.trim().slice(0, this.resolved.maxInputChars);
        if (text.length === 0)
            throw new Error('gather AI material has no content to process');
        return text;
    }
    /** One queued call with the rate-limit retry policy wrapped around it. */
    processWithRetry(request, text) {
        return pRetry(() => this.callModel(request, text), {
            retries: AI_RETRY_MAX,
            minTimeout: 1000,
            maxTimeout: 30_000,
            factor: 2,
            shouldRetry: isRateLimitError,
            onFailedAttempt: error => honorRetryAfter(error),
        });
    }
    /** One model call: framed prompt in, streamed text out, JSON validated. */
    async callModel(request, text) {
        const framed = [
            request.title,
            request.url === undefined ? '' : `链接：${request.url}`,
            text,
        ].filter(part => part.length > 0).join('\n\n');
        const output = await streamLlmText(this.ctx, this.resolved, SYSTEM_PROMPT, framed, GATHER_AI_TIMEOUT_CODE);
        return parseGatherAiOutput(output);
    }
}
/**
 * One framed one-shot model call riding the shared `llm` Service Definition:
 * framed prompt in, streamed text out. Shared by the gather and competitor
 * AI faces — both live behind this gateway, so the call source names this
 * plugin. No persistence happens here.
 * @param ctx - context exposing the registered LLM service.
 * @param policy - provider, model, deadline, and output cap of the call.
 * @param system - the face's system prompt.
 * @param framed - complete user-prompt text.
 * @param timeoutCode - abort reason code carried by the deadline.
 * @returns the concatenated text output of the call.
 */
export async function streamLlmText(ctx, policy, system, framed, timeoutCode) {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        const messages = [createUserMessage({
                content: [{ type: 'text', text: framed }],
                source: { kind: 'plugin', plugin: 'dsh-content-outputs' },
            })];
        const callDeadline = __addDisposableResource(env_1, deadline(undefined, policy.timeoutMs, timeoutCode), false);
        const options = deepFreeze({
            provider: policy.provider,
            model: policy.model,
            messages,
            system,
            maxTokens: policy.maxOutputTokens,
            signal: callDeadline.signal,
        });
        const assembler = new BlockAssembler();
        for await (const chunk of ctx.llm.stream(options)) {
            callDeadline.signal.throwIfAborted();
            assembler.push(chunk);
        }
        callDeadline.signal.throwIfAborted();
        const terminalError = finishError(assembler.finish);
        if (terminalError !== undefined)
            throw terminalError;
        const blocks = assembler.blocks();
        return blocks
            .filter((block) => block.type === 'text')
            .map(block => block.text)
            .join(' ');
    }
    catch (e_1) {
        env_1.error = e_1;
        env_1.hasError = true;
    }
    finally {
        __disposeResources(env_1);
    }
}
//# sourceMappingURL=ai.js.map