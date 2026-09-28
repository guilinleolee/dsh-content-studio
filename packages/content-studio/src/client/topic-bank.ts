/**
 * Pure logic of the topic-bank view: the five-status single-source config,
 * the persisted view/filter configuration with versioned load migration,
 * filtering (source, score range, tag, status, keyword, plan window), the
 * kanban grouping, and the Markdown export whose frontmatter is emitted and
 * parsed by one strict schema so export → import round-trips losslessly.
 * No React, no I/O — the view and the tests share this module, like
 * `calendar.ts`, `create.ts`, and `competitors.ts`.
 */

import type { TopicItem, TopicItemInput, TopicSourceType, TopicStatus } from '@deepseek-ai/dsh-content-topics/types'

/** Kanban column order and the canonical status sequence, oldest stage first. */
export const TOPIC_STATUSES: readonly TopicStatus[] = ['idea', 'todo', 'creating', 'done', 'shelved']

/** Source families of one topic, in filter order. */
export const TOPIC_SOURCE_TYPES: readonly TopicSourceType[] = ['manual', 'gather', 'benchmark', 'interaction']

/** The persisted view: the topic bank's two faces. */
export type TopicBankViewKind = 'table' | 'kanban'

/** How the plan-date filter scopes the list. */
export type TopicBankPlanWindow = 'all' | 'week' | 'month'

/** One view/filter configuration as persisted to localStorage. */
export interface TopicBankConfig {
  /** Migration gate: an unrecognized version reloads defaults whole. */
  readonly version: 1
  readonly view: TopicBankViewKind
  readonly filters: {
    /** `'all'` or one source family. */
    readonly source: 'all' | TopicSourceType
    /** `'all'` or one lifecycle status. */
    readonly status: 'all' | TopicStatus
    /** Inclusive score-range lower bound, 0–10. */
    readonly scoreMin: number
    /** Inclusive score-range upper bound, 0–10. */
    readonly scoreMax: number
    /** Exact tag match, or null for no tag filter. */
    readonly tag: string | null
    readonly planWindow: TopicBankPlanWindow
    /** Case-insensitive substring over title, pitch, description, and tags. */
    readonly search: string
  }
}

/** The shipped configuration; every load migration falls back here whole. */
export const DEFAULT_TOPIC_BANK_CONFIG: TopicBankConfig = {
  version: 1,
  view: 'table',
  filters: {
    source: 'all',
    status: 'all',
    scoreMin: 0,
    scoreMax: 10,
    tag: null,
    planWindow: 'all',
    search: '',
  },
}

/** The recognized configuration version. */
export const TOPIC_BANK_CONFIG_VERSION = 1

function isSourceFilter(value: unknown): value is TopicBankConfig['filters']['source'] {
  return value === 'all' || (typeof value === 'string' && TOPIC_SOURCE_TYPES.includes(value as TopicSourceType))
}

function isStatusFilter(value: unknown): value is TopicBankConfig['filters']['status'] {
  return value === 'all' || (typeof value === 'string' && TOPIC_STATUSES.includes(value as TopicStatus))
}

function isScoreBound(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10
}

function isPlanWindow(value: unknown): value is TopicBankPlanWindow {
  return value === 'all' || value === 'week' || value === 'month'
}

function normalizeConfig(value: unknown): TopicBankConfig | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (record.version !== TOPIC_BANK_CONFIG_VERSION) return null
  if (record.view !== 'table' && record.view !== 'kanban') return null
  const filters = record.filters
  if (typeof filters !== 'object' || filters === null) return null
  const f = filters as Record<string, unknown>
  if (!isSourceFilter(f.source) || !isStatusFilter(f.status)) return null
  if (!isScoreBound(f.scoreMin) || !isScoreBound(f.scoreMax) || f.scoreMin > f.scoreMax) return null
  if (f.tag !== null && typeof f.tag !== 'string') return null
  if (!isPlanWindow(f.planWindow)) return null
  if (typeof f.search !== 'string') return null
  return {
    version: TOPIC_BANK_CONFIG_VERSION,
    view: record.view,
    filters: {
      source: f.source,
      status: f.status,
      scoreMin: f.scoreMin,
      scoreMax: f.scoreMax,
      tag: f.tag,
      planWindow: f.planWindow,
      search: f.search,
    },
  }
}

/**
 * Load and migrate one persisted configuration. Anything the current schema
 * does not recognize — wrong version, truncated JSON, unexpected shapes —
 * resolves to the defaults whole, so no dirty state ever reaches the view.
 * @param raw - the stored JSON text, or null when nothing was saved.
 * @returns the recognized configuration, or the defaults.
 */
export function loadTopicBankConfig(raw: string | null): TopicBankConfig {
  if (raw === null) return DEFAULT_TOPIC_BANK_CONFIG
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return DEFAULT_TOPIC_BANK_CONFIG
  }
  return normalizeConfig(parsed) ?? DEFAULT_TOPIC_BANK_CONFIG
}

/**
 * Serialize one configuration for localStorage.
 * @param config - the configuration to persist.
 * @returns the JSON text.
 */
export function saveTopicBankConfig(config: TopicBankConfig): string {
  return JSON.stringify(config)
}

/**
 * Local-time Monday of the week containing `today`, as a wire date.
 * @param today - the anchor date, `YYYY-MM-DD`.
 * @returns the week's Monday wire date.
 */
export function weekStart(today: string): string {
  const [year, month, day] = today.split('-').map(Number) as [number, number, number]
  const weekday = (new Date(year, month - 1, day).getDay() + 6) % 7
  const monday = new Date(year, month - 1, day - weekday)
  return formatDate(monday.getFullYear(), monday.getMonth() + 1, monday.getDate())
}

/**
 * Compose a wire date from local year/month(1-12)/day.
 * @param year - calendar year.
 * @param month - calendar month, 1-12.
 * @param day - calendar day.
 * @returns the zero-padded `YYYY-MM-DD` date.
 */
export function formatDate(year: number, month: number, day: number): string {
  const monthText = String(month).padStart(2, '0')
  const dayText = String(day).padStart(2, '0')
  return `${year}-${monthText}-${dayText}`
}

/**
 * The inclusive wire-date range one plan window covers.
 * @param window - the selected window (`week` or `month`; `all` never
 * range-checks and never reaches this function).
 * @param today - the anchor date, `YYYY-MM-DD`.
 * @returns `[start, end]` wire dates; `week` covers Monday–Sunday, `month`
 * the calendar month.
 */
export function planWindowRange(window: Exclude<TopicBankPlanWindow, 'all'>, today: string): readonly [string, string] {
  const start = window === 'week' ? weekStart(today) : `${today.slice(0, 7)}-01`
  const [year, month, day] = start.split('-').map(Number) as [number, number, number]
  if (window === 'week') {
    const end = new Date(year, month - 1, day + 6)
    return [start, formatDate(end.getFullYear(), end.getMonth() + 1, end.getDate())]
  }
  const lastDay = new Date(year, month, 0).getDate()
  return [start, formatDate(year, month, lastDay)]
}

/**
 * Client-side filter of the visible topics: source, status, score range,
 * tag, plan window, and keyword. Unscored topics pass the score filter only
 * when the range's lower bound is 0, so tightening the range hides them;
 * unplanned topics always show unless a week/month window is active.
 * @param items - the bank's topics (any order).
 * @param filters - the active filter state.
 * @param today - the anchor date for plan windows, `YYYY-MM-DD`.
 * @returns the topics passing every filter, in input order.
 */
export function filterTopics(items: readonly TopicItem[], filters: TopicBankConfig['filters'], today: string): readonly TopicItem[] {
  const query = filters.search.trim().toLowerCase()
  return items.filter((item) => {
    if (filters.source !== 'all' && item.source.type !== filters.source) return false
    if (filters.status !== 'all' && item.status !== filters.status) return false
    if (filters.scoreMin > 0 && (item.score === null || item.score.total < filters.scoreMin)) return false
    if (filters.scoreMax < 10 && (item.score === null || item.score.total > filters.scoreMax)) return false
    if (filters.tag !== null && !item.tags.includes(filters.tag)) return false
    if (filters.planWindow !== 'all') {
      const [start, end] = planWindowRange(filters.planWindow, today)
      if (item.planDate === null || item.planDate < start || item.planDate > end) return false
    }
    if (query.length > 0) {
      const haystack = [item.title, item.oneLiner ?? '', item.description ?? '', ...item.tags].join('\n').toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

/** One kanban column: a status and its topics in input order. */
export interface TopicStatusColumn {
  readonly status: TopicStatus
  readonly items: readonly TopicItem[]
}

/**
 * Group topics by status for the kanban's five columns.
 * @param items - the topics to place.
 * @returns one entry per canonical status, in column order, preserving each
 * bucket's input order.
 */
export function groupByStatus(items: readonly TopicItem[]): readonly TopicStatusColumn[] {
  return TOPIC_STATUSES.map(status => ({
    status,
    items: items.filter(item => item.status === status),
  }))
}

/**
 * Collect every distinct tag across the bank, alphabetically.
 * @param items - the bank's topics.
 * @returns the sorted distinct tag list.
 */
export function collectTags(items: readonly TopicItem[]): readonly string[] {
  return [...new Set(items.flatMap(item => [...item.tags]))].sort((a, b) => (a < b ? -1 : 1))
}

/**
 * Render one topic score for the table and kanban: integral scores stay
 * bare, fractional ones keep one decimal.
 * @param total - the score, 0–10.
 * @returns the display text.
 */
export function formatScore(total: number): string {
  return Number.isInteger(total) ? String(total) : total.toFixed(1)
}

// ── Markdown export ──

/** Quote a frontmatter string: the schema quotes every string, escaping `\` and `"`. */
function quote(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

/** Read back one quoted frontmatter string, reversing the emitter's escapes. */
function unquote(value: string): string {
  return value.slice(1, -1).replaceAll('\\"', '"').replaceAll('\\\\', '\\')
}

function isQuoted(value: string): boolean {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
}

/**
 * Emit one topic's frontmatter-plus-body Markdown. The schema is strict:
 * dates stay unquoted `YYYY-MM-DD`, scores stay bare numbers, every other
 * scalar is double-quoted, and tags are a quoted inline array — the exact
 * inverse of {@link parseTopicsMarkdown}, so a round-trip loses nothing.
 * @param item - the topic to render.
 * @returns the Markdown document text.
 */
export function topicToMarkdown(item: TopicItem): string {
  const lines = [
    '---',
    `title: ${quote(item.title)}`,
    `oneLiner: ${item.oneLiner === null ? 'null' : quote(item.oneLiner)}`,
    `status: ${item.status}`,
    `sourceType: ${item.source.type}`,
    `sourceUrl: ${item.source.url === null ? 'null' : quote(item.source.url)}`,
    `tags: [${item.tags.map(quote).join(', ')}]`,
    `score: ${item.score === null ? 'null' : String(item.score.total)}`,
    `planDate: ${item.planDate ?? 'null'}`,
    `updatedAt: ${quote(item.updatedAt)}`,
    '---',
  ]
  const body = item.description ?? ''
  return `${lines.join('\n')}\n\n${body}${body.endsWith('\n') || body.length === 0 ? '' : '\n'}`
}

/**
 * Emit the batch-export document: every topic under the next, separated by
 * a blank line — one file carries the whole selection.
 * @param items - the topics to export, in document order.
 * @returns the Markdown document text.
 */
export function topicsToMarkdown(items: readonly TopicItem[]): string {
  return items.map(topicToMarkdown).join('\n')
}

/** One parsed export document: the schema's fields plus the body text. */
export interface ParsedTopicMarkdown {
  readonly title: string
  readonly oneLiner: string | null
  readonly status: TopicStatus
  readonly sourceType: TopicSourceType
  readonly sourceUrl: string | null
  readonly tags: readonly string[]
  readonly score: number | null
  readonly planDate: string | null
  readonly updatedAt: string
  readonly description: string | null
}

function parseFrontmatterValue(raw: string): string | null {
  if (raw === 'null') return null
  if (isQuoted(raw)) return unquote(raw)
  return raw
}

function parseTags(raw: string): readonly string[] | null {
  if (!raw.startsWith('[') || !raw.endsWith(']')) return null
  const inner = raw.slice(1, -1).trim()
  if (inner.length === 0) return []
  const parts: string[] = []
  let current = ''
  let inQuotes = false
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index] ?? ''
    if (inQuotes && char === '"' && inner[index - 1] !== '\\') inQuotes = false
    else if (char === '"') inQuotes = true
    if (char === ',' && !inQuotes) {
      parts.push(current.trim())
      current = ''
    } else current += char
  }
  parts.push(current.trim())
  return parts.every(part => isQuoted(part))
    ? parts.map(part => parseFrontmatterValue(part) ?? '')
    : null
}

/**
 * Parse one document produced by {@link topicToMarkdown}. The parser accepts
 * only the schema's own shape and answers null for anything else — it exists
 * to keep the export schema honest (round-trip), not to import foreign files.
 * @param markdown - the document text.
 * @returns the parsed fields, or null when the document is not schema output.
 */
export function parseTopicsMarkdown(markdown: string): ParsedTopicMarkdown | null {
  if (!markdown.startsWith('---\n')) return null
  const close = markdown.indexOf('\n---\n', 4)
  if (close < 0) return null
  const frontmatter = markdown.slice(4, close)
  const body = markdown.slice(close + 5).replace(/^\n+/, '').replace(/\n?$/, '\n')
  const fields = new Map<string, string>()
  for (const line of frontmatter.split('\n')) {
    const sep = line.indexOf(': ')
    if (sep <= 0) return null
    fields.set(line.slice(0, sep), line.slice(sep + 2))
  }
  const title = fields.has('title') ? parseFrontmatterValue(fields.get('title') ?? '') : null
  if (title === null || title.length === 0) return null
  const status = fields.get('status') ?? ''
  if (!TOPIC_STATUSES.includes(status as TopicStatus)) return null
  const sourceType = fields.get('sourceType') ?? ''
  if (!TOPIC_SOURCE_TYPES.includes(sourceType as TopicSourceType)) return null
  const tags = parseTags(fields.get('tags') ?? '')
  if (tags === null) return null
  const scoreRaw = fields.get('score') ?? ''
  const score = scoreRaw === 'null' ? null : Number(scoreRaw)
  if (score !== null && (!Number.isFinite(score) || score < 0 || score > 10)) return null
  const planDate = parseFrontmatterValue(fields.get('planDate') ?? '')
  if (planDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(planDate)) return null
  const updatedAt = parseFrontmatterValue(fields.get('updatedAt') ?? '')
  if (updatedAt === null) return null
  return {
    title,
    oneLiner: parseFrontmatterValue(fields.get('oneLiner') ?? ''),
    status: status as TopicStatus,
    sourceType: sourceType as TopicSourceType,
    sourceUrl: parseFrontmatterValue(fields.get('sourceUrl') ?? ''),
    tags,
    score,
    planDate,
    updatedAt,
    description: body.trim().length === 0 ? null : body.trim(),
  }
}

/**
 * Build a create-topic input from one gather material join: the material's
 * stable id rides along as `source.refId`, its link and create-time capture
 * as `source.url` / `source.snapshot`, and the record starts in `idea`.
 * @param material - the joined gather material.
 * @param capturedAt - the capture instant, ISO 8601.
 * @returns the upsert input for the contentTopics Remote.
 */
export function gatherMaterialToTopicInput(
  material: { id: string; title: string; url: string; summary?: string },
  capturedAt: string,
): TopicItemInput {
  return {
    title: material.title,
    oneLiner: material.summary ?? null,
    status: 'idea',
    source: {
      type: 'gather',
      refId: material.id,
      url: material.url,
      snapshot: { title: material.title, summary: material.summary ?? null, capturedAt },
    },
    tags: [],
    description: null,
    score: null,
    planDate: null,
    scheduleItemId: null,
    topicDir: null,
  }
}

/**
 * Build a manual topic input: only the title is required, and the record
 * starts in `idea` — everything else is back-filled later in the detail
 * panel.
 * @param title - the working title.
 * @returns the upsert input for the contentTopics Remote.
 */
export function manualTopicInput(title: string): TopicItemInput {
  return {
    title,
    oneLiner: null,
    status: 'idea',
    source: { type: 'manual', refId: null, url: null, snapshot: null },
    tags: [],
    description: null,
    score: null,
    planDate: null,
    scheduleItemId: null,
    topicDir: null,
  }
}

/**
 * Project one stored topic back to its upsert input, with patches applied —
 * the shape every status move, batch edit, and detail-panel save sends to
 * the contentTopics Remote.
 * @param item - the stored topic.
 * @param patch - the fields overriding the stored ones.
 * @returns the upsert input carrying the topic's `id`.
 */
export function topicInputOf(item: TopicItem, patch: Partial<TopicItemInput> = {}): TopicItemInput {
  return {
    id: item.id,
    title: item.title,
    oneLiner: item.oneLiner,
    status: item.status,
    source: item.source,
    tags: [...item.tags],
    description: item.description,
    score: item.score,
    planDate: item.planDate,
    scheduleItemId: item.scheduleItemId,
    topicDir: item.topicDir,
    ...patch,
  }
}

/**
 * The input for a batch tag edit: the stored tags plus every appended one,
 * deduplicated, order preserved.
 * @param item - the stored topic.
 * @param appended - tags to add; duplicates of existing tags are ignored.
 * @returns the upsert input with the union tags.
 */
export function withAppendedTags(item: TopicItem, appended: readonly string[]): TopicItemInput {
  const tags = [...item.tags]
  for (const tag of appended) {
    if (tag.length > 0 && !tags.includes(tag)) tags.push(tag)
  }
  return topicInputOf(item, { tags })
}
