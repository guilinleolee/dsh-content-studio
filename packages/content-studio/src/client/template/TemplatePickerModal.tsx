/**
 * The cross-column template picker modal, driven by the shared controller's
 * picker state: the host column opens it with a {@link TemplatePickTarget},
 * the user picks an active template of that category, fills the required
 * variables, and confirms — the first confirm only arms the overwrite guard
 * when the host field already holds content. Rendered at the workbench
 * surface level so every column sees the same modal.
 */
import { useSyncExternalStore } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { missingRequired, renderTemplate, TEMPLATE_CATEGORY_LABELS } from './model.ts'
import type { TemplateController } from './template-store.ts'
import css from './TemplatePickerModal.module.css'

/** Props: the injected controller plus the locale seat. */
export type TemplatePickerModalProps = {
  templates: TemplateController
} & PropsLocale<'content-studio'>

/**
 * Render the picker modal; null while no picker session is open.
 * @param props - the injected controller and the locale seat.
 * @returns the modal element tree, or null.
 */
export function TemplatePickerModal({ templates, t }: TemplatePickerModalProps) {
  const state = useSyncExternalStore(
    listener => templates.subscribe(listener),
    () => templates.getState(),
  )
  const picker = state.picker
  if (picker === null) return null

  const search = picker.search.trim().toLowerCase()
  const candidates = state.templates.filter((record) => {
    if (record.category !== picker.target.category || record.status !== 'active') return false
    if (search.length > 0 && !`${record.name}\n${record.description}\n${record.body}`.toLowerCase().includes(search)) return false
    return true
  })
  const selected = picker.selected
  const rendered = selected === null ? null : renderTemplate(selected.body, picker.values, selected.variables)
  const missing = selected === null ? [] : missingRequired(selected.body, selected.variables, picker.values)

  return (
    <div className={css.overlay} role="dialog" aria-modal="true" aria-label={t('template.picker.title')}>
      <div className={css.modal}>
        <div className={css.head}>
          <span className={css.title}>
            {t('template.picker.title')}
            <span className={css.subtitle}>{`${TEMPLATE_CATEGORY_LABELS[picker.target.category]} → ${picker.target.targetLabel}`}</span>
          </span>
          <button type="button" className={css.mini} onClick={() => { templates.closePicker() }}>
            {t('template.picker.close')}
          </button>
        </div>

        {selected === null ? (
          <>
            <input
              className={css.input}
              placeholder={t('template.search')}
              value={picker.search}
              onChange={(event) => { templates.pickerSearch(event.target.value) }}
            />
            <div className={css.list}>
              {candidates.length === 0 && <div className={css.empty}>{t('template.picker.empty')}</div>}
              {candidates.map(record => (
                <button key={record.id} type="button" className={css.card} onClick={() => { templates.pickerSelect(record) }}>
                  <span className={css.cardName}>{record.name}</span>
                  {record.description.trim().length > 0 && <span className={css.cardMeta}>{record.description}</span>}
                  <span className={css.cardMeta}>{`v${String(record.version)}`}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className={css.fillHead}>
              <span className={css.cardName}>{selected.name}</span>
              <button type="button" className={css.mini} onClick={() => { templates.pickerBack() }}>
                {t('template.picker.back')}
              </button>
            </div>
            {selected.description.trim().length > 0 && <span className={css.cardMeta}>{selected.description}</span>}
            <span className={css.cardMeta}>{t('template.picker.titleHint')}</span>
            {selected.variables.length === 0 && <span className={css.cardMeta}>{t('template.variable.none')}</span>}
            {selected.variables.map(variable => (
              <label key={variable.name} className={css.field}>
                <span className={css.label}>
                  {variable.label || variable.name}
                  {variable.required && <span className={css.required}>（{t('template.variable.required')}）</span>}
                </span>
                {variable.description.trim().length > 0 && <span className={css.cardMeta}>{variable.description}</span>}
                <input
                  className={css.input}
                  value={picker.values[variable.name] ?? ''}
                  onChange={(event) => { templates.pickerValue(variable.name, event.target.value) }}
                />
              </label>
            ))}
            {rendered !== null && rendered.unresolved.length > 0 && (
              <span className={css.problems}>
                {t('template.preview.unresolved').replace('{list}', rendered.unresolved.join('、'))}
              </span>
            )}
            {rendered !== null && <pre className={css.preview}>{rendered.output}</pre>}
            {picker.overwriteConfirm && (
              <div className={css.overwrite} role="alert">
                <span>{t('template.picker.overwrite').replace('{target}', picker.target.targetLabel)}</span>
                <button type="button" className={css.mini} onClick={() => { templates.pickerBack() }}>
                  {t('template.picker.cancel')}
                </button>
              </div>
            )}
            <div className={css.foot}>
              {picker.target.apply !== undefined ? (
                <button
                  type="button"
                  className={css.primary}
                  disabled={missing.length > 0}
                  onClick={() => { templates.pickerConfirm() }}
                >
                  {t('template.picker.confirm')}
                </button>
              ) : (
                <button type="button" className={css.primary} onClick={() => { templates.pickerCopyBody() }}>
                  {t('template.picker.copy')}
                </button>
              )}
              {missing.length > 0 && <span className={css.problems}>{t('template.picker.missing').replace('{list}', missing.join('、'))}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
