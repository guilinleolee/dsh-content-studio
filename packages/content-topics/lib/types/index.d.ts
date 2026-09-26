/** Topic-bank Remote for the content-creation library. */
import type { Context } from '@deepseek-ai/cordis';
import type Schema from '@deepseek-ai/schemastery';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ContentTopicsSnapshot, TopicItem, TopicItemInput } from './types.ts';
export type * from './types.ts';
export { TOPICS_FILENAME, normalizeInput, readTopics, mutateTopics } from './store.ts';
/** Content-topics Remote configuration. */
export interface Config {
    /** Outputs library root. Defaults to `<dsh home>/outputs`. */
    root?: string;
}
export declare const Config: Schema<Config>;
/**
 * Remote topic-bank service over `_topics.json` at the library root. Every
 * method reads or commits the file directly — the bank is small, and the
 * file stays the single truth the agent can also read.
 */
export declare class ContentTopicsGateway extends TypertRemoteService {
    static inject: never[];
    static Config: Schema<Config>;
    /** Absolute topic bank file path. */
    private readonly file;
    constructor(ctx: Context, config: Config);
    /**
     * Read the whole topic bank.
     * @returns items sorted by `updatedAt` (newest first), with every bad
     * stored record named.
     */
    list(): Promise<ContentTopicsSnapshot>;
    /**
     * Upsert one topic: an absent `id` (or an unknown one) creates; a known one
     * replaces in place, keeping the stored `createdAt` and restamping
     * `updatedAt`. Identity is decided by id alone.
     * @param input - the upsert payload.
     * @returns the post-write topic bank snapshot.
     */
    put(input: TopicItemInput): Promise<ContentTopicsSnapshot>;
    /**
     * Delete one topic by id; deleting an unknown id is a no-op, not an error.
     * Only the topic record is removed — the linked schedule entry and the
     * outputs project, if any, stay untouched.
     * @param id - the topic's stable identity.
     * @returns the post-write topic bank snapshot.
     */
    delete(id: TopicItem['id']): Promise<ContentTopicsSnapshot>;
}
export default ContentTopicsGateway;
//# sourceMappingURL=index.d.ts.map