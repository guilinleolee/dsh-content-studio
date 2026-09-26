/**
 * The SEO/GEO helper of the create workbench, rules tier: deterministic
 * keyword extraction (CJK bigrams plus latin words against a small stopword
 * list), static per-type layout advice, and the local-region keyword combos.
 * No AI, no network — the advisory surface the doc scopes as the basic tier.
 */

import type { CreateContentType } from '@deepseek-ai/dsh-content-outputs/types'

/** CJK function words and fragments that never make a useful keyword. */
const STOP_BIGRAMS: readonly string[] = [
  '我的', '一个', '这个', '那个', '但是', '所以', '因为', '如果', '我们', '你们',
  '他们', '自己', '什么', '怎么', '可以', '就是', '还是', '没有', '不是', '有了',
  '的话', '来说', '一下', '一些', '这里', '那里', '时候', '现在', '而且', '或者',
]

/** Latin words too common to suggest. */
const STOP_WORDS: readonly string[] = ['the', 'and', 'for', 'with', 'this', 'that', 'you', 'your', 'are', 'from']

/**
 * Extract the core keywords of a text: CJK bigrams ranked by frequency
 * (stopwords dropped, overlaps kept — they read naturally as search
 * phrases), latin words ranked likewise.
 * @param text - the body to mine.
 * @param cap - the suggestion count.
 * @returns the keywords, strongest first.
 */
export function extractKeywords(text: string, cap = 8): string[] {
  const scores = new Map<string, { count: number; first: number }>()
  const bump = (key: string, at: number): void => {
    const entry = scores.get(key)
    if (entry === undefined) scores.set(key, { count: 1, first: at })
    else entry.count += 1
  }
  const cjk = text.match(/[\u4e00-\u9fff]{2,}/gu) ?? []
  for (const run of cjk) {
    for (let at = 0; at + 2 <= run.length; at += 1) {
      const bigram = run.slice(at, at + 2)
      if (!STOP_BIGRAMS.includes(bigram)) bump(bigram, at)
    }
  }
  const latin = text.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) ?? []
  for (const word of latin) {
    if (!STOP_WORDS.includes(word)) bump(word, text.indexOf(word))
  }
  return [...scores.entries()]
    .filter(([, score]) => score.count >= 2)
    .sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first)
    .slice(0, cap)
    .map(([key]) => key)
}

/**
 * The static layout advice of one content type, as locale stems
 * (`create.seo.layout.<key>`).
 * @param contentType - the content type.
 * @returns the placement stems in reading order.
 */
export function layoutSuggestions(contentType: CreateContentType): readonly string[] {
  switch (contentType) {
    case 'gzh-article': return ['title', 'hook', 'sections', 'cta', 'tags']
    case 'xhs-note': return ['title', 'firstImage', 'cards', 'tags']
    case 'video-script': return ['hook', 'shots', 'cta']
    case 'voiceover': return ['hook', 'pauses', 'cta']
    case 'product-page': return ['selling', 'pain', 'params', 'trust', 'cta']
    case 'rewrite': return ['title', 'structure', 'tags']
    default: return ['title', 'sections', 'cta']
  }
}

/**
 * Combine the target region with the core keywords into local GEO phrases
 * (e.g. 杭州 + 探店 → 杭州探店).
 * @param region - the target region name, trimmed.
 * @param keywords - the extracted keywords, strongest first.
 * @param cap - the combo count.
 * @returns the region keyword combos; empty without a region or keywords.
 */
export function geoKeywords(region: string, keywords: readonly string[], cap = 6): string[] {
  const clean = region.trim()
  if (clean.length === 0 || keywords.length === 0) return []
  return keywords.slice(0, cap).map(keyword => `${clean}${keyword}`)
}
