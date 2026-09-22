/**
 * Schedule file store: reads and writes the calendar JSON directly on every
 * call. The file lives at the library root under `_schedule.json` — the `_`
 * prefix keeps the outputs scanner treating it as a system entry, and one
 * library directory stays the whole content-creation surface on disk.
 *
 * Validation follows the same rule as the outputs scanner: one malformed
 * record never hides the rest — it is named in `problems` and skipped, while
 * valid items keep their place on the calendar.
 */
import type { ContentScheduleSnapshot, ScheduleItem, ScheduleItemInput } from './types.ts';
/** System file name of the calendar at the library root. */
export declare const SCHEDULE_FILENAME = "_schedule.json";
/**
 * Validate one upsert input into its stored shape; `id` is generated when
 * absent and trimmed fields are normalized.
 * @param input - the upsert payload.
 * @returns the stored item, or the reason the input is invalid.
 */
export declare function normalizeInput(input: ScheduleItemInput): {
    item?: ScheduleItem;
    detail?: string;
};
/**
 * Read the calendar file.
 * @param file - absolute `_schedule.json` path; a missing file is empty.
 * @returns the snapshot with items sorted and every bad record named.
 */
export declare function readSchedule(file: string): Promise<ContentScheduleSnapshot>;
/**
 * Apply one mutation to the calendar under a file lock, atomically.
 * @param file - absolute `_schedule.json` path; parent directories are
 * created when missing (the lock file requires its parent to exist).
 * @param mutate - pure transform over the current item list.
 * @returns the mutation's write snapshot (post-write state).
 */
export declare function mutateSchedule(file: string, mutate: (items: readonly ScheduleItem[]) => Promise<readonly ScheduleItem[]> | readonly ScheduleItem[]): Promise<ContentScheduleSnapshot>;
//# sourceMappingURL=store.d.ts.map