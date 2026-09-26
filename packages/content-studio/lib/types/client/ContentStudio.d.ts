import type { ContentOutputsSnapshot } from '@deepseek-ai/dsh-content-outputs/types';
import type { ContentScheduleSnapshot, ScheduleItem, ScheduleItemInput } from '@deepseek-ai/dsh-content-schedule/types';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import { type CompetitorsViewInjected } from './CompetitorsView.tsx';
import { type CreateGateway } from './CreateView.tsx';
import { type TopicBankGateway } from './TopicBankView.tsx';
import type { GatherController } from './gather/gather-store.ts';
import type { PersonaController } from './persona/persona-store.ts';
import type { ContentStudioController } from './studio-store.ts';
/** Injected face of the workbench surface: the shared controller and the server reads. */
export interface ContentStudioInjected {
    studio: ContentStudioController;
    listOutputs: () => Promise<ContentOutputsSnapshot>;
    /** The gather controller: browser-side sources/tasks plus the collection scheduler. */
    gather: GatherController;
    schedule: {
        list: () => Promise<ContentScheduleSnapshot>;
        put: (input: ScheduleItemInput) => Promise<ContentScheduleSnapshot>;
        remove: (id: ScheduleItem['id']) => Promise<ContentScheduleSnapshot>;
    };
    /** The competitor write face, served by the content-outputs Remote. */
    competitors: Omit<CompetitorsViewInjected, 'listOutputs'>;
    /** The create workbench face, served by the content-outputs Remote. */
    create: CreateGateway;
    /** The persona controller: the `_personas.json` manifest plus the wizard draft. */
    personas: PersonaController;
    /** Current theme directory names, projected from the outputs library. */
    listThemes: () => Promise<readonly string[]>;
    /** The topic-bank Remote face, served by the content-topics Remote. */
    topics: TopicBankGateway;
    /** The authorized asset write backing the topic bank's Markdown export. */
    writeExport: (theme: string, file: string, content: string) => Promise<unknown>;
}
/** Full surface props: the injected face plus the locale seat. */
export type ContentStudioProps = ContentStudioInjected & PropsLocale<'content-studio'>;
/**
 * Render the Content Studio workbench surface.
 * @param props - the injected face and the locale seat.
 * @returns the surface element tree while open; null while closed.
 */
export declare function ContentStudio({ studio, listOutputs, gather, schedule, competitors, create, personas, listThemes, topics, writeExport, t, }: ContentStudioProps): import("react").JSX.Element | null;
//# sourceMappingURL=ContentStudio.d.ts.map