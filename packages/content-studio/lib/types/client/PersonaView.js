import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The persona view: the account-persona card list over the `_personas.json`
 * manifest, the four-step wizard (basics, social links, intent, style and
 * red lines), the explicit AI helpers (blank-field fill, résumé extraction
 * with its consent gate), and the report panel (generate, edit with the
 * staleness banner, confirmed regeneration). All state and actions live on
 * the injected controller; this file only wires them to the DOM.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives';
import { parseWordList } from "./persona/model.js";
import { PERSONA_FIELD_KEYS, PERSONA_FIELD_LABELS, PERSONA_PLATFORMS, PERSONA_PLATFORM_LABELS, PERSONA_STYLE_PRESETS, PERSONA_STYLE_PRESET_LABELS, } from "./persona/model.js";
import { renderPersonaPrompt } from "./persona/prompt.js";
import css from './PersonaView.module.css';
/** Client-side cap for pasted / uploaded text; the wire rejects beyond this. */
const TEXT_CAP = 100_000;
/**
 * Render the persona page.
 * @param props - the injected controller and the locale seat.
 * @returns the page element tree.
 */
export function PersonaView({ personas, t }) {
    const state = useSyncExternalStore(listener => personas.subscribe(listener), () => personas.getState());
    const [previewId, setPreviewId] = useState(null);
    useEffect(() => { void personas.ensureLoaded(); }, [personas]);
    const previewEntry = previewId === null ? null : state.personas.find(entry => entry.id === previewId) ?? null;
    const reportEntry = state.reportId === null ? null : state.personas.find(entry => entry.id === state.reportId) ?? null;
    return (_jsxs("div", { className: css.persona, children: [_jsxs("div", { className: css.personaHead, children: [_jsxs("div", { children: [_jsx("h2", { className: css.personaTitle, children: t('persona.title') }), _jsx("p", { className: css.personaHint, children: t('persona.hint') })] }), _jsx("button", { type: "button", className: css.personaPrimary, onClick: () => { personas.openNew(); }, children: t('persona.new') })] }), state.legacyText !== null && (_jsxs("div", { className: css.personaBanner, role: "status", children: [_jsx("span", { children: t('persona.legacy.text') }), _jsx("button", { type: "button", className: css.personaMini, onClick: () => { void personas.importLegacy(t('persona.legacy.name')); }, children: t('persona.legacy.import') }), _jsx("button", { type: "button", className: css.personaMini, onClick: () => { personas.dismissLegacy(); }, children: t('persona.legacy.dismiss') })] })), state.problems.length > 0 && (_jsx("div", { className: css.personaBanner, role: "alert", children: `${t('persona.problems')} ${state.problems.join(' ')}` })), state.notice !== null && (_jsx("button", { type: "button", className: css.personaNotice, role: "status", onClick: () => { personas.dismissNotice(); }, children: t(`persona.notice.${state.notice}`) })), state.loading ? _jsx("p", { className: css.personaEmpty, children: t('persona.loading') })
                : state.personas.length === 0 ? _jsx("p", { className: css.personaEmpty, children: t('persona.empty') })
                    : (_jsx("div", { className: css.personaGrid, children: state.personas.map(entry => (_jsx(PersonaCardView, { entry: entry, selected: state.selectedId === entry.id, controller: personas, previewOpen: previewId === entry.id, onTogglePreview: () => { setPreviewId(previewId === entry.id ? null : entry.id); }, t: t }, entry.id))) })), previewEntry !== null && _jsx(PersonaPreviewPanel, { entry: previewEntry, controller: personas, t: t }), state.wizard !== null && _jsx(PersonaWizard, { state: state, controller: personas, t: t }), reportEntry !== null && _jsx(PersonaReportPanel, { entry: reportEntry, controller: personas, t: t })] }));
}
/** One persona card: identity chips, the digest line, and the six actions. */
function PersonaCardView(props) {
    const { entry, selected, previewOpen, controller, onTogglePreview, t } = props;
    const stale = entry.report !== null && entry.revision > entry.report.sourceRevision;
    return (_jsxs("article", { className: css.personaCard, children: [_jsxs("div", { className: css.personaCardHead, children: [_jsx("h3", { className: css.personaCardName, children: entry.name }), selected && _jsx("span", { className: css.personaBadgeActive, children: t('persona.card.selected') }), entry.report !== null && (_jsx("span", { className: stale ? css.personaBadgeStale : css.personaBadge, children: stale ? t('persona.card.stale') : t('persona.card.report') }))] }), _jsxs("div", { className: css.personaChips, children: [entry.platforms.map(platform => _jsx("span", { className: css.personaChip, children: PERSONA_PLATFORM_LABELS[platform] }, platform)), entry.fields.niche.value !== null && _jsx("span", { className: css.personaChip, children: entry.fields.niche.value })] }), _jsx("p", { className: css.personaDigest, children: entry.digest }), _jsxs("div", { className: css.personaActions, children: [_jsx("button", { type: "button", className: css.personaMini, onClick: () => { controller.select(selected ? null : entry.id); }, children: t(selected ? 'persona.card.deselect' : 'persona.card.select') }), _jsx("button", { type: "button", className: css.personaMini, onClick: onTogglePreview, children: t(previewOpen ? 'persona.card.hide' : 'persona.card.preview') }), _jsx("button", { type: "button", className: css.personaMini, onClick: () => { controller.openEdit(entry.id); }, children: t('persona.card.edit') }), _jsx("button", { type: "button", className: css.personaMini, onClick: () => { controller.openReport(entry.id); }, children: t('persona.card.reportView') }), _jsx("button", { type: "button", className: css.personaMini, onClick: () => { controller.openClone(entry.id); }, children: t('persona.card.clone') }), _jsx("button", { type: "button", className: css.personaMini, onClick: () => {
                            if (window.confirm(t('persona.delete.confirm').replace('{name}', entry.name)))
                                void controller.remove(entry.id);
                        }, children: t('persona.card.delete') })] })] }));
}
/** The structured side preview: every field with its provenance badge, plus style and constraints. */
function PersonaPreviewPanel(props) {
    const { entry, controller, t } = props;
    const sourceBadge = (source) => source === 'ai' ? t('persona.preview.source.ai') : source === 'template' ? t('persona.preview.source.template') : t('persona.preview.source.user');
    return (_jsxs("section", { className: css.personaPreview, "aria-label": t('persona.preview.title'), children: [_jsxs("div", { className: css.personaPreviewHead, children: [_jsx("h3", { children: t('persona.preview.title') }), entry.id !== controller.getState().selectedId && (_jsx("button", { type: "button", className: css.personaMini, onClick: () => { controller.select(entry.id); }, children: t('persona.preview.use') }))] }), _jsx("dl", { className: css.personaFacts, children: PERSONA_FIELD_KEYS.map((key) => {
                    const field = entry.fields[key];
                    if (field.value === null)
                        return null;
                    return (_jsxs("div", { className: css.personaFact, children: [_jsxs("dt", { children: [PERSONA_FIELD_LABELS[key], " ", _jsx("span", { className: css.personaSource, children: sourceBadge(field.source) })] }), _jsx("dd", { children: field.value })] }, key));
                }) }), _jsx("p", { className: css.personaFactLine, children: `${t('persona.preview.digest')}：${entry.digest}` }), entry.style.bannedWords.length > 0 && (_jsx("p", { className: css.personaFactLine, children: `${t('persona.preview.banned')}：${entry.style.bannedWords.join('；')}` })), entry.style.redLines.length > 0 && (_jsx("p", { className: css.personaFactLine, children: `${t('persona.preview.red')}：${entry.style.redLines.join('；')}` }))] }));
}
/** Shared label+control row for the wizard's fields. */
function FieldRow(props) {
    return (_jsxs("label", { className: css.personaField, children: [_jsx("span", { className: css.personaFieldLabel, children: props.label }), props.children] }));
}
/** The four-step wizard modal, driven entirely by the controller's form state. */
function PersonaWizard(props) {
    const { state, controller, t } = props;
    const wizard = state.wizard;
    if (wizard === null)
        return null;
    const { step, form } = wizard;
    const setField = (key) => (value) => { controller.setField(key, value); };
    const updateLink = (index, patch) => { controller.updateLink(index, patch); };
    const revision = form.editingId === null
        ? 1
        : (state.personas.find(entry => entry.id === form.editingId)?.revision ?? 0) + 1;
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
    });
    return (_jsx("div", { className: css.personaModal, role: "dialog", "aria-modal": "true", "aria-label": t('persona.wizard.title'), children: _jsxs("div", { className: css.personaModalCard, children: [_jsxs("div", { className: css.personaModalHead, children: [_jsx("h3", { children: t('persona.wizard.title') }), _jsx("span", { className: css.personaStepLabel, children: `${String(step)} / 4 · ${t(`persona.wizard.step${String(step)}`)}` }), _jsx("button", { type: "button", className: css.personaMini, onClick: () => { controller.closeWizard(); }, "aria-label": t('persona.wizard.close'), children: t('persona.wizard.close') })] }), step === 1 && (_jsxs("div", { className: css.personaStepBody, children: [_jsx(FieldRow, { label: t('persona.name.label'), children: _jsx("input", { value: form.name, placeholder: t('persona.name.placeholder'), onChange: (event) => { controller.updateForm({ name: event.currentTarget.value }); } }) }), _jsxs("div", { className: css.personaField, children: [_jsx("span", { className: css.personaFieldLabel, children: t('persona.platforms.label') }), _jsx("div", { className: css.personaChips, children: PERSONA_PLATFORMS.map(platform => (_jsx("button", { type: "button", className: form.platforms.includes(platform) ? css.personaChipOn : css.personaChip, onClick: () => { controller.togglePlatform(platform); }, children: PERSONA_PLATFORM_LABELS[platform] }, platform))) })] }), _jsxs("div", { className: css.personaField, children: [_jsx("span", { className: css.personaFieldLabel, children: t('persona.stage.label') }), _jsx("div", { className: css.personaChips, children: ['fresh', 'existing'].map(stage => (_jsx("button", { type: "button", className: form.accountStage === stage ? css.personaChipOn : css.personaChip, onClick: () => { controller.setAccountStage(stage); }, children: t(stage === 'fresh' ? 'persona.stage.fresh' : 'persona.stage.existing') }, stage))) })] }), _jsx(FieldRow, { label: PERSONA_FIELD_LABELS.niche, children: _jsx("input", { value: form.fields.niche.value, onChange: (event) => { setField('niche')(event.currentTarget.value); } }) }), _jsx(FieldRow, { label: PERSONA_FIELD_LABELS.whoAmI, children: _jsx("textarea", { rows: 4, value: form.fields.whoAmI.value, onChange: (event) => { setField('whoAmI')(event.currentTarget.value); } }) }), _jsxs("div", { className: css.personaResume, children: [_jsx(FieldRow, { label: t('persona.resume.title'), children: _jsx("textarea", { rows: 3, placeholder: t('persona.resume.paste'), value: form.resumeText, onChange: (event) => { controller.updateForm({ resumeText: event.currentTarget.value.slice(0, TEXT_CAP) }); } }) }), _jsxs("div", { className: css.personaResumeRow, children: [_jsx("input", { type: "file", accept: ".txt,.md", onChange: (event) => {
                                                const file = event.currentTarget.files?.[0];
                                                void (async () => {
                                                    if (file === undefined)
                                                        return;
                                                    const text = (await file.text()).slice(0, TEXT_CAP);
                                                    controller.updateForm({ resumeText: text, resumeName: file.name });
                                                })();
                                            } }), _jsxs("label", { className: css.personaConsent, children: [_jsx("input", { type: "checkbox", checked: form.resumeConsent, onChange: (event) => { controller.updateForm({ resumeConsent: event.currentTarget.checked }); } }), t('persona.resume.consent')] }), _jsx("button", { type: "button", className: css.personaMini, disabled: state.aiBusy !== false, onClick: () => { void controller.runResume(); }, children: state.aiBusy === 'resume' ? t('persona.busy') : t('persona.resume.parse') })] })] }), _jsx(FieldRow, { label: PERSONA_FIELD_LABELS.audience, children: _jsx("textarea", { rows: 3, value: form.fields.audience.value, onChange: (event) => { setField('audience')(event.currentTarget.value); } }) }), _jsx(FieldRow, { label: PERSONA_FIELD_LABELS.oneLiner, children: _jsx("input", { value: form.fields.oneLiner.value, onChange: (event) => { setField('oneLiner')(event.currentTarget.value); } }) })] })), step === 2 && (_jsxs("div", { className: css.personaStepBody, children: [form.links.map((link, index) => (_jsxs("div", { className: css.personaLinkRow, children: [_jsx("select", { value: link.platform, onChange: (event) => { updateLink(index, { platform: event.currentTarget.value }); }, children: PERSONA_PLATFORMS.map(platform => _jsx("option", { value: platform, children: PERSONA_PLATFORM_LABELS[platform] }, platform)) }), _jsx("input", { placeholder: t('persona.links.url'), value: link.url, onChange: (event) => { updateLink(index, { url: event.currentTarget.value }); } }), _jsx("input", { placeholder: t('persona.links.bio'), value: link.bio ?? '', onChange: (event) => { updateLink(index, { bio: event.currentTarget.value.slice(0, TEXT_CAP) }); } }), _jsx("button", { type: "button", className: css.personaMini, onClick: () => { controller.removeLink(index); }, children: t('persona.links.remove') })] }, index))), _jsx("button", { type: "button", className: css.personaMini, onClick: () => { controller.addLink(); }, children: t('persona.links.add') }), _jsx(FieldRow, { label: t('persona.site.url.label'), children: _jsx("input", { placeholder: t('persona.site.url.placeholder'), value: form.siteUrl, onChange: (event) => { controller.updateForm({ siteUrl: event.currentTarget.value }); } }) }), _jsx(FieldRow, { label: t('persona.site.paste.label'), children: _jsx("textarea", { rows: 4, value: form.sitePastedText, onChange: (event) => { controller.updateForm({ sitePastedText: event.currentTarget.value.slice(0, TEXT_CAP) }); } }) }), _jsx("button", { type: "button", className: css.personaMini, disabled: true, title: t('persona.site.parse.hint'), children: t('persona.site.parse') })] })), step === 3 && (_jsxs("div", { className: css.personaStepBody, children: [_jsx(FieldRow, { label: PERSONA_FIELD_LABELS.goal, children: _jsx("input", { value: form.fields.goal.value, onChange: (event) => { setField('goal')(event.currentTarget.value); } }) }), _jsx(FieldRow, { label: PERSONA_FIELD_LABELS.monetize, children: _jsx("input", { value: form.fields.monetize.value, onChange: (event) => { setField('monetize')(event.currentTarget.value); } }) }), _jsx(FieldRow, { label: PERSONA_FIELD_LABELS.contentValue, children: _jsx("input", { value: form.fields.contentValue.value, onChange: (event) => { setField('contentValue')(event.currentTarget.value); } }) }), _jsx(FieldRow, { label: PERSONA_FIELD_LABELS.cadence, children: _jsx("input", { value: form.fields.cadence.value, onChange: (event) => { setField('cadence')(event.currentTarget.value); } }) })] })), step === 4 && (_jsxs("div", { className: css.personaStepBody, children: [_jsx(FieldRow, { label: t('persona.style.preset.label'), children: _jsxs("select", { value: form.preset ?? '', onChange: (event) => { controller.updateForm({ preset: event.currentTarget.value === '' ? null : event.currentTarget.value }); }, children: [_jsx("option", { value: "", children: t('persona.style.preset.none') }), PERSONA_STYLE_PRESETS.map(preset => _jsx("option", { value: preset, children: PERSONA_STYLE_PRESET_LABELS[preset] }, preset))] }) }), _jsx(FieldRow, { label: t('persona.style.custom.label'), children: _jsx("textarea", { rows: 2, placeholder: t('persona.style.custom.placeholder'), value: form.customText, onChange: (event) => { controller.updateForm({ customText: event.currentTarget.value }); } }) }), _jsxs("div", { className: css.personaField, children: [_jsx("span", { className: css.personaFieldLabel, children: t('persona.style.strength.label') }), _jsx("div", { className: css.personaChips, children: ['light', 'strict'].map(strength => (_jsx("button", { type: "button", className: form.strength === strength ? css.personaChipOn : css.personaChip, onClick: () => { controller.updateForm({ strength }); }, children: t(strength === 'strict' ? 'persona.style.strict' : 'persona.style.light') }, strength))) })] }), _jsx(FieldRow, { label: PERSONA_FIELD_LABELS.phrases, children: _jsx("input", { value: form.fields.phrases.value, onChange: (event) => { setField('phrases')(event.currentTarget.value); } }) }), _jsx(FieldRow, { label: t('persona.style.banned.label'), children: _jsx("textarea", { rows: 2, value: form.bannedWordsText, onChange: (event) => { controller.updateForm({ bannedWordsText: event.currentTarget.value }); } }) }), _jsx(FieldRow, { label: t('persona.style.red.label'), children: _jsx("textarea", { rows: 2, value: form.redLinesText, onChange: (event) => { controller.updateForm({ redLinesText: event.currentTarget.value }); } }) }), _jsxs("div", { className: css.personaPromptBox, children: [_jsxs("div", { className: css.personaPromptHead, children: [_jsx("strong", { children: t('persona.prompt.preview') }), _jsx("button", { type: "button", className: css.personaMini, onClick: () => { void writeClipboard(prompt); }, children: t('persona.prompt.copy') })] }), _jsx("pre", { className: css.personaPromptText, children: prompt })] })] })), state.fillPreview !== null && _jsx(FillPreviewPanel, { state: state, controller: controller, t: t }), _jsxs("div", { className: css.personaModalFoot, children: [step > 1 && _jsx("button", { type: "button", className: css.personaMini, onClick: () => { controller.setStep((step - 1)); }, children: t('persona.prev') }), step < 4 && _jsx("button", { type: "button", className: css.personaPrimary, onClick: () => { controller.setStep((step + 1)); }, children: t('persona.next') }), _jsx("button", { type: "button", className: css.personaPrimary, disabled: state.saving, onClick: () => { void controller.saveWizard(); }, children: state.saving ? t('persona.saving') : t('persona.save') }), step === 4 && (_jsx("button", { type: "button", className: css.personaMini, disabled: state.aiBusy !== false, title: t('persona.fill.hint'), onClick: () => { void controller.runFill(); }, children: state.aiBusy === 'fill' ? t('persona.busy') : t('persona.fill.run') }))] })] }) }));
}
/** The AI fill preview: per-field textareas the user can adjust before adopting. */
function FillPreviewPanel(props) {
    const { state, controller, t } = props;
    const preview = state.fillPreview;
    if (preview === null)
        return null;
    return (_jsxs("div", { className: css.personaFill, role: "status", children: [_jsxs("div", { className: css.personaFillHead, children: [_jsx("strong", { children: t('persona.fill.title') }), _jsx("button", { type: "button", className: css.personaMini, onClick: () => { controller.adoptAllFill(); }, children: t('persona.fill.adoptAll') }), _jsx("button", { type: "button", className: css.personaMini, onClick: () => { controller.discardFill(); }, children: t('persona.fill.discard') })] }), Object.keys(preview.fields).map(key => (_jsx(FillRow, { fieldKey: key, value: preview.fields[key] ?? '', controller: controller, t: t }, key)))] }));
}
/** One candidate row: editable in place, adopted with its edited text. */
function FillRow(props) {
    const { fieldKey, value, controller, t } = props;
    const [draft, setDraft] = useState(value);
    return (_jsxs("div", { className: css.personaFillRow, children: [_jsx("span", { className: css.personaFieldLabel, children: PERSONA_FIELD_LABELS[fieldKey] }), _jsx("textarea", { rows: 2, value: draft, onChange: (event) => { setDraft(event.currentTarget.value); } }), _jsx("button", { type: "button", className: css.personaMini, onClick: () => { controller.adoptFillField(fieldKey, draft); }, children: t('persona.fill.adopt') })] }));
}
/** The report panel: generate, edit with the staleness banner, confirmed regeneration. */
function PersonaReportPanel(props) {
    const { entry, controller, t } = props;
    const report = entry.report;
    const [draft, setDraft] = useState(report?.markdown ?? '');
    useEffect(() => { setDraft(report?.markdown ?? ''); }, [report]);
    const stale = report !== null && entry.revision > report.sourceRevision;
    const generate = () => {
        if (report !== null && report.editedByUser && !window.confirm(t('persona.report.confirmRegen')))
            return;
        void controller.generateReport(entry.id);
    };
    return (_jsx("div", { className: css.personaModal, role: "dialog", "aria-modal": "true", "aria-label": t('persona.report.title'), children: _jsxs("div", { className: css.personaModalCard, children: [_jsxs("div", { className: css.personaModalHead, children: [_jsx("h3", { children: `${t('persona.report.title')} · ${entry.name}` }), _jsx("button", { type: "button", className: css.personaMini, onClick: () => { controller.closeReport(); }, "aria-label": t('persona.report.close'), children: t('persona.report.close') })] }), report === null ? (_jsx("p", { className: css.personaEmpty, children: t('persona.report.empty') })) : (_jsxs(_Fragment, { children: [stale && _jsx("div", { className: css.personaBanner, role: "status", children: t('persona.report.stale') }), report.editedByUser && _jsx("p", { className: css.personaReportEdited, children: t('persona.report.edited') }), _jsx("textarea", { className: css.personaReportText, rows: 14, value: draft, onChange: (event) => { setDraft(event.currentTarget.value); } })] })), _jsxs("div", { className: css.personaModalFoot, children: [_jsx("button", { type: "button", className: css.personaMini, disabled: controller.getState().aiBusy !== false || report === null || draft.trim().length === 0 || draft === report.markdown, onClick: () => { void controller.saveReportEdit(entry.id, draft); }, children: t('persona.report.edit.save') }), _jsx("button", { type: "button", className: css.personaPrimary, disabled: controller.getState().aiBusy === 'report', onClick: generate, children: controller.getState().aiBusy === 'report' ? t('persona.busy') : report === null ? t('persona.report.generate') : t('persona.report.regenerate') })] })] }) }));
}
//# sourceMappingURL=PersonaView.js.map