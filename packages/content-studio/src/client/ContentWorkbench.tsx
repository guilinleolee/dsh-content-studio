/**
 * The workbench home (Easel-style dashboard): greeting, icon verb chips
 * (navigate or copy a capability instruction), four stat cards with tinted
 * icon tiles, and a 3+2 panel grid — quick-create rows, recent outputs,
 * upcoming schedule, and a creation-data breakdown — each panel hopping to
 * its full view.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import {
  IconCheckOutline16, IconChecklistOutline14, IconEditOutline16, IconFolderOpenOutline16,
  IconGoalOutline16, IconNewChatOutline16, IconSparkle16, writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ContentOutputsSnapshot } from '@deepseek-ai/dsh-content-outputs/types'
import type { ContentScheduleSnapshot } from '@deepseek-ai/dsh-content-schedule/types'
import type { CapabilityItem } from './capabilities.ts'
import { CAPABILITY_ITEMS } from './capabilities.ts'
import type { StudioKey } from './locales.ts'
import css from './ContentStudio.module.css'

/** Injected face of the workbench home: the two Remote read wrappers. */
export interface ContentWorkbenchInjected {
  listOutputs: () => Promise<ContentOutputsSnapshot>
  listSchedule: () => Promise<ContentScheduleSnapshot>
}

/** Full props: the injected face, view navigation/chat, and the locale seat. */
export type ContentWorkbenchProps = ContentWorkbenchInjected & {
  onNavigate: (view: 'create' | 'library' | 'calendar') => void
  onChat: () => void
} & PropsLocale<'content-studio'>

/** Quick-create panel rows: these capability ids, in this order. */
const QUICK_IDS: readonly CapabilityItem['id'][] = ['social-card', 'gzh-article', 'short-script', 'multi-platform', 'pre-publish']

/** How long a row shows its copied state before reverting. */
const COPIED_FEEDBACK_MS = 1600

/** Per-source load state: one failing Remote never blanks the whole home. */
type Load<T> = { state: 'loading' } | { state: 'ok'; value: T } | { state: 'failed'; detail: string }

/** Greeting bucket by hour of day. */
function greetKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
}

/** Find one capability by id (the catalog is static, ids are pinned by test). */
function cap(id: CapabilityItem['id']): CapabilityItem {
  const found = CAPABILITY_ITEMS.find(item => item.id === id)
  if (found === undefined) throw new Error(`unknown capability id: ${id}`)
  return found
}

/**
 * Render the workbench home.
 * @param props - the Remote read wrappers, view navigation, and the locale seat.
 * @returns the dashboard element tree.
 */
export function ContentWorkbench({ listOutputs, listSchedule, onNavigate, onChat, t }: ContentWorkbenchProps) {
  const [outputs, setOutputs] = useState<Load<ContentOutputsSnapshot>>({ state: 'loading' })
  const [schedule, setSchedule] = useState<Load<ContentScheduleSnapshot>>({ state: 'loading' })
  const [copiedId, setCopiedId] = useState<string | undefined>(undefined)

  const loadOutputs = useCallback(async (): Promise<void> => {
    setOutputs({ state: 'loading' })
    try {
      setOutputs({ state: 'ok', value: await listOutputs() })
    } catch (error) {
      console.error('[content-studio] contentOutputs/list failed:', error)
      setOutputs({ state: 'failed', detail: error instanceof Error ? error.message : String(error) })
    }
  }, [listOutputs])
  const loadSchedule = useCallback(async (): Promise<void> => {
    setSchedule({ state: 'loading' })
    try {
      setSchedule({ state: 'ok', value: await listSchedule() })
    } catch (error) {
      console.error('[content-studio] contentSchedule/list failed:', error)
      setSchedule({ state: 'failed', detail: error instanceof Error ? error.message : String(error) })
    }
  }, [listSchedule])
  useEffect(() => { void loadOutputs() }, [loadOutputs])
  useEffect(() => { void loadSchedule() }, [loadSchedule])

  useEffect(() => {
    if (copiedId === undefined) return
    const timer = window.setTimeout(() => { setCopiedId(undefined) }, COPIED_FEEDBACK_MS)
    return () => { window.clearTimeout(timer) }
  }, [copiedId])

  const quick = useMemo(
    () => QUICK_IDS.map(id => cap(id)),
    [],
  )

  const pick = async (item: CapabilityItem): Promise<void> => {
    if (await writeClipboard(item.prompt)) setCopiedId(item.id)
  }

  if (outputs.state === 'failed') console.warn('[content-studio] outputs panel degraded:', outputs.detail)
  if (schedule.state === 'failed') console.warn('[content-studio] schedule panel degraded:', schedule.detail)

  const projects = outputs.state === 'ok' ? outputs.value.projects : []
  const ready = projects.filter(project => project.status === 'ready').length
  const items = schedule.state === 'ok' ? schedule.value.items : []
  const pending = items.filter(item => item.status !== 'published').length
  const published = items.filter(item => item.status === 'published').length
  const recent = [...projects].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 5)
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = items
    .filter(item => item.status !== 'published' && item.date >= today)
    .slice(0, 5)
  const allSchedule = items

  /** Loading / failed seat for a panel fed by one Remote. */
  const panelState = (load: Load<unknown>, retry: () => void): React.ReactNode => {
    if (load.state === 'loading') return <p className={css.panelEmpty}>{t('library.loading')}</p>
    if (load.state === 'failed') {
      return (
        <div className={css.libraryState}>
          <span>{t('library.error')}: {load.detail}</span>
          <button type="button" className={css.retry} onClick={retry}>{t('library.retry')}</button>
        </div>
      )
    }
    return undefined
  }

  return (
    <div className={css.workbench}>
      <div className={css.helloRow}>
        <h1 className={css.hello}>{t(`greet.${greetKey(new Date().getHours())}`)} 👋</h1>
        <p className={css.helloSub}>{t('workbench.subtitle')}</p>
      </div>

      <div className={css.quickRow}>
        <button type="button" className={css.chip} onClick={onChat}>
          <IconNewChatOutline16 size={14} />
          {t('action.chat')}
        </button>
        <button type="button" className={css.chip} onClick={() => { onNavigate('create') }}>
          <IconSparkle16 size={14} />
          {t('nav.create')}
        </button>
        <button type="button" className={css.chip} onClick={() => { onNavigate('calendar') }}>
          <IconChecklistOutline14 size={14} />
          {t('action.schedule')}
        </button>
        <button
          type="button"
          className={clsx(css.chip, copiedId === 'social-card' && css.chipCopied)}
          onClick={() => { void pick(cap('social-card')) }}
        >
          <IconEditOutline16 size={14} />
          {copiedId === 'social-card' ? t('card.copied') : t('cap.social-card.title')}
        </button>
        <button
          type="button"
          className={clsx(css.chip, copiedId === 'pre-publish' && css.chipCopied)}
          onClick={() => { void pick(cap('pre-publish')) }}
        >
          <IconCheckOutline16 size={14} />
          {copiedId === 'pre-publish' ? t('card.copied') : t('cap.pre-publish.title')}
        </button>
      </div>

      <div className={css.statRow}>
        <StatCard icon={<IconFolderOpenOutline16 size={16} />} value={outputs.state === 'ok' ? projects.length : undefined} label={t('stat.projects')} />
        <StatCard icon={<IconChecklistOutline14 size={16} />} value={schedule.state === 'ok' ? pending : undefined} label={t('stat.scheduled')} />
        <StatCard icon={<IconCheckOutline16 size={16} />} value={outputs.state === 'ok' ? ready : undefined} label={t('stat.ready')} />
        <StatCard icon={<IconGoalOutline16 size={16} />} value={schedule.state === 'ok' ? published : undefined} label={t('stat.published')} />
      </div>

      <div className={css.panelRowThree}>
        <section className={css.panel}>
          <header className={css.panelHead}>
            <h2 className={css.panelTitle}><IconSparkle16 size={13} />{t('panel.quickCreate')}</h2>
            <button type="button" className={css.panelMore} onClick={() => { onNavigate('create') }}>
              {t('nav.create')} →
            </button>
          </header>
          {quick.map(item => (
            <button
              key={item.id}
              type="button"
              className={clsx(css.listRowButton, copiedId === item.id && css.listRowCopied)}
              onClick={() => { void pick(item) }}
            >
              <span className={css.listTitle}>{copiedId === item.id ? t('card.copied') : t(`cap.${item.id}.title` as StudioKey)}</span>
              <span className={css.listMeta}>{copiedId === item.id ? '' : t('card.copyHint')}</span>
            </button>
          ))}
        </section>
        <section className={css.panel}>
          <header className={css.panelHead}>
            <h2 className={css.panelTitle}><IconFolderOpenOutline16 size={13} />{t('panel.recent')}</h2>
            <button type="button" className={css.panelMore} onClick={() => { onNavigate('library') }}>
              {t('nav.library')} →
            </button>
          </header>
          {panelState(outputs, () => { void loadOutputs() })
            ?? (recent.length === 0
              ? <p className={css.panelEmpty}>{t('panel.emptyRecent')}</p>
              : recent.map(project => (
                <div key={project.topic} className={css.listRow}>
                  <span className={css.listTitle}>{project.title}</span>
                  <span className={css.listMeta}>{t(`status.${project.status}` )}</span>
                </div>
              )))}
        </section>
        <section className={css.panel}>
          <header className={css.panelHead}>
            <h2 className={css.panelTitle}><IconChecklistOutline14 size={13} />{t('panel.upcoming')}</h2>
            <button type="button" className={css.panelMore} onClick={() => { onNavigate('calendar') }}>
              {t('nav.calendar')} →
            </button>
          </header>
          {panelState(schedule, () => { void loadSchedule() })
            ?? (upcoming.length === 0
              ? <p className={css.panelEmpty}>{t('panel.emptyUpcoming')}</p>
              : upcoming.map(item => (
                <div key={item.id} className={css.listRow}>
                  <span className={css.listTitle}>{item.title}</span>
                  <span className={css.listMeta}>{item.date}</span>
                </div>
              )))}
        </section>
      </div>

      <div className={css.panelRowTwo}>
        <section className={css.panel}>
          <header className={css.panelHead}>
            <h2 className={css.panelTitle}><IconGoalOutline16 size={13} />{t('panel.data')}</h2>
            <button type="button" className={css.panelMore} onClick={() => { onNavigate('library') }}>
              {t('nav.library')} →
            </button>
          </header>
          {outputs.state === 'ok'
            ? (
              <>
                <div className={css.dataPills}>
                  <span className={css.dataPill}>{t('stat.projects')} · {projects.length}</span>
                  <span className={css.dataPill}>{t('status.draft')} · {projects.filter(project => project.status === 'draft').length}</span>
                  <span className={css.dataPill}>{t('stat.ready')} · {ready}</span>
                  <span className={css.dataPill}>{t('stat.published')} · {published}</span>
                </div>
                <p className={css.panelEmpty}>{t('panel.dataHint')}</p>
              </>
            )
            : panelState(outputs, () => { void loadOutputs() })}
        </section>
        <section className={css.panel}>
          <header className={css.panelHead}>
            <h2 className={css.panelTitle}><IconChecklistOutline14 size={13} />{t('panel.recentSchedule')}</h2>
            <button type="button" className={css.panelMore} onClick={() => { onNavigate('calendar') }}>
              {t('nav.calendar')} →
            </button>
          </header>
          {schedule.state === 'ok'
            ? (
              allSchedule.length === 0
                ? <p className={css.panelEmpty}>{t('panel.emptyUpcoming')}</p>
                : allSchedule.slice(-5).reverse().map(item => (
                  <div key={item.id} className={css.listRow}>
                    <span className={css.listTitle}>{item.title}</span>
                    <span className={css.listMeta}>{item.date} · {t(`status.${item.status}` )}</span>
                  </div>
                ))
            )
            : panelState(schedule, () => { void loadSchedule() })}
        </section>
      </div>
    </div>
  )
}

/** One stat card with a tinted icon tile over the value and label. */
function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number | undefined; label: string }) {
  return (
    <div className={css.statCard}>
      <span className={css.statIcon}>{icon}</span>
      <span className={css.statValue}>{value === undefined ? '—' : String(value)}</span>
      <span className={css.statLabel}>{label}</span>
    </div>
  )
}
