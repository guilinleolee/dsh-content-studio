/**
 * Pure client-side rules of the gather view: draft filtering, manifest
 * merging, retention trimming, and failure backoff. Refreshes merge by the
 * composite (sourceId, id) key and never touch an existing entry, so read /
 * favorite / picked state and AI results survive every collection run;
 * `favorite` and `picked` entries are exempt from the retention quota. The
 * gateway re-applies the same quota at the storage layer, so both sides
 * agree even if a second writer touches the manifest.
 */
import type { GatherItemDraft, GatherMaterial } from './types.ts';
/** Per-source retention quota for `unread`/`read` materials in one theme. */
export declare const GATHER_QUOTA_PER_SOURCE = 50;
/** Body snapshots larger than this many characters are written truncated. */
export declare const GATHER_BODY_CHAR_LIMIT = 100000;
/** Whether one material is exempt from retention trimming. */
export declare function isRetentionExempt(material: GatherMaterial): boolean;
/**
 * Apply the retention quota: per source, keep `unread`/`read` materials up
 * to {@link GATHER_QUOTA_PER_SOURCE} (newest first); `favorite`/`picked`
 * entries always survive. Selection is newest-first, but the kept list
 * preserves the manifest's original order — trimming never reshuffles it.
 * @param materials - the manifest's current entries.
 * @returns the trimmed list plus every entry the quota dropped (the caller
 * deletes their body snapshots after the manifest write commits).
 */
export declare function applyQuota(materials: readonly GatherMaterial[]): {
    kept: GatherMaterial[];
    dropped: GatherMaterial[];
};
/** All keyword filters that apply to one draft: the source's and the task's. */
export interface GatherKeywordFilters {
    readonly sourceExcludeKeywords: readonly string[];
    readonly includeKeywords: readonly string[];
    readonly excludeKeywords: readonly string[];
}
/** Whether one draft passes the keyword filters (case-insensitive substring match on title + summary). */
export declare function passesKeywordFilters(draft: GatherItemDraft, filters: GatherKeywordFilters): boolean;
/**
 * Filter one feed run's drafts for one task: keyword filters, the `since`
 * cursor (publication instant strictly after it), and the per-run cap
 * (newest first). Deduplication against the manifest happens at merge time.
 * @param drafts - the feed's item drafts.
 * @param filters - keyword filters in effect.
 * @param since - task publication cursor, or null.
 * @param maxItems - per-run cap.
 * @returns the drafts that may enter the manifest, newest first.
 */
export declare function filterDrafts(drafts: readonly GatherItemDraft[], filters: GatherKeywordFilters, since: string | null, maxItems: number): GatherItemDraft[];
/** Options for one merge: nothing here mutates existing entries. */
export interface MergeOptions {
    /** Collection instant stamped on new entries (ISO 8601). */
    readonly now: string;
}
/**
 * Merge one source's drafts into the manifest materials. Existing entries
 * win over drafts for their whole lifetime of the run: user state, AI
 * results, excerpts, and snapshot references are never overwritten.
 * @param materials - current manifest entries.
 * @param sourceId - collecting source's id.
 * @param sourceName - collecting source's display name.
 * @param drafts - the (already filtered) drafts of this run.
 * @param options - merge options.
 * @returns the merged list, new entries appended, plus the drafts that were new.
 */
export declare function mergeDrafts(materials: readonly GatherMaterial[], sourceId: string, sourceName: string, drafts: readonly GatherItemDraft[], options: MergeOptions): {
    merged: GatherMaterial[];
    added: GatherMaterial[];
};
/**
 * Failure backoff for one source: 1h doubled per consecutive failure, capped
 * at 24h. The first failure pushes the next attempt one hour out.
 * @param consecutiveFailures - consecutive failed attempts so far.
 * @returns the backoff delay in milliseconds (0 when nothing has failed).
 */
export declare function failureBackoffMs(consecutiveFailures: number): number;
/**
 * Earliest instant the source may be collected again: the later of its own
 * interval and its failure backoff, measured from the last attempt.
 * @param source - the source.
 * @param now - current instant (ISO 8601).
 * @returns true when the source is due for a run.
 */
export declare function isSourceDue(source: {
    intervalMinutes: number;
    lastFetchedAt: string | null;
    consecutiveFailures: number;
}, now: string): boolean;
/** Snapshot file name for one material's body. */
export declare function bodyFileName(materialId: string): string;
//# sourceMappingURL=model.d.ts.map