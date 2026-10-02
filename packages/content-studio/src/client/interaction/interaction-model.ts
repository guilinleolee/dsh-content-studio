/**
 * Pure logic of the interaction view: the persisted filter set with its
 * versioned load migration, the conversation filters, the thread-line
 * projection the reply prompt consumes, the batch slicing for the
 * classifier and insight extractor, the insight merge across batches, and
 * the topic input builder for the one-click push. No React, no I/O — the
 * view and the tests share this module.
 *
 * The enum tables mirror the gateway's `interactions/types.ts` (the bundle
 * purity gate bans cross-plugin value imports); the parity test pins them.
 */

import type {
  InteractionConversation, InteractionInsightBatch, InteractionInsightEntry, InteractionIntent,
  InteractionMessage, InteractionMessageType, InteractionPlatformId, InteractionSentiment,
  InteractionStyle,
} from '@deepseek-ai/dsh-content-outputs/types'
import type { TopicItemInput } from '@deepseek-ai/dsh-content-topics/types'

/** All platforms, in picker order; mirrors the gateway table. */
export const INTERACTION_PLATFORM_IDS: readonly InteractionPlatformId[] = ['xhs', 'douyin', 'weixin', 'bilibili']

/** All message kinds, in picker order; mirrors the gateway table. */
export const INTERACTION_TYPE_IDS: readonly InteractionMessageType[] = ['comment', 'dm', 'mention']

/** All conversation statuses, in pipeline order; mirrors the gateway table. */
export const INTERACTION_STATUS_IDS = ['unread', 'pendingReply', 'replied', 'archived', 'spam'] as const

/** All reply tones, in picker order; mirrors the gateway table. */
export const INTERACTION_STYLE_IDS: readonly InteractionStyle[] = ['formal', 'friendly', 'humorous', 'brief']

/** Sentiment readings, including the unclassified fallback. */
export const INTERACTION_SENTIMENT_IDS = ['positive', 'negative', 'question', 'unknown'] as const

/** Intent readings, including the unclassified fallback. */
export const INTERACTION_INTENT_IDS = ['consult', 'praise', 'complain', 'demand', 'spam', 'unknown'] as const

/** Batch size of the classification loop; the quota charges one unit per batch. */
export const CLASSIFY_BATCH_SIZE = 50

/** Batch size of the insight loop; the quota charges one unit per batch. */
export const INSIGHT_BATCH_SIZE = 200

/** How many thread lines the reply prompt context keeps. */
export const REPLY_THREAD_LINES = 20

/** The persisted filter set. */
export interface InteractionFilters {
  /** Migration gate: an unrecognized version reloads defaults whole. */
  readonly version: 1
  readonly platforms: readonly InteractionPlatformId[]
  /** `'all'` or one conversation status. */
  readonly status: 'all' | (typeof INTERACTION_STATUS_IDS)[number]
  /** `'all'` or one message kind — a conversation matches when any message has it. */
  readonly type: 'all' | InteractionMessageType
  /** `'all'` or one sentiment — matches when any inbound message carries it. */
  readonly sentiment: 'all' | InteractionSentiment
  /** `'all'` or one intent — matches when any inbound message carries it. */
  readonly intent: 'all' | InteractionIntent
  readonly search: string
}

/** Browser-local storage key of the filter set. */
export const FILTERS_KEY = 'dsh-content-studio.interaction.filters'

/**
 * The default filters: everything, no search.
 * @returns the filter set every malformed or version-stale load falls back to.
 */
export function defaultInteractionFilters(): InteractionFilters {
  return { version: 1, platforms: [], status: 'all', type: 'all', sentiment: 'all', intent: 'all', search: '' }
}

/**
 * Load the stored filter set; anything malformed or version-stale reloads
 * defaults whole (the migration fallback the plugin's localStorage rule
 * mandates).
 * @returns the filters to render with.
 */
export function loadInteractionFilters(): InteractionFilters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY)
    if (raw === null) return defaultInteractionFilters()
    const parsed = JSON.parse(raw) as Partial<InteractionFilters>
    if (parsed.version !== 1) return defaultInteractionFilters()
    return {
      version: 1,
      platforms: Array.isArray(parsed.platforms)
        ? parsed.platforms.filter((platform): platform is InteractionPlatformId =>
          typeof platform === 'string' && (INTERACTION_PLATFORM_IDS as readonly string[]).includes(platform))
        : [],
      status: parsed.status !== undefined && (INTERACTION_STATUS_IDS as readonly string[]).includes(parsed.status) ? parsed.status : 'all',
      type: parsed.type !== undefined && parsed.type !== 'all' && (INTERACTION_TYPE_IDS as readonly string[]).includes(parsed.type) ? parsed.type : 'all',
      sentiment: parsed.sentiment !== undefined && parsed.sentiment !== 'all' && (INTERACTION_SENTIMENT_IDS as readonly string[]).includes(parsed.sentiment) ? parsed.sentiment : 'all',
      intent: parsed.intent !== undefined && parsed.intent !== 'all' && (INTERACTION_INTENT_IDS as readonly string[]).includes(parsed.intent) ? parsed.intent : 'all',
      search: typeof parsed.search === 'string' ? parsed.search : '',
    }
  } catch {
    return defaultInteractionFilters()
  }
}

/**
 * Persist the filter set under the versioned key.
 * @param filters - the filters to store.
 */
export function saveInteractionFilters(filters: InteractionFilters): void {
  localStorage.setItem(FILTERS_KEY, JSON.stringify(filters))
}

/**
 * The last inbound message of a conversation, or null when it has none.
 * @param conversation - the conversation to scan.
 * @returns the newest `direction: 'in'` message, or null.
 */
export function lastInboundMessage(conversation: InteractionConversation): InteractionMessage | null {
  for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
    const message = conversation.messages[index]
    if (message !== undefined && message.direction === 'in') return message
  }
  return null
}

/**
 * The latest message of a conversation regardless of direction, or null.
 * @param conversation - the conversation to scan.
 * @returns the last message in stored order, or null without messages.
 */
export function lastMessage(conversation: InteractionConversation): InteractionMessage | null {
  return conversation.messages[conversation.messages.length - 1] ?? null
}

/**
 * Apply the filter set to the conversation list. Archived and spam
 * conversations stay retrievable only through their explicit status filters
 * — the default views never mix them back in.
 * @param conversations - every stored conversation.
 * @param filters - the active filter set.
 * @returns the conversations matching, `updatedAt` order preserved.
 */
export function filterConversations(
  conversations: readonly InteractionConversation[],
  filters: InteractionFilters,
): InteractionConversation[] {
  const search = filters.search.trim().toLowerCase()
  return conversations.filter((conversation) => {
    if (filters.platforms.length > 0 && !filters.platforms.includes(conversation.platform)) return false
    if (filters.status !== 'all' && conversation.status !== filters.status) return false
    if (filters.type !== 'all' && !conversation.messages.some(message => message.type === filters.type)) return false
    if (filters.sentiment !== 'all' || filters.intent !== 'all') {
      const inbound = conversation.messages.filter(message => message.direction === 'in')
      if (filters.sentiment !== 'all' && !inbound.some(message => message.sentiment.value === filters.sentiment)) return false
      if (filters.intent !== 'all' && !inbound.some(message => message.intent.value === filters.intent)) return false
    }
    if (search.length > 0) {
      const haystack = `${conversation.participant.nickname}\n${conversation.participant.externalUserId}\n${conversation.messages.map(message => message.content).join('\n')}`.toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

/**
 * Project a conversation's thread into the lines the reply prompt embeds:
 * content only, trimmed to the latest window.
 * @param conversation - the conversation being answered.
 * @param maxLines - how many trailing lines to keep.
 * @returns the thread lines, oldest first.
 */
export function threadLines(conversation: InteractionConversation, maxLines = REPLY_THREAD_LINES): { direction: 'in' | 'out'; content: string }[] {
  return conversation.messages.slice(-maxLines).map(message => ({ direction: message.direction, content: message.content }))
}

/**
 * Merge one insight batch into the accumulated entries: same-label entries
 * sum their counts and keep the first example and hint; new labels append;
 * the result sorts by count descending and caps at five lines per list.
 * @param accumulated - the entries merged so far.
 * @param incoming - one batch's lines.
 * @returns the merged entries.
 */
export function mergeInsightList(
  accumulated: readonly InteractionInsightEntry[],
  incoming: readonly InteractionInsightEntry[],
): InteractionInsightEntry[] {
  const merged = new Map<string, InteractionInsightEntry>()
  for (const entry of [...accumulated, ...incoming]) {
    const existing = merged.get(entry.label)
    if (existing === undefined) merged.set(entry.label, { ...entry })
    else {
      merged.set(entry.label, {
        ...existing,
        count: existing.count + entry.count,
        exampleMessageId: existing.exampleMessageId ?? entry.exampleMessageId,
        topicHint: existing.topicHint ?? entry.topicHint,
      })
    }
  }
  return [...merged.values()].sort((a, b) => b.count - a.count).slice(0, 5)
}

/**
 * Merge one batch result into the whole insights record.
 * @param insights - the record so far.
 * @param batch - one batch's extraction.
 * @returns the updated record (generatedAt untouched — the caller stamps it).
 */
export function mergeInsightBatch(insights: {
  readonly generatedAt: string | null
  readonly topQuestions: readonly InteractionInsightEntry[]
  readonly painPoints: readonly InteractionInsightEntry[]
  readonly interests: readonly InteractionInsightEntry[]
}, batch: InteractionInsightBatch): {
  generatedAt: string | null
  topQuestions: InteractionInsightEntry[]
  painPoints: InteractionInsightEntry[]
  interests: InteractionInsightEntry[]
} {
  return {
    generatedAt: insights.generatedAt,
    topQuestions: mergeInsightList(insights.topQuestions, batch.questions),
    painPoints: mergeInsightList(insights.painPoints, batch.painPoints),
    interests: mergeInsightList(insights.interests, batch.interests),
  }
}

/**
 * Slice message ids into classification batches.
 * @param ids - every message id to classify.
 * @param size - the batch size.
 * @returns the id batches, last one possibly short.
 */
export function batchIds(ids: readonly string[], size: number): string[][] {
  const batches: string[][] = []
  for (let index = 0; index < ids.length; index += size) {
    batches.push(ids.slice(index, index + size))
  }
  return batches
}

/**
 * Build the topic-bank upsert for one insight line: an `interaction`-source
 * idea whose refId anchors the conversation the insight came from and whose
 * snapshot keeps the phrasing readable if the conversation goes away.
 * @param title - the topic working title.
 * @param oneLiner - the pitch (topic hint or the insight label).
 * @param conversationId - the conversation the insight grounded in.
 * @param summary - the snapshot summary.
 * @param capturedAt - the capture instant, ISO 8601.
 * @returns the upsert input for the contentTopics Remote.
 */
export function insightToTopicInput(
  title: string,
  oneLiner: string | null,
  conversationId: string,
  summary: string | null,
  capturedAt: string,
): TopicItemInput {
  return {
    title,
    oneLiner,
    status: 'idea',
    source: {
      type: 'interaction',
      refId: conversationId,
      url: null,
      snapshot: { title, summary, capturedAt },
    },
    tags: ['互动'],
    description: null,
    score: null,
    planDate: null,
    scheduleItemId: null,
    topicDir: null,
  }
}
