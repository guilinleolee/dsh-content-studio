/**
 * The frame-wide workbench surface occupying the `shell.overlay` hole.
 * Easel-style two-column shell: a left inner nav — 工作台 / 对话 / 对标 /
 * 选题库 / 信息收集 / 内容 / 内容日历 / 创作 / 发布 / 账号 / 画像 / 模板, with the
 * back-to-chat verb and the feedback link at the foot — and a main column
 * rendering the active view, defaulting to the workbench home dashboard.
 * 对话 closes back to the chat; 对标 is a capability slice of the catalog;
 * 选题库 is the topic bank over the contentTopics Remote; 内容日历 is the
 * scheduling workbench over the contentSchedule Remote; 画像 is the
 * account-persona manager over the `_personas.json` manifest. 账号 keeps the
 * browser-local creation identity injected into every copied capability
 * instruction, and a selected disk persona injects its packed prompt
 * instead. Escape dismisses the surface; closed state renders null while the
 * slot entry stays mounted.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { clsx } from 'clsx'
import { IconCloseOutline16, IconSparkle16, writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  ContentOutputsSnapshot, InteractionsManifestRead, ReviewManifestRead,
} from '@deepseek-ai/dsh-content-outputs/types'
import type { ContentScheduleSnapshot, ScheduleItem, ScheduleItemInput } from '@deepseek-ai/dsh-content-schedule/types'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { TopicItemInput } from '@deepseek-ai/dsh-content-topics/types'
import type { CapabilityItem, CapabilityMaturity } from './capabilities.ts'
import { STUDIO_TABS, capabilityGroups, type StudioTab } from './capabilities.ts'
import { ContentLibrary } from './ContentLibrary.tsx'
import { ContentCalendar, type ContentCalendarInjected } from './ContentCalendar.tsx'
import { ContentWorkbench } from './ContentWorkbench.tsx'
import { AccountSelect } from './AccountSelect.tsx'
import { CapabilityPage } from './CapabilityPage.tsx'
import { AccountsView } from './AccountsView.tsx'
import { PersonaView } from './PersonaView.tsx'
import { CompetitorsView, type CompetitorsViewInjected } from './CompetitorsView.tsx'
import { GatherView } from './GatherView.tsx'
import { CreateView, type CreateGateway } from './CreateView.tsx'
import { TopicBankView, type TopicBankGateway } from './TopicBankView.tsx'
import { PublishView } from './PublishView.tsx'
import type { PublishController } from './publish/publish-store.ts'
import { ReviewView } from './ReviewView.tsx'
import type { ReviewController } from './review/review-store.ts'
import { InteractionView } from './InteractionView.tsx'
import type { InteractionController } from './interaction/interaction-store.ts'
import { TemplateLibraryView } from './template/TemplateLibraryView.tsx'
import { TemplatePickerModal } from './template/TemplatePickerModal.tsx'
import type { TemplateController } from './template/template-store.ts'
import { gatherMaterialToTopicInput } from './topic-bank.ts'
import type { GatherController } from './gather/gather-store.ts'
import type { PersonaController } from './persona/persona-store.ts'
import type { StudioKey } from './locales.ts'
import type { ContentStudioController, PickedManuscript, PickedTopic } from './studio-store.ts'
import css from './ContentStudio.module.css'
// The picked-material banner belongs to the gather feature surface, whose
// styles live in the gather view's own module.
import gatherCss from './GatherView.module.css'

/** How long a card shows its copied state before reverting. */
const COPIED_FEEDBACK_MS = 1600

/** The top-level views; the workbench home is the entry view. 对话 is a verb, not a view. */
type StudioView = 'workbench' | 'benchmark' | 'competitors' | 'topicBank' | 'gather' | 'library' | 'create' | 'publish' | 'review' | 'interaction' | 'accounts' | 'persona' | 'templates' | 'calendar'

/** The nav order exactly as specified: 对话 rides between 工作台 and 对标 as a verb. */
const NAV_ITEMS: readonly { view: StudioView | 'chat'; key: StudioKey }[] = [
  { view: 'workbench', key: 'nav.workbench' },
  { view: 'chat', key: 'nav.chat' },
  { view: 'benchmark', key: 'nav.benchmark' },
  { view: 'competitors', key: 'nav.competitors' },
  { view: 'topicBank', key: 'nav.topicBank' },
  { view: 'gather', key: 'nav.gather' },
  { view: 'library', key: 'nav.content' },
  { view: 'calendar', key: 'nav.calendar' },
  { view: 'create', key: 'nav.create' },
  { view: 'publish', key: 'nav.publish' },
  { view: 'review', key: 'nav.review' },
  { view: 'interaction', key: 'nav.interaction' },
  { view: 'accounts', key: 'nav.accounts' },
  { view: 'persona', key: 'nav.persona' },
  { view: 'templates', key: 'nav.templates' },
]

/** Capability slice behind the 对标 nav view. */
const BENCHMARK_IDS: readonly CapabilityItem['id'][] = ['breakdown']

/** Injected face of the workbench surface: the shared controller and the server reads. */
export interface ContentStudioInjected {
  studio: ContentStudioController
  listOutputs: () => Promise<ContentOutputsSnapshot>
  /** The gather controller: browser-side sources/tasks plus the collection scheduler. */
  gather: GatherController
  schedule: {
    list: () => Promise<ContentScheduleSnapshot>
    put: (input: ScheduleItemInput) => Promise<ContentScheduleSnapshot>
    remove: (id: ScheduleItem['id']) => Promise<ContentScheduleSnapshot>
  }
  /** The calendar's day-note sidecar face, served by the contentSchedule Remote. */
  notes: ContentCalendarInjected['notes']
  /** The competitor write face, served by the content-outputs Remote. */
  competitors: Omit<CompetitorsViewInjected, 'listOutputs'>
  /** The create workbench face, served by the content-outputs Remote. */
  create: CreateGateway
  /** The persona controller: the `_personas.json` manifest plus the wizard draft. */
  personas: PersonaController
  /** Current theme directory names, projected from the outputs library. */
  listThemes: () => Promise<readonly string[]>
  /** The topic-bank Remote face, served by the content-topics Remote. */
  topics: TopicBankGateway
  /** The authorized asset write backing the topic bank's Markdown export. */
  writeExport: (theme: string, file: string, content: string) => Promise<unknown>
  /** The publish controller: tasks, profiles, history, and the AI adaptations. */
  publish: PublishController
  /** The review controller: imports, pools, diagnoses, reports, and the reflow. */
  review: ReviewController
  /** The interaction controller: the fan inbox, the CSV import, and the AI helpers. */
  interaction: InteractionController
  /** Raw read of the `_interactions.json` manifest for the workbench home. */
  readInteractions: () => Promise<InteractionsManifestRead>
  /** Raw read of one theme's `_review.json` manifest for the workbench home. */
  readReviewManifest: (theme: string) => Promise<ReviewManifestRead>
  /** The global template library controller: the asset store plus the cross-column picker. */
  templates: TemplateController
}

/** Full surface props: the injected face plus the locale seat. */
export type ContentStudioProps = ContentStudioInjected & PropsLocale<'content-studio'>

/** Maturity → its badge modifier class. */
const BADGE_CLASS: Record<CapabilityMaturity, string> = {
  done: css.badgeDone ?? '',
  ready: css.badgeReady ?? '',
  need: css.badgeNeed ?? '',
  incoming: css.badgeIncoming ?? '',
}

/**
 * Render the Content Studio workbench surface.
 * @param props - the injected face and the locale seat.
 * @returns the surface element tree while open; null while closed.
 */
export function ContentStudio({
  studio, listOutputs, gather, schedule, notes, competitors, create, personas, listThemes,
  topics, writeExport, publish, review, interaction, readInteractions, readReviewManifest, templates, t,
}: ContentStudioProps) {
  const open = useSyncExternalStore(
    fn => studio.subscribe(fn),
    () => studio.isOpen(),
  )
  const [view, setView] = useState<StudioView>('workbench')
  // Browser-local creation accounts and persona (Easel's persona selector):
  // both are injected into every copied capability instruction.
  const [accounts, setAccounts] = useState<readonly string[]>(() => {
    try { return JSON.parse(localStorage.getItem('dsh-content-studio.accounts') ?? '') as string[] }
    catch { return ['通用模式'] }
  })
  const [account, setAccount] = useState<string>(() => localStorage.getItem('dsh-content-studio.account') ?? '通用模式')
  const [persona] = useState<string>(() => localStorage.getItem('dsh-content-studio.persona') ?? '')
  const selectAccount = (name: string): void => {
    setAccount(name)
    localStorage.setItem('dsh-content-studio.account', name)
  }
  const addAccount = (name: string): void => {
    const next = accounts.includes(name) ? accounts : [...accounts, name]
    setAccounts(next)
    localStorage.setItem('dsh-content-studio.accounts', JSON.stringify(next))
    selectAccount(name)
  }
  const removeAccount = (name: string): void => {
    const next = accounts.filter(candidate => candidate !== name)
    setAccounts(next)
    localStorage.setItem('dsh-content-studio.accounts', JSON.stringify(next))
    if (account === name) selectAccount('通用模式')
  }
  // Prepend the active account (and persona when set) to a copied instruction;
  // generic mode with no persona adds nothing. A picked gathered material adds
  // its id-titled reference line — never the body. A selected disk persona
  // injects its packed persona-prompt@1 text; the inline free text is the
  // fallback.
  const personaPrompt = useSyncExternalStore(
    fn => personas.subscribe(fn),
    () => personas.activePrompt(),
  )
  const personaText = personaPrompt.length > 0 ? personaPrompt : persona
  const withIdentity = (prompt: string, material?: { title: string; url: string } | null): string => {
    const personaLine = personaPrompt.length > 0 ? personaPrompt : persona.length > 0 ? `账号画像：${persona}` : ''
    const identity = account === '通用模式'
      ? personaLine
      : personaLine.length > 0 ? `我的账号/画像：${account}\n${personaLine}` : `我的账号/画像：${account}`
    const reference = material === null || material === undefined ? '' : `参考素材：${material.title}（${material.url}）`
    return [identity, reference].filter(part => part.length > 0).join('\n').length > 0
      ? `${[identity, reference].filter(part => part.length > 0).join('\n')}\n\n${prompt}`
      : prompt
  }
  const [tab, setTab] = useState<StudioTab>('create')
  const [copiedId, setCopiedId] = useState<string | undefined>(undefined)

  // Escape closes; the listener exists only while open so the key keeps its
  // native meaning everywhere else.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') studio.close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [open, studio])

  // Revert the copied feedback without racing successive picks: each pick
  // replaces the pending timer instead of stacking one.
  useEffect(() => {
    if (copiedId === undefined) return
    const timer = window.setTimeout(() => { setCopiedId(undefined) }, COPIED_FEEDBACK_MS)
    return () => { window.clearTimeout(timer) }
  }, [copiedId])

  // The gather scheduler exists only while the surface is open: opening
  // starts the tick (and runs the overdue catch-up), closing stops every
  // timer and the visibility listener. No background polling remains.
  useEffect(() => {
    if (!open) return
    gather.start()
    return () => { gather.dispose() }
  }, [open, gather])
  const picked = useSyncExternalStore(
    fn => studio.subscribe(fn),
    () => studio.pickedMaterial(),
  )
  const pickedTopic = useSyncExternalStore(
    fn => studio.subscribe(fn),
    () => studio.pickedTopic(),
  )
  const pickedManuscript = useSyncExternalStore(
    fn => studio.subscribe(fn),
    () => studio.pickedManuscript(),
  )

  if (!open) return null

  const groups = capabilityGroups(tab)

  const pickItem = (item: CapabilityItem): void => {
    void (async () => {
      if (await writeClipboard(withIdentity(item.prompt, picked))) setCopiedId(item.id)
    })()
  }
  const pick = async (id: string, prompt: string): Promise<void> => {
    if (await writeClipboard(withIdentity(prompt, picked))) setCopiedId(id)
  }
  const pushToCreate = (material: { id: string; title: string; url: string }): void => {
    void gather.markPicked(material.id)
    studio.pickMaterial(material)
    setView('create')
  }
  const startTopicCreate = (topic: PickedTopic): void => {
    studio.pickTopic(topic)
    setView('create')
  }
  // The create-view handoff: one registered deliverable becomes one publish
  // form prefill — an id reference only, never the manuscript body.
  const sendToPublish = (manuscript: PickedManuscript): void => {
    studio.pickManuscript(manuscript)
    setView('publish')
  }
  // The reserved addToTopicBank contract, now wired: one gather material
  // becomes one `source.type:"gather"` topic carrying the material's stable
  // id as refId, its link, and a create-time snapshot; feedback rides the
  // gather view's own notice channel.
  const joinTopicBank = (materialId: string): void => {
    const material = gather.getState().materials.find(candidate => candidate.id === materialId)
    if (material === undefined) {
      gather.showNotice('topic-bank-missing')
      return
    }
    void (async () => {
      const input: TopicItemInput = gatherMaterialToTopicInput(material, material.gatheredAt)
      try {
        await topics.put(input)
        gather.showNotice('topic-bank-added')
      } catch {
        gather.showNotice('topic-bank-failed')
      }
    })()
  }

  return (
    <div className={css.surface} role="dialog" aria-modal="true" aria-label={t('studio.title')}>
      <div className={css.shell}>
        <aside className={css.side}>
          <div className={css.sideBrand}>
            <IconSparkle16 size={16} />
            <span>{t('studio.title')}</span>
          </div>
          <AccountSelect
            account={account}
            accounts={accounts}
            onSelect={selectAccount}
            onAdd={addAccount}
            t={t}
          />
          <nav className={css.sideNav} aria-label={t('studio.title')}>
            {NAV_ITEMS.map(({ view: candidate, key }) => (
              <button
                key={candidate}
                type="button"
                className={clsx(css.navItem, view === candidate && css.navItemActive)}
                aria-current={view === candidate || undefined}
                onClick={() => {
                  if (candidate === 'chat') studio.close()
                  else setView(candidate)
                }}
              >
                {t(key)}
              </button>
            ))}
          </nav>
          <div className={css.sideFoot}>
            <button type="button" className={css.back} onClick={() => { studio.close() }}>
              {t('studio.back')}
            </button>
            <a
              className={css.aboutLink}
              href="https://github.com/guilinleolee/dsh-content-studio/issues"
              target="_blank"
              rel="noreferrer"
            >
              {t('studio.feedback')}
            </a>
          </div>
        </aside>

        <div className={css.main}>
          <button
            type="button"
            className={css.close}
            aria-label={t('studio.close')}
            onClick={() => { studio.close() }}
          >
            <IconCloseOutline16 size={16} />
          </button>

          <div className={css.frame}>
            {view === 'workbench' && (
              <ContentWorkbench
                listOutputs={listOutputs}
                listSchedule={schedule.list}
                listTopics={topics.list}
                readInteractions={readInteractions}
                readReviewManifest={readReviewManifest}
                onNavigate={setView}
                onChat={() => { studio.close() }}
                account={account}
                persona={personaText}
                t={t}
              />
            )}
            {view === 'benchmark' && (
              <CapabilityPage title={t('benchmark.title')} ids={BENCHMARK_IDS} copiedId={copiedId} pick={pickItem} t={t} />
            )}
            {view === 'competitors' && (
              <CompetitorsView listOutputs={listOutputs} {...competitors} t={t} />
            )}
            {view === 'topicBank' && (
              <TopicBankView
                topics={topics}
                schedule={schedule}
                onStartCreate={startTopicCreate}
                writeExport={writeExport}
                listThemes={listThemes}
                copiedCapabilityId={copiedId}
                pickCapability={pickItem}
                templateLibrary={templates}
                t={t}
              />
            )}
            {view === 'gather' && (
              <GatherView gather={gather} onPushToCreate={pushToCreate} addToTopicBank={joinTopicBank} t={t} />
            )}
            {view === 'accounts' && (
              <AccountsView
                account={account}
                accounts={accounts}
                onSelect={selectAccount}
                onAdd={addAccount}
                onRemove={removeAccount}
                t={t}
              />
            )}
            {view === 'persona' && (
              <PersonaView personas={personas} t={t} />
            )}
            {view === 'library' && <ContentLibrary listOutputs={listOutputs} t={t} />}
            {view === 'publish' && (
              <PublishView
                publish={publish}
                persona={personaText}
                pickedManuscript={pickedManuscript}
                onClearPickedManuscript={() => { studio.clearPickedManuscript() }}
                t={t}
              />
            )}
            {view === 'review' && (
              <ReviewView review={review} listThemes={listThemes} t={t} />
            )}
            {view === 'interaction' && (
              <InteractionView
                interaction={interaction}
                personas={personas}
                templates={templates}
                listThemes={listThemes}
                t={t}
              />
            )}
            {view === 'calendar' && (
              <ContentCalendar
                listSchedule={schedule.list}
                putSchedule={schedule.put}
                removeSchedule={schedule.remove}
                notes={notes}
                topics={topics}
                writeExport={writeExport}
                listThemes={listThemes}
                onNavigate={setView}
                t={t}
              />
            )}
            {view === 'templates' && <TemplateLibraryView templates={templates} t={t} />}
            {view === 'create' && (
              <>
                {picked !== null && (
                  <div className={gatherCss.gatherPicked} role="status">
                    <span>
                      {t('gather.picked.chip')}
                      {picked.title}
                    </span>
                    <button type="button" className={gatherCss.gatherMini} onClick={() => { studio.clearPickedMaterial() }}>
                      {t('gather.picked.clear')}
                    </button>
                  </div>
                )}
                <CreateView
                  create={create}
                  listThemes={listThemes}
                  persona={personaText}
                  picked={picked}
                  onClearPicked={() => { studio.clearPickedMaterial() }}
                  pickedTopic={pickedTopic}
                  templateLibrary={templates}
                  onClearPickedTopic={() => { studio.clearPickedTopic() }}
                  topics={topics}
                  schedule={schedule}
                  onSendToPublish={sendToPublish}
                  catalog={(
                    <>
                      <div className={css.tabs} role="tablist">
                        {STUDIO_TABS.map(candidate => (
                          <button
                            key={candidate.id}
                            type="button"
                            role="tab"
                            aria-selected={tab === candidate.id}
                            aria-label={t(candidate.id === 'create' ? 'tab.create.aria' : 'tab.operate.aria')}
                            className={clsx(css.tab, tab === candidate.id && css.tabActive)}
                            onClick={() => { setTab(candidate.id) }}
                          >
                            {t(candidate.id === 'create' ? 'tab.create' : 'tab.operate')}
                          </button>
                        ))}
                      </div>

                      <div className={css.body}>
                        {groups.map(group => (
                          <section key={group.id} className={css.group}>
                            <h2 className={css.groupTitle}>{t(`group.${group.id}` as StudioKey)}</h2>
                            <div className={css.grid}>
                              {group.items.map((item) => {
                                const copied = copiedId === item.id
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    className={clsx(css.card, copied && css.cardCopied)}
                                    onClick={() => { void pick(item.id, item.prompt) }}
                                  >
                                    <span className={css.cardHead}>
                                      {/* Catalog ids are the locale key stems; the
                                          catalog test pins every stem to both
                                          dictionaries. */}
                                      <span className={css.cardTitle}>{t(`cap.${item.id}.title` as StudioKey)}</span>
                                      <span className={clsx(css.badge, BADGE_CLASS[item.maturity])}>
                                        {t(`badge.${item.maturity}`)}
                                      </span>
                                    </span>
                                    <span className={css.cardDetail}>{t(`cap.${item.id}.detail` as StudioKey)}</span>
                                    <span className={clsx(css.cardHint, copied && css.cardHintCopied)}>
                                      {copied ? t('card.copied') : t('card.copyHint')}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                    </>
                  )}
                  t={t}
                />
              </>
            )}
          </div>
          {/* The cross-column template picker overlays every view; its state
              lives on the shared template controller. */}
          <TemplatePickerModal templates={templates} t={t} />
        </div>
      </div>
    </div>
  )
}
