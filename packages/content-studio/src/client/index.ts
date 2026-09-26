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
import type { Context } from '@deepseek-ai/cordis'
import type { TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol'
import type { PersonaAiRequest, PersonaAiResult } from '@deepseek-ai/dsh-content-outputs/types'
import contentOutputsRemote from '@deepseek-ai/dsh-content-outputs/remote'
import contentScheduleRemote from '@deepseek-ai/dsh-content-schedule/remote'
import contentTopicsRemote from '@deepseek-ai/dsh-content-topics/remote'
// Type-only: pulls ui-layout's SlotMap merge ('shell.overlay') into this
// program so the surface registration below typechecks.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls ui-sidebar's SlotMap merge ('sidebar.footer.action').
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { createContentStudioController } from './studio-store.ts'
import { StudioEntry } from './StudioEntry.tsx'
import { ContentStudio, type ContentStudioInjected } from './ContentStudio.tsx'
import { createGatherController } from './gather/gather-store.ts'
import { createPersonaController } from './persona/persona-store.ts'
import { en, zh, type StudioKey } from './locales.ts'

export { createContentStudioController, type ContentStudioController } from './studio-store.ts'
export { CAPABILITY_ITEMS, STUDIO_TABS, capabilityGroups } from './capabilities.ts'
export type { CapabilityGroup, CapabilityItem, CapabilityMaturity, StudioTab } from './capabilities.ts'
export { createGatherController, type GatherController, type GatherState } from './gather/gather-store.ts'
export { createPersonaController, type PersonaController, type PersonaGateway, type PersonaState } from './persona/persona-store.ts'
export type { ContentStudioInjected } from './ContentStudio.tsx'
export type { CreateGateway } from './CreateView.tsx'
export type { TopicBankGateway, TopicBankScheduleFace } from './TopicBankView.tsx'
export {
  DEFAULT_TOPIC_BANK_CONFIG, TOPIC_BANK_CONFIG_VERSION, TOPIC_SOURCE_TYPES, TOPIC_STATUSES,
  collectTags, filterTopics, formatScore, groupByStatus, gatherMaterialToTopicInput,
  loadTopicBankConfig, manualTopicInput, parseTopicsMarkdown, planWindowRange, saveTopicBankConfig,
  topicInputOf, topicToMarkdown, topicsToMarkdown, weekStart, withAppendedTags,
} from './topic-bank.ts'
export type { ParsedTopicMarkdown, TopicBankConfig, TopicBankPlanWindow, TopicBankViewKind } from './topic-bank.ts'
export type { StudioKey } from './locales.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Same carrier face api-remotes declares; identical merge is additive. */
    remote: TypertClientRemote
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Content Studio copy: entry, workbench chrome, catalog labels. */
    'content-studio': StudioKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'content-studio'

/**
 * Services required by the Content Studio plugin. The Remote namespaces are
 * mounted by this plugin's own apply (not waited on as services): the mount
 * completes before the slot registrations below run.
 */
export const inject = ['slots', 'locale', 'remote']

/**
 * Unwrap one Typert remote envelope, naming the failed call in the error.
 * @param label - the remote method identity for the error message.
 * @param call - the pending remote call.
 * @returns the unwrapped value.
 */
type RpcCall<T> = Promise<{ ok: true; value: T } | { ok: false; error: { code: string; message: string } }>

async function unwrap<T>(label: string, call: RpcCall<T>): Promise<T> {
  const result = await call
  if (!result.ok) throw new Error(`${label} failed: ${result.error.code}: ${result.error.message}`)
  return result.value
}

/**
 * Mount the plugin's own Remote contributions, then register the sidebar
 * entry and the workbench surface once their slot declarations are on the
 * ledger; both registrations install and roll back atomically through one
 * generator. The mounts unwound in reverse order after every registration.
 * @param ctx - client root context.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-content-studio: dictionaries')

  const disposers: Array<() => Promise<void>> = []
  try {
    for (const contribution of [contentOutputsRemote, contentScheduleRemote, contentTopicsRemote]) {
      disposers.push(await ctx.remote.$mount(contribution))
    }
  } catch (error) {
    for (const dispose of disposers.reverse()) await dispose()
    throw error
  }

  const studio = createContentStudioController()
  const listOutputs: ContentStudioInjected['listOutputs'] = async () => {
    const result = await ctx.remote.contentOutputs.list()
    if (!result.ok) {
      throw new Error(`contentOutputs.list failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const listThemes: ContentStudioInjected['listThemes'] = async () => {
    const snapshot = await listOutputs()
    return snapshot.projects.map(project => project.topic)
  }
  const create: ContentStudioInjected['create'] = {
    readCreateState: theme => unwrap('contentOutputs.readCreateState', ctx.remote.contentOutputs.readCreateState(theme)),
    writeCreateState: (theme, manifest) => unwrap('contentOutputs.writeCreateState', ctx.remote.contentOutputs.writeCreateState(theme, manifest)),
    writeAsset: (theme, file, content) => unwrap('contentOutputs.writeAsset', ctx.remote.contentOutputs.writeAsset({ theme, file, content })),
    publishCreateFinal: (theme, request) => unwrap('contentOutputs.publishCreateFinal', ctx.remote.contentOutputs.publishCreateFinal(theme, request)),
    registerCreatePublish: (theme, request) => unwrap('contentOutputs.registerCreatePublish', ctx.remote.contentOutputs.registerCreatePublish(theme, request)),
    readCreateMetadata: theme => unwrap('contentOutputs.readCreateMetadata', ctx.remote.contentOutputs.readCreateMetadata(theme)),
    writeCreateMetadata: (theme, metadata) => unwrap('contentOutputs.writeCreateMetadata', ctx.remote.contentOutputs.writeCreateMetadata(theme, metadata)),
    generateCreateContent: request => unwrap('contentOutputs.generateCreateContent', ctx.remote.contentOutputs.generateCreateContent(request)),
    rewriteCreateSelection: request => unwrap('contentOutputs.rewriteCreateSelection', ctx.remote.contentOutputs.rewriteCreateSelection(request)),
    evaluateCreateContent: request => unwrap('contentOutputs.evaluateCreateContent', ctx.remote.contentOutputs.evaluateCreateContent(request)),
    listCreateAssets: theme => unwrap('contentOutputs.listCreateAssets', ctx.remote.contentOutputs.listCreateAssets(theme)),
    listCreateTemplates: () => unwrap('contentOutputs.listCreateTemplates', ctx.remote.contentOutputs.listCreateTemplates()),
    putCreateTemplate: input => unwrap('contentOutputs.putCreateTemplate', ctx.remote.contentOutputs.putCreateTemplate(input)),
    deleteCreateTemplate: id => unwrap('contentOutputs.deleteCreateTemplate', ctx.remote.contentOutputs.deleteCreateTemplate(id)),
  }
  const schedule: ContentStudioInjected['schedule'] = {
    list: async () => {
      const result = await ctx.remote.contentSchedule.list()
      if (!result.ok) throw new Error(`contentSchedule.list failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
    put: async (input) => {
      const result = await ctx.remote.contentSchedule.put(input)
      if (!result.ok) throw new Error(`contentSchedule.put failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
    remove: async (id) => {
      const result = await ctx.remote.contentSchedule.delete(id)
      if (!result.ok) throw new Error(`contentSchedule.delete failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
  }
  const topics: ContentStudioInjected['topics'] = {
    list: () => unwrap('contentTopics.list', ctx.remote.contentTopics.list()),
    put: input => unwrap('contentTopics.put', ctx.remote.contentTopics.put(input)),
    remove: id => unwrap('contentTopics.delete', ctx.remote.contentTopics.delete(id)),
  }
  // The topic bank's Markdown export reuses contentOutputs' guarded asset
  // write — no second file-write face for the plugin.
  const writeExport: ContentStudioInjected['writeExport'] = (theme, file, content) =>
    unwrap('contentOutputs.writeAsset', ctx.remote.contentOutputs.writeAsset({ theme, file, content }))
  const gatherGateway: Parameters<typeof createGatherController>[0]['gateway'] = {
    fetchFeed: async (request) => {
      const result = await ctx.remote.contentOutputs.fetchFeed(request)
      if (!result.ok) throw new Error(`contentOutputs.fetchFeed failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
    writeAsset: async (write) => {
      const result = await ctx.remote.contentOutputs.writeAsset(write)
      if (!result.ok) throw new Error(`contentOutputs.writeAsset failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
    readAsset: async (theme, file) => {
      const result = await ctx.remote.contentOutputs.readAsset(theme, file)
      if (!result.ok) throw new Error(`contentOutputs.readAsset failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
    readManifest: async (theme) => {
      const result = await ctx.remote.contentOutputs.readGatherManifest(theme)
      if (!result.ok) throw new Error(`contentOutputs.readGatherManifest failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
    writeManifest: async (theme, manifest) => {
      const result = await ctx.remote.contentOutputs.writeGatherManifest(theme, manifest)
      if (!result.ok) throw new Error(`contentOutputs.writeGatherManifest failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
    moveAsset: async (move) => {
      const result = await ctx.remote.contentOutputs.moveAsset(move)
      if (!result.ok) throw new Error(`contentOutputs.moveAsset failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
    deleteAsset: async (theme, file) => {
      const result = await ctx.remote.contentOutputs.deleteAsset(theme, file)
      if (!result.ok) throw new Error(`contentOutputs.deleteAsset failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
    processMaterial: async (request) => {
      const result = await ctx.remote.contentOutputs.processMaterial(request)
      if (!result.ok) throw new Error(`contentOutputs.processMaterial failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
  }
  const gather = createGatherController({ gateway: gatherGateway, listOutputs, schedulePut: input => schedule.put(input) })
  // The persona face: the `_personas.json` manifest plus the explicit AI
  // helpers, on the same contentOutputs Remote as every other write face.
  const personas: ContentStudioInjected['personas'] = createPersonaController({
    gateway: {
      listPersonas: () => unwrap('contentOutputs.listPersonas', ctx.remote.contentOutputs.listPersonas()),
      getPersona: id => unwrap('contentOutputs.getPersona', ctx.remote.contentOutputs.getPersona(id)),
      putPersona: input => unwrap('contentOutputs.putPersona', ctx.remote.contentOutputs.putPersona(input)),
      putPersonaReport: (id, report) => unwrap('contentOutputs.putPersonaReport', ctx.remote.contentOutputs.putPersonaReport(id, report)),
      deletePersona: id => unwrap('contentOutputs.deletePersona', ctx.remote.contentOutputs.deletePersona(id)),
      // The generated Remote returns the plain result union; the view face
      // narrows it per operation at this typed boundary.
      processPersonaAi: async <T extends PersonaAiRequest>(request: T) => {
        const result = await unwrap('contentOutputs.processPersonaAi', ctx.remote.contentOutputs.processPersonaAi(request))
        return result as Extract<PersonaAiResult, { readonly operation: T['operation'] }>
      },
    },
  })
  const competitors: ContentStudioInjected['competitors'] = {
    readCompetitorManifest: async (theme) => {
      const result = await ctx.remote.contentOutputs.readCompetitorManifest(theme)
      if (!result.ok) throw new Error(`contentOutputs.readCompetitorManifest failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
    writeCompetitorManifest: async (theme, manifest) => {
      const result = await ctx.remote.contentOutputs.writeCompetitorManifest(theme, manifest)
      if (!result.ok) throw new Error(`contentOutputs.writeCompetitorManifest failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
    writeAsset: async (write) => {
      const result = await ctx.remote.contentOutputs.writeAsset(write)
      if (!result.ok) throw new Error(`contentOutputs.writeAsset failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
    deleteAsset: async (theme, file) => {
      const result = await ctx.remote.contentOutputs.deleteAsset(theme, file)
      if (!result.ok) throw new Error(`contentOutputs.deleteAsset failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
    readAsset: async (theme, file) => {
      const result = await ctx.remote.contentOutputs.readAsset(theme, file)
      if (!result.ok) throw new Error(`contentOutputs.readAsset failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
    analyzeCompetitorWork: async (request) => {
      const result = await ctx.remote.contentOutputs.analyzeCompetitorWork(request)
      if (!result.ok) throw new Error(`contentOutputs.analyzeCompetitorWork failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
    generateCompetitorReport: async (request) => {
      const result = await ctx.remote.contentOutputs.generateCompetitorReport(request)
      if (!result.ok) throw new Error(`contentOutputs.generateCompetitorReport failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
  }
  ctx.slots.inject('sidebar.footer.action', function* () {
    yield ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'content-studio-entry',
      locale: NS,
      inject: () => ({ studio }),
    }, StudioEntry)
    yield ctx.slots.register({
      name: 'shell.overlay',
      id: 'content-studio',
      order: 50,
      locale: NS,
      inject: () => ({ studio, listOutputs, gather, schedule, competitors, create, personas, listThemes, topics, writeExport }),
    }, ContentStudio)
  })

  return async () => {
    for (const dispose of disposers.reverse()) await dispose()
  }
}
