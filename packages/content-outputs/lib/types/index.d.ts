/**
 * Content-outputs Remote: the read-only projection of the outputs library
 * plus the gather and competitor write faces — the single authorized write
 * path for the Content Studio information-gathering and benchmark-account
 * views (asset and manifest storage under `outputs/<theme>/assets/`, and AI
 * processing). The projection stays exactly as it was: `list` scans the
 * library from disk on every call.
 */
import type { Context } from '@deepseek-ai/cordis';
import type Schema from '@deepseek-ai/schemastery';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { CompetitorAnalyzeWorkRequest, CompetitorAnalyzeWorkResult, CompetitorManifest, CompetitorManifestRead, CompetitorReportRequest, CompetitorReportResult, ContentOutputsSnapshot, CreateAiResult, CreateAssetList, CreateEvaluateRequest, CreateEvaluation, CreateGenerateRequest, CreateManifest, CreatePublishRequest, CreatePublishResult, CreateRegisterRequest, CreateRewriteRequest, CreateStateRead, CreateTemplateInput, CreateTemplateList, GatherAiRequest, GatherAiResult, GatherAssetMove, GatherAssetWrite, GatherFeedRequest, GatherFeedResult, GatherManifest, GatherManifestRead, OutputMetadata, PersonaAiRequest, PersonaAiResult, PersonaEntry, PersonaInput, PersonasSnapshot, PersonaId, PersonaReport } from './types.ts';
import { type GatherAiConfig } from './gather/ai.ts';
import { type CreateQuotaConfig } from './create/quota.ts';
export type * from './types.ts';
export { METADATA_FILENAME, ASSETS_DIRNAME, scanOutputs, scanProject } from './scan.ts';
export { parseGatherAiOutput, GATHER_AI_TIMEOUT_CODE } from './gather/ai.ts';
export { GATHER_MANIFEST_FILENAME, GATHER_QUOTA_PER_SOURCE, GATHER_MAX_BODY_CHARS } from './gather/store.ts';
export { parseCompetitorAnalysisOutput, parseCompetitorReportOutput, COMPETITOR_AI_TIMEOUT_CODE } from './competitor/ai.ts';
export { COMPETITOR_MANIFEST_FILENAME } from './competitor/store.ts';
export { CREATE_MANIFEST_FILENAME, CREATE_MAX_STORED_VERSIONS, parseCreateManifest, assertCreateManifest, collectCreateReferencedFiles, } from './create/store.ts';
export { CREATE_AI_TIMEOUT_CODE, CREATE_PROMPT_VERSION } from './create/ai.ts';
export { CREATE_QUOTA_FILENAME, CreateQuotaError, normalizeQuotaState, localDayKey, resolveQuotaConfig, } from './create/quota.ts';
export { CREATE_TEMPLATES_FILENAME, CREATE_TEMPLATE_PLACEHOLDERS, assertTemplateBody, } from './create/store.ts';
export { PERSONAS_FILENAME, personaDigest, parsePersonasManifest } from './persona/store.ts';
export { buildFactsText, parsePersonaFieldsOutput, parsePersonaReportOutput, PERSONA_AI_TIMEOUT_CODE, PERSONA_FILL_PROMPT_VERSION, PERSONA_REPORT_PROMPT_VERSION, PERSONA_RESUME_PROMPT_VERSION, } from './persona/ai.ts';
/** Content-outputs Remote configuration. */
export interface Config extends GatherAiConfig, CreateQuotaConfig {
    /** Outputs library root. Defaults to `<dsh home>/outputs`. */
    root?: string;
}
export declare const Config: Schema<Config>;
/**
 * Remote gateway over the outputs library: the read-only `list` projection,
 * the gather write face (`fetchFeed`, asset and manifest storage, AI
 * processing), the competitor write face (manifest storage, asset reads,
 * teardown and report AI), the create workbench face, and the persona face
 * (the `_personas.json` account-persona manifest and persona AI). AI calls
 * inject the shared `llm` service; everything else is filesystem-local.
 */
export declare class ContentOutputsGateway extends TypertRemoteService {
    static inject: string[];
    static Config: Schema<Config>;
    /** Absolute library root; a missing directory scans as an empty library. */
    private readonly root;
    /** Queued AI processor behind the gather view's explicit processing button. */
    private readonly ai;
    /** Queued AI processor behind the competitors view's explicit buttons. */
    private readonly competitorAi;
    /** Queued AI processor behind the create workbench's generate/rewrite buttons. */
    private readonly createAi;
    /** Queued AI processor behind the persona view's explicit buttons. */
    private readonly personaAi;
    /** Freemium gate over the create AI faces. */
    private readonly createQuota;
    constructor(ctx: Context, config: Config);
    /**
     * Read the library root directly on every call: the library is the agent's
     * write surface, so a cache would only add a second truth to synchronize.
     * @returns Current projects in topic order, with every unreadable
     * directory named in `problems`.
     */
    list(): Promise<ContentOutputsSnapshot>;
    /**
     * Fetch and parse one feed document with the source's conditional-request
     * cursors. Network reading only: nothing is persisted, and the fetch
     * happens here — never in the browser, whose cross-origin feeds would be
     * blocked by CORS anyway.
     * @param request - feed URL plus the stored ETag / Last-Modified cursors.
     * @param signal - caller cancellation.
     * @returns item drafts plus the cursors to store for the next run.
     */
    fetchFeed(request: GatherFeedRequest, signal?: AbortSignal): Promise<GatherFeedResult>;
    /**
     * Write one file inside the theme's `assets/` directory. `*.html` content
     * is sanitized through the allowlist and truncated to the body cap before
     * it reaches disk; the replacement is atomic and serialized per file.
     * @param write - theme, plain file name, and complete content.
     * @returns whether the stored snapshot was truncated.
     */
    writeAsset(write: GatherAssetWrite): Promise<{
        truncated: boolean;
    }>;
    /**
     * Read the theme's `_gather.json` manifest.
     * @param theme - outputs-project directory name.
     * @returns the manifest with only valid entries, every dropped one named
     * in `problems`; callers must not write back while `problems` is non-empty.
     */
    readGatherManifest(theme: string): Promise<GatherManifestRead>;
    /**
     * Replace the theme's `_gather.json` manifest with an atomic, locked
     * commit. The stored manifest is quota-trimmed: per source the newest
     * `unread`/`read` entries up to the quota survive, `favorite`/`picked`
     * entries and their snapshots are never removed.
     * @param theme - outputs-project directory name.
     * @param manifest - the complete next manifest.
     * @returns the stored (trimmed) manifest.
     */
    writeGatherManifest(theme: string, manifest: GatherManifest): Promise<GatherManifest>;
    /**
     * Rename or relocate one file between two themes' `assets/` directories:
     * a within-theme rename for renaming, the cross-theme form for rebinding
     * one material to another theme.
     * @param move - source theme/name and destination theme/name.
     */
    moveAsset(move: GatherAssetMove): Promise<void>;
    /**
     * Delete one file from the theme's `assets/` directory; absent files are
     * a no-op.
     * @param theme - outputs-project directory name.
     * @param file - plain file name inside `assets/`.
     */
    deleteAsset(theme: string, file: string): Promise<void>;
    /**
     * Process one material through the model: summary, key points, topic
     * score, and tags. Explicit per call, queued one at a time, rate limits
     * retried with backoff; nothing is persisted here.
     * @param request - the material's display facts plus its snapshot reference.
     * @returns the structured result for the caller to write back.
     */
    processMaterial(request: GatherAiRequest): Promise<GatherAiResult>;
    /**
     * Read the theme's `_competitors.json` manifest.
     * @param theme - outputs-project directory name.
     * @returns the manifest with only valid entries, every dropped one named
     *   in `problems`; callers must not write back while `problems` is
     *   non-empty.
     */
    readCompetitorManifest(theme: string): Promise<CompetitorManifestRead>;
    /**
     * Replace the theme's `_competitors.json` manifest with an atomic, locked
     * commit. No trimming runs: works carry user markers and append-only
     * snapshots, so the caller's list is stored verbatim after validation.
     * @param theme - outputs-project directory name.
     * @param manifest - the complete next manifest.
     */
    writeCompetitorManifest(theme: string, manifest: CompetitorManifest): Promise<void>;
    /**
     * Read one asset file as text for the work side preview. Read-only and
     * path-guarded like every other asset access.
     * @param theme - outputs-project directory name.
     * @param file - plain file name inside `assets/`.
     * @returns the file content, or an empty record when absent.
     */
    readAsset(theme: string, file: string): Promise<{
        content?: string;
    }>;
    /**
     * Tear one benchmark work down through the model: hook, structure, pain
     * points, risks, reusable patterns, and differentiated topic suggestions.
     * Explicit per call, queued one at a time, rate limits retried with
     * backoff; nothing is persisted here.
     * @param request - the work's display facts, snapshot reference, and any
     *   user-pasted hot comments.
     * @returns the structured result plus the full markdown teardown.
     */
    analyzeCompetitorWork(request: CompetitorAnalyzeWorkRequest): Promise<CompetitorAnalyzeWorkResult>;
    /**
     * Generate one benchmark report through the model: a single-account
     * panorama or a two-account face-off, from aggregated digests only.
     * Explicit per call, queued one at a time, rate limits retried with
     * backoff; nothing is persisted here.
     * @param request - report kind plus one or two account digests.
     * @returns the markdown report for the caller to store as an asset file.
     */
    generateCompetitorReport(request: CompetitorReportRequest): Promise<CompetitorReportResult>;
    /**
     * Read the theme's creation state: the validated `_create.json` manifest
     * plus the current draft body. A malformed manifest reads as empty with
     * the rejection named, so the editor can warn instead of overwriting it.
     * @param theme - outputs-project directory name.
     * @returns the manifest (or null) and the draft body (or null).
     */
    readCreateState(theme: string): Promise<CreateStateRead>;
    /**
     * Replace the theme's `_create.json` manifest with an atomic, locked
     * commit. The caller owns version pruning and ordering; this face only
     * validates the format.
     * @param theme - outputs-project directory name.
     * @param manifest - the complete next manifest.
     */
    writeCreateState(theme: string, manifest: CreateManifest): Promise<void>;
    /**
     * Publish one deliverable: copy the given content to the theme root. A
     * name collision rejects unless `overwrite` is set — the caller confirms
     * with the user first. Registration into `.dsh-output.json` is the
     * separate {@link registerCreatePublish} step.
     * @param theme - outputs-project directory name.
     * @param request - file name, complete content, and the overwrite decision.
     * @returns the stored root file name.
     */
    publishCreateFinal(theme: string, request: CreatePublishRequest): Promise<CreatePublishResult>;
    /**
     * Register one publish into the theme's metadata: flip the status to
     * `published` and mirror the version bookkeeping. The retry half of the
     * handoff — the deliverable must already sit at the theme root.
     * @param theme - outputs-project directory name.
     * @param request - the root file name and the published version.
     */
    registerCreatePublish(theme: string, request: CreateRegisterRequest): Promise<void>;
    /**
     * Read the theme's `.dsh-output.json` for the merge-before-write the
     * metadata face does. A malformed file reads as null with the violation
     * named, so the editor warns instead of silently overwriting it.
     * @param theme - outputs-project directory name.
     * @returns the metadata, or null with the problem when malformed.
     */
    readCreateMetadata(theme: string): Promise<{
        metadata: OutputMetadata | null;
        problem: string | null;
    }>;
    /**
     * Write the theme's `.dsh-output.json` — theme initialization and any
     * later bookkeeping merge go through here, validated against the format-0
     * rules before the atomic commit.
     * @param theme - outputs-project directory name.
     * @param metadata - the complete next metadata.
     */
    writeCreateMetadata(theme: string, metadata: OutputMetadata): Promise<void>;
    /**
     * List the theme's non-system asset file names, sorted. Serves the image
     * inserter; system files never appear.
     * @param theme - outputs-project directory name.
     * @returns the sorted plain file names.
     */
    listCreateAssets(theme: string): Promise<CreateAssetList>;
    /**
     * Generate one draft through the model under the selected built-in
     * template. Explicit per call, queued one at a time, rate limits retried
     * with backoff; nothing is persisted here. Charges the daily generation
     * budget per variant; `count: 3` additionally requires the paid tier.
     * @param request - the creation context, content type, and variant count.
     * @returns the draft text, the split variants when batched, and provenance.
     */
    generateCreateContent(request: CreateGenerateRequest): Promise<CreateAiResult>;
    /**
     * Rewrite one selection through the model (condense, expand, style switch,
     * perspective switch, extract, humanize light/deep, or title batch).
     * Explicit per call, queued one at a time, rate limits retried with
     * backoff; nothing is persisted here. Charges the daily rewrite budget.
     * @param request - the operation and the selection text.
     * @returns the rewritten text with its provenance.
     */
    rewriteCreateSelection(request: CreateRewriteRequest): Promise<CreateAiResult>;
    /**
     * Evaluate one draft through the model: four rubric dimensions plus an
     * overall advisory grade. Explicit per call, queued one at a time,
     * rate limits retried with backoff; nothing is persisted here. A
     * paid-tier feature — the advisory result never blocks anything.
     * @param request - the content type, title, and draft text.
     * @returns the structured evaluation with its provenance.
     */
    /**
     * List the global custom templates. A malformed bank reads as empty with
     * the rejection named, so the manager can warn before overwriting.
     * @returns the valid templates plus every rejection.
     */
    listCreateTemplates(): Promise<CreateTemplateList>;
    /**
     * Upsert one custom template: absent id creates, present id updates and
     * bumps the revision. The body re-validates against the placeholder
     * whitelist here, and again at every generation that uses it.
     * @param input - the template facts; id, revision, and timestamps are store-managed.
     * @returns the stored templates.
     */
    putCreateTemplate(input: CreateTemplateInput): Promise<CreateTemplateList>;
    /**
     * Delete one custom template; an unknown id is a no-op.
     * @param id - the template id.
     * @returns the stored templates.
     */
    deleteCreateTemplate(id: string): Promise<CreateTemplateList>;
    evaluateCreateContent(request: CreateEvaluateRequest): Promise<CreateEvaluation>;
    /**
     * List every account persona from the library root's `_personas.json`.
     * @returns the entries newest-first, with every dropped stored record named
     *   in `problems`.
     */
    listPersonas(): Promise<PersonasSnapshot>;
    /**
     * Read one account persona by id.
     * @param id - the persona id.
     * @returns the stored entry, or an empty record when absent.
     */
    getPersona(id: PersonaId): Promise<{
        persona?: PersonaEntry;
    }>;
    /**
     * Upsert one persona: the revision increments, the digest recomputes from
     * the stored content, and the timestamps are gateway-owned. Report edits
     * never ride this face — it is the form save, and the report staleness
     * banner tracks form revisions only.
     * @param input - the upsert payload from the browser.
     * @returns the stored entry.
     */
    putPersona(input: PersonaInput): Promise<PersonaEntry>;
    /**
     * Replace one persona's report without touching its form state: revision
     * and digest stay, so editing the report text never marks the report stale.
     * @param id - the persona to update; unknown ids reject.
     * @param report - the complete next report.
     * @returns the stored entry.
     */
    putPersonaReport(id: PersonaId, report: PersonaReport): Promise<PersonaEntry>;
    /**
     * Remove one persona; the embedded report goes with it and no file is left
     * to dangle. Removing an unknown id is a no-op.
     * @param id - the persona id.
     */
    deletePersona(id: PersonaId): Promise<void>;
    /**
     * Run one persona AI operation (blank-field fill, résumé extraction, or
     * report generation). Explicit per call, queued one at a time, rate limits
     * retried with backoff; nothing is persisted here — the caller previews
     * the result and writes adopted values back through the persona faces.
     * @param request - the operation and its input.
     * @returns the candidate fields or report, with the prompt version for
     *   provenance stamping.
     */
    processPersonaAi(request: PersonaAiRequest): Promise<PersonaAiResult>;
}
export default ContentOutputsGateway;
//# sourceMappingURL=index.d.ts.map