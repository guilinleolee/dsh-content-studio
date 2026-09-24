import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ContentOutputsSnapshot } from '@deepseek-ai/dsh-content-outputs/types';
import type { ContentScheduleSnapshot } from '@deepseek-ai/dsh-content-schedule/types';
/** Injected face of the workbench home: the two Remote read wrappers. */
export interface ContentWorkbenchInjected {
    listOutputs: () => Promise<ContentOutputsSnapshot>;
    listSchedule: () => Promise<ContentScheduleSnapshot>;
}
/** Full props: the injected face, view navigation, and the locale seat. */
export type ContentWorkbenchProps = ContentWorkbenchInjected & {
    onNavigate: (view: 'create' | 'library' | 'calendar') => void;
} & PropsLocale<'content-studio'>;
/**
 * Render the workbench home.
 * @param props - the Remote read wrappers, view navigation, and the locale seat.
 * @returns the dashboard element tree.
 */
export declare function ContentWorkbench({ listOutputs, listSchedule, onNavigate, t }: ContentWorkbenchProps): import("react").JSX.Element;
//# sourceMappingURL=ContentWorkbench.d.ts.map