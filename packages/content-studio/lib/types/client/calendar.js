/**
 * Pure month-grid math for the calendar view: no React, no IO — weeks start
 * Monday, and every day carries its `YYYY-MM-DD` wire date plus an
 * in-month flag so leading/trailing padding renders dimmed.
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
//# sourceMappingURL=calendar.js.map