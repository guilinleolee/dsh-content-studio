import type { ContentOutputsSnapshot } from '@deepseek-ai/dsh-content-outputs/types';
import type { ContentScheduleSnapshot, ScheduleItem, ScheduleItemInput } from '@deepseek-ai/dsh-content-schedule/types';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ContentStudioController } from './studio-store.ts';
/** Injected face of the workbench surface: the shared controller and the server reads. */
export interface ContentStudioInjected {
    studio: ContentStudioController;
    listOutputs: () => Promise<ContentOutputsSnapshot>;
    schedule: {
        list: () => Promise<ContentScheduleSnapshot>;
        put: (input: ScheduleItemInput) => Promise<ContentScheduleSnapshot>;
        remove: (id: ScheduleItem['id']) => Promise<ContentScheduleSnapshot>;
    };
}
/** Full surface props: the injected face plus the locale seat. */
export type ContentStudioProps = ContentStudioInjected & PropsLocale<'content-studio'>;
/**
 * Render the Content Studio workbench surface.
 * @param props - the shared controller and the locale seat.
 * @returns the surface element tree while open; null while closed.
 */
export declare function ContentStudio({ studio, listOutputs, schedule, t }: ContentStudioProps): import("react").JSX.Element | null;
//# sourceMappingURL=ContentStudio.d.ts.map