/**
 * On-disk store for the gather write face: the `_gather.json` manifest and
 * body-snapshot files under `outputs/<theme>/assets/`. Every path enters
 * through the guards here — a theme is one plain directory name and a file
 * is one plain file name inside that theme's `assets/`, so `..`, absolute
 * paths, theme roots, and separator tricks cannot reach anything else.
 * Manifest replacement is serialized through a file lock and committed with
 * an atomic rename; on Windows a just-closed file can be briefly pinned by
 * antivirus or the search indexer, so renames retry the pinning error codes
 * with backoff. Retention trimming runs before every manifest write: a
 * source keeps its newest `unread`/`read` materials up to the quota, while
 * `favorite` and `picked` markers and their snapshots are never removed.
 */
import type { GatherAssetMove, GatherAssetWrite, GatherManifest, GatherMaterial } from '../types.ts';
/** Manifest file name inside the theme's `assets/` directory. */
export declare const GATHER_MANIFEST_FILENAME = "_gather.json";
/** Per-source retention quota for `unread`/`read` materials in one theme. */
export declare const GATHER_QUOTA_PER_SOURCE = 50;
/** Sanitized body snapshots are truncated to this many characters. */
export declare const GATHER_MAX_BODY_CHARS = 100000;
/** Hard per-file size cap for any asset write, truncation aside. */
export declare const GATHER_MAX_ASSET_CHARS = 2000000;
/**
 * Resolve and guard one theme's assets directory.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the absolute `assets/` path.
 * @throws when the theme name is not a plain project-directory name.
 */
export declare function resolveAssetsDir(root: string, theme: string): string;
/**
 * Resolve and guard one asset file path.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - plain file name inside the theme's `assets/`.
 * @returns the absolute file path.
 * @throws when the theme or file name could escape the assets directory.
 */
export declare function resolveAssetPath(root: string, theme: string, file: string): string;
/**
 * Parse and validate one manifest document. One malformed entry never hides
 * the rest: it is named in `problems` and dropped, like the outputs scanner
 * treats bad metadata.
 * @param raw - exact file contents.
 * @returns the manifest with only valid entries, plus every dropped one named.
 */
export declare function parseGatherManifest(raw: string): {
    manifest: GatherManifest;
    problems: string[];
};
/**
 * Validate one incoming manifest wholesale; used by the write path to reject
 * rather than repair caller mistakes.
 * @param manifest - the manifest the caller wants stored.
 * @throws when the envelope or any entry violates the format.
 */
export declare function assertGatherManifest(manifest: GatherManifest): void;
/**
 * Apply the retention quota: per source, keep `unread`/`read` materials up
 * to {@link GATHER_QUOTA_PER_SOURCE} (newest first); `favorite`/`picked`
 * entries and the files the create workbench references always survive.
 * Returns the kept entries and the dropped ones — dropping is only decided
 * here, snapshot deletion stays with the caller after the trimmed manifest
 * is durably committed.
 * @param materials - the manifest's current entries.
 * @param exemptFiles - asset file names exempt from trimming (the create
 *   workbench's referenced snapshots).
 * @returns the trimmed list plus every entry the quota dropped.
 */
export declare function applyRetentionQuota(materials: readonly GatherMaterial[], exemptFiles?: ReadonlySet<string>): {
    kept: GatherMaterial[];
    dropped: GatherMaterial[];
};
/**
 * Replace one file atomically, serialized against other writers of the same
 * path. The parent directory is created before the lock is taken — the lock
 * file lives beside the target, so a first write into a fresh theme needs
 * the directory to exist first. A pinned commit rename (the Windows pinning
 * window) retries the whole replacement: the temp is cleaned on failure and
 * the old file stays intact, so a retry is always safe. Shared with the
 * competitor write face.
 * @param file - absolute destination path.
 * @param content - complete next file content.
 */
export declare function writeAtomicallyLocked(file: string, content: string): Promise<void>;
/**
 * Write one asset file. `*.html` content is sanitized through the allowlist
 * first and truncated to the body cap; other text files pass through with
 * only the hard size cap applied.
 * @param root - absolute outputs library root.
 * @param write - theme, file name, and content.
 * @returns whether the stored snapshot was truncated.
 */
export declare function writeAssetFile(root: string, write: GatherAssetWrite): Promise<{
    truncated: boolean;
}>;
/**
 * Read one asset file as text, capped. Serves the gather view's detail pane
 * (the browser has no other way to display a stored snapshot) and the AI
 * face's snapshot input; `*.html` snapshots were already sanitized when they
 * were written.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - plain file name inside `assets/`.
 * @returns the file content, or undefined when absent.
 * @throws when the file exceeds the read cap.
 */
export declare function readAssetText(root: string, theme: string, file: string): Promise<string | undefined>;
/** Hard cap for one detail-pane snapshot read; snapshots are written under this size. */
export declare const GATHER_MAX_ASSET_READ_CHARS = 2000000;
/**
 * Read one asset file for the Remote read face, rejecting oversized files
 * instead of streaming them to the browser.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - plain file name inside `assets/`.
 * @returns the file content, or undefined when absent.
 */
export declare function readGatherAssetFile(root: string, theme: string, file: string): Promise<string | undefined>;
/**
 * Rename or relocate one file between two themes' `assets/` directories.
 * The destination theme's `assets/` directory is created when absent, so a
 * material can move into a theme that has not stored assets before.
 * @param root - absolute outputs library root.
 * @param move - source theme/name and destination theme/name.
 * @throws when the source is missing or the destination already exists.
 */
export declare function moveAssetFile(root: string, move: GatherAssetMove): Promise<void>;
/**
 * Delete one asset file; deleting an absent file is a no-op.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - plain file name inside `assets/`.
 */
export declare function deleteAssetFile(root: string, theme: string, file: string): Promise<void>;
/**
 * Read the theme's gather manifest.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the manifest with only valid entries, plus every dropped one named.
 */
export declare function readGatherManifestFile(root: string, theme: string): Promise<{
    manifest: GatherManifest;
    problems: string[];
}>;
/**
 * Replace the theme's gather manifest under a lock with an atomic commit.
 * The stored manifest is quota-trimmed first; snapshots of trimmed entries
 * are deleted only after the trimmed manifest is durably on disk, so a crash
 * can leave an untracked file but never a tracked-but-missing one.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param manifest - the complete next manifest.
 * @param exemptFiles - asset file names exempt from trimming (the create
 *   workbench's referenced snapshots; the gateway collects them per write).
 * @returns the stored (trimmed) manifest.
 */
export declare function writeGatherManifestFile(root: string, theme: string, manifest: GatherManifest, exemptFiles?: ReadonlySet<string>): Promise<GatherManifest>;
/**
 * Delete orphaned atomic-write temp files (`<name>.<hex>.tmp`) left behind by
 * a crashed gateway process, across every theme's assets directory. Best
 * effort: a sweep failure must never block startup, because the temp files
 * are inert.
 * @param root - absolute outputs library root.
 */
export declare function sweepOrphanTempFiles(root: string): Promise<void>;
//# sourceMappingURL=store.d.ts.map