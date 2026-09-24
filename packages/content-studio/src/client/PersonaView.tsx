/**
 * The persona view: a browser-local persona description for the active
 * account, injected into copied capability instructions alongside the
 * account name.
 */
import { useEffect, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import css from './ContentStudio.module.css'

/** Props: the controlled persona text and saver, plus the locale seat. */
export type PersonaViewProps = {
  persona: string
  onSave: (persona: string) => void
} & PropsLocale<'content-studio'>

/** How long the saved flash shows. */
const SAVED_FEEDBACK_MS = 1600

/**
 * Render the persona editor.
 * @param props - the controlled persona text, saver, and the locale seat.
 * @returns the page element tree.
 */
export function PersonaView({ persona, onSave, t }: PersonaViewProps) {
  const [draft, setDraft] = useState(persona)
  const [saved, setSaved] = useState(false)

  // Sync the draft when the persona changes underneath (account switch etc.).
  useEffect(() => { setDraft(persona) }, [persona])

  useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => { setSaved(false) }, SAVED_FEEDBACK_MS)
    return () => { window.clearTimeout(timer) }
  }, [saved])

  const save = (): void => {
    onSave(draft.trim())
    setSaved(true)
  }

  return (
    <div className={css.workbench}>
      <h2 className={css.pageTitle}>{t('persona.title')}</h2>
      <p className={css.helloSub}>{t('persona.hint')}</p>
      <textarea
        className={css.personaInput}
        rows={10}
        placeholder={t('persona.placeholder')}
        value={draft}
        onChange={(event) => { setDraft(event.currentTarget.value) }}
      />
      <div className={css.personaRow}>
        <button type="button" className={css.back} onClick={save}>{t('persona.save')}</button>
        {saved && <span className={css.personaSaved}>{t('persona.saved')}</span>}
      </div>
    </div>
  )
}
