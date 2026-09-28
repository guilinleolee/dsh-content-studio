/**
 * The interaction view controller: one observable state object over the
 * library-root `_interactions.json` manifest (via the content-outputs
 * interactions faces), the two-step CSV import, the explicit AI calls
 * (reply drafts, batched sentiment/intent classification, batched insight
 * extraction), the send-with-local-archive behavior, and the topic-bank
 * push. Persistent business data (conversations, drafts, insights) lives in
 * the manifest; only filters and the staged import ride the browser.
 */
import { CLASSIFY_BATCH_SIZE, INSIGHT_BATCH_SIZE, batchIds, filterConversations, insightToTopicInput, loadInteractionFilters, mergeInsightBatch, saveInteractionFilters, threadLines, } from "./interaction-model.js";
/** The untagged tagging pair every stored message carries until classified. */
const untagged = {
    sentiment: { value: 'unknown', source: 'user', aiMeta: null },
    intent: { value: 'unknown', source: 'user', aiMeta: null },
};
/**
 * Create the interaction controller over the wired gateway and the topic /
 * export faces.
 * @param gateway - the interactions half of the content-outputs Remote.
 * @param topics - the topic-bank write face for the insight push.
 * @param writeExport - the guarded asset write the CSV export rides.
 * @returns the controller.
 */
export function createInteractionController(gateway, topics, writeExport) {
    let state = {
        manifest: null,
        problems: [],
        loading: false,
        busy: false,
        progress: null,
        notice: null,
        preview: null,
        importReport: null,
        selectedId: null,
        filtersRevision: 0,
    };
    const listeners = new Set();
    const notify = () => {
        for (const listener of listeners)
            listener();
    };
    const patch = (next) => {
        state = { ...state, ...next };
        notify();
    };
    const requireManifest = () => {
        if (state.manifest === null)
            throw new Error('interactions manifest not loaded');
        return state.manifest;
    };
    /** Validate-and-store one patched manifest, adopting the normalized return. */
    const persist = async (manifest) => {
        const stored = await gateway.writeInteractions(manifest);
        patch({ manifest: stored, problems: [] });
    };
    /** Patch one conversation in the manifest and persist the whole document. */
    const patchConversationIn = (manifest, id, patchConversation) => ({
        ...manifest,
        conversations: manifest.conversations.map(conversation => conversation.id === id ? patchConversation(conversation) : conversation),
    });
    return {
        getState: () => state,
        subscribe(listener) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        async load() {
            patch({ loading: true, notice: null });
            try {
                const read = await gateway.readInteractions();
                patch({ manifest: read.manifest, problems: read.problems, loading: false });
            }
            catch {
                patch({ loading: false, notice: 'load-failed' });
            }
        },
        filters: () => loadInteractionFilters(),
        setFilters(patchFilters) {
            saveInteractionFilters({ ...loadInteractionFilters(), ...patchFilters });
            patch({ filtersRevision: state.filtersRevision + 1 });
        },
        visible() {
            const manifest = state.manifest;
            if (manifest === null)
                return [];
            return filterConversations(manifest.conversations, loadInteractionFilters());
        },
        select(id) {
            patch({ selectedId: id });
        },
        async stageImport(fileName, text) {
            patch({ busy: true, notice: null });
            try {
                const preview = await gateway.parseInteractionImport({ fileName, text });
                patch({ preview, busy: false, notice: 'import-parsed' });
            }
            catch {
                patch({ busy: false, notice: 'import-failed' });
            }
        },
        async commitImport() {
            const preview = state.preview;
            if (preview === null)
                return;
            patch({ busy: true, notice: null });
            try {
                const result = await gateway.commitInteractionImport({ messages: preview.messages });
                const read = await gateway.readInteractions();
                patch({
                    manifest: read.manifest, problems: read.problems, preview: null,
                    importReport: result, busy: false, notice: 'import-committed',
                });
            }
            catch {
                patch({ busy: false, notice: 'import-failed' });
            }
        },
        discardImport() {
            patch({ preview: null });
        },
        async patchConversation(id, conversationPatch) {
            const manifest = requireManifest();
            try {
                await persist(patchConversationIn(manifest, id, conversation => ({ ...conversation, ...conversationPatch })));
            }
            catch {
                patch({ notice: 'save-failed' });
            }
        },
        async generateDrafts(conversationId, messageId, style, persona, template) {
            const manifest = requireManifest();
            const conversation = manifest.conversations.find(candidate => candidate.id === conversationId);
            if (conversation === undefined)
                return;
            patch({ busy: true, notice: null });
            try {
                const result = await gateway.generateInteractionReply({
                    style,
                    personaDigest: persona?.digest ?? null,
                    personaPhrases: persona?.phrases ?? [],
                    personaSamples: persona?.samples ?? [],
                    template,
                    thread: threadLines(conversation),
                });
                const now = new Date().toISOString();
                const drafts = result.drafts.map(draft => ({
                    id: crypto.randomUUID(),
                    style: draft.style,
                    content: draft.content,
                    personaId: persona?.id ?? null,
                    createdAt: now,
                }));
                const next = patchConversationIn(requireManifest(), conversationId, (candidate) => ({
                    ...candidate,
                    messages: candidate.messages.map(message => message.id === messageId ? { ...message, replyDrafts: drafts } : message),
                }));
                await persist(next);
                patch({ busy: false, notice: 'drafts-ready' });
            }
            catch {
                patch({ busy: false, notice: 'drafts-failed' });
            }
        },
        async saveDraft(conversationId, messageId, style, content, personaId) {
            const manifest = requireManifest();
            const draft = {
                id: crypto.randomUUID(),
                style,
                content,
                personaId,
                createdAt: new Date().toISOString(),
            };
            try {
                await persist(patchConversationIn(manifest, conversationId, (candidate) => ({
                    ...candidate,
                    messages: candidate.messages.map(message => message.id === messageId ? { ...message, replyDrafts: [...message.replyDrafts, draft] } : message),
                })));
            }
            catch {
                patch({ notice: 'save-failed' });
            }
        },
        async sendReply(conversationId, inReplyToMessageId, content, personaId) {
            const manifest = requireManifest();
            const conversation = manifest.conversations.find(candidate => candidate.id === conversationId);
            if (conversation === undefined)
                return;
            const replied = conversation.messages.find(message => message.id === inReplyToMessageId);
            const now = new Date().toISOString();
            try {
                await persist(patchConversationIn(manifest, conversationId, (candidate) => ({
                    ...candidate,
                    // The status machine's only other automatic transition: answering
                    // an open conversation closes it.
                    status: candidate.status === 'unread' || candidate.status === 'pendingReply' ? 'replied' : candidate.status,
                    updatedAt: now,
                    messages: [...candidate.messages, {
                            id: crypto.randomUUID(),
                            // The outbound reply has no platform id yet — the local prefix
                            // keeps the dedup key unique until a provider assigns one.
                            externalMessageId: `local-${crypto.randomUUID()}`,
                            direction: 'out',
                            type: replied?.type ?? 'comment',
                            content,
                            inReplyTo: inReplyToMessageId,
                            sentAt: now,
                            sentiment: { ...untagged.sentiment },
                            intent: { ...untagged.intent },
                            replyDrafts: [],
                        }],
                })));
            }
            catch {
                patch({ notice: 'save-failed' });
                return;
            }
            // The reserved channel knock: always refused this phase, never
            // load-bearing for the archive above.
            await gateway.sendInteractionReply({ conversationId, inReplyTo: inReplyToMessageId, content, personaId }).catch(() => undefined);
            patch({ notice: 'sent-archived' });
        },
        async classifySelected(conversationIds) {
            const manifest = requireManifest();
            const wanted = new Set(conversationIds);
            const messages = manifest.conversations
                .filter(conversation => wanted.has(conversation.id))
                .flatMap(conversation => conversation.messages
                .filter(message => message.direction === 'in' && message.sentiment.source !== 'ai' && message.intent.source !== 'ai')
                .map(message => ({ conversationId: conversation.id, messageId: message.id, content: message.content })));
            if (messages.length === 0) {
                patch({ notice: 'classify-done' });
                return;
            }
            const byId = new Map(messages.map(message => [message.messageId, message]));
            const batches = batchIds(messages.map(message => message.messageId), CLASSIFY_BATCH_SIZE);
            patch({ busy: true, notice: null, progress: { done: 0, total: batches.length } });
            let working = requireManifest();
            let failures = 0;
            for (let index = 0; index < batches.length; index += 1) {
                const batch = batches[index];
                try {
                    const result = await gateway.classifyInteractions({
                        messages: batch.map(id => ({ messageId: id, content: byId.get(id)?.content ?? '' })),
                    });
                    const byMessage = new Map(result.entries.map(entry => [entry.messageId, entry]));
                    const now = new Date().toISOString();
                    working = {
                        ...working,
                        conversations: working.conversations.map(conversation => wanted.has(conversation.id)
                            ? {
                                ...conversation,
                                messages: conversation.messages.map((message) => {
                                    const entry = byMessage.get(message.id);
                                    if (entry === undefined)
                                        return message;
                                    return {
                                        ...message,
                                        sentiment: { value: entry.sentiment, source: 'ai', aiMeta: { promptVersion: result.promptVersion, at: now } },
                                        intent: { value: entry.intent, source: 'ai', aiMeta: { promptVersion: result.promptVersion, at: now } },
                                    };
                                }),
                            }
                            : conversation),
                    };
                    await persist(working);
                }
                catch {
                    // One failed batch leaves its messages unknown; the loop continues.
                    failures += 1;
                }
                patch({ progress: { done: index + 1, total: batches.length } });
            }
            patch({ busy: false, progress: null, notice: failures > 0 ? 'classify-failed' : 'classify-done' });
        },
        async extractInsights(conversationIds) {
            const manifest = requireManifest();
            const wanted = new Set(conversationIds);
            const messages = manifest.conversations
                .filter(conversation => wanted.has(conversation.id) && conversation.status !== 'archived' && conversation.status !== 'spam')
                .flatMap(conversation => conversation.messages
                .filter(message => message.direction === 'in')
                .map(message => ({ messageId: message.id, content: message.content })));
            if (messages.length === 0) {
                patch({ notice: 'insights-done' });
                return;
            }
            const byId = new Map(messages.map(message => [message.messageId, message]));
            const batches = batchIds(messages.map(message => message.messageId), INSIGHT_BATCH_SIZE);
            patch({ busy: true, notice: null, progress: { done: 0, total: batches.length } });
            let insights = { ...requireManifest().insights };
            let failures = 0;
            for (let index = 0; index < batches.length; index += 1) {
                const batch = batches[index];
                try {
                    const result = await gateway.extractInteractionInsights({
                        messages: batch.map(id => ({ messageId: id, content: byId.get(id)?.content ?? '' })),
                    });
                    insights = mergeInsightBatch(insights, result.batch);
                }
                catch {
                    // One failed batch drops out of the merge; the loop continues.
                    failures += 1;
                }
                patch({ progress: { done: index + 1, total: batches.length } });
            }
            try {
                await persist({ ...requireManifest(), insights: { ...insights, generatedAt: new Date().toISOString() } });
                patch({ busy: false, progress: null, notice: failures > 0 ? 'insights-failed' : 'insights-done' });
            }
            catch {
                patch({ busy: false, progress: null, notice: 'save-failed' });
            }
        },
        async pushTopic(title, oneLiner, conversationId, summary) {
            const input = insightToTopicInput(title, oneLiner, conversationId, summary, new Date().toISOString());
            try {
                await topics.put(input);
                patch({ notice: 'topic-added' });
            }
            catch {
                patch({ notice: 'topic-failed' });
            }
        },
        async exportCsv(theme) {
            if (theme.length === 0) {
                patch({ notice: 'need-theme' });
                return;
            }
            patch({ busy: true, notice: null });
            try {
                const { text } = await gateway.exportInteractionCsv();
                const stamp = new Date().toISOString().slice(0, 10);
                await writeExport(theme, `interactions-${stamp}.csv`, text);
                patch({ busy: false, notice: 'exported' });
            }
            catch {
                patch({ busy: false, notice: 'export-failed' });
            }
        },
        clearNotice() {
            patch({ notice: null });
        },
    };
}
//# sourceMappingURL=interaction-store.js.map