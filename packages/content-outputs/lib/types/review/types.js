/**
 * Wire vocabulary of the content-outputs review face: metric snapshots
 * imported from platform exports, the work bindings that admit snapshots
 * into the analysis pool, review tasks and their reports, and the one-shot
 * AI calls (single-work diagnosis, period report). Client-safe by
 * construction — no Node or filesystem imports.
 */
/** All platforms, in picker order; importers and stores validate against this list. */
export const REVIEW_PLATFORMS = ['xhs', 'douyin', 'gzh', 'bilibili'];
/** All content forms; platform exports that carry no form read as null. */
export const REVIEW_CONTENT_TYPES = ['image-text', 'video', null];
/** A metrics-shaped value with every field null — the import parser's blank-row product. */
export const NULL_REVIEW_METRICS = {
    impressions: null, reads: null, likes: null, collects: null,
    comments: null, shares: null, followersGained: null, coverCtr: null,
};
/** The built-in baselines used until the user sets their own. */
export const DEFAULT_BASELINES = {
    engagementRate: 0.05,
    collectRate: 0.02,
    source: 'default',
    updatedAt: '',
};
/** All pool slices, in picker order. */
export const REVIEW_WORK_FILTERS = ['all', 'viral', 'weak', 'longtail'];
/** All statuses; editing a report never moves the status. */
export const REVIEW_STATUSES = ['generating', 'ready', 'failed'];
//# sourceMappingURL=types.js.map