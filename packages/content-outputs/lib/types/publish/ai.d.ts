/**
 * AI processing for the publish face: one explicit, controlled model call
 * per platform adaptation behind the view's adapt buttons. Calls ride the
 * same shared `llm` Service Definition, one-shot pattern, queue, and
 * rate-limit retry policy as the other AI faces; nothing is persisted here —
 * the caller writes each result back as a derived draft through the store.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { PublishAdaptRequest, PublishAdaptResult } from './types.ts';
import type { AiCallPolicy } from '../gather/ai.ts';
/** Timeout reason code carried by aborted publish AI calls. */
export declare const PUBLISH_AI_TIMEOUT_CODE = "PUBLISH_AI_TIMEOUT";
/** Prompt vocabulary version pinned into every result for provenance. */
export declare const PUBLISH_PROMPT_VERSION = 1;
/**
 * Build the system prompt for one platform adaptation: the registry's style
 * rules, the persona digest as the style reference, and the fixed JSON
 * output contract.
 * @param request - the adaptation request.
 * @returns the complete system prompt.
 */
export declare function adaptSystemPrompt(request: PublishAdaptRequest): string;
/**
 * Frame the user prompt: title first, then the full source manuscript.
 * @param request - the adaptation request.
 * @param maxInputChars - the combined prompt character cap.
 * @returns the complete user prompt.
 */
export declare function adaptFramedPrompt(request: PublishAdaptRequest, maxInputChars: number): string;
/**
 * Validate one adaptation request.
 * @param request - the raw request.
 * @param maxInputChars - the source text character cap.
 * @returns the validated request.
 */
export declare function validateAdaptRequest(request: PublishAdaptRequest, maxInputChars: number): PublishAdaptRequest;
/**
 * Parse an adaptation answer into the structured result. The model output is
 * a JSON boundary: missing content, or non-string tags, rejects here.
 * @param text - exact model text output.
 * @param model - the model identity recorded into the result.
 * @returns the validated adaptation with its provenance.
 */
export declare function parsePublishAdaptOutput(text: string, model: string): PublishAdaptResult;
/**
 * The queued AI processor behind the publish view; not itself a cordis
 * service — the gateway carries the `llm` injection and passes the resolved
 * policy in.
 */
export declare class PublishAiProcessor {
    private readonly ctx;
    private readonly policy;
    /** Single-slot call queue: one model call at a time, shared policy with the other faces. */
    private readonly queue;
    /**
     * @param ctx - context exposing the registered LLM service.
     * @param policy - the gateway's already-resolved AI policy.
     */
    constructor(ctx: Context, policy: AiCallPolicy & {
        maxInputChars: number;
    });
    /**
     * Adapt one manuscript into one platform version. Rate limits retry with
     * backoff; every other failure surfaces immediately so the platform card
     * can show its 未生成 state and retry button.
     * @param request - the adaptation request.
     * @returns the structured result for the caller to write back.
     */
    adapt(request: PublishAdaptRequest): Promise<PublishAdaptResult>;
}
//# sourceMappingURL=ai.d.ts.map