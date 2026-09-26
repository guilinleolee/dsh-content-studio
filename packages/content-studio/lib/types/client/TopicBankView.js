import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The topic-bank view: the whole `_topics.json` bank in two faces — the P0
 * table (title, source with its provenance entry, score, tags, status,
 * plan date, update time) and the P1 five-column kanban with native HTML5
 * drag-and-drop status moves — over the reusable SplitDetail layout, with
 * the detail side panel, create/edit forms, batch actions, schedule
 * linkage, and Markdown export. Loading, error, and empty are first-class
 * states; an empty bank renders the guide page carrying the two capability
 * cards inherited from the retired 选题规划 view. Filter and view
 * configuration persists to localStorage under the feature prefix and
 * reloads through the versioned migration (unknown shapes fall back whole).
 */
import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { IconRefreshOutline14, IconWarningOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import { CapabilityPage } from "./CapabilityPage.js";
import { SplitDetail } from "./SplitDetail.js";
import { todayDate } from "./calendar.js";
import { TOPIC_SOURCE_TYPES, TOPIC_STATUSES, collectTags, filterTopics, formatScore, groupByStatus, loadTopicBankConfig, manualTopicInput, saveTopicBankConfig, topicInputOf, topicsToMarkdown, withAppendedTags, } from "./topic-bank.js";
import css from './ContentStudio.module.css';
import tb from './TopicBankView.module.css';
/** localStorage key of the view/filter configuration (feature-prefixed). */
const CONFIG_KEY = 'dsh-content-studio.topicBank.config';
/** How long a toast stays visible before clearing itself. */
const NOTICE_MS = 3000;
/** One collision-resistant schedule id, matching the gather id scheme: the
 * calendar store accepts any non-empty id, and supplying one lets the topic
 * bank remember the linkage without scanning the returned snapshot. */
function newScheduleId() {
    return `sched${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
/** Draft of an edit form, prefilled from one stored topic. */
function editFormOf(item) {
    return {
        mode: 'edit',
        id: item.id,
        title: item.title,
        oneLiner: item.oneLiner ?? '',
        status: item.status,
        tagsText: item.tags.join(', '),
        description: item.description ?? '',
        sourceUrl: item.source.url ?? '',
        planDate: item.planDate ?? '',
        scoreText: item.score === null ? '' : formatScore(item.score.total),
    };
}
/** Blank-string-to-null for the form's optional fields. */
function orNull(value) {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
}
/** Split a comma-separated field into trimmed, non-empty tags. */
function parseTagsText(value) {
    return value.split(/[,，]/).map(tag => tag.trim()).filter(tag => tag.length > 0);
}
/**
 * Render the topic-bank view.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export function TopicBankView({ topics, schedule, onStartCreate, writeExport, listThemes, copiedCapabilityId, pickCapability, t, }) {
    const [snapshot, setSnapshot] = useState(undefined);
    const [failed, setFailed] = useState(undefined);
    const [config, setConfig] = useState(() => loadTopicBankConfig(localStorage.getItem(CONFIG_KEY)));
    const [selectedId, setSelectedId] = useState(null);
    const [form, setForm] = useState(null);
    const [formError, setFormError] = useState(null);
    const [confirming, setConfirming] = useState(false);
    const [alsoRemoveSchedule, setAlsoRemoveSchedule] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const [batchStatus, setBatchStatus] = useState('todo');
    const [batchTagsText, setBatchTagsText] = useState('');
    const [themes, setThemes] = useState([]);
    const [exportTheme, setExportTheme] = useState(null);
    const [notice, setNotice] = useState(null);
    const [dragOver, setDragOver] = useState(null);
    const draggingRef = useRef(null);
    const load = async () => {
        setFailed(undefined);
        setSnapshot(undefined);
        try {
            setSnapshot(await topics.list());
        }
        catch (error) {
            console.error('[content-studio] contentTopics/list failed:', error);
            setFailed(error instanceof Error ? error.message : String(error));
        }
    };
    useEffect(() => { void load(); }, [topics]);
    useEffect(() => {
        let alive = true;
        listThemes().then((names) => {
            if (alive)
                setThemes(names);
        }).catch(() => {
            if (alive)
                setThemes([]);
        });
        return () => { alive = false; };
    }, [listThemes]);
    useEffect(() => {
        if (notice === null)
            return;
        const timer = window.setTimeout(() => { setNotice(null); }, NOTICE_MS);
        return () => { window.clearTimeout(timer); };
    }, [notice]);
    const toast = (message) => { setNotice(message); };
    const patchConfig = (patch) => {
        setConfig((current) => {
            const next = { ...current, ...patch };
            localStorage.setItem(CONFIG_KEY, saveTopicBankConfig(next));
            return next;
        });
    };
    const patchFilters = (patch) => {
        patchConfig({ filters: { ...config.filters, ...patch } });
    };
    const today = todayDate();
    const items = snapshot?.items ?? [];
    const visible = snapshot === undefined ? [] : filterTopics(snapshot.items, config.filters, today);
    const tags = collectTags(items);
    const selected = items.find(item => item.id === selectedId);
    const exportTarget = exportTheme ?? themes[0] ?? null;
    const checkedIds = selectedIds.filter(id => items.some(item => item.id === id));
    const patchForm = (patch) => {
        setForm(current => current === null ? current : { ...current, ...patch });
    };
    const openCreate = () => {
        setFormError(null);
        setForm({ mode: 'create', id: null, title: '', oneLiner: '', status: 'idea', tagsText: '', description: '', sourceUrl: '', planDate: '', scoreText: '' });
    };
    const submitCreate = async () => {
        if (form === null)
            return;
        const title = form.title.trim();
        if (title.length === 0) {
            setFormError(t('topicBank.error.titleRequired'));
            return;
        }
        try {
            const next = await topics.put(manualTopicInput(title));
            setSnapshot(next);
            setForm(null);
            toast(t('topicBank.notice.created'));
        }
        catch (error) {
            toast(t('topicBank.notice.failed', { detail: error instanceof Error ? error.message : String(error) }));
        }
    };
    /** Save the edit form, including the one-way plan-date → calendar linkage. */
    const submitEdit = async () => {
        if (form === null || form.id === null)
            return;
        const item = items.find(candidate => candidate.id === form.id);
        if (item === undefined)
            return;
        const title = form.title.trim();
        if (title.length === 0) {
            setFormError(t('topicBank.error.titleRequired'));
            return;
        }
        const scoreText = form.scoreText.trim();
        let score = item.score;
        if (scoreText.length === 0)
            score = null;
        else {
            const total = Number(scoreText);
            if (!Number.isFinite(total) || total < 0 || total > 10) {
                setFormError(t('topicBank.error.scoreRange'));
                return;
            }
            score = { total, source: 'manual', factors: null, evaluatedAt: new Date().toISOString() };
        }
        const planDate = orNull(form.planDate);
        let scheduleItemId = item.scheduleItemId;
        if (planDate !== null && planDate !== item.planDate) {
            // One-way linkage: the calendar entry is created (or its date moves)
            // through the schedule gateway only; the topic side just remembers the
            // id. No status sync runs in either direction.
            const scheduleId = (item.scheduleItemId ?? newScheduleId());
            try {
                await schedule.put({
                    id: scheduleId,
                    title,
                    date: planDate,
                    time: null,
                    platform: null,
                    status: 'idea',
                    kind: 'content',
                    topic: item.topicDir,
                    url: null,
                });
                scheduleItemId = scheduleId;
            }
            catch (error) {
                toast(t('topicBank.notice.failed', { detail: error instanceof Error ? error.message : String(error) }));
                return;
            }
        }
        try {
            const next = await topics.put(topicInputOf(item, {
                title,
                oneLiner: orNull(form.oneLiner),
                status: form.status,
                tags: parseTagsText(form.tagsText),
                description: orNull(form.description),
                source: { ...item.source, url: orNull(form.sourceUrl) },
                score,
                planDate,
                scheduleItemId,
            }));
            setSnapshot(next);
            setForm(null);
            toast(t('topicBank.notice.saved'));
        }
        catch (error) {
            toast(t('topicBank.notice.failed', { detail: error instanceof Error ? error.message : String(error) }));
        }
    };
    /** Delete the selected topic, cascading to its calendar entry only when
     * the confirm checkbox says so. */
    const performDelete = async () => {
        if (selected === undefined)
            return;
        try {
            if (alsoRemoveSchedule && selected.scheduleItemId !== null) {
                await schedule.remove(selected.scheduleItemId);
            }
            const next = await topics.remove(selected.id);
            setSnapshot(next);
            setSelectedId(null);
            setConfirming(false);
            toast(t('topicBank.notice.deleted'));
        }
        catch (error) {
            toast(t('topicBank.notice.failed', { detail: error instanceof Error ? error.message : String(error) }));
        }
    };
    /** Move one kanban card across columns: optimistic status flip, then the
     * Remote put; a failed write rolls the UI back and toasts. */
    const dropTo = async (status) => {
        setDragOver(null);
        const id = draggingRef.current;
        draggingRef.current = null;
        if (id === null || snapshot === undefined)
            return;
        const item = snapshot.items.find(candidate => candidate.id === id);
        if (item === undefined || item.status === status)
            return;
        setSnapshot({ ...snapshot, items: snapshot.items.map(candidate => candidate.id === id ? { ...candidate, status } : candidate) });
        try {
            setSnapshot(await topics.put(topicInputOf(item, { status })));
        }
        catch (error) {
            setSnapshot(snapshot);
            toast(t('topicBank.notice.failed', { detail: error instanceof Error ? error.message : String(error) }));
        }
    };
    /** Run one batch edit over every checked topic, sequentially — the
     * gateway serializes on the file lock, and one failure stops the run. */
    const runBatch = async (build) => {
        const targets = items.filter(item => checkedIds.includes(item.id));
        let last;
        try {
            for (const item of targets)
                last = await topics.put(build(item));
        }
        catch (error) {
            toast(t('topicBank.notice.failed', { detail: error instanceof Error ? error.message : String(error) }));
            return;
        }
        if (last !== undefined)
            setSnapshot(last);
        setSelectedIds([]);
        toast(t('topicBank.notice.batchDone'));
    };
    const applyBatchTags = async () => {
        const appended = parseTagsText(batchTagsText);
        if (appended.length === 0)
            return;
        await runBatch(item => withAppendedTags(item, appended));
    };
    /** Export topics as one Markdown document into the selected theme's assets. */
    const doExport = async (exportItems) => {
        if (exportTarget === null)
            return;
        const file = `topics-${today}.md`;
        try {
            await writeExport(exportTarget, file, topicsToMarkdown(exportItems));
            toast(t('topicBank.notice.exported', { file }));
        }
        catch (error) {
            toast(t('topicBank.notice.failed', { detail: error instanceof Error ? error.message : String(error) }));
        }
    };
    const toggleChecked = (id) => {
        setSelectedIds(current => current.includes(id) ? current.filter(candidate => candidate !== id) : [...current, id]);
    };
    const selectItem = (id) => {
        setSelectedId(id);
        setConfirming(false);
    };
    const createForm = form !== null && form.mode === 'create' && (_jsx("div", { className: clsx(tb.detail, tb.formPanel), children: _jsxs("div", { className: tb.form, children: [_jsx("label", { className: tb.fieldLabel, htmlFor: "topic-bank-create-title", children: t('topicBank.field.title') }), _jsx("input", { id: "topic-bank-create-title", className: tb.formInput, value: form.title, placeholder: t('topicBank.field.titlePlaceholder'), onChange: (event) => { patchForm({ title: event.target.value }); } }), formError !== null && _jsx("p", { className: tb.formError, children: formError }), _jsxs("div", { className: tb.formRow, children: [_jsx("button", { type: "button", className: tb.primary, onClick: () => { void submitCreate(); }, children: t('topicBank.save') }), _jsx("button", { type: "button", className: tb.btn, onClick: () => { setForm(null); }, children: t('topicBank.cancel') })] })] }) }));
    if (failed !== undefined) {
        return (_jsxs("div", { className: css.libraryState, children: [_jsx(IconWarningOutline16, { size: 16 }), _jsxs("span", { children: [t('topicBank.error'), ": ", failed] }), _jsxs("button", { type: "button", className: css.retry, onClick: () => { void load(); }, children: [_jsx(IconRefreshOutline14, { size: 14 }), t('library.retry')] })] }));
    }
    if (snapshot === undefined) {
        return _jsx("div", { className: css.libraryState, children: t('topicBank.loading') });
    }
    if (items.length === 0) {
        return (_jsxs("div", { children: [createForm, _jsx("div", { className: css.libraryState, children: t('topicBank.guide.hint') }), _jsx("div", { className: tb.guideActions, children: _jsx("button", { type: "button", className: tb.primary, onClick: openCreate, children: t('topicBank.new') }) }), _jsx(CapabilityPage, { title: t('topicBank.title'), ids: ['hotspot', 'calendar-plan'], copiedId: copiedCapabilityId, pick: pickCapability, t: t })] }));
    }
    const editForm = form !== null && form.mode === 'edit' && (_jsxs("div", { className: tb.form, "aria-label": t('topicBank.edit'), children: [_jsxs("div", { className: tb.formRow, children: [_jsx("button", { type: "button", className: tb.primary, onClick: () => { void submitEdit(); }, children: t('topicBank.save') }), _jsx("button", { type: "button", className: tb.btn, onClick: () => { setForm(null); }, children: t('topicBank.cancel') })] }), _jsx("label", { className: tb.fieldLabel, htmlFor: "topic-bank-title", children: t('topicBank.field.title') }), _jsx("input", { id: "topic-bank-title", className: tb.formInput, value: form.title, onChange: (event) => { patchForm({ title: event.target.value }); } }), _jsx("label", { className: tb.fieldLabel, htmlFor: "topic-bank-oneliner", children: t('topicBank.field.oneLiner') }), _jsx("input", { id: "topic-bank-oneliner", className: tb.formInput, value: form.oneLiner, onChange: (event) => { patchForm({ oneLiner: event.target.value }); } }), _jsxs("div", { className: tb.formRow, children: [_jsx("label", { className: tb.fieldLabel, htmlFor: "topic-bank-status", children: t('topicBank.field.status') }), _jsx("select", { id: "topic-bank-status", className: tb.formInput, value: form.status, onChange: (event) => { patchForm({ status: event.target.value }); }, children: TOPIC_STATUSES.map(status => _jsx("option", { value: status, children: t(`topic.status.${status}`) }, status)) }), _jsx("label", { className: tb.fieldLabel, htmlFor: "topic-bank-plan", children: t('topicBank.field.planDate') }), _jsx("input", { id: "topic-bank-plan", className: tb.formInput, type: "date", value: form.planDate, onChange: (event) => { patchForm({ planDate: event.target.value }); } })] }), _jsx("label", { className: tb.fieldLabel, htmlFor: "topic-bank-tags", children: t('topicBank.field.tags') }), _jsx("input", { id: "topic-bank-tags", className: tb.formInput, value: form.tagsText, placeholder: t('topicBank.field.tagsPlaceholder'), onChange: (event) => { patchForm({ tagsText: event.target.value }); } }), _jsx("label", { className: tb.fieldLabel, htmlFor: "topic-bank-url", children: t('topicBank.field.sourceUrl') }), _jsx("input", { id: "topic-bank-url", className: tb.formInput, value: form.sourceUrl, placeholder: t('topicBank.field.sourceUrlPlaceholder'), onChange: (event) => { patchForm({ sourceUrl: event.target.value }); } }), _jsx("label", { className: tb.fieldLabel, htmlFor: "topic-bank-score", children: t('topicBank.field.score') }), _jsx("input", { id: "topic-bank-score", className: tb.formInput, type: "number", min: 0, max: 10, step: 0.5, value: form.scoreText, placeholder: t('topicBank.field.scorePlaceholder'), onChange: (event) => { patchForm({ scoreText: event.target.value }); } }), _jsx("label", { className: tb.fieldLabel, htmlFor: "topic-bank-description", children: t('topicBank.field.description') }), _jsx("textarea", { id: "topic-bank-description", className: clsx(tb.formInput, tb.formTextarea), value: form.description, placeholder: t('topicBank.field.descriptionPlaceholder'), onChange: (event) => { patchForm({ description: event.target.value }); } }), formError !== null && _jsx("p", { className: tb.formError, children: formError })] }));
    return (_jsxs("div", { children: [_jsxs("header", { className: tb.head, children: [_jsxs("div", { children: [_jsx("h2", { className: css.pageTitle, children: t('topicBank.title') }), _jsx("span", { className: css.subtitle, children: t('topicBank.subtitle') })] }), _jsx("button", { type: "button", className: tb.primary, onClick: openCreate, children: t('topicBank.new') })] }), _jsxs("div", { className: tb.toolbar, children: [_jsxs("select", { "aria-label": t('topicBank.view.aria'), className: tb.control, value: config.view, onChange: (event) => { patchConfig({ view: event.target.value }); }, children: [_jsx("option", { value: "table", children: t('topicBank.view.table') }), _jsx("option", { value: "kanban", children: t('topicBank.view.kanban') })] }), _jsxs("select", { "aria-label": t('topicBank.filter.source'), className: tb.control, value: config.filters.source, onChange: (event) => { patchFilters({ source: event.target.value }); }, children: [_jsx("option", { value: "all", children: t('topicBank.filter.all') }), TOPIC_SOURCE_TYPES.map(source => _jsx("option", { value: source, children: t(`topic.source.${source}`) }, source))] }), _jsxs("select", { "aria-label": t('topicBank.filter.status'), className: tb.control, value: config.filters.status, onChange: (event) => { patchFilters({ status: event.target.value }); }, children: [_jsx("option", { value: "all", children: t('topicBank.filter.all') }), TOPIC_STATUSES.map(status => _jsx("option", { value: status, children: t(`topic.status.${status}`) }, status))] }), _jsxs("select", { "aria-label": t('topicBank.filter.plan'), className: tb.control, value: config.filters.planWindow, onChange: (event) => { patchFilters({ planWindow: event.target.value }); }, children: [_jsx("option", { value: "all", children: t('topicBank.plan.all') }), _jsx("option", { value: "week", children: t('topicBank.plan.week') }), _jsx("option", { value: "month", children: t('topicBank.plan.month') })] }), _jsxs("select", { "aria-label": t('topicBank.filter.tag'), className: tb.control, value: config.filters.tag ?? '', onChange: (event) => { patchFilters({ tag: event.target.value === '' ? null : event.target.value }); }, children: [_jsx("option", { value: "", children: t('topicBank.filter.allTags') }), tags.map(tag => _jsx("option", { value: tag, children: tag }, tag))] }), _jsxs("label", { className: tb.toolbarGroup, children: [_jsx("span", { className: tb.controlLabel, children: t('topicBank.filter.score') }), _jsx("input", { "aria-label": t('topicBank.filter.scoreMin'), className: clsx(tb.control, tb.scoreInput), type: "number", min: 0, max: 10, value: config.filters.scoreMin, onChange: (event) => { patchFilters({ scoreMin: Number(event.target.value) }); } }), _jsx("span", { className: tb.controlLabel, children: "\u2013" }), _jsx("input", { "aria-label": t('topicBank.filter.scoreMax'), className: clsx(tb.control, tb.scoreInput), type: "number", min: 0, max: 10, value: config.filters.scoreMax, onChange: (event) => { patchFilters({ scoreMax: Number(event.target.value) }); } })] }), _jsx("input", { "aria-label": t('topicBank.filter.search'), className: clsx(tb.control, tb.search), value: config.filters.search, placeholder: t('topicBank.filter.search'), onChange: (event) => { patchFilters({ search: event.target.value }); } }), _jsx("span", { className: tb.count, children: t('topicBank.count', { n: visible.length }) })] }), _jsxs("div", { className: tb.toolbar, children: [_jsxs("label", { className: tb.toolbarGroup, children: [_jsx("span", { className: tb.controlLabel, children: t('topicBank.export.theme') }), _jsxs("select", { "aria-label": t('topicBank.export.theme'), className: tb.control, value: exportTarget ?? '', onChange: (event) => { setExportTheme(event.target.value); }, children: [themes.length === 0 && _jsx("option", { value: "", children: t('topicBank.export.noTheme') }), themes.map(theme => _jsx("option", { value: theme, children: theme }, theme))] })] }), _jsx("button", { type: "button", className: tb.btn, disabled: exportTarget === null || visible.length === 0, title: exportTarget === null ? t('topicBank.export.noTheme') : undefined, onClick: () => { void doExport(visible); }, children: t('topicBank.export.button') })] }), notice !== null && (_jsx("button", { type: "button", className: tb.notice, role: "status", onClick: () => { setNotice(null); }, children: notice })), snapshot.problems.length > 0 && (_jsxs("div", { className: css.libraryProblems, role: "alert", children: [_jsx(IconWarningOutline16, { size: 14 }), _jsx("span", { children: t('topicBank.problems', { n: snapshot.problems.length }) })] })), createForm, checkedIds.length > 0 && (_jsxs("div", { className: tb.batchBar, children: [_jsx("span", { children: t('topicBank.batch.selected', { n: checkedIds.length }) }), _jsxs("label", { className: tb.toolbarGroup, children: [_jsx("span", { className: tb.controlLabel, children: t('topicBank.batch.setStatus') }), _jsx("select", { "aria-label": t('topicBank.batch.setStatus'), className: tb.control, value: batchStatus, onChange: (event) => { setBatchStatus(event.target.value); }, children: TOPIC_STATUSES.map(status => _jsx("option", { value: status, children: t(`topic.status.${status}`) }, status)) })] }), _jsx("button", { type: "button", className: tb.btn, onClick: () => { void runBatch(item => topicInputOf(item, { status: batchStatus })); }, children: t('topicBank.batch.apply') }), _jsx("input", { "aria-label": t('topicBank.batch.tagsPlaceholder'), className: tb.control, value: batchTagsText, placeholder: t('topicBank.batch.tagsPlaceholder'), onChange: (event) => { setBatchTagsText(event.target.value); } }), _jsx("button", { type: "button", className: tb.btn, onClick: () => { void applyBatchTags(); }, children: t('topicBank.batch.applyTags') }), _jsx("button", { type: "button", className: tb.btn, onClick: () => { void doExport(items.filter(item => checkedIds.includes(item.id))); }, children: t('topicBank.batch.export') }), _jsx("button", { type: "button", className: tb.btn, onClick: () => { setSelectedIds([]); }, children: t('topicBank.batch.clear') })] })), _jsx(SplitDetail, { list: config.view === 'table' ? (_jsxs("div", { className: tb.tableWrap, children: [_jsxs("table", { className: tb.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { "aria-label": t('topicBank.batch.select') }), _jsx("th", { children: t('topicBank.column.title') }), _jsx("th", { children: t('topicBank.column.source') }), _jsx("th", { children: t('topicBank.column.score') }), _jsx("th", { children: t('topicBank.column.tags') }), _jsx("th", { children: t('topicBank.column.status') }), _jsx("th", { children: t('topicBank.column.planDate') }), _jsx("th", { children: t('topicBank.column.updatedAt') })] }) }), _jsx("tbody", { children: visible.map(item => (_jsxs("tr", { className: clsx(tb.row, item.id === selectedId && tb.rowActive), onClick: () => { selectItem(item.id); }, children: [_jsx("td", { onClick: (event) => { event.stopPropagation(); }, children: _jsx("input", { type: "checkbox", "aria-label": `${t('topicBank.batch.select')}: ${item.title}`, checked: checkedIds.includes(item.id), onChange: () => { toggleChecked(item.id); } }) }), _jsxs("td", { className: tb.cellTitle, children: [_jsx("span", { className: tb.cellTitleText, children: item.title }), item.oneLiner !== null && _jsx("span", { className: tb.cellMeta, children: item.oneLiner })] }), _jsxs("td", { className: tb.cellMuted, children: [t(`topic.source.${item.source.type}`), item.source.url !== null && (_jsxs(_Fragment, { children: [' ', _jsx("a", { className: tb.link, href: item.source.url, target: "_blank", rel: "noreferrer", onClick: (event) => { event.stopPropagation(); }, children: t('topicBank.openOriginal') })] }))] }), _jsx("td", { children: item.score === null ? t('topic.score.none') : formatScore(item.score.total) }), _jsx("td", { children: item.tags.map(tag => _jsx("span", { className: tb.tag, children: tag }, tag)) }), _jsx("td", { children: _jsx("span", { className: tb.pill, children: t(`topic.status.${item.status}`) }) }), _jsx("td", { className: tb.cellMuted, children: item.planDate ?? '—' }), _jsx("td", { className: tb.cellMuted, children: item.updatedAt.slice(0, 10) })] }, item.id))) })] }), visible.length === 0 && _jsx("div", { className: css.libraryState, children: t('topicBank.noMatch') })] })) : (_jsxs("div", { children: [_jsx("p", { className: tb.kanbanHint, children: t('topicBank.kanbanHint') }), _jsx("div", { className: tb.kanban, children: groupByStatus(visible).map(({ status, items: columnItems }) => (_jsxs("div", { className: clsx(tb.column, dragOver === status && tb.columnOver), onDragOver: (event) => { event.preventDefault(); setDragOver(status); }, onDragLeave: () => { setDragOver(current => current === status ? null : current); }, onDrop: () => { void dropTo(status); }, children: [_jsxs("div", { className: tb.columnHead, children: [_jsx("span", { children: t(`topic.status.${status}`) }), _jsx("span", { children: columnItems.length })] }), columnItems.map(item => (_jsxs("button", { type: "button", draggable: true, className: clsx(tb.card, item.id === selectedId && tb.cardActive), "aria-label": item.title, onDragStart: () => { draggingRef.current = item.id; }, onClick: () => { selectItem(item.id); }, children: [_jsx("span", { className: tb.cardTitle, children: item.title }), _jsxs("span", { className: tb.cardMeta, children: [item.score === null ? t('topic.score.none') : formatScore(item.score.total), item.planDate !== null && ` · ${item.planDate}`, item.tags.length > 0 && ` · ${item.tags.length}`] })] }, item.id)))] }, status))) })] })), detail: 
                // SplitDetail owns the region's aria-label; the inner surfaces stay
                // anonymous so the detail pane remains one named region.
                editForm !== false ? (_jsx("section", { className: tb.detail, children: editForm })) : selected === undefined ? (_jsx("section", { className: tb.detail, children: _jsx("div", { className: css.libraryState, children: t('topicBank.detail.empty') }) })) : (_jsxs("section", { className: tb.detail, children: [_jsxs("div", { className: tb.detailHead, children: [_jsx("h3", { className: tb.detailTitle, children: selected.title }), _jsx("span", { className: tb.pill, children: t(`topic.status.${selected.status}`) })] }), _jsxs("p", { className: tb.detailMeta, children: [t(`topic.source.${selected.source.type}`), ' · ', selected.score === null ? t('topic.score.none') : formatScore(selected.score.total), ' · ', t('topicBank.updatedAt', { date: selected.updatedAt.slice(0, 10) }), selected.planDate !== null && ` · ${t('topicBank.field.planDate')}: ${selected.planDate}`] }), _jsxs("div", { className: tb.actions, children: [_jsx("button", { type: "button", className: tb.primary, onClick: () => {
                                        onStartCreate({
                                            id: selected.id,
                                            title: selected.title,
                                            oneLiner: selected.oneLiner,
                                            description: selected.description,
                                        });
                                    }, children: t('topicBank.startCreate') }), _jsx("button", { type: "button", className: clsx(tb.btn, tb.btnDisabled), disabled: true, title: t('topicBank.aiPending'), children: t('topicBank.aiOptimize') }), _jsx("button", { type: "button", className: tb.btn, onClick: () => { setFormError(null); setForm(editFormOf(selected)); }, children: t('topicBank.edit') }), _jsx("button", { type: "button", className: clsx(tb.btn, tb.btnDanger), onClick: () => { setConfirming(true); setAlsoRemoveSchedule(true); }, children: t('topicBank.delete') })] }), confirming && (_jsxs("div", { className: tb.confirmBox, role: "alertdialog", "aria-label": t('topicBank.confirmDelete'), children: [_jsx("span", { children: t('topicBank.confirmDelete') }), selected.scheduleItemId !== null && (_jsxs("label", { className: tb.checkboxLabel, children: [_jsx("input", { type: "checkbox", checked: alsoRemoveSchedule, onChange: (event) => { setAlsoRemoveSchedule(event.target.checked); } }), t('topicBank.deleteAlsoSchedule')] })), _jsxs("div", { className: tb.formRow, children: [_jsx("button", { type: "button", className: clsx(tb.btn, tb.btnDanger), onClick: () => { void performDelete(); }, children: t('topicBank.deleteConfirm') }), _jsx("button", { type: "button", className: tb.btn, onClick: () => { setConfirming(false); }, children: t('topicBank.cancel') })] })] })), selected.oneLiner !== null && (_jsxs("div", { className: tb.fieldBlock, children: [_jsx("span", { className: tb.fieldLabel, children: t('topicBank.field.oneLiner') }), _jsx("p", { className: tb.fieldValue, children: selected.oneLiner })] })), selected.tags.length > 0 && (_jsxs("div", { className: tb.fieldBlock, children: [_jsx("span", { className: tb.fieldLabel, children: t('topicBank.column.tags') }), _jsx("p", { className: tb.fieldValue, children: selected.tags.join(' / ') })] })), selected.source.url !== null && (_jsx("p", { className: tb.fieldValue, children: _jsx("a", { className: tb.link, href: selected.source.url, target: "_blank", rel: "noreferrer", children: t('topicBank.openOriginal') }) })), selected.source.snapshot !== null && (_jsxs("div", { className: tb.snapshot, children: [_jsx("span", { className: tb.fieldLabel, children: t('topicBank.snapshotLabel') }), _jsx("p", { className: tb.fieldValue, children: selected.source.snapshot.title }), _jsx("p", { className: tb.fieldValue, children: selected.source.snapshot.summary ?? t('topicBank.snapshotNoSummary') }), _jsx("p", { className: tb.fieldValue, children: t('topicBank.snapshotCaptured', { date: selected.source.snapshot.capturedAt.slice(0, 10) }) })] })), selected.description !== null && (_jsxs("div", { className: tb.fieldBlock, children: [_jsx("span", { className: tb.fieldLabel, children: t('topicBank.field.description') }), _jsx("p", { className: tb.fieldValue, children: selected.description })] })), selected.scheduleItemId !== null && (_jsx("p", { className: tb.detailMeta, children: t('topicBank.linkedSchedule') }))] })), detailLabel: t('topicBank.detail.label') })] }));
}
//# sourceMappingURL=TopicBankView.js.map