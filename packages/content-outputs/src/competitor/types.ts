/**
 * Wire vocabulary of the competitor write face on the content-outputs Remote:
 * benchmark-account works, the `_competitors.json` manifest, and the AI
 * analysis/report requests and results. Client-safe by construction — no Node
 * or filesystem imports. Account configuration lives browser-side and never
 * appears here; collection itself is out of scope (manual import only; the
 * MCP collection interface is reserved, not implemented).
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Stable identity of one competitor work: `cw-` prefixed. */
export type CompetitorWorkId = Branded<'CompetitorWorkId'>

/** Stable identity of one competitor report: `cr-` prefixed. */
export type CompetitorReportId = Branded<'CompetitorReportId'>

/** Content platform a benchmark account publishes on. */
export type CompetitorPlatform = 'xhs' | 'douyin' | 'wechat' | 'bili' | 'zhihu' | 'toutiao'

/** Heat rank of one work inside its own account's distribution. */
export type CompetitorHeatLevel = 'hot' | 'normal' | 'cold'

/** One interaction-metrics snapshot of one work. Snapshots append, never overwrite. */
export interface CompetitorMetricSnapshot {
  /** Snapshot instant (ISO 8601). */
  readonly t: string
  readonly likes: number
  readonly comments: number
  readonly shares: number
  /** View count, when the platform exposes one. */
  readonly views?: number
}

/**
 * Structured teardown of one work produced by the AI analysis call. Purely
 * paradigm-borrowing facts — the prompt forbids rewrite-ready prose.
 */
export interface CompetitorWorkAnalysisResult {
  /** Opening-hook type (pain point / suspense / counter-intuitive / story / other). */
  readonly hookType: string
  /** Content structure: section frame, case types, argument style. */
  readonly structure: string
  /** Audience pain points the work targets. */
  readonly painPoints: readonly string[]
  /** Topic buckets the work belongs to. */
  readonly topics: readonly string[]
  /** Why the work performs, plus risks (sameness, banned-word exposure). */
  readonly risks: readonly string[]
  /** Reusable patterns worth copying. */
  readonly reusable: readonly string[]
  /** Differentiated topic suggestions derived from this work. */
  readonly migrationTopics: readonly string[]
  /** Hot-comment insight text, or `unavailable` when no comments were supplied. */
  readonly commentInsight: string
}

/** Analysis state of one work. `pending`/`running` are view-local and never persisted. */
export interface CompetitorWorkAnalysis {
  readonly status: 'none' | 'done' | 'failed'
  /** Failure summary of the last attempt, present when status is `failed`. */
  readonly error?: string
  /** Full teardown report file name under the theme's `assets/`, when done. */
  readonly ref?: string
  /** Structured core fields, present when status is `done`. */
  readonly result?: CompetitorWorkAnalysisResult
}

/** One benchmark-account work as stored in the `_competitors.json` manifest. */
export interface CompetitorWork {
  readonly id: CompetitorWorkId
  /** Browser-side account this work belongs to; the manifest keeps the name too. */
  readonly accountId: string
  readonly accountName: string
  readonly platform: CompetitorPlatform
  /** Platform-native work id; with `platform` and `accountId` this is the dedup key. */
  readonly platformWorkId: string
  readonly title: string
  readonly url?: string
  /** Work publication instant (ISO 8601), when known. */
  readonly publishedAt?: string
  /** Import instant (ISO 8601). */
  readonly importedAt: string
  /** Body text file name under the theme's `assets/`, when one was saved. */
  readonly textFile?: string
  /** Interaction-metrics snapshots, oldest first, append-only. */
  readonly metrics: readonly CompetitorMetricSnapshot[]
  /** User hot marker, exempt from any future cleanup. */
  readonly hot: boolean
  /** User favorite marker, exempt from any future cleanup. */
  readonly favorite: boolean
  /** How the work entered the library; phase one only supports manual import. */
  readonly via: 'manual'
  /** Reference to the linked information-gathering material, when linked. */
  readonly gatheredRef?: string
  readonly analysis: CompetitorWorkAnalysis
}

/** One generated report as stored in the `_competitors.json` manifest. */
export interface CompetitorReport {
  readonly id: CompetitorReportId
  /** `account` is the single-account panorama; `compare` is the two-account face-off. */
  readonly kind: 'account' | 'compare'
  readonly accountIds: readonly string[]
  readonly accountNames: readonly string[]
  /** Report file name under the theme's `assets/`. */
  readonly ref: string
  /** Generation instant (ISO 8601). */
  readonly createdAt: string
  /** Works considered, for scope labeling. */
  readonly workCount: number
}

/**
 * The `_competitors.json` manifest document; `formatVersion 0` has no
 * compatibility promise. `syncedAt` records per-account last collection
 * instants so the catch-up check survives browser changes.
 */
export interface CompetitorManifest {
  readonly formatVersion: 0
  /** Account id → last collection instant (ISO 8601). */
  readonly syncedAt: Readonly<Record<string, string>>
  readonly works: readonly CompetitorWork[]
  readonly reports: readonly CompetitorReport[]
}

/** Result face of reading a competitor manifest: valid entries plus every dropped one named. */
export interface CompetitorManifestRead {
  readonly manifest: CompetitorManifest
  /** Stored entries that failed validation, named but not dropped silently. */
  readonly problems: readonly string[]
}

/** Request face of the single-work AI teardown: display facts plus snapshot reference. */
export interface CompetitorAnalyzeWorkRequest {
  /** Outputs-project directory that holds the body text, when `textFile` is set. */
  readonly theme?: string
  /** Body text file name under the theme's `assets/`, when one exists. */
  readonly textFile?: string
  readonly title: string
  readonly url?: string
  /** One-line interaction facts (likes/comments/shares/views) as display text. */
  readonly stats?: string
  /** User-pasted hot comments, when available; their absence yields `unavailable`. */
  readonly comments?: string
}

/** Result face of the single-work AI teardown: the structured core plus the full report text. */
export interface CompetitorAnalyzeWorkResult extends CompetitorWorkAnalysisResult {
  /** Full teardown markdown for the caller to store as the `assets/` report file. */
  readonly markdown: string
}

/** One account's aggregated facts fed into a report call. Never raw work text. */
export interface CompetitorAccountDigest {
  readonly name: string
  /** ≤1k-character structured summary (topic distribution, hook stats, cadence, hot rate). */
  readonly digest: string
}

/** Request face of the report AI call: one account panorama or two-account face-off. */
export interface CompetitorReportRequest {
  readonly kind: 'account' | 'compare'
  /** One digest for `account`, exactly two for `compare`. */
  readonly accounts: readonly CompetitorAccountDigest[]
}

/** Result face of the report AI call, for the caller to store as an asset file. */
export interface CompetitorReportResult {
  readonly markdown: string
}
