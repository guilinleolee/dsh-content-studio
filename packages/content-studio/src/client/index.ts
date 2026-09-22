/**
 * Content Studio plugin, browser half. Self-contained Remote assembly: this
 * plugin mounts its own host contributions (contentOutputs, contentSchedule)
 * through `ctx.remote.$mount()` — the pattern api-remotes established — so the
 * plugin carries its whole server face with it and no in-tree BFF assembly
 * needs to know it exists. Two registrations install atomically for their
 * declarations' lifetimes: the sidebar entry fills ui-sidebar's
 * `sidebar.footer.action` hole, and the workbench surface fills ui-layout's
 * additive `shell.overlay` hole. Both share one open/close controller created
 * here; activation order is unconstrained, so each registration waits on its
 * declaration through `slots.inject()`.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol'
import contentOutputsRemote from '@deepseek-ai/dsh-content-outputs/remote'
import contentScheduleRemote from '@deepseek-ai/dsh-content-schedule/remote'
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
import { en, zh, type StudioKey } from './locales.ts'

export { createContentStudioController, type ContentStudioController } from './studio-store.ts'
export { CAPABILITY_ITEMS, STUDIO_TABS, capabilityGroups } from './capabilities.ts'
export type { CapabilityGroup, CapabilityItem, CapabilityMaturity, StudioTab } from './capabilities.ts'
export type { ContentStudioInjected } from './ContentStudio.tsx'
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
 * Services required by the Content Studio plugin. The two Remote namespaces
 * are mounted by this plugin's own apply (not waited on as services): the
 * mount completes before the slot registrations below run.
 */
export const inject = ['slots', 'locale', 'remote']

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
    for (const contribution of [contentOutputsRemote, contentScheduleRemote]) {
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
      inject: () => ({ studio, listOutputs, schedule }),
    }, ContentStudio)
  })

  return async () => {
    for (const dispose of disposers.reverse()) await dispose()
  }
}
