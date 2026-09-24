import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The frame-wide workbench surface occupying the `shell.overlay` hole.
 * Easel-style two-column shell: a left inner nav — 工作台 / 对话 / 对标 /
 * 选题 / 内容 / 创作 / 账号 / 画像, with the back-to-chat verb and the
 * feedback link at the foot — and a main column rendering the active view,
 * defaulting to the workbench home dashboard. 对话 closes back to the chat;
 * 对标 and 选题 are capability slices of the catalog; 账号 and 画像 manage the
 * browser-local creation identity that is injected into every copied
 * capability instruction. Escape dismisses the surface; closed state renders
 * null while the slot entry stays mounted.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { clsx } from 'clsx';
import { IconCloseOutline16, IconSparkle16, writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives';
import { STUDIO_TABS, capabilityGroups } from "./capabilities.js";
import { ContentLibrary } from "./ContentLibrary.js";
import { ContentCalendar } from "./ContentCalendar.js";
import { ContentWorkbench } from "./ContentWorkbench.js";
import { AccountSelect } from "./AccountSelect.js";
import { CapabilityPage } from "./CapabilityPage.js";
import { AccountsView } from "./AccountsView.js";
import { PersonaView } from "./PersonaView.js";
import css from './ContentStudio.module.css';
/** How long a card shows its copied state before reverting. */
const COPIED_FEEDBACK_MS = 1600;
/** The nav order exactly as specified: 对话 rides between 工作台 and 对标 as a verb. */
const NAV_ITEMS = [
    { view: 'workbench', key: 'nav.workbench' },
    { view: 'chat', key: 'nav.chat' },
    { view: 'benchmark', key: 'nav.benchmark' },
    { view: 'topics', key: 'nav.topics' },
    { view: 'library', key: 'nav.content' },
    { view: 'create', key: 'nav.create' },
    { view: 'accounts', key: 'nav.accounts' },
    { view: 'persona', key: 'nav.persona' },
];
/** Capability slices behind the 对标 / 选题 nav views. */
const BENCHMARK_IDS = ['breakdown'];
const TOPICS_IDS = ['hotspot', 'calendar-plan'];
/** Maturity → its badge modifier class. */
const BADGE_CLASS = {
    done: css.badgeDone ?? '',
    ready: css.badgeReady ?? '',
    need: css.badgeNeed ?? '',
    incoming: css.badgeIncoming ?? '',
};
/**
 * Render the Content Studio workbench surface.
 * @param props - the injected face and the locale seat.
 * @returns the surface element tree while open; null while closed.
 */
export function ContentStudio({ studio, listOutputs, schedule, t }) {
    const open = useSyncExternalStore(fn => studio.subscribe(fn), () => studio.isOpen());
    const [view, setView] = useState('workbench');
    // Browser-local creation accounts and persona (Easel's persona selector):
    // both are injected into every copied capability instruction.
    const [accounts, setAccounts] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('dsh-content-studio.accounts') ?? '');
        }
        catch {
            return ['通用模式'];
        }
    });
    const [account, setAccount] = useState(() => localStorage.getItem('dsh-content-studio.account') ?? '通用模式');
    const [persona, setPersona] = useState(() => localStorage.getItem('dsh-content-studio.persona') ?? '');
    const selectAccount = (name) => {
        setAccount(name);
        localStorage.setItem('dsh-content-studio.account', name);
    };
    const addAccount = (name) => {
        const next = accounts.includes(name) ? accounts : [...accounts, name];
        setAccounts(next);
        localStorage.setItem('dsh-content-studio.accounts', JSON.stringify(next));
        selectAccount(name);
    };
    const removeAccount = (name) => {
        const next = accounts.filter(candidate => candidate !== name);
        setAccounts(next);
        localStorage.setItem('dsh-content-studio.accounts', JSON.stringify(next));
        if (account === name)
            selectAccount('通用模式');
    };
    const savePersona = (text) => {
        setPersona(text);
        localStorage.setItem('dsh-content-studio.persona', text);
    };
    // Prepend the active account (and persona when set) to a copied instruction;
    // generic mode with no persona adds nothing.
    const withIdentity = (prompt) => {
        const identity = account === '通用模式'
            ? persona.length > 0 ? `账号画像：${persona}` : ''
            : persona.length > 0 ? `我的账号/画像：${account}\n账号画像：${persona}` : `我的账号/画像：${account}`;
        return identity.length > 0 ? `${identity}\n\n${prompt}` : prompt;
    };
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
    const pickItem = (item) => {
        void (async () => {
            if (await writeClipboard(withIdentity(item.prompt)))
                setCopiedId(item.id);
        })();
    };
    const pick = async (id, prompt) => {
        if (await writeClipboard(withIdentity(prompt)))
            setCopiedId(id);
    };
    return (_jsx("div", { className: css.surface, role: "dialog", "aria-modal": "true", "aria-label": t('studio.title'), children: _jsxs("div", { className: css.shell, children: [_jsxs("aside", { className: css.side, children: [_jsxs("div", { className: css.sideBrand, children: [_jsx(IconSparkle16, { size: 16 }), _jsx("span", { children: t('studio.title') })] }), _jsx(AccountSelect, { account: account, accounts: accounts, onSelect: selectAccount, onAdd: addAccount, t: t }), _jsx("nav", { className: css.sideNav, "aria-label": t('studio.title'), children: NAV_ITEMS.map(({ view: candidate, key }) => (_jsx("button", { type: "button", className: clsx(css.navItem, view === candidate && css.navItemActive), "aria-current": view === candidate || undefined, onClick: () => {
                                    if (candidate === 'chat')
                                        studio.close();
                                    else
                                        setView(candidate);
                                }, children: t(key) }, candidate))) }), _jsxs("div", { className: css.sideFoot, children: [_jsx("button", { type: "button", className: css.back, onClick: () => { studio.close(); }, children: t('studio.back') }), _jsx("a", { className: css.aboutLink, href: "https://github.com/guilinleolee/dsh-content-studio/issues", target: "_blank", rel: "noreferrer", children: t('studio.feedback') })] })] }), _jsxs("div", { className: css.main, children: [_jsx("button", { type: "button", className: css.close, "aria-label": t('studio.close'), onClick: () => { studio.close(); }, children: _jsx(IconCloseOutline16, { size: 16 }) }), _jsxs("div", { className: css.frame, children: [view === 'workbench' && (_jsx(ContentWorkbench, { listOutputs: listOutputs, listSchedule: schedule.list, onNavigate: setView, onChat: () => { studio.close(); }, account: account, persona: persona, t: t })), view === 'benchmark' && (_jsx(CapabilityPage, { title: t('benchmark.title'), ids: BENCHMARK_IDS, copiedId: copiedId, pick: pickItem, t: t })), view === 'topics' && (_jsx(CapabilityPage, { title: t('topics.title'), ids: TOPICS_IDS, copiedId: copiedId, pick: pickItem, t: t })), view === 'accounts' && (_jsx(AccountsView, { account: account, accounts: accounts, onSelect: selectAccount, onAdd: addAccount, onRemove: removeAccount, t: t })), view === 'persona' && (_jsx(PersonaView, { persona: persona, onSave: savePersona, t: t })), view === 'library' && _jsx(ContentLibrary, { listOutputs: listOutputs, t: t }), view === 'calendar' && (_jsx(ContentCalendar, { listSchedule: schedule.list, putSchedule: schedule.put, removeSchedule: schedule.remove, t: t })), view === 'create' && (_jsxs(_Fragment, { children: [_jsx("div", { className: css.tabs, role: "tablist", children: STUDIO_TABS.map(candidate => (_jsx("button", { type: "button", role: "tab", "aria-selected": tab === candidate.id, "aria-label": t(candidate.id === 'create' ? 'tab.create.aria' : 'tab.operate.aria'), className: clsx(css.tab, tab === candidate.id && css.tabActive), onClick: () => { setTab(candidate.id); }, children: t(candidate.id === 'create' ? 'tab.create' : 'tab.operate') }, candidate.id))) }), _jsx("div", { className: css.body, children: groups.map(group => (_jsxs("section", { className: css.group, children: [_jsx("h2", { className: css.groupTitle, children: t(`group.${group.id}`) }), _jsx("div", { className: css.grid, children: group.items.map((item) => {
                                                            const copied = copiedId === item.id;
                                                            return (_jsxs("button", { type: "button", className: clsx(css.card, copied && css.cardCopied), onClick: () => { void pick(item.id, item.prompt); }, children: [_jsxs("span", { className: css.cardHead, children: [_jsx("span", { className: css.cardTitle, children: t(`cap.${item.id}.title`) }), _jsx("span", { className: clsx(css.badge, BADGE_CLASS[item.maturity]), children: t(`badge.${item.maturity}`) })] }), _jsx("span", { className: css.cardDetail, children: t(`cap.${item.id}.detail`) }), _jsx("span", { className: clsx(css.cardHint, copied && css.cardHintCopied), children: copied ? t('card.copied') : t('card.copyHint') })] }, item.id));
                                                        }) })] }, group.id))) })] }))] })] })] }) }));
}
//# sourceMappingURL=ContentStudio.js.map