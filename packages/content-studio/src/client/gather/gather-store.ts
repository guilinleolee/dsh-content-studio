/**
 * The gather view controller: one observable state object backed by browser
 * storage (sources, tasks, logs) and the on-disk manifests (materials),
 * plus the front-side scheduler. The scheduler exists only while the
 * workbench is open — a master tick runs due interval tasks, visibility
 * changes pause and resume it, and reopening after a gap runs every overdue
 * task once with its `since` cursor. That is compensation, not background
 * polling: closing the workbench stops everything.
 *
 * All manifest writes funnel through one sequential run queue, so two task
 * runs can never interleave their read-modify-write cycles; user state on
 * materials survives every run because merges never touch existing entries.
 * A failing fetch keeps the source's materials, marks the task `failed`,
 * and starts the exponential failure backoff for that source.
 */

import type { GatherMaterial } from '@deepseek-ai/dsh-content-outputs/types'
import type { ScheduleItemInput } from '@deepseek-ai/dsh-content-schedule/types'
import {
  GATHER_BODY_CHAR_LIMIT, applyQuota, bodyFileName, filterDrafts, isSourceDue, mergeDrafts,
} from './model.ts'
import { GATHER_SOURCE_LIMIT, createGatherStorage } from './storage.ts'
import type { GatherGateway, GatherItemDraft, GatherSource, GatherTask, GatherTaskLogEntry, GatherTaskStatus, GatherTaskView } from './types.ts'

/** The gather view controller created by {@link createGatherController}. */
export type GatherController = ReturnType<typeof createGatherController>

/** How often the master tick checks for due tasks while the workbench is open. */
const TICK_MS = 30_000

/** Ring size of one task's run log. */
const TASK_LOG_LIMIT = 20

/** Injected server face plus the calendar push the view offers. */
export interface GatherControllerDeps {
  readonly gateway: GatherGateway
  /** The workbench's existing outputs read, for the theme list. */
  readonly listOutputs: () => Promise<{ projects: ReadonlyArray<{ topic: string }> }>
  /** The workbench's existing calendar write, for 加入内容日历. */
  readonly schedulePut: (input: ScheduleItemInput) => Promise<unknown>
}

/** Snapshot the React surface subscribes to. */
export interface GatherState {
  readonly sources: readonly GatherSource[]
  readonly tasks: readonly GatherTaskView[]
  readonly themes: readonly string[]
  /** Materials of the selected theme, as the manifest stores them. */
  readonly materials: readonly GatherMaterial[]
  readonly selectedTheme: string | null
  /** Material the detail pane shows, or null. */
  readonly selectedMaterialId: string | null
  /** True while a manifest read for the selected theme is in flight. */
  readonly loadingMaterials: boolean
  /** False once a storage write was demoted to memory (quota / private mode). */
  readonly storagePersistent: boolean
  /** One-line user-facing outcome of the last action (error or info). */
  readonly notice: string | null
}

/** Cumulative counts one run reports back to the task log. */
interface RunOutcome {
  readonly outcome: GatherTaskLogEntry['outcome']
  readonly added: number
  readonly detail?: string
}

function randomId(): string {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** The source's conditional-request cursors, absent fields omitted. */
function cursorsOf(source: GatherSource): { etag?: string; lastModified?: string } {
  const cursors: { etag?: string; lastModified?: string } = {}
  if (source.etag !== null) cursors.etag = source.etag
  if (source.lastModified !== null) cursors.lastModified = source.lastModified
  return cursors
}

/** Ring-append one log entry, oldest first, capped. */
function appendLog(log: readonly GatherTaskLogEntry[], entry: GatherTaskLogEntry): GatherTaskLogEntry[] {
  const next = [...log, entry]
  return next.length > TASK_LOG_LIMIT ? next.slice(next.length - TASK_LOG_LIMIT) : next
}

/**
 * Create the gather controller. The browser half creates one instance in
 * apply() and injects it into the surface, like the open/close controller.
 * @param deps - the injected server face.
 * @returns the controller with its state, actions, and lifecycle.
 */
export function createGatherController(deps: GatherControllerDeps): {
  subscribe(listener: () => void): () => void
  getState(): GatherState
  start(): void
  dispose(): void
  refreshThemes(): Promise<void>
  selectTheme(theme: string | null): Promise<void>
  selectMaterial(id: string | null): void
  readBody(theme: string, file: string): Promise<string | null>
  showNotice(message: string): void
  dismissNotice(): void
  addSource(input: {
    name: string
    url: string
    intervalMinutes: number
    tags: readonly string[]
    excludeKeywords: readonly string[]
  }): void
  updateSource(id: string, patch: Partial<Pick<GatherSource, 'name' | 'url' | 'intervalMinutes' | 'enabled' | 'tags' | 'excludeKeywords'>>): void
  removeSource(id: string): void
  testSource(id: string): Promise<{ ok: boolean; detail: string }>
  importSources(inputs: ReadonlyArray<{ name: string; url: string; tags: readonly string[] }>): number
  addTask(input: {
    name: string
    sourceIds: readonly string[]
    themeName: string
    maxItemsPerRun: number
    since: string | null
    includeKeywords: readonly string[]
    excludeKeywords: readonly string[]
    aiEnabled: boolean
    intervalMinutes: number | null
  }): void
  updateTask(id: string, patch: Partial<Pick<GatherTask, 'name' | 'intervalMinutes' | 'sourceIds'>>): void
  removeTask(id: string): void
  triggerTask(id: string): Promise<void>
  markRead(id: string): Promise<void>
  toggleFavorite(id: string): Promise<void>
  markPicked(id: string): Promise<void>
  addExcerpt(id: string, excerpt: string): Promise<void>
  bindTheme(id: string, nextTheme: string): Promise<void>
  processWithAi(id: string): Promise<void>
  pushToCalendar(id: string, date: string): Promise<void>
} {
  const storage = createGatherStorage()
  const persisted = storage.load()
  let sources: GatherSource[] = [...persisted.sources]
  let tasks: GatherTaskView[] = persisted.tasks.map(task => ({ ...task, status: 'idle' as GatherTaskStatus }))
  let themes: readonly string[] = []
  let materials: readonly GatherMaterial[] = []
  let selectedTheme: string | null = null
  let selectedMaterialId: string | null = null
  let loadingMaterials = false
  let notice: string | null = null

  const listeners = new Set<() => void>()
  // The snapshot is rebuilt once per mutation and cached between emits:
  // useSyncExternalStore compares getSnapshot results by identity, so a
  // freshly built object per call would re-render forever.
  const buildState = (): GatherState => ({
    sources,
    tasks,
    themes,
    materials,
    selectedTheme,
    selectedMaterialId,
    loadingMaterials,
    storagePersistent: storage.persistent,
    notice,
  })
  let snapshot: GatherState = buildState()
  const emit = (): void => {
    snapshot = buildState()
    for (const listener of listeners) listener()
  }
  const state = (): GatherState => snapshot

  const persist = (): void => {
    storage.save({ sources, tasks: tasks.map(({ status: _status, ...task }) => task) })
    emit()
  }

  const setNotice = (value: string | null): void => {
    notice = value
    emit()
  }

  /** All task runs (and manifest writes) go through this chain, strictly one at a time. */
  let runChain: Promise<void> = Promise.resolve()
  const enqueue = (operation: () => Promise<void>): Promise<void> => {
    const run = runChain.then(operation)
    runChain = run.catch(() => undefined)
    return run
  }

  // ── lifecycle ──

  let tickTimer: ReturnType<typeof setInterval> | undefined
  let visibilityBound = false

  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') {
      // Back from a hidden tab: restart the tick and run whatever went
      // overdue while hidden — the compensation the prompt allows.
      startTicking()
      void catchUp()
    }
  }

  const startTicking = (): void => {
    if (tickTimer !== undefined) clearInterval(tickTimer)
    tickTimer = setInterval(() => { void runDueTasks() }, TICK_MS)
  }

  const stopTicking = (): void => {
    if (tickTimer !== undefined) {
      clearInterval(tickTimer)
      tickTimer = undefined
    }
  }

  /** Run every interval task whose last run is older than its interval. */
  const runDueTasks = (): Promise<void> => {
    const now = new Date().toISOString()
    const due = tasks.filter((task) => {
      if (task.intervalMinutes === null) return false
      const lastAt = task.log[task.log.length - 1]?.at
      if (lastAt === undefined) return true
      return Date.parse(now) - Date.parse(lastAt) >= task.intervalMinutes * 60_000
    })
    return enqueue(async () => {
      for (const task of due) await runTask(task.id, now)
    })
  }

  /** One catch-up pass at workbench open: overdue interval tasks run once. */
  const catchUp = (): Promise<void> => runDueTasks()

  // ── collection run ──

  const sourceById = (id: string): GatherSource | undefined => sources.find(source => source.id === id)

  const patchSource = (id: string, patch: Partial<GatherSource>): void => {
    sources = sources.map(source => source.id === id ? { ...source, ...patch } : source)
  }

  const patchTask = (id: string, patch: Partial<GatherTaskView>): void => {
    tasks = tasks.map(task => task.id === id ? { ...task, ...patch } : task)
  }

  /**
   * Run one task: fetch each bound source, filter and merge the drafts into
   * the theme manifest, persist body snapshots for new materials. A source
   * failure never touches the materials already on disk. Scheduled runs skip
   * sources whose interval or failure backoff has not elapsed; a manual
   * trigger is the user's explicit intent and overrides that gate.
   */
  const runTask = async (taskId: string, now: string, manual = false): Promise<void> => {
    const task = tasks.find(candidate => candidate.id === taskId)
    if (task === undefined) return
    patchTask(taskId, { status: 'running' })
    emit()

    let addedTotal = 0
    let notModified = true
    let failure: string | undefined
    for (const sourceId of task.sourceIds) {
      const source = sourceById(sourceId)
      if (source === undefined || !source.enabled) continue
      // Scheduled gate: the source's own interval, widened by the exponential
      // failure backoff (1h → 2h → 4h, capped 24h), must have elapsed.
      if (!manual && !isSourceDue(source, now)) continue
      try {
        const result = await deps.gateway.fetchFeed({ url: source.url, ...cursorsOf(source) })
        patchSource(source.id, {
          lastFetchedAt: now,
          lastStatus: 'ok',
          consecutiveFailures: 0,
          etag: result.etag,
          lastModified: result.lastModified,
        })
        if (result.notModified) continue
        notModified = false
        const added = await mergeIntoManifest(task, source, result.items, now)
        addedTotal += added
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        failure = failure === undefined ? detail : `${failure}; ${detail}`
        patchSource(source.id, {
          lastFetchedAt: now,
          lastStatus: 'failed',
          consecutiveFailures: source.consecutiveFailures + 1,
        })
      }
    }

    const outcome: RunOutcome = failure !== undefined
      ? { outcome: 'failed', added: addedTotal, detail: failure }
      : notModified ? { outcome: 'notModified', added: 0 } : { outcome: 'ok', added: addedTotal }
    patchTask(taskId, {
      status: failure !== undefined ? 'failed' : 'done',
      log: appendLog(task.log, {
        at: now,
        outcome: outcome.outcome,
        added: outcome.added,
        ...(outcome.detail !== undefined ? { detail: outcome.detail } : {}),
      }),
    })
    persist()
  }

  /** Filter, merge, snapshot, and commit one source's drafts into the task's theme. */
  const mergeIntoManifest = async (
    task: GatherTaskView, source: GatherSource, drafts: readonly GatherItemDraft[], now: string,
  ): Promise<number> => {
    const read = await deps.gateway.readManifest(task.themeName)
    if (read.problems.length > 0) {
      // A manifest that failed validation must not be replaced by a view
      // built on top of it; the run fails loudly instead.
      throw new Error(`manifest for ${task.themeName} has problems: ${read.problems[0]}`)
    }
    const eligible = filterDrafts(
      drafts,
      { sourceExcludeKeywords: source.excludeKeywords, includeKeywords: task.includeKeywords, excludeKeywords: task.excludeKeywords },
      task.since,
      task.maxItemsPerRun,
    )
    const { merged, added } = mergeDrafts(read.manifest.materials, source.id, source.name, eligible, { now })
    if (added.length === 0) return 0

    const withBodies = new Map(added.map(material => [material.id, material]))
    for (const material of added) {
      const draft = eligible.find(candidate => candidate.id === material.id)
      if (draft?.content !== null && draft?.content !== undefined) {
        const body = draft.content.length > GATHER_BODY_CHAR_LIMIT
          ? `${draft.content.slice(0, GATHER_BODY_CHAR_LIMIT)}\n<!-- truncated -->`
          : draft.content
        const file = bodyFileName(material.id)
        try {
          await deps.gateway.writeAsset({ theme: task.themeName, file, content: body })
          withBodies.set(material.id, { ...material, bodyFile: file })
        } catch {
          // Snapshot write failure keeps the material; it just has no body.
        }
      }
    }
    const committed = merged.map(material => withBodies.get(material.id) ?? material)

    const trimmed = applyQuota(committed).kept
    await deps.gateway.writeManifest(task.themeName, { formatVersion: 0, materials: trimmed })
    if (selectedTheme === task.themeName) materials = trimmed
    return added.length
  }

  // ── public actions ──

  const withMaterials = async (id: string, mutate: (material: GatherMaterial) => GatherMaterial): Promise<GatherMaterial | undefined> => {
    if (selectedTheme === null) return undefined
    const current = materials.find(material => material.id === id)
    if (current === undefined) return undefined
    const next = materials.map(material => material.id === id ? mutate(material) : material)
    await deps.gateway.writeManifest(selectedTheme, { formatVersion: 0, materials: next })
    materials = next
    emit()
    return next.find(material => material.id === id)
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getState: state,

    start() {
      startTicking()
      if (!visibilityBound && typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibility)
        visibilityBound = true
      }
      void catchUp()
    },
    dispose() {
      stopTicking()
      if (visibilityBound && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
        visibilityBound = false
      }
    },

    async refreshThemes() {
      try {
        const snapshot = await deps.listOutputs()
        themes = snapshot.projects.map(project => project.topic)
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error))
      }
      emit()
    },

    async selectTheme(theme) {
      selectedTheme = theme
      selectedMaterialId = null
      materials = []
      if (theme === null) {
        loadingMaterials = false
        emit()
        return
      }
      loadingMaterials = true
      emit()
      try {
        const read = await deps.gateway.readManifest(theme)
        materials = applyQuota(read.manifest.materials).kept
        if (read.problems.length > 0) setNotice(read.problems[0] ?? null)
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error))
      } finally {
        loadingMaterials = false
        emit()
      }
    },

    selectMaterial(id) {
      selectedMaterialId = id
      emit()
    },

    async readBody(theme, file) {
      try {
        const stored = await deps.gateway.readAsset(theme, file)
        return stored.content ?? null
      } catch {
        return null
      }
    },

    showNotice(message) {
      setNotice(message)
    },

    dismissNotice() {
      setNotice(null)
    },

    addSource(input) {
      if (sources.length >= GATHER_SOURCE_LIMIT) {
        setNotice('source-limit')
        return
      }
      sources = [...sources, {
        id: randomId(),
        name: input.name,
        url: input.url,
        intervalMinutes: Math.max(30, input.intervalMinutes),
        enabled: true,
        tags: [...input.tags],
        excludeKeywords: [...input.excludeKeywords],
        createdAt: new Date().toISOString(),
        lastFetchedAt: null,
        lastStatus: null,
        consecutiveFailures: 0,
        etag: null,
        lastModified: null,
      }]
      persist()
    },

    updateSource(id, patch) {
      patchSource(id, patch.intervalMinutes === undefined ? patch : { ...patch, intervalMinutes: Math.max(30, patch.intervalMinutes) })
      persist()
    },

    removeSource(id) {
      sources = sources.filter(source => source.id !== id)
      persist()
    },

    async testSource(id) {
      const source = sourceById(id)
      if (source === undefined) return { ok: false, detail: 'missing-source' }
      try {
        const result = await deps.gateway.fetchFeed({ url: source.url, ...cursorsOf(source) })
        return { ok: true, detail: result.notModified ? 'not-modified' : `${result.items.length}` }
      } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : String(error) }
      }
    },

    importSources(inputs) {
      const knownUrls = new Set(sources.map(source => source.url))
      let imported = 0
      for (const input of inputs) {
        if (knownUrls.has(input.url) || sources.length >= GATHER_SOURCE_LIMIT) continue
        knownUrls.add(input.url)
        sources = [...sources, {
          id: randomId(),
          name: input.name,
          url: input.url,
          intervalMinutes: 60,
          enabled: true,
          tags: [...input.tags],
          excludeKeywords: [],
          createdAt: new Date().toISOString(),
          lastFetchedAt: null,
          lastStatus: null,
          consecutiveFailures: 0,
          etag: null,
          lastModified: null,
        }]
        imported += 1
      }
      persist()
      return imported
    },

    addTask(input) {
      tasks = [...tasks, {
        ...input,
        id: randomId(),
        name: input.name,
        sourceIds: [...input.sourceIds],
        includeKeywords: [...input.includeKeywords],
        excludeKeywords: [...input.excludeKeywords],
        log: [],
        status: 'idle',
      }]
      persist()
    },

    updateTask(id, patch) {
      patchTask(id, patch)
      persist()
    },

    removeTask(id) {
      tasks = tasks.filter(task => task.id !== id)
      persist()
    },

    async triggerTask(id) {
      await enqueue(() => runTask(id, new Date().toISOString(), true))
    },

    async markRead(id) {
      await withMaterials(id, material => ({ ...material, status: material.status === 'read' ? 'unread' : 'read' }))
    },

    async toggleFavorite(id) {
      await withMaterials(id, material => ({ ...material, status: material.status === 'favorite' ? 'unread' : 'favorite' }))
    },

    async markPicked(id) {
      await withMaterials(id, material => ({ ...material, status: 'picked' }))
    },

    async addExcerpt(id, excerpt) {
      if (excerpt.trim().length === 0) return
      await withMaterials(id, material => ({ ...material, excerpts: [...material.excerpts ?? [], excerpt.trim()] }))
    },

    async bindTheme(id, nextTheme) {
      const current = materials.find(material => material.id === id)
      if (current === undefined || selectedTheme === null || nextTheme === selectedTheme) return
      const oldTheme = selectedTheme
      const target = await deps.gateway.readManifest(nextTheme)
      if (target.problems.length > 0) {
        setNotice(`manifest for ${nextTheme} has problems: ${target.problems[0] ?? ''}`)
        return
      }
      // Carry the snapshot over first (the gateway's moveAsset stays within
      // one theme): a failure aborts the rebind with both manifests untouched.
      if (current.bodyFile !== undefined) {
        try {
          const stored = await deps.gateway.readAsset(oldTheme, current.bodyFile)
          if (stored.content !== undefined) {
            await deps.gateway.writeAsset({ theme: nextTheme, file: current.bodyFile, content: stored.content })
          }
          await deps.gateway.deleteAsset(oldTheme, current.bodyFile)
        } catch (error) {
          setNotice(error instanceof Error ? error.message : String(error))
          return
        }
      }
      const moved: GatherMaterial = { ...current }
      const nextMaterials = target.manifest.materials.filter(material => material.id !== id)
      await deps.gateway.writeManifest(nextTheme, { formatVersion: 0, materials: [...nextMaterials, moved] })
      const remaining = materials.filter(material => material.id !== id)
      await deps.gateway.writeManifest(oldTheme, { formatVersion: 0, materials: remaining })
      materials = remaining
      emit()
    },

    async processWithAi(id) {
      const current = materials.find(material => material.id === id)
      if (current === undefined || selectedTheme === null) return
      try {
        const result = await deps.gateway.processMaterial({
          operation: 'process',
          theme: selectedTheme,
          ...(current.bodyFile !== undefined ? { bodyFile: current.bodyFile } : {}),
          title: current.title,
          ...(current.summary !== undefined ? { summary: current.summary } : {}),
          url: current.url,
        })
        await withMaterials(id, material => ({
          ...material,
          summary: result.summary,
          points: result.points,
          score: result.score,
          tags: result.tags,
        }))
      } catch (error) {
        // AI failures never affect the material itself: the entry keeps its
        // state and the UI offers the button again.
        setNotice(error instanceof Error ? error.message : String(error))
      }
    },

    async pushToCalendar(id, date) {
      const current = materials.find(material => material.id === id)
      if (current === undefined) return
      try {
        await deps.schedulePut({
          title: current.title,
          date,
          time: null,
          platform: null,
          status: 'scheduled',
          kind: 'event',
          topic: selectedTheme,
          url: current.url,
        })
        setNotice('calendar-added')
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error))
      }
    },
  }
}
