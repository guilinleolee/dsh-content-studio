import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The calendar view: one month grid over the publication calendar, read and
 * mutated through the injected `contentSchedule` wrappers. Clicking a day
 * opens an inline add form; each item chip offers mark-published and remove.
 * All state is view-local — the file on disk is the only truth.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { IconPlusOutline16, IconTrashOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import { groupByDate, monthGrid } from "./calendar.js";
import css from './ContentStudio.module.css';
/** Weekday headers, Monday first; rendered through the locale seat. */
const WEEKDAY_KEYS = [
    'weekday.mon', 'weekday.tue', 'weekday.wed', 'weekday.thu', 'weekday.fri', 'weekday.sat', 'weekday.sun',
];
/** Status → its dot modifier class. */
const DOT_CLASS = {
    idea: css.dotIdea ?? '',
    draft: css.dotDraft ?? '',
    scheduled: css.dotScheduled ?? '',
    published: css.dotPublished ?? '',
};
/**
 * Render the publication calendar.
 * @param props - the Remote wrappers and the locale seat.
 * @returns the calendar element tree.
 */
export function ContentCalendar({ listSchedule, putSchedule, removeSchedule, t }) {
    const [snapshot, setSnapshot] = useState(undefined);
    const [failed, setFailed] = useState(false);
    const [month, setMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() + 1 };
    });
    const [form, setForm] = useState(undefined);
    const [submitting, setSubmitting] = useState(false);
    const load = useCallback(async () => {
        setFailed(false);
        try {
            setSnapshot(await listSchedule());
        }
        catch {
            setFailed(true);
        }
    }, [listSchedule]);
    useEffect(() => { void load(); }, [load]);
    const grid = useMemo(() => monthGrid(month.year, month.month), [month]);
    const byDate = useMemo(() => groupByDate(snapshot?.items ?? []), [snapshot]);
    const shiftMonth = (delta) => {
        setMonth((current) => {
            const zero = current.year * 12 + current.month - 1 + delta;
            return { year: Math.floor(zero / 12), month: ((zero % 12) + 12) % 12 + 1 };
        });
    };
    const submit = async () => {
        if (form === undefined || form.title.trim().length === 0)
            return;
        setSubmitting(true);
        try {
            setSnapshot(await putSchedule({
                title: form.title,
                date: form.date,
                time: null,
                platform: form.platform.trim().length > 0 ? form.platform.trim() : null,
                status: 'scheduled',
                kind: 'content',
                topic: null,
                url: null,
            }));
            setForm(undefined);
        }
        catch {
            setFailed(true);
        }
        finally {
            setSubmitting(false);
        }
    };
    const markPublished = async (item) => {
        try {
            setSnapshot(await putSchedule({ ...item, status: 'published', url: item.url }));
        }
        catch {
            setFailed(true);
        }
    };
    const remove = async (id) => {
        try {
            setSnapshot(await removeSchedule(id));
        }
        catch {
            setFailed(true);
        }
    };
    if (failed) {
        return _jsx("div", { className: css.libraryState, children: t('library.error') });
    }
    if (snapshot === undefined) {
        return _jsx("div", { className: css.libraryState, children: t('calendar.loading') });
    }
    return (_jsxs("div", { className: css.calendar, children: [_jsxs("div", { className: css.calendarBar, children: [_jsx("button", { type: "button", className: css.calendarNav, "aria-label": t('calendar.prev'), onClick: () => { shiftMonth(-1); }, children: "\u2039" }), _jsxs("span", { className: css.calendarMonth, children: [month.year, " \u00B7 ", t(`calendar.month.${month.month}`)] }), _jsx("button", { type: "button", className: css.calendarNav, "aria-label": t('calendar.next'), onClick: () => { shiftMonth(1); }, children: "\u203A" }), _jsx("button", { type: "button", className: css.calendarToday, onClick: () => {
                            const now = new Date();
                            setMonth({ year: now.getFullYear(), month: now.getMonth() + 1 });
                        }, children: t('calendar.today') })] }), _jsx("div", { className: css.calendarHead, children: WEEKDAY_KEYS.map(key => _jsx("span", { className: css.calendarWeekday, children: t(key) }, key)) }), _jsx("div", { className: css.calendarGrid, children: grid.flat().map((day) => {
                    const items = byDate.get(day.date) ?? [];
                    return (_jsxs("div", { className: clsx(css.calendarCell, !day.inMonth && css.calendarCellOutside, day.isToday && css.calendarCellToday), role: "button", tabIndex: 0, "aria-label": day.date, onClick: () => { setForm(form?.date === day.date ? undefined : { date: day.date, title: '', platform: '' }); }, onKeyDown: (event) => { if (event.key === 'Enter')
                            setForm(form?.date === day.date ? undefined : { date: day.date, title: '', platform: '' }); }, children: [_jsx("span", { className: css.calendarDayNum, children: Number(day.date.slice(8, 10)) }), items.map(item => (_jsxs("span", { className: css.calendarChip, onClick: (event) => { event.stopPropagation(); }, children: [_jsx("span", { className: clsx(css.calendarDot, DOT_CLASS[item.status]), "aria-hidden": "true" }), _jsxs("span", { className: css.calendarChipTitle, children: [item.time !== null && `${item.time} `, item.title] }), item.status !== 'published' && (_jsx("button", { type: "button", className: css.calendarChipAction, "aria-label": t('calendar.publish.aria'), title: t('calendar.publish'), onClick: () => { void markPublished(item); }, children: "\u2713" })), _jsx("button", { type: "button", className: css.calendarChipAction, "aria-label": t('calendar.remove.aria'), onClick: () => { void remove(item.id); }, children: _jsx(IconTrashOutline16, { size: 11 }) })] }, item.id))), form?.date === day.date && (_jsxs("div", { className: css.calendarForm, onClick: (event) => { event.stopPropagation(); }, children: [_jsx("input", { className: css.calendarInput, autoFocus: true, placeholder: t('calendar.titlePlaceholder'), value: form.title, onChange: (event) => { setForm({ ...form, title: event.currentTarget.value }); }, onKeyDown: (event) => { if (event.key === 'Enter')
                                            void submit(); } }), _jsx("input", { className: css.calendarInput, placeholder: t('calendar.platformPlaceholder'), value: form.platform, onChange: (event) => { setForm({ ...form, platform: event.currentTarget.value }); } }), _jsxs("div", { className: css.calendarFormRow, children: [_jsxs("button", { type: "button", className: css.calendarSubmit, disabled: submitting, onClick: () => { void submit(); }, children: [_jsx(IconPlusOutline16, { size: 12 }), t('calendar.add')] }), _jsx("button", { type: "button", className: css.calendarChipAction, "aria-label": t('calendar.cancel'), onClick: () => { setForm(undefined); }, children: t('calendar.cancel') })] })] }))] }, day.date));
                }) }), form === undefined && snapshot.items.length === 0 && (_jsx("div", { className: css.calendarHint, children: t('calendar.empty') }))] }));
}
//# sourceMappingURL=ContentCalendar.js.map