import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The workbench home (Easel-style dashboard): greeting, quick capability
 * chips (pick = copy instruction), four stat cards derived from the outputs
 * library and the publication calendar, and two panels — recent outputs and
 * upcoming schedule — each hopping to its full view.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives';
import { CAPABILITY_ITEMS } from "./capabilities.js";
import css from './ContentStudio.module.css';
/** Quick chips surface these capability ids, in this order. */
const QUICK_IDS = ['social-card', 'gzh-article', 'short-script', 'multi-platform'];
/** How long a chip shows its copied state before reverting. */
const COPIED_FEEDBACK_MS = 1600;
/** Greeting bucket by hour of day. */
function greetKey(hour) {
    return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}
/**
 * Render the workbench home.
 * @param props - the Remote read wrappers, view navigation, and the locale seat.
 * @returns the dashboard element tree.
 */
export function ContentWorkbench({ listOutputs, listSchedule, onNavigate, t }) {
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
    const quick = useMemo(() => QUICK_IDS.map(id => CAPABILITY_ITEMS.find(item => item.id === id)).filter(item => item !== undefined), []);
    const pick = async (item) => {
        if (await writeClipboard(item.prompt))
            setCopiedId(item.id);
    };
    if (failed)
        return _jsx("div", { className: css.libraryState, children: t('library.error') });
    const ready = outputs?.projects.filter(project => project.status === 'ready').length ?? 0;
    const pending = schedule?.items.filter(item => item.status !== 'published').length ?? 0;
    const published = schedule?.items.filter(item => item.status === 'published').length ?? 0;
    const recent = [...(outputs?.projects ?? [])]
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, 4);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = (schedule?.items ?? [])
        .filter(item => item.status !== 'published' && item.date >= today)
        .slice(0, 4);
    return (_jsxs("div", { className: css.workbench, children: [_jsxs("div", { className: css.helloRow, children: [_jsxs("h1", { className: css.hello, children: [t(`greet.${greetKey(new Date().getHours())}`), " \uD83D\uDC4B"] }), _jsx("p", { className: css.helloSub, children: t('workbench.subtitle') })] }), _jsx("div", { className: css.quickRow, children: quick.map(item => (_jsx("button", { type: "button", className: clsx(css.chip, copiedId === item.id && css.chipCopied), onClick: () => { void pick(item); }, children: copiedId === item.id ? t('card.copied') : t(`cap.${item.id}.title`) }, item.id))) }), _jsxs("div", { className: css.statRow, children: [_jsx(StatCard, { value: outputs?.projects.length, label: t('stat.projects') }), _jsx(StatCard, { value: ready, label: t('stat.ready') }), _jsx(StatCard, { value: pending, label: t('stat.scheduled') }), _jsx(StatCard, { value: published, label: t('stat.published') })] }), _jsxs("div", { className: css.panelRow, children: [_jsxs("section", { className: css.panel, children: [_jsxs("header", { className: css.panelHead, children: [_jsx("h2", { className: css.panelTitle, children: t('panel.recent') }), _jsxs("button", { type: "button", className: css.panelMore, onClick: () => { onNavigate('library'); }, children: [t('panel.viewAll'), " \u2192"] })] }), recent.length === 0
                                ? _jsx("p", { className: css.panelEmpty, children: t('panel.emptyRecent') })
                                : recent.map(project => (_jsxs("div", { className: css.listRow, children: [_jsx("span", { className: css.listTitle, children: project.title }), _jsx("span", { className: css.listMeta, children: t(`status.${project.status}`) })] }, project.topic)))] }), _jsxs("section", { className: css.panel, children: [_jsxs("header", { className: css.panelHead, children: [_jsx("h2", { className: css.panelTitle, children: t('panel.upcoming') }), _jsxs("button", { type: "button", className: css.panelMore, onClick: () => { onNavigate('calendar'); }, children: [t('panel.viewAll'), " \u2192"] })] }), upcoming.length === 0
                                ? _jsx("p", { className: css.panelEmpty, children: t('panel.emptyUpcoming') })
                                : upcoming.map(item => (_jsxs("div", { className: css.listRow, children: [_jsx("span", { className: css.listTitle, children: item.title }), _jsx("span", { className: css.listMeta, children: item.date })] }, item.id)))] })] })] }));
}
/** One stat card; the value shows an em dash while its snapshot loads. */
function StatCard({ value, label }) {
    return (_jsxs("div", { className: css.statCard, children: [_jsx("span", { className: css.statValue, children: value === undefined ? '—' : String(value) }), _jsx("span", { className: css.statLabel, children: label })] }));
}
//# sourceMappingURL=ContentWorkbench.js.map