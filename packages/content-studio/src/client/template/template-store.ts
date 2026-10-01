/**
 * The template-library controller: one observable state object over the
 * global template faces of the content-outputs Remote, the 模板库 page's
 * editor, and the cross-column picker modal. Every AI action is explicit and
 * lands in a draft the user adopts or discards — nothing reaches disk except
 * through a save. The picker never writes: it hands the rendered body back to
 * the host column, which owns where it lands.
 */

import type {
  TemplateAiOperation, TemplateAiRequest, TemplateAiResult, TemplateCategory,
  TemplateHistoryEntry, TemplateId, TemplateImportStrategy, TemplateImportSummary,
  TemplateInput, TemplatePack, TemplateRecord, TemplateStatus, TemplateTag,
  TemplateTagId, TemplateVariable,
} from '@deepseek-ai/dsh-content-outputs/types'
import { writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import { reconcileVariables, renderTemplate, missingRequired, parseTemplatePack } from './model.ts'
import { STARTER_PACK_NAME, STARTER_TEMPLATE_PACK } from './starter-pack.ts'

/** Browser-local storage key for the template library's view preferences (view-only state, loss-free). */
const PREFS_KEY = 'dsh-content-studio.template.prefs'

/** The injected server face: the template half of the content-outputs Remote. */
export interface TemplateGateway {
  listTemplates: () => Promise<{ templates: readonly TemplateRecord[]; tags: readonly TemplateTag[]; problems: readonly string[] }>
  putTemplate: (input: TemplateInput) => Promise<TemplateRecord>
  setTemplateStatus: (id: TemplateId, status: TemplateStatus) => Promise<TemplateRecord>
  deleteTemplate: (id: TemplateId) => Promise<void>
  getTemplateHistory: (id: TemplateId) => Promise<{ entries: readonly TemplateHistoryEntry[] }>
  putTemplateTags: (tags: readonly TemplateTag[]) => Promise<readonly TemplateTag[]>
  exportTemplates: (ids: readonly string[]) => Promise<TemplatePack>
  importTemplates: (pack: TemplatePack, strategy: TemplateImportStrategy) => Promise<TemplateImportSummary>
  processTemplateAi: (request: TemplateAiRequest) => Promise<TemplateAiResult>
}

/** One-step user-facing outcome codes; the copy lives in the locale dictionaries. */
export type TemplateNotice =
  | 'load-failed'
  | 'save-failed'
  | 'name-duplicate'
  | 'delete-failed'
  | 'tags-failed'
  | 'tag-name-required'
  | 'import-invalid'
  | 'import-failed'
  | 'export-failed'
  | 'ai-failed'
  | 'ai-empty'
  | 'saved'
  | 'archived'
  | 'restored'

/** The editable template form inside the library editor. */
export interface TemplateForm {
  /** Null while composing a new template. */
  readonly id: TemplateId | null
  readonly name: string
  readonly category: TemplateCategory
  readonly description: string
  readonly tagIds: readonly TemplateTagId[]
  readonly body: string
  /** Active and unused metadata; the body reconciliation keeps them aligned. */
  readonly variables: readonly TemplateVariable[]
  readonly changeNote: string
}

/** The open editor sheet over one template form. */
export interface TemplateEditor {
  readonly form: TemplateForm
}

/**
 * What one confirmed pick hands to the host column — the v2 output contract:
 * the rendered body plus the structured fields. `title` is the filled
 * `title` variable when the template defines one, else the template's own
 * name; `tags` carries the template's tag names for hosts that prefill label
 * fields. The raw `values` stay available for multi-field hosts.
 */
export interface TemplatePickDraft {
  readonly title: string
  readonly body: string
  readonly tags: readonly string[]
  readonly values: Readonly<Record<string, string>>
  readonly template: TemplateRecord
}

/**
 * The host-column contract the picker applies to: the column declares which
 * category it draws from and where the rendered body lands. A target without
 * `apply` is the copy-only fallback — the modal offers the rendered body on
 * the clipboard and never touches the host form.
 */
export interface TemplatePickTarget {
  readonly category: TemplateCategory
  /** The host field the rendered body fills, named in the overwrite confirmation. */
  readonly targetLabel: string
  /** Whether the host field currently holds content; true adds the overwrite confirmation. */
  readonly hasContent: () => boolean
  /** Receives the structured draft; the host owns the merge. */
  readonly apply?: (draft: TemplatePickDraft) => void
}

/** The picker modal's state machine: list → fill → (overwrite confirm) → apply. */
export interface PickerState {
  readonly target: TemplatePickTarget
  readonly search: string
  readonly selected: TemplateRecord | null
  readonly values: Readonly<Record<string, string>>
  readonly overwriteConfirm: boolean
}

/** What one import produced, shown until dismissed. */
export interface TemplateImportReport {
  readonly fileName: string
  readonly summary: TemplateImportSummary
}

/** Snapshot the React surface subscribes to. */
export interface TemplateState {
  readonly templates: readonly TemplateRecord[]
  readonly tags: readonly TemplateTag[]
  /** Stored records that failed validation, named but not dropped silently. */
  readonly problems: readonly string[]
  readonly loading: boolean
  readonly saving: boolean
  readonly editor: TemplateEditor | null
  readonly history: readonly TemplateHistoryEntry[]
  readonly historyOpen: boolean
  readonly aiBusy: false | TemplateAiOperation
  readonly aiDraft: TemplateAiResult | null
  readonly generateSource: string
  readonly generateCategory: TemplateCategory
  readonly optimizeSource: string
  readonly extractSource: string
  readonly importReport: TemplateImportReport | null
  readonly picker: PickerState | null
  readonly notice: TemplateNotice | null
}

/** View preferences persisted per browser; losing them loses nothing. */
export interface TemplatePrefs {
  /** Category filter, or null for all. */
  readonly category: TemplateCategory | null
  /** Selected tag-id filter. */
  readonly tagIds: readonly TemplateTagId[]
  /** Status filter: all, active only, or archived only. */
  readonly status: 'all' | 'active' | 'archived'
  readonly search: string
}

/** Injected server face. */
export interface TemplateControllerDeps {
  readonly gateway: TemplateGateway
}

function emptyForm(category: TemplateCategory = 'creation'): TemplateForm {
  return { id: null, name: '', category, description: '', tagIds: [], body: '', variables: [], changeNote: '' }
}

function formFromRecord(record: TemplateRecord): TemplateForm {
  return {
    id: record.id,
    name: record.name,
    category: record.category,
    description: record.description,
    tagIds: [...record.tagIds],
    body: record.body,
    variables: [...record.variables],
    changeNote: '',
  }
}

function readPrefs(): TemplatePrefs {
  const fallback: TemplatePrefs = { category: null, tagIds: [], status: 'all', search: '' }
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw) as Partial<TemplatePrefs>
    return {
      category: parsed.category ?? null,
      tagIds: Array.isArray(parsed.tagIds) ? parsed.tagIds : [],
      status: parsed.status === 'active' || parsed.status === 'archived' ? parsed.status : 'all',
      search: typeof parsed.search === 'string' ? parsed.search : '',
    }
  } catch {
    // Unreadable preferences: the defaults lose nothing that reached disk.
    return fallback
  }
}

function writePrefs(prefs: TemplatePrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Private mode: the filters stay in memory for this session only.
  }
}

/** Monotonic suffix for browser-generated tag ids; uniqueness is all they need. */
let tagCounter = 0

function nextTagId(): TemplateTagId {
  tagCounter += 1
  return `tag-${Date.now().toString(36)}-${String(tagCounter)}` as TemplateTagId
}

/**
 * Create the template-library controller.
 * @param deps - the injected gateway face.
 * @returns the controller with its initial empty state.
 */
export function createTemplateController(deps: TemplateControllerDeps): TemplateController {
  const { gateway } = deps
  let state: TemplateState = {
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
  }
  let prefs = readPrefs()
  const listeners = new Set<() => void>()

  const emit = (): void => {
    for (const listener of listeners) listener()
  }
  const patch = (next: Partial<TemplateState>): void => {
    state = { ...state, ...next }
    emit()
  }
  const setPrefs = (next: Partial<TemplatePrefs>): void => {
    prefs = { ...prefs, ...next }
    writePrefs(prefs)
    emit()
  }

  const reload = async (): Promise<void> => {
    patch({ loading: true })
    try {
      const snapshot = await gateway.listTemplates()
      patch({ templates: snapshot.templates, tags: snapshot.tags, problems: snapshot.problems, loading: false })
    } catch {
      patch({ loading: false, notice: 'load-failed' })
    }
  }

  const applyBody = (form: TemplateForm, body: string): TemplateForm => {
    const reconciled = reconcileVariables(body, form.variables)
    return { ...form, body, variables: [...reconciled.active, ...reconciled.unused] }
  }

  const controller: TemplateController = {
    getState: () => state,
    getPrefs: () => prefs,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    reload: () => { void reload() },
    setFilter: (next) => { setPrefs(next) },
    dismissNotice: () => {
      if (state.notice !== null) patch({ notice: null })
    },

    openNew: () =>{  patch({ editor: { form: emptyForm() }, aiDraft: null, historyOpen: false, history: [] }) },
    openEditor: (record) =>{  patch({ editor: { form: formFromRecord(record) }, aiDraft: null, historyOpen: false, history: [] }) },
    closeEditor: () =>{  patch({ editor: null, aiDraft: null, historyOpen: false, history: [], optimizeSource: '', extractSource: '' }) },
    patchForm: (formPatch) => {
      if (state.editor === null) return
      const current = state.editor.form
      const merged = { ...current, ...formPatch }
      const next = typeof formPatch.body === 'string'
        ? applyBody(merged, formPatch.body)
        : merged
      patch({ editor: { form: next } })
    },
    patchVariable: (name, variablePatch) => {
      if (state.editor === null) return
      const variables = state.editor.form.variables.map(variable =>
        variable.name === name ? { ...variable, ...variablePatch } : variable)
      patch({ editor: { form: { ...state.editor.form, variables } } })
    },
    toggleFormTag: (tagId) => {
      if (state.editor === null) return
      const form = state.editor.form
      const tagIds = form.tagIds.includes(tagId)
        ? form.tagIds.filter(candidate => candidate !== tagId)
        : [...form.tagIds, tagId]
      patch({ editor: { form: { ...form, tagIds } } })
    },
    save: () => {
      const editor = state.editor
      if (editor === null || state.saving) return
      const form = editor.form
      if (form.name.trim().length === 0 || form.body.trim().length === 0) {
        patch({ notice: 'save-failed' })
        return
      }
      patch({ saving: true })
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
          })
          patch({ saving: false, editor: { form: formFromRecord(record) }, notice: 'saved' })
          await reload()
        } catch (error) {
          const message = error instanceof Error ? error.message : ''
          patch({ saving: false, notice: /duplicate template name/.test(message) ? 'name-duplicate' : 'save-failed' })
        }
      })()
    },
    toggleArchive: (record) => {
      const status: TemplateStatus = record.status === 'active' ? 'archived' : 'active'
      void (async () => {
        try {
          await gateway.setTemplateStatus(record.id, status)
          patch({ notice: 'archived' })
          await reload()
        } catch {
          patch({ notice: 'save-failed' })
        }
      })()
    },
    remove: (id) => {
      void (async () => {
        try {
          await gateway.deleteTemplate(id)
          if (state.editor?.form.id === id) patch({ editor: null })
          await reload()
        } catch {
          patch({ notice: 'delete-failed' })
        }
      })()
    },
    copyTemplate: (record) => {
      patch({ editor: { form: { ...formFromRecord(record), id: null, name: `${record.name} 副本`, changeNote: '' } } })
    },
    openHistory: (id) => {
      patch({ historyOpen: true, history: [] })
      void (async () => {
        try {
          const read = await gateway.getTemplateHistory(id)
          patch({ history: read.entries })
        } catch {
          patch({ history: [] })
        }
      })()
    },
    closeHistory: () =>{  patch({ historyOpen: false }) },
    restoreVersion: (entry) => {
      const editor = state.editor
      if (editor === null || editor.form.id === null) return
      controller.patchForm({
        body: entry.record.body,
        variables: [...entry.record.variables],
        changeNote: `回滚自 v${String(entry.version)}`,
      })
      patch({ historyOpen: false, notice: 'restored' })
    },

    addTag: (name) => {
      const trimmed = name.trim()
      if (trimmed.length === 0) {
        patch({ notice: 'tag-name-required' })
        return
      }
      const tag: TemplateTag = { id: nextTagId(), name: trimmed }
      void (async () => {
        try {
          await gateway.putTemplateTags([...state.tags, tag])
          await reload()
        } catch {
          patch({ notice: 'tags-failed' })
        }
      })()
    },
    removeTag: (tagId) => {
      void (async () => {
        try {
          await gateway.putTemplateTags(state.tags.filter(tag => tag.id !== tagId))
          await reload()
        } catch {
          patch({ notice: 'tags-failed' })
        }
      })()
    },

    importFile: (file, strategy) => {
      void (async () => {
        try {
          const raw = await file.text()
          const parsed = parseTemplatePack(raw)
          if (parsed.kind === 'invalid') {
            patch({ notice: 'import-invalid' })
            return
          }
          const summary = await gateway.importTemplates(parsed.pack, strategy)
          patch({ importReport: { fileName: file.name, summary } })
          await reload()
        } catch {
          patch({ notice: 'import-failed' })
        }
      })()
    },
    dismissImportReport: () =>{  patch({ importReport: null }) },
    importStarterPack: () => {
      void (async () => {
        try {
          const summary = await gateway.importTemplates(STARTER_TEMPLATE_PACK, 'skip')
          patch({ importReport: { fileName: STARTER_PACK_NAME, summary } })
          await reload()
        } catch {
          patch({ notice: 'import-failed' })
        }
      })()
    },
    exportIds: (ids) => {
      void (async () => {
        try {
          const packDoc = await gateway.exportTemplates(ids)
          const blob = new Blob([`${JSON.stringify(packDoc, null, 2)}\n`], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = `dsh-templates-${new Date().toISOString().slice(0, 10)}.json`
          anchor.click()
          URL.revokeObjectURL(url)
        } catch {
          patch({ notice: 'export-failed' })
        }
      })()
    },

    setGenerateSource: (text) =>{  patch({ generateSource: text }) },
    setGenerateCategory: (category) =>{  patch({ generateCategory: category }) },
    setOptimizeSource: (text) =>{  patch({ optimizeSource: text }) },
    setExtractSource: (text) =>{  patch({ extractSource: text }) },
    runAi: (request) => {
      if (state.aiBusy !== false) return
      const body = request.operation === 'generate'
        ? request.description
        : request.operation === 'optimize' ? request.instruction : request.content
      if (body.trim().length === 0) {
        patch({ notice: 'ai-empty' })
        return
      }
      patch({ aiBusy: request.operation, aiDraft: null })
      void (async () => {
        try {
          const result = await gateway.processTemplateAi(request)
          patch({ aiBusy: false, aiDraft: result })
        } catch {
          patch({ aiBusy: false, notice: 'ai-failed' })
        }
      })()
    },
    adoptAiDraft: () => {
      const draft = state.aiDraft
      if (draft === null) return
      if (draft.operation === 'generate') {
        const reconciled = reconcileVariables(draft.draft.body, draft.draft.variables)
        const form: TemplateForm = {
          ...emptyForm(state.generateCategory),
          name: draft.draft.name,
          description: draft.draft.description,
          body: draft.draft.body,
          variables: [...reconciled.active, ...reconciled.unused],
        }
        patch({ editor: { form }, aiDraft: null })
        return
      }
      if (state.editor === null) return
      const current = state.editor.form
      if (draft.operation === 'optimize') {
        patch({ editor: { form: applyBody(current, draft.draft.body) }, aiDraft: null })
        return
      }
      const proposed = draft.draft.variables.filter(variable => !current.variables.some(candidate => candidate.name === variable.name))
      const reconciled = reconcileVariables(draft.draft.body, [...current.variables, ...proposed])
      patch({
        editor: { form: { ...applyBody(current, draft.draft.body), variables: [...reconciled.active, ...reconciled.unused] } },
        aiDraft: null,
      })
    },
    discardAiDraft: () =>{  patch({ aiDraft: null }) },

    openPicker: (target) =>{  patch({ picker: { target, search: '', selected: null, values: {}, overwriteConfirm: false } }) },
    pickerSearch: (text) => {
      if (state.picker !== null) patch({ picker: { ...state.picker, search: text } })
    },
    pickerSelect: (record) => {
      if (state.picker !== null) patch({ picker: { ...state.picker, selected: record, values: {}, overwriteConfirm: false } })
    },
    pickerValue: (name, value) => {
      if (state.picker !== null) patch({ picker: { ...state.picker, values: { ...state.picker.values, [name]: value } } })
    },
    pickerBack: () => {
      if (state.picker !== null) patch({ picker: { ...state.picker, selected: null, values: {}, overwriteConfirm: false } })
    },
    pickerConfirm: () => {
      const picker = state.picker
      if (picker === null || picker.selected === null) return
      if (picker.target.apply === undefined) return
      if (missingRequired(picker.selected.body, picker.selected.variables, picker.values).length > 0) return
      if (picker.target.hasContent() && !picker.overwriteConfirm) {
        patch({ picker: { ...picker, overwriteConfirm: true } })
        return
      }
      const rendered = renderTemplate(picker.selected.body, picker.values, picker.selected.variables)
      const title = picker.values['title']?.trim() || picker.selected.name
      const tagNames = picker.selected.tagIds
        .map(tagId => state.tags.find(tag => tag.id === tagId)?.name)
        .filter((name): name is string => name !== undefined)
      picker.target.apply({
        title,
        body: rendered.output,
        tags: tagNames,
        values: picker.values,
        template: picker.selected,
      })
      patch({ picker: null })
    },
    pickerCopyBody: () => {
      const picker = state.picker
      if (picker === null || picker.selected === null) return
      const rendered = renderTemplate(picker.selected.body, picker.values, picker.selected.variables)
      void (async () => {
        if (await writeClipboard(rendered.output)) patch({ picker: null })
      })()
    },
    closePicker: () =>{  patch({ picker: null }) },
  }
  return controller
}

/** Observable library state plus every action the two surfaces need. */
export interface TemplateController {
  /** Current state (the useSyncExternalStore snapshot). */
  getState(): TemplateState
  /** Current view preferences (category, tags, status, search). */
  getPrefs(): TemplatePrefs
  /** Subscribe to state changes; returns the unsubscriber. */
  subscribe(listener: () => void): () => void
  /** Reload the library from disk. */
  reload(): void
  /** Patch the view preferences. */
  setFilter(next: Partial<TemplatePrefs>): void
  /** Clear the current notice. */
  dismissNotice(): void

  /** Open a blank editor sheet. */
  openNew(): void
  /** Open the editor over one stored template. */
  openEditor(record: TemplateRecord): void
  /** Close the editor sheet. */
  closeEditor(): void
  /** Patch the form; a body patch re-reconciles the variable metadata. */
  patchForm(formPatch: Partial<TemplateForm>): void
  /** Patch one variable's metadata. */
  patchVariable(name: string, variablePatch: Partial<TemplateVariable>): void
  /** Toggle one tag on the form. */
  toggleFormTag(tagId: TemplateTagId): void
  /** Save the form: one manual save, one history snapshot. */
  save(): void
  /** Archive or restore one template (no snapshot). */
  toggleArchive(record: TemplateRecord): void
  /** Delete one template and its history. */
  remove(id: TemplateId): void
  /** Open the editor over a copy of one stored template. */
  copyTemplate(record: TemplateRecord): void
  /** Load and show one template's history. */
  openHistory(id: TemplateId): void
  /** Close the history drawer. */
  closeHistory(): void
  /** Copy one snapshot's body back into the editor as a pending restore. */
  restoreVersion(entry: TemplateHistoryEntry): void

  /** Add one shared tag. */
  addTag(name: string): void
  /** Remove one shared tag; references are stripped from every template. */
  removeTag(tagId: TemplateTagId): void

  /** Import one pack file with the given conflict strategy. */
  importFile(file: File, strategy: TemplateImportStrategy): void
  /** Clear the import report. */
  dismissImportReport(): void
  /** Import the bundled starter pack; `skip` makes re-imports idempotent. */
  importStarterPack(): void
  /** Download the pack document for the given ids (empty exports all). */
  exportIds(ids: readonly string[]): void

  /** Set the AI generation description. */
  setGenerateSource(text: string): void
  /** Set the AI generation target category. */
  setGenerateCategory(category: TemplateCategory): void
  /** Set the AI optimization instruction. */
  setOptimizeSource(text: string): void
  /** Set the extraction source instance content. */
  setExtractSource(text: string): void
  /** Run one AI operation; the result lands in the draft preview. */
  runAi(request: TemplateAiRequest): void
  /** Apply the AI draft to the editor (opening one for `generate`). */
  adoptAiDraft(): void
  /** Drop the AI draft. */
  discardAiDraft(): void

  /** Open the picker for one host column. */
  openPicker(target: TemplatePickTarget): void
  /** Patch the picker search text. */
  pickerSearch(text: string): void
  /** Select one template to fill. */
  pickerSelect(record: TemplateRecord): void
  /** Set one variable's filled value. */
  pickerValue(name: string, value: string): void
  /** Return from the fill step to the list. */
  pickerBack(): void
  /** Render and hand the body to the host; confirms the overwrite first. */
  pickerConfirm(): void
  /** Copy the rendered body to the clipboard (the no-apply fallback). */
  pickerCopyBody(): void
  /** Close the picker without applying. */
  closePicker(): void
}
