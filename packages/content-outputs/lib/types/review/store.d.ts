/**
 * On-disk store for the review face: the `_review.json` sidecar manifest and
 * the report/template files under `outputs/<theme>/assets/review/`, plus the
 * global `_review-index.json` aggregation aid. `.dsh-output.json` is never
 * touched. Paths enter through the same plain-name guards as the other faces;
 * manifest and index writes commit through the shared atomic-rename lock. A
 * malformed manifest reads back with its bad entries dropped and named;
 * writes reject wholesale — the caller fixes its list, the store never
 * repairs it.
 */
import type { ReviewIndexRead, ReviewImportCommitRequest, ReviewImportCommitResult, ReviewManifest, ReviewManifestRead } from '../types.ts';
/** Sidecar manifest file name inside the theme's `assets/` directory. */
export declare const REVIEW_MANIFEST_FILENAME = "_review.json";
/** Global index file name at the outputs library root (underscore = invisible to the scanner). */
export declare const REVIEW_INDEX_FILENAME = "_review-index.json";
/** Directory under `assets/` holding the reports and saved templates. */
export declare const REVIEW_DIRNAME = "review";
/** Directory under `assets/review/` holding the generated and edited reports. */
export declare const REVIEW_REPORTS_DIRNAME = "reports";
/** Directory under `assets/review/` holding saved viral-work templates. */
export declare const REVIEW_TEMPLATES_DIRNAME = "templates";
/** Hard snapshot count per theme; the oldest same-work snapshots evict first past it. */
export declare const REVIEW_MAX_SNAPSHOTS = 20000;
/** Hard report size cap. */
export declare const REVIEW_MAX_REPORT_CHARS = 400000;
/**
 * Parse and validate one review manifest. One malformed snapshot or task
 * never hides the rest: it is named in `problems` and dropped; an unreadable
 * envelope reads as an empty manifest with the rejection named.
 * @param raw - exact file contents.
 * @returns the manifest with only valid entries, plus every dropped one named.
 */
export declare function parseReviewManifest(raw: string): {
    manifest: ReviewManifest;
    problems: string[];
};
/**
 * Validate one incoming manifest wholesale; used by the write path to reject
 * rather than repair caller mistakes.
 * @param manifest - the manifest the caller wants stored.
 * @throws when the envelope, baselines, or any entry violates the format.
 */
export declare function assertReviewManifest(manifest: ReviewManifest): void;
/**
 * Read the theme's `_review.json`.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the manifest (null when absent) with only valid entries, every
 *   dropped one named in `problems`; callers must not write back while
 *   `problems` is non-empty.
 */
export declare function readReviewManifestFile(root: string, theme: string): Promise<ReviewManifestRead>;
/**
 * Replace the theme's `_review.json` with an atomic, locked commit, and
 * refresh the theme's rows in the global `_review-index.json` under the same
 * commit sequence. Snapshot appends and task retries ride full-manifest
 * writes: the caller sends the complete next manifest.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param manifest - the complete next manifest.
 */
export declare function writeReviewManifestFile(root: string, theme: string, manifest: ReviewManifest): Promise<void>;
/**
 * Read the global `_review-index.json`. A malformed file reads as empty with
 * the rejection named — the next manifest write rebuilds the theme's rows,
 * and the history list falls back to scanning.
 * @param root - absolute outputs library root.
 * @returns the index plus the parse problems.
 */
export declare function readReviewIndexFile(root: string): Promise<ReviewIndexRead>;
/**
 * Commit confirmed import rows as snapshots: append new works, overwrite the
 * same UTC day's snapshot of a known work (idempotent re-import), and keep
 * every historical day (long-tail detection depends on the history).
 * @param root - absolute outputs library root.
 * @param request - the theme, platform, and the confirmed rows.
 * @returns the append and overwrite accounting.
 */
export declare function commitReviewImportFile(root: string, request: ReviewImportCommitRequest): Promise<ReviewImportCommitResult>;
/**
 * Replace the theme's whole manifest — the binding, baseline, and task faces
 * all ride this one write after the caller has patched its copy.
 * Alias of {@link writeReviewManifestFile} kept for face naming symmetry.
 */
export declare const putReviewManifestFile: typeof writeReviewManifestFile;
/**
 * Remove one review task and delete its report file. Snapshots and bindings
 * survive: other tasks and the dashboard reuse them.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param taskId - the task to remove; an unknown id rejects so a stale UI
 *   cannot silently no-op.
 */
export declare function deleteReviewTaskFile(root: string, theme: string, taskId: string): Promise<void>;
/**
 * Write one report file under `assets/review/reports/`. The caller owns the
 * name (`report-<taskId>-<ts>.md`) so every save is a new file — the
 * generated original is never overwritten.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - plain report file name.
 * @param content - the complete report markdown.
 * @returns the stored reference, relative to `assets/review/`.
 */
export declare function writeReviewReportFile(root: string, theme: string, file: string, content: string): Promise<{
    file: string;
}>;
/**
 * Read one report file back from its stored reference.
 * @returns the markdown, or an empty record when the file does not exist.
 */
export declare function readReviewReportFile(root: string, theme: string, reference: string): Promise<{
    content?: string;
}>;
/**
 * Save one viral-work template under `assets/review/templates/`.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - plain template file name.
 * @param content - the template markdown.
 * @returns the stored reference, relative to `assets/review/`.
 */
export declare function writeReviewTemplateFile(root: string, theme: string, file: string, content: string): Promise<{
    file: string;
}>;
/**
 * List saved template file names under `assets/review/templates/`.
 * @returns the sorted plain file names.
 */
export declare function listReviewTemplatesFile(root: string, theme: string): Promise<readonly string[]>;
/**
 * Read one saved template's content.
 * @returns the markdown, or an empty record when the file does not exist.
 */
export declare function readReviewTemplateFile(root: string, theme: string, file: string): Promise<{
    content?: string;
}>;
//# sourceMappingURL=store.d.ts.map