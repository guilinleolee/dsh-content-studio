/**
 * The interaction view: a unified fan inbox over the interaction controller.
 * The header carries the derived summary chips; the toolbar holds the CSV
 * import, the CSV export, the batch classifier, the insight extractor, and
 * the disabled MCP-pull entry (the reserved channel). The left pane lists
 * the filtered conversations; the right pane renders the selected thread
 * with the persona binding, the demand tags, the note, the AI draft set,
 * and the send composer whose archive never depends on the reserved call.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type {
  InteractionConversation, InteractionConversationStatus, InteractionInsightEntry,
  InteractionStyle,
} from '@deepseek-ai/dsh-content-outputs/types'
import type { PersonaEntry } from '@deepseek-ai/dsh-content-outputs/types'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { PersonaController } from './persona/persona-store.ts'
import type { TemplateController } from './template/template-store.ts'
import type { StudioKey } from './locales.ts'
import {
  INTERACTION_PLATFORM_IDS, INTERACTION_SENTIMENT_IDS, INTERACTION_STATUS_IDS,
  INTERACTION_STYLE_IDS, INTERACTION_TYPE_IDS, lastInboundMessage, lastMessage,
  type InteractionFilters,
} from './interaction/interaction-model.ts'
import type { InteractionController } from './interaction/interaction-store.ts'
import { SplitDetail } from './SplitDetail.tsx'
import css from './InteractionView.module.css'

/** The locale seat's translate function, shared by every sub-panel. */
type Translate = PropsLocale<'content-studio'>['t']

/** Injected face of the interaction view. */
export interface InteractionViewInjected {
  interaction: InteractionController
  personas: PersonaController
  templates: TemplateController
  /** Current theme directory names, projected from the outputs library. */
  listThemes: () => Promise<readonly string[]>
}

/** Full view props: the injected face plus the locale seat. */
export type InteractionViewProps = InteractionViewInjected & PropsLocale<'content-studio'>

/** The demand-tag values the data contract freezes; stored and rendered verbatim. */
const TAG_OPTIONS: readonly string[] = ['产品咨询', '价格疑问', '内容建议', '投诉', '其他']

/** Platform label keys, aligned with the picker order. */
const PLATFORM_KEYS: Record<string, StudioKey> = {
  xhs: 'interaction.platform.xhs',
  douyin: 'interaction.platform.douyin',
  weixin: 'interaction.platform.weixin',
  bilibili: 'interaction.platform.bilibili',
}

/** Shorten one message to the list excerpt length. */
function excerpt(text: string, max = 60): string {
  const single = text.replaceAll(/\s+/gu, ' ').trim()
  return single.length > max ? `${single.slice(0, max)}…` : single
}

/**
 * Render the interaction workbench.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export function InteractionView({ interaction, personas, templates, listThemes, t }: InteractionViewProps) {
  const state = useSyncExternalStore(
    fn => interaction.subscribe(fn),
    () => interaction.getState(),
  )
  const personaState = useSyncExternalStore(
    fn => personas.subscribe(fn),
    () => personas.getState(),
  )
  const [themes, setThemes] = useState<readonly string[]>([])
  const [exportTheme, setExportTheme] = useState('')
  const [composer, setComposer] = useState('')
  const [style, setStyle] = useState<InteractionStyle>('friendly')
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null)
  const [templateSkeleton, setTemplateSkeleton] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  useEffect(() => {
    void (async () => {
      try { setThemes(await listThemes()) } catch { setThemes([]) }
    })()
  }, [listThemes])

  // The inbox loads from disk on mount: nothing else triggers the read.
  useEffect(() => {
    void interaction.load()
  }, [interaction])
  // The persona picker needs the persona list loaded even when the persona
  // view was never visited (ensureLoaded is idempotent).
  useEffect(() => {
    void personas.ensureLoaded()
  }, [personas])

  useEffect(() => {
    if (state.notice === null) return
    const timer = window.setTimeout(() => { interaction.clearNotice() }, 4000)
    return () => { window.clearTimeout(timer) }
  }, [state.notice, interaction])

  const filters = interaction.filters()
  const conversations = useMemo(
    () => interaction.visible(),
    [interaction, state.manifest, state.filtersRevision],
  )
  const selected = useMemo(
    () => state.manifest?.conversations.find(candidate => candidate.id === state.selectedId) ?? null,
    [state.manifest, state.selectedId],
  )
  const selectedId = selected?.id ?? null

  // Reset the editor state when the selection changes — never on unrelated
  // manifest refreshes, or typing would lose its work.
  useEffect(() => {
    const current = selectedId === null
      ? null
      : interaction.getState().manifest?.conversations.find(candidate => candidate.id === selectedId) ?? null
    setNoteDraft(current?.note ?? '')
    setTargetMessageId(current === null ? null : lastInboundMessage(current)?.id ?? null)
    setComposer('')
  }, [selectedId, interaction])

  // Keep the note editor in sync when the store changed it underneath
  // (another save path), without fighting the typing in progress.
  useEffect(() => {
    if (selected !== null && document.activeElement?.tagName !== 'TEXTAREA') setNoteDraft(selected.note)
  }, [selected])

  const personaOf = (id: string | null): PersonaEntry | null =>
    id === null ? null : personaState.personas.find(entry => entry.id === id) ?? null

  const personaFacts = (entry: PersonaEntry | null) => entry === null ? null : {
    id: entry.id,
    digest: entry.digest.length > 0 ? entry.digest : null,
    phrases: typeof entry.fields.phrases.value === 'string' && entry.fields.phrases.value.trim().length > 0
      ? [entry.fields.phrases.value.trim()]
      : [],
    samples: entry.links
      .map(link => link.sampleText)
      .filter((sample): sample is string => sample !== null && sample.trim().length > 0),
  }

  const togglePlatform = (platform: InteractionFilters['platforms'][number]): void => {
    const next = filters.platforms.includes(platform)
      ? filters.platforms.filter(candidate => candidate !== platform)
      : [...filters.platforms, platform]
    interaction.setFilters({ platforms: next })
  }
  const toggleTag = (conversation: InteractionConversation, tag: string): void => {
    const next = conversation.tags.includes(tag)
      ? conversation.tags.filter(candidate => candidate !== tag)
      : [...conversation.tags, tag]
    void interaction.patchConversation(conversation.id, { tags: next })
  }

  const onImportFile = (file: File | undefined): void => {
    if (file === undefined) return
    void (async () => {
      const text = await file.text()
      await interaction.stageImport(file.name, text)
    })()
  }

  const target = selected === null || targetMessageId === null
    ? null
    : selected.messages.find(message => message.id === targetMessageId) ?? null

  const pickTemplate = (): void => {
    templates.openPicker({
      category: 'interaction',
      targetLabel: t('interaction.reply.title'),
      hasContent: () => templateSkeleton !== null,
      apply: (draft) => { setTemplateSkeleton(draft.body) },
    })
  }

  const generate = (): void => {
    if (selected === null || target === null || target.direction !== 'in') return
    void interaction.generateDrafts(
      selected.id,
      target.id,
      style,
      personaFacts(personaOf(selected.personaId)),
      templateSkeleton,
    )
  }

  // The topic push anchors on the conversation that produced the example
  // message; a lost anchor degrades to the selected conversation.
  const conversationOfExample = (exampleMessageId: string | null): string => {
    if (exampleMessageId !== null) {
      const owner = state.manifest?.conversations.find(conversation =>
        conversation.messages.some(message => message.id === exampleMessageId))
      if (owner !== undefined) return owner.id
    }
    return selectedId ?? ''
  }
  const pushInsight = (entry: InteractionInsightEntry): void => {
    void interaction.pushTopic(
      entry.label,
      entry.topicHint ?? entry.label,
      conversationOfExample(entry.exampleMessageId),
      entry.topicHint ?? entry.label,
    )
  }

  const summary = state.manifest?.summary
  const insights = state.manifest?.insights

  const listPane = (
    <div className={css.listInner}>
      <div className={css.filters}>
        <div className={css.chipRow}>
          {INTERACTION_PLATFORM_IDS.map(platform => (
            <button
              key={platform}
              type="button"
              className={css.chip}
              aria-pressed={filters.platforms.includes(platform)}
              onClick={() => { togglePlatform(platform) }}
            >
              {t(PLATFORM_KEYS[platform] as StudioKey)}
            </button>
          ))}
        </div>
        <div className={css.selectRow}>
          <select
            className={css.select}
            aria-label={t('interaction.filter.status')}
            value={filters.status}
            onChange={(event) => { interaction.setFilters({ status: event.target.value as InteractionFilters['status'] }) }}
          >
            <option value="all">{t('interaction.filter.all')}</option>
            {INTERACTION_STATUS_IDS.map(status => (
              <option key={status} value={status}>{t(`interaction.status.${status}`)}</option>
            ))}
          </select>
          <select
            className={css.select}
            aria-label={t('interaction.filter.type')}
            value={filters.type}
            onChange={(event) => { interaction.setFilters({ type: event.target.value as InteractionFilters['type'] }) }}
          >
            <option value="all">{t('interaction.filter.all')}</option>
            {INTERACTION_TYPE_IDS.map(type => (
              <option key={type} value={type}>{t(`interaction.type.${type}`)}</option>
            ))}
          </select>
          <select
            className={css.select}
            aria-label={t('interaction.filter.sentiment')}
            value={filters.sentiment}
            onChange={(event) => { interaction.setFilters({ sentiment: event.target.value as InteractionFilters['sentiment'] }) }}
          >
            <option value="all">{t('interaction.filter.all')}</option>
            {INTERACTION_SENTIMENT_IDS.map(sentiment => (
              <option key={sentiment} value={sentiment}>{t(`interaction.sentiment.${sentiment}`)}</option>
            ))}
          </select>
          <select
            className={css.select}
            aria-label={t('interaction.filter.intent')}
            value={filters.intent}
            onChange={(event) => { interaction.setFilters({ intent: event.target.value as InteractionFilters['intent'] }) }}
          >
            <option value="all">{t('interaction.filter.all')}</option>
            {(['consult', 'praise', 'complain', 'demand', 'spam', 'unknown'] as const).map(intent => (
              <option key={intent} value={intent}>{t(`interaction.intent.${intent}`)}</option>
            ))}
          </select>
        </div>
        <input
          className={css.search}
          type="search"
          placeholder={t('interaction.filter.search')}
          value={filters.search}
          onChange={(event) => { interaction.setFilters({ search: event.target.value }) }}
        />
      </div>
      <div className={css.cards}>
        {conversations.length === 0 && <div className={css.emptySmall}>{t('interaction.list.none')}</div>}
        {conversations.map((conversation) => {
          const latest = lastMessage(conversation)
          return (
            <button
              key={conversation.id}
              type="button"
              className={css.card}
              aria-current={conversation.id === state.selectedId || undefined}
              onClick={() => { interaction.select(conversation.id) }}
            >
              <span className={css.cardHead}>
                <span className={css.cardName}>
                  {conversation.participant.nickname.length > 0
                    ? conversation.participant.nickname
                    : conversation.participant.externalUserId}
                </span>
                <span className={css.platform}>{t(PLATFORM_KEYS[conversation.platform] as StudioKey)}</span>
              </span>
              {latest !== null && <span className={css.cardExcerpt}>{excerpt(latest.content)}</span>}
              <span className={css.cardMeta}>
                <span>{t(`interaction.status.${conversation.status}`)}</span>
                <span>{conversation.messages.length} {t('interaction.list.messages')}</span>
                {conversation.starred && <span aria-label={t('interaction.star')}>★</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  const detailPane = selected === null
    ? <div className={css.empty}>{t('interaction.detail.empty')}</div>
    : (
      <div className={css.detail}>
        <div className={css.detailHead}>
          <span className={css.cardName}>
            {selected.participant.nickname.length > 0 ? selected.participant.nickname : selected.participant.externalUserId}
          </span>
          <select
            className={css.select}
            aria-label={t('interaction.filter.status')}
            value={selected.status}
            onChange={(event) => {
              void interaction.patchConversation(selected.id, { status: event.target.value as InteractionConversationStatus })
            }}
          >
            {INTERACTION_STATUS_IDS.map(status => (
              <option key={status} value={status}>{t(`interaction.status.${status}`)}</option>
            ))}
          </select>
          <select
            className={css.select}
            aria-label={t('interaction.detail.persona')}
            title={personaState.personas.length === 0 ? t('persona.empty') : undefined}
            value={selected.personaId ?? ''}
            onChange={(event) => { void interaction.patchConversation(selected.id, { personaId: event.target.value === '' ? null : event.target.value }) }}
          >
            <option value="">{t('interaction.detail.persona.none')}</option>
            {personaState.personas.map(entry => (
              <option key={entry.id} value={entry.id}>{entry.name}</option>
            ))}
          </select>
          <button
            type="button"
            className={css.mini}
            aria-pressed={selected.starred}
            onClick={() => { void interaction.patchConversation(selected.id, { starred: !selected.starred }) }}
          >
            {selected.starred ? `★ ${t('interaction.unstar')}` : `☆ ${t('interaction.star')}`}
          </button>
        </div>
        {(selected.topicRef !== null || selected.outputRef !== null) && (
          <div className={css.refs}>
            {selected.topicRef !== null && <span>{t('interaction.detail.topicRef')}: {selected.topicRef}</span>}
            {selected.outputRef !== null && <span>{t('interaction.detail.outputRef')}: {selected.outputRef}</span>}
          </div>
        )}
        <div className={css.tagRow} aria-label={t('interaction.detail.tags')}>
          {TAG_OPTIONS.map(tag => (
            <button
              key={tag}
              type="button"
              className={css.chip}
              aria-pressed={selected.tags.includes(tag)}
              onClick={() => { toggleTag(selected, tag) }}
            >
              {tag}
            </button>
          ))}
        </div>
        <textarea
          className={css.note}
          aria-label={t('interaction.detail.note.aria')}
          placeholder={t('interaction.detail.note.placeholder')}
          value={noteDraft}
          onChange={(event) => { setNoteDraft(event.target.value) }}
          onBlur={() => {
            if (noteDraft !== selected.note) void interaction.patchConversation(selected.id, { note: noteDraft })
          }}
        />

        <div className={css.thread} aria-label={t('interaction.detail.label')}>
          {selected.messages.map((message) => {
            const isFan = message.direction === 'in'
            return (
              <button
                key={message.id}
                type="button"
                className={isFan ? css.lineIn : css.lineOut}
                data-target={message.id === targetMessageId || undefined}
                onClick={() => { if (isFan) setTargetMessageId(message.id) }}
              >
                <span className={css.lineRole}>{isFan ? t('interaction.thread.fan') : t('interaction.thread.me')}</span>
                <span className={css.lineBody}>
                  {message.content}
                  {isFan && (
                    <span className={css.taggings}>
                      <span>
                        {t(`interaction.sentiment.${message.sentiment.value}`)}
                        {message.sentiment.source === 'ai' && t('interaction.thread.aiTag')}
                      </span>
                      <span>
                        {t(`interaction.intent.${message.intent.value}`)}
                        {message.intent.source === 'ai' && t('interaction.thread.aiTag')}
                      </span>
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <div className={css.reply}>
          <span className={css.sectionTitle}>{t('interaction.reply.title')}</span>
          {target === null || target.direction !== 'in'
            ? <span className={css.emptySmall}>{t('interaction.reply.noTarget')}</span>
            : (
              <>
                <div className={css.replyControls}>
                  <label className={css.label}>
                    {t('interaction.reply.style')}
                    <select
                      className={css.select}
                      value={style}
                      onChange={(event) => { setStyle(event.target.value as InteractionStyle) }}
                    >
                      {INTERACTION_STYLE_IDS.map(candidate => (
                        <option key={candidate} value={candidate}>{t(`interaction.style.${candidate}`)}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className={css.mini} onClick={pickTemplate}>{t('interaction.reply.template')}</button>
                  {templateSkeleton !== null && (
                    <button type="button" className={css.mini} onClick={() => { setTemplateSkeleton(null) }}>✕</button>
                  )}
                  <button
                    type="button"
                    className={css.primary}
                    disabled={state.busy}
                    onClick={generate}
                  >
                    {t('interaction.reply.generate')}
                  </button>
                </div>
                {target.replyDrafts.length > 0 && (
                  <div className={css.drafts}>
                    <span className={css.sectionTitle}>{t('interaction.reply.drafts')}</span>
                    {target.replyDrafts.map(draft => (
                      <div key={draft.id} className={css.draft}>
                        <span className={css.draftBody}>{draft.content}</span>
                        <button type="button" className={css.mini} onClick={() => { setComposer(draft.content) }}>
                          {t('interaction.reply.adopt')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  className={css.composer}
                  aria-label={t('interaction.reply.composer')}
                  value={composer}
                  onChange={(event) => { setComposer(event.target.value) }}
                />
                <div className={css.replyActions}>
                  <button
                    type="button"
                    className={css.mini}
                    disabled={composer.trim().length === 0 || state.busy}
                    onClick={() => {
                      // The surrounding target guard already narrowed both;
                      // only the composer emptiness needs checking here.
                      if (composer.trim().length === 0) return
                      void interaction.saveDraft(selected.id, target.id, style, composer.trim(), selected.personaId)
                    }}
                  >
                    {t('interaction.reply.sendDraft')}
                  </button>
                  <button
                    type="button"
                    className={css.primary}
                    disabled={composer.trim().length === 0 || state.busy}
                    onClick={() => {
                      if (composer.trim().length === 0) return
                      const content = composer.trim()
                      const personaId = selected.personaId
                      void (async () => {
                        await interaction.sendReply(selected.id, target.id, content, personaId)
                        setComposer('')
                      })()
                    }}
                  >
                    {t('interaction.reply.send')}
                  </button>
                </div>
              </>
            )}
        </div>
      </div>
    )

  return (
    <div className={css.view}>
      <div className={css.header}>
        <h2 className={css.title}>{t('interaction.title')}</h2>
        <span className={css.subtitle}>{t('interaction.subtitle')}</span>
      </div>
      {summary !== undefined && (
        <div className={css.summaryRow}>
          {INTERACTION_STATUS_IDS.map(status => (
            <span key={status} className={css.summaryChip}>
              {t(`interaction.summary.${status}`)} ×{summary[status]}
            </span>
          ))}
        </div>
      )}
      {state.problems.length > 0 && (
        <div className={css.problems}>{t('interaction.problems')} {state.problems.join('；')}</div>
      )}
      {state.notice !== null && (
        <div className={css.notice} role="status">
          {t(`interaction.notice.${state.notice}`)}
          {state.errorDetail !== null && <div>{state.errorDetail}</div>}
        </div>
      )}
      {state.busy && (
        <div className={css.busy}>
          {t('interaction.busy')}
          {state.progress !== null && <span>{` ${state.progress.done}/${state.progress.total}`}</span>}
        </div>
      )}

      <div className={css.toolbar}>
        <label className={css.fileButton}>
          {t('interaction.import')}
          <input
            type="file"
            accept=".csv,text/csv"
            className={css.fileInput}
            onChange={(event) => { onImportFile(event.target.files?.[0]) }}
          />
        </label>
        <button
          type="button"
          className={css.mini}
          disabled={state.busy || conversations.length === 0}
          onClick={() => { void interaction.classifySelected(conversations.map(conversation => conversation.id)) }}
        >
          {t('interaction.classify')}
        </button>
        <button
          type="button"
          className={css.mini}
          disabled={state.busy || conversations.length === 0}
          onClick={() => { void interaction.extractInsights(conversations.map(conversation => conversation.id)) }}
        >
          {t('interaction.insights')}
        </button>
        <span className={css.mcpPull} title={t('interaction.mcp.disabled')}>
          <button type="button" className={css.mini} disabled>{t('interaction.mcp.pull')}</button>
        </span>
        <span className={css.exportGroup}>
          <select
            className={css.select}
            aria-label={t('interaction.export.aria')}
            value={exportTheme}
            onChange={(event) => { setExportTheme(event.target.value) }}
          >
            <option value="">{t('interaction.export.aria')}</option>
            {themes.map(theme => <option key={theme} value={theme}>{theme}</option>)}
          </select>
          <button
            type="button"
            className={css.mini}
            disabled={state.busy}
            onClick={() => { void interaction.exportCsv(exportTheme) }}
          >
            {t('interaction.export')}
          </button>
        </span>
      </div>

      {state.preview !== null && (
        <div className={css.preview}>
          <span className={css.sectionTitle}>{t('interaction.import.preview')} — {state.preview.fileName}</span>
          <span>{state.preview.messages.length} {t('interaction.import.valid')}</span>
          {state.preview.rejected.length > 0 && (
            <div className={css.rejected}>
              <span>{t('interaction.import.rejected')}:</span>
              {state.preview.rejected.map(rejection => (
                <div key={rejection.row} className={css.rejectedRow}>
                  #{rejection.row}: {rejection.reason}
                </div>
              ))}
            </div>
          )}
          <div className={css.replyActions}>
            <button type="button" className={css.mini} onClick={() => { interaction.discardImport() }}>
              {t('interaction.import.discard')}
            </button>
            <button
              type="button"
              className={css.primary}
              disabled={state.preview.messages.length === 0}
              onClick={() => { void interaction.commitImport() }}
            >
              {t('interaction.import.commit')}
            </button>
          </div>
        </div>
      )}
      {state.importReport !== null && state.preview === null && (
        <div className={css.report}>
          <span>{t('interaction.import.report')}:</span>
          <span>{state.importReport.added} {t('interaction.import.added')}</span>
          <span>{state.importReport.updated} {t('interaction.import.updated')}</span>
          <span>{state.importReport.conversationsCreated} {t('interaction.import.created')}</span>
          <span>{state.importReport.threadWarnings.length} {t('interaction.import.threads')}</span>
        </div>
      )}

      {insights !== undefined && (
        <div className={css.insights}>
          <span className={css.sectionTitle}>{t('interaction.insights.title')}</span>
          {insights.generatedAt !== null && (
            <span className={css.generatedAt}>
              {t('interaction.insights.generatedAt')} {insights.generatedAt.slice(0, 10)}
            </span>
          )}
          {insights.generatedAt === null && <span className={css.emptySmall}>{t('interaction.insights.none')}</span>}
          <InsightList label={t('interaction.insights.questions')} entries={insights.topQuestions} onPush={pushInsight} t={t} />
          <InsightList label={t('interaction.insights.pain')} entries={insights.painPoints} onPush={pushInsight} t={t} />
          <InsightList label={t('interaction.insights.interests')} entries={insights.interests} onPush={pushInsight} t={t} />
        </div>
      )}

      {state.manifest === null && state.loading && <div className={css.empty}>{t('interaction.loading')}</div>}
      {state.manifest !== null && state.manifest.conversations.length === 0 && (
        <div className={css.empty}>{t('interaction.empty')}</div>
      )}

      {state.manifest !== null && state.manifest.conversations.length > 0 && (
        <SplitDetail list={listPane} detail={detailPane} detailLabel={t('interaction.detail.label')} />
      )}
    </div>
  )
}

/** One insight list with its per-entry topic push. */
function InsightList({ label, entries, onPush, t }: {
  label: string
  entries: readonly InteractionInsightEntry[]
  onPush: (entry: InteractionInsightEntry) => void
  t: Translate
}): React.JSX.Element | null {
  if (entries.length === 0) return null
  return (
    <div className={css.insightList}>
      <span className={css.insightLabel}>{label}</span>
      {entries.map(entry => (
        <div key={entry.label} className={css.insightRow}>
          <span className={css.insightText}>{entry.label} ×{entry.count}</span>
          {entry.topicHint !== null && <span className={css.insightHint}>{entry.topicHint}</span>}
          <button type="button" className={css.mini} onClick={() => { onPush(entry) }}>
            {t('interaction.insights.toTopic')}
          </button>
        </div>
      ))}
    </div>
  )
}
