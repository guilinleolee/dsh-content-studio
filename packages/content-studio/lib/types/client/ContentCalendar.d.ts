import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ContentScheduleSnapshot, ScheduleItem, ScheduleItemInput } from '@deepseek-ai/dsh-content-schedule/types';
/** Injected face of the calendar view: the Remote wrappers. */
export interface ContentCalendarInjected {
    listSchedule: () => Promise<ContentScheduleSnapshot>;
    putSchedule: (input: ScheduleItemInput) => Promise<ContentScheduleSnapshot>;
    removeSchedule: (id: ScheduleItem['id']) => Promise<ContentScheduleSnapshot>;
}
/** Full calendar props: the injected face plus the locale seat. */
export type ContentCalendarProps = ContentCalendarInjected & PropsLocale<'content-studio'>;
/**
 * Render the publication calendar.
 * @param props - the Remote wrappers and the locale seat.
 * @returns the calendar element tree.
 */
export declare function ContentCalendar({ listSchedule, putSchedule, removeSchedule, t }: ContentCalendarProps): import("react").JSX.Element;
//# sourceMappingURL=ContentCalendar.d.ts.map