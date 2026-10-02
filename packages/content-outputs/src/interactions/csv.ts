/**
 * CSV parsing for the interactions face: the frozen import contract in, and
 * the round-trip export builder out. Nothing touches disk here — the
 * preview returns parsed rows plus every rejection, and only the confirmed
 * rows land through the commit face. Unlike the review importers, the
 * columns are this plugin's own contract (exact header names), not a
 * platform's export template, so no alias table exists.
 */

import type {
  InteractionImportPreview, InteractionImportPreviewRequest, InteractionMessageType,
  InteractionParsedMessage, InteractionPlatformId, InteractionRejectedRow,
} from './types.ts'
import { INTERACTION_MESSAGE_TYPES, INTERACTION_PLATFORMS } from './types.ts'
import { parseCsvRows, parseDateCell } from '../review/importers.ts'

/** Hard input cap: the largest CSV text one parse accepts. */
export const INTERACTION_MAX_IMPORT_CHARS = 2_000_000

/** Hard row cap: the most data rows one file may carry. */
export const INTERACTION_MAX_IMPORT_ROWS = 5_000

/** Hard content cap; longer messages truncate rather than reject. */
export const INTERACTION_MAX_MESSAGE_CHARS = 20_000

/**
 * The export column order: exactly the import columns plus
 * `conversation_id`, `status`, and `tags` — an export re-imports unchanged.
 */
export const INTERACTION_CSV_COLUMNS: readonly string[] = [
  'platform', 'external_message_id', 'external_user_id', 'nickname', 'type',
  'content', 'in_reply_to', 'sent_at', 'topic_ref', 'output_ref', 'persona_id',
  'conversation_id', 'status', 'tags',
]

/** Import columns that must resolve from the header or the whole file rejects. */
const REQUIRED_COLUMNS: readonly (typeof INTERACTION_CSV_COLUMNS[number])[] = [
  'platform', 'external_message_id', 'external_user_id', 'type', 'content', 'sent_at',
]

/** Whether the value is one well-typed platform id. */
function isPlatform(value: unknown): value is InteractionPlatformId {
  return typeof value === 'string' && (INTERACTION_PLATFORMS as readonly string[]).includes(value)
}

/** Whether the value is one well-typed message kind. */
function isMessageType(value: unknown): value is InteractionMessageType {
  return typeof value === 'string' && (INTERACTION_MESSAGE_TYPES as readonly string[]).includes(value)
}

/** Normalize one header cell: trim and lowercase, nothing else — the columns are ours. */
function normalizeHeader(cell: string): string {
  return cell.trim().toLowerCase()
}

/**
 * Escape one CSV field per RFC 4180: quotes double, delimiters force quoting.
 * @param value - the raw field text.
 * @returns the field safe to place as one CSV record cell.
 */
export function escapeCsvField(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/**
 * Parse one import file into the preview: validated message rows plus
 * per-row rejections with 1-based physical row numbers. Text that decodes
 * with replacement characters reads as a non-UTF-8 (typically GBK) export
 * and rejects wholesale — no silent mojibake, no auto-transcode guessing.
 * @param request - the file name and the raw CSV text (browser-decoded).
 * @returns the preview; nothing is stored.
 */
export function parseInteractionImport(request: InteractionImportPreviewRequest): InteractionImportPreview {
  if (request.text.includes('\uFFFD')) {
    throw new Error('import file is not valid UTF-8 (GBK export?); re-export it as UTF-8 and retry')
  }
  if (request.text.length > INTERACTION_MAX_IMPORT_CHARS) {
    throw new Error(`interaction import exceeds the ${INTERACTION_MAX_IMPORT_CHARS}-character cap`)
  }
  const physicalRows = parseCsvRows(request.text).filter(row => row.some(cell => cell.trim().length > 0))
  if (physicalRows.length === 0) throw new Error('interaction import file is empty')
  const header = (physicalRows[0] as string[]).map(normalizeHeader)
  const columns = new Map<string, number>()
  header.forEach((cell, index) => {
    if (!columns.has(cell)) columns.set(cell, index)
  })
  const missing = REQUIRED_COLUMNS.filter(column => !columns.has(column))
  if (missing.length > 0) {
    throw new Error(`interaction import is missing required columns: ${missing.join(', ')}`)
  }
  const indexOf = (name: string): number => columns.get(name) ?? -1

  const rows: InteractionParsedMessage[] = []
  const rejected: InteractionRejectedRow[] = []
  const batchIndex = new Map<string, number>()
  for (let rowIndex = 1; rowIndex < physicalRows.length; rowIndex += 1) {
    // +1 for the header so rejections number physical file rows 1-based.
    const rowNumber = rowIndex + 1
    if (rows.length + rejected.length >= INTERACTION_MAX_IMPORT_ROWS) {
      rejected.push({ row: rowNumber, reason: `exceeds the ${INTERACTION_MAX_IMPORT_ROWS}-row cap` })
      break
    }
    const cells = physicalRows[rowIndex] as string[]
    const cell = (name: string): string => (indexOf(name) === -1 ? '' : (cells[indexOf(name)] ?? '')).trim()
    try {
      const platform = cell('platform')
      if (!isPlatform(platform)) throw new Error(`invalid platform "${platform}"`)
      const externalMessageId = cell('external_message_id')
      if (externalMessageId.length === 0) throw new Error('missing external_message_id')
      const externalUserId = cell('external_user_id')
      if (externalUserId.length === 0) throw new Error('missing external_user_id')
      const type = cell('type')
      if (!isMessageType(type)) throw new Error(`invalid type "${type}"`)
      const content = cell('content')
      if (content.length === 0) throw new Error('missing content')
      const sentAtRaw = cell('sent_at')
      if (sentAtRaw.length === 0) throw new Error('missing sent_at')
      const sentAt = parseDateCell(sentAtRaw)
      if (sentAt === null) throw new Error('missing sent_at')
      const message: InteractionParsedMessage = {
        platform,
        externalMessageId,
        externalUserId,
        nickname: cell('nickname') || null,
        type,
        content: content.slice(0, INTERACTION_MAX_MESSAGE_CHARS),
        inReplyToExternal: cell('in_reply_to') || null,
        sentAt,
        topicRef: cell('topic_ref') || null,
        outputRef: cell('output_ref') || null,
        personaId: cell('persona_id') || null,
      }
      // The dedup key is global: a repeated id inside one file updates the
      // earlier row in place (last write wins) instead of double-counting.
      const dedupKey = `${message.platform}:${message.externalMessageId}`
      const existing = batchIndex.get(dedupKey)
      if (existing === undefined) {
        batchIndex.set(dedupKey, rows.push(message) - 1)
      } else {
        rows[existing] = message
      }
    } catch (error) {
      rejected.push({ row: rowNumber, reason: error instanceof Error ? error.message : String(error) })
    }
  }
  return {
    fileName: request.fileName,
    messages: rows,
    rejected,
    totalRows: rows.length + rejected.length,
  }
}

/**
 * Build one export CSV from whole conversations: the import columns plus
 * `conversation_id`, `status`, and `tags`, UTF-8 BOM first and CRLF lines,
 * so Excel opens it cleanly and the file re-imports unchanged. Threads
 * export the parent's external message id in `in_reply_to`, resolved
 * through the internal-id map; unresolved parents export empty.
 * @param conversations - the conversations to export.
 * @returns the complete CSV text with BOM.
 */
export function buildInteractionExportCsv(conversations: readonly {
  readonly id: string
  readonly platform: string
  readonly status: string
  readonly tags: readonly string[]
  readonly participant: { readonly externalUserId: string; readonly nickname: string }
  readonly messages: readonly {
    readonly id: string
    readonly externalMessageId: string
    readonly type: string
    readonly content: string
    readonly inReplyTo: string | null
    readonly sentAt: string
  }[]
}[]): string {
  // Message identity on the wire is external: map every internal id to its
  // external id once, so `in_reply_to` exports the platform-side parent.
  const externalById = new Map<string, string>()
  for (const conversation of conversations) {
    for (const message of conversation.messages) {
      externalById.set(message.id, message.externalMessageId)
    }
  }
  const lines: string[] = [INTERACTION_CSV_COLUMNS.join(',')]
  for (const conversation of conversations) {
    for (const message of conversation.messages) {
      const fields = [
        conversation.platform,
        message.externalMessageId,
        conversation.participant.externalUserId,
        conversation.participant.nickname,
        message.type,
        message.content,
        message.inReplyTo === null ? '' : externalById.get(message.inReplyTo) ?? '',
        message.sentAt,
        '',
        '',
        '',
        conversation.id,
        conversation.status,
        conversation.tags.join('|'),
      ]
      lines.push(fields.map(field => escapeCsvField(field)).join(','))
    }
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}
