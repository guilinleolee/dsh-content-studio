/**
 * The persona wizard's editable form model: the browser-side shape between
 * the wire `PersonaEntry` and the four-step form. Every wire round-trip goes
 * through {@link formFromEntry} / {@link inputFromForm}, and every field
 * edit flips its provenance back to `user` — the AI never stays the source
 * of a value the user has touched.
 */
import type { PersonaAccountStage, PersonaEntry, PersonaField, PersonaFieldKey, PersonaFieldSource, PersonaId, PersonaInput, PersonaLink, PersonaPlatform, PersonaReport, PersonaStylePreset, PersonaStyleStrength } from '@deepseek-ai/dsh-content-outputs/types';
/**
 * The persona vocabulary the browser owns: the platform, field, and style
 * enum tables for the pickers, the packed prompt preview, and the fill
 * scope. The gateway carries the same keys for wire validation and the
 * digest; the sync between the two sides is pinned by a cross-check test,
 * because the bundle purity gate forbids importing the gateway's tables as
 * values here.
 */
/** Every persona platform, in picker order; the competitor face's word list extended. */
export declare const PERSONA_PLATFORMS: readonly ["xhs", "douyin", "bili", "zhihu", "wechat", "channels", "weibo", "toutiao"];
/** Chinese label of one persona platform. */
export declare const PERSONA_PLATFORM_LABELS: Readonly<Record<PersonaPlatform, string>>;
/** Every persona field key, in wizard order. */
export declare const PERSONA_FIELD_KEYS: readonly ["whoAmI", "audience", "oneLiner", "niche", "goal", "monetize", "contentValue", "cadence", "phrases"];
/** Chinese label of one persona field. */
export declare const PERSONA_FIELD_LABELS: Readonly<Record<PersonaFieldKey, string>>;
/** Field keys the generic fill operation must never produce: the subject background is a fact only the user or the résumé face supplies. */
export declare const PERSONA_FILL_PROHIBITED: readonly PersonaFieldKey[];
/** Every style preset, in picker order. */
export declare const PERSONA_STYLE_PRESETS: readonly ["professional", "friendly", "humor", "concise", "narrative", "hardcore", "empathy"];
/** Chinese label of one style preset. */
export declare const PERSONA_STYLE_PRESET_LABELS: Readonly<Record<PersonaStylePreset, string>>;
/** One editable structured field: the text plus the provenance it keeps. */
export interface PersonaFormField {
    value: string;
    source: PersonaFieldSource;
    aiMeta: PersonaField['aiMeta'];
}
/** The wizard's editable form. Text areas hold raw text; word lists are parsed on save. */
export interface PersonaForm {
    editingId: PersonaId | null;
    clonedFrom: PersonaId | null;
    name: string;
    platforms: PersonaPlatform[];
    accountStage: PersonaAccountStage;
    fields: Record<PersonaFieldKey, PersonaFormField>;
    links: PersonaLink[];
    siteUrl: string;
    sitePastedText: string;
    preset: PersonaStylePreset | null;
    customText: string;
    strength: PersonaStyleStrength;
    bannedWordsText: string;
    redLinesText: string;
    resumeText: string;
    resumeName: string | null;
    resumeConsent: boolean;
    /** The stored report rides the form untouched: editing it is a separate save path. */
    report: PersonaReport | null;
}
/**
 * The empty form of a brand-new persona.
 * @returns the form with every field blank, no editing target, and no stored report.
 */
export declare function emptyForm(): PersonaForm;
/**
 * Build the form from a stored entry.
 * @param entry - the stored persona.
 * @param options - `clone: true` builds a clone draft: no editing id, the
 *   source recorded as `clonedFrom`, and the report remapped to the clone's
 *   revision 1 so the staleness banner stays correct.
 * @returns the editable form.
 */
export declare function formFromEntry(entry: PersonaEntry, options?: {
    clone?: boolean;
}): PersonaForm;
/**
 * Parse one textarea's word list: entries separated by newlines, Chinese or
 * ASCII commas and semicolons (the join separator on the way back into the
 * form); blanks drop.
 * @param text - the raw textarea text.
 * @returns the trimmed, non-empty entries.
 */
export declare function parseWordList(text: string): string[];
/**
 * Build the upsert payload from the form. Empty field texts become `null`
 * values; a touched field keeps `user` provenance and loses any AI metadata.
 * @param form - the wizard form.
 * @returns the gateway upsert payload (digest, revision, timestamps are gateway-owned).
 */
export declare function inputFromForm(form: PersonaForm): PersonaInput;
/**
 * Adopt one AI candidate into the form: the value lands with `ai` source
 * and the prompt's provenance stamped at the adoption instant.
 * @param form - the wizard form (mutated copy returned).
 * @param key - the field to fill.
 * @param value - the adopted text.
 * @param promptVersion - the AI prompt that produced the value.
 * @returns the next form.
 */
export declare function adoptField(form: PersonaForm, key: PersonaFieldKey, value: string, promptVersion: string): PersonaForm;
//# sourceMappingURL=model.d.ts.map