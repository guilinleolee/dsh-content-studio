/**
 * The account selector under the workbench brand row (Easel's persona
 * dropdown): a bordered select showing the active creation account, a
 * dropdown with all accounts plus "+ 新建账号...", and an inline create row.
 * State is browser-local (localStorage) — the selection is injected into
 * copied capability instructions by the callers.
 */
import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import {
  IconChevronDownOutline14, IconPlusOutline16, useDismissOnOutsidePointer,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import css from './ContentStudio.module.css'

/** Props: the controlled account list and selection, plus the locale seat. */
export type AccountSelectProps = {
  account: string
  accounts: readonly string[]
  onSelect: (account: string) => void
  onAdd: (account: string) => void
} & PropsLocale<'content-studio'>

/**
 * Render the account dropdown.
 * @param props - controlled state and the locale seat.
 * @returns the selector element tree.
 */
export function AccountSelect({ account, accounts, onSelect, onAdd, t }: AccountSelectProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  // Any pointer outside the box closes the dropdown; inside keeps it open —
  // including clicks on the create row's own controls.
  useDismissOnOutsidePointer(boxRef, open, setOpen)

  // Focus the create input when it appears.
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  const commitDraft = (): void => {
    const name = draft.trim()
    if (name.length === 0) return
    onAdd(name)
    setDraft('')
    setCreating(false)
    setOpen(false)
  }

  return (
    <div className={css.accountBox} ref={boxRef}>
      <button
        type="button"
        className={css.accountButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.accountName}>{account}</span>
        <IconChevronDownOutline14 size={14} />
      </button>
      {open && (
        <div className={css.accountList} role="listbox" aria-label={t('account.label')}>
          {accounts.map(name => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={name === account}
              className={clsx(css.accountOption, name === account && css.accountOptionActive)}
              onClick={() => { onSelect(name); setOpen(false) }}
            >
              {name}
            </button>
          ))}
          {creating
            ? (
              <div className={css.accountCreateRow}>
                <input
                  ref={inputRef}
                  className={css.accountInput}
                  placeholder={t('account.placeholder')}
                  value={draft}
                  onChange={(event) => { setDraft(event.currentTarget.value) }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitDraft()
                    if (event.key === 'Escape') { setCreating(false); setDraft('') }
                  }}
                />
                <button type="button" className={css.accountCreateAdd} onClick={commitDraft}>
                  {t('account.add')}
                </button>
              </div>
            )
            : (
              <button type="button" className={css.accountOption} onClick={() => { setCreating(true) }}>
                <IconPlusOutline16 size={12} />
                {t('account.new')}
              </button>
            )}
        </div>
      )}
    </div>
  )
}
