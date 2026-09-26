/**
 * Topic bank file store: reads and writes the topics JSON directly on every
 * call. The file lives at the library root under `_topics.json` — the `_`
 * prefix keeps the outputs scanner treating it as a system entry, and one
 * library directory stays the whole content-creation surface on disk.
 *
 * Validation follows the same rule as the outputs scanner: one malformed
 * record never hides the rest — it is named in `problems` and skipped, while
 * valid topics keep their place in the bank. A file whose `formatVersion` is
 * not the current one never loads as current records.
 */
import type { ContentTopicsSnapshot, TopicItem, TopicItemInput } from './types.ts';
/** System file name of the topic bank at the library root. */
export declare const TOPICS_FILENAME = "_topics.json";
/**
 * Validate one upsert input into its stored shape: `id` is generated as a
 * UUID when absent, timestamps are stamped here, and trimmed fields are
 * normalized (blank optionals collapse to null, blank tags are dropped).
 * @param input - the upsert payload.
 * @returns the stored topic, or the reason the input is invalid.
 */
export declare function normalizeInput(input: TopicItemInput): {
    item?: TopicItem;
    detail?: string;
};
/**
 * Read the topic bank file.
 * @param file - absolute `_topics.json` path; a missing file is empty.
 * @returns the snapshot with items sorted and every bad record named.
 */
export declare function readTopics(file: string): Promise<ContentTopicsSnapshot>;
/**
 * Apply one mutation to the topic bank under a file lock, atomically.
 * @param file - absolute `_topics.json` path; parent directories are
 * created before the lock so a fresh install's very first write succeeds.
 * @param mutate - pure transform over the current item list.
 * @returns the mutation's write snapshot (post-write state).
 */
export declare function mutateTopics(file: string, mutate: (items: readonly TopicItem[]) => Promise<readonly TopicItem[]> | readonly TopicItem[]): Promise<ContentTopicsSnapshot>;
//# sourceMappingURL=store.d.ts.map