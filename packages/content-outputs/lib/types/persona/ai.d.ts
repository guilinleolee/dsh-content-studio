/**
 * AI processing for the persona write face: one explicit, controlled model
 * call per request behind the 画像 view's explicit buttons (field fill,
 * résumé extraction, report generation). Calls ride the shared `llm` Service
 * Definition through the same one-shot helper as the gather and competitor
 * faces; the processor runs one call at a time and retries only upstream
 * rate limits. Nothing is persisted here: the caller previews the result and
 * writes adopted values back through the persona store.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { PersonaAiRequest, PersonaAiResult, PersonaEntry, PersonaFieldKey } from '../types.ts';
import { type GatherAiConfig } from '../gather/ai.ts';
/** Timeout reason code carried by aborted persona AI calls. */
export declare const PERSONA_AI_TIMEOUT_CODE = "PERSONA_AI_TIMEOUT";
/** Prompt version of the blank-field fill face; stamped into adopted fields' provenance. */
export declare const PERSONA_FILL_PROMPT_VERSION = "persona-fill@1";
/** Prompt version of the résumé extraction face; stamped into adopted fields' provenance. */
export declare const PERSONA_RESUME_PROMPT_VERSION = "persona-resume@1";
/** Prompt version of the report face; stamped onto the stored report. */
export declare const PERSONA_REPORT_PROMPT_VERSION = "persona-report@1";
/**
 * Parse a fill or résumé answer into candidate field values. Keys outside
 * `allowed` are dropped (the fill face can never produce `whoAmI`), values
 * are trimmed and capped, empty values are dropped: the caller previews what
 * survives.
 * @param text - exact model text output.
 * @param allowed - the field keys the caller may receive.
 * @returns the candidate values keyed by field.
 */
export declare function parsePersonaFieldsOutput(text: string, allowed: readonly PersonaFieldKey[]): Partial<Record<PersonaFieldKey, string>>;
/**
 * Parse the report answer into its Markdown body: fenced wrappers are
 * stripped, and an empty body rejects.
 * @param text - exact model text output.
 * @returns the report Markdown.
 */
export declare function parsePersonaReportOutput(text: string): string;
/**
 * Render one saved entry as the report prompt's fact sheet: every non-empty
 * field with its provenance mark, the style and hard constraints, and the
 * embedded text assets. AI-sourced values carry the "（AI 推断，供参考）"
 * annotation so the report never presents an inference as a user fact.
 * @param entry - the saved persona entry.
 * @returns the plain-text fact sheet.
 */
export declare function buildFactsText(entry: PersonaEntry): string;
/**
 * The queued AI processor owned by the content-outputs gateway; not itself a
 * cordis service — the gateway carries the `llm` injection and the config.
 */
export declare class PersonaAiProcessor {
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
     * Run one persona AI operation. Rate limits retry with backoff; every
     * other failure surfaces immediately so the UI can offer its own retry.
     * @param request - the operation and its input.
     * @returns the structured result with its prompt version.
     */
    process(request: PersonaAiRequest): Promise<PersonaAiResult>;
    /** One queued call with the rate-limit retry policy wrapped around it. */
    private enqueue;
    /** Fill blank fields from the known ones; `whoAmI` is never fillable here. */
    private fill;
    /** Extract structured fields from one résumé / background text. */
    private resume;
    /** Generate the full report from one saved entry's facts. */
    private report;
    /** One framed one-shot call under the resolved policy. */
    private call;
}
//# sourceMappingURL=ai.d.ts.map