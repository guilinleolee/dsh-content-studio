/**
 * OPML import preview and export for the gather source list, built on
 * feedsmith's OPML grammar. Import returns a preview (folder grouping,
 * duplicates against the current list marked, invalid rows flagged) and the
 * caller decides what to write; export warns about private tokens in feed
 * URLs at the UI layer, not here.
 */
import type { GatherSource } from './types.ts';
/** One previewed import row. */
export interface OpmlPreviewRow {
    readonly name: string;
    readonly url: string;
    /** Folder path the outline sat in (outer outline texts), outermost first. */
    readonly folder: readonly string[];
    /** Same URL already exists in the current source list; import skips it. */
    readonly duplicate: boolean;
    /** Outline carried no usable xmlUrl; import skips it. */
    readonly invalid: boolean;
}
/**
 * Build the import preview for one OPML document.
 * @param raw - exact OPML text.
 * @param sources - the current source list, for duplicate marking.
 * @returns the preview rows (never empty-input throws), or the parse problem.
 */
export declare function previewOpmlImport(raw: string, sources: readonly GatherSource[]): {
    rows?: OpmlPreviewRow[];
    problem?: string;
};
/**
 * Generate one OPML document from the source list; the first tag becomes the
 * folder an entry sits in, untagged sources stay at the top level.
 * @param sources - the sources to export.
 * @returns the OPML text.
 */
export declare function exportSourcesAsOpml(sources: readonly GatherSource[]): string;
//# sourceMappingURL=opml.d.ts.map