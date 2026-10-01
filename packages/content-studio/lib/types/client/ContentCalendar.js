import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The calendar view: the scheduling workbench over `_schedule.json` — the
 * month, week, and list faces render the same filtered items, native
 * drag-and-drop rescheduling confirms before writing (a linked topic's plan
 * date rides along), day notes live in the `_calendar.json` sidecar, and the
 * overdue and conflict badges are derived at render time by `calendar.ts`.
 * All state is view-local; the files on disk are the only truth.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { IconPlusOutline16, IconTrashOutline16, IconWarningOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import { DEFAULT_CALENDAR_FILTERS, calendarEventsToCsv, detectConflicts, filterCalendarItems, formatDate, groupByDate, loadCalendarConfig, monthGrid, overdueOf, saveCalendarConfig, todayDate, weekGrid, } from "./calendar.js";
import { topicInputOf } from "./topic-bank.js";
import css from './ContentStudio.module.css';
import cal from './ContentCalendar.module.css';
/** localStorage key of the view/filter configuration (feature-prefixed). */
const CONFIG_KEY = 'dsh-content-studio.calendar.config';
/** How long a toast stays visible before clearing itself. */
const NOTICE_MS = 3000;
/** Wire shape of one optional local time. */
const TIME_PATTERN = /^\d{2}:\d{2}$/;
/** Status → its dot modifier class. */
const DOT_CLASS = {
    idea: css.dotIdea ?? '',
    draft: css.dotDraft ?? '',
    scheduled: css.dotScheduled ?? '',
    published: css.dotPublished ?? '',
};
/** Every stored status, in filter-chip order. */
const STATUS_KEYS = ['idea', 'draft', 'scheduled', 'published'];
/** View face → its tab label. */
const VIEW_KEYS = {
    month: 'calendar.view.month',
    week: 'calendar.view.week',
    list: 'calendar.view.list',
};
/** Weekday headers, Monday first; rendered through the locale seat. */
const WEEKDAY_KEYS = [
    'weekday.mon', 'weekday.tue', 'weekday.wed', 'weekday.thu', 'weekday.fri', 'weekday.sat', 'weekday.sun',
];
/** Open a fresh add form for one day. */
function newForm(date) {
    return { date, title: '', platform: '', time: '', kind: 'event', topicDir: '' };
}
/**
 * Render the scheduling calendar.
 * @param props - the Remote wrappers and the locale seat.
 * @returns the calendar element tree.
 */
export function ContentCalendar({ listSchedule, putSchedule, removeSchedule, notes, topics, writeExport, listThemes, onNavigate, t, }) {
    const [snapshot, setSnapshot] = useState(undefined);
    const [notesSnapshot, setNotesSnapshot] = useState(undefined);
    const [topicsSnapshot, setTopicsSnapshot] = useState(undefined);
    const [failed, setFailed] = useState(false);
    const [month, setMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() + 1 };
    });
    const [weekAnchor, setWeekAnchor] = useState(() => todayDate());
    const [config, setConfig] = useState(() => {
        try {
            return loadCalendarConfig(localStorage.getItem(CONFIG_KEY));
        }
        catch {
            // Storage denied (privacy mode): the view still renders with defaults.
            return loadCalendarConfig(null);
        }
    });
    const [form, setForm] = useState(undefined);
    const [detailId, setDetailId] = useState(undefined);
    const [dragId, setDragId] = useState(undefined);
    const [checked, setChecked] = useState(new Set());
    const [submitting, setSubmitting] = useState(false);
    const [notice, setNotice] = useState(undefined);
    const [exportTheme, setExportTheme] = useState(null);
    const showNotice = (text, tone) => {
        setNotice({ text, tone });
    };
    useEffect(() => {
        if (notice === undefined)
            return;
        const timer = window.setTimeout(() => { setNotice(undefined); }, NOTICE_MS);
        return () => { window.clearTimeout(timer); };
    }, [notice]);
    const load = useCallback(async () => {
        setFailed(false);
        try {
            const [schedule, dayNotes, bank] = await Promise.all([listSchedule(), notes.list(), topics.list()]);
            setSnapshot(schedule);
            setNotesSnapshot(dayNotes);
            setTopicsSnapshot(bank);
        }
        catch (error) {
            console.error('[content-studio] calendar load failed:', error);
            setFailed(true);
        }
    }, [listSchedule, notes, topics]);
    useEffect(() => { void load(); }, [load]);
    // The first theme directory is the CSV export target; without one the
    // export button explains itself instead of failing at write time.
    useEffect(() => {
        let alive = true;
        listThemes().then((names) => {
            if (alive)
                setExportTheme(names[0] ?? null);
        }).catch(() => {
            // Theme listing failed: export stays disabled with its own hint.
        });
        return () => { alive = false; };
    }, [listThemes]);
    const patchConfig = (patch) => {
        setConfig((current) => {
            const next = { ...current, ...patch };
            try {
                localStorage.setItem(CONFIG_KEY, saveCalendarConfig(next));
            }
            catch {
                // Storage denied: the configuration stays session-local.
            }
            return next;
        });
    };
    const patchFilters = (patch) => {
        patchConfig({ filters: { ...config.filters, ...patch } });
    };
    const today = todayDate();
    const items = snapshot?.items ?? [];
    const filtered = useMemo(() => filterCalendarItems(items, config.filters, today), [items, config.filters, today]);
    const conflicts = useMemo(() => detectConflicts(items), [items]);
    const conflictItems = useMemo(() => items.filter(item => conflicts.has(item.id)), [items, conflicts]);
    const byDate = useMemo(() => groupByDate(filtered), [filtered]);
    const platforms = useMemo(() => [...new Set(items.map(item => item.platform).filter((platform) => platform !== null))].sort(), [items]);
    const detail = detailId === undefined ? undefined : items.find(item => item.id === detailId);
    /** Resolve the display title of an item's linked topic, or null. */
    const topicTitleOf = (item) => {
        const bank = topicsSnapshot?.items ?? [];
        const linked = (item.topic !== null ? bank.find(candidate => candidate.topicDir === item.topic) : undefined)
            ?? bank.find(candidate => candidate.scheduleItemId === item.id);
        return linked?.title ?? null;
    };
    const shift = (delta) => {
        if (config.view === 'week') {
            setWeekAnchor((current) => {
                const base = new Date(Number(current.slice(0, 4)), Number(current.slice(5, 7)) - 1, Number(current.slice(8, 10)));
                const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta * 7);
                return formatDate(day.getFullYear(), day.getMonth() + 1, day.getDate());
            });
            return;
        }
        setMonth((current) => {
            const zero = current.year * 12 + current.month - 1 + delta;
            return { year: Math.floor(zero / 12), month: ((zero % 12) + 12) % 12 + 1 };
        });
    };
    const goToday = () => {
        const now = new Date();
        setMonth({ year: now.getFullYear(), month: now.getMonth() + 1 });
        setWeekAnchor(todayDate());
    };
    const submit = async () => {
        if (form === undefined || form.title.trim().length === 0)
            return;
        setSubmitting(true);
        try {
            setSnapshot(await putSchedule({
                title: form.title,
                date: form.date,
                time: TIME_PATTERN.test(form.time) ? form.time : null,
                platform: form.platform.trim().length > 0 ? form.platform.trim() : null,
                status: 'scheduled',
                kind: form.kind,
                topic: form.topicDir.length > 0 ? form.topicDir : null,
                url: null,
            }));
            setForm(undefined);
        }
        catch (error) {
            console.error('[content-studio] contentSchedule failed:', error);
            showNotice(t('calendar.action.failed'), 'warn');
        }
        finally {
            setSubmitting(false);
        }
    };
    const markPublished = async (item) => {
        try {
            setSnapshot(await putSchedule({ ...item, status: 'published', url: item.url }));
        }
        catch (error) {
            console.error('[content-studio] contentSchedule failed:', error);
            showNotice(t('calendar.action.failed'), 'warn');
        }
    };
    /** Confirm, then move one item; the linked topic's plan date rides along. */
    const reschedule = async (item, date) => {
        if (date === item.date)
            return;
        if (!window.confirm(t('calendar.drag.confirm').replace('{from}', item.date).replace('{to}', date)))
            return;
        try {
            setSnapshot(await putSchedule({ ...item, date }));
        }
        catch (error) {
            console.error('[content-studio] contentSchedule failed:', error);
            showNotice(t('calendar.drag.failed'), 'warn');
            return;
        }
        const topic = topicsSnapshot?.items.find(candidate => candidate.scheduleItemId === item.id);
        if (topic === undefined || topic.planDate === date)
            return;
        try {
            setTopicsSnapshot(await topics.put(topicInputOf(topic, { planDate: date })));
        }
        catch (error) {
            console.error('[content-studio] contentTopics failed:', error);
            showNotice(t('calendar.drag.topicSyncFailed'), 'warn');
        }
    };
    /** Delete one schedule item; `content` items optionally clear the linked topic's plan date. */
    const removeItem = async (item, clearPlan) => {
        if (!window.confirm(t('calendar.delete.confirm')))
            return;
        try {
            setSnapshot(await removeSchedule(item.id));
            setDetailId(undefined);
            if (!clearPlan)
                return;
            const topic = topicsSnapshot?.items.find(candidate => candidate.scheduleItemId === item.id);
            if (topic !== undefined && topic.planDate !== null) {
                setTopicsSnapshot(await topics.put(topicInputOf(topic, { planDate: null })));
            }
        }
        catch (error) {
            console.error('[content-studio] contentSchedule failed:', error);
            showNotice(t('calendar.action.failed'), 'warn');
        }
    };
    const saveNote = async (id, text) => {
        try {
            setNotesSnapshot(await notes.put(id, text));
            showNotice(t('calendar.note.saved'), 'ok');
        }
        catch (error) {
            console.error('[content-studio] contentSchedule.putNote failed:', error);
            showNotice(t('calendar.action.failed'), 'warn');
        }
    };
    const batchPublish = async () => {
        const targets = filtered.filter(item => checked.has(item.id) && item.status !== 'published');
        try {
            let current = snapshot;
            for (const item of targets) {
                current = await putSchedule({ ...item, status: 'published', url: item.url });
            }
            if (current !== undefined)
                setSnapshot(current);
            setChecked(new Set());
            showNotice(t('calendar.batch.done'), 'ok');
        }
        catch (error) {
            console.error('[content-studio] contentSchedule failed:', error);
            showNotice(t('calendar.action.failed'), 'warn');
            void load();
        }
    };
    const batchRemove = async () => {
        if (!window.confirm(t('calendar.batchDelete.confirm')))
            return;
        try {
            let current = snapshot;
            for (const id of checked) {
                current = await removeSchedule(id);
            }
            if (current !== undefined)
                setSnapshot(current);
            setChecked(new Set());
            setDetailId(undefined);
            showNotice(t('calendar.batch.done'), 'ok');
        }
        catch (error) {
            console.error('[content-studio] contentSchedule failed:', error);
            showNotice(t('calendar.action.failed'), 'warn');
            void load();
        }
    };
    const exportCsv = async () => {
        if (exportTheme === null) {
            showNotice(t('calendar.export.none'), 'warn');
            return;
        }
        try {
            await writeExport(exportTheme, `calendar-export-${today.replaceAll('-', '')}.csv`, calendarEventsToCsv(filtered, notesSnapshot?.notes ?? {}));
            showNotice(t('calendar.export.done').replace('{theme}', exportTheme), 'ok');
        }
        catch (error) {
            console.error('[content-studio] calendar export failed:', error);
            showNotice(t('calendar.export.failed'), 'warn');
        }
    };
    const toggleInList = (list, value) => list.includes(value) ? list.filter(entry => entry !== value) : [...list, value];
    /** One day cell: the drop target plus its chips and the inline add form. */
    const renderCell = (day) => {
        const cellItems = byDate.get(day.date) ?? [];
        return (_jsxs("div", { className: clsx(css.calendarCell, !day.inMonth && css.calendarCellOutside, day.isToday && css.calendarCellToday), role: "button", tabIndex: 0, "aria-label": day.date, onDragOver: (event) => {
                if (dragId !== undefined)
                    event.preventDefault();
            }, onDrop: (event) => {
                event.preventDefault();
                const dropped = dragId;
                setDragId(undefined);
                const item = dropped === undefined ? undefined : items.find(candidate => candidate.id === dropped);
                if (item !== undefined)
                    void reschedule(item, day.date);
            }, onClick: () => { setForm(form?.date === day.date ? undefined : newForm(day.date)); }, onKeyDown: (event) => { if (event.key === 'Enter')
                setForm(form?.date === day.date ? undefined : newForm(day.date)); }, children: [_jsx("span", { className: css.calendarDayNum, children: Number(day.date.slice(8, 10)) }), cellItems.map(item => (_jsxs("span", { draggable: true, onDragStart: () => { setDragId(item.id); }, onDragEnd: () => { setDragId(undefined); }, className: clsx(css.calendarChip, dragId === item.id && cal.chipDragging, conflicts.has(item.id) && cal.chipConflict, overdueOf(item, today) && cal.chipOverdue), role: "button", tabIndex: 0, title: conflicts.has(item.id) ? t('calendar.conflict.hint') : undefined, onClick: (event) => { event.stopPropagation(); setDetailId(item.id); }, onKeyDown: (event) => { if (event.key === 'Enter') {
                        event.stopPropagation();
                        setDetailId(item.id);
                    } }, children: [_jsx("span", { className: clsx(css.calendarDot, DOT_CLASS[item.status]), "aria-hidden": "true" }), _jsx("span", { className: cal.chipKind, "aria-hidden": "true", children: item.kind === 'content' ? '📄' : '📌' }), _jsxs("span", { className: css.calendarChipTitle, children: [item.time !== null && `${item.time} `, item.title] }), item.status !== 'published' && (_jsx("button", { type: "button", className: css.calendarChipAction, "aria-label": t('calendar.publish.aria'), title: t('calendar.publish'), onClick: (event) => { event.stopPropagation(); void markPublished(item); }, children: "\u2713" })), _jsx("button", { type: "button", className: css.calendarChipAction, "aria-label": t('calendar.remove.aria'), onClick: (event) => { event.stopPropagation(); void removeItem(item, false); }, children: _jsx(IconTrashOutline16, { size: 11 }) })] }, item.id))), form?.date === day.date && (_jsxs("div", { className: css.calendarForm, onClick: (event) => { event.stopPropagation(); }, children: [_jsx("input", { className: css.calendarInput, autoFocus: true, placeholder: t('calendar.titlePlaceholder'), value: form.title, onChange: (event) => { setForm({ ...form, title: event.currentTarget.value }); }, onKeyDown: (event) => { if (event.key === 'Enter')
                                void submit(); } }), _jsxs("div", { className: cal.formRow, children: [_jsxs("select", { className: cal.formSelect, "aria-label": t('calendar.filter.kind'), value: form.kind, onChange: (event) => { setForm({ ...form, kind: event.currentTarget.value }); }, children: [_jsx("option", { value: "event", children: t('calendar.kind.event') }), _jsx("option", { value: "content", children: t('calendar.kind.content') })] }), _jsx("input", { className: css.calendarInput, placeholder: t('calendar.timePlaceholder'), value: form.time, onChange: (event) => { setForm({ ...form, time: event.currentTarget.value }); } })] }), _jsxs("div", { className: cal.formRow, children: [_jsx("input", { className: css.calendarInput, placeholder: t('calendar.platformPlaceholder'), value: form.platform, onChange: (event) => { setForm({ ...form, platform: event.currentTarget.value }); } }), _jsxs("select", { className: cal.formSelect, "aria-label": t('calendar.detail.topic'), value: form.topicDir, onChange: (event) => { setForm({ ...form, topicDir: event.currentTarget.value }); }, children: [_jsx("option", { value: "", children: t('calendar.topicPlaceholder') }), (topicsSnapshot?.items ?? []).filter(candidate => candidate.topicDir !== null).map(candidate => (_jsx("option", { value: candidate.topicDir ?? '', children: candidate.title }, candidate.id)))] })] }), _jsxs("div", { className: css.calendarFormRow, children: [_jsxs("button", { type: "button", className: css.calendarSubmit, disabled: submitting, onClick: () => { void submit(); }, children: [_jsx(IconPlusOutline16, { size: 12 }), t('calendar.add')] }), _jsx("button", { type: "button", className: css.calendarChipAction, "aria-label": t('calendar.cancel'), onClick: () => { setForm(undefined); }, children: t('calendar.cancel') })] })] }))] }, day.date));
    };
    if (failed) {
        return _jsx("div", { className: css.libraryState, children: t('library.error') });
    }
    if (snapshot === undefined || notesSnapshot === undefined) {
        return _jsx("div", { className: css.libraryState, children: t('calendar.loading') });
    }
    const grid = config.view === 'week' ? [weekGrid(weekAnchor)] : monthGrid(month.year, month.month);
    const weekRow = grid[0] ?? [];
    const periodLabel = config.view === 'week'
        ? `${weekRow[0]?.date ?? ''} ~ ${weekRow.at(-1)?.date ?? ''}`
        : `${month.year} · ${t(`calendar.month.${month.month}`)}`;
    const filters = config.filters;
    return (_jsxs("div", { className: css.calendar, children: [_jsxs("div", { className: cal.toolbar, children: [_jsxs("div", { className: css.calendarBar, children: [config.view !== 'list' && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: css.calendarNav, "aria-label": config.view === 'week' ? t('calendar.prevWeek') : t('calendar.prev'), onClick: () => { shift(-1); }, children: "\u2039" }), _jsx("span", { className: css.calendarMonth, children: periodLabel }), _jsx("button", { type: "button", className: css.calendarNav, "aria-label": config.view === 'week' ? t('calendar.nextWeek') : t('calendar.next'), onClick: () => { shift(1); }, children: "\u203A" })] })), _jsx("button", { type: "button", className: css.calendarToday, onClick: () => { goToday(); }, children: t('calendar.today') })] }), _jsx("div", { className: cal.tabs, role: "tablist", children: ['month', 'week', 'list'].map(kind => (_jsx("button", { type: "button", role: "tab", "aria-selected": config.view === kind, className: clsx(cal.tab, config.view === kind && cal.tabActive), onClick: () => { patchConfig({ view: kind }); }, children: t(VIEW_KEYS[kind]) }, kind))) }), _jsxs("div", { className: cal.toolbarActions, children: [_jsx("button", { type: "button", className: cal.toolButton, disabled: exportTheme === null, title: exportTheme === null ? t('calendar.export.none') : undefined, onClick: () => { void exportCsv(); }, children: t('calendar.export') }), _jsx("button", { type: "button", className: cal.toolButton, disabled: true, title: t('calendar.ai.hint'), children: t('calendar.ai') })] })] }), _jsxs("div", { className: cal.filters, children: [_jsxs("select", { className: cal.formSelect, "aria-label": t('calendar.filter.kind'), value: filters.kind, onChange: (event) => { patchFilters({ kind: event.currentTarget.value }); }, children: [_jsx("option", { value: "all", children: t('calendar.kind.all') }), _jsx("option", { value: "content", children: t('calendar.kind.content') }), _jsx("option", { value: "event", children: t('calendar.kind.event') })] }), platforms.map(platform => (_jsx("button", { type: "button", className: clsx(cal.chip, filters.platforms.includes(platform) && cal.chipActive), onClick: () => { patchFilters({ platforms: toggleInList(filters.platforms, platform) }); }, children: platform }, platform))), STATUS_KEYS.map(status => (_jsxs("button", { type: "button", className: clsx(cal.chip, filters.statuses.includes(status) && cal.chipActive), onClick: () => { patchFilters({ statuses: toggleInList(filters.statuses, status) }); }, children: [_jsx("span", { className: clsx(css.calendarDot, DOT_CLASS[status]), "aria-hidden": "true" }), t(`calendar.status.${status}`)] }, status))), _jsx("input", { type: "date", className: cal.formSelect, "aria-label": t('calendar.filter.range'), value: filters.start ?? '', onChange: (event) => { patchFilters({ start: event.currentTarget.value === '' ? null : event.currentTarget.value }); } }), _jsx("input", { type: "date", className: cal.formSelect, "aria-label": t('calendar.filter.range'), value: filters.end ?? '', onChange: (event) => { patchFilters({ end: event.currentTarget.value === '' ? null : event.currentTarget.value }); } }), _jsx("input", { type: "search", className: cal.formSelect, "aria-label": t('calendar.filter.query.aria'), placeholder: t('calendar.filter.query.aria'), value: filters.query, onChange: (event) => { patchFilters({ query: event.currentTarget.value }); } }), _jsx("button", { type: "button", className: clsx(cal.chip, filters.overdueOnly && cal.chipOverdueActive), onClick: () => { patchFilters({ overdueOnly: !filters.overdueOnly }); }, children: t('calendar.filter.overdue') }), (filters.kind !== 'all' || filters.platforms.length > 0 || filters.statuses.length > 0
                        || filters.start !== null || filters.end !== null || filters.query !== '' || filters.overdueOnly) && (_jsx("button", { type: "button", className: cal.chip, onClick: () => { patchFilters({ ...DEFAULT_CALENDAR_FILTERS }); }, children: t('calendar.filters.clear') }))] }), conflictItems.length > 0 && (_jsxs("div", { className: cal.conflicts, role: "status", children: [_jsx(IconWarningOutline16, { size: 14 }), _jsxs("span", { children: [t('calendar.conflicts'), "\uFF08", conflictItems.length, "\uFF09"] }), conflictItems.map(item => (_jsxs("button", { type: "button", className: cal.chip, onClick: () => { setDetailId(item.id); }, children: [item.date, " ", item.time !== null && `${item.time} `, item.title] }, item.id)))] })), config.view === 'list' ? (_jsxs("div", { className: cal.listWrap, children: [_jsxs("div", { className: cal.listHead, children: [_jsx("label", { className: cal.listCheck, children: _jsx("input", { type: "checkbox", "aria-label": t('calendar.list.all'), checked: filtered.length > 0 && filtered.every(item => checked.has(item.id)), onChange: (event) => {
                                        setChecked(event.currentTarget.checked ? new Set(filtered.map(item => item.id)) : new Set());
                                    } }) }), _jsx("span", { children: t('calendar.detail.date') }), _jsx("span", { children: t('calendar.detail.time') }), _jsx("span", { children: t('calendar.filter.kind') }), _jsx("span", { children: t('calendar.filter.status') }), _jsx("span", { children: t('calendar.list.title') }), _jsx("span", { children: t('calendar.detail.platform') }), _jsx("span", { children: t('calendar.detail.topic') })] }), filtered.map((item) => {
                        const topicTitle = topicTitleOf(item);
                        return (_jsxs("div", { className: clsx(cal.listRow, detailId === item.id && cal.listRowActive), role: "button", tabIndex: 0, onClick: () => { setDetailId(item.id); }, onKeyDown: (event) => { if (event.key === 'Enter')
                                setDetailId(item.id); }, children: [_jsx("label", { className: cal.listCheck, onClick: (event) => { event.stopPropagation(); }, children: _jsx("input", { type: "checkbox", checked: checked.has(item.id), onChange: (event) => {
                                            const next = new Set(checked);
                                            if (event.currentTarget.checked)
                                                next.add(item.id);
                                            else
                                                next.delete(item.id);
                                            setChecked(next);
                                        } }) }), _jsx("span", { children: overdueOf(item, today) ? `${item.date} · ${t('calendar.overdue')}` : item.date }), _jsx("span", { children: item.time ?? '' }), _jsx("span", { children: item.kind === 'content' ? t('calendar.kind.content') : t('calendar.kind.event') }), _jsxs("span", { className: cal.listStatus, children: [_jsx("span", { className: clsx(css.calendarDot, DOT_CLASS[item.status]), "aria-hidden": "true" }), t(`calendar.status.${item.status}`)] }), _jsx("span", { className: cal.listTitle, children: item.title }), _jsx("span", { children: item.platform ?? '' }), _jsx("span", { children: topicTitle ?? item.topic ?? '' })] }, item.id));
                    }), filtered.length === 0 && _jsx("div", { className: css.calendarHint, children: t('calendar.empty') }), checked.size > 0 && (_jsxs("div", { className: cal.batchBar, children: [_jsx("button", { type: "button", className: cal.toolButton, onClick: () => { void batchPublish(); }, children: t('calendar.batch.publish') }), _jsx("button", { type: "button", className: cal.toolButtonDanger, onClick: () => { void batchRemove(); }, children: t('calendar.batch.remove') })] }))] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: css.calendarHead, children: WEEKDAY_KEYS.map(key => _jsx("span", { className: css.calendarWeekday, children: t(key) }, key)) }), _jsx("div", { className: clsx(css.calendarGrid, config.view === 'week' && cal.weekGrid), children: grid.flat().map(renderCell) }), form === undefined && items.length === 0 && (_jsx("div", { className: css.calendarHint, children: t('calendar.empty') }))] })), detail !== undefined && (_jsxs("section", { className: cal.detail, "aria-label": t('calendar.detail.title'), children: [_jsxs("div", { className: cal.detailHead, children: [_jsx("strong", { children: detail.title }), _jsx("button", { type: "button", className: css.calendarChipAction, "aria-label": t('calendar.cancel'), onClick: () => { setDetailId(undefined); }, children: "\u00D7" })] }), _jsxs("dl", { className: cal.detailGrid, children: [_jsx("dt", { children: t('calendar.detail.date') }), _jsxs("dd", { children: [detail.date, overdueOf(detail, today) ? ` · ${t('calendar.overdue')}` : ''] }), _jsx("dt", { children: t('calendar.detail.time') }), _jsx("dd", { children: detail.time ?? '—' }), _jsx("dt", { children: t('calendar.filter.kind') }), _jsx("dd", { children: detail.kind === 'content' ? t('calendar.kind.content') : t('calendar.kind.event') }), _jsx("dt", { children: t('calendar.filter.status') }), _jsxs("dd", { className: cal.listStatus, children: [_jsx("span", { className: clsx(css.calendarDot, DOT_CLASS[detail.status]), "aria-hidden": "true" }), t(`calendar.status.${detail.status}`)] }), _jsx("dt", { children: t('calendar.detail.platform') }), _jsx("dd", { children: detail.platform ?? '—' }), _jsx("dt", { children: t('calendar.detail.topic') }), _jsx("dd", { children: topicTitleOf(detail) ?? detail.topic ?? '—' })] }), _jsx(NoteEditor, { initial: notesSnapshot.notes[detail.id]?.text ?? '', onSave: text => saveNote(detail.id, text), t: t }, detail.id), _jsxs("div", { className: cal.detailActions, children: [detail.status !== 'published' && (_jsx("button", { type: "button", className: cal.toolButton, onClick: () => { void markPublished(detail); }, children: t('calendar.publish') })), _jsx("button", { type: "button", className: cal.toolButton, onClick: () => { onNavigate('topicBank'); }, children: t('calendar.jump.topicBank') }), _jsxs("button", { type: "button", className: cal.toolButtonDanger, onClick: () => { void removeItem(detail, false); }, children: [_jsx(IconTrashOutline16, { size: 12 }), t('calendar.delete')] }), detail.kind === 'content' && (_jsx("button", { type: "button", className: cal.toolButtonDanger, onClick: () => { void removeItem(detail, true); }, children: t('calendar.delete.clearPlan') }))] })] })), notice !== undefined && (_jsx("div", { className: clsx(cal.toast, notice.tone === 'warn' && cal.toastWarn), role: "status", children: notice.text }))] }));
}
/**
 * Render the note draft editor; the draft resets per item through the key.
 * @param props - the stored text, the save callback, and the locale seat.
 * @returns the note editor element tree.
 */
function NoteEditor({ initial, onSave, t }) {
    const [draft, setDraft] = useState(initial);
    const [saving, setSaving] = useState(false);
    return (_jsxs("div", { className: cal.noteArea, children: [_jsx("textarea", { className: cal.noteInput, rows: 3, placeholder: t('calendar.note.placeholder'), value: draft, onChange: (event) => { setDraft(event.currentTarget.value); } }), _jsx("button", { type: "button", className: cal.toolButton, disabled: saving || draft.trim() === initial.trim(), onClick: () => {
                    void (async () => {
                        setSaving(true);
                        try {
                            await onSave(draft);
                        }
                        finally {
                            setSaving(false);
                        }
                    })();
                }, children: t('calendar.note.save') })] }));
}
//# sourceMappingURL=ContentCalendar.js.map