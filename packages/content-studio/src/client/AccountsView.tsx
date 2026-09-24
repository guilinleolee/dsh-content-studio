/**
 * The accounts view: select the active creation account, add new ones, and
 * delete non-default ones. State is browser-local and owned by the workbench
 * surface; 通用模式 can never be deleted.
 */
import { IconTrashOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { AccountSelect } from './AccountSelect.tsx'
import css from './ContentStudio.module.css'

/** Props: the controlled account state and mutators, plus the locale seat. */
export type AccountsViewProps = {
  account: string
  accounts: readonly string[]
  onSelect: (account: string) => void
  onAdd: (account: string) => void
  onRemove: (account: string) => void
} & PropsLocale<'content-studio'>

/**
 * Render the accounts management page.
 * @param props - controlled state, mutators, and the locale seat.
 * @returns the page element tree.
 */
export function AccountsView({ account, accounts, onSelect, onAdd, onRemove, t }: AccountsViewProps) {
  return (
    <div className={css.workbench}>
      <h2 className={css.pageTitle}>{t('accounts.title')}</h2>
      <p className={css.helloSub}>{t('accounts.hint')}</p>

      <div className={css.accountsPane}>
        <AccountSelect
          account={account}
          accounts={accounts}
          onSelect={onSelect}
          onAdd={onAdd}
          t={t}
        />
        <div className={css.accountsList}>
          {accounts.map(name => (
            <div key={name} className={css.listRow}>
              <span className={css.listTitle}>
                {name}
                {name === account && <span className={css.accountActiveTag}>{t('account.active')}</span>}
              </span>
              {name !== '通用模式' && (
                <button
                  type="button"
                  className={css.calendarChipAction}
                  aria-label={t('accounts.delete')}
                  onClick={() => { onRemove(name) }}
                >
                  <IconTrashOutline16 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
