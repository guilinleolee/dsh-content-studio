/**
 * The persona view controller: one observable state object over the
 * `_personas.json` manifest (via the content-outputs persona faces) plus the
 * wizard's browser-local draft buffer. The save path is purely local — AI
 * actions (blank-field fill, résumé extraction, report generation) are
 * explicit, separate, and never block saving; adopted AI values land in the
 * draft first and reach disk only through a save. The old free-text persona
 * (`dsh-content-studio.persona`) is imported once through the view's banner
 * and cleared from browser storage.
 */
import { PERSONA_FIELD_KEYS, PERSONA_FILL_PROHIBITED } from "./model.js";
import { renderEntryPrompt } from "./prompt.js";
import { adoptField, emptyForm, formFromEntry, inputFromForm } from "./model.js";
/** Browser-local storage keys owned by the persona view. */
const SELECTED_KEY = 'dsh-content-studio.persona.selectedId';
const WIZARD_KEY = 'dsh-content-studio.persona.wizard';
const LEGACY_KEY = 'dsh-content-studio.persona';
const LEGACY_DISMISS_KEY = 'dsh-content-studio.persona.legacyDismissed';
/** Draft-buffer format version; unrecognized buffers drop back to a fresh form. */
const WIZARD_VERSION = 1;
/** Read the persisted creation-side selection; private mode keeps it in memory. */
function readSelected() {
    try {
        const raw = localStorage.getItem(SELECTED_KEY);
        if (raw === null)
            return null;
        const parsed = JSON.parse(raw);
        return parsed.version === WIZARD_VERSION && typeof parsed.id === 'string' ? parsed.id : null;
    }
    catch {
        // Unreadable selection: the default (no persona injected) is safe.
        return null;
    }
}
function writeSelected(id) {
    try {
        if (id === null)
            localStorage.removeItem(SELECTED_KEY);
        else
            localStorage.setItem(SELECTED_KEY, JSON.stringify({ version: WIZARD_VERSION, id }));
    }
    catch {
        // Private mode: the selection stays in memory for this session only.
    }
}
/** Read the unsaved wizard draft; unrecognized shapes drop to a fresh form. */
function readDraft() {
    try {
        const raw = localStorage.getItem(WIZARD_KEY);
        if (raw === null)
            return null;
        const parsed = JSON.parse(raw);
        if (parsed.version !== WIZARD_VERSION || typeof parsed.form?.name !== 'string')
            return null;
        const base = emptyForm();
        const step = parsed.step === 2 || parsed.step === 3 || parsed.step === 4 ? parsed.step : 1;
        return {
            step,
            form: {
                ...base,
                ...parsed.form,
                fields: { ...base.fields, ...(parsed.form.fields ?? {}) },
            },
        };
    }
    catch {
        // Unreadable draft: starting fresh loses nothing that reached disk.
        return null;
    }
}
function writeDraft(wizard) {
    try {
        localStorage.setItem(WIZARD_KEY, JSON.stringify({ version: WIZARD_VERSION, step: wizard.step, form: wizard.form }));
    }
    catch {
        // Private mode: the draft lives in memory until the surface closes.
    }
}
function clearDraft() {
    try {
        localStorage.removeItem(WIZARD_KEY);
    }
    catch {
        // Nothing to recover: a stale buffer is inert.
    }
}
/** The old free-text persona, or null when absent, empty, or dismissed. */
function readLegacy() {
    try {
        if (localStorage.getItem(LEGACY_DISMISS_KEY) === '1')
            return null;
        const raw = localStorage.getItem(LEGACY_KEY);
        return raw !== null && raw.trim().length > 0 ? raw : null;
    }
    catch {
        return null;
    }
}
/**
 * Create the persona controller. The browser half creates one instance in
 * apply() and injects it into the surface, like the open/close controller.
 * @param deps - the injected server face.
 * @returns the controller with its state and actions.
 */
export function createPersonaController(deps) {
    const listeners = new Set();
    let personas = [];
    let problems = [];
    let loading = false;
    let loadedOnce = false;
    let saving = false;
    let selectedId = readSelected();
    let legacyText = readLegacy();
    let wizard = null;
    let reportId = null;
    let aiBusy = false;
    let fillPreview = null;
    let notice = null;
    const buildState = () => ({
        personas,
        problems,
        loading,
        saving,
        selectedId,
        legacyText,
        wizard,
        reportId,
        aiBusy,
        fillPreview,
        notice,
    });
    let snapshot = buildState();
    const emit = () => {
        snapshot = buildState();
        for (const listener of listeners)
            listener();
    };
    const state = () => snapshot;
    const setNotice = (value) => {
        notice = value;
        emit();
    };
    const find = (id) => personas.find(entry => entry.id === id);
    const patchWizard = (next) => {
        wizard = next;
        writeDraft(next);
        emit();
    };
    const nonEmptyFields = (form) => {
        const known = {};
        for (const key of PERSONA_FIELD_KEYS) {
            const value = form.fields[key].value.trim();
            if (value.length > 0)
                known[key] = value;
        }
        return known;
    };
    /**
     * Run one AI call with the busy flag and the shared failure notice; the
     * caller supplies the success handling.
     */
    const runAi = async (kind, call, failure) => {
        aiBusy = kind;
        emit();
        try {
            await call();
        }
        catch {
            setNotice(failure);
        }
        finally {
            aiBusy = false;
            emit();
        }
    };
    const reload = async () => {
        loadedOnce = true;
        loading = true;
        emit();
        try {
            const snapshotRead = await deps.gateway.listPersonas();
            personas = snapshotRead.personas;
            problems = snapshotRead.problems;
            if (selectedId !== null && !personas.some(entry => entry.id === selectedId)) {
                selectedId = null;
                writeSelected(null);
            }
        }
        catch {
            setNotice('load-failed');
        }
        finally {
            loading = false;
            emit();
        }
    };
    return {
        subscribe(listener) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        getState: () => state(),
        async ensureLoaded() {
            if (loadedOnce)
                return;
            await reload();
        },
        reload: () => reload(),
        activePrompt() {
            const entry = selectedId === null ? undefined : find(selectedId);
            return entry === undefined ? '' : renderEntryPrompt(entry);
        },
        selectedEntry() {
            return selectedId === null ? null : find(selectedId) ?? null;
        },
        select(id) {
            selectedId = id;
            writeSelected(id);
            emit();
        },
        openNew() {
            wizard = readDraft() ?? { step: 1, form: emptyForm() };
            emit();
        },
        openEdit(id) {
            const entry = find(id);
            if (entry === undefined)
                return;
            patchWizard({ step: 1, form: formFromEntry(entry) });
        },
        openClone(id) {
            const entry = find(id);
            if (entry === undefined)
                return;
            patchWizard({ step: 1, form: formFromEntry(entry, { clone: true }) });
        },
        closeWizard() {
            wizard = null;
            fillPreview = null;
            emit();
        },
        setStep(step) {
            if (wizard === null)
                return;
            patchWizard({ ...wizard, step });
        },
        updateForm(patch) {
            if (wizard === null)
                return;
            patchWizard({ ...wizard, form: { ...wizard.form, ...patch } });
        },
        setField(key, value) {
            if (wizard === null)
                return;
            const form = {
                ...wizard.form,
                fields: { ...wizard.form.fields, [key]: { value, source: 'user', aiMeta: null } },
            };
            patchWizard({ ...wizard, form });
        },
        togglePlatform(platform) {
            if (wizard === null)
                return;
            const platforms = wizard.form.platforms.includes(platform)
                ? wizard.form.platforms.filter(candidate => candidate !== platform)
                : [...wizard.form.platforms, platform];
            patchWizard({ ...wizard, form: { ...wizard.form, platforms } });
        },
        setAccountStage(stage) {
            if (wizard === null)
                return;
            patchWizard({ ...wizard, form: { ...wizard.form, accountStage: stage } });
        },
        addLink() {
            if (wizard === null)
                return;
            const link = { platform: 'xhs', url: '', bio: null, sampleText: null };
            patchWizard({ ...wizard, form: { ...wizard.form, links: [...wizard.form.links, link] } });
        },
        updateLink(index, patch) {
            if (wizard === null)
                return;
            const links = wizard.form.links.map((link, at) => at === index ? { ...link, ...patch } : link);
            patchWizard({ ...wizard, form: { ...wizard.form, links } });
        },
        removeLink(index) {
            if (wizard === null)
                return;
            patchWizard({ ...wizard, form: { ...wizard.form, links: wizard.form.links.filter((_, at) => at !== index) } });
        },
        async runFill() {
            if (wizard === null)
                return;
            const known = nonEmptyFields(wizard.form);
            const blanks = PERSONA_FIELD_KEYS.filter(key => !PERSONA_FILL_PROHIBITED.includes(key) && (known[key] === undefined));
            if (blanks.length === 0) {
                setNotice('fill-none');
                return;
            }
            await runAi('fill', async () => {
                const result = await deps.gateway.processPersonaAi({ operation: 'fill', known, blanks });
                if (Object.keys(result.fields).length === 0) {
                    setNotice('fill-none');
                    return;
                }
                fillPreview = { origin: 'fill', promptVersion: result.promptVersion, fields: result.fields };
            }, 'ai-failed');
        },
        async runResume() {
            if (wizard === null)
                return;
            const resumeText = wizard.form.resumeText;
            if (resumeText.trim().length === 0) {
                setNotice('resume-empty');
                return;
            }
            if (!wizard.form.resumeConsent) {
                setNotice('resume-consent');
                return;
            }
            await runAi('resume', async () => {
                const result = await deps.gateway.processPersonaAi({ operation: 'resume', resumeText });
                if (Object.keys(result.fields).length === 0) {
                    setNotice('ai-failed');
                    return;
                }
                fillPreview = { origin: 'resume', promptVersion: result.promptVersion, fields: result.fields };
            }, 'ai-failed');
        },
        adoptFillField(key, value) {
            if (wizard === null || fillPreview === null)
                return;
            const text = value ?? fillPreview.fields[key];
            if (text === undefined || text.length === 0)
                return;
            const form = adoptField(wizard.form, key, text, fillPreview.promptVersion);
            const { [key]: _consumed, ...fields } = fillPreview.fields;
            fillPreview = Object.keys(fields).length > 0 ? { ...fillPreview, fields } : null;
            patchWizard({ ...wizard, form });
        },
        adoptAllFill() {
            if (wizard === null || fillPreview === null)
                return;
            let form = wizard.form;
            for (const [key, value] of Object.entries(fillPreview.fields)) {
                form = adoptField(form, key, value, fillPreview.promptVersion);
            }
            fillPreview = null;
            patchWizard({ ...wizard, form });
        },
        discardFill() {
            fillPreview = null;
            emit();
        },
        async saveWizard() {
            if (wizard === null)
                return;
            if (wizard.form.name.trim().length === 0) {
                setNotice('name-required');
                return;
            }
            saving = true;
            emit();
            try {
                await deps.gateway.putPersona(inputFromForm(wizard.form));
                clearDraft();
                wizard = null;
                fillPreview = null;
                await reload();
            }
            catch {
                setNotice('save-failed');
            }
            finally {
                saving = false;
                emit();
            }
        },
        async remove(id) {
            try {
                await deps.gateway.deletePersona(id);
                if (selectedId === id) {
                    selectedId = null;
                    writeSelected(null);
                }
                await reload();
            }
            catch {
                setNotice('delete-failed');
            }
        },
        openReport(id) {
            reportId = id;
            emit();
        },
        closeReport() {
            reportId = null;
            emit();
        },
        async generateReport(id) {
            const entry = find(id);
            if (entry === undefined)
                return;
            await runAi('report', async () => {
                const result = await deps.gateway.processPersonaAi({ operation: 'report', facts: entry });
                await deps.gateway.putPersonaReport(id, {
                    markdown: result.markdown,
                    sourceRevision: entry.revision,
                    editedByUser: false,
                    generatedAt: new Date().toISOString(),
                    promptVersion: result.promptVersion,
                });
                setNotice('report-saved');
                await reload();
            }, 'report-failed');
        },
        async saveReportEdit(id, markdown) {
            const entry = find(id);
            const text = markdown.trim();
            if (entry === undefined || entry.report === null || text.length === 0)
                return;
            try {
                await deps.gateway.putPersonaReport(id, { ...entry.report, markdown: text, editedByUser: true });
                setNotice('report-saved');
                await reload();
            }
            catch {
                setNotice('report-failed');
            }
        },
        async importLegacy(name) {
            const text = legacyText;
            if (text === null)
                return;
            const form = emptyForm();
            form.name = name;
            form.customText = text;
            try {
                await deps.gateway.putPersona(inputFromForm(form));
                try {
                    localStorage.removeItem(LEGACY_KEY);
                }
                catch {
                    // Removal is best effort: the banner clears for this session either way.
                }
                legacyText = null;
                setNotice('legacy-done');
                await reload();
            }
            catch {
                setNotice('legacy-failed');
            }
        },
        dismissLegacy() {
            try {
                localStorage.setItem(LEGACY_DISMISS_KEY, '1');
            }
            catch {
                // Private mode: dismissal holds for this session only.
            }
            legacyText = null;
            emit();
        },
        dismissNotice() {
            setNotice(null);
        },
    };
}
//# sourceMappingURL=persona-store.js.map