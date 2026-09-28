/**
 * AI processing for the review face: one explicit, controlled model call per
 * request behind the single-work diagnosis button and the period-report
 * button. Calls ride the same shared `llm` Service Definition, one-shot
 * pattern, queue, and rate-limit retry policy as every other AI face; nothing
 * is persisted here — the caller stores the markdown through the report
 * faces. Inputs are aggregate digests and front-truncated excerpts only;
 * full bodies never ride a report call.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ReviewAiResult, ReviewAnalyzeWorkRequest, ReviewGenerateReportRequest, ReviewMetrics, ReviewWorkDigest } from '../types.ts';
import type { AiCallPolicy } from '../gather/ai.ts';
/** Timeout reason code carried by aborted review AI calls. */
export declare const REVIEW_AI_TIMEOUT_CODE = "REVIEW_AI_TIMEOUT";
/** Prompt vocabulary version pinned into every result for provenance. */
export declare const REVIEW_PROMPT_VERSION = 1;
/** The fixed six report sections; the template is frozen so outputs stay snapshot-testable. */
export declare const REVIEW_REPORT_SECTIONS: readonly string[];
/**
 * Render one metrics record as a compact Chinese facts line, skipping null
 * metrics entirely so the model never sees faked zeros.
 * @param metrics - the metrics with nulls for missing platform fields.
 * @returns the facts line.
 */
export declare function metricsLine(metrics: ReviewMetrics): string;
/**
 * Render one work digest as the numbered block the report prompt embeds.
 * @param digest - the digest.
 * @param index - the 1-based position in its list.
 * @returns the block text.
 */
export declare function digestBlock(digest: ReviewWorkDigest, index: number): string;
/**
 * Validate one diagnosis request and frame its user prompt. The draft text
 * must already be front-truncated by the caller; an absent body is legal —
 * the diagnosis then argues from metrics and tags alone.
 * @param request - the raw diagnosis request.
 * @param maxInputChars - the combined prompt character cap.
 * @returns the framed user prompt.
 */
export declare function frameAnalyzeRequest(request: ReviewAnalyzeWorkRequest, maxInputChars: number): string;
/**
 * Build the system prompt for one single-work diagnosis.
 * @param request - the diagnosis request.
 * @returns the complete system prompt.
 */
export declare function analyzeSystemPrompt(request: ReviewAnalyzeWorkRequest): string;
/**
 * Validate one report request and frame its user prompt: aggregate summary
 * plus the top/bottom digest blocks, nothing else.
 * @param request - the raw report request.
 * @param maxInputChars - the combined prompt character cap.
 * @returns the framed user prompt.
 */
export declare function frameReportRequest(request: ReviewGenerateReportRequest, maxInputChars: number): string;
/**
 * Build the system prompt for one period report: the frozen six-section
 * template, with the audience section pinned to its placeholder while the
 * interaction view is absent.
 * @returns the complete system prompt.
 */
export declare function reportSystemPrompt(): string;
/**
 * The queued AI processor behind the review view; not itself a cordis
 * service — the gateway carries the `llm` injection and passes the resolved
 * policy in.
 */
export declare class ReviewAiProcessor {
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
     * Diagnose one work through the model. Rate limits retry with backoff;
     * every other failure surfaces immediately so the UI can offer its retry
     * button.
     * @param request - the diagnosis request.
     * @returns the markdown diagnosis with its provenance.
     */
    analyzeWork(request: ReviewAnalyzeWorkRequest): Promise<ReviewAiResult>;
    /**
     * Generate one period report through the model. The caller stores the
     * markdown; on failure it renders the data-only fallback itself.
     * @param request - the report request.
     * @returns the markdown report with its provenance.
     */
    generateReport(request: ReviewGenerateReportRequest): Promise<ReviewAiResult>;
    /** One queued call with the shared rate-limit retry policy wrapped around it. */
    private queued;
}
//# sourceMappingURL=ai.d.ts.map