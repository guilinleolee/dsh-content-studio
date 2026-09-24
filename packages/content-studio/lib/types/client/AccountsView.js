import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The accounts view: select the active creation account, add new ones, and
 * delete non-default ones. State is browser-local and owned by the workbench
 * surface; 通用模式 can never be deleted.
 */
import { IconTrashOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import { AccountSelect } from "./AccountSelect.js";
import css from './ContentStudio.module.css';
/**
 * Render the accounts management page.
 * @param props - controlled state, mutators, and the locale seat.
 * @returns the page element tree.
 */
export function AccountsView({ account, accounts, onSelect, onAdd, onRemove, t }) {
    return (_jsxs("div", { className: css.workbench, children: [_jsx("h2", { className: css.pageTitle, children: t('accounts.title') }), _jsx("p", { className: css.helloSub, children: t('accounts.hint') }), _jsxs("div", { className: css.accountsPane, children: [_jsx(AccountSelect, { account: account, accounts: accounts, onSelect: onSelect, onAdd: onAdd, t: t }), _jsx("div", { className: css.accountsList, children: accounts.map(name => (_jsxs("div", { className: css.listRow, children: [_jsxs("span", { className: css.listTitle, children: [name, name === account && _jsx("span", { className: css.accountActiveTag, children: t('account.active') })] }), name !== '通用模式' && (_jsx("button", { type: "button", className: css.calendarChipAction, "aria-label": t('accounts.delete'), onClick: () => { onRemove(name); }, children: _jsx(IconTrashOutline16, { size: 12 }) }))] }, name))) })] })] }));
}
//# sourceMappingURL=AccountsView.js.map