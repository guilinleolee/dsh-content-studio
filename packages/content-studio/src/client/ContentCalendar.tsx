/**
 * The calendar view: the scheduling workbench over `_schedule.json` — the
 * month, week, and list faces render the same filtered items, native
 * drag-and-drop rescheduling confirms before writing (a linked topic's plan
 * date rides along), day notes live in the `_calendar.json` sidecar, and the
 * overdue and conflict badges are derived at render time by `calendar.ts`.
 * All state is view-local; the files on disk are the only truth.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { IconPlusOutline16, IconTrashOutline16, IconWarningOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  CalendarNotesSnapshot, ContentScheduleSnapshot, ScheduleItem, ScheduleItemInput,
  ScheduleItemKind, ScheduleItemStatus,
} from '@deepseek-ai/dsh-content-schedule/types'
import type { ContentTopicsSnapshot } from '@deepseek-ai/dsh-content-topics/types'
import {
  DEFAULT_CALENDAR_FILTERS,
  calendarEventsToCsv,
  detectConflicts,
  filterCalendarItems,
  formatDate,
  groupByDate,
  loadCalendarConfig,
  monthGrid,
  overdueOf,
  saveCalendarConfig,
  todayDate,
  weekGrid,
  type CalendarConfig,
  type CalendarDay,
  type CalendarFilters,
  type CalendarViewKind,
} from './calendar.ts'
import { topicInputOf } from './topic-bank.ts'
import type { TopicBankGateway } from './TopicBankView.tsx'
import type { StudioKey } from './locales.ts'
import css from './ContentStudio.module.css'
import cal from './ContentCalendar.module.css'

/** localStorage key of the view/filter configuration (feature-prefixed). */
const CONFIG_KEY = 'dsh-content-studio.calendar.config'

/** How long a toast stays visible before clearing itself. */
const NOTICE_MS = 3000

/** Wire shape of one optional local time. */
const TIME_PATTERN = /^\d{2}:\d{2}$/

/** Status → its dot modifier class. */
const DOT_CLASS: Record<ScheduleItemStatus, string> = {
  idea: css.dotIdea ?? '',
  draft: css.dotDraft ?? '',
  scheduled: css.dotScheduled ?? '',
  published: css.dotPublished ?? '',
}

/** Every stored status, in filter-chip order. */
const STATUS_KEYS: readonly ScheduleItemStatus[] = ['idea', 'draft', 'scheduled', 'published']

/** View face → its tab label. */
const VIEW_KEYS: Record<CalendarViewKind, StudioKey> = {
  month: 'calendar.view.month',
  week: 'calendar.view.week',
  list: 'calendar.view.list',
}

/** Weekday headers, Monday first; rendered through the locale seat. */
const WEEKDAY_KEYS = [
  'weekday.mon', 'weekday.tue', 'weekday.wed', 'weekday.thu', 'weekday.fri', 'weekday.sat', 'weekday.sun',
] as const

/** Injected face of the calendar view: the Remote wrappers. */
export interface ContentCalendarInjected {
  listSchedule: () => Promise<ContentScheduleSnapshot>
  putSchedule: (input: ScheduleItemInput) => Promise<ContentScheduleSnapshot>
  removeSchedule: (id: ScheduleItem['id']) => Promise<ContentScheduleSnapshot>
  /** The day-note sidecar face served by the contentSchedule Remote. */
  notes: {
    list: () => Promise<CalendarNotesSnapshot>
    put: (id: string, text: string) => Promise<CalendarNotesSnapshot>
  }
  /** The topic bank face: the title join and the plan-date round-trip. */
  topics: TopicBankGateway
  /** The authorized asset write backing the CSV export into `<theme>/assets/`. */
  writeExport: (theme: string, file: string, content: string) => Promise<unknown>
  /** Outputs theme names; the first is the CSV export target. */
  listThemes: () => Promise<readonly string[]>
  /** Cross-view navigation; the calendar only jumps to the topic bank. */
  onNavigate: (view: 'topicBank') => void
}

/** Full calendar props: the injected face plus the locale seat. */
export type ContentCalendarProps = ContentCalendarInjected & PropsLocale<'content-studio'>

/** Form state of the inline add form (one open day at a time). */
interface AddForm {
  date: string
  title: string
  platform: string
  time: string
  kind: ScheduleItemKind
  topicDir: string
}

/** A self-clearing toast line. */
interface Notice {
  text: string
  tone: 'ok' | 'warn'
}

/** Open a fresh add form for one day. */
function newForm(date: string): AddForm {
  return { date, title: '', platform: '', time: '', kind: 'event', topicDir: '' }
}

/**
 * Render the scheduling calendar.
 * @param props - the Remote wrappers and the locale seat.
 * @returns the calendar element tree.
 */
export function ContentCalendar({
  listSchedule, putSchedule, removeSchedule, notes, topics, writeExport, listThemes, onNavigate, t,
}: ContentCalendarProps) {
  const [snapshot, setSnapshot] = useState<ContentScheduleSnapshot | undefined>(undefined)
  const [notesSnapshot, setNotesSnapshot] = useState<CalendarNotesSnapshot | undefined>(undefined)
  const [topicsSnapshot, setTopicsSnapshot] = useState<ContentTopicsSnapshot | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })
  const [weekAnchor, setWeekAnchor] = useState<string>(() => todayDate())
  const [config, setConfig] = useState<CalendarConfig>(() => {
    try {
      return loadCalendarConfig(localStorage.getItem(CONFIG_KEY))
    } catch {
      // Storage denied (privacy mode): the view still renders with defaults.
      return loadCalendarConfig(null)
    }
  })
  const [form, setForm] = useState<AddForm | undefined>(undefined)
  const [detailId, setDetailId] = useState<ScheduleItem['id'] | undefined>(undefined)
  const [dragId, setDragId] = useState<ScheduleItem['id'] | undefined>(undefined)
  const [checked, setChecked] = useState<ReadonlySet<ScheduleItem['id']>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<Notice | undefined>(undefined)
  const [exportTheme, setExportTheme] = useState<string | null>(null)

  const showNotice = (text: string, tone: Notice['tone']): void => {
    setNotice({ text, tone })
  }
  useEffect(() => {
    if (notice === undefined) return
    const timer = window.setTimeout(() => { setNotice(undefined) }, NOTICE_MS)
    return () => { window.clearTimeout(timer) }
  }, [notice])

  const load = useCallback(async (): Promise<void> => {
    setFailed(false)
    try {
      const [schedule, dayNotes, bank] = await Promise.all([listSchedule(), notes.list(), topics.list()])
      setSnapshot(schedule)
      setNotesSnapshot(dayNotes)
      setTopicsSnapshot(bank)
    } catch (error) {
      console.error('[content-studio] calendar load failed:', error)
      setFailed(true)
    }
  }, [listSchedule, notes, topics])
  useEffect(() => { void load() }, [load])

  // The first theme directory is the CSV export target; without one the
  // export button explains itself instead of failing at write time.
  useEffect(() => {
    let alive = true
    listThemes().then((names) => {
      if (alive) setExportTheme(names[0] ?? null)
    }).catch(() => {
      // Theme listing failed: export stays disabled with its own hint.
    })
    return () => { alive = false }
  }, [listThemes])

  const patchConfig = (patch: Partial<Omit<CalendarConfig, 'version'>>): void => {
    setConfig((current) => {
      const next = { ...current, ...patch }
      try {
        localStorage.setItem(CONFIG_KEY, saveCalendarConfig(next))
      } catch {
        // Storage denied: the configuration stays session-local.
      }
      return next
    })
  }
  const patchFilters = (patch: Partial<CalendarFilters>): void => {
    patchConfig({ filters: { ...config.filters, ...patch } })
  }

  const today = todayDate()
  const items = snapshot?.items ?? []
  const filtered = useMemo(() => filterCalendarItems(items, config.filters, today), [items, config.filters, today])
  const conflicts = useMemo(() => detectConflicts(items), [items])
  const conflictItems = useMemo(() => items.filter(item => conflicts.has(item.id)), [items, conflicts])
  const byDate = useMemo(() => groupByDate(filtered), [filtered])
  const platforms = useMemo(
    () => [...new Set(items.map(item => item.platform).filter((platform): platform is string => platform !== null))].sort(),
    [items],
  )
  const detail = detailId === undefined ? undefined : items.find(item => item.id === detailId)

  /** Resolve the display title of an item's linked topic, or null. */
  const topicTitleOf = (item: ScheduleItem): string | null => {
    const bank = topicsSnapshot?.items ?? []
    const linked = (item.topic !== null ? bank.find(candidate => candidate.topicDir === item.topic) : undefined)
      ?? bank.find(candidate => candidate.scheduleItemId === item.id)
    return linked?.title ?? null
  }

  const shift = (delta: number): void => {
    if (config.view === 'week') {
      setWeekAnchor((current) => {
        const base = new Date(Number(current.slice(0, 4)), Number(current.slice(5, 7)) - 1, Number(current.slice(8, 10)))
        const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta * 7)
        return formatDate(day.getFullYear(), day.getMonth() + 1, day.getDate())
      })
      return
    }
    setMonth((current) => {
      const zero = current.year * 12 + current.month - 1 + delta
      return { year: Math.floor(zero / 12), month: ((zero % 12) + 12) % 12 + 1 }
    })
  }
  const goToday = (): void => {
    const now = new Date()
    setMonth({ year: now.getFullYear(), month: now.getMonth() + 1 })
    setWeekAnchor(todayDate())
  }

  const submit = async (): Promise<void> => {
    if (form === undefined || form.title.trim().length === 0) return
    setSubmitting(true)
    try {
      setSnapshot(await putSchedule({
        title: form.title,
        date: form.date,
        time: TIME_PATTERN.test(form.time) ? form.time : null,
        platform: form.platform.trim().length > 0 ? form.platform.trim() : null,
        status: 'scheduled',
        kind: form.kind,
        topic: form.topicDir.length > 0 ? form.topicDir : null,
        url: null,
      }))
      setForm(undefined)
    } catch (error) {
      console.error('[content-studio] contentSchedule failed:', error)
      showNotice(t('calendar.action.failed'), 'warn')
    } finally {
      setSubmitting(false)
    }
  }

  const markPublished = async (item: ScheduleItem): Promise<void> => {
    try {
      setSnapshot(await putSchedule({ ...item, status: 'published', url: item.url }))
    } catch (error) {
      console.error('[content-studio] contentSchedule failed:', error)
      showNotice(t('calendar.action.failed'), 'warn')
    }
  }

  /** Confirm, then move one item; the linked topic's plan date rides along. */
  const reschedule = async (item: ScheduleItem, date: string): Promise<void> => {
    if (date === item.date) return
    if (!window.confirm(t('calendar.drag.confirm').replace('{from}', item.date).replace('{to}', date))) return
    try {
      setSnapshot(await putSchedule({ ...item, date }))
    } catch (error) {
      console.error('[content-studio] contentSchedule failed:', error)
      showNotice(t('calendar.drag.failed'), 'warn')
      return
    }
    const topic = topicsSnapshot?.items.find(candidate => candidate.scheduleItemId === item.id)
    if (topic === undefined || topic.planDate === date) return
    try {
      setTopicsSnapshot(await topics.put(topicInputOf(topic, { planDate: date })))
    } catch (error) {
      console.error('[content-studio] contentTopics failed:', error)
      showNotice(t('calendar.drag.topicSyncFailed'), 'warn')
    }
  }

  /** Delete one schedule item; `content` items optionally clear the linked topic's plan date. */
  const removeItem = async (item: ScheduleItem, clearPlan: boolean): Promise<void> => {
    if (!window.confirm(t('calendar.delete.confirm'))) return
    try {
      setSnapshot(await removeSchedule(item.id))
      setDetailId(undefined)
      if (!clearPlan) return
      const topic = topicsSnapshot?.items.find(candidate => candidate.scheduleItemId === item.id)
      if (topic !== undefined && topic.planDate !== null) {
        setTopicsSnapshot(await topics.put(topicInputOf(topic, { planDate: null })))
      }
    } catch (error) {
      console.error('[content-studio] contentSchedule failed:', error)
      showNotice(t('calendar.action.failed'), 'warn')
    }
  }

  const saveNote = async (id: ScheduleItem['id'], text: string): Promise<void> => {
    try {
      setNotesSnapshot(await notes.put(id, text))
      showNotice(t('calendar.note.saved'), 'ok')
    } catch (error) {
      console.error('[content-studio] contentSchedule.putNote failed:', error)
      showNotice(t('calendar.action.failed'), 'warn')
    }
  }

  const batchPublish = async (): Promise<void> => {
    const targets = filtered.filter(item => checked.has(item.id) && item.status !== 'published')
    try {
      let current = snapshot
      for (const item of targets) {
        current = await putSchedule({ ...item, status: 'published', url: item.url })
      }
      if (current !== undefined) setSnapshot(current)
      setChecked(new Set())
      showNotice(t('calendar.batch.done'), 'ok')
    } catch (error) {
      console.error('[content-studio] contentSchedule failed:', error)
      showNotice(t('calendar.action.failed'), 'warn')
      void load()
    }
  }

  const batchRemove = async (): Promise<void> => {
    if (!window.confirm(t('calendar.batchDelete.confirm'))) return
    try {
      let current = snapshot
      for (const id of checked) {
        current = await removeSchedule(id)
      }
      if (current !== undefined) setSnapshot(current)
      setChecked(new Set())
      setDetailId(undefined)
      showNotice(t('calendar.batch.done'), 'ok')
    } catch (error) {
      console.error('[content-studio] contentSchedule failed:', error)
      showNotice(t('calendar.action.failed'), 'warn')
      void load()
    }
  }

  const exportCsv = async (): Promise<void> => {
    if (exportTheme === null) {
      showNotice(t('calendar.export.none'), 'warn')
      return
    }
    try {
      await writeExport(exportTheme, `calendar-export-${today.replaceAll('-', '')}.csv`, calendarEventsToCsv(filtered, notesSnapshot?.notes ?? {}))
      showNotice(t('calendar.export.done').replace('{theme}', exportTheme), 'ok')
    } catch (error) {
      console.error('[content-studio] calendar export failed:', error)
      showNotice(t('calendar.export.failed'), 'warn')
    }
  }

  const toggleInList = <T,>(list: readonly T[], value: T): readonly T[] =>
    list.includes(value) ? list.filter(entry => entry !== value) : [...list, value]

  /** One day cell: the drop target plus its chips and the inline add form. */
  const renderCell = (day: CalendarDay) => {
    const cellItems = byDate.get(day.date) ?? []
    return (
      <div
        key={day.date}
        className={clsx(css.calendarCell, !day.inMonth && css.calendarCellOutside, day.isToday && css.calendarCellToday)}
        role="button"
        tabIndex={0}
        aria-label={day.date}
        onDragOver={(event) => {
          if (dragId !== undefined) event.preventDefault()
        }}
        onDrop={(event) => {
          event.preventDefault()
          const dropped = dragId
          setDragId(undefined)
          const item = dropped === undefined ? undefined : items.find(candidate => candidate.id === dropped)
          if (item !== undefined) void reschedule(item, day.date)
        }}
        onClick={() => { setForm(form?.date === day.date ? undefined : newForm(day.date)) }}
        onKeyDown={(event) => { if (event.key === 'Enter') setForm(form?.date === day.date ? undefined : newForm(day.date)) }}
      >
        <span className={css.calendarDayNum}>{Number(day.date.slice(8, 10))}</span>
        {cellItems.map(item => (
          <span
            key={item.id}
            draggable
            onDragStart={() => { setDragId(item.id) }}
            onDragEnd={() => { setDragId(undefined) }}
            className={clsx(
              css.calendarChip,
              dragId === item.id && cal.chipDragging,
              conflicts.has(item.id) && cal.chipConflict,
              overdueOf(item, today) && cal.chipOverdue,
            )}
            role="button"
            tabIndex={0}
            title={conflicts.has(item.id) ? t('calendar.conflict.hint') : undefined}
            onClick={(event) => { event.stopPropagation(); setDetailId(item.id) }}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); setDetailId(item.id) } }}
          >
            <span className={clsx(css.calendarDot, DOT_CLASS[item.status])} aria-hidden="true" />
            <span className={cal.chipKind} aria-hidden="true">{item.kind === 'content' ? '📄' : '📌'}</span>
            <span className={css.calendarChipTitle}>{item.time !== null && `${item.time} `}{item.title}</span>
            {item.status !== 'published' && (
              <button
                type="button"
                className={css.calendarChipAction}
                aria-label={t('calendar.publish.aria')}
                title={t('calendar.publish')}
                onClick={(event) => { event.stopPropagation(); void markPublished(item) }}
              >
                ✓
              </button>
            )}
            <button
              type="button"
              className={css.calendarChipAction}
              aria-label={t('calendar.remove.aria')}
              onClick={(event) => { event.stopPropagation(); void removeItem(item, false) }}
            >
              <IconTrashOutline16 size={11} />
            </button>
          </span>
        ))}
        {form?.date === day.date && (
          <div className={css.calendarForm} onClick={(event) => { event.stopPropagation() }}>
            <input
              className={css.calendarInput}
              autoFocus
              placeholder={t('calendar.titlePlaceholder')}
              value={form.title}
              onChange={(event) => { setForm({ ...form, title: event.currentTarget.value }) }}
              onKeyDown={(event) => { if (event.key === 'Enter') void submit() }}
            />
            <div className={cal.formRow}>
              <select
                className={cal.formSelect}
                aria-label={t('calendar.filter.kind')}
                value={form.kind}
                onChange={(event) => { setForm({ ...form, kind: event.currentTarget.value as ScheduleItemKind }) }}
              >
                <option value="event">{t('calendar.kind.event')}</option>
                <option value="content">{t('calendar.kind.content')}</option>
              </select>
              <input
                className={css.calendarInput}
                placeholder={t('calendar.timePlaceholder')}
                value={form.time}
                onChange={(event) => { setForm({ ...form, time: event.currentTarget.value }) }}
              />
            </div>
            <div className={cal.formRow}>
              <input
                className={css.calendarInput}
                placeholder={t('calendar.platformPlaceholder')}
                value={form.platform}
                onChange={(event) => { setForm({ ...form, platform: event.currentTarget.value }) }}
              />
              <select
                className={cal.formSelect}
                aria-label={t('calendar.detail.topic')}
                value={form.topicDir}
                onChange={(event) => { setForm({ ...form, topicDir: event.currentTarget.value }) }}
              >
                <option value="">{t('calendar.topicPlaceholder')}</option>
                {(topicsSnapshot?.items ?? []).filter(candidate => candidate.topicDir !== null).map(candidate => (
                  <option key={candidate.id} value={candidate.topicDir ?? ''}>{candidate.title}</option>
                ))}
              </select>
            </div>
            <div className={css.calendarFormRow}>
              <button type="button" className={css.calendarSubmit} disabled={submitting} onClick={() => { void submit() }}>
                <IconPlusOutline16 size={12} />
                {t('calendar.add')}
              </button>
              <button type="button" className={css.calendarChipAction} aria-label={t('calendar.cancel')} onClick={() => { setForm(undefined) }}>
                {t('calendar.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (failed) {
    return <div className={css.libraryState}>{t('library.error')}</div>
  }
  if (snapshot === undefined || notesSnapshot === undefined) {
    return <div className={css.libraryState}>{t('calendar.loading')}</div>
  }

  const grid: CalendarDay[][] = config.view === 'week' ? [weekGrid(weekAnchor)] : monthGrid(month.year, month.month)
  const weekRow = grid[0] ?? []
  const periodLabel = config.view === 'week'
    ? `${weekRow[0]?.date ?? ''} ~ ${weekRow.at(-1)?.date ?? ''}`
    : `${month.year} · ${t(`calendar.month.${month.month}` as StudioKey)}`
  const filters = config.filters

  return (
    <div className={css.calendar}>
      <div className={cal.toolbar}>
        <div className={css.calendarBar}>
          {config.view !== 'list' && (
            <>
              <button type="button" className={css.calendarNav} aria-label={config.view === 'week' ? t('calendar.prevWeek') : t('calendar.prev')} onClick={() => { shift(-1) }}>‹</button>
              <span className={css.calendarMonth}>{periodLabel}</span>
              <button type="button" className={css.calendarNav} aria-label={config.view === 'week' ? t('calendar.nextWeek') : t('calendar.next')} onClick={() => { shift(1) }}>›</button>
            </>
          )}
          <button type="button" className={css.calendarToday} onClick={() => { goToday() }}>
            {t('calendar.today')}
          </button>
        </div>
        <div className={cal.tabs} role="tablist">
          {(['month', 'week', 'list'] as const).map(kind => (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={config.view === kind}
              className={clsx(cal.tab, config.view === kind && cal.tabActive)}
              onClick={() => { patchConfig({ view: kind }) }}
            >
              {t(VIEW_KEYS[kind])}
            </button>
          ))}
        </div>
        <div className={cal.toolbarActions}>
          <button type="button" className={cal.toolButton} disabled={exportTheme === null} title={exportTheme === null ? t('calendar.export.none') : undefined} onClick={() => { void exportCsv() }}>
            {t('calendar.export')}
          </button>
          <button type="button" className={cal.toolButton} disabled title={t('calendar.ai.hint')}>
            {t('calendar.ai')}
          </button>
        </div>
      </div>

      <div className={cal.filters}>
        <select
          className={cal.formSelect}
          aria-label={t('calendar.filter.kind')}
          value={filters.kind}
          onChange={(event) => { patchFilters({ kind: event.currentTarget.value as CalendarFilters['kind'] }) }}
        >
          <option value="all">{t('calendar.kind.all')}</option>
          <option value="content">{t('calendar.kind.content')}</option>
          <option value="event">{t('calendar.kind.event')}</option>
        </select>
        {platforms.map(platform => (
          <button
            key={platform}
            type="button"
            className={clsx(cal.chip, filters.platforms.includes(platform) && cal.chipActive)}
            onClick={() => { patchFilters({ platforms: toggleInList(filters.platforms, platform) }) }}
          >
            {platform}
          </button>
        ))}
        {STATUS_KEYS.map(status => (
          <button
            key={status}
            type="button"
            className={clsx(cal.chip, filters.statuses.includes(status) && cal.chipActive)}
            onClick={() => { patchFilters({ statuses: toggleInList(filters.statuses, status) }) }}
          >
            <span className={clsx(css.calendarDot, DOT_CLASS[status])} aria-hidden="true" />
            {t(`calendar.status.${status}`)}
          </button>
        ))}
        <input
          type="date"
          className={cal.formSelect}
          aria-label={t('calendar.filter.range')}
          value={filters.start ?? ''}
          onChange={(event) => { patchFilters({ start: event.currentTarget.value === '' ? null : event.currentTarget.value }) }}
        />
        <input
          type="date"
          className={cal.formSelect}
          aria-label={t('calendar.filter.range')}
          value={filters.end ?? ''}
          onChange={(event) => { patchFilters({ end: event.currentTarget.value === '' ? null : event.currentTarget.value }) }}
        />
        <input
          type="search"
          className={cal.formSelect}
          aria-label={t('calendar.filter.query.aria')}
          placeholder={t('calendar.filter.query.aria')}
          value={filters.query}
          onChange={(event) => { patchFilters({ query: event.currentTarget.value }) }}
        />
        <button
          type="button"
          className={clsx(cal.chip, filters.overdueOnly && cal.chipOverdueActive)}
          onClick={() => { patchFilters({ overdueOnly: !filters.overdueOnly }) }}
        >
          {t('calendar.filter.overdue')}
        </button>
        {(filters.kind !== 'all' || filters.platforms.length > 0 || filters.statuses.length > 0
          || filters.start !== null || filters.end !== null || filters.query !== '' || filters.overdueOnly) && (
          <button type="button" className={cal.chip} onClick={() => { patchFilters({ ...DEFAULT_CALENDAR_FILTERS }) }}>
            {t('calendar.filters.clear')}
          </button>
        )}
      </div>

      {conflictItems.length > 0 && (
        <div className={cal.conflicts} role="status">
          <IconWarningOutline16 size={14} />
          <span>{t('calendar.conflicts')}（{conflictItems.length}）</span>
          {conflictItems.map(item => (
            <button key={item.id} type="button" className={cal.chip} onClick={() => { setDetailId(item.id) }}>
              {item.date} {item.time !== null && `${item.time} `}{item.title}
            </button>
          ))}
        </div>
      )}

      {config.view === 'list' ? (
        <div className={cal.listWrap}>
          <div className={cal.listHead}>
            <label className={cal.listCheck}>
              <input
                type="checkbox"
                aria-label={t('calendar.list.all')}
                checked={filtered.length > 0 && filtered.every(item => checked.has(item.id))}
                onChange={(event) => {
                  setChecked(event.currentTarget.checked ? new Set(filtered.map(item => item.id)) : new Set())
                }}
              />
            </label>
            <span>{t('calendar.detail.date')}</span>
            <span>{t('calendar.detail.time')}</span>
            <span>{t('calendar.filter.kind')}</span>
            <span>{t('calendar.filter.status')}</span>
            <span>{t('calendar.list.title')}</span>
            <span>{t('calendar.detail.platform')}</span>
            <span>{t('calendar.detail.topic')}</span>
          </div>
          {filtered.map((item) => {
            const topicTitle = topicTitleOf(item)
            return (
              <div
                key={item.id}
                className={clsx(cal.listRow, detailId === item.id && cal.listRowActive)}
                role="button"
                tabIndex={0}
                onClick={() => { setDetailId(item.id) }}
                onKeyDown={(event) => { if (event.key === 'Enter') setDetailId(item.id) }}
              >
                <label className={cal.listCheck} onClick={(event) => { event.stopPropagation() }}>
                  <input
                    type="checkbox"
                    checked={checked.has(item.id)}
                    onChange={(event) => {
                      const next = new Set(checked)
                      if (event.currentTarget.checked) next.add(item.id)
                      else next.delete(item.id)
                      setChecked(next)
                    }}
                  />
                </label>
                <span>{overdueOf(item, today) ? `${item.date} · ${t('calendar.overdue')}` : item.date}</span>
                <span>{item.time ?? ''}</span>
                <span>{item.kind === 'content' ? t('calendar.kind.content') : t('calendar.kind.event')}</span>
                <span className={cal.listStatus}>
                  <span className={clsx(css.calendarDot, DOT_CLASS[item.status])} aria-hidden="true" />
                  {t(`calendar.status.${item.status}`)}
                </span>
                <span className={cal.listTitle}>{item.title}</span>
                <span>{item.platform ?? ''}</span>
                <span>{topicTitle ?? item.topic ?? ''}</span>
              </div>
            )
          })}
          {filtered.length === 0 && <div className={css.calendarHint}>{t('calendar.empty')}</div>}
          {checked.size > 0 && (
            <div className={cal.batchBar}>
              <button type="button" className={cal.toolButton} onClick={() => { void batchPublish() }}>
                {t('calendar.batch.publish')}
              </button>
              <button type="button" className={cal.toolButtonDanger} onClick={() => { void batchRemove() }}>
                {t('calendar.batch.remove')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className={css.calendarHead}>
            {WEEKDAY_KEYS.map(key => <span key={key} className={css.calendarWeekday}>{t(key)}</span>)}
          </div>
          <div className={clsx(css.calendarGrid, config.view === 'week' && cal.weekGrid)}>
            {grid.flat().map(renderCell)}
          </div>
          {form === undefined && items.length === 0 && (
            <div className={css.calendarHint}>{t('calendar.empty')}</div>
          )}
        </>
      )}

      {detail !== undefined && (
        <section className={cal.detail} aria-label={t('calendar.detail.title')}>
          <div className={cal.detailHead}>
            <strong>{detail.title}</strong>
            <button type="button" className={css.calendarChipAction} aria-label={t('calendar.cancel')} onClick={() => { setDetailId(undefined) }}>×</button>
          </div>
          <dl className={cal.detailGrid}>
            <dt>{t('calendar.detail.date')}</dt>
            <dd>{detail.date}{overdueOf(detail, today) ? ` · ${t('calendar.overdue')}` : ''}</dd>
            <dt>{t('calendar.detail.time')}</dt>
            <dd>{detail.time ?? '—'}</dd>
            <dt>{t('calendar.filter.kind')}</dt>
            <dd>{detail.kind === 'content' ? t('calendar.kind.content') : t('calendar.kind.event')}</dd>
            <dt>{t('calendar.filter.status')}</dt>
            <dd className={cal.listStatus}>
              <span className={clsx(css.calendarDot, DOT_CLASS[detail.status])} aria-hidden="true" />
              {t(`calendar.status.${detail.status}`)}
            </dd>
            <dt>{t('calendar.detail.platform')}</dt>
            <dd>{detail.platform ?? '—'}</dd>
            <dt>{t('calendar.detail.topic')}</dt>
            <dd>{topicTitleOf(detail) ?? detail.topic ?? '—'}</dd>
          </dl>
          <NoteEditor key={detail.id} initial={notesSnapshot.notes[detail.id]?.text ?? ''} onSave={text => saveNote(detail.id, text)} t={t} />
          <div className={cal.detailActions}>
            {detail.status !== 'published' && (
              <button type="button" className={cal.toolButton} onClick={() => { void markPublished(detail) }}>
                {t('calendar.publish')}
              </button>
            )}
            <button type="button" className={cal.toolButton} onClick={() => { onNavigate('topicBank') }}>
              {t('calendar.jump.topicBank')}
            </button>
            <button type="button" className={cal.toolButtonDanger} onClick={() => { void removeItem(detail, false) }}>
              <IconTrashOutline16 size={12} />
              {t('calendar.delete')}
            </button>
            {detail.kind === 'content' && (
              <button type="button" className={cal.toolButtonDanger} onClick={() => { void removeItem(detail, true) }}>
                {t('calendar.delete.clearPlan')}
              </button>
            )}
          </div>
        </section>
      )}

      {notice !== undefined && (
        <div className={clsx(cal.toast, notice.tone === 'warn' && cal.toastWarn)} role="status">
          {notice.text}
        </div>
      )}
    </div>
  )
}

/** Props of the inline note editor inside the detail panel. */
interface NoteEditorProps {
  /** The stored note body, or an empty string. */
  initial: string
  /** Persist the draft; the parent owns the write and its feedback. */
  onSave: (text: string) => Promise<void>
  /** The locale seat. */
  t: PropsLocale<'content-studio'>['t']
}

/**
 * Render the note draft editor; the draft resets per item through the key.
 * @param props - the stored text, the save callback, and the locale seat.
 * @returns the note editor element tree.
 */
function NoteEditor({ initial, onSave, t }: NoteEditorProps) {
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  return (
    <div className={cal.noteArea}>
      <textarea
        className={cal.noteInput}
        rows={3}
        placeholder={t('calendar.note.placeholder')}
        value={draft}
        onChange={(event) => { setDraft(event.currentTarget.value) }}
      />
      <button
        type="button"
        className={cal.toolButton}
        disabled={saving || draft.trim() === initial.trim()}
        onClick={() => {
          void (async () => {
            setSaving(true)
            try {
              await onSave(draft)
            } finally {
              setSaving(false)
            }
          })()
        }}
      >
        {t('calendar.note.save')}
      </button>
    </div>
  )
}
