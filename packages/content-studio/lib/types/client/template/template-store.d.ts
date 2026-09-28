/**
 * The template-library controller: one observable state object over the
 * global template faces of the content-outputs Remote, the 模板库 page's
 * editor, and the cross-column picker modal. Every AI action is explicit and
 * lands in a draft the user adopts or discards — nothing reaches disk except
 * through a save. The picker never writes: it hands the rendered body back to
 * the host column, which owns where it lands.
 */
import type { TemplateAiOperation, TemplateAiRequest, TemplateAiResult, TemplateCategory, TemplateHistoryEntry, TemplateId, TemplateImportStrategy, TemplateImportSummary, TemplateInput, TemplatePack, TemplateRecord, TemplateStatus, TemplateTag, TemplateTagId, TemplateVariable } from '@deepseek-ai/dsh-content-outputs/types';
/** The injected server face: the template half of the content-outputs Remote. */
export interface TemplateGateway {
    listTemplates: () => Promise<{
        templates: readonly TemplateRecord[];
        tags: readonly TemplateTag[];
        problems: readonly string[];
    }>;
    putTemplate: (input: TemplateInput) => Promise<TemplateRecord>;
    setTemplateStatus: (id: TemplateId, status: TemplateStatus) => Promise<TemplateRecord>;
    deleteTemplate: (id: TemplateId) => Promise<void>;
    getTemplateHistory: (id: TemplateId) => Promise<{
        entries: readonly TemplateHistoryEntry[];
    }>;
    putTemplateTags: (tags: readonly TemplateTag[]) => Promise<readonly TemplateTag[]>;
    exportTemplates: (ids: readonly string[]) => Promise<TemplatePack>;
    importTemplates: (pack: TemplatePack, strategy: TemplateImportStrategy) => Promise<TemplateImportSummary>;
    processTemplateAi: (request: TemplateAiRequest) => Promise<TemplateAiResult>;
}
/** One-step user-facing outcome codes; the copy lives in the locale dictionaries. */
export type TemplateNotice = 'load-failed' | 'save-failed' | 'name-duplicate' | 'delete-failed' | 'tags-failed' | 'tag-name-required' | 'import-invalid' | 'import-failed' | 'export-failed' | 'ai-failed' | 'ai-empty' | 'saved' | 'archived' | 'restored';
/** The editable template form inside the library editor. */
export interface TemplateForm {
    /** Null while composing a new template. */
    readonly id: TemplateId | null;
    readonly name: string;
    readonly category: TemplateCategory;
    readonly description: string;
    readonly tagIds: readonly TemplateTagId[];
    readonly body: string;
    /** Active and unused metadata; the body reconciliation keeps them aligned. */
    readonly variables: readonly TemplateVariable[];
    readonly changeNote: string;
}
/** The open editor sheet over one template form. */
export interface TemplateEditor {
    readonly form: TemplateForm;
}
/**
 * What one confirmed pick hands to the host column — the v2 output contract:
 * the rendered body plus the structured fields. `title` is the filled
 * `title` variable when the template defines one, else the template's own
 * name; `tags` carries the template's tag names for hosts that prefill label
 * fields. The raw `values` stay available for multi-field hosts.
 */
export interface TemplatePickDraft {
    readonly title: string;
    readonly body: string;
    readonly tags: readonly string[];
    readonly values: Readonly<Record<string, string>>;
    readonly template: TemplateRecord;
}
/**
 * The host-column contract the picker applies to: the column declares which
 * category it draws from and where the rendered body lands. A target without
 * `apply` is the copy-only fallback — the modal offers the rendered body on
 * the clipboard and never touches the host form.
 */
export interface TemplatePickTarget {
    readonly category: TemplateCategory;
    /** The host field the rendered body fills, named in the overwrite confirmation. */
    readonly targetLabel: string;
    /** Whether the host field currently holds content; true adds the overwrite confirmation. */
    readonly hasContent: () => boolean;
    /** Receives the structured draft; the host owns the merge. */
    readonly apply?: (draft: TemplatePickDraft) => void;
}
/** The picker modal's state machine: list → fill → (overwrite confirm) → apply. */
export interface PickerState {
    readonly target: TemplatePickTarget;
    readonly search: string;
    readonly selected: TemplateRecord | null;
    readonly values: Readonly<Record<string, string>>;
    readonly overwriteConfirm: boolean;
}
/** What one import produced, shown until dismissed. */
export interface TemplateImportReport {
    readonly fileName: string;
    readonly summary: TemplateImportSummary;
}
/** Snapshot the React surface subscribes to. */
export interface TemplateState {
    readonly templates: readonly TemplateRecord[];
    readonly tags: readonly TemplateTag[];
    /** Stored records that failed validation, named but not dropped silently. */
    readonly problems: readonly string[];
    readonly loading: boolean;
    readonly saving: boolean;
    readonly editor: TemplateEditor | null;
    readonly history: readonly TemplateHistoryEntry[];
    readonly historyOpen: boolean;
    readonly aiBusy: false | TemplateAiOperation;
    readonly aiDraft: TemplateAiResult | null;
    readonly generateSource: string;
    readonly generateCategory: TemplateCategory;
    readonly optimizeSource: string;
    readonly extractSource: string;
    readonly importReport: TemplateImportReport | null;
    readonly picker: PickerState | null;
    readonly notice: TemplateNotice | null;
}
/** View preferences persisted per browser; losing them loses nothing. */
export interface TemplatePrefs {
    /** Category filter, or null for all. */
    readonly category: TemplateCategory | null;
    /** Selected tag-id filter. */
    readonly tagIds: readonly TemplateTagId[];
    /** Status filter: all, active only, or archived only. */
    readonly status: 'all' | 'active' | 'archived';
    readonly search: string;
}
/** Injected server face. */
export interface TemplateControllerDeps {
    readonly gateway: TemplateGateway;
}
/**
 * Create the template-library controller.
 * @param deps - the injected gateway face.
 * @returns the controller with its initial empty state.
 */
export declare function createTemplateController(deps: TemplateControllerDeps): TemplateController;
/** Observable library state plus every action the two surfaces need. */
export interface TemplateController {
    /** Current state (the useSyncExternalStore snapshot). */
    getState(): TemplateState;
    /** Current view preferences (category, tags, status, search). */
    getPrefs(): TemplatePrefs;
    /** Subscribe to state changes; returns the unsubscriber. */
    subscribe(listener: () => void): () => void;
    /** Reload the library from disk. */
    reload(): void;
    /** Patch the view preferences. */
    setFilter(next: Partial<TemplatePrefs>): void;
    /** Clear the current notice. */
    dismissNotice(): void;
    /** Open a blank editor sheet. */
    openNew(): void;
    /** Open the editor over one stored template. */
    openEditor(record: TemplateRecord): void;
    /** Close the editor sheet. */
    closeEditor(): void;
    /** Patch the form; a body patch re-reconciles the variable metadata. */
    patchForm(formPatch: Partial<TemplateForm>): void;
    /** Patch one variable's metadata. */
    patchVariable(name: string, variablePatch: Partial<TemplateVariable>): void;
    /** Toggle one tag on the form. */
    toggleFormTag(tagId: TemplateTagId): void;
    /** Save the form: one manual save, one history snapshot. */
    save(): void;
    /** Archive or restore one template (no snapshot). */
    toggleArchive(record: TemplateRecord): void;
    /** Delete one template and its history. */
    remove(id: TemplateId): void;
    /** Open the editor over a copy of one stored template. */
    copyTemplate(record: TemplateRecord): void;
    /** Load and show one template's history. */
    openHistory(id: TemplateId): void;
    /** Close the history drawer. */
    closeHistory(): void;
    /** Copy one snapshot's body back into the editor as a pending restore. */
    restoreVersion(entry: TemplateHistoryEntry): void;
    /** Add one shared tag. */
    addTag(name: string): void;
    /** Remove one shared tag; references are stripped from every template. */
    removeTag(tagId: TemplateTagId): void;
    /** Import one pack file with the given conflict strategy. */
    importFile(file: File, strategy: TemplateImportStrategy): void;
    /** Clear the import report. */
    dismissImportReport(): void;
    /** Import the bundled starter pack; `skip` makes re-imports idempotent. */
    importStarterPack(): void;
    /** Download the pack document for the given ids (empty exports all). */
    exportIds(ids: readonly string[]): void;
    /** Set the AI generation description. */
    setGenerateSource(text: string): void;
    /** Set the AI generation target category. */
    setGenerateCategory(category: TemplateCategory): void;
    /** Set the AI optimization instruction. */
    setOptimizeSource(text: string): void;
    /** Set the extraction source instance content. */
    setExtractSource(text: string): void;
    /** Run one AI operation; the result lands in the draft preview. */
    runAi(request: TemplateAiRequest): void;
    /** Apply the AI draft to the editor (opening one for `generate`). */
    adoptAiDraft(): void;
    /** Drop the AI draft. */
    discardAiDraft(): void;
    /** Open the picker for one host column. */
    openPicker(target: TemplatePickTarget): void;
    /** Patch the picker search text. */
    pickerSearch(text: string): void;
    /** Select one template to fill. */
    pickerSelect(record: TemplateRecord): void;
    /** Set one variable's filled value. */
    pickerValue(name: string, value: string): void;
    /** Return from the fill step to the list. */
    pickerBack(): void;
    /** Render and hand the body to the host; confirms the overwrite first. */
    pickerConfirm(): void;
    /** Copy the rendered body to the clipboard (the no-apply fallback). */
    pickerCopyBody(): void;
    /** Close the picker without applying. */
    closePicker(): void;
}
//# sourceMappingURL=template-store.d.ts.map