/**
 * The gather view controller: one observable state object backed by browser
 * storage (sources, tasks, logs) and the on-disk manifests (materials),
 * plus the front-side scheduler. The scheduler exists only while the
 * workbench is open — a master tick runs due interval tasks, visibility
 * changes pause and resume it, and reopening after a gap runs every overdue
 * task once with its `since` cursor. That is compensation, not background
 * polling: closing the workbench stops everything.
 *
 * All manifest writes funnel through one sequential run queue, so two task
 * runs can never interleave their read-modify-write cycles; user state on
 * materials survives every run because merges never touch existing entries.
 * A failing fetch keeps the source's materials, marks the task `failed`,
 * and starts the exponential failure backoff for that source.
 */
import type { GatherMaterial } from '@deepseek-ai/dsh-content-outputs/types';
import type { ScheduleItemInput } from '@deepseek-ai/dsh-content-schedule/types';
import type { GatherGateway, GatherSource, GatherTask, GatherTaskView } from './types.ts';
/** The gather view controller created by {@link createGatherController}. */
export type GatherController = ReturnType<typeof createGatherController>;
/** Injected server face plus the calendar push the view offers. */
export interface GatherControllerDeps {
    readonly gateway: GatherGateway;
    /** The workbench's existing outputs read, for the theme list. */
    readonly listOutputs: () => Promise<{
        projects: ReadonlyArray<{
            topic: string;
        }>;
    }>;
    /** The workbench's existing calendar write, for 加入内容日历. */
    readonly schedulePut: (input: ScheduleItemInput) => Promise<unknown>;
}
/** Snapshot the React surface subscribes to. */
export interface GatherState {
    readonly sources: readonly GatherSource[];
    readonly tasks: readonly GatherTaskView[];
    readonly themes: readonly string[];
    /** Materials of the selected theme, as the manifest stores them. */
    readonly materials: readonly GatherMaterial[];
    readonly selectedTheme: string | null;
    /** Material the detail pane shows, or null. */
    readonly selectedMaterialId: string | null;
    /** True while a manifest read for the selected theme is in flight. */
    readonly loadingMaterials: boolean;
    /** False once a storage write was demoted to memory (quota / private mode). */
    readonly storagePersistent: boolean;
    /** One-line user-facing outcome of the last action (error or info). */
    readonly notice: string | null;
}
/**
 * Create the gather controller. The browser half creates one instance in
 * apply() and injects it into the surface, like the open/close controller.
 * @param deps - the injected server face.
 * @returns the controller with its state, actions, and lifecycle.
 */
export declare function createGatherController(deps: GatherControllerDeps): {
    subscribe(listener: () => void): () => void;
    getState(): GatherState;
    start(): void;
    dispose(): void;
    refreshThemes(): Promise<void>;
    selectTheme(theme: string | null): Promise<void>;
    selectMaterial(id: string | null): void;
    readBody(theme: string, file: string): Promise<string | null>;
    showNotice(message: string): void;
    dismissNotice(): void;
    addSource(input: {
        name: string;
        url: string;
        intervalMinutes: number;
        tags: readonly string[];
        excludeKeywords: readonly string[];
    }): void;
    updateSource(id: string, patch: Partial<Pick<GatherSource, 'name' | 'url' | 'intervalMinutes' | 'enabled' | 'tags' | 'excludeKeywords'>>): void;
    removeSource(id: string): void;
    testSource(id: string): Promise<{
        ok: boolean;
        detail: string;
    }>;
    importSources(inputs: ReadonlyArray<{
        name: string;
        url: string;
        tags: readonly string[];
    }>): number;
    addTask(input: {
        name: string;
        sourceIds: readonly string[];
        themeName: string;
        maxItemsPerRun: number;
        since: string | null;
        includeKeywords: readonly string[];
        excludeKeywords: readonly string[];
        aiEnabled: boolean;
        intervalMinutes: number | null;
    }): void;
    updateTask(id: string, patch: Partial<Pick<GatherTask, 'name' | 'intervalMinutes' | 'sourceIds'>>): void;
    removeTask(id: string): void;
    triggerTask(id: string): Promise<void>;
    markRead(id: string): Promise<void>;
    toggleFavorite(id: string): Promise<void>;
    markPicked(id: string): Promise<void>;
    addExcerpt(id: string, excerpt: string): Promise<void>;
    bindTheme(id: string, nextTheme: string): Promise<void>;
    processWithAi(id: string): Promise<void>;
    pushToCalendar(id: string, date: string): Promise<void>;
};
//# sourceMappingURL=gather-store.d.ts.map