import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The persona view: a browser-local persona description for the active
 * account, injected into copied capability instructions alongside the
 * account name.
 */
import { useEffect, useState } from 'react';
import css from './ContentStudio.module.css';
/** How long the saved flash shows. */
const SAVED_FEEDBACK_MS = 1600;
/**
 * Render the persona editor.
 * @param props - the controlled persona text, saver, and the locale seat.
 * @returns the page element tree.
 */
export function PersonaView({ persona, onSave, t }) {
    const [draft, setDraft] = useState(persona);
    const [saved, setSaved] = useState(false);
    // Sync the draft when the persona changes underneath (account switch etc.).
    useEffect(() => { setDraft(persona); }, [persona]);
    useEffect(() => {
        if (!saved)
            return;
        const timer = window.setTimeout(() => { setSaved(false); }, SAVED_FEEDBACK_MS);
        return () => { window.clearTimeout(timer); };
    }, [saved]);
    const save = () => {
        onSave(draft.trim());
        setSaved(true);
    };
    return (_jsxs("div", { className: css.workbench, children: [_jsx("h2", { className: css.pageTitle, children: t('persona.title') }), _jsx("p", { className: css.helloSub, children: t('persona.hint') }), _jsx("textarea", { className: css.personaInput, rows: 10, placeholder: t('persona.placeholder'), value: draft, onChange: (event) => { setDraft(event.currentTarget.value); } }), _jsxs("div", { className: css.personaRow, children: [_jsx("button", { type: "button", className: css.back, onClick: save, children: t('persona.save') }), saved && _jsx("span", { className: css.personaSaved, children: t('persona.saved') })] })] }));
}
//# sourceMappingURL=PersonaView.js.map