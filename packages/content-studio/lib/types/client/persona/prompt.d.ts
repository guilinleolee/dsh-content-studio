/**
 * The packed account-persona prompt (`persona-prompt@1`): the deterministic
 * rendering that turns one persona's fields and style into the text the
 * create face injects as its style layer. Pure functions of the persona
 * content — the wizard's live preview, the card digest display, and the
 * future create-side profile injection all read this one rendering, so the
 * prompt the user previews is byte-for-byte the prompt that gets injected.
 * Empty fields drop their whole line; AI-sourced values carry the inference
 * annotation; banned words and red lines render as structured hard
 * constraints, never blended into the prose.
 */
import type { PersonaEntry, PersonaField, PersonaFieldKey, PersonaStyle } from '@deepseek-ai/dsh-content-outputs/types';
/** Version stamped beside every rendering of the packed prompt. */
export declare const PERSONA_PROMPT_VERSION = "persona-prompt@1";
/** The annotation appended to AI-inferred values, in the prompt and the report alike. */
export declare const PERSONA_AI_MARK = "\uFF08AI \u63A8\u65AD\uFF0C\u4F9B\u53C2\u8003\uFF09";
/** The pieces of one persona the packed prompt renders. */
export interface PersonaPromptSource {
    readonly name: string;
    readonly revision: number;
    readonly fields: Readonly<Record<PersonaFieldKey, PersonaField>>;
    readonly style: PersonaStyle;
}
/**
 * Render the packed persona prompt for one persona. Same content in, same
 * bytes out — the create face's style layer and the wizard's preview cannot
 * drift apart.
 * @param source - the persona's name, revision, fields, and style.
 * @returns the packed prompt text (`persona-prompt@1`).
 */
export declare function renderPersonaPrompt(source: PersonaPromptSource): string;
/**
 * Render the packed prompt for a stored entry, pinned to that entry's saved
 * revision.
 * @param entry - the stored persona.
 * @returns the packed prompt text.
 */
export declare function renderEntryPrompt(entry: PersonaEntry): string;
//# sourceMappingURL=prompt.d.ts.map