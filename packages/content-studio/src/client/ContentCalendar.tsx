/**
 * The calendar view: one month grid over the publication calendar, read and
 * mutated through the injected `contentSchedule` wrappers. Clicking a day
 * opens an inline add form; each item chip offers mark-published and remove.
 * All state is view-local — the file on disk is the only truth.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { IconPlusOutline16, IconTrashOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ContentScheduleSnapshot, ScheduleItem, ScheduleItemInput, ScheduleItemStatus } from '@deepseek-ai/dsh-content-schedule/types'
import { groupByDate, monthGrid, type CalendarDay } from './calendar.ts'
import type { StudioKey } from './locales.ts'
import css from './ContentStudio.module.css'

/** Injected face of the calendar view: the Remote wrappers. */
export interface ContentCalendarInjected {
  listSchedule: () => Promise<ContentScheduleSnapshot>
  putSchedule: (input: ScheduleItemInput) => Promise<ContentScheduleSnapshot>
  removeSchedule: (id: ScheduleItem['id']) => Promise<ContentScheduleSnapshot>
}

/** Full calendar props: the injected face plus the locale seat. */
export type ContentCalendarProps = ContentCalendarInjected & PropsLocale<'content-studio'>

/** Weekday headers, Monday first; rendered through the locale seat. */
const WEEKDAY_KEYS = [
  'weekday.mon', 'weekday.tue', 'weekday.wed', 'weekday.thu', 'weekday.fri', 'weekday.sat', 'weekday.sun',
] as const

/** Status → its dot modifier class. */
const DOT_CLASS: Record<ScheduleItemStatus, string> = {
  idea: css.dotIdea ?? '',
  draft: css.dotDraft ?? '',
  scheduled: css.dotScheduled ?? '',
  published: css.dotPublished ?? '',
}

/** Form state of the inline add form (one open day at a time). */
interface AddForm {
  date: string
  title: string
  platform: string
}

/**
 * Render the publication calendar.
 * @param props - the Remote wrappers and the locale seat.
 * @returns the calendar element tree.
 */
export function ContentCalendar({ listSchedule, putSchedule, removeSchedule, t }: ContentCalendarProps) {
  const [snapshot, setSnapshot] = useState<ContentScheduleSnapshot | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })
  const [form, setForm] = useState<AddForm | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setFailed(false)
    try {
      setSnapshot(await listSchedule())
    } catch {
      setFailed(true)
    }
  }, [listSchedule])
  useEffect(() => { void load() }, [load])

  const grid = useMemo(() => monthGrid(month.year, month.month), [month])
  const byDate = useMemo(() => groupByDate(snapshot?.items ?? []), [snapshot])

  const shiftMonth = (delta: number): void => {
    setMonth((current) => {
      const zero = current.year * 12 + current.month - 1 + delta
      return { year: Math.floor(zero / 12), month: ((zero % 12) + 12) % 12 + 1 }
    })
  }

  const submit = async (): Promise<void> => {
    if (form === undefined || form.title.trim().length === 0) return
    setSubmitting(true)
    try {
      setSnapshot(await putSchedule({
        title: form.title,
        date: form.date,
        time: null,
        platform: form.platform.trim().length > 0 ? form.platform.trim() : null,
        status: 'scheduled',
        kind: 'content',
        topic: null,
        url: null,
      }))
      setForm(undefined)
    } catch {
      setFailed(true)
    } finally {
      setSubmitting(false)
    }
  }

  const markPublished = async (item: ScheduleItem): Promise<void> => {
    try {
      setSnapshot(await putSchedule({ ...item, status: 'published', url: item.url }))
    } catch {
      setFailed(true)
    }
  }

  const remove = async (id: ScheduleItem['id']): Promise<void> => {
    try {
      setSnapshot(await removeSchedule(id))
    } catch {
      setFailed(true)
    }
  }

  if (failed) {
    return <div className={css.libraryState}>{t('library.error')}</div>
  }
  if (snapshot === undefined) {
    return <div className={css.libraryState}>{t('calendar.loading')}</div>
  }

  return (
    <div className={css.calendar}>
      <div className={css.calendarBar}>
        <button type="button" className={css.calendarNav} aria-label={t('calendar.prev')} onClick={() => { shiftMonth(-1) }}>‹</button>
        <span className={css.calendarMonth}>{month.year} · {t(`calendar.month.${month.month}` as StudioKey)}</span>
        <button type="button" className={css.calendarNav} aria-label={t('calendar.next')} onClick={() => { shiftMonth(1) }}>›</button>
        <button
          type="button"
          className={css.calendarToday}
          onClick={() => {
            const now = new Date()
            setMonth({ year: now.getFullYear(), month: now.getMonth() + 1 })
          }}
        >
          {t('calendar.today')}
        </button>
      </div>

      <div className={css.calendarHead}>
        {WEEKDAY_KEYS.map(key => <span key={key} className={css.calendarWeekday}>{t(key)}</span>)}
      </div>

      <div className={css.calendarGrid}>
        {grid.flat().map((day: CalendarDay) => {
          const items = byDate.get(day.date) ?? []
          return (
            <div
              key={day.date}
              className={clsx(css.calendarCell, !day.inMonth && css.calendarCellOutside, day.isToday && css.calendarCellToday)}
              role="button"
              tabIndex={0}
              aria-label={day.date}
              onClick={() => { setForm(form?.date === day.date ? undefined : { date: day.date, title: '', platform: '' }) }}
              onKeyDown={(event) => { if (event.key === 'Enter') setForm(form?.date === day.date ? undefined : { date: day.date, title: '', platform: '' }) }}
            >
              <span className={css.calendarDayNum}>{Number(day.date.slice(8, 10))}</span>
              {items.map(item => (
                <span
                  key={item.id}
                  className={css.calendarChip}
                  onClick={(event) => { event.stopPropagation() }}
                >
                  <span className={clsx(css.calendarDot, DOT_CLASS[item.status])} aria-hidden="true" />
                  <span className={css.calendarChipTitle}>{item.time !== null && `${item.time} `}{item.title}</span>
                  {item.status !== 'published' && (
                    <button
                      type="button"
                      className={css.calendarChipAction}
                      aria-label={t('calendar.publish.aria')}
                      title={t('calendar.publish')}
                      onClick={() => { void markPublished(item) }}
                    >
                      ✓
                    </button>
                  )}
                  <button
                    type="button"
                    className={css.calendarChipAction}
                    aria-label={t('calendar.remove.aria')}
                    onClick={() => { void remove(item.id) }}
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
                  <input
                    className={css.calendarInput}
                    placeholder={t('calendar.platformPlaceholder')}
                    value={form.platform}
                    onChange={(event) => { setForm({ ...form, platform: event.currentTarget.value }) }}
                  />
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
        })}
      </div>

      {form === undefined && snapshot.items.length === 0 && (
        <div className={css.calendarHint}>{t('calendar.empty')}</div>
      )}
    </div>
  )
}
