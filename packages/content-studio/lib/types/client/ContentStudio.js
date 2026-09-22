import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The frame-wide workbench surface occupying the `shell.overlay` hole. Closed
 * state renders null (the slot entry stays mounted); open state covers the
 * frame with the dual-tab capability menu. Picking a capability copies its
 * structured instruction to the clipboard — the composer draft seam does not
 * exist yet, so the paste-into-session hop is the user's one action.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { clsx } from 'clsx';
import { IconCloseOutline16, writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives';
import { STUDIO_TABS, capabilityGroups } from "./capabilities.js";
import { ContentLibrary } from "./ContentLibrary.js";
import { ContentCalendar } from "./ContentCalendar.js";
import css from './ContentStudio.module.css';
/** How long a card shows its copied state before reverting. */
const COPIED_FEEDBACK_MS = 1600;
/** Maturity → its badge modifier class. */
const BADGE_CLASS = {
    done: css.badgeDone ?? '',
    ready: css.badgeReady ?? '',
    need: css.badgeNeed ?? '',
    incoming: css.badgeIncoming ?? '',
};
/**
 * Render the Content Studio workbench surface.
 * @param props - the shared controller and the locale seat.
 * @returns the surface element tree while open; null while closed.
 */
export function ContentStudio({ studio, listOutputs, schedule, t }) {
    const open = useSyncExternalStore(fn => studio.subscribe(fn), () => studio.isOpen());
    const [view, setView] = useState('create');
    const [tab, setTab] = useState('create');
    const [copiedId, setCopiedId] = useState(undefined);
    // Escape closes; the listener exists only while open so the key keeps its
    // native meaning everywhere else.
    useEffect(() => {
        if (!open)
            return;
        const onKeyDown = (event) => {
            if (event.key === 'Escape')
                studio.close();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => { document.removeEventListener('keydown', onKeyDown); };
    }, [open, studio]);
    // Revert the copied feedback without racing successive picks: each pick
    // replaces the pending timer instead of stacking one.
    useEffect(() => {
        if (copiedId === undefined)
            return;
        const timer = window.setTimeout(() => { setCopiedId(undefined); }, COPIED_FEEDBACK_MS);
        return () => { window.clearTimeout(timer); };
    }, [copiedId]);
    if (!open)
        return null;
    const groups = capabilityGroups(tab);
    const pick = async (id, prompt) => {
        if (await writeClipboard(prompt))
            setCopiedId(id);
    };
    return (_jsx("div", { className: css.surface, role: "dialog", "aria-modal": "true", "aria-label": t('studio.title'), children: _jsxs("div", { className: css.frame, children: [_jsxs("header", { className: css.header, children: [_jsxs("div", { children: [_jsx("h1", { className: css.title, children: t('studio.title') }), _jsx("p", { className: css.subtitle, children: t('studio.subtitle') })] }), _jsxs("div", { className: css.headerControls, children: [_jsx("div", { className: css.views, role: "tablist", children: ['create', 'library', 'calendar'].map(candidate => (_jsx("button", { type: "button", role: "tab", "aria-selected": view === candidate, className: clsx(css.tab, view === candidate && css.tabActive), onClick: () => { setView(candidate); }, children: t(candidate === 'create' ? 'view.create' : candidate === 'library' ? 'view.library' : 'view.calendar') }, candidate))) }), _jsx("button", { type: "button", className: css.back, onClick: () => { studio.close(); }, children: t('studio.back') }), _jsx("button", { type: "button", className: css.close, "aria-label": t('studio.close'), onClick: () => { studio.close(); }, children: _jsx(IconCloseOutline16, { size: 16 }) })] })] }), view === 'library' && _jsx(ContentLibrary, { listOutputs: listOutputs, t: t }), view === 'calendar' && (_jsx(ContentCalendar, { listSchedule: schedule.list, putSchedule: schedule.put, removeSchedule: schedule.remove, t: t })), view === 'create' && (_jsxs(_Fragment, { children: [_jsx("div", { className: css.tabs, role: "tablist", children: STUDIO_TABS.map(candidate => (_jsx("button", { type: "button", role: "tab", "aria-selected": tab === candidate.id, "aria-label": t(candidate.id === 'create' ? 'tab.create.aria' : 'tab.operate.aria'), className: clsx(css.tab, tab === candidate.id && css.tabActive), onClick: () => { setTab(candidate.id); }, children: t(candidate.id === 'create' ? 'tab.create' : 'tab.operate') }, candidate.id))) }), _jsx("div", { className: css.body, children: groups.map(group => (_jsxs("section", { className: css.group, children: [_jsx("h2", { className: css.groupTitle, children: t(`group.${group.id}`) }), _jsx("div", { className: css.grid, children: group.items.map((item) => {
                                            const copied = copiedId === item.id;
                                            return (_jsxs("button", { type: "button", className: clsx(css.card, copied && css.cardCopied), onClick: () => { void pick(item.id, item.prompt); }, children: [_jsxs("span", { className: css.cardHead, children: [_jsx("span", { className: css.cardTitle, children: t(`cap.${item.id}.title`) }), _jsx("span", { className: clsx(css.badge, BADGE_CLASS[item.maturity]), children: t(`badge.${item.maturity}`) })] }), _jsx("span", { className: css.cardDetail, children: t(`cap.${item.id}.detail`) }), _jsx("span", { className: clsx(css.cardHint, copied && css.cardHintCopied), children: copied ? t('card.copied') : t('card.copyHint') })] }, item.id));
                                        }) })] }, group.id))) })] })), _jsxs("footer", { className: css.about, children: [_jsx("span", { children: t('studio.brand') }), _jsx("a", { className: css.aboutLink, href: "https://github.com/guilinleolee/dsh-content-studio/issues", target: "_blank", rel: "noreferrer", children: t('studio.feedback') })] })] }) }));
}
//# sourceMappingURL=ContentStudio.js.map