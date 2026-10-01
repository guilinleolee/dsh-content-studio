import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The workbench home (Easel-style dashboard): greeting, verb chips and the
 * five quick-create entries, eight stat cards over four Remotes (outputs,
 * schedule, topics, interactions) plus a per-theme review digest, and a
 * 2×3 panel grid — quick-create rows, recent topics, recent deliverables,
 * the merged activity/reminders feed, and the reads/likes preview. Each
 * panel hops to its full view; one failing Remote never blanks the home.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { IconCheckOutline16, IconChecklistOutline14, IconEditOutline16, IconFolderOpenOutline16, IconGoalOutline16, IconNewChatOutline16, IconSparkle16, writeClipboard, } from '@deepseek-ai/dsh-client-ui-primitives';
import { CAPABILITY_ITEMS } from "./capabilities.js";
import css from './ContentStudio.module.css';
/** Quick-create panel rows: these capability ids, in this order. */
const QUICK_IDS = ['social-card', 'gzh-article', 'short-script', 'multi-platform', 'pre-publish'];
/** The five quick-create entries and the view each one opens. */
const NEW_ENTRIES = [
    { view: 'gather', key: 'nav.gather' },
    { view: 'competitors', key: 'nav.competitors' },
    { view: 'topicBank', key: 'nav.topicBank' },
    { view: 'persona', key: 'nav.persona' },
    { view: 'publish', key: 'nav.publish' },
];
/** How long a row shows its copied state before reverting. */
const COPIED_FEEDBACK_MS = 1600;
/** Greeting bucket by hour of day. */
function greetKey(hour) {
    return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}
/** Find one capability by id (the catalog is static, ids are pinned by test). */
function cap(id) {
    const found = CAPABILITY_ITEMS.find(item => item.id === id);
    if (found === undefined)
        throw new Error(`unknown capability id: ${id}`);
    return found;
}
/**
 * Aggregate one theme's snapshots into the preview digest: the latest
 * snapshot per work, null metrics skipped (never faked as zero).
 * @param read - the theme's review manifest read.
 * @param digest - the accumulator to merge into.
 * @returns the updated digest.
 */
function foldReviewDigest(read, digest) {
    const manifest = read.manifest;
    if (manifest === null)
        return digest;
    const latest = new Map();
    for (const snapshot of manifest.snapshots) {
        latest.set(`${snapshot.platformId}:${snapshot.platformWorkId}`, snapshot.capturedAt);
    }
    const pick = (key) => {
        let total = null;
        for (const snapshot of manifest.snapshots) {
            if (latest.get(`${snapshot.platformId}:${snapshot.platformWorkId}`) !== snapshot.capturedAt)
                continue;
            const value = snapshot.metrics[key];
            if (value === null)
                continue;
            total = (total ?? 0) + value;
        }
        return total;
    };
    return {
        works: digest.works + latest.size,
        reads: addMetric(digest.reads, pick('reads')),
        likes: addMetric(digest.likes, pick('likes')),
        followers: addMetric(digest.followers, pick('followersGained')),
        themesAwaitingReview: digest.themesAwaitingReview
            + (manifest.snapshots.length > 0 && manifest.tasks.length === 0 ? 1 : 0),
    };
}
const EMPTY_DIGEST = { works: 0, reads: null, likes: null, followers: null, themesAwaitingReview: 0 };
/** Merge two optional metric totals; a missing side never fakes a zero. */
function addMetric(base, addend) {
    return base === null ? addend : addend === null ? base : base + addend;
}
/**
 * Render the workbench home.
 * @param props - the Remote read wrappers, view navigation, and the locale seat.
 * @returns the dashboard element tree.
 */
export function ContentWorkbench({ listOutputs, listSchedule, listTopics, readInteractions, readReviewManifest, onNavigate, onChat, account, persona, t, }) {
    const [outputs, setOutputs] = useState({ state: 'loading' });
    const [schedule, setSchedule] = useState({ state: 'loading' });
    const [topics, setTopics] = useState({ state: 'loading' });
    const [interactions, setInteractions] = useState({ state: 'loading' });
    const [review, setReview] = useState({ state: 'loading' });
    const [copiedId, setCopiedId] = useState(undefined);
    const loadOutputs = useCallback(async () => {
        setOutputs({ state: 'loading' });
        try {
            setOutputs({ state: 'ok', value: await listOutputs() });
        }
        catch (error) {
            console.error('[content-studio] contentOutputs/list failed:', error);
            setOutputs({ state: 'failed', detail: error instanceof Error ? error.message : String(error) });
        }
    }, [listOutputs]);
    const loadSchedule = useCallback(async () => {
        setSchedule({ state: 'loading' });
        try {
            setSchedule({ state: 'ok', value: await listSchedule() });
        }
        catch (error) {
            console.error('[content-studio] contentSchedule/list failed:', error);
            setSchedule({ state: 'failed', detail: error instanceof Error ? error.message : String(error) });
        }
    }, [listSchedule]);
    const loadTopics = useCallback(async () => {
        setTopics({ state: 'loading' });
        try {
            setTopics({ state: 'ok', value: await listTopics() });
        }
        catch (error) {
            console.error('[content-studio] contentTopics/list failed:', error);
            setTopics({ state: 'failed', detail: error instanceof Error ? error.message : String(error) });
        }
    }, [listTopics]);
    const loadInteractions = useCallback(async () => {
        setInteractions({ state: 'loading' });
        try {
            setInteractions({ state: 'ok', value: await readInteractions() });
        }
        catch (error) {
            console.error('[content-studio] readInteractions failed:', error);
            setInteractions({ state: 'failed', detail: error instanceof Error ? error.message : String(error) });
        }
    }, [readInteractions]);
    useEffect(() => { void loadOutputs(); }, [loadOutputs]);
    useEffect(() => { void loadSchedule(); }, [loadSchedule]);
    useEffect(() => { void loadTopics(); }, [loadTopics]);
    useEffect(() => { void loadInteractions(); }, [loadInteractions]);
    // The review digest needs the theme list first, so it rides the outputs load.
    useEffect(() => {
        if (outputs.state !== 'ok')
            return;
        let cancelled = false;
        void (async () => {
            setReview({ state: 'loading' });
            try {
                const themes = outputs.value.projects.map(project => project.topic);
                const digests = await Promise.all(themes.map(async (theme) => readReviewManifest(theme).then(read => foldReviewDigest(read, { ...EMPTY_DIGEST }))));
                if (cancelled)
                    return;
                const folded = digests.reduce((acc, cur) => ({
                    works: acc.works + cur.works,
                    reads: addMetric(acc.reads, cur.reads),
                    likes: addMetric(acc.likes, cur.likes),
                    followers: addMetric(acc.followers, cur.followers),
                    themesAwaitingReview: acc.themesAwaitingReview + cur.themesAwaitingReview,
                }), { ...EMPTY_DIGEST });
                setReview({ state: 'ok', value: folded });
            }
            catch (error) {
                if (cancelled)
                    return;
                console.error('[content-studio] review digest failed:', error);
                setReview({ state: 'failed', detail: error instanceof Error ? error.message : String(error) });
            }
        })();
        return () => { cancelled = true; };
    }, [outputs, readReviewManifest]);
    useEffect(() => {
        if (copiedId === undefined)
            return;
        const timer = window.setTimeout(() => { setCopiedId(undefined); }, COPIED_FEEDBACK_MS);
        return () => { window.clearTimeout(timer); };
    }, [copiedId]);
    const quick = useMemo(() => QUICK_IDS.map(id => cap(id)), []);
    const pick = async (item) => {
        const identity = account === '通用模式'
            ? persona.length > 0 ? `账号画像：${persona}` : ''
            : persona.length > 0 ? `我的账号/画像：${account}
账号画像：${persona}` : `我的账号/画像：${account}`;
        const prompt = identity.length > 0 ? `${identity}

${item.prompt}` : item.prompt;
        if (await writeClipboard(prompt))
            setCopiedId(item.id);
    };
    if (outputs.state === 'failed')
        console.warn('[content-studio] outputs panel degraded:', outputs.detail);
    if (schedule.state === 'failed')
        console.warn('[content-studio] schedule panel degraded:', schedule.detail);
    const projects = outputs.state === 'ok' ? outputs.value.projects : [];
    const ready = projects.filter(project => project.status === 'ready').length;
    const publishedProjects = projects.filter(project => project.status === 'published').length;
    const items = schedule.state === 'ok' ? schedule.value.items : [];
    const today = new Date().toISOString().slice(0, 10);
    const todayDue = items.filter(item => item.status !== 'published' && item.date === today).length;
    const scheduledTasks = items.filter(item => item.status !== 'published' && item.date > today).length;
    const topicItems = topics.state === 'ok' ? topics.value.items : [];
    const topicTodo = topicItems.filter(topic => topic.status === 'idea' || topic.status === 'todo' || topic.status === 'creating').length;
    const topicDone = topicItems.filter(topic => topic.status === 'done').length;
    const summary = interactions.state === 'ok'
        ? interactions.value.manifest?.summary ?? null
        : null;
    const recentTopics = [...topicItems]
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, 5);
    const recentFinals = [...projects]
        .filter(project => project.status === 'ready' || project.status === 'published')
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, 5);
    // The merged activity/reminders feed: topics born, works moved, schedule
    // coming due, replies waiting, themes ready for their review pass.
    const feed = useMemo(() => {
        const entries = [];
        for (const topic of recentTopics) {
            entries.push({ key: `topic:${topic.id}`, at: topic.updatedAt, label: `${t('workbench.tl.newTopic')}「${topic.title}」`, view: 'topicBank' });
        }
        for (const project of [...projects].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 5)) {
            entries.push({
                key: `project:${project.topic}`,
                at: project.updatedAt,
                label: `「${project.title}」· ${t(`status.${project.status}`)}`,
                view: 'library',
            });
        }
        for (const item of items.filter(candidate => candidate.status !== 'published' && candidate.date >= today).slice(0, 5)) {
            entries.push({ key: `schedule:${item.id}`, at: item.date, label: `${t('workbench.tl.due')}「${item.title}」`, view: 'calendar' });
        }
        const manifest = interactions.state === 'ok' ? interactions.value.manifest : null;
        if (manifest !== null) {
            const waiting = manifest.summary.unread + manifest.summary.pendingReply;
            if (waiting > 0) {
                entries.push({ key: 'interaction:waiting', at: manifest.conversations[0]?.updatedAt ?? today, label: `${t('workbench.tl.reply')} ×${waiting}`, view: 'interaction' });
            }
        }
        if (review.state === 'ok' && review.value.themesAwaitingReview > 0) {
            entries.push({
                key: 'review:waiting',
                at: today,
                label: `${t('workbench.tl.reviewData')} ×${review.value.themesAwaitingReview}`,
                view: 'review',
            });
        }
        return entries.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8);
    }, [recentTopics, projects, items, interactions, review, today, t]);
    /** Loading / failed seat for a panel fed by one Remote. */
    const panelState = (load, retry) => {
        if (load.state === 'loading')
            return _jsx("p", { className: css.panelEmpty, children: t('library.loading') });
        if (load.state === 'failed') {
            return (_jsxs("div", { className: css.libraryState, children: [_jsxs("span", { children: [t('library.error'), ": ", load.detail] }), _jsx("button", { type: "button", className: css.retry, onClick: retry, children: t('library.retry') })] }));
        }
        return undefined;
    };
    return (_jsxs("div", { className: css.workbench, children: [_jsxs("div", { className: css.helloRow, children: [_jsxs("h1", { className: css.hello, children: [t(`greet.${greetKey(new Date().getHours())}`), " \uD83D\uDC4B"] }), _jsx("p", { className: css.helloSub, children: t('workbench.subtitle') })] }), _jsxs("div", { className: css.quickRow, children: [_jsxs("button", { type: "button", className: css.chip, onClick: onChat, children: [_jsx(IconNewChatOutline16, { size: 14 }), t('action.chat')] }), _jsxs("button", { type: "button", className: css.chip, onClick: () => { onNavigate('create'); }, children: [_jsx(IconSparkle16, { size: 14 }), t('nav.create')] }), _jsxs("button", { type: "button", className: css.chip, onClick: () => { onNavigate('calendar'); }, children: [_jsx(IconChecklistOutline14, { size: 14 }), t('action.schedule')] }), _jsxs("button", { type: "button", className: clsx(css.chip, copiedId === 'social-card' && css.chipCopied), onClick: () => { void pick(cap('social-card')); }, children: [_jsx(IconEditOutline16, { size: 14 }), copiedId === 'social-card' ? t('card.copied') : t('cap.social-card.title')] }), _jsxs("button", { type: "button", className: clsx(css.chip, copiedId === 'pre-publish' && css.chipCopied), onClick: () => { void pick(cap('pre-publish')); }, children: [_jsx(IconCheckOutline16, { size: 14 }), copiedId === 'pre-publish' ? t('card.copied') : t('cap.pre-publish.title')] })] }), _jsxs("div", { className: css.quickRow, children: [_jsx("span", { className: css.panelTitle, children: t('workbench.createNew') }), NEW_ENTRIES.map(entry => (_jsxs("button", { type: "button", className: css.chip, onClick: () => { onNavigate(entry.view); }, children: ["\uFF0B ", t(entry.key)] }, entry.view)))] }), _jsxs("div", { className: css.statRow, children: [_jsx(StatCard, { icon: _jsx(IconChecklistOutline14, { size: 16 }), value: topics.state === 'ok' ? topicItems.length : undefined, label: t('stat.topicTotal') }), _jsx(StatCard, { icon: _jsx(IconEditOutline16, { size: 16 }), value: topics.state === 'ok' ? topicTodo : undefined, label: t('stat.topicTodo') }), _jsx(StatCard, { icon: _jsx(IconCheckOutline16, { size: 16 }), value: topics.state === 'ok' ? topicDone : undefined, label: t('stat.topicDone') }), _jsx(StatCard, { icon: _jsx(IconFolderOpenOutline16, { size: 16 }), value: outputs.state === 'ok' ? ready : undefined, label: t('stat.ready') })] }), _jsxs("div", { className: css.statRow, children: [_jsx(StatCard, { icon: _jsx(IconGoalOutline16, { size: 16 }), value: outputs.state === 'ok' ? publishedProjects : undefined, label: t('stat.published') }), _jsx(StatCard, { icon: _jsx(IconChecklistOutline14, { size: 16 }), value: schedule.state === 'ok' ? todayDue : undefined, label: t('stat.todayDue') }), _jsx(StatCard, { icon: _jsx(IconNewChatOutline16, { size: 16 }), value: summary === null ? undefined : summary.unread + summary.pendingReply, label: t('stat.pendingReply') }), _jsx(StatCard, { icon: _jsx(IconSparkle16, { size: 16 }), value: schedule.state === 'ok' ? scheduledTasks : undefined, label: t('stat.scheduledTasks') })] }), _jsxs("div", { className: css.panelRowThree, children: [_jsxs("section", { className: css.panel, children: [_jsxs("header", { className: css.panelHead, children: [_jsxs("h2", { className: css.panelTitle, children: [_jsx(IconSparkle16, { size: 13 }), t('panel.quickCreate')] }), _jsxs("button", { type: "button", className: css.panelMore, onClick: () => { onNavigate('create'); }, children: [t('nav.create'), " \u2192"] })] }), quick.map(item => (_jsxs("button", { type: "button", className: clsx(css.listRowButton, copiedId === item.id && css.listRowCopied), onClick: () => { void pick(item); }, children: [_jsx("span", { className: css.listTitle, children: copiedId === item.id ? t('card.copied') : t(`cap.${item.id}.title`) }), _jsx("span", { className: css.listMeta, children: copiedId === item.id ? '' : t('card.copyHint') })] }, item.id)))] }), _jsxs("section", { className: css.panel, children: [_jsxs("header", { className: css.panelHead, children: [_jsxs("h2", { className: css.panelTitle, children: [_jsx(IconChecklistOutline14, { size: 13 }), t('panel.recentTopics')] }), _jsxs("button", { type: "button", className: css.panelMore, onClick: () => { onNavigate('topicBank'); }, children: [t('nav.topicBank'), " \u2192"] })] }), panelState(topics, () => { void loadTopics(); })
                                ?? (recentTopics.length === 0
                                    ? _jsx("p", { className: css.panelEmpty, children: t('panel.emptyRecentTopics') })
                                    : recentTopics.map(topic => (_jsxs("button", { type: "button", className: css.listRowButton, onClick: () => { onNavigate('topicBank'); }, children: [_jsx("span", { className: css.listTitle, children: topic.title }), _jsx("span", { className: css.listMeta, children: t(`topic.status.${topic.status}`) })] }, topic.id))))] }), _jsxs("section", { className: css.panel, children: [_jsxs("header", { className: css.panelHead, children: [_jsxs("h2", { className: css.panelTitle, children: [_jsx(IconFolderOpenOutline16, { size: 13 }), t('panel.recentFinals')] }), _jsxs("button", { type: "button", className: css.panelMore, onClick: () => { onNavigate('library'); }, children: [t('nav.library'), " \u2192"] })] }), panelState(outputs, () => { void loadOutputs(); })
                                ?? (recentFinals.length === 0
                                    ? _jsx("p", { className: css.panelEmpty, children: t('panel.emptyRecent') })
                                    : recentFinals.map(project => (_jsxs("button", { type: "button", className: css.listRowButton, onClick: () => { onNavigate('library'); }, children: [_jsx("span", { className: css.listTitle, children: project.title }), _jsx("span", { className: css.listMeta, children: t(`status.${project.status}`) })] }, project.topic))))] })] }), _jsxs("div", { className: css.panelRowTwo, children: [_jsxs("section", { className: css.panel, children: [_jsxs("header", { className: css.panelHead, children: [_jsxs("h2", { className: css.panelTitle, children: [_jsx(IconGoalOutline16, { size: 13 }), t('panel.timeline')] }), _jsxs("button", { type: "button", className: css.panelMore, onClick: () => { onNavigate('review'); }, children: [t('nav.review'), " \u2192"] })] }), feed.length === 0
                                ? _jsx("p", { className: css.panelEmpty, children: t('workbench.emptyTimeline') })
                                : feed.map(entry => (_jsxs("button", { type: "button", className: css.listRowButton, onClick: () => { onNavigate(entry.view); }, children: [_jsx("span", { className: css.listTitle, children: entry.label }), _jsx("span", { className: css.listMeta, children: entry.at.slice(0, 10) })] }, entry.key)))] }), _jsxs("section", { className: css.panel, children: [_jsxs("header", { className: css.panelHead, children: [_jsxs("h2", { className: css.panelTitle, children: [_jsx(IconSparkle16, { size: 13 }), t('panel.dataPreview')] }), _jsxs("button", { type: "button", className: css.panelMore, onClick: () => { onNavigate('review'); }, children: [t('nav.review'), " \u2192"] })] }), review.state === 'loading' && _jsx("p", { className: css.panelEmpty, children: t('library.loading') }), review.state === 'failed' && (_jsxs("div", { className: css.libraryState, children: [_jsxs("span", { children: [t('library.error'), ": ", review.detail] }), _jsx("button", { type: "button", className: css.retry, onClick: () => { setOutputs({ ...outputs }); }, children: t('library.retry') })] })), review.state === 'ok' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.dataPills, children: [_jsxs("span", { className: css.dataPill, children: [t('stat.previewWorks'), " \u00B7 ", review.value.works] }), _jsxs("span", { className: css.dataPill, children: [t('stat.reads'), " \u00B7 ", review.value.reads ?? '—'] }), _jsxs("span", { className: css.dataPill, children: [t('stat.likes'), " \u00B7 ", review.value.likes ?? '—'] }), _jsxs("span", { className: css.dataPill, children: [t('stat.followers'), " \u00B7 ", review.value.followers ?? '—'] })] }), _jsx("p", { className: css.panelEmpty, children: t('workbench.reviewHint') })] }))] })] })] }));
}
/** One stat card with a tinted icon tile over the value and label. */
function StatCard({ icon, value, label }) {
    return (_jsxs("div", { className: css.statCard, children: [_jsx("span", { className: css.statIcon, children: icon }), _jsx("span", { className: css.statValue, children: value === undefined ? '—' : String(value) }), _jsx("span", { className: css.statLabel, children: label })] }));
}
//# sourceMappingURL=ContentWorkbench.js.map