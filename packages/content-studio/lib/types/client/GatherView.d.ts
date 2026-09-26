import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { GatherController } from './gather/gather-store.ts';
/** Injected face of the gather view: the controller and the create handoff. */
export interface GatherViewInjected {
    gather: GatherController;
    /** Hand one material to the create view (marks picked, navigates). */
    onPushToCreate: (material: {
        id: string;
        title: string;
        url: string;
    }) => void;
    /**
     * Join one material into the topic bank, keyed by the reserved
     * {@link ADD_TO_TOPIC_BANK} contract name. Absent until the topic bank
     * ships: the view answers with the pending toast.
     */
    addToTopicBank?: (materialId: string) => void;
}
/** Full gather props: the injected face plus the locale seat. */
export type GatherViewProps = GatherViewInjected & PropsLocale<'content-studio'>;
/** Render the gather view. */
export declare function GatherView({ gather, onPushToCreate, addToTopicBank, t }: GatherViewProps): import("react").JSX.Element;
//# sourceMappingURL=GatherView.d.ts.map