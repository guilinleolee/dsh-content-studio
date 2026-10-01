import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The interaction view: a unified fan inbox over the interaction controller.
 * The header carries the derived summary chips; the toolbar holds the CSV
 * import, the CSV export, the batch classifier, the insight extractor, and
 * the disabled MCP-pull entry (the reserved channel). The left pane lists
 * the filtered conversations; the right pane renders the selected thread
 * with the persona binding, the demand tags, the note, the AI draft set,
 * and the send composer whose archive never depends on the reserved call.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { INTERACTION_PLATFORM_IDS, INTERACTION_SENTIMENT_IDS, INTERACTION_STATUS_IDS, INTERACTION_STYLE_IDS, INTERACTION_TYPE_IDS, lastInboundMessage, lastMessage, } from "./interaction/interaction-model.js";
import { SplitDetail } from "./SplitDetail.js";
import css from './InteractionView.module.css';
/** The demand-tag values the data contract freezes; stored and rendered verbatim. */
const TAG_OPTIONS = ['产品咨询', '价格疑问', '内容建议', '投诉', '其他'];
/** Platform label keys, aligned with the picker order. */
const PLATFORM_KEYS = {
    xhs: 'interaction.platform.xhs',
    douyin: 'interaction.platform.douyin',
    weixin: 'interaction.platform.weixin',
    bilibili: 'interaction.platform.bilibili',
};
/** Shorten one message to the list excerpt length. */
function excerpt(text, max = 60) {
    const single = text.replaceAll(/\s+/gu, ' ').trim();
    return single.length > max ? `${single.slice(0, max)}…` : single;
}
/**
 * Render the interaction workbench.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export function InteractionView({ interaction, personas, templates, listThemes, t }) {
    const state = useSyncExternalStore(fn => interaction.subscribe(fn), () => interaction.getState());
    const personaState = useSyncExternalStore(fn => personas.subscribe(fn), () => personas.getState());
    const [themes, setThemes] = useState([]);
    const [exportTheme, setExportTheme] = useState('');
    const [composer, setComposer] = useState('');
    const [style, setStyle] = useState('friendly');
    const [targetMessageId, setTargetMessageId] = useState(null);
    const [templateSkeleton, setTemplateSkeleton] = useState(null);
    const [noteDraft, setNoteDraft] = useState('');
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
        const timer = window.setTimeout(() => { interaction.clearNotice(); }, 4000);
        return () => { window.clearTimeout(timer); };
    }, [state.notice, interaction]);
    const filters = interaction.filters();
    const conversations = useMemo(() => interaction.visible(), [interaction, state.manifest, state.filtersRevision]);
    const selected = useMemo(() => state.manifest?.conversations.find(candidate => candidate.id === state.selectedId) ?? null, [state.manifest, state.selectedId]);
    const selectedId = selected?.id ?? null;
    // Reset the editor state when the selection changes — never on unrelated
    // manifest refreshes, or typing would lose its work.
    useEffect(() => {
        const current = selectedId === null
            ? null
            : interaction.getState().manifest?.conversations.find(candidate => candidate.id === selectedId) ?? null;
        setNoteDraft(current?.note ?? '');
        setTargetMessageId(current === null ? null : lastInboundMessage(current)?.id ?? null);
        setComposer('');
    }, [selectedId, interaction]);
    // Keep the note editor in sync when the store changed it underneath
    // (another save path), without fighting the typing in progress.
    useEffect(() => {
        if (selected !== null && document.activeElement?.tagName !== 'TEXTAREA')
            setNoteDraft(selected.note);
    }, [selected]);
    const personaOf = (id) => id === null ? null : personaState.personas.find(entry => entry.id === id) ?? null;
    const personaFacts = (entry) => entry === null ? null : {
        id: entry.id,
        digest: entry.digest.length > 0 ? entry.digest : null,
        phrases: typeof entry.fields.phrases.value === 'string' && entry.fields.phrases.value.trim().length > 0
            ? [entry.fields.phrases.value.trim()]
            : [],
        samples: entry.links
            .map(link => link.sampleText)
            .filter((sample) => sample !== null && sample.trim().length > 0),
    };
    const togglePlatform = (platform) => {
        const next = filters.platforms.includes(platform)
            ? filters.platforms.filter(candidate => candidate !== platform)
            : [...filters.platforms, platform];
        interaction.setFilters({ platforms: next });
    };
    const toggleTag = (conversation, tag) => {
        const next = conversation.tags.includes(tag)
            ? conversation.tags.filter(candidate => candidate !== tag)
            : [...conversation.tags, tag];
        void interaction.patchConversation(conversation.id, { tags: next });
    };
    const onImportFile = (file) => {
        if (file === undefined)
            return;
        void (async () => {
            const text = await file.text();
            await interaction.stageImport(file.name, text);
        })();
    };
    const target = selected === null || targetMessageId === null
        ? null
        : selected.messages.find(message => message.id === targetMessageId) ?? null;
    const pickTemplate = () => {
        templates.openPicker({
            category: 'interaction',
            targetLabel: t('interaction.reply.title'),
            hasContent: () => templateSkeleton !== null,
            apply: (draft) => { setTemplateSkeleton(draft.body); },
        });
    };
    const generate = () => {
        if (selected === null || target === null || target.direction !== 'in')
            return;
        void interaction.generateDrafts(selected.id, target.id, style, personaFacts(personaOf(selected.personaId)), templateSkeleton);
    };
    // The topic push anchors on the conversation that produced the example
    // message; a lost anchor degrades to the selected conversation.
    const conversationOfExample = (exampleMessageId) => {
        if (exampleMessageId !== null) {
            const owner = state.manifest?.conversations.find(conversation => conversation.messages.some(message => message.id === exampleMessageId));
            if (owner !== undefined)
                return owner.id;
        }
        return selectedId ?? '';
    };
    const pushInsight = (entry) => {
        void interaction.pushTopic(entry.label, entry.topicHint ?? entry.label, conversationOfExample(entry.exampleMessageId), entry.topicHint ?? entry.label);
    };
    const summary = state.manifest?.summary;
    const insights = state.manifest?.insights;
    const listPane = (_jsxs("div", { className: css.listInner, children: [_jsxs("div", { className: css.filters, children: [_jsx("div", { className: css.chipRow, children: INTERACTION_PLATFORM_IDS.map(platform => (_jsx("button", { type: "button", className: css.chip, "aria-pressed": filters.platforms.includes(platform), onClick: () => { togglePlatform(platform); }, children: t(PLATFORM_KEYS[platform]) }, platform))) }), _jsxs("div", { className: css.selectRow, children: [_jsxs("select", { className: css.select, "aria-label": t('interaction.filter.status'), value: filters.status, onChange: (event) => { interaction.setFilters({ status: event.target.value }); }, children: [_jsx("option", { value: "all", children: t('interaction.filter.all') }), INTERACTION_STATUS_IDS.map(status => (_jsx("option", { value: status, children: t(`interaction.status.${status}`) }, status)))] }), _jsxs("select", { className: css.select, "aria-label": t('interaction.filter.type'), value: filters.type, onChange: (event) => { interaction.setFilters({ type: event.target.value }); }, children: [_jsx("option", { value: "all", children: t('interaction.filter.all') }), INTERACTION_TYPE_IDS.map(type => (_jsx("option", { value: type, children: t(`interaction.type.${type}`) }, type)))] }), _jsxs("select", { className: css.select, "aria-label": t('interaction.filter.sentiment'), value: filters.sentiment, onChange: (event) => { interaction.setFilters({ sentiment: event.target.value }); }, children: [_jsx("option", { value: "all", children: t('interaction.filter.all') }), INTERACTION_SENTIMENT_IDS.map(sentiment => (_jsx("option", { value: sentiment, children: t(`interaction.sentiment.${sentiment}`) }, sentiment)))] }), _jsxs("select", { className: css.select, "aria-label": t('interaction.filter.intent'), value: filters.intent, onChange: (event) => { interaction.setFilters({ intent: event.target.value }); }, children: [_jsx("option", { value: "all", children: t('interaction.filter.all') }), ['consult', 'praise', 'complain', 'demand', 'spam', 'unknown'].map(intent => (_jsx("option", { value: intent, children: t(`interaction.intent.${intent}`) }, intent)))] })] }), _jsx("input", { className: css.search, type: "search", placeholder: t('interaction.filter.search'), value: filters.search, onChange: (event) => { interaction.setFilters({ search: event.target.value }); } })] }), _jsxs("div", { className: css.cards, children: [conversations.length === 0 && _jsx("div", { className: css.emptySmall, children: t('interaction.list.none') }), conversations.map((conversation) => {
                        const latest = lastMessage(conversation);
                        return (_jsxs("button", { type: "button", className: css.card, "aria-current": conversation.id === state.selectedId || undefined, onClick: () => { interaction.select(conversation.id); }, children: [_jsxs("span", { className: css.cardHead, children: [_jsx("span", { className: css.cardName, children: conversation.participant.nickname.length > 0
                                                ? conversation.participant.nickname
                                                : conversation.participant.externalUserId }), _jsx("span", { className: css.platform, children: t(PLATFORM_KEYS[conversation.platform]) })] }), latest !== null && _jsx("span", { className: css.cardExcerpt, children: excerpt(latest.content) }), _jsxs("span", { className: css.cardMeta, children: [_jsx("span", { children: t(`interaction.status.${conversation.status}`) }), _jsxs("span", { children: [conversation.messages.length, " ", t('interaction.list.messages')] }), conversation.starred && _jsx("span", { "aria-label": t('interaction.star'), children: "\u2605" })] })] }, conversation.id));
                    })] })] }));
    const detailPane = selected === null
        ? _jsx("div", { className: css.empty, children: t('interaction.detail.empty') })
        : (_jsxs("div", { className: css.detail, children: [_jsxs("div", { className: css.detailHead, children: [_jsx("span", { className: css.cardName, children: selected.participant.nickname.length > 0 ? selected.participant.nickname : selected.participant.externalUserId }), _jsx("select", { className: css.select, "aria-label": t('interaction.filter.status'), value: selected.status, onChange: (event) => {
                                void interaction.patchConversation(selected.id, { status: event.target.value });
                            }, children: INTERACTION_STATUS_IDS.map(status => (_jsx("option", { value: status, children: t(`interaction.status.${status}`) }, status))) }), _jsxs("select", { className: css.select, "aria-label": t('interaction.detail.persona'), value: selected.personaId ?? '', onChange: (event) => { void interaction.patchConversation(selected.id, { personaId: event.target.value === '' ? null : event.target.value }); }, children: [_jsx("option", { value: "", children: t('interaction.detail.persona.none') }), personaState.personas.map(entry => (_jsx("option", { value: entry.id, children: entry.name }, entry.id)))] }), _jsx("button", { type: "button", className: css.mini, "aria-pressed": selected.starred, onClick: () => { void interaction.patchConversation(selected.id, { starred: !selected.starred }); }, children: selected.starred ? `★ ${t('interaction.unstar')}` : `☆ ${t('interaction.star')}` })] }), (selected.topicRef !== null || selected.outputRef !== null) && (_jsxs("div", { className: css.refs, children: [selected.topicRef !== null && _jsxs("span", { children: [t('interaction.detail.topicRef'), ": ", selected.topicRef] }), selected.outputRef !== null && _jsxs("span", { children: [t('interaction.detail.outputRef'), ": ", selected.outputRef] })] })), _jsx("div", { className: css.tagRow, "aria-label": t('interaction.detail.tags'), children: TAG_OPTIONS.map(tag => (_jsx("button", { type: "button", className: css.chip, "aria-pressed": selected.tags.includes(tag), onClick: () => { toggleTag(selected, tag); }, children: tag }, tag))) }), _jsx("textarea", { className: css.note, "aria-label": t('interaction.detail.note.aria'), placeholder: t('interaction.detail.note.placeholder'), value: noteDraft, onChange: (event) => { setNoteDraft(event.target.value); }, onBlur: () => {
                        if (noteDraft !== selected.note)
                            void interaction.patchConversation(selected.id, { note: noteDraft });
                    } }), _jsx("div", { className: css.thread, "aria-label": t('interaction.detail.label'), children: selected.messages.map((message) => {
                        const isFan = message.direction === 'in';
                        return (_jsxs("button", { type: "button", className: isFan ? css.lineIn : css.lineOut, "data-target": message.id === targetMessageId || undefined, onClick: () => { if (isFan)
                                setTargetMessageId(message.id); }, children: [_jsx("span", { className: css.lineRole, children: isFan ? t('interaction.thread.fan') : t('interaction.thread.me') }), _jsxs("span", { className: css.lineBody, children: [message.content, isFan && (_jsxs("span", { className: css.taggings, children: [_jsxs("span", { children: [t(`interaction.sentiment.${message.sentiment.value}`), message.sentiment.source === 'ai' && t('interaction.thread.aiTag')] }), _jsxs("span", { children: [t(`interaction.intent.${message.intent.value}`), message.intent.source === 'ai' && t('interaction.thread.aiTag')] })] }))] })] }, message.id));
                    }) }), _jsxs("div", { className: css.reply, children: [_jsx("span", { className: css.sectionTitle, children: t('interaction.reply.title') }), target === null || target.direction !== 'in'
                            ? _jsx("span", { className: css.emptySmall, children: t('interaction.reply.noTarget') })
                            : (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.replyControls, children: [_jsxs("label", { className: css.label, children: [t('interaction.reply.style'), _jsx("select", { className: css.select, value: style, onChange: (event) => { setStyle(event.target.value); }, children: INTERACTION_STYLE_IDS.map(candidate => (_jsx("option", { value: candidate, children: t(`interaction.style.${candidate}`) }, candidate))) })] }), _jsx("button", { type: "button", className: css.mini, onClick: pickTemplate, children: t('interaction.reply.template') }), templateSkeleton !== null && (_jsx("button", { type: "button", className: css.mini, onClick: () => { setTemplateSkeleton(null); }, children: "\u2715" })), _jsx("button", { type: "button", className: css.primary, disabled: state.busy, onClick: generate, children: t('interaction.reply.generate') })] }), target.replyDrafts.length > 0 && (_jsxs("div", { className: css.drafts, children: [_jsx("span", { className: css.sectionTitle, children: t('interaction.reply.drafts') }), target.replyDrafts.map(draft => (_jsxs("div", { className: css.draft, children: [_jsx("span", { className: css.draftBody, children: draft.content }), _jsx("button", { type: "button", className: css.mini, onClick: () => { setComposer(draft.content); }, children: t('interaction.reply.adopt') })] }, draft.id)))] })), _jsx("textarea", { className: css.composer, "aria-label": t('interaction.reply.composer'), value: composer, onChange: (event) => { setComposer(event.target.value); } }), _jsxs("div", { className: css.replyActions, children: [_jsx("button", { type: "button", className: css.mini, disabled: composer.trim().length === 0 || state.busy, onClick: () => {
                                                    // The surrounding target guard already narrowed both;
                                                    // only the composer emptiness needs checking here.
                                                    if (composer.trim().length === 0)
                                                        return;
                                                    void interaction.saveDraft(selected.id, target.id, style, composer.trim(), selected.personaId);
                                                }, children: t('interaction.reply.sendDraft') }), _jsx("button", { type: "button", className: css.primary, disabled: composer.trim().length === 0 || state.busy, onClick: () => {
                                                    if (composer.trim().length === 0)
                                                        return;
                                                    const content = composer.trim();
                                                    const personaId = selected.personaId;
                                                    void (async () => {
                                                        await interaction.sendReply(selected.id, target.id, content, personaId);
                                                        setComposer('');
                                                    })();
                                                }, children: t('interaction.reply.send') })] })] }))] })] }));
    return (_jsxs("div", { className: css.view, children: [_jsxs("div", { className: css.header, children: [_jsx("h2", { className: css.title, children: t('interaction.title') }), _jsx("span", { className: css.subtitle, children: t('interaction.subtitle') })] }), summary !== undefined && (_jsx("div", { className: css.summaryRow, children: INTERACTION_STATUS_IDS.map(status => (_jsxs("span", { className: css.summaryChip, children: [t(`interaction.summary.${status}`), " \u00D7", summary[status]] }, status))) })), state.problems.length > 0 && (_jsxs("div", { className: css.problems, children: [t('interaction.problems'), " ", state.problems.join('；')] })), state.notice !== null && (_jsx("div", { className: css.notice, role: "status", children: t(`interaction.notice.${state.notice}`) })), state.busy && (_jsxs("div", { className: css.busy, children: [t('interaction.busy'), state.progress !== null && _jsx("span", { children: ` ${state.progress.done}/${state.progress.total}` })] })), _jsxs("div", { className: css.toolbar, children: [_jsxs("label", { className: css.fileButton, children: [t('interaction.import'), _jsx("input", { type: "file", accept: ".csv,text/csv", className: css.fileInput, onChange: (event) => { onImportFile(event.target.files?.[0]); } })] }), _jsx("button", { type: "button", className: css.mini, disabled: state.busy || conversations.length === 0, onClick: () => { void interaction.classifySelected(conversations.map(conversation => conversation.id)); }, children: t('interaction.classify') }), _jsx("button", { type: "button", className: css.mini, disabled: state.busy || conversations.length === 0, onClick: () => { void interaction.extractInsights(conversations.map(conversation => conversation.id)); }, children: t('interaction.insights') }), _jsx("span", { className: css.mcpPull, title: t('interaction.mcp.disabled'), children: _jsx("button", { type: "button", className: css.mini, disabled: true, children: t('interaction.mcp.pull') }) }), _jsxs("span", { className: css.exportGroup, children: [_jsxs("select", { className: css.select, "aria-label": t('interaction.export.aria'), value: exportTheme, onChange: (event) => { setExportTheme(event.target.value); }, children: [_jsx("option", { value: "", children: t('interaction.export.aria') }), themes.map(theme => _jsx("option", { value: theme, children: theme }, theme))] }), _jsx("button", { type: "button", className: css.mini, disabled: state.busy, onClick: () => { void interaction.exportCsv(exportTheme); }, children: t('interaction.export') })] })] }), state.preview !== null && (_jsxs("div", { className: css.preview, children: [_jsxs("span", { className: css.sectionTitle, children: [t('interaction.import.preview'), " \u2014 ", state.preview.fileName] }), _jsxs("span", { children: [state.preview.messages.length, " ", t('interaction.import.valid')] }), state.preview.rejected.length > 0 && (_jsxs("div", { className: css.rejected, children: [_jsxs("span", { children: [t('interaction.import.rejected'), ":"] }), state.preview.rejected.map(rejection => (_jsxs("div", { className: css.rejectedRow, children: ["#", rejection.row, ": ", rejection.reason] }, rejection.row)))] })), _jsxs("div", { className: css.replyActions, children: [_jsx("button", { type: "button", className: css.mini, onClick: () => { interaction.discardImport(); }, children: t('interaction.import.discard') }), _jsx("button", { type: "button", className: css.primary, disabled: state.preview.messages.length === 0, onClick: () => { void interaction.commitImport(); }, children: t('interaction.import.commit') })] })] })), state.importReport !== null && state.preview === null && (_jsxs("div", { className: css.report, children: [_jsxs("span", { children: [t('interaction.import.report'), ":"] }), _jsxs("span", { children: [state.importReport.added, " ", t('interaction.import.added')] }), _jsxs("span", { children: [state.importReport.updated, " ", t('interaction.import.updated')] }), _jsxs("span", { children: [state.importReport.conversationsCreated, " ", t('interaction.import.created')] }), _jsxs("span", { children: [state.importReport.threadWarnings.length, " ", t('interaction.import.threads')] })] })), insights !== undefined && (_jsxs("div", { className: css.insights, children: [_jsx("span", { className: css.sectionTitle, children: t('interaction.insights.title') }), insights.generatedAt !== null && (_jsxs("span", { className: css.generatedAt, children: [t('interaction.insights.generatedAt'), " ", insights.generatedAt.slice(0, 10)] })), insights.generatedAt === null && _jsx("span", { className: css.emptySmall, children: t('interaction.insights.none') }), _jsx(InsightList, { label: t('interaction.insights.questions'), entries: insights.topQuestions, onPush: pushInsight, t: t }), _jsx(InsightList, { label: t('interaction.insights.pain'), entries: insights.painPoints, onPush: pushInsight, t: t }), _jsx(InsightList, { label: t('interaction.insights.interests'), entries: insights.interests, onPush: pushInsight, t: t })] })), state.manifest === null && state.loading && _jsx("div", { className: css.empty, children: t('interaction.loading') }), state.manifest !== null && state.manifest.conversations.length === 0 && (_jsx("div", { className: css.empty, children: t('interaction.empty') })), state.manifest !== null && state.manifest.conversations.length > 0 && (_jsx(SplitDetail, { list: listPane, detail: detailPane, detailLabel: t('interaction.detail.label') }))] }));
}
/** One insight list with its per-entry topic push. */
function InsightList({ label, entries, onPush, t }) {
    if (entries.length === 0)
        return null;
    return (_jsxs("div", { className: css.insightList, children: [_jsx("span", { className: css.insightLabel, children: label }), entries.map(entry => (_jsxs("div", { className: css.insightRow, children: [_jsxs("span", { className: css.insightText, children: [entry.label, " \u00D7", entry.count] }), entry.topicHint !== null && _jsx("span", { className: css.insightHint, children: entry.topicHint }), _jsx("button", { type: "button", className: css.mini, onClick: () => { onPush(entry); }, children: t('interaction.insights.toTopic') })] }, entry.label)))] }));
}
//# sourceMappingURL=InteractionView.js.map