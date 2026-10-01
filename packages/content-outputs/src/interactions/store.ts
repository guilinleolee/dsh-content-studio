/**
 * On-disk store for the interactions face: the library-root
 * `_interactions.json` system file (underscore = invisible to the outputs
 * scanner). `.dsh-output.json`, theme directories, and every other face's
 * file are never touched. One malformed conversation never hides the rest —
 * it is named in `problems` and dropped; a malformed envelope reads as an
 * empty manifest with the rejection named. Writes reject wholesale (the
 * caller fixes its list, the store never repairs it) and recompute the
 * derived summary under the same commit, so the cache can never drift from
 * the conversations it summarizes.
 */

import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { writeFileAtomic, withFileLock } from '@deepseek-ai/dsh-atomic-write'
import type {
  InteractionConversation, InteractionInsightEntry, InteractionInsights, InteractionMessage,
  InteractionImportCommitRequest, InteractionImportCommitResult, InteractionSummary,
  InteractionsManifest, InteractionsManifestRead,
} from './types.ts'
import {
  EMPTY_INTERACTION_INSIGHTS, EMPTY_INTERACTION_SUMMARY, INTERACTION_MESSAGE_TYPES,
  INTERACTION_PLATFORMS, INTERACTION_STATUSES, INTERACTION_STYLES, UNTAGGED_INTENT, UNTAGGED_SENTIMENT,
} from './types.ts'

/** System file name of the interactions manifest at the library root. */
export const INTERACTIONS_FILENAME = '_interactions.json'

/** Hard conversation count; the write path rejects past it. */
export const INTERACTIONS_MAX_CONVERSATIONS = 20_000

/** Hard messages-per-conversation cap; the write path rejects past it. */
export const INTERACTIONS_MAX_MESSAGES = 5_000

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && ISO_PATTERN.test(value) && !Number.isNaN(Date.parse(value))
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

/** Whether the value is one well-typed platform id. */
function isPlatform(value: unknown): value is InteractionConversation['platform'] {
  return typeof value === 'string' && (INTERACTION_PLATFORMS as readonly string[]).includes(value)
}

/** Whether the value is one well-typed conversation status. */
function isStatus(value: unknown): value is InteractionConversation['status'] {
  return typeof value === 'string' && (INTERACTION_STATUSES as readonly string[]).includes(value)
}

/** Whether the value is one well-typed message kind. */
function isMessageType(value: unknown): value is InteractionMessage['type'] {
  return typeof value === 'string' && (INTERACTION_MESSAGE_TYPES as readonly string[]).includes(value)
}

/** Whether the value is one well-typed reply style. */
function isStyle(value: unknown): value is (typeof INTERACTION_STYLES)[number] {
  return typeof value === 'string' && (INTERACTION_STYLES as readonly string[]).includes(value)
}

/** Whether the value is one well-formed provenance tagging. */
function isTagging<T extends string>(value: unknown, values: readonly T[]): value is { value: T; source: 'user' | 'ai'; aiMeta: { promptVersion: string; at: string } | null } {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.value !== 'string' || !(values as readonly string[]).includes(record.value)) return false
  if (record.source !== 'user' && record.source !== 'ai') return false
  if (record.aiMeta === null) return true
  // The aiMeta shape checks are load-bearing on this parse path: the value
  // arrived as parsed-unknown JSON, so the literal guards carry the type.
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (typeof record.aiMeta !== 'object' || record.aiMeta === null) return false
  const meta = record.aiMeta as Record<string, unknown>
  return isTrimmedNonEmpty(meta.promptVersion) && isIsoTimestamp(meta.at)
}

const SENTIMENTS = ['positive', 'negative', 'question', 'unknown'] as const
const INTENTS = ['consult', 'praise', 'complain', 'demand', 'spam', 'unknown'] as const

/** Whether one stored message has every field present and well-typed. */
function isMessage(value: unknown): value is InteractionMessage {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return isTrimmedNonEmpty(record.id)
    && isTrimmedNonEmpty(record.externalMessageId)
    && (record.direction === 'in' || record.direction === 'out')
    && isMessageType(record.type)
    && typeof record.content === 'string' && record.content.length > 0
    && isNullableString(record.inReplyTo)
    && isIsoTimestamp(record.sentAt)
    && isTagging(record.sentiment, SENTIMENTS)
    && isTagging(record.intent, INTENTS)
    && Array.isArray(record.replyDrafts) && record.replyDrafts.every((draft) => {
    if (typeof draft !== 'object' || draft === null) return false
    const entry = draft as Record<string, unknown>
    return isTrimmedNonEmpty(entry.id) && isStyle(entry.style)
        && typeof entry.content === 'string' && entry.content.length > 0
        && isNullableString(entry.personaId) && isIsoTimestamp(entry.createdAt)
  })
}

/** Whether one stored conversation has every field present and well-typed. */
function isConversation(value: unknown): value is InteractionConversation {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const participant = record.participant
  // The participant shape checks are load-bearing on this parse path: the
  // value arrived as parsed-unknown JSON, so the literal guards carry the
  // type. oxlint-disable-next-line typescript/no-unnecessary-condition
  if (typeof participant !== 'object' || participant === null) return false
  const fields = participant as Record<string, unknown>
  return isTrimmedNonEmpty(record.id)
    && isPlatform(record.platform)
    && isTrimmedNonEmpty(fields.externalUserId)
    && typeof fields.nickname === 'string'
    && isNullableString(record.topicRef)
    && isNullableString(record.outputRef)
    && isNullableString(record.personaId)
    && isStatus(record.status)
    && isStringArray(record.tags) && record.tags.every(tag => tag.length > 0)
    && typeof record.note === 'string'
    && typeof record.starred === 'boolean'
    && isIsoTimestamp(record.createdAt)
    && isIsoTimestamp(record.updatedAt)
    && Array.isArray(record.messages) && record.messages.every(isMessage)
}

/** Whether one stored insight entry is well-typed. */
function isInsightEntry(value: unknown): value is InteractionInsightEntry {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return isTrimmedNonEmpty(record.label)
    && typeof record.count === 'number' && Number.isInteger(record.count) && record.count >= 1
    && isNullableString(record.exampleMessageId)
    && isNullableString(record.topicHint)
}

/** Whether one stored insights record is well-typed. */
function isInsights(value: unknown): value is InteractionInsights {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const lists = [record.topQuestions, record.painPoints, record.interests]
  return (record.generatedAt === null || isIsoTimestamp(record.generatedAt))
    && lists.every(list => Array.isArray(list) && list.every(isInsightEntry))
}

/**
 * Recompute the derived summary from the conversations: the cache the
 * workbench badge reads, always rebuilt — never trusted from the file.
 * @param conversations - the validated conversations.
 * @returns the per-status counts.
 */
export function summarizeInteractions(conversations: readonly InteractionConversation[]): InteractionSummary {
  const counts = { ...EMPTY_INTERACTION_SUMMARY } as Record<InteractionConversation['status'], number>
  for (const conversation of conversations) counts[conversation.status] += 1
  return counts
}

/** Sort key: `updatedAt` descending (newest first), then id for stability. */
function compareConversations(a: InteractionConversation, b: InteractionConversation): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? -1 : 1
  return a.id < b.id ? -1 : 1
}

/** Sort key within one thread: `sentAt` ascending, then id for stability. */
function compareMessages(a: InteractionMessage, b: InteractionMessage): number {
  if (a.sentAt !== b.sentAt) return a.sentAt < b.sentAt ? -1 : 1
  return a.id < b.id ? -1 : 1
}

/**
 * Parse and validate one interactions manifest. One malformed conversation
 * never hides the rest: it is named in `problems` and dropped. The summary
 * cache is always recomputed from the surviving conversations, and the
 * message/conversation orderings are normalized on read.
 * @param raw - exact file contents.
 * @returns the manifest with only valid entries, plus every dropped one named.
 */
export function parseInteractionsManifest(raw: string): { manifest: InteractionsManifest; problems: string[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      manifest: { formatVersion: 0, conversations: [], insights: EMPTY_INTERACTION_INSIGHTS, summary: EMPTY_INTERACTION_SUMMARY },
      problems: ['interactions manifest is not valid JSON'],
    }
  }
  const record = parsed as Record<string, unknown>
  if (record.formatVersion !== 0) {
    return {
      manifest: { formatVersion: 0, conversations: [], insights: EMPTY_INTERACTION_INSIGHTS, summary: EMPTY_INTERACTION_SUMMARY },
      problems: [`unsupported interactions manifest formatVersion ${String(record.formatVersion)}`],
    }
  }
  const problems: string[] = []
  const conversations: InteractionConversation[] = []
  if (Array.isArray(record.conversations)) {
    for (const entry of record.conversations) {
      if (isConversation(entry)) conversations.push(entry)
      else problems.push(`dropped one invalid interaction conversation: ${JSON.stringify(entry).slice(0, 120)}`)
    }
  } else {
    problems.push('interactions manifest has no conversations array')
  }
  const insights = isInsights(record.insights) ? record.insights : EMPTY_INTERACTION_INSIGHTS
  const normalized = conversations
    .map(conversation => ({ ...conversation, messages: [...conversation.messages].sort(compareMessages) }))
    .sort(compareConversations)
  return {
    manifest: { formatVersion: 0, conversations: normalized, insights, summary: summarizeInteractions(normalized) },
    problems,
  }
}

/**
 * Validate one incoming manifest wholesale; used by the write path to reject
 * rather than repair caller mistakes.
 * @param manifest - the manifest the caller wants stored.
 * @throws when the envelope, insights, or any conversation violates the format.
 */
export function assertInteractionsManifest(manifest: InteractionsManifest): void {
  // The read path feeds parsed-unknown JSON through this assert cast to the
  // typed shape, so the envelope version gate is load-bearing.
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (manifest.formatVersion !== 0) throw new Error(`unsupported interactions manifest formatVersion ${String(manifest.formatVersion)}`)
  if (!isInsights(manifest.insights)) throw new Error('interactions manifest insights are malformed')
  if (manifest.conversations.length > INTERACTIONS_MAX_CONVERSATIONS) {
    throw new Error(`interactions manifest exceeds the ${INTERACTIONS_MAX_CONVERSATIONS}-conversation cap`)
  }
  for (const conversation of manifest.conversations) {
    if (!isConversation(conversation)) throw new Error(`invalid interaction conversation: ${JSON.stringify(conversation).slice(0, 120)}`)
    if (conversation.messages.length > INTERACTIONS_MAX_MESSAGES) {
      throw new Error(`interaction conversation ${conversation.id} exceeds the ${INTERACTIONS_MAX_MESSAGES}-message cap`)
    }
  }
}

/** Absolute path of the library-root `_interactions.json`. */
function interactionsPath(root: string): string {
  return join(root, INTERACTIONS_FILENAME)
}

/**
 * Read the interactions manifest.
 * @param root - absolute outputs library root.
 * @returns the manifest (null when absent) with only valid entries, every
 *   dropped one named in `problems`; callers must not write back while
 *   `problems` is non-empty.
 */
export async function readInteractionsFile(root: string): Promise<InteractionsManifestRead> {
  let raw: string
  try {
    raw = await readFile(interactionsPath(root), 'utf8')
  } catch {
    return { manifest: null, problems: [] }
  }
  const { manifest, problems } = parseInteractionsManifest(raw)
  return { manifest, problems }
}

/**
 * Replace the interactions manifest with an atomic, locked commit. The
 * summary cache is recomputed here and the canonical orderings applied, so
 * the stored file is always normalized regardless of what the caller sent.
 * @param root - absolute outputs library root.
 * @param manifest - the complete next manifest.
 * @returns the stored manifest (recomputed summary, canonical order).
 */
export async function writeInteractionsFile(root: string, manifest: InteractionsManifest): Promise<InteractionsManifest> {
  assertInteractionsManifest(manifest)
  const conversations = manifest.conversations
    .map(conversation => ({ ...conversation, messages: [...conversation.messages].sort(compareMessages) }))
    .sort(compareConversations)
  const stored: InteractionsManifest = {
    formatVersion: 0,
    conversations,
    insights: manifest.insights,
    summary: summarizeInteractions(conversations),
  }
  await mkdir(root, { recursive: true, mode: 0o700 })
  await withFileLock(interactionsPath(root), async () => {
    await writeFileAtomic(interactionsPath(root), `${JSON.stringify(stored, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
  })
  return stored
}

/**
 * Commit confirmed import rows: group messages into conversations by
 * `platform + external_user_id`, dedupe against stored and batch messages by
 * `platform + external_message_id` (an existing id updates content and time
 * in place), and resolve threading against the library plus the batch —
 * unresolved parents keep the message with a null link and a named warning.
 * Runs under the file lock so two importers cannot interleave.
 * @param root - absolute outputs library root.
 * @param request - the confirmed parsed rows.
 * @returns the append/update accounting and the thread warnings.
 */
export async function commitInteractionImportFile(
  root: string,
  request: InteractionImportCommitRequest,
): Promise<InteractionImportCommitResult> {
  await mkdir(root, { recursive: true, mode: 0o700 })
  return withFileLock(interactionsPath(root), async () => {
    const raw = await readFile(interactionsPath(root), 'utf8').catch(() => null)
    let current: InteractionsManifest
    if (raw === null) {
      current = { formatVersion: 0, conversations: [], insights: EMPTY_INTERACTION_INSIGHTS, summary: EMPTY_INTERACTION_SUMMARY }
    } else {
      const parsed = parseInteractionsManifest(raw)
      if (parsed.problems.length > 0) throw new Error(`interactions manifest unreadable: ${parsed.problems[0]}`)
      current = parsed.manifest
    }

    // Working copies keyed for dedup and conversation grouping.
    const conversations = current.conversations.map(conversation => ({ ...conversation, messages: [...conversation.messages] }))
    const byExternal = new Map<string, { conversation: (typeof conversations)[number]; index: number }>()
    for (const conversation of conversations) {
      conversation.messages.forEach((message, index) => {
        byExternal.set(`${conversation.platform}:${message.externalMessageId}`, { conversation, index })
      })
    }
    const conversationKey = (platform: string, externalUserId: string): string => `${platform}:${externalUserId}`
    const conversationByKey = new Map<string, (typeof conversations)[number]>()
    for (const conversation of conversations) {
      conversationByKey.set(conversationKey(conversation.platform, conversation.participant.externalUserId), conversation)
    }

    let added = 0
    let updated = 0
    let conversationsCreated = 0
    const threadWarnings: string[] = []
    const now = new Date().toISOString()

    for (const row of request.messages) {
      const dedupKey = `${row.platform}:${row.externalMessageId}`
      const existing = byExternal.get(dedupKey)
      if (existing !== undefined) {
        // Idempotent re-import: refresh the mutable fields, keep identity.
        const previous = existing.conversation.messages[existing.index]
        if (previous !== undefined) {
          existing.conversation.messages[existing.index] = { ...previous, content: row.content, sentAt: row.sentAt }
          existing.conversation.updatedAt = now
        }
        updated += 1
        continue
      }
      // Threading resolves against the library and the batch; the batch's
      // earlier rows are already in `byExternal`, so a same-file parent
      // resolves regardless of row order.
      let inReplyTo: string | null = null
      if (row.inReplyToExternal !== null) {
        const parent = byExternal.get(`${row.platform}:${row.inReplyToExternal}`)
        if (parent === undefined) {
          if (threadWarnings.length < 100) {
            threadWarnings.push(`parent message "${row.inReplyToExternal}" not found for "${row.externalMessageId}"`)
          }
        } else {
          inReplyTo = parent.conversation.messages[parent.index]?.id ?? null
        }
      }
      const key = conversationKey(row.platform, row.externalUserId)
      let conversation = conversationByKey.get(key)
      if (conversation === undefined) {
        conversation = {
          id: randomUUID(),
          platform: row.platform,
          participant: { externalUserId: row.externalUserId, nickname: row.nickname ?? '' },
          topicRef: row.topicRef,
          outputRef: row.outputRef,
          personaId: row.personaId,
          status: 'unread',
          tags: [],
          note: '',
          starred: false,
          createdAt: now,
          updatedAt: now,
          messages: [],
        }
        conversations.push(conversation)
        conversationByKey.set(key, conversation)
        conversationsCreated += 1
      } else {
        // A conversation's header fields backfill from richer rows: the
        // first import often carries only ids, later ones the profile.
        if (conversation.participant.nickname.length === 0 && row.nickname !== null) {
          conversation.participant = { ...conversation.participant, nickname: row.nickname }
        }
        if (conversation.topicRef === null && row.topicRef !== null) conversation.topicRef = row.topicRef
        if (conversation.outputRef === null && row.outputRef !== null) conversation.outputRef = row.outputRef
        if (conversation.personaId === null && row.personaId !== null) conversation.personaId = row.personaId
      }
      const message: InteractionMessage = {
        id: randomUUID(),
        externalMessageId: row.externalMessageId,
        direction: 'in',
        type: row.type,
        content: row.content,
        inReplyTo,
        sentAt: row.sentAt,
        sentiment: { ...UNTAGGED_SENTIMENT },
        intent: { ...UNTAGGED_INTENT },
        replyDrafts: [],
      }
      conversation.messages.push(message)
      conversation.updatedAt = now
      byExternal.set(dedupKey, { conversation, index: conversation.messages.length - 1 })
      added += 1
    }

    const sorted = conversations.map((conversation) => {
      conversation.messages.sort(compareMessages)
      return conversation
    }).sort(compareConversations)
    const stored: InteractionsManifest = {
      formatVersion: 0,
      conversations: sorted,
      insights: current.insights,
      summary: summarizeInteractions(sorted),
    }
    await writeFileAtomic(interactionsPath(root), `${JSON.stringify(stored, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
    return { added, updated, conversationsCreated, threadWarnings }
  })
}
