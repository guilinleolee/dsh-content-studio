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
import type { FinishReason } from '@deepseek-ai/dsh-llm';
import type { Context } from '@deepseek-ai/cordis';
import type { GatherAiRequest, GatherAiResult } from '../types.ts';
/** Timeout reason code carried by aborted AI processing calls. */
export declare const GATHER_AI_TIMEOUT_CODE = "GATHER_AI_TIMEOUT";
/** Deployment policy for the AI processing face; every default lives in {@link GatherAiProcessor}. */
export interface GatherAiConfig {
    /** Registered LLM provider route. */
    readonly provider?: string;
    /** Model id within the provider route. */
    readonly model?: string;
    /** End-to-end call deadline in milliseconds (1000–600000). */
    readonly timeoutMs?: number;
    /** Model-output token cap for one call (256–32000). */
    readonly maxOutputTokens?: number;
    /** Model-input character cap for one material (1000–100000). */
    readonly maxInputChars?: number;
}
/** Validated policy after explicit default resolution. */
export interface ResolvedAiConfig {
    provider: string;
    model: string;
    timeoutMs: number;
    maxOutputTokens: number;
    maxInputChars: number;
}
/** Call policy a one-shot model call needs; `maxInputChars` is caller-side. */
export interface AiCallPolicy {
    provider: string;
    model: string;
    timeoutMs: number;
    maxOutputTokens: number;
}
/**
 * Resolve the declared AI policy into its validated form, defaults applied.
 * Shared by every AI face of this gateway so the bounds live in one place.
 * @param config - the declared policy; every field optional.
 * @returns the validated policy, fail loud on out-of-range values.
 */
export declare function resolveAiConfig(config: GatherAiConfig): ResolvedAiConfig;
/** Retry budget shared by the gather and competitor AI faces: rate limits only, four tries. */
export declare const AI_RETRY_MAX = 4;
/**
 * Honor a provider `Retry-After` before p-retry's own backoff runs.
 * @param failure - the failed attempt's error or its p-retry context.
 */
export declare function honorRetryAfter(failure: unknown): Promise<void>;
/**
 * Whether one thrown error (or its p-retry context) is an upstream rate limit worth retrying.
 * @param failure - the failed attempt's error or its p-retry context.
 * @returns whether the underlying error codes as `RATE_LIMIT` or HTTP 429.
 */
export declare function isRateLimitError(failure: unknown): boolean;
/**
 * Provider-requested retry delay in milliseconds, capped so one source cannot pin the queue.
 * @param failure - the failed attempt's error or its p-retry context.
 * @returns the provider `Retry-After` delay capped at 30s, or undefined when absent.
 */
export declare function retryAfterMs(failure: unknown): number | undefined;
/**
 * Terminal model finish reasons that mean the call failed.
 * @param finish - the model call's finish reason.
 * @returns the failure as an `Error` carrying the failure code, or undefined for a clean `stop`.
 */
export declare function finishError(finish: FinishReason): Error | undefined;
/**
 * Parse the model's JSON answer into the structured result. Model output is
 * a JSON boundary: anything that is not the requested object rejects here.
 * @param text - exact model text output.
 * @returns the validated result.
 */
export declare function parseGatherAiOutput(text: string): GatherAiResult;
/**
 * The queued AI processor owned by the content-outputs gateway; not itself a
 * cordis service — the gateway carries the `llm` injection and the config.
 */
export declare class GatherAiProcessor {
    private readonly ctx;
    /** Validated policy, defaults resolved once at construction. */
    private readonly resolved;
    /** Single-slot call queue: one model call at a time, per the gather policy. */
    private readonly queue;
    /**
     * @param ctx - context exposing the registered LLM service.
     * @param config - declared AI policy; defaults resolve here, fail loud.
     */
    constructor(ctx: Context, config: GatherAiConfig);
    /**
     * Process one material through the model: summary, key points, topic
     * score, and tags. Rate limits retry with backoff; every other failure
     * surfaces immediately so the UI can offer its own retry button.
     * @param request - the material's display facts plus its snapshot reference.
     * @param readSnapshot - reads one snapshot file body (theme, file name) as text.
     * @returns the structured result for the caller to write back into the manifest.
     */
    process(request: GatherAiRequest, readSnapshot: (theme: string, file: string) => Promise<string | undefined>): Promise<GatherAiResult>;
    /** Gather the model input: snapshot text when present, else the summary; never empty. */
    private collectInputText;
    /** One queued call with the rate-limit retry policy wrapped around it. */
    private processWithRetry;
    /** One model call: framed prompt in, streamed text out, JSON validated. */
    private callModel;
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
export declare function streamLlmText(ctx: Context, policy: AiCallPolicy, system: string, framed: string, timeoutCode: string): Promise<string>;
//# sourceMappingURL=ai.d.ts.map