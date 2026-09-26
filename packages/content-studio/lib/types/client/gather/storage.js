/**
 * Browser storage for the gather view: sources and tasks under one
 * `content-studio.gather.` namespace, read and written through this module
 * only. A failed write (quota, private mode) degrades to in-memory keeping
 * with `persistent: false` so the UI can say so; a missing key rebuilds the
 * default state. Clearing browser data loses only sources and tasks —
 * materials live in the on-disk manifest and survive.
 */
/** Maximum number of configured sources. */
export const GATHER_SOURCE_LIMIT = 100;
/** Storage-key prefix owned by the gather view. */
export const GATHER_STORAGE_PREFIX = 'content-studio.gather.';
const SOURCES_KEY = `${GATHER_STORAGE_PREFIX}sources`;
const TASKS_KEY = `${GATHER_STORAGE_PREFIX}tasks`;
function parseJsonList(raw) {
    if (raw === null)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        // A corrupted list rebuilds as empty, like a missing one.
        return [];
    }
}
/** Structural guard for one stored source; unknown shapes are dropped. */
function isSource(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return typeof record.id === 'string' && record.id.length > 0
        && typeof record.name === 'string' && record.name.length > 0
        && typeof record.url === 'string' && record.url.length > 0
        && typeof record.intervalMinutes === 'number' && record.intervalMinutes >= 30
        && typeof record.enabled === 'boolean'
        && Array.isArray(record.tags) && record.tags.every(tag => typeof tag === 'string')
        && Array.isArray(record.excludeKeywords) && record.excludeKeywords.every(word => typeof word === 'string')
        && typeof record.createdAt === 'string'
        && (record.lastFetchedAt === null || typeof record.lastFetchedAt === 'string')
        && (record.lastStatus === null || record.lastStatus === 'ok' || record.lastStatus === 'failed')
        && typeof record.consecutiveFailures === 'number'
        && (record.etag === null || typeof record.etag === 'string')
        && (record.lastModified === null || typeof record.lastModified === 'string');
}
/** Structural guard for one stored task; `status` is runtime-only and never stored. */
function isTask(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    const log = record.log;
    return typeof record.id === 'string' && record.id.length > 0
        && typeof record.name === 'string' && record.name.length > 0
        && Array.isArray(record.sourceIds) && record.sourceIds.every(id => typeof id === 'string')
        && typeof record.themeName === 'string' && record.themeName.length > 0
        && typeof record.maxItemsPerRun === 'number' && record.maxItemsPerRun >= 1
        && (record.since === null || typeof record.since === 'string')
        && Array.isArray(record.includeKeywords) && record.includeKeywords.every(word => typeof word === 'string')
        && Array.isArray(record.excludeKeywords) && record.excludeKeywords.every(word => typeof word === 'string')
        && typeof record.aiEnabled === 'boolean'
        && (record.intervalMinutes === null || (typeof record.intervalMinutes === 'number' && record.intervalMinutes >= 30))
        && Array.isArray(log) && log.every(entry => typeof entry === 'object' && entry !== null);
}
/**
 * Create the gather storage facade.
 * @param backend - storage backend; defaults to `window.localStorage`, and a
 * caller can pass a stub for tests.
 * @returns the facade with the loaded state and a `persistent` flag that
 * turns false once a write has been demoted to memory.
 */
export function createGatherStorage(backend) {
    let store = backend
        ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    let persistent = store !== undefined;
    const decode = (key, guard) => {
        if (store === undefined)
            return [];
        return parseJsonList(store.getItem(key)).filter(guard);
    };
    return {
        load() {
            return {
                sources: decode(`${SOURCES_KEY}.v0`, isSource),
                tasks: decode(`${TASKS_KEY}.v0`, isTask),
            };
        },
        save(state) {
            if (store === undefined)
                return;
            try {
                store.setItem(`${SOURCES_KEY}.v0`, JSON.stringify(state.sources));
                store.setItem(`${TASKS_KEY}.v0`, JSON.stringify(state.tasks));
                persistent = true;
            }
            catch (error) {
                // Quota-exceeded or storage-disabled (private mode): keep serving
                // from memory and let the UI state the downgrade.
                store = undefined;
                persistent = false;
                console.warn('[content-studio] gather storage disabled, keeping state in memory:', error);
            }
        },
        get persistent() {
            return persistent;
        },
    };
}
//# sourceMappingURL=storage.js.map