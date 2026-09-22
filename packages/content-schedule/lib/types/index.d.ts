/** Publication calendar Remote for the content-creation library. */
import type { Context } from '@deepseek-ai/cordis';
import type Schema from '@deepseek-ai/schemastery';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ContentScheduleSnapshot, ScheduleItem, ScheduleItemInput } from './types.ts';
export type * from './types.ts';
export { SCHEDULE_FILENAME, normalizeInput, readSchedule, mutateSchedule } from './store.ts';
/** Content-schedule Remote configuration. */
export interface Config {
    /** Outputs library root. Defaults to `<dsh home>/outputs`. */
    root?: string;
}
export declare const Config: Schema<Config>;
/**
 * Remote calendar service over `_schedule.json` at the library root. Every
 * method reads or commits the file directly — the calendar is small, and the
 * file stays the single truth the agent can also read.
 */
export declare class ContentScheduleGateway extends TypertRemoteService {
    static inject: never[];
    static Config: Schema<Config>;
    /** Absolute calendar file path. */
    private readonly file;
    constructor(ctx: Context, config: Config);
    /**
     * Read the whole calendar.
     * @returns items sorted by date, with every bad stored record named.
     */
    list(): Promise<ContentScheduleSnapshot>;
    /**
     * Upsert one item: an absent `id` (or an unknown one) creates; a known one
     * replaces in place. Identity is decided by id alone — no title/date
     * matching.
     * @param input - the upsert payload.
     * @returns the post-write calendar snapshot.
     */
    put(input: ScheduleItemInput): Promise<ContentScheduleSnapshot>;
    /**
     * Delete one item by id; deleting an unknown id is a no-op, not an error.
     * @param id - the item's stable identity.
     * @returns the post-write calendar snapshot.
     */
    delete(id: ScheduleItem['id']): Promise<ContentScheduleSnapshot>;
}
export default ContentScheduleGateway;
//# sourceMappingURL=index.d.ts.map