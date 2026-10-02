/**
 * The interaction view controller: one observable state object over the
 * library-root `_interactions.json` manifest (via the content-outputs
 * interactions faces), the two-step CSV import, the explicit AI calls
 * (reply drafts, batched sentiment/intent classification, batched insight
 * extraction), the send-with-local-archive behavior, and the topic-bank
 * push. Persistent business data (conversations, drafts, insights) lives in
 * the manifest; only filters and the staged import ride the browser.
 */
import type { InteractionClassifyEntry, InteractionClassifyMessage, InteractionConversation, InteractionImportCommitResult, InteractionImportPreview, InteractionInsights, InteractionSendReplyRequest, InteractionStyle, InteractionsManifest, InteractionsManifestRead } from '@deepseek-ai/dsh-content-outputs/types';
import type { TopicItemInput } from '@deepseek-ai/dsh-content-topics/types';
import { type InteractionFilters } from './interaction-model.ts';
/** Persona facts the reply generator layers its tone base over. */
export interface InteractionPersonaFacts {
    readonly id: string;
    readonly digest: string | null;
    readonly phrases: readonly string[];
    readonly samples: readonly string[];
}
/** The injected server face: the interactions half of the content-outputs Remote. */
export interface InteractionGateway {
    readInteractions: () => Promise<InteractionsManifestRead>;
    writeInteractions: (manifest: InteractionsManifest) => Promise<InteractionsManifest>;
    parseInteractionImport: (request: {
        fileName: string;
        text: string;
    }) => Promise<InteractionImportPreview>;
    commitInteractionImport: (request: {
        messages: InteractionImportPreview['messages'];
    }) => Promise<InteractionImportCommitResult>;
    generateInteractionReply: (request: {
        style: InteractionStyle;
        personaDigest: string | null;
        personaPhrases: readonly string[];
        personaSamples: readonly string[];
        template: string | null;
        thread: readonly {
            direction: 'in' | 'out';
            content: string;
        }[];
    }) => Promise<{
        drafts: readonly {
            style: InteractionStyle;
            content: string;
        }[];
        model: string;
        promptVersion: string;
    }>;
    classifyInteractions: (request: {
        messages: readonly InteractionClassifyMessage[];
    }) => Promise<{
        entries: readonly InteractionClassifyEntry[];
        promptVersion: string;
    }>;
    extractInteractionInsights: (request: {
        messages: readonly InteractionClassifyMessage[];
    }) => Promise<{
        batch: {
            questions: InteractionInsights['topQuestions'];
            painPoints: InteractionInsights['painPoints'];
            interests: InteractionInsights['interests'];
        };
    }>;
    exportInteractionCsv: () => Promise<{
        text: string;
    }>;
    sendInteractionReply: (request: InteractionSendReplyRequest) => Promise<{
        ok: false;
        reason: 'MCP_NOT_CONFIGURED';
    }>;
}
/** One-step user-facing outcome codes; the copy lives in the locale dictionaries. */
export type InteractionNotice = 'load-failed' | 'import-parsed' | 'import-failed' | 'import-committed' | 'save-failed' | 'drafts-ready' | 'drafts-failed' | 'classify-done' | 'classify-failed' | 'insights-done' | 'insights-failed' | 'sent-archived' | 'exported' | 'export-failed' | 'need-theme' | 'topic-added' | 'topic-failed';
/** Snapshot the React surface subscribes to. */
export interface InteractionState {
    readonly manifest: InteractionsManifest | null;
    /** Stored entries that failed validation, named but not dropped silently. */
    readonly problems: readonly string[];
    readonly loading: boolean;
    /** Any in-flight import, AI, or send call. */
    readonly busy: boolean;
    /** Batched-loop progress, present only while a loop runs. */
    readonly progress: {
        readonly done: number;
        readonly total: number;
    } | null;
    readonly notice: InteractionNotice | null;
    /** The underlying server message of the last failed call, for the notice line. */
    readonly errorDetail: string | null;
    /** The staged import preview awaiting user confirmation. */
    readonly preview: InteractionImportPreview | null;
    /** The last commit's accounting, rendered as the import report. */
    readonly importReport: InteractionImportCommitResult | null;
    readonly selectedId: string | null;
    /** Bumped on every filter change so subscribers recompute the list. */
    readonly filtersRevision: number;
}
/** The topics face the insight push rides; structural so tests can stub it. */
export interface InteractionTopicsFace {
    put: (input: TopicItemInput) => Promise<unknown>;
}
/** The asset-write face the CSV export rides. */
export interface InteractionExportFace {
    (theme: string, file: string, content: string): Promise<unknown>;
}
/** The controller the view consumes. */
export interface InteractionController {
    getState(): InteractionState;
    subscribe(listener: () => void): () => void;
    load(): Promise<void>;
    filters(): InteractionFilters;
    setFilters(patch: Partial<Omit<InteractionFilters, 'version'>>): void;
    /** The conversations matching the active filters, store order preserved. */
    visible(): InteractionConversation[];
    select(id: string | null): void;
    /** Stage one file's parse preview (no storage). */
    stageImport(fileName: string, text: string): Promise<void>;
    /** Commit the staged preview's rows. */
    commitImport(): Promise<void>;
    discardImport(): void;
    /** Patch one conversation's header fields and persist. */
    patchConversation(id: string, patch: Partial<Pick<InteractionConversation, 'status' | 'tags' | 'note' | 'starred' | 'personaId' | 'topicRef' | 'outputRef'>>): Promise<void>;
    /**
     * Generate the fixed draft set for one message and store it as the
     * message's drafts.
     */
    generateDrafts(conversationId: string, messageId: string, style: InteractionStyle, persona: InteractionPersonaFacts | null, template: string | null): Promise<void>;
    /** Save one hand-tuned draft onto the message's draft list. */
    saveDraft(conversationId: string, messageId: string, style: InteractionStyle, content: string, personaId: string | null): Promise<void>;
    /**
     * Send the final reply: archive an `out` message, flip the conversation to
     * `replied`, then knock on the reserved MCP channel — the archive never
     * depends on its refusal.
     */
    sendReply(conversationId: string, inReplyToMessageId: string, content: string, personaId: string | null): Promise<void>;
    /** Classify every untagged inbound message of the given conversations, fifty per call. */
    classifySelected(conversationIds: readonly string[]): Promise<void>;
    /** Extract insights from the given conversations' inbound messages, two hundred per call. */
    extractInsights(conversationIds: readonly string[]): Promise<void>;
    /** Push one insight line into the topic bank. */
    pushTopic(title: string, oneLiner: string | null, conversationId: string, summary: string | null): Promise<void>;
    /** Export the whole inbox as CSV into one theme's `assets/`. */
    exportCsv(theme: string): Promise<void>;
    clearNotice(): void;
}
/**
 * Create the interaction controller over the wired gateway and the topic /
 * export faces.
 * @param gateway - the interactions half of the content-outputs Remote.
 * @param topics - the topic-bank write face for the insight push.
 * @param writeExport - the guarded asset write the CSV export rides.
 * @returns the controller.
 */
export declare function createInteractionController(gateway: InteractionGateway, topics: InteractionTopicsFace, writeExport: InteractionExportFace): InteractionController;
//# sourceMappingURL=interaction-store.d.ts.map