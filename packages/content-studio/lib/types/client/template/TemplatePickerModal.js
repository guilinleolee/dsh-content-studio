import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The cross-column template picker modal, driven by the shared controller's
 * picker state: the host column opens it with a {@link TemplatePickTarget},
 * the user picks an active template of that category, fills the required
 * variables, and confirms — the first confirm only arms the overwrite guard
 * when the host field already holds content. Rendered at the workbench
 * surface level so every column sees the same modal.
 */
import { useSyncExternalStore } from 'react';
import { missingRequired, renderTemplate, TEMPLATE_CATEGORY_LABELS } from "./model.js";
import css from './TemplatePickerModal.module.css';
/**
 * Render the picker modal; null while no picker session is open.
 * @param props - the injected controller and the locale seat.
 * @returns the modal element tree, or null.
 */
export function TemplatePickerModal({ templates, t }) {
    const state = useSyncExternalStore(listener => templates.subscribe(listener), () => templates.getState());
    const picker = state.picker;
    if (picker === null)
        return null;
    const search = picker.search.trim().toLowerCase();
    const candidates = state.templates.filter((record) => {
        if (record.category !== picker.target.category || record.status !== 'active')
            return false;
        if (search.length > 0 && !`${record.name}\n${record.description}\n${record.body}`.toLowerCase().includes(search))
            return false;
        return true;
    });
    const selected = picker.selected;
    const rendered = selected === null ? null : renderTemplate(selected.body, picker.values, selected.variables);
    const missing = selected === null ? [] : missingRequired(selected.body, selected.variables, picker.values);
    return (_jsx("div", { className: css.overlay, role: "dialog", "aria-modal": "true", "aria-label": t('template.picker.title'), children: _jsxs("div", { className: css.modal, children: [_jsxs("div", { className: css.head, children: [_jsxs("span", { className: css.title, children: [t('template.picker.title'), _jsx("span", { className: css.subtitle, children: `${TEMPLATE_CATEGORY_LABELS[picker.target.category]} → ${picker.target.targetLabel}` })] }), _jsx("button", { type: "button", className: css.mini, onClick: () => { templates.closePicker(); }, children: t('template.picker.close') })] }), selected === null ? (_jsxs(_Fragment, { children: [_jsx("input", { className: css.input, placeholder: t('template.search'), value: picker.search, onChange: (event) => { templates.pickerSearch(event.target.value); } }), _jsxs("div", { className: css.list, children: [candidates.length === 0 && _jsx("div", { className: css.empty, children: t('template.picker.empty') }), candidates.map(record => (_jsxs("button", { type: "button", className: css.card, onClick: () => { templates.pickerSelect(record); }, children: [_jsx("span", { className: css.cardName, children: record.name }), record.description.trim().length > 0 && _jsx("span", { className: css.cardMeta, children: record.description }), _jsx("span", { className: css.cardMeta, children: `v${String(record.version)}` })] }, record.id)))] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.fillHead, children: [_jsx("span", { className: css.cardName, children: selected.name }), _jsx("button", { type: "button", className: css.mini, onClick: () => { templates.pickerBack(); }, children: t('template.picker.back') })] }), selected.description.trim().length > 0 && _jsx("span", { className: css.cardMeta, children: selected.description }), _jsx("span", { className: css.cardMeta, children: t('template.picker.titleHint') }), selected.variables.length === 0 && _jsx("span", { className: css.cardMeta, children: t('template.variable.none') }), selected.variables.map(variable => (_jsxs("label", { className: css.field, children: [_jsxs("span", { className: css.label, children: [variable.label || variable.name, variable.required && _jsxs("span", { className: css.required, children: ["\uFF08", t('template.variable.required'), "\uFF09"] })] }), variable.description.trim().length > 0 && _jsx("span", { className: css.cardMeta, children: variable.description }), _jsx("input", { className: css.input, value: picker.values[variable.name] ?? '', onChange: (event) => { templates.pickerValue(variable.name, event.target.value); } })] }, variable.name))), rendered !== null && rendered.unresolved.length > 0 && (_jsx("span", { className: css.problems, children: t('template.preview.unresolved').replace('{list}', rendered.unresolved.join('、')) })), rendered !== null && _jsx("pre", { className: css.preview, children: rendered.output }), picker.overwriteConfirm && (_jsxs("div", { className: css.overwrite, role: "alert", children: [_jsx("span", { children: t('template.picker.overwrite').replace('{target}', picker.target.targetLabel) }), _jsx("button", { type: "button", className: css.mini, onClick: () => { templates.pickerBack(); }, children: t('template.picker.cancel') })] })), _jsxs("div", { className: css.foot, children: [picker.target.apply !== null ? (_jsx("button", { type: "button", className: css.primary, disabled: missing.length > 0, onClick: () => { templates.pickerConfirm(); }, children: t('template.picker.confirm') })) : (_jsx("button", { type: "button", className: css.primary, onClick: () => { templates.pickerCopyBody(); }, children: t('template.picker.copy') })), missing.length > 0 && _jsx("span", { className: css.problems, children: t('template.picker.missing').replace('{list}', missing.join('、')) })] })] }))] }) }));
}
//# sourceMappingURL=TemplatePickerModal.js.map