/**
 * AI processing for the create write face: one explicit, controlled model
 * call per request behind the workbench's generate and rewrite buttons. Calls
 * ride the same shared `llm` Service Definition, one-shot pattern, queue, and
 * rate-limit retry policy as the gather and competitor AI faces; nothing is
 * persisted here — the caller writes the text back as a version snapshot.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { CreateEvaluateRequest, CreateEvaluation, CreateGenerateRequest, CreateRewriteRequest, CreateAiResult } from '../types.ts';
import type { AiCallPolicy } from '../gather/ai.ts';
/** Timeout reason code carried by aborted create AI calls. */
export declare const CREATE_AI_TIMEOUT_CODE = "CREATE_AI_TIMEOUT";
/** Prompt vocabulary version pinned into every result for provenance. */
export declare const CREATE_PROMPT_VERSION = 1;
/**
 * Build the system prompt for one generation: the type brief, the style
 * provenance, and the shared output discipline.
 * @param request - the generation request.
 * @returns the complete system prompt.
 */
export declare function generateSystemPrompt(request: CreateGenerateRequest): string;
/**
 * Frame the user prompt for one generation: identity facts first, then
 * audience, points, and reference material.
 * @param request - the generation request.
 * @returns the complete user prompt.
 */
export declare function generateFramedPrompt(request: CreateGenerateRequest): string;
/**
 * Build the system prompt for one rewrite: the operation brief plus the
 * shared discipline (keep facts, output only the rewritten text).
 * @param request - the rewrite request.
 * @returns the complete system prompt.
 */
export declare function rewriteSystemPrompt(request: CreateRewriteRequest): string;
/**
 * Validate one generation request and frame it; shared by the remote face.
 * @param request - the raw request.
 * @param maxInputChars - the combined user-prompt character cap.
 * @returns the framed user prompt.
 */
export declare function frameGenerateRequest(request: CreateGenerateRequest, maxInputChars: number): string;
/**
 * Validate one rewrite request; shared by the remote face.
 * @param request - the raw request.
 * @param maxInputChars - the selection character cap.
 * @returns the validated selection text.
 */
export declare function validateRewriteRequest(request: CreateRewriteRequest, maxInputChars: number): string;
/**
 * Fill one custom template body: whitelisted placeholders take the request
 * facts, and any placeholder that survives the fill rejects the run.
 * @param body - the validated template body.
 * @param request - the generation request.
 * @returns the filled user prompt.
 */
export declare function fillCustomTemplate(body: string, request: CreateGenerateRequest): string;
/**
 * Parse a variant-batch answer into its variants. The model output is a JSON
 * boundary: anything that is not the requested array of exactly `expected`
 * non-empty strings rejects here.
 * @param text - exact model text output.
 * @param expected - the requested variant count.
 * @returns the trimmed variants.
 */
export declare function parseCreateVariants(text: string, expected: number): string[];
/**
 * Build the system prompt for one evaluation: G-Eval style — list each
 * dimension's rubric checkpoints, judge, then emit the fixed JSON.
 * @param request - the evaluation request.
 * @returns the complete system prompt.
 */
export declare function evaluateSystemPrompt(request: CreateEvaluateRequest): string;
/**
 * Parse an evaluation answer into the structured result. Model output is a
 * JSON boundary: any missing dimension, unknown grade, or empty reason
 * rejects here.
 * @param text - exact model text output.
 * @param model - the model identity recorded into the result.
 * @returns the validated evaluation with its provenance.
 */
export declare function parseCreateEvaluation(text: string, model: string): CreateEvaluation;
/**
 * Validate one evaluation request; shared by the remote face.
 * @param request - the raw request.
 * @param maxInputChars - the text character cap.
 * @returns the validated text.
 */
export declare function validateEvaluateRequest(request: CreateEvaluateRequest, maxInputChars: number): string;
/**
 * The queued AI processor behind the create workbench; not itself a cordis
 * service — the gateway carries the `llm` injection and passes the resolved
 * policy in.
 */
export declare class CreateAiProcessor {
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
     * Generate one draft (or, for the short content types, one variant batch)
     * through the model. Rate limits retry with backoff; every other failure
     * surfaces immediately so the UI can offer its retry button.
     * @param request - the generation request; `count: 3` is short-types only.
     * @returns the draft text, the split variants when batched, and provenance.
     */
    generate(request: CreateGenerateRequest): Promise<CreateAiResult>;
    /**
     * Rewrite one selection through the model, under the same retry policy.
     * @param request - the rewrite request.
     * @returns the rewritten text with its provenance.
     */
    rewrite(request: CreateRewriteRequest): Promise<CreateAiResult>;
    /**
     * Evaluate one draft through the model: four rubric dimensions plus an
     * overall advisory grade. Advisory only — the result never blocks
     * anything, and a failure surfaces to the caller as a normal error.
     * @param request - the evaluation request.
     * @returns the structured evaluation with its provenance.
     */
    evaluate(request: CreateEvaluateRequest): Promise<CreateEvaluation>;
    /** One queued call with the shared rate-limit retry policy wrapped around it. */
    private queued;
}
//# sourceMappingURL=ai.d.ts.map