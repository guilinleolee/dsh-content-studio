import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { CalendarNotesSnapshot, ContentScheduleSnapshot, ScheduleItem, ScheduleItemInput } from '@deepseek-ai/dsh-content-schedule/types';
import type { TopicBankGateway } from './TopicBankView.tsx';
/** Injected face of the calendar view: the Remote wrappers. */
export interface ContentCalendarInjected {
    listSchedule: () => Promise<ContentScheduleSnapshot>;
    putSchedule: (input: ScheduleItemInput) => Promise<ContentScheduleSnapshot>;
    removeSchedule: (id: ScheduleItem['id']) => Promise<ContentScheduleSnapshot>;
    /** The day-note sidecar face served by the contentSchedule Remote. */
    notes: {
        list: () => Promise<CalendarNotesSnapshot>;
        put: (id: string, text: string) => Promise<CalendarNotesSnapshot>;
    };
    /** The topic bank face: the title join and the plan-date round-trip. */
    topics: TopicBankGateway;
    /** The authorized asset write backing the CSV export into `<theme>/assets/`. */
    writeExport: (theme: string, file: string, content: string) => Promise<unknown>;
    /** Outputs theme names; the first is the CSV export target. */
    listThemes: () => Promise<readonly string[]>;
    /** Cross-view navigation; the calendar only jumps to the topic bank. */
    onNavigate: (view: 'topicBank') => void;
}
/** Full calendar props: the injected face plus the locale seat. */
export type ContentCalendarProps = ContentCalendarInjected & PropsLocale<'content-studio'>;
/**
 * Render the scheduling calendar.
 * @param props - the Remote wrappers and the locale seat.
 * @returns the calendar element tree.
 */
export declare function ContentCalendar({ listSchedule, putSchedule, removeSchedule, notes, topics, writeExport, listThemes, onNavigate, t, }: ContentCalendarProps): import("react").JSX.Element;
//# sourceMappingURL=ContentCalendar.d.ts.map