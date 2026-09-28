/**
 * The template-library controller: one observable state object over the
 * global template faces of the content-outputs Remote, the 模板库 page's
 * editor, and the cross-column picker modal. Every AI action is explicit and
 * lands in a draft the user adopts or discards — nothing reaches disk except
 * through a save. The picker never writes: it hands the rendered body back to
 * the host column, which owns where it lands.
 */
import { writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives';
import { reconcileVariables, renderTemplate, missingRequired, parseTemplatePack } from "./model.js";
import { STARTER_PACK_NAME, STARTER_TEMPLATE_PACK } from "./starter-pack.js";
/** Browser-local storage key for the template library's view preferences (view-only state, loss-free). */
const PREFS_KEY = 'dsh-content-studio.template.prefs';
function emptyForm(category = 'creation') {
    return { id: null, name: '', category, description: '', tagIds: [], body: '', variables: [], changeNote: '' };
}
function formFromRecord(record) {
    return {
        id: record.id,
        name: record.name,
        category: record.category,
        description: record.description,
        tagIds: [...record.tagIds],
        body: record.body,
        variables: [...record.variables],
        changeNote: '',
    };
}
function readPrefs() {
    const fallback = { category: null, tagIds: [], status: 'all', search: '' };
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw === null)
            return fallback;
        const parsed = JSON.parse(raw);
        return {
            category: parsed.category ?? null,
            tagIds: Array.isArray(parsed.tagIds) ? parsed.tagIds : [],
            status: parsed.status === 'active' || parsed.status === 'archived' ? parsed.status : 'all',
            search: typeof parsed.search === 'string' ? parsed.search : '',
        };
    }
    catch {
        // Unreadable preferences: the defaults lose nothing that reached disk.
        return fallback;
    }
}
function writePrefs(prefs) {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    }
    catch {
        // Private mode: the filters stay in memory for this session only.
    }
}
/** Monotonic suffix for browser-generated tag ids; uniqueness is all they need. */
let tagCounter = 0;
function nextTagId() {
    tagCounter += 1;
    return `tag-${Date.now().toString(36)}-${String(tagCounter)}`;
}
/**
 * Create the template-library controller.
 * @param deps - the injected gateway face.
 * @returns the controller with its initial empty state.
 */
export function createTemplateController(deps) {
    const { gateway } = deps;
    let state = {
        templates: [],
        tags: [],
        problems: [],
        loading: false,
        saving: false,
        editor: null,
        history: [],
        historyOpen: false,
        aiBusy: false,
        aiDraft: null,
        generateSource: '',
        generateCategory: 'creation',
        optimizeSource: '',
        extractSource: '',
        importReport: null,
        picker: null,
        notice: null,
    };
    let prefs = readPrefs();
    const listeners = new Set();
    const emit = () => {
        for (const listener of listeners)
            listener();
    };
    const patch = (next) => {
        state = { ...state, ...next };
        emit();
    };
    const setPrefs = (next) => {
        prefs = { ...prefs, ...next };
        writePrefs(prefs);
        emit();
    };
    const reload = async () => {
        patch({ loading: true });
        try {
            const snapshot = await gateway.listTemplates();
            patch({ templates: snapshot.templates, tags: snapshot.tags, problems: snapshot.problems, loading: false });
        }
        catch {
            patch({ loading: false, notice: 'load-failed' });
        }
    };
    const applyBody = (form, body) => {
        const reconciled = reconcileVariables(body, form.variables);
        return { ...form, body, variables: [...reconciled.active, ...reconciled.unused] };
    };
    const controller = {
        getState: () => state,
        getPrefs: () => prefs,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        reload: () => { void reload(); },
        setFilter: (next) => { setPrefs(next); },
        dismissNotice: () => {
            if (state.notice !== null)
                patch({ notice: null });
        },
        openNew: () => patch({ editor: { form: emptyForm() }, aiDraft: null, historyOpen: false, history: [] }),
        openEditor: record => patch({ editor: { form: formFromRecord(record) }, aiDraft: null, historyOpen: false, history: [] }),
        closeEditor: () => patch({ editor: null, aiDraft: null, historyOpen: false, history: [], optimizeSource: '', extractSource: '' }),
        patchForm: (formPatch) => {
            if (state.editor === null)
                return;
            const current = state.editor.form;
            const merged = { ...current, ...formPatch };
            const next = typeof formPatch.body === 'string'
                ? applyBody(merged, formPatch.body)
                : merged;
            patch({ editor: { form: next } });
        },
        patchVariable: (name, variablePatch) => {
            if (state.editor === null)
                return;
            const variables = state.editor.form.variables.map(variable => variable.name === name ? { ...variable, ...variablePatch } : variable);
            patch({ editor: { form: { ...state.editor.form, variables } } });
        },
        toggleFormTag: (tagId) => {
            if (state.editor === null)
                return;
            const form = state.editor.form;
            const tagIds = form.tagIds.includes(tagId)
                ? form.tagIds.filter(candidate => candidate !== tagId)
                : [...form.tagIds, tagId];
            patch({ editor: { form: { ...form, tagIds } } });
        },
        save: () => {
            const editor = state.editor;
            if (editor === null || state.saving)
                return;
            const form = editor.form;
            if (form.name.trim().length === 0 || form.body.trim().length === 0) {
                patch({ notice: 'save-failed' });
                return;
            }
            patch({ saving: true });
            void (async () => {
                try {
                    const record = await gateway.putTemplate({
                        ...(form.id === null ? {} : { id: form.id }),
                        name: form.name.trim(),
                        category: form.category,
                        description: form.description,
                        tagIds: form.tagIds,
                        body: form.body,
                        variables: form.variables,
                        ...(form.changeNote.trim().length > 0 ? { changeNote: form.changeNote.trim() } : {}),
                    });
                    patch({ saving: false, editor: { form: formFromRecord(record) }, notice: 'saved' });
                    await reload();
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : '';
                    patch({ saving: false, notice: /duplicate template name/.test(message) ? 'name-duplicate' : 'save-failed' });
                }
            })();
        },
        toggleArchive: (record) => {
            const status = record.status === 'active' ? 'archived' : 'active';
            void (async () => {
                try {
                    await gateway.setTemplateStatus(record.id, status);
                    patch({ notice: 'archived' });
                    await reload();
                }
                catch {
                    patch({ notice: 'save-failed' });
                }
            })();
        },
        remove: (id) => {
            void (async () => {
                try {
                    await gateway.deleteTemplate(id);
                    if (state.editor?.form.id === id)
                        patch({ editor: null });
                    await reload();
                }
                catch {
                    patch({ notice: 'delete-failed' });
                }
            })();
        },
        copyTemplate: (record) => {
            patch({ editor: { form: { ...formFromRecord(record), id: null, name: `${record.name} 副本`, changeNote: '' } } });
        },
        openHistory: (id) => {
            patch({ historyOpen: true, history: [] });
            void (async () => {
                try {
                    const read = await gateway.getTemplateHistory(id);
                    patch({ history: read.entries });
                }
                catch {
                    patch({ history: [] });
                }
            })();
        },
        closeHistory: () => patch({ historyOpen: false }),
        restoreVersion: (entry) => {
            const editor = state.editor;
            if (editor === null || editor.form.id === null)
                return;
            controller.patchForm({
                body: entry.record.body,
                variables: [...entry.record.variables],
                changeNote: `回滚自 v${String(entry.version)}`,
            });
            patch({ historyOpen: false, notice: 'restored' });
        },
        addTag: (name) => {
            const trimmed = name.trim();
            if (trimmed.length === 0) {
                patch({ notice: 'tag-name-required' });
                return;
            }
            const tag = { id: nextTagId(), name: trimmed };
            void (async () => {
                try {
                    await gateway.putTemplateTags([...state.tags, tag]);
                    await reload();
                }
                catch {
                    patch({ notice: 'tags-failed' });
                }
            })();
        },
        removeTag: (tagId) => {
            void (async () => {
                try {
                    await gateway.putTemplateTags(state.tags.filter(tag => tag.id !== tagId));
                    await reload();
                }
                catch {
                    patch({ notice: 'tags-failed' });
                }
            })();
        },
        importFile: (file, strategy) => {
            void (async () => {
                try {
                    const raw = await file.text();
                    const parsed = parseTemplatePack(raw);
                    if (parsed.kind === 'invalid') {
                        patch({ notice: 'import-invalid' });
                        return;
                    }
                    const summary = await gateway.importTemplates(parsed.pack, strategy);
                    patch({ importReport: { fileName: file.name, summary } });
                    await reload();
                }
                catch {
                    patch({ notice: 'import-failed' });
                }
            })();
        },
        dismissImportReport: () => patch({ importReport: null }),
        importStarterPack: () => {
            void (async () => {
                try {
                    const summary = await gateway.importTemplates(STARTER_TEMPLATE_PACK, 'skip');
                    patch({ importReport: { fileName: STARTER_PACK_NAME, summary } });
                    await reload();
                }
                catch {
                    patch({ notice: 'import-failed' });
                }
            })();
        },
        exportIds: (ids) => {
            void (async () => {
                try {
                    const packDoc = await gateway.exportTemplates(ids);
                    const blob = new Blob([`${JSON.stringify(packDoc, null, 2)}\n`], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = `dsh-templates-${new Date().toISOString().slice(0, 10)}.json`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                }
                catch {
                    patch({ notice: 'export-failed' });
                }
            })();
        },
        setGenerateSource: text => patch({ generateSource: text }),
        setGenerateCategory: category => patch({ generateCategory: category }),
        setOptimizeSource: text => patch({ optimizeSource: text }),
        setExtractSource: text => patch({ extractSource: text }),
        runAi: (request) => {
            if (state.aiBusy !== false)
                return;
            const body = request.operation === 'generate'
                ? request.description
                : request.operation === 'optimize' ? request.instruction : request.content;
            if (body.trim().length === 0) {
                patch({ notice: 'ai-empty' });
                return;
            }
            patch({ aiBusy: request.operation, aiDraft: null });
            void (async () => {
                try {
                    const result = await gateway.processTemplateAi(request);
                    patch({ aiBusy: false, aiDraft: result });
                }
                catch {
                    patch({ aiBusy: false, notice: 'ai-failed' });
                }
            })();
        },
        adoptAiDraft: () => {
            const draft = state.aiDraft;
            if (draft === null)
                return;
            if (draft.operation === 'generate') {
                const reconciled = reconcileVariables(draft.draft.body, draft.draft.variables);
                const form = {
                    ...emptyForm(state.generateCategory),
                    name: draft.draft.name,
                    description: draft.draft.description,
                    body: draft.draft.body,
                    variables: [...reconciled.active, ...reconciled.unused],
                };
                patch({ editor: { form }, aiDraft: null });
                return;
            }
            if (state.editor === null)
                return;
            const current = state.editor.form;
            if (draft.operation === 'optimize') {
                patch({ editor: { form: applyBody(current, draft.draft.body) }, aiDraft: null });
                return;
            }
            const proposed = draft.draft.variables.filter(variable => !current.variables.some(candidate => candidate.name === variable.name));
            const reconciled = reconcileVariables(draft.draft.body, [...current.variables, ...proposed]);
            patch({
                editor: { form: { ...applyBody(current, draft.draft.body), variables: [...reconciled.active, ...reconciled.unused] } },
                aiDraft: null,
            });
        },
        discardAiDraft: () => patch({ aiDraft: null }),
        openPicker: target => patch({ picker: { target, search: '', selected: null, values: {}, overwriteConfirm: false } }),
        pickerSearch: (text) => {
            if (state.picker !== null)
                patch({ picker: { ...state.picker, search: text } });
        },
        pickerSelect: (record) => {
            if (state.picker !== null)
                patch({ picker: { ...state.picker, selected: record, values: {}, overwriteConfirm: false } });
        },
        pickerValue: (name, value) => {
            if (state.picker !== null)
                patch({ picker: { ...state.picker, values: { ...state.picker.values, [name]: value } } });
        },
        pickerBack: () => {
            if (state.picker !== null)
                patch({ picker: { ...state.picker, selected: null, values: {}, overwriteConfirm: false } });
        },
        pickerConfirm: () => {
            const picker = state.picker;
            if (picker === null || picker.selected === null)
                return;
            if (picker.target.apply === undefined)
                return;
            if (missingRequired(picker.selected.body, picker.selected.variables, picker.values).length > 0)
                return;
            if (picker.target.hasContent() && !picker.overwriteConfirm) {
                patch({ picker: { ...picker, overwriteConfirm: true } });
                return;
            }
            const rendered = renderTemplate(picker.selected.body, picker.values, picker.selected.variables);
            const title = picker.values['title']?.trim() || picker.selected.name;
            const tagNames = picker.selected.tagIds
                .map(tagId => state.tags.find(tag => tag.id === tagId)?.name)
                .filter((name) => name !== undefined);
            picker.target.apply({
                title,
                body: rendered.output,
                tags: tagNames,
                values: picker.values,
                template: picker.selected,
            });
            patch({ picker: null });
        },
        pickerCopyBody: () => {
            const picker = state.picker;
            if (picker === null || picker.selected === null)
                return;
            const rendered = renderTemplate(picker.selected.body, picker.values, picker.selected.variables);
            void (async () => {
                if (await writeClipboard(rendered.output))
                    patch({ picker: null });
            })();
        },
        closePicker: () => patch({ picker: null }),
    };
    return controller;
}
//# sourceMappingURL=template-store.js.map