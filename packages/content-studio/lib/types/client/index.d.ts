/**
 * Content Studio plugin, browser half. Self-contained Remote assembly: this
 * plugin mounts its own host contributions (contentOutputs, contentSchedule,
 * contentTopics) through `ctx.remote.$mount()` — the pattern api-remotes
 * established — so the plugin carries its whole server face with it and no
 * in-tree BFF assembly needs to know it exists. Two registrations install
 * atomically for their declarations' lifetimes: the sidebar entry fills
 * ui-sidebar's `sidebar.footer.action` hole, and the workbench surface fills
 * ui-layout's additive `shell.overlay` hole. Both share one open/close
 * controller created here; activation order is unconstrained, so each
 * registration waits on its declaration through `slots.inject()`.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol';
import { type StudioKey } from './locales.ts';
export { createContentStudioController, type ContentStudioController } from './studio-store.ts';
export { CAPABILITY_ITEMS, STUDIO_TABS, capabilityGroups } from './capabilities.ts';
export type { CapabilityGroup, CapabilityItem, CapabilityMaturity, StudioTab } from './capabilities.ts';
export { createGatherController, type GatherController, type GatherState } from './gather/gather-store.ts';
export { createPersonaController, type PersonaController, type PersonaGateway, type PersonaState } from './persona/persona-store.ts';
export { createTemplateController, type TemplateController, type TemplateGateway, type TemplatePickTarget, type TemplateState } from './template/template-store.ts';
export { createPublishController, type PublishController, type PublishGateway, type PublishState } from './publish/publish-store.ts';
export { createReviewController, type ReviewController, type ReviewGateway, type ReviewState, type WorkCard } from './review/review-store.ts';
export { createInteractionController, type InteractionController, type InteractionGateway, type InteractionState } from './interaction/interaction-store.ts';
export { PLATFORM_PROFILES, manuscriptCards, platformProfileOf, formatTags, dueScheduledTasks } from './publish/model.ts';
export type { PlatformProfile, ManuscriptCard } from './publish/model.ts';
export type { ContentStudioInjected } from './ContentStudio.tsx';
export type { CreateGateway } from './CreateView.tsx';
export type { TopicBankGateway, TopicBankScheduleFace } from './TopicBankView.tsx';
export { DEFAULT_TOPIC_BANK_CONFIG, TOPIC_BANK_CONFIG_VERSION, TOPIC_SOURCE_TYPES, TOPIC_STATUSES, collectTags, filterTopics, formatScore, groupByStatus, gatherMaterialToTopicInput, loadTopicBankConfig, manualTopicInput, parseTopicsMarkdown, planWindowRange, saveTopicBankConfig, topicInputOf, topicToMarkdown, topicsToMarkdown, weekStart, withAppendedTags, } from './topic-bank.ts';
export type { ParsedTopicMarkdown, TopicBankConfig, TopicBankPlanWindow, TopicBankViewKind } from './topic-bank.ts';
export type { StudioKey } from './locales.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Same carrier face api-remotes declares; identical merge is additive. */
        remote: TypertClientRemote;
    }
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Content Studio copy: entry, workbench chrome, catalog labels. */
        'content-studio': StudioKey;
    }
}
/**
 * Services required by the Content Studio plugin. The Remote namespaces are
 * mounted by this plugin's own apply (not waited on as services): the mount
 * completes before the slot registrations below run.
 */
export declare const inject: string[];
/**
 * Mount the plugin's own Remote contributions, then run the workbench body on
 * a fiber that declares every mounted namespace by its exact service name.
 * Cordis snapshots a namespace service only into fibers whose inject lists
 * that name (`remote.contentOutputs`), so a consumer that merely injects
 * `remote` — including this plugin's own apply fiber, a sibling of each
 * namespace fiber — never resolves it and every gateway call dies with
 * "cannot get property ... without inject". The mount runs first so the
 * namespace services exist before the workbench fiber waits on them; Cordis
 * unloads and re-runs the workbench body if a namespace unmounts.
 * @param ctx - client root context.
 */
export declare function apply(ctx: Context): Promise<() => Promise<void>>;
//# sourceMappingURL=index.d.ts.map