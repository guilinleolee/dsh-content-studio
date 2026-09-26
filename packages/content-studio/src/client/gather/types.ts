/**
 * Client-side model of the gather view: sources, tasks, and task logs live
 * in browser storage only; materials mirror the on-disk manifest entries.
 * Field sets follow the gather development prompt exactly — the one
 * addition is `consecutiveFailures` on a source, the counter the failure
 * backoff (1h → 2h → 4h, capped at 24h) is computed from.
 */

import type { GatherMaterial } from '@deepseek-ai/dsh-content-outputs/types'

export type { GatherMaterial }

/** One feed entry draft as `fetchFeed` returns it: network reading only, nothing persisted yet. */
export interface GatherItemDraft {
  /** Deduplication key within its source: the feed guid, else the SHA-1 of the normalized link. */
  readonly id: string
  /** Original feed guid, kept beside the key for later recomputation. */
  readonly rawGuid: string | null
  readonly url: string
  readonly title: string | null
  /** Publication instant (ISO 8601), or null when the feed states none. */
  readonly publishedAt: string | null
  readonly summary: string | null
  /** Raw item HTML body, or null for summary-only feeds; sanitized by the gateway on `writeAsset`. */
  readonly content: string | null
}

/**
 * Contract name reserved with the topic-bank feature: joining one material
 * into the topic bank. The gather view renders the entry under this name
 * today as a pending toast; once the topic bank ships, its handler plugs in
 * as `addToTopicBank(materialId)` and the material's stable id becomes the
 * topic's `source.refId`.
 */
export const ADD_TO_TOPIC_BANK = 'addToTopicBank'

/** One RSS/Atom subscription configured in the browser. */
export interface GatherSource {
  readonly id: string
  readonly name: string
  readonly url: string
  /** Collection interval in minutes; at least 30. */
  readonly intervalMinutes: number
  readonly enabled: boolean
  readonly tags: readonly string[]
  readonly excludeKeywords: readonly string[]
  readonly createdAt: string
  /** Last collection attempt instant (ISO 8601), or null before the first. */
  readonly lastFetchedAt: string | null
  readonly lastStatus: 'ok' | 'failed' | null
  /** Consecutive failed attempts, the base of the failure backoff. */
  readonly consecutiveFailures: number
  /** Conditional-request cursor from the last successful response. */
  readonly etag: string | null
  /** Conditional-request cursor from the last successful response. */
  readonly lastModified: string | null
}

/** Runtime state of one collection task; never persisted. */
export type GatherTaskStatus = 'idle' | 'running' | 'done' | 'failed'

/** One ring-buffer log entry of a task's last run. */
export interface GatherTaskLogEntry {
  readonly at: string
  readonly outcome: 'ok' | 'failed' | 'notModified'
  /** Materials added to the manifest by the run. */
  readonly added: number
  /** Error summary on failure. */
  readonly detail?: string
}

/** One collection task: a set of sources filtered into one theme. */
export interface GatherTask {
  readonly id: string
  readonly name: string
  readonly sourceIds: readonly string[]
  /** Outputs-project (theme) the task collects into. */
  readonly themeName: string
  readonly maxItemsPerRun: number
  /** Collection cursor: only materials published after this instant (ISO 8601), or null. */
  readonly since: string | null
  readonly includeKeywords: readonly string[]
  readonly excludeKeywords: readonly string[]
  /** Default visibility of the manual AI button; never triggers calls by itself. */
  readonly aiEnabled: boolean
  /** Scheduled interval in minutes, or null for manual-only. */
  readonly intervalMinutes: number | null
  /** Ring of the last 20 runs, oldest first. */
  readonly log: readonly GatherTaskLogEntry[]
}

/** A task with its runtime status joined on; the persisted shape omits `status`. */
export type GatherTaskView = GatherTask & { readonly status: GatherTaskStatus }

/** Client-side face of the gather write surface on the content-outputs Remote. */
export interface GatherGateway {
  fetchFeed(request: { url: string; etag?: string; lastModified?: string }): Promise<{
    notModified: boolean
    etag: string | null
    lastModified: string | null
    feedTitle: string | null
    items: readonly GatherItemDraft[]
  }>
  writeAsset: (write: { theme: string; file: string; content: string }) => Promise<{ truncated: boolean }>
  readAsset: (theme: string, file: string) => Promise<{ content?: string }>
  readManifest: (theme: string) => Promise<{
    manifest: { formatVersion: 0; materials: readonly GatherMaterial[] }
    problems: readonly string[]
  }>
  writeManifest: (theme: string, manifest: { formatVersion: 0; materials: readonly GatherMaterial[] }) => Promise<{
    formatVersion: 0
    materials: readonly GatherMaterial[]
  }>
  moveAsset: (move: { fromTheme: string; from: string; toTheme: string; to: string }) => Promise<void>
  deleteAsset: (theme: string, file: string) => Promise<void>
  processMaterial: (request: {
    operation: 'process'
    theme?: string
    bodyFile?: string
    title: string
    summary?: string
    url?: string
  }) => Promise<{ summary: string; points: readonly string[]; score: number; tags: readonly string[] }>
}
