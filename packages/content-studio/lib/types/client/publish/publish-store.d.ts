/**
 * The publish view controller: one observable state object over the publish
 * faces of the content-outputs Remote (theme-side `_publish.json` manifests,
 * the global index, the account cards, derived drafts, and the per-platform
 * AI adaptation), plus the calendar and topic-bank faces for the scheduling
 * and reflow handoffs. Every AI call is explicit; a per-platform failure
 * never blocks the other legs; task retries append attempt entries and never
 * rewrite the logged history.
 */
import type { PublishAdaptRequest, PublishAdaptResult, PublishIndexEntry, PublishIndexRead, PublishManifest, PublishManifestRead, PublishPackage, PublishProfile, PublishProfilesDoc, PublishProfilesRead, PublishTask } from '@deepseek-ai/dsh-content-outputs/types';
import type { ContentScheduleSnapshot, ScheduleItemInput } from '@deepseek-ai/dsh-content-schedule/types';
import type { ContentTopicsSnapshot, TopicItemInput } from '@deepseek-ai/dsh-content-topics/types';
import type { ContentOutputsSnapshot } from '@deepseek-ai/dsh-content-outputs/types';
import { manuscriptCards } from './model.ts';
/** The injected server face: the publish half of the content-outputs Remote. */
export interface PublishGateway {
    readPublishManifest(theme: string): Promise<PublishManifestRead>;
    writePublishManifest(theme: string, manifest: PublishManifest): Promise<void>;
    listPublishIndex(): Promise<PublishIndexRead>;
    readPublishProfiles(): Promise<PublishProfilesRead>;
    writePublishProfiles(profiles: PublishProfilesDoc['profiles']): Promise<void>;
    writePublishDerived(theme: string, taskId: string, platformId: string, content: string): Promise<{
        file: string;
    }>;
    readPublishDerived(theme: string, taskId: string, platformId: string): Promise<{
        content?: string;
    }>;
    readPublishSource(theme: string, file: string): Promise<{
        content?: string;
    }>;
    buildPublishPackage(theme: string, taskId: string): Promise<PublishPackage>;
    adaptPublishContent(request: PublishAdaptRequest): Promise<PublishAdaptResult>;
}
/** Type re-exports kept local so views import the controller, not the wire file. */
export type { PublishPackage, PublishAdaptRequest, PublishAdaptResult, PublishManifestRead };
/** One-step user-facing outcome codes; the copy lives in the locale dictionaries. */
export type PublishNotice = 'profiles-saved' | 'profiles-failed' | 'task-created' | 'task-create-failed' | 'adapt-done' | 'adapt-failed' | 'draft-saved' | 'draft-save-failed' | 'recorded' | 'record-failed' | 'scheduled' | 'schedule-failed' | 'task-deleted' | 'task-deleted-schedule-stale' | 'delete-failed' | 'copied' | 'reflowed' | 'reflow-orphan' | 'reflow-failed' | 'due-tasks' | 'load-failed';
/** The observable view state. */
export interface PublishState {
    readonly loading: boolean;
    /** Manuscript pool: every root deliverable across the library, newest first. */
    readonly manuscripts: ReturnType<typeof manuscriptCards>;
    readonly profiles: readonly PublishProfile[];
    readonly profileProblems: readonly string[];
    /** Global history rows across every theme. */
    readonly index: readonly PublishIndexEntry[];
    readonly indexProblems: readonly string[];
    /** The theme whose tasks are loaded, or null. */
    readonly theme: string | null;
    readonly tasks: readonly PublishTask[];
    readonly manifestProblems: readonly string[];
    readonly openTaskId: string | null;
    /** Per-leg adapting flags, keyed `taskId:platformId`. */
    readonly busyPlatforms: Readonly<Record<string, boolean>>;
    /** True while the record handoff (package build) is running. */
    readonly recording: boolean;
    readonly notice: PublishNotice | null;
    readonly error: string | null;
}
/** The topic-bank face the reflow needs. */
export interface PublishTopicsFace {
    list(): Promise<ContentTopicsSnapshot>;
    put(input: TopicItemInput): Promise<unknown>;
}
/** The calendar face scheduling needs. */
export interface PublishScheduleFace {
    list(): Promise<ContentScheduleSnapshot>;
    put(input: ScheduleItemInput): Promise<ContentScheduleSnapshot>;
    remove(id: string): Promise<ContentScheduleSnapshot>;
}
/** Constructor dependencies. */
export interface PublishControllerDeps {
    readonly gateway: PublishGateway;
    readonly listOutputs: () => Promise<ContentOutputsSnapshot>;
    readonly schedule: PublishScheduleFace;
    readonly topics: PublishTopicsFace;
}
/** The controller: observable state plus the view's verbs. */
export interface PublishController {
    subscribe(listener: () => void): () => void;
    getState(): PublishState;
    /** Load the index, profiles, and manuscript pool once. */
    init(): Promise<void>;
    /** Reload every face. */
    refresh(): Promise<void>;
    /** Replace the account cards. */
    saveProfiles(profiles: readonly PublishProfile[]): Promise<void>;
    /** Load one theme's tasks and surface due scheduled ones. */
    openTheme(theme: string): Promise<void>;
    /** Mark one task as the open detail. */
    selectTask(taskId: string | null): void;
    /** Create one task from a pool manuscript and enabled platform cards. */
    createTask(input: {
        readonly manuscript: {
            readonly theme: string;
            readonly file: string;
            readonly title: string;
        };
        readonly platformIds: readonly string[];
        readonly mode: PublishTask['mode'];
        readonly scheduledAt: string | null;
        readonly note: string | null;
        readonly topicId: string | null;
        readonly personaDigest: string | null;
        readonly manuscriptId: string | null;
    }): Promise<void>;
    /** Adapt one platform leg through the model, then write the derived draft. */
    adaptPlatform(taskId: string, platformId: string): Promise<void>;
    /** Persist a user edit of one derived draft (status flips to `edited`). */
    saveDraftEdit(taskId: string, platformId: string, content: string): Promise<void>;
    /** Read one derived draft for the preview pane. */
    loadDraft(taskId: string, platformId: string): Promise<string | null>;
    /** Build the MCP handoff package and flip the task and every leg to `recorded`. */
    recordTask(taskId: string): Promise<void>;
    /** Create the calendar entry for a scheduled task and link it both ways. */
    scheduleTask(taskId: string, date: string, time: string | null): Promise<void>;
    /** Delete the task record (calendar entry goes with it; drafts stay). */
    deleteTask(taskId: string): Promise<void>;
    /** Copy a task's manuscript and platform set into a fresh task. */
    copyTask(taskId: string): Promise<void>;
    /** Flip the linked topic to `done` (idempotent; orphan degrades quietly). */
    reflowTask(taskId: string): Promise<void>;
    /** Clear the current notice. */
    clearNotice(): void;
}
/**
 * Create the publish controller.
 * @param deps - the gateway plus the library, calendar, and topic faces.
 * @returns the controller with an idle state.
 */
export declare function createPublishController(deps: PublishControllerDeps): PublishController;
//# sourceMappingURL=publish-store.d.ts.map