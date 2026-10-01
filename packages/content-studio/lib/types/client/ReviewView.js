import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The review view: a four-panel workbench over the review controller —
 * 数据 (import + bindings + baselines), 看板 (filters + summary cards +
 * leaderboard), 诊断 (per-work AI diagnosis), 报告 (task creation, the
 * report editor, history, and the topic-bank reflow). The theme picker
 * rides the top; everything else renders against the loaded manifest.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { REVIEW_PLATFORMS, REVIEW_WORK_FILTERS } from "./review/model.js";
import { collectRateOf, engagementRateOf, rankWorks } from "./review/model.js";
import css from './ReviewView.module.css';
/** Percent label helper: rates render as percents, missing as a dash. */
function percent(rate) {
    return rate === null ? '—' : `${(rate * 100).toFixed(1)}%`;
}
/** The platform display names, in picker order. */
const PLATFORM_LABELS = {
    xhs: '小红书', douyin: '抖音', gzh: '公众号', bilibili: 'B站',
};
/**
 * Render the review workbench.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export function ReviewView({ review, listThemes, t }) {
    const state = useSyncExternalStore(fn => review.subscribe(fn), () => review.getState());
    const [tab, setTab] = useState('data');
    const [themes, setThemes] = useState([]);
    // Import staging form state.
    const [importPlatform, setImportPlatform] = useState('xhs');
    const [importFileName, setImportFileName] = useState('');
    const [importText, setImportText] = useState('');
    // Task + reflow form state.
    const [taskName, setTaskName] = useState('');
    const [topicTitle, setTopicTitle] = useState('');
    const [topicNote, setTopicNote] = useState('');
    useEffect(() => {
        void (async () => {
            try {
                setThemes(await listThemes());
            }
            catch {
                setThemes([]);
            }
        })();
    }, [listThemes]);
    useEffect(() => {
        if (state.notice === null)
            return;
        const timer = window.setTimeout(() => { review.clearNotice(); }, 4000);
        return () => { window.clearTimeout(timer); };
    }, [state.notice, review]);
    const manifest = state.manifest;
    const cards = useMemo(() => review.pool(), [review, state.manifest, state.theme, state.filtersRevision]);
    const summary = useMemo(() => review.summary(), [review, state.manifest, state.theme, state.filtersRevision]);
    const ranked = useMemo(() => rankWorks(cards.map(card => card.snapshot)), [cards]);
    const unbound = manifest?.snapshots.filter(snapshot => snapshot.contentId === null) ?? [];
    const pickTheme = (theme) => {
        void review.load(theme);
    };
    const onFilePicked = async (file) => {
        if (file === undefined)
            return;
        setImportFileName(file.name);
        const text = await file.text();
        setImportText(text);
    };
    const stageImport = () => {
        if (importText.trim().length === 0)
            return;
        void review.stageImport(importPlatform, importFileName, importText);
    };
    const noticeText = (notice) => t(`review.notice.${notice}`);
    return (_jsxs("div", { className: css.view, children: [_jsxs("header", { className: css.header, children: [_jsx("h2", { className: css.title, children: t('review.title') }), _jsxs("select", { className: css.themePick, value: state.theme ?? '', onChange: (event) => { pickTheme(event.target.value); }, "aria-label": t('review.theme.aria'), children: [_jsx("option", { value: "", children: t('review.theme.placeholder') }), themes.map(theme => _jsx("option", { value: theme, children: theme }, theme))] }), state.problems.length > 0 && _jsx("span", { className: css.problems, children: state.problems[0] })] }), state.notice !== null && _jsx("div", { className: css.notice, role: "status", children: noticeText(state.notice) }), state.busy && _jsx("div", { className: css.busy, children: t('review.busy') }), _jsx("nav", { className: css.tabs, role: "tablist", children: ['data', 'board', 'diagnose', 'reports'].map(candidate => (_jsx("button", { type: "button", role: "tab", "aria-selected": tab === candidate, className: css.tabButton, onClick: () => { setTab(candidate); }, children: t(`review.tab.${candidate}`) }, candidate))) }), state.theme === null && _jsx("p", { className: css.empty, children: t('review.empty.noTheme') }), state.loading && _jsx("p", { className: css.empty, children: t('review.loading') }), state.theme !== null && !state.loading && (_jsxs("div", { className: css.body, children: [tab === 'data' && (_jsxs("section", { className: css.panel, children: [_jsx("h3", { children: t('review.import.title') }), _jsx("p", { className: css.hint, children: t('review.import.hint') }), _jsxs("div", { className: css.formRow, children: [_jsx("select", { value: importPlatform, onChange: (event) => { setImportPlatform(event.target.value); }, "aria-label": t('review.import.platform'), children: REVIEW_PLATFORMS.map(platform => (_jsx("option", { value: platform, children: PLATFORM_LABELS[platform] }, platform))) }), _jsx("input", { type: "file", accept: ".csv,text/csv", onChange: (event) => { void onFilePicked(event.target.files?.[0]); }, "aria-label": t('review.import.file') }), _jsx("button", { type: "button", disabled: state.busy || importText.length === 0, onClick: stageImport, children: t('review.import.parse') })] }), state.preview !== null && (_jsx(ImportPreviewCard, { preview: state.preview, ignoredColumns: state.ignoredColumns, onIgnore: (columns) => { review.setIgnoredColumns(columns); }, onCommit: () => { void review.commitImport(); }, onDiscard: () => { review.discardImport(); }, t: t })), unbound.length > 0 && (_jsxs("div", { className: css.subpanel, children: [_jsx("h4", { children: t('review.bind.title', { count: String(unbound.length) }) }), _jsx("p", { className: css.hint, children: t('review.bind.hint') }), _jsx("ul", { className: css.workList, children: unbound.slice(0, 20).map(snapshot => (_jsx(BindRow, { snapshot: snapshot, review: review, t: t }, snapshot.snapshotId))) })] })), _jsx(BaselinesPanel, { review: review, manifest: manifest, t: t })] })), tab === 'board' && (_jsxs("section", { className: css.panel, children: [_jsx(FilterPanel, { review: review, t: t }), _jsxs("div", { className: css.cards, children: [_jsxs("div", { className: css.statCard, children: [_jsx("span", { className: css.statValue, children: summary.totalWorks }), _jsx("span", { className: css.statLabel, children: t('review.stat.works') })] }), _jsxs("div", { className: css.statCard, children: [_jsx("span", { className: css.statValue, children: summary.viralCount }), _jsx("span", { className: css.statLabel, children: t('review.stat.viral') })] }), _jsxs("div", { className: css.statCard, children: [_jsx("span", { className: css.statValue, children: percent(summary.avgEngagementRate) }), _jsx("span", { className: css.statLabel, children: t('review.stat.rate') })] }), _jsxs("div", { className: css.statCard, children: [_jsx("span", { className: css.statValue, children: summary.longtailCount }), _jsx("span", { className: css.statLabel, children: t('review.stat.longtail') })] })] }), _jsxs("div", { className: css.subpanel, children: [_jsx("h4", { children: t('review.board.platforms') }), _jsxs("table", { className: css.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: t('review.table.platform') }), _jsx("th", { children: t('review.table.works') }), _jsx("th", { children: t('review.table.impressions') }), _jsx("th", { children: t('review.table.engagement') })] }) }), _jsx("tbody", { children: REVIEW_PLATFORMS.filter(platform => summary.perPlatform[platform].works > 0).map(platform => (_jsxs("tr", { children: [_jsx("td", { children: PLATFORM_LABELS[platform] }), _jsx("td", { children: summary.perPlatform[platform].works }), _jsx("td", { children: summary.perPlatform[platform].impressions ?? '—' }), _jsx("td", { children: summary.perPlatform[platform].engagement ?? '—' })] }, platform))) })] }), _jsx("p", { className: css.hint, children: t('review.board.noSum') })] }), _jsxs("div", { className: css.subpanel, children: [_jsx("h4", { children: t('review.board.leaderboard') }), ranked.length === 0
                                        ? _jsx("p", { className: css.empty, children: t('review.empty.pool') })
                                        : (_jsx("ol", { className: css.workList, children: ranked.slice(0, 10).map((snapshot, index) => {
                                                const rate = engagementRateOf(snapshot.metrics);
                                                return (_jsxs("li", { className: css.workRow, children: [_jsx("span", { className: css.workRank, children: index + 1 }), _jsx("span", { className: css.workTitle, children: snapshot.title }), _jsx("span", { className: css.workMeta, children: PLATFORM_LABELS[snapshot.platformId] }), _jsx("span", { className: css.workMeta, children: percent(rate) })] }, snapshot.snapshotId));
                                            }) }))] })] })), tab === 'diagnose' && (_jsxs("section", { className: css.panel, children: [_jsx("h3", { children: t('review.diagnose.title') }), cards.length === 0
                                ? _jsx("p", { className: css.empty, children: t('review.empty.pool') })
                                : (_jsx("ul", { className: css.workList, children: cards.map(card => (_jsx(DiagnoseRow, { card: card, review: review, persona: null, t: t }, card.snapshot.snapshotId))) }))] })), tab === 'reports' && (_jsxs("section", { className: css.panel, children: [_jsx("h3", { children: t('review.report.title') }), _jsxs("div", { className: css.formRow, children: [_jsx("input", { type: "text", value: taskName, placeholder: t('review.report.namePlaceholder'), onChange: (event) => { setTaskName(event.target.value); }, "aria-label": t('review.report.namePlaceholder') }), _jsx("button", { type: "button", disabled: state.busy || taskName.trim().length === 0, onClick: () => { void review.createTask(taskName.trim()).then(() => { setTaskName(''); }); }, children: t('review.report.generate') })] }), state.reportDraft !== null && (_jsxs("div", { className: css.subpanel, children: [_jsx("h4", { children: t('review.report.editing') }), _jsx("textarea", { className: css.reportEditor, value: state.reportDraft, rows: 18, onChange: (event) => { review.copyReportToEditor(event.target.value); } }), _jsxs("div", { className: css.formRow, children: [_jsx("button", { type: "button", onClick: () => { void review.saveReport(); }, children: t('review.report.save') }), _jsx("button", { type: "button", onClick: () => { review.closeReport(); }, children: t('review.report.close') }), _jsx("button", { type: "button", onClick: () => { void review.saveTemplate(`爆款模板-${Date.now()}`, state.reportDraft ?? ''); }, children: t('review.report.saveTemplate') })] })] })), _jsxs("div", { className: css.subpanel, children: [_jsx("h4", { children: t('review.history.title') }), (manifest?.tasks.length ?? 0) === 0
                                        ? _jsx("p", { className: css.empty, children: t('review.history.empty') })
                                        : (_jsx("ul", { className: css.workList, children: [...manifest?.tasks ?? []].reverse().map(task => (_jsx(TaskRow, { task: task, review: review, t: t }, task.taskId))) }))] }), _jsxs("div", { className: css.subpanel, children: [_jsx("h4", { children: t('review.reflow.title') }), _jsx("p", { className: css.hint, children: t('review.reflow.hint') }), _jsx("div", { className: css.formRow, children: _jsx("input", { type: "text", value: topicTitle, placeholder: t('review.reflow.titlePlaceholder'), onChange: (event) => { setTopicTitle(event.target.value); } }) }), _jsx("textarea", { className: css.topicNote, rows: 3, value: topicNote, placeholder: t('review.reflow.notePlaceholder'), onChange: (event) => { setTopicNote(event.target.value); } }), _jsx("button", { type: "button", disabled: topicTitle.trim().length === 0, onClick: () => {
                                            void review.pushToTopicBank(topicTitle.trim(), null, topicNote.trim().length > 0 ? topicNote.trim() : null)
                                                .then(() => { setTopicTitle(''); setTopicNote(''); });
                                        }, children: t('review.reflow.push') })] }), (state.templates.length > 0) && (_jsxs("div", { className: css.subpanel, children: [_jsx("h4", { children: t('review.templates.title') }), _jsx("ul", { className: css.workList, children: state.templates.map(file => _jsx("li", { className: css.workRow, children: file }, file)) })] }))] }))] }))] }));
}
/** One staged import preview: counts, unknown-column checks, commit controls. */
function ImportPreviewCard({ preview, ignoredColumns, onIgnore, onCommit, onDiscard, t }) {
    const toggle = (column) => {
        onIgnore(ignoredColumns.includes(column)
            ? ignoredColumns.filter(candidate => candidate !== column)
            : [...ignoredColumns, column]);
    };
    return (_jsxs("div", { className: css.subpanel, children: [_jsxs("h4", { children: [preview.fileName, " \u00B7 ", preview.rows.length, " \u2713 / ", preview.rejected.length, " \u2717"] }), preview.rejected.length > 0 && (_jsx("ul", { className: css.rejectList, children: preview.rejected.slice(0, 10).map(rejection => (_jsx("li", { children: t('review.import.rowRejected', { row: String(rejection.row), reason: rejection.reason }) }, rejection.row))) })), preview.unknownColumns.length > 0 && (_jsxs("div", { children: [_jsx("p", { className: css.hint, children: t('review.import.unknownColumns') }), preview.unknownColumns.map(column => (_jsxs("label", { className: css.checkLabel, children: [_jsx("input", { type: "checkbox", checked: ignoredColumns.includes(column), onChange: () => { toggle(column); } }), column] }, column)))] })), _jsxs("div", { className: css.formRow, children: [_jsx("button", { type: "button", onClick: onCommit, children: t('review.import.commit') }), _jsx("button", { type: "button", onClick: onDiscard, children: t('review.import.discard') })] })] }));
}
/** One unbound snapshot with its manual contentId input. */
function BindRow({ snapshot, review, t }) {
    const [contentId, setContentId] = useState('');
    return (_jsxs("li", { className: css.workRow, children: [_jsx("span", { className: css.workTitle, children: snapshot.title }), _jsx("span", { className: css.workMeta, children: PLATFORM_LABELS[snapshot.platformId] }), _jsx("input", { type: "text", className: css.bindInput, placeholder: t('review.bind.placeholder'), value: contentId, onChange: (event) => { setContentId(event.target.value); } }), _jsx("button", { type: "button", disabled: contentId.trim().length === 0, onClick: () => { void review.bindWork(snapshot.platformWorkId, snapshot.platformId, contentId.trim()); }, children: t('review.bind.button') })] }));
}
/** The baselines editor: two rates plus their source label. */
function BaselinesPanel({ review, manifest, t }) {
    const [engagement, setEngagement] = useState('');
    const [collect, setCollect] = useState('');
    const current = manifest?.baselines;
    return (_jsxs("div", { className: css.subpanel, children: [_jsx("h4", { children: t('review.baselines.title') }), _jsxs("p", { className: css.hint, children: [t('review.baselines.hint'), current !== undefined && ` ${t('review.baselines.current', { engagement: percent(current.engagementRate), collect: percent(current.collectRate), source: current.source === 'user' ? t('review.baselines.sourceUser') : t('review.baselines.sourceDefault') })}`] }), _jsxs("div", { className: css.formRow, children: [_jsx("input", { type: "text", className: css.bindInput, placeholder: "5%", value: engagement, onChange: (event) => { setEngagement(event.target.value); }, "aria-label": t('review.baselines.engagement') }), _jsx("input", { type: "text", className: css.bindInput, placeholder: "2%", value: collect, onChange: (event) => { setCollect(event.target.value); }, "aria-label": t('review.baselines.collect') }), _jsx("button", { type: "button", onClick: () => {
                            const parse = (text) => {
                                const value = Number.parseFloat(text.replace('%', ''));
                                return Number.isFinite(value) ? value / 100 : null;
                            };
                            const nextEngagement = parse(engagement);
                            const nextCollect = parse(collect);
                            if (nextEngagement !== null && nextCollect !== null) {
                                void review.saveBaselines(nextEngagement, nextCollect);
                                setEngagement('');
                                setCollect('');
                            }
                        }, children: t('review.baselines.save') })] })] }));
}
/** The filter panel: period, platforms, forms, and the verdict slice. */
function FilterPanel({ review, t }) {
    const filters = review.filters();
    const togglePlatform = (platform) => {
        const next = filters.platforms.includes(platform)
            ? filters.platforms.filter(candidate => candidate !== platform)
            : [...filters.platforms, platform];
        review.setFilters({ platforms: next });
    };
    const toggleType = (kind) => {
        const next = filters.contentTypes.includes(kind)
            ? filters.contentTypes.filter(candidate => candidate !== kind)
            : [...filters.contentTypes, kind];
        review.setFilters({ contentTypes: next });
    };
    return (_jsxs("div", { className: css.subpanel, children: [_jsxs("div", { className: css.formRow, children: [_jsx("input", { type: "date", value: filters.period.from, onChange: (event) => { review.setFilters({ period: { ...filters.period, from: event.target.value } }); }, "aria-label": t('review.filter.from') }), _jsx("input", { type: "date", value: filters.period.to, onChange: (event) => { review.setFilters({ period: { ...filters.period, to: event.target.value } }); }, "aria-label": t('review.filter.to') })] }), _jsxs("div", { className: css.formRow, children: [REVIEW_PLATFORMS.map(platform => (_jsxs("label", { className: css.checkLabel, children: [_jsx("input", { type: "checkbox", checked: filters.platforms.includes(platform), onChange: () => { togglePlatform(platform); } }), PLATFORM_LABELS[platform]] }, platform))), _jsxs("label", { className: css.checkLabel, children: [_jsx("input", { type: "checkbox", checked: filters.contentTypes.includes('image-text'), onChange: () => { toggleType('image-text'); } }), t('review.filter.imageText')] }), _jsxs("label", { className: css.checkLabel, children: [_jsx("input", { type: "checkbox", checked: filters.contentTypes.includes('video'), onChange: () => { toggleType('video'); } }), t('review.filter.video')] })] }), _jsx("div", { className: css.formRow, children: REVIEW_WORK_FILTERS.map(candidate => (_jsxs("label", { className: css.checkLabel, children: [_jsx("input", { type: "radio", name: "review-work-filter", checked: filters.workFilter === candidate, onChange: () => { review.setFilters({ workFilter: candidate }); } }), t(`review.filter.${candidate}`)] }, candidate))) })] }));
}
/** One work row with its verdict chips and the diagnose button. */
function DiagnoseRow({ card, review, persona, t }) {
    const key = `${card.snapshot.platformId}:${card.snapshot.platformWorkId}`;
    const diagnosis = review.getState().diagnoses[key];
    const [open, setOpen] = useState(false);
    const [draftText, setDraftText] = useState('');
    const verdictClass = card.verdict === 'viral' ? css.viralChip : card.verdict === 'weak' ? css.weakChip : css.neutralChip;
    return (_jsxs("li", { className: css.workBlock, children: [_jsxs("div", { className: css.workRow, children: [_jsxs("button", { type: "button", className: css.linkish, onClick: () => { setOpen(!open); }, children: [open ? '▾' : '▸', " ", card.snapshot.title] }), _jsx("span", { className: css.workMeta, children: PLATFORM_LABELS[card.snapshot.platformId] }), _jsx("span", { className: css.workMeta, children: percent(engagementRateOf(card.snapshot.metrics)) }), _jsx("span", { className: css.workMeta, children: percent(collectRateOf(card.snapshot.metrics)) }), _jsx("span", { className: `${css.chip} ${verdictClass}`, children: t(`review.verdict.${card.longtail ? 'longtail' : card.verdict}`) }), _jsx("button", { type: "button", disabled: review.getState().busy, onClick: () => { void review.diagnoseWork(card, draftText.length > 0 ? draftText : null, [], persona); }, children: t('review.diagnose.run') })] }), open && (_jsxs("div", { className: css.workDetail, children: [_jsx("p", { className: css.hint, children: t('review.diagnose.draftHint') }), _jsx("textarea", { className: css.topicNote, rows: 3, value: draftText, onChange: (event) => { setDraftText(event.target.value); } }), diagnosis !== undefined && _jsx("pre", { className: css.diagnosis, children: diagnosis })] }))] }));
}
/** One history task row: status, report actions, delete. */
function TaskRow({ task, review, t }) {
    return (_jsxs("li", { className: css.workRow, children: [_jsx("span", { className: css.workTitle, children: task.name }), _jsxs("span", { className: css.workMeta, children: [task.period.from, " ~ ", task.period.to] }), _jsx("span", { className: `${css.chip} ${task.status === 'ready' && !task.degraded ? css.viralChip : task.status === 'failed' ? css.weakChip : css.neutralChip}`, children: t(`review.status.${task.degraded ? 'degraded' : task.status}`) }), task.reportFile !== null && (_jsx("button", { type: "button", onClick: () => { void review.editReport(task.taskId); }, children: t('review.history.view') })), _jsx("button", { type: "button", onClick: () => {
                    if (!window.confirm(t('review.history.deleteConfirm')))
                        return;
                    void review.deleteTask(task.taskId);
                }, children: t('review.history.delete') })] }));
}
//# sourceMappingURL=ReviewView.js.map