/**
 * Pure logic of the create workbench: content-type metadata, version-list
 * operations (append, manual-save merge window, pin, prune), word/reading
 * counts, deliverable naming, export rendering, line diffing, and the
 * selection splice. No React, no I/O — the view and the tests share this
 * module, like `competitors.ts` and `calendar.ts`.
 */

import type {
  CreateContentType, CreateManifest, CreateProfileRef, CreateRewriteOperation, CreateStyleKey,
  CreateVersion, OutputKind,
} from '@deepseek-ai/dsh-content-outputs/types'

/** The six built-in content types with the coarse `kind` they map to in metadata. */
export const CREATE_TYPES: readonly { id: CreateContentType; kind: OutputKind }[] = [
  { id: 'gzh-article', kind: 'article' },
  { id: 'xhs-note', kind: 'xhs-note' },
  { id: 'video-script', kind: 'video' },
  { id: 'voiceover', kind: 'audio' },
  { id: 'product-page', kind: 'other' },
  { id: 'rewrite', kind: 'other' },
]

/** Rewrite operations of the selection toolbar, in order. */
export const REWRITE_OPS: readonly CreateRewriteOperation[] = ['condense', 'expand', 'style', 'perspective', 'extract']

/** Style choices of the `style` operation, in order. */
export const REWRITE_STYLES: readonly CreateStyleKey[] = ['professional', 'friendly', 'hardcore', 'story', 'concise']

/** Manual saves inside this window replace the last `manual-save` version instead of stacking one. */
export const MANUAL_MERGE_WINDOW_MS = 5 * 60_000

/** Version quota: the newest unpinned versions survive; pinned ones never age out. */
export const VERSION_CAP = 30

/**
 * The coarse metadata kind a content type maps to.
 * @param id - the content type id.
 * @returns the `OutputKind` of the matching entry, or `'other'` when the id has no entry.
 */
export function contentTypeKind(id: CreateContentType): OutputKind {
  return CREATE_TYPES.find(entry => entry.id === id)?.kind ?? 'other'
}

/**
 * One prefixed, collision-resistant id (`cc-<time><rand>`).
 * @param prefix - the id's leading segment, `'cc'` by default.
 * @returns the composed id string.
 */
export function newId(prefix = 'cc'): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * The manifest a new creation starts from: no versions yet, no topic link.
 * @param contentId - the creation's stable id; also the draft file stem.
 * @param contentType - the initially selected template.
 * @returns the empty manifest.
 */
export function defaultManifest(contentId: string, contentType: CreateContentType): CreateManifest {
  return {
    formatVersion: 0,
    contentId,
    contentType,
    currentVersion: 0,
    context: { audience: null, points: null, references: null },
    topicRef: null,
    sources: [],
    versions: [],
  }
}

/** CJK characters count one word each; latin/digit runs count one word per run. */
const CJK_RUN = /[\u4e00-\u9fff]/gu
const LATIN_WORD = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g

/**
 * Count words the way Chinese creators do: every CJK character is a word,
 * latin words group into one.
 * @param text - the text to count (markdown marks included, they are sparse).
 * @returns the word count.
 */
export function countWords(text: string): number {
  const cjk = text.match(CJK_RUN)?.length ?? 0
  const latin = text.match(LATIN_WORD)?.length ?? 0
  return cjk + latin
}

/**
 * Estimate reading time: voiceover reads at ~240 chars/min, everything else
 * at ~400. Always at least one minute for non-empty text.
 * @param words - the word count.
 * @param contentType - the content type deciding the pace.
 * @returns whole minutes.
 */
export function readingMinutes(words: number, contentType: CreateContentType): number {
  const charsPerMinute = contentType === 'voiceover' ? 240 : 400
  return Math.max(1, Math.ceil(words / charsPerMinute))
}

/**
 * Prune a version list to the quota: pinned versions always survive, the
 * newest unpinned fill the remaining slots. Order stays by `v` ascending.
 * @param versions - the current list.
 * @param cap - the quota.
 * @returns the pruned list.
 */
export function pruneVersions(versions: readonly CreateVersion[], cap = VERSION_CAP): CreateVersion[] {
  const ordered = [...versions].sort((a, b) => a.v - b.v)
  const kept: CreateVersion[] = []
  let unpinned = 0
  for (const version of [...ordered].reverse()) {
    if (version.pinned) {
      kept.push(version)
      continue
    }
    if (unpinned >= cap) continue
    unpinned += 1
    kept.push(version)
  }
  return kept.reverse()
}

/**
 * Append one version as the new current one: `v` continues the counter, the
 * list is pruned to the quota afterwards.
 * @param manifest - the current manifest.
 * @param input - the snapshot facts; `now` is the ISO timestamp.
 * @returns the next manifest.
 */
export function appendVersion(
  manifest: CreateManifest,
  input: { content: string; trigger: string; now: string; profileRef: CreateProfileRef | null; pinned?: boolean },
): CreateManifest {
  const version: CreateVersion = {
    v: manifest.currentVersion + 1,
    ts: input.now,
    trigger: input.trigger,
    words: countWords(input.content),
    content: input.content,
    pinned: input.pinned ?? false,
    profileRef: input.profileRef,
  }
  return {
    ...manifest,
    currentVersion: version.v,
    versions: pruneVersions([...manifest.versions, version]),
  }
}

/**
 * Fold one manual save into the history: inside the merge window after the
 * last `manual-save` version, that version is replaced in place (same `v`);
 * otherwise a new version appends.
 * @param manifest - the current manifest.
 * @param input - the saved text and the ISO timestamp.
 * @returns the next manifest plus whether a new version was created.
 */
export function mergeManualSave(
  manifest: CreateManifest,
  input: { content: string; now: string; profileRef: CreateProfileRef | null },
): { manifest: CreateManifest; created: boolean } {
  const last = manifest.versions.at(-1)
  if (last !== undefined && last.trigger === 'manual-save'
    && Number.isFinite(Date.parse(last.ts)) && Date.parse(input.now) - Date.parse(last.ts) < MANUAL_MERGE_WINDOW_MS) {
    const replaced: CreateVersion = { ...last, ts: input.now, words: countWords(input.content), content: input.content }
    return {
      manifest: { ...manifest, versions: [...manifest.versions.slice(0, -1), replaced] },
      created: false,
    }
  }
  return { manifest: appendVersion(manifest, { ...input, trigger: 'manual-save' }), created: true }
}

/**
 * Toggle the pin of one version; pinned versions never age out of the quota.
 * @param manifest - the current manifest.
 * @param v - the version to toggle.
 * @returns the next manifest, or the input when the version is unknown.
 */
export function pinVersion(manifest: CreateManifest, v: number): CreateManifest {
  const target = manifest.versions.find(version => version.v === v)
  if (target === undefined) return manifest
  return {
    ...manifest,
    versions: manifest.versions.map(version => version.v === v ? { ...version, pinned: !version.pinned } : version),
  }
}

/**
 * The stored text of one version.
 * @param manifest - the current manifest.
 * @param v - the version to read.
 * @returns its content, or null when unknown.
 */
export function versionContent(manifest: CreateManifest, v: number): string | null {
  return manifest.versions.find(version => version.v === v)?.content ?? null
}

/**
 * Splice one range of the text (the rewrite selection) with its replacement.
 * @param text - the full editor text.
 * @param start - the selection start offset.
 * @param end - the selection end offset.
 * @param replacement - the replacement text.
 * @returns the spliced text.
 */
export function replaceRange(text: string, start: number, end: number, replacement: string): string {
  return text.slice(0, start) + replacement + text.slice(end)
}

/** One diff row of the rewrite preview. */
export interface DiffRow {
  readonly kind: 'same' | 'del' | 'add'
  readonly text: string
}

/**
 * Line diff of two texts for the rewrite preview. Common leading and
 * trailing lines are trimmed first, then a bounded LCS fills the middle;
 * beyond the bound the whole block reads as one del+add pair.
 * @param before - the original text.
 * @param after - the rewritten text.
 * @returns the row list.
 */
export function lineDiff(before: string, after: string): DiffRow[] {
  const a = before.split('\n')
  const b = after.split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1
    endB -= 1
  }
  const head = a.slice(0, start).map(text => ({ kind: 'same' as const, text }))
  const tail = a.slice(endA).map(text => ({ kind: 'same' as const, text }))
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  if (midA.length * midB.length > 40_000) {
    return [
      ...head,
      ...midA.map(text => ({ kind: 'del' as const, text })),
      ...midB.map(text => ({ kind: 'add' as const, text })),
      ...tail,
    ]
  }
  const rows: DiffRow[] = []
  const lcs = lcsTable(midA, midB)
  emitDiff(lcs, midA, midB, midA.length, midB.length, rows)
  return [...head, ...rows, ...tail]
}

/** Index a list with the caller's proven-range guarantee; throws on programmer error. */
function at<T>(list: readonly T[], index: number): T {
  const value = list[index]
  if (value === undefined) throw new Error(`create diff: index ${index} out of range (${list.length} entries)`)
  return value
}

/** Classic DP LCS length table. */
function lcsTable(a: readonly string[], b: readonly string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      at(table, i)[j] = a[i - 1] === b[j - 1] ? at(at(table, i - 1), j - 1) + 1 : Math.max(at(at(table, i - 1), j), at(at(table, i), j - 1))
    }
  }
  return table
}

/** Walk the LCS table backwards, emitting del/add/same rows in reading order. */
function emitDiff(table: number[][], a: readonly string[], b: readonly string[], i: number, j: number, rows: DiffRow[]): void {
  if (i > 0 && j > 0 && at(a, i - 1) === at(b, j - 1)) {
    emitDiff(table, a, b, i - 1, j - 1, rows)
    rows.push({ kind: 'same', text: at(a, i - 1) })
    return
  }
  if (j > 0 && (i === 0 || at(at(table, i), j - 1) >= at(at(table, i - 1), j))) {
    emitDiff(table, a, b, i, j - 1, rows)
    rows.push({ kind: 'add', text: at(b, j - 1) })
    return
  }
  if (i > 0) {
    emitDiff(table, a, b, i - 1, j, rows)
    rows.push({ kind: 'del', text: at(a, i - 1) })
  }
}

/**
 * Slugify a title for file naming: CJK stays, spaces and punctuation become
 * hyphens, the result is capped and never empty.
 * @param title - the raw title.
 * @returns the slug.
 */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '')
  return slug.length > 0 ? slug : 'draft'
}

/** The id stem a deliverable name carries (last 8 alphanumerics of the content id). */
function idStem(contentId: string): string {
  const stem = contentId.replace(/[^a-z0-9]/gi, '').slice(-8)
  return stem.length > 0 ? stem : '00000000'
}

/**
 * The theme-root deliverable name of a publish: `<slug>-<id8>.md`.
 * @param title - the current title.
 * @param contentId - the creation id.
 * @returns the file name.
 */
export function deliverableName(title: string, contentId: string): string {
  return `${slugify(title)}-${idStem(contentId)}.md`
}

/**
 * The `assets/` export file name of one export action.
 * @param title - the current title.
 * @param contentId - the creation id.
 * @returns the file name.
 */
export function exportFileName(title: string, contentId: string): string {
  return `export-${slugify(title)}-${idStem(contentId)}.md`
}

/**
 * Render one export document: frontmatter (title, type, status, version,
 * export time) followed by the body.
 * @param meta - the frontmatter facts.
 * @param content - the body text.
 * @returns the complete markdown document.
 */
export function buildExportMarkdown(
  meta: { title: string; contentType: CreateContentType; status: string; version: number; exportedAt: string },
  content: string,
): string {
  return [
    '---',
    `title: ${meta.title}`,
    `contentType: ${meta.contentType}`,
    `status: ${meta.status}`,
    `version: ${meta.version}`,
    `exportedAt: ${meta.exportedAt}`,
    '---',
    '',
    content,
    '',
  ].join('\n')
}

/**
 * Classify a version trigger into its locale stem
 * (`create.trigger.<class>`).
 * @param trigger - the stored trigger string.
 * @returns the locale stem suffix.
 */
export function triggerClass(trigger: string): 'ai' | 'manual' | 'restore' | 'retarget' | 'rewrite' {
  if (trigger.startsWith('rewrite:')) return 'rewrite'
  if (trigger === 'manual-save') return 'manual'
  if (trigger === 'restore') return 'restore'
  if (trigger === 'retarget') return 'retarget'
  return 'ai'
}

/** The content types whose variant batches ride one request. */
export const BATCHABLE_CONTENT_TYPES: readonly CreateContentType[] = ['xhs-note']

/**
 * Whether the content type can batch three variants in one request.
 * @param contentType - the content type id to test.
 * @returns whether the type is in `BATCHABLE_CONTENT_TYPES`.
 */
export function isBatchable(contentType: CreateContentType): boolean {
  return BATCHABLE_CONTENT_TYPES.includes(contentType)
}

/** The local advisory hashtag pool: common creator niches, matched against the text. */
export const HASHTAG_POOL: readonly string[] = [
  'AI工具', '效率提升', '自媒体', '副业', '职场', '创业', '个人成长', '数码测评',
  '生活方式', '理财', '健康', '学习', '时间管理', '写作', '营销', '品牌',
  '小程序', '编程', '设计', '旅行', '美食', '家居', '育儿', '健身',
]

/**
 * Suggest hashtags from the pool by matching them against the text, title
 * first; unmatched pool entries never appear, and the suggestions cap at
 * eight so the block stays scannable.
 * @param title - the work title.
 * @param body - the body text.
 * @returns the suggested tags, best matches first.
 */
export function suggestHashtags(title: string, body: string): string[] {
  const haystack = `${title}\n${body}`
  const hits = HASHTAG_POOL.filter(tag => haystack.includes(tag))
  const titleHits = hits.filter(tag => title.includes(tag))
  const rest = hits.filter(tag => !title.includes(tag))
  return [...titleHits, ...rest].slice(0, 8)
}

/**
 * Format one hashtag block for the platform: 小红书 uses a space-separated
 * `#标签` run, 公众号 and 知乎 use closed `#标签#` entries.
 * @param tags - the chosen tags.
 * @param contentType - the content type deciding the platform format.
 * @returns the formatted hashtag line, or an empty string with no tags.
 */
export function formatHashtags(tags: readonly string[], contentType: CreateContentType): string {
  const clean = tags.map(tag => tag.trim()).filter(tag => tag.length > 0)
  if (clean.length === 0) return ''
  if (contentType === 'xhs-note') return clean.map(tag => `#${tag}`).join(' ')
  return clean.map(tag => `#${tag}#`).join(' ')
}

/**
 * Append one hashtag block to the body, on its own line.
 * @param text - the current body.
 * @param block - the formatted hashtag line.
 * @returns the body with the block appended.
 */
export function appendHashtagBlock(text: string, block: string): string {
  if (block.length === 0) return text
  const trimmed = text.trimEnd()
  return `${trimmed.length > 0 ? trimmed : ''}\n\n${block}\n`
}

/** Deterministic local metrics shown next to the advisory AI evaluation. */
export interface LocalMetrics {
  readonly words: number
  /** Non-empty paragraphs. */
  readonly paragraphs: number
  /** Length of the first heading line, or 0 when the body starts without one. */
  readonly titleLength: number
}

/**
 * Compute the deterministic local metrics of a draft.
 * @param text - the draft text.
 * @returns the metrics.
 */
export function localMetrics(text: string): LocalMetrics {
  const lines = text.split('\n')
  const paragraphs = lines.map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('#')).length
  const heading = lines.find(line => line.trim().startsWith('#'))
  return {
    words: countWords(text),
    paragraphs,
    titleLength: heading === undefined ? 0 : countWords(heading.replace(/^#+\s*/, '')),
  }
}
