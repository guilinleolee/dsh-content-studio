/**
 * Wire vocabulary of the content-outputs interactions face: the
 * multi-platform fan-interaction inbox (conversations with embedded
 * messages), the derived summary cache, the AI-extracted audience insights,
 * the two-step CSV import, and the one-shot AI calls (reply drafts,
 * sentiment/intent classification, insight extraction). Client-safe by
 * construction — no Node or filesystem imports.
 */

/** Platforms the inbox accepts; the persona platform table's core four. */
export type InteractionPlatformId = 'xhs' | 'douyin' | 'weixin' | 'bilibili'

/** All platforms, in picker order; import and stores validate against this list. */
export const INTERACTION_PLATFORMS: readonly InteractionPlatformId[] = ['xhs', 'douyin', 'weixin', 'bilibili']

/** Kinds of fan message the inbox distinguishes. */
export type InteractionMessageType = 'comment' | 'dm' | 'mention'

/** All message kinds, in picker order. */
export const INTERACTION_MESSAGE_TYPES: readonly InteractionMessageType[] = ['comment', 'dm', 'mention']

/** Lifecycle of one conversation. Only the import transition is automatic;
 * every other move is an explicit user mark. */
export type InteractionConversationStatus = 'unread' | 'pendingReply' | 'replied' | 'archived' | 'spam'

/** All statuses, in pipeline order. */
export const INTERACTION_STATUSES: readonly InteractionConversationStatus[] = ['unread', 'pendingReply', 'replied', 'archived', 'spam']

/** Tone reading of one inbound message. */
export type InteractionSentiment = 'positive' | 'negative' | 'question' | 'unknown'

/** Demand reading of one inbound message. */
export type InteractionIntent = 'consult' | 'praise' | 'complain' | 'demand' | 'spam' | 'unknown'

/** Reply tone the draft generator layers over the persona base. */
export type InteractionStyle = 'formal' | 'friendly' | 'humorous' | 'brief'

/** All reply tones, in picker order. */
export const INTERACTION_STYLES: readonly InteractionStyle[] = ['formal', 'friendly', 'humorous', 'brief']

/**
 * Provenance wrapper (the persona convention): who produced a tagging and
 * under which prompt. The unclassified default reads `{ value: "unknown",
 * source: "user", aiMeta: null }` — `unknown` renders nowhere, so the
 * placeholder never masquerades as a manual verdict.
 */
export interface InteractionTagging<T extends string> {
  readonly value: T
  readonly source: 'user' | 'ai'
  readonly aiMeta: { readonly promptVersion: string; readonly at: string } | null
}

/** The unclassified sentiment placeholder every imported message starts with. */
export const UNTAGGED_SENTIMENT: InteractionTagging<InteractionSentiment> = { value: 'unknown', source: 'user', aiMeta: null }

/** The unclassified intent placeholder every imported message starts with. */
export const UNTAGGED_INTENT: InteractionTagging<InteractionIntent> = { value: 'unknown', source: 'user', aiMeta: null }

/** One saved reply candidate on the message it answers. */
export interface InteractionReplyDraft {
  readonly id: string
  readonly style: InteractionStyle
  readonly content: string
  /** Persona the draft was generated under, for audit; null when none. */
  readonly personaId: string | null
  readonly createdAt: string
}

/** One message inside a conversation thread, `sentAt` ascending. */
export interface InteractionMessage {
  readonly id: string
  /** Platform-side message id; with the conversation's platform it is the global dedup key. */
  readonly externalMessageId: string
  readonly direction: 'in' | 'out'
  readonly type: InteractionMessageType
  readonly content: string
  /** Internal id of the parent message (threading); null when none or unresolved at import. */
  readonly inReplyTo: string | null
  readonly sentAt: string
  readonly sentiment: InteractionTagging<InteractionSentiment>
  readonly intent: InteractionTagging<InteractionIntent>
  readonly replyDrafts: readonly InteractionReplyDraft[]
}

/** The fan side of one conversation. */
export interface InteractionParticipant {
  readonly externalUserId: string
  readonly nickname: string
}

/** One conversation: the aggregation root with its messages embedded. */
export interface InteractionConversation {
  readonly id: string
  readonly platform: InteractionPlatformId
  readonly participant: InteractionParticipant
  /** Outputs-project directory name this conversation belongs to, or null. */
  readonly topicRef: string | null
  /** `主题名/文件名` of the bound library work, or null. */
  readonly outputRef: string | null
  /** `_personas.json` entry id bound for reply tone, or null. */
  readonly personaId: string | null
  readonly status: InteractionConversationStatus
  /** Demand labels from the fixed tag set. */
  readonly tags: readonly string[]
  readonly note: string
  readonly starred: boolean
  readonly createdAt: string
  readonly updatedAt: string
  readonly messages: readonly InteractionMessage[]
}

/** One extracted audience-insight line. */
export interface InteractionInsightEntry {
  /** The question, pain point, or interest direction phrasing. */
  readonly label: string
  /** How many messages backed it. */
  readonly count: number
  /** One message id that exemplifies the line, or null. */
  readonly exampleMessageId: string | null
  /** Draft topic suggestion (interests only), or null. */
  readonly topicHint: string | null
}

/** The AI-extracted audience summary persisted in the manifest. */
export interface InteractionInsights {
  readonly generatedAt: string | null
  readonly topQuestions: readonly InteractionInsightEntry[]
  readonly painPoints: readonly InteractionInsightEntry[]
  readonly interests: readonly InteractionInsightEntry[]
}

/** The empty insights value a fresh manifest starts with. */
export const EMPTY_INTERACTION_INSIGHTS: InteractionInsights = {
  generatedAt: null, topQuestions: [], painPoints: [], interests: [],
}

/** Derived per-status conversation counts; recomputed by the gateway on every write. */
export interface InteractionSummary {
  readonly unread: number
  readonly pendingReply: number
  readonly replied: number
  readonly archived: number
  readonly spam: number
}

/** The empty summary a fresh manifest starts with. */
export const EMPTY_INTERACTION_SUMMARY: InteractionSummary = {
  unread: 0, pendingReply: 0, replied: 0, archived: 0, spam: 0,
}

/**
 * The interactions manifest: the library-root `_interactions.json` system
 * file. Conversations sort `updatedAt` descending; `summary` is a derived
 * cache the gateway recomputes — the UI reads it, never writes it.
 */
export interface InteractionsManifest {
  readonly formatVersion: 0
  readonly conversations: readonly InteractionConversation[]
  readonly insights: InteractionInsights
  readonly summary: InteractionSummary
}

/** Read face of the manifest: validated conversations only. */
export interface InteractionsManifestRead {
  readonly manifest: InteractionsManifest | null
  /** Why the stored manifest was rejected or which entries were dropped; callers must not write back while non-empty. */
  readonly problems: readonly string[]
}

/** One import-parsed message row, validated and normalized but not stored. */
export interface InteractionParsedMessage {
  readonly platform: InteractionPlatformId
  readonly externalMessageId: string
  readonly externalUserId: string
  readonly nickname: string | null
  readonly type: InteractionMessageType
  readonly content: string
  /** The parent's external message id, or null; resolved to internal ids at commit. */
  readonly inReplyToExternal: string | null
  readonly sentAt: string
  readonly topicRef: string | null
  readonly outputRef: string | null
  readonly personaId: string | null
}

/** Why one import row was rejected. */
export interface InteractionRejectedRow {
  /** 1-based CSV physical row number, header included. */
  readonly row: number
  readonly reason: string
}

/** The parse request: the file's name and its browser-decoded CSV text. */
export interface InteractionImportPreviewRequest {
  readonly fileName: string
  readonly text: string
}

/** Parse result of one import file: nothing is stored yet. */
export interface InteractionImportPreview {
  readonly fileName: string
  readonly messages: readonly InteractionParsedMessage[]
  readonly rejected: readonly InteractionRejectedRow[]
  readonly totalRows: number
}

/** Commit request: the confirmed rows land as messages of grouped conversations. */
export interface InteractionImportCommitRequest {
  readonly messages: readonly InteractionParsedMessage[]
}

/** Commit result: append vs update accounting plus unresolved-thread warnings. */
export interface InteractionImportCommitResult {
  readonly added: number
  readonly updated: number
  readonly conversationsCreated: number
  readonly threadWarnings: readonly string[]
}

/** One thread message block the reply generator reasons over. */
export interface InteractionThreadLine {
  readonly direction: 'in' | 'out'
  readonly content: string
}

/** Reply-draft generation request; the caller assembles persona facts and the thread. */
export interface InteractionReplyRequest {
  readonly style: InteractionStyle
  readonly personaDigest: string | null
  readonly personaPhrases: readonly string[]
  readonly personaSamples: readonly string[]
  /** A rendered template-library body used as the draft skeleton, or null. */
  readonly template: string | null
  readonly thread: readonly InteractionThreadLine[]
}

/** One generated draft candidate. */
export interface InteractionReplyDraftResult {
  readonly style: InteractionStyle
  readonly content: string
}

/** Result of the reply-draft face: the fixed candidate set plus provenance. */
export interface InteractionReplyResult {
  readonly drafts: readonly InteractionReplyDraftResult[]
  readonly model: string
  readonly promptVersion: string
}

/** One message handed to the classifier or insight extractor. */
export interface InteractionClassifyMessage {
  readonly messageId: string
  readonly content: string
}

/** Classification request: at most fifty messages per call. */
export interface InteractionClassifyRequest {
  readonly messages: readonly InteractionClassifyMessage[]
}

/** One classified message. */
export interface InteractionClassifyEntry {
  readonly messageId: string
  readonly sentiment: InteractionSentiment
  readonly intent: InteractionIntent
}

/** Result of the classification face. */
export interface InteractionClassifyResult {
  readonly entries: readonly InteractionClassifyEntry[]
  readonly model: string
  readonly promptVersion: string
}

/** Insight extraction request: at most two hundred messages per call. */
export interface InteractionInsightRequest {
  readonly messages: readonly InteractionClassifyMessage[]
}

/** One batch's extracted insight lines; the client merges batches by label. */
export interface InteractionInsightBatch {
  readonly questions: readonly InteractionInsightEntry[]
  readonly painPoints: readonly InteractionInsightEntry[]
  readonly interests: readonly InteractionInsightEntry[]
}

/** Result of one insight batch call. */
export interface InteractionInsightResult {
  readonly batch: InteractionInsightBatch
  readonly model: string
  readonly promptVersion: string
}

/** One raw platform message the reserved MCP channel would deliver. */
export interface InteractionRawMessage {
  readonly platform: InteractionPlatformId
  readonly externalMessageId: string
  readonly externalUserId: string
  readonly nickname: string | null
  readonly type: InteractionMessageType
  readonly content: string
  readonly inReplyToExternal: string | null
  readonly sentAt: string
}

/** The reserved send face's request: the archived reply to push outward. */
export interface InteractionSendReplyRequest {
  readonly conversationId: string
  readonly inReplyTo: string | null
  readonly content: string
  readonly personaId: string | null
}

/** Why the reserved channel refused; the only reason while no MCP provider exists. */
export type InteractionChannelFailure = { readonly ok: false; readonly reason: 'MCP_NOT_CONFIGURED' }

/**
 * The reserved interaction channel for a future MCP provider. This phase
 * ships the interface plus its always-failing stub only — the send button's
 * local archive never depends on the call's outcome.
 */
export interface InteractionChannel {
  fetchMessages(request: { readonly platform: InteractionPlatformId; readonly sinceIso?: string }): Promise<
    | InteractionChannelFailure
    | { readonly ok: true; readonly messages: readonly InteractionRawMessage[] }
  >
  sendReply(request: InteractionSendReplyRequest): Promise<
    | InteractionChannelFailure
    | { readonly ok: true; readonly externalMessageId: string }
  >
}
