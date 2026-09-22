/**
 * The Content Studio capability catalog: the static dual-tab menu of creation
 * and operation verbs this plugin ships. Display copy lives in the locale
 * dictionaries under `cap.<id>.title` / `cap.<id>.detail`; this module owns
 * the structure, the clipboard payload, and the maturity classification.
 */
/** Maturity of one capability entry (four states, rendered as badges). */
export type CapabilityMaturity = 'done' | 'ready' | 'need' | 'incoming';
/** One pickable verb of the workbench: pick copies `prompt` to the clipboard. */
export interface CapabilityItem {
    /** Stable id; also the locale key stem (`cap.<id>.title` / `.detail`). */
    id: string;
    /** The group this item renders under within its tab. */
    group: string;
    /** Structured instruction template copied on pick; 【…】 marks user fill-ins. */
    prompt: string;
    maturity: CapabilityMaturity;
}
/** One titled group of items within a tab. */
export interface CapabilityGroup {
    id: string;
    items: readonly CapabilityItem[];
}
/** The dual intent tabs: finished artifacts versus operation actions. */
export type StudioTab = 'create' | 'operate';
/** Tab order and the group sequence each tab renders. */
export declare const STUDIO_TABS: readonly {
    id: StudioTab;
    groups: readonly string[];
}[];
/** All catalog items across both tabs, in render order. */
export declare const CAPABILITY_ITEMS: readonly CapabilityItem[];
/**
 * The items of one tab, grouped in the tab's declared group order.
 * @param tab - the active intent tab.
 * @returns the tab's groups with their items; a group with no items is omitted.
 */
export declare function capabilityGroups(tab: StudioTab): CapabilityGroup[];
//# sourceMappingURL=capabilities.d.ts.map