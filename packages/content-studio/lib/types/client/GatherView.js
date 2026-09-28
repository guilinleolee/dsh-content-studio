import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The gather view: the information-collection surface inside the workbench
 * overlay. Three regions — sources and tasks (browser-side configuration),
 * the material list of one theme (the on-disk manifest projected), and the
 * material detail (sanitized body, AI results, excerpts) — the latter two
 * sharing the reusable SplitDetail layout the topic bank adopts. Every
 * material card and the detail carry the topic-bank entry under the
 * reserved `addToTopicBank` contract name; the handler arrives injected now
 * that the topic bank ships, with the pending toast kept as the fallback
 * when no handler is plugged in. Scheduling copy states the product fact
 * plainly — collection runs only while the workbench is open; nothing polls
 * in the background.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { clsx } from 'clsx';
import { IconWarningOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import { exportSourcesAsOpml, previewOpmlImport } from "./gather/opml.js";
import { sanitizeForRender } from "./gather/purify.js";
import { SplitDetail } from "./SplitDetail.js";
import css from './ContentStudio.module.css';
import gatherCss from './GatherView.module.css';
/** Render the gather view. */
export function GatherView({ gather, onPushToCreate, addToTopicBank, t }) {
    const state = useSyncExternalStore(listener => gather.subscribe(listener), () => gather.getState());
    useEffect(() => { void gather.refreshThemes(); }, [gather]);
    // Initial theme pick: first theme once the list arrives.
    useEffect(() => {
        if (state.selectedTheme === null && state.themes.length > 0)
            void gather.selectTheme(state.themes[0] ?? null);
    }, [gather, state.selectedTheme, state.themes]);
    // The reserved topic-bank entry: a pending toast until the topic bank
    // plugs its handler in under the same contract name.
    const joinTopicBank = addToTopicBank ?? ((materialId) => {
        void materialId;
        gather.showNotice('topic-bank-pending');
    });
    return (_jsxs("div", { className: gatherCss.gather, children: [_jsxs("header", { className: gatherCss.gatherHead, children: [_jsxs("div", { children: [_jsx("h1", { className: css.title, children: t('gather.title') }), _jsx("p", { className: css.subtitle, children: t('gather.subtitle') })] }), state.notice !== null && (_jsxs("button", { type: "button", className: gatherCss.gatherNotice, onClick: () => { gather.dismissNotice(); }, children: [_jsx(IconWarningOutline16, { size: 14 }), _jsx("span", { children: noticeText(state.notice, t) })] }))] }), !state.storagePersistent && (_jsxs("div", { className: gatherCss.gatherWarn, role: "alert", children: [_jsx(IconWarningOutline16, { size: 14 }), _jsx("span", { children: t('gather.storage.memory') })] })), _jsxs("div", { className: gatherCss.gatherColumns, children: [_jsxs("aside", { className: gatherCss.gatherConfig, children: [_jsx(SourcesSection, { state: state, gather: gather, t: t }), _jsx(TasksSection, { state: state, gather: gather, t: t })] }), _jsx(SplitDetail, { list: _jsx(MaterialsSection, { state: state, gather: gather, onJoinTopicBank: joinTopicBank, t: t }), detail: _jsx(MaterialDetail, { state: state, gather: gather, onPushToCreate: onPushToCreate, onJoinTopicBank: joinTopicBank, t: t }), detailLabel: t('gather.detail.label') })] })] }));
}
function noticeText(notice, t) {
    const known = {
        'calendar-added': () => t('gather.notice.calendarAdded'),
        'source-limit': () => t('gather.notice.sourceLimit'),
        'opml-exported': () => t('gather.notice.opmlExported'),
        'topic-bank-pending': () => t('gather.notice.topicBankPending'),
        'topic-bank-added': () => t('gather.notice.topicBankAdded'),
        'topic-bank-failed': () => t('gather.notice.topicBankFailed'),
        'topic-bank-missing': () => t('gather.notice.topicBankMissing'),
    };
    const knownValue = known[notice];
    if (knownValue !== undefined)
        return knownValue();
    if (notice.startsWith('opml-imported:')) {
        const [n, skipped] = notice.slice('opml-imported:'.length).split('+');
        return t('gather.notice.opmlImported', { n: n ?? '0', skipped: skipped ?? '0' });
    }
    if (notice.startsWith('test-ok:'))
        return t('gather.notice.testOk', { n: notice.slice('test-ok:'.length) });
    if (notice.startsWith('test-failed:'))
        return t('gather.notice.testFailed', { detail: notice.slice('test-failed:'.length) });
    return notice;
}
/** Map one source's last status to its badge class. */
function sourceBadge(source) {
    if (source.lastStatus === 'ok')
        return gatherCss.gatherBadgeOk ?? '';
    if (source.lastStatus === 'failed')
        return gatherCss.gatherBadgeFailed ?? '';
    return '';
}
// ── sources ──
function SourcesSection({ state, gather, t }) {
    const [expanded, setExpanded] = useState(false);
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [interval, setInterval] = useState(60);
    const [exclude, setExclude] = useState('');
    const [testing, setTesting] = useState(null);
    const submit = () => {
        if (name.trim().length === 0 || url.trim().length === 0)
            return;
        gather.addSource({
            name: name.trim(),
            url: url.trim(),
            intervalMinutes: Math.max(30, interval),
            tags: [],
            excludeKeywords: splitKeywords(exclude),
        });
        setName('');
        setUrl('');
        setExclude('');
    };
    return (_jsxs("section", { className: gatherCss.gatherPanel, children: [_jsxs("header", { className: gatherCss.gatherPanelHead, children: [_jsx("h2", { className: css.groupTitle, children: t('gather.sources.title') }), _jsx("span", { className: css.listMeta, children: state.sources.length })] }), _jsx("ul", { className: gatherCss.gatherList, children: state.sources.map(source => (_jsxs("li", { className: gatherCss.gatherItem, children: [_jsxs("div", { className: gatherCss.gatherItemHead, children: [_jsx("span", { className: clsx(gatherCss.gatherBadge, sourceBadge(source)) }), _jsx("span", { className: gatherCss.gatherItemTitle, children: source.name }), _jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => { gather.updateSource(source.id, { enabled: !source.enabled }); }, children: source.enabled ? t('gather.sources.disable') : t('gather.sources.enable') }), _jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => {
                                        setTesting(source.id);
                                        void gather.testSource(source.id).then((result) => {
                                            setTesting(null);
                                            gather.showNotice(result.ok ? `test-ok:${result.detail}` : `test-failed:${result.detail}`);
                                        }).catch(() => { setTesting(null); });
                                    }, children: testing === source.id ? t('gather.sources.testing') : t('gather.sources.test') }), _jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => {
                                        if (!window.confirm(t('gather.sources.removeConfirm')))
                                            return;
                                        gather.removeSource(source.id);
                                    }, children: t('gather.sources.remove') })] }), _jsxs("span", { className: gatherCss.gatherItemMeta, children: [source.url, ' · ', t('gather.sources.interval', { n: source.intervalMinutes }), source.lastStatus === 'failed' && ` · ${t('gather.sources.failed')}`, source.lastFetchedAt !== null && ` · ${source.lastFetchedAt.slice(0, 16).replace('T', ' ')}`] }), source.excludeKeywords.length > 0 && (_jsxs("span", { className: gatherCss.gatherItemMeta, children: [t('gather.sources.exclude'), ": ", source.excludeKeywords.join('、')] }))] }, source.id))) }), expanded ? (_jsxs("div", { className: gatherCss.gatherForm, children: [_jsx("input", { className: gatherCss.gatherInput, value: name, placeholder: t('gather.sources.namePlaceholder'), onChange: (event) => { setName(event.target.value); } }), _jsx("input", { className: gatherCss.gatherInput, value: url, placeholder: "https://example.com/feed.xml", onChange: (event) => { setUrl(event.target.value); } }), _jsxs("div", { className: gatherCss.gatherFormRow, children: [_jsxs("label", { className: gatherCss.gatherItemMeta, children: [t('gather.sources.intervalLabel'), _jsx("input", { className: gatherCss.gatherInput, type: "number", min: 30, value: interval, onChange: (event) => { setInterval(Number(event.target.value)); } })] }), _jsx("input", { className: gatherCss.gatherInput, value: exclude, placeholder: t('gather.sources.excludePlaceholder'), onChange: (event) => { setExclude(event.target.value); } })] }), _jsxs("div", { className: gatherCss.gatherFormRow, children: [_jsx("button", { type: "button", className: gatherCss.gatherAction, onClick: submit, children: t('gather.sources.add') }), _jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => { setExpanded(false); }, children: t('gather.cancel') })] })] })) : (_jsxs("div", { className: gatherCss.gatherFormRow, children: [_jsx("button", { type: "button", className: gatherCss.gatherAction, onClick: () => { setExpanded(true); }, children: t('gather.sources.add') }), _jsx(OpmlControls, { sources: state.sources, gather: gather, t: t })] })), _jsx("p", { className: gatherCss.gatherHint, children: t('gather.schedule.limit') })] }));
}
function OpmlControls({ sources, gather, t }) {
    return (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.opml,text/xml,application/xml';
                    input.onchange = () => {
                        const file = input.files?.[0];
                        if (file === undefined)
                            return;
                        void file.text().then((text) => {
                            const { rows, problem } = previewOpmlImport(text, sources);
                            if (problem !== undefined || rows === undefined) {
                                gather.showNotice(problem ?? 'opml-error');
                                return;
                            }
                            const usable = rows.filter(row => !row.invalid && !row.duplicate);
                            const skipped = rows.length - usable.length;
                            gather.importSources(usable.map(row => ({ name: row.name, url: row.url, tags: row.folder.slice(0, 1) })));
                            gather.showNotice(`opml-imported:${usable.length}+${skipped}`);
                        });
                    };
                    input.click();
                }, children: t('gather.sources.opmlImport') }), _jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => {
                    if (sources.length === 0)
                        return;
                    // Feed URLs can carry private tokens; the export dialog states the
                    // handling duty before the file exists.
                    if (!window.confirm(t('gather.sources.opmlExportWarning')))
                        return;
                    const opml = exportSourcesAsOpml(sources);
                    const blob = new Blob([opml], { type: 'text/x-opml' });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = 'gather-sources.opml';
                    anchor.click();
                    URL.revokeObjectURL(url);
                    gather.showNotice('opml-exported');
                }, children: t('gather.sources.opmlExport') })] }));
}
// ── tasks ──
function TasksSection({ state, gather, t }) {
    const [expanded, setExpanded] = useState(null);
    return (_jsxs("section", { className: gatherCss.gatherPanel, children: [_jsxs("header", { className: gatherCss.gatherPanelHead, children: [_jsx("h2", { className: css.groupTitle, children: t('gather.tasks.title') }), _jsx("span", { className: css.listMeta, children: state.tasks.length })] }), _jsx("ul", { className: gatherCss.gatherList, children: state.tasks.map(task => (_jsx(TaskRow, { task: task, gather: gather, expanded: expanded === task.id, toggle: () => { setExpanded(expanded === task.id ? null : task.id); }, t: t }, task.id))) }), _jsx(TaskCreate, { state: state, gather: gather, t: t })] }));
}
const STATUS_LABEL = {
    idle: 'gather.task.idle',
    running: 'gather.task.running',
    done: 'gather.task.done',
    failed: 'gather.task.failed',
};
function TaskRow({ task, gather, expanded, toggle, t }) {
    return (_jsxs("li", { className: gatherCss.gatherItem, children: [_jsxs("div", { className: gatherCss.gatherItemHead, children: [_jsx("span", { className: gatherCss.gatherItemTitle, children: task.name }), _jsx("span", { className: clsx(gatherCss.gatherBadge, task.status === 'failed' ? gatherCss.gatherBadgeFailed : task.status === 'running' ? gatherCss.gatherBadgeOk : ''), children: t(STATUS_LABEL[task.status]) })] }), _jsxs("span", { className: gatherCss.gatherItemMeta, children: [task.themeName, ' · ', task.intervalMinutes === null ? t('gather.task.manual') : t('gather.sources.interval', { n: task.intervalMinutes }), ' · ', task.sourceIds.length] }), _jsxs("div", { className: gatherCss.gatherItemHead, children: [_jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => { void gather.triggerTask(task.id); }, children: t('gather.task.run') }), _jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => { gather.updateTask(task.id, { intervalMinutes: task.intervalMinutes === null ? 60 : null }); }, children: task.intervalMinutes === null ? t('gather.task.resume') : t('gather.task.pause') }), _jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: toggle, children: t('gather.task.log') }), _jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => {
                            if (!window.confirm(t('gather.task.removeConfirm')))
                                return;
                            gather.removeTask(task.id);
                        }, children: t('gather.sources.remove') })] }), expanded && (_jsxs("ul", { className: gatherCss.gatherLog, children: [task.log.length === 0 && _jsx("li", { className: gatherCss.gatherItemMeta, children: t('gather.task.logEmpty') }), task.log.map(entry => (_jsxs("li", { className: gatherCss.gatherItemMeta, children: [entry.at.slice(11, 19), ' · ', t(entry.outcome === 'ok' ? 'gather.log.ok' : entry.outcome === 'failed' ? 'gather.log.failed' : 'gather.log.notModified'), entry.outcome !== 'failed' && ` +${entry.added}`, entry.detail !== undefined && ` · ${entry.detail}`] }, entry.at)))] }))] }));
}
function TaskCreate({ state, gather, t }) {
    const [expanded, setExpanded] = useState(false);
    const [name, setName] = useState('');
    const [theme, setTheme] = useState('');
    const [selected, setSelected] = useState([]);
    const [interval, setIntervalMinutes] = useState('');
    const [maxItems, setMaxItems] = useState(20);
    const [include, setInclude] = useState('');
    const [exclude, setExclude] = useState('');
    if (!expanded) {
        return _jsx("button", { type: "button", className: gatherCss.gatherAction, onClick: () => { setExpanded(true); }, children: t('gather.task.add') });
    }
    return (_jsxs("div", { className: gatherCss.gatherForm, children: [_jsx("input", { className: gatherCss.gatherInput, value: name, placeholder: t('gather.task.namePlaceholder'), onChange: (event) => { setName(event.target.value); } }), _jsxs("select", { className: gatherCss.gatherInput, value: theme, onChange: (event) => { setTheme(event.target.value); }, children: [_jsx("option", { value: "", children: t('gather.task.themePlaceholder') }), state.themes.map(candidate => _jsx("option", { value: candidate, children: candidate }, candidate))] }), _jsx("div", { className: gatherCss.gatherCheckList, children: state.sources.map(source => (_jsxs("label", { className: gatherCss.gatherItemMeta, children: [_jsx("input", { type: "checkbox", checked: selected.includes(source.id), onChange: () => {
                                setSelected(selected.includes(source.id) ? selected.filter(id => id !== source.id) : [...selected, source.id]);
                            } }), ' ', source.name] }, source.id))) }), _jsxs("div", { className: gatherCss.gatherFormRow, children: [_jsx("input", { className: gatherCss.gatherInput, type: "number", min: 20, value: maxItems, onChange: (event) => { setMaxItems(Number(event.target.value)); } }), _jsx("input", { className: gatherCss.gatherInput, value: interval, placeholder: t('gather.task.intervalPlaceholder'), onChange: (event) => { setIntervalMinutes(event.target.value); } })] }), _jsx("input", { className: gatherCss.gatherInput, value: include, placeholder: t('gather.task.includePlaceholder'), onChange: (event) => { setInclude(event.target.value); } }), _jsx("input", { className: gatherCss.gatherInput, value: exclude, placeholder: t('gather.task.excludePlaceholder'), onChange: (event) => { setExclude(event.target.value); } }), _jsxs("div", { className: gatherCss.gatherFormRow, children: [_jsx("button", { type: "button", className: gatherCss.gatherAction, onClick: () => {
                            if (name.trim().length === 0 || theme.length === 0 || selected.length === 0)
                                return;
                            const minutes = interval.trim().length === 0 ? null : Math.max(30, Number(interval));
                            gather.addTask({
                                name: name.trim(),
                                sourceIds: selected,
                                themeName: theme,
                                maxItemsPerRun: Math.max(1, maxItems),
                                since: null,
                                includeKeywords: splitKeywords(include),
                                excludeKeywords: splitKeywords(exclude),
                                aiEnabled: true,
                                intervalMinutes: minutes,
                            });
                            setName('');
                            setSelected([]);
                            setExpanded(false);
                        }, children: t('gather.task.add') }), _jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => { setExpanded(false); }, children: t('gather.cancel') })] })] }));
}
// ── materials ──
function MaterialsSection({ state, gather, onJoinTopicBank, t }) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const filtered = useMemo(() => filterMaterials(state, search, statusFilter, sourceFilter), [state, search, statusFilter, sourceFilter]);
    return (_jsxs("section", { className: gatherCss.gatherMaterials, children: [_jsxs("div", { className: gatherCss.gatherFilters, children: [_jsxs("select", { className: gatherCss.gatherInput, value: state.selectedTheme ?? '', onChange: (event) => { void gather.selectTheme(event.target.value === '' ? null : event.target.value); }, children: [state.themes.length === 0 && _jsx("option", { value: "", children: t('gather.materials.noTheme') }), state.themes.map(theme => _jsx("option", { value: theme, children: theme }, theme))] }), _jsxs("select", { className: gatherCss.gatherInput, value: sourceFilter, onChange: (event) => { setSourceFilter(event.target.value); }, children: [_jsx("option", { value: "all", children: t('gather.materials.allSources') }), state.sources.map(source => _jsx("option", { value: source.id, children: source.name }, source.id))] }), _jsxs("select", { className: gatherCss.gatherInput, value: statusFilter, onChange: (event) => { setStatusFilter(event.target.value); }, children: [_jsx("option", { value: "all", children: t('gather.materials.allStatus') }), _jsx("option", { value: "unread", children: t('gather.materials.unread') }), _jsx("option", { value: "read", children: t('gather.materials.read') }), _jsx("option", { value: "favorite", children: t('gather.materials.favorite') }), _jsx("option", { value: "picked", children: t('gather.materials.picked') })] }), _jsx("input", { className: gatherCss.gatherInput, value: search, placeholder: t('gather.materials.searchPlaceholder'), onChange: (event) => { setSearch(event.target.value); } })] }), state.loadingMaterials && _jsx("div", { className: css.libraryState, children: t('gather.materials.loading') }), !state.loadingMaterials && filtered.length === 0 && _jsx("div", { className: css.libraryState, children: t('gather.materials.empty') }), _jsx("ul", { className: gatherCss.gatherMaterialList, children: filtered.map(material => (_jsxs("li", { className: gatherCss.gatherCardRow, children: [_jsxs("button", { type: "button", className: clsx(gatherCss.gatherMaterialCard, state.selectedMaterialId === material.id && gatherCss.gatherMaterialActive), onClick: () => { gather.selectMaterial(material.id); }, children: [_jsx("span", { className: gatherCss.gatherItemTitle, children: material.title }), _jsxs("span", { className: gatherCss.gatherItemMeta, children: [material.sourceName, material.publishedAt !== undefined && ` · ${material.publishedAt.slice(0, 10)}`, material.score !== undefined && ` · ${material.score}`] })] }), _jsx("button", { type: "button", className: clsx(gatherCss.gatherMini, gatherCss.gatherTopicBank), "aria-label": `${t('gather.detail.topicBank')}: ${material.title}`, title: t('gather.notice.topicBankPending'), onClick: () => { onJoinTopicBank(material.id); }, children: t('gather.detail.topicBankShort') })] }, material.id))) })] }));
}
/** Client-side filter of the visible materials: search, status, source. */
function filterMaterials(state, search, status, sourceId) {
    const query = search.trim().toLowerCase();
    return state.materials.filter((material) => {
        if (status !== 'all' && material.status !== status)
            return false;
        if (sourceId !== 'all' && material.sourceId !== sourceId)
            return false;
        if (query.length > 0 && !`${material.title}\n${material.summary ?? ''}`.toLowerCase().includes(query))
            return false;
        return true;
    });
}
// ── detail ──
function MaterialDetail({ state, gather, onPushToCreate, onJoinTopicBank, t }) {
    const material = state.materials.find(candidate => candidate.id === state.selectedMaterialId);
    const [body, setBody] = useState(null);
    const [excerpt, setExcerpt] = useState('');
    const [bindTheme, setBindTheme] = useState('');
    const [calendarDate, setCalendarDate] = useState('');
    useEffect(() => {
        setBody(null);
        setExcerpt('');
        if (material?.bodyFile === undefined || state.selectedTheme === null)
            return;
        let live = true;
        void gather.readBody(state.selectedTheme, material.bodyFile).then((content) => {
            if (live)
                setBody(content);
        });
        return () => { live = false; };
    }, [gather, material?.bodyFile, state.selectedTheme]);
    if (material === undefined) {
        return _jsx("section", { className: gatherCss.gatherDetail, children: _jsx("div", { className: css.libraryState, children: t('gather.detail.empty') }) });
    }
    return (_jsxs("section", { className: gatherCss.gatherDetail, children: [_jsxs("header", { className: gatherCss.gatherDetailHead, children: [_jsx("h2", { className: gatherCss.gatherDetailTitle, children: material.title }), _jsxs("span", { className: gatherCss.gatherItemMeta, children: [material.sourceName, material.publishedAt !== undefined && ` · ${material.publishedAt.slice(0, 10)}`, ` · ${t(`gather.materials.${material.status}`)}`] }), _jsx("a", { className: gatherCss.gatherLink, href: material.url, target: "_blank", rel: "noreferrer", children: t('gather.detail.openOriginal') })] }), _jsxs("div", { className: gatherCss.gatherFormRow, children: [_jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => { void gather.markRead(material.id); }, children: material.status === 'read' ? t('gather.detail.markUnread') : t('gather.detail.markRead') }), _jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => { void gather.toggleFavorite(material.id); }, children: material.status === 'favorite' ? t('gather.detail.unfavorite') : t('gather.detail.favorite') }), _jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => {
                            void gather.markPicked(material.id);
                            onPushToCreate({ id: material.id, title: material.title, url: material.url });
                        }, children: t('gather.detail.pushCreate') }), _jsx("button", { type: "button", className: gatherCss.gatherMini, title: t('gather.notice.topicBankPending'), onClick: () => { onJoinTopicBank(material.id); }, children: t('gather.detail.topicBank') })] }), _jsxs("div", { className: gatherCss.gatherAi, children: [_jsxs("div", { className: gatherCss.gatherFormRow, children: [_jsx("button", { type: "button", className: gatherCss.gatherAction, onClick: () => { void gather.processWithAi(material.id); }, children: t('gather.detail.aiProcess') }), material.summary === undefined && _jsx("span", { className: gatherCss.gatherHint, children: t('gather.detail.aiPending') })] }), material.summary !== undefined && (_jsxs("div", { className: gatherCss.gatherAiResult, children: [_jsx("p", { className: gatherCss.gatherBodyText, children: material.summary }), material.points !== undefined && material.points.length > 0 && (_jsx("ul", { className: gatherCss.gatherLog, children: material.points.map((point, index) => _jsx("li", { className: gatherCss.gatherBodyText, children: point }, index)) })), material.score !== undefined && _jsx("span", { className: gatherCss.gatherBadgeOk, children: t('gather.detail.score', { n: material.score }) }), material.tags !== undefined && material.tags.length > 0 && (_jsx("span", { className: gatherCss.gatherItemMeta, children: material.tags.join('、') }))] }))] }), body !== null && (_jsx("div", { className: gatherCss.gatherBody, dangerouslySetInnerHTML: { __html: sanitizeForRender(body) } })), _jsxs("div", { className: gatherCss.gatherExcerpts, children: [_jsx("ul", { className: gatherCss.gatherLog, children: material.excerpts?.map((entry, index) => _jsx("li", { className: gatherCss.gatherBodyText, children: entry }, index)) }), _jsxs("div", { className: gatherCss.gatherFormRow, children: [_jsx("input", { className: gatherCss.gatherInput, value: excerpt, placeholder: t('gather.detail.excerptPlaceholder'), onChange: (event) => { setExcerpt(event.target.value); } }), _jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => {
                                    void gather.addExcerpt(material.id, excerpt);
                                    setExcerpt('');
                                }, children: t('gather.detail.excerptAdd') })] })] }), _jsxs("div", { className: gatherCss.gatherFormRow, children: [_jsxs("select", { className: gatherCss.gatherInput, value: bindTheme, onChange: (event) => { setBindTheme(event.target.value); }, children: [_jsx("option", { value: "", children: t('gather.detail.bindPlaceholder') }), state.themes.filter(theme => theme !== state.selectedTheme).map(theme => _jsx("option", { value: theme, children: theme }, theme))] }), _jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => {
                            if (bindTheme.length > 0) {
                                void gather.bindTheme(material.id, bindTheme);
                                setBindTheme('');
                            }
                        }, children: t('gather.detail.bindMove') })] }), _jsxs("div", { className: gatherCss.gatherFormRow, children: [_jsx("input", { className: gatherCss.gatherInput, type: "date", value: calendarDate, onChange: (event) => { setCalendarDate(event.target.value); } }), _jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => {
                            if (calendarDate.length > 0)
                                void gather.pushToCalendar(material.id, calendarDate);
                        }, children: t('gather.detail.toCalendar') })] })] }));
}
/** Split a comma/、-separated keyword field into a clean list. */
function splitKeywords(value) {
    return value.split(/[,，、\n]/u).map(word => word.trim()).filter(word => word.length > 0);
}
//# sourceMappingURL=GatherView.js.map