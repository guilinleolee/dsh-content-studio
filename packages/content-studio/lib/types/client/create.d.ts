/**
 * Pure logic of the create workbench: content-type metadata, version-list
 * operations (append, manual-save merge window, pin, prune), word/reading
 * counts, deliverable naming, export rendering, line diffing, and the
 * selection splice. No React, no I/O — the view and the tests share this
 * module, like `competitors.ts` and `calendar.ts`.
 */
import type { CreateContentType, CreateManifest, CreateProfileRef, CreateRewriteOperation, CreateStyleKey, CreateVersion, OutputKind } from '@deepseek-ai/dsh-content-outputs/types';
/** The six built-in content types with the coarse `kind` they map to in metadata. */
export declare const CREATE_TYPES: readonly {
    id: CreateContentType;
    kind: OutputKind;
}[];
/** Rewrite operations of the selection toolbar, in order. */
export declare const REWRITE_OPS: readonly CreateRewriteOperation[];
/** Style choices of the `style` operation, in order. */
export declare const REWRITE_STYLES: readonly CreateStyleKey[];
/** Manual saves inside this window replace the last `manual-save` version instead of stacking one. */
export declare const MANUAL_MERGE_WINDOW_MS: number;
/** Version quota: the newest unpinned versions survive; pinned ones never age out. */
export declare const VERSION_CAP = 30;
/** The coarse metadata kind a content type maps to. */
export declare function contentTypeKind(id: CreateContentType): OutputKind;
/** One prefixed, collision-resistant id (`cc-<time><rand>`). */
export declare function newId(prefix?: string): string;
/**
 * The manifest a new creation starts from: no versions yet, no topic link.
 * @param contentId - the creation's stable id; also the draft file stem.
 * @param contentType - the initially selected template.
 * @returns the empty manifest.
 */
export declare function defaultManifest(contentId: string, contentType: CreateContentType): CreateManifest;
/**
 * Count words the way Chinese creators do: every CJK character is a word,
 * latin words group into one.
 * @param text - the text to count (markdown marks included, they are sparse).
 * @returns the word count.
 */
export declare function countWords(text: string): number;
/**
 * Estimate reading time: voiceover reads at ~240 chars/min, everything else
 * at ~400. Always at least one minute for non-empty text.
 * @param words - the word count.
 * @param contentType - the content type deciding the pace.
 * @returns whole minutes.
 */
export declare function readingMinutes(words: number, contentType: CreateContentType): number;
/**
 * Prune a version list to the quota: pinned versions always survive, the
 * newest unpinned fill the remaining slots. Order stays by `v` ascending.
 * @param versions - the current list.
 * @param cap - the quota.
 * @returns the pruned list.
 */
export declare function pruneVersions(versions: readonly CreateVersion[], cap?: number): CreateVersion[];
/**
 * Append one version as the new current one: `v` continues the counter, the
 * list is pruned to the quota afterwards.
 * @param manifest - the current manifest.
 * @param input - the snapshot facts; `now` is the ISO timestamp.
 * @returns the next manifest.
 */
export declare function appendVersion(manifest: CreateManifest, input: {
    content: string;
    trigger: string;
    now: string;
    profileRef: CreateProfileRef | null;
    pinned?: boolean;
}): CreateManifest;
/**
 * Fold one manual save into the history: inside the merge window after the
 * last `manual-save` version, that version is replaced in place (same `v`);
 * otherwise a new version appends.
 * @param manifest - the current manifest.
 * @param input - the saved text and the ISO timestamp.
 * @returns the next manifest plus whether a new version was created.
 */
export declare function mergeManualSave(manifest: CreateManifest, input: {
    content: string;
    now: string;
    profileRef: CreateProfileRef | null;
}): {
    manifest: CreateManifest;
    created: boolean;
};
/**
 * Toggle the pin of one version; pinned versions never age out of the quota.
 * @param manifest - the current manifest.
 * @param v - the version to toggle.
 * @returns the next manifest, or the input when the version is unknown.
 */
export declare function pinVersion(manifest: CreateManifest, v: number): CreateManifest;
/**
 * The stored text of one version.
 * @param manifest - the current manifest.
 * @param v - the version to read.
 * @returns its content, or null when unknown.
 */
export declare function versionContent(manifest: CreateManifest, v: number): string | null;
/**
 * Splice one range of the text (the rewrite selection) with its replacement.
 * @param text - the full editor text.
 * @param start - the selection start offset.
 * @param end - the selection end offset.
 * @param replacement - the replacement text.
 * @returns the spliced text.
 */
export declare function replaceRange(text: string, start: number, end: number, replacement: string): string;
/** One diff row of the rewrite preview. */
export interface DiffRow {
    readonly kind: 'same' | 'del' | 'add';
    readonly text: string;
}
/**
 * Line diff of two texts for the rewrite preview. Common leading and
 * trailing lines are trimmed first, then a bounded LCS fills the middle;
 * beyond the bound the whole block reads as one del+add pair.
 * @param before - the original text.
 * @param after - the rewritten text.
 * @returns the row list.
 */
export declare function lineDiff(before: string, after: string): DiffRow[];
/**
 * Slugify a title for file naming: CJK stays, spaces and punctuation become
 * hyphens, the result is capped and never empty.
 * @param title - the raw title.
 * @returns the slug.
 */
export declare function slugify(title: string): string;
/**
 * The theme-root deliverable name of a publish: `<slug>-<id8>.md`.
 * @param title - the current title.
 * @param contentId - the creation id.
 * @returns the file name.
 */
export declare function deliverableName(title: string, contentId: string): string;
/**
 * The `assets/` export file name of one export action.
 * @param title - the current title.
 * @param contentId - the creation id.
 * @returns the file name.
 */
export declare function exportFileName(title: string, contentId: string): string;
/**
 * Render one export document: frontmatter (title, type, status, version,
 * export time) followed by the body.
 * @param meta - the frontmatter facts.
 * @param content - the body text.
 * @returns the complete markdown document.
 */
export declare function buildExportMarkdown(meta: {
    title: string;
    contentType: CreateContentType;
    status: string;
    version: number;
    exportedAt: string;
}, content: string): string;
/**
 * Classify a version trigger into its locale stem
 * (`create.trigger.<class>`).
 * @param trigger - the stored trigger string.
 * @returns the locale stem suffix.
 */
export declare function triggerClass(trigger: string): 'ai' | 'manual' | 'restore' | 'retarget' | 'rewrite';
/** The content types whose variant batches ride one request. */
export declare const BATCHABLE_CONTENT_TYPES: readonly CreateContentType[];
/** Whether the content type can batch three variants in one request. */
export declare function isBatchable(contentType: CreateContentType): boolean;
/** The local advisory hashtag pool: common creator niches, matched against the text. */
export declare const HASHTAG_POOL: readonly string[];
/**
 * Suggest hashtags from the pool by matching them against the text, title
 * first; unmatched pool entries never appear, and the suggestions cap at
 * eight so the block stays scannable.
 * @param title - the work title.
 * @param body - the body text.
 * @returns the suggested tags, best matches first.
 */
export declare function suggestHashtags(title: string, body: string): string[];
/**
 * Format one hashtag block for the platform: 小红书 uses a space-separated
 * `#标签` run, 公众号 and 知乎 use closed `#标签#` entries.
 * @param tags - the chosen tags.
 * @param contentType - the content type deciding the platform format.
 * @returns the formatted hashtag line, or an empty string with no tags.
 */
export declare function formatHashtags(tags: readonly string[], contentType: CreateContentType): string;
/**
 * Append one hashtag block to the body, on its own line.
 * @param text - the current body.
 * @param block - the formatted hashtag line.
 * @returns the body with the block appended.
 */
export declare function appendHashtagBlock(text: string, block: string): string;
/** Deterministic local metrics shown next to the advisory AI evaluation. */
export interface LocalMetrics {
    readonly words: number;
    /** Non-empty paragraphs. */
    readonly paragraphs: number;
    /** Length of the first heading line, or 0 when the body starts without one. */
    readonly titleLength: number;
}
/**
 * Compute the deterministic local metrics of a draft.
 * @param text - the draft text.
 * @returns the metrics.
 */
export declare function localMetrics(text: string): LocalMetrics;
//# sourceMappingURL=create.d.ts.map