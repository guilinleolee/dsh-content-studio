/**
 * Pure calendar math for the calendar view: no React, no IO. Month and week
 * grids (weeks start Monday), view/filter configuration with a versioned
 * whole-fallback migration, the render-time overdue and conflict
 * derivations, list filtering, and CSV export. Every grid day carries its
 * `YYYY-MM-DD` wire date plus an in-month flag so leading/trailing padding
 * renders dimmed.
 */
import type { ScheduleItem, ScheduleItemKind, ScheduleItemStatus } from '@deepseek-ai/dsh-content-schedule/types';
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
/** Minutes two same-platform schedules may span and still count as crowded. */
export declare const CALENDAR_CONFLICT_WINDOW_MINUTES = 120;
/** The three rendered faces of the calendar surface. */
export type CalendarViewKind = 'month' | 'week' | 'list';
/** Active filters of the calendar surface; empty collections mean "all". */
export interface CalendarFilters {
    /** Item kind, or `all`. */
    kind: 'all' | ScheduleItemKind;
    /** Platforms to keep; empty keeps every platform. */
    platforms: readonly string[];
    /** Statuses to keep; empty keeps every status. */
    statuses: readonly ScheduleItemStatus[];
    /** Inclusive range start (`YYYY-MM-DD`), or null for unbounded. */
    start: string | null;
    /** Inclusive range end (`YYYY-MM-DD`), or null for unbounded. */
    end: string | null;
    /** Case-insensitive substring over the title. */
    query: string;
    /** Keep only items whose plan day passed without publishing. */
    overdueOnly: boolean;
}
/** Filters with every constraint disabled. */
export declare const DEFAULT_CALENDAR_FILTERS: CalendarFilters;
/** Current persisted-configuration shape version. */
export declare const CALENDAR_CONFIG_VERSION = 1;
/** Persisted view configuration (localStorage, feature-prefixed). */
export interface CalendarConfig {
    /** On-disk shape version; unknown versions fall back whole. */
    version: typeof CALENDAR_CONFIG_VERSION;
    /** Last rendered face. */
    view: CalendarViewKind;
    /** Active filters. */
    filters: CalendarFilters;
}
/**
 * Parse the persisted view configuration; anything unrecognizable — wrong
 * version, truncated JSON, one bad field — falls back to the default whole,
 * so a stale shape never half-renders.
 * @param raw - the stored string, or null before the first save.
 * @returns the configuration to render with.
 */
export declare function loadCalendarConfig(raw: string | null): CalendarConfig;
/**
 * Serialize the view configuration for storage.
 * @param config - the configuration to persist.
 * @returns the stored string.
 */
export declare function saveCalendarConfig(config: CalendarConfig): string;
/**
 * Build the one-week row containing the anchor date, Monday first. A week is
 * never padded, so every cell renders at full opacity.
 * @param anchor - the wire date the rendered week must contain.
 * @returns exactly 7 cells.
 */
export declare function weekGrid(anchor: string): CalendarDay[];
/**
 * Derive the overdue state at render time: the plan day passed entirely and
 * the item never published. Never stored — recomputed on every render.
 * @param item - the schedule item.
 * @param today - today's wire date in the host time zone.
 * @returns true when the item is overdue.
 */
export declare function overdueOf(item: Pick<ScheduleItem, 'date' | 'status'>, today: string): boolean;
/**
 * Detect scheduling conflicts at render time: two `scheduled` items on the
 * same platform and day whose times sit closer than the conflict window,
 * plus a same-platform day carrying three or more `scheduled` items (all-day
 * items without a time only count toward that crowding rule). Never stored.
 * @param items - schedule items in any order.
 * @returns the conflicting items' ids.
 */
export declare function detectConflicts(items: readonly ScheduleItem[]): ReadonlySet<string>;
/**
 * Apply the active filters to the snapshot items in store order.
 * @param items - schedule items sorted by the store.
 * @param filters - the active filters.
 * @param today - today's wire date, for the overdue-only filter.
 * @returns the items matching every active constraint.
 */
export declare function filterCalendarItems(items: readonly ScheduleItem[], filters: CalendarFilters, today: string): readonly ScheduleItem[];
/**
 * Render the filtered schedule as the archival CSV: UTF-8 with BOM (Excel
 * reads the Chinese headers correctly), CRLF rows, and the fixed column
 * order 日期/时间/类型/状态/标题/平台/关联选题/备注.
 * @param items - the filtered items in render order.
 * @param notes - the note bodies keyed by item id.
 * @returns the complete file content including the BOM and final CRLF.
 */
export declare function calendarEventsToCsv(items: readonly ScheduleItem[], notes: Readonly<Record<string, {
    readonly text: string;
}>>): string;
//# sourceMappingURL=calendar.d.ts.map