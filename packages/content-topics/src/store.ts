/**
 * Topic bank file store: reads and writes the topics JSON directly on every
 * call. The file lives at the library root under `_topics.json` — the `_`
 * prefix keeps the outputs scanner treating it as a system entry, and one
 * library directory stays the whole content-creation surface on disk.
 *
 * Validation follows the same rule as the outputs scanner: one malformed
 * record never hides the rest — it is named in `problems` and skipped, while
 * valid topics keep their place in the bank. A file whose `formatVersion` is
 * not the current one never loads as current records.
 */

import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import type {
  ContentTopicsSnapshot, TopicItem, TopicItemInput, TopicScore, TopicScoreFactor,
  TopicSource, TopicSourceSnapshot, TopicSourceType, TopicStatus,
} from './types.ts'

/** System file name of the topic bank at the library root. */
export const TOPICS_FILENAME = '_topics.json'

const STATUSES: readonly TopicStatus[] = ['idea', 'todo', 'creating', 'done', 'shelved']
const SOURCE_TYPES: readonly TopicSourceType[] = ['manual', 'gather', 'benchmark']
const SCORE_SOURCES: readonly ('manual' | 'ai')[] = ['manual', 'ai']

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && ISO_PATTERN.test(value) && !Number.isNaN(Date.parse(value))
}

function isScoreValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10
}

function isConfidenceValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

function isTrimmedNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string')
}

function isSnapshot(value: unknown): value is TopicSourceSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return isTrimmedNonEmpty(record.title)
    && isNullableString(record.summary)
    && isIsoTimestamp(record.capturedAt)
}

function isSource(value: unknown): value is TopicSource {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return SOURCE_TYPES.includes(record.type as TopicSourceType)
    && isNullableString(record.refId)
    && isNullableString(record.url)
    && (record.snapshot === null || isSnapshot(record.snapshot))
}

function isScoreFactor(value: unknown): value is TopicScoreFactor {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return isTrimmedNonEmpty(record.name)
    && isScoreValue(record.score)
    && isNullableString(record.reason)
    && isConfidenceValue(record.confidence)
    && typeof record.estimated === 'boolean'
}

function isScore(value: unknown): value is TopicScore {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return isScoreValue(record.total)
    && SCORE_SOURCES.includes(record.source as 'manual' | 'ai')
    && (record.factors === null
      || (Array.isArray(record.factors) && record.factors.every(entry => isScoreFactor(entry))))
    && isIsoTimestamp(record.evaluatedAt)
}

function isTopic(value: unknown): value is TopicItem {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && record.id.length > 0
    && typeof record.title === 'string' && record.title.length > 0
    && isNullableString(record.oneLiner)
    && STATUSES.includes(record.status as TopicStatus)
    && isSource(record.source)
    && isStringArray(record.tags) && record.tags.every(tag => tag.length > 0)
    && isNullableString(record.description)
    && (record.score === null || isScore(record.score))
    && (record.planDate === null || (typeof record.planDate === 'string' && DATE_PATTERN.test(record.planDate)))
    && isNullableString(record.scheduleItemId)
    && isNullableString(record.topicDir)
    && isIsoTimestamp(record.createdAt)
    && isIsoTimestamp(record.updatedAt)
}

/** Sort key: `updatedAt` descending (newest first), then id for stability. */
function compareItems(a: TopicItem, b: TopicItem): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? -1 : 1
  return a.id < b.id ? -1 : 1
}

/**
 * Validate one upsert input into its stored shape: `id` is generated as a
 * UUID when absent, timestamps are stamped here, and trimmed fields are
 * normalized (blank optionals collapse to null, blank tags are dropped).
 * @param input - the upsert payload.
 * @returns the stored topic, or the reason the input is invalid.
 */
export function normalizeInput(input: TopicItemInput): { item?: TopicItem; detail?: string } {
  if (typeof input.title !== 'string' || input.title.trim().length === 0) return { detail: 'title must be a non-empty string' }
  if (!isNullableString(input.oneLiner)) return { detail: 'oneLiner must be a string or null' }
  if (!STATUSES.includes(input.status)) return { detail: 'unknown status' }
  if (!isSource(input.source)) return { detail: 'source must be a valid provenance object' }
  if (!isStringArray(input.tags)) return { detail: 'tags must be an array of strings' }
  if (!isNullableString(input.description)) return { detail: 'description must be a string or null' }
  if (input.score !== null && !isScore(input.score)) return { detail: 'score must be a valid evaluation or null' }
  if (input.planDate !== null && (typeof input.planDate !== 'string' || !DATE_PATTERN.test(input.planDate))) return { detail: 'planDate must be YYYY-MM-DD or null' }
  if (!isNullableString(input.scheduleItemId)) return { detail: 'scheduleItemId must be a string or null' }
  if (!isNullableString(input.topicDir)) return { detail: 'topicDir must be a string or null' }
  const now = new Date().toISOString()
  return {
    item: {
      id: input.id ?? (randomUUID() as TopicItem['id']),
      title: input.title.trim(),
      oneLiner: input.oneLiner === null ? null : input.oneLiner.trim() || null,
      status: input.status,
      source: {
        type: input.source.type,
        refId: input.source.refId === null ? null : input.source.refId.trim() || null,
        url: input.source.url === null ? null : input.source.url.trim() || null,
        snapshot: input.source.snapshot,
      },
      tags: input.tags.map(tag => tag.trim()).filter(tag => tag.length > 0),
      description: input.description === null ? null : input.description.trim() || null,
      score: input.score,
      planDate: input.planDate,
      scheduleItemId: input.scheduleItemId,
      topicDir: input.topicDir,
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Parse one JSON document, reporting a parse failure as null.
 * @param raw - the document text.
 * @returns the parsed value, or null when the text is not valid JSON.
 */
function parseJsonOrNull(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Read the topic bank file.
 * @param file - absolute `_topics.json` path; a missing file is empty.
 * @returns the snapshot with items sorted and every bad record named.
 */
export async function readTopics(file: string): Promise<ContentTopicsSnapshot> {
  const raw = await readFile(file, 'utf8').catch(() => null)
  if (raw === null) return { file, items: [], problems: [] }
  const parsed = parseJsonOrNull(raw)
  if (parsed === null) return { file, items: [], problems: ['topic bank file is not valid JSON'] }
  const root = parsed as Record<string, unknown>
  // Future on-disk formats never load as current records: the version gate
  // mirrors the outputs metadata contract (one backend, one format).
  if (root.formatVersion !== 0) return { file, items: [], problems: [`unsupported topic bank formatVersion ${String(root.formatVersion)}`] }
  if (!Array.isArray(root.items)) return { file, items: [], problems: ['topic bank file has no items array'] }

  const items: TopicItem[] = []
  const problems: string[] = []
  for (const entry of root.items) {
    if (isTopic(entry)) items.push(entry)
    else problems.push(`dropped one invalid topic record: ${JSON.stringify(entry).slice(0, 120)}`)
  }
  items.sort(compareItems)
  return { file, items, problems }
}

/**
 * Apply one mutation to the topic bank under a file lock, atomically.
 * @param file - absolute `_topics.json` path; parent directories are
 * created before the lock so a fresh install's very first write succeeds.
 * @param mutate - pure transform over the current item list.
 * @returns the mutation's write snapshot (post-write state).
 */
export async function mutateTopics(
  file: string,
  mutate: (items: readonly TopicItem[]) => Promise<readonly TopicItem[]> | readonly TopicItem[],
): Promise<ContentTopicsSnapshot> {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  return withFileLock(file, async () => {
    const before = await readTopics(file)
    const items = await mutate(before.items)
    const body = `${JSON.stringify({ formatVersion: 0, items }, null, 2)}\n`
    await writeFileAtomic(file, body, { mode: 0o600, dirMode: 0o700 })
    const after = await readTopics(file)
    return { ...after, problems: [...before.problems, ...after.problems] }
  })
}
