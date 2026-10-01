/**
 * The interaction view controller: one observable state object over the
 * library-root `_interactions.json` manifest (via the content-outputs
 * interactions faces), the two-step CSV import, the explicit AI calls
 * (reply drafts, batched sentiment/intent classification, batched insight
 * extraction), the send-with-local-archive behavior, and the topic-bank
 * push. Persistent business data (conversations, drafts, insights) lives in
 * the manifest; only filters and the staged import ride the browser.
 */

import type {
  InteractionClassifyEntry, InteractionClassifyMessage, InteractionConversation,
  InteractionImportCommitResult, InteractionImportPreview,
  InteractionInsights, InteractionReplyDraft, InteractionSendReplyRequest, InteractionStyle,
  InteractionsManifest, InteractionsManifestRead,
} from '@deepseek-ai/dsh-content-outputs/types'
import type { TopicItemInput } from '@deepseek-ai/dsh-content-topics/types'
import {
  CLASSIFY_BATCH_SIZE, INSIGHT_BATCH_SIZE, batchIds, filterConversations, insightToTopicInput,
  loadInteractionFilters, mergeInsightBatch, saveInteractionFilters, threadLines,
  type InteractionFilters,
} from './interaction-model.ts'

/** Persona facts the reply generator layers its tone base over. */
export interface InteractionPersonaFacts {
  readonly id: string
  readonly digest: string | null
  readonly phrases: readonly string[]
  readonly samples: readonly string[]
}

/** The injected server face: the interactions half of the content-outputs Remote. */
export interface InteractionGateway {
  readInteractions: () => Promise<InteractionsManifestRead>
  writeInteractions: (manifest: InteractionsManifest) => Promise<InteractionsManifest>
  parseInteractionImport: (request: { fileName: string; text: string }) => Promise<InteractionImportPreview>
  commitInteractionImport: (request: { messages: InteractionImportPreview['messages'] }) => Promise<InteractionImportCommitResult>
  generateInteractionReply: (request: {
    style: InteractionStyle
    personaDigest: string | null
    personaPhrases: readonly string[]
    personaSamples: readonly string[]
    template: string | null
    thread: readonly { direction: 'in' | 'out'; content: string }[]
  }) => Promise<{ drafts: readonly { style: InteractionStyle; content: string }[]; model: string; promptVersion: string }>
  classifyInteractions: (request: { messages: readonly InteractionClassifyMessage[] }) => Promise<{
    entries: readonly InteractionClassifyEntry[]
    promptVersion: string
  }>
  extractInteractionInsights: (request: { messages: readonly InteractionClassifyMessage[] }) => Promise<{
    batch: { questions: InteractionInsights['topQuestions']; painPoints: InteractionInsights['painPoints']; interests: InteractionInsights['interests'] }
  }>
  exportInteractionCsv: () => Promise<{ text: string }>
  sendInteractionReply: (request: InteractionSendReplyRequest) => Promise<{ ok: false; reason: 'MCP_NOT_CONFIGURED' }>
}

/** One-step user-facing outcome codes; the copy lives in the locale dictionaries. */
export type InteractionNotice =
  | 'load-failed'
  | 'import-parsed'
  | 'import-failed'
  | 'import-committed'
  | 'save-failed'
  | 'drafts-ready'
  | 'drafts-failed'
  | 'classify-done'
  | 'classify-failed'
  | 'insights-done'
  | 'insights-failed'
  | 'sent-archived'
  | 'exported'
  | 'export-failed'
  | 'need-theme'
  | 'topic-added'
  | 'topic-failed'

/** Snapshot the React surface subscribes to. */
export interface InteractionState {
  readonly manifest: InteractionsManifest | null
  /** Stored entries that failed validation, named but not dropped silently. */
  readonly problems: readonly string[]
  readonly loading: boolean
  /** Any in-flight import, AI, or send call. */
  readonly busy: boolean
  /** Batched-loop progress, present only while a loop runs. */
  readonly progress: { readonly done: number; readonly total: number } | null
  readonly notice: InteractionNotice | null
  /** The staged import preview awaiting user confirmation. */
  readonly preview: InteractionImportPreview | null
  /** The last commit's accounting, rendered as the import report. */
  readonly importReport: InteractionImportCommitResult | null
  readonly selectedId: string | null
  /** Bumped on every filter change so subscribers recompute the list. */
  readonly filtersRevision: number
}

/** The topics face the insight push rides; structural so tests can stub it. */
export interface InteractionTopicsFace {
  put: (input: TopicItemInput) => Promise<unknown>
}

/** The asset-write face the CSV export rides. */
export interface InteractionExportFace {
  (theme: string, file: string, content: string): Promise<unknown>
}

/** The controller the view consumes. */
export interface InteractionController {
  getState(): InteractionState
  subscribe(listener: () => void): () => void
  load(): Promise<void>
  filters(): InteractionFilters
  setFilters(patch: Partial<Omit<InteractionFilters, 'version'>>): void
  /** The conversations matching the active filters, store order preserved. */
  visible(): InteractionConversation[]
  select(id: string | null): void
  /** Stage one file's parse preview (no storage). */
  stageImport(fileName: string, text: string): Promise<void>
  /** Commit the staged preview's rows. */
  commitImport(): Promise<void>
  discardImport(): void
  /** Patch one conversation's header fields and persist. */
  patchConversation(id: string, patch: Partial<Pick<InteractionConversation, 'status' | 'tags' | 'note' | 'starred' | 'personaId' | 'topicRef' | 'outputRef'>>): Promise<void>
  /**
   * Generate the fixed draft set for one message and store it as the
   * message's drafts.
   */
  generateDrafts(
    conversationId: string,
    messageId: string,
    style: InteractionStyle,
    persona: InteractionPersonaFacts | null,
    template: string | null,
  ): Promise<void>
  /** Save one hand-tuned draft onto the message's draft list. */
  saveDraft(conversationId: string, messageId: string, style: InteractionStyle, content: string, personaId: string | null): Promise<void>
  /**
   * Send the final reply: archive an `out` message, flip the conversation to
   * `replied`, then knock on the reserved MCP channel — the archive never
   * depends on its refusal.
   */
  sendReply(conversationId: string, inReplyToMessageId: string, content: string, personaId: string | null): Promise<void>
  /** Classify every untagged inbound message of the given conversations, fifty per call. */
  classifySelected(conversationIds: readonly string[]): Promise<void>
  /** Extract insights from the given conversations' inbound messages, two hundred per call. */
  extractInsights(conversationIds: readonly string[]): Promise<void>
  /** Push one insight line into the topic bank. */
  pushTopic(title: string, oneLiner: string | null, conversationId: string, summary: string | null): Promise<void>
  /** Export the whole inbox as CSV into one theme's `assets/`. */
  exportCsv(theme: string): Promise<void>
  clearNotice(): void
}

/** The untagged tagging pair every stored message carries until classified. */
const untagged = {
  sentiment: { value: 'unknown' as const, source: 'user' as const, aiMeta: null },
  intent: { value: 'unknown' as const, source: 'user' as const, aiMeta: null },
}

/**
 * Create the interaction controller over the wired gateway and the topic /
 * export faces.
 * @param gateway - the interactions half of the content-outputs Remote.
 * @param topics - the topic-bank write face for the insight push.
 * @param writeExport - the guarded asset write the CSV export rides.
 * @returns the controller.
 */
export function createInteractionController(
  gateway: InteractionGateway,
  topics: InteractionTopicsFace,
  writeExport: InteractionExportFace,
): InteractionController {
  let state: InteractionState = {
    manifest: null,
    problems: [],
    loading: false,
    busy: false,
    progress: null,
    notice: null,
    preview: null,
    importReport: null,
    selectedId: null,
    filtersRevision: 0,
  }
  const listeners = new Set<() => void>()
  const notify = (): void => {
    for (const listener of listeners) listener()
  }
  const patch = (next: Partial<InteractionState>): void => {
    state = { ...state, ...next }
    notify()
  }

  const requireManifest = (): InteractionsManifest => {
    if (state.manifest === null) throw new Error('interactions manifest not loaded')
    return state.manifest
  }

  /** Validate-and-store one patched manifest, adopting the normalized return. */
  const persist = async (manifest: InteractionsManifest): Promise<void> => {
    const stored = await gateway.writeInteractions(manifest)
    patch({ manifest: stored, problems: [] })
  }

  /** Patch one conversation in the manifest and persist the whole document. */
  const patchConversationIn = (
    manifest: InteractionsManifest,
    id: string,
    patchConversation: (conversation: InteractionConversation) => InteractionConversation,
  ): InteractionsManifest => ({
    ...manifest,
    conversations: manifest.conversations.map(conversation => conversation.id === id ? patchConversation(conversation) : conversation),
  })

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },

    async load() {
      patch({ loading: true, notice: null })
      try {
        const read = await gateway.readInteractions()
        patch({ manifest: read.manifest, problems: read.problems, loading: false })
      } catch {
        patch({ loading: false, notice: 'load-failed' })
      }
    },

    filters: () => loadInteractionFilters(),

    setFilters(patchFilters) {
      saveInteractionFilters({ ...loadInteractionFilters(), ...patchFilters })
      patch({ filtersRevision: state.filtersRevision + 1 })
    },

    visible() {
      const manifest = state.manifest
      if (manifest === null) return []
      return filterConversations(manifest.conversations, loadInteractionFilters())
    },

    select(id) {
      patch({ selectedId: id })
    },

    async stageImport(fileName, text) {
      patch({ busy: true, notice: null })
      try {
        const preview = await gateway.parseInteractionImport({ fileName, text })
        patch({ preview, busy: false, notice: 'import-parsed' })
      } catch {
        patch({ busy: false, notice: 'import-failed' })
      }
    },

    async commitImport() {
      const preview = state.preview
      if (preview === null) return
      patch({ busy: true, notice: null })
      try {
        const result = await gateway.commitInteractionImport({ messages: preview.messages })
        const read = await gateway.readInteractions()
        patch({
          manifest: read.manifest, problems: read.problems, preview: null,
          importReport: result, busy: false, notice: 'import-committed',
        })
      } catch {
        patch({ busy: false, notice: 'import-failed' })
      }
    },

    discardImport() {
      patch({ preview: null })
    },

    async patchConversation(id, conversationPatch) {
      const manifest = requireManifest()
      try {
        await persist(patchConversationIn(manifest, id, conversation => ({ ...conversation, ...conversationPatch })))
      } catch {
        patch({ notice: 'save-failed' })
      }
    },

    async generateDrafts(conversationId, messageId, style, persona, template) {
      const manifest = requireManifest()
      const conversation = manifest.conversations.find(candidate => candidate.id === conversationId)
      if (conversation === undefined) return
      patch({ busy: true, notice: null })
      try {
        const result = await gateway.generateInteractionReply({
          style,
          personaDigest: persona?.digest ?? null,
          personaPhrases: persona?.phrases ?? [],
          personaSamples: persona?.samples ?? [],
          template,
          thread: threadLines(conversation),
        })
        const now = new Date().toISOString()
        const drafts: InteractionReplyDraft[] = result.drafts.map(draft => ({
          id: crypto.randomUUID(),
          style: draft.style,
          content: draft.content,
          personaId: persona?.id ?? null,
          createdAt: now,
        }))
        const next = patchConversationIn(requireManifest(), conversationId, candidate => ({
          ...candidate,
          messages: candidate.messages.map(message =>
            message.id === messageId ? { ...message, replyDrafts: drafts } : message),
        }))
        await persist(next)
        patch({ busy: false, notice: 'drafts-ready' })
      } catch {
        patch({ busy: false, notice: 'drafts-failed' })
      }
    },

    async saveDraft(conversationId, messageId, style, content, personaId) {
      const manifest = requireManifest()
      const draft: InteractionReplyDraft = {
        id: crypto.randomUUID(),
        style,
        content,
        personaId,
        createdAt: new Date().toISOString(),
      }
      try {
        await persist(patchConversationIn(manifest, conversationId, candidate => ({
          ...candidate,
          messages: candidate.messages.map(message =>
            message.id === messageId ? { ...message, replyDrafts: [...message.replyDrafts, draft] } : message),
        })))
      } catch {
        patch({ notice: 'save-failed' })
      }
    },

    async sendReply(conversationId, inReplyToMessageId, content, personaId) {
      const manifest = requireManifest()
      const conversation = manifest.conversations.find(candidate => candidate.id === conversationId)
      if (conversation === undefined) return
      const replied = conversation.messages.find(message => message.id === inReplyToMessageId)
      const now = new Date().toISOString()
      try {
        await persist(patchConversationIn(manifest, conversationId, candidate => ({
          ...candidate,
          // The status machine's only other automatic transition: answering
          // an open conversation closes it.
          status: candidate.status === 'unread' || candidate.status === 'pendingReply' ? 'replied' : candidate.status,
          updatedAt: now,
          messages: [...candidate.messages, {
            id: crypto.randomUUID(),
            // The outbound reply has no platform id yet — the local prefix
            // keeps the dedup key unique until a provider assigns one.
            externalMessageId: `local-${crypto.randomUUID()}`,
            direction: 'out' as const,
            type: replied?.type ?? 'comment',
            content,
            inReplyTo: inReplyToMessageId,
            sentAt: now,
            sentiment: { ...untagged.sentiment },
            intent: { ...untagged.intent },
            replyDrafts: [],
          }],
        })))
      } catch {
        patch({ notice: 'save-failed' })
        return
      }
      // The reserved channel knock: always refused this phase, never
      // load-bearing for the archive above.
      await gateway.sendInteractionReply({ conversationId, inReplyTo: inReplyToMessageId, content, personaId }).catch(() => undefined)
      patch({ notice: 'sent-archived' })
    },

    async classifySelected(conversationIds) {
      const manifest = requireManifest()
      const wanted = new Set(conversationIds)
      const messages = manifest.conversations
        .filter(conversation => wanted.has(conversation.id))
        .flatMap(conversation => conversation.messages
          .filter(message => message.direction === 'in' && message.sentiment.source !== 'ai' && message.intent.source !== 'ai')
          .map(message => ({ conversationId: conversation.id, messageId: message.id, content: message.content })))
      if (messages.length === 0) {
        patch({ notice: 'classify-done' })
        return
      }
      const byId = new Map(messages.map(message => [message.messageId, message]))
      const batches = batchIds(messages.map(message => message.messageId), CLASSIFY_BATCH_SIZE)
      patch({ busy: true, notice: null, progress: { done: 0, total: batches.length } })
      let working = requireManifest()
      let failures = 0
      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index] as string[]
        try {
          const result = await gateway.classifyInteractions({
            messages: batch.map(id => ({ messageId: id, content: byId.get(id)?.content ?? '' })),
          })
          const byMessage = new Map(result.entries.map(entry => [entry.messageId, entry]))
          const now = new Date().toISOString()
          working = {
            ...working,
            conversations: working.conversations.map(conversation => wanted.has(conversation.id)
              ? {
                ...conversation,
                messages: conversation.messages.map((message) => {
                  const entry = byMessage.get(message.id)
                  if (entry === undefined) return message
                  return {
                    ...message,
                    sentiment: { value: entry.sentiment, source: 'ai' as const, aiMeta: { promptVersion: result.promptVersion, at: now } },
                    intent: { value: entry.intent, source: 'ai' as const, aiMeta: { promptVersion: result.promptVersion, at: now } },
                  }
                }),
              }
              : conversation),
          }
          await persist(working)
        } catch {
          // One failed batch leaves its messages unknown; the loop continues.
          failures += 1
        }
        patch({ progress: { done: index + 1, total: batches.length } })
      }
      patch({ busy: false, progress: null, notice: failures > 0 ? 'classify-failed' : 'classify-done' })
    },

    async extractInsights(conversationIds) {
      const manifest = requireManifest()
      const wanted = new Set(conversationIds)
      const messages = manifest.conversations
        .filter(conversation => wanted.has(conversation.id) && conversation.status !== 'archived' && conversation.status !== 'spam')
        .flatMap(conversation => conversation.messages
          .filter(message => message.direction === 'in')
          .map(message => ({ messageId: message.id, content: message.content })))
      if (messages.length === 0) {
        patch({ notice: 'insights-done' })
        return
      }
      const byId = new Map(messages.map(message => [message.messageId, message]))
      const batches = batchIds(messages.map(message => message.messageId), INSIGHT_BATCH_SIZE)
      patch({ busy: true, notice: null, progress: { done: 0, total: batches.length } })
      let insights: InteractionInsights = { ...requireManifest().insights }
      let failures = 0
      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index] as string[]
        try {
          const result = await gateway.extractInteractionInsights({
            messages: batch.map(id => ({ messageId: id, content: byId.get(id)?.content ?? '' })),
          })
          insights = mergeInsightBatch(insights, result.batch)
        } catch {
          // One failed batch drops out of the merge; the loop continues.
          failures += 1
        }
        patch({ progress: { done: index + 1, total: batches.length } })
      }
      try {
        await persist({ ...requireManifest(), insights: { ...insights, generatedAt: new Date().toISOString() } })
        patch({ busy: false, progress: null, notice: failures > 0 ? 'insights-failed' : 'insights-done' })
      } catch {
        patch({ busy: false, progress: null, notice: 'save-failed' })
      }
    },

    async pushTopic(title, oneLiner, conversationId, summary) {
      const input = insightToTopicInput(title, oneLiner, conversationId, summary, new Date().toISOString())
      try {
        await topics.put(input)
        patch({ notice: 'topic-added' })
      } catch {
        patch({ notice: 'topic-failed' })
      }
    },

    async exportCsv(theme) {
      if (theme.length === 0) {
        patch({ notice: 'need-theme' })
        return
      }
      patch({ busy: true, notice: null })
      try {
        const { text } = await gateway.exportInteractionCsv()
        const stamp = new Date().toISOString().slice(0, 10)
        await writeExport(theme, `interactions-${stamp}.csv`, text)
        patch({ busy: false, notice: 'exported' })
      } catch {
        patch({ busy: false, notice: 'export-failed' })
      }
    },

    clearNotice() {
      patch({ notice: null })
    },
  }
}
