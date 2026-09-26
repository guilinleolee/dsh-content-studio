/**
 * Browser storage for the gather view: sources and tasks under one
 * `content-studio.gather.` namespace, read and written through this module
 * only. A failed write (quota, private mode) degrades to in-memory keeping
 * with `persistent: false` so the UI can say so; a missing key rebuilds the
 * default state. Clearing browser data loses only sources and tasks —
 * materials live in the on-disk manifest and survive.
 */
import type { GatherSource, GatherTask } from './types.ts';
/** Maximum number of configured sources. */
export declare const GATHER_SOURCE_LIMIT = 100;
/** Storage-key prefix owned by the gather view. */
export declare const GATHER_STORAGE_PREFIX = "content-studio.gather.";
/** The minimal storage backend this module needs (localStorage satisfies it). */
export interface GatherStorageBackend {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
/** Whole persisted gather configuration. */
export interface GatherPersistedState {
    readonly sources: readonly GatherSource[];
    readonly tasks: readonly GatherTask[];
}
/**
 * Create the gather storage facade.
 * @param backend - storage backend; defaults to `window.localStorage`, and a
 * caller can pass a stub for tests.
 * @returns the facade with the loaded state and a `persistent` flag that
 * turns false once a write has been demoted to memory.
 */
export declare function createGatherStorage(backend?: GatherStorageBackend): {
    load(): GatherPersistedState;
    save(state: GatherPersistedState): void;
    readonly persistent: boolean;
};
//# sourceMappingURL=storage.d.ts.map