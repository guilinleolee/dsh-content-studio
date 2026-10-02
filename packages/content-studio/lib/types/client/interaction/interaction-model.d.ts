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
import type { InteractionConversation, InteractionInsightBatch, InteractionInsightEntry, InteractionIntent, InteractionMessage, InteractionMessageType, InteractionPlatformId, InteractionSentiment, InteractionStyle } from '@deepseek-ai/dsh-content-outputs/types';
import type { TopicItemInput } from '@deepseek-ai/dsh-content-topics/types';
/** All platforms, in picker order; mirrors the gateway table. */
export declare const INTERACTION_PLATFORM_IDS: readonly InteractionPlatformId[];
/** All message kinds, in picker order; mirrors the gateway table. */
export declare const INTERACTION_TYPE_IDS: readonly InteractionMessageType[];
/** All conversation statuses, in pipeline order; mirrors the gateway table. */
export declare const INTERACTION_STATUS_IDS: readonly ["unread", "pendingReply", "replied", "archived", "spam"];
/** All reply tones, in picker order; mirrors the gateway table. */
export declare const INTERACTION_STYLE_IDS: readonly InteractionStyle[];
/** Sentiment readings, including the unclassified fallback. */
export declare const INTERACTION_SENTIMENT_IDS: readonly ["positive", "negative", "question", "unknown"];
/** Intent readings, including the unclassified fallback. */
export declare const INTERACTION_INTENT_IDS: readonly ["consult", "praise", "complain", "demand", "spam", "unknown"];
/** Batch size of the classification loop; the quota charges one unit per batch. */
export declare const CLASSIFY_BATCH_SIZE = 50;
/** Batch size of the insight loop; the quota charges one unit per batch. */
export declare const INSIGHT_BATCH_SIZE = 200;
/** How many thread lines the reply prompt context keeps. */
export declare const REPLY_THREAD_LINES = 20;
/** The persisted filter set. */
export interface InteractionFilters {
    /** Migration gate: an unrecognized version reloads defaults whole. */
    readonly version: 1;
    readonly platforms: readonly InteractionPlatformId[];
    /** `'all'` or one conversation status. */
    readonly status: 'all' | (typeof INTERACTION_STATUS_IDS)[number];
    /** `'all'` or one message kind — a conversation matches when any message has it. */
    readonly type: 'all' | InteractionMessageType;
    /** `'all'` or one sentiment — matches when any inbound message carries it. */
    readonly sentiment: 'all' | InteractionSentiment;
    /** `'all'` or one intent — matches when any inbound message carries it. */
    readonly intent: 'all' | InteractionIntent;
    readonly search: string;
}
/** Browser-local storage key of the filter set. */
export declare const FILTERS_KEY = "dsh-content-studio.interaction.filters";
/**
 * The default filters: everything, no search.
 * @returns the filter set every malformed or version-stale load falls back to.
 */
export declare function defaultInteractionFilters(): InteractionFilters;
/**
 * Load the stored filter set; anything malformed or version-stale reloads
 * defaults whole (the migration fallback the plugin's localStorage rule
 * mandates).
 * @returns the filters to render with.
 */
export declare function loadInteractionFilters(): InteractionFilters;
/**
 * Persist the filter set under the versioned key.
 * @param filters - the filters to store.
 */
export declare function saveInteractionFilters(filters: InteractionFilters): void;
/**
 * The last inbound message of a conversation, or null when it has none.
 * @param conversation - the conversation to scan.
 * @returns the newest `direction: 'in'` message, or null.
 */
export declare function lastInboundMessage(conversation: InteractionConversation): InteractionMessage | null;
/**
 * The latest message of a conversation regardless of direction, or null.
 * @param conversation - the conversation to scan.
 * @returns the last message in stored order, or null without messages.
 */
export declare function lastMessage(conversation: InteractionConversation): InteractionMessage | null;
/**
 * Apply the filter set to the conversation list. Archived and spam
 * conversations stay retrievable only through their explicit status filters
 * — the default views never mix them back in.
 * @param conversations - every stored conversation.
 * @param filters - the active filter set.
 * @returns the conversations matching, `updatedAt` order preserved.
 */
export declare function filterConversations(conversations: readonly InteractionConversation[], filters: InteractionFilters): InteractionConversation[];
/**
 * Project a conversation's thread into the lines the reply prompt embeds:
 * content only, trimmed to the latest window.
 * @param conversation - the conversation being answered.
 * @param maxLines - how many trailing lines to keep.
 * @returns the thread lines, oldest first.
 */
export declare function threadLines(conversation: InteractionConversation, maxLines?: number): {
    direction: 'in' | 'out';
    content: string;
}[];
/**
 * Merge one insight batch into the accumulated entries: same-label entries
 * sum their counts and keep the first example and hint; new labels append;
 * the result sorts by count descending and caps at five lines per list.
 * @param accumulated - the entries merged so far.
 * @param incoming - one batch's lines.
 * @returns the merged entries.
 */
export declare function mergeInsightList(accumulated: readonly InteractionInsightEntry[], incoming: readonly InteractionInsightEntry[]): InteractionInsightEntry[];
/**
 * Merge one batch result into the whole insights record.
 * @param insights - the record so far.
 * @param batch - one batch's extraction.
 * @returns the updated record (generatedAt untouched — the caller stamps it).
 */
export declare function mergeInsightBatch(insights: {
    readonly generatedAt: string | null;
    readonly topQuestions: readonly InteractionInsightEntry[];
    readonly painPoints: readonly InteractionInsightEntry[];
    readonly interests: readonly InteractionInsightEntry[];
}, batch: InteractionInsightBatch): {
    generatedAt: string | null;
    topQuestions: InteractionInsightEntry[];
    painPoints: InteractionInsightEntry[];
    interests: InteractionInsightEntry[];
};
/**
 * Slice message ids into classification batches.
 * @param ids - every message id to classify.
 * @param size - the batch size.
 * @returns the id batches, last one possibly short.
 */
export declare function batchIds(ids: readonly string[], size: number): string[][];
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
export declare function insightToTopicInput(title: string, oneLiner: string | null, conversationId: string, summary: string | null, capturedAt: string): TopicItemInput;
//# sourceMappingURL=interaction-model.d.ts.map