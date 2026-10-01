/**
 * The workbench home (Easel-style dashboard): greeting, verb chips and the
 * five quick-create entries, eight stat cards over four Remotes (outputs,
 * schedule, topics, interactions) plus a per-theme review digest, and a
 * 2×3 panel grid — quick-create rows, recent topics, recent deliverables,
 * the merged activity/reminders feed, and the reads/likes preview. Each
 * panel hops to its full view; one failing Remote never blanks the home.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import {
  IconCheckOutline16, IconChecklistOutline14, IconEditOutline16, IconFolderOpenOutline16,
  IconGoalOutline16, IconNewChatOutline16, IconSparkle16, writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ContentOutputsSnapshot, InteractionsManifestRead, InteractionSummary, ReviewManifestRead,
} from '@deepseek-ai/dsh-content-outputs/types'
import type { ContentScheduleSnapshot } from '@deepseek-ai/dsh-content-schedule/types'
import type { ContentTopicsSnapshot } from '@deepseek-ai/dsh-content-topics/types'
import type { CapabilityItem } from './capabilities.ts'
import { CAPABILITY_ITEMS } from './capabilities.ts'
import type { StudioKey } from './locales.ts'
import css from './ContentStudio.module.css'

/** Injected face of the workbench home: the Remote read wrappers it aggregates. */
export interface ContentWorkbenchInjected {
  listOutputs: () => Promise<ContentOutputsSnapshot>
  listSchedule: () => Promise<ContentScheduleSnapshot>
  /** The topic bank: topic stats and the recent-topics panel. */
  listTopics: () => Promise<ContentTopicsSnapshot>
  /** The interaction inbox manifest: the pending-reply counts and feed entries. */
  readInteractions: () => Promise<InteractionsManifestRead>
  /** One theme's review manifest; the data preview aggregates across themes. */
  readReviewManifest: (theme: string) => Promise<ReviewManifestRead>
}

/** Every view the home can hop to. */
export type WorkbenchView =
  | 'create' | 'library' | 'calendar' | 'topicBank' | 'gather'
  | 'competitors' | 'persona' | 'publish' | 'review' | 'interaction'

/** Full props: the injected face, view navigation/chat, and the locale seat. */
export type ContentWorkbenchProps = ContentWorkbenchInjected & {
  onNavigate: (view: WorkbenchView) => void
  onChat: () => void
  /** Active creation account, prepended to copied instructions. */
  account: string
  /** Browser-local persona text, appended to the identity block. */
  persona: string
} & PropsLocale<'content-studio'>

/** Quick-create panel rows: these capability ids, in this order. */
const QUICK_IDS: readonly CapabilityItem['id'][] = ['social-card', 'gzh-article', 'short-script', 'multi-platform', 'pre-publish']

/** The five quick-create entries and the view each one opens. */
const NEW_ENTRIES: readonly { view: WorkbenchView; key: StudioKey }[] = [
  { view: 'gather', key: 'nav.gather' },
  { view: 'competitors', key: 'nav.competitors' },
  { view: 'topicBank', key: 'nav.topicBank' },
  { view: 'persona', key: 'nav.persona' },
  { view: 'publish', key: 'nav.publish' },
]

/** How long a row shows its copied state before reverting. */
const COPIED_FEEDBACK_MS = 1600

/** Per-source load state: one failing Remote never blanks the whole home. */
type Load<T> = { state: 'loading' } | { state: 'ok'; value: T } | { state: 'failed'; detail: string }

/** The cross-theme reads/likes aggregate the data preview renders. */
interface ReviewDigest {
  /** Works with at least one metrics snapshot. */
  readonly works: number
  /** Latest-snapshot totals; null when no theme reported the metric. */
  readonly reads: number | null
  readonly likes: number | null
  readonly followers: number | null
  /** Themes carrying snapshots but no review task yet — the 待复盘 reminder. */
  readonly themesAwaitingReview: number
}

/** One merged activity/reminders feed row. */
interface FeedEntry {
  readonly key: string
  readonly at: string
  readonly label: string
  readonly view: WorkbenchView
}

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
 * Aggregate one theme's snapshots into the preview digest: the latest
 * snapshot per work, null metrics skipped (never faked as zero).
 * @param read - the theme's review manifest read.
 * @param digest - the accumulator to merge into.
 * @returns the updated digest.
 */
function foldReviewDigest(read: ReviewManifestRead, digest: ReviewDigest): ReviewDigest {
  const manifest = read.manifest
  if (manifest === null) return digest
  const latest = new Map<string, string>()
  for (const snapshot of manifest.snapshots) {
    latest.set(`${snapshot.platformId}:${snapshot.platformWorkId}`, snapshot.capturedAt)
  }
  const pick = (key: 'reads' | 'likes' | 'followersGained'): number | null => {
    let total: number | null = null
    for (const snapshot of manifest.snapshots) {
      if (latest.get(`${snapshot.platformId}:${snapshot.platformWorkId}`) !== snapshot.capturedAt) continue
      const value = snapshot.metrics[key]
      if (value === null) continue
      total = (total ?? 0) + value
    }
    return total
  }
  return {
    works: digest.works + latest.size,
    reads: addMetric(digest.reads, pick('reads')),
    likes: addMetric(digest.likes, pick('likes')),
    followers: addMetric(digest.followers, pick('followersGained')),
    themesAwaitingReview: digest.themesAwaitingReview
      + (manifest.snapshots.length > 0 && manifest.tasks.length === 0 ? 1 : 0),
  }
}

const EMPTY_DIGEST: ReviewDigest = { works: 0, reads: null, likes: null, followers: null, themesAwaitingReview: 0 }

/** Merge two optional metric totals; a missing side never fakes a zero. */
function addMetric(base: number | null, addend: number | null): number | null {
  return base === null ? addend : addend === null ? base : base + addend
}

/**
 * Render the workbench home.
 * @param props - the Remote read wrappers, view navigation, and the locale seat.
 * @returns the dashboard element tree.
 */
export function ContentWorkbench({
  listOutputs, listSchedule, listTopics, readInteractions, readReviewManifest,
  onNavigate, onChat, account, persona, t,
}: ContentWorkbenchProps) {
  const [outputs, setOutputs] = useState<Load<ContentOutputsSnapshot>>({ state: 'loading' })
  const [schedule, setSchedule] = useState<Load<ContentScheduleSnapshot>>({ state: 'loading' })
  const [topics, setTopics] = useState<Load<ContentTopicsSnapshot>>({ state: 'loading' })
  const [interactions, setInteractions] = useState<Load<InteractionsManifestRead>>({ state: 'loading' })
  const [review, setReview] = useState<Load<ReviewDigest>>({ state: 'loading' })
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
  const loadTopics = useCallback(async (): Promise<void> => {
    setTopics({ state: 'loading' })
    try {
      setTopics({ state: 'ok', value: await listTopics() })
    } catch (error) {
      console.error('[content-studio] contentTopics/list failed:', error)
      setTopics({ state: 'failed', detail: error instanceof Error ? error.message : String(error) })
    }
  }, [listTopics])
  const loadInteractions = useCallback(async (): Promise<void> => {
    setInteractions({ state: 'loading' })
    try {
      setInteractions({ state: 'ok', value: await readInteractions() })
    } catch (error) {
      console.error('[content-studio] readInteractions failed:', error)
      setInteractions({ state: 'failed', detail: error instanceof Error ? error.message : String(error) })
    }
  }, [readInteractions])
  useEffect(() => { void loadOutputs() }, [loadOutputs])
  useEffect(() => { void loadSchedule() }, [loadSchedule])
  useEffect(() => { void loadTopics() }, [loadTopics])
  useEffect(() => { void loadInteractions() }, [loadInteractions])

  // The review digest needs the theme list first, so it rides the outputs load.
  useEffect(() => {
    if (outputs.state !== 'ok') return
    let cancelled = false
    void (async () => {
      setReview({ state: 'loading' })
      try {
        const themes = outputs.value.projects.map(project => project.topic)
        const digests = await Promise.all(themes.map(async theme =>
          readReviewManifest(theme).then(read => foldReviewDigest(read, { ...EMPTY_DIGEST }))))
        if (cancelled) return
        const folded = digests.reduce<ReviewDigest>((acc, cur) => ({
          works: acc.works + cur.works,
          reads: addMetric(acc.reads, cur.reads),
          likes: addMetric(acc.likes, cur.likes),
          followers: addMetric(acc.followers, cur.followers),
          themesAwaitingReview: acc.themesAwaitingReview + cur.themesAwaitingReview,
        }), { ...EMPTY_DIGEST })
        setReview({ state: 'ok', value: folded })
      } catch (error) {
        if (cancelled) return
        console.error('[content-studio] review digest failed:', error)
        setReview({ state: 'failed', detail: error instanceof Error ? error.message : String(error) })
      }
    })()
    return () => { cancelled = true }
  }, [outputs, readReviewManifest])

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
    const identity = account === '通用模式'
      ? persona.length > 0 ? `账号画像：${persona}` : ''
      : persona.length > 0 ? `我的账号/画像：${account}
账号画像：${persona}` : `我的账号/画像：${account}`
    const prompt = identity.length > 0 ? `${identity}

${item.prompt}` : item.prompt
    if (await writeClipboard(prompt)) setCopiedId(item.id)
  }

  if (outputs.state === 'failed') console.warn('[content-studio] outputs panel degraded:', outputs.detail)
  if (schedule.state === 'failed') console.warn('[content-studio] schedule panel degraded:', schedule.detail)

  const projects = outputs.state === 'ok' ? outputs.value.projects : []
  const ready = projects.filter(project => project.status === 'ready').length
  const publishedProjects = projects.filter(project => project.status === 'published').length
  const items = schedule.state === 'ok' ? schedule.value.items : []
  const today = new Date().toISOString().slice(0, 10)
  const todayDue = items.filter(item => item.status !== 'published' && item.date === today).length
  const scheduledTasks = items.filter(item => item.status !== 'published' && item.date > today).length
  const topicItems = topics.state === 'ok' ? topics.value.items : []
  const topicTodo = topicItems.filter(topic => topic.status === 'idea' || topic.status === 'todo' || topic.status === 'creating').length
  const topicDone = topicItems.filter(topic => topic.status === 'done').length
  const summary: InteractionSummary | null = interactions.state === 'ok'
    ? interactions.value.manifest?.summary ?? null
    : null

  const recentTopics = [...topicItems]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 5)
  const recentFinals = [...projects]
    .filter(project => project.status === 'ready' || project.status === 'published')
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 5)

  // The merged activity/reminders feed: topics born, works moved, schedule
  // coming due, replies waiting, themes ready for their review pass.
  const feed = useMemo<FeedEntry[]>(() => {
    const entries: FeedEntry[] = []
    for (const topic of recentTopics) {
      entries.push({ key: `topic:${topic.id}`, at: topic.updatedAt, label: `${t('workbench.tl.newTopic')}「${topic.title}」`, view: 'topicBank' })
    }
    for (const project of [...projects].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 5)) {
      entries.push({
        key: `project:${project.topic}`,
        at: project.updatedAt,
        label: `「${project.title}」· ${t(`status.${project.status}`)}`,
        view: 'library',
      })
    }
    for (const item of items.filter(candidate => candidate.status !== 'published' && candidate.date >= today).slice(0, 5)) {
      entries.push({ key: `schedule:${item.id}`, at: item.date, label: `${t('workbench.tl.due')}「${item.title}」`, view: 'calendar' })
    }
    const manifest = interactions.state === 'ok' ? interactions.value.manifest : null
    if (manifest !== null) {
      const waiting = manifest.summary.unread + manifest.summary.pendingReply
      if (waiting > 0) {
        entries.push({ key: 'interaction:waiting', at: manifest.conversations[0]?.updatedAt ?? today, label: `${t('workbench.tl.reply')} ×${waiting}`, view: 'interaction' })
      }
    }
    if (review.state === 'ok' && review.value.themesAwaitingReview > 0) {
      entries.push({
        key: 'review:waiting',
        at: today,
        label: `${t('workbench.tl.reviewData')} ×${review.value.themesAwaitingReview}`,
        view: 'review',
      })
    }
    return entries.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8)
  }, [recentTopics, projects, items, interactions, review, today, t])

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

      <div className={css.quickRow}>
        <span className={css.panelTitle}>{t('workbench.createNew')}</span>
        {NEW_ENTRIES.map(entry => (
          <button key={entry.view} type="button" className={css.chip} onClick={() => { onNavigate(entry.view) }}>
            ＋ {t(entry.key)}
          </button>
        ))}
      </div>

      <div className={css.statRow}>
        <StatCard icon={<IconChecklistOutline14 size={16} />} value={topics.state === 'ok' ? topicItems.length : undefined} label={t('stat.topicTotal')} />
        <StatCard icon={<IconEditOutline16 size={16} />} value={topics.state === 'ok' ? topicTodo : undefined} label={t('stat.topicTodo')} />
        <StatCard icon={<IconCheckOutline16 size={16} />} value={topics.state === 'ok' ? topicDone : undefined} label={t('stat.topicDone')} />
        <StatCard icon={<IconFolderOpenOutline16 size={16} />} value={outputs.state === 'ok' ? ready : undefined} label={t('stat.ready')} />
      </div>
      <div className={css.statRow}>
        <StatCard icon={<IconGoalOutline16 size={16} />} value={outputs.state === 'ok' ? publishedProjects : undefined} label={t('stat.published')} />
        <StatCard icon={<IconChecklistOutline14 size={16} />} value={schedule.state === 'ok' ? todayDue : undefined} label={t('stat.todayDue')} />
        <StatCard icon={<IconNewChatOutline16 size={16} />} value={summary === null ? undefined : summary.unread + summary.pendingReply} label={t('stat.pendingReply')} />
        <StatCard icon={<IconSparkle16 size={16} />} value={schedule.state === 'ok' ? scheduledTasks : undefined} label={t('stat.scheduledTasks')} />
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
            <h2 className={css.panelTitle}><IconChecklistOutline14 size={13} />{t('panel.recentTopics')}</h2>
            <button type="button" className={css.panelMore} onClick={() => { onNavigate('topicBank') }}>
              {t('nav.topicBank')} →
            </button>
          </header>
          {panelState(topics, () => { void loadTopics() })
            ?? (recentTopics.length === 0
              ? <p className={css.panelEmpty}>{t('panel.emptyRecentTopics')}</p>
              : recentTopics.map(topic => (
                <button
                  key={topic.id}
                  type="button"
                  className={css.listRowButton}
                  onClick={() => { onNavigate('topicBank') }}
                >
                  <span className={css.listTitle}>{topic.title}</span>
                  <span className={css.listMeta}>{t(`topic.status.${topic.status}`)}</span>
                </button>
              )))}
        </section>
        <section className={css.panel}>
          <header className={css.panelHead}>
            <h2 className={css.panelTitle}><IconFolderOpenOutline16 size={13} />{t('panel.recentFinals')}</h2>
            <button type="button" className={css.panelMore} onClick={() => { onNavigate('library') }}>
              {t('nav.library')} →
            </button>
          </header>
          {panelState(outputs, () => { void loadOutputs() })
            ?? (recentFinals.length === 0
              ? <p className={css.panelEmpty}>{t('panel.emptyRecent')}</p>
              : recentFinals.map(project => (
                <button
                  key={project.topic}
                  type="button"
                  className={css.listRowButton}
                  onClick={() => { onNavigate('library') }}
                >
                  <span className={css.listTitle}>{project.title}</span>
                  <span className={css.listMeta}>{t(`status.${project.status}`)}</span>
                </button>
              )))}
        </section>
      </div>

      <div className={css.panelRowTwo}>
        <section className={css.panel}>
          <header className={css.panelHead}>
            <h2 className={css.panelTitle}><IconGoalOutline16 size={13} />{t('panel.timeline')}</h2>
            <button type="button" className={css.panelMore} onClick={() => { onNavigate('review') }}>
              {t('nav.review')} →
            </button>
          </header>
          {feed.length === 0
            ? <p className={css.panelEmpty}>{t('workbench.emptyTimeline')}</p>
            : feed.map(entry => (
              <button
                key={entry.key}
                type="button"
                className={css.listRowButton}
                onClick={() => { onNavigate(entry.view) }}
              >
                <span className={css.listTitle}>{entry.label}</span>
                <span className={css.listMeta}>{entry.at.slice(0, 10)}</span>
              </button>
            ))}
        </section>
        <section className={css.panel}>
          <header className={css.panelHead}>
            <h2 className={css.panelTitle}><IconSparkle16 size={13} />{t('panel.dataPreview')}</h2>
            <button type="button" className={css.panelMore} onClick={() => { onNavigate('review') }}>
              {t('nav.review')} →
            </button>
          </header>
          {review.state === 'loading' && <p className={css.panelEmpty}>{t('library.loading')}</p>}
          {review.state === 'failed' && (
            <div className={css.libraryState}>
              <span>{t('library.error')}: {review.detail}</span>
              <button type="button" className={css.retry} onClick={() => { setOutputs({ ...outputs }) }}>{t('library.retry')}</button>
            </div>
          )}
          {review.state === 'ok' && (
            <>
              <div className={css.dataPills}>
                <span className={css.dataPill}>{t('stat.previewWorks')} · {review.value.works}</span>
                <span className={css.dataPill}>{t('stat.reads')} · {review.value.reads ?? '—'}</span>
                <span className={css.dataPill}>{t('stat.likes')} · {review.value.likes ?? '—'}</span>
                <span className={css.dataPill}>{t('stat.followers')} · {review.value.followers ?? '—'}</span>
              </div>
              <p className={css.panelEmpty}>{t('workbench.reviewHint')}</p>
            </>
          )}
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
