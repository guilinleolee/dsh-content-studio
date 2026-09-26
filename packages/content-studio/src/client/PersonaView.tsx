/**
 * The persona view: the account-persona card list over the `_personas.json`
 * manifest, the four-step wizard (basics, social links, intent, style and
 * red lines), the explicit AI helpers (blank-field fill, résumé extraction
 * with its consent gate), and the report panel (generate, edit with the
 * staleness banner, confirmed regeneration). All state and actions live on
 * the injected controller; this file only wires them to the DOM.
 */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { PersonaEntry, PersonaFieldKey, PersonaId, PersonaLink, PersonaPlatform } from '@deepseek-ai/dsh-content-outputs/types'
import { parseWordList, type PersonaForm } from './persona/model.ts'
import {
  PERSONA_FIELD_KEYS, PERSONA_FIELD_LABELS, PERSONA_PLATFORMS, PERSONA_PLATFORM_LABELS,
  PERSONA_STYLE_PRESETS, PERSONA_STYLE_PRESET_LABELS,
} from './persona/model.ts'
import type { PersonaController, PersonaState } from './persona/persona-store.ts'
import { renderPersonaPrompt } from './persona/prompt.ts'
import type { StudioKey } from './locales.ts'
import css from './PersonaView.module.css'

/** Props: the injected controller plus the locale seat. */
export type PersonaViewProps = {
  personas: PersonaController
} & PropsLocale<'content-studio'>

/** Client-side cap for pasted / uploaded text; the wire rejects beyond this. */
const TEXT_CAP = 100_000

/**
 * Render the persona page.
 * @param props - the injected controller and the locale seat.
 * @returns the page element tree.
 */
export function PersonaView({ personas, t }: PersonaViewProps) {
  const state = useSyncExternalStore(listener => personas.subscribe(listener), () => personas.getState())
  const [previewId, setPreviewId] = useState<PersonaId | null>(null)

  useEffect(() => { void personas.ensureLoaded() }, [personas])

  const previewEntry = previewId === null ? null : state.personas.find(entry => entry.id === previewId) ?? null
  const reportEntry = state.reportId === null ? null : state.personas.find(entry => entry.id === state.reportId) ?? null

  return (
    <div className={css.persona}>
      <div className={css.personaHead}>
        <div>
          <h2 className={css.personaTitle}>{t('persona.title')}</h2>
          <p className={css.personaHint}>{t('persona.hint')}</p>
        </div>
        <button type="button" className={css.personaPrimary} onClick={() => { personas.openNew() }}>
          {t('persona.new')}
        </button>
      </div>

      {state.legacyText !== null && (
        <div className={css.personaBanner} role="status">
          <span>{t('persona.legacy.text')}</span>
          <button type="button" className={css.personaMini} onClick={() => { void personas.importLegacy(t('persona.legacy.name')) }}>
            {t('persona.legacy.import')}
          </button>
          <button type="button" className={css.personaMini} onClick={() => { personas.dismissLegacy() }}>
            {t('persona.legacy.dismiss')}
          </button>
        </div>
      )}
      {state.problems.length > 0 && (
        <div className={css.personaBanner} role="alert">
          {`${t('persona.problems')} ${state.problems.join(' ')}`}
        </div>
      )}
      {state.notice !== null && (
        <button type="button" className={css.personaNotice} role="status" onClick={() => { personas.dismissNotice() }}>
          {t(`persona.notice.${state.notice}`)}
        </button>
      )}

      {state.loading ? <p className={css.personaEmpty}>{t('persona.loading')}</p>
        : state.personas.length === 0 ? <p className={css.personaEmpty}>{t('persona.empty')}</p>
          : (
            <div className={css.personaGrid}>
              {state.personas.map(entry => (
                <PersonaCardView
                  key={entry.id}
                  entry={entry}
                  selected={state.selectedId === entry.id}
                  controller={personas}
                  previewOpen={previewId === entry.id}
                  onTogglePreview={() => { setPreviewId(previewId === entry.id ? null : entry.id) }}
                  t={t}
                />
              ))}
            </div>
          )}

      {previewEntry !== null && <PersonaPreviewPanel entry={previewEntry} controller={personas} t={t} />}
      {state.wizard !== null && <PersonaWizard state={state} controller={personas} t={t} />}
      {reportEntry !== null && <PersonaReportPanel entry={reportEntry} controller={personas} t={t} />}
    </div>
  )
}

/** One persona card: identity chips, the digest line, and the six actions. */
function PersonaCardView(props: {
  entry: PersonaEntry
  selected: boolean
  previewOpen: boolean
  controller: PersonaController
  onTogglePreview: () => void
  t: PropsLocale<'content-studio'>['t']
}) {
  const { entry, selected, previewOpen, controller, onTogglePreview, t } = props
  const stale = entry.report !== null && entry.revision > entry.report.sourceRevision
  return (
    <article className={css.personaCard}>
      <div className={css.personaCardHead}>
        <h3 className={css.personaCardName}>{entry.name}</h3>
        {selected && <span className={css.personaBadgeActive}>{t('persona.card.selected')}</span>}
        {entry.report !== null && (
          <span className={stale ? css.personaBadgeStale : css.personaBadge}>{stale ? t('persona.card.stale') : t('persona.card.report')}</span>
        )}
      </div>
      <div className={css.personaChips}>
        {entry.platforms.map(platform => <span key={platform} className={css.personaChip}>{PERSONA_PLATFORM_LABELS[platform]}</span>)}
        {entry.fields.niche.value !== null && <span className={css.personaChip}>{entry.fields.niche.value}</span>}
      </div>
      <p className={css.personaDigest}>{entry.digest}</p>
      <div className={css.personaActions}>
        <button type="button" className={css.personaMini} onClick={() => { controller.select(selected ? null : entry.id) }}>
          {t(selected ? 'persona.card.deselect' : 'persona.card.select')}
        </button>
        <button type="button" className={css.personaMini} onClick={onTogglePreview}>
          {t(previewOpen ? 'persona.card.hide' : 'persona.card.preview')}
        </button>
        <button type="button" className={css.personaMini} onClick={() => { controller.openEdit(entry.id) }}>{t('persona.card.edit')}</button>
        <button type="button" className={css.personaMini} onClick={() => { controller.openReport(entry.id) }}>{t('persona.card.reportView')}</button>
        <button type="button" className={css.personaMini} onClick={() => { controller.openClone(entry.id) }}>{t('persona.card.clone')}</button>
        <button
          type="button"
          className={css.personaMini}
          onClick={() => {
            if (window.confirm(t('persona.delete.confirm').replace('{name}', entry.name))) void controller.remove(entry.id)
          }}
        >
          {t('persona.card.delete')}
        </button>
      </div>
    </article>
  )
}

/** The structured side preview: every field with its provenance badge, plus style and constraints. */
function PersonaPreviewPanel(props: {
  entry: PersonaEntry
  controller: PersonaController
  t: PropsLocale<'content-studio'>['t']
}) {
  const { entry, controller, t } = props
  const sourceBadge = (source: 'user' | 'ai' | 'template'): string =>
    source === 'ai' ? t('persona.preview.source.ai') : source === 'template' ? t('persona.preview.source.template') : t('persona.preview.source.user')
  return (
    <section className={css.personaPreview} aria-label={t('persona.preview.title')}>
      <div className={css.personaPreviewHead}>
        <h3>{t('persona.preview.title')}</h3>
        {entry.id !== controller.getState().selectedId && (
          <button type="button" className={css.personaMini} onClick={() => { controller.select(entry.id) }}>
            {t('persona.preview.use')}
          </button>
        )}
      </div>
      <dl className={css.personaFacts}>
        {PERSONA_FIELD_KEYS.map((key) => {
          const field = entry.fields[key]
          if (field.value === null) return null
          return (
            <div key={key} className={css.personaFact}>
              <dt>{PERSONA_FIELD_LABELS[key]} <span className={css.personaSource}>{sourceBadge(field.source)}</span></dt>
              <dd>{field.value}</dd>
            </div>
          )
        })}
      </dl>
      <p className={css.personaFactLine}>
        {`${t('persona.preview.digest')}：${entry.digest}`}
      </p>
      {entry.style.bannedWords.length > 0 && (
        <p className={css.personaFactLine}>{`${t('persona.preview.banned')}：${entry.style.bannedWords.join('；')}`}</p>
      )}
      {entry.style.redLines.length > 0 && (
        <p className={css.personaFactLine}>{`${t('persona.preview.red')}：${entry.style.redLines.join('；')}`}</p>
      )}
    </section>
  )
}

/** Shared label+control row for the wizard's fields. */
function FieldRow(props: { label: string; children: ReactNode }) {
  return (
    <label className={css.personaField}>
      <span className={css.personaFieldLabel}>{props.label}</span>
      {props.children}
    </label>
  )
}

/** The four-step wizard modal, driven entirely by the controller's form state. */
function PersonaWizard(props: {
  state: PersonaState
  controller: PersonaController
  t: PropsLocale<'content-studio'>['t']
}) {
  const { state, controller, t } = props
  const wizard = state.wizard
  if (wizard === null) return null
  const { step, form } = wizard
  const setField = (key: PersonaFieldKey) => (value: string) => { controller.setField(key, value) }
  const updateLink = (index: number, patch: Partial<PersonaLink>) => { controller.updateLink(index, patch) }
  const revision = form.editingId === null
    ? 1
    : (state.personas.find(entry => entry.id === form.editingId)?.revision ?? 0) + 1
  const prompt = renderPersonaPrompt({
    name: form.name.trim().length > 0 ? form.name : t('persona.preview.unnamed'),
    revision,
    fields: form.fields,
    style: {
      preset: form.preset,
      customText: form.customText.trim().length === 0 ? null : form.customText,
      strength: form.strength,
      bannedWords: parseWordList(form.bannedWordsText),
      redLines: parseWordList(form.redLinesText),
    },
  })
  return (
    <div className={css.personaModal} role="dialog" aria-modal="true" aria-label={t('persona.wizard.title')}>
      <div className={css.personaModalCard}>
        <div className={css.personaModalHead}>
          <h3>{t('persona.wizard.title')}</h3>
          <span className={css.personaStepLabel}>{`${String(step)} / 4 · ${t(`persona.wizard.step${String(step)}` as StudioKey)}`}</span>
          <button type="button" className={css.personaMini} onClick={() => { controller.closeWizard() }} aria-label={t('persona.wizard.close')}>
            {t('persona.wizard.close')}
          </button>
        </div>

        {step === 1 && (
          <div className={css.personaStepBody}>
            <FieldRow label={t('persona.name.label')}>
              <input value={form.name} placeholder={t('persona.name.placeholder')} onChange={(event) => { controller.updateForm({ name: event.currentTarget.value }) }} />
            </FieldRow>
            <div className={css.personaField}>
              <span className={css.personaFieldLabel}>{t('persona.platforms.label')}</span>
              <div className={css.personaChips}>
                {PERSONA_PLATFORMS.map(platform => (
                  <button
                    key={platform}
                    type="button"
                    className={form.platforms.includes(platform) ? css.personaChipOn : css.personaChip}
                    onClick={() => { controller.togglePlatform(platform) }}
                  >
                    {PERSONA_PLATFORM_LABELS[platform]}
                  </button>
                ))}
              </div>
            </div>
            <div className={css.personaField}>
              <span className={css.personaFieldLabel}>{t('persona.stage.label')}</span>
              <div className={css.personaChips}>
                {(['fresh', 'existing'] as const).map(stage => (
                  <button
                    key={stage}
                    type="button"
                    className={form.accountStage === stage ? css.personaChipOn : css.personaChip}
                    onClick={() => { controller.setAccountStage(stage) }}
                  >
                    {t(stage === 'fresh' ? 'persona.stage.fresh' : 'persona.stage.existing')}
                  </button>
                ))}
              </div>
            </div>
            <FieldRow label={PERSONA_FIELD_LABELS.niche}>
              <input value={form.fields.niche.value} onChange={(event) => { setField('niche')(event.currentTarget.value) }} />
            </FieldRow>
            <FieldRow label={PERSONA_FIELD_LABELS.whoAmI}>
              <textarea rows={4} value={form.fields.whoAmI.value} onChange={(event) => { setField('whoAmI')(event.currentTarget.value) }} />
            </FieldRow>
            <div className={css.personaResume}>
              <FieldRow label={t('persona.resume.title')}>
                <textarea
                  rows={3}
                  placeholder={t('persona.resume.paste')}
                  value={form.resumeText}
                  onChange={(event) => { controller.updateForm({ resumeText: event.currentTarget.value.slice(0, TEXT_CAP) }) }}
                />
              </FieldRow>
              <div className={css.personaResumeRow}>
                <input
                  type="file"
                  accept=".txt,.md"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    void (async () => {
                      if (file === undefined) return
                      const text = (await file.text()).slice(0, TEXT_CAP)
                      controller.updateForm({ resumeText: text, resumeName: file.name })
                    })()
                  }}
                />
                <label className={css.personaConsent}>
                  <input
                    type="checkbox"
                    checked={form.resumeConsent}
                    onChange={(event) => { controller.updateForm({ resumeConsent: event.currentTarget.checked }) }}
                  />
                  {t('persona.resume.consent')}
                </label>
                <button type="button" className={css.personaMini} disabled={state.aiBusy !== false} onClick={() => { void controller.runResume() }}>
                  {state.aiBusy === 'resume' ? t('persona.busy') : t('persona.resume.parse')}
                </button>
              </div>
            </div>
            <FieldRow label={PERSONA_FIELD_LABELS.audience}>
              <textarea rows={3} value={form.fields.audience.value} onChange={(event) => { setField('audience')(event.currentTarget.value) }} />
            </FieldRow>
            <FieldRow label={PERSONA_FIELD_LABELS.oneLiner}>
              <input value={form.fields.oneLiner.value} onChange={(event) => { setField('oneLiner')(event.currentTarget.value) }} />
            </FieldRow>
          </div>
        )}

        {step === 2 && (
          <div className={css.personaStepBody}>
            {form.links.map((link, index) => (
              <div key={index} className={css.personaLinkRow}>
                <select
                  value={link.platform}
                  onChange={(event) => { updateLink(index, { platform: event.currentTarget.value as PersonaPlatform }) }}>
                  {PERSONA_PLATFORMS.map(platform => <option key={platform} value={platform}>{PERSONA_PLATFORM_LABELS[platform]}</option>)}
                </select>
                <input
                  placeholder={t('persona.links.url')}
                  value={link.url}
                  onChange={(event) => { updateLink(index, { url: event.currentTarget.value }) }}
                />
                <input
                  placeholder={t('persona.links.bio')}
                  value={link.bio ?? ''}
                  onChange={(event) => { updateLink(index, { bio: event.currentTarget.value.slice(0, TEXT_CAP) }) }}
                />
                <button type="button" className={css.personaMini} onClick={() => { controller.removeLink(index) }}>
                  {t('persona.links.remove')}
                </button>
              </div>
            ))}
            <button type="button" className={css.personaMini} onClick={() => { controller.addLink() }}>
              {t('persona.links.add')}
            </button>
            <FieldRow label={t('persona.site.url.label')}>
              <input placeholder={t('persona.site.url.placeholder')} value={form.siteUrl} onChange={(event) => { controller.updateForm({ siteUrl: event.currentTarget.value }) }} />
            </FieldRow>
            <FieldRow label={t('persona.site.paste.label')}>
              <textarea
                rows={4}
                value={form.sitePastedText}
                onChange={(event) => { controller.updateForm({ sitePastedText: event.currentTarget.value.slice(0, TEXT_CAP) }) }}
              />
            </FieldRow>
            <button type="button" className={css.personaMini} disabled title={t('persona.site.parse.hint')}>
              {t('persona.site.parse')}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className={css.personaStepBody}>
            <FieldRow label={PERSONA_FIELD_LABELS.goal}>
              <input value={form.fields.goal.value} onChange={(event) => { setField('goal')(event.currentTarget.value) }} />
            </FieldRow>
            <FieldRow label={PERSONA_FIELD_LABELS.monetize}>
              <input value={form.fields.monetize.value} onChange={(event) => { setField('monetize')(event.currentTarget.value) }} />
            </FieldRow>
            <FieldRow label={PERSONA_FIELD_LABELS.contentValue}>
              <input value={form.fields.contentValue.value} onChange={(event) => { setField('contentValue')(event.currentTarget.value) }} />
            </FieldRow>
            <FieldRow label={PERSONA_FIELD_LABELS.cadence}>
              <input value={form.fields.cadence.value} onChange={(event) => { setField('cadence')(event.currentTarget.value) }} />
            </FieldRow>
          </div>
        )}

        {step === 4 && (
          <div className={css.personaStepBody}>
            <FieldRow label={t('persona.style.preset.label')}>
              <select
                value={form.preset ?? ''}
                onChange={(event) => { controller.updateForm({ preset: event.currentTarget.value === '' ? null : event.currentTarget.value as PersonaForm['preset'] }) }}
              >
                <option value="">{t('persona.style.preset.none')}</option>
                {PERSONA_STYLE_PRESETS.map(preset => <option key={preset} value={preset}>{PERSONA_STYLE_PRESET_LABELS[preset]}</option>)}
              </select>
            </FieldRow>
            <FieldRow label={t('persona.style.custom.label')}>
              <textarea
                rows={2}
                placeholder={t('persona.style.custom.placeholder')}
                value={form.customText}
                onChange={(event) => { controller.updateForm({ customText: event.currentTarget.value }) }}
              />
            </FieldRow>
            <div className={css.personaField}>
              <span className={css.personaFieldLabel}>{t('persona.style.strength.label')}</span>
              <div className={css.personaChips}>
                {(['light', 'strict'] as const).map(strength => (
                  <button
                    key={strength}
                    type="button"
                    className={form.strength === strength ? css.personaChipOn : css.personaChip}
                    onClick={() => { controller.updateForm({ strength }) }}
                  >
                    {t(strength === 'strict' ? 'persona.style.strict' : 'persona.style.light')}
                  </button>
                ))}
              </div>
            </div>
            <FieldRow label={PERSONA_FIELD_LABELS.phrases}>
              <input value={form.fields.phrases.value} onChange={(event) => { setField('phrases')(event.currentTarget.value) }} />
            </FieldRow>
            <FieldRow label={t('persona.style.banned.label')}>
              <textarea
                rows={2}
                value={form.bannedWordsText}
                onChange={(event) => { controller.updateForm({ bannedWordsText: event.currentTarget.value }) }}
              />
            </FieldRow>
            <FieldRow label={t('persona.style.red.label')}>
              <textarea
                rows={2}
                value={form.redLinesText}
                onChange={(event) => { controller.updateForm({ redLinesText: event.currentTarget.value }) }}
              />
            </FieldRow>
            <div className={css.personaPromptBox}>
              <div className={css.personaPromptHead}>
                <strong>{t('persona.prompt.preview')}</strong>
                <button
                  type="button"
                  className={css.personaMini}
                  onClick={() => { void writeClipboard(prompt) }}
                >
                  {t('persona.prompt.copy')}
                </button>
              </div>
              <pre className={css.personaPromptText}>{prompt}</pre>
            </div>
          </div>
        )}

        {state.fillPreview !== null && <FillPreviewPanel state={state} controller={controller} t={t} />}

        <div className={css.personaModalFoot}>
          {step > 1 && <button type="button" className={css.personaMini} onClick={() => { controller.setStep((step - 1) as 1 | 2 | 3) }}>{t('persona.prev')}</button>}
          {step < 4 && <button type="button" className={css.personaPrimary} onClick={() => { controller.setStep((step + 1) as 2 | 3 | 4) }}>{t('persona.next')}</button>}
          <button
            type="button"
            className={css.personaPrimary}
            disabled={state.saving}
            onClick={() => { void controller.saveWizard() }}
          >
            {state.saving ? t('persona.saving') : t('persona.save')}
          </button>
          {step === 4 && (
            <button
              type="button"
              className={css.personaMini}
              disabled={state.aiBusy !== false}
              title={t('persona.fill.hint')}
              onClick={() => { void controller.runFill() }}
            >
              {state.aiBusy === 'fill' ? t('persona.busy') : t('persona.fill.run')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** The AI fill preview: per-field textareas the user can adjust before adopting. */
function FillPreviewPanel(props: {
  state: PersonaState
  controller: PersonaController
  t: PropsLocale<'content-studio'>['t']
}) {
  const { state, controller, t } = props
  const preview = state.fillPreview
  if (preview === null) return null
  return (
    <div className={css.personaFill} role="status">
      <div className={css.personaFillHead}>
        <strong>{t('persona.fill.title')}</strong>
        <button type="button" className={css.personaMini} onClick={() => { controller.adoptAllFill() }}>
          {t('persona.fill.adoptAll')}
        </button>
        <button type="button" className={css.personaMini} onClick={() => { controller.discardFill() }}>
          {t('persona.fill.discard')}
        </button>
      </div>
      {(Object.keys(preview.fields) as PersonaFieldKey[]).map(key => (
        <FillRow key={key} fieldKey={key} value={preview.fields[key] ?? ''} controller={controller} t={t} />
      ))}
    </div>
  )
}

/** One candidate row: editable in place, adopted with its edited text. */
function FillRow(props: {
  fieldKey: PersonaFieldKey
  value: string
  controller: PersonaController
  t: PropsLocale<'content-studio'>['t']
}) {
  const { fieldKey, value, controller, t } = props
  const [draft, setDraft] = useState(value)
  return (
    <div className={css.personaFillRow}>
      <span className={css.personaFieldLabel}>{PERSONA_FIELD_LABELS[fieldKey]}</span>
      <textarea rows={2} value={draft} onChange={(event) => { setDraft(event.currentTarget.value) }} />
      <button type="button" className={css.personaMini} onClick={() => { controller.adoptFillField(fieldKey, draft) }}>
        {t('persona.fill.adopt')}
      </button>
    </div>
  )
}

/** The report panel: generate, edit with the staleness banner, confirmed regeneration. */
function PersonaReportPanel(props: {
  entry: PersonaEntry
  controller: PersonaController
  t: PropsLocale<'content-studio'>['t']
}) {
  const { entry, controller, t } = props
  const report = entry.report
  const [draft, setDraft] = useState(report?.markdown ?? '')
  useEffect(() => { setDraft(report?.markdown ?? '') }, [report])
  const stale = report !== null && entry.revision > report.sourceRevision
  const generate = (): void => {
    if (report !== null && report.editedByUser && !window.confirm(t('persona.report.confirmRegen'))) return
    void controller.generateReport(entry.id)
  }
  return (
    <div className={css.personaModal} role="dialog" aria-modal="true" aria-label={t('persona.report.title')}>
      <div className={css.personaModalCard}>
        <div className={css.personaModalHead}>
          <h3>{`${t('persona.report.title')} · ${entry.name}`}</h3>
          <button type="button" className={css.personaMini} onClick={() => { controller.closeReport() }} aria-label={t('persona.report.close')}>
            {t('persona.report.close')}
          </button>
        </div>
        {report === null ? (
          <p className={css.personaEmpty}>{t('persona.report.empty')}</p>
        ) : (
          <>
            {stale && <div className={css.personaBanner} role="status">{t('persona.report.stale')}</div>}
            {report.editedByUser && <p className={css.personaReportEdited}>{t('persona.report.edited')}</p>}
            <textarea
              className={css.personaReportText}
              rows={14}
              value={draft}
              onChange={(event) => { setDraft(event.currentTarget.value) }}
            />
          </>
        )}
        <div className={css.personaModalFoot}>
          <button
            type="button"
            className={css.personaMini}
            disabled={controller.getState().aiBusy !== false || report === null || draft.trim().length === 0 || draft === report.markdown}
            onClick={() => { void controller.saveReportEdit(entry.id, draft) }}
          >
            {t('persona.report.edit.save')}
          </button>
          <button
            type="button"
            className={css.personaPrimary}
            disabled={controller.getState().aiBusy === 'report'}
            onClick={generate}
          >
            {controller.getState().aiBusy === 'report' ? t('persona.busy') : report === null ? t('persona.report.generate') : t('persona.report.regenerate')}
          </button>
        </div>
      </div>
    </div>
  )
}
