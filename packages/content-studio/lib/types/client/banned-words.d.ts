/**
 * Local banned-word pre-check: a curated, offline word list (advertising-law
 * absolute claims, authority endorsements, medical efficacy, and financial
 * promises) plus a deterministic scanner. Purely advisory — the view shows
 * hits with a disclaimer and never blocks saving or exporting. The list is
 * a curated subset in the spirit of the MIT-licensed Sensitive-lexicon
 * project, reduced to phrase-level entries so a single character like 最
 * cannot flood a text with false hits.
 */
/** The four advisory categories of the pre-check. */
export type BannedCategory = 'absolute' | 'authority' | 'medical' | 'finance';
/** One curated category: its words and the locale stem that names it. */
export interface BannedGroup {
    readonly category: BannedCategory;
    readonly words: readonly string[];
}
/**
 * The bundled word list, grouped by category. Phrase-level entries only;
 * extend here (never in the scanner) as the compliance needs grow.
 */
export declare const BANNED_GROUPS: readonly BannedGroup[];
/** One scan hit: the word, its category, occurrence count, and first offset. */
export interface BannedHit {
    readonly word: string;
    readonly category: BannedCategory;
    readonly count: number;
    readonly firstIndex: number;
}
/**
 * Scan a text for the bundled list. Case-insensitive for latin entries; one
 * hit per word (counting every occurrence); hits sort by first appearance.
 * @param text - the text to scan.
 * @returns the hits in reading order; empty when clean.
 */
export declare function scanBannedWords(text: string): BannedHit[];
//# sourceMappingURL=banned-words.d.ts.map