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
  const [outputs, setOutputs] = useState<ContentOutputsSnapshot | undefined>(undefined)
  const [schedule, setSchedule] = useState<ContentScheduleSnapshot | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [copiedId, setCopiedId] = useState<string | undefined>(undefined)

  const load = useCallback(async (): Promise<void> => {
    setFailed(false)
    try {
      const [o, s] = await Promise.all([listOutputs(), listSchedule()])
      setOutputs(o)
      setSchedule(s)
    } catch {
      setFailed(true)
    }
  }, [listOutputs, listSchedule])
  useEffect(() => { void load() }, [load])

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

  if (failed) return <div className={css.libraryState}>{t('library.error')}</div>

  const projects = outputs?.projects ?? []
  const ready = projects.filter(project => project.status === 'ready').length
  const pending = (schedule?.items ?? []).filter(item => item.status !== 'published').length
  const published = (schedule?.items ?? []).filter(item => item.status === 'published').length
  const recent = [...projects].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 5)
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = (schedule?.items ?? [])
    .filter(item => item.status !== 'published' && item.date >= today)
    .slice(0, 5)
  const allSchedule = schedule?.items ?? []

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
        <StatCard icon={<IconFolderOpenOutline16 size={16} />} value={projects.length} label={t('stat.projects')} />
        <StatCard icon={<IconChecklistOutline14 size={16} />} value={pending} label={t('stat.scheduled')} />
        <StatCard icon={<IconCheckOutline16 size={16} />} value={ready} label={t('stat.ready')} />
        <StatCard icon={<IconGoalOutline16 size={16} />} value={published} label={t('stat.published')} />
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
          {recent.length === 0
            ? <p className={css.panelEmpty}>{t('panel.emptyRecent')}</p>
            : recent.map(project => (
              <div key={project.topic} className={css.listRow}>
                <span className={css.listTitle}>{project.title}</span>
                <span className={css.listMeta}>{t(`status.${project.status}` as const)}</span>
              </div>
            ))}
        </section>
        <section className={css.panel}>
          <header className={css.panelHead}>
            <h2 className={css.panelTitle}><IconChecklistOutline14 size={13} />{t('panel.upcoming')}</h2>
            <button type="button" className={css.panelMore} onClick={() => { onNavigate('calendar') }}>
              {t('nav.calendar')} →
            </button>
          </header>
          {upcoming.length === 0
            ? <p className={css.panelEmpty}>{t('panel.emptyUpcoming')}</p>
            : upcoming.map(item => (
              <div key={item.id} className={css.listRow}>
                <span className={css.listTitle}>{item.title}</span>
                <span className={css.listMeta}>{item.date}</span>
              </div>
            ))}
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
          <div className={css.dataPills}>
            <span className={css.dataPill}>{t('stat.projects')} · {projects.length}</span>
            <span className={css.dataPill}>{t('status.draft')} · {projects.filter(project => project.status === 'draft').length}</span>
            <span className={css.dataPill}>{t('stat.ready')} · {ready}</span>
            <span className={css.dataPill}>{t('stat.published')} · {published}</span>
          </div>
          <p className={css.panelEmpty}>{t('panel.dataHint')}</p>
        </section>
        <section className={css.panel}>
          <header className={css.panelHead}>
            <h2 className={css.panelTitle}><IconChecklistOutline14 size={13} />{t('panel.recentSchedule')}</h2>
            <button type="button" className={css.panelMore} onClick={() => { onNavigate('calendar') }}>
              {t('nav.calendar')} →
            </button>
          </header>
          {allSchedule.length === 0
            ? <p className={css.panelEmpty}>{t('panel.emptyUpcoming')}</p>
            : allSchedule.slice(-5).reverse().map(item => (
              <div key={item.id} className={css.listRow}>
                <span className={css.listTitle}>{item.title}</span>
                <span className={css.listMeta}>{item.date} · {t(`status.${item.status}` as const)}</span>
              </div>
            ))}
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
