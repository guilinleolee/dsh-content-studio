/**
 * Wire vocabulary of the content-outputs review face: metric snapshots
 * imported from platform exports, the work bindings that admit snapshots
 * into the analysis pool, review tasks and their reports, and the one-shot
 * AI calls (single-work diagnosis, period report). Client-safe by
 * construction — no Node or filesystem imports.
 */

/** Platforms the review face accepts exports from, in picker order. */
export type ReviewPlatformId = 'xhs' | 'douyin' | 'gzh' | 'bilibili'

/** All platforms, in picker order; importers and stores validate against this list. */
export const REVIEW_PLATFORMS: readonly ReviewPlatformId[] = ['xhs', 'douyin', 'gzh', 'bilibili']

/** Work content forms the filters and comparison charts group by. */
export type ReviewContentType = 'image-text' | 'video'

/** All content forms; platform exports that carry no form read as null. */
export const REVIEW_CONTENT_TYPES: readonly (ReviewContentType | null)[] = ['image-text', 'video', null]

/**
 * One platform metrics reading. Every metric is optional and nullable:
 * platforms differ in what their exports carry, and a missing metric stays
 * `null` — aggregations skip it and the UI renders a dash, never a faked 0.
 */
export interface ReviewMetrics {
  readonly impressions: number | null
  readonly reads: number | null
  readonly likes: number | null
  readonly collects: number | null
  readonly comments: number | null
  readonly shares: number | null
  readonly followersGained: number | null
  readonly coverCtr: number | null
}

/** A metrics-shaped value with every field null — the import parser's blank-row product. */
export const NULL_REVIEW_METRICS: ReviewMetrics = {
  impressions: null, reads: null, likes: null, collects: null,
  comments: null, shares: null, followersGained: null, coverCtr: null,
}

/**
 * One point-in-time metrics reading of one platform work. Snapshots are
 * append-only history; re-importing the same work on the same UTC day
 * overwrites that day's snapshot (idempotent) instead of stacking a row.
 */
export interface MetricSnapshot {
  readonly snapshotId: string
  readonly platformId: ReviewPlatformId
  /** The platform-side work id; with `capturedAt`'s UTC day it is the dedup key. */
  readonly platformWorkId: string
  readonly title: string
  readonly publishedAt: string | null
  /** Capture time, ISO 8601. */
  readonly capturedAt: string
  /**
   * The bound creation content id. Only snapshots with a non-null contentId
   * enter the analysis pool; unbound rows stay listed for manual binding.
   */
  readonly contentId: string | null
  /** How the binding came into being; null while unbound. */
  readonly matchMethod: 'url' | 'title' | 'manual' | null
  readonly contentType: ReviewContentType | null
  readonly metrics: ReviewMetrics
}

/**
 * Baseline account averages that ground the viral/weak verdicts. A persisted
 * business setting: it lives in the manifest, never in browser storage.
 */
export interface ReviewBaselines {
  readonly engagementRate: number
  readonly collectRate: number
  /** Whether the numbers came from the user or the built-in defaults. */
  readonly source: 'user' | 'default'
  readonly updatedAt: string
}

/** The built-in baselines used until the user sets their own. */
export const DEFAULT_BASELINES: ReviewBaselines = {
  engagementRate: 0.05,
  collectRate: 0.02,
  source: 'default',
  updatedAt: '',
}

/** Time range of a review, ISO 8601 dates. */
export interface ReviewPeriod {
  readonly from: string
  readonly to: string
}

/** Which pool slice a review task (or the dashboard filters) targets. */
export type ReviewWorkFilter = 'all' | 'viral' | 'weak' | 'longtail'

/** All pool slices, in picker order. */
export const REVIEW_WORK_FILTERS: readonly ReviewWorkFilter[] = ['all', 'viral', 'weak', 'longtail']

/** The filter set one review task freezes at creation. */
export interface ReviewFilters {
  readonly platforms: readonly ReviewPlatformId[]
  readonly contentTypes: readonly ReviewContentType[]
  readonly workFilter: ReviewWorkFilter
}

/** Lifecycle of a review task's report. */
export type ReviewStatus = 'generating' | 'ready' | 'failed'

/** All statuses; editing a report never moves the status. */
export const REVIEW_STATUSES: readonly ReviewStatus[] = ['generating', 'ready', 'failed']

/** One review run: a frozen filter set plus its stored report. */
export interface ReviewTask {
  readonly taskId: string
  readonly name: string
  readonly period: ReviewPeriod
  readonly filters: ReviewFilters
  readonly status: ReviewStatus
  /** Report file name under `assets/review/reports/`; null until one exists. */
  readonly reportFile: string | null
  /** Whether the stored report is the data-only fallback (AI part failed). */
  readonly degraded: boolean
  readonly createdAt: string
}

/** Review state for one theme, stored as `assets/_review.json`. */
export interface ReviewManifest {
  readonly formatVersion: 0
  readonly baselines: ReviewBaselines
  readonly snapshots: readonly MetricSnapshot[]
  readonly tasks: readonly ReviewTask[]
}

/** Read face of the review manifest: validated snapshots and tasks only. */
export interface ReviewManifestRead {
  readonly manifest: ReviewManifest | null
  /** Why the stored manifest was rejected; callers must not write back while non-empty. */
  readonly problems: readonly string[]
}

/** One history-list row of the global `_review-index.json` aggregation aid. */
export interface ReviewIndexRow {
  readonly taskId: string
  readonly theme: string
  readonly name: string
  readonly period: ReviewPeriod
  readonly platforms: readonly ReviewPlatformId[]
  readonly status: ReviewStatus
  readonly updatedAt: string
}

/** The global index document; the sidecar manifest is the truth, this only speeds history up. */
export interface ReviewIndexDoc {
  readonly formatVersion: 0
  readonly rows: readonly ReviewIndexRow[]
}

/** Read face of the global index. */
export interface ReviewIndexRead {
  readonly doc: ReviewIndexDoc | null
  /** Why the stored index was rejected; the next manifest write rebuilds the theme's rows. */
  readonly problems: readonly string[]
}

/** One import-parsed work row, validated and normalized but not yet stored. */
export interface ReviewParsedRow {
  readonly platformWorkId: string
  readonly title: string
  readonly publishedAt: string | null
  readonly contentType: ReviewContentType | null
  readonly metrics: ReviewMetrics
}

/** The two-step import: parse returns a preview, the commit stores confirmed rows only. */
export interface ReviewImportPreviewRequest {
  readonly platformId: ReviewPlatformId
  /** Original file text (UTF-8 CSV). Decoded by the browser; mojibake rejects here. */
  readonly text: string
  readonly fileName: string
}

/** Why one import row was rejected. */
export interface ReviewRejectedRow {
  /** 1-based CSV physical row number, header included. */
  readonly row: number
  readonly reason: string
}

/** Parse result of one import file: nothing is stored yet. */
export interface ReviewImportPreview {
  readonly fileName: string
  readonly platformId: ReviewPlatformId
  readonly rows: readonly ReviewParsedRow[]
  readonly rejected: readonly ReviewRejectedRow[]
  /** Column names no alias matched; the user checks the ones to ignore. */
  readonly unknownColumns: readonly string[]
  readonly totalRows: number
}

/** Commit request: the confirmed rows land as snapshots. */
export interface ReviewImportCommitRequest {
  readonly theme: string
  readonly platformId: ReviewPlatformId
  readonly rows: readonly ReviewParsedRow[]
}

/** Commit result: append vs same-day overwrite accounting. */
export interface ReviewImportCommitResult {
  readonly added: number
  readonly overwritten: number
}

/** Report save: new file per save, never overwriting the generated original. */
export interface ReviewReportSaveRequest {
  readonly theme: string
  readonly taskId: string
  readonly content: string
}

/** Report read face. */
export interface ReviewReportRead {
  readonly content?: string
}

/** Task delete request; snapshots and bindings survive, the report file does not. */
export interface ReviewTaskDeleteRequest {
  readonly theme: string
  readonly taskId: string
}

/** Aggregated period statistics the UI renders and the report AI consumes. */
export interface ReviewAggregateSummary {
  readonly totalWorks: number
  readonly viralCount: number
  readonly weakCount: number
  readonly longtailCount: number
  /** Per-platform totals — impressions are never summed across platforms. */
  readonly perPlatform: Readonly<Record<ReviewPlatformId, { works: number; impressions: number | null; engagement: number | null }>>
  readonly totalEngagement: number | null
  readonly avgEngagementRate: number | null
  readonly totalFollowersGained: number | null
}

/** One work digest fed to the report AI — aggregate facts plus a short excerpt, never full text. */
export interface ReviewWorkDigest {
  readonly title: string
  readonly platformId: ReviewPlatformId
  readonly contentType: ReviewContentType | null
  readonly publishedAt: string | null
  readonly engagementRate: number | null
  readonly collectRate: number | null
  readonly reads: number | null
  /** Body excerpt (≤500 chars, front-truncated) for the top/bottom analysis. */
  readonly excerpt: string
}

/** One-shot single-work diagnosis request: the caller assembles the context. */
export interface ReviewAnalyzeWorkRequest {
  readonly title: string
  readonly platformId: ReviewPlatformId
  readonly contentType: ReviewContentType | null
  readonly publishedAt: string | null
  /** The period the work is judged in. */
  readonly period: ReviewPeriod
  readonly metrics: ReviewMetrics
  /** Verdict class the thresholds produced, so the AI argues from the same facts as the UI. */
  readonly verdict: 'viral' | 'weak' | 'neutral'
  /** Draft body, front-truncated by the caller to the input cap. */
  readonly draftText: string | null
  readonly tags: readonly string[]
  readonly personaDigest: string | null
}

/** One-shot period report request: aggregate digests only, never full bodies. */
export interface ReviewGenerateReportRequest {
  readonly name: string
  readonly period: ReviewPeriod
  readonly platforms: readonly ReviewPlatformId[]
  readonly baselines: ReviewBaselines
  readonly summary: ReviewAggregateSummary
  readonly topWorks: readonly ReviewWorkDigest[]
  readonly bottomWorks: readonly ReviewWorkDigest[]
}

/** Result of both AI faces: the markdown plus its provenance. */
export interface ReviewAiResult {
  readonly markdown: string
  readonly model: string
  readonly promptVersion: number
}
