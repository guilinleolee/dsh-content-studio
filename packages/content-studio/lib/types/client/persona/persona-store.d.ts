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
import type { PersonaAccountStage, PersonaAiRequest, PersonaAiResult, PersonaEntry, PersonaFieldKey, PersonaId, PersonaInput, PersonaLink, PersonaPlatform, PersonaReport } from '@deepseek-ai/dsh-content-outputs/types';
import { type PersonaForm } from './model.ts';
/** The injected server face: the persona half of the content-outputs Remote. Each AI operation correlates to its own result face. */
export interface PersonaGateway {
    listPersonas: () => Promise<{
        personas: readonly PersonaEntry[];
        problems: readonly string[];
    }>;
    getPersona: (id: PersonaId) => Promise<{
        persona?: PersonaEntry;
    }>;
    putPersona: (input: PersonaInput) => Promise<PersonaEntry>;
    putPersonaReport: (id: PersonaId, report: PersonaReport) => Promise<PersonaEntry>;
    deletePersona: (id: PersonaId) => Promise<void>;
    processPersonaAi: <T extends PersonaAiRequest>(request: T) => Promise<Extract<PersonaAiResult, {
        operation: T['operation'];
    }>>;
}
/** One-step user-facing outcome codes; the copy lives in the locale dictionaries. */
export type PersonaNotice = 'load-failed' | 'save-failed' | 'delete-failed' | 'name-required' | 'fill-none' | 'ai-failed' | 'resume-empty' | 'resume-consent' | 'report-saved' | 'report-failed' | 'legacy-done' | 'legacy-failed';
/** The wizard's open state: the active step plus the editable form. */
export interface PersonaWizardState {
    readonly step: 1 | 2 | 3 | 4;
    readonly form: PersonaForm;
}
/** Candidates from one AI fill or résumé extraction, awaiting per-field adoption. */
export interface PersonaFillPreview {
    readonly origin: 'fill' | 'resume';
    readonly promptVersion: string;
    readonly fields: Readonly<Partial<Record<PersonaFieldKey, string>>>;
}
/** Snapshot the React surface subscribes to. */
export interface PersonaState {
    readonly personas: readonly PersonaEntry[];
    /** Stored records that failed validation, named but not dropped silently. */
    readonly problems: readonly string[];
    readonly loading: boolean;
    readonly saving: boolean;
    /** The persona the create face injects, or null. */
    readonly selectedId: PersonaId | null;
    /** The old free-text persona, until imported or dismissed; null once handled. */
    readonly legacyText: string | null;
    readonly wizard: PersonaWizardState | null;
    /** The persona whose report panel is open, or null. */
    readonly reportId: PersonaId | null;
    readonly aiBusy: false | 'fill' | 'resume' | 'report';
    readonly fillPreview: PersonaFillPreview | null;
    readonly notice: PersonaNotice | null;
}
/** Injected server face. */
export interface PersonaControllerDeps {
    readonly gateway: PersonaGateway;
}
/** The persona view controller created by {@link createPersonaController}. */
export type PersonaController = ReturnType<typeof createPersonaController>;
/**
 * Create the persona controller. The browser half creates one instance in
 * apply() and injects it into the surface, like the open/close controller.
 * @param deps - the injected server face.
 * @returns the controller with its state and actions.
 */
export declare function createPersonaController(deps: PersonaControllerDeps): {
    subscribe(listener: () => void): () => void;
    getState(): PersonaState;
    ensureLoaded(): Promise<void>;
    reload(): Promise<void>;
    activePrompt(): string;
    selectedEntry(): PersonaEntry | null;
    select(id: PersonaId | null): void;
    openNew(): void;
    openEdit(id: PersonaId): void;
    openClone(id: PersonaId): void;
    closeWizard(): void;
    setStep(step: 1 | 2 | 3 | 4): void;
    updateForm(patch: Partial<PersonaForm>): void;
    setField(key: PersonaFieldKey, value: string): void;
    togglePlatform(platform: PersonaPlatform): void;
    setAccountStage(stage: PersonaAccountStage): void;
    addLink(): void;
    updateLink(index: number, patch: Partial<PersonaLink>): void;
    removeLink(index: number): void;
    runFill(): Promise<void>;
    runResume(): Promise<void>;
    adoptFillField(key: PersonaFieldKey, value?: string): void;
    adoptAllFill(): void;
    discardFill(): void;
    saveWizard(): Promise<void>;
    remove(id: PersonaId): Promise<void>;
    openReport(id: PersonaId): void;
    closeReport(): void;
    generateReport(id: PersonaId): Promise<void>;
    saveReportEdit(id: PersonaId, markdown: string): Promise<void>;
    importLegacy(name: string): Promise<void>;
    dismissLegacy(): void;
    dismissNotice(): void;
};
//# sourceMappingURL=persona-store.d.ts.map