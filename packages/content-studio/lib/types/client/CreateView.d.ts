/**
 * The create workbench view: three entries (blank new as the main path,
 * paste-a-topic, and the topic-bank push once that column ships), then the
 * editor — one-shot generation, selection rewrites with a diff preview,
 * version snapshots with a pin/prune quota, the local banned-word pre-check,
 * and the copy-plus-register publish handoff. The capability card catalog
 * stays reachable behind the 指令库 toggle. Editor logic lives in the pure
 * `create.ts` / `banned-words.ts` modules; this surface only orchestrates.
 */
import { type ReactNode } from 'react';
import type { CreateContentType, CreateEvaluation, CreateManifest, CreatePublishRequest, CreatePublishResult, CreateRegisterRequest, CreateRewriteRequest, CreateStateRead, CreateAiResult, CreateTemplate, CreateTemplateInput, OutputMetadata } from '@deepseek-ai/dsh-content-outputs/types';
import type { ContentScheduleSnapshot, ScheduleItemInput } from '@deepseek-ai/dsh-content-schedule/types';
import type { ContentTopicsSnapshot, TopicItemInput } from '@deepseek-ai/dsh-content-topics/types';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { TemplateController } from './template/template-store.ts';
import type { PickedMaterial, PickedTopic } from './studio-store.ts';
/** Server face of the create workbench, served by the content-outputs Remote. */
export interface CreateGateway {
    readCreateState(theme: string): Promise<CreateStateRead>;
    writeCreateState(theme: string, manifest: CreateManifest): Promise<void>;
    writeAsset(theme: string, file: string, content: string): Promise<{
        truncated: boolean;
    }>;
    publishCreateFinal(theme: string, request: CreatePublishRequest): Promise<CreatePublishResult>;
    registerCreatePublish(theme: string, request: CreateRegisterRequest): Promise<void>;
    readCreateMetadata(theme: string): Promise<{
        metadata: OutputMetadata | null;
        problem: string | null;
    }>;
    writeCreateMetadata(theme: string, metadata: OutputMetadata): Promise<void>;
    listCreateAssets(theme: string): Promise<{
        files: readonly string[];
    }>;
    generateCreateContent(request: {
        contentType: CreateContentType;
        title: string;
        audience: string | null;
        points: string | null;
        references: string | null;
        profileDigest: string | null;
        count?: 1 | 3;
        customTemplate?: {
            readonly id: string;
            readonly revision: number;
            readonly body: string;
        } | null;
    }): Promise<CreateAiResult>;
    rewriteCreateSelection(request: CreateRewriteRequest): Promise<CreateAiResult>;
    evaluateCreateContent(request: {
        contentType: CreateContentType;
        title: string;
        text: string;
    }): Promise<CreateEvaluation>;
    listCreateTemplates(): Promise<{
        templates: readonly CreateTemplate[];
        problems: readonly string[];
    }>;
    putCreateTemplate(input: CreateTemplateInput): Promise<{
        templates: readonly CreateTemplate[];
    }>;
    deleteCreateTemplate(id: string): Promise<{
        templates: readonly CreateTemplate[];
    }>;
}
/** One batch card of the multi-variant generation. */
export type BatchCard = {
    kind: 'pending';
} | {
    kind: 'done';
    text: string;
} | {
    kind: 'failed';
    detail: string;
};
/** Classify an AI failure for its locale stem: quota, paid tier, or generic. */
export declare function aiErrorClass(message: string): 'quota' | 'paid' | 'generic';
/** Injected face of the create view. */
export interface CreateViewProps {
    readonly create: CreateGateway;
    /** Current theme directory names, from the outputs projection. */
    readonly listThemes: () => Promise<readonly string[]>;
    /** The active account persona text, applied as the inline style reference. */
    readonly persona: string;
    /** Material handed over from the gather view, if any. */
    readonly picked: PickedMaterial | null;
    readonly onClearPicked: () => void;
    /** Topic handed over from the topic bank, if any. */
    readonly pickedTopic: PickedTopic | null;
    readonly onClearPickedTopic: () => void;
    /** The topic-bank face, for the finalize write-back. */
    readonly topics: {
        list(): Promise<ContentTopicsSnapshot>;
        put(input: TopicItemInput): Promise<unknown>;
    };
    /** The schedule face, for pushing the linked calendar entry to published. */
    readonly schedule: {
        list(): Promise<ContentScheduleSnapshot>;
        put(input: ScheduleItemInput): Promise<ContentScheduleSnapshot>;
    };
    /** The publish-view handoff for a registered deliverable; absent when the publish view is not mounted. */
    readonly onSendToPublish?: (manuscript: {
        readonly theme: string;
        readonly file: string;
        readonly title: string;
    }) => void;
    /** The capability card catalog, reachable behind the 指令库 toggle. */
    readonly catalog: ReactNode;
    /** The global template library controller; absent hides the 模板 picker entry. */
    readonly templateLibrary?: TemplateController | null;
    readonly t: PropsLocale<'content-studio'>['t'];
}
/**
 * Render the create workbench view.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export declare function CreateView({ create, listThemes, persona, picked, onClearPicked, pickedTopic, onClearPickedTopic, topics, schedule, onSendToPublish, catalog, templateLibrary, t, }: CreateViewProps): import("react").JSX.Element;
//# sourceMappingURL=CreateView.d.ts.map