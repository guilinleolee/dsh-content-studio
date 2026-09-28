/**
 * AI processing for the global template library: one explicit, controlled
 * model call per request behind the 模板库 view's explicit buttons (skeleton
 * generation, body optimization, variable extraction from a business
 * instance). Calls ride the shared `llm` Service Definition through the same
 * one-shot helper as the gather, competitor, create, and persona faces; the
 * processor runs one call at a time and retries only upstream rate limits.
 * Nothing is persisted here: the caller previews the draft and stores it
 * only through an explicit save.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { TemplateAiDraft, TemplateAiRequest, TemplateAiResult, TemplateVariable } from './types.ts';
import { type GatherAiConfig } from '../gather/ai.ts';
/** Timeout reason code carried by aborted template AI calls. */
export declare const TEMPLATE_AI_TIMEOUT_CODE = "TEMPLATE_AI_TIMEOUT";
/** Prompt version of the skeleton generation face. */
export declare const TEMPLATE_GENERATE_PROMPT_VERSION = "template-generate@1";
/** Prompt version of the body optimization face. */
export declare const TEMPLATE_OPTIMIZE_PROMPT_VERSION = "template-optimize@1";
/** Prompt version of the variable extraction face. */
export declare const TEMPLATE_EXTRACT_PROMPT_VERSION = "template-extract@1";
/** Field-level draft texts before the per-variable validation. */
interface RawDraftVariables {
    readonly variables: TemplateVariable[];
    readonly problems: string[];
}
/**
 * Parse the model's variable list: entries with an unusable name drop into
 * `problems`, duplicate names keep their first occurrence, text fields are
 * trimmed and capped. The body stays the source of truth — a caller
 * reconciles these entries against the placeholders actually present.
 * @param value - the raw `variables` value from the model answer.
 * @returns the surviving variables plus every rejection.
 */
export declare function parseTemplateVariablesOutput(value: unknown): RawDraftVariables;
/**
 * Parse a generation answer into its full draft. A missing or oversized body
 * rejects; the suggested name and description are advisory and may be empty.
 * @param text - exact model text output.
 * @returns the draft plus every field-level rejection.
 */
export declare function parseTemplateGenerateOutput(text: string): {
    draft: TemplateAiDraft;
    problems: string[];
};
/**
 * Parse an optimization answer into its body-only draft. The caller merges
 * the body into its editor; name, description, and variables stay untouched.
 * @param text - exact model text output.
 * @returns the draft plus an empty problem list (kept for shape parity).
 */
export declare function parseTemplateOptimizeOutput(text: string): {
    draft: TemplateAiDraft;
    problems: string[];
};
/**
 * Parse an extraction answer into its skeleton draft: body plus the
 * proposed variable metadata.
 * @param text - exact model text output.
 * @returns the draft plus every field-level rejection.
 */
export declare function parseTemplateExtractOutput(text: string): {
    draft: TemplateAiDraft;
    problems: string[];
};
/**
 * The queued AI processor owned by the content-outputs gateway; not itself a
 * cordis service — the gateway carries the `llm` injection and the config.
 */
export declare class TemplateAiProcessor {
    private readonly ctx;
    /** Validated policy, defaults resolved once at construction. */
    private readonly resolved;
    /** Single-slot call queue: one model call at a time, per the plugin AI policy. */
    private readonly queue;
    /**
     * @param ctx - context exposing the registered LLM service.
     * @param config - declared AI policy; defaults resolve here, fail loud.
     */
    constructor(ctx: Context, config: GatherAiConfig);
    /**
     * Run one template AI operation. Rate limits retry with backoff; every
     * other failure surfaces immediately so the UI can offer its own retry.
     * @param request - the operation and its input.
     * @returns the draft with its prompt version.
     */
    process(request: TemplateAiRequest): Promise<TemplateAiResult>;
    /** One queued call with the rate-limit retry policy wrapped around it. */
    private enqueue;
    /** Draft a whole skeleton from a natural-language description. */
    private generate;
    /** Rewrite one existing body per the user's instruction. */
    private optimize;
    /** Distill one business instance into a skeleton with placeholders. */
    private extract;
    /** One framed one-shot call under the resolved policy. */
    private call;
}
export {};
//# sourceMappingURL=ai.d.ts.map