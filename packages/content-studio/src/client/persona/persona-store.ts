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

import type {
  PersonaAccountStage, PersonaAiRequest, PersonaAiResult, PersonaEntry, PersonaFieldKey,
  PersonaId, PersonaInput, PersonaLink, PersonaPlatform, PersonaReport,
} from '@deepseek-ai/dsh-content-outputs/types'
import { PERSONA_FIELD_KEYS, PERSONA_FILL_PROHIBITED } from './model.ts'
import { renderEntryPrompt } from './prompt.ts'
import { adoptField, emptyForm, formFromEntry, inputFromForm, type PersonaForm } from './model.ts'

/** Browser-local storage keys owned by the persona view. */
const SELECTED_KEY = 'dsh-content-studio.persona.selectedId'
const WIZARD_KEY = 'dsh-content-studio.persona.wizard'
const LEGACY_KEY = 'dsh-content-studio.persona'
const LEGACY_DISMISS_KEY = 'dsh-content-studio.persona.legacyDismissed'

/** Draft-buffer format version; unrecognized buffers drop back to a fresh form. */
const WIZARD_VERSION = 1

/** The injected server face: the persona half of the content-outputs Remote. Each AI operation correlates to its own result face. */
export interface PersonaGateway {
  listPersonas: () => Promise<{ personas: readonly PersonaEntry[]; problems: readonly string[] }>
  getPersona: (id: PersonaId) => Promise<{ persona?: PersonaEntry }>
  putPersona: (input: PersonaInput) => Promise<PersonaEntry>
  putPersonaReport: (id: PersonaId, report: PersonaReport) => Promise<PersonaEntry>
  deletePersona: (id: PersonaId) => Promise<void>
  processPersonaAi: <T extends PersonaAiRequest>(request: T) => Promise<Extract<PersonaAiResult, { operation: T['operation'] }>>
}

/** One-step user-facing outcome codes; the copy lives in the locale dictionaries. */
export type PersonaNotice =
  | 'load-failed'
  | 'save-failed'
  | 'delete-failed'
  | 'name-required'
  | 'fill-none'
  | 'ai-failed'
  | 'resume-empty'
  | 'resume-consent'
  | 'report-saved'
  | 'report-failed'
  | 'legacy-done'
  | 'legacy-failed'

/** The wizard's open state: the active step plus the editable form. */
export interface PersonaWizardState {
  readonly step: 1 | 2 | 3 | 4
  readonly form: PersonaForm
}

/** Candidates from one AI fill or résumé extraction, awaiting per-field adoption. */
export interface PersonaFillPreview {
  readonly origin: 'fill' | 'resume'
  readonly promptVersion: string
  readonly fields: Readonly<Partial<Record<PersonaFieldKey, string>>>
}

/** Snapshot the React surface subscribes to. */
export interface PersonaState {
  readonly personas: readonly PersonaEntry[]
  /** Stored records that failed validation, named but not dropped silently. */
  readonly problems: readonly string[]
  readonly loading: boolean
  readonly saving: boolean
  /** The persona the create face injects, or null. */
  readonly selectedId: PersonaId | null
  /** The old free-text persona, until imported or dismissed; null once handled. */
  readonly legacyText: string | null
  readonly wizard: PersonaWizardState | null
  /** The persona whose report panel is open, or null. */
  readonly reportId: PersonaId | null
  readonly aiBusy: false | 'fill' | 'resume' | 'report'
  readonly fillPreview: PersonaFillPreview | null
  readonly notice: PersonaNotice | null
}

/** Injected server face. */
export interface PersonaControllerDeps {
  readonly gateway: PersonaGateway
}

/** Read the persisted creation-side selection; private mode keeps it in memory. */
function readSelected(): PersonaId | null {
  try {
    const raw = localStorage.getItem(SELECTED_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as { version?: number; id?: string | null }
    return parsed.version === WIZARD_VERSION && typeof parsed.id === 'string' ? (parsed.id as PersonaId) : null
  } catch {
    // Unreadable selection: the default (no persona injected) is safe.
    return null
  }
}

function writeSelected(id: PersonaId | null): void {
  try {
    if (id === null) localStorage.removeItem(SELECTED_KEY)
    else localStorage.setItem(SELECTED_KEY, JSON.stringify({ version: WIZARD_VERSION, id }))
  } catch {
    // Private mode: the selection stays in memory for this session only.
  }
}

/** Read the unsaved wizard draft; unrecognized shapes drop to a fresh form. */
function readDraft(): PersonaWizardState | null {
  try {
    const raw = localStorage.getItem(WIZARD_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as { version?: number; step?: number; form?: Partial<PersonaForm> }
    if (parsed.version !== WIZARD_VERSION || typeof parsed.form?.name !== 'string') return null
    const base = emptyForm()
    const step = parsed.step === 2 || parsed.step === 3 || parsed.step === 4 ? parsed.step : 1
    return {
      step,
      form: {
        ...base,
        ...parsed.form,
        fields: { ...base.fields, ...(parsed.form.fields ?? {}) },
      },
    }
  } catch {
    // Unreadable draft: starting fresh loses nothing that reached disk.
    return null
  }
}

function writeDraft(wizard: PersonaWizardState): void {
  try {
    localStorage.setItem(WIZARD_KEY, JSON.stringify({ version: WIZARD_VERSION, step: wizard.step, form: wizard.form }))
  } catch {
    // Private mode: the draft lives in memory until the surface closes.
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(WIZARD_KEY)
  } catch {
    // Nothing to recover: a stale buffer is inert.
  }
}

/** The old free-text persona, or null when absent, empty, or dismissed. */
function readLegacy(): string | null {
  try {
    if (localStorage.getItem(LEGACY_DISMISS_KEY) === '1') return null
    const raw = localStorage.getItem(LEGACY_KEY)
    return raw !== null && raw.trim().length > 0 ? raw : null
  } catch {
    return null
  }
}

/** The persona view controller created by {@link createPersonaController}. */
export type PersonaController = ReturnType<typeof createPersonaController>

/**
 * Create the persona controller. The browser half creates one instance in
 * apply() and injects it into the surface, like the open/close controller.
 * @param deps - the injected server face.
 * @returns the controller with its state and actions.
 */
export function createPersonaController(deps: PersonaControllerDeps): {
  subscribe(listener: () => void): () => void
  getState(): PersonaState
  ensureLoaded(): Promise<void>
  reload(): Promise<void>
  activePrompt(): string
  selectedEntry(): PersonaEntry | null
  select(id: PersonaId | null): void
  openNew(): void
  openEdit(id: PersonaId): void
  openClone(id: PersonaId): void
  closeWizard(): void
  setStep(step: 1 | 2 | 3 | 4): void
  updateForm(patch: Partial<PersonaForm>): void
  setField(key: PersonaFieldKey, value: string): void
  togglePlatform(platform: PersonaPlatform): void
  setAccountStage(stage: PersonaAccountStage): void
  addLink(): void
  updateLink(index: number, patch: Partial<PersonaLink>): void
  removeLink(index: number): void
  runFill(): Promise<void>
  runResume(): Promise<void>
  adoptFillField(key: PersonaFieldKey, value?: string): void
  adoptAllFill(): void
  discardFill(): void
  saveWizard(): Promise<void>
  remove(id: PersonaId): Promise<void>
  openReport(id: PersonaId): void
  closeReport(): void
  generateReport(id: PersonaId): Promise<void>
  saveReportEdit(id: PersonaId, markdown: string): Promise<void>
  importLegacy(name: string): Promise<void>
  dismissLegacy(): void
  dismissNotice(): void
} {
  const listeners = new Set<() => void>()
  let personas: readonly PersonaEntry[] = []
  let problems: readonly string[] = []
  let loading = false
  let loadedOnce = false
  let saving = false
  let selectedId: PersonaId | null = readSelected()
  let legacyText: string | null = readLegacy()
  let wizard: PersonaWizardState | null = null
  let reportId: PersonaId | null = null
  let aiBusy: PersonaState['aiBusy'] = false
  let fillPreview: PersonaFillPreview | null = null
  let notice: PersonaNotice | null = null

  const buildState = (): PersonaState => ({
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
  })
  let snapshot: PersonaState = buildState()
  const emit = (): void => {
    snapshot = buildState()
    for (const listener of listeners) listener()
  }
  const state = (): PersonaState => snapshot

  const setNotice = (value: PersonaNotice | null): void => {
    notice = value
    emit()
  }

  const find = (id: PersonaId): PersonaEntry | undefined => personas.find(entry => entry.id === id)

  const patchWizard = (next: PersonaWizardState): void => {
    wizard = next
    writeDraft(next)
    emit()
  }

  const nonEmptyFields = (form: PersonaForm): Partial<Record<PersonaFieldKey, string>> => {
    const known: Partial<Record<PersonaFieldKey, string>> = {}
    for (const key of PERSONA_FIELD_KEYS) {
      const value = form.fields[key].value.trim()
      if (value.length > 0) known[key] = value
    }
    return known
  }

  /**
   * Run one AI call with the busy flag and the shared failure notice; the
   * caller supplies the success handling.
   */
  const runAi = async (kind: 'fill' | 'resume' | 'report', call: () => Promise<void>, failure: PersonaNotice): Promise<void> => {
    aiBusy = kind
    emit()
    try {
      await call()
    } catch {
      setNotice(failure)
    } finally {
      aiBusy = false
      emit()
    }
  }

  const reload = async (): Promise<void> => {
    loadedOnce = true
    loading = true
    emit()
    try {
      const snapshotRead = await deps.gateway.listPersonas()
      personas = snapshotRead.personas
      problems = snapshotRead.problems
      if (selectedId !== null && !personas.some(entry => entry.id === selectedId)) {
        selectedId = null
        writeSelected(null)
      }
    } catch {
      setNotice('load-failed')
    } finally {
      loading = false
      emit()
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getState: () => state(),

    async ensureLoaded() {
      if (loadedOnce) return
      await reload()
    },

    reload: () => reload(),

    activePrompt() {
      const entry = selectedId === null ? undefined : find(selectedId)
      return entry === undefined ? '' : renderEntryPrompt(entry)
    },

    selectedEntry() {
      return selectedId === null ? null : find(selectedId) ?? null
    },

    select(id) {
      selectedId = id
      writeSelected(id)
      emit()
    },

    openNew() {
      wizard = readDraft() ?? { step: 1, form: emptyForm() }
      emit()
    },

    openEdit(id) {
      const entry = find(id)
      if (entry === undefined) return
      patchWizard({ step: 1, form: formFromEntry(entry) })
    },

    openClone(id) {
      const entry = find(id)
      if (entry === undefined) return
      patchWizard({ step: 1, form: formFromEntry(entry, { clone: true }) })
    },

    closeWizard() {
      wizard = null
      fillPreview = null
      emit()
    },

    setStep(step) {
      if (wizard === null) return
      patchWizard({ ...wizard, step })
    },

    updateForm(patch) {
      if (wizard === null) return
      patchWizard({ ...wizard, form: { ...wizard.form, ...patch } })
    },

    setField(key, value) {
      if (wizard === null) return
      const form = {
        ...wizard.form,
        fields: { ...wizard.form.fields, [key]: { value, source: 'user' as const, aiMeta: null } },
      }
      patchWizard({ ...wizard, form })
    },

    togglePlatform(platform) {
      if (wizard === null) return
      const platforms = wizard.form.platforms.includes(platform)
        ? wizard.form.platforms.filter(candidate => candidate !== platform)
        : [...wizard.form.platforms, platform]
      patchWizard({ ...wizard, form: { ...wizard.form, platforms } })
    },

    setAccountStage(stage) {
      if (wizard === null) return
      patchWizard({ ...wizard, form: { ...wizard.form, accountStage: stage } })
    },

    addLink() {
      if (wizard === null) return
      const link: PersonaLink = { platform: 'xhs', url: '', bio: null, sampleText: null }
      patchWizard({ ...wizard, form: { ...wizard.form, links: [...wizard.form.links, link] } })
    },

    updateLink(index, patch) {
      if (wizard === null) return
      const links = wizard.form.links.map((link, at) => at === index ? { ...link, ...patch } : link)
      patchWizard({ ...wizard, form: { ...wizard.form, links } })
    },

    removeLink(index) {
      if (wizard === null) return
      patchWizard({ ...wizard, form: { ...wizard.form, links: wizard.form.links.filter((_, at) => at !== index) } })
    },

    async runFill() {
      if (wizard === null) return
      const known = nonEmptyFields(wizard.form)
      const blanks = PERSONA_FIELD_KEYS.filter(key => !PERSONA_FILL_PROHIBITED.includes(key) && (known[key] === undefined))
      if (blanks.length === 0) {
        setNotice('fill-none')
        return
      }
      await runAi('fill', async () => {
        const result = await deps.gateway.processPersonaAi({ operation: 'fill', known, blanks })
        if (Object.keys(result.fields).length === 0) {
          setNotice('fill-none')
          return
        }
        fillPreview = { origin: 'fill', promptVersion: result.promptVersion, fields: result.fields }
      }, 'ai-failed')
    },

    async runResume() {
      if (wizard === null) return
      const resumeText = wizard.form.resumeText
      if (resumeText.trim().length === 0) {
        setNotice('resume-empty')
        return
      }
      if (!wizard.form.resumeConsent) {
        setNotice('resume-consent')
        return
      }
      await runAi('resume', async () => {
        const result = await deps.gateway.processPersonaAi({ operation: 'resume', resumeText })
        if (Object.keys(result.fields).length === 0) {
          setNotice('ai-failed')
          return
        }
        fillPreview = { origin: 'resume', promptVersion: result.promptVersion, fields: result.fields }
      }, 'ai-failed')
    },

    adoptFillField(key, value) {
      if (wizard === null || fillPreview === null) return
      const text = value ?? fillPreview.fields[key]
      if (text === undefined || text.length === 0) return
      const form = adoptField(wizard.form, key, text, fillPreview.promptVersion)
      const { [key]: _consumed, ...fields } = fillPreview.fields
      fillPreview = Object.keys(fields).length > 0 ? { ...fillPreview, fields } : null
      patchWizard({ ...wizard, form })
    },

    adoptAllFill() {
      if (wizard === null || fillPreview === null) return
      let form = wizard.form
      for (const [key, value] of Object.entries(fillPreview.fields)) {
        form = adoptField(form, key as PersonaFieldKey, value, fillPreview.promptVersion)
      }
      fillPreview = null
      patchWizard({ ...wizard, form })
    },

    discardFill() {
      fillPreview = null
      emit()
    },

    async saveWizard() {
      if (wizard === null) return
      if (wizard.form.name.trim().length === 0) {
        setNotice('name-required')
        return
      }
      saving = true
      emit()
      try {
        await deps.gateway.putPersona(inputFromForm(wizard.form))
        clearDraft()
        wizard = null
        fillPreview = null
        await reload()
      } catch {
        setNotice('save-failed')
      } finally {
        saving = false
        emit()
      }
    },

    async remove(id) {
      try {
        await deps.gateway.deletePersona(id)
        if (selectedId === id) {
          selectedId = null
          writeSelected(null)
        }
        await reload()
      } catch {
        setNotice('delete-failed')
      }
    },

    openReport(id) {
      reportId = id
      emit()
    },

    closeReport() {
      reportId = null
      emit()
    },

    async generateReport(id) {
      const entry = find(id)
      if (entry === undefined) return
      await runAi('report', async () => {
        const result = await deps.gateway.processPersonaAi({ operation: 'report', facts: entry })
        await deps.gateway.putPersonaReport(id, {
          markdown: result.markdown,
          sourceRevision: entry.revision,
          editedByUser: false,
          generatedAt: new Date().toISOString(),
          promptVersion: result.promptVersion,
        })
        setNotice('report-saved')
        await reload()
      }, 'report-failed')
    },

    async saveReportEdit(id, markdown) {
      const entry = find(id)
      const text = markdown.trim()
      if (entry === undefined || entry.report === null || text.length === 0) return
      try {
        await deps.gateway.putPersonaReport(id, { ...entry.report, markdown: text, editedByUser: true })
        setNotice('report-saved')
        await reload()
      } catch {
        setNotice('report-failed')
      }
    },

    async importLegacy(name) {
      const text = legacyText
      if (text === null) return
      const form = emptyForm()
      form.name = name
      form.customText = text
      try {
        await deps.gateway.putPersona(inputFromForm(form))
        try {
          localStorage.removeItem(LEGACY_KEY)
        } catch {
          // Removal is best effort: the banner clears for this session either way.
        }
        legacyText = null
        setNotice('legacy-done')
        await reload()
      } catch {
        setNotice('legacy-failed')
      }
    },

    dismissLegacy() {
      try {
        localStorage.setItem(LEGACY_DISMISS_KEY, '1')
      } catch {
        // Private mode: dismissal holds for this session only.
      }
      legacyText = null
      emit()
    },

    dismissNotice() {
      setNotice(null)
    },
  }
}
