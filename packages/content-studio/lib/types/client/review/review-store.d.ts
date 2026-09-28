/**
 * The review view controller: one observable state object over the
 * `_review.json` manifest (via the content-outputs review faces), the
 * two-step import flow (parse preview → confirmed commit), the explicit AI
 * calls (single-work diagnosis, period report with its data-only fallback),
 * the reflow into the topic bank, and the session-scoped filter/diagnosis
 * buffers. Persistent business data (baselines, bindings, snapshots, tasks)
 * lives in the manifest; only filters and in-progress diagnosis ride the
 * browser session.
 */
import type { MetricSnapshot, ReviewAiResult, ReviewAnalyzeWorkRequest, ReviewImportCommitRequest, ReviewImportCommitResult, ReviewImportPreview, ReviewImportPreviewRequest, ReviewGenerateReportRequest, ReviewManifest, ReviewManifestRead, ReviewReportRead, ReviewTaskDeleteRequest, ReviewWorkFilter } from '@deepseek-ai/dsh-content-outputs/types';
import type { TopicItemInput } from '@deepseek-ai/dsh-content-topics/types';
import { aggregateSummary, type WorkVerdict } from './model.ts';
/** The injected server face: the review half of the content-outputs Remote. */
export interface ReviewGateway {
    readReviewManifest: (theme: string) => Promise<ReviewManifestRead>;
    writeReviewManifest: (theme: string, manifest: ReviewManifest) => Promise<void>;
    parseReviewImport: (request: ReviewImportPreviewRequest) => Promise<ReviewImportPreview>;
    commitReviewImport: (request: ReviewImportCommitRequest) => Promise<ReviewImportCommitResult>;
    deleteReviewTask: (request: ReviewTaskDeleteRequest) => Promise<void>;
    writeReviewReport: (theme: string, file: string, content: string) => Promise<{
        file: string;
    }>;
    readReviewReport: (theme: string, file: string) => Promise<ReviewReportRead>;
    writeReviewTemplate: (theme: string, file: string, content: string) => Promise<{
        file: string;
    }>;
    listReviewTemplates: (theme: string) => Promise<{
        files: readonly string[];
    }>;
    analyzeReviewWork: (request: ReviewAnalyzeWorkRequest) => Promise<ReviewAiResult>;
    generateReviewReport: (request: ReviewGenerateReportRequest) => Promise<ReviewAiResult>;
}
/** One-step user-facing outcome codes; the copy lives in the locale dictionaries. */
export type ReviewNotice = 'load-failed' | 'import-parsed' | 'import-committed' | 'import-failed' | 'bind-failed' | 'baselines-saved' | 'baselines-failed' | 'report-ready' | 'report-degraded' | 'report-failed' | 'report-saved' | 'save-failed' | 'task-deleted' | 'delete-failed' | 'template-saved' | 'diagnose-failed' | 'topic-added' | 'topic-failed' | 'need-theme';
/** The session filter set the view restores per open. */
export interface ReviewFilterSession {
    readonly version: 1;
    readonly platforms: readonly string[];
    readonly contentTypes: readonly string[];
    readonly workFilter: ReviewWorkFilter;
    readonly period: {
        from: string;
        to: string;
    };
}
/** The latest per-work judgment the UI renders. */
export interface WorkCard {
    readonly snapshot: MetricSnapshot;
    readonly verdict: WorkVerdict;
    readonly longtail: boolean;
}
/** Snapshot the React surface subscribes to. */
export interface ReviewState {
    readonly theme: string | null;
    readonly manifest: ReviewManifest | null;
    /** Stored entries that failed validation, named but not dropped silently. */
    readonly problems: readonly string[];
    readonly loading: boolean;
    /** Any in-flight import, AI, or reflow call. */
    readonly busy: boolean;
    readonly notice: ReviewNotice | null;
    /** The staged import preview awaiting user confirmation. */
    readonly preview: ReviewImportPreview | null;
    /** Unknown columns the user checked to ignore, for the staged file. */
    readonly ignoredColumns: readonly string[];
    /** The report markdown being edited inline; null when not editing. */
    readonly reportDraft: string | null;
    readonly editingTaskId: string | null;
    /** Saved viral-template file names from disk. */
    readonly templates: readonly string[];
    /** Session diagnosis results keyed by `platform:workId`. */
    readonly diagnoses: Readonly<Record<string, string>>;
    /** Bumped on every filter change so subscribers recompute the pool. */
    readonly filtersRevision: number;
}
/** The topics face the reflow rides; structural so tests can stub it. */
export interface ReviewTopicsFace {
    put: (input: TopicItemInput) => Promise<unknown>;
}
/** The controller the view consumes. */
export interface ReviewController {
    /** Current state snapshot (the useSyncExternalStore read). */
    getState(): ReviewState;
    /** Subscribe to state changes; returns the unsubscriber. */
    subscribe(listener: () => void): () => void;
    /** Load one theme's manifest (and its saved templates). */
    load(theme: string): Promise<void>;
    /** Set the staged file's unknown columns the user chose to ignore. */
    setIgnoredColumns(columns: readonly string[]): void;
    /** Parse one file into the staged preview (no storage). */
    stageImport(platformId: ReviewImportPreviewRequest['platformId'], fileName: string, text: string): Promise<void>;
    /** Commit the staged preview's rows as snapshots. */
    commitImport(): Promise<void>;
    /** Drop the staged preview. */
    discardImport(): void;
    /** Bind one unbound snapshot to a creation content id (manual match). */
    bindWork(platformWorkId: string, platformId: string, contentId: string): Promise<void>;
    /** Persist the baselines as user-sourced. */
    saveBaselines(engagementRate: number, collectRate: number): Promise<void>;
    /** The active filter set. */
    filters(): ReviewFilterSession;
    /** Patch the filter set (persisted to the session storage). */
    setFilters(patch: Partial<Omit<ReviewFilterSession, 'version'>>): void;
    /** The filtered analysis pool with per-work verdicts. */
    pool(): WorkCard[];
    /** The period aggregation over the current pool. */
    summary(): ReturnType<typeof aggregateSummary>;
    /** Create one review task and generate its report (AI with the data-only fallback). */
    createTask(name: string): Promise<void>;
    /** Read one task's report into the inline editor. */
    editReport(taskId: string): Promise<void>;
    /** Save the edited report as a new file version. */
    saveReport(): Promise<void>;
    /** Stop editing without saving. */
    closeReport(): void;
    /** Place content into the inline editor without switching tasks. */
    copyReportToEditor(content: string): void;
    /** Remove one task (report file goes, snapshots stay). */
    deleteTask(taskId: string): Promise<void>;
    /** Save one report as a viral template. */
    saveTemplate(fileName: string, content: string): Promise<void>;
    /** Diagnose one work (explicit AI call; the result stays for the session). */
    diagnoseWork(card: WorkCard, draftText: string | null, tags: readonly string[], personaDigest: string | null): Promise<void>;
    /** Push one topic suggestion into the topic bank. */
    pushToTopicBank(title: string, oneLiner: string | null, description: string | null): Promise<void>;
    /** Clear the current notice. */
    clearNotice(): void;
}
/**
 * Create the review controller over the wired gateway and topic face.
 * @param gateway - the review half of the content-outputs Remote.
 * @param topics - the topic-bank write face for the reflow.
 * @returns the controller.
 */
export declare function createReviewController(gateway: ReviewGateway, topics: ReviewTopicsFace): ReviewController;
//# sourceMappingURL=review-store.d.ts.map