import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ContentOutputsSnapshot, InteractionsManifestRead, ReviewManifestRead } from '@deepseek-ai/dsh-content-outputs/types';
import type { ContentScheduleSnapshot } from '@deepseek-ai/dsh-content-schedule/types';
import type { ContentTopicsSnapshot } from '@deepseek-ai/dsh-content-topics/types';
/** Injected face of the workbench home: the Remote read wrappers it aggregates. */
export interface ContentWorkbenchInjected {
    listOutputs: () => Promise<ContentOutputsSnapshot>;
    listSchedule: () => Promise<ContentScheduleSnapshot>;
    /** The topic bank: topic stats and the recent-topics panel. */
    listTopics: () => Promise<ContentTopicsSnapshot>;
    /** The interaction inbox manifest: the pending-reply counts and feed entries. */
    readInteractions: () => Promise<InteractionsManifestRead>;
    /** One theme's review manifest; the data preview aggregates across themes. */
    readReviewManifest: (theme: string) => Promise<ReviewManifestRead>;
}
/** Every view the home can hop to. */
export type WorkbenchView = 'create' | 'library' | 'calendar' | 'topicBank' | 'gather' | 'competitors' | 'persona' | 'publish' | 'review' | 'interaction';
/** Full props: the injected face, view navigation/chat, and the locale seat. */
export type ContentWorkbenchProps = ContentWorkbenchInjected & {
    onNavigate: (view: WorkbenchView) => void;
    onChat: () => void;
    /** Active creation account, prepended to copied instructions. */
    account: string;
    /** Browser-local persona text, appended to the identity block. */
    persona: string;
} & PropsLocale<'content-studio'>;
/**
 * Render the workbench home.
 * @param props - the Remote read wrappers, view navigation, and the locale seat.
 * @returns the dashboard element tree.
 */
export declare function ContentWorkbench({ listOutputs, listSchedule, listTopics, readInteractions, readReviewManifest, onNavigate, onChat, account, persona, t, }: ContentWorkbenchProps): import("react").JSX.Element;
//# sourceMappingURL=ContentWorkbench.d.ts.map