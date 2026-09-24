/**
 * The frame-wide workbench surface occupying the `shell.overlay` hole.
 * Easel-style two-column shell: a left inner nav — 工作台 / 对话 / 对标 /
 * 选题 / 内容 / 创作 / 账号 / 画像, with the back-to-chat verb and the
 * feedback link at the foot — and a main column rendering the active view,
 * defaulting to the workbench home dashboard. 对话 closes back to the chat;
 * 对标 and 选题 are capability slices of the catalog; 账号 and 画像 manage the
 * browser-local creation identity that is injected into every copied
 * capability instruction. Escape dismisses the surface; closed state renders
 * null while the slot entry stays mounted.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { clsx } from 'clsx'
import { IconCloseOutline16, IconSparkle16, writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ContentOutputsSnapshot } from '@deepseek-ai/dsh-content-outputs/types'
import type { ContentScheduleSnapshot, ScheduleItem, ScheduleItemInput } from '@deepseek-ai/dsh-content-schedule/types'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { CapabilityItem, CapabilityMaturity } from './capabilities.ts'
import { STUDIO_TABS, capabilityGroups, type StudioTab } from './capabilities.ts'
import { ContentLibrary } from './ContentLibrary.tsx'
import { ContentCalendar } from './ContentCalendar.tsx'
import { ContentWorkbench } from './ContentWorkbench.tsx'
import { AccountSelect } from './AccountSelect.tsx'
import { CapabilityPage } from './CapabilityPage.tsx'
import { AccountsView } from './AccountsView.tsx'
import { PersonaView } from './PersonaView.tsx'
import type { StudioKey } from './locales.ts'
import type { ContentStudioController } from './studio-store.ts'
import css from './ContentStudio.module.css'

/** How long a card shows its copied state before reverting. */
const COPIED_FEEDBACK_MS = 1600

/** The top-level views; the workbench home is the entry view. 对话 is a verb, not a view. */
type StudioView = 'workbench' | 'benchmark' | 'topics' | 'library' | 'create' | 'accounts' | 'persona' | 'calendar'

/** The nav order exactly as specified: 对话 rides between 工作台 and 对标 as a verb. */
const NAV_ITEMS: readonly { view: StudioView | 'chat'; key: StudioKey }[] = [
  { view: 'workbench', key: 'nav.workbench' },
  { view: 'chat', key: 'nav.chat' },
  { view: 'benchmark', key: 'nav.benchmark' },
  { view: 'topics', key: 'nav.topics' },
  { view: 'library', key: 'nav.content' },
  { view: 'create', key: 'nav.create' },
  { view: 'accounts', key: 'nav.accounts' },
  { view: 'persona', key: 'nav.persona' },
]

/** Capability slices behind the 对标 / 选题 nav views. */
const BENCHMARK_IDS: readonly CapabilityItem['id'][] = ['breakdown']
const TOPICS_IDS: readonly CapabilityItem['id'][] = ['hotspot', 'calendar-plan']

/** Injected face of the workbench surface: the shared controller and the server reads. */
export interface ContentStudioInjected {
  studio: ContentStudioController
  listOutputs: () => Promise<ContentOutputsSnapshot>
  schedule: {
    list: () => Promise<ContentScheduleSnapshot>
    put: (input: ScheduleItemInput) => Promise<ContentScheduleSnapshot>
    remove: (id: ScheduleItem['id']) => Promise<ContentScheduleSnapshot>
  }
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
export function ContentStudio({ studio, listOutputs, schedule, t }: ContentStudioProps) {
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
  const [persona, setPersona] = useState<string>(() => localStorage.getItem('dsh-content-studio.persona') ?? '')
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
  const savePersona = (text: string): void => {
    setPersona(text)
    localStorage.setItem('dsh-content-studio.persona', text)
  }
  // Prepend the active account (and persona when set) to a copied instruction;
  // generic mode with no persona adds nothing.
  const withIdentity = (prompt: string): string => {
    const identity = account === '通用模式'
      ? persona.length > 0 ? `账号画像：${persona}` : ''
      : persona.length > 0 ? `我的账号/画像：${account}\n账号画像：${persona}` : `我的账号/画像：${account}`
    return identity.length > 0 ? `${identity}\n\n${prompt}` : prompt
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

  if (!open) return null

  const groups = capabilityGroups(tab)

  const pickItem = (item: CapabilityItem): void => {
    void (async () => {
      if (await writeClipboard(withIdentity(item.prompt))) setCopiedId(item.id)
    })()
  }
  const pick = async (id: string, prompt: string): Promise<void> => {
    if (await writeClipboard(withIdentity(prompt))) setCopiedId(id)
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
                onNavigate={setView}
                onChat={() => { studio.close() }}
                account={account}
                persona={persona}
                t={t}
              />
            )}
            {view === 'benchmark' && (
              <CapabilityPage title={t('benchmark.title')} ids={BENCHMARK_IDS} copiedId={copiedId} pick={pickItem} t={t} />
            )}
            {view === 'topics' && (
              <CapabilityPage title={t('topics.title')} ids={TOPICS_IDS} copiedId={copiedId} pick={pickItem} t={t} />
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
              <PersonaView persona={persona} onSave={savePersona} t={t} />
            )}
            {view === 'library' && <ContentLibrary listOutputs={listOutputs} t={t} />}
            {view === 'calendar' && (
              <ContentCalendar
                listSchedule={schedule.list}
                putSchedule={schedule.put}
                removeSchedule={schedule.remove}
                t={t}
              />
            )}
            {view === 'create' && (
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
          </div>
        </div>
      </div>
    </div>
  )
}
