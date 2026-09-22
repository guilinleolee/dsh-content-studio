import contentOutputsRemote from '@deepseek-ai/dsh-content-outputs/remote';
import contentScheduleRemote from '@deepseek-ai/dsh-content-schedule/remote';
import { createContentStudioController } from "./studio-store.js";
import { StudioEntry } from "./StudioEntry.js";
import { ContentStudio } from "./ContentStudio.js";
import { en, zh } from "./locales.js";
export { createContentStudioController } from "./studio-store.js";
export { CAPABILITY_ITEMS, STUDIO_TABS, capabilityGroups } from "./capabilities.js";
/** Dictionary namespace owned by this plugin. */
const NS = 'content-studio';
/**
 * Services required by the Content Studio plugin. The two Remote namespaces
 * are mounted by this plugin's own apply (not waited on as services): the
 * mount completes before the slot registrations below run.
 */
export const inject = ['slots', 'locale', 'remote'];
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
        for (const contribution of [contentOutputsRemote, contentScheduleRemote]) {
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
            inject: () => ({ studio, listOutputs, schedule }),
        }, ContentStudio);
    });
    return async () => {
        for (const dispose of disposers.reverse())
            await dispose();
    };
}
//# sourceMappingURL=index.js.map