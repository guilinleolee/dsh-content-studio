import contentOutputsRemote from '@deepseek-ai/dsh-content-outputs/remote';
import contentScheduleRemote from '@deepseek-ai/dsh-content-schedule/remote';
import contentTopicsRemote from '@deepseek-ai/dsh-content-topics/remote';
import { createContentStudioController } from "./studio-store.js";
import { StudioEntry } from "./StudioEntry.js";
import { ContentStudio } from "./ContentStudio.js";
import { createGatherController } from "./gather/gather-store.js";
import { createPersonaController } from "./persona/persona-store.js";
import { en, zh } from "./locales.js";
export { createContentStudioController } from "./studio-store.js";
export { CAPABILITY_ITEMS, STUDIO_TABS, capabilityGroups } from "./capabilities.js";
export { createGatherController } from "./gather/gather-store.js";
export { createPersonaController } from "./persona/persona-store.js";
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
 * Mount the plugin's own Remote contributions, then register the sidebar
 * entry and the workbench surface once their slot declarations are on the
 * ledger; both registrations install and roll back atomically through one
 * generator. The mounts unwound in reverse order after every registration.
 * @param ctx - client root context.
 */
export async function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-content-studio: dictionaries');
    const disposers = [];
    try {
        for (const contribution of [contentOutputsRemote, contentScheduleRemote, contentTopicsRemote]) {
            disposers.push(await ctx.remote.$mount(contribution));
        }
    }
    catch (error) {
        for (const dispose of disposers.reverse())
            await dispose();
        throw error;
    }
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
            inject: () => ({ studio, listOutputs, gather, schedule, competitors, create, personas, listThemes, topics, writeExport }),
        }, ContentStudio);
    });
    return async () => {
        for (const dispose of disposers.reverse())
            await dispose();
    };
}
//# sourceMappingURL=index.js.map