/**
 * The template library page: the list panel (filters, tags, cards), the
 * editor sheet (metadata, body, reconciled variables, live preview, explicit
 * AI helpers, history drawer with confirmed restore), and the import/export
 * face. All state and actions live on the injected controller; this file only
 * wires them to the DOM.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { TemplateCategory, TemplateImportStrategy, TemplateRecord } from '@deepseek-ai/dsh-content-outputs/types'
import { renderTemplate, scanTemplateVariables, TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_LABELS } from './model.ts'
import type { TemplateController, TemplatePrefs, TemplateState } from './template-store.ts'
import css from './TemplateLibraryView.module.css'

/** Props: the injected controller plus the locale seat. */
export type TemplateLibraryViewProps = {
  templates: TemplateController
} & PropsLocale<'content-studio'>

/** The import conflict strategies in picker order. */
const IMPORT_STRATEGIES: readonly TemplateImportStrategy[] = ['skip', 'overwrite', 'rename']

/**
 * Render the template library page.
 * @param props - the injected controller and the locale seat.
 * @returns the page element tree.
 */
export function TemplateLibraryView({ templates, t }: TemplateLibraryViewProps) {
  const state = useSyncExternalStore(
    listener => templates.subscribe(listener),
    () => templates.getState(),
  )
  const prefs = useSyncExternalStore(
    listener => templates.subscribe(listener),
    (): TemplatePrefs => templates.getPrefs(),
  )
  const [importStrategy, setImportStrategy] = useState<TemplateImportStrategy>('skip')
  const [previewValues, setPreviewValues] = useState<Readonly<Record<string, string>>>({})

  useEffect(() => { templates.reload() }, [templates])

  const editor = state.editor
  const form = editor?.form ?? null
  const preview = form === null
    ? null
    : renderTemplate(form.body, previewValues, form.variables)

  const filtered = useMemo(() => {
    const search = prefs.search.trim().toLowerCase()
    return state.templates.filter((record) => {
      if (prefs.category !== null && record.category !== prefs.category) return false
      if (prefs.status !== 'all' && record.status !== prefs.status) return false
      if (prefs.tagIds.length > 0 && !prefs.tagIds.every(tagId => record.tagIds.includes(tagId))) return false
      if (search.length > 0 && !`${record.name}\n${record.description}\n${record.body}`.toLowerCase().includes(search)) return false
      return true
    })
  }, [state.templates, prefs])

  const deleteRecord = (record: TemplateRecord): void => {
    const confirmed = window.confirm(t('template.delete.confirm').replace('{name}', record.name))
    if (confirmed) templates.remove(record.id)
  }

  const tagNames = new Map(state.tags.map(tag => [tag.id, tag.name]))

  return (
    <div className={css.template}>
      <div className={css.templateHead}>
        <div>
          <h2 className={css.templateTitle}>{t('template.title')}</h2>
          <p className={css.templateHint}>{t('template.hint')}</p>
        </div>
        <div className={css.templateActions}>
          <label className={css.templateAria} htmlFor="template-import-file">{t('template.import')}</label>
          <select
            aria-label={t('template.import.strategy')}
            value={importStrategy}
            onChange={(event) => { setImportStrategy(event.target.value as TemplateImportStrategy) }}
          >
            {IMPORT_STRATEGIES.map(strategy => (
              <option key={strategy} value={strategy}>{t(`template.import.${strategy}`)}</option>
            ))}
          </select>
          <input
            id="template-import-file"
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file !== undefined) templates.importFile(file, importStrategy)
              event.target.value = ''
            }}
          />
          <button type="button" className={css.templateMini} onClick={() => { document.getElementById('template-import-file')?.click() }}>
            {t('template.import')}
          </button>
          <button type="button" className={css.templateMini} onClick={() => { templates.exportIds([]) }}>
            {t('template.exportAll')}
          </button>
          <button type="button" className={css.templateMini} onClick={() => { templates.importStarterPack() }} title={t('template.starter.hint')}>
            {t('template.starter')}
          </button>
          <button type="button" className={css.templatePrimary} onClick={() => { templates.openNew(); setPreviewValues({}) }}>
            {t('template.new')}
          </button>
        </div>
      </div>

      {state.importReport !== null && (
        <div className={css.templateBanner} role="status">
          <span>
            {t('template.import.report')
              .replace('{file}', state.importReport.fileName)
              .replace('{added}', String(state.importReport.summary.added))
              .replace('{skipped}', String(state.importReport.summary.skipped))
              .replace('{overwritten}', String(state.importReport.summary.overwritten))
              .replace('{renamed}', String(state.importReport.summary.renamed))
              .replace('{failed}', String(state.importReport.summary.failed.length))}
          </span>
          {state.importReport.summary.failed.map(detail => <span key={detail} className={css.templateProblems}>{detail}</span>)}
          <button type="button" className={css.templateMini} onClick={() => { templates.dismissImportReport() }}>
            {t('template.notice.dismiss')}
          </button>
        </div>
      )}
      {state.notice !== null && (
        <div className={css.templateBanner} role="status">
          <span>{t(`template.notice.${state.notice}`)}</span>
          <button type="button" className={css.templateMini} onClick={() => { templates.dismissNotice() }}>
            {t('template.notice.dismiss')}
          </button>
        </div>
      )}
      {state.problems.length > 0 && (
        <div className={css.templateBanner}>
          <span>{`${t('template.problems')} ${state.problems.join('；')}`}</span>
        </div>
      )}

      <div className={css.templateLayout}>
        <div className={css.templateList}>
          <div className={css.templateFilters}>
            <input
              className={`${css.templateInput} ${css.templateSearch}`}
              placeholder={t('template.search')}
              value={prefs.search}
              onChange={(event) => { templates.setFilter({ search: event.target.value }) }}
            />
            <select
              aria-label={t('template.filter.category')}
              value={prefs.category ?? ''}
              onChange={(event) => { templates.setFilter({ category: event.target.value === '' ? null : event.target.value as TemplateCategory }) }}
            >
              <option value="">{t('template.filter.all')}</option>
              {TEMPLATE_CATEGORIES.map(category => (
                <option key={category} value={category}>{TEMPLATE_CATEGORY_LABELS[category]}</option>
              ))}
            </select>
            <select
              aria-label={t('template.filter.status')}
              value={prefs.status}
              onChange={(event) => { templates.setFilter({ status: event.target.value as TemplatePrefs['status'] }) }}
            >
              <option value="all">{t('template.status.all')}</option>
              <option value="active">{t('template.status.active')}</option>
              <option value="archived">{t('template.status.archived')}</option>
            </select>
          </div>
          <div className={css.templateTagRow}>
            {state.tags.map(tag => (
              <button
                key={tag.id}
                type="button"
                className={`${css.templateTag} ${prefs.tagIds.includes(tag.id) ? css.templateTagActive : ''}`}
                onClick={() => {
                  templates.setFilter({
                    tagIds: prefs.tagIds.includes(tag.id)
                      ? prefs.tagIds.filter(candidate => candidate !== tag.id)
                      : [...prefs.tagIds, tag.id],
                  })
                }}
                onDoubleClick={() => { templates.removeTag(tag.id) }}
                title={t('template.tag.removeHint')}
              >
                {tag.name}
              </button>
            ))}
            <TagInput onAdd={(name) => { templates.addTag(name) }} placeholder={t('template.tag.add')} addLabel={t('template.tag.addAria')} />
          </div>
          <span className={css.templateCardMeta}>{t('template.count').replace('{n}', String(filtered.length))}</span>
          {filtered.length === 0 && (
            <div className={css.templateEmpty}>
              {t('template.empty')}
              {state.templates.length === 0 && (
                <div>
                  <button type="button" className={css.templatePrimary} onClick={() => { templates.importStarterPack() }}>
                    {t('template.starter.cta')}
                  </button>
                </div>
              )}
            </div>
          )}
          {filtered.map(record => (
            <div key={record.id} className={`${css.templateCard} ${record.status === 'archived' ? css.templateCardArchived : ''}`}>
              <span className={css.templateCardName}>
                {record.name}
                <span className={css.templateCardMeta}>
                  {`${TEMPLATE_CATEGORY_LABELS[record.category]} · v${String(record.version)} · ${record.status === 'archived' ? t('template.status.archived') : t('template.status.active')}`}
                </span>
              </span>
              {record.description.trim().length > 0 && <span className={css.templateCardMeta}>{record.description}</span>}
              <span className={css.templateCardMeta}>
                {record.tagIds.map(tagId => tagNames.get(tagId)).filter(name => name !== undefined).join('、')}
              </span>
              <span className={css.templateCardActions}>
                <button type="button" className={css.templateMini} onClick={() => { templates.openEditor(record); setPreviewValues({}) }}>
                  {t('template.card.edit')}
                </button>
                <button type="button" className={css.templateMini} onClick={() => { templates.copyTemplate(record) }}>
                  {t('template.card.copy')}
                </button>
                <button type="button" className={css.templateMini} onClick={() => { templates.exportIds([record.id]) }}>
                  {t('template.card.export')}
                </button>
                <button type="button" className={css.templateMini} onClick={() => { templates.toggleArchive(record) }}>
                  {record.status === 'active' ? t('template.card.archive') : t('template.card.restore')}
                </button>
                <button type="button" className={`${css.templateMini} ${css.templateDanger}`} onClick={() => { deleteRecord(record) }}>
                  {t('template.card.delete')}
                </button>
              </span>
            </div>
          ))}
        </div>

        <div className={css.templateMain}>
          {form === null ? (
            <GenerateBox state={state} templates={templates} t={t} />
          ) : (
            <>
              {state.aiDraft !== null && (
                <div className={css.templateDraft}>
                  <strong className={css.templateGenerateTitle}>{t('template.ai.draft')}</strong>
                  {state.aiDraft.problems.map(problem => <span key={problem} className={css.templateProblems}>{problem}</span>)}
                  <pre className={css.templatePreviewOutput}>{state.aiDraft.draft.body}</pre>
                  <div className={css.templateFoot}>
                    <button type="button" className={css.templatePrimary} onClick={() => { templates.adoptAiDraft(); setPreviewValues({}) }}>
                      {t('template.ai.adopt')}
                    </button>
                    <button type="button" className={css.templateMini} onClick={() => { templates.discardAiDraft() }}>
                      {t('template.ai.discard')}
                    </button>
                  </div>
                </div>
              )}

              <div className={css.templateFormGrid}>
                <label className={css.templateField}>
                  <span className={css.templateLabel}>{t('template.field.name')}</span>
                  <input
                    className={css.templateInput}
                    value={form.name}
                    onChange={(event) => { templates.patchForm({ name: event.target.value }) }}
                  />
                </label>
                <label className={css.templateField}>
                  <span className={css.templateLabel}>{t('template.field.category')}</span>
                  <select
                    className={css.templateInput}
                    value={form.category}
                    onChange={(event) => { templates.patchForm({ category: event.target.value as TemplateCategory }) }}
                  >
                    {TEMPLATE_CATEGORIES.map(category => (
                      <option key={category} value={category}>{TEMPLATE_CATEGORY_LABELS[category]}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={css.templateField}>
                <span className={css.templateLabel}>{t('template.field.description')}</span>
                <input
                  className={css.templateInput}
                  value={form.description}
                  onChange={(event) => { templates.patchForm({ description: event.target.value }) }}
                />
              </label>
              <div className={css.templateTagRow}>
                {state.tags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`${css.templateTag} ${form.tagIds.includes(tag.id) ? css.templateTagActive : ''}`}
                    onClick={() => { templates.toggleFormTag(tag.id) }}
                  >
                    {tag.name}
                  </button>
                ))}
                {state.tags.length === 0 && <span className={css.templateCardMeta}>{t('template.field.noTags')}</span>}
              </div>
              <label className={css.templateField}>
                <span className={css.templateLabel}>{t('template.field.body')}</span>
                <textarea
                  className={`${css.templateTextarea} ${css.templateBodyTextarea}`}
                  value={form.body}
                  placeholder={t('template.field.bodyHint')}
                  onChange={(event) => { templates.patchForm({ body: event.target.value }) }}
                />
              </label>

              <div className={css.templateVariableTable}>
                <span className={css.templateLabel}>{t('template.field.variables')}</span>
                {form.variables.length === 0 && <span className={css.templateCardMeta}>{t('template.variable.none')}</span>}
                {form.variables.map((variable) => {
                  const active = scanTemplateVariables(form.body).includes(variable.name)
                  return (
                    <div key={variable.name} className={`${css.templateVariableRow} ${active ? '' : css.templateVariableUnused}`}>
                      <span className={css.templateVariableName} title={variable.name}>{`{{${variable.name}}}`}</span>
                      <input
                        className={css.templateInput}
                        aria-label={t('template.variable.label')}
                        placeholder={t('template.variable.label')}
                        value={variable.label}
                        onChange={(event) => { templates.patchVariable(variable.name, { label: event.target.value }) }}
                      />
                      <input
                        className={css.templateInput}
                        aria-label={t('template.variable.description')}
                        placeholder={t('template.variable.description')}
                        value={variable.description}
                        onChange={(event) => { templates.patchVariable(variable.name, { description: event.target.value }) }}
                      />
                      <input
                        className={css.templateInput}
                        aria-label={t('template.variable.default')}
                        placeholder={t('template.variable.default')}
                        value={variable.defaultValue}
                        onChange={(event) => { templates.patchVariable(variable.name, { defaultValue: event.target.value }) }}
                      />
                      <label className={css.templateCheckboxLabel}>
                        <input
                          type="checkbox"
                          checked={variable.required}
                          onChange={(event) => { templates.patchVariable(variable.name, { required: event.target.checked }) }}
                        />
                        {t('template.variable.required')}
                      </label>
                      {!active && (
                        <button type="button" className={css.templateMini} onClick={() => { templates.patchForm({ variables: form.variables.filter(candidate => candidate.name !== variable.name) }) }}>
                          {t('template.variable.remove')}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className={css.templatePreview}>
                <span className={css.templateLabel}>{t('template.preview.title')}</span>
                {form.variables.map(variable => (
                  <input
                    key={variable.name}
                    className={css.templateInput}
                    placeholder={`${variable.label || variable.name}${variable.required ? `（${t('template.variable.required')}）` : ''}`}
                    value={previewValues[variable.name] ?? ''}
                    onChange={(event) => { setPreviewValues({ ...previewValues, [variable.name]: event.target.value }) }}
                  />
                ))}
                {preview !== null && preview.unresolved.length > 0 && (
                  <span className={css.templateProblems}>
                    {t('template.preview.unresolved').replace('{list}', preview.unresolved.join('、'))}
                  </span>
                )}
                <pre className={css.templatePreviewOutput}>{preview?.output ?? ''}</pre>
              </div>

              <div className={css.templateGenerate}>
                <span className={css.templateLabel}>{t('template.ai.optimize')}</span>
                <div className={css.templateFoot}>
                  <input
                    className={`${css.templateInput} ${css.templateFootNote}`}
                    placeholder={t('template.ai.optimizePrompt')}
                    value={state.optimizeSource}
                    onChange={(event) => { templates.setOptimizeSource(event.target.value) }}
                  />
                  <button
                    type="button"
                    className={css.templateMini}
                    disabled={state.aiBusy !== false}
                    onClick={() => { templates.runAi({ operation: 'optimize', body: form.body, instruction: state.optimizeSource }) }}
                  >
                    {state.aiBusy === 'optimize' ? t('template.ai.running') : t('template.ai.run')}
                  </button>
                </div>
                <span className={css.templateLabel}>{t('template.ai.extract')}</span>
                <span className={css.templateCardMeta}>{t('template.ai.extractHint')}</span>
                <textarea
                  className={css.templateTextarea}
                  rows={3}
                  placeholder={t('template.ai.extractPlaceholder')}
                  value={state.extractSource}
                  onChange={(event) => { templates.setExtractSource(event.target.value) }}
                />
                <div className={css.templateFoot}>
                  <button
                    type="button"
                    className={css.templateMini}
                    disabled={state.aiBusy !== false}
                    onClick={() => { templates.runAi({ operation: 'extract', content: state.extractSource }) }}
                  >
                    {state.aiBusy === 'extract' ? t('template.ai.running') : t('template.ai.run')}
                  </button>
                </div>
              </div>

              <div className={css.templateFoot}>
                <input
                  className={`${css.templateInput} ${css.templateFootNote}`}
                  placeholder={t('template.changeNote')}
                  value={form.changeNote}
                  onChange={(event) => { templates.patchForm({ changeNote: event.target.value }) }}
                />
                <button
                  type="button"
                  className={css.templatePrimary}
                  disabled={state.saving || form.name.trim().length === 0 || form.body.trim().length === 0}
                  onClick={() => { templates.save() }}
                >
                  {t('template.save')}
                </button>
                {form.id !== null && (
                  <button type="button" className={css.templateMini} onClick={() => {
                    const id = form.id
                    if (id !== null) templates.openHistory(id)
                  }}>
                    {t('template.history')}
                  </button>
                )}
                <button type="button" className={css.templateMini} onClick={() => { templates.closeEditor() }}>
                  {t('template.close')}
                </button>
              </div>

              {state.historyOpen && (
                <div className={css.templateHistory}>
                  <span className={css.templateLabel}>{t('template.history')}</span>
                  {state.history.length === 0 && <span className={css.templateCardMeta}>{t('template.history.empty')}</span>}
                  {state.history.map(entry => (
                    <div key={entry.version} className={css.templateHistoryRow}>
                      <span className={css.templateHistoryVersion}>{t('template.history.version').replace('{version}', String(entry.version))}</span>
                      <span className={css.templateHistoryNote}>{entry.changeNote.length > 0 ? entry.changeNote : entry.createdAt}</span>
                      <button type="button" className={css.templateMini} onClick={() => { templates.restoreVersion(entry); setPreviewValues({}) }}>
                        {t('template.history.restore')}
                      </button>
                    </div>
                  ))}
                  <button type="button" className={css.templateMini} onClick={() => { templates.closeHistory() }}>
                    {t('template.close')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** The empty-state AI generation box: description plus target category, explicit run. */
function GenerateBox({ state, templates, t }: {
  state: TemplateState
  templates: TemplateController
  t: PropsLocale<'content-studio'>['t']
}) {
  return (
    <div className={css.templateGenerate}>
      <p className={css.templateGenerateTitle}>{t('template.ai.generate.title')}</p>
      <span className={css.templateCardMeta}>{t('template.ai.generate.hint')}</span>
      <textarea
        className={css.templateTextarea}
        rows={3}
        placeholder={t('template.ai.generate.placeholder')}
        value={state.generateSource}
        onChange={(event) => { templates.setGenerateSource(event.target.value) }}
      />
      <div className={css.templateFoot}>
        <select
          className={css.templateInput}
          aria-label={t('template.field.category')}
          value={state.generateCategory}
          onChange={(event) => { templates.setGenerateCategory(event.target.value as TemplateCategory) }}
        >
          {TEMPLATE_CATEGORIES.map(category => (
            <option key={category} value={category}>{TEMPLATE_CATEGORY_LABELS[category]}</option>
          ))}
        </select>
        <button
          type="button"
          className={css.templatePrimary}
          disabled={state.aiBusy !== false}
          onClick={() => { templates.runAi({ operation: 'generate', category: state.generateCategory, description: state.generateSource }) }}
        >
          {state.aiBusy === 'generate' ? t('template.ai.running') : t('template.ai.run')}
        </button>
      </div>
      {state.aiDraft !== null && (
        <div className={css.templateDraft}>
          {state.aiDraft.problems.map(problem => <span key={problem} className={css.templateProblems}>{problem}</span>)}
          <pre className={css.templatePreviewOutput}>{state.aiDraft.draft.body}</pre>
          <div className={css.templateFoot}>
            <button type="button" className={css.templatePrimary} onClick={() => { templates.adoptAiDraft() }}>
              {t('template.ai.adopt')}
            </button>
            <button type="button" className={css.templateMini} onClick={() => { templates.discardAiDraft() }}>
              {t('template.ai.discard')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** One-line tag input: Enter adds, blur adds a pending name. */
function TagInput({ onAdd, placeholder, addLabel }: {
  onAdd: (name: string) => void
  placeholder: string
  addLabel: string
}) {
  const [name, setName] = useState('')
  const add = (): void => {
    if (name.trim().length > 0) onAdd(name)
    setName('')
  }
  return (
    <input
      className={css.templateInput}
      placeholder={placeholder}
      aria-label={addLabel}
      value={name}
      onChange={(event) => { setName(event.target.value) }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') add()
      }}
      onBlur={add}
    />
  )
}
