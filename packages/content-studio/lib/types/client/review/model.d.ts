/**
 * Review-view pure functions: metric rates, the viral/weak/long-tail
 * verdicts against the account baselines, the analysis-pool filter, the
 * period aggregation, the top/bottom digest selection, and the data-only
 * report fallback. No I/O and no React — everything the UI and the report
 * pipeline derive from snapshots lives here, so the thresholds have exactly
 * one implementation to test.
 */
import type { MetricSnapshot, ReviewAggregateSummary, ReviewBaselines, ReviewFilters, ReviewPlatformId, ReviewWorkDigest } from '@deepseek-ai/dsh-content-outputs/types';
/**
 * Client-side copies of the wire enums. The bundle-purity gate forbids
 * cross-plugin value imports, so the view carries its own constants; the
 * review-model spec pins them byte-identical to the gateway's list.
 */
/** All platforms, in picker order (must match the gateway's REVIEW_PLATFORMS). */
export declare const REVIEW_PLATFORMS: readonly ReviewPlatformId[];
/** All pool slices, in picker order (must match the gateway's REVIEW_WORK_FILTERS). */
export declare const REVIEW_WORK_FILTERS: readonly ReviewFilters['workFilter'][];
/** The built-in baselines used until the user sets their own (must match the gateway's DEFAULT_BASELINES). */
export declare const DEFAULT_BASELINES: ReviewBaselines;
/** Long-tail age gate: the work must have been published at least this long ago. */
export declare const LONGTAIL_MIN_AGE_DAYS = 30;
/** Long-tail window: the recent-growth slice compared against the lifetime daily pace. */
export declare const LONGTAIL_WINDOW_DAYS = 7;
/** Long-tail pace gate: recent daily growth at or above this fraction of the lifetime pace. */
export declare const LONGTAIL_PACE_FRACTION = 0.2;
/** Excerpt length per work digest fed to the report AI. */
export declare const DIGEST_EXCERPT_CHARS = 500;
/**
 * The frozen six report sections. Duplicated from the gateway's review AI
 * face (Node-only module): the client renders and tests the template, the
 * gateway prompts with it, and the review-model spec pins both sides to this
 * ordering.
 */
export declare const REVIEW_REPORT_SECTIONS: readonly string[];
/** Diagnosis draft cap: the front slice of the body that rides a diagnosis call. */
export declare const DIAGNOSE_DRAFT_CHARS = 4000;
/** How many works enter the report's top and bottom lists (then halve past this pool size). */
export declare const REPORT_TOP_N = 5;
/** Pool size beyond which the report sampling halves its lists and says so. */
export declare const REPORT_SAMPLE_POOL = 50;
/**
 * Sum of one metrics record's interaction fields; missing metrics read as 0 in a sum.
 * @param metrics - the metrics record of one snapshot.
 * @returns likes + collects + comments + shares, absent fields counted as 0.
 */
export declare function interactionsOf(metrics: MetricSnapshot['metrics']): number;
/**
 * Interaction rate: interactions over reads/plays. Null when the platform
 * exports no reads — never a faked 0.
 * @param metrics - the metrics record of one snapshot.
 * @returns the rate as a fraction, or null without a positive reads value.
 */
export declare function engagementRateOf(metrics: MetricSnapshot['metrics']): number | null;
/**
 * Collect rate: collects over reads/plays; null when reads are missing.
 * @param metrics - the metrics record of one snapshot.
 * @returns the rate as a fraction, or null without a positive reads value.
 */
export declare function collectRateOf(metrics: MetricSnapshot['metrics']): number | null;
/** The three verdict classes; `neutral` is everything between the two gates. */
export type WorkVerdict = 'viral' | 'weak' | 'neutral';
/**
 * Judge one snapshot against the baselines: viral at twice the baseline
 * engagement rate, weak below half of it.
 * @param metrics - the metrics record of one snapshot.
 * @param baselines - the account baselines grounding the gates.
 * @returns `'viral'`, `'weak'`, or `'neutral'`; an incomputable rate reads neutral.
 */
export declare function verdictOf(metrics: MetricSnapshot['metrics'], baselines: ReviewBaselines): WorkVerdict;
/**
 * Long-tail verdict: published at least 30 days ago, still growing in the
 * last 7 days at no less than a fifth of its lifetime daily pace. Needs at
 * least two snapshots; anything less reads as false.
 * @param workSnapshots - every snapshot of one work, any order.
 * @param now - the evaluation instant.
 * @returns whether the work meets the long-tail age and recent-pace gates.
 */
export declare function isLongtail(workSnapshots: readonly MetricSnapshot[], now: Date): boolean;
/**
 * The analysis pool: bound snapshots only (a contentId is the admission
 * ticket), inside the period, matching the platform, form, and verdict
 * filters.
 * @param manifest - snapshots to filter.
 * @param filters - the active filter set (platforms, forms, verdict slice).
 * @param period - the inclusive capture-date window.
 * @param baselines - the account baselines grounding the verdict filters.
 * @returns the snapshots passing every filter, manifest order preserved.
 */
export declare function poolSnapshots(manifest: {
    readonly snapshots: readonly MetricSnapshot[];
}, filters: ReviewFilters, period: {
    from: string;
    to: string;
}, baselines: ReviewBaselines): MetricSnapshot[];
/**
 * The period aggregation the summary cards and the report prompt both
 * render. Impressions sum per platform only — never across platforms.
 * @param snapshots - the pool snapshots (bound, period-filtered).
 * @param baselines - the verdict ground (viral/weak counts).
 * @param now - the evaluation instant (long-tail needs one).
 * @returns the aggregation behind the summary cards and the report prompt.
 */
export declare function aggregateSummary(snapshots: readonly MetricSnapshot[], baselines: ReviewBaselines, now: Date): ReviewAggregateSummary;
/**
 * Rank the pool for the leaderboard and the report's top/bottom lists:
 * bound snapshots, latest per work, engagement-rate descending; works
 * without a computable rate sink to the bottom sorted by raw interactions.
 * @param snapshots - the pool snapshots (one entry per capture, any order).
 * @returns one latest snapshot per work, ranked best first.
 */
export declare function rankWorks(snapshots: readonly MetricSnapshot[]): MetricSnapshot[];
/**
 * Select the report's top and bottom lists from the ranked pool, halving
 * the counts past the sampling threshold and reporting it.
 * @param ranked - the ranked pool from {@link rankWorks}.
 * @param drafts - body text per work key (`platform:workId`), for excerpts.
 * @returns the top and bottom digests plus whether the pool size halved the lists.
 */
export declare function selectDigests(ranked: readonly MetricSnapshot[], drafts: Readonly<Record<string, string>>): {
    top: readonly ReviewWorkDigest[];
    bottom: readonly ReviewWorkDigest[];
    sampled: boolean;
};
/**
 * The data-only fallback report rendered when the report AI call fails: the
 * frozen six-section template with the data sections filled from aggregates
 * and the analysis sections naming the failure — never an empty document.
 * @param name - the review task's name.
 * @param period - the reviewed period.
 * @param summary - the period aggregation.
 * @param ranked - the ranked pool.
 * @param baselines - the account baselines grounding the viral labels.
 * @returns the fallback report markdown.
 */
export declare function dataOnlyReport(name: string, period: {
    from: string;
    to: string;
}, summary: ReviewAggregateSummary, ranked: readonly MetricSnapshot[], baselines: ReviewBaselines): string;
//# sourceMappingURL=model.d.ts.map