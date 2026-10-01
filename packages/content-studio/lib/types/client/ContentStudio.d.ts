import type { ContentOutputsSnapshot, InteractionsManifestRead, ReviewManifestRead } from '@deepseek-ai/dsh-content-outputs/types';
import type { ContentScheduleSnapshot, ScheduleItem, ScheduleItemInput } from '@deepseek-ai/dsh-content-schedule/types';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import { type ContentCalendarInjected } from './ContentCalendar.tsx';
import { type CompetitorsViewInjected } from './CompetitorsView.tsx';
import { type CreateGateway } from './CreateView.tsx';
import { type TopicBankGateway } from './TopicBankView.tsx';
import type { PublishController } from './publish/publish-store.ts';
import type { ReviewController } from './review/review-store.ts';
import type { InteractionController } from './interaction/interaction-store.ts';
import type { TemplateController } from './template/template-store.ts';
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
    /** The calendar's day-note sidecar face, served by the contentSchedule Remote. */
    notes: ContentCalendarInjected['notes'];
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
    /** The publish controller: tasks, profiles, history, and the AI adaptations. */
    publish: PublishController;
    /** The review controller: imports, pools, diagnoses, reports, and the reflow. */
    review: ReviewController;
    /** The interaction controller: the fan inbox, the CSV import, and the AI helpers. */
    interaction: InteractionController;
    /** Raw read of the `_interactions.json` manifest for the workbench home. */
    readInteractions: () => Promise<InteractionsManifestRead>;
    /** Raw read of one theme's `_review.json` manifest for the workbench home. */
    readReviewManifest: (theme: string) => Promise<ReviewManifestRead>;
    /** The global template library controller: the asset store plus the cross-column picker. */
    templates: TemplateController;
}
/** Full surface props: the injected face plus the locale seat. */
export type ContentStudioProps = ContentStudioInjected & PropsLocale<'content-studio'>;
/**
 * Render the Content Studio workbench surface.
 * @param props - the injected face and the locale seat.
 * @returns the surface element tree while open; null while closed.
 */
export declare function ContentStudio({ studio, listOutputs, gather, schedule, notes, competitors, create, personas, listThemes, topics, writeExport, publish, review, interaction, readInteractions, readReviewManifest, templates, t, }: ContentStudioProps): import("react").JSX.Element | null;
//# sourceMappingURL=ContentStudio.d.ts.map