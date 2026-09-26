/**
 * Content-outputs Remote: the read-only projection of the outputs library
 * plus the gather and competitor write faces — the single authorized write
 * path for the Content Studio information-gathering and benchmark-account
 * views (asset and manifest storage under `outputs/<theme>/assets/`, and AI
 * processing). The projection stays exactly as it was: `list` scans the
 * library from disk on every call.
 */
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import z from '@deepseek-ai/schemastery';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { join } from 'node:path';
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol';
import { scanOutputs } from "./scan.js";
import { fetchFeedDocument } from "./gather/feed.js";
import { deleteAssetFile, moveAssetFile, readAssetText, readGatherManifestFile, sweepOrphanTempFiles, writeAssetFile, writeGatherManifestFile, } from "./gather/store.js";
import { GatherAiProcessor, resolveAiConfig } from "./gather/ai.js";
import { readCompetitorManifestFile, writeCompetitorManifestFile, } from "./competitor/store.js";
import { CompetitorAiProcessor } from "./competitor/ai.js";
import { collectCreateReferencedFiles, deleteCreateTemplateFile, listAssetFiles, publishFinalFile, putCreateTemplateFile, readCreateStateFile, readCreateMetadataFile, readCreateTemplatesFile, registerCreatePublishFile, writeCreateStateFile, writeOutputMetadataFile, } from "./create/store.js";
import { CreateAiProcessor } from "./create/ai.js";
import { CreateQuotaGate } from "./create/quota.js";
import { PERSONAS_FILENAME, deletePersonaFile, putPersonaFile, putPersonaReportFile, readPersonasFile, } from "./persona/store.js";
import { PersonaAiProcessor } from "./persona/ai.js";
export { METADATA_FILENAME, ASSETS_DIRNAME, scanOutputs, scanProject } from "./scan.js";
export { parseGatherAiOutput, GATHER_AI_TIMEOUT_CODE } from "./gather/ai.js";
export { GATHER_MANIFEST_FILENAME, GATHER_QUOTA_PER_SOURCE, GATHER_MAX_BODY_CHARS } from "./gather/store.js";
export { parseCompetitorAnalysisOutput, parseCompetitorReportOutput, COMPETITOR_AI_TIMEOUT_CODE } from "./competitor/ai.js";
export { COMPETITOR_MANIFEST_FILENAME } from "./competitor/store.js";
export { CREATE_MANIFEST_FILENAME, CREATE_MAX_STORED_VERSIONS, parseCreateManifest, assertCreateManifest, collectCreateReferencedFiles, } from "./create/store.js";
export { CREATE_AI_TIMEOUT_CODE, CREATE_PROMPT_VERSION } from "./create/ai.js";
export { CREATE_QUOTA_FILENAME, CreateQuotaError, normalizeQuotaState, localDayKey, resolveQuotaConfig, } from "./create/quota.js";
export { CREATE_TEMPLATES_FILENAME, CREATE_TEMPLATE_PLACEHOLDERS, assertTemplateBody, } from "./create/store.js";
export { PERSONAS_FILENAME, personaDigest, parsePersonasManifest } from "./persona/store.js";
export { buildFactsText, parsePersonaFieldsOutput, parsePersonaReportOutput, PERSONA_AI_TIMEOUT_CODE, PERSONA_FILL_PROMPT_VERSION, PERSONA_REPORT_PROMPT_VERSION, PERSONA_RESUME_PROMPT_VERSION, } from "./persona/ai.js";
export const Config = z.object({
    root: z.string(),
    provider: z.string(),
    model: z.string(),
    timeoutMs: z.number(),
    maxOutputTokens: z.number(),
    maxInputChars: z.number(),
    freeDailyGenerates: z.number(),
    freeDailyRewrites: z.number(),
    paidTierEnabled: z.boolean(),
});
/**
 * Remote gateway over the outputs library: the read-only `list` projection,
 * the gather write face (`fetchFeed`, asset and manifest storage, AI
 * processing), the competitor write face (manifest storage, asset reads,
 * teardown and report AI), the create workbench face, and the persona face
 * (the `_personas.json` account-persona manifest and persona AI). AI calls
 * inject the shared `llm` service; everything else is filesystem-local.
 */
let ContentOutputsGateway = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _list_decorators;
    let _fetchFeed_decorators;
    let _writeAsset_decorators;
    let _readGatherManifest_decorators;
    let _writeGatherManifest_decorators;
    let _moveAsset_decorators;
    let _deleteAsset_decorators;
    let _processMaterial_decorators;
    let _readCompetitorManifest_decorators;
    let _writeCompetitorManifest_decorators;
    let _readAsset_decorators;
    let _analyzeCompetitorWork_decorators;
    let _generateCompetitorReport_decorators;
    let _readCreateState_decorators;
    let _writeCreateState_decorators;
    let _publishCreateFinal_decorators;
    let _registerCreatePublish_decorators;
    let _readCreateMetadata_decorators;
    let _writeCreateMetadata_decorators;
    let _listCreateAssets_decorators;
    let _generateCreateContent_decorators;
    let _rewriteCreateSelection_decorators;
    let _listCreateTemplates_decorators;
    let _putCreateTemplate_decorators;
    let _deleteCreateTemplate_decorators;
    let _evaluateCreateContent_decorators;
    let _listPersonas_decorators;
    let _getPersona_decorators;
    let _putPersona_decorators;
    let _putPersonaReport_decorators;
    let _deletePersona_decorators;
    let _processPersonaAi_decorators;
    return class ContentOutputsGateway extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _list_decorators = [Remote('list')];
            _fetchFeed_decorators = [Remote('fetchFeed')];
            _writeAsset_decorators = [Remote('writeAsset')];
            _readGatherManifest_decorators = [Remote('readGatherManifest')];
            _writeGatherManifest_decorators = [Remote('writeGatherManifest')];
            _moveAsset_decorators = [Remote('moveAsset')];
            _deleteAsset_decorators = [Remote('deleteAsset')];
            _processMaterial_decorators = [Remote('processMaterial')];
            _readCompetitorManifest_decorators = [Remote('readCompetitorManifest')];
            _writeCompetitorManifest_decorators = [Remote('writeCompetitorManifest')];
            _readAsset_decorators = [Remote('readAsset')];
            _analyzeCompetitorWork_decorators = [Remote('analyzeCompetitorWork')];
            _generateCompetitorReport_decorators = [Remote('generateCompetitorReport')];
            _readCreateState_decorators = [Remote('readCreateState')];
            _writeCreateState_decorators = [Remote('writeCreateState')];
            _publishCreateFinal_decorators = [Remote('publishCreateFinal')];
            _registerCreatePublish_decorators = [Remote('registerCreatePublish')];
            _readCreateMetadata_decorators = [Remote('readCreateMetadata')];
            _writeCreateMetadata_decorators = [Remote('writeCreateMetadata')];
            _listCreateAssets_decorators = [Remote('listCreateAssets')];
            _generateCreateContent_decorators = [Remote('generateCreateContent')];
            _rewriteCreateSelection_decorators = [Remote('rewriteCreateSelection')];
            _listCreateTemplates_decorators = [Remote('listCreateTemplates')];
            _putCreateTemplate_decorators = [Remote('putCreateTemplate')];
            _deleteCreateTemplate_decorators = [Remote('deleteCreateTemplate')];
            _evaluateCreateContent_decorators = [Remote('evaluateCreateContent')];
            _listPersonas_decorators = [Remote('listPersonas')];
            _getPersona_decorators = [Remote('getPersona')];
            _putPersona_decorators = [Remote('putPersona')];
            _putPersonaReport_decorators = [Remote('putPersonaReport')];
            _deletePersona_decorators = [Remote('deletePersona')];
            _processPersonaAi_decorators = [Remote('processPersonaAi')];
            __esDecorate(this, null, _list_decorators, { kind: "method", name: "list", static: false, private: false, access: { has: obj => "list" in obj, get: obj => obj.list }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _fetchFeed_decorators, { kind: "method", name: "fetchFeed", static: false, private: false, access: { has: obj => "fetchFeed" in obj, get: obj => obj.fetchFeed }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _writeAsset_decorators, { kind: "method", name: "writeAsset", static: false, private: false, access: { has: obj => "writeAsset" in obj, get: obj => obj.writeAsset }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readGatherManifest_decorators, { kind: "method", name: "readGatherManifest", static: false, private: false, access: { has: obj => "readGatherManifest" in obj, get: obj => obj.readGatherManifest }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _writeGatherManifest_decorators, { kind: "method", name: "writeGatherManifest", static: false, private: false, access: { has: obj => "writeGatherManifest" in obj, get: obj => obj.writeGatherManifest }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _moveAsset_decorators, { kind: "method", name: "moveAsset", static: false, private: false, access: { has: obj => "moveAsset" in obj, get: obj => obj.moveAsset }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _deleteAsset_decorators, { kind: "method", name: "deleteAsset", static: false, private: false, access: { has: obj => "deleteAsset" in obj, get: obj => obj.deleteAsset }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _processMaterial_decorators, { kind: "method", name: "processMaterial", static: false, private: false, access: { has: obj => "processMaterial" in obj, get: obj => obj.processMaterial }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readCompetitorManifest_decorators, { kind: "method", name: "readCompetitorManifest", static: false, private: false, access: { has: obj => "readCompetitorManifest" in obj, get: obj => obj.readCompetitorManifest }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _writeCompetitorManifest_decorators, { kind: "method", name: "writeCompetitorManifest", static: false, private: false, access: { has: obj => "writeCompetitorManifest" in obj, get: obj => obj.writeCompetitorManifest }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readAsset_decorators, { kind: "method", name: "readAsset", static: false, private: false, access: { has: obj => "readAsset" in obj, get: obj => obj.readAsset }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _analyzeCompetitorWork_decorators, { kind: "method", name: "analyzeCompetitorWork", static: false, private: false, access: { has: obj => "analyzeCompetitorWork" in obj, get: obj => obj.analyzeCompetitorWork }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _generateCompetitorReport_decorators, { kind: "method", name: "generateCompetitorReport", static: false, private: false, access: { has: obj => "generateCompetitorReport" in obj, get: obj => obj.generateCompetitorReport }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readCreateState_decorators, { kind: "method", name: "readCreateState", static: false, private: false, access: { has: obj => "readCreateState" in obj, get: obj => obj.readCreateState }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _writeCreateState_decorators, { kind: "method", name: "writeCreateState", static: false, private: false, access: { has: obj => "writeCreateState" in obj, get: obj => obj.writeCreateState }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _publishCreateFinal_decorators, { kind: "method", name: "publishCreateFinal", static: false, private: false, access: { has: obj => "publishCreateFinal" in obj, get: obj => obj.publishCreateFinal }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _registerCreatePublish_decorators, { kind: "method", name: "registerCreatePublish", static: false, private: false, access: { has: obj => "registerCreatePublish" in obj, get: obj => obj.registerCreatePublish }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readCreateMetadata_decorators, { kind: "method", name: "readCreateMetadata", static: false, private: false, access: { has: obj => "readCreateMetadata" in obj, get: obj => obj.readCreateMetadata }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _writeCreateMetadata_decorators, { kind: "method", name: "writeCreateMetadata", static: false, private: false, access: { has: obj => "writeCreateMetadata" in obj, get: obj => obj.writeCreateMetadata }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _listCreateAssets_decorators, { kind: "method", name: "listCreateAssets", static: false, private: false, access: { has: obj => "listCreateAssets" in obj, get: obj => obj.listCreateAssets }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _generateCreateContent_decorators, { kind: "method", name: "generateCreateContent", static: false, private: false, access: { has: obj => "generateCreateContent" in obj, get: obj => obj.generateCreateContent }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _rewriteCreateSelection_decorators, { kind: "method", name: "rewriteCreateSelection", static: false, private: false, access: { has: obj => "rewriteCreateSelection" in obj, get: obj => obj.rewriteCreateSelection }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _listCreateTemplates_decorators, { kind: "method", name: "listCreateTemplates", static: false, private: false, access: { has: obj => "listCreateTemplates" in obj, get: obj => obj.listCreateTemplates }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _putCreateTemplate_decorators, { kind: "method", name: "putCreateTemplate", static: false, private: false, access: { has: obj => "putCreateTemplate" in obj, get: obj => obj.putCreateTemplate }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _deleteCreateTemplate_decorators, { kind: "method", name: "deleteCreateTemplate", static: false, private: false, access: { has: obj => "deleteCreateTemplate" in obj, get: obj => obj.deleteCreateTemplate }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _evaluateCreateContent_decorators, { kind: "method", name: "evaluateCreateContent", static: false, private: false, access: { has: obj => "evaluateCreateContent" in obj, get: obj => obj.evaluateCreateContent }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _listPersonas_decorators, { kind: "method", name: "listPersonas", static: false, private: false, access: { has: obj => "listPersonas" in obj, get: obj => obj.listPersonas }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _getPersona_decorators, { kind: "method", name: "getPersona", static: false, private: false, access: { has: obj => "getPersona" in obj, get: obj => obj.getPersona }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _putPersona_decorators, { kind: "method", name: "putPersona", static: false, private: false, access: { has: obj => "putPersona" in obj, get: obj => obj.putPersona }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _putPersonaReport_decorators, { kind: "method", name: "putPersonaReport", static: false, private: false, access: { has: obj => "putPersonaReport" in obj, get: obj => obj.putPersonaReport }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _deletePersona_decorators, { kind: "method", name: "deletePersona", static: false, private: false, access: { has: obj => "deletePersona" in obj, get: obj => obj.deletePersona }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _processPersonaAi_decorators, { kind: "method", name: "processPersonaAi", static: false, private: false, access: { has: obj => "processPersonaAi" in obj, get: obj => obj.processPersonaAi }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['llm'];
        static Config = Config;
        /** Absolute library root; a missing directory scans as an empty library. */
        root = __runInitializers(this, _instanceExtraInitializers);
        /** Queued AI processor behind the gather view's explicit processing button. */
        ai;
        /** Queued AI processor behind the competitors view's explicit buttons. */
        competitorAi;
        /** Queued AI processor behind the create workbench's generate/rewrite buttons. */
        createAi;
        /** Queued AI processor behind the persona view's explicit buttons. */
        personaAi;
        /** Freemium gate over the create AI faces. */
        createQuota;
        constructor(ctx, config) {
            super(ctx, 'contentOutputs');
            this.root = join(resolveDshHome(config.root), 'outputs');
            this.ai = new GatherAiProcessor(ctx, config);
            this.competitorAi = new CompetitorAiProcessor(ctx, config);
            this.createAi = new CreateAiProcessor(ctx, resolveAiConfig(config));
            this.personaAi = new PersonaAiProcessor(ctx, config);
            this.createQuota = new CreateQuotaGate(this.root, config);
            // Reclaim atomic-write temp files a crashed process left behind. Best
            // effort: orphan temps are inert, so a sweep failure never blocks start.
            void sweepOrphanTempFiles(this.root).catch(() => undefined);
        }
        /**
         * Read the library root directly on every call: the library is the agent's
         * write surface, so a cache would only add a second truth to synchronize.
         * @returns Current projects in topic order, with every unreadable
         * directory named in `problems`.
         */
        async list() {
            return scanOutputs(this.root);
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
        async fetchFeed(request, signal) {
            return fetchFeedDocument(request, {}, signal);
        }
        /**
         * Write one file inside the theme's `assets/` directory. `*.html` content
         * is sanitized through the allowlist and truncated to the body cap before
         * it reaches disk; the replacement is atomic and serialized per file.
         * @param write - theme, plain file name, and complete content.
         * @returns whether the stored snapshot was truncated.
         */
        async writeAsset(write) {
            return writeAssetFile(this.root, write);
        }
        /**
         * Read the theme's `_gather.json` manifest.
         * @param theme - outputs-project directory name.
         * @returns the manifest with only valid entries, every dropped one named
         * in `problems`; callers must not write back while `problems` is non-empty.
         */
        async readGatherManifest(theme) {
            return readGatherManifestFile(this.root, theme);
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
        async writeGatherManifest(theme, manifest) {
            // The create workbench's referenced snapshots are exempt from the
            // retention trim — collected fresh per write, so a released reference
            // becomes trimmable again on the next gather run.
            return writeGatherManifestFile(this.root, theme, manifest, await collectCreateReferencedFiles(this.root, theme));
        }
        /**
         * Rename or relocate one file between two themes' `assets/` directories:
         * a within-theme rename for renaming, the cross-theme form for rebinding
         * one material to another theme.
         * @param move - source theme/name and destination theme/name.
         */
        async moveAsset(move) {
            await moveAssetFile(this.root, move);
        }
        /**
         * Delete one file from the theme's `assets/` directory; absent files are
         * a no-op.
         * @param theme - outputs-project directory name.
         * @param file - plain file name inside `assets/`.
         */
        async deleteAsset(theme, file) {
            await deleteAssetFile(this.root, theme, file);
        }
        /**
         * Process one material through the model: summary, key points, topic
         * score, and tags. Explicit per call, queued one at a time, rate limits
         * retried with backoff; nothing is persisted here.
         * @param request - the material's display facts plus its snapshot reference.
         * @returns the structured result for the caller to write back.
         */
        async processMaterial(request) {
            return this.ai.process(request, (theme, file) => readAssetText(this.root, theme, file));
        }
        /**
         * Read the theme's `_competitors.json` manifest.
         * @param theme - outputs-project directory name.
         * @returns the manifest with only valid entries, every dropped one named
         *   in `problems`; callers must not write back while `problems` is
         *   non-empty.
         */
        async readCompetitorManifest(theme) {
            return readCompetitorManifestFile(this.root, theme);
        }
        /**
         * Replace the theme's `_competitors.json` manifest with an atomic, locked
         * commit. No trimming runs: works carry user markers and append-only
         * snapshots, so the caller's list is stored verbatim after validation.
         * @param theme - outputs-project directory name.
         * @param manifest - the complete next manifest.
         */
        async writeCompetitorManifest(theme, manifest) {
            await writeCompetitorManifestFile(this.root, theme, manifest);
        }
        /**
         * Read one asset file as text for the work side preview. Read-only and
         * path-guarded like every other asset access.
         * @param theme - outputs-project directory name.
         * @param file - plain file name inside `assets/`.
         * @returns the file content, or an empty record when absent.
         */
        async readAsset(theme, file) {
            const content = await readAssetText(this.root, theme, file);
            return content === undefined ? {} : { content };
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
        async analyzeCompetitorWork(request) {
            return this.competitorAi.analyzeWork(request, (theme, file) => readAssetText(this.root, theme, file));
        }
        /**
         * Generate one benchmark report through the model: a single-account
         * panorama or a two-account face-off, from aggregated digests only.
         * Explicit per call, queued one at a time, rate limits retried with
         * backoff; nothing is persisted here.
         * @param request - report kind plus one or two account digests.
         * @returns the markdown report for the caller to store as an asset file.
         */
        async generateCompetitorReport(request) {
            return this.competitorAi.generateReport(request);
        }
        /**
         * Read the theme's creation state: the validated `_create.json` manifest
         * plus the current draft body. A malformed manifest reads as empty with
         * the rejection named, so the editor can warn instead of overwriting it.
         * @param theme - outputs-project directory name.
         * @returns the manifest (or null) and the draft body (or null).
         */
        async readCreateState(theme) {
            return readCreateStateFile(this.root, theme);
        }
        /**
         * Replace the theme's `_create.json` manifest with an atomic, locked
         * commit. The caller owns version pruning and ordering; this face only
         * validates the format.
         * @param theme - outputs-project directory name.
         * @param manifest - the complete next manifest.
         */
        async writeCreateState(theme, manifest) {
            await writeCreateStateFile(this.root, theme, manifest);
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
        async publishCreateFinal(theme, request) {
            return { file: await publishFinalFile(this.root, theme, request) };
        }
        /**
         * Register one publish into the theme's metadata: flip the status to
         * `published` and mirror the version bookkeeping. The retry half of the
         * handoff — the deliverable must already sit at the theme root.
         * @param theme - outputs-project directory name.
         * @param request - the root file name and the published version.
         */
        async registerCreatePublish(theme, request) {
            await registerCreatePublishFile(this.root, theme, request);
        }
        /**
         * Read the theme's `.dsh-output.json` for the merge-before-write the
         * metadata face does. A malformed file reads as null with the violation
         * named, so the editor warns instead of silently overwriting it.
         * @param theme - outputs-project directory name.
         * @returns the metadata, or null with the problem when malformed.
         */
        async readCreateMetadata(theme) {
            return readCreateMetadataFile(this.root, theme);
        }
        /**
         * Write the theme's `.dsh-output.json` — theme initialization and any
         * later bookkeeping merge go through here, validated against the format-0
         * rules before the atomic commit.
         * @param theme - outputs-project directory name.
         * @param metadata - the complete next metadata.
         */
        async writeCreateMetadata(theme, metadata) {
            await writeOutputMetadataFile(this.root, theme, metadata);
        }
        /**
         * List the theme's non-system asset file names, sorted. Serves the image
         * inserter; system files never appear.
         * @param theme - outputs-project directory name.
         * @returns the sorted plain file names.
         */
        async listCreateAssets(theme) {
            return { files: await listAssetFiles(this.root, theme) };
        }
        /**
         * Generate one draft through the model under the selected built-in
         * template. Explicit per call, queued one at a time, rate limits retried
         * with backoff; nothing is persisted here. Charges the daily generation
         * budget per variant; `count: 3` additionally requires the paid tier.
         * @param request - the creation context, content type, and variant count.
         * @returns the draft text, the split variants when batched, and provenance.
         */
        async generateCreateContent(request) {
            const count = request.count ?? 1;
            if (count === 3)
                await this.createQuota.requirePaidFeature('batch');
            await this.createQuota.consumeGenerate(count);
            return this.createAi.generate(request);
        }
        /**
         * Rewrite one selection through the model (condense, expand, style switch,
         * perspective switch, extract, humanize light/deep, or title batch).
         * Explicit per call, queued one at a time, rate limits retried with
         * backoff; nothing is persisted here. Charges the daily rewrite budget.
         * @param request - the operation and the selection text.
         * @returns the rewritten text with its provenance.
         */
        async rewriteCreateSelection(request) {
            await this.createQuota.consumeRewrite();
            return this.createAi.rewrite(request);
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
        async listCreateTemplates() {
            const { templates, problems } = await readCreateTemplatesFile(this.root);
            return { templates, problems };
        }
        /**
         * Upsert one custom template: absent id creates, present id updates and
         * bumps the revision. The body re-validates against the placeholder
         * whitelist here, and again at every generation that uses it.
         * @param input - the template facts; id, revision, and timestamps are store-managed.
         * @returns the stored templates.
         */
        async putCreateTemplate(input) {
            return { templates: await putCreateTemplateFile(this.root, input), problems: [] };
        }
        /**
         * Delete one custom template; an unknown id is a no-op.
         * @param id - the template id.
         * @returns the stored templates.
         */
        async deleteCreateTemplate(id) {
            return { templates: await deleteCreateTemplateFile(this.root, id), problems: [] };
        }
        async evaluateCreateContent(request) {
            await this.createQuota.requirePaidFeature('evaluation');
            return this.createAi.evaluate(request);
        }
        /**
         * List every account persona from the library root's `_personas.json`.
         * @returns the entries newest-first, with every dropped stored record named
         *   in `problems`.
         */
        async listPersonas() {
            return readPersonasFile(join(this.root, PERSONAS_FILENAME));
        }
        /**
         * Read one account persona by id.
         * @param id - the persona id.
         * @returns the stored entry, or an empty record when absent.
         */
        async getPersona(id) {
            const snapshot = await readPersonasFile(join(this.root, PERSONAS_FILENAME));
            const persona = snapshot.personas.find(entry => entry.id === id);
            return persona === undefined ? {} : { persona };
        }
        /**
         * Upsert one persona: the revision increments, the digest recomputes from
         * the stored content, and the timestamps are gateway-owned. Report edits
         * never ride this face — it is the form save, and the report staleness
         * banner tracks form revisions only.
         * @param input - the upsert payload from the browser.
         * @returns the stored entry.
         */
        async putPersona(input) {
            return putPersonaFile(join(this.root, PERSONAS_FILENAME), input);
        }
        /**
         * Replace one persona's report without touching its form state: revision
         * and digest stay, so editing the report text never marks the report stale.
         * @param id - the persona to update; unknown ids reject.
         * @param report - the complete next report.
         * @returns the stored entry.
         */
        async putPersonaReport(id, report) {
            return putPersonaReportFile(join(this.root, PERSONAS_FILENAME), id, report);
        }
        /**
         * Remove one persona; the embedded report goes with it and no file is left
         * to dangle. Removing an unknown id is a no-op.
         * @param id - the persona id.
         */
        async deletePersona(id) {
            await deletePersonaFile(join(this.root, PERSONAS_FILENAME), id);
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
        async processPersonaAi(request) {
            return this.personaAi.process(request);
        }
    };
})();
export { ContentOutputsGateway };
export default ContentOutputsGateway;
//# sourceMappingURL=index.js.map