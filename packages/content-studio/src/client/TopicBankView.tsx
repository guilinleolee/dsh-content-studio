/**
 * The topic-bank view: the whole `_topics.json` bank in two faces — the P0
 * table (title, source with its provenance entry, score, tags, status,
 * plan date, update time) and the P1 five-column kanban with native HTML5
 * drag-and-drop status moves — over the reusable SplitDetail layout, with
 * the detail side panel, create/edit forms, batch actions, schedule
 * linkage, and Markdown export. Loading, error, and empty are first-class
 * states; an empty bank renders the guide page carrying the two capability
 * cards inherited from the retired 选题规划 view. Filter and view
 * configuration persists to localStorage under the feature prefix and
 * reloads through the versioned migration (unknown shapes fall back whole).
 */
import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { IconRefreshOutline14, IconWarningOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ScheduleItemId, ScheduleItemInput } from '@deepseek-ai/dsh-content-schedule/types'
import type { ContentTopicsSnapshot, TopicItem, TopicItemInput, TopicStatus } from '@deepseek-ai/dsh-content-topics/types'
import type { CapabilityItem } from './capabilities.ts'
import { CapabilityPage } from './CapabilityPage.tsx'
import type { PickedTopic } from './studio-store.ts'
import { SplitDetail } from './SplitDetail.tsx'
import { todayDate } from './calendar.ts'
import {
  TOPIC_SOURCE_TYPES,
  TOPIC_STATUSES,
  collectTags,
  filterTopics,
  formatScore,
  groupByStatus,
  loadTopicBankConfig,
  manualTopicInput,
  saveTopicBankConfig,
  topicInputOf,
  topicsToMarkdown,
  withAppendedTags,
  type TopicBankConfig,
} from './topic-bank.ts'
import css from './ContentStudio.module.css'
import tb from './TopicBankView.module.css'

/** localStorage key of the view/filter configuration (feature-prefixed). */
const CONFIG_KEY = 'dsh-content-studio.topicBank.config'

/** How long a toast stays visible before clearing itself. */
const NOTICE_MS = 3000

/** One collision-resistant schedule id, matching the gather id scheme: the
 * calendar store accepts any non-empty id, and supplying one lets the topic
 * bank remember the linkage without scanning the returned snapshot. */
function newScheduleId(): string {
  return `sched${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** The narrow schedule write face the view drives (create/update/remove). */
export interface TopicBankScheduleFace {
  put: (input: ScheduleItemInput) => Promise<unknown>
  remove: (id: ScheduleItemId) => Promise<unknown>
}

/** The contentTopics Remote face, envelope-unwrapped by the assembler. */
export interface TopicBankGateway {
  list: () => Promise<ContentTopicsSnapshot>
  put: (input: TopicItemInput) => Promise<ContentTopicsSnapshot>
  remove: (id: TopicItem['id']) => Promise<ContentTopicsSnapshot>
}

/** Injected face of the topic-bank view. */
export interface TopicBankViewInjected {
  topics: TopicBankGateway
  /** The calendar write face for the plan-date linkage and delete cascade. */
  schedule: TopicBankScheduleFace
  /** Hand one topic to the create view (navigates there). */
  onStartCreate: (topic: PickedTopic) => void
  /** The authorized asset write for Markdown exports into `<theme>/assets/`. */
  writeExport: (theme: string, file: string, content: string) => Promise<unknown>
  /** Outputs theme names, the export targets. */
  listThemes: () => Promise<readonly string[]>
  /** The workbench's shared capability-copy state, for the guide cards. */
  copiedCapabilityId?: string | undefined
  pickCapability: (item: CapabilityItem) => void
}

/** Full view props: the injected face plus the locale seat. */
export type TopicBankViewProps = TopicBankViewInjected & PropsLocale<'content-studio'>

/** The create/edit form's draft state; create reads only the title. */
interface TopicFormState {
  readonly mode: 'create' | 'edit'
  readonly id: string | null
  readonly title: string
  readonly oneLiner: string
  readonly status: TopicStatus
  readonly tagsText: string
  readonly description: string
  readonly sourceUrl: string
  readonly planDate: string
  readonly scoreText: string
}

/** Draft of an edit form, prefilled from one stored topic. */
function editFormOf(item: TopicItem): TopicFormState {
  return {
    mode: 'edit',
    id: item.id,
    title: item.title,
    oneLiner: item.oneLiner ?? '',
    status: item.status,
    tagsText: item.tags.join(', '),
    description: item.description ?? '',
    sourceUrl: item.source.url ?? '',
    planDate: item.planDate ?? '',
    scoreText: item.score === null ? '' : formatScore(item.score.total),
  }
}

/** Blank-string-to-null for the form's optional fields. */
function orNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

/** Split a comma-separated field into trimmed, non-empty tags. */
function parseTagsText(value: string): readonly string[] {
  return value.split(/[,，]/).map(tag => tag.trim()).filter(tag => tag.length > 0)
}

/**
 * Render the topic-bank view.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export function TopicBankView({
  topics, schedule, onStartCreate, writeExport, listThemes, copiedCapabilityId, pickCapability, t,
}: TopicBankViewProps) {
  const [snapshot, setSnapshot] = useState<ContentTopicsSnapshot | undefined>(undefined)
  const [failed, setFailed] = useState<string | undefined>(undefined)
  const [config, setConfig] = useState<TopicBankConfig>(() => loadTopicBankConfig(localStorage.getItem(CONFIG_KEY)))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<TopicFormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [alsoRemoveSchedule, setAlsoRemoveSchedule] = useState(true)
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([])
  const [batchStatus, setBatchStatus] = useState<TopicStatus>('todo')
  const [batchTagsText, setBatchTagsText] = useState('')
  const [themes, setThemes] = useState<readonly string[]>([])
  const [exportTheme, setExportTheme] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<TopicStatus | null>(null)
  const draggingRef = useRef<string | null>(null)

  const load = async (): Promise<void> => {
    setFailed(undefined)
    setSnapshot(undefined)
    try {
      setSnapshot(await topics.list())
    } catch (error) {
      console.error('[content-studio] contentTopics/list failed:', error)
      setFailed(error instanceof Error ? error.message : String(error))
    }
  }
  useEffect(() => { void load() }, [topics])

  useEffect(() => {
    let alive = true
    listThemes().then((names) => {
      if (alive) setThemes(names)
    }).catch(() => {
      if (alive) setThemes([])
    })
    return () => { alive = false }
  }, [listThemes])

  useEffect(() => {
    if (notice === null) return
    const timer = window.setTimeout(() => { setNotice(null) }, NOTICE_MS)
    return () => { window.clearTimeout(timer) }
  }, [notice])

  const toast = (message: string): void => { setNotice(message) }

  const patchConfig = (patch: Partial<TopicBankConfig>): void => {
    setConfig((current) => {
      const next = { ...current, ...patch }
      localStorage.setItem(CONFIG_KEY, saveTopicBankConfig(next))
      return next
    })
  }
  const patchFilters = (patch: Partial<TopicBankConfig['filters']>): void => {
    patchConfig({ filters: { ...config.filters, ...patch } })
  }

  const today = todayDate()
  const items = snapshot?.items ?? []
  const visible = snapshot === undefined ? [] : filterTopics(snapshot.items, config.filters, today)
  const tags = collectTags(items)
  const selected = items.find(item => item.id === selectedId)
  const exportTarget = exportTheme ?? themes[0] ?? null
  const checkedIds = selectedIds.filter(id => items.some(item => item.id === id))

  const patchForm = (patch: Partial<TopicFormState>): void => {
    setForm(current => current === null ? current : { ...current, ...patch })
  }

  const openCreate = (): void => {
    setFormError(null)
    setForm({ mode: 'create', id: null, title: '', oneLiner: '', status: 'idea', tagsText: '', description: '', sourceUrl: '', planDate: '', scoreText: '' })
  }
  const submitCreate = async (): Promise<void> => {
    if (form === null) return
    const title = form.title.trim()
    if (title.length === 0) { setFormError(t('topicBank.error.titleRequired')); return }
    try {
      const next = await topics.put(manualTopicInput(title))
      setSnapshot(next)
      setForm(null)
      toast(t('topicBank.notice.created'))
    } catch (error) {
      toast(t('topicBank.notice.failed', { detail: error instanceof Error ? error.message : String(error) }))
    }
  }

  /** Save the edit form, including the one-way plan-date → calendar linkage. */
  const submitEdit = async (): Promise<void> => {
    if (form === null || form.id === null) return
    const item = items.find(candidate => candidate.id === form.id)
    if (item === undefined) return
    const title = form.title.trim()
    if (title.length === 0) { setFormError(t('topicBank.error.titleRequired')); return }
    const scoreText = form.scoreText.trim()
    let score = item.score
    if (scoreText.length === 0) score = null
    else {
      const total = Number(scoreText)
      if (!Number.isFinite(total) || total < 0 || total > 10) { setFormError(t('topicBank.error.scoreRange')); return }
      score = { total, source: 'manual', factors: null, evaluatedAt: new Date().toISOString() }
    }
    const planDate = orNull(form.planDate)
    let scheduleItemId = item.scheduleItemId
    if (planDate !== null && planDate !== item.planDate) {
      // One-way linkage: the calendar entry is created (or its date moves)
      // through the schedule gateway only; the topic side just remembers the
      // id. No status sync runs in either direction.
      const scheduleId = (item.scheduleItemId ?? newScheduleId()) as ScheduleItemId
      try {
        await schedule.put({
          id: scheduleId,
          title,
          date: planDate,
          time: null,
          platform: null,
          status: 'idea',
          kind: 'content',
          topic: item.topicDir,
          url: null,
        })
        scheduleItemId = scheduleId
      } catch (error) {
        toast(t('topicBank.notice.failed', { detail: error instanceof Error ? error.message : String(error) }))
        return
      }
    }
    try {
      const next = await topics.put(topicInputOf(item, {
        title,
        oneLiner: orNull(form.oneLiner),
        status: form.status,
        tags: parseTagsText(form.tagsText),
        description: orNull(form.description),
        source: { ...item.source, url: orNull(form.sourceUrl) },
        score,
        planDate,
        scheduleItemId,
      }))
      setSnapshot(next)
      setForm(null)
      toast(t('topicBank.notice.saved'))
    } catch (error) {
      toast(t('topicBank.notice.failed', { detail: error instanceof Error ? error.message : String(error) }))
    }
  }

  /** Delete the selected topic, cascading to its calendar entry only when
   * the confirm checkbox says so. */
  const performDelete = async (): Promise<void> => {
    if (selected === undefined) return
    try {
      if (alsoRemoveSchedule && selected.scheduleItemId !== null) {
        await schedule.remove(selected.scheduleItemId as ScheduleItemId)
      }
      const next = await topics.remove(selected.id)
      setSnapshot(next)
      setSelectedId(null)
      setConfirming(false)
      toast(t('topicBank.notice.deleted'))
    } catch (error) {
      toast(t('topicBank.notice.failed', { detail: error instanceof Error ? error.message : String(error) }))
    }
  }

  /** Move one kanban card across columns: optimistic status flip, then the
   * Remote put; a failed write rolls the UI back and toasts. */
  const dropTo = async (status: TopicStatus): Promise<void> => {
    setDragOver(null)
    const id = draggingRef.current
    draggingRef.current = null
    if (id === null || snapshot === undefined) return
    const item = snapshot.items.find(candidate => candidate.id === id)
    if (item === undefined || item.status === status) return
    setSnapshot({ ...snapshot, items: snapshot.items.map(candidate => candidate.id === id ? { ...candidate, status } : candidate) })
    try {
      setSnapshot(await topics.put(topicInputOf(item, { status })))
    } catch (error) {
      setSnapshot(snapshot)
      toast(t('topicBank.notice.failed', { detail: error instanceof Error ? error.message : String(error) }))
    }
  }

  /** Run one batch edit over every checked topic, sequentially — the
   * gateway serializes on the file lock, and one failure stops the run. */
  const runBatch = async (build: (item: TopicItem) => TopicItemInput): Promise<void> => {
    const targets = items.filter(item => checkedIds.includes(item.id))
    let last: ContentTopicsSnapshot | undefined
    try {
      for (const item of targets) last = await topics.put(build(item))
    } catch (error) {
      toast(t('topicBank.notice.failed', { detail: error instanceof Error ? error.message : String(error) }))
      return
    }
    if (last !== undefined) setSnapshot(last)
    setSelectedIds([])
    toast(t('topicBank.notice.batchDone'))
  }

  const applyBatchTags = async (): Promise<void> => {
    const appended = parseTagsText(batchTagsText)
    if (appended.length === 0) return
    await runBatch(item => withAppendedTags(item, appended))
  }

  /** Export topics as one Markdown document into the selected theme's assets. */
  const doExport = async (exportItems: readonly TopicItem[]): Promise<void> => {
    if (exportTarget === null) return
    const file = `topics-${today}.md`
    try {
      await writeExport(exportTarget, file, topicsToMarkdown(exportItems))
      toast(t('topicBank.notice.exported', { file }))
    } catch (error) {
      toast(t('topicBank.notice.failed', { detail: error instanceof Error ? error.message : String(error) }))
    }
  }

  const toggleChecked = (id: string): void => {
    setSelectedIds(current => current.includes(id) ? current.filter(candidate => candidate !== id) : [...current, id])
  }

  const selectItem = (id: string): void => {
    setSelectedId(id)
    setConfirming(false)
  }

  const createForm = form !== null && form.mode === 'create' && (
    <div className={clsx(tb.detail, tb.formPanel)}>
      <div className={tb.form}>
        <label className={tb.fieldLabel} htmlFor="topic-bank-create-title">{t('topicBank.field.title')}</label>
        <input
          id="topic-bank-create-title"
          className={tb.formInput}
          value={form.title}
          placeholder={t('topicBank.field.titlePlaceholder')}
          onChange={(event) => { patchForm({ title: event.target.value }) }}
        />
        {formError !== null && <p className={tb.formError}>{formError}</p>}
        <div className={tb.formRow}>
          <button type="button" className={tb.primary} onClick={() => { void submitCreate() }}>{t('topicBank.save')}</button>
          <button type="button" className={tb.btn} onClick={() => { setForm(null) }}>{t('topicBank.cancel')}</button>
        </div>
      </div>
    </div>
  )

  if (failed !== undefined) {
    return (
      <div className={css.libraryState}>
        <IconWarningOutline16 size={16} />
        <span>{t('topicBank.error')}: {failed}</span>
        <button type="button" className={css.retry} onClick={() => { void load() }}>
          <IconRefreshOutline14 size={14} />
          {t('library.retry')}
        </button>
      </div>
    )
  }
  if (snapshot === undefined) {
    return <div className={css.libraryState}>{t('topicBank.loading')}</div>
  }
  if (items.length === 0) {
    return (
      <div>
        {createForm}
        <div className={css.libraryState}>{t('topicBank.guide.hint')}</div>
        <div className={tb.guideActions}>
          <button type="button" className={tb.primary} onClick={openCreate}>{t('topicBank.new')}</button>
        </div>
        <CapabilityPage title={t('topicBank.title')} ids={['hotspot', 'calendar-plan']} copiedId={copiedCapabilityId} pick={pickCapability} t={t} />
      </div>
    )
  }

  const editForm = form !== null && form.mode === 'edit' && (
    <div className={tb.form} aria-label={t('topicBank.edit')}>
      <div className={tb.formRow}>
        <button type="button" className={tb.primary} onClick={() => { void submitEdit() }}>{t('topicBank.save')}</button>
        <button type="button" className={tb.btn} onClick={() => { setForm(null) }}>{t('topicBank.cancel')}</button>
      </div>
      <label className={tb.fieldLabel} htmlFor="topic-bank-title">{t('topicBank.field.title')}</label>
      <input id="topic-bank-title" className={tb.formInput} value={form.title} onChange={(event) => { patchForm({ title: event.target.value }) }} />
      <label className={tb.fieldLabel} htmlFor="topic-bank-oneliner">{t('topicBank.field.oneLiner')}</label>
      <input id="topic-bank-oneliner" className={tb.formInput} value={form.oneLiner} onChange={(event) => { patchForm({ oneLiner: event.target.value }) }} />
      <div className={tb.formRow}>
        <label className={tb.fieldLabel} htmlFor="topic-bank-status">{t('topicBank.field.status')}</label>
        <select id="topic-bank-status" className={tb.formInput} value={form.status} onChange={(event) => { patchForm({ status: event.target.value as TopicStatus }) }}>
          {TOPIC_STATUSES.map(status => <option key={status} value={status}>{t(`topic.status.${status}` as const)}</option>)}
        </select>
        <label className={tb.fieldLabel} htmlFor="topic-bank-plan">{t('topicBank.field.planDate')}</label>
        <input id="topic-bank-plan" className={tb.formInput} type="date" value={form.planDate} onChange={(event) => { patchForm({ planDate: event.target.value }) }} />
      </div>
      <label className={tb.fieldLabel} htmlFor="topic-bank-tags">{t('topicBank.field.tags')}</label>
      <input id="topic-bank-tags" className={tb.formInput} value={form.tagsText} placeholder={t('topicBank.field.tagsPlaceholder')} onChange={(event) => { patchForm({ tagsText: event.target.value }) }} />
      <label className={tb.fieldLabel} htmlFor="topic-bank-url">{t('topicBank.field.sourceUrl')}</label>
      <input id="topic-bank-url" className={tb.formInput} value={form.sourceUrl} placeholder={t('topicBank.field.sourceUrlPlaceholder')} onChange={(event) => { patchForm({ sourceUrl: event.target.value }) }} />
      <label className={tb.fieldLabel} htmlFor="topic-bank-score">{t('topicBank.field.score')}</label>
      <input id="topic-bank-score" className={tb.formInput} type="number" min={0} max={10} step={0.5} value={form.scoreText} placeholder={t('topicBank.field.scorePlaceholder')} onChange={(event) => { patchForm({ scoreText: event.target.value }) }} />
      <label className={tb.fieldLabel} htmlFor="topic-bank-description">{t('topicBank.field.description')}</label>
      <textarea id="topic-bank-description" className={clsx(tb.formInput, tb.formTextarea)} value={form.description} placeholder={t('topicBank.field.descriptionPlaceholder')} onChange={(event) => { patchForm({ description: event.target.value }) }} />
      {formError !== null && <p className={tb.formError}>{formError}</p>}
    </div>
  )

  return (
    <div>
      <header className={tb.head}>
        <div>
          <h2 className={css.pageTitle}>{t('topicBank.title')}</h2>
          <span className={css.subtitle}>{t('topicBank.subtitle')}</span>
        </div>
        <button type="button" className={tb.primary} onClick={openCreate}>{t('topicBank.new')}</button>
      </header>

      <div className={tb.toolbar}>
        <select aria-label={t('topicBank.view.aria')} className={tb.control} value={config.view} onChange={(event) => { patchConfig({ view: event.target.value as TopicBankConfig['view'] }) }}>
          <option value="table">{t('topicBank.view.table')}</option>
          <option value="kanban">{t('topicBank.view.kanban')}</option>
        </select>
        <select aria-label={t('topicBank.filter.source')} className={tb.control} value={config.filters.source} onChange={(event) => { patchFilters({ source: event.target.value as TopicBankConfig['filters']['source'] }) }}>
          <option value="all">{t('topicBank.filter.all')}</option>
          {TOPIC_SOURCE_TYPES.map(source => <option key={source} value={source}>{t(`topic.source.${source}` as const)}</option>)}
        </select>
        <select aria-label={t('topicBank.filter.status')} className={tb.control} value={config.filters.status} onChange={(event) => { patchFilters({ status: event.target.value as TopicBankConfig['filters']['status'] }) }}>
          <option value="all">{t('topicBank.filter.all')}</option>
          {TOPIC_STATUSES.map(status => <option key={status} value={status}>{t(`topic.status.${status}` as const)}</option>)}
        </select>
        <select aria-label={t('topicBank.filter.plan')} className={tb.control} value={config.filters.planWindow} onChange={(event) => { patchFilters({ planWindow: event.target.value as TopicBankConfig['filters']['planWindow'] }) }}>
          <option value="all">{t('topicBank.plan.all')}</option>
          <option value="week">{t('topicBank.plan.week')}</option>
          <option value="month">{t('topicBank.plan.month')}</option>
        </select>
        <select aria-label={t('topicBank.filter.tag')} className={tb.control} value={config.filters.tag ?? ''} onChange={(event) => { patchFilters({ tag: event.target.value === '' ? null : event.target.value }) }}>
          <option value="">{t('topicBank.filter.allTags')}</option>
          {tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
        </select>
        <label className={tb.toolbarGroup}>
          <span className={tb.controlLabel}>{t('topicBank.filter.score')}</span>
          <input aria-label={t('topicBank.filter.scoreMin')} className={clsx(tb.control, tb.scoreInput)} type="number" min={0} max={10} value={config.filters.scoreMin} onChange={(event) => { patchFilters({ scoreMin: Number(event.target.value) }) }} />
          <span className={tb.controlLabel}>–</span>
          <input aria-label={t('topicBank.filter.scoreMax')} className={clsx(tb.control, tb.scoreInput)} type="number" min={0} max={10} value={config.filters.scoreMax} onChange={(event) => { patchFilters({ scoreMax: Number(event.target.value) }) }} />
        </label>
        <input aria-label={t('topicBank.filter.search')} className={clsx(tb.control, tb.search)} value={config.filters.search} placeholder={t('topicBank.filter.search')} onChange={(event) => { patchFilters({ search: event.target.value }) }} />
        <span className={tb.count}>{t('topicBank.count', { n: visible.length })}</span>
      </div>

      <div className={tb.toolbar}>
        <label className={tb.toolbarGroup}>
          <span className={tb.controlLabel}>{t('topicBank.export.theme')}</span>
          <select aria-label={t('topicBank.export.theme')} className={tb.control} value={exportTarget ?? ''} onChange={(event) => { setExportTheme(event.target.value) }}>
            {themes.length === 0 && <option value="">{t('topicBank.export.noTheme')}</option>}
            {themes.map(theme => <option key={theme} value={theme}>{theme}</option>)}
          </select>
        </label>
        <button
          type="button"
          className={tb.btn}
          disabled={exportTarget === null || visible.length === 0}
          title={exportTarget === null ? t('topicBank.export.noTheme') : undefined}
          onClick={() => { void doExport(visible) }}
        >
          {t('topicBank.export.button')}
        </button>
      </div>

      {notice !== null && (
        <button type="button" className={tb.notice} role="status" onClick={() => { setNotice(null) }}>
          {notice}
        </button>
      )}
      {snapshot.problems.length > 0 && (
        <div className={css.libraryProblems} role="alert">
          <IconWarningOutline16 size={14} />
          <span>{t('topicBank.problems', { n: snapshot.problems.length })}</span>
        </div>
      )}

      {createForm}

      {checkedIds.length > 0 && (
        <div className={tb.batchBar}>
          <span>{t('topicBank.batch.selected', { n: checkedIds.length })}</span>
          <label className={tb.toolbarGroup}>
            <span className={tb.controlLabel}>{t('topicBank.batch.setStatus')}</span>
            <select aria-label={t('topicBank.batch.setStatus')} className={tb.control} value={batchStatus} onChange={(event) => { setBatchStatus(event.target.value as TopicStatus) }}>
              {TOPIC_STATUSES.map(status => <option key={status} value={status}>{t(`topic.status.${status}` as const)}</option>)}
            </select>
          </label>
          <button type="button" className={tb.btn} onClick={() => { void runBatch(item => topicInputOf(item, { status: batchStatus })) }}>
            {t('topicBank.batch.apply')}
          </button>
          <input
            aria-label={t('topicBank.batch.tagsPlaceholder')}
            className={tb.control}
            value={batchTagsText}
            placeholder={t('topicBank.batch.tagsPlaceholder')}
            onChange={(event) => { setBatchTagsText(event.target.value) }}
          />
          <button type="button" className={tb.btn} onClick={() => { void applyBatchTags() }}>
            {t('topicBank.batch.applyTags')}
          </button>
          <button type="button" className={tb.btn} onClick={() => { void doExport(items.filter(item => checkedIds.includes(item.id))) }}>
            {t('topicBank.batch.export')}
          </button>
          <button type="button" className={tb.btn} onClick={() => { setSelectedIds([]) }}>
            {t('topicBank.batch.clear')}
          </button>
        </div>
      )}

      <SplitDetail
        list={
          config.view === 'table' ? (
            <div className={tb.tableWrap}>
              <table className={tb.table}>
                <thead>
                  <tr>
                    <th aria-label={t('topicBank.batch.select')} />
                    <th>{t('topicBank.column.title')}</th>
                    <th>{t('topicBank.column.source')}</th>
                    <th>{t('topicBank.column.score')}</th>
                    <th>{t('topicBank.column.tags')}</th>
                    <th>{t('topicBank.column.status')}</th>
                    <th>{t('topicBank.column.planDate')}</th>
                    <th>{t('topicBank.column.updatedAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(item => (
                    <tr
                      key={item.id}
                      className={clsx(tb.row, item.id === selectedId && tb.rowActive)}
                      onClick={() => { selectItem(item.id) }}
                    >
                      <td onClick={(event) => { event.stopPropagation() }}>
                        <input
                          type="checkbox"
                          aria-label={`${t('topicBank.batch.select')}: ${item.title}`}
                          checked={checkedIds.includes(item.id)}
                          onChange={() => { toggleChecked(item.id) }}
                        />
                      </td>
                      <td className={tb.cellTitle}>
                        <span className={tb.cellTitleText}>{item.title}</span>
                        {item.oneLiner !== null && <span className={tb.cellMeta}>{item.oneLiner}</span>}
                      </td>
                      <td className={tb.cellMuted}>
                        {t(`topic.source.${item.source.type}` as const)}
                        {item.source.url !== null && (
                          <>
                            {' '}
                            <a className={tb.link} href={item.source.url} target="_blank" rel="noreferrer" onClick={(event) => { event.stopPropagation() }}>
                              {t('topicBank.openOriginal')}
                            </a>
                          </>
                        )}
                      </td>
                      <td>{item.score === null ? t('topic.score.none') : formatScore(item.score.total)}</td>
                      <td>{item.tags.map(tag => <span key={tag} className={tb.tag}>{tag}</span>)}</td>
                      <td><span className={tb.pill}>{t(`topic.status.${item.status}` as const)}</span></td>
                      <td className={tb.cellMuted}>{item.planDate ?? '—'}</td>
                      <td className={tb.cellMuted}>{item.updatedAt.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible.length === 0 && <div className={css.libraryState}>{t('topicBank.noMatch')}</div>}
            </div>
          ) : (
            <div>
              <p className={tb.kanbanHint}>{t('topicBank.kanbanHint')}</p>
              <div className={tb.kanban}>
                {groupByStatus(visible).map(({ status, items: columnItems }) => (
                  <div
                    key={status}
                    className={clsx(tb.column, dragOver === status && tb.columnOver)}
                    onDragOver={(event) => { event.preventDefault(); setDragOver(status) }}
                    onDragLeave={() => { setDragOver(current => current === status ? null : current) }}
                    onDrop={() => { void dropTo(status) }}
                  >
                    <div className={tb.columnHead}>
                      <span>{t(`topic.status.${status}` as const)}</span>
                      <span>{columnItems.length}</span>
                    </div>
                    {columnItems.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        draggable
                        className={clsx(tb.card, item.id === selectedId && tb.cardActive)}
                        aria-label={item.title}
                        onDragStart={() => { draggingRef.current = item.id }}
                        onClick={() => { selectItem(item.id) }}
                      >
                        <span className={tb.cardTitle}>{item.title}</span>
                        <span className={tb.cardMeta}>
                          {item.score === null ? t('topic.score.none') : formatScore(item.score.total)}
                          {item.planDate !== null && ` · ${item.planDate}`}
                          {item.tags.length > 0 && ` · ${item.tags.length}`}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )
        }
        detail={
          // SplitDetail owns the region's aria-label; the inner surfaces stay
          // anonymous so the detail pane remains one named region.
          editForm !== false ? (
            <section className={tb.detail}>{editForm}</section>
          ) : selected === undefined ? (
            <section className={tb.detail}><div className={css.libraryState}>{t('topicBank.detail.empty')}</div></section>
          ) : (
            <section className={tb.detail}>
              <div className={tb.detailHead}>
                <h3 className={tb.detailTitle}>{selected.title}</h3>
                <span className={tb.pill}>{t(`topic.status.${selected.status}` as const)}</span>
              </div>
              <p className={tb.detailMeta}>
                {t(`topic.source.${selected.source.type}` as const)}
                {' · '}
                {selected.score === null ? t('topic.score.none') : formatScore(selected.score.total)}
                {' · '}
                {t('topicBank.updatedAt', { date: selected.updatedAt.slice(0, 10) })}
                {selected.planDate !== null && ` · ${t('topicBank.field.planDate')}: ${selected.planDate}`}
              </p>
              <div className={tb.actions}>
                <button
                  type="button"
                  className={tb.primary}
                  onClick={() => {
                    onStartCreate({
                      id: selected.id,
                      title: selected.title,
                      oneLiner: selected.oneLiner,
                      description: selected.description,
                    })
                  }}
                >
                  {t('topicBank.startCreate')}
                </button>
                <button type="button" className={clsx(tb.btn, tb.btnDisabled)} disabled title={t('topicBank.aiPending')}>
                  {t('topicBank.aiOptimize')}
                </button>
                <button type="button" className={tb.btn} onClick={() => { setFormError(null); setForm(editFormOf(selected)) }}>
                  {t('topicBank.edit')}
                </button>
                <button type="button" className={clsx(tb.btn, tb.btnDanger)} onClick={() => { setConfirming(true); setAlsoRemoveSchedule(true) }}>
                  {t('topicBank.delete')}
                </button>
              </div>
              {confirming && (
                <div className={tb.confirmBox} role="alertdialog" aria-label={t('topicBank.confirmDelete')}>
                  <span>{t('topicBank.confirmDelete')}</span>
                  {selected.scheduleItemId !== null && (
                    <label className={tb.checkboxLabel}>
                      <input type="checkbox" checked={alsoRemoveSchedule} onChange={(event) => { setAlsoRemoveSchedule(event.target.checked) }} />
                      {t('topicBank.deleteAlsoSchedule')}
                    </label>
                  )}
                  <div className={tb.formRow}>
                    <button type="button" className={clsx(tb.btn, tb.btnDanger)} onClick={() => { void performDelete() }}>
                      {t('topicBank.deleteConfirm')}
                    </button>
                    <button type="button" className={tb.btn} onClick={() => { setConfirming(false) }}>
                      {t('topicBank.cancel')}
                    </button>
                  </div>
                </div>
              )}
              {selected.oneLiner !== null && (
                <div className={tb.fieldBlock}>
                  <span className={tb.fieldLabel}>{t('topicBank.field.oneLiner')}</span>
                  <p className={tb.fieldValue}>{selected.oneLiner}</p>
                </div>
              )}
              {selected.tags.length > 0 && (
                <div className={tb.fieldBlock}>
                  <span className={tb.fieldLabel}>{t('topicBank.column.tags')}</span>
                  <p className={tb.fieldValue}>{selected.tags.join(' / ')}</p>
                </div>
              )}
              {selected.source.url !== null && (
                <p className={tb.fieldValue}>
                  <a className={tb.link} href={selected.source.url} target="_blank" rel="noreferrer">{t('topicBank.openOriginal')}</a>
                </p>
              )}
              {selected.source.snapshot !== null && (
                <div className={tb.snapshot}>
                  <span className={tb.fieldLabel}>{t('topicBank.snapshotLabel')}</span>
                  <p className={tb.fieldValue}>{selected.source.snapshot.title}</p>
                  <p className={tb.fieldValue}>
                    {selected.source.snapshot.summary ?? t('topicBank.snapshotNoSummary')}
                  </p>
                  <p className={tb.fieldValue}>
                    {t('topicBank.snapshotCaptured', { date: selected.source.snapshot.capturedAt.slice(0, 10) })}
                  </p>
                </div>
              )}
              {selected.description !== null && (
                <div className={tb.fieldBlock}>
                  <span className={tb.fieldLabel}>{t('topicBank.field.description')}</span>
                  <p className={tb.fieldValue}>{selected.description}</p>
                </div>
              )}
              {selected.scheduleItemId !== null && (
                <p className={tb.detailMeta}>{t('topicBank.linkedSchedule')}</p>
              )}
            </section>
          )
        }
        detailLabel={t('topicBank.detail.label')}
      />
    </div>
  )
}
