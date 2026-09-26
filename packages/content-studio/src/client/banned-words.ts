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
export type BannedCategory = 'absolute' | 'authority' | 'medical' | 'finance'

/** One curated category: its words and the locale stem that names it. */
export interface BannedGroup {
  readonly category: BannedCategory
  readonly words: readonly string[]
}

/**
 * The bundled word list, grouped by category. Phrase-level entries only;
 * extend here (never in the scanner) as the compliance needs grow.
 */
export const BANNED_GROUPS: readonly BannedGroup[] = [
  {
    category: 'absolute',
    words: [
      '最佳', '最好', '最优', '最低价', '最先进', '最便宜', '最高级', '最豪华', '最高端', '最强',
      '第一品牌', '全国第一', '全网第一', '销量第一', '行业第一', '中国第一', '世界第一名',
      '国家级', '世界级', '全球级', '顶级', '顶尖', '王牌', '冠军', '独家', '首选', '首个',
      '独一无二', '绝无仅有', '史无前例', '前无古人', '万能', '祖传', '完美',
      '100%', '百分之百', '纯天然', '零风险', '永久', '彻底', '绝绝对对', '绝对划算',
    ],
  },
  {
    category: 'authority',
    words: [
      '国家机关推荐', '国家认证', '质量免检', '免检产品', '专供', '特供',
      '人大代表推荐', '机关单位推荐', '权威认证', '官方授权', '国家战略',
    ],
  },
  {
    category: 'medical',
    words: [
      '根治', '治愈', '包治百病', '药到病除', '立竿见影', '无副作用', '彻底根除',
      '消炎', '杀菌', '降血压', '降血糖', '降血脂', '排毒', '抗衰老', '延缓衰老',
      '提高智商', '增强记忆力', '修复细胞', '抗癌', '防癌',
    ],
  },
  {
    category: 'finance',
    words: [
      '保本', '稳赚不赔', '包赚', '稳定回报', '高额回报', '躺赚', '一夜暴富',
      '零门槛躺赚', '翻倍收益', '躺平收钱',
    ],
  },
]

/** One scan hit: the word, its category, occurrence count, and first offset. */
export interface BannedHit {
  readonly word: string
  readonly category: BannedCategory
  readonly count: number
  readonly firstIndex: number
}

/**
 * Scan a text for the bundled list. Case-insensitive for latin entries; one
 * hit per word (counting every occurrence); hits sort by first appearance.
 * @param text - the text to scan.
 * @returns the hits in reading order; empty when clean.
 */
export function scanBannedWords(text: string): BannedHit[] {
  const lowered = text.toLowerCase()
  const hits: BannedHit[] = []
  for (const group of BANNED_GROUPS) {
    for (const word of group.words) {
      const needle = word.toLowerCase()
      const firstIndex = lowered.indexOf(needle)
      if (firstIndex === -1) continue
      let count = 0
      let at = firstIndex
      while (at !== -1) {
        count += 1
        at = lowered.indexOf(needle, at + needle.length)
      }
      hits.push({ word, category: group.category, count, firstIndex })
    }
  }
  return hits.sort((a, b) => a.firstIndex - b.firstIndex)
}
