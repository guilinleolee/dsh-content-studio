/**
 * Wire vocabulary of the content-topics Remote: the topic bank projected to
 * and mutated by trusted clients. Client-safe by construction — no Node or
 * filesystem imports.
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Stable identity of one stored topic. */
export type TopicItemId = Branded<'TopicItemId'>

/** Lifecycle of one topic in the creation pipeline. */
export type TopicStatus = 'idea' | 'todo' | 'creating' | 'done' | 'shelved'

/** Where one topic came from. */
export type TopicSourceType = 'manual' | 'gather' | 'benchmark' | 'interaction'

/** Who produced a topic score. */
export type TopicScoreSource = 'manual' | 'ai'

/** Read-only capture of the source material at topic-creation time. */
export interface TopicSourceSnapshot {
  /** Title of the captured material. */
  readonly title: string
  /** Summary of the captured material, or null when none was captured. */
  readonly summary: string | null
  /** Capture time, ISO 8601. */
  readonly capturedAt: string
}

/**
 * Provenance of one topic: the source family plus enough identity and
 * captured material to survive the source going away — the id keeps a future
 * in-app jump target alive, the snapshot keeps the content readable when the
 * original link dies.
 */
export interface TopicSource {
  /** Which pipeline produced the topic. */
  readonly type: TopicSourceType
  /** Gather material id or benchmark record id, or null when manual. */
  readonly refId: string | null
  /** Original external link, or null when none exists. */
  readonly url: string | null
  /** Create-time capture of the source material, or null when manual. */
  readonly snapshot: TopicSourceSnapshot | null
}

/** One scoring factor behind a topic score. */
export interface TopicScoreFactor {
  /** Factor name, e.g. `audience fit`. */
  readonly name: string
  /** Factor contribution on the same 0–10 scale as the total. */
  readonly score: number
  /** Why the factor scored this way, or null when unexplained. */
  readonly reason: string | null
  /** Producer-stated confidence in the factor, 0–1; 1 for manual factors. */
  readonly confidence: number
  /** True when the score is an estimate rather than evidence-derived. */
  readonly estimated: boolean
}

/** Evaluation result attached to one topic, manual or AI-produced. */
export interface TopicScore {
  /** Overall score, 0–10. */
  readonly total: number
  /** Who produced the score. */
  readonly source: TopicScoreSource
  /** Per-factor breakdown, or null when the score carries none (manual P0). */
  readonly factors: readonly TopicScoreFactor[] | null
  /** Evaluation time, ISO 8601. */
  readonly evaluatedAt: string
}

/** Input face of an upsert: `id` absent creates a new topic. Timestamps are
 * store-managed and never accepted from clients. */
export interface TopicItemInput {
  readonly id?: TopicItemId
  /** Working title; never empty. */
  readonly title: string
  /** One-line pitch, or null when untold. */
  readonly oneLiner: string | null
  readonly status: TopicStatus
  /** Where the topic came from, with its create-time capture. */
  readonly source: TopicSource
  /** Free-form labels; empty strings are dropped on normalize. */
  readonly tags: readonly string[]
  /** Core viewpoint, audience, differentiation, material notes (Markdown), or null. */
  readonly description: string | null
  /** Latest evaluation, or null when unscored. */
  readonly score: TopicScore | null
  /** Planned creation day, `YYYY-MM-DD`, or null when unplanned. */
  readonly planDate: string | null
  /** Linked `_schedule.json` entry id for the calendar round-trip, or null. */
  readonly scheduleItemId: string | null
  /** Linked `outputs/<topic>/` project directory name, or null. */
  readonly topicDir: string | null
}

/** One stored topic; `id` and the audit timestamps are always present. */
export interface TopicItem {
  readonly id: TopicItemId
  /** Working title; never empty. */
  readonly title: string
  /** One-line pitch, or null when untold. */
  readonly oneLiner: string | null
  readonly status: TopicStatus
  /** Where the topic came from, with its create-time capture. */
  readonly source: TopicSource
  /** Free-form labels. */
  readonly tags: readonly string[]
  /** Core viewpoint, audience, differentiation, material notes (Markdown), or null. */
  readonly description: string | null
  /** Latest evaluation, or null when unscored. */
  readonly score: TopicScore | null
  /** Planned creation day, `YYYY-MM-DD`, or null when unplanned. */
  readonly planDate: string | null
  /** Linked `_schedule.json` entry id for the calendar round-trip, or null. */
  readonly scheduleItemId: string | null
  /** Linked `outputs/<topic>/` project directory name, or null. */
  readonly topicDir: string | null
  /** Creation time, ISO 8601; preserved across upserts. */
  readonly createdAt: string
  /** Last-write time, ISO 8601; the list ordering key. */
  readonly updatedAt: string
}

/** Point-in-time topic bank returned by the content-topics Remote. */
export interface ContentTopicsSnapshot {
  /** Absolute file the topic bank was read from. */
  readonly file: string
  /** Items sorted by `updatedAt`, newest first. */
  readonly items: readonly TopicItem[]
  /** Stored records that failed validation, named but not dropped silently. */
  readonly problems: readonly string[]
}
