import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The frame-wide workbench surface occupying the `shell.overlay` hole.
 * Easel-style two-column shell: a left inner nav — 工作台 / 对话 / 对标 /
 * 选题库 / 信息收集 / 内容 / 内容日历 / 创作 / 发布 / 账号 / 画像 / 模板, with the
 * back-to-chat verb and the feedback link at the foot — and a main column
 * rendering the active view, defaulting to the workbench home dashboard.
 * 对话 closes back to the chat; 对标 is a capability slice of the catalog;
 * 选题库 is the topic bank over the contentTopics Remote; 内容日历 is the
 * scheduling workbench over the contentSchedule Remote; 画像 is the
 * account-persona manager over the `_personas.json` manifest. 账号 keeps the
 * browser-local creation identity injected into every copied capability
 * instruction, and a selected disk persona injects its packed prompt
 * instead. Escape dismisses the surface; closed state renders null while the
 * slot entry stays mounted.
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
import { CompetitorsView } from "./CompetitorsView.js";
import { GatherView } from "./GatherView.js";
import { CreateView } from "./CreateView.js";
import { TopicBankView } from "./TopicBankView.js";
import { PublishView } from "./PublishView.js";
import { ReviewView } from "./ReviewView.js";
import { InteractionView } from "./InteractionView.js";
import { TemplateLibraryView } from "./template/TemplateLibraryView.js";
import { TemplatePickerModal } from "./template/TemplatePickerModal.js";
import { gatherMaterialToTopicInput } from "./topic-bank.js";
import css from './ContentStudio.module.css';
// The picked-material banner belongs to the gather feature surface, whose
// styles live in the gather view's own module.
import gatherCss from './GatherView.module.css';
/** How long a card shows its copied state before reverting. */
const COPIED_FEEDBACK_MS = 1600;
/** The nav order exactly as specified: 对话 rides between 工作台 and 对标 as a verb. */
const NAV_ITEMS = [
    { view: 'workbench', key: 'nav.workbench' },
    { view: 'chat', key: 'nav.chat' },
    { view: 'benchmark', key: 'nav.benchmark' },
    { view: 'competitors', key: 'nav.competitors' },
    { view: 'topicBank', key: 'nav.topicBank' },
    { view: 'gather', key: 'nav.gather' },
    { view: 'library', key: 'nav.content' },
    { view: 'calendar', key: 'nav.calendar' },
    { view: 'create', key: 'nav.create' },
    { view: 'publish', key: 'nav.publish' },
    { view: 'review', key: 'nav.review' },
    { view: 'interaction', key: 'nav.interaction' },
    { view: 'accounts', key: 'nav.accounts' },
    { view: 'persona', key: 'nav.persona' },
    { view: 'templates', key: 'nav.templates' },
];
/** Capability slice behind the 对标 nav view. */
const BENCHMARK_IDS = ['breakdown'];
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
export function ContentStudio({ studio, listOutputs, gather, schedule, notes, competitors, create, personas, listThemes, topics, writeExport, publish, review, interaction, readInteractions, readReviewManifest, templates, t, }) {
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
    const [persona] = useState(() => localStorage.getItem('dsh-content-studio.persona') ?? '');
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
    // Prepend the active account (and persona when set) to a copied instruction;
    // generic mode with no persona adds nothing. A picked gathered material adds
    // its id-titled reference line — never the body. A selected disk persona
    // injects its packed persona-prompt@1 text; the inline free text is the
    // fallback.
    const personaPrompt = useSyncExternalStore(fn => personas.subscribe(fn), () => personas.activePrompt());
    const personaText = personaPrompt.length > 0 ? personaPrompt : persona;
    const withIdentity = (prompt, material) => {
        const personaLine = personaPrompt.length > 0 ? personaPrompt : persona.length > 0 ? `账号画像：${persona}` : '';
        const identity = account === '通用模式'
            ? personaLine
            : personaLine.length > 0 ? `我的账号/画像：${account}\n${personaLine}` : `我的账号/画像：${account}`;
        const reference = material === null || material === undefined ? '' : `参考素材：${material.title}（${material.url}）`;
        return [identity, reference].filter(part => part.length > 0).join('\n').length > 0
            ? `${[identity, reference].filter(part => part.length > 0).join('\n')}\n\n${prompt}`
            : prompt;
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
    // The gather scheduler exists only while the surface is open: opening
    // starts the tick (and runs the overdue catch-up), closing stops every
    // timer and the visibility listener. No background polling remains.
    useEffect(() => {
        if (!open)
            return;
        gather.start();
        return () => { gather.dispose(); };
    }, [open, gather]);
    const picked = useSyncExternalStore(fn => studio.subscribe(fn), () => studio.pickedMaterial());
    const pickedTopic = useSyncExternalStore(fn => studio.subscribe(fn), () => studio.pickedTopic());
    const pickedManuscript = useSyncExternalStore(fn => studio.subscribe(fn), () => studio.pickedManuscript());
    if (!open)
        return null;
    const groups = capabilityGroups(tab);
    const pickItem = (item) => {
        void (async () => {
            if (await writeClipboard(withIdentity(item.prompt, picked)))
                setCopiedId(item.id);
        })();
    };
    const pick = async (id, prompt) => {
        if (await writeClipboard(withIdentity(prompt, picked)))
            setCopiedId(id);
    };
    const pushToCreate = (material) => {
        void gather.markPicked(material.id);
        studio.pickMaterial(material);
        setView('create');
    };
    const startTopicCreate = (topic) => {
        studio.pickTopic(topic);
        setView('create');
    };
    // The create-view handoff: one registered deliverable becomes one publish
    // form prefill — an id reference only, never the manuscript body.
    const sendToPublish = (manuscript) => {
        studio.pickManuscript(manuscript);
        setView('publish');
    };
    // The reserved addToTopicBank contract, now wired: one gather material
    // becomes one `source.type:"gather"` topic carrying the material's stable
    // id as refId, its link, and a create-time snapshot; feedback rides the
    // gather view's own notice channel.
    const joinTopicBank = (materialId) => {
        const material = gather.getState().materials.find(candidate => candidate.id === materialId);
        if (material === undefined) {
            gather.showNotice('topic-bank-missing');
            return;
        }
        void (async () => {
            const input = gatherMaterialToTopicInput(material, material.gatheredAt);
            try {
                await topics.put(input);
                gather.showNotice('topic-bank-added');
            }
            catch {
                gather.showNotice('topic-bank-failed');
            }
        })();
    };
    return (_jsx("div", { className: css.surface, role: "dialog", "aria-modal": "true", "aria-label": t('studio.title'), children: _jsxs("div", { className: css.shell, children: [_jsxs("aside", { className: css.side, children: [_jsxs("div", { className: css.sideBrand, children: [_jsx(IconSparkle16, { size: 16 }), _jsx("span", { children: t('studio.title') })] }), _jsx(AccountSelect, { account: account, accounts: accounts, onSelect: selectAccount, onAdd: addAccount, t: t }), _jsx("nav", { className: css.sideNav, "aria-label": t('studio.title'), children: NAV_ITEMS.map(({ view: candidate, key }) => (_jsx("button", { type: "button", className: clsx(css.navItem, view === candidate && css.navItemActive), "aria-current": view === candidate || undefined, onClick: () => {
                                    if (candidate === 'chat')
                                        studio.close();
                                    else
                                        setView(candidate);
                                }, children: t(key) }, candidate))) }), _jsxs("div", { className: css.sideFoot, children: [_jsx("button", { type: "button", className: css.back, onClick: () => { studio.close(); }, children: t('studio.back') }), _jsx("a", { className: css.aboutLink, href: "https://github.com/guilinleolee/dsh-content-studio/issues", target: "_blank", rel: "noreferrer", children: t('studio.feedback') })] })] }), _jsxs("div", { className: css.main, children: [_jsx("button", { type: "button", className: css.close, "aria-label": t('studio.close'), onClick: () => { studio.close(); }, children: _jsx(IconCloseOutline16, { size: 16 }) }), _jsxs("div", { className: css.frame, children: [view === 'workbench' && (_jsx(ContentWorkbench, { listOutputs: listOutputs, listSchedule: schedule.list, listTopics: topics.list, readInteractions: readInteractions, readReviewManifest: readReviewManifest, onNavigate: setView, onChat: () => { studio.close(); }, account: account, persona: personaText, t: t })), view === 'benchmark' && (_jsx(CapabilityPage, { title: t('benchmark.title'), ids: BENCHMARK_IDS, copiedId: copiedId, pick: pickItem, t: t })), view === 'competitors' && (_jsx(CompetitorsView, { listOutputs: listOutputs, ...competitors, t: t })), view === 'topicBank' && (_jsx(TopicBankView, { topics: topics, schedule: schedule, onStartCreate: startTopicCreate, writeExport: writeExport, listThemes: listThemes, copiedCapabilityId: copiedId, pickCapability: pickItem, templateLibrary: templates, t: t })), view === 'gather' && (_jsx(GatherView, { gather: gather, onPushToCreate: pushToCreate, addToTopicBank: joinTopicBank, t: t })), view === 'accounts' && (_jsx(AccountsView, { account: account, accounts: accounts, onSelect: selectAccount, onAdd: addAccount, onRemove: removeAccount, t: t })), view === 'persona' && (_jsx(PersonaView, { personas: personas, t: t })), view === 'library' && _jsx(ContentLibrary, { listOutputs: listOutputs, t: t }), view === 'publish' && (_jsx(PublishView, { publish: publish, persona: personaText, pickedManuscript: pickedManuscript, onClearPickedManuscript: () => { studio.clearPickedManuscript(); }, t: t })), view === 'review' && (_jsx(ReviewView, { review: review, listThemes: listThemes, t: t })), view === 'interaction' && (_jsx(InteractionView, { interaction: interaction, personas: personas, templates: templates, listThemes: listThemes, t: t })), view === 'calendar' && (_jsx(ContentCalendar, { listSchedule: schedule.list, putSchedule: schedule.put, removeSchedule: schedule.remove, notes: notes, topics: topics, writeExport: writeExport, listThemes: listThemes, onNavigate: setView, t: t })), view === 'templates' && _jsx(TemplateLibraryView, { templates: templates, t: t }), view === 'create' && (_jsxs(_Fragment, { children: [picked !== null && (_jsxs("div", { className: gatherCss.gatherPicked, role: "status", children: [_jsxs("span", { children: [t('gather.picked.chip'), picked.title] }), _jsx("button", { type: "button", className: gatherCss.gatherMini, onClick: () => { studio.clearPickedMaterial(); }, children: t('gather.picked.clear') })] })), _jsx(CreateView, { create: create, listThemes: listThemes, persona: personaText, picked: picked, onClearPicked: () => { studio.clearPickedMaterial(); }, pickedTopic: pickedTopic, templateLibrary: templates, onClearPickedTopic: () => { studio.clearPickedTopic(); }, topics: topics, schedule: schedule, onSendToPublish: sendToPublish, catalog: (_jsxs(_Fragment, { children: [_jsx("div", { className: css.tabs, role: "tablist", children: STUDIO_TABS.map(candidate => (_jsx("button", { type: "button", role: "tab", "aria-selected": tab === candidate.id, "aria-label": t(candidate.id === 'create' ? 'tab.create.aria' : 'tab.operate.aria'), className: clsx(css.tab, tab === candidate.id && css.tabActive), onClick: () => { setTab(candidate.id); }, children: t(candidate.id === 'create' ? 'tab.create' : 'tab.operate') }, candidate.id))) }), _jsx("div", { className: css.body, children: groups.map(group => (_jsxs("section", { className: css.group, children: [_jsx("h2", { className: css.groupTitle, children: t(`group.${group.id}`) }), _jsx("div", { className: css.grid, children: group.items.map((item) => {
                                                                        const copied = copiedId === item.id;
                                                                        return (_jsxs("button", { type: "button", className: clsx(css.card, copied && css.cardCopied), onClick: () => { void pick(item.id, item.prompt); }, children: [_jsxs("span", { className: css.cardHead, children: [_jsx("span", { className: css.cardTitle, children: t(`cap.${item.id}.title`) }), _jsx("span", { className: clsx(css.badge, BADGE_CLASS[item.maturity]), children: t(`badge.${item.maturity}`) })] }), _jsx("span", { className: css.cardDetail, children: t(`cap.${item.id}.detail`) }), _jsx("span", { className: clsx(css.cardHint, copied && css.cardHintCopied), children: copied ? t('card.copied') : t('card.copyHint') })] }, item.id));
                                                                    }) })] }, group.id))) })] })), t: t })] }))] }), _jsx(TemplatePickerModal, { templates: templates, t: t })] })] }) }));
}
//# sourceMappingURL=ContentStudio.js.map