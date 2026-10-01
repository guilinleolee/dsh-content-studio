import contentOutputsRemote from '@deepseek-ai/dsh-content-outputs/remote';
import contentScheduleRemote from '@deepseek-ai/dsh-content-schedule/remote';
import contentTopicsRemote from '@deepseek-ai/dsh-content-topics/remote';
import { createContentStudioController } from "./studio-store.js";
import { StudioEntry } from "./StudioEntry.js";
import { ContentStudio } from "./ContentStudio.js";
import { createGatherController } from "./gather/gather-store.js";
import { createPersonaController } from "./persona/persona-store.js";
import { createTemplateController } from "./template/template-store.js";
import { createPublishController } from "./publish/publish-store.js";
import { createReviewController } from "./review/review-store.js";
import { createInteractionController } from "./interaction/interaction-store.js";
import { en, zh } from "./locales.js";
export { createContentStudioController } from "./studio-store.js";
export { CAPABILITY_ITEMS, STUDIO_TABS, capabilityGroups } from "./capabilities.js";
export { createGatherController } from "./gather/gather-store.js";
export { createPersonaController } from "./persona/persona-store.js";
export { createTemplateController } from "./template/template-store.js";
export { createPublishController } from "./publish/publish-store.js";
export { createReviewController } from "./review/review-store.js";
export { createInteractionController } from "./interaction/interaction-store.js";
export { PLATFORM_PROFILES, manuscriptCards, platformProfileOf, formatTags, dueScheduledTasks } from "./publish/model.js";
export { DEFAULT_TOPIC_BANK_CONFIG, TOPIC_BANK_CONFIG_VERSION, TOPIC_SOURCE_TYPES, TOPIC_STATUSES, collectTags, filterTopics, formatScore, groupByStatus, gatherMaterialToTopicInput, loadTopicBankConfig, manualTopicInput, parseTopicsMarkdown, planWindowRange, saveTopicBankConfig, topicInputOf, topicToMarkdown, topicsToMarkdown, weekStart, withAppendedTags, } from "./topic-bank.js";
/** Dictionary namespace owned by this plugin. */
const NS = 'content-studio';
/**
 * Services required by the Content Studio plugin. The Remote namespaces are
 * mounted by this plugin's own apply (not waited on as services): the mount
 * completes before the slot registrations below run.
 */
export const inject = ['slots', 'locale', 'remote'];
async function unwrap(label, call) {
    const result = await call;
    if (!result.ok)
        throw new Error(`${label} failed: ${result.error.code}: ${result.error.message}`);
    return result.value;
}
/**
 * Mount the plugin's own Remote contributions, then run the workbench body on
 * a fiber that declares every mounted namespace by its exact service name.
 * Cordis snapshots a namespace service only into fibers whose inject lists
 * that name (`remote.contentOutputs`), so a consumer that merely injects
 * `remote` — including this plugin's own apply fiber, a sibling of each
 * namespace fiber — never resolves it and every gateway call dies with
 * "cannot get property ... without inject". The mount runs first so the
 * namespace services exist before the workbench fiber waits on them; Cordis
 * unloads and re-runs the workbench body if a namespace unmounts.
 * @param ctx - client root context.
 */
export async function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-content-studio: dictionaries');
    const mountDisposers = [];
    try {
        for (const contribution of [contentOutputsRemote, contentScheduleRemote, contentTopicsRemote]) {
            mountDisposers.push(await ctx.remote.$mount(contribution));
        }
    }
    catch (error) {
        for (const dispose of mountDisposers.reverse())
            await dispose();
        throw error;
    }
    const workbench = await ctx.plugin({
        name: 'ui-content-studio:workbench',
        inject: ['slots', 'locale', 'remote', 'remote.contentOutputs', 'remote.contentSchedule', 'remote.contentTopics'],
        apply: workbenchCtx => mainApply(workbenchCtx),
    });
    return async () => {
        await workbench.dispose();
        for (const dispose of mountDisposers.reverse())
            await dispose();
    };
}
/**
 * The workbench body: the controllers, the gateway closures, and the two slot
 * registrations (sidebar entry + frame-wide surface), on the fiber that
 * declared the Remote namespaces. The slot registrations unwind with this
 * fiber — the `slots.inject` generator owns their lifetime — so there is no
 * separate disposer.
 * @param ctx - the workbench fiber's context.
 */
function mainApply(ctx) {
    const studio = createContentStudioController();
    const listOutputs = async () => {
        const result = await ctx.remote.contentOutputs.list();
        if (!result.ok) {
            throw new Error(`contentOutputs.list failed: ${result.error.code}: ${result.error.message}`);
        }
        return result.value;
    };
    const listThemes = async () => {
        const snapshot = await listOutputs();
        return snapshot.projects.map(project => project.topic);
    };
    const create = {
        readCreateState: theme => unwrap('contentOutputs.readCreateState', ctx.remote.contentOutputs.readCreateState(theme)),
        writeCreateState: (theme, manifest) => unwrap('contentOutputs.writeCreateState', ctx.remote.contentOutputs.writeCreateState(theme, manifest)),
        writeAsset: (theme, file, content) => unwrap('contentOutputs.writeAsset', ctx.remote.contentOutputs.writeAsset({ theme, file, content })),
        publishCreateFinal: (theme, request) => unwrap('contentOutputs.publishCreateFinal', ctx.remote.contentOutputs.publishCreateFinal(theme, request)),
        registerCreatePublish: (theme, request) => unwrap('contentOutputs.registerCreatePublish', ctx.remote.contentOutputs.registerCreatePublish(theme, request)),
        readCreateMetadata: theme => unwrap('contentOutputs.readCreateMetadata', ctx.remote.contentOutputs.readCreateMetadata(theme)),
        writeCreateMetadata: (theme, metadata) => unwrap('contentOutputs.writeCreateMetadata', ctx.remote.contentOutputs.writeCreateMetadata(theme, metadata)),
        generateCreateContent: request => unwrap('contentOutputs.generateCreateContent', ctx.remote.contentOutputs.generateCreateContent(request)),
        rewriteCreateSelection: request => unwrap('contentOutputs.rewriteCreateSelection', ctx.remote.contentOutputs.rewriteCreateSelection(request)),
        evaluateCreateContent: request => unwrap('contentOutputs.evaluateCreateContent', ctx.remote.contentOutputs.evaluateCreateContent(request)),
        listCreateAssets: theme => unwrap('contentOutputs.listCreateAssets', ctx.remote.contentOutputs.listCreateAssets(theme)),
        listCreateTemplates: () => unwrap('contentOutputs.listCreateTemplates', ctx.remote.contentOutputs.listCreateTemplates()),
        putCreateTemplate: input => unwrap('contentOutputs.putCreateTemplate', ctx.remote.contentOutputs.putCreateTemplate(input)),
        deleteCreateTemplate: id => unwrap('contentOutputs.deleteCreateTemplate', ctx.remote.contentOutputs.deleteCreateTemplate(id)),
    };
    const schedule = {
        list: async () => {
            const result = await ctx.remote.contentSchedule.list();
            if (!result.ok)
                throw new Error(`contentSchedule.list failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
        put: async (input) => {
            const result = await ctx.remote.contentSchedule.put(input);
            if (!result.ok)
                throw new Error(`contentSchedule.put failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
        remove: async (id) => {
            const result = await ctx.remote.contentSchedule.delete(id);
            if (!result.ok)
                throw new Error(`contentSchedule.delete failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
    };
    const notes = {
        list: () => unwrap('contentSchedule.getNotes', ctx.remote.contentSchedule.getNotes()),
        put: (id, text) => unwrap('contentSchedule.putNote', ctx.remote.contentSchedule.putNote(id, text)),
    };
    const topics = {
        list: () => unwrap('contentTopics.list', ctx.remote.contentTopics.list()),
        put: input => unwrap('contentTopics.put', ctx.remote.contentTopics.put(input)),
        remove: id => unwrap('contentTopics.delete', ctx.remote.contentTopics.delete(id)),
    };
    // The topic bank's Markdown export reuses contentOutputs' guarded asset
    // write — no second file-write face for the plugin.
    const writeExport = (theme, file, content) => unwrap('contentOutputs.writeAsset', ctx.remote.contentOutputs.writeAsset({ theme, file, content }));
    const gatherGateway = {
        fetchFeed: async (request) => {
            const result = await ctx.remote.contentOutputs.fetchFeed(request);
            if (!result.ok)
                throw new Error(`contentOutputs.fetchFeed failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
        writeAsset: async (write) => {
            const result = await ctx.remote.contentOutputs.writeAsset(write);
            if (!result.ok)
                throw new Error(`contentOutputs.writeAsset failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
        readAsset: async (theme, file) => {
            const result = await ctx.remote.contentOutputs.readAsset(theme, file);
            if (!result.ok)
                throw new Error(`contentOutputs.readAsset failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
        readManifest: async (theme) => {
            const result = await ctx.remote.contentOutputs.readGatherManifest(theme);
            if (!result.ok)
                throw new Error(`contentOutputs.readGatherManifest failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
        writeManifest: async (theme, manifest) => {
            const result = await ctx.remote.contentOutputs.writeGatherManifest(theme, manifest);
            if (!result.ok)
                throw new Error(`contentOutputs.writeGatherManifest failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
        moveAsset: async (move) => {
            const result = await ctx.remote.contentOutputs.moveAsset(move);
            if (!result.ok)
                throw new Error(`contentOutputs.moveAsset failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
        deleteAsset: async (theme, file) => {
            const result = await ctx.remote.contentOutputs.deleteAsset(theme, file);
            if (!result.ok)
                throw new Error(`contentOutputs.deleteAsset failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
        processMaterial: async (request) => {
            const result = await ctx.remote.contentOutputs.processMaterial(request);
            if (!result.ok)
                throw new Error(`contentOutputs.processMaterial failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
    };
    const gather = createGatherController({ gateway: gatherGateway, listOutputs, schedulePut: input => schedule.put(input) });
    // The persona face: the `_personas.json` manifest plus the explicit AI
    // helpers, on the same contentOutputs Remote as every other write face.
    const personas = createPersonaController({
        gateway: {
            listPersonas: () => unwrap('contentOutputs.listPersonas', ctx.remote.contentOutputs.listPersonas()),
            getPersona: id => unwrap('contentOutputs.getPersona', ctx.remote.contentOutputs.getPersona(id)),
            putPersona: input => unwrap('contentOutputs.putPersona', ctx.remote.contentOutputs.putPersona(input)),
            putPersonaReport: (id, report) => unwrap('contentOutputs.putPersonaReport', ctx.remote.contentOutputs.putPersonaReport(id, report)),
            deletePersona: id => unwrap('contentOutputs.deletePersona', ctx.remote.contentOutputs.deletePersona(id)),
            // The generated Remote returns the plain result union; the view face
            // narrows it per operation at this typed boundary.
            processPersonaAi: async (request) => {
                const result = await unwrap('contentOutputs.processPersonaAi', ctx.remote.contentOutputs.processPersonaAi(request));
                return result;
            },
        },
    });
    const competitors = {
        // The benchmark side's 收录为选题 rides the shared topic-bank face.
        topics,
        readCompetitorManifest: async (theme) => {
            const result = await ctx.remote.contentOutputs.readCompetitorManifest(theme);
            if (!result.ok)
                throw new Error(`contentOutputs.readCompetitorManifest failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
        writeCompetitorManifest: async (theme, manifest) => {
            const result = await ctx.remote.contentOutputs.writeCompetitorManifest(theme, manifest);
            if (!result.ok)
                throw new Error(`contentOutputs.writeCompetitorManifest failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
        writeAsset: async (write) => {
            const result = await ctx.remote.contentOutputs.writeAsset(write);
            if (!result.ok)
                throw new Error(`contentOutputs.writeAsset failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
        deleteAsset: async (theme, file) => {
            const result = await ctx.remote.contentOutputs.deleteAsset(theme, file);
            if (!result.ok)
                throw new Error(`contentOutputs.deleteAsset failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
        readAsset: async (theme, file) => {
            const result = await ctx.remote.contentOutputs.readAsset(theme, file);
            if (!result.ok)
                throw new Error(`contentOutputs.readAsset failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
        analyzeCompetitorWork: async (request) => {
            const result = await ctx.remote.contentOutputs.analyzeCompetitorWork(request);
            if (!result.ok)
                throw new Error(`contentOutputs.analyzeCompetitorWork failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
        generateCompetitorReport: async (request) => {
            const result = await ctx.remote.contentOutputs.generateCompetitorReport(request);
            if (!result.ok)
                throw new Error(`contentOutputs.generateCompetitorReport failed: ${result.error.code}: ${result.error.message}`);
            return result.value;
        },
    };
    // The publish face: the theme-side `_publish.json` manifests, the global
    // index, the account cards, the derived drafts, and the per-platform AI
    // adaptation — plus the calendar and topic faces for schedule and reflow.
    const publish = createPublishController({
        gateway: {
            readPublishManifest: theme => unwrap('contentOutputs.readPublishManifest', ctx.remote.contentOutputs.readPublishManifest(theme)),
            writePublishManifest: (theme, manifest) => unwrap('contentOutputs.writePublishManifest', ctx.remote.contentOutputs.writePublishManifest(theme, manifest)),
            listPublishIndex: () => unwrap('contentOutputs.listPublishIndex', ctx.remote.contentOutputs.listPublishIndex()),
            readPublishProfiles: () => unwrap('contentOutputs.readPublishProfiles', ctx.remote.contentOutputs.readPublishProfiles()),
            writePublishProfiles: profiles => unwrap('contentOutputs.writePublishProfiles', ctx.remote.contentOutputs.writePublishProfiles(profiles)),
            writePublishDerived: (theme, taskId, platformId, content) => unwrap('contentOutputs.writePublishDerived', ctx.remote.contentOutputs.writePublishDerived(theme, taskId, platformId, content)),
            readPublishDerived: (theme, taskId, platformId) => unwrap('contentOutputs.readPublishDerived', ctx.remote.contentOutputs.readPublishDerived(theme, taskId, platformId)),
            readPublishSource: (theme, file) => unwrap('contentOutputs.readPublishSource', ctx.remote.contentOutputs.readPublishSource(theme, file)),
            buildPublishPackage: (theme, taskId) => unwrap('contentOutputs.buildPublishPackage', ctx.remote.contentOutputs.buildPublishPackage(theme, taskId)),
            adaptPublishContent: request => unwrap('contentOutputs.adaptPublishContent', ctx.remote.contentOutputs.adaptPublishContent(request)),
        },
        listOutputs,
        schedule,
        topics,
    });
    // The template-library face: the global template assets plus the picker
    // controller the columns share, on the same contentOutputs Remote.
    const templates = createTemplateController({
        gateway: {
            listTemplates: () => unwrap('contentOutputs.listTemplates', ctx.remote.contentOutputs.listTemplates()),
            putTemplate: input => unwrap('contentOutputs.putTemplate', ctx.remote.contentOutputs.putTemplate(input)),
            setTemplateStatus: (id, status) => unwrap('contentOutputs.setTemplateStatus', ctx.remote.contentOutputs.setTemplateStatus(id, status)),
            deleteTemplate: id => unwrap('contentOutputs.deleteTemplate', ctx.remote.contentOutputs.deleteTemplate(id)),
            getTemplateHistory: id => unwrap('contentOutputs.getTemplateHistory', ctx.remote.contentOutputs.getTemplateHistory(id)),
            putTemplateTags: tags => unwrap('contentOutputs.putTemplateTags', ctx.remote.contentOutputs.putTemplateTags(tags)),
            exportTemplates: ids => unwrap('contentOutputs.exportTemplates', ctx.remote.contentOutputs.exportTemplates(ids)),
            importTemplates: (pack, strategy) => unwrap('contentOutputs.importTemplates', ctx.remote.contentOutputs.importTemplates(pack, strategy)),
            processTemplateAi: request => unwrap('contentOutputs.processTemplateAi', ctx.remote.contentOutputs.processTemplateAi(request)),
        },
    });
    // The review face: the `_review.json` manifest, the two-step import, the
    // report and template files, and the explicit AI calls — plus the topic
    // face for the reflow.
    const review = createReviewController({
        readReviewManifest: theme => unwrap('contentOutputs.readReviewManifest', ctx.remote.contentOutputs.readReviewManifest(theme)),
        writeReviewManifest: (theme, manifest) => unwrap('contentOutputs.writeReviewManifest', ctx.remote.contentOutputs.writeReviewManifest(theme, manifest)),
        parseReviewImport: request => unwrap('contentOutputs.parseReviewImport', ctx.remote.contentOutputs.parseReviewImport(request)),
        commitReviewImport: request => unwrap('contentOutputs.commitReviewImport', ctx.remote.contentOutputs.commitReviewImport(request)),
        deleteReviewTask: request => unwrap('contentOutputs.deleteReviewTask', ctx.remote.contentOutputs.deleteReviewTask(request)),
        writeReviewReport: (theme, file, content) => unwrap('contentOutputs.writeReviewReport', ctx.remote.contentOutputs.writeReviewReport(theme, file, content)),
        readReviewReport: (theme, file) => unwrap('contentOutputs.readReviewReport', ctx.remote.contentOutputs.readReviewReport(theme, file)),
        writeReviewTemplate: (theme, file, content) => unwrap('contentOutputs.writeReviewTemplate', ctx.remote.contentOutputs.writeReviewTemplate(theme, file, content)),
        listReviewTemplates: theme => unwrap('contentOutputs.listReviewTemplates', ctx.remote.contentOutputs.listReviewTemplates(theme)),
        analyzeReviewWork: request => unwrap('contentOutputs.analyzeReviewWork', ctx.remote.contentOutputs.analyzeReviewWork(request)),
        generateReviewReport: request => unwrap('contentOutputs.generateReviewReport', ctx.remote.contentOutputs.generateReviewReport(request)),
    }, topics);
    // The interaction face: the `_interactions.json` inbox manifest, the
    // two-step CSV import, the reply/classify/insight AI, and the reserved
    // MCP send knock — plus the topic and export faces for the reflows.
    // Raw manifest reads for the workbench home: the dashboard aggregates
    // across columns without pulling the controllers' session state.
    const readInteractions = () => unwrap('contentOutputs.readInteractions', ctx.remote.contentOutputs.readInteractions());
    const readReviewManifest = theme => unwrap('contentOutputs.readReviewManifest', ctx.remote.contentOutputs.readReviewManifest(theme));
    const interaction = createInteractionController({
        readInteractions: () => unwrap('contentOutputs.readInteractions', ctx.remote.contentOutputs.readInteractions()),
        writeInteractions: manifest => unwrap('contentOutputs.writeInteractions', ctx.remote.contentOutputs.writeInteractions(manifest)),
        parseInteractionImport: request => unwrap('contentOutputs.parseInteractionImport', ctx.remote.contentOutputs.parseInteractionImport(request)),
        commitInteractionImport: request => unwrap('contentOutputs.commitInteractionImport', ctx.remote.contentOutputs.commitInteractionImport(request)),
        generateInteractionReply: request => unwrap('contentOutputs.generateInteractionReply', ctx.remote.contentOutputs.generateInteractionReply(request)),
        classifyInteractions: request => unwrap('contentOutputs.classifyInteractions', ctx.remote.contentOutputs.classifyInteractions(request)),
        extractInteractionInsights: request => unwrap('contentOutputs.extractInteractionInsights', ctx.remote.contentOutputs.extractInteractionInsights(request)),
        exportInteractionCsv: () => unwrap('contentOutputs.exportInteractionCsv', ctx.remote.contentOutputs.exportInteractionCsv()),
        sendInteractionReply: request => unwrap('contentOutputs.sendInteractionReply', ctx.remote.contentOutputs.sendInteractionReply(request)),
    }, topics, writeExport);
    ctx.slots.inject('sidebar.footer.action', function* () {
        yield ctx.slots.register({
            name: 'sidebar.footer.action',
            id: 'content-studio-entry',
            locale: NS,
            inject: () => ({ studio }),
        }, StudioEntry);
        yield ctx.slots.register({
            name: 'shell.overlay',
            id: 'content-studio',
            order: 50,
            locale: NS,
            inject: () => ({
                studio, listOutputs, gather, schedule, notes, competitors, create, personas, listThemes,
                topics, writeExport, publish, review, interaction, readInteractions, readReviewManifest,
                templates,
            }),
        }, ContentStudio);
    });
}
//# sourceMappingURL=index.js.map