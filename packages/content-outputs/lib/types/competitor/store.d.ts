/**
 * On-disk store for the competitor write face: the `_competitors.json`
 * manifest under `outputs/<theme>/assets/`. Path guards and the atomic,
 * Windows-retry commit are shared with the gather write face; this module
 * owns only the manifest schema — parse with per-entry problems instead of a
 * wholesale failure, validate incoming writes loudly, and commit under the
 * same per-file lock. Works carry user markers (`hot`/`favorite`) and
 * append-only metric snapshots, so the store never trims or reorders them:
 * what the caller sends is what lands, after validation.
 */
import type { CompetitorManifest, CompetitorManifestRead } from '../types.ts';
/** Manifest file name inside the theme's `assets/` directory. */
export declare const COMPETITOR_MANIFEST_FILENAME = "_competitors.json";
/**
 * Parse and validate one manifest document. One malformed entry never hides
 * the rest: it is named in `problems` and dropped, like the outputs scanner
 * treats bad metadata.
 * @param raw - exact file contents.
 * @returns the manifest with only valid entries, plus every dropped one named.
 */
export declare function parseCompetitorManifest(raw: string): CompetitorManifestRead;
/** The empty manifest every absent or unreadable manifest reads as. */
export declare function emptyManifest(): CompetitorManifest;
/**
 * Validate one incoming manifest wholesale; used by the write path to reject
 * rather than repair caller mistakes.
 * @param manifest - the manifest the caller wants stored.
 * @throws when the envelope or any entry violates the format.
 */
export declare function assertCompetitorManifest(manifest: CompetitorManifest): void;
/**
 * Read the theme's competitor manifest.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the manifest with only valid entries, plus every dropped one named.
 * @throws when the theme name is not a plain project-directory name.
 */
export declare function readCompetitorManifestFile(root: string, theme: string): Promise<CompetitorManifestRead>;
/**
 * Replace the theme's competitor manifest under a lock with an atomic
 * commit. No retention trimming runs here: works carry user markers and
 * append-only snapshots, so the caller's list is stored verbatim.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param manifest - the complete next manifest.
 */
export declare function writeCompetitorManifestFile(root: string, theme: string, manifest: CompetitorManifest): Promise<void>;
//# sourceMappingURL=store.d.ts.map