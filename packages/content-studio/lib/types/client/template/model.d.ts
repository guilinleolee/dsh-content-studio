/**
 * Pure template-library helpers: body segmentation (code regions are never
 * touched), placeholder scanning, variable reconciliation, rendering, and
 * import-pack validation. The body is the source of truth — the variables
 * metadata follows it, never the other way around. Rendering output is plain
 * text: views must render it through text nodes (React's own escaping), never
 * through `innerHTML`.
 */
import type { TemplateCategory, TemplatePack, TemplateVariable } from '@deepseek-ai/dsh-content-outputs/types';
/**
 * Every template category, mirrored client-side: the bundle purity gate
 * forbids cross-plugin value imports, so the wire type stays type-only and
 * this frozen list carries the runtime order for the pickers.
 */
export declare const TEMPLATE_CATEGORIES: readonly ["topic", "creation", "publish", "calendar", "retro", "interaction", "persona", "benchmark", "intel", "dashboard"];
/** Chinese label of one template category; shared by the library, the picker, and the generate box. */
export declare const TEMPLATE_CATEGORY_LABELS: Readonly<Record<TemplateCategory, string>>;
/** Placeholder identifier shape inside a template body. */
export declare const TEMPLATE_VARIABLE_NAME_PATTERN: RegExp;
/** One placeholder occurrence the scanner found outside code regions. */
export interface PlaceholderMatch {
    readonly name: string;
    /** Match start offset within the segment the match came from. */
    readonly escaped: boolean;
}
/** One body fragment: verbatim code (fenced block or inline span) or substitutable text. */
export interface TemplateSegment {
    readonly code: boolean;
    readonly text: string;
}
/**
 * Split one body into text and code segments. Fenced blocks (``` or ~~~)
 * toggle per line; inline backtick spans are code within a text line.
 * Unclosed fences run to the end of the body.
 * @param body - the template Markdown body.
 * @returns the ordered segments.
 */
export declare function segmentTemplateBody(body: string): readonly TemplateSegment[];
/**
 * Scan one body for the variable names its placeholders introduce, in
 * first-occurrence order, deduplicated. Code regions never contribute.
 * @param body - the template Markdown body.
 * @returns the active variable names.
 */
export declare function scanTemplateVariables(body: string): readonly string[];
/** Result of aligning stored variable metadata with the body's placeholders. */
export interface ReconciledVariables {
    /** Metadata for every active placeholder, in body order. */
    readonly active: readonly TemplateVariable[];
    /** Metadata whose placeholder no longer appears in the body; kept, never auto-deleted. */
    readonly unused: readonly TemplateVariable[];
}
/**
 * Align variable metadata with the body's active placeholders: known names
 * keep their metadata, unknown names get fresh entries, and metadata whose
 * placeholder disappeared moves to `unused` (the editor shows it without
 * silently deleting it).
 * @param body - the template Markdown body.
 * @param existing - the stored variable metadata.
 * @returns the aligned metadata.
 */
export declare function reconcileVariables(body: string, existing: readonly TemplateVariable[]): ReconciledVariables;
/** Result of rendering one body: the output plus placeholders left visible. */
export interface TemplateRenderResult {
    /** The rendered plain text. */
    readonly output: string;
    /** Names left as visible placeholders: filled empty with no default, or unknown. */
    readonly unresolved: readonly string[];
}
/**
 * Render one body: substitutes placeholders outside code regions, falls back
 * to each variable's default value, and keeps an unfilled optional without a
 * default (or a placeholder with no metadata at all) visible — reporting it
 * in `unresolved`. `\{{name}}` renders as the literal `{{name}}`.
 * @param body - the template Markdown body.
 * @param values - the filled values keyed by variable name.
 * @param variables - the stored metadata supplying default values.
 * @returns the output and the unresolved names.
 */
export declare function renderTemplate(body: string, values: Readonly<Record<string, string>>, variables: readonly TemplateVariable[]): TemplateRenderResult;
/**
 * Names of body-active required variables without a filled value; the picker
 * disables its confirm button while any are missing. Only placeholders the
 * body actually uses count — a required declaration whose placeholder was
 * removed never blocks a pick.
 * @param body - the template Markdown body.
 * @param variables - the template's variable metadata.
 * @param values - the filled values keyed by variable name.
 * @returns the missing required names.
 */
export declare function missingRequired(body: string, variables: readonly TemplateVariable[], values: Readonly<Record<string, string>>): readonly string[];
/** Client-side pack validation result; the gateway re-validates every entry. */
export type TemplatePackParse = {
    readonly kind: 'ok';
    readonly pack: TemplatePack;
} | {
    readonly kind: 'invalid';
    readonly problem: string;
};
/**
 * Parse one import-file body into a pack: the envelope must identify itself
 * and both lists must be arrays. Entries are not deeply validated here — the
 * import face rejects each bad entry by name.
 * @param raw - exact file contents.
 * @returns the parsed pack or the reason it is not one.
 */
export declare function parseTemplatePack(raw: string): TemplatePackParse;
//# sourceMappingURL=model.d.ts.map