/**
 * The gather view: the information-collection surface inside the workbench
 * overlay. Three regions — sources and tasks (browser-side configuration),
 * the material list of one theme (the on-disk manifest projected), and the
 * material detail (sanitized body, AI results, excerpts) — the latter two
 * sharing the reusable SplitDetail layout the topic bank adopts. Every
 * material card and the detail carry the topic-bank entry under the
 * reserved `addToTopicBank` contract name; the handler arrives injected now
 * that the topic bank ships, with the pending toast kept as the fallback
 * when no handler is plugged in. Scheduling copy states the product fact
 * plainly — collection runs only while the workbench is open; nothing polls
 * in the background.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { clsx } from 'clsx'
import { IconWarningOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { GatherMaterial } from '@deepseek-ai/dsh-content-outputs/types'
import type { GatherSource, GatherTaskView } from './gather/types.ts'
import type { GatherController, GatherState } from './gather/gather-store.ts'
import { exportSourcesAsOpml, previewOpmlImport } from './gather/opml.ts'
import { sanitizeForRender } from './gather/purify.ts'
import { SplitDetail } from './SplitDetail.tsx'
import css from './ContentStudio.module.css'
import gatherCss from './GatherView.module.css'

/** Injected face of the gather view: the controller and the create handoff. */
export interface GatherViewInjected {
  gather: GatherController
  /** Hand one material to the create view (marks picked, navigates). */
  onPushToCreate: (material: { id: string; title: string; url: string }) => void
  /**
   * Join one material into the topic bank, keyed by the reserved
   * {@link ADD_TO_TOPIC_BANK} contract name. Absent until the topic bank
   * ships: the view answers with the pending toast.
   */
  addToTopicBank?: (materialId: string) => void
}

/** Full gather props: the injected face plus the locale seat. */
export type GatherViewProps = GatherViewInjected & PropsLocale<'content-studio'>

/** Render the gather view. */
export function GatherView({ gather, onPushToCreate, addToTopicBank, t }: GatherViewProps) {
  const state = useSyncExternalStore(
    listener => gather.subscribe(listener),
    () => gather.getState(),
  )
  useEffect(() => { void gather.refreshThemes() }, [gather])
  // Initial theme pick: first theme once the list arrives.
  useEffect(() => {
    if (state.selectedTheme === null && state.themes.length > 0) void gather.selectTheme(state.themes[0] ?? null)
  }, [gather, state.selectedTheme, state.themes])
  // The reserved topic-bank entry: a pending toast until the topic bank
  // plugs its handler in under the same contract name.
  const joinTopicBank = addToTopicBank ?? ((materialId: string): void => {
    void materialId
    gather.showNotice('topic-bank-pending')
  })

  return (
    <div className={gatherCss.gather}>
      <header className={gatherCss.gatherHead}>
        <div>
          <h1 className={css.title}>{t('gather.title')}</h1>
          <p className={css.subtitle}>{t('gather.subtitle')}</p>
        </div>
        {state.notice !== null && (
          <button type="button" className={gatherCss.gatherNotice} onClick={() => { gather.dismissNotice() }}>
            <IconWarningOutline16 size={14} />
            <span>{noticeText(state.notice, t)}</span>
          </button>
        )}
      </header>
      {!state.storagePersistent && (
        <div className={gatherCss.gatherWarn} role="alert">
          <IconWarningOutline16 size={14} />
          <span>{t('gather.storage.memory')}</span>
        </div>
      )}
      <div className={gatherCss.gatherColumns}>
        <aside className={gatherCss.gatherConfig}>
          <SourcesSection state={state} gather={gather} t={t} />
          <TasksSection state={state} gather={gather} t={t} />
        </aside>
        <SplitDetail
          list={<MaterialsSection state={state} gather={gather} onJoinTopicBank={joinTopicBank} t={t} />}
          detail={<MaterialDetail state={state} gather={gather} onPushToCreate={onPushToCreate} onJoinTopicBank={joinTopicBank} t={t} />}
          detailLabel={t('gather.detail.label')}
        />
      </div>
    </div>
  )
}

function noticeText(notice: string, t: PropsLocale<'content-studio'>['t']): string {
  const known: Record<string, () => string> = {
    'calendar-added': () => t('gather.notice.calendarAdded'),
    'source-limit': () => t('gather.notice.sourceLimit'),
    'opml-exported': () => t('gather.notice.opmlExported'),
    'topic-bank-pending': () => t('gather.notice.topicBankPending'),
    'topic-bank-added': () => t('gather.notice.topicBankAdded'),
    'topic-bank-failed': () => t('gather.notice.topicBankFailed'),
    'topic-bank-missing': () => t('gather.notice.topicBankMissing'),
  }
  const knownValue = known[notice]
  if (knownValue !== undefined) return knownValue()
  if (notice.startsWith('opml-imported:')) {
    const [n, skipped] = notice.slice('opml-imported:'.length).split('+')
    return t('gather.notice.opmlImported', { n: n ?? '0', skipped: skipped ?? '0' })
  }
  if (notice.startsWith('test-ok:')) return t('gather.notice.testOk', { n: notice.slice('test-ok:'.length) })
  if (notice.startsWith('test-failed:')) return t('gather.notice.testFailed', { detail: notice.slice('test-failed:'.length) })
  return notice
}

/** Map one source's last status to its badge class. */
function sourceBadge(source: GatherSource): string {
  if (source.lastStatus === 'ok') return gatherCss.gatherBadgeOk ?? ''
  if (source.lastStatus === 'failed') return gatherCss.gatherBadgeFailed ?? ''
  return ''
}

// ── sources ──

function SourcesSection({ state, gather, t }: { state: GatherState; gather: GatherController; t: PropsLocale<'content-studio'>['t'] }) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [interval, setInterval] = useState(60)
  const [exclude, setExclude] = useState('')
  const [testing, setTesting] = useState<string | null>(null)

  const submit = (): void => {
    if (name.trim().length === 0 || url.trim().length === 0) return
    gather.addSource({
      name: name.trim(),
      url: url.trim(),
      intervalMinutes: Math.max(30, interval),
      tags: [],
      excludeKeywords: splitKeywords(exclude),
    })
    setName('')
    setUrl('')
    setExclude('')
  }

  return (
    <section className={gatherCss.gatherPanel}>
      <header className={gatherCss.gatherPanelHead}>
        <h2 className={css.groupTitle}>{t('gather.sources.title')}</h2>
        <span className={css.listMeta}>{state.sources.length}</span>
      </header>
      <ul className={gatherCss.gatherList}>
        {state.sources.map(source => (
          <li key={source.id} className={gatherCss.gatherItem}>
            <div className={gatherCss.gatherItemHead}>
              <span className={clsx(gatherCss.gatherBadge, sourceBadge(source))} />
              <span className={gatherCss.gatherItemTitle}>{source.name}</span>
              <button
                type="button"
                className={gatherCss.gatherMini}
                onClick={() => { gather.updateSource(source.id, { enabled: !source.enabled }) }}
              >
                {source.enabled ? t('gather.sources.disable') : t('gather.sources.enable')}
              </button>
              <button
                type="button"
                className={gatherCss.gatherMini}
                onClick={() => {
                  setTesting(source.id)
                  void gather.testSource(source.id).then((result) => {
                    setTesting(null)
                    gather.showNotice(result.ok ? `test-ok:${result.detail}` : `test-failed:${result.detail}`)
                  }).catch(() => { setTesting(null) })
                }}
              >
                {testing === source.id ? t('gather.sources.testing') : t('gather.sources.test')}
              </button>
              <button type="button" className={gatherCss.gatherMini} onClick={() => { gather.removeSource(source.id) }}>
                {t('gather.sources.remove')}
              </button>
            </div>
            <span className={gatherCss.gatherItemMeta}>
              {source.url}
              {' · '}
              {t('gather.sources.interval', { n: source.intervalMinutes })}
              {source.lastStatus === 'failed' && ` · ${t('gather.sources.failed')}`}
              {source.lastFetchedAt !== null && ` · ${source.lastFetchedAt.slice(0, 16).replace('T', ' ')}`}
            </span>
            {source.excludeKeywords.length > 0 && (
              <span className={gatherCss.gatherItemMeta}>{t('gather.sources.exclude')}: {source.excludeKeywords.join('、')}</span>
            )}
          </li>
        ))}
      </ul>
      {expanded ? (
        <div className={gatherCss.gatherForm}>
          <input className={gatherCss.gatherInput} value={name} placeholder={t('gather.sources.namePlaceholder')} onChange={(event) => { setName(event.target.value) }} />
          <input className={gatherCss.gatherInput} value={url} placeholder="https://example.com/feed.xml" onChange={(event) => { setUrl(event.target.value) }} />
          <div className={gatherCss.gatherFormRow}>
            <label className={gatherCss.gatherItemMeta}>
              {t('gather.sources.intervalLabel')}
              <input className={gatherCss.gatherInput} type="number" min={30} value={interval} onChange={(event) => { setInterval(Number(event.target.value)) }} />
            </label>
            <input className={gatherCss.gatherInput} value={exclude} placeholder={t('gather.sources.excludePlaceholder')} onChange={(event) => { setExclude(event.target.value) }} />
          </div>
          <div className={gatherCss.gatherFormRow}>
            <button type="button" className={gatherCss.gatherAction} onClick={submit}>{t('gather.sources.add')}</button>
            <button type="button" className={gatherCss.gatherMini} onClick={() => { setExpanded(false) }}>{t('gather.cancel')}</button>
          </div>
        </div>
      ) : (
        <div className={gatherCss.gatherFormRow}>
          <button type="button" className={gatherCss.gatherAction} onClick={() => { setExpanded(true) }}>{t('gather.sources.add')}</button>
          <OpmlControls sources={state.sources} gather={gather} t={t} />
        </div>
      )}
      <p className={gatherCss.gatherHint}>{t('gather.schedule.limit')}</p>
    </section>
  )
}

function OpmlControls({ sources, gather, t }: {
  sources: readonly GatherSource[]
  gather: GatherController
  t: PropsLocale<'content-studio'>['t']
}) {
  return (
    <>
      <button
        type="button"
        className={gatherCss.gatherMini}
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.opml,text/xml,application/xml'
          input.onchange = () => {
            const file = input.files?.[0]
            if (file === undefined) return
            void file.text().then((text) => {
              const { rows, problem } = previewOpmlImport(text, sources)
              if (problem !== undefined || rows === undefined) {
                gather.showNotice(problem ?? 'opml-error')
                return
              }
              const usable = rows.filter(row => !row.invalid && !row.duplicate)
              const skipped = rows.length - usable.length
              gather.importSources(usable.map(row => ({ name: row.name, url: row.url, tags: row.folder.slice(0, 1) })))
              gather.showNotice(`opml-imported:${usable.length}+${skipped}`)
            })
          }
          input.click()
        }}
      >
        {t('gather.sources.opmlImport')}
      </button>
      <button
        type="button"
        className={gatherCss.gatherMini}
        onClick={() => {
          if (sources.length === 0) return
          // Feed URLs can carry private tokens; the export dialog states the
          // handling duty before the file exists.
          if (!window.confirm(t('gather.sources.opmlExportWarning'))) return
          const opml = exportSourcesAsOpml(sources)
          const blob = new Blob([opml], { type: 'text/x-opml' })
          const url = URL.createObjectURL(blob)
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = 'gather-sources.opml'
          anchor.click()
          URL.revokeObjectURL(url)
          gather.showNotice('opml-exported')
        }}
      >
        {t('gather.sources.opmlExport')}
      </button>
    </>
  )
}

// ── tasks ──

function TasksSection({ state, gather, t }: { state: GatherState; gather: GatherController; t: PropsLocale<'content-studio'>['t'] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <section className={gatherCss.gatherPanel}>
      <header className={gatherCss.gatherPanelHead}>
        <h2 className={css.groupTitle}>{t('gather.tasks.title')}</h2>
        <span className={css.listMeta}>{state.tasks.length}</span>
      </header>
      <ul className={gatherCss.gatherList}>
        {state.tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            gather={gather}
            expanded={expanded === task.id}
            toggle={() => { setExpanded(expanded === task.id ? null : task.id) }}
            t={t}
          />
        ))}
      </ul>
      <TaskCreate state={state} gather={gather} t={t} />
    </section>
  )
}

const STATUS_LABEL: Record<GatherTaskView['status'], 'gather.task.idle' | 'gather.task.running' | 'gather.task.done' | 'gather.task.failed'> = {
  idle: 'gather.task.idle',
  running: 'gather.task.running',
  done: 'gather.task.done',
  failed: 'gather.task.failed',
}

function TaskRow({ task, gather, expanded, toggle, t }: {
  task: GatherTaskView
  gather: GatherController
  expanded: boolean
  toggle: () => void
  t: PropsLocale<'content-studio'>['t']
}) {
  return (
    <li className={gatherCss.gatherItem}>
      <div className={gatherCss.gatherItemHead}>
        <span className={gatherCss.gatherItemTitle}>{task.name}</span>
        <span className={clsx(gatherCss.gatherBadge, task.status === 'failed' ? gatherCss.gatherBadgeFailed : task.status === 'running' ? gatherCss.gatherBadgeOk : '')}>
          {t(STATUS_LABEL[task.status])}
        </span>
      </div>
      <span className={gatherCss.gatherItemMeta}>
        {task.themeName}
        {' · '}
        {task.intervalMinutes === null ? t('gather.task.manual') : t('gather.sources.interval', { n: task.intervalMinutes })}
        {' · '}
        {task.sourceIds.length}
      </span>
      <div className={gatherCss.gatherItemHead}>
        <button type="button" className={gatherCss.gatherMini} onClick={() => { void gather.triggerTask(task.id) }}>{t('gather.task.run')}</button>
        <button
          type="button"
          className={gatherCss.gatherMini}
          onClick={() => { gather.updateTask(task.id, { intervalMinutes: task.intervalMinutes === null ? 60 : null }) }}
        >
          {task.intervalMinutes === null ? t('gather.task.resume') : t('gather.task.pause')}
        </button>
        <button type="button" className={gatherCss.gatherMini} onClick={toggle}>{t('gather.task.log')}</button>
        <button type="button" className={gatherCss.gatherMini} onClick={() => { gather.removeTask(task.id) }}>{t('gather.sources.remove')}</button>
      </div>
      {expanded && (
        <ul className={gatherCss.gatherLog}>
          {task.log.length === 0 && <li className={gatherCss.gatherItemMeta}>{t('gather.task.logEmpty')}</li>}
          {task.log.map(entry => (
            <li key={entry.at} className={gatherCss.gatherItemMeta}>
              {entry.at.slice(11, 19)}
              {' · '}
              {t(entry.outcome === 'ok' ? 'gather.log.ok' : entry.outcome === 'failed' ? 'gather.log.failed' : 'gather.log.notModified')}
              {entry.outcome !== 'failed' && ` +${entry.added}`}
              {entry.detail !== undefined && ` · ${entry.detail}`}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function TaskCreate({ state, gather, t }: { state: GatherState; gather: GatherController; t: PropsLocale<'content-studio'>['t'] }) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState('')
  const [theme, setTheme] = useState('')
  const [selected, setSelected] = useState<readonly string[]>([])
  const [interval, setIntervalMinutes] = useState('')
  const [maxItems, setMaxItems] = useState(20)
  const [include, setInclude] = useState('')
  const [exclude, setExclude] = useState('')

  if (!expanded) {
    return <button type="button" className={gatherCss.gatherAction} onClick={() => { setExpanded(true) }}>{t('gather.task.add')}</button>
  }
  return (
    <div className={gatherCss.gatherForm}>
      <input className={gatherCss.gatherInput} value={name} placeholder={t('gather.task.namePlaceholder')} onChange={(event) => { setName(event.target.value) }} />
      <select className={gatherCss.gatherInput} value={theme} onChange={(event) => { setTheme(event.target.value) }}>
        <option value="">{t('gather.task.themePlaceholder')}</option>
        {state.themes.map(candidate => <option key={candidate} value={candidate}>{candidate}</option>)}
      </select>
      <div className={gatherCss.gatherCheckList}>
        {state.sources.map(source => (
          <label key={source.id} className={gatherCss.gatherItemMeta}>
            <input
              type="checkbox"
              checked={selected.includes(source.id)}
              onChange={() => {
                setSelected(selected.includes(source.id) ? selected.filter(id => id !== source.id) : [...selected, source.id])
              }}
            />
            {' '}
            {source.name}
          </label>
        ))}
      </div>
      <div className={gatherCss.gatherFormRow}>
        <input className={gatherCss.gatherInput} type="number" min={20} value={maxItems} onChange={(event) => { setMaxItems(Number(event.target.value)) }} />
        <input className={gatherCss.gatherInput} value={interval} placeholder={t('gather.task.intervalPlaceholder')} onChange={(event) => { setIntervalMinutes(event.target.value) }} />
      </div>
      <input className={gatherCss.gatherInput} value={include} placeholder={t('gather.task.includePlaceholder')} onChange={(event) => { setInclude(event.target.value) }} />
      <input className={gatherCss.gatherInput} value={exclude} placeholder={t('gather.task.excludePlaceholder')} onChange={(event) => { setExclude(event.target.value) }} />
      <div className={gatherCss.gatherFormRow}>
        <button
          type="button"
          className={gatherCss.gatherAction}
          onClick={() => {
            if (name.trim().length === 0 || theme.length === 0 || selected.length === 0) return
            const minutes = interval.trim().length === 0 ? null : Math.max(30, Number(interval))
            gather.addTask({
              name: name.trim(),
              sourceIds: selected,
              themeName: theme,
              maxItemsPerRun: Math.max(1, maxItems),
              since: null,
              includeKeywords: splitKeywords(include),
              excludeKeywords: splitKeywords(exclude),
              aiEnabled: true,
              intervalMinutes: minutes,
            })
            setName('')
            setSelected([])
            setExpanded(false)
          }}
        >
          {t('gather.task.add')}
        </button>
        <button type="button" className={gatherCss.gatherMini} onClick={() => { setExpanded(false) }}>{t('gather.cancel')}</button>
      </div>
    </div>
  )
}

// ── materials ──

function MaterialsSection({ state, gather, onJoinTopicBank, t }: {
  state: GatherState
  gather: GatherController
  onJoinTopicBank: (materialId: string) => void
  t: PropsLocale<'content-studio'>['t']
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read' | 'favorite' | 'picked'>('all')
  const [sourceFilter, setSourceFilter] = useState('all')

  const filtered = useMemo(() => filterMaterials(state, search, statusFilter, sourceFilter), [state, search, statusFilter, sourceFilter])

  return (
    <section className={gatherCss.gatherMaterials}>
      <div className={gatherCss.gatherFilters}>
        <select className={gatherCss.gatherInput} value={state.selectedTheme ?? ''} onChange={(event) => { void gather.selectTheme(event.target.value === '' ? null : event.target.value) }}>
          {state.themes.length === 0 && <option value="">{t('gather.materials.noTheme')}</option>}
          {state.themes.map(theme => <option key={theme} value={theme}>{theme}</option>)}
        </select>
        <select className={gatherCss.gatherInput} value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value) }}>
          <option value="all">{t('gather.materials.allSources')}</option>
          {state.sources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
        </select>
        <select
          className={gatherCss.gatherInput}
          value={statusFilter}
          onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter) }}>
          <option value="all">{t('gather.materials.allStatus')}</option>
          <option value="unread">{t('gather.materials.unread')}</option>
          <option value="read">{t('gather.materials.read')}</option>
          <option value="favorite">{t('gather.materials.favorite')}</option>
          <option value="picked">{t('gather.materials.picked')}</option>
        </select>
        <input className={gatherCss.gatherInput} value={search} placeholder={t('gather.materials.searchPlaceholder')} onChange={(event) => { setSearch(event.target.value) }} />
      </div>
      {state.loadingMaterials && <div className={css.libraryState}>{t('gather.materials.loading')}</div>}
      {!state.loadingMaterials && filtered.length === 0 && <div className={css.libraryState}>{t('gather.materials.empty')}</div>}
      <ul className={gatherCss.gatherMaterialList}>
        {filtered.map(material => (
          <li key={material.id} className={gatherCss.gatherCardRow}>
            <button
              type="button"
              className={clsx(gatherCss.gatherMaterialCard, state.selectedMaterialId === material.id && gatherCss.gatherMaterialActive)}
              onClick={() => { gather.selectMaterial(material.id) }}
            >
              <span className={gatherCss.gatherItemTitle}>{material.title}</span>
              <span className={gatherCss.gatherItemMeta}>
                {material.sourceName}
                {material.publishedAt !== undefined && ` · ${material.publishedAt.slice(0, 10)}`}
                {material.score !== undefined && ` · ${material.score}`}
              </span>
            </button>
            {/* Reserved topic-bank entry (addToTopicBank contract): pending toast this iteration. */}
            <button
              type="button"
              className={clsx(gatherCss.gatherMini, gatherCss.gatherTopicBank)}
              aria-label={`${t('gather.detail.topicBank')}: ${material.title}`}
              title={t('gather.notice.topicBankPending')}
              onClick={() => { onJoinTopicBank(material.id) }}
            >
              {t('gather.detail.topicBankShort')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Client-side filter of the visible materials: search, status, source. */
function filterMaterials(state: GatherState, search: string, status: string, sourceId: string): readonly GatherMaterial[] {
  const query = search.trim().toLowerCase()
  return state.materials.filter((material) => {
    if (status !== 'all' && material.status !== status) return false
    if (sourceId !== 'all' && material.sourceId !== sourceId) return false
    if (query.length > 0 && !`${material.title}\n${material.summary ?? ''}`.toLowerCase().includes(query)) return false
    return true
  })
}

// ── detail ──

function MaterialDetail({ state, gather, onPushToCreate, onJoinTopicBank, t }: GatherViewProps & {
  state: GatherState
  onJoinTopicBank: (materialId: string) => void
}) {
  const material = state.materials.find(candidate => candidate.id === state.selectedMaterialId)
  const [body, setBody] = useState<string | null>(null)
  const [excerpt, setExcerpt] = useState('')
  const [bindTheme, setBindTheme] = useState('')
  const [calendarDate, setCalendarDate] = useState('')

  useEffect(() => {
    setBody(null)
    setExcerpt('')
    if (material?.bodyFile === undefined || state.selectedTheme === null) return
    let live = true
    void gather.readBody(state.selectedTheme, material.bodyFile).then((content) => {
      if (live) setBody(content)
    })
    return () => { live = false }
  }, [gather, material?.bodyFile, state.selectedTheme])

  if (material === undefined) {
    return <section className={gatherCss.gatherDetail}><div className={css.libraryState}>{t('gather.detail.empty')}</div></section>
  }
  return (
    <section className={gatherCss.gatherDetail}>
      <header className={gatherCss.gatherDetailHead}>
        <h2 className={gatherCss.gatherDetailTitle}>{material.title}</h2>
        <span className={gatherCss.gatherItemMeta}>
          {material.sourceName}
          {material.publishedAt !== undefined && ` · ${material.publishedAt.slice(0, 10)}`}
          {` · ${t(`gather.materials.${material.status}` as const)}`}
        </span>
        <a className={gatherCss.gatherLink} href={material.url} target="_blank" rel="noreferrer">{t('gather.detail.openOriginal')}</a>
      </header>
      <div className={gatherCss.gatherFormRow}>
        <button type="button" className={gatherCss.gatherMini} onClick={() => { void gather.markRead(material.id) }}>
          {material.status === 'read' ? t('gather.detail.markUnread') : t('gather.detail.markRead')}
        </button>
        <button type="button" className={gatherCss.gatherMini} onClick={() => { void gather.toggleFavorite(material.id) }}>
          {material.status === 'favorite' ? t('gather.detail.unfavorite') : t('gather.detail.favorite')}
        </button>
        <button
          type="button"
          className={gatherCss.gatherMini}
          onClick={() => {
            void gather.markPicked(material.id)
            onPushToCreate({ id: material.id, title: material.title, url: material.url })
          }}
        >
          {t('gather.detail.pushCreate')}
        </button>
        {/* Reserved topic-bank entry (addToTopicBank contract): pending toast this iteration. */}
        <button
          type="button"
          className={gatherCss.gatherMini}
          title={t('gather.notice.topicBankPending')}
          onClick={() => { onJoinTopicBank(material.id) }}
        >
          {t('gather.detail.topicBank')}
        </button>
      </div>

      <div className={gatherCss.gatherAi}>
        <div className={gatherCss.gatherFormRow}>
          <button type="button" className={gatherCss.gatherAction} onClick={() => { void gather.processWithAi(material.id) }}>
            {t('gather.detail.aiProcess')}
          </button>
          {material.summary === undefined && <span className={gatherCss.gatherHint}>{t('gather.detail.aiPending')}</span>}
        </div>
        {material.summary !== undefined && (
          <div className={gatherCss.gatherAiResult}>
            <p className={gatherCss.gatherBodyText}>{material.summary}</p>
            {material.points !== undefined && material.points.length > 0 && (
              <ul className={gatherCss.gatherLog}>
                {material.points.map((point, index) => <li key={index} className={gatherCss.gatherBodyText}>{point}</li>)}
              </ul>
            )}
            {material.score !== undefined && <span className={gatherCss.gatherBadgeOk}>{t('gather.detail.score', { n: material.score })}</span>}
            {material.tags !== undefined && material.tags.length > 0 && (
              <span className={gatherCss.gatherItemMeta}>{material.tags.join('、')}</span>
            )}
          </div>
        )}
      </div>

      {body !== null && (
        <div className={gatherCss.gatherBody} dangerouslySetInnerHTML={{ __html: sanitizeForRender(body) }} />
      )}

      <div className={gatherCss.gatherExcerpts}>
        <ul className={gatherCss.gatherLog}>
          {material.excerpts?.map((entry, index) => <li key={index} className={gatherCss.gatherBodyText}>{entry}</li>)}
        </ul>
        <div className={gatherCss.gatherFormRow}>
          <input className={gatherCss.gatherInput} value={excerpt} placeholder={t('gather.detail.excerptPlaceholder')} onChange={(event) => { setExcerpt(event.target.value) }} />
          <button
            type="button"
            className={gatherCss.gatherMini}
            onClick={() => {
              void gather.addExcerpt(material.id, excerpt)
              setExcerpt('')
            }}
          >
            {t('gather.detail.excerptAdd')}
          </button>
        </div>
      </div>

      <div className={gatherCss.gatherFormRow}>
        <select className={gatherCss.gatherInput} value={bindTheme} onChange={(event) => { setBindTheme(event.target.value) }}>
          <option value="">{t('gather.detail.bindPlaceholder')}</option>
          {state.themes.filter(theme => theme !== state.selectedTheme).map(theme => <option key={theme} value={theme}>{theme}</option>)}
        </select>
        <button
          type="button"
          className={gatherCss.gatherMini}
          onClick={() => {
            if (bindTheme.length > 0) {
              void gather.bindTheme(material.id, bindTheme)
              setBindTheme('')
            }
          }}
        >
          {t('gather.detail.bindMove')}
        </button>
      </div>
      <div className={gatherCss.gatherFormRow}>
        <input className={gatherCss.gatherInput} type="date" value={calendarDate} onChange={(event) => { setCalendarDate(event.target.value) }} />
        <button
          type="button"
          className={gatherCss.gatherMini}
          onClick={() => {
            if (calendarDate.length > 0) void gather.pushToCalendar(material.id, calendarDate)
          }}
        >
          {t('gather.detail.toCalendar')}
        </button>
      </div>
    </section>
  )
}

/** Split a comma/、-separated keyword field into a clean list. */
function splitKeywords(value: string): string[] {
  return value.split(/[,，、\n]/u).map(word => word.trim()).filter(word => word.length > 0)
}
