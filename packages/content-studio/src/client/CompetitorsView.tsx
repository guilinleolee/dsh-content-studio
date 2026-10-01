/**
 * The competitors view (对标账号): benchmark-account registry in the browser,
 * works library on disk behind the content-outputs competitor write face,
 * AI teardown and report generation behind explicit buttons, and the
 * catch-up banner replacing phase-one scheduling. Storage split follows the
 * competitor plan: accounts live in localStorage (with JSON import/export),
 * works, snapshots, analysis state, and reports live in the theme manifest.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { IconRefreshOutline14, IconTrashOutline16, IconWarningOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  CompetitorAccountDigest, CompetitorAnalyzeWorkRequest, CompetitorAnalyzeWorkResult,
  CompetitorManifest, CompetitorManifestRead, CompetitorMetricSnapshot, CompetitorPlatform,
  CompetitorReport, CompetitorReportId, CompetitorReportRequest, CompetitorReportResult, CompetitorWork,
  ContentOutputsSnapshot, OutputProject,
} from '@deepseek-ai/dsh-content-outputs/types'
import {
  aggregateAccountDigest, buildIdeaMarkdown, COMPETITOR_PLATFORMS, competitorWorkToTopicInput,
  exportAccounts, heatByWork, importAccounts, interactionScore, isAccountStale, loadAccounts,
  newId, saveAccounts, upsertWork,
  type CompetitorAccount,
} from './competitors.ts'
import type { TopicBankGateway } from './TopicBankView.tsx'
import type { StudioKey } from './locales.ts'
import css from './ContentStudio.module.css'

/** localStorage key of the last opened theme. */
const THEME_STORAGE_KEY = 'dsh-content-studio.competitors.theme'

/** Pre-alignment theme key; read when the aligned key is absent. */
const THEME_LEGACY_STORAGE_KEY = 'content-studio.competitors.theme'

/** Injected face of the competitors view: the Remote wrappers it needs. */
export interface CompetitorsViewInjected {
  /** The topic-bank face the 收录为选题 push rides. */
  topics: TopicBankGateway
  listOutputs: () => Promise<ContentOutputsSnapshot>
  readCompetitorManifest: (theme: string) => Promise<CompetitorManifestRead>
  writeCompetitorManifest: (theme: string, manifest: CompetitorManifest) => Promise<void>
  writeAsset: (write: { theme: string; file: string; content: string }) => Promise<{ truncated: boolean }>
  deleteAsset: (theme: string, file: string) => Promise<void>
  readAsset: (theme: string, file: string) => Promise<{ content?: string }>
  analyzeCompetitorWork: (request: CompetitorAnalyzeWorkRequest) => Promise<CompetitorAnalyzeWorkResult>
  generateCompetitorReport: (request: CompetitorReportRequest) => Promise<CompetitorReportResult>
}

/** Full view props: the injected face plus the locale seat. */
export type CompetitorsViewProps = CompetitorsViewInjected & PropsLocale<'content-studio'>

/** The view's three sections. */
type CompetitorSection = 'accounts' | 'works' | 'reports'

/** Section tab order. */
const SECTIONS: readonly CompetitorSection[] = ['accounts', 'works', 'reports']

/** Locale key per section tab. */
const SECTION_KEYS: Record<CompetitorSection, StudioKey> = {
  accounts: 'comp.section.accounts',
  works: 'comp.section.works',
  reports: 'comp.section.reports',
}

/** Locale key per platform. */
const PLATFORM_KEYS: Record<CompetitorPlatform, StudioKey> = {
  xhs: 'comp.platform.xhs',
  douyin: 'comp.platform.douyin',
  wechat: 'comp.platform.wechat',
  bili: 'comp.platform.bili',
  zhihu: 'comp.platform.zhihu',
  toutiao: 'comp.platform.toutiao',
}

/** Priority → its badge modifier class. */
const PRIORITY_CLASS = {
  high: css.compBadgeHot ?? '',
  medium: css.statusDraft ?? '',
  low: css.badgeIncoming ?? '',
} as const

/** Empty-manifest stand-in while no theme is open. */
const EMPTY_MANIFEST: CompetitorManifest = { formatVersion: 0, syncedAt: {}, works: [], reports: [] }

/** Draft fields of the account form. */
interface AccountForm {
  id: string | undefined
  name: string
  platform: CompetitorPlatform
  homepageUrl: string
  topics: string
  priority: CompetitorAccount['priority']
  intervalDays: CompetitorAccount['intervalDays']
  positioning: string
  followerTier: string
  monetization: string
  note: string
}

/** Fresh account form pre-filled with an account, when editing. */
function accountForm(account?: CompetitorAccount): AccountForm {
  return {
    id: account?.id,
    name: account?.name ?? '',
    platform: account?.platform ?? 'xhs',
    homepageUrl: account?.homepageUrl ?? '',
    topics: account?.topics.join(' ') ?? '',
    priority: account?.priority ?? 'medium',
    intervalDays: account?.intervalDays ?? 3,
    positioning: account?.positioning ?? '',
    followerTier: account?.followerTier ?? '',
    monetization: account?.monetization ?? '',
    note: account?.note ?? '',
  }
}

/** Draft fields of the manual work import form. */
interface WorkForm {
  accountId: string
  platform: CompetitorPlatform
  platformWorkId: string
  title: string
  url: string
  publishedDate: string
  likes: string
  comments: string
  shares: string
  views: string
  body: string
}

/** Fresh work import form pre-filled with the given account. */
function workForm(accountId: string, platform: CompetitorPlatform): WorkForm {
  return {
    accountId,
    platform,
    platformWorkId: '',
    title: '',
    url: '',
    publishedDate: '',
    likes: '',
    comments: '',
    shares: '',
    views: '',
    body: '',
  }
}

/** Parse one numeric form field; blank reads as zero. */
function numberField(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0
}

/**
 * Render the competitors view.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export function CompetitorsView(props: CompetitorsViewProps) {
  const {
    listOutputs, readCompetitorManifest, writeCompetitorManifest, writeAsset, deleteAsset, readAsset,
    analyzeCompetitorWork, generateCompetitorReport, topics, t,
  } = props
  const [accounts, setAccounts] = useState<readonly CompetitorAccount[]>(() => loadAccounts().accounts)
  const [storageDegraded, setStorageDegraded] = useState(false)
  const [section, setSection] = useState<CompetitorSection>('works')
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) ?? localStorage.getItem(THEME_LEGACY_STORAGE_KEY) ?? '')
  const [projects, setProjects] = useState<readonly OutputProject[]>([])
  const [manifest, setManifest] = useState<CompetitorManifest | undefined>(undefined)
  const [manifestProblems, setManifestProblems] = useState<readonly string[]>([])
  const [manifestError, setManifestError] = useState<string | undefined>(undefined)
  const [accountForm, setAccountForm] = useState<AccountForm | undefined>(undefined)
  const [importOpen, setImportOpen] = useState(false)
  const [workFormState, setWorkFormState] = useState<WorkForm>(workForm('', 'xhs'))
  const [query, setQuery] = useState('')
  const [flagFilter, setFlagFilter] = useState<'all' | 'hot' | 'favorite' | 'analyzed' | 'unanalyzed'>('all')
  const [selectedWorkId, setSelectedWorkId] = useState<string | undefined>(undefined)
  const [previewText, setPreviewText] = useState<string | undefined>(undefined)
  const [commentsDraft, setCommentsDraft] = useState('')
  const [pendingAnalysis, setPendingAnalysis] = useState<readonly string[]>([])
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>(undefined)
  const [reportText, setReportText] = useState<string | undefined>(undefined)
  const [compareIds, setCompareIds] = useState<readonly string[]>([])
  const [generating, setGenerating] = useState(false)
  const [actionError, setActionError] = useState<string | undefined>(undefined)

  const persistAccounts = useCallback((next: readonly CompetitorAccount[]): void => {
    setAccounts(next)
    setStorageDegraded(!saveAccounts(next))
  }, [])

  const selectTheme = useCallback((next: string): void => {
    setTheme(next)
    try { localStorage.setItem(THEME_STORAGE_KEY, next) } catch { /* best effort */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    listOutputs().then(
      (snapshot) => { if (!cancelled) setProjects(snapshot.projects) },
      (error: unknown) => { console.error('[content-studio] contentOutputs/list failed:', error) },
    )
    return () => { cancelled = true }
  }, [listOutputs])

  useEffect(() => {
    if (theme.length === 0) { setManifest(undefined); setManifestProblems([]); setManifestError(undefined); return }
    let cancelled = false
    setManifestError(undefined)
    readCompetitorManifest(theme).then(
      (read) => {
        if (cancelled) return
        setManifest(read.manifest)
        setManifestProblems(read.problems)
      },
      (error: unknown) => {
        if (cancelled) return
        console.error('[content-studio] contentOutputs/readCompetitorManifest failed:', error)
        setManifestError(error instanceof Error ? error.message : String(error))
      },
    )
    return () => { cancelled = true }
  }, [theme, readCompetitorManifest])

  const commitManifest = useCallback(async (next: CompetitorManifest): Promise<void> => {
    await writeCompetitorManifest(theme, next)
    setManifest(next)
  }, [theme, writeCompetitorManifest])

  const current = manifest ?? EMPTY_MANIFEST
  const heat = useMemo(() => heatByWork(current.works), [current.works])
  const stale = useMemo(
    () => manifest === undefined ? [] : accounts.filter(account => isAccountStale(account, manifest, new Date())),
    [accounts, manifest],
  )
  const works = useMemo(() => {
    const filtered = current.works.filter((work) => {
      if (flagFilter === 'hot' && !work.hot) return false
      if (flagFilter === 'favorite' && !work.favorite) return false
      if (flagFilter === 'analyzed' && work.analysis.status !== 'done') return false
      if (flagFilter === 'unanalyzed' && work.analysis.status === 'done') return false
      if (query.trim().length > 0) {
        const needle = query.trim().toLowerCase()
        const haystack = `${work.title} ${work.accountName}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
    return [...filtered].sort((a, b) => Date.parse(b.publishedAt ?? b.importedAt) - Date.parse(a.publishedAt ?? a.importedAt))
  }, [current.works, flagFilter, query])
  const selectedWork = current.works.find(work => work.id === selectedWorkId)
  const selectedReport = current.reports.find(report => report.id === selectedReportId)

  useEffect(() => {
    if (selectedWork?.textFile === undefined || theme.length === 0) { setPreviewText(undefined); return }
    let cancelled = false
    readAsset(theme, selectedWork.textFile).then(
      (result) => { if (!cancelled) setPreviewText(result.content) },
      () => { if (!cancelled) setPreviewText(undefined) },
    )
    return () => { cancelled = true }
  }, [selectedWork?.textFile, theme, readAsset])

  useEffect(() => {
    if (selectedReport === undefined || theme.length === 0) { setReportText(undefined); return }
    let cancelled = false
    readAsset(theme, selectedReport.ref).then(
      (result) => { if (!cancelled) setReportText(result.content) },
      () => { if (!cancelled) setReportText(undefined) },
    )
    return () => { cancelled = true }
  }, [selectedReport, theme, readAsset])

  /** Wrap one mutating action: surface its failure once, then clear it. */
  const act = async (action: () => Promise<void>): Promise<void> => {
    setActionError(undefined)
    try {
      await action()
    } catch (error) {
      console.error('[content-studio] competitors action failed:', error)
      setActionError(error instanceof Error ? error.message : String(error))
    }
  }

  const submitAccount = (): void => {
    if (accountForm === undefined || accountForm.name.trim().length === 0) return
    if (accountForm.id !== undefined) {
      persistAccounts(accounts.map(account => account.id === accountForm.id
        ? { ...account, ...accountForm, id: account.id, topics: accountForm.topics.split(/\s+/u).filter(part => part.length > 0) }
        : account))
    } else {
      persistAccounts([...accounts, {
        ...accountForm,
        id: newId('acc'),
        enabled: true,
        topics: accountForm.topics.split(/\s+/u).filter(part => part.length > 0),
        createdAt: new Date().toISOString(),
      }])
    }
    setAccountForm(undefined)
  }

  const removeAccount = (account: CompetitorAccount): void => {
    if (!window.confirm(t('comp.removeAccountConfirm'))) return
    persistAccounts(accounts.filter(candidate => candidate.id !== account.id))
    if (accountForm?.id === account.id) setAccountForm(undefined)
  }

  const importAccountFile = async (file: File): Promise<void> => {
    const result = importAccounts(await file.text(), accounts)
    persistAccounts(result.accounts)
    setActionError(t('comp.importResult', { added: result.added, skipped: result.skipped }))
  }

  const exportAccountFile = (): void => {
    const blob = new Blob([exportAccounts(accounts)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'competitor-accounts.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const submitWork = (): void => {
    if (workFormState.title.trim().length === 0) return
    const account = accounts.find(candidate => candidate.id === workFormState.accountId)
    void act(async () => {
      const id = newId('cw')
      const textFile = workFormState.body.trim().length > 0 ? `${id}.md` : undefined
      if (textFile !== undefined) {
        await writeAsset({ theme, file: textFile, content: `${workFormState.body.trim()}\n` })
      }
      const metrics: CompetitorMetricSnapshot = {
        t: new Date().toISOString(),
        likes: numberField(workFormState.likes),
        comments: numberField(workFormState.comments),
        shares: numberField(workFormState.shares),
        ...(workFormState.views.trim().length > 0 ? { views: numberField(workFormState.views) } : {}),
      }
      const upsert = upsertWork(current, {
        accountId: account?.id ?? 'unassigned',
        accountName: account?.name ?? t('comp.unassigned'),
        platform: workFormState.platform,
        platformWorkId: workFormState.platformWorkId,
        title: workFormState.title.trim(),
        ...(workFormState.url.trim().length > 0 ? { url: workFormState.url.trim() } : {}),
        ...(workFormState.publishedDate.length > 0 ? { publishedAt: new Date(workFormState.publishedDate).toISOString() } : {}),
        ...(textFile !== undefined ? { textFile } : {}),
        metrics,
      })
      await commitManifest(upsert.manifest)
      setImportOpen(false)
      setWorkFormState(workForm(account?.id ?? '', workFormState.platform))
    })
  }

  const toggleFlag = (work: CompetitorWork, flag: 'hot' | 'favorite'): void => {
    void act(async () => {
      await commitManifest({
        ...current,
        works: current.works.map(candidate => candidate.id === work.id ? { ...candidate, [flag]: !candidate[flag] } : candidate),
      })
    })
  }

  const removeWork = (work: CompetitorWork): void => {
    // Removal deletes the work's asset snapshots from disk, so it is guarded
    // like the other destructive actions instead of firing on a single click.
    if (!window.confirm(t('comp.removeWorkConfirm'))) return
    void act(async () => {
      const files = [work.textFile, work.analysis.ref].filter((file): file is string => file !== undefined)
      for (const file of files) await deleteAsset(theme, file)
      await commitManifest({
        ...current,
        works: current.works.filter(candidate => candidate.id !== work.id),
      })
      if (selectedWorkId === work.id) setSelectedWorkId(undefined)
    })
  }

  const analyze = (work: CompetitorWork): void => {
    if (pendingAnalysis.includes(work.id)) return
    setPendingAnalysis(pending => [...pending, work.id])
    void act(async () => {
      const score = interactionScore(work.metrics)
      try {
        const result = await analyzeCompetitorWork({
          theme,
          ...(work.textFile !== undefined ? { textFile: work.textFile } : {}),
          title: work.title,
          ...(work.url !== undefined ? { url: work.url } : {}),
          stats: t('comp.statLine', { score, likes: work.metrics.at(-1)?.likes ?? 0, comments: work.metrics.at(-1)?.comments ?? 0, shares: work.metrics.at(-1)?.shares ?? 0 }),
          ...(commentsDraft.trim().length > 0 ? { comments: commentsDraft.trim() } : {}),
        })
        const ref = `ca-${work.id.slice(3)}.md`
        await writeAsset({ theme, file: ref, content: result.markdown })
        await commitManifest({
          ...current,
          works: current.works.map(candidate => candidate.id === work.id
            ? {
              ...candidate,
              analysis: {
                status: 'done' as const,
                ref,
                result: {
                  hookType: result.hookType,
                  structure: result.structure,
                  painPoints: result.painPoints,
                  topics: result.topics,
                  risks: result.risks,
                  reusable: result.reusable,
                  migrationTopics: result.migrationTopics,
                  commentInsight: result.commentInsight,
                },
              },
            }
            : candidate),
        })
      } catch (error) {
        await commitManifest({
          ...current,
          works: current.works.map(candidate => candidate.id === work.id
            ? { ...candidate, analysis: { status: 'failed' as const, error: error instanceof Error ? error.message : String(error) } }
            : candidate),
        })
        throw error
      } finally {
        setPendingAnalysis(pending => pending.filter(id => id !== work.id))
      }
    })
  }

  const collectNow = (accountIds: readonly string[]): void => {
    if (manifest === undefined) return
    const syncedAt = { ...manifest.syncedAt }
    for (const id of accountIds) syncedAt[id] = new Date().toISOString()
    void act(() => commitManifest({ ...manifest, syncedAt }))
  }

  const addIdea = (work: CompetitorWork): void => {
    void act(async () => {
      // The topic bank is the primary target: one benchmark work yields one
      // topic, ever — the list check makes a retry after a half-done round
      // (topic landed, file write failed) a pure marker backfill.
      const bank = await topics.list()
      const exists = bank.items.some(topic => topic.source.type === 'benchmark' && topic.source.refId === work.id)
      if (!exists) await topics.put(competitorWorkToTopicInput(work, new Date().toISOString()))
      const file = `idea-${work.id.slice(3)}.md`
      await writeAsset({ theme, file, content: buildIdeaMarkdown(work, work.analysis.result?.migrationTopics[0]) })
      await commitManifest({
        ...current,
        works: current.works.map(candidate => candidate.id === work.id ? { ...candidate, collectedIdeaRef: file } : candidate),
      })
    })
  }

  const generate = (kind: 'account' | 'compare', ids: readonly string[]): void => {
    if (manifest === undefined || generating) return
    const chosen = accounts.filter(account => ids.includes(account.id))
    if (chosen.length !== ids.length) return
    setGenerating(true)
    void act(async () => {
      try {
        const digests: CompetitorAccountDigest[] = chosen.map(account => ({
          name: account.name,
          digest: aggregateAccountDigest(account.name, account.platform, current.works.filter(work => work.accountId === account.id)),
        }))
        const result = await generateCompetitorReport({ kind, accounts: digests })
        const id = newId('cr')
        const ref = `${id}.md`
        await writeAsset({ theme, file: ref, content: result.markdown })
        const report: CompetitorReport = {
          // The report id is the gateway's branded type; this view mints it.
          id: id as CompetitorReportId,
          kind,
          accountIds: chosen.map(account => account.id),
          accountNames: chosen.map(account => account.name),
          ref,
          createdAt: new Date().toISOString(),
          workCount: chosen.reduce((sum, account) => sum + current.works.filter(work => work.accountId === account.id).length, 0),
        }
        await commitManifest({ ...manifest, reports: [report, ...manifest.reports] })
        setSelectedReportId(id)
      } finally {
        setGenerating(false)
      }
    })
  }

  const themeInput = (
    <label className={css.compThemeRow}>
      <span>{t('comp.theme')}</span>
      <input
        className={css.compInput}
        list="comp-theme-options"
        placeholder={t('comp.themePlaceholder')}
        value={theme}
        onChange={(event) => { selectTheme(event.currentTarget.value) }}
      />
      <datalist id="comp-theme-options">
        {projects.map(project => <option key={project.topic} value={project.topic} />)}
      </datalist>
    </label>
  )

  const sectionBar = (
    <div className={css.compSections} role="tablist">
      {SECTIONS.map(candidate => (
        <button
          key={candidate}
          type="button"
          role="tab"
          aria-selected={section === candidate}
          className={clsx(css.tab, section === candidate && css.tabActive)}
          onClick={() => { setSection(candidate) }}
        >
          {t(SECTION_KEYS[candidate])}
        </button>
      ))}
    </div>
  )

  return (
    <div className={css.comp}>
      <div className={css.compToolbar}>
        {themeInput}
        {sectionBar}
      </div>

      {theme.length === 0 && <div className={css.compBanner}>{t('comp.noTheme')}</div>}
      {storageDegraded && <div className={css.compBanner}>{t('comp.storageDegraded')}</div>}
      {manifestError !== undefined && (
        <div className={css.compBanner}>
          <IconWarningOutline16 size={14} />
          <span>{t('comp.manifestError')}: {manifestError}</span>
        </div>
      )}
      {manifestProblems.length > 0 && (
        <div className={css.compBanner} role="alert">
          <IconWarningOutline16 size={14} />
          <span>{t('comp.manifestProblems', { n: manifestProblems.length })}</span>
        </div>
      )}
      {manifest !== undefined && stale.length > 0 && section !== 'accounts' && (
        <div className={css.compBanner}>
          <span>{t('comp.stale', { names: stale.map(account => account.name).join('、') })}</span>
          <button type="button" className={css.retry} onClick={() => { collectNow(stale.map(account => account.id)) }}>
            {t('comp.markCollected')}
          </button>
        </div>
      )}
      {actionError !== undefined && <div className={css.compBanner}>{t('comp.actionError')}: {actionError}</div>}

      {section === 'accounts' && (
        <AccountsSection
          accounts={accounts}
          form={accountForm}
          onForm={setAccountForm}
          onSubmit={submitAccount}
          onRemove={removeAccount}
          onImport={(file) => { void importAccountFile(file) }}
          onExport={exportAccountFile}
          onToggle={(account) => {
            persistAccounts(accounts.map(candidate => (
              candidate.id === account.id ? { ...candidate, enabled: !candidate.enabled } : candidate
            )))
          }}
          manifest={manifest}
          onCollect={(ids) => { collectNow(ids) }}
          t={t}
        />
      )}

      {section === 'works' && (
        <div className={css.compSplit}>
          <div className={css.compListPane}>
            <div className={css.compFilterRow}>
              <select
                className={css.compInput}
                value={workFormState.accountId}
                onChange={(event) => { setWorkFormState(workForm(event.currentTarget.value, workFormState.platform)) }}
              >
                <option value="">{t('comp.filterAllAccounts')}</option>
                {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
              <select
                className={css.compInput}
                value={flagFilter}
                onChange={(event) => { setFlagFilter(event.currentTarget.value as typeof flagFilter) }}
              >
                <option value="all">{t('comp.filterAll')}</option>
                <option value="hot">{t('comp.filterHot')}</option>
                <option value="favorite">{t('comp.filterFavorite')}</option>
                <option value="analyzed">{t('comp.filterAnalyzed')}</option>
                <option value="unanalyzed">{t('comp.filterUnanalyzed')}</option>
              </select>
              <input className={css.compInput} placeholder={t('comp.search')} value={query} onChange={(event) => { setQuery(event.currentTarget.value) }} />
            </div>
            <div className={css.compImportRow}>
              <button type="button" className={css.retry} disabled={theme.length === 0} onClick={() => { setImportOpen(!importOpen) }}>
                {importOpen ? t('comp.importClose') : t('comp.importOpen')}
              </button>
              <span className={css.listMeta}>{t('comp.workCount', { n: current.works.length })}</span>
            </div>
            {importOpen && (
              <WorkImportForm
                form={workFormState}
                accounts={accounts}
                onForm={setWorkFormState}
                onSubmit={submitWork}
                disabled={theme.length === 0}
                t={t}
              />
            )}
            <div className={css.compWorkList}>
              {works.length === 0
                ? <p className={css.panelEmpty}>{t('comp.worksEmpty')}</p>
                : works.map(work => (
                  <WorkRow
                    key={work.id}
                    work={work}
                    heat={heat.get(work.id)}
                    pending={pendingAnalysis.includes(work.id)}
                    active={work.id === selectedWorkId}
                    onOpen={() => { setSelectedWorkId(work.id); setCommentsDraft('') }}
                    t={t}
                  />
                ))}
            </div>
          </div>
          <div className={css.compDetailPane}>
            {selectedWork === undefined
              ? <p className={css.panelEmpty}>{t('comp.pickWork')}</p>
              : (
                <WorkDetail
                  work={selectedWork}
                  themeReady={theme.length > 0}
                  pending={pendingAnalysis.includes(selectedWork.id)}
                  previewText={previewText}
                  commentsDraft={commentsDraft}
                  onCommentsDraft={setCommentsDraft}
                  onAnalyze={() => { analyze(selectedWork) }}
                  onToggleHot={() => { toggleFlag(selectedWork, 'hot') }}
                  onToggleFavorite={() => { toggleFlag(selectedWork, 'favorite') }}
                  onIdea={() => { addIdea(selectedWork) }}
                  onRemove={() => { removeWork(selectedWork) }}
                  t={t}
                />
              )}
          </div>
        </div>
      )}

      {section === 'reports' && (
        <div className={css.compSplit}>
          <div className={css.compListPane}>
            <div className={css.compReportPicker}>
              <p className={css.compFieldLabel}>{t('comp.reportAccount')}</p>
              <select
                className={css.compInput}
                value={compareIds[0] ?? ''}
                onChange={(event) => { setCompareIds([event.currentTarget.value]) }}
              >
                <option value="">{t('comp.pickAccount')}</option>
                {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
              <button
                type="button"
                className={css.retry}
                disabled={theme.length === 0 || generating || compareIds.length !== 1}
                onClick={() => {
                  const first = compareIds[0]
                  if (first !== undefined) generate('account', [first])
                }}
              >
                {t('comp.generateAccountReport')}
              </button>
              <p className={css.compFieldLabel}>{t('comp.reportCompare')}</p>
              <select
                className={css.compInput}
                value={compareIds[1] ?? ''}
                onChange={(event) => { setCompareIds([compareIds[0] ?? '', event.currentTarget.value].filter(id => id.length > 0).slice(0, 2)) }}
              >
                <option value="">{t('comp.pickAccount')}</option>
                {accounts
                  .filter(account => account.id !== compareIds[0])
                  .map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
              <button
                type="button"
                className={css.retry}
                disabled={theme.length === 0 || generating || compareIds.length !== 2}
                onClick={() => { generate('compare', compareIds) }}
              >
                {t('comp.generateCompareReport')}
              </button>
              {generating && <p className={css.panelEmpty}>{t('comp.generating')}</p>}
            </div>
            <div className={css.compWorkList}>
              {current.reports.length === 0
                ? <p className={css.panelEmpty}>{t('comp.reportsEmpty')}</p>
                : current.reports.map(report => (
                  <button
                    key={report.id}
                    type="button"
                    className={clsx(css.listRowButton, report.id === selectedReportId && css.listRowCopied)}
                    onClick={() => { setSelectedReportId(report.id) }}
                  >
                    <span className={css.listTitle}>{t(report.kind === 'account' ? 'comp.reportKindAccount' : 'comp.reportKindCompare')} · {report.accountNames.join(' vs ')}</span>
                    <span className={css.listMeta}>{report.createdAt.slice(0, 10)} · {t('comp.reportWorks', { n: report.workCount })}</span>
                  </button>
                ))}
            </div>
          </div>
          <div className={css.compDetailPane}>
            {selectedReport === undefined
              ? <p className={css.panelEmpty}>{t('comp.pickReport')}</p>
              : <pre className={css.compReport}>{reportText ?? t('comp.reportLoading')}</pre>}
          </div>
        </div>
      )}

      <p className={css.compCompliance}>{t('comp.compliance')}</p>
    </div>
  )
}

/** One work row in the list: title, account, heat badge, and analysis state. */
function WorkRow({ work, heat, pending, active, onOpen, t }: {
  work: CompetitorWork
  heat: { level: 'hot' | 'normal' | 'cold'; score: number } | undefined
  pending: boolean
  active: boolean
  onOpen: () => void
  t: PropsLocale<'content-studio'>['t']
}) {
  const analysisKey: StudioKey = pending
    ? 'comp.analysisRunning'
    : work.analysis.status === 'done' ? 'comp.analysisDone' : work.analysis.status === 'failed' ? 'comp.analysisFailed' : 'comp.analysisNone'
  return (
    <button type="button" className={clsx(css.listRowButton, active && css.listRowCopied)} onClick={onOpen}>
      <span className={css.listTitle}>{work.hot && '🔥 '}{work.title}</span>
      <span className={css.listMeta}>{work.accountName} · {t(PLATFORM_KEYS[work.platform])}</span>
      <span className={css.listMeta}>
        {heat !== undefined && <span className={clsx(css.badge, heat.level === 'hot' ? css.compBadgeHot : heat.level === 'cold' ? css.badgeIncoming : css.statusDraft)}>{t(`comp.heat.${heat.level}`)}</span>}
        {' '}
        <span className={clsx(css.badge, work.analysis.status === 'done' ? css.badgeDone : work.analysis.status === 'failed' ? css.compBadgeFailed : css.badgeIncoming)}>{t(analysisKey)}</span>
      </span>
    </button>
  )
}

/** The work detail pane: facts, markers, actions, teardown result, and preview. */
function WorkDetail({
  work, themeReady, pending, previewText, commentsDraft, onCommentsDraft, onAnalyze, onToggleHot, onToggleFavorite, onIdea, onRemove, t,
}: {
  work: CompetitorWork
  themeReady: boolean
  pending: boolean
  previewText: string | undefined
  commentsDraft: string
  onCommentsDraft: (value: string) => void
  onAnalyze: () => void
  onToggleHot: () => void
  onToggleFavorite: () => void
  onIdea: () => void
  onRemove: () => void
  t: PropsLocale<'content-studio'>['t']
}) {
  const result = work.analysis.result
  return (
    <div className={css.compDetail}>
      <div className={css.compDetailHead}>
        <strong className={css.compDetailTitle}>{work.title}</strong>
        <span className={css.listMeta}>
          {work.accountName} · {t(PLATFORM_KEYS[work.platform])}
          {work.publishedAt !== undefined && ` · ${work.publishedAt.slice(0, 10)}`}
          {work.url !== undefined && <> · <a href={work.url} target="_blank" rel="noreferrer">{t('comp.openOriginal')}</a></>}
        </span>
      </div>
      <div className={css.compActions}>
        <button type="button" className={css.retry} disabled={!themeReady || pending} onClick={onAnalyze}>{pending ? t('comp.analysisRunning') : work.analysis.status === 'done' ? t('comp.reanalyze') : t('comp.analyze')}</button>
        <button type="button" className={css.retry} onClick={onToggleHot}>{work.hot ? t('comp.unmarkHot') : t('comp.markHot')}</button>
        <button type="button" className={css.retry} onClick={onToggleFavorite}>{work.favorite ? t('comp.unmarkFavorite') : t('comp.markFavorite')}</button>
        <button type="button" className={css.retry} disabled={!themeReady || work.collectedIdeaRef !== undefined} onClick={onIdea} title={work.collectedIdeaRef}>{t('comp.addIdea')}</button>
        <button type="button" className={css.retry} onClick={onRemove} aria-label={t('comp.removeWork')}><IconTrashOutline16 size={12} /></button>
      </div>
      {work.analysis.status === 'failed' && (
        <div className={css.compBanner} role="alert">
          <IconWarningOutline16 size={14} />
          <span>{t('comp.analysisFailed')}: {work.analysis.error}</span>
        </div>
      )}
      {result !== undefined && (
        <div className={css.compResult}>
          <p className={css.compResultLine}><strong>{t('comp.hookType')}</strong>{result.hookType}</p>
          <p className={css.compResultLine}><strong>{t('comp.structure')}</strong>{result.structure}</p>
          <ListBlock label={t('comp.painPoints')} values={result.painPoints} />
          <ListBlock label={t('comp.topics')} values={result.topics} />
          <ListBlock label={t('comp.risks')} values={result.risks} />
          <ListBlock label={t('comp.reusable')} values={result.reusable} />
          <ListBlock label={t('comp.migrationTopics')} values={result.migrationTopics} />
          <p className={css.compResultLine}>
            <strong>{t('comp.commentInsight')}</strong>
            {result.commentInsight === 'unavailable' ? t('comp.commentUnavailable') : result.commentInsight}
          </p>
        </div>
      )}
      <label className={css.compFieldLabel}>
        {t('comp.commentsInput')}
        <textarea className={css.compTextarea} rows={3} value={commentsDraft} onChange={(event) => { onCommentsDraft(event.currentTarget.value) }} placeholder={t('comp.commentsPlaceholder')} />
      </label>
      <details className={css.compPreview}>
        <summary>{t('comp.previewBody')}</summary>
        {work.textFile === undefined
          ? <p className={css.panelEmpty}>{t('comp.noBody')}</p>
          : <pre className={css.compReport}>{previewText === undefined ? t('comp.reportLoading') : previewText}</pre>}
      </details>
    </div>
  )
}

/** One labeled string list inside the teardown result. */
function ListBlock({ label, values }: { label: string; values: readonly string[] }) {
  if (values.length === 0) return null
  return (
    <div className={css.compResultLine}>
      <strong>{label}</strong>
      <ul className={css.compResultList}>
        {values.map(value => <li key={value}>{value}</li>)}
      </ul>
    </div>
  )
}

/** The manual import form (phase-one collection path). */
function WorkImportForm({ form, accounts, onForm, onSubmit, disabled, t }: {
  form: WorkForm
  accounts: readonly CompetitorAccount[]
  onForm: (form: WorkForm) => void
  onSubmit: () => void
  disabled: boolean
  t: PropsLocale<'content-studio'>['t']
}) {
  const field = (key: keyof WorkForm) => (event: { currentTarget: { value: string } }) => {
    onForm({ ...form, [key]: event.currentTarget.value })
  }
  return (
    <form className={css.compForm} onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
      <div className={css.compFormRow}>
        <select className={css.compInput} value={form.accountId} onChange={field('accountId')} aria-label={t('comp.fieldAccount')}>
          <option value="">{t('comp.fieldAccount')}</option>
          {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
        <select className={css.compInput} value={form.platform} onChange={field('platform')} aria-label={t('comp.fieldPlatform')}>
          {COMPETITOR_PLATFORMS.map(platform => <option key={platform} value={platform}>{t(PLATFORM_KEYS[platform])}</option>)}
        </select>
      </div>
      <input className={css.compInput} placeholder={t('comp.fieldTitle')} value={form.title} onChange={field('title')} />
      <div className={css.compFormRow}>
        <input className={css.compInput} placeholder={t('comp.fieldWorkId')} value={form.platformWorkId} onChange={field('platformWorkId')} />
        <input className={css.compInput} placeholder={t('comp.fieldUrl')} value={form.url} onChange={field('url')} />
      </div>
      <div className={css.compFormRow}>
        <input className={css.compInput} type="date" aria-label={t('comp.fieldPublished')} value={form.publishedDate} onChange={field('publishedDate')} />
        <input className={css.compInput} inputMode="numeric" placeholder={t('comp.fieldLikes')} value={form.likes} onChange={field('likes')} />
        <input className={css.compInput} inputMode="numeric" placeholder={t('comp.fieldComments')} value={form.comments} onChange={field('comments')} />
        <input className={css.compInput} inputMode="numeric" placeholder={t('comp.fieldShares')} value={form.shares} onChange={field('shares')} />
        <input className={css.compInput} inputMode="numeric" placeholder={t('comp.fieldViews')} value={form.views} onChange={field('views')} />
      </div>
      <textarea className={css.compTextarea} rows={4} placeholder={t('comp.fieldBody')} value={form.body} onChange={field('body')} />
      <div className={css.compFormRow}>
        <button type="submit" className={css.retry} disabled={disabled || form.title.trim().length === 0}>{t('comp.importSubmit')}</button>
        <span className={css.listMeta}>{t('comp.importHint')}</span>
      </div>
    </form>
  )
}

/** The account registry section. */
function AccountsSection({ accounts, form, onForm, onSubmit, onRemove, onImport, onExport, onToggle, manifest, onCollect, t }: {
  accounts: readonly CompetitorAccount[]
  form: AccountForm | undefined
  onForm: (form: AccountForm | undefined) => void
  onSubmit: () => void
  onRemove: (account: CompetitorAccount) => void
  onImport: (file: File) => void
  onExport: () => void
  onToggle: (account: CompetitorAccount) => void
  manifest: CompetitorManifest | undefined
  onCollect: (ids: readonly string[]) => void
  t: PropsLocale<'content-studio'>['t']
}) {
  const fileInputId = 'comp-account-import'
  return (
    <div className={css.compAccounts}>
      <div className={css.compImportRow}>
        <button type="button" className={css.retry} onClick={() => { onForm(form === undefined ? accountForm() : undefined) }}>
          {form === undefined ? t('comp.accountAdd') : t('comp.accountCancel')}
        </button>
        <label className={css.retry} htmlFor={fileInputId}>{t('comp.accountImport')}</label>
        <input id={fileInputId} type="file" accept="application/json,.json" className={css.compFileInput} onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file !== undefined) onImport(file)
          event.currentTarget.value = ''
        }} />
        <button type="button" className={css.retry} disabled={accounts.length === 0} onClick={onExport}>{t('comp.accountExport')}</button>
        <span className={css.listMeta}>{t('comp.accountCount', { n: accounts.length })}</span>
      </div>
      {form !== undefined && (
        <form className={css.compForm} onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
          <div className={css.compFormRow}>
            <input className={css.compInput} placeholder={t('comp.fieldName')} value={form.name} onChange={(event) => { onForm({ ...form, name: event.currentTarget.value }) }} />
            <select className={css.compInput} value={form.platform} onChange={(event) => { onForm({ ...form, platform: event.currentTarget.value as CompetitorPlatform }) }} aria-label={t('comp.fieldPlatform')}>
              {COMPETITOR_PLATFORMS.map(platform => <option key={platform} value={platform}>{t(PLATFORM_KEYS[platform])}</option>)}
            </select>
            <select className={css.compInput} value={form.priority} onChange={(event) => { onForm({ ...form, priority: event.currentTarget.value as CompetitorAccount['priority'] }) }} aria-label={t('comp.fieldPriority')}>
              <option value="high">{t('comp.priority.high')}</option>
              <option value="medium">{t('comp.priority.medium')}</option>
              <option value="low">{t('comp.priority.low')}</option>
            </select>
            <select className={css.compInput} value={form.intervalDays} onChange={(event) => { onForm({ ...form, intervalDays: Number(event.currentTarget.value) as CompetitorAccount['intervalDays'] }) }} aria-label={t('comp.fieldInterval')}>
              <option value={1}>{t('comp.intervalDaily')}</option>
              <option value={3}>{t('comp.interval3d')}</option>
              <option value={7}>{t('comp.intervalWeekly')}</option>
            </select>
          </div>
          <input className={css.compInput} placeholder={t('comp.fieldHomepage')} value={form.homepageUrl} onChange={(event) => { onForm({ ...form, homepageUrl: event.currentTarget.value }) }} />
          <input className={css.compInput} placeholder={t('comp.fieldTopics')} value={form.topics} onChange={(event) => { onForm({ ...form, topics: event.currentTarget.value }) }} />
          <div className={css.compFormRow}>
            <input className={css.compInput} placeholder={t('comp.fieldPositioning')} value={form.positioning} onChange={(event) => { onForm({ ...form, positioning: event.currentTarget.value }) }} />
            <input className={css.compInput} placeholder={t('comp.fieldFollowerTier')} value={form.followerTier} onChange={(event) => { onForm({ ...form, followerTier: event.currentTarget.value }) }} />
            <input className={css.compInput} placeholder={t('comp.fieldMonetization')} value={form.monetization} onChange={(event) => { onForm({ ...form, monetization: event.currentTarget.value }) }} />
          </div>
          <input className={css.compInput} placeholder={t('comp.fieldNote')} value={form.note} onChange={(event) => { onForm({ ...form, note: event.currentTarget.value }) }} />
          <div className={css.compFormRow}>
            <button type="submit" className={css.retry} disabled={form.name.trim().length === 0}>{t('comp.accountSave')}</button>
          </div>
        </form>
      )}
      <div className={css.compWorkList}>
        {accounts.length === 0
          ? <p className={css.panelEmpty}>{t('comp.accountsEmpty')}</p>
          : accounts.map((account) => {
            const workCount = manifest?.works.filter(work => work.accountId === account.id).length ?? 0
            const hotCount = manifest?.works.filter(work => work.accountId === account.id && work.hot).length ?? 0
            const lastSynced = manifest?.syncedAt[account.id]
            return (
              <div key={account.id} className={css.compAccountCard}>
                <div className={css.compDetailHead}>
                  <strong>{account.name}</strong>
                  <span className={clsx(css.badge, PRIORITY_CLASS[account.priority])}>{t(`comp.priority.${account.priority}`)}</span>
                  <span className={css.listMeta}>{t(PLATFORM_KEYS[account.platform])}{account.topics.length > 0 && ` · ${account.topics.join(' / ')}`}</span>
                </div>
                <span className={css.listMeta}>
                  {t('comp.accountWorks', { n: workCount, hot: hotCount })}
                  {' · '}
                  {lastSynced === undefined ? t('comp.neverCollected') : t('comp.lastCollected', { date: lastSynced.slice(0, 10) })}
                </span>
                {account.positioning.length > 0 && <span className={css.listMeta}>{account.positioning}</span>}
                <div className={css.compActions}>
                  <button type="button" className={css.retry} onClick={() => { onToggle(account) }}>{account.enabled ? t('comp.accountDisable') : t('comp.accountEnable')}</button>
                  <button type="button" className={css.retry} disabled={manifest === undefined} onClick={() => { onCollect([account.id]) }}><IconRefreshOutline14 size={12} /> {t('comp.markCollectedOne')}</button>
                  <button type="button" className={css.retry} onClick={() => { onForm(accountForm(account)) }}>{t('comp.accountEdit')}</button>
                  <button type="button" className={css.retry} onClick={() => { onRemove(account) }} aria-label={t('comp.accountRemove')}><IconTrashOutline16 size={12} /></button>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
