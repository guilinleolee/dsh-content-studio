/**
 * The SEO/GEO helper of the create workbench, rules tier: deterministic
 * keyword extraction (CJK bigrams plus latin words against a small stopword
 * list), static per-type layout advice, and the local-region keyword combos.
 * No AI, no network — the advisory surface the doc scopes as the basic tier.
 */
import type { CreateContentType } from '@deepseek-ai/dsh-content-outputs/types';
/**
 * Extract the core keywords of a text: CJK bigrams ranked by frequency
 * (stopwords dropped, overlaps kept — they read naturally as search
 * phrases), latin words ranked likewise.
 * @param text - the body to mine.
 * @param cap - the suggestion count.
 * @returns the keywords, strongest first.
 */
export declare function extractKeywords(text: string, cap?: number): string[];
/**
 * The static layout advice of one content type, as locale stems
 * (`create.seo.layout.<key>`).
 * @param contentType - the content type.
 * @returns the placement stems in reading order.
 */
export declare function layoutSuggestions(contentType: CreateContentType): readonly string[];
/**
 * Combine the target region with the core keywords into local GEO phrases
 * (e.g. 杭州 + 探店 → 杭州探店).
 * @param region - the target region name, trimmed.
 * @param keywords - the extracted keywords, strongest first.
 * @param cap - the combo count.
 * @returns the region keyword combos; empty without a region or keywords.
 */
export declare function geoKeywords(region: string, keywords: readonly string[], cap?: number): string[];
//# sourceMappingURL=seo.d.ts.map