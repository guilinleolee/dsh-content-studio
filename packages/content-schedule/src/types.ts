/**
 * Wire vocabulary of the content-schedule Remote: the publication calendar
 * projected to and mutated by trusted clients. Client-safe by construction —
 * no Node or filesystem imports.
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Stable identity of one scheduled calendar item. */
export type ScheduleItemId = Branded<'ScheduleItemId'>

/** Lifecycle of one calendar item (Easel's progression). */
export type ScheduleItemStatus = 'idea' | 'draft' | 'scheduled' | 'published'

/** What kind of day-entry the item is. */
export type ScheduleItemKind = 'content' | 'event'

/** Input face of an upsert: `id` absent creates a new item. */
export interface ScheduleItemInput {
  readonly id?: ScheduleItemId
  /** Working title; never empty. */
  readonly title: string
  /** Calendar day, `YYYY-MM-DD`. */
  readonly date: string
  /** Optional local time, `HH:mm`. */
  readonly time: string | null
  /** Target platform, or null when undecided. */
  readonly platform: string | null
  readonly status: ScheduleItemStatus
  readonly kind: ScheduleItemKind
  /** Linked outputs-project topic, or null when standalone. */
  readonly topic: string | null
  /** Published URL once live, or null before that. */
  readonly url: string | null
}

/** One stored calendar item; `id` is always present. */
export interface ScheduleItem extends ScheduleItemInput {
  readonly id: ScheduleItemId
}

/** Point-in-time calendar returned by the content-schedule Remote. */
export interface ContentScheduleSnapshot {
  /** Absolute file the calendar was read from. */
  readonly file: string
  /** Items sorted by date, then time, then id. */
  readonly items: readonly ScheduleItem[]
  /** Stored records that failed validation, named but not dropped silently. */
  readonly problems: readonly string[]
}
