/**
 * On-disk store for the create write face: the `_create.json` manifest and
 * the publishing handoff under `outputs/<theme>/`. Paths enter through the
 * guards here — a theme is one plain directory name and a deliverable is one
 * plain file name at the theme root, so `..`, absolute paths, and separator
 * tricks cannot reach anything else. Manifest and metadata writes serialize
 * through the shared file lock and commit with an atomic rename (with the
 * Windows rename-pinning retry the gather write face established). A
 * malformed manifest rejects whole: unlike gather materials, a version list
 * must stay consistent, so no entry is ever dropped or repaired.
 */
import type { CreateManifest, CreateTemplate, CreateTemplateInput, OutputMetadata } from '../types.ts';
/** Template bank file name at the outputs library root. */
export declare const CREATE_TEMPLATES_FILENAME = "_templates.json";
/** The placeholder whitelist a custom template body may carry. */
export declare const CREATE_TEMPLATE_PLACEHOLDERS: readonly string[];
/** Manifest file name inside the theme's `assets/` directory. */
export declare const CREATE_MANIFEST_FILENAME = "_create.json";
/** Hard version-count cap enforced on write; the client prunes to its own lower quota. */
export declare const CREATE_MAX_STORED_VERSIONS = 60;
/** Hard per-version size cap; generation and drafts stay far below it. */
export declare const CREATE_MAX_CONTENT_CHARS = 400000;
/** Whether the manifest envelope and every version conform; one violation rejects whole. */
export declare function assertCreateManifest(manifest: CreateManifest): void;
/**
 * Parse and validate one manifest document. The manifest rejects whole on
 * any violation — a truncated or hand-edited file never loads as partial
 * state; the caller shows the problem and keeps the last known state.
 * @param raw - exact file contents.
 * @returns the manifest, or null with a problem when it does not conform.
 */
export declare function parseCreateManifest(raw: string): {
    manifest: CreateManifest | null;
    problems: string[];
};
/**
 * Read the theme's creation state: the validated manifest plus the current
 * draft body (`assets/<contentId>.md`). A missing state reads as empty
 * without problems; a malformed manifest reads as empty with the rejection
 * named, so the UI can warn instead of silently overwriting it.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the manifest (or null) and the draft body (or null).
 */
export declare function readCreateStateFile(root: string, theme: string): Promise<{
    manifest: CreateManifest | null;
    draft: string | null;
    problems: string[];
}>;
/**
 * Replace the theme's creation manifest with an atomic, locked commit.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param manifest - the complete next manifest.
 */
export declare function writeCreateStateFile(root: string, theme: string, manifest: CreateManifest): Promise<void>;
/**
 * Resolve and guard one theme-root file path.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - plain deliverable file name at the theme root.
 * @returns the absolute file path.
 * @throws when the theme or file name could escape the theme directory.
 */
export declare function resolveThemeFilePath(root: string, theme: string, file: string): string;
/**
 * Publish one deliverable: copy the given content to the theme root under an
 * atomic, locked commit. A collision rejects instead of overwriting unless
 * `overwrite` is set — the caller confirms with the user first. The metadata
 * registration is a separate, later write so a failure between the two steps
 * is recoverable through the register retry.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param request - file name, complete content, and the overwrite decision.
 * @returns the stored root file name.
 */
export declare function publishFinalFile(root: string, theme: string, request: {
    file: string;
    content: string;
    overwrite: boolean;
}): Promise<string>;
/**
 * Validate one metadata document on the create write path: the known fields
 * keep the scanner's format-0 rules, unknown fields pass through untouched,
 * and the optional `create` bookkeeping must be well-typed when present.
 * @param metadata - the metadata the caller wants stored.
 */
export declare function assertOutputMetadata(metadata: object): void;
/**
 * Resolve and guard one theme's `.dsh-output.json` path.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the absolute metadata path.
 * @throws when the theme name could escape the library root.
 */
export declare function resolveThemeMetadataPath(root: string, theme: string): string;
/**
 * Read and validate the theme's `.dsh-output.json`.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the metadata, or null with the violation named when the file is
 *   absent (null metadata, no problem) or malformed (both set).
 */
export declare function readCreateMetadataFile(root: string, theme: string): Promise<{
    metadata: OutputMetadata | null;
    problem: string | null;
}>;
/**
 * Register one publish into the theme's metadata: flip the status to
 * `published` and mirror the creation bookkeeping. The deliverable must
 * already sit at the theme root — this is the retry half of the publish
 * handoff, never the copy.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param request - the root file name and the version being published.
 */
export declare function registerCreatePublishFile(root: string, theme: string, request: {
    file: string;
    version: number;
}): Promise<void>;
/**
 * Write the theme's `.dsh-output.json` with an atomic, locked commit after
 * validating the known fields and the creation bookkeeping.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param metadata - the complete next metadata record.
 */
export declare function writeOutputMetadataFile(root: string, theme: string, metadata: OutputMetadata | Record<string, unknown>): Promise<void>;
/**
 * Collect the asset files the theme's creation state references, for the
 * gather retention exemption: a gather material whose snapshot file is
 * referenced by the create workbench must never be trimmed as stale.
 * A malformed create manifest contributes an empty set — trimming then runs
 * by its own rules, which is the safe direction (worst case a referenced
 * snapshot ages out; the versions carry the text).
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the referenced asset file names.
 */
export declare function collectCreateReferencedFiles(root: string, theme: string): Promise<Set<string>>;
/**
 * List the theme's non-system asset file names, sorted. Serves the material
 * reference list and the image inserter; `_`-prefixed system files (the
 * gather and create manifests) never appear.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the sorted plain file names.
 */
export declare function listAssetFiles(root: string, theme: string): Promise<string[]>;
/**
 * Validate one custom template body: non-empty, and its `{{…}}` placeholders
 * stay inside the whitelist — an unknown placeholder fails the save here and
 * the run there, never silently misfills.
 * @param body - the template body.
 * @throws when the body is empty or carries an unknown placeholder.
 */
export declare function assertTemplateBody(body: string): void;
/**
 * Read the global template bank. A missing file reads as empty; a malformed
 * bank reads as empty with the rejection named, so the manager can warn
 * instead of silently overwriting it.
 * @param root - absolute outputs library root.
 * @returns the valid templates plus every rejection named.
 */
export declare function readCreateTemplatesFile(root: string): Promise<{
    templates: CreateTemplate[];
    problems: string[];
}>;
/**
 * Upsert one custom template: an absent id creates (revision 1), a present
 * id updates and bumps the revision. The bank rewrites with an atomic,
 * locked commit; the read-modify-write window is the same granularity the
 * gather manifest face accepts for this single-user data class.
 * @param root - absolute outputs library root.
 * @param input - the template facts; timestamps and the revision are store-managed.
 * @returns the stored templates.
 */
export declare function putCreateTemplateFile(root: string, input: CreateTemplateInput): Promise<CreateTemplate[]>;
/**
 * Delete one custom template; deleting an unknown id is a no-op.
 * @param root - absolute outputs library root.
 * @param id - the template id.
 * @returns the stored templates.
 */
export declare function deleteCreateTemplateFile(root: string, id: string): Promise<CreateTemplate[]>;
//# sourceMappingURL=store.d.ts.map