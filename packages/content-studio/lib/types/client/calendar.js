/**
 * Pure calendar math for the calendar view: no React, no IO. Month and week
 * grids (weeks start Monday), view/filter configuration with a versioned
 * whole-fallback migration, the render-time overdue and conflict
 * derivations, list filtering, and CSV export. Every grid day carries its
 * `YYYY-MM-DD` wire date plus an in-month flag so leading/trailing padding
 * renders dimmed.
 */
/**
 * Local-time today as `YYYY-MM-DD`.
 * @returns today's wire date in the host time zone.
 */
export function todayDate() {
    const now = new Date();
    return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
/**
 * Compose a wire date from local year/month(1-12)/day.
 * @param year - calendar year.
 * @param month - calendar month, 1-12.
 * @param day - calendar day.
 * @returns the zero-padded `YYYY-MM-DD` date.
 */
export function formatDate(year, month, day) {
    const monthText = String(month).padStart(2, '0');
    const dayText = String(day).padStart(2, '0');
    return `${year}-${monthText}-${dayText}`;
}
/** Days in one month (month is 1-12). */
function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}
/**
 * Build the month grid: whole weeks, Monday first, including the leading and
 * trailing days borrowed from adjacent months.
 * @param year - calendar year.
 * @param month - calendar month, 1-12.
 * @returns rows of 7 cells covering the month.
 */
export function monthGrid(year, month) {
    const today = todayDate();
    const first = new Date(year, month - 1, 1);
    const lead = (first.getDay() + 6) % 7;
    const total = lead + daysInMonth(year, month);
    const rows = Math.ceil(total / 7);
    const grid = [];
    for (let index = 0; index < rows * 7; index += 7) {
        const row = [];
        for (let cell = 0; cell < 7; cell++) {
            const offset = index + cell - lead + 1;
            const day = new Date(year, month - 1, offset);
            const date = formatDate(day.getFullYear(), day.getMonth() + 1, day.getDate());
            row.push({ date, inMonth: day.getMonth() === month - 1, isToday: date === today });
        }
        grid.push(row);
    }
    return grid;
}
/**
 * Group items by their wire date for per-day chip rendering.
 * @param items - items carrying a `YYYY-MM-DD` date.
 * @returns a date-keyed map preserving each bucket's item order.
 */
export function groupByDate(items) {
    const byDate = new Map();
    for (const item of items) {
        const bucket = byDate.get(item.date);
        if (bucket === undefined)
            byDate.set(item.date, [item]);
        else
            bucket.push(item);
    }
    return byDate;
}
/** Minutes two same-platform schedules may span and still count as crowded. */
export const CALENDAR_CONFLICT_WINDOW_MINUTES = 120;
/** Filters with every constraint disabled. */
export const DEFAULT_CALENDAR_FILTERS = {
    kind: 'all',
    platforms: [],
    statuses: [],
    start: null,
    end: null,
    query: '',
    overdueOnly: false,
};
/** Current persisted-configuration shape version. */
export const CALENDAR_CONFIG_VERSION = 1;
const DEFAULT_CALENDAR_CONFIG = {
    version: CALENDAR_CONFIG_VERSION,
    view: 'month',
    filters: DEFAULT_CALENDAR_FILTERS,
};
const VIEW_KINDS = ['month', 'week', 'list'];
const STATUSES = ['idea', 'draft', 'scheduled', 'published'];
function isFilters(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return (record.kind === 'all' || record.kind === 'content' || record.kind === 'event')
        && Array.isArray(record.platforms) && record.platforms.every(entry => typeof entry === 'string')
        && Array.isArray(record.statuses) && record.statuses.every(entry => STATUSES.includes(entry))
        && (record.start === null || typeof record.start === 'string')
        && (record.end === null || typeof record.end === 'string')
        && typeof record.query === 'string'
        && typeof record.overdueOnly === 'boolean';
}
/**
 * Parse the persisted view configuration; anything unrecognizable — wrong
 * version, truncated JSON, one bad field — falls back to the default whole,
 * so a stale shape never half-renders.
 * @param raw - the stored string, or null before the first save.
 * @returns the configuration to render with.
 */
export function loadCalendarConfig(raw) {
    if (raw === null)
        return DEFAULT_CALENDAR_CONFIG;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return DEFAULT_CALENDAR_CONFIG;
    }
    if (typeof parsed !== 'object' || parsed === null)
        return DEFAULT_CALENDAR_CONFIG;
    const record = parsed;
    if (record.version !== CALENDAR_CONFIG_VERSION)
        return DEFAULT_CALENDAR_CONFIG;
    if (!VIEW_KINDS.includes(record.view))
        return DEFAULT_CALENDAR_CONFIG;
    if (!isFilters(record.filters))
        return DEFAULT_CALENDAR_CONFIG;
    return { version: CALENDAR_CONFIG_VERSION, view: record.view, filters: record.filters };
}
/**
 * Serialize the view configuration for storage.
 * @param config - the configuration to persist.
 * @returns the stored string.
 */
export function saveCalendarConfig(config) {
    return JSON.stringify(config);
}
/**
 * Build the one-week row containing the anchor date, Monday first. A week is
 * never padded, so every cell renders at full opacity.
 * @param anchor - the wire date the rendered week must contain.
 * @returns exactly 7 cells.
 */
export function weekGrid(anchor) {
    const today = todayDate();
    const base = new Date(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)) - 1, Number(anchor.slice(8, 10)));
    const lead = (base.getDay() + 6) % 7;
    return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() - lead + index);
        const date = formatDate(day.getFullYear(), day.getMonth() + 1, day.getDate());
        return { date, inMonth: true, isToday: date === today };
    });
}
/**
 * Derive the overdue state at render time: the plan day passed entirely and
 * the item never published. Never stored — recomputed on every render.
 * @param item - the schedule item.
 * @param today - today's wire date in the host time zone.
 * @returns true when the item is overdue.
 */
export function overdueOf(item, today) {
    return item.status !== 'published' && item.date < today;
}
/** Minutes since midnight of one `HH:mm` time, or null without a time. */
function minutesOf(time) {
    if (time === null)
        return null;
    return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}
/**
 * Detect scheduling conflicts at render time: two `scheduled` items on the
 * same platform and day whose times sit closer than the conflict window,
 * plus a same-platform day carrying three or more `scheduled` items (all-day
 * items without a time only count toward that crowding rule). Never stored.
 * @param items - schedule items in any order.
 * @returns the conflicting items' ids.
 */
export function detectConflicts(items) {
    const conflicted = new Set();
    const byDay = new Map();
    for (const item of items) {
        if (item.status !== 'scheduled' || item.platform === null)
            continue;
        const key = `${item.platform}\n${item.date}`;
        const bucket = byDay.get(key);
        if (bucket === undefined)
            byDay.set(key, [item]);
        else
            bucket.push(item);
    }
    for (const bucket of byDay.values()) {
        if (bucket.length >= 3) {
            for (const item of bucket)
                conflicted.add(item.id);
            continue;
        }
        for (let left = 0; left < bucket.length; left++) {
            const first = bucket[left];
            if (first === undefined)
                continue;
            const leftMinutes = minutesOf(first.time);
            if (leftMinutes === null)
                continue;
            for (let right = left + 1; right < bucket.length; right++) {
                const second = bucket[right];
                if (second === undefined)
                    continue;
                const rightMinutes = minutesOf(second.time);
                if (rightMinutes === null)
                    continue;
                if (Math.abs(leftMinutes - rightMinutes) < CALENDAR_CONFLICT_WINDOW_MINUTES) {
                    conflicted.add(first.id);
                    conflicted.add(second.id);
                }
            }
        }
    }
    return conflicted;
}
/**
 * Apply the active filters to the snapshot items in store order.
 * @param items - schedule items sorted by the store.
 * @param filters - the active filters.
 * @param today - today's wire date, for the overdue-only filter.
 * @returns the items matching every active constraint.
 */
export function filterCalendarItems(items, filters, today) {
    const query = filters.query.trim().toLowerCase();
    return items.filter((item) => {
        if (filters.kind !== 'all' && item.kind !== filters.kind)
            return false;
        if (filters.platforms.length > 0 && (item.platform === null || !filters.platforms.includes(item.platform)))
            return false;
        if (filters.statuses.length > 0 && !filters.statuses.includes(item.status))
            return false;
        if (filters.start !== null && item.date < filters.start)
            return false;
        if (filters.end !== null && item.date > filters.end)
            return false;
        if (filters.overdueOnly && !overdueOf(item, today))
            return false;
        if (query.length > 0 && !item.title.toLowerCase().includes(query))
            return false;
        return true;
    });
}
/** Fixed Chinese labels of the CSV artifact (the offline archival form). */
const CSV_STATUS_LABELS = {
    idea: '构思',
    draft: '草稿',
    scheduled: '已排期',
    published: '已发布',
};
/** Wrap one CSV field when it carries a comma, quote, or newline. */
function csvCell(value) {
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
/**
 * Render the filtered schedule as the archival CSV: UTF-8 with BOM (Excel
 * reads the Chinese headers correctly), CRLF rows, and the fixed column
 * order 日期/时间/类型/状态/标题/平台/关联选题/备注.
 * @param items - the filtered items in render order.
 * @param notes - the note bodies keyed by item id.
 * @returns the complete file content including the BOM and final CRLF.
 */
export function calendarEventsToCsv(items, notes) {
    const header = ['日期', '时间', '类型', '状态', '标题', '平台', '关联选题', '备注'];
    const rows = items.map(item => [
        item.date,
        item.time ?? '',
        item.kind === 'content' ? '选题排期' : '独立日程',
        CSV_STATUS_LABELS[item.status],
        item.title,
        item.platform ?? '',
        item.topic ?? '',
        notes[item.id]?.text ?? '',
    ].map(csvCell).join(','));
    return `\uFEFF${[header.join(','), ...rows].join('\r\n')}\r\n`;
}
//# sourceMappingURL=calendar.js.map