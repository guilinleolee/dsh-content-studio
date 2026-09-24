import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The account selector under the workbench brand row (Easel's persona
 * dropdown): a bordered select showing the active creation account, a
 * dropdown with all accounts plus "+ 新建账号...", and an inline create row.
 * State is browser-local (localStorage) — the selection is injected into
 * copied capability instructions by the callers.
 */
import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { IconChevronDownOutline14, IconPlusOutline16, useDismissOnOutsidePointer, } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './ContentStudio.module.css';
/**
 * Render the account dropdown.
 * @param props - controlled state and the locale seat.
 * @returns the selector element tree.
 */
export function AccountSelect({ account, accounts, onSelect, onAdd, t }) {
    const [open, setOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [draft, setDraft] = useState('');
    const boxRef = useRef(null);
    // Any pointer outside the box closes the dropdown; inside keeps it open —
    // including clicks on the create row's own controls.
    useDismissOnOutsidePointer(boxRef, open, setOpen);
    // Focus the create input when it appears.
    const inputRef = useRef(null);
    useEffect(() => {
        if (creating)
            inputRef.current?.focus();
    }, [creating]);
    const commitDraft = () => {
        const name = draft.trim();
        if (name.length === 0)
            return;
        onAdd(name);
        setDraft('');
        setCreating(false);
        setOpen(false);
    };
    return (_jsxs("div", { className: css.accountBox, ref: boxRef, children: [_jsxs("button", { type: "button", className: css.accountButton, "aria-haspopup": "listbox", "aria-expanded": open, onClick: () => { setOpen(!open); }, children: [_jsx("span", { className: css.accountName, children: account }), _jsx(IconChevronDownOutline14, { size: 14 })] }), open && (_jsxs("div", { className: css.accountList, role: "listbox", "aria-label": t('account.label'), children: [accounts.map(name => (_jsx("button", { type: "button", role: "option", "aria-selected": name === account, className: clsx(css.accountOption, name === account && css.accountOptionActive), onClick: () => { onSelect(name); setOpen(false); }, children: name }, name))), creating
                        ? (_jsxs("div", { className: css.accountCreateRow, children: [_jsx("input", { ref: inputRef, className: css.accountInput, placeholder: t('account.placeholder'), value: draft, onChange: (event) => { setDraft(event.currentTarget.value); }, onKeyDown: (event) => {
                                        if (event.key === 'Enter')
                                            commitDraft();
                                        if (event.key === 'Escape') {
                                            setCreating(false);
                                            setDraft('');
                                        }
                                    } }), _jsx("button", { type: "button", className: css.accountCreateAdd, onClick: commitDraft, children: t('account.add') })] }))
                        : (_jsxs("button", { type: "button", className: css.accountOption, onClick: () => { setCreating(true); }, children: [_jsx(IconPlusOutline16, { size: 12 }), t('account.new')] }))] }))] }));
}
//# sourceMappingURL=AccountSelect.js.map