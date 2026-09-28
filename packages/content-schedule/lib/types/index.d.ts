/** Publication calendar Remote for the content-creation library. */
import type { Context } from '@deepseek-ai/cordis';
import type Schema from '@deepseek-ai/schemastery';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { CalendarNotesSnapshot, ContentScheduleSnapshot, ScheduleItem, ScheduleItemInput } from './types.ts';
export type * from './types.ts';
export { SCHEDULE_FILENAME, normalizeInput, readSchedule, mutateSchedule } from './store.ts';
export { CALENDAR_FILENAME, readNotes, writeNote } from './calendar-notes.ts';
/** Content-schedule Remote configuration. */
export interface Config {
    /** Outputs library root. Defaults to `<dsh home>/outputs`. */
    root?: string;
}
export declare const Config: Schema<Config>;
/**
 * Remote calendar service over `_schedule.json` at the library root, plus the
 * `_calendar.json` day-note sidecar. Every method reads or commits its file
 * directly — the calendar is small, and the files stay the single truth the
 * agent can also read.
 */
export declare class ContentScheduleGateway extends TypertRemoteService {
    static inject: never[];
    static Config: Schema<Config>;
    /** Absolute calendar file path. */
    private readonly file;
    /** Absolute notes sidecar path. */
    private readonly notesFile;
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
    /**
     * Read the day-note sidecar.
     * @returns the notes keyed by schedule item id, with bad records named.
     */
    getNotes(): Promise<CalendarNotesSnapshot>;
    /**
     * Upsert one day note: a non-empty text annotates the item, an empty text
     * clears the entry. The annotated item is not looked up — a note for a
     * deleted item stays stored but inert until rewritten or cleared.
     * @param id - the annotated schedule item's stable id.
     * @param text - the note body; empty clears the entry.
     * @returns the post-write notes snapshot.
     */
    putNote(id: string, text: string): Promise<CalendarNotesSnapshot>;
}
export default ContentScheduleGateway;
//# sourceMappingURL=index.d.ts.map