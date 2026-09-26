import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ScheduleItemId, ScheduleItemInput } from '@deepseek-ai/dsh-content-schedule/types';
import type { ContentTopicsSnapshot, TopicItem, TopicItemInput } from '@deepseek-ai/dsh-content-topics/types';
import type { CapabilityItem } from './capabilities.ts';
import type { PickedTopic } from './studio-store.ts';
/** The narrow schedule write face the view drives (create/update/remove). */
export interface TopicBankScheduleFace {
    put: (input: ScheduleItemInput) => Promise<unknown>;
    remove: (id: ScheduleItemId) => Promise<unknown>;
}
/** The contentTopics Remote face, envelope-unwrapped by the assembler. */
export interface TopicBankGateway {
    list: () => Promise<ContentTopicsSnapshot>;
    put: (input: TopicItemInput) => Promise<ContentTopicsSnapshot>;
    remove: (id: TopicItem['id']) => Promise<ContentTopicsSnapshot>;
}
/** Injected face of the topic-bank view. */
export interface TopicBankViewInjected {
    topics: TopicBankGateway;
    /** The calendar write face for the plan-date linkage and delete cascade. */
    schedule: TopicBankScheduleFace;
    /** Hand one topic to the create view (navigates there). */
    onStartCreate: (topic: PickedTopic) => void;
    /** The authorized asset write for Markdown exports into `<theme>/assets/`. */
    writeExport: (theme: string, file: string, content: string) => Promise<unknown>;
    /** Outputs theme names, the export targets. */
    listThemes: () => Promise<readonly string[]>;
    /** The workbench's shared capability-copy state, for the guide cards. */
    copiedCapabilityId?: string | undefined;
    pickCapability: (item: CapabilityItem) => void;
}
/** Full view props: the injected face plus the locale seat. */
export type TopicBankViewProps = TopicBankViewInjected & PropsLocale<'content-studio'>;
/**
 * Render the topic-bank view.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export declare function TopicBankView({ topics, schedule, onStartCreate, writeExport, listThemes, copiedCapabilityId, pickCapability, t, }: TopicBankViewProps): import("react").JSX.Element;
//# sourceMappingURL=TopicBankView.d.ts.map