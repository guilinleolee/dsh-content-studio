/**
 * AI processing for the competitor write face: three explicit, controlled
 * operations behind the competitors view — single-work teardown, single-
 * account panorama report, and two-account face-off. Calls ride the shared
 * `llm` Service Definition through the same one-shot helper the gather face
 * established; the queue runs one call at a time and retries only upstream
 * rate limits. Nothing persists here: the caller writes results back into
 * the manifest and asset files. Report digests carry aggregated facts only —
 * raw work text never enters a report prompt.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { CompetitorAnalyzeWorkRequest, CompetitorAnalyzeWorkResult, CompetitorReportRequest, CompetitorReportResult, CompetitorWorkAnalysisResult } from '../types.ts';
/** Timeout reason code carried by aborted competitor AI calls. */
export declare const COMPETITOR_AI_TIMEOUT_CODE = "COMPETITOR_AI_TIMEOUT";
/** The comment-insight value every comment-less teardown carries. */
export declare const COMMENT_INSIGHT_UNAVAILABLE = "unavailable";
/**
 * Parse the model's JSON answer into the structured teardown result. Model
 * output is a JSON boundary: anything that is not the requested object
 * rejects here.
 * @param text - exact model text output.
 * @returns the validated teardown result.
 */
export declare function parseCompetitorAnalysisOutput(text: string): CompetitorWorkAnalysisResult;
/**
 * Parse the model's answer into the report result: the markdown body only.
 * @param text - exact model text output.
 * @returns the non-empty markdown report.
 */
export declare function parseCompetitorReportOutput(text: string): CompetitorReportResult;
/**
 * The queued AI processor owned by the content-outputs gateway for the
 * competitors view; not itself a cordis service — the gateway carries the
 * `llm` injection and the config.
 */
export declare class CompetitorAiProcessor {
    private readonly ctx;
    /** Call policy shared with the gather face's resolved config. */
    private readonly policy;
    /** Single-slot call queue: one model call at a time, per the gather policy. */
    private readonly queue;
    /**
     * @param ctx - context exposing the registered LLM service.
     * @param config - declared AI policy; defaults resolve in the gather face's
     *   validation rules, so both faces stay on one policy.
     */
    constructor(ctx: Context, config: {
        provider?: string;
        model?: string;
        timeoutMs?: number;
        maxOutputTokens?: number;
        maxInputChars?: number;
    });
    /**
     * Tear down one work through the model. Rate limits retry with backoff;
     * every other failure surfaces immediately so the UI can offer its own
     * retry button.
     * @param request - the work's display facts, snapshot reference, and any
     *   user-pasted hot comments.
     * @param readSnapshot - reads one text file body (theme, file name).
     * @returns the structured teardown plus the full markdown report.
     */
    analyzeWork(request: CompetitorAnalyzeWorkRequest, readSnapshot: (theme: string, file: string) => Promise<string | undefined>): Promise<CompetitorAnalyzeWorkResult>;
    /**
     * Generate one report from aggregated account digests. Raw work text never
     * enters this call — the digests are the caller's aggregation.
     * @param request - one digest for an account report, exactly two for compare.
     * @returns the markdown report.
     */
    generateReport(request: CompetitorReportRequest): Promise<CompetitorReportResult>;
    /** One queued call with the shared rate-limit retry policy wrapped around it. */
    private enqueue;
    /** Gather the model input: snapshot text when present; a teardown needs some body. */
    private collectWorkText;
}
//# sourceMappingURL=ai.d.ts.map