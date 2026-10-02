/**
 * Persona file store: reads and writes the account-persona manifest
 * directly on every call. The file lives at the library root under
 * `_personas.json` — the `_` prefix keeps the outputs scanner treating it as
 * a system entry, and one library directory stays the whole content-creation
 * surface on disk. Entry text is embedded; a persona never references a
 * file, so the manifest alone is a complete backup and nothing can dangle.
 *
 * Validation follows the same rule as the outputs scanner: one malformed
 * record never hides the rest — it is named in `problems` and skipped. Every
 * write, though, refuses to touch a file whose current state dropped
 * entries: a save must never be the step that silently deletes user
 * personas.
 */
import type { PersonaEntry, PersonaInput, PersonaReport, PersonasManifest, PersonasSnapshot } from './types.ts';
/** System file name of the persona manifest at the library root. */
export declare const PERSONAS_FILENAME = "_personas.json";
/** Stored-shape caps enforced at the wire boundary; generous, never a product decision. */
export declare const PERSONA_MAX_NAME = 100;
/** Character cap of one persona field's value. */
export declare const PERSONA_MAX_FIELD_VALUE = 5000;
/** Character cap of the free-text fields (custom style text, resume text, red lines). */
export declare const PERSONA_MAX_TEXT = 100000;
/** Cap on how many links one persona entry carries. */
export declare const PERSONA_MAX_LINKS = 10;
/** Character cap of one link's URL. */
export declare const PERSONA_MAX_URL = 2000;
/** Character cap of one link's display text. */
export declare const PERSONA_MAX_LINK_TEXT = 5000;
/** Cap on how many entries a banned-words or style word list carries. */
export declare const PERSONA_MAX_WORD_ITEMS = 50;
/** Character cap of one word inside a word list. */
export declare const PERSONA_MAX_WORD = 100;
/** Character cap of the stored AI report digest. */
export declare const PERSONA_MAX_DIGEST = 200;
/** Character cap of persona and related record ids. */
export declare const PERSONA_MAX_ID = 64;
/** Character cap of the stored prompt-version string. */
export declare const PERSONA_MAX_PROMPT_VERSION = 100;
/** Character cap of stored ISO-8601 timestamp strings. */
export declare const PERSONA_MAX_TIMESTAMP = 40;
/** One stored manifest parse: `empty` (no file yet), `invalid` (refuse-write state), or `ok`. */
export type PersonasParse = {
    readonly kind: 'empty';
} | {
    readonly kind: 'invalid';
    readonly problem: string;
} | {
    readonly kind: 'ok';
    readonly manifest: PersonasManifest;
    readonly problems: readonly string[];
};
/**
 * Parse one stored manifest body. Future on-disk formats never load as
 * current records: the version gate mirrors the outputs metadata contract
 * (one backend, one format), and invalid JSON is its own refuse-write state.
 * @param raw - exact file contents; empty string means the file does not exist yet.
 * @returns the parse outcome with every dropped entry named.
 */
export declare function parsePersonasManifest(raw: string): PersonasParse;
/**
 * Read the manifest for the list projection.
 * @param file - absolute `_personas.json` path; a missing file is empty.
 * @returns the snapshot with entries newest-first and every bad record named.
 */
export declare function readPersonasFile(file: string): Promise<PersonasSnapshot>;
/**
 * The deterministic ≤200-character style summary stored as `digest`: the
 * identity, style, and intent fields joined in a fixed order, the banned
 * words and red lines never included, truncated, and suffixed with the
 * revision the summary was computed from. Same content in, same bytes out.
 * @param entry - the entry's name, fields, style, and revision.
 * @returns the digest text, at most {@link PERSONA_MAX_DIGEST} characters.
 */
export declare function personaDigest(entry: Pick<PersonaEntry, 'name' | 'fields' | 'style'> & {
    readonly revision: number;
}): string;
/**
 * Validate one upsert input into its stored shape; the revision increments
 * from the stored entry, the digest derives from the stored content, and a
 * clone (`clonedFrom` on a fresh entry) carries a fresh id and revision 1.
 * @param input - the upsert payload from the browser.
 * @param existing - the stored entry when `input.id` addresses one.
 * @param now - the save instant (ISO 8601).
 * @returns the stored entry, or the reason the input is invalid.
 */
export declare function normalizePersonaInput(input: PersonaInput, existing: PersonaEntry | undefined, now: string): {
    entry?: PersonaEntry;
    detail?: string;
};
/**
 * Upsert one persona under a file lock, atomically: the revision increments,
 * the digest recomputes, and the timestamps are gateway-owned. Creating with
 * an id that is absent from the manifest rejects — a stale client must
 * reload, not resurrect a deleted persona.
 * @param file - absolute `_personas.json` path.
 * @param input - the upsert payload from the browser.
 * @param now - the save instant (ISO 8601); defaults to the current time.
 * @returns the stored entry.
 */
export declare function putPersonaFile(file: string, input: PersonaInput, now?: string): Promise<PersonaEntry>;
/**
 * Replace one persona's report without touching its form state: the
 * revision and digest stay, `updatedAt` moves. Report edits are a separate
 * save path from form saves exactly so the staleness banner (`revision >
 * sourceRevision`) tracks form changes only.
 * @param file - absolute `_personas.json` path.
 * @param id - the persona to update; unknown ids reject.
 * @param report - the complete next report.
 * @param now - the save instant (ISO 8601); defaults to the current time.
 * @returns the stored entry.
 */
export declare function putPersonaReportFile(file: string, id: string, report: PersonaReport, now?: string): Promise<PersonaEntry>;
/**
 * Remove one persona under a file lock; the embedded report goes with it,
 * and there is no file left to dangle. Removing an unknown id is a no-op.
 * @param file - absolute `_personas.json` path.
 * @param id - the persona to remove.
 */
export declare function deletePersonaFile(file: string, id: string): Promise<void>;
//# sourceMappingURL=store.d.ts.map