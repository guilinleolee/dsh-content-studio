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
import { buildPublishPackageFile, readPublishDerivedFile, readPublishIndexFile, readPublishManifestFile, readPublishProfilesFile, readPublishSourceFile, writePublishDerivedFile, writePublishManifestFile, writePublishProfilesFile, } from "./publish/store.js";
import { PublishAiProcessor } from "./publish/ai.js";
import { deleteTemplateFile, exportTemplatePack, importTemplatePack, putTemplateFile, putTemplateTagsFile, readTemplateHistory, readTemplateLibrary, setTemplateStatusFile, } from "./template/store.js";
import { TemplateAiProcessor } from "./template/ai.js";
import { commitReviewImportFile, deleteReviewTaskFile, listReviewTemplatesFile, readReviewIndexFile, readReviewManifestFile, readReviewReportFile, readReviewTemplateFile, writeReviewManifestFile, writeReviewReportFile, writeReviewTemplateFile, } from "./review/store.js";
import { parseImportFile } from "./review/importers.js";
import { ReviewAiProcessor } from "./review/ai.js";
import { commitInteractionImportFile, readInteractionsFile, writeInteractionsFile, } from "./interactions/store.js";
import { buildInteractionExportCsv, parseInteractionImport as parseInteractionImportText, } from "./interactions/csv.js";
import { InteractionAiProcessor } from "./interactions/ai.js";
import { stubInteractionChannel } from "./interactions/channel.js";
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
export { PUBLISH_DIRNAME, PUBLISH_INDEX_FILENAME, PUBLISH_MANIFEST_FILENAME, PUBLISH_PROFILES_FILENAME, assertPublishManifest, buildPublishPackageFile, isPlatformId, isTaskId, parsePublishManifest, } from "./publish/store.js";
export { PUBLISH_AI_TIMEOUT_CODE, PUBLISH_PROMPT_VERSION, parsePublishAdaptOutput } from "./publish/ai.js";
export { TEMPLATES_FILENAME, TAXONOMY_FILENAME, HISTORY_DIRNAME, TEMPLATE_HISTORY_LIMIT, TEMPLATE_VARIABLE_NAME_PATTERN, parseTemplatesManifest, parseTemplateTaxonomy, normalizeTemplateInput, } from "./template/store.js";
export { TEMPLATE_AI_TIMEOUT_CODE, TEMPLATE_GENERATE_PROMPT_VERSION, TEMPLATE_OPTIMIZE_PROMPT_VERSION, TEMPLATE_EXTRACT_PROMPT_VERSION, parseTemplateExtractOutput, parseTemplateGenerateOutput, parseTemplateOptimizeOutput, parseTemplateVariablesOutput, } from "./template/ai.js";
export { REVIEW_MANIFEST_FILENAME, REVIEW_INDEX_FILENAME, REVIEW_DIRNAME, parseReviewManifest, } from "./review/store.js";
export { parseImportFile, parseCsvRows, mapImportColumns, parseMetricCell, parseDateCell, PLATFORM_IMPORT_HINTS } from "./review/importers.js";
export { REVIEW_AI_TIMEOUT_CODE, REVIEW_PROMPT_VERSION, REVIEW_REPORT_SECTIONS, analyzeSystemPrompt, reportSystemPrompt, frameAnalyzeRequest, frameReportRequest, metricsLine, } from "./review/ai.js";
export { INTERACTIONS_FILENAME, INTERACTIONS_MAX_CONVERSATIONS, INTERACTIONS_MAX_MESSAGES, assertInteractionsManifest, parseInteractionsManifest, summarizeInteractions, } from "./interactions/store.js";
export { INTERACTION_CSV_COLUMNS, INTERACTION_MAX_IMPORT_CHARS, INTERACTION_MAX_IMPORT_ROWS, INTERACTION_MAX_MESSAGE_CHARS, buildInteractionExportCsv, escapeCsvField, parseInteractionImport, } from "./interactions/csv.js";
export { INTERACTION_AI_TIMEOUT_CODE, INTERACTION_INSIGHT_PROMPT_VERSION, INTERACTION_REPLY_CANDIDATES, INTERACTION_REPLY_PROMPT_VERSION, INTERACTION_SENTIMENT_PROMPT_VERSION, classifySystemPrompt, frameClassifyRequest, frameInsightRequest, frameReplyRequest, insightSystemPrompt, parseClassifyOutput, parseInsightOutput, parseReplyOutput, replySystemPrompt, } from "./interactions/ai.js";
export { stubInteractionChannel } from "./interactions/channel.js";
export const Config = z.object({
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
});
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
    let _readPublishManifest_decorators;
    let _writePublishManifest_decorators;
    let _listPublishIndex_decorators;
    let _readPublishProfiles_decorators;
    let _writePublishProfiles_decorators;
    let _writePublishDerived_decorators;
    let _readPublishDerived_decorators;
    let _readPublishSource_decorators;
    let _buildPublishPackage_decorators;
    let _adaptPublishContent_decorators;
    let _listTemplates_decorators;
    let _putTemplate_decorators;
    let _setTemplateStatus_decorators;
    let _deleteTemplate_decorators;
    let _getTemplateHistory_decorators;
    let _putTemplateTags_decorators;
    let _exportTemplates_decorators;
    let _importTemplates_decorators;
    let _processTemplateAi_decorators;
    let _readReviewManifest_decorators;
    let _writeReviewManifest_decorators;
    let _listReviewIndex_decorators;
    let _parseReviewImport_decorators;
    let _commitReviewImport_decorators;
    let _deleteReviewTask_decorators;
    let _writeReviewReport_decorators;
    let _readReviewReport_decorators;
    let _writeReviewTemplate_decorators;
    let _listReviewTemplates_decorators;
    let _readReviewTemplate_decorators;
    let _analyzeReviewWork_decorators;
    let _generateReviewReport_decorators;
    let _readInteractions_decorators;
    let _writeInteractions_decorators;
    let _parseInteractionImport_decorators;
    let _commitInteractionImport_decorators;
    let _generateInteractionReply_decorators;
    let _classifyInteractions_decorators;
    let _extractInteractionInsights_decorators;
    let _sendInteractionReply_decorators;
    let _exportInteractionCsv_decorators;
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
            _readPublishManifest_decorators = [Remote('readPublishManifest')];
            _writePublishManifest_decorators = [Remote('writePublishManifest')];
            _listPublishIndex_decorators = [Remote('listPublishIndex')];
            _readPublishProfiles_decorators = [Remote('readPublishProfiles')];
            _writePublishProfiles_decorators = [Remote('writePublishProfiles')];
            _writePublishDerived_decorators = [Remote('writePublishDerived')];
            _readPublishDerived_decorators = [Remote('readPublishDerived')];
            _readPublishSource_decorators = [Remote('readPublishSource')];
            _buildPublishPackage_decorators = [Remote('buildPublishPackage')];
            _adaptPublishContent_decorators = [Remote('adaptPublishContent')];
            _listTemplates_decorators = [Remote('listTemplates')];
            _putTemplate_decorators = [Remote('putTemplate')];
            _setTemplateStatus_decorators = [Remote('setTemplateStatus')];
            _deleteTemplate_decorators = [Remote('deleteTemplate')];
            _getTemplateHistory_decorators = [Remote('getTemplateHistory')];
            _putTemplateTags_decorators = [Remote('putTemplateTags')];
            _exportTemplates_decorators = [Remote('exportTemplates')];
            _importTemplates_decorators = [Remote('importTemplates')];
            _processTemplateAi_decorators = [Remote('processTemplateAi')];
            _readReviewManifest_decorators = [Remote('readReviewManifest')];
            _writeReviewManifest_decorators = [Remote('writeReviewManifest')];
            _listReviewIndex_decorators = [Remote('listReviewIndex')];
            _parseReviewImport_decorators = [Remote('parseReviewImport')];
            _commitReviewImport_decorators = [Remote('commitReviewImport')];
            _deleteReviewTask_decorators = [Remote('deleteReviewTask')];
            _writeReviewReport_decorators = [Remote('writeReviewReport')];
            _readReviewReport_decorators = [Remote('readReviewReport')];
            _writeReviewTemplate_decorators = [Remote('writeReviewTemplate')];
            _listReviewTemplates_decorators = [Remote('listReviewTemplates')];
            _readReviewTemplate_decorators = [Remote('readReviewTemplate')];
            _analyzeReviewWork_decorators = [Remote('analyzeReviewWork')];
            _generateReviewReport_decorators = [Remote('generateReviewReport')];
            _readInteractions_decorators = [Remote('readInteractions')];
            _writeInteractions_decorators = [Remote('writeInteractions')];
            _parseInteractionImport_decorators = [Remote('parseInteractionImport')];
            _commitInteractionImport_decorators = [Remote('commitInteractionImport')];
            _generateInteractionReply_decorators = [Remote('generateInteractionReply')];
            _classifyInteractions_decorators = [Remote('classifyInteractions')];
            _extractInteractionInsights_decorators = [Remote('extractInteractionInsights')];
            _sendInteractionReply_decorators = [Remote('sendInteractionReply')];
            _exportInteractionCsv_decorators = [Remote('exportInteractionCsv')];
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
            __esDecorate(this, null, _readPublishManifest_decorators, { kind: "method", name: "readPublishManifest", static: false, private: false, access: { has: obj => "readPublishManifest" in obj, get: obj => obj.readPublishManifest }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _writePublishManifest_decorators, { kind: "method", name: "writePublishManifest", static: false, private: false, access: { has: obj => "writePublishManifest" in obj, get: obj => obj.writePublishManifest }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _listPublishIndex_decorators, { kind: "method", name: "listPublishIndex", static: false, private: false, access: { has: obj => "listPublishIndex" in obj, get: obj => obj.listPublishIndex }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readPublishProfiles_decorators, { kind: "method", name: "readPublishProfiles", static: false, private: false, access: { has: obj => "readPublishProfiles" in obj, get: obj => obj.readPublishProfiles }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _writePublishProfiles_decorators, { kind: "method", name: "writePublishProfiles", static: false, private: false, access: { has: obj => "writePublishProfiles" in obj, get: obj => obj.writePublishProfiles }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _writePublishDerived_decorators, { kind: "method", name: "writePublishDerived", static: false, private: false, access: { has: obj => "writePublishDerived" in obj, get: obj => obj.writePublishDerived }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readPublishDerived_decorators, { kind: "method", name: "readPublishDerived", static: false, private: false, access: { has: obj => "readPublishDerived" in obj, get: obj => obj.readPublishDerived }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readPublishSource_decorators, { kind: "method", name: "readPublishSource", static: false, private: false, access: { has: obj => "readPublishSource" in obj, get: obj => obj.readPublishSource }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _buildPublishPackage_decorators, { kind: "method", name: "buildPublishPackage", static: false, private: false, access: { has: obj => "buildPublishPackage" in obj, get: obj => obj.buildPublishPackage }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _adaptPublishContent_decorators, { kind: "method", name: "adaptPublishContent", static: false, private: false, access: { has: obj => "adaptPublishContent" in obj, get: obj => obj.adaptPublishContent }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _listTemplates_decorators, { kind: "method", name: "listTemplates", static: false, private: false, access: { has: obj => "listTemplates" in obj, get: obj => obj.listTemplates }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _putTemplate_decorators, { kind: "method", name: "putTemplate", static: false, private: false, access: { has: obj => "putTemplate" in obj, get: obj => obj.putTemplate }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _setTemplateStatus_decorators, { kind: "method", name: "setTemplateStatus", static: false, private: false, access: { has: obj => "setTemplateStatus" in obj, get: obj => obj.setTemplateStatus }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _deleteTemplate_decorators, { kind: "method", name: "deleteTemplate", static: false, private: false, access: { has: obj => "deleteTemplate" in obj, get: obj => obj.deleteTemplate }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _getTemplateHistory_decorators, { kind: "method", name: "getTemplateHistory", static: false, private: false, access: { has: obj => "getTemplateHistory" in obj, get: obj => obj.getTemplateHistory }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _putTemplateTags_decorators, { kind: "method", name: "putTemplateTags", static: false, private: false, access: { has: obj => "putTemplateTags" in obj, get: obj => obj.putTemplateTags }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _exportTemplates_decorators, { kind: "method", name: "exportTemplates", static: false, private: false, access: { has: obj => "exportTemplates" in obj, get: obj => obj.exportTemplates }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _importTemplates_decorators, { kind: "method", name: "importTemplates", static: false, private: false, access: { has: obj => "importTemplates" in obj, get: obj => obj.importTemplates }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _processTemplateAi_decorators, { kind: "method", name: "processTemplateAi", static: false, private: false, access: { has: obj => "processTemplateAi" in obj, get: obj => obj.processTemplateAi }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readReviewManifest_decorators, { kind: "method", name: "readReviewManifest", static: false, private: false, access: { has: obj => "readReviewManifest" in obj, get: obj => obj.readReviewManifest }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _writeReviewManifest_decorators, { kind: "method", name: "writeReviewManifest", static: false, private: false, access: { has: obj => "writeReviewManifest" in obj, get: obj => obj.writeReviewManifest }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _listReviewIndex_decorators, { kind: "method", name: "listReviewIndex", static: false, private: false, access: { has: obj => "listReviewIndex" in obj, get: obj => obj.listReviewIndex }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _parseReviewImport_decorators, { kind: "method", name: "parseReviewImport", static: false, private: false, access: { has: obj => "parseReviewImport" in obj, get: obj => obj.parseReviewImport }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _commitReviewImport_decorators, { kind: "method", name: "commitReviewImport", static: false, private: false, access: { has: obj => "commitReviewImport" in obj, get: obj => obj.commitReviewImport }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _deleteReviewTask_decorators, { kind: "method", name: "deleteReviewTask", static: false, private: false, access: { has: obj => "deleteReviewTask" in obj, get: obj => obj.deleteReviewTask }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _writeReviewReport_decorators, { kind: "method", name: "writeReviewReport", static: false, private: false, access: { has: obj => "writeReviewReport" in obj, get: obj => obj.writeReviewReport }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readReviewReport_decorators, { kind: "method", name: "readReviewReport", static: false, private: false, access: { has: obj => "readReviewReport" in obj, get: obj => obj.readReviewReport }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _writeReviewTemplate_decorators, { kind: "method", name: "writeReviewTemplate", static: false, private: false, access: { has: obj => "writeReviewTemplate" in obj, get: obj => obj.writeReviewTemplate }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _listReviewTemplates_decorators, { kind: "method", name: "listReviewTemplates", static: false, private: false, access: { has: obj => "listReviewTemplates" in obj, get: obj => obj.listReviewTemplates }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readReviewTemplate_decorators, { kind: "method", name: "readReviewTemplate", static: false, private: false, access: { has: obj => "readReviewTemplate" in obj, get: obj => obj.readReviewTemplate }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _analyzeReviewWork_decorators, { kind: "method", name: "analyzeReviewWork", static: false, private: false, access: { has: obj => "analyzeReviewWork" in obj, get: obj => obj.analyzeReviewWork }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _generateReviewReport_decorators, { kind: "method", name: "generateReviewReport", static: false, private: false, access: { has: obj => "generateReviewReport" in obj, get: obj => obj.generateReviewReport }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readInteractions_decorators, { kind: "method", name: "readInteractions", static: false, private: false, access: { has: obj => "readInteractions" in obj, get: obj => obj.readInteractions }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _writeInteractions_decorators, { kind: "method", name: "writeInteractions", static: false, private: false, access: { has: obj => "writeInteractions" in obj, get: obj => obj.writeInteractions }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _parseInteractionImport_decorators, { kind: "method", name: "parseInteractionImport", static: false, private: false, access: { has: obj => "parseInteractionImport" in obj, get: obj => obj.parseInteractionImport }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _commitInteractionImport_decorators, { kind: "method", name: "commitInteractionImport", static: false, private: false, access: { has: obj => "commitInteractionImport" in obj, get: obj => obj.commitInteractionImport }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _generateInteractionReply_decorators, { kind: "method", name: "generateInteractionReply", static: false, private: false, access: { has: obj => "generateInteractionReply" in obj, get: obj => obj.generateInteractionReply }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _classifyInteractions_decorators, { kind: "method", name: "classifyInteractions", static: false, private: false, access: { has: obj => "classifyInteractions" in obj, get: obj => obj.classifyInteractions }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _extractInteractionInsights_decorators, { kind: "method", name: "extractInteractionInsights", static: false, private: false, access: { has: obj => "extractInteractionInsights" in obj, get: obj => obj.extractInteractionInsights }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _sendInteractionReply_decorators, { kind: "method", name: "sendInteractionReply", static: false, private: false, access: { has: obj => "sendInteractionReply" in obj, get: obj => obj.sendInteractionReply }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _exportInteractionCsv_decorators, { kind: "method", name: "exportInteractionCsv", static: false, private: false, access: { has: obj => "exportInteractionCsv" in obj, get: obj => obj.exportInteractionCsv }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['llm'];
        static Config = Config;
        /** Absolute library root; a missing directory scans as an empty library. */
        root = __runInitializers(this, _instanceExtraInitializers);
        /** Absolute global template library root; a missing directory reads as an empty library. */
        templatesRoot;
        /** Queued AI processor behind the gather view's explicit processing button. */
        ai;
        /** Queued AI processor behind the competitors view's explicit buttons. */
        competitorAi;
        /** Queued AI processor behind the create workbench's generate/rewrite buttons. */
        createAi;
        /** Queued AI processor behind the persona view's explicit buttons. */
        personaAi;
        /** Queued AI processor behind the publish view's per-platform adapt buttons. */
        publishAi;
        /** Queued AI processor behind the template library's explicit buttons. */
        templateAi;
        /** Queued AI processor behind the review view's diagnosis and report buttons. */
        reviewAi;
        /** Queued AI processor behind the interaction view's draft, classify, and insight buttons. */
        interactionAi;
        /** Freemium gate over the create AI faces. */
        createQuota;
        constructor(ctx, config) {
            super(ctx, 'contentOutputs');
            this.root = join(resolveDshHome(config.root), 'outputs');
            this.ai = new GatherAiProcessor(ctx, config);
            this.competitorAi = new CompetitorAiProcessor(ctx, config);
            this.createAi = new CreateAiProcessor(ctx, resolveAiConfig(config));
            this.personaAi = new PersonaAiProcessor(ctx, config);
            this.publishAi = new PublishAiProcessor(ctx, resolveAiConfig(config));
            this.templateAi = new TemplateAiProcessor(ctx, resolveAiConfig(config));
            this.reviewAi = new ReviewAiProcessor(ctx, resolveAiConfig(config));
            this.interactionAi = new InteractionAiProcessor(ctx, resolveAiConfig(config));
            this.createQuota = new CreateQuotaGate(this.root, config);
            this.templatesRoot = join(resolveDshHome(config.templatesRoot), 'templates');
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
        /**
         * Read the theme's `_publish.json` manifest.
         * @param theme - outputs-project directory name.
         * @returns the manifest (null when absent) with only valid tasks, every
         *   dropped one named in `problems`; callers must not write back while
         *   `problems` is non-empty.
         */
        async readPublishManifest(theme) {
            return readPublishManifestFile(this.root, theme);
        }
        /**
         * Replace the theme's `_publish.json` manifest with an atomic, locked
         * commit, refreshing the theme's rows in the global `_publish-index.json`
         * under the same lock. Task retries ride full-manifest writes: the caller
         * appends a new attempt entry, never rewriting the logged history.
         * @param theme - outputs-project directory name.
         * @param manifest - the complete next manifest.
         */
        async writePublishManifest(theme, manifest) {
            await writePublishManifestFile(this.root, theme, manifest);
        }
        /**
         * Read the global `_publish-index.json` aggregation aid for the history
         * list. A malformed file reads as empty with the rejection named — the
         * next manifest write rebuilds the theme's rows.
         * @returns the index plus the parse problems.
         */
        async listPublishIndex() {
            return readPublishIndexFile(this.root);
        }
        /**
         * Read the global `_publish-profiles.json` account cards. The cards carry
         * aliases and switches only — never credentials.
         * @returns the profiles plus every dropped stored card named.
         */
        async readPublishProfiles() {
            return readPublishProfilesFile(this.root);
        }
        /**
         * Replace the global `_publish-profiles.json` account cards with an
         * atomic, locked commit.
         * @param profiles - the complete next card list.
         */
        async writePublishProfiles(profiles) {
            await writePublishProfilesFile(this.root, profiles);
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
        async writePublishDerived(theme, taskId, platformId, content) {
            return writePublishDerivedFile(this.root, theme, taskId, platformId, content);
        }
        /**
         * Read one derived platform draft back for the preview pane.
         * @returns the text, or an empty record when the draft does not exist yet.
         */
        async readPublishDerived(theme, taskId, platformId) {
            const content = await readPublishDerivedFile(this.root, theme, taskId, platformId);
            return content === undefined ? {} : { content };
        }
        /**
         * Read one theme-root deliverable as an adaptation source. Guarded like
         * every asset read; the `.dsh-output.json` metadata file is never readable
         * through this face.
         * @param theme - outputs-project directory name.
         * @param file - the deliverable file name at the theme root.
         * @returns the text, or an empty record when absent.
         */
        async readPublishSource(theme, file) {
            const content = await readPublishSourceFile(this.root, theme, file);
            return content === undefined ? {} : { content };
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
        async buildPublishPackage(theme, taskId) {
            return buildPublishPackageFile(this.root, theme, taskId);
        }
        /**
         * Adapt one manuscript into one platform version through the model.
         * Explicit per call, queued one at a time, rate limits retried with
         * backoff; nothing is persisted here — the caller writes the result back
         * as a derived draft. Charges the daily generation budget.
         * @param request - the adaptation request.
         * @returns the structured result with its provenance.
         */
        async adaptPublishContent(request) {
            await this.createQuota.consumeGenerate(1);
            return this.publishAi.adapt(request);
        }
        /**
         * List the whole global template library: records and the shared tag list.
         * Both files read leniently — valid records surface, every dropped stored
         * record is named in `problems`.
         * @returns the library snapshot.
         */
        async listTemplates() {
            return readTemplateLibrary(this.templatesRoot);
        }
        /**
         * Upsert one template: the version increments and one full-record snapshot
         * lands in the history directory per save. Duplicate display names reject.
         * @param input - the template facts; version, status, and timestamps are store-managed.
         * @returns the stored record.
         */
        async putTemplate(input) {
            return putTemplateFile(this.templatesRoot, input);
        }
        /**
         * Flip one template's lifecycle state. Archiving and restoring are
         * bookkeeping, not edits: no snapshot is written.
         * @param id - the template to update; unknown ids reject.
         * @param status - the next lifecycle state.
         * @returns the stored record.
         */
        async setTemplateStatus(id, status) {
            return setTemplateStatusFile(this.templatesRoot, id, status);
        }
        /**
         * Remove one template; the whole history directory goes with it and no
         * file is left to dangle. Removing an unknown id is a no-op.
         * @param id - the template id.
         */
        async deleteTemplate(id) {
            await deleteTemplateFile(this.templatesRoot, id);
        }
        /**
         * Read one template's history snapshots, newest version first. Malformed
         * snapshot files are skipped, never surfaced as records.
         * @param id - the template whose history to read.
         * @returns the snapshots.
         */
        async getTemplateHistory(id) {
            return { entries: await readTemplateHistory(this.templatesRoot, id) };
        }
        /**
         * Replace the shared tag list wholesale, stripping every reference to a
         * removed tag from the stored records in the same commit.
         * @param tags - the complete next tag list; names must be unique.
         * @returns the stored tag list.
         */
        async putTemplateTags(tags) {
            return putTemplateTagsFile(this.templatesRoot, tags);
        }
        /**
         * Build the portable pack document for the given ids. Read-only; the
         * caller downloads it as the import/export file.
         * @param ids - the template ids to export; empty exports the whole library.
         * @returns the pack document.
         */
        async exportTemplates(ids) {
            return exportTemplatePack(this.templatesRoot, ids, new Date().toISOString());
        }
        /**
         * Import one pack document. Entries are independent: a rejected entry is
         * named in the summary while the rest land. A conflicting id resolves per
         * the strategy.
         * @param pack - the parsed pack document from the browser.
         * @param strategy - the conflict resolution for ids that already exist.
         * @returns the per-bucket summary.
         */
        async importTemplates(pack, strategy) {
            return importTemplatePack(this.templatesRoot, pack, strategy);
        }
        /**
         * Run one template AI operation (skeleton generation, body optimization,
         * or variable extraction). Explicit per call, queued one at a time, rate
         * limits retried with backoff; nothing is persisted here — the caller
         * previews the draft and stores it only through an explicit save.
         * @param request - the operation and its input.
         * @returns the draft with its prompt version.
         */
        async processTemplateAi(request) {
            return this.templateAi.process(request);
        }
        /**
         * Read the theme's `_review.json` manifest.
         * @param theme - outputs-project directory name.
         * @returns the manifest (null when absent) with only valid snapshots and
         *   tasks, every dropped one named in `problems`; callers must not write
         *   back while `problems` is non-empty.
         */
        async readReviewManifest(theme) {
            return readReviewManifestFile(this.root, theme);
        }
        /**
         * Replace the theme's `_review.json` manifest with an atomic, locked
         * commit, refreshing the theme's rows in the global `_review-index.json`.
         * Snapshot appends, bindings, baseline edits, and task retries all ride
         * full-manifest writes; the store rejects wholesale rather than repairing.
         * @param theme - outputs-project directory name.
         * @param manifest - the complete next manifest.
         */
        async writeReviewManifest(theme, manifest) {
            await writeReviewManifestFile(this.root, theme, manifest);
        }
        /**
         * Read the global `_review-index.json` aggregation aid for the history
         * list. A malformed file reads as empty with the rejection named — the
         * next manifest write rebuilds the theme's rows.
         * @returns the index plus the parse problems.
         */
        async listReviewIndex() {
            return readReviewIndexFile(this.root);
        }
        /**
         * Parse one platform export file into an import preview: mapped rows,
         * per-row rejections, and the unmatched columns. Nothing is stored — the
         * caller confirms with the user before the commit face lands rows.
         * @param request - the platform, file name, and raw CSV text.
         * @returns the preview.
         */
        async parseReviewImport(request) {
            return parseImportFile(request);
        }
        /**
         * Commit confirmed import rows as snapshots: new works append, a known
         * work re-imported on the same UTC day overwrites that day's snapshot
         * (idempotent), historical days are never rewritten.
         * @param request - the theme, platform, and confirmed rows.
         * @returns the append and overwrite accounting.
         */
        async commitReviewImport(request) {
            return commitReviewImportFile(this.root, request);
        }
        /**
         * Remove one review task and delete its report file. Snapshots and
         * bindings survive — other tasks and the dashboard reuse them. An unknown
         * id rejects so a stale UI cannot silently no-op.
         * @param request - the theme and the task id.
         */
        async deleteReviewTask(request) {
            await deleteReviewTaskFile(this.root, request.theme, request.taskId);
        }
        /**
         * Write one report file under `assets/review/reports/`. Every save lands a
         * new file — the generated original is never overwritten.
         * @param theme - outputs-project directory name.
         * @param file - plain report file name (`report-<taskId>-<ts>.md`).
         * @param content - the complete report markdown.
         * @returns the stored file name, relative to `assets/review/`.
         */
        async writeReviewReport(theme, file, content) {
            return writeReviewReportFile(this.root, theme, file, content);
        }
        /**
         * Read one report file back for the viewer and editor.
         * @returns the markdown, or an empty record when the file does not exist.
         */
        async readReviewReport(theme, file) {
            return readReviewReportFile(this.root, theme, file);
        }
        /**
         * Save one viral-work template under `assets/review/templates/`.
         * @param theme - outputs-project directory name.
         * @param file - plain template file name.
         * @param content - the template markdown.
         * @returns the stored file name, relative to `assets/review/`.
         */
        async writeReviewTemplate(theme, file, content) {
            return writeReviewTemplateFile(this.root, theme, file, content);
        }
        /**
         * List saved template file names under `assets/review/templates/`.
         * @param theme - outputs-project directory name.
         * @returns the sorted plain file names.
         */
        async listReviewTemplates(theme) {
            return { files: await listReviewTemplatesFile(this.root, theme) };
        }
        /**
         * Read one saved template's content.
         * @returns the markdown, or an empty record when the file does not exist.
         */
        async readReviewTemplate(theme, file) {
            return readReviewTemplateFile(this.root, theme, file);
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
        async analyzeReviewWork(request) {
            return this.reviewAi.analyzeWork(request);
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
        async generateReviewReport(request) {
            return this.reviewAi.generateReport(request);
        }
        /**
         * Read the library-root `_interactions.json` manifest: the conversation
         * inbox, the AI insights, and the derived summary cache.
         * @returns the manifest (null when absent) with only valid conversations,
         *   every dropped one named in `problems`; callers must not write back
         *   while `problems` is non-empty.
         */
        async readInteractions() {
            return readInteractionsFile(this.root);
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
        async writeInteractions(manifest) {
            return writeInteractionsFile(this.root, manifest);
        }
        /**
         * Parse one fan-interaction export file into an import preview: validated
         * message rows plus per-row rejections. Nothing is stored — the caller
         * confirms with the user before the commit face lands rows.
         * @param request - the file name and raw CSV text (browser-decoded).
         * @returns the preview.
         */
        async parseInteractionImport(request) {
            return parseInteractionImportText(request);
        }
        /**
         * Commit confirmed import rows: messages group into conversations by
         * `platform + external_user_id`, dedupe by `platform + external_message_id`
         * (a known id updates in place), and threading resolves against the
         * library plus the batch — unresolved parents stay with a named warning.
         * @param request - the confirmed rows.
         * @returns the append/update accounting and thread warnings.
         */
        async commitInteractionImport(request) {
            return commitInteractionImportFile(this.root, request);
        }
        /**
         * Generate the fixed three-candidate reply draft set for one fan message.
         * The persona digest and samples layer the tone base; the style parameter
         * loses to the persona on conflict. Explicit per call, queued one at a
         * time, rate limits retried with backoff; charges one daily generation.
         * @param request - the thread, tone, persona facts, and template skeleton.
         * @returns the drafts with their provenance.
         */
        async generateInteractionReply(request) {
            await this.createQuota.consumeGenerate(1);
            return this.interactionAi.replyDrafts(request);
        }
        /**
         * Classify one batch of fan messages along the two orthogonal taggings
         * (sentiment, intent). Explicit per call, queued one at a time; charges
         * one daily generation per fifty messages. A garbled batch degrades to
         * unknowns rather than failing the caller's loop.
         * @param request - at most fifty messages.
         * @returns the sanitized entries with their provenance.
         */
        async classifyInteractions(request) {
            await this.createQuota.consumeGenerate(Math.max(1, Math.ceil(request.messages.length / 50)));
            return this.interactionAi.classify(request);
        }
        /**
         * Extract one insight batch (questions, pain points, interests) from fan
         * messages. Explicit per call, queued one at a time; charges one daily
         * generation per batch. A garbled batch reads as empty — the caller's
         * merge records it and keeps going.
         * @param request - at most two hundred messages.
         * @returns the sanitized batch with its provenance.
         */
        async extractInteractionInsights(request) {
            await this.createQuota.consumeGenerate(1);
            return this.interactionAi.insights(request);
        }
        /**
         * Push one archived reply outward through the reserved MCP channel. No
         * provider exists this phase, so the call always refuses with
         * `MCP_NOT_CONFIGURED` — the caller's local archive already happened and
         * never depended on this result.
         * @param request - the conversation, threading, reply text, and persona.
         * @returns the refusal the toast renders.
         */
        async sendInteractionReply(request) {
            return stubInteractionChannel.sendReply(request);
        }
        /**
         * Build the whole-inbox export CSV: the import columns plus
         * `conversation_id`, `status`, and `tags`, BOM first and CRLF lines, so
         * the file round-trips through the import face unchanged. Nothing is
         * stored — the caller writes the text where the user aimed it.
         * @returns the complete CSV text with BOM.
         */
        async exportInteractionCsv() {
            const { manifest } = await readInteractionsFile(this.root);
            return { text: buildInteractionExportCsv(manifest?.conversations ?? []) };
        }
    };
})();
export { ContentOutputsGateway };
export default ContentOutputsGateway;
//# sourceMappingURL=index.js.map