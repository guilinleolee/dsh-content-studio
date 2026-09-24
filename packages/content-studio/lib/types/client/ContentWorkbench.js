import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The workbench home (Easel-style dashboard): greeting, icon verb chips
 * (navigate or copy a capability instruction), four stat cards with tinted
 * icon tiles, and a 3+2 panel grid — quick-create rows, recent outputs,
 * upcoming schedule, and a creation-data breakdown — each panel hopping to
 * its full view.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { IconCheckOutline16, IconChecklistOutline14, IconEditOutline16, IconFolderOpenOutline16, IconGoalOutline16, IconNewChatOutline16, IconSparkle16, writeClipboard, } from '@deepseek-ai/dsh-client-ui-primitives';
import { CAPABILITY_ITEMS } from "./capabilities.js";
import css from './ContentStudio.module.css';
/** Quick-create panel rows: these capability ids, in this order. */
const QUICK_IDS = ['social-card', 'gzh-article', 'short-script', 'multi-platform', 'pre-publish'];
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
 * Render the workbench home.
 * @param props - the Remote read wrappers, view navigation, and the locale seat.
 * @returns the dashboard element tree.
 */
export function ContentWorkbench({ listOutputs, listSchedule, onNavigate, onChat, t }) {
    const [outputs, setOutputs] = useState(undefined);
    const [schedule, setSchedule] = useState(undefined);
    const [failed, setFailed] = useState(false);
    const [copiedId, setCopiedId] = useState(undefined);
    const load = useCallback(async () => {
        setFailed(false);
        try {
            const [o, s] = await Promise.all([listOutputs(), listSchedule()]);
            setOutputs(o);
            setSchedule(s);
        }
        catch {
            setFailed(true);
        }
    }, [listOutputs, listSchedule]);
    useEffect(() => { void load(); }, [load]);
    useEffect(() => {
        if (copiedId === undefined)
            return;
        const timer = window.setTimeout(() => { setCopiedId(undefined); }, COPIED_FEEDBACK_MS);
        return () => { window.clearTimeout(timer); };
    }, [copiedId]);
    const quick = useMemo(() => QUICK_IDS.map(id => cap(id)), []);
    const pick = async (item) => {
        if (await writeClipboard(item.prompt))
            setCopiedId(item.id);
    };
    if (failed)
        return _jsx("div", { className: css.libraryState, children: t('library.error') });
    const projects = outputs?.projects ?? [];
    const ready = projects.filter(project => project.status === 'ready').length;
    const pending = (schedule?.items ?? []).filter(item => item.status !== 'published').length;
    const published = (schedule?.items ?? []).filter(item => item.status === 'published').length;
    const recent = [...projects].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 5);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = (schedule?.items ?? [])
        .filter(item => item.status !== 'published' && item.date >= today)
        .slice(0, 5);
    const allSchedule = schedule?.items ?? [];
    return (_jsxs("div", { className: css.workbench, children: [_jsxs("div", { className: css.helloRow, children: [_jsxs("h1", { className: css.hello, children: [t(`greet.${greetKey(new Date().getHours())}`), " \uD83D\uDC4B"] }), _jsx("p", { className: css.helloSub, children: t('workbench.subtitle') })] }), _jsxs("div", { className: css.quickRow, children: [_jsxs("button", { type: "button", className: css.chip, onClick: onChat, children: [_jsx(IconNewChatOutline16, { size: 14 }), t('action.chat')] }), _jsxs("button", { type: "button", className: css.chip, onClick: () => { onNavigate('create'); }, children: [_jsx(IconSparkle16, { size: 14 }), t('nav.create')] }), _jsxs("button", { type: "button", className: css.chip, onClick: () => { onNavigate('calendar'); }, children: [_jsx(IconChecklistOutline14, { size: 14 }), t('action.schedule')] }), _jsxs("button", { type: "button", className: clsx(css.chip, copiedId === 'social-card' && css.chipCopied), onClick: () => { void pick(cap('social-card')); }, children: [_jsx(IconEditOutline16, { size: 14 }), copiedId === 'social-card' ? t('card.copied') : t('cap.social-card.title')] }), _jsxs("button", { type: "button", className: clsx(css.chip, copiedId === 'pre-publish' && css.chipCopied), onClick: () => { void pick(cap('pre-publish')); }, children: [_jsx(IconCheckOutline16, { size: 14 }), copiedId === 'pre-publish' ? t('card.copied') : t('cap.pre-publish.title')] })] }), _jsxs("div", { className: css.statRow, children: [_jsx(StatCard, { icon: _jsx(IconFolderOpenOutline16, { size: 16 }), value: projects.length, label: t('stat.projects') }), _jsx(StatCard, { icon: _jsx(IconChecklistOutline14, { size: 16 }), value: pending, label: t('stat.scheduled') }), _jsx(StatCard, { icon: _jsx(IconCheckOutline16, { size: 16 }), value: ready, label: t('stat.ready') }), _jsx(StatCard, { icon: _jsx(IconGoalOutline16, { size: 16 }), value: published, label: t('stat.published') })] }), _jsxs("div", { className: css.panelRowThree, children: [_jsxs("section", { className: css.panel, children: [_jsxs("header", { className: css.panelHead, children: [_jsxs("h2", { className: css.panelTitle, children: [_jsx(IconSparkle16, { size: 13 }), t('panel.quickCreate')] }), _jsxs("button", { type: "button", className: css.panelMore, onClick: () => { onNavigate('create'); }, children: [t('nav.create'), " \u2192"] })] }), quick.map(item => (_jsxs("button", { type: "button", className: clsx(css.listRowButton, copiedId === item.id && css.listRowCopied), onClick: () => { void pick(item); }, children: [_jsx("span", { className: css.listTitle, children: copiedId === item.id ? t('card.copied') : t(`cap.${item.id}.title`) }), _jsx("span", { className: css.listMeta, children: copiedId === item.id ? '' : t('card.copyHint') })] }, item.id)))] }), _jsxs("section", { className: css.panel, children: [_jsxs("header", { className: css.panelHead, children: [_jsxs("h2", { className: css.panelTitle, children: [_jsx(IconFolderOpenOutline16, { size: 13 }), t('panel.recent')] }), _jsxs("button", { type: "button", className: css.panelMore, onClick: () => { onNavigate('library'); }, children: [t('nav.library'), " \u2192"] })] }), recent.length === 0
                                ? _jsx("p", { className: css.panelEmpty, children: t('panel.emptyRecent') })
                                : recent.map(project => (_jsxs("div", { className: css.listRow, children: [_jsx("span", { className: css.listTitle, children: project.title }), _jsx("span", { className: css.listMeta, children: t(`status.${project.status}`) })] }, project.topic)))] }), _jsxs("section", { className: css.panel, children: [_jsxs("header", { className: css.panelHead, children: [_jsxs("h2", { className: css.panelTitle, children: [_jsx(IconChecklistOutline14, { size: 13 }), t('panel.upcoming')] }), _jsxs("button", { type: "button", className: css.panelMore, onClick: () => { onNavigate('calendar'); }, children: [t('nav.calendar'), " \u2192"] })] }), upcoming.length === 0
                                ? _jsx("p", { className: css.panelEmpty, children: t('panel.emptyUpcoming') })
                                : upcoming.map(item => (_jsxs("div", { className: css.listRow, children: [_jsx("span", { className: css.listTitle, children: item.title }), _jsx("span", { className: css.listMeta, children: item.date })] }, item.id)))] })] }), _jsxs("div", { className: css.panelRowTwo, children: [_jsxs("section", { className: css.panel, children: [_jsxs("header", { className: css.panelHead, children: [_jsxs("h2", { className: css.panelTitle, children: [_jsx(IconGoalOutline16, { size: 13 }), t('panel.data')] }), _jsxs("button", { type: "button", className: css.panelMore, onClick: () => { onNavigate('library'); }, children: [t('nav.library'), " \u2192"] })] }), _jsxs("div", { className: css.dataPills, children: [_jsxs("span", { className: css.dataPill, children: [t('stat.projects'), " \u00B7 ", projects.length] }), _jsxs("span", { className: css.dataPill, children: [t('status.draft'), " \u00B7 ", projects.filter(project => project.status === 'draft').length] }), _jsxs("span", { className: css.dataPill, children: [t('stat.ready'), " \u00B7 ", ready] }), _jsxs("span", { className: css.dataPill, children: [t('stat.published'), " \u00B7 ", published] })] }), _jsx("p", { className: css.panelEmpty, children: t('panel.dataHint') })] }), _jsxs("section", { className: css.panel, children: [_jsxs("header", { className: css.panelHead, children: [_jsxs("h2", { className: css.panelTitle, children: [_jsx(IconChecklistOutline14, { size: 13 }), t('panel.recentSchedule')] }), _jsxs("button", { type: "button", className: css.panelMore, onClick: () => { onNavigate('calendar'); }, children: [t('nav.calendar'), " \u2192"] })] }), allSchedule.length === 0
                                ? _jsx("p", { className: css.panelEmpty, children: t('panel.emptyUpcoming') })
                                : allSchedule.slice(-5).reverse().map(item => (_jsxs("div", { className: css.listRow, children: [_jsx("span", { className: css.listTitle, children: item.title }), _jsxs("span", { className: css.listMeta, children: [item.date, " \u00B7 ", t(`status.${item.status}`)] })] }, item.id)))] })] })] }));
}
/** One stat card with a tinted icon tile over the value and label. */
function StatCard({ icon, value, label }) {
    return (_jsxs("div", { className: css.statCard, children: [_jsx("span", { className: css.statIcon, children: icon }), _jsx("span", { className: css.statValue, children: value === undefined ? '—' : String(value) }), _jsx("span", { className: css.statLabel, children: label })] }));
}
//# sourceMappingURL=ContentWorkbench.js.map