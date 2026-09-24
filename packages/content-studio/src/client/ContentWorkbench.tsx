/**
 * The workbench home (Easel-style dashboard): greeting, quick capability
 * chips (pick = copy instruction), four stat cards derived from the outputs
 * library and the publication calendar, and two panels — recent outputs and
 * upcoming schedule — each hopping to its full view.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
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

/** Full props: the injected face, view navigation, and the locale seat. */
export type ContentWorkbenchProps = ContentWorkbenchInjected & {
  onNavigate: (view: 'create' | 'library' | 'calendar') => void
} & PropsLocale<'content-studio'>

/** Quick chips surface these capability ids, in this order. */
const QUICK_IDS: readonly CapabilityItem['id'][] = ['social-card', 'gzh-article', 'short-script', 'multi-platform']

/** How long a chip shows its copied state before reverting. */
const COPIED_FEEDBACK_MS = 1600

/** Greeting bucket by hour of day. */
function greetKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
}

/**
 * Render the workbench home.
 * @param props - the Remote read wrappers, view navigation, and the locale seat.
 * @returns the dashboard element tree.
 */
export function ContentWorkbench({ listOutputs, listSchedule, onNavigate, t }: ContentWorkbenchProps) {
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
    () => QUICK_IDS.map(id => CAPABILITY_ITEMS.find(item => item.id === id)).filter(item => item !== undefined),
    [],
  )

  const pick = async (item: CapabilityItem): Promise<void> => {
    if (await writeClipboard(item.prompt)) setCopiedId(item.id)
  }

  if (failed) return <div className={css.libraryState}>{t('library.error')}</div>

  const ready = outputs?.projects.filter(project => project.status === 'ready').length ?? 0
  const pending = schedule?.items.filter(item => item.status !== 'published').length ?? 0
  const published = schedule?.items.filter(item => item.status === 'published').length ?? 0
  const recent = [...(outputs?.projects ?? [])]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 4)
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = (schedule?.items ?? [])
    .filter(item => item.status !== 'published' && item.date >= today)
    .slice(0, 4)

  return (
    <div className={css.workbench}>
      <div className={css.helloRow}>
        <h1 className={css.hello}>{t(`greet.${greetKey(new Date().getHours())}`)} 👋</h1>
        <p className={css.helloSub}>{t('workbench.subtitle')}</p>
      </div>

      <div className={css.quickRow}>
        {quick.map(item => (
          <button
            key={item.id}
            type="button"
            className={clsx(css.chip, copiedId === item.id && css.chipCopied)}
            onClick={() => { void pick(item) }}
          >
            {copiedId === item.id ? t('card.copied') : t(`cap.${item.id}.title` as StudioKey)}
          </button>
        ))}
      </div>

      <div className={css.statRow}>
        <StatCard value={outputs?.projects.length} label={t('stat.projects')} />
        <StatCard value={ready} label={t('stat.ready')} />
        <StatCard value={pending} label={t('stat.scheduled')} />
        <StatCard value={published} label={t('stat.published')} />
      </div>

      <div className={css.panelRow}>
        <section className={css.panel}>
          <header className={css.panelHead}>
            <h2 className={css.panelTitle}>{t('panel.recent')}</h2>
            <button type="button" className={css.panelMore} onClick={() => { onNavigate('library') }}>
              {t('panel.viewAll')} →
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
            <h2 className={css.panelTitle}>{t('panel.upcoming')}</h2>
            <button type="button" className={css.panelMore} onClick={() => { onNavigate('calendar') }}>
              {t('panel.viewAll')} →
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
    </div>
  )
}

/** One stat card; the value shows an em dash while its snapshot loads. */
function StatCard({ value, label }: { value: number | undefined; label: string }) {
  return (
    <div className={css.statCard}>
      <span className={css.statValue}>{value === undefined ? '—' : String(value)}</span>
      <span className={css.statLabel}>{label}</span>
    </div>
  )
}
