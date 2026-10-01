/**
 * The publish view: the manuscript pool on the left of the create flow, the
 * platform-matrix task builder, the per-platform AI adaptation board with
 * append-only attempt logs, the record handoff that freezes the phase-2 MCP
 * package, the global history list, and the topic reflow. Orchestration
 * only — task logic lives in the pure `model.ts` and the controller.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { clsx } from 'clsx'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { PublishTask } from '@deepseek-ai/dsh-content-outputs/types'
import { PLATFORM_PROFILES, exceedsCharLimit, formatTags, platformProfileOf } from './publish/model.ts'
import type { ManuscriptCard } from './publish/model.ts'
import type { PublishController, PublishNotice, PublishState } from './publish/publish-store.ts'
import type { PickedManuscript } from './studio-store.ts'
import css from './PublishView.module.css'

/** Injected face of the publish view. */
export interface PublishViewProps {
  readonly publish: PublishController
  /** The active persona text, prefilled as the adaptation style reference. */
  readonly persona: string
  /** Manuscript handed over from the create view, if any. */
  readonly pickedManuscript: PickedManuscript | null
  readonly onClearPickedManuscript: () => void
  readonly t: PropsLocale<'content-studio'>['t']
}

/** Status → its badge modifier class. */
const STATUS_CLASS: Record<PublishTask['status'], string> = {
  draft: css.badgeDraft ?? '',
  pendingReview: css.badgeReview ?? '',
  scheduled: css.badgeScheduled ?? '',
  recorded: css.badgeRecorded ?? '',
}

/** Platform-leg status → its badge modifier class. */
const LEG_STATUS_CLASS: Record<PublishTask['platforms'][number]['status'], string> = {
  pending: css.badgeDraft ?? '',
  adapted: css.badgeReview ?? '',
  edited: css.badgeScheduled ?? '',
  recorded: css.badgeRecorded ?? '',
}

/** Draft edit state of one platform card. */
interface DraftEdit {
  readonly taskId: string
  readonly platformId: string
  readonly content: string
}

/** New-task form state; null when the form is closed. */
interface NewTaskForm {
  readonly theme: string
  readonly file: string
  readonly title: string
  readonly platformIds: readonly string[]
  readonly mode: PublishTask['mode']
  readonly scheduledLocal: string
  readonly note: string
  /** The creation topic this task fulfills; null on manual entries. */
  readonly topicId: string | null
}

/** Whether the locale key exists in the publish notice family. */
const NOTICE_KEYS: readonly PublishNotice[] = [
  'profiles-saved', 'profiles-failed', 'task-created', 'task-create-failed', 'adapt-done', 'adapt-failed',
  'draft-saved', 'draft-save-failed', 'recorded', 'record-failed', 'scheduled', 'schedule-failed',
  'task-deleted', 'task-deleted-schedule-stale', 'delete-failed', 'copied', 'reflowed', 'reflow-orphan', 'reflow-failed', 'due-tasks', 'load-failed',
]

/**
 * Render the publish view.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export function PublishView({ publish, persona, pickedManuscript, onClearPickedManuscript, t }: PublishViewProps) {
  const state = useSyncExternalStore(
    listener => publish.subscribe(listener),
    () => publish.getState(),
  )
  const [tab, setTab] = useState<'tasks' | 'history'>('tasks')
  const [showProfiles, setShowProfiles] = useState(false)
  const [form, setForm] = useState<NewTaskForm | null>(null)
  const [draftEdit, setDraftEdit] = useState<DraftEdit | null>(null)
  const [profileDraft, setProfileDraft] = useState(state.profiles)
  const [scheduleInputs, setScheduleInputs] = useState<{ date: string; time: string }>({ date: '', time: '09:00' })

  useEffect(() => { void publish.init() }, [publish])

  // A create-view handoff opens the form prefilled once.
  useEffect(() => {
    if (pickedManuscript === null) return
    setTab('tasks')
    setForm({
      theme: pickedManuscript.theme,
      file: pickedManuscript.file,
      title: pickedManuscript.title,
      platformIds: [],
      mode: 'immediate',
      scheduledLocal: '',
      note: '',
      topicId: pickedManuscript.topicId ?? null,
    })
    onClearPickedManuscript()
  }, [pickedManuscript, onClearPickedManuscript])

  // Keep the profile editor draft aligned when the stored cards load.
  useEffect(() => {
    setProfileDraft(state.profiles)
  }, [state.profiles])

  const openTask = state.tasks.find(task => task.taskId === state.openTaskId) ?? null

  const startFormFrom = (card: ManuscriptCard): void => {
    setForm({
      theme: card.theme, file: card.file, title: card.title,
      platformIds: [], mode: 'immediate', scheduledLocal: '', note: '',
      topicId: null,
    })
  }

  const submitForm = async (): Promise<void> => {
    if (form === null) return
    const scheduledAt = form.mode === 'scheduled' && form.scheduledLocal.length > 0
      ? new Date(form.scheduledLocal).toISOString()
      : null
    await publish.createTask({
      manuscript: { theme: form.theme, file: form.file, title: form.title },
      platformIds: form.platformIds,
      mode: form.mode,
      scheduledAt,
      note: form.note.trim().length > 0 ? form.note.trim() : null,
      topicId: form.topicId,
      personaDigest: persona.trim().length > 0 ? persona.trim().slice(0, 500) : null,
      manuscriptId: null,
    })
    setTab('tasks')
    setForm(null)
  }

  const togglePlatform = (platformId: string): void => {
    setForm(current => current === null ? current : {
      ...current,
      platformIds: current.platformIds.includes(platformId)
        ? current.platformIds.filter(candidate => candidate !== platformId)
        : [...current.platformIds, platformId],
    })
  }

  const openHistoryRow = async (theme: string, taskId: string): Promise<void> => {
    await publish.openTheme(theme)
    publish.selectTask(taskId)
    setTab('tasks')
  }

  return (
    <div className={css.view}>
      <header className={css.head}>
        <div>
          <h2 className={css.title}>{t('publish.title')}</h2>
          <p className={css.hint}>{t('publish.hint')}</p>
        </div>
        <div className={css.headActions}>
          <button type="button" className={css.ghost} onClick={() => { setShowProfiles(current => !current) }}>
            {t('publish.profiles.toggle')}
          </button>
        </div>
      </header>

      {state.notice !== null && NOTICE_KEYS.includes(state.notice) && (
        <div
          className={clsx(css.notice, state.notice.endsWith('failed') || state.notice === 'load-failed' ? css.noticeWarn : css.noticeOk)}
          role="status"
        >
          <span>{t(`publish.notice.${state.notice}`)}</span>
          {state.error !== null && <span className={css.noticeDetail}>{state.error}</span>}
          <button type="button" className={css.mini} onClick={() => { publish.clearNotice() }}>
            {t('publish.notice.dismiss')}
          </button>
        </div>
      )}

      {showProfiles && (
        <section className={css.profiles} aria-label={t('publish.profiles.title')}>
          <h3 className={css.sectionTitle}>{t('publish.profiles.title')}</h3>
          <p className={css.hint}>{t('publish.profiles.hint')}</p>
          <div className={css.profileGrid}>
            {PLATFORM_PROFILES.map((profile) => {
              const stored = profileDraft.find(candidate => candidate.platformId === profile.platformId)
              return (
                <div key={profile.platformId} className={css.profileCard}>
                  <label className={css.profileHead}>
                    <input
                      type="checkbox"
                      checked={stored?.enabled ?? false}
                      onChange={(event) => {
                        const enabled = event.target.checked
                        setProfileDraft((current) => {
                          const base = current.some(candidate => candidate.platformId === profile.platformId)
                            ? current
                            : [...current, {
                              platformId: profile.platformId, alias: profile.name,
                              enabled: false, adaptationOverrides: null,
                            }]
                          return base.map(candidate => candidate.platformId === profile.platformId ? { ...candidate, enabled } : candidate)
                        })
                      }}
                    />
                    <span>{profile.name}</span>
                  </label>
                  <input
                    type="text"
                    className={css.aliasInput}
                    placeholder={t('publish.profiles.alias')}
                    value={stored?.alias ?? ''}
                    onChange={(event) => {
                      const alias = event.target.value
                      setProfileDraft(current => current.map(candidate =>
                        candidate.platformId === profile.platformId ? { ...candidate, alias } : candidate))
                    }}
                  />
                  <textarea
                    className={css.overrideInput}
                    placeholder={t('publish.profiles.overrides')}
                    value={stored?.adaptationOverrides ?? ''}
                    onChange={(event) => {
                      const adaptationOverrides = event.target.value
                      setProfileDraft(current => current.map(candidate =>
                        candidate.platformId === profile.platformId ? { ...candidate, adaptationOverrides } : candidate))
                    }}
                  />
                </div>
              )
            })}
          </div>
          <div className={css.profilesActions}>
            <button type="button" className={css.primary} onClick={() => { void publish.saveProfiles(profileDraft) }}>
              {t('publish.profiles.save')}
            </button>
            <button type="button" className={css.ghost} onClick={() => { setShowProfiles(false) }}>
              {t('publish.profiles.close')}
            </button>
          </div>
        </section>
      )}

      <nav className={css.tabs} role="tablist">
        <button
          type="button" role="tab" aria-selected={tab === 'tasks'}
          className={clsx(css.tab, tab === 'tasks' && css.tabActive)}
          onClick={() => { setTab('tasks') }}
        >
          {t('publish.tab.tasks')}
        </button>
        <button
          type="button" role="tab" aria-selected={tab === 'history'}
          className={clsx(css.tab, tab === 'history' && css.tabActive)}
          onClick={() => { setTab('history') }}
        >
          {t('publish.tab.history')}
        </button>
      </nav>

      {tab === 'tasks' && (
        <div className={css.columns}>
          <aside className={css.taskList} aria-label={t('publish.tab.tasks')}>
            {state.theme === null && <p className={css.empty}>{t('publish.theme.none')}</p>}
            {state.tasks.length === 0 && state.theme !== null && <p className={css.empty}>{t('publish.tasks.empty')}</p>}
            {state.tasks.map(task => (
              <button
                key={task.taskId}
                type="button"
                className={clsx(css.taskItem, task.taskId === state.openTaskId && css.taskItemActive)}
                onClick={() => { publish.selectTask(task.taskId) }}
              >
                <span className={css.taskItemTitle}>{task.title}</span>
                <span className={clsx(css.badge, STATUS_CLASS[task.status])}>{t(`publish.status.${task.status}`)}</span>
              </button>
            ))}
          </aside>

          <div className={css.main}>
            {state.manifestProblems.length > 0 && (
              <p className={css.problem}>{t('publish.problems').replace('{list}', state.manifestProblems.join('；'))}</p>
            )}

            {form === null && openTask === null && (
              <section className={css.pool} aria-label={t('publish.pool.title')}>
                <h3 className={css.sectionTitle}>{t('publish.pool.title')}</h3>
                <p className={css.hint}>{t('publish.pool.hint')}</p>
                {state.manuscripts.length === 0 && <p className={css.empty}>{t('publish.pool.empty')}</p>}
                <div className={css.poolGrid}>
                  {state.manuscripts.map(card => (
                    <button key={`${card.theme}/${card.file}`} type="button" className={css.poolCard} onClick={() => { startFormFrom(card) }}>
                      <span className={css.poolTitle}>{card.title}</span>
                      <span className={css.poolMeta}>{card.theme}/{card.file}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {form !== null && (
              <section className={css.form} aria-label={t('publish.form.title')}>
                <h3 className={css.sectionTitle}>{t('publish.form.title')}</h3>
                <p className={css.formManuscript}>{form.title}<span className={css.formMeta}>{form.theme}/{form.file}</span></p>
                <div className={css.platformGrid}>
                  {PLATFORM_PROFILES.map((profile) => {
                    const card = state.profiles.find(candidate => candidate.platformId === profile.platformId)
                    const checked = form.platformIds.includes(profile.platformId)
                    return (
                      <label
                        key={profile.platformId}
                        className={clsx(
                          css.platformCard,
                          checked && css.platformCardActive,
                          card?.enabled === false && css.platformCardOff,
                        )}
                      >
                        <input type="checkbox" checked={checked} onChange={() => { togglePlatform(profile.platformId) }} />
                        <span className={css.platformName}>{profile.name}</span>
                        <span className={css.platformMeta}>{card?.alias ?? profile.name}</span>
                      </label>
                    )
                  })}
                </div>
                <div className={css.formRow}>
                  <label className={css.formLabel}>
                    <input
                      type="radio" name="publish-mode" checked={form.mode === 'immediate'}
                      onChange={() => { setForm({ ...form, mode: 'immediate' }) }}
                    />
                    {t('publish.form.immediate')}
                  </label>
                  <label className={css.formLabel}>
                    <input
                      type="radio" name="publish-mode" checked={form.mode === 'scheduled'}
                      onChange={() => { setForm({ ...form, mode: 'scheduled' }) }}
                    />
                    {t('publish.form.scheduled')}
                  </label>
                  {form.mode === 'scheduled' && (
                    <input
                      type="datetime-local" className={css.input}
                      value={form.scheduledLocal}
                      onChange={(event) => { setForm({ ...form, scheduledLocal: event.target.value }) }}
                    />
                  )}
                </div>
                <textarea
                  className={css.noteInput}
                  placeholder={t('publish.form.note')}
                  value={form.note}
                  onChange={(event) => { setForm({ ...form, note: event.target.value }) }}
                />
                <p className={css.hint}>{t('publish.form.persona')}{persona.trim().length > 0 ? t('publish.form.personaOn') : t('publish.form.personaOff')}</p>
                <div className={css.formActions}>
                  <button type="button" className={css.primary} disabled={form.platformIds.length === 0} onClick={() => { void submitForm() }}>
                    {t('publish.form.submit')}
                  </button>
                  <button type="button" className={css.ghost} onClick={() => { setForm(null) }}>
                    {t('publish.form.cancel')}
                  </button>
                </div>
              </section>
            )}

            {form === null && openTask !== null && (
              <TaskDetail
                task={openTask}
                state={state}
                publish={publish}
                draftEdit={draftEdit}
                setDraftEdit={setDraftEdit}
                scheduleInputs={scheduleInputs}
                setScheduleInputs={setScheduleInputs}
                t={t}
              />
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <section className={css.history} aria-label={t('publish.tab.history')}>
          {state.indexProblems.length > 0 && (
            <p className={css.problem}>{t('publish.problems').replace('{list}', state.indexProblems.join('；'))}</p>
          )}
          {state.index.length === 0 && <p className={css.empty}>{t('publish.history.empty')}</p>}
          <table className={css.historyTable}>
            <thead>
              <tr>
                <th>{t('publish.history.task')}</th>
                <th>{t('publish.history.theme')}</th>
                <th>{t('publish.history.platforms')}</th>
                <th>{t('publish.history.status')}</th>
                <th>{t('publish.history.updated')}</th>
                <th aria-label={t('publish.history.actions')} />
              </tr>
            </thead>
            <tbody>
              {[...state.index].reverse().map(entry => (
                <tr key={`${entry.theme}/${entry.taskId}`}>
                  <td>{entry.title}</td>
                  <td>{entry.theme}</td>
                  <td>{entry.platformIds.map(id => platformProfileOf(id)?.name ?? id).join('、')}</td>
                  <td><span className={clsx(css.badge, STATUS_CLASS[entry.status])}>{t(`publish.status.${entry.status}`)}</span></td>
                  <td>{entry.updatedAt.slice(0, 16).replace('T', ' ')}</td>
                  <td>
                    <button type="button" className={css.mini} onClick={() => { void openHistoryRow(entry.theme, entry.taskId) }}>
                      {t('publish.history.open')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

/** Props of the open-task detail pane. */
interface TaskDetailProps {
  readonly task: PublishTask
  readonly state: PublishState
  readonly publish: PublishController
  readonly draftEdit: DraftEdit | null
  readonly setDraftEdit: (edit: DraftEdit | null) => void
  readonly scheduleInputs: { readonly date: string; readonly time: string }
  readonly setScheduleInputs: (inputs: { readonly date: string; readonly time: string }) => void
  readonly t: PropsLocale<'content-studio'>['t']
}

/**
 * Render one open task: the fact header, the platform legs with their
 * adaptation/edit/log surfaces, and the task-level actions.
 */
function TaskDetail({ task, state, publish, draftEdit, setDraftEdit, scheduleInputs, setScheduleInputs, t }: TaskDetailProps) {
  const isRecorded = task.status === 'recorded'
  return (
    <section className={css.detail} aria-label={task.title}>
      <header className={css.detailHead}>
        <h3 className={css.sectionTitle}>{task.title}</h3>
        <span className={clsx(css.badge, STATUS_CLASS[task.status])}>{t(`publish.status.${task.status}`)}</span>
      </header>
      <p className={css.facts}>
        <span>{t('publish.fact.manuscript')}{task.manuscriptFile}</span>
        {task.topicId !== null && <span>{t('publish.fact.topic')}{task.topicId}</span>}
        {task.scheduledAt !== null && <span>{t('publish.fact.scheduledAt')}{task.scheduledAt.slice(0, 16).replace('T', ' ')}</span>}
        {task.note !== null && <span>{t('publish.fact.note')}{task.note}</span>}
      </p>

      {!isRecorded && (
        <div className={css.detailActions}>
          <button
            type="button" className={css.primary}
            disabled={task.platforms.every(leg => leg.status !== 'pending')}
            onClick={() => {
              void (async () => {
                for (const leg of task.platforms) {
                  if (leg.status === 'pending') await publish.adaptPlatform(task.taskId, leg.platformId)
                }
              })()
            }}
          >
            {t('publish.action.preview')}
          </button>
          <button type="button" className={css.primary} disabled={state.recording} onClick={() => { void publish.recordTask(task.taskId) }}>
            {t('publish.action.record')}
          </button>
          {task.mode === 'scheduled' && task.scheduleItemId === null && (
            <span className={css.scheduleRow}>
              <input type="date" className={css.input} value={scheduleInputs.date}
                onChange={(event) => { setScheduleInputs({ ...scheduleInputs, date: event.target.value }) }} />
              <input type="time" className={css.input} value={scheduleInputs.time}
                onChange={(event) => { setScheduleInputs({ ...scheduleInputs, time: event.target.value }) }} />
              <button
                type="button" className={css.ghost}
                disabled={scheduleInputs.date.length === 0}
                onClick={() => { void publish.scheduleTask(task.taskId, scheduleInputs.date, scheduleInputs.time) }}
              >
                {t('publish.action.schedule')}
              </button>
            </span>
          )}
          <button type="button" className={css.ghost} onClick={() => { void publish.copyTask(task.taskId) }}>
            {t('publish.action.copy')}
          </button>
          <button
            type="button"
            className={css.danger}
            onClick={() => {
              if (!window.confirm(t('publish.action.deleteConfirm'))) return
              void publish.deleteTask(task.taskId)
            }}
          >
            {t('publish.action.delete')}
          </button>
        </div>
      )}

      {isRecorded && (
        <div className={css.detailActions}>
          <p className={css.recordedNote}>{t('publish.recorded.note')}</p>
          {task.topicId !== null && (
            <button type="button" className={css.primary} onClick={() => { void publish.reflowTask(task.taskId) }}>
              {t('publish.action.reflow')}
            </button>
          )}
        </div>
      )}

      <div className={css.legGrid}>
        {task.platforms.map((leg) => {
          const profile = platformProfileOf(leg.platformId)
          const busy = state.busyPlatforms[`${task.taskId}:${leg.platformId}`] === true
          const editing = draftEdit !== null && draftEdit.taskId === task.taskId && draftEdit.platformId === leg.platformId
          return (
            <div key={leg.platformId} className={css.legCard}>
              <header className={css.legHead}>
                <span className={css.platformName}>{profile?.name ?? leg.platformId}</span>
                <span className={css.platformMeta}>{leg.accountAlias}</span>
                <span className={clsx(css.badge, LEG_STATUS_CLASS[leg.status])}>{t(`publish.leg.${leg.status}`)}</span>
              </header>
              {leg.coverPrompt !== null && <p className={css.legCover}>{t('publish.leg.cover')}{leg.coverPrompt}</p>}
              {leg.tags.length > 0 && profile !== undefined && (
                <p className={css.legTags}>{formatTags(leg.tags, profile.tagStyle)}</p>
              )}
              <div className={css.legActions}>
                <button
                  type="button" className={css.mini} disabled={busy}
                  onClick={() => { void publish.adaptPlatform(task.taskId, leg.platformId) }}
                >
                  {leg.status === 'pending' ? t('publish.leg.adapt') : t('publish.leg.readapt')}
                </button>
                {!editing && (
                  <button
                    type="button" className={css.mini}
                    onClick={() => {
                      void (async () => {
                        const content = await publish.loadDraft(task.taskId, leg.platformId)
                        setDraftEdit({ taskId: task.taskId, platformId: leg.platformId, content: content ?? '' })
                      })()
                    }}
                  >
                    {t('publish.leg.edit')}
                  </button>
                )}
              </div>
              {editing && (
                <div className={css.editBlock}>
                  <textarea
                    className={css.editArea}
                    value={draftEdit.content}
                    onChange={(event) => { setDraftEdit({ ...draftEdit, content: event.target.value }) }}
                  />
                  {exceedsCharLimit(draftEdit.content, profile?.charLimit ?? null) && (
                    <p className={css.problem}>{t('publish.leg.overLimit')}</p>
                  )}
                  <div className={css.editActions}>
                    <button
                      type="button" className={css.primary}
                      onClick={() => {
                        void (async () => {
                          await publish.saveDraftEdit(task.taskId, leg.platformId, draftEdit.content)
                          setDraftEdit(null)
                        })()
                      }}
                    >
                      {t('publish.leg.save')}
                    </button>
                    <button type="button" className={css.ghost} onClick={() => { setDraftEdit(null) }}>
                      {t('publish.leg.cancel')}
                    </button>
                  </div>
                </div>
              )}
              {leg.attempts.length > 0 && (
                <details className={css.logBox}>
                  <summary>{t('publish.leg.log').replace('{count}', String(leg.attempts.length))}</summary>
                  <ul className={css.logList}>
                    {[...leg.attempts].reverse().map((attempt, index) => (
                      <li key={`${attempt.at}-${index}`} className={attempt.ok ? css.logOk : css.logFail}>
                        {attempt.at.slice(11, 19)} {t(`publish.attempt.${attempt.action}`)} — {attempt.detail}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
