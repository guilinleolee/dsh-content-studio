/**
 * Pure logic of the topic-bank view: the five-status single-source config,
 * the persisted view/filter configuration with versioned load migration,
 * filtering (source, score range, tag, status, keyword, plan window), the
 * kanban grouping, and the Markdown export whose frontmatter is emitted and
 * parsed by one strict schema so export → import round-trips losslessly.
 * No React, no I/O — the view and the tests share this module, like
 * `calendar.ts`, `create.ts`, and `competitors.ts`.
 */
import type { TopicItem, TopicItemInput, TopicSourceType, TopicStatus } from '@deepseek-ai/dsh-content-topics/types';
/** Kanban column order and the canonical status sequence, oldest stage first. */
export declare const TOPIC_STATUSES: readonly TopicStatus[];
/** Source families of one topic, in filter order. */
export declare const TOPIC_SOURCE_TYPES: readonly TopicSourceType[];
/** The persisted view: the topic bank's two faces. */
export type TopicBankViewKind = 'table' | 'kanban';
/** How the plan-date filter scopes the list. */
export type TopicBankPlanWindow = 'all' | 'week' | 'month';
/** One view/filter configuration as persisted to localStorage. */
export interface TopicBankConfig {
    /** Migration gate: an unrecognized version reloads defaults whole. */
    readonly version: 1;
    readonly view: TopicBankViewKind;
    readonly filters: {
        /** `'all'` or one source family. */
        readonly source: 'all' | TopicSourceType;
        /** `'all'` or one lifecycle status. */
        readonly status: 'all' | TopicStatus;
        /** Inclusive score-range lower bound, 0–10. */
        readonly scoreMin: number;
        /** Inclusive score-range upper bound, 0–10. */
        readonly scoreMax: number;
        /** Exact tag match, or null for no tag filter. */
        readonly tag: string | null;
        readonly planWindow: TopicBankPlanWindow;
        /** Case-insensitive substring over title, pitch, description, and tags. */
        readonly search: string;
    };
}
/** The shipped configuration; every load migration falls back here whole. */
export declare const DEFAULT_TOPIC_BANK_CONFIG: TopicBankConfig;
/** The recognized configuration version. */
export declare const TOPIC_BANK_CONFIG_VERSION = 1;
/**
 * Load and migrate one persisted configuration. Anything the current schema
 * does not recognize — wrong version, truncated JSON, unexpected shapes —
 * resolves to the defaults whole, so no dirty state ever reaches the view.
 * @param raw - the stored JSON text, or null when nothing was saved.
 * @returns the recognized configuration, or the defaults.
 */
export declare function loadTopicBankConfig(raw: string | null): TopicBankConfig;
/**
 * Serialize one configuration for localStorage.
 * @param config - the configuration to persist.
 * @returns the JSON text.
 */
export declare function saveTopicBankConfig(config: TopicBankConfig): string;
/**
 * Local-time Monday of the week containing `today`, as a wire date.
 * @param today - the anchor date, `YYYY-MM-DD`.
 * @returns the week's Monday wire date.
 */
export declare function weekStart(today: string): string;
/**
 * Compose a wire date from local year/month(1-12)/day.
 * @param year - calendar year.
 * @param month - calendar month, 1-12.
 * @param day - calendar day.
 * @returns the zero-padded `YYYY-MM-DD` date.
 */
export declare function formatDate(year: number, month: number, day: number): string;
/**
 * The inclusive wire-date range one plan window covers.
 * @param window - the selected window (`week` or `month`; `all` never
 * range-checks and never reaches this function).
 * @param today - the anchor date, `YYYY-MM-DD`.
 * @returns `[start, end]` wire dates; `week` covers Monday–Sunday, `month`
 * the calendar month.
 */
export declare function planWindowRange(window: Exclude<TopicBankPlanWindow, 'all'>, today: string): readonly [string, string];
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
export declare function filterTopics(items: readonly TopicItem[], filters: TopicBankConfig['filters'], today: string): readonly TopicItem[];
/** One kanban column: a status and its topics in input order. */
export interface TopicStatusColumn {
    readonly status: TopicStatus;
    readonly items: readonly TopicItem[];
}
/**
 * Group topics by status for the kanban's five columns.
 * @param items - the topics to place.
 * @returns one entry per canonical status, in column order, preserving each
 * bucket's input order.
 */
export declare function groupByStatus(items: readonly TopicItem[]): readonly TopicStatusColumn[];
/**
 * Collect every distinct tag across the bank, alphabetically.
 * @param items - the bank's topics.
 * @returns the sorted distinct tag list.
 */
export declare function collectTags(items: readonly TopicItem[]): readonly string[];
/**
 * Render one topic score for the table and kanban: integral scores stay
 * bare, fractional ones keep one decimal.
 * @param total - the score, 0–10.
 * @returns the display text.
 */
export declare function formatScore(total: number): string;
/**
 * Emit one topic's frontmatter-plus-body Markdown. The schema is strict:
 * dates stay unquoted `YYYY-MM-DD`, scores stay bare numbers, every other
 * scalar is double-quoted, and tags are a quoted inline array — the exact
 * inverse of {@link parseTopicsMarkdown}, so a round-trip loses nothing.
 * @param item - the topic to render.
 * @returns the Markdown document text.
 */
export declare function topicToMarkdown(item: TopicItem): string;
/**
 * Emit the batch-export document: every topic under the next, separated by
 * a blank line — one file carries the whole selection.
 * @param items - the topics to export, in document order.
 * @returns the Markdown document text.
 */
export declare function topicsToMarkdown(items: readonly TopicItem[]): string;
/** One parsed export document: the schema's fields plus the body text. */
export interface ParsedTopicMarkdown {
    readonly title: string;
    readonly oneLiner: string | null;
    readonly status: TopicStatus;
    readonly sourceType: TopicSourceType;
    readonly sourceUrl: string | null;
    readonly tags: readonly string[];
    readonly score: number | null;
    readonly planDate: string | null;
    readonly updatedAt: string;
    readonly description: string | null;
}
/**
 * Parse one document produced by {@link topicToMarkdown}. The parser accepts
 * only the schema's own shape and answers null for anything else — it exists
 * to keep the export schema honest (round-trip), not to import foreign files.
 * @param markdown - the document text.
 * @returns the parsed fields, or null when the document is not schema output.
 */
export declare function parseTopicsMarkdown(markdown: string): ParsedTopicMarkdown | null;
/**
 * Build a create-topic input from one gather material join: the material's
 * stable id rides along as `source.refId`, its link and create-time capture
 * as `source.url` / `source.snapshot`, and the record starts in `idea`.
 * @param material - the joined gather material.
 * @param capturedAt - the capture instant, ISO 8601.
 * @returns the upsert input for the contentTopics Remote.
 */
export declare function gatherMaterialToTopicInput(material: {
    id: string;
    title: string;
    url: string;
    summary?: string;
}, capturedAt: string): TopicItemInput;
/**
 * Build a manual topic input: only the title is required, and the record
 * starts in `idea` — everything else is back-filled later in the detail
 * panel.
 * @param title - the working title.
 * @returns the upsert input for the contentTopics Remote.
 */
export declare function manualTopicInput(title: string): TopicItemInput;
/**
 * Project one stored topic back to its upsert input, with patches applied —
 * the shape every status move, batch edit, and detail-panel save sends to
 * the contentTopics Remote.
 * @param item - the stored topic.
 * @param patch - the fields overriding the stored ones.
 * @returns the upsert input carrying the topic's `id`.
 */
export declare function topicInputOf(item: TopicItem, patch?: Partial<TopicItemInput>): TopicItemInput;
/**
 * The input for a batch tag edit: the stored tags plus every appended one,
 * deduplicated, order preserved.
 * @param item - the stored topic.
 * @param appended - tags to add; duplicates of existing tags are ignored.
 * @returns the upsert input with the union tags.
 */
export declare function withAppendedTags(item: TopicItem, appended: readonly string[]): TopicItemInput;
//# sourceMappingURL=topic-bank.d.ts.map