/**
 * Schedule file store: reads and writes the calendar JSON directly on every
 * call. The file lives at the library root under `_schedule.json` — the `_`
 * prefix keeps the outputs scanner treating it as a system entry, and one
 * library directory stays the whole content-creation surface on disk.
 *
 * Validation follows the same rule as the outputs scanner: one malformed
 * record never hides the rest — it is named in `problems` and skipped, while
 * valid items keep their place on the calendar.
 */

import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import type {
  ContentScheduleSnapshot, ScheduleItem, ScheduleItemInput, ScheduleItemKind, ScheduleItemStatus,
} from './types.ts'

/** System file name of the calendar at the library root. */
export const SCHEDULE_FILENAME = '_schedule.json'

const STATUSES: readonly ScheduleItemStatus[] = ['idea', 'draft', 'scheduled', 'published']
const KINDS: readonly ScheduleItemKind[] = ['content', 'event']

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{2}:\d{2}$/

function isValidTime(value: string): boolean {
  if (!TIME_PATTERN.test(value)) return false
  const hours = Number(value.slice(0, 2))
  const minutes = Number(value.slice(3, 5))
  return hours <= 23 && minutes <= 59
}

function isItem(value: unknown): value is ScheduleItem {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && record.id.length > 0
    && typeof record.title === 'string' && record.title.length > 0
    && typeof record.date === 'string' && DATE_PATTERN.test(record.date)
    && (record.time === null || (typeof record.time === 'string' && isValidTime(record.time)))
    && (record.platform === null || typeof record.platform === 'string')
    && STATUSES.includes(record.status as ScheduleItemStatus)
    && KINDS.includes(record.kind as ScheduleItemKind)
    && (record.topic === null || typeof record.topic === 'string')
    && (record.url === null || typeof record.url === 'string')
}

/** Sort key: date, then time (undated times last within a day), then id. */
function compareItems(a: ScheduleItem, b: ScheduleItem): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const at = a.time ?? '99:99'
  const bt = b.time ?? '99:99'
  if (at !== bt) return at < bt ? -1 : 1
  return a.id < b.id ? -1 : 1
}

/**
 * Validate one upsert input into its stored shape; `id` is generated when
 * absent and trimmed fields are normalized.
 * @param input - the upsert payload.
 * @returns the stored item, or the reason the input is invalid.
 */
export function normalizeInput(input: ScheduleItemInput): { item?: ScheduleItem; detail?: string } {
  if (typeof input.title !== 'string' || input.title.trim().length === 0) return { detail: 'title must be a non-empty string' }
  if (typeof input.date !== 'string' || !DATE_PATTERN.test(input.date)) return { detail: 'date must be YYYY-MM-DD' }
  if (input.time !== null && (typeof input.time !== 'string' || !isValidTime(input.time))) return { detail: 'time must be HH:mm (00:00–23:59) or null' }
  if (!STATUSES.includes(input.status)) return { detail: 'unknown status' }
  if (!KINDS.includes(input.kind)) return { detail: 'unknown kind' }
  return {
    item: {
      id: input.id ?? (randomUUID() as ScheduleItem['id']),
      title: input.title.trim(),
      date: input.date,
      time: input.time,
      platform: input.platform === null ? null : input.platform.trim() || null,
      status: input.status,
      kind: input.kind,
      topic: input.topic ?? null,
      url: input.url ?? null,
    },
  }
}

/**
 * Read the calendar file.
 * @param file - absolute `_schedule.json` path; a missing file is empty.
 * @returns the snapshot with items sorted and every bad record named.
 */
export async function readSchedule(file: string): Promise<ContentScheduleSnapshot> {
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch {
    return { file, items: [], problems: [] }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { file, items: [], problems: ['calendar file is not valid JSON'] }
  }
  const root = parsed as Record<string, unknown>
  // Future on-disk formats never load as current records: the version gate
  // mirrors the outputs metadata contract (one backend, one format).
  if (root.formatVersion !== 0) return { file, items: [], problems: [`unsupported calendar formatVersion ${String(root.formatVersion)}`] }
  if (!Array.isArray(root.items)) return { file, items: [], problems: ['calendar file has no items array'] }

  const items: ScheduleItem[] = []
  const problems: string[] = []
  for (const entry of root.items) {
    if (isItem(entry)) items.push(entry)
    else problems.push(`dropped one invalid calendar record: ${JSON.stringify(entry).slice(0, 120)}`)
  }
  items.sort(compareItems)
  return { file, items, problems }
}

/**
 * Apply one mutation to the calendar under a file lock, atomically.
 * @param file - absolute `_schedule.json` path; parent directories are
 * created when missing (the lock file requires its parent to exist).
 * @param mutate - pure transform over the current item list.
 * @returns the mutation's write snapshot (post-write state).
 */
export async function mutateSchedule(
  file: string,
  mutate: (items: readonly ScheduleItem[]) => Promise<readonly ScheduleItem[]> | readonly ScheduleItem[],
): Promise<ContentScheduleSnapshot> {
  return withFileLock(file, async () => {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 })
    const before = await readSchedule(file)
    const items = await mutate(before.items)
    const body = `${JSON.stringify({ formatVersion: 0, items }, null, 2)}\n`
    await writeFileAtomic(file, body, { mode: 0o600, dirMode: 0o700 })
    const after = await readSchedule(file)
    return { ...after, problems: [...before.problems, ...after.problems] }
  })
}
