/**
 * Review-view pure functions: metric rates, the viral/weak/long-tail
 * verdicts against the account baselines, the analysis-pool filter, the
 * period aggregation, the top/bottom digest selection, and the data-only
 * report fallback. No I/O and no React — everything the UI and the report
 * pipeline derive from snapshots lives here, so the thresholds have exactly
 * one implementation to test.
 */

import type {
  MetricSnapshot, ReviewAggregateSummary, ReviewBaselines, ReviewFilters,
  ReviewPlatformId, ReviewWorkDigest,
} from '@deepseek-ai/dsh-content-outputs/types'

/**
 * Client-side copies of the wire enums. The bundle-purity gate forbids
 * cross-plugin value imports, so the view carries its own constants; the
 * review-model spec pins them byte-identical to the gateway's list.
 */

/** All platforms, in picker order (must match the gateway's REVIEW_PLATFORMS). */
export const REVIEW_PLATFORMS: readonly ReviewPlatformId[] = ['xhs', 'douyin', 'gzh', 'bilibili']

/** All pool slices, in picker order (must match the gateway's REVIEW_WORK_FILTERS). */
export const REVIEW_WORK_FILTERS: readonly ReviewFilters['workFilter'][] = ['all', 'viral', 'weak', 'longtail']

/** The built-in baselines used until the user sets their own (must match the gateway's DEFAULT_BASELINES). */
export const DEFAULT_BASELINES: ReviewBaselines = {
  engagementRate: 0.05,
  collectRate: 0.02,
  source: 'default',
  updatedAt: '',
}

/** One millisecond-day. */
const DAY_MS = 86_400_000

/** Long-tail age gate: the work must have been published at least this long ago. */
export const LONGTAIL_MIN_AGE_DAYS = 30

/** Long-tail window: the recent-growth slice compared against the lifetime daily pace. */
export const LONGTAIL_WINDOW_DAYS = 7

/** Long-tail pace gate: recent daily growth at or above this fraction of the lifetime pace. */
export const LONGTAIL_PACE_FRACTION = 0.2

/** Excerpt length per work digest fed to the report AI. */
export const DIGEST_EXCERPT_CHARS = 500

/**
 * The frozen six report sections. Duplicated from the gateway's review AI
 * face (Node-only module): the client renders and tests the template, the
 * gateway prompts with it, and the review-model spec pins both sides to this
 * ordering.
 */
export const REVIEW_REPORT_SECTIONS: readonly string[] = [
  '周期数据概览',
  '爆款内容分析',
  '低效内容诊断',
  '受众反馈总结',
  '可落地优化建议',
  '下期行动清单',
]

/** Diagnosis draft cap: the front slice of the body that rides a diagnosis call. */
export const DIAGNOSE_DRAFT_CHARS = 4_000

/** How many works enter the report's top and bottom lists (then halve past this pool size). */
export const REPORT_TOP_N = 5

/** Pool size beyond which the report sampling halves its lists and says so. */
export const REPORT_SAMPLE_POOL = 50

/**
 * Sum of one metrics record's interaction fields; missing metrics read as 0 in a sum.
 * @param metrics - the metrics record of one snapshot.
 * @returns likes + collects + comments + shares, absent fields counted as 0.
 */
export function interactionsOf(metrics: MetricSnapshot['metrics']): number {
  return (metrics.likes ?? 0) + (metrics.collects ?? 0) + (metrics.comments ?? 0) + (metrics.shares ?? 0)
}

/**
 * Interaction rate: interactions over reads/plays. Null when the platform
 * exports no reads — never a faked 0.
 * @param metrics - the metrics record of one snapshot.
 * @returns the rate as a fraction, or null without a positive reads value.
 */
export function engagementRateOf(metrics: MetricSnapshot['metrics']): number | null {
  if (metrics.reads === null || metrics.reads <= 0) return null
  return interactionsOf(metrics) / metrics.reads
}

/**
 * Collect rate: collects over reads/plays; null when reads are missing.
 * @param metrics - the metrics record of one snapshot.
 * @returns the rate as a fraction, or null without a positive reads value.
 */
export function collectRateOf(metrics: MetricSnapshot['metrics']): number | null {
  if (metrics.reads === null || metrics.reads <= 0) return null
  return (metrics.collects ?? 0) / metrics.reads
}

/** The three verdict classes; `neutral` is everything between the two gates. */
export type WorkVerdict = 'viral' | 'weak' | 'neutral'

/**
 * Judge one snapshot against the baselines: viral at twice the baseline
 * engagement rate, weak below half of it.
 * @param metrics - the metrics record of one snapshot.
 * @param baselines - the account baselines grounding the gates.
 * @returns `'viral'`, `'weak'`, or `'neutral'`; an incomputable rate reads neutral.
 */
export function verdictOf(metrics: MetricSnapshot['metrics'], baselines: ReviewBaselines): WorkVerdict {
  const rate = engagementRateOf(metrics)
  if (rate === null) return 'neutral'
  if (rate >= 2 * baselines.engagementRate) return 'viral'
  if (rate < 0.5 * baselines.engagementRate) return 'weak'
  return 'neutral'
}

/**
 * Long-tail verdict: published at least 30 days ago, still growing in the
 * last 7 days at no less than a fifth of its lifetime daily pace. Needs at
 * least two snapshots; anything less reads as false.
 * @param workSnapshots - every snapshot of one work, any order.
 * @param now - the evaluation instant.
 * @returns whether the work meets the long-tail age and recent-pace gates.
 */
export function isLongtail(workSnapshots: readonly MetricSnapshot[], now: Date): boolean {
  if (workSnapshots.length < 2) return false
  const sorted = [...workSnapshots].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
  const latest = sorted[sorted.length - 1]
  const earliest = sorted[0]
  if (latest === undefined || earliest === undefined || latest.publishedAt === null) return false
  const publishedAge = now.getTime() - new Date(latest.publishedAt).getTime()
  if (publishedAge < LONGTAIL_MIN_AGE_DAYS * DAY_MS) return false
  const cutoff = new Date(now.getTime() - LONGTAIL_WINDOW_DAYS * DAY_MS).toISOString()
  const base = [...sorted].reverse().find(candidate => candidate.capturedAt <= cutoff) ?? earliest
  if (base.snapshotId === latest.snapshotId) return false
  const recentGain = interactionsOf(latest.metrics) - interactionsOf(base.metrics)
  if (recentGain <= 0) return false
  const windowDays = Math.max((new Date(latest.capturedAt).getTime() - new Date(base.capturedAt).getTime()) / DAY_MS, 1)
  const lifetimeDays = Math.max((new Date(latest.capturedAt).getTime() - new Date(earliest.capturedAt).getTime()) / DAY_MS, 1)
  const lifetimeDailyPace = (interactionsOf(latest.metrics) - interactionsOf(earliest.metrics)) / lifetimeDays
  if (lifetimeDailyPace <= 0) return false
  return recentGain / windowDays >= LONGTAIL_PACE_FRACTION * lifetimeDailyPace
}

/**
 * The analysis pool: bound snapshots only (a contentId is the admission
 * ticket), inside the period, matching the platform, form, and verdict
 * filters.
 * @param manifest - snapshots to filter.
 * @param filters - the active filter set (platforms, forms, verdict slice).
 * @param period - the inclusive capture-date window.
 * @param baselines - the account baselines grounding the verdict filters.
 * @returns the snapshots passing every filter, manifest order preserved.
 */
export function poolSnapshots(
  manifest: { readonly snapshots: readonly MetricSnapshot[] },
  filters: ReviewFilters,
  period: { from: string; to: string },
  baselines: ReviewBaselines,
): MetricSnapshot[] {
  return manifest.snapshots.filter((snapshot) => {
    if (snapshot.contentId === null) return false
    if (snapshot.capturedAt < period.from || snapshot.capturedAt > `${period.to}T23:59:59.999Z`) return false
    if (filters.platforms.length > 0 && !filters.platforms.includes(snapshot.platformId)) return false
    if (filters.contentTypes.length > 0
      && (snapshot.contentType === null || !filters.contentTypes.includes(snapshot.contentType))) return false
    if (filters.workFilter === 'viral' && verdictOf(snapshot.metrics, baselines) !== 'viral') return false
    if (filters.workFilter === 'weak' && verdictOf(snapshot.metrics, baselines) !== 'weak') return false
    return true
  })
}

/**
 * The period aggregation the summary cards and the report prompt both
 * render. Impressions sum per platform only — never across platforms.
 * @param snapshots - the pool snapshots (bound, period-filtered).
 * @param baselines - the verdict ground (viral/weak counts).
 * @param now - the evaluation instant (long-tail needs one).
 * @returns the aggregation behind the summary cards and the report prompt.
 */
export function aggregateSummary(
  snapshots: readonly MetricSnapshot[],
  baselines: ReviewBaselines,
  now: Date,
): ReviewAggregateSummary {
  const perPlatform: Record<ReviewPlatformId, { works: number; impressions: number | null; engagement: number | null }> = {
    xhs: { works: 0, impressions: null, engagement: null },
    douyin: { works: 0, impressions: null, engagement: null },
    gzh: { works: 0, impressions: null, engagement: null },
    bilibili: { works: 0, impressions: null, engagement: null },
  }
  let viralCount = 0
  let weakCount = 0
  let longtailCount = 0
  let engagementSum = 0
  let engagementWorks = 0
  let followersSum = 0
  let followersWorks = 0
  const byWork = new Map<string, MetricSnapshot[]>()
  for (const snapshot of snapshots) {
    const slot = perPlatform[snapshot.platformId]
    slot.works += 1
    if (snapshot.metrics.impressions !== null) {
      slot.impressions = (slot.impressions ?? 0) + snapshot.metrics.impressions
    }
    const interactions = interactionsOf(snapshot.metrics)
    if (interactions > 0) slot.engagement = (slot.engagement ?? 0) + interactions
    const verdict = verdictOf(snapshot.metrics, baselines)
    if (verdict === 'viral') viralCount += 1
    if (verdict === 'weak') weakCount += 1
    engagementSum += interactions
    if (snapshot.metrics.reads !== null) engagementWorks += 1
    if (snapshot.metrics.followersGained !== null) {
      followersSum += snapshot.metrics.followersGained
      followersWorks += 1
    }
    const key = `${snapshot.platformId}:${snapshot.platformWorkId}`
    const workSnapshots = byWork.get(key)
    if (workSnapshots === undefined) byWork.set(key, [snapshot])
    else workSnapshots.push(snapshot)
  }
  for (const workSnapshots of byWork.values()) {
    if (isLongtail(workSnapshots, now)) longtailCount += 1
  }
  return {
    totalWorks: byWork.size,
    viralCount,
    weakCount,
    longtailCount,
    perPlatform,
    totalEngagement: engagementSum > 0 ? engagementSum : null,
    avgEngagementRate: engagementWorks > 0 ? engagementSum / engagementWorks : null,
    totalFollowersGained: followersWorks > 0 ? followersSum : null,
  }
}

/**
 * Rank the pool for the leaderboard and the report's top/bottom lists:
 * bound snapshots, latest per work, engagement-rate descending; works
 * without a computable rate sink to the bottom sorted by raw interactions.
 * @param snapshots - the pool snapshots (one entry per capture, any order).
 * @returns one latest snapshot per work, ranked best first.
 */
export function rankWorks(snapshots: readonly MetricSnapshot[]): MetricSnapshot[] {
  const byWork = new Map<string, MetricSnapshot>()
  for (const snapshot of snapshots) {
    const key = `${snapshot.platformId}:${snapshot.platformWorkId}`
    const current = byWork.get(key)
    if (current === undefined || snapshot.capturedAt >= current.capturedAt) byWork.set(key, snapshot)
  }
  return [...byWork.values()].sort((a, b) => {
    const rateA = engagementRateOf(a.metrics)
    const rateB = engagementRateOf(b.metrics)
    if (rateA === null && rateB === null) return interactionsOf(b.metrics) - interactionsOf(a.metrics)
    if (rateA === null) return 1
    if (rateB === null) return -1
    return rateB - rateA
  })
}

/**
 * Select the report's top and bottom lists from the ranked pool, halving
 * the counts past the sampling threshold and reporting it.
 * @param ranked - the ranked pool from {@link rankWorks}.
 * @param drafts - body text per work key (`platform:workId`), for excerpts.
 * @returns the top and bottom digests plus whether the pool size halved the lists.
 */
export function selectDigests(
  ranked: readonly MetricSnapshot[],
  drafts: Readonly<Record<string, string>>,
): { top: readonly ReviewWorkDigest[]; bottom: readonly ReviewWorkDigest[]; sampled: boolean } {
  const count = ranked.length > REPORT_SAMPLE_POOL ? Math.max(Math.floor(REPORT_TOP_N / 2), 1) : REPORT_TOP_N
  const toDigest = (snapshot: MetricSnapshot): ReviewWorkDigest => ({
    title: snapshot.title,
    platformId: snapshot.platformId,
    contentType: snapshot.contentType,
    publishedAt: snapshot.publishedAt,
    engagementRate: engagementRateOf(snapshot.metrics),
    collectRate: collectRateOf(snapshot.metrics),
    reads: snapshot.metrics.reads,
    excerpt: (drafts[`${snapshot.platformId}:${snapshot.platformWorkId}`] ?? '').slice(0, DIGEST_EXCERPT_CHARS),
  })
  return {
    top: ranked.slice(0, count).map(toDigest),
    bottom: ranked.slice(-count).map(toDigest),
    sampled: ranked.length > REPORT_SAMPLE_POOL,
  }
}

/**
 * The data-only fallback report rendered when the report AI call fails: the
 * frozen six-section template with the data sections filled from aggregates
 * and the analysis sections naming the failure — never an empty document.
 * @param name - the review task's name.
 * @param period - the reviewed period.
 * @param summary - the period aggregation.
 * @param ranked - the ranked pool.
 * @param baselines - the account baselines grounding the viral labels.
 * @returns the fallback report markdown.
 */
export function dataOnlyReport(
  name: string,
  period: { from: string; to: string },
  summary: ReviewAggregateSummary,
  ranked: readonly MetricSnapshot[],
  baselines: ReviewBaselines,
): string {
  const percent = (rate: number | null): string => rate === null ? '—' : `${(rate * 100).toFixed(1)}%`
  const lines = [
    `# ${name}（数据版）`,
    '',
    '> AI 增强部分生成失败，以下为纯数据版本；可重试生成完整报告。',
    '',
    '## 周期数据概览',
    '',
    `- 复盘周期：${period.from} 至 ${period.to}`,
    `- 作品总数：${summary.totalWorks}`,
    `- 爆款 ${summary.viralCount} 件；低表现 ${summary.weakCount} 件；长尾 ${summary.longtailCount} 件`,
    `- 平均互动率：${percent(summary.avgEngagementRate)}`,
    `- 总涨粉：${summary.totalFollowersGained ?? '—'}`,
    '',
    '### 分平台',
    '',
    '| 平台 | 作品数 | 曝光 | 互动 |',
    '|---|---|---|---|',
    ...REVIEW_PLATFORMS
      .filter(platform => summary.perPlatform[platform].works > 0)
      .map(platform => `| ${platform} | ${summary.perPlatform[platform].works} | ${summary.perPlatform[platform].impressions ?? '—'} | ${summary.perPlatform[platform].engagement ?? '—'} |`),
    '',
    '> 曝光各平台口径不同，不作跨平台求和。',
    '',
    '## 爆款内容分析',
    '',
    ...(ranked.slice(0, 3).map((snapshot, index) => {
      const rate = engagementRateOf(snapshot.metrics)
      return `${index + 1}. 《${snapshot.title}》互动率 ${percent(rate)}${rate !== null && rate >= 2 * baselines.engagementRate ? '（爆款）' : ''}`
    })),
    '',
    '## 低效内容诊断',
    '',
    ...(ranked.slice(-3).reverse().map((snapshot, index) => `${index + 1}. 《${snapshot.title}》互动率 ${percent(engagementRateOf(snapshot.metrics))}`)),
    '',
    '## 受众反馈总结',
    '',
    '【互动】栏目未上线，本节暂缺。',
    '',
    '## 可落地优化建议',
    '',
    'AI 建议生成失败。可参考上节数据自行判断，或点击「重新生成」重试完整报告。',
    '',
    '## 下期行动清单',
    '',
    '- [ ] 重试生成完整复盘报告',
    '- [ ] 为未绑定稿件补齐绑定',
  ]
  return lines.join('\n')
}
