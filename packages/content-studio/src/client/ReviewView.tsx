/**
 * The review view: a four-panel workbench over the review controller —
 * 数据 (import + bindings + baselines), 看板 (filters + summary cards +
 * leaderboard), 诊断 (per-work AI diagnosis), 报告 (task creation, the
 * report editor, history, and the topic-bank reflow). The theme picker
 * rides the top; everything else renders against the loaded manifest.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { MetricSnapshot, ReviewImportPreview, ReviewPlatformId } from '@deepseek-ai/dsh-content-outputs/types'
import { REVIEW_PLATFORMS, REVIEW_WORK_FILTERS } from './review/model.ts'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { StudioKey } from './locales.ts'
import type { ReviewController, ReviewNotice, WorkCard } from './review/review-store.ts'
import { collectRateOf, engagementRateOf, rankWorks } from './review/model.ts'
import css from './ReviewView.module.css'

/** The locale seat's translate function, shared by every sub-panel. */
type Translate = PropsLocale<'content-studio'>['t']

/** Injected face of the review view. */
export interface ReviewViewInjected {
  review: ReviewController
  /** Current theme directory names, projected from the outputs library. */
  listThemes: () => Promise<readonly string[]>
}

/** Full view props: the injected face plus the locale seat. */
export type ReviewViewProps = ReviewViewInjected & PropsLocale<'content-studio'>

/** The four panels, in nav order. */
type ReviewTab = 'data' | 'board' | 'diagnose' | 'reports'

/** Percent label helper: rates render as percents, missing as a dash. */
function percent(rate: number | null): string {
  return rate === null ? '—' : `${(rate * 100).toFixed(1)}%`
}

/** The platform display names, in picker order. */
const PLATFORM_LABELS: Record<ReviewPlatformId, string> = {
  xhs: '小红书', douyin: '抖音', gzh: '公众号', bilibili: 'B站',
}

/**
 * Render the review workbench.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export function ReviewView({ review, listThemes, t }: ReviewViewProps) {
  const state = useSyncExternalStore(
    fn => review.subscribe(fn),
    () => review.getState(),
  )
  const [tab, setTab] = useState<ReviewTab>('data')
  const [themes, setThemes] = useState<readonly string[]>([])
  // Import staging form state.
  const [importPlatform, setImportPlatform] = useState<ReviewPlatformId>('xhs')
  const [importFileName, setImportFileName] = useState('')
  const [importText, setImportText] = useState('')
  // Task + reflow form state.
  const [taskName, setTaskName] = useState('')
  const [topicTitle, setTopicTitle] = useState('')
  const [topicNote, setTopicNote] = useState('')

  useEffect(() => {
    void (async () => {
      try { setThemes(await listThemes()) } catch { setThemes([]) }
    })()
  }, [listThemes])

  useEffect(() => {
    if (state.notice === null) return
    const timer = window.setTimeout(() => { review.clearNotice() }, 4000)
    return () => { window.clearTimeout(timer) }
  }, [state.notice, review])

  const manifest = state.manifest
  const cards = useMemo(
    () => review.pool(),
    [review, state.manifest, state.theme, state.filtersRevision],
  )
  const summary = useMemo(
    () => review.summary(),
    [review, state.manifest, state.theme, state.filtersRevision],
  )
  const ranked = useMemo(() => rankWorks(cards.map(card => card.snapshot)), [cards])
  const unbound = manifest?.snapshots.filter(snapshot => snapshot.contentId === null) ?? []

  const pickTheme = (theme: string): void => {
    void review.load(theme)
  }

  const onFilePicked = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return
    setImportFileName(file.name)
    const text = await file.text()
    setImportText(text)
  }

  const stageImport = (): void => {
    if (importText.trim().length === 0) return
    void review.stageImport(importPlatform, importFileName, importText)
  }

  const noticeText = (notice: ReviewNotice): string => t(`review.notice.${notice}`)

  return (
    <div className={css.view}>
      <header className={css.header}>
        <h2 className={css.title}>{t('review.title')}</h2>
        <select
          className={css.themePick}
          value={state.theme ?? ''}
          onChange={(event) =>{  pickTheme(event.target.value) }}
          aria-label={t('review.theme.aria')}
        >
          <option value="">{t('review.theme.placeholder')}</option>
          {themes.map(theme => <option key={theme} value={theme}>{theme}</option>)}
        </select>
        {state.problems.length > 0 && <span className={css.problems}>{state.problems[0]}</span>}
      </header>

      {state.notice !== null && <div className={css.notice} role="status">{noticeText(state.notice)}</div>}
      {state.busy && <div className={css.busy}>{t('review.busy')}</div>}

      <nav className={css.tabs} role="tablist">
        {(['data', 'board', 'diagnose', 'reports'] as const).map(candidate => (
          <button
            key={candidate}
            type="button"
            role="tab"
            aria-selected={tab === candidate}
            className={css.tabButton}
            onClick={() => { setTab(candidate) }}
          >
            {t(`review.tab.${candidate}`)}
          </button>
        ))}
      </nav>

      {state.theme === null && <p className={css.empty}>{t('review.empty.noTheme')}</p>}
      {state.loading && <p className={css.empty}>{t('review.loading')}</p>}

      {state.theme !== null && !state.loading && (
        <div className={css.body}>
          {tab === 'data' && (
            <section className={css.panel}>
              <h3>{t('review.import.title')}</h3>
              <p className={css.hint}>{t('review.import.hint')}</p>
              <div className={css.formRow}>
                <select
                  value={importPlatform}
                  onChange={(event) =>{  setImportPlatform(event.target.value as ReviewPlatformId) }}
                  aria-label={t('review.import.platform')}
                >
                  {REVIEW_PLATFORMS.map(platform => (
                    <option key={platform} value={platform}>{PLATFORM_LABELS[platform]}</option>
                  ))}
                </select>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => { void onFilePicked(event.target.files?.[0]) }}
                  aria-label={t('review.import.file')}
                />
                <button type="button" disabled={state.busy || importText.length === 0} onClick={stageImport}>
                  {t('review.import.parse')}
                </button>
              </div>

              {state.preview !== null && (
                <ImportPreviewCard
                  preview={state.preview}
                  ignoredColumns={state.ignoredColumns}
                  onIgnore={(columns) =>{  review.setIgnoredColumns(columns) }}
                  onCommit={() => { void review.commitImport() }}
                  onDiscard={() =>{  review.discardImport() }}
                  t={t}
                />
              )}

              {unbound.length > 0 && (
                <div className={css.subpanel}>
                  <h4>{t('review.bind.title', { count: String(unbound.length) })}</h4>
                  <p className={css.hint}>{t('review.bind.hint')}</p>
                  <ul className={css.workList}>
                    {unbound.slice(0, 20).map(snapshot => (
                      <BindRow key={snapshot.snapshotId} snapshot={snapshot} review={review} t={t} />
                    ))}
                  </ul>
                </div>
              )}

              <BaselinesPanel review={review} manifest={manifest} t={t} />
            </section>
          )}

          {tab === 'board' && (
            <section className={css.panel}>
              <FilterPanel review={review} t={t} />
              <div className={css.cards}>
                <div className={css.statCard}>
                  <span className={css.statValue}>{summary.totalWorks}</span>
                  <span className={css.statLabel}>{t('review.stat.works')}</span>
                </div>
                <div className={css.statCard}>
                  <span className={css.statValue}>{summary.viralCount}</span>
                  <span className={css.statLabel}>{t('review.stat.viral')}</span>
                </div>
                <div className={css.statCard}>
                  <span className={css.statValue}>{percent(summary.avgEngagementRate)}</span>
                  <span className={css.statLabel}>{t('review.stat.rate')}</span>
                </div>
                <div className={css.statCard}>
                  <span className={css.statValue}>{summary.longtailCount}</span>
                  <span className={css.statLabel}>{t('review.stat.longtail')}</span>
                </div>
              </div>

              <div className={css.subpanel}>
                <h4>{t('review.board.platforms')}</h4>
                <table className={css.table}>
                  <thead>
                    <tr>
                      <th>{t('review.table.platform')}</th>
                      <th>{t('review.table.works')}</th>
                      <th>{t('review.table.impressions')}</th>
                      <th>{t('review.table.engagement')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {REVIEW_PLATFORMS.filter(platform => summary.perPlatform[platform].works > 0).map(platform => (
                      <tr key={platform}>
                        <td>{PLATFORM_LABELS[platform]}</td>
                        <td>{summary.perPlatform[platform].works}</td>
                        <td>{summary.perPlatform[platform].impressions ?? '—'}</td>
                        <td>{summary.perPlatform[platform].engagement ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className={css.hint}>{t('review.board.noSum')}</p>
              </div>

              <div className={css.subpanel}>
                <h4>{t('review.board.leaderboard')}</h4>
                {ranked.length === 0
                  ? <p className={css.empty}>{t('review.empty.pool')}</p>
                  : (
                    <ol className={css.workList}>
                      {ranked.slice(0, 10).map((snapshot, index) => {
                        const rate = engagementRateOf(snapshot.metrics)
                        return (
                          <li key={snapshot.snapshotId} className={css.workRow}>
                            <span className={css.workRank}>{index + 1}</span>
                            <span className={css.workTitle}>{snapshot.title}</span>
                            <span className={css.workMeta}>{PLATFORM_LABELS[snapshot.platformId]}</span>
                            <span className={css.workMeta}>{percent(rate)}</span>
                          </li>
                        )
                      })}
                    </ol>
                  )}
              </div>
            </section>
          )}

          {tab === 'diagnose' && (
            <section className={css.panel}>
              <h3>{t('review.diagnose.title')}</h3>
              {cards.length === 0
                ? <p className={css.empty}>{t('review.empty.pool')}</p>
                : (
                  <ul className={css.workList}>
                    {cards.map(card => (
                      <DiagnoseRow
                        key={card.snapshot.snapshotId}
                        card={card}
                        review={review}
                        persona={null}
                        t={t}
                      />
                    ))}
                  </ul>
                )}
            </section>
          )}

          {tab === 'reports' && (
            <section className={css.panel}>
              <h3>{t('review.report.title')}</h3>
              <div className={css.formRow}>
                <input
                  type="text"
                  value={taskName}
                  placeholder={t('review.report.namePlaceholder')}
                  onChange={(event) =>{  setTaskName(event.target.value) }}
                  aria-label={t('review.report.namePlaceholder')}
                />
                <button
                  type="button"
                  disabled={state.busy || taskName.trim().length === 0}
                  onClick={() => { void review.createTask(taskName.trim()).then(() =>{  setTaskName('') }) }}
                >
                  {t('review.report.generate')}
                </button>
              </div>

              {state.reportDraft !== null && (
                <div className={css.subpanel}>
                  <h4>{t('review.report.editing')}</h4>
                  <textarea
                    className={css.reportEditor}
                    value={state.reportDraft}
                    rows={18}
                    onChange={(event) =>{  review.copyReportToEditor(event.target.value) }}
                  />
                  <div className={css.formRow}>
                    <button type="button" onClick={() => { void review.saveReport() }}>{t('review.report.save')}</button>
                    <button type="button" onClick={() =>{  review.closeReport() }}>{t('review.report.close')}</button>
                    <button
                      type="button"
                      onClick={() => { void review.saveTemplate(`爆款模板-${Date.now()}`, state.reportDraft ?? '') }}
                    >
                      {t('review.report.saveTemplate')}
                    </button>
                  </div>
                </div>
              )}

              <div className={css.subpanel}>
                <h4>{t('review.history.title')}</h4>
                {(manifest?.tasks.length ?? 0) === 0
                  ? <p className={css.empty}>{t('review.history.empty')}</p>
                  : (
                    <ul className={css.workList}>
                      {[...manifest?.tasks ?? []].reverse().map(task => (
                        <TaskRow key={task.taskId} task={task} review={review} t={t} />
                      ))}
                    </ul>
                  )}
              </div>

              <div className={css.subpanel}>
                <h4>{t('review.reflow.title')}</h4>
                <p className={css.hint}>{t('review.reflow.hint')}</p>
                <div className={css.formRow}>
                  <input
                    type="text"
                    value={topicTitle}
                    placeholder={t('review.reflow.titlePlaceholder')}
                    onChange={(event) =>{  setTopicTitle(event.target.value) }}
                  />
                </div>
                <textarea
                  className={css.topicNote}
                  rows={3}
                  value={topicNote}
                  placeholder={t('review.reflow.notePlaceholder')}
                  onChange={(event) =>{  setTopicNote(event.target.value) }}
                />
                <button
                  type="button"
                  disabled={topicTitle.trim().length === 0}
                  onClick={() => {
                    void review.pushToTopicBank(topicTitle.trim(), null, topicNote.trim().length > 0 ? topicNote.trim() : null)
                      .then(() => { setTopicTitle(''); setTopicNote('') })
                  }}
                >
                  {t('review.reflow.push')}
                </button>
              </div>

              {(state.templates.length > 0) && (
                <div className={css.subpanel}>
                  <h4>{t('review.templates.title')}</h4>
                  <ul className={css.workList}>
                    {state.templates.map(file => <li key={file} className={css.workRow}>{file}</li>)}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

/** One staged import preview: counts, unknown-column checks, commit controls. */
function ImportPreviewCard({ preview, ignoredColumns, onIgnore, onCommit, onDiscard, t }: {
  preview: ReviewImportPreview
  ignoredColumns: readonly string[]
  onIgnore: (columns: readonly string[]) => void
  onCommit: () => void
  onDiscard: () => void
  t: Translate
}) {
  const toggle = (column: string): void => {
    onIgnore(ignoredColumns.includes(column)
      ? ignoredColumns.filter(candidate => candidate !== column)
      : [...ignoredColumns, column])
  }
  return (
    <div className={css.subpanel}>
      <h4>{preview.fileName} · {preview.rows.length} ✓ / {preview.rejected.length} ✗</h4>
      {preview.rejected.length > 0 && (
        <ul className={css.rejectList}>
          {preview.rejected.slice(0, 10).map(rejection => (
            <li key={rejection.row}>{t('review.import.rowRejected', { row: String(rejection.row), reason: rejection.reason })}</li>
          ))}
        </ul>
      )}
      {preview.unknownColumns.length > 0 && (
        <div>
          <p className={css.hint}>{t('review.import.unknownColumns')}</p>
          {preview.unknownColumns.map(column => (
            <label key={column} className={css.checkLabel}>
              <input
                type="checkbox"
                checked={ignoredColumns.includes(column)}
                onChange={() =>{  toggle(column) }}
              />
              {column}
            </label>
          ))}
        </div>
      )}
      <div className={css.formRow}>
        <button type="button" onClick={onCommit}>{t('review.import.commit')}</button>
        <button type="button" onClick={onDiscard}>{t('review.import.discard')}</button>
      </div>
    </div>
  )
}

/** One unbound snapshot with its manual contentId input. */
function BindRow({ snapshot, review, t }: {
  snapshot: MetricSnapshot
  review: ReviewController
  t: Translate
}) {
  const [contentId, setContentId] = useState('')
  return (
    <li className={css.workRow}>
      <span className={css.workTitle}>{snapshot.title}</span>
      <span className={css.workMeta}>{PLATFORM_LABELS[snapshot.platformId]}</span>
      <input
        type="text"
        className={css.bindInput}
        placeholder={t('review.bind.placeholder')}
        value={contentId}
        onChange={(event) =>{  setContentId(event.target.value) }}
      />
      <button
        type="button"
        disabled={contentId.trim().length === 0}
        onClick={() => { void review.bindWork(snapshot.platformWorkId, snapshot.platformId, contentId.trim()) }}
      >
        {t('review.bind.button')}
      </button>
    </li>
  )
}

/** The baselines editor: two rates plus their source label. */
function BaselinesPanel({ review, manifest, t }: {
  review: ReviewController
  manifest: { readonly baselines: { engagementRate: number; collectRate: number; source: 'user' | 'default' } } | null
  t: Translate
}) {
  const [engagement, setEngagement] = useState('')
  const [collect, setCollect] = useState('')
  const current = manifest?.baselines
  return (
    <div className={css.subpanel}>
      <h4>{t('review.baselines.title')}</h4>
      <p className={css.hint}>
        {t('review.baselines.hint')}
        {current !== undefined && ` ${t('review.baselines.current', { engagement: percent(current.engagementRate), collect: percent(current.collectRate), source: current.source === 'user' ? t('review.baselines.sourceUser') : t('review.baselines.sourceDefault') })}`}
      </p>
      <div className={css.formRow}>
        <input
          type="text"
          className={css.bindInput}
          placeholder="5%"
          value={engagement}
          onChange={(event) =>{  setEngagement(event.target.value) }}
          aria-label={t('review.baselines.engagement')}
        />
        <input
          type="text"
          className={css.bindInput}
          placeholder="2%"
          value={collect}
          onChange={(event) =>{  setCollect(event.target.value) }}
          aria-label={t('review.baselines.collect')}
        />
        <button
          type="button"
          onClick={() => {
            const parse = (text: string): number | null => {
              const value = Number.parseFloat(text.replace('%', ''))
              return Number.isFinite(value) ? value / 100 : null
            }
            const nextEngagement = parse(engagement)
            const nextCollect = parse(collect)
            if (nextEngagement !== null && nextCollect !== null) {
              void review.saveBaselines(nextEngagement, nextCollect)
              setEngagement('')
              setCollect('')
            }
          }}
        >
          {t('review.baselines.save')}
        </button>
      </div>
    </div>
  )
}

/** The filter panel: period, platforms, forms, and the verdict slice. */
function FilterPanel({ review, t }: {
  review: ReviewController
  t: Translate
}) {
  const filters = review.filters()
  const togglePlatform = (platform: string): void => {
    const next = filters.platforms.includes(platform)
      ? filters.platforms.filter(candidate => candidate !== platform)
      : [...filters.platforms, platform]
    review.setFilters({ platforms: next })
  }
  const toggleType = (kind: string): void => {
    const next = filters.contentTypes.includes(kind)
      ? filters.contentTypes.filter(candidate => candidate !== kind)
      : [...filters.contentTypes, kind]
    review.setFilters({ contentTypes: next })
  }
  return (
    <div className={css.subpanel}>
      <div className={css.formRow}>
        <input
          type="date"
          value={filters.period.from}
          onChange={(event) =>{  review.setFilters({ period: { ...filters.period, from: event.target.value } }) }}
          aria-label={t('review.filter.from')}
        />
        <input
          type="date"
          value={filters.period.to}
          onChange={(event) =>{  review.setFilters({ period: { ...filters.period, to: event.target.value } }) }}
          aria-label={t('review.filter.to')}
        />
      </div>
      <div className={css.formRow}>
        {REVIEW_PLATFORMS.map(platform => (
          <label key={platform} className={css.checkLabel}>
            <input
              type="checkbox"
              checked={filters.platforms.includes(platform)}
              onChange={() =>{  togglePlatform(platform) }}
            />
            {PLATFORM_LABELS[platform]}
          </label>
        ))}
        <label className={css.checkLabel}>
          <input
            type="checkbox"
            checked={filters.contentTypes.includes('image-text')}
            onChange={() =>{  toggleType('image-text') }}
          />
          {t('review.filter.imageText')}
        </label>
        <label className={css.checkLabel}>
          <input
            type="checkbox"
            checked={filters.contentTypes.includes('video')}
            onChange={() =>{  toggleType('video') }}
          />
          {t('review.filter.video')}
        </label>
      </div>
      <div className={css.formRow}>
        {REVIEW_WORK_FILTERS.map(candidate => (
          <label key={candidate} className={css.checkLabel}>
            <input
              type="radio"
              name="review-work-filter"
              checked={filters.workFilter === candidate}
              onChange={() =>{  review.setFilters({ workFilter: candidate }) }}
            />
            {t(`review.filter.${candidate}`)}
          </label>
        ))}
      </div>
    </div>
  )
}

/** One work row with its verdict chips and the diagnose button. */
function DiagnoseRow({ card, review, persona, t }: {
  card: WorkCard
  review: ReviewController
  persona: string | null
  t: Translate
}) {
  const key = `${card.snapshot.platformId}:${card.snapshot.platformWorkId}`
  const diagnosis = review.getState().diagnoses[key]
  const [open, setOpen] = useState(false)
  const [draftText, setDraftText] = useState('')
  const verdictClass = card.verdict === 'viral' ? css.viralChip : card.verdict === 'weak' ? css.weakChip : css.neutralChip
  return (
    <li className={css.workBlock}>
      <div className={css.workRow}>
        <button type="button" className={css.linkish} onClick={() =>{  setOpen(!open) }}>{open ? '▾' : '▸'} {card.snapshot.title}</button>
        <span className={css.workMeta}>{PLATFORM_LABELS[card.snapshot.platformId]}</span>
        <span className={css.workMeta}>{percent(engagementRateOf(card.snapshot.metrics))}</span>
        <span className={css.workMeta}>{percent(collectRateOf(card.snapshot.metrics))}</span>
        <span className={`${css.chip} ${verdictClass}`}>{t(`review.verdict.${card.longtail ? 'longtail' : card.verdict}`)}</span>
        <button
          type="button"
          disabled={review.getState().busy}
          onClick={() => { void review.diagnoseWork(card, draftText.length > 0 ? draftText : null, [], persona) }}
        >
          {t('review.diagnose.run')}
        </button>
      </div>
      {open && (
        <div className={css.workDetail}>
          <p className={css.hint}>{t('review.diagnose.draftHint')}</p>
          <textarea
            className={css.topicNote}
            rows={3}
            value={draftText}
            onChange={(event) =>{  setDraftText(event.target.value) }}
          />
          {diagnosis !== undefined && <pre className={css.diagnosis}>{diagnosis}</pre>}
        </div>
      )}
    </li>
  )
}

/** One history task row: status, report actions, delete. */
function TaskRow({ task, review, t }: {
  task: { taskId: string; name: string; period: { from: string; to: string }; status: string; degraded: boolean; reportFile: string | null }
  review: ReviewController
  t: Translate
}) {
  return (
    <li className={css.workRow}>
      <span className={css.workTitle}>{task.name}</span>
      <span className={css.workMeta}>{task.period.from} ~ {task.period.to}</span>
      <span className={`${css.chip} ${task.status === 'ready' && !task.degraded ? css.viralChip : task.status === 'failed' ? css.weakChip : css.neutralChip}`}>
        {t(`review.status.${task.degraded ? 'degraded' : task.status}` as StudioKey)}
      </span>
      {task.reportFile !== null && (
        <button type="button" onClick={() => { void review.editReport(task.taskId) }}>
          {t('review.history.view')}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          if (!window.confirm(t('review.history.deleteConfirm'))) return
          void review.deleteTask(task.taskId)
        }}
      >
        {t('review.history.delete')}
      </button>
    </li>
  )
}
