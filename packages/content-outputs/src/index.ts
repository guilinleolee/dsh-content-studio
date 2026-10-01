/**
 * Content-outputs Remote: the read-only projection of the outputs library
 * plus the gather and competitor write faces — the single authorized write
 * path for the Content Studio information-gathering and benchmark-account
 * views (asset and manifest storage under `outputs/<theme>/assets/`, and AI
 * processing). The projection stays exactly as it was: `list` scans the
 * library from disk on every call.
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { join } from 'node:path'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type {
  CompetitorAnalyzeWorkRequest, CompetitorAnalyzeWorkResult, CompetitorManifest,
  CompetitorManifestRead, CompetitorReportRequest, CompetitorReportResult,
  ContentOutputsSnapshot, CreateAiResult, CreateAssetList, CreateEvaluateRequest,
  CreateEvaluation, CreateGenerateRequest, CreateManifest, CreatePublishRequest,
  CreatePublishResult, CreateRegisterRequest, CreateRewriteRequest, CreateStateRead,
  CreateTemplateInput, CreateTemplateList,
  GatherAiRequest, GatherAiResult, GatherAssetMove, GatherAssetWrite, GatherFeedRequest,
  GatherFeedResult, GatherManifest, GatherManifestRead, OutputMetadata,
  InteractionClassifyRequest, InteractionClassifyResult, InteractionImportCommitRequest,
  InteractionImportCommitResult, InteractionImportPreview, InteractionImportPreviewRequest,
  InteractionInsightRequest, InteractionInsightResult, InteractionReplyRequest,
  InteractionReplyResult, InteractionSendReplyRequest, InteractionsManifest,
  InteractionsManifestRead, PersonaAiRequest,
  PersonaAiResult, PersonaEntry, PersonaInput, PersonasSnapshot, PersonaId, PersonaReport,
  PublishAdaptRequest, PublishAdaptResult, PublishIndexRead, PublishManifest, PublishManifestRead,
  PublishPackage, PublishProfilesRead, PublishProfilesDoc,
  ReviewAiResult, ReviewAnalyzeWorkRequest, ReviewGenerateReportRequest, ReviewImportCommitRequest,
  ReviewImportCommitResult, ReviewImportPreview, ReviewImportPreviewRequest, ReviewIndexRead,
  ReviewManifest, ReviewManifestRead, ReviewReportRead, ReviewTaskDeleteRequest, TemplateAiRequest,
  TemplateAiResult, TemplateHistoryRead, TemplateId, TemplateImportStrategy,
  TemplateImportSummary, TemplateInput, TemplatePack, TemplateRecord, TemplatesSnapshot,
  TemplateStatus, TemplateTag,
} from './types.ts'
import { scanOutputs } from './scan.ts'
import { fetchFeedDocument } from './gather/feed.ts'
import {
  deleteAssetFile, moveAssetFile, readAssetText, readGatherManifestFile,
  sweepOrphanTempFiles, writeAssetFile, writeGatherManifestFile,
} from './gather/store.ts'
import { GatherAiProcessor, type GatherAiConfig, resolveAiConfig } from './gather/ai.ts'
import {
  readCompetitorManifestFile, writeCompetitorManifestFile,
} from './competitor/store.ts'
import { CompetitorAiProcessor } from './competitor/ai.ts'
import {
  collectCreateReferencedFiles, deleteCreateTemplateFile, listAssetFiles, publishFinalFile,
  putCreateTemplateFile, readCreateStateFile, readCreateMetadataFile, readCreateTemplatesFile,
  registerCreatePublishFile, writeCreateStateFile, writeOutputMetadataFile,
} from './create/store.ts'
import { CreateAiProcessor } from './create/ai.ts'
import { CreateQuotaGate, type CreateQuotaConfig } from './create/quota.ts'
import {
  PERSONAS_FILENAME, deletePersonaFile, putPersonaFile, putPersonaReportFile, readPersonasFile,
} from './persona/store.ts'
import { PersonaAiProcessor } from './persona/ai.ts'
import {
  buildPublishPackageFile, readPublishDerivedFile, readPublishIndexFile,
  readPublishManifestFile, readPublishProfilesFile, readPublishSourceFile, writePublishDerivedFile,
  writePublishManifestFile, writePublishProfilesFile,
} from './publish/store.ts'
import { PublishAiProcessor } from './publish/ai.ts'
import {
  deleteTemplateFile, exportTemplatePack, importTemplatePack, putTemplateFile,
  putTemplateTagsFile, readTemplateHistory, readTemplateLibrary, setTemplateStatusFile,
} from './template/store.ts'
import { TemplateAiProcessor } from './template/ai.ts'
import {
  commitReviewImportFile, deleteReviewTaskFile, listReviewTemplatesFile,
  readReviewIndexFile, readReviewManifestFile, readReviewReportFile, readReviewTemplateFile,
  writeReviewManifestFile, writeReviewReportFile, writeReviewTemplateFile,
} from './review/store.ts'
import { parseImportFile } from './review/importers.ts'
import { ReviewAiProcessor } from './review/ai.ts'
import {
  commitInteractionImportFile, readInteractionsFile, writeInteractionsFile,
} from './interactions/store.ts'
import {
  buildInteractionExportCsv, parseInteractionImport as parseInteractionImportText,
} from './interactions/csv.ts'
import { InteractionAiProcessor } from './interactions/ai.ts'
import { stubInteractionChannel } from './interactions/channel.ts'

export type * from './types.ts'
export { METADATA_FILENAME, ASSETS_DIRNAME, scanOutputs, scanProject } from './scan.ts'
export { parseGatherAiOutput, GATHER_AI_TIMEOUT_CODE } from './gather/ai.ts'
export { GATHER_MANIFEST_FILENAME, GATHER_QUOTA_PER_SOURCE, GATHER_MAX_BODY_CHARS } from './gather/store.ts'
export { parseCompetitorAnalysisOutput, parseCompetitorReportOutput, COMPETITOR_AI_TIMEOUT_CODE } from './competitor/ai.ts'
export { COMPETITOR_MANIFEST_FILENAME } from './competitor/store.ts'
export {
  CREATE_MANIFEST_FILENAME, CREATE_MAX_STORED_VERSIONS, parseCreateManifest, assertCreateManifest,
  collectCreateReferencedFiles,
} from './create/store.ts'
export { CREATE_AI_TIMEOUT_CODE, CREATE_PROMPT_VERSION } from './create/ai.ts'
export {
  CREATE_QUOTA_FILENAME, CreateQuotaError, normalizeQuotaState, localDayKey, resolveQuotaConfig,
} from './create/quota.ts'
export {
  CREATE_TEMPLATES_FILENAME, CREATE_TEMPLATE_PLACEHOLDERS, assertTemplateBody,
} from './create/store.ts'
export { PERSONAS_FILENAME, personaDigest, parsePersonasManifest } from './persona/store.ts'
export {
  buildFactsText, parsePersonaFieldsOutput, parsePersonaReportOutput, PERSONA_AI_TIMEOUT_CODE,
  PERSONA_FILL_PROMPT_VERSION, PERSONA_REPORT_PROMPT_VERSION, PERSONA_RESUME_PROMPT_VERSION,
} from './persona/ai.ts'
export {
  PUBLISH_DIRNAME, PUBLISH_INDEX_FILENAME, PUBLISH_MANIFEST_FILENAME, PUBLISH_PROFILES_FILENAME,
  assertPublishManifest, buildPublishPackageFile, isPlatformId, isTaskId, parsePublishManifest,
} from './publish/store.ts'
export { PUBLISH_AI_TIMEOUT_CODE, PUBLISH_PROMPT_VERSION, parsePublishAdaptOutput } from './publish/ai.ts'
export {
  TEMPLATES_FILENAME, TAXONOMY_FILENAME, HISTORY_DIRNAME, TEMPLATE_HISTORY_LIMIT,
  TEMPLATE_VARIABLE_NAME_PATTERN, parseTemplatesManifest, parseTemplateTaxonomy,
  normalizeTemplateInput,
} from './template/store.ts'
export {
  TEMPLATE_AI_TIMEOUT_CODE, TEMPLATE_GENERATE_PROMPT_VERSION, TEMPLATE_OPTIMIZE_PROMPT_VERSION,
  TEMPLATE_EXTRACT_PROMPT_VERSION, parseTemplateExtractOutput, parseTemplateGenerateOutput,
  parseTemplateOptimizeOutput, parseTemplateVariablesOutput,
} from './template/ai.ts'
export {
  REVIEW_MANIFEST_FILENAME, REVIEW_INDEX_FILENAME, REVIEW_DIRNAME, parseReviewManifest,
} from './review/store.ts'
export { parseImportFile, parseCsvRows, mapImportColumns, parseMetricCell, parseDateCell, PLATFORM_IMPORT_HINTS } from './review/importers.ts'
export {
  REVIEW_AI_TIMEOUT_CODE, REVIEW_PROMPT_VERSION, REVIEW_REPORT_SECTIONS,
  analyzeSystemPrompt, reportSystemPrompt, frameAnalyzeRequest, frameReportRequest, metricsLine,
} from './review/ai.ts'
export {
  INTERACTIONS_FILENAME, INTERACTIONS_MAX_CONVERSATIONS, INTERACTIONS_MAX_MESSAGES,
  assertInteractionsManifest, parseInteractionsManifest, summarizeInteractions,
} from './interactions/store.ts'
export {
  INTERACTION_CSV_COLUMNS, INTERACTION_MAX_IMPORT_CHARS, INTERACTION_MAX_IMPORT_ROWS,
  INTERACTION_MAX_MESSAGE_CHARS, buildInteractionExportCsv, escapeCsvField, parseInteractionImport,
} from './interactions/csv.ts'
export {
  INTERACTION_AI_TIMEOUT_CODE, INTERACTION_INSIGHT_PROMPT_VERSION, INTERACTION_REPLY_CANDIDATES,
  INTERACTION_REPLY_PROMPT_VERSION, INTERACTION_SENTIMENT_PROMPT_VERSION, classifySystemPrompt,
  frameClassifyRequest, frameInsightRequest, frameReplyRequest, insightSystemPrompt,
  parseClassifyOutput, parseInsightOutput, parseReplyOutput, replySystemPrompt,
} from './interactions/ai.ts'
export { stubInteractionChannel } from './interactions/channel.ts'

/** Content-outputs Remote configuration. */
export interface Config extends GatherAiConfig, CreateQuotaConfig {
  /** Outputs library root. Defaults to `<dsh home>/outputs`. */
  root?: string
  /** Home the global template library resolves under (`<templatesRoot>/templates`). Defaults to the dsh home. */
  templatesRoot?: string
}

export const Config: Schema<Config> = z.object({
  root: z.string(),
  templatesRoot: z.string(),
  provider: z.string(),
  model: z.string(),
  timeoutMs: z.number(),
  maxOutputTokens: z.number(),
  maxInputChars: z.number(),
  freeDailyGenerates: z.number(),
  freeDailyRewrites: z.number(),
  paidTierEnabled: z.boolean(),
})

/**
 * Remote gateway over the outputs library: the read-only `list` projection,
 * the gather write face (`fetchFeed`, asset and manifest storage, AI
 * processing), the competitor write face (manifest storage, asset reads,
 * teardown and report AI), the create workbench face, the persona face (the
 * `_personas.json` account-persona manifest and persona AI), and the
 * interaction face (the `_interactions.json` inbox manifest, the CSV import,
 * and the reply/classify/insight AI). AI calls inject the shared `llm`
 * service; everything else is filesystem-local.
 */
export class ContentOutputsGateway extends TypertRemoteService {
  static inject = ['llm']

  static Config: Schema<Config> = Config

  /** Absolute library root; a missing directory scans as an empty library. */
  private readonly root: string

  /** Absolute global template library root; a missing directory reads as an empty library. */
  private readonly templatesRoot: string

  /** Queued AI processor behind the gather view's explicit processing button. */
  private readonly ai: GatherAiProcessor

  /** Queued AI processor behind the competitors view's explicit buttons. */
  private readonly competitorAi: CompetitorAiProcessor

  /** Queued AI processor behind the create workbench's generate/rewrite buttons. */
  private readonly createAi: CreateAiProcessor

  /** Queued AI processor behind the persona view's explicit buttons. */
  private readonly personaAi: PersonaAiProcessor

  /** Queued AI processor behind the publish view's per-platform adapt buttons. */
  private readonly publishAi: PublishAiProcessor

  /** Queued AI processor behind the template library's explicit buttons. */
  private readonly templateAi: TemplateAiProcessor

  /** Queued AI processor behind the review view's diagnosis and report buttons. */
  private readonly reviewAi: ReviewAiProcessor

  /** Queued AI processor behind the interaction view's draft, classify, and insight buttons. */
  private readonly interactionAi: InteractionAiProcessor

  /** Freemium gate over the create AI faces. */
  private readonly createQuota: CreateQuotaGate

  constructor(ctx: Context, config: Config) {
    super(ctx, 'contentOutputs')
    this.root = join(resolveDshHome(config.root), 'outputs')
    this.ai = new GatherAiProcessor(ctx, config)
    this.competitorAi = new CompetitorAiProcessor(ctx, config)
    this.createAi = new CreateAiProcessor(ctx, resolveAiConfig(config))
    this.personaAi = new PersonaAiProcessor(ctx, config)
    this.publishAi = new PublishAiProcessor(ctx, resolveAiConfig(config))
    this.templateAi = new TemplateAiProcessor(ctx, resolveAiConfig(config))
    this.reviewAi = new ReviewAiProcessor(ctx, resolveAiConfig(config))
    this.interactionAi = new InteractionAiProcessor(ctx, resolveAiConfig(config))
    this.createQuota = new CreateQuotaGate(this.root, config)
    this.templatesRoot = join(resolveDshHome(config.templatesRoot), 'templates')
    // Reclaim atomic-write temp files a crashed process left behind. Best
    // effort: orphan temps are inert, so a sweep failure never blocks start.
    void sweepOrphanTempFiles(this.root).catch(() => undefined)
  }

  /**
   * Read the library root directly on every call: the library is the agent's
   * write surface, so a cache would only add a second truth to synchronize.
   * @returns Current projects in topic order, with every unreadable
   * directory named in `problems`.
   */
  @Remote('list')
  async list(): Promise<ContentOutputsSnapshot> {
    return scanOutputs(this.root)
  }

  /**
   * Fetch and parse one feed document with the source's conditional-request
   * cursors. Network reading only: nothing is persisted, and the fetch
   * happens here — never in the browser, whose cross-origin feeds would be
   * blocked by CORS anyway.
   * @param request - feed URL plus the stored ETag / Last-Modified cursors.
   * @param signal - caller cancellation.
   * @returns item drafts plus the cursors to store for the next run.
   */
  @Remote('fetchFeed')
  async fetchFeed(request: GatherFeedRequest, signal?: AbortSignal): Promise<GatherFeedResult> {
    return fetchFeedDocument(request, {}, signal)
  }

  /**
   * Write one file inside the theme's `assets/` directory. `*.html` content
   * is sanitized through the allowlist and truncated to the body cap before
   * it reaches disk; the replacement is atomic and serialized per file.
   * @param write - theme, plain file name, and complete content.
   * @returns whether the stored snapshot was truncated.
   */
  @Remote('writeAsset')
  async writeAsset(write: GatherAssetWrite): Promise<{ truncated: boolean }> {
    return writeAssetFile(this.root, write)
  }

  /**
   * Read the theme's `_gather.json` manifest.
   * @param theme - outputs-project directory name.
   * @returns the manifest with only valid entries, every dropped one named
   * in `problems`; callers must not write back while `problems` is non-empty.
   */
  @Remote('readGatherManifest')
  async readGatherManifest(theme: string): Promise<GatherManifestRead> {
    return readGatherManifestFile(this.root, theme)
  }

  /**
   * Replace the theme's `_gather.json` manifest with an atomic, locked
   * commit. The stored manifest is quota-trimmed: per source the newest
   * `unread`/`read` entries up to the quota survive, `favorite`/`picked`
   * entries and their snapshots are never removed.
   * @param theme - outputs-project directory name.
   * @param manifest - the complete next manifest.
   * @returns the stored (trimmed) manifest.
   */
  @Remote('writeGatherManifest')
  async writeGatherManifest(theme: string, manifest: GatherManifest): Promise<GatherManifest> {
    // The create workbench's referenced snapshots are exempt from the
    // retention trim — collected fresh per write, so a released reference
    // becomes trimmable again on the next gather run.
    return writeGatherManifestFile(this.root, theme, manifest, await collectCreateReferencedFiles(this.root, theme))
  }

  /**
   * Rename or relocate one file between two themes' `assets/` directories:
   * a within-theme rename for renaming, the cross-theme form for rebinding
   * one material to another theme.
   * @param move - source theme/name and destination theme/name.
   */
  @Remote('moveAsset')
  async moveAsset(move: GatherAssetMove): Promise<void> {
    await moveAssetFile(this.root, move)
  }

  /**
   * Delete one file from the theme's `assets/` directory; absent files are
   * a no-op.
   * @param theme - outputs-project directory name.
   * @param file - plain file name inside `assets/`.
   */
  @Remote('deleteAsset')
  async deleteAsset(theme: string, file: string): Promise<void> {
    await deleteAssetFile(this.root, theme, file)
  }

  /**
   * Process one material through the model: summary, key points, topic
   * score, and tags. Explicit per call, queued one at a time, rate limits
   * retried with backoff; nothing is persisted here.
   * @param request - the material's display facts plus its snapshot reference.
   * @returns the structured result for the caller to write back.
   */
  @Remote('processMaterial')
  async processMaterial(request: GatherAiRequest): Promise<GatherAiResult> {
    return this.ai.process(request, (theme, file) => readAssetText(this.root, theme, file))
  }

  /**
   * Read the theme's `_competitors.json` manifest.
   * @param theme - outputs-project directory name.
   * @returns the manifest with only valid entries, every dropped one named
   *   in `problems`; callers must not write back while `problems` is
   *   non-empty.
   */
  @Remote('readCompetitorManifest')
  async readCompetitorManifest(theme: string): Promise<CompetitorManifestRead> {
    return readCompetitorManifestFile(this.root, theme)
  }

  /**
   * Replace the theme's `_competitors.json` manifest with an atomic, locked
   * commit. No trimming runs: works carry user markers and append-only
   * snapshots, so the caller's list is stored verbatim after validation.
   * @param theme - outputs-project directory name.
   * @param manifest - the complete next manifest.
   */
  @Remote('writeCompetitorManifest')
  async writeCompetitorManifest(theme: string, manifest: CompetitorManifest): Promise<void> {
    await writeCompetitorManifestFile(this.root, theme, manifest)
  }

  /**
   * Read one asset file as text for the work side preview. Read-only and
   * path-guarded like every other asset access.
   * @param theme - outputs-project directory name.
   * @param file - plain file name inside `assets/`.
   * @returns the file content, or an empty record when absent.
   */
  @Remote('readAsset')
  async readAsset(theme: string, file: string): Promise<{ content?: string }> {
    const content = await readAssetText(this.root, theme, file)
    return content === undefined ? {} : { content }
  }

  /**
   * Tear one benchmark work down through the model: hook, structure, pain
   * points, risks, reusable patterns, and differentiated topic suggestions.
   * Explicit per call, queued one at a time, rate limits retried with
   * backoff; nothing is persisted here.
   * @param request - the work's display facts, snapshot reference, and any
   *   user-pasted hot comments.
   * @returns the structured result plus the full markdown teardown.
   */
  @Remote('analyzeCompetitorWork')
  async analyzeCompetitorWork(request: CompetitorAnalyzeWorkRequest): Promise<CompetitorAnalyzeWorkResult> {
    return this.competitorAi.analyzeWork(request, (theme, file) => readAssetText(this.root, theme, file))
  }

  /**
   * Generate one benchmark report through the model: a single-account
   * panorama or a two-account face-off, from aggregated digests only.
   * Explicit per call, queued one at a time, rate limits retried with
   * backoff; nothing is persisted here.
   * @param request - report kind plus one or two account digests.
   * @returns the markdown report for the caller to store as an asset file.
   */
  @Remote('generateCompetitorReport')
  async generateCompetitorReport(request: CompetitorReportRequest): Promise<CompetitorReportResult> {
    return this.competitorAi.generateReport(request)
  }

  /**
   * Read the theme's creation state: the validated `_create.json` manifest
   * plus the current draft body. A malformed manifest reads as empty with
   * the rejection named, so the editor can warn instead of overwriting it.
   * @param theme - outputs-project directory name.
   * @returns the manifest (or null) and the draft body (or null).
   */
  @Remote('readCreateState')
  async readCreateState(theme: string): Promise<CreateStateRead> {
    return readCreateStateFile(this.root, theme)
  }

  /**
   * Replace the theme's `_create.json` manifest with an atomic, locked
   * commit. The caller owns version pruning and ordering; this face only
   * validates the format.
   * @param theme - outputs-project directory name.
   * @param manifest - the complete next manifest.
   */
  @Remote('writeCreateState')
  async writeCreateState(theme: string, manifest: CreateManifest): Promise<void> {
    await writeCreateStateFile(this.root, theme, manifest)
  }

  /**
   * Publish one deliverable: copy the given content to the theme root. A
   * name collision rejects unless `overwrite` is set — the caller confirms
   * with the user first. Registration into `.dsh-output.json` is the
   * separate {@link registerCreatePublish} step.
   * @param theme - outputs-project directory name.
   * @param request - file name, complete content, and the overwrite decision.
   * @returns the stored root file name.
   */
  @Remote('publishCreateFinal')
  async publishCreateFinal(theme: string, request: CreatePublishRequest): Promise<CreatePublishResult> {
    return { file: await publishFinalFile(this.root, theme, request) }
  }

  /**
   * Register one publish into the theme's metadata: flip the status to
   * `published` and mirror the version bookkeeping. The retry half of the
   * handoff — the deliverable must already sit at the theme root.
   * @param theme - outputs-project directory name.
   * @param request - the root file name and the published version.
   */
  @Remote('registerCreatePublish')
  async registerCreatePublish(theme: string, request: CreateRegisterRequest): Promise<void> {
    await registerCreatePublishFile(this.root, theme, request)
  }

  /**
   * Read the theme's `.dsh-output.json` for the merge-before-write the
   * metadata face does. A malformed file reads as null with the violation
   * named, so the editor warns instead of silently overwriting it.
   * @param theme - outputs-project directory name.
   * @returns the metadata, or null with the problem when malformed.
   */
  @Remote('readCreateMetadata')
  async readCreateMetadata(theme: string): Promise<{ metadata: OutputMetadata | null; problem: string | null }> {
    return readCreateMetadataFile(this.root, theme)
  }

  /**
   * Write the theme's `.dsh-output.json` — theme initialization and any
   * later bookkeeping merge go through here, validated against the format-0
   * rules before the atomic commit.
   * @param theme - outputs-project directory name.
   * @param metadata - the complete next metadata.
   */
  @Remote('writeCreateMetadata')
  async writeCreateMetadata(theme: string, metadata: OutputMetadata): Promise<void> {
    await writeOutputMetadataFile(this.root, theme, metadata)
  }

  /**
   * List the theme's non-system asset file names, sorted. Serves the image
   * inserter; system files never appear.
   * @param theme - outputs-project directory name.
   * @returns the sorted plain file names.
   */
  @Remote('listCreateAssets')
  async listCreateAssets(theme: string): Promise<CreateAssetList> {
    return { files: await listAssetFiles(this.root, theme) }
  }

  /**
   * Generate one draft through the model under the selected built-in
   * template. Explicit per call, queued one at a time, rate limits retried
   * with backoff; nothing is persisted here. Charges the daily generation
   * budget per variant; `count: 3` additionally requires the paid tier.
   * @param request - the creation context, content type, and variant count.
   * @returns the draft text, the split variants when batched, and provenance.
   */
  @Remote('generateCreateContent')
  async generateCreateContent(request: CreateGenerateRequest): Promise<CreateAiResult> {
    const count = request.count ?? 1
    if (count === 3) await this.createQuota.requirePaidFeature('batch')
    await this.createQuota.consumeGenerate(count)
    return this.createAi.generate(request)
  }

  /**
   * Rewrite one selection through the model (condense, expand, style switch,
   * perspective switch, extract, humanize light/deep, or title batch).
   * Explicit per call, queued one at a time, rate limits retried with
   * backoff; nothing is persisted here. Charges the daily rewrite budget.
   * @param request - the operation and the selection text.
   * @returns the rewritten text with its provenance.
   */
  @Remote('rewriteCreateSelection')
  async rewriteCreateSelection(request: CreateRewriteRequest): Promise<CreateAiResult> {
    await this.createQuota.consumeRewrite()
    return this.createAi.rewrite(request)
  }

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
  @Remote('listCreateTemplates')
  async listCreateTemplates(): Promise<CreateTemplateList> {
    const { templates, problems } = await readCreateTemplatesFile(this.root)
    return { templates, problems }
  }

  /**
   * Upsert one custom template: absent id creates, present id updates and
   * bumps the revision. The body re-validates against the placeholder
   * whitelist here, and again at every generation that uses it.
   * @param input - the template facts; id, revision, and timestamps are store-managed.
   * @returns the stored templates.
   */
  @Remote('putCreateTemplate')
  async putCreateTemplate(input: CreateTemplateInput): Promise<CreateTemplateList> {
    return { templates: await putCreateTemplateFile(this.root, input), problems: [] }
  }

  /**
   * Delete one custom template; an unknown id is a no-op.
   * @param id - the template id.
   * @returns the stored templates.
   */
  @Remote('deleteCreateTemplate')
  async deleteCreateTemplate(id: string): Promise<CreateTemplateList> {
    return { templates: await deleteCreateTemplateFile(this.root, id), problems: [] }
  }

  @Remote('evaluateCreateContent')
  async evaluateCreateContent(request: CreateEvaluateRequest): Promise<CreateEvaluation> {
    await this.createQuota.requirePaidFeature('evaluation')
    return this.createAi.evaluate(request)
  }

  /**
   * List every account persona from the library root's `_personas.json`.
   * @returns the entries newest-first, with every dropped stored record named
   *   in `problems`.
   */
  @Remote('listPersonas')
  async listPersonas(): Promise<PersonasSnapshot> {
    return readPersonasFile(join(this.root, PERSONAS_FILENAME))
  }

  /**
   * Read one account persona by id.
   * @param id - the persona id.
   * @returns the stored entry, or an empty record when absent.
   */
  @Remote('getPersona')
  async getPersona(id: PersonaId): Promise<{ persona?: PersonaEntry }> {
    const snapshot = await readPersonasFile(join(this.root, PERSONAS_FILENAME))
    const persona = snapshot.personas.find(entry => entry.id === id)
    return persona === undefined ? {} : { persona }
  }

  /**
   * Upsert one persona: the revision increments, the digest recomputes from
   * the stored content, and the timestamps are gateway-owned. Report edits
   * never ride this face — it is the form save, and the report staleness
   * banner tracks form revisions only.
   * @param input - the upsert payload from the browser.
   * @returns the stored entry.
   */
  @Remote('putPersona')
  async putPersona(input: PersonaInput): Promise<PersonaEntry> {
    return putPersonaFile(join(this.root, PERSONAS_FILENAME), input)
  }

  /**
   * Replace one persona's report without touching its form state: revision
   * and digest stay, so editing the report text never marks the report stale.
   * @param id - the persona to update; unknown ids reject.
   * @param report - the complete next report.
   * @returns the stored entry.
   */
  @Remote('putPersonaReport')
  async putPersonaReport(id: PersonaId, report: PersonaReport): Promise<PersonaEntry> {
    return putPersonaReportFile(join(this.root, PERSONAS_FILENAME), id, report)
  }

  /**
   * Remove one persona; the embedded report goes with it and no file is left
   * to dangle. Removing an unknown id is a no-op.
   * @param id - the persona id.
   */
  @Remote('deletePersona')
  async deletePersona(id: PersonaId): Promise<void> {
    await deletePersonaFile(join(this.root, PERSONAS_FILENAME), id)
  }

  /**
   * Run one persona AI operation (blank-field fill, résumé extraction, or
   * report generation). Explicit per call, queued one at a time, rate limits
   * retried with backoff; nothing is persisted here — the caller previews
   * the result and writes adopted values back through the persona faces.
   * @param request - the operation and its input.
   * @returns the candidate fields or report, with the prompt version for
   *   provenance stamping.
   */
  @Remote('processPersonaAi')
  async processPersonaAi(request: PersonaAiRequest): Promise<PersonaAiResult> {
    return this.personaAi.process(request)
  }

  /**
   * Read the theme's `_publish.json` manifest.
   * @param theme - outputs-project directory name.
   * @returns the manifest (null when absent) with only valid tasks, every
   *   dropped one named in `problems`; callers must not write back while
   *   `problems` is non-empty.
   */
  @Remote('readPublishManifest')
  async readPublishManifest(theme: string): Promise<PublishManifestRead> {
    return readPublishManifestFile(this.root, theme)
  }

  /**
   * Replace the theme's `_publish.json` manifest with an atomic, locked
   * commit, refreshing the theme's rows in the global `_publish-index.json`
   * under the same lock. Task retries ride full-manifest writes: the caller
   * appends a new attempt entry, never rewriting the logged history.
   * @param theme - outputs-project directory name.
   * @param manifest - the complete next manifest.
   */
  @Remote('writePublishManifest')
  async writePublishManifest(theme: string, manifest: PublishManifest): Promise<void> {
    await writePublishManifestFile(this.root, theme, manifest)
  }

  /**
   * Read the global `_publish-index.json` aggregation aid for the history
   * list. A malformed file reads as empty with the rejection named — the
   * next manifest write rebuilds the theme's rows.
   * @returns the index plus the parse problems.
   */
  @Remote('listPublishIndex')
  async listPublishIndex(): Promise<PublishIndexRead> {
    return readPublishIndexFile(this.root)
  }

  /**
   * Read the global `_publish-profiles.json` account cards. The cards carry
   * aliases and switches only — never credentials.
   * @returns the profiles plus every dropped stored card named.
   */
  @Remote('readPublishProfiles')
  async readPublishProfiles(): Promise<PublishProfilesRead> {
    return readPublishProfilesFile(this.root)
  }

  /**
   * Replace the global `_publish-profiles.json` account cards with an
   * atomic, locked commit.
   * @param profiles - the complete next card list.
   */
  @Remote('writePublishProfiles')
  async writePublishProfiles(profiles: PublishProfilesDoc['profiles']): Promise<void> {
    await writePublishProfilesFile(this.root, profiles)
  }

  /**
   * Write one derived platform draft under
   * `assets/publish/<taskId>/<platformId>.md`. The replacement is atomic;
   * the path is guarded against leaving the task directory.
   * @param theme - outputs-project directory name.
   * @param taskId - the owning task's UUID.
   * @param platformId - the platform registry key.
   * @param content - the complete draft text.
   * @returns the stored path relative to the theme's `assets/`.
   */
  @Remote('writePublishDerived')
  async writePublishDerived(theme: string, taskId: string, platformId: string, content: string): Promise<{ file: string }> {
    return writePublishDerivedFile(this.root, theme, taskId, platformId, content)
  }

  /**
   * Read one derived platform draft back for the preview pane.
   * @returns the text, or an empty record when the draft does not exist yet.
   */
  @Remote('readPublishDerived')
  async readPublishDerived(theme: string, taskId: string, platformId: string): Promise<{ content?: string }> {
    const content = await readPublishDerivedFile(this.root, theme, taskId, platformId)
    return content === undefined ? {} : { content }
  }

  /**
   * Read one theme-root deliverable as an adaptation source. Guarded like
   * every asset read; the `.dsh-output.json` metadata file is never readable
   * through this face.
   * @param theme - outputs-project directory name.
   * @param file - the deliverable file name at the theme root.
   * @returns the text, or an empty record when absent.
   */
  @Remote('readPublishSource')
  async readPublishSource(theme: string, file: string): Promise<{ content?: string }> {
    const content = await readPublishSourceFile(this.root, theme, file)
    return content === undefined ? {} : { content }
  }

  /**
   * Assemble the frozen phase-2 MCP handoff package for one task: every
   * platform leg's derived draft must already exist, or the build rejects —
   * the package is complete or not generated. Nothing is persisted here; the
   * caller records the attempt through the manifest face.
   * @param theme - outputs-project directory name.
   * @param taskId - the task's UUID.
   * @returns the complete package.
   */
  @Remote('buildPublishPackage')
  async buildPublishPackage(theme: string, taskId: string): Promise<PublishPackage> {
    return buildPublishPackageFile(this.root, theme, taskId)
  }

  /**
   * Adapt one manuscript into one platform version through the model.
   * Explicit per call, queued one at a time, rate limits retried with
   * backoff; nothing is persisted here — the caller writes the result back
   * as a derived draft. Charges the daily generation budget.
   * @param request - the adaptation request.
   * @returns the structured result with its provenance.
   */
  @Remote('adaptPublishContent')
  async adaptPublishContent(request: PublishAdaptRequest): Promise<PublishAdaptResult> {
    await this.createQuota.consumeGenerate(1)
    return this.publishAi.adapt(request)
  }

  /**
   * List the whole global template library: records and the shared tag list.
   * Both files read leniently — valid records surface, every dropped stored
   * record is named in `problems`.
   * @returns the library snapshot.
   */
  @Remote('listTemplates')
  async listTemplates(): Promise<TemplatesSnapshot> {
    return readTemplateLibrary(this.templatesRoot)
  }

  /**
   * Upsert one template: the version increments and one full-record snapshot
   * lands in the history directory per save. Duplicate display names reject.
   * @param input - the template facts; version, status, and timestamps are store-managed.
   * @returns the stored record.
   */
  @Remote('putTemplate')
  async putTemplate(input: TemplateInput): Promise<TemplateRecord> {
    return putTemplateFile(this.templatesRoot, input)
  }

  /**
   * Flip one template's lifecycle state. Archiving and restoring are
   * bookkeeping, not edits: no snapshot is written.
   * @param id - the template to update; unknown ids reject.
   * @param status - the next lifecycle state.
   * @returns the stored record.
   */
  @Remote('setTemplateStatus')
  async setTemplateStatus(id: TemplateId, status: TemplateStatus): Promise<TemplateRecord> {
    return setTemplateStatusFile(this.templatesRoot, id, status)
  }

  /**
   * Remove one template; the whole history directory goes with it and no
   * file is left to dangle. Removing an unknown id is a no-op.
   * @param id - the template id.
   */
  @Remote('deleteTemplate')
  async deleteTemplate(id: TemplateId): Promise<void> {
    await deleteTemplateFile(this.templatesRoot, id)
  }

  /**
   * Read one template's history snapshots, newest version first. Malformed
   * snapshot files are skipped, never surfaced as records.
   * @param id - the template whose history to read.
   * @returns the snapshots.
   */
  @Remote('getTemplateHistory')
  async getTemplateHistory(id: TemplateId): Promise<TemplateHistoryRead> {
    return { entries: await readTemplateHistory(this.templatesRoot, id) }
  }

  /**
   * Replace the shared tag list wholesale, stripping every reference to a
   * removed tag from the stored records in the same commit.
   * @param tags - the complete next tag list; names must be unique.
   * @returns the stored tag list.
   */
  @Remote('putTemplateTags')
  async putTemplateTags(tags: readonly TemplateTag[]): Promise<readonly TemplateTag[]> {
    return putTemplateTagsFile(this.templatesRoot, tags)
  }

  /**
   * Build the portable pack document for the given ids. Read-only; the
   * caller downloads it as the import/export file.
   * @param ids - the template ids to export; empty exports the whole library.
   * @returns the pack document.
   */
  @Remote('exportTemplates')
  async exportTemplates(ids: readonly string[]): Promise<TemplatePack> {
    return exportTemplatePack(this.templatesRoot, ids, new Date().toISOString())
  }

  /**
   * Import one pack document. Entries are independent: a rejected entry is
   * named in the summary while the rest land. A conflicting id resolves per
   * the strategy.
   * @param pack - the parsed pack document from the browser.
   * @param strategy - the conflict resolution for ids that already exist.
   * @returns the per-bucket summary.
   */
  @Remote('importTemplates')
  async importTemplates(pack: TemplatePack, strategy: TemplateImportStrategy): Promise<TemplateImportSummary> {
    return importTemplatePack(this.templatesRoot, pack, strategy)
  }

  /**
   * Run one template AI operation (skeleton generation, body optimization,
   * or variable extraction). Explicit per call, queued one at a time, rate
   * limits retried with backoff; nothing is persisted here — the caller
   * previews the draft and stores it only through an explicit save.
   * @param request - the operation and its input.
   * @returns the draft with its prompt version.
   */
  @Remote('processTemplateAi')
  async processTemplateAi(request: TemplateAiRequest): Promise<TemplateAiResult> {
    return this.templateAi.process(request)
  }

  /**
   * Read the theme's `_review.json` manifest.
   * @param theme - outputs-project directory name.
   * @returns the manifest (null when absent) with only valid snapshots and
   *   tasks, every dropped one named in `problems`; callers must not write
   *   back while `problems` is non-empty.
   */
  @Remote('readReviewManifest')
  async readReviewManifest(theme: string): Promise<ReviewManifestRead> {
    return readReviewManifestFile(this.root, theme)
  }

  /**
   * Replace the theme's `_review.json` manifest with an atomic, locked
   * commit, refreshing the theme's rows in the global `_review-index.json`.
   * Snapshot appends, bindings, baseline edits, and task retries all ride
   * full-manifest writes; the store rejects wholesale rather than repairing.
   * @param theme - outputs-project directory name.
   * @param manifest - the complete next manifest.
   */
  @Remote('writeReviewManifest')
  async writeReviewManifest(theme: string, manifest: ReviewManifest): Promise<void> {
    await writeReviewManifestFile(this.root, theme, manifest)
  }

  /**
   * Read the global `_review-index.json` aggregation aid for the history
   * list. A malformed file reads as empty with the rejection named — the
   * next manifest write rebuilds the theme's rows.
   * @returns the index plus the parse problems.
   */
  @Remote('listReviewIndex')
  async listReviewIndex(): Promise<ReviewIndexRead> {
    return readReviewIndexFile(this.root)
  }

  /**
   * Parse one platform export file into an import preview: mapped rows,
   * per-row rejections, and the unmatched columns. Nothing is stored — the
   * caller confirms with the user before the commit face lands rows.
   * @param request - the platform, file name, and raw CSV text.
   * @returns the preview.
   */
  @Remote('parseReviewImport')
  parseReviewImport(request: ReviewImportPreviewRequest): Promise<ReviewImportPreview> {
    return Promise.resolve(parseImportFile(request))
  }

  /**
   * Commit confirmed import rows as snapshots: new works append, a known
   * work re-imported on the same UTC day overwrites that day's snapshot
   * (idempotent), historical days are never rewritten.
   * @param request - the theme, platform, and confirmed rows.
   * @returns the append and overwrite accounting.
   */
  @Remote('commitReviewImport')
  async commitReviewImport(request: ReviewImportCommitRequest): Promise<ReviewImportCommitResult> {
    return commitReviewImportFile(this.root, request)
  }

  /**
   * Remove one review task and delete its report file. Snapshots and
   * bindings survive — other tasks and the dashboard reuse them. An unknown
   * id rejects so a stale UI cannot silently no-op.
   * @param request - the theme and the task id.
   */
  @Remote('deleteReviewTask')
  async deleteReviewTask(request: ReviewTaskDeleteRequest): Promise<void> {
    await deleteReviewTaskFile(this.root, request.theme, request.taskId)
  }

  /**
   * Write one report file under `assets/review/reports/`. Every save lands a
   * new file — the generated original is never overwritten.
   * @param theme - outputs-project directory name.
   * @param file - plain report file name (`report-<taskId>-<ts>.md`).
   * @param content - the complete report markdown.
   * @returns the stored file name, relative to `assets/review/`.
   */
  @Remote('writeReviewReport')
  async writeReviewReport(theme: string, file: string, content: string): Promise<{ file: string }> {
    return writeReviewReportFile(this.root, theme, file, content)
  }

  /**
   * Read one report file back for the viewer and editor.
   * @returns the markdown, or an empty record when the file does not exist.
   */
  @Remote('readReviewReport')
  async readReviewReport(theme: string, file: string): Promise<ReviewReportRead> {
    return readReviewReportFile(this.root, theme, file)
  }

  /**
   * Save one viral-work template under `assets/review/templates/`.
   * @param theme - outputs-project directory name.
   * @param file - plain template file name.
   * @param content - the template markdown.
   * @returns the stored file name, relative to `assets/review/`.
   */
  @Remote('writeReviewTemplate')
  async writeReviewTemplate(theme: string, file: string, content: string): Promise<{ file: string }> {
    return writeReviewTemplateFile(this.root, theme, file, content)
  }

  /**
   * List saved template file names under `assets/review/templates/`.
   * @param theme - outputs-project directory name.
   * @returns the sorted plain file names.
   */
  @Remote('listReviewTemplates')
  async listReviewTemplates(theme: string): Promise<{ files: readonly string[] }> {
    return { files: await listReviewTemplatesFile(this.root, theme) }
  }

  /**
   * Read one saved template's content.
   * @returns the markdown, or an empty record when the file does not exist.
   */
  @Remote('readReviewTemplate')
  async readReviewTemplate(theme: string, file: string): Promise<ReviewReportRead> {
    return readReviewTemplateFile(this.root, theme, file)
  }

  /**
   * Diagnose one work through the model: what worked (viral) or what likely
   * failed (weak), with reusable elements or fix directions. Explicit per
   * call, queued one at a time, rate limits retried with backoff; nothing is
   * persisted here.
   * @param request - the diagnosis request; the caller assembles the draft
   *   excerpt and its truncation.
   * @returns the markdown diagnosis with its provenance.
   */
  @Remote('analyzeReviewWork')
  async analyzeReviewWork(request: ReviewAnalyzeWorkRequest): Promise<ReviewAiResult> {
    return this.reviewAi.analyzeWork(request)
  }

  /**
   * Generate one period report through the model under the frozen six-section
   * template. Aggregate digests only — full bodies never ride this call.
   * Explicit per call, queued one at a time, rate limits retried with
   * backoff; nothing is persisted here — the caller stores the markdown and
   * renders its own data-only fallback on failure.
   * @param request - the report request.
   * @returns the markdown report with its provenance.
   */
  @Remote('generateReviewReport')
  async generateReviewReport(request: ReviewGenerateReportRequest): Promise<ReviewAiResult> {
    return this.reviewAi.generateReport(request)
  }

  /**
   * Read the library-root `_interactions.json` manifest: the conversation
   * inbox, the AI insights, and the derived summary cache.
   * @returns the manifest (null when absent) with only valid conversations,
   *   every dropped one named in `problems`; callers must not write back
   *   while `problems` is non-empty.
   */
  @Remote('readInteractions')
  async readInteractions(): Promise<InteractionsManifestRead> {
    return readInteractionsFile(this.root)
  }

  /**
   * Replace the library-root `_interactions.json` manifest with an atomic,
   * locked commit. Status marks, tags, notes, drafts, sent replies, and the
   * insight merge all ride full-manifest writes; the store rejects wholesale
   * rather than repairing, and recomputes the summary cache in the same
   * commit so it can never drift.
   * @param manifest - the complete next manifest.
   * @returns the stored manifest (recomputed summary, canonical order).
   */
  @Remote('writeInteractions')
  async writeInteractions(manifest: InteractionsManifest): Promise<InteractionsManifest> {
    return writeInteractionsFile(this.root, manifest)
  }

  /**
   * Parse one fan-interaction export file into an import preview: validated
   * message rows plus per-row rejections. Nothing is stored — the caller
   * confirms with the user before the commit face lands rows.
   * @param request - the file name and raw CSV text (browser-decoded).
   * @returns the preview.
   */
  @Remote('parseInteractionImport')
  parseInteractionImport(request: InteractionImportPreviewRequest): Promise<InteractionImportPreview> {
    return Promise.resolve(parseInteractionImportText(request))
  }

  /**
   * Commit confirmed import rows: messages group into conversations by
   * `platform + external_user_id`, dedupe by `platform + external_message_id`
   * (a known id updates in place), and threading resolves against the
   * library plus the batch — unresolved parents stay with a named warning.
   * @param request - the confirmed rows.
   * @returns the append/update accounting and thread warnings.
   */
  @Remote('commitInteractionImport')
  async commitInteractionImport(request: InteractionImportCommitRequest): Promise<InteractionImportCommitResult> {
    return commitInteractionImportFile(this.root, request)
  }

  /**
   * Generate the fixed three-candidate reply draft set for one fan message.
   * The persona digest and samples layer the tone base; the style parameter
   * loses to the persona on conflict. Explicit per call, queued one at a
   * time, rate limits retried with backoff; charges one daily generation.
   * @param request - the thread, tone, persona facts, and template skeleton.
   * @returns the drafts with their provenance.
   */
  @Remote('generateInteractionReply')
  async generateInteractionReply(request: InteractionReplyRequest): Promise<InteractionReplyResult> {
    await this.createQuota.consumeGenerate(1)
    return this.interactionAi.replyDrafts(request)
  }

  /**
   * Classify one batch of fan messages along the two orthogonal taggings
   * (sentiment, intent). Explicit per call, queued one at a time; charges
   * one daily generation per fifty messages. A garbled batch degrades to
   * unknowns rather than failing the caller's loop.
   * @param request - at most fifty messages.
   * @returns the sanitized entries with their provenance.
   */
  @Remote('classifyInteractions')
  async classifyInteractions(request: InteractionClassifyRequest): Promise<InteractionClassifyResult> {
    await this.createQuota.consumeGenerate(Math.max(1, Math.ceil(request.messages.length / 50)))
    return this.interactionAi.classify(request)
  }

  /**
   * Extract one insight batch (questions, pain points, interests) from fan
   * messages. Explicit per call, queued one at a time; charges one daily
   * generation per batch. A garbled batch reads as empty — the caller's
   * merge records it and keeps going.
   * @param request - at most two hundred messages.
   * @returns the sanitized batch with its provenance.
   */
  @Remote('extractInteractionInsights')
  async extractInteractionInsights(request: InteractionInsightRequest): Promise<InteractionInsightResult> {
    await this.createQuota.consumeGenerate(1)
    return this.interactionAi.insights(request)
  }

  /**
   * Push one archived reply outward through the reserved MCP channel. No
   * provider exists this phase, so the call always refuses with
   * `MCP_NOT_CONFIGURED` — the caller's local archive already happened and
   * never depended on this result.
   * @param request - the conversation, threading, reply text, and persona.
   * @returns the refusal the toast renders.
   */
  @Remote('sendInteractionReply')
  async sendInteractionReply(request: InteractionSendReplyRequest): Promise<{ ok: false; reason: 'MCP_NOT_CONFIGURED' }> {
    return stubInteractionChannel.sendReply(request)
  }

  /**
   * Build the whole-inbox export CSV: the import columns plus
   * `conversation_id`, `status`, and `tags`, BOM first and CRLF lines, so
   * the file round-trips through the import face unchanged. Nothing is
   * stored — the caller writes the text where the user aimed it.
   * @returns the complete CSV text with BOM.
   */
  @Remote('exportInteractionCsv')
  async exportInteractionCsv(): Promise<{ text: string }> {
    const { manifest } = await readInteractionsFile(this.root)
    return { text: buildInteractionExportCsv(manifest?.conversations ?? []) }
  }
}

export default ContentOutputsGateway
