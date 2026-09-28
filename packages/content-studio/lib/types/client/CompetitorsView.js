import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The competitors view (对标账号): benchmark-account registry in the browser,
 * works library on disk behind the content-outputs competitor write face,
 * AI teardown and report generation behind explicit buttons, and the
 * catch-up banner replacing phase-one scheduling. Storage split follows the
 * competitor plan: accounts live in localStorage (with JSON import/export),
 * works, snapshots, analysis state, and reports live in the theme manifest.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { IconRefreshOutline14, IconTrashOutline16, IconWarningOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import { aggregateAccountDigest, buildIdeaMarkdown, COMPETITOR_PLATFORMS, exportAccounts, heatByWork, importAccounts, interactionScore, isAccountStale, loadAccounts, newId, saveAccounts, upsertWork, } from "./competitors.js";
import css from './ContentStudio.module.css';
/** localStorage key of the last opened theme. */
const THEME_STORAGE_KEY = 'dsh-content-studio.competitors.theme';
/** Pre-alignment theme key; read when the aligned key is absent. */
const THEME_LEGACY_STORAGE_KEY = 'content-studio.competitors.theme';
/** Section tab order. */
const SECTIONS = ['accounts', 'works', 'reports'];
/** Locale key per section tab. */
const SECTION_KEYS = {
    accounts: 'comp.section.accounts',
    works: 'comp.section.works',
    reports: 'comp.section.reports',
};
/** Locale key per platform. */
const PLATFORM_KEYS = {
    xhs: 'comp.platform.xhs',
    douyin: 'comp.platform.douyin',
    wechat: 'comp.platform.wechat',
    bili: 'comp.platform.bili',
    zhihu: 'comp.platform.zhihu',
    toutiao: 'comp.platform.toutiao',
};
/** Priority → its badge modifier class. */
const PRIORITY_CLASS = {
    high: css.compBadgeHot ?? '',
    medium: css.statusDraft ?? '',
    low: css.badgeIncoming ?? '',
};
/** Empty-manifest stand-in while no theme is open. */
const EMPTY_MANIFEST = { formatVersion: 0, syncedAt: {}, works: [], reports: [] };
/** Fresh account form pre-filled with an account, when editing. */
function accountForm(account) {
    return {
        id: account?.id,
        name: account?.name ?? '',
        platform: account?.platform ?? 'xhs',
        homepageUrl: account?.homepageUrl ?? '',
        topics: account?.topics.join(' ') ?? '',
        priority: account?.priority ?? 'medium',
        intervalDays: account?.intervalDays ?? 3,
        positioning: account?.positioning ?? '',
        followerTier: account?.followerTier ?? '',
        monetization: account?.monetization ?? '',
        note: account?.note ?? '',
    };
}
/** Fresh work import form pre-filled with the given account. */
function workForm(accountId, platform) {
    return {
        accountId,
        platform,
        platformWorkId: '',
        title: '',
        url: '',
        publishedDate: '',
        likes: '',
        comments: '',
        shares: '',
        views: '',
        body: '',
    };
}
/** Parse one numeric form field; blank reads as zero. */
function numberField(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}
/**
 * Render the competitors view.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export function CompetitorsView(props) {
    const { listOutputs, readCompetitorManifest, writeCompetitorManifest, writeAsset, deleteAsset, readAsset, analyzeCompetitorWork, generateCompetitorReport, t, } = props;
    const [accounts, setAccounts] = useState(() => loadAccounts().accounts);
    const [storageDegraded, setStorageDegraded] = useState(false);
    const [section, setSection] = useState('works');
    const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) ?? localStorage.getItem(THEME_LEGACY_STORAGE_KEY) ?? '');
    const [projects, setProjects] = useState([]);
    const [manifest, setManifest] = useState(undefined);
    const [manifestProblems, setManifestProblems] = useState([]);
    const [manifestError, setManifestError] = useState(undefined);
    const [accountForm, setAccountForm] = useState(undefined);
    const [importOpen, setImportOpen] = useState(false);
    const [workFormState, setWorkFormState] = useState(workForm('', 'xhs'));
    const [query, setQuery] = useState('');
    const [flagFilter, setFlagFilter] = useState('all');
    const [selectedWorkId, setSelectedWorkId] = useState(undefined);
    const [previewText, setPreviewText] = useState(undefined);
    const [commentsDraft, setCommentsDraft] = useState('');
    const [pendingAnalysis, setPendingAnalysis] = useState([]);
    const [selectedReportId, setSelectedReportId] = useState(undefined);
    const [reportText, setReportText] = useState(undefined);
    const [compareIds, setCompareIds] = useState([]);
    const [generating, setGenerating] = useState(false);
    const [actionError, setActionError] = useState(undefined);
    const persistAccounts = useCallback((next) => {
        setAccounts(next);
        setStorageDegraded(!saveAccounts(next));
    }, []);
    const selectTheme = useCallback((next) => {
        setTheme(next);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
        }
        catch { /* best effort */ }
    }, []);
    useEffect(() => {
        let cancelled = false;
        listOutputs().then((snapshot) => { if (!cancelled)
            setProjects(snapshot.projects); }, (error) => { console.error('[content-studio] contentOutputs/list failed:', error); });
        return () => { cancelled = true; };
    }, [listOutputs]);
    useEffect(() => {
        if (theme.length === 0) {
            setManifest(undefined);
            setManifestProblems([]);
            setManifestError(undefined);
            return;
        }
        let cancelled = false;
        setManifestError(undefined);
        readCompetitorManifest(theme).then((read) => {
            if (cancelled)
                return;
            setManifest(read.manifest);
            setManifestProblems(read.problems);
        }, (error) => {
            if (cancelled)
                return;
            console.error('[content-studio] contentOutputs/readCompetitorManifest failed:', error);
            setManifestError(error instanceof Error ? error.message : String(error));
        });
        return () => { cancelled = true; };
    }, [theme, readCompetitorManifest]);
    const commitManifest = useCallback(async (next) => {
        await writeCompetitorManifest(theme, next);
        setManifest(next);
    }, [theme, writeCompetitorManifest]);
    const current = manifest ?? EMPTY_MANIFEST;
    const heat = useMemo(() => heatByWork(current.works), [current.works]);
    const stale = useMemo(() => manifest === undefined ? [] : accounts.filter(account => isAccountStale(account, manifest, new Date())), [accounts, manifest]);
    const works = useMemo(() => {
        const filtered = current.works.filter((work) => {
            if (flagFilter === 'hot' && !work.hot)
                return false;
            if (flagFilter === 'favorite' && !work.favorite)
                return false;
            if (flagFilter === 'analyzed' && work.analysis.status !== 'done')
                return false;
            if (flagFilter === 'unanalyzed' && work.analysis.status === 'done')
                return false;
            if (query.trim().length > 0) {
                const needle = query.trim().toLowerCase();
                const haystack = `${work.title} ${work.accountName}`.toLowerCase();
                if (!haystack.includes(needle))
                    return false;
            }
            return true;
        });
        return [...filtered].sort((a, b) => Date.parse(b.publishedAt ?? b.importedAt) - Date.parse(a.publishedAt ?? a.importedAt));
    }, [current.works, flagFilter, query]);
    const selectedWork = current.works.find(work => work.id === selectedWorkId);
    const selectedReport = current.reports.find(report => report.id === selectedReportId);
    useEffect(() => {
        if (selectedWork?.textFile === undefined || theme.length === 0) {
            setPreviewText(undefined);
            return;
        }
        let cancelled = false;
        readAsset(theme, selectedWork.textFile).then((result) => { if (!cancelled)
            setPreviewText(result.content); }, () => { if (!cancelled)
            setPreviewText(undefined); });
        return () => { cancelled = true; };
    }, [selectedWork?.textFile, theme, readAsset]);
    useEffect(() => {
        if (selectedReport === undefined || theme.length === 0) {
            setReportText(undefined);
            return;
        }
        let cancelled = false;
        readAsset(theme, selectedReport.ref).then((result) => { if (!cancelled)
            setReportText(result.content); }, () => { if (!cancelled)
            setReportText(undefined); });
        return () => { cancelled = true; };
    }, [selectedReport, theme, readAsset]);
    /** Wrap one mutating action: surface its failure once, then clear it. */
    const act = async (action) => {
        setActionError(undefined);
        try {
            await action();
        }
        catch (error) {
            console.error('[content-studio] competitors action failed:', error);
            setActionError(error instanceof Error ? error.message : String(error));
        }
    };
    const submitAccount = () => {
        if (accountForm === undefined || accountForm.name.trim().length === 0)
            return;
        if (accountForm.id !== undefined) {
            persistAccounts(accounts.map(account => account.id === accountForm.id
                ? { ...account, ...accountForm, id: account.id, topics: accountForm.topics.split(/\s+/u).filter(part => part.length > 0) }
                : account));
        }
        else {
            persistAccounts([...accounts, {
                    ...accountForm,
                    id: newId('acc'),
                    enabled: true,
                    topics: accountForm.topics.split(/\s+/u).filter(part => part.length > 0),
                    createdAt: new Date().toISOString(),
                }]);
        }
        setAccountForm(undefined);
    };
    const removeAccount = (account) => {
        if (!window.confirm(t('comp.removeAccountConfirm')))
            return;
        persistAccounts(accounts.filter(candidate => candidate.id !== account.id));
        if (accountForm?.id === account.id)
            setAccountForm(undefined);
    };
    const importAccountFile = async (file) => {
        const result = importAccounts(await file.text(), accounts);
        persistAccounts(result.accounts);
        setActionError(t('comp.importResult', { added: result.added, skipped: result.skipped }));
    };
    const exportAccountFile = () => {
        const blob = new Blob([exportAccounts(accounts)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'competitor-accounts.json';
        anchor.click();
        URL.revokeObjectURL(url);
    };
    const submitWork = () => {
        if (workFormState.title.trim().length === 0)
            return;
        const account = accounts.find(candidate => candidate.id === workFormState.accountId);
        void act(async () => {
            const id = newId('cw');
            const textFile = workFormState.body.trim().length > 0 ? `${id}.md` : undefined;
            if (textFile !== undefined) {
                await writeAsset({ theme, file: textFile, content: `${workFormState.body.trim()}\n` });
            }
            const metrics = {
                t: new Date().toISOString(),
                likes: numberField(workFormState.likes),
                comments: numberField(workFormState.comments),
                shares: numberField(workFormState.shares),
                ...(workFormState.views.trim().length > 0 ? { views: numberField(workFormState.views) } : {}),
            };
            const upsert = upsertWork(current, {
                accountId: account?.id ?? 'unassigned',
                accountName: account?.name ?? t('comp.unassigned'),
                platform: workFormState.platform,
                platformWorkId: workFormState.platformWorkId,
                title: workFormState.title.trim(),
                ...(workFormState.url.trim().length > 0 ? { url: workFormState.url.trim() } : {}),
                ...(workFormState.publishedDate.length > 0 ? { publishedAt: new Date(workFormState.publishedDate).toISOString() } : {}),
                ...(textFile !== undefined ? { textFile } : {}),
                metrics,
            });
            await commitManifest(upsert.manifest);
            setImportOpen(false);
            setWorkFormState(workForm(account?.id ?? '', workFormState.platform));
        });
    };
    const toggleFlag = (work, flag) => {
        void act(async () => {
            await commitManifest({
                ...current,
                works: current.works.map(candidate => candidate.id === work.id ? { ...candidate, [flag]: !candidate[flag] } : candidate),
            });
        });
    };
    const removeWork = (work) => {
        // Removal deletes the work's asset snapshots from disk, so it is guarded
        // like the other destructive actions instead of firing on a single click.
        if (!window.confirm(t('comp.removeWorkConfirm')))
            return;
        void act(async () => {
            const files = [work.textFile, work.analysis.ref].filter((file) => file !== undefined);
            for (const file of files)
                await deleteAsset(theme, file);
            await commitManifest({
                ...current,
                works: current.works.filter(candidate => candidate.id !== work.id),
            });
            if (selectedWorkId === work.id)
                setSelectedWorkId(undefined);
        });
    };
    const analyze = (work) => {
        if (pendingAnalysis.includes(work.id))
            return;
        setPendingAnalysis(pending => [...pending, work.id]);
        void act(async () => {
            const score = interactionScore(work.metrics);
            try {
                const result = await analyzeCompetitorWork({
                    theme,
                    ...(work.textFile !== undefined ? { textFile: work.textFile } : {}),
                    title: work.title,
                    ...(work.url !== undefined ? { url: work.url } : {}),
                    stats: t('comp.statLine', { score, likes: work.metrics.at(-1)?.likes ?? 0, comments: work.metrics.at(-1)?.comments ?? 0, shares: work.metrics.at(-1)?.shares ?? 0 }),
                    ...(commentsDraft.trim().length > 0 ? { comments: commentsDraft.trim() } : {}),
                });
                const ref = `ca-${work.id.slice(3)}.md`;
                await writeAsset({ theme, file: ref, content: result.markdown });
                await commitManifest({
                    ...current,
                    works: current.works.map(candidate => candidate.id === work.id
                        ? {
                            ...candidate,
                            analysis: {
                                status: 'done',
                                ref,
                                result: {
                                    hookType: result.hookType,
                                    structure: result.structure,
                                    painPoints: result.painPoints,
                                    topics: result.topics,
                                    risks: result.risks,
                                    reusable: result.reusable,
                                    migrationTopics: result.migrationTopics,
                                    commentInsight: result.commentInsight,
                                },
                            },
                        }
                        : candidate),
                });
            }
            catch (error) {
                await commitManifest({
                    ...current,
                    works: current.works.map(candidate => candidate.id === work.id
                        ? { ...candidate, analysis: { status: 'failed', error: error instanceof Error ? error.message : String(error) } }
                        : candidate),
                });
                throw error;
            }
            finally {
                setPendingAnalysis(pending => pending.filter(id => id !== work.id));
            }
        });
    };
    const collectNow = (accountIds) => {
        if (manifest === undefined)
            return;
        const syncedAt = { ...manifest.syncedAt };
        for (const id of accountIds)
            syncedAt[id] = new Date().toISOString();
        void act(() => commitManifest({ ...manifest, syncedAt }));
    };
    const addIdea = (work) => {
        void act(async () => {
            const file = `idea-${work.id.slice(3)}.md`;
            await writeAsset({ theme, file, content: buildIdeaMarkdown(work, work.analysis.result?.migrationTopics[0]) });
            await commitManifest({
                ...current,
                works: current.works.map(candidate => candidate.id === work.id ? { ...candidate, collectedIdeaRef: file } : candidate),
            });
        });
    };
    const generate = (kind, ids) => {
        if (manifest === undefined || generating)
            return;
        const chosen = accounts.filter(account => ids.includes(account.id));
        if (chosen.length !== ids.length)
            return;
        setGenerating(true);
        void act(async () => {
            try {
                const digests = chosen.map(account => ({
                    name: account.name,
                    digest: aggregateAccountDigest(account.name, account.platform, current.works.filter(work => work.accountId === account.id)),
                }));
                const result = await generateCompetitorReport({ kind, accounts: digests });
                const id = newId('cr');
                const ref = `${id}.md`;
                await writeAsset({ theme, file: ref, content: result.markdown });
                const report = {
                    // The report id is the gateway's branded type; this view mints it.
                    id: id,
                    kind,
                    accountIds: chosen.map(account => account.id),
                    accountNames: chosen.map(account => account.name),
                    ref,
                    createdAt: new Date().toISOString(),
                    workCount: chosen.reduce((sum, account) => sum + current.works.filter(work => work.accountId === account.id).length, 0),
                };
                await commitManifest({ ...manifest, reports: [report, ...manifest.reports] });
                setSelectedReportId(id);
            }
            finally {
                setGenerating(false);
            }
        });
    };
    const themeInput = (_jsxs("label", { className: css.compThemeRow, children: [_jsx("span", { children: t('comp.theme') }), _jsx("input", { className: css.compInput, list: "comp-theme-options", placeholder: t('comp.themePlaceholder'), value: theme, onChange: (event) => { selectTheme(event.currentTarget.value); } }), _jsx("datalist", { id: "comp-theme-options", children: projects.map(project => _jsx("option", { value: project.topic }, project.topic)) })] }));
    const sectionBar = (_jsx("div", { className: css.compSections, role: "tablist", children: SECTIONS.map(candidate => (_jsx("button", { type: "button", role: "tab", "aria-selected": section === candidate, className: clsx(css.tab, section === candidate && css.tabActive), onClick: () => { setSection(candidate); }, children: t(SECTION_KEYS[candidate]) }, candidate))) }));
    return (_jsxs("div", { className: css.comp, children: [_jsxs("div", { className: css.compToolbar, children: [themeInput, sectionBar] }), theme.length === 0 && _jsx("div", { className: css.compBanner, children: t('comp.noTheme') }), storageDegraded && _jsx("div", { className: css.compBanner, children: t('comp.storageDegraded') }), manifestError !== undefined && (_jsxs("div", { className: css.compBanner, children: [_jsx(IconWarningOutline16, { size: 14 }), _jsxs("span", { children: [t('comp.manifestError'), ": ", manifestError] })] })), manifestProblems.length > 0 && (_jsxs("div", { className: css.compBanner, role: "alert", children: [_jsx(IconWarningOutline16, { size: 14 }), _jsx("span", { children: t('comp.manifestProblems', { n: manifestProblems.length }) })] })), manifest !== undefined && stale.length > 0 && section !== 'accounts' && (_jsxs("div", { className: css.compBanner, children: [_jsx("span", { children: t('comp.stale', { names: stale.map(account => account.name).join('、') }) }), _jsx("button", { type: "button", className: css.retry, onClick: () => { collectNow(stale.map(account => account.id)); }, children: t('comp.markCollected') })] })), actionError !== undefined && _jsxs("div", { className: css.compBanner, children: [t('comp.actionError'), ": ", actionError] }), section === 'accounts' && (_jsx(AccountsSection, { accounts: accounts, form: accountForm, onForm: setAccountForm, onSubmit: submitAccount, onRemove: removeAccount, onImport: (file) => { void importAccountFile(file); }, onExport: exportAccountFile, onToggle: (account) => {
                    persistAccounts(accounts.map(candidate => (candidate.id === account.id ? { ...candidate, enabled: !candidate.enabled } : candidate)));
                }, manifest: manifest, onCollect: (ids) => { collectNow(ids); }, t: t })), section === 'works' && (_jsxs("div", { className: css.compSplit, children: [_jsxs("div", { className: css.compListPane, children: [_jsxs("div", { className: css.compFilterRow, children: [_jsxs("select", { className: css.compInput, value: workFormState.accountId, onChange: (event) => { setWorkFormState(workForm(event.currentTarget.value, workFormState.platform)); }, children: [_jsx("option", { value: "", children: t('comp.filterAllAccounts') }), accounts.map(account => _jsx("option", { value: account.id, children: account.name }, account.id))] }), _jsxs("select", { className: css.compInput, value: flagFilter, onChange: (event) => { setFlagFilter(event.currentTarget.value); }, children: [_jsx("option", { value: "all", children: t('comp.filterAll') }), _jsx("option", { value: "hot", children: t('comp.filterHot') }), _jsx("option", { value: "favorite", children: t('comp.filterFavorite') }), _jsx("option", { value: "analyzed", children: t('comp.filterAnalyzed') }), _jsx("option", { value: "unanalyzed", children: t('comp.filterUnanalyzed') })] }), _jsx("input", { className: css.compInput, placeholder: t('comp.search'), value: query, onChange: (event) => { setQuery(event.currentTarget.value); } })] }), _jsxs("div", { className: css.compImportRow, children: [_jsx("button", { type: "button", className: css.retry, disabled: theme.length === 0, onClick: () => { setImportOpen(!importOpen); }, children: importOpen ? t('comp.importClose') : t('comp.importOpen') }), _jsx("span", { className: css.listMeta, children: t('comp.workCount', { n: current.works.length }) })] }), importOpen && (_jsx(WorkImportForm, { form: workFormState, accounts: accounts, onForm: setWorkFormState, onSubmit: submitWork, disabled: theme.length === 0, t: t })), _jsx("div", { className: css.compWorkList, children: works.length === 0
                                    ? _jsx("p", { className: css.panelEmpty, children: t('comp.worksEmpty') })
                                    : works.map(work => (_jsx(WorkRow, { work: work, heat: heat.get(work.id), pending: pendingAnalysis.includes(work.id), active: work.id === selectedWorkId, onOpen: () => { setSelectedWorkId(work.id); setCommentsDraft(''); }, t: t }, work.id))) })] }), _jsx("div", { className: css.compDetailPane, children: selectedWork === undefined
                            ? _jsx("p", { className: css.panelEmpty, children: t('comp.pickWork') })
                            : (_jsx(WorkDetail, { work: selectedWork, themeReady: theme.length > 0, pending: pendingAnalysis.includes(selectedWork.id), previewText: previewText, commentsDraft: commentsDraft, onCommentsDraft: setCommentsDraft, onAnalyze: () => { analyze(selectedWork); }, onToggleHot: () => { toggleFlag(selectedWork, 'hot'); }, onToggleFavorite: () => { toggleFlag(selectedWork, 'favorite'); }, onIdea: () => { addIdea(selectedWork); }, onRemove: () => { removeWork(selectedWork); }, t: t })) })] })), section === 'reports' && (_jsxs("div", { className: css.compSplit, children: [_jsxs("div", { className: css.compListPane, children: [_jsxs("div", { className: css.compReportPicker, children: [_jsx("p", { className: css.compFieldLabel, children: t('comp.reportAccount') }), _jsxs("select", { className: css.compInput, value: compareIds[0] ?? '', onChange: (event) => { setCompareIds([event.currentTarget.value]); }, children: [_jsx("option", { value: "", children: t('comp.pickAccount') }), accounts.map(account => _jsx("option", { value: account.id, children: account.name }, account.id))] }), _jsx("button", { type: "button", className: css.retry, disabled: theme.length === 0 || generating || compareIds.length !== 1, onClick: () => {
                                            const first = compareIds[0];
                                            if (first !== undefined)
                                                generate('account', [first]);
                                        }, children: t('comp.generateAccountReport') }), _jsx("p", { className: css.compFieldLabel, children: t('comp.reportCompare') }), _jsxs("select", { className: css.compInput, value: compareIds[1] ?? '', onChange: (event) => { setCompareIds([compareIds[0] ?? '', event.currentTarget.value].filter(id => id.length > 0).slice(0, 2)); }, children: [_jsx("option", { value: "", children: t('comp.pickAccount') }), accounts
                                                .filter(account => account.id !== compareIds[0])
                                                .map(account => _jsx("option", { value: account.id, children: account.name }, account.id))] }), _jsx("button", { type: "button", className: css.retry, disabled: theme.length === 0 || generating || compareIds.length !== 2, onClick: () => { generate('compare', compareIds); }, children: t('comp.generateCompareReport') }), generating && _jsx("p", { className: css.panelEmpty, children: t('comp.generating') })] }), _jsx("div", { className: css.compWorkList, children: current.reports.length === 0
                                    ? _jsx("p", { className: css.panelEmpty, children: t('comp.reportsEmpty') })
                                    : current.reports.map(report => (_jsxs("button", { type: "button", className: clsx(css.listRowButton, report.id === selectedReportId && css.listRowCopied), onClick: () => { setSelectedReportId(report.id); }, children: [_jsxs("span", { className: css.listTitle, children: [t(report.kind === 'account' ? 'comp.reportKindAccount' : 'comp.reportKindCompare'), " \u00B7 ", report.accountNames.join(' vs ')] }), _jsxs("span", { className: css.listMeta, children: [report.createdAt.slice(0, 10), " \u00B7 ", t('comp.reportWorks', { n: report.workCount })] })] }, report.id))) })] }), _jsx("div", { className: css.compDetailPane, children: selectedReport === undefined
                            ? _jsx("p", { className: css.panelEmpty, children: t('comp.pickReport') })
                            : _jsx("pre", { className: css.compReport, children: reportText ?? t('comp.reportLoading') }) })] })), _jsx("p", { className: css.compCompliance, children: t('comp.compliance') })] }));
}
/** One work row in the list: title, account, heat badge, and analysis state. */
function WorkRow({ work, heat, pending, active, onOpen, t }) {
    const analysisKey = pending
        ? 'comp.analysisRunning'
        : work.analysis.status === 'done' ? 'comp.analysisDone' : work.analysis.status === 'failed' ? 'comp.analysisFailed' : 'comp.analysisNone';
    return (_jsxs("button", { type: "button", className: clsx(css.listRowButton, active && css.listRowCopied), onClick: onOpen, children: [_jsxs("span", { className: css.listTitle, children: [work.hot && '🔥 ', work.title] }), _jsxs("span", { className: css.listMeta, children: [work.accountName, " \u00B7 ", t(PLATFORM_KEYS[work.platform])] }), _jsxs("span", { className: css.listMeta, children: [heat !== undefined && _jsx("span", { className: clsx(css.badge, heat.level === 'hot' ? css.compBadgeHot : heat.level === 'cold' ? css.badgeIncoming : css.statusDraft), children: t(`comp.heat.${heat.level}`) }), ' ', _jsx("span", { className: clsx(css.badge, work.analysis.status === 'done' ? css.badgeDone : work.analysis.status === 'failed' ? css.compBadgeFailed : css.badgeIncoming), children: t(analysisKey) })] })] }));
}
/** The work detail pane: facts, markers, actions, teardown result, and preview. */
function WorkDetail({ work, themeReady, pending, previewText, commentsDraft, onCommentsDraft, onAnalyze, onToggleHot, onToggleFavorite, onIdea, onRemove, t, }) {
    const result = work.analysis.result;
    return (_jsxs("div", { className: css.compDetail, children: [_jsxs("div", { className: css.compDetailHead, children: [_jsx("strong", { className: css.compDetailTitle, children: work.title }), _jsxs("span", { className: css.listMeta, children: [work.accountName, " \u00B7 ", t(PLATFORM_KEYS[work.platform]), work.publishedAt !== undefined && ` · ${work.publishedAt.slice(0, 10)}`, work.url !== undefined && _jsxs(_Fragment, { children: [" \u00B7 ", _jsx("a", { href: work.url, target: "_blank", rel: "noreferrer", children: t('comp.openOriginal') })] })] })] }), _jsxs("div", { className: css.compActions, children: [_jsx("button", { type: "button", className: css.retry, disabled: !themeReady || pending, onClick: onAnalyze, children: pending ? t('comp.analysisRunning') : work.analysis.status === 'done' ? t('comp.reanalyze') : t('comp.analyze') }), _jsx("button", { type: "button", className: css.retry, onClick: onToggleHot, children: work.hot ? t('comp.unmarkHot') : t('comp.markHot') }), _jsx("button", { type: "button", className: css.retry, onClick: onToggleFavorite, children: work.favorite ? t('comp.unmarkFavorite') : t('comp.markFavorite') }), _jsx("button", { type: "button", className: css.retry, disabled: !themeReady || work.collectedIdeaRef !== undefined, onClick: onIdea, title: work.collectedIdeaRef, children: t('comp.addIdea') }), _jsx("button", { type: "button", className: css.retry, onClick: onRemove, "aria-label": t('comp.removeWork'), children: _jsx(IconTrashOutline16, { size: 12 }) })] }), work.analysis.status === 'failed' && (_jsxs("div", { className: css.compBanner, role: "alert", children: [_jsx(IconWarningOutline16, { size: 14 }), _jsxs("span", { children: [t('comp.analysisFailed'), ": ", work.analysis.error] })] })), result !== undefined && (_jsxs("div", { className: css.compResult, children: [_jsxs("p", { className: css.compResultLine, children: [_jsx("strong", { children: t('comp.hookType') }), result.hookType] }), _jsxs("p", { className: css.compResultLine, children: [_jsx("strong", { children: t('comp.structure') }), result.structure] }), _jsx(ListBlock, { label: t('comp.painPoints'), values: result.painPoints }), _jsx(ListBlock, { label: t('comp.topics'), values: result.topics }), _jsx(ListBlock, { label: t('comp.risks'), values: result.risks }), _jsx(ListBlock, { label: t('comp.reusable'), values: result.reusable }), _jsx(ListBlock, { label: t('comp.migrationTopics'), values: result.migrationTopics }), _jsxs("p", { className: css.compResultLine, children: [_jsx("strong", { children: t('comp.commentInsight') }), result.commentInsight === 'unavailable' ? t('comp.commentUnavailable') : result.commentInsight] })] })), _jsxs("label", { className: css.compFieldLabel, children: [t('comp.commentsInput'), _jsx("textarea", { className: css.compTextarea, rows: 3, value: commentsDraft, onChange: (event) => { onCommentsDraft(event.currentTarget.value); }, placeholder: t('comp.commentsPlaceholder') })] }), _jsxs("details", { className: css.compPreview, children: [_jsx("summary", { children: t('comp.previewBody') }), work.textFile === undefined
                        ? _jsx("p", { className: css.panelEmpty, children: t('comp.noBody') })
                        : _jsx("pre", { className: css.compReport, children: previewText === undefined ? t('comp.reportLoading') : previewText })] })] }));
}
/** One labeled string list inside the teardown result. */
function ListBlock({ label, values }) {
    if (values.length === 0)
        return null;
    return (_jsxs("div", { className: css.compResultLine, children: [_jsx("strong", { children: label }), _jsx("ul", { className: css.compResultList, children: values.map(value => _jsx("li", { children: value }, value)) })] }));
}
/** The manual import form (phase-one collection path). */
function WorkImportForm({ form, accounts, onForm, onSubmit, disabled, t }) {
    const field = (key) => (event) => {
        onForm({ ...form, [key]: event.currentTarget.value });
    };
    return (_jsxs("form", { className: css.compForm, onSubmit: (event) => { event.preventDefault(); onSubmit(); }, children: [_jsxs("div", { className: css.compFormRow, children: [_jsxs("select", { className: css.compInput, value: form.accountId, onChange: field('accountId'), "aria-label": t('comp.fieldAccount'), children: [_jsx("option", { value: "", children: t('comp.fieldAccount') }), accounts.map(account => _jsx("option", { value: account.id, children: account.name }, account.id))] }), _jsx("select", { className: css.compInput, value: form.platform, onChange: field('platform'), "aria-label": t('comp.fieldPlatform'), children: COMPETITOR_PLATFORMS.map(platform => _jsx("option", { value: platform, children: t(PLATFORM_KEYS[platform]) }, platform)) })] }), _jsx("input", { className: css.compInput, placeholder: t('comp.fieldTitle'), value: form.title, onChange: field('title') }), _jsxs("div", { className: css.compFormRow, children: [_jsx("input", { className: css.compInput, placeholder: t('comp.fieldWorkId'), value: form.platformWorkId, onChange: field('platformWorkId') }), _jsx("input", { className: css.compInput, placeholder: t('comp.fieldUrl'), value: form.url, onChange: field('url') })] }), _jsxs("div", { className: css.compFormRow, children: [_jsx("input", { className: css.compInput, type: "date", "aria-label": t('comp.fieldPublished'), value: form.publishedDate, onChange: field('publishedDate') }), _jsx("input", { className: css.compInput, inputMode: "numeric", placeholder: t('comp.fieldLikes'), value: form.likes, onChange: field('likes') }), _jsx("input", { className: css.compInput, inputMode: "numeric", placeholder: t('comp.fieldComments'), value: form.comments, onChange: field('comments') }), _jsx("input", { className: css.compInput, inputMode: "numeric", placeholder: t('comp.fieldShares'), value: form.shares, onChange: field('shares') }), _jsx("input", { className: css.compInput, inputMode: "numeric", placeholder: t('comp.fieldViews'), value: form.views, onChange: field('views') })] }), _jsx("textarea", { className: css.compTextarea, rows: 4, placeholder: t('comp.fieldBody'), value: form.body, onChange: field('body') }), _jsxs("div", { className: css.compFormRow, children: [_jsx("button", { type: "submit", className: css.retry, disabled: disabled || form.title.trim().length === 0, children: t('comp.importSubmit') }), _jsx("span", { className: css.listMeta, children: t('comp.importHint') })] })] }));
}
/** The account registry section. */
function AccountsSection({ accounts, form, onForm, onSubmit, onRemove, onImport, onExport, onToggle, manifest, onCollect, t }) {
    const fileInputId = 'comp-account-import';
    return (_jsxs("div", { className: css.compAccounts, children: [_jsxs("div", { className: css.compImportRow, children: [_jsx("button", { type: "button", className: css.retry, onClick: () => { onForm(form === undefined ? accountForm() : undefined); }, children: form === undefined ? t('comp.accountAdd') : t('comp.accountCancel') }), _jsx("label", { className: css.retry, htmlFor: fileInputId, children: t('comp.accountImport') }), _jsx("input", { id: fileInputId, type: "file", accept: "application/json,.json", className: css.compFileInput, onChange: (event) => {
                            const file = event.currentTarget.files?.[0];
                            if (file !== undefined)
                                onImport(file);
                            event.currentTarget.value = '';
                        } }), _jsx("button", { type: "button", className: css.retry, disabled: accounts.length === 0, onClick: onExport, children: t('comp.accountExport') }), _jsx("span", { className: css.listMeta, children: t('comp.accountCount', { n: accounts.length }) })] }), form !== undefined && (_jsxs("form", { className: css.compForm, onSubmit: (event) => { event.preventDefault(); onSubmit(); }, children: [_jsxs("div", { className: css.compFormRow, children: [_jsx("input", { className: css.compInput, placeholder: t('comp.fieldName'), value: form.name, onChange: (event) => { onForm({ ...form, name: event.currentTarget.value }); } }), _jsx("select", { className: css.compInput, value: form.platform, onChange: (event) => { onForm({ ...form, platform: event.currentTarget.value }); }, "aria-label": t('comp.fieldPlatform'), children: COMPETITOR_PLATFORMS.map(platform => _jsx("option", { value: platform, children: t(PLATFORM_KEYS[platform]) }, platform)) }), _jsxs("select", { className: css.compInput, value: form.priority, onChange: (event) => { onForm({ ...form, priority: event.currentTarget.value }); }, "aria-label": t('comp.fieldPriority'), children: [_jsx("option", { value: "high", children: t('comp.priority.high') }), _jsx("option", { value: "medium", children: t('comp.priority.medium') }), _jsx("option", { value: "low", children: t('comp.priority.low') })] }), _jsxs("select", { className: css.compInput, value: form.intervalDays, onChange: (event) => { onForm({ ...form, intervalDays: Number(event.currentTarget.value) }); }, "aria-label": t('comp.fieldInterval'), children: [_jsx("option", { value: 1, children: t('comp.intervalDaily') }), _jsx("option", { value: 3, children: t('comp.interval3d') }), _jsx("option", { value: 7, children: t('comp.intervalWeekly') })] })] }), _jsx("input", { className: css.compInput, placeholder: t('comp.fieldHomepage'), value: form.homepageUrl, onChange: (event) => { onForm({ ...form, homepageUrl: event.currentTarget.value }); } }), _jsx("input", { className: css.compInput, placeholder: t('comp.fieldTopics'), value: form.topics, onChange: (event) => { onForm({ ...form, topics: event.currentTarget.value }); } }), _jsxs("div", { className: css.compFormRow, children: [_jsx("input", { className: css.compInput, placeholder: t('comp.fieldPositioning'), value: form.positioning, onChange: (event) => { onForm({ ...form, positioning: event.currentTarget.value }); } }), _jsx("input", { className: css.compInput, placeholder: t('comp.fieldFollowerTier'), value: form.followerTier, onChange: (event) => { onForm({ ...form, followerTier: event.currentTarget.value }); } }), _jsx("input", { className: css.compInput, placeholder: t('comp.fieldMonetization'), value: form.monetization, onChange: (event) => { onForm({ ...form, monetization: event.currentTarget.value }); } })] }), _jsx("input", { className: css.compInput, placeholder: t('comp.fieldNote'), value: form.note, onChange: (event) => { onForm({ ...form, note: event.currentTarget.value }); } }), _jsx("div", { className: css.compFormRow, children: _jsx("button", { type: "submit", className: css.retry, disabled: form.name.trim().length === 0, children: t('comp.accountSave') }) })] })), _jsx("div", { className: css.compWorkList, children: accounts.length === 0
                    ? _jsx("p", { className: css.panelEmpty, children: t('comp.accountsEmpty') })
                    : accounts.map((account) => {
                        const workCount = manifest?.works.filter(work => work.accountId === account.id).length ?? 0;
                        const hotCount = manifest?.works.filter(work => work.accountId === account.id && work.hot).length ?? 0;
                        const lastSynced = manifest?.syncedAt[account.id];
                        return (_jsxs("div", { className: css.compAccountCard, children: [_jsxs("div", { className: css.compDetailHead, children: [_jsx("strong", { children: account.name }), _jsx("span", { className: clsx(css.badge, PRIORITY_CLASS[account.priority]), children: t(`comp.priority.${account.priority}`) }), _jsxs("span", { className: css.listMeta, children: [t(PLATFORM_KEYS[account.platform]), account.topics.length > 0 && ` · ${account.topics.join(' / ')}`] })] }), _jsxs("span", { className: css.listMeta, children: [t('comp.accountWorks', { n: workCount, hot: hotCount }), ' · ', lastSynced === undefined ? t('comp.neverCollected') : t('comp.lastCollected', { date: lastSynced.slice(0, 10) })] }), account.positioning.length > 0 && _jsx("span", { className: css.listMeta, children: account.positioning }), _jsxs("div", { className: css.compActions, children: [_jsx("button", { type: "button", className: css.retry, onClick: () => { onToggle(account); }, children: account.enabled ? t('comp.accountDisable') : t('comp.accountEnable') }), _jsxs("button", { type: "button", className: css.retry, disabled: manifest === undefined, onClick: () => { onCollect([account.id]); }, children: [_jsx(IconRefreshOutline14, { size: 12 }), " ", t('comp.markCollectedOne')] }), _jsx("button", { type: "button", className: css.retry, onClick: () => { onForm(accountForm(account)); }, children: t('comp.accountEdit') }), _jsx("button", { type: "button", className: css.retry, onClick: () => { onRemove(account); }, "aria-label": t('comp.accountRemove'), children: _jsx(IconTrashOutline16, { size: 12 }) })] })] }, account.id));
                    }) })] }));
}
//# sourceMappingURL=CompetitorsView.js.map