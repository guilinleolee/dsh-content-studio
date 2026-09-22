/**
 * Pure month-grid math for the calendar view: no React, no IO — weeks start
 * Monday, and every day carries its `YYYY-MM-DD` wire date plus an
 * in-month flag so leading/trailing padding renders dimmed.
 */
/** One rendered cell of the month grid. */
export interface CalendarDay {
    /** Wire date of the cell, `YYYY-MM-DD`. */
    date: string;
    /** False for the leading/trailing cells borrowed from adjacent months. */
    inMonth: boolean;
    /** True when the cell is today (local time). */
    isToday: boolean;
}
/**
 * Local-time today as `YYYY-MM-DD`.
 * @returns today's wire date in the host time zone.
 */
export declare function todayDate(): string;
/**
 * Compose a wire date from local year/month(1-12)/day.
 * @param year - calendar year.
 * @param month - calendar month, 1-12.
 * @param day - calendar day.
 * @returns the zero-padded `YYYY-MM-DD` date.
 */
export declare function formatDate(year: number, month: number, day: number): string;
/**
 * Build the month grid: whole weeks, Monday first, including the leading and
 * trailing days borrowed from adjacent months.
 * @param year - calendar year.
 * @param month - calendar month, 1-12.
 * @returns rows of 7 cells covering the month.
 */
export declare function monthGrid(year: number, month: number): CalendarDay[][];
/**
 * Group items by their wire date for per-day chip rendering.
 * @param items - items carrying a `YYYY-MM-DD` date.
 * @returns a date-keyed map preserving each bucket's item order.
 */
export declare function groupByDate<S extends {
    readonly date: string;
}>(items: readonly S[]): Map<string, S[]>;
//# sourceMappingURL=calendar.d.ts.map