/**
 * Template library file store: reads and writes the global template assets
 * under `<templatesRoot>` — `templates.json` for the records, `taxonomy.json`
 * for the shared tag list, and one full-record snapshot per manual save under
 * `history/<template-id>/<version>.json`. The library sits outside the
 * outputs library on purpose: templates are global skeleton assets, never
 * theme business data, so no outputs scan can mistake them for a project and
 * no theme teardown can sweep them away.
 *
 * Validation follows the persona store's rules: one malformed record never
 * hides the rest on read — it is named in `problems` and skipped — while
 * every write refuses to touch a file whose current state dropped entries,
 * so a save can never be the step that silently deletes user templates.
 */
import type { TemplateHistoryEntry, TemplateImportStrategy, TemplateImportSummary, TemplateInput, TemplatePack, TemplateRecord, TemplateStatus, TemplateTag, TemplateTaxonomy, TemplatesManifest, TemplatesSnapshot } from './types.ts';
/** Library file names under `<templatesRoot>`. */
export declare const TEMPLATES_FILENAME = "templates.json";
export declare const TAXONOMY_FILENAME = "taxonomy.json";
export declare const HISTORY_DIRNAME = "history";
/** Stored-shape caps enforced at the wire boundary; generous, never a product decision. */
export declare const TEMPLATE_MAX_NAME = 100;
export declare const TEMPLATE_MAX_DESCRIPTION = 500;
export declare const TEMPLATE_MAX_BODY = 100000;
export declare const TEMPLATE_MAX_VARIABLES = 50;
export declare const TEMPLATE_MAX_VARIABLE_NAME = 64;
export declare const TEMPLATE_MAX_VARIABLE_TEXT = 200;
export declare const TEMPLATE_MAX_VARIABLE_DESCRIPTION = 500;
export declare const TEMPLATE_MAX_VARIABLE_DEFAULT = 2000;
export declare const TEMPLATE_MAX_TAGS = 50;
export declare const TEMPLATE_MAX_TAG_NAME = 50;
export declare const TEMPLATE_MAX_CHANGE_NOTE = 200;
export declare const TEMPLATE_HISTORY_LIMIT = 20;
export declare const TEMPLATE_MAX_ID = 64;
export declare const TEMPLATE_MAX_TIMESTAMP = 40;
/** Placeholder identifier shape inside a template body. */
export declare const TEMPLATE_VARIABLE_NAME_PATTERN: RegExp;
/** One stored manifest parse: `empty` (no file yet), `invalid` (refuse-write state), or `ok`. */
export type TemplatesParse = {
    readonly kind: 'empty';
} | {
    readonly kind: 'invalid';
    readonly problem: string;
} | {
    readonly kind: 'ok';
    readonly manifest: TemplatesManifest;
    readonly problems: readonly string[];
};
/** One stored taxonomy parse; same three states as the manifest parse. */
export type TaxonomyParse = {
    readonly kind: 'empty';
} | {
    readonly kind: 'invalid';
    readonly problem: string;
} | {
    readonly kind: 'ok';
    readonly taxonomy: TemplateTaxonomy;
    readonly problems: readonly string[];
};
/**
 * Parse one stored templates manifest body. The version gate mirrors every
 * other store: future on-disk formats never load as current records.
 * @param raw - exact file contents; empty string means the file does not exist yet.
 * @returns the parse outcome with every dropped record named.
 */
export declare function parseTemplatesManifest(raw: string): TemplatesParse;
/**
 * Parse one stored taxonomy body, same rules as the manifest parse.
 * @param raw - exact file contents; empty string means the file does not exist yet.
 * @returns the parse outcome with every dropped tag named.
 */
export declare function parseTemplateTaxonomy(raw: string): TaxonomyParse;
/**
 * Read both library files leniently for the list and export projections.
 * @param root - absolute templates root directory.
 * @returns the valid records and tags, with every dropped stored record named.
 */
export declare function readTemplateLibrary(root: string): Promise<TemplatesSnapshot>;
/**
 * Validate one upsert input into its stored shape: the version increments
 * from the stored record, the status carries over (the archive face owns
 * transitions), and gateway-owned fields cannot be injected.
 * @param input - the upsert payload from the browser.
 * @param existing - the stored record when `input.id` addresses one.
 * @param storedNames - display names of every other stored record.
 * @param now - the save instant (ISO 8601).
 * @returns the stored record, or the reason the input is invalid.
 */
export declare function normalizeTemplateInput(input: TemplateInput, existing: TemplateRecord | undefined, storedNames: readonly string[], now: string): {
    record?: TemplateRecord;
    detail?: string;
};
/**
 * Upsert one template under a file lock, atomically: the version increments
 * and one full-record snapshot lands in `history/` before the manifest
 * commits. Creating with an id that is absent from the manifest rejects — a
 * stale client must reload, not resurrect a deleted template.
 * @param root - absolute templates root directory.
 * @param input - the upsert payload from the browser.
 * @param now - the save instant (ISO 8601); defaults to the current time.
 * @returns the stored record.
 */
export declare function putTemplateFile(root: string, input: TemplateInput, now?: string): Promise<TemplateRecord>;
/**
 * Flip one template's lifecycle state without a content save: archiving and
 * restoring are bookkeeping, not edits, so no snapshot is written.
 * @param root - absolute templates root directory.
 * @param id - the template to update; unknown ids reject.
 * @param status - the next lifecycle state.
 * @param now - the transition instant (ISO 8601); defaults to the current time.
 * @returns the stored record.
 */
export declare function setTemplateStatusFile(root: string, id: string, status: TemplateStatus, now?: string): Promise<TemplateRecord>;
/**
 * Remove one template and its whole history directory under a file lock;
 * there is no file left to dangle. Removing an unknown id is a no-op.
 * @param root - absolute templates root directory.
 * @param id - the template to remove.
 */
export declare function deleteTemplateFile(root: string, id: string): Promise<void>;
/**
 * Replace the shared tag list wholesale under a file lock, stripping every
 * reference to a removed tag from the stored records in the same commit —
 * a template never carries a dangling `tagIds` entry.
 * @param root - absolute templates root directory.
 * @param tags - the complete next tag list; names must be unique.
 * @returns the stored tag list.
 */
export declare function putTemplateTagsFile(root: string, tags: readonly TemplateTag[]): Promise<readonly TemplateTag[]>;
/**
 * Read one template's history snapshots, newest version first.
 * @param root - absolute templates root directory.
 * @param id - the template whose history to read.
 * @returns the valid snapshots; unreadable or malformed files are skipped.
 */
export declare function readTemplateHistory(root: string, id: string): Promise<readonly TemplateHistoryEntry[]>;
/**
 * Build the portable pack document for the given ids (every template when
 * `ids` is empty), reading leniently like the list projection.
 * @param root - absolute templates root directory.
 * @param ids - the template ids to export; empty exports the whole library.
 * @param exportedAt - the export instant (ISO 8601).
 * @returns the pack document for the caller to hand the browser.
 */
export declare function exportTemplatePack(root: string, ids: readonly string[], exportedAt: string): Promise<TemplatePack>;
/**
 * Import one pack document under a file lock. Entries are independent: one
 * rejected entry is named in the summary's `failed` list while the rest land.
 * A conflicting id resolves per the strategy — `skip` keeps the local record,
 * `overwrite` replaces it (new version, new snapshot), `rename` stores the
 * incoming entry under a fresh id and a suffixed unique name. Every stored
 * entry also writes its snapshot so the history directory starts populated.
 * @param root - absolute templates root directory.
 * @param pack - the parsed pack document from the browser.
 * @param strategy - the conflict resolution for ids that already exist.
 * @param now - the import instant (ISO 8601); defaults to the current time.
 * @returns the per-bucket summary.
 */
export declare function importTemplatePack(root: string, pack: TemplatePack, strategy: TemplateImportStrategy, now?: string): Promise<TemplateImportSummary>;
//# sourceMappingURL=store.d.ts.map