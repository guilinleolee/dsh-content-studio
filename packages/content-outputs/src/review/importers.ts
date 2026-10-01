/**
 * Import parsing for the review face: RFC 4180 CSV text in, validated and
 * normalized work rows out. Nothing touches disk here — the preview returns
 * parsed rows plus every rejection, and only the confirmed rows land as
 * snapshots through the commit face. Column mapping is data-driven per
 * platform (aliased header names, since export templates differ per platform
 * and per release); unmapped columns are surfaced, never silently dropped.
 */

import type {
  ReviewContentType, ReviewImportPreview, ReviewImportPreviewRequest, ReviewMetrics,
  ReviewParsedRow, ReviewPlatformId, ReviewRejectedRow,
} from '../types.ts'
import { REVIEW_PLATFORMS } from '../types.ts'

/** Hard input cap: the largest CSV text one parse accepts. */
export const REVIEW_MAX_IMPORT_CHARS = 2_000_000

/** Hard row cap: the most data rows one file may carry. */
export const REVIEW_MAX_IMPORT_ROWS = 5_000

/** Hard title cap; longer titles truncate rather than reject. */
export const REVIEW_MAX_TITLE_CHARS = 300

/**
 * Parse one CSV document into physical rows: RFC 4180 quoted fields with
 * doubled-quote escapes, CR / LF / CRLF line endings, and a stripped UTF-8
 * BOM. A quote inside an unquoted field is literal; a newline inside quotes
 * keeps the physical-row count aligned with the caller's rejection numbering.
 * @param text - the raw file text.
 * @returns the rows, each a list of field strings.
 */
export function parseCsvRows(text: string): string[][] {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let index = 0
  while (index < body.length) {
    const char = body[index] as string
    if (inQuotes) {
      if (char === '"') {
        if (body[index + 1] === '"') {
          field += '"'
          index += 2
          continue
        }
        inQuotes = false
        index += 1
        continue
      }
      field += char
      index += 1
      continue
    }
    if (char === '"') {
      inQuotes = true
      index += 1
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      index += 1
      continue
    }
    if (char === '\r' || char === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      index += char === '\r' && body[index + 1] === '\n' ? 2 : 1
      continue
    }
    field += char
    index += 1
  }
  // A final field only exists when the document does not end on a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** One header alias list per metric field; first match wins. Matching normalizes case, spaces, and full-width parens. */
const METRIC_COLUMN_ALIASES: Readonly<Record<keyof ReviewMetrics, readonly string[]>> = {
  impressions: ['曝光量', '曝光', '展现量', '展现', 'impressions'],
  reads: ['观看量', '阅读数', '阅读', '播放量', '播放', '阅读量', 'views', 'reads'],
  likes: ['点赞量', '点赞数', '点赞', 'likes'],
  collects: ['收藏量', '收藏数', '收藏', 'collects'],
  comments: ['评论量', '评论数', '评论', '弹幕量', 'comments'],
  shares: ['分享量', '分享数', '分享', '转发量', '转发数', '转发', 'shares'],
  followersGained: ['涨粉量', '涨粉数', '涨粉', '新增粉丝', 'followers'],
  coverCtr: ['封面点击率', '点击率', 'ctr'],
}

/** Identity column aliases per platform: work id, title, publish time, content form. */
const IDENTITY_COLUMN_ALIASES: Readonly<Record<'workId' | 'title' | 'publishedAt' | 'contentType', readonly string[]>> = {
  workId: ['笔记id', '作品id', '视频id', '文章id', 'bv号', '工作id', 'id'],
  title: ['笔记标题', '作品标题', '标题', '图文标题', 'title'],
  publishedAt: ['发布时间', '发表时间', '刊登时间', '发布日期', 'publishedat', '时间'],
  contentType: ['笔记类型', '作品类型', '内容类型', '类型', 'contenttype'],
}

/** Content-form value aliases: anything else reads as null (unknown form). */
const CONTENT_TYPE_ALIASES: Readonly<Record<'image-text' | 'video', readonly string[]>> = {
  'image-text': ['图文', '图片', '笔记', '文章', 'image-text'],
  video: ['视频', '短视频', 'video'],
}

/** Normalize one header cell for alias matching: case, spaces, and bracketed qualifier suffixes go away. */
function normalizeHeader(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/gu, '').replace(/[(（][^)）]*[)）]/gu, '')
}

/** Every internal field the column mapper resolves. */
type ImportField = keyof ReviewMetrics | 'workId' | 'title' | 'publishedAt' | 'contentType'

/**
 * Map one CSV header row onto the internal fields by alias.
 * @param header - the raw header cells.
 * @returns each field's column index (-1 when no header matched), plus the
 *   unmatched header names.
 */
export function mapImportColumns(header: readonly string[]): {
  columns: Record<ImportField, number>
  unknownColumns: string[]
} {
  const columns = {} as Record<ImportField, number>
  for (const key of Object.keys(METRIC_COLUMN_ALIASES)) columns[key as ImportField] = -1
  for (const key of Object.keys(IDENTITY_COLUMN_ALIASES)) columns[key as ImportField] = -1
  const unknownColumns: string[] = []
  for (let index = 0; index < header.length; index += 1) {
    const cell = normalizeHeader(header[index] ?? '')
    if (cell.length === 0) continue
    let matched = false
    for (const [field, aliases] of [...Object.entries(METRIC_COLUMN_ALIASES), ...Object.entries(IDENTITY_COLUMN_ALIASES)]) {
      if (columns[field as ImportField] !== -1) continue
      if (aliases.some(alias => normalizeHeader(alias) === cell)) {
        columns[field as ImportField] = index
        matched = true
        break
      }
    }
    if (!matched) unknownColumns.push((header[index] as string).trim())
  }
  return { columns, unknownColumns }
}

/**
 * Normalize one metric cell: numbers pass through, `万`/`w` suffixed values
 * scale to units, blanks and dashes read as null. Any other text rejects.
 * @param cell - the raw cell, or undefined when the column is absent.
 * @returns the number, or null when blank.
 */
export function parseMetricCell(cell: string | undefined): number | null {
  if (cell === undefined) return null
  const trimmed = cell.trim()
  if (trimmed.length === 0 || trimmed === '-' || trimmed === '—' || trimmed === '--') return null
  const scaled = trimmed.match(/^(-?[\d.,]+)\s*[万wW]$/u)
  if (scaled !== null) {
    const base = Number((scaled[1] as string).replace(/,/gu, ''))
    if (Number.isFinite(base)) return Math.round(base * 10_000)
  }
  const value = Number(trimmed.replace(/,/gu, '').replace(/%/gu, ''))
  if (!Number.isFinite(value)) throw new Error(`non-numeric metric value "${trimmed}"`)
  return Math.round(value)
}

/**
 * Normalize one date cell to an ISO 8601 instant. Accepts ISO strings and the
 * `YYYY/M/D H:m[:s]` / `YYYY-M-D` forms the platform exports use; blank reads
 * as null; anything else rejects.
 * @param cell - the raw cell, or undefined when the column is absent.
 * @returns the ISO instant, or null when blank.
 */
export function parseDateCell(cell: string | undefined): string | null {
  if (cell === undefined) return null
  const trimmed = cell.trim()
  if (trimmed.length === 0 || trimmed === '-') return null
  const slash = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/u)
  if (slash !== null) {
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = slash
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)))
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  throw new Error(`unparseable date "${trimmed}"`)
}

/** Resolve one content-form cell to its union value; unknown text reads as null. */
function parseContentTypeCell(cell: string | undefined): ReviewContentType | null {
  if (cell === undefined) return null
  const normalized = normalizeHeader(cell)
  if (normalized.length === 0) return null
  for (const key of ['image-text', 'video'] as const) {
    if (CONTENT_TYPE_ALIASES[key].some(alias => normalizeHeader(alias) === normalized)) return key
  }
  return null
}

/**
 * Parse one import file into the preview: mapped rows, per-row rejections
 * with 1-based physical row numbers, and the unmatched header names. The
 * work-id column must resolve or the whole file rejects — rows without an
 * identity cannot dedupe.
 * @param request - the platform, the file name, and the raw CSV text.
 * @returns the preview; nothing is stored.
 */
export function parseImportFile(request: ReviewImportPreviewRequest): ReviewImportPreview {
  if (!REVIEW_PLATFORMS.includes(request.platformId)) {
    throw new Error(`invalid review platformId: ${request.platformId}`)
  }
  if (request.text.length > REVIEW_MAX_IMPORT_CHARS) {
    throw new Error(`review import exceeds the ${REVIEW_MAX_IMPORT_CHARS}-character cap`)
  }
  const physicalRows = parseCsvRows(request.text).filter(row => row.some(cell => cell.trim().length > 0))
  if (physicalRows.length === 0) throw new Error('review import file is empty')
  const header = physicalRows[0] as string[]
  const { columns, unknownColumns } = mapImportColumns(header)
  if (columns.workId === -1 || columns.title === -1) {
    throw new Error('review import needs resolvable work-id and title columns')
  }
  const rows: ReviewParsedRow[] = []
  const rejected: ReviewRejectedRow[] = []
  const seenWorkIds = new Set<string>()
  for (let rowIndex = 1; rowIndex < physicalRows.length; rowIndex += 1) {
    // +1 for the header so rejections number physical file rows 1-based.
    const rowNumber = rowIndex + 1
    if (rows.length + rejected.length >= REVIEW_MAX_IMPORT_ROWS) {
      rejected.push({ row: rowNumber, reason: `exceeds the ${REVIEW_MAX_IMPORT_ROWS}-row cap` })
      break
    }
    const cells = physicalRows[rowIndex] as string[]
    try {
      const workId = (cells[columns.workId] ?? '').trim()
      const title = (cells[columns.title] ?? '').trim().slice(0, REVIEW_MAX_TITLE_CHARS)
      if (workId.length === 0) throw new Error('missing work id')
      if (title.length === 0) throw new Error('missing title')
      if (seenWorkIds.has(workId)) throw new Error(`duplicate work id "${workId}" in file`)
      seenWorkIds.add(workId)
      const metrics = {} as Record<keyof ReviewMetrics, number | null>
      for (const field of Object.keys(METRIC_COLUMN_ALIASES) as ReadonlyArray<keyof ReviewMetrics>) {
        metrics[field] = parseMetricCell(columns[field] === -1 ? undefined : cells[columns[field]])
      }
      const row: ReviewParsedRow = {
        platformWorkId: workId,
        title,
        publishedAt: parseDateCell(columns.publishedAt === -1 ? undefined : cells[columns.publishedAt]),
        contentType: parseContentTypeCell(columns.contentType === -1 ? undefined : cells[columns.contentType]),
        metrics,
      }
      rows.push(row)
    } catch (error) {
      rejected.push({ row: rowNumber, reason: error instanceof Error ? error.message : String(error) })
    }
  }
  return {
    fileName: request.fileName,
    platformId: request.platformId,
    rows,
    rejected,
    unknownColumns,
    totalRows: rows.length + rejected.length,
  }
}

/**
 * The platform export shapes the importers document as their baseline
 * (verified against each platform's center export naming as of 2026-09;
 * aliases absorb the drift). UI copy may surface this list verbatim.
 */
export const PLATFORM_IMPORT_HINTS: Readonly<Record<ReviewPlatformId, string>> = {
  xhs: '小红书专业号数据中心「笔记列表明细表」导出（CSV）',
  douyin: '抖音创作者中心作品数据导出（CSV）',
  gzh: '公众号内容分析已发表内容导出（CSV）',
  bilibili: 'B站创作中心播放效果导出（CSV）',
}
