/**
 * File storage for the publish face: the theme-side `assets/_publish.json`
 * manifest, the derived per-platform drafts under
 * `assets/publish/<taskId>/<platformId>.md`, the global
 * `_publish-index.json` aggregation aid, and the `_publish-profiles.json`
 * account cards. Every write is an atomic, writer-locked commit; every path
 * is guarded against leaving its directory.
 */
import type { PublishIndex, PublishIndexEntry, PublishManifest, PublishProfilesDoc, PublishPackage, PublishTask } from './types.ts';
/** Theme-side publish manifest file name (`_` keeps it out of the scanner). */
export declare const PUBLISH_MANIFEST_FILENAME = "_publish.json";
/** Derived-draft directory under the theme's `assets/`. */
export declare const PUBLISH_DIRNAME = "publish";
/** Global aggregation aid at the library root. */
export declare const PUBLISH_INDEX_FILENAME = "_publish-index.json";
/** Global account cards at the library root. */
export declare const PUBLISH_PROFILES_FILENAME = "_publish-profiles.json";
/** Whether the value is one well-formed task id. */
export declare function isTaskId(value: string): boolean;
/** Whether the value is one well-formed platform id. */
export declare function isPlatformId(value: string): boolean;
/**
 * Parse and validate one publish manifest. One malformed task never hides
 * the rest: it is named in `problems` and dropped.
 * @param raw - exact file contents.
 * @returns the manifest with only valid tasks, plus every dropped one named.
 */
export declare function parsePublishManifest(raw: string): {
    manifest: PublishManifest;
    problems: string[];
};
/**
 * Structural validation for one write. The whole manifest rejects together —
 * the caller holds the complete next state, so a partial acceptance would
 * only invite silent loss.
 * @param manifest - the complete next manifest.
 * @throws when any task is malformed.
 */
export declare function assertPublishManifest(manifest: PublishManifest): void;
/**
 * Read the theme's `_publish.json` manifest.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the manifest (null when absent) plus every dropped task named.
 */
export declare function readPublishManifestFile(root: string, theme: string): Promise<{
    manifest: PublishManifest | null;
    problems: string[];
}>;
/**
 * Recompute one theme's aggregation rows from its validated tasks.
 * @param theme - outputs-project directory name.
 * @param tasks - the theme's stored tasks.
 * @returns one index entry per task.
 */
export declare function indexEntriesOf(theme: string, tasks: readonly PublishTask[]): PublishIndexEntry[];
/**
 * Read the global `_publish-index.json`. A malformed file reads as empty
 * with the rejection named — the next manifest write rebuilds the rows.
 * @param root - absolute outputs library root.
 * @returns the index plus the parse problems.
 */
export declare function readPublishIndexFile(root: string): Promise<{
    index: PublishIndex;
    problems: string[];
}>;
/**
 * Replace the theme's `_publish.json` with an atomic, locked commit and
 * refresh the theme's rows in the global index under the same lock.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param manifest - the complete next manifest.
 */
export declare function writePublishManifestFile(root: string, theme: string, manifest: PublishManifest): Promise<void>;
/** Absolute path of one derived draft. */
export declare function resolvePublishDerivedPath(root: string, theme: string, taskId: string, platformId: string): string;
/**
 * Write one derived draft under `assets/publish/<taskId>/<platformId>.md`.
 * The replacement is atomic and serialized per file; the directory is
 * created on demand.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param taskId - the owning task's UUID.
 * @param platformId - the platform registry key.
 * @param content - the complete draft text.
 * @returns the stored path relative to the theme's `assets/`.
 */
export declare function writePublishDerivedFile(root: string, theme: string, taskId: string, platformId: string, content: string): Promise<{
    file: string;
}>;
/**
 * Read one derived draft back.
 * @returns the text, or undefined when the draft does not exist yet.
 */
export declare function readPublishDerivedFile(root: string, theme: string, taskId: string, platformId: string): Promise<string | undefined>;
/**
 * Read one theme-root deliverable as the adaptation source. Guarded like
 * every asset read: one plain file name at the theme root, never the
 * metadata file, never a system entry.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - the deliverable file name.
 * @returns the text, or undefined when absent.
 */
export declare function readPublishSourceFile(root: string, theme: string, file: string): Promise<string | undefined>;
/**
 * Read the global `_publish-profiles.json` account cards.
 * @param root - absolute outputs library root.
 * @returns the profiles plus every dropped stored card named.
 */
export declare function readPublishProfilesFile(root: string): Promise<{
    profiles: PublishProfilesDoc['profiles'];
    problems: string[];
}>;
/**
 * Replace the global `_publish-profiles.json` with an atomic, locked commit.
 * @param root - absolute outputs library root.
 * @param profiles - the complete next card list.
 */
export declare function writePublishProfilesFile(root: string, profiles: PublishProfilesDoc['profiles']): Promise<void>;
/**
 * Assemble the frozen phase-2 MCP handoff for one task: every platform leg's
 * derived draft is read fresh from disk, and a leg without its draft yet
 * rejects — the package must be complete or not exist.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param taskId - the task's UUID.
 * @returns the complete package.
 */
export declare function buildPublishPackageFile(root: string, theme: string, taskId: string): Promise<PublishPackage>;
/**
 * Remove one task's derived-draft directory. Task deletion keeps drafts by
 * contract; this face exists for the explicit purge path and is a no-op when
 * nothing is on disk.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param taskId - the task's UUID.
 */
export declare function purgePublishDerivedDir(root: string, theme: string, taskId: string): Promise<void>;
//# sourceMappingURL=store.d.ts.map