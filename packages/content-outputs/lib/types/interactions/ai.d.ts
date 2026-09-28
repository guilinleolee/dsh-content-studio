/**
 * AI processing for the interactions face: three explicit, controlled model
 * calls behind the reply-drafts button, the batch classifier button, and the
 * insight-extraction button. Calls ride the same shared `llm` Service
 * Definition, one-shot pattern, queue, and rate-limit retry policy as every
 * other AI face; nothing is persisted here — the caller stores drafts and
 * taggings through the manifest write face. Inputs are thread excerpts and
 * message texts only; outputs are strict JSON contracts, and one unparseable
 * reply batch fails the call rather than storing half a draft set.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { InteractionClassifyEntry, InteractionClassifyRequest, InteractionClassifyResult, InteractionInsightBatch, InteractionInsightRequest, InteractionInsightResult, InteractionReplyDraftResult, InteractionReplyRequest, InteractionReplyResult, InteractionStyle } from './types.ts';
import type { AiCallPolicy } from '../gather/ai.ts';
/** Timeout reason code carried by aborted interaction AI calls. */
export declare const INTERACTION_AI_TIMEOUT_CODE = "INTERACTION_AI_TIMEOUT";
/** Prompt vocabulary versions pinned into every result for provenance. */
export declare const INTERACTION_REPLY_PROMPT_VERSION = "interaction-reply@1";
export declare const INTERACTION_SENTIMENT_PROMPT_VERSION = "interaction-sentiment@1";
export declare const INTERACTION_INSIGHT_PROMPT_VERSION = "interaction-insight@1";
/** The reply face's fixed candidate count; the contract freezes it at three. */
export declare const INTERACTION_REPLY_CANDIDATES = 3;
/** Hard thread size the reply prompt accepts; the caller trims to the latest lines. */
export declare const INTERACTION_MAX_THREAD_LINES = 20;
/**
 * Render the persona block the reply prompt embeds: digest, phrases, and
 * tone samples, each section present only when the caller has the facts.
 * @param digest - the persona's ≤200-char style summary, or null.
 * @param phrases - recommended phrasings, possibly empty.
 * @param samples - tone sample texts, possibly empty.
 * @returns the persona block lines, empty when no persona is bound.
 */
export declare function personaBlock(digest: string | null, phrases: readonly string[], samples: readonly string[]): string[];
/**
 * Build the system prompt for one reply-draft generation. The persona is the
 * tone base; the style parameter layers on top and loses to the persona on
 * conflict, exactly as the plan freezes.
 * @param request - the reply request.
 * @returns the complete system prompt.
 */
export declare function replySystemPrompt(request: InteractionReplyRequest): string;
/**
 * Validate one reply request and frame its user prompt: the thread lines
 * plus a clear pointer at the message to answer.
 * @param request - the raw reply request.
 * @param maxInputChars - the combined prompt character cap.
 * @returns the framed user prompt.
 */
export declare function frameReplyRequest(request: InteractionReplyRequest, maxInputChars: number): string;
/**
 * Parse one reply-draft output: extract the JSON object, require exactly the
 * frozen candidate count, and coerce unknown styles to the requested one.
 * @param text - the raw model output.
 * @param style - the style the caller requested (fallback for unknown values).
 * @returns the validated drafts.
 */
export declare function parseReplyOutput(text: string, style: InteractionStyle): InteractionReplyDraftResult[];
/**
 * Build the system prompt for one classification batch: the two orthogonal
 * taggings, their closed unions, and the unknown fallback.
 * @returns the complete system prompt.
 */
export declare function classifySystemPrompt(): string;
/**
 * Frame one classification batch: numbered messages so the model can echo
 * the ids back.
 * @param request - the batch request (at most fifty messages).
 * @param maxInputChars - the combined prompt character cap.
 * @returns the framed user prompt.
 */
export declare function frameClassifyRequest(request: InteractionClassifyRequest, maxInputChars: number): string;
/**
 * Parse one classification output: keep only entries whose id was sent and
 * coerce unknown tag values to `unknown` — one bad batch degrades to
 * unknowns, never to a failure.
 * @param text - the raw model output.
 * @param validIds - the message ids the batch sent.
 * @returns the sanitized entries.
 */
export declare function parseClassifyOutput(text: string, validIds: ReadonlySet<string>): InteractionClassifyEntry[];
/**
 * Build the system prompt for one insight batch: the three lists and their
 * count-grounding rule.
 * @returns the complete system prompt.
 */
export declare function insightSystemPrompt(): string;
/**
 * Frame one insight batch.
 * @param request - the batch request (at most two hundred messages).
 * @param maxInputChars - the combined prompt character cap.
 * @returns the framed user prompt.
 */
export declare function frameInsightRequest(request: InteractionInsightRequest, maxInputChars: number): string;
/**
 * Parse one insight batch output; a batch the model garbled reads as an
 * empty batch (the caller records the failure and continues).
 * @param text - the raw model output.
 * @returns the sanitized batch.
 */
export declare function parseInsightOutput(text: string): InteractionInsightBatch;
/**
 * The queued AI processor behind the interaction view; not itself a cordis
 * service — the gateway carries the `llm` injection and passes the resolved
 * policy in.
 */
export declare class InteractionAiProcessor {
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
     * Generate the fixed candidate set of reply drafts. Rate limits retry with
     * backoff; an unparseable output surfaces immediately so the UI can offer
     * its retry button.
     * @param request - the reply request.
     * @returns the drafts with their provenance.
     */
    replyDrafts(request: InteractionReplyRequest): Promise<InteractionReplyResult>;
    /**
     * Classify one batch of messages. A garbled batch degrades to an empty
     * entry list (the caller leaves those messages unknown) instead of
     * failing — classification never blocks the local workflow.
     * @param request - the batch request.
     * @returns the sanitized entries with their provenance.
     */
    classify(request: InteractionClassifyRequest): Promise<InteractionClassifyResult>;
    /**
     * Extract one insight batch. A garbled batch reads as an empty batch; the
     * caller records it and keeps going.
     * @param request - the batch request.
     * @returns the sanitized batch with its provenance.
     */
    insights(request: InteractionInsightRequest): Promise<InteractionInsightResult>;
    /** One queued call with the shared rate-limit retry policy wrapped around it. */
    private queued;
}
//# sourceMappingURL=ai.d.ts.map