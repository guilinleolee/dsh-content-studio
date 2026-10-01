/**
 * The review view controller: one observable state object over the
 * `_review.json` manifest (via the content-outputs review faces), the
 * two-step import flow (parse preview → confirmed commit), the explicit AI
 * calls (single-work diagnosis, period report with its data-only fallback),
 * the reflow into the topic bank, and the session-scoped filter/diagnosis
 * buffers. Persistent business data (baselines, bindings, snapshots, tasks)
 * lives in the manifest; only filters and in-progress diagnosis ride the
 * browser session.
 */

import type {
  MetricSnapshot, ReviewAiResult, ReviewAnalyzeWorkRequest, ReviewBaselines, ReviewFilters,
  ReviewImportCommitRequest, ReviewImportCommitResult, ReviewImportPreview,
  ReviewImportPreviewRequest, ReviewGenerateReportRequest, ReviewManifest, ReviewManifestRead,
  ReviewReportRead, ReviewTask, ReviewTaskDeleteRequest, ReviewWorkFilter,
} from '@deepseek-ai/dsh-content-outputs/types'
import { DEFAULT_BASELINES } from './model.ts'
import type { TopicItemInput } from '@deepseek-ai/dsh-content-topics/types'
import {
  aggregateSummary, dataOnlyReport, DIAGNOSE_DRAFT_CHARS, isLongtail, poolSnapshots,
  rankWorks, selectDigests, verdictOf, type WorkVerdict,
} from './model.ts'

/** Browser-local storage key of the session filter set. */
const FILTERS_KEY = 'dsh-content-studio.review.filters'

/** The injected server face: the review half of the content-outputs Remote. */
export interface ReviewGateway {
  readReviewManifest: (theme: string) => Promise<ReviewManifestRead>
  writeReviewManifest: (theme: string, manifest: ReviewManifest) => Promise<void>
  parseReviewImport: (request: ReviewImportPreviewRequest) => Promise<ReviewImportPreview>
  commitReviewImport: (request: ReviewImportCommitRequest) => Promise<ReviewImportCommitResult>
  deleteReviewTask: (request: ReviewTaskDeleteRequest) => Promise<void>
  writeReviewReport: (theme: string, file: string, content: string) => Promise<{ file: string }>
  readReviewReport: (theme: string, file: string) => Promise<ReviewReportRead>
  writeReviewTemplate: (theme: string, file: string, content: string) => Promise<{ file: string }>
  listReviewTemplates: (theme: string) => Promise<{ files: readonly string[] }>
  analyzeReviewWork: (request: ReviewAnalyzeWorkRequest) => Promise<ReviewAiResult>
  generateReviewReport: (request: ReviewGenerateReportRequest) => Promise<ReviewAiResult>
}

/** One-step user-facing outcome codes; the copy lives in the locale dictionaries. */
export type ReviewNotice =
  | 'load-failed'
  | 'import-parsed'
  | 'import-committed'
  | 'import-failed'
  | 'bind-failed'
  | 'baselines-saved'
  | 'baselines-failed'
  | 'report-ready'
  | 'report-degraded'
  | 'report-failed'
  | 'report-saved'
  | 'save-failed'
  | 'task-deleted'
  | 'delete-failed'
  | 'template-saved'
  | 'diagnose-failed'
  | 'topic-added'
  | 'topic-failed'
  | 'need-theme'

/** The session filter set the view restores per open. */
export interface ReviewFilterSession {
  readonly version: 1
  readonly platforms: readonly string[]
  readonly contentTypes: readonly string[]
  readonly workFilter: ReviewWorkFilter
  readonly period: { from: string; to: string }
}

/** The latest per-work judgment the UI renders. */
export interface WorkCard {
  readonly snapshot: MetricSnapshot
  readonly verdict: WorkVerdict
  readonly longtail: boolean
}

/** Snapshot the React surface subscribes to. */
export interface ReviewState {
  readonly theme: string | null
  readonly manifest: ReviewManifest | null
  /** Stored entries that failed validation, named but not dropped silently. */
  readonly problems: readonly string[]
  readonly loading: boolean
  /** Any in-flight import, AI, or reflow call. */
  readonly busy: boolean
  readonly notice: ReviewNotice | null
  /** The staged import preview awaiting user confirmation. */
  readonly preview: ReviewImportPreview | null
  /** Unknown columns the user checked to ignore, for the staged file. */
  readonly ignoredColumns: readonly string[]
  /** The report markdown being edited inline; null when not editing. */
  readonly reportDraft: string | null
  readonly editingTaskId: string | null
  /** Saved viral-template file names from disk. */
  readonly templates: readonly string[]
  /** Session diagnosis results keyed by `platform:workId`. */
  readonly diagnoses: Readonly<Record<string, string>>
  /** Bumped on every filter change so subscribers recompute the pool. */
  readonly filtersRevision: number
}

/** The default session filters: the trailing month. */
function defaultFilters(now: Date): ReviewFilterSession {
  const iso = (date: Date): string => date.toISOString().slice(0, 10)
  return {
    version: 1,
    platforms: [],
    contentTypes: [],
    workFilter: 'all',
    period: { from: iso(new Date(now.getTime() - 30 * 86_400_000)), to: iso(now) },
  }
}

/** Load the stored session filters; anything malformed drops back to defaults. */
function loadFilters(now: Date): ReviewFilterSession {
  try {
    const raw = localStorage.getItem(FILTERS_KEY)
    if (raw === null) return defaultFilters(now)
    const parsed = JSON.parse(raw) as ReviewFilterSession
    // The version gate runs on parsed-unknown JSON; the literal check
    // carries the type. oxlint-disable-next-line typescript/no-unnecessary-condition
    if (parsed.version !== 1 || typeof parsed.period.from !== 'string') return defaultFilters(now)
    return parsed
  } catch {
    return defaultFilters(now)
  }
}

/** The topics face the reflow rides; structural so tests can stub it. */
export interface ReviewTopicsFace {
  put: (input: TopicItemInput) => Promise<unknown>
}

/** The controller the view consumes. */
export interface ReviewController {
  /** Current state snapshot (the useSyncExternalStore read). */
  getState(): ReviewState
  /** Subscribe to state changes; returns the unsubscriber. */
  subscribe(listener: () => void): () => void
  /** Load one theme's manifest (and its saved templates). */
  load(theme: string): Promise<void>
  /** Set the staged file's unknown columns the user chose to ignore. */
  setIgnoredColumns(columns: readonly string[]): void
  /** Parse one file into the staged preview (no storage). */
  stageImport(platformId: ReviewImportPreviewRequest['platformId'], fileName: string, text: string): Promise<void>
  /** Commit the staged preview's rows as snapshots. */
  commitImport(): Promise<void>
  /** Drop the staged preview. */
  discardImport(): void
  /** Bind one unbound snapshot to a creation content id (manual match). */
  bindWork(platformWorkId: string, platformId: string, contentId: string): Promise<void>
  /** Persist the baselines as user-sourced. */
  saveBaselines(engagementRate: number, collectRate: number): Promise<void>
  /** The active filter set. */
  filters(): ReviewFilterSession
  /** Patch the filter set (persisted to the session storage). */
  setFilters(patch: Partial<Omit<ReviewFilterSession, 'version'>>): void
  /** The filtered analysis pool with per-work verdicts. */
  pool(): WorkCard[]
  /** The period aggregation over the current pool. */
  summary(): ReturnType<typeof aggregateSummary>
  /** Create one review task and generate its report (AI with the data-only fallback). */
  createTask(name: string): Promise<void>
  /** Read one task's report into the inline editor. */
  editReport(taskId: string): Promise<void>
  /** Save the edited report as a new file version. */
  saveReport(): Promise<void>
  /** Stop editing without saving. */
  closeReport(): void
  /** Place content into the inline editor without switching tasks. */
  copyReportToEditor(content: string): void
  /** Remove one task (report file goes, snapshots stay). */
  deleteTask(taskId: string): Promise<void>
  /** Save one report as a viral template. */
  saveTemplate(fileName: string, content: string): Promise<void>
  /** Diagnose one work (explicit AI call; the result stays for the session). */
  diagnoseWork(card: WorkCard, draftText: string | null, tags: readonly string[], personaDigest: string | null): Promise<void>
  /** Push one topic suggestion into the topic bank. */
  pushToTopicBank(title: string, oneLiner: string | null, description: string | null): Promise<void>
  /** Clear the current notice. */
  clearNotice(): void
}

/**
 * Create the review controller over the wired gateway and topic face.
 * @param gateway - the review half of the content-outputs Remote.
 * @param topics - the topic-bank write face for the reflow.
 * @returns the controller.
 */
export function createReviewController(gateway: ReviewGateway, topics: ReviewTopicsFace): ReviewController {
  let state: ReviewState = {
    theme: null,
    manifest: null,
    problems: [],
    loading: false,
    busy: false,
    notice: null,
    preview: null,
    ignoredColumns: [],
    reportDraft: null,
    editingTaskId: null,
    templates: [],
    diagnoses: {},
    filtersRevision: 0,
  }
  const listeners = new Set<() => void>()
  const notify = (): void => {
    for (const listener of listeners) listener()
  }
  const patch = (next: Partial<ReviewState>): void => {
    state = { ...state, ...next }
    notify()
  }

  const requireManifest = (): ReviewManifest => {
    if (state.manifest === null) throw new Error('review manifest not loaded')
    return state.manifest
  }

  const persist = async (manifest: ReviewManifest): Promise<void> => {
    await gateway.writeReviewManifest(state.theme as string, manifest)
    patch({ manifest })
  }

  /** Report file name for one save: new file per save, original never overwritten. */
  const reportFileName = (taskId: string): string =>
    `report-${taskId}-${new Date().toISOString().replace(/[:.]/gu, '-')}.md`

  /** The active filters as the store-side ReviewFilters shape. */
  const activeFilters = (session: ReviewFilterSession): ReviewFilters => ({
    platforms: session.platforms as ReviewFilters['platforms'],
    contentTypes: session.contentTypes as ReviewFilters['contentTypes'],
    workFilter: session.workFilter,
  })

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },

    async load(theme) {
      patch({ theme, loading: true, notice: null })
      try {
        const read = await gateway.readReviewManifest(theme)
        const templates = await gateway.listReviewTemplates(theme)
        patch({ manifest: read.manifest, problems: read.problems, loading: false, templates: templates.files })
      } catch {
        patch({ loading: false, notice: 'load-failed' })
      }
    },

    setIgnoredColumns(columns) {
      patch({ ignoredColumns: columns })
    },

    async stageImport(platformId, fileName, text) {
      if (state.theme === null) {
        patch({ notice: 'need-theme' })
        return
      }
      patch({ busy: true, notice: null })
      try {
        const preview = await gateway.parseReviewImport({ platformId, fileName, text })
        patch({ preview, ignoredColumns: [], busy: false, notice: 'import-parsed' })
      } catch {
        patch({ busy: false, notice: 'import-failed' })
      }
    },

    async commitImport() {
      const theme = state.theme
      const preview = state.preview
      if (theme === null || preview === null) return
      patch({ busy: true, notice: null })
      try {
        await gateway.commitReviewImport({ theme, platformId: preview.platformId, rows: preview.rows })
        const read = await gateway.readReviewManifest(theme)
        patch({ manifest: read.manifest, problems: read.problems, preview: null, busy: false, notice: 'import-committed' })
      } catch {
        patch({ busy: false, notice: 'import-failed' })
      }
    },

    discardImport() {
      patch({ preview: null, ignoredColumns: [] })
    },

    async bindWork(platformWorkId, platformId, contentId) {
      const manifest = requireManifest()
      const snapshots = manifest.snapshots.map(snapshot =>
        snapshot.platformId === platformId && snapshot.platformWorkId === platformWorkId
          ? { ...snapshot, contentId, matchMethod: 'manual' as const }
          : snapshot)
      try {
        await persist({ ...manifest, snapshots })
      } catch {
        patch({ notice: 'bind-failed' })
      }
    },

    async saveBaselines(engagementRate, collectRate) {
      const manifest = requireManifest()
      const baselines: ReviewBaselines = {
        engagementRate, collectRate, source: 'user', updatedAt: new Date().toISOString(),
      }
      try {
        await persist({ ...manifest, baselines })
        patch({ notice: 'baselines-saved' })
      } catch {
        patch({ notice: 'baselines-failed' })
      }
    },

    filters: () => loadFilters(new Date()),

    setFilters(patchFilters) {
      const next = { ...loadFilters(new Date()), ...patchFilters }
      localStorage.setItem(FILTERS_KEY, JSON.stringify(next))
      patch({ filtersRevision: state.filtersRevision + 1 })
    },

    pool() {
      const manifest = state.manifest
      if (manifest === null) return []
      const baselines = manifest.baselines
      const now = new Date()
      const session = loadFilters(now)
      const pooled = poolSnapshots(manifest, activeFilters(session), session.period, baselines)
      if (session.workFilter !== 'longtail') {
        return pooled.map(snapshot => ({ snapshot, verdict: verdictOf(snapshot.metrics, baselines), longtail: false }))
      }
      // Long-tail judges each work's full snapshot history; the pool keeps
      // every bound work whose history passes the pace gate, represented by
      // its latest snapshot.
      const byWork = new Map<string, MetricSnapshot[]>()
      for (const snapshot of pooled) {
        const key = `${snapshot.platformId}:${snapshot.platformWorkId}`
        const list = byWork.get(key)
        if (list === undefined) byWork.set(key, [snapshot])
        else list.push(snapshot)
      }
      const cards: WorkCard[] = []
      for (const workSnapshots of byWork.values()) {
        const latest = [...workSnapshots].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0]
        if (latest === undefined) continue
        if (isLongtail(workSnapshots, now)) cards.push({ snapshot: latest, verdict: 'neutral', longtail: true })
      }
      return cards
    },

    summary() {
      const manifest = state.manifest
      if (manifest === null) return aggregateSummary([], DEFAULT_BASELINES, new Date())
      return aggregateSummary(this.pool().map(card => card.snapshot), manifest.baselines, new Date())
    },

    async createTask(name) {
      const theme = state.theme
      if (theme === null) {
        patch({ notice: 'need-theme' })
        return
      }
      const manifest = requireManifest()
      const session = loadFilters(new Date())
      const taskId = crypto.randomUUID()
      const task: ReviewTask = {
        taskId,
        name,
        period: session.period,
        filters: {
          platforms: session.platforms as ReviewFilters['platforms'],
          contentTypes: session.contentTypes as ReviewFilters['contentTypes'],
          workFilter: session.workFilter,
        },
        status: 'generating',
        reportFile: null,
        degraded: false,
        createdAt: new Date().toISOString(),
      }
      patch({ busy: true, notice: null })
      try {
        await persist({ ...manifest, tasks: [...manifest.tasks, task] })
      } catch {
        patch({ busy: false, notice: 'save-failed' })
        return
      }
      const now = new Date()
      const pooled = poolSnapshots(manifest, activeFilters(session), session.period, manifest.baselines)
      const ranked = rankWorks(pooled)
      const summary = aggregateSummary(pooled, manifest.baselines, now)
      const digests = selectDigests(ranked, {})
      let degraded = true
      let markdown: string
      try {
        const result = await gateway.generateReviewReport({
          name,
          period: task.period,
          platforms: task.filters.platforms,
          baselines: manifest.baselines,
          summary,
          topWorks: digests.top,
          bottomWorks: digests.bottom,
        })
        markdown = result.markdown
        degraded = false
      } catch {
        markdown = dataOnlyReport(name, task.period, summary, ranked, manifest.baselines)
      }
      try {
        const stored = await gateway.writeReviewReport(theme, reportFileName(taskId), markdown)
        const current = requireManifest()
        const tasks = current.tasks.map(candidate =>
          candidate.taskId === taskId
            ? { ...candidate, status: 'ready' as const, degraded, reportFile: stored.file }
            : candidate)
        await persist({ ...current, tasks })
        patch({ busy: false, notice: degraded ? 'report-degraded' : 'report-ready' })
      } catch {
        // The text lands in the editor even when the disk write failed, so
        // the user can copy it out; the task records the failure.
        const current = requireManifest()
        const tasks = current.tasks.map(candidate =>
          candidate.taskId === taskId ? { ...candidate, status: 'failed' as const } : candidate)
        await persist({ ...current, tasks }).catch(() => undefined)
        patch({ busy: false, reportDraft: markdown, editingTaskId: taskId, notice: 'report-failed' })
      }
    },

    async editReport(taskId) {
      const theme = state.theme
      const manifest = requireManifest()
      const task = manifest.tasks.find(candidate => candidate.taskId === taskId)
      if (theme === null || task === undefined || task.reportFile === null) return
      try {
        const read = await gateway.readReviewReport(theme, task.reportFile)
        patch({ reportDraft: read.content ?? '', editingTaskId: taskId })
      } catch {
        patch({ notice: 'load-failed' })
      }
    },

    async saveReport() {
      const theme = state.theme
      const taskId = state.editingTaskId
      const draft = state.reportDraft
      if (theme === null || taskId === null || draft === null) return
      try {
        const stored = await gateway.writeReviewReport(theme, reportFileName(taskId), draft)
        const manifest = requireManifest()
        const tasks = manifest.tasks.map(candidate =>
          candidate.taskId === taskId ? { ...candidate, reportFile: stored.file, status: 'ready' as const } : candidate)
        await persist({ ...manifest, tasks })
        patch({ reportDraft: null, editingTaskId: null, notice: 'report-saved' })
      } catch {
        patch({ notice: 'save-failed' })
      }
    },

    closeReport() {
      patch({ reportDraft: null, editingTaskId: null })
    },

    copyReportToEditor(content) {
      patch({ reportDraft: content })
    },

    async deleteTask(taskId) {
      const theme = state.theme
      if (theme === null) return
      try {
        await gateway.deleteReviewTask({ theme, taskId })
        const read = await gateway.readReviewManifest(theme)
        patch({ manifest: read.manifest, problems: read.problems, notice: 'task-deleted' })
      } catch {
        patch({ notice: 'delete-failed' })
      }
    },

    async saveTemplate(fileName, content) {
      const theme = state.theme
      if (theme === null) {
        patch({ notice: 'need-theme' })
        return
      }
      try {
        await gateway.writeReviewTemplate(theme, fileName.endsWith('.md') ? fileName : `${fileName}.md`, content)
        const templates = await gateway.listReviewTemplates(theme)
        patch({ templates: templates.files, notice: 'template-saved' })
      } catch {
        patch({ notice: 'save-failed' })
      }
    },

    async diagnoseWork(card, draftText, tags, personaDigest) {
      patch({ busy: true, notice: null })
      const key = `${card.snapshot.platformId}:${card.snapshot.platformWorkId}`
      try {
        const result = await gateway.analyzeReviewWork({
          title: card.snapshot.title,
          platformId: card.snapshot.platformId,
          contentType: card.snapshot.contentType,
          publishedAt: card.snapshot.publishedAt,
          period: loadFilters(new Date()).period,
          metrics: card.snapshot.metrics,
          verdict: card.verdict === 'viral' || card.verdict === 'weak' ? card.verdict : 'neutral',
          draftText: draftText === null ? null : draftText.slice(0, DIAGNOSE_DRAFT_CHARS),
          tags,
          personaDigest,
        })
        patch({ busy: false, diagnoses: { ...state.diagnoses, [key]: result.markdown } })
      } catch {
        patch({ busy: false, notice: 'diagnose-failed' })
      }
    },

    async pushToTopicBank(title, oneLiner, description) {
      const input: TopicItemInput = {
        title,
        oneLiner,
        status: 'idea',
        source: { type: 'manual', refId: null, url: null, snapshot: null },
        tags: ['复盘'],
        description,
        score: null,
        planDate: null,
        scheduleItemId: null,
        topicDir: null,
      }
      try {
        await topics.put(input)
        patch({ notice: 'topic-added' })
      } catch {
        patch({ notice: 'topic-failed' })
      }
    },

    clearNotice() {
      patch({ notice: null })
    },
  }
}
