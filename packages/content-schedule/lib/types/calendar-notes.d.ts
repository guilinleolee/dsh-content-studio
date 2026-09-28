/**
 * Calendar-notes store: reads and writes the day-note sidecar
 * `_calendar.json` at the library root, next to `_schedule.json`. Notes are
 * the calendar view's only owned data — every schedule fact lives on the
 * `_schedule.json` item itself, and a note merely annotates one item by its
 * stable id. A note whose item is gone is inert: readers ignore unknown ids
 * and the next write to that id replaces or clears the entry.
 */
import type { CalendarNotesSnapshot } from './types.ts';
/** System file name of the notes sidecar at the library root. */
export declare const CALENDAR_FILENAME = "_calendar.json";
/**
 * Read the notes file.
 * @param file - absolute `_calendar.json` path; a missing file is empty.
 * @returns the snapshot with valid entries and every bad record named.
 */
export declare function readNotes(file: string): Promise<CalendarNotesSnapshot>;
/**
 * Write one note under a file lock, atomically: a non-empty text upserts the
 * entry, an empty (or whitespace) text clears it.
 * @param file - absolute `_calendar.json` path; parent directories are
 * created when missing (the lock file requires its parent to exist).
 * @param id - the annotated schedule item's stable id.
 * @param text - the note body; empty clears the entry.
 * @returns the post-write notes snapshot.
 */
export declare function writeNote(file: string, id: string, text: string): Promise<CalendarNotesSnapshot>;
//# sourceMappingURL=calendar-notes.d.ts.map