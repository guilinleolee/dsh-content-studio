/**
 * AI processing for the review face: one explicit, controlled model call per
 * request behind the single-work diagnosis button and the period-report
 * button. Calls ride the same shared `llm` Service Definition, one-shot
 * pattern, queue, and rate-limit retry policy as every other AI face; nothing
 * is persisted here — the caller stores the markdown through the report
 * faces. Inputs are aggregate digests and front-truncated excerpts only;
 * full bodies never ride a report call.
 */

import pRetry from 'p-retry'
import PQueue from 'p-queue'
import type { Context } from '@deepseek-ai/cordis'
import type {
  ReviewAiResult, ReviewAnalyzeWorkRequest,
  ReviewGenerateReportRequest, ReviewMetrics, ReviewPlatformId, ReviewWorkDigest,
} from '../types.ts'
import { REVIEW_PLATFORMS } from '../types.ts'
import {
  AI_RETRY_MAX, honorRetryAfter, isRateLimitError, streamLlmText,
} from '../gather/ai.ts'
import type { AiCallPolicy } from '../gather/ai.ts'

/** Timeout reason code carried by aborted review AI calls. */
export const REVIEW_AI_TIMEOUT_CODE = 'REVIEW_AI_TIMEOUT'

/** Prompt vocabulary version pinned into every result for provenance. */
export const REVIEW_PROMPT_VERSION = 1

/** The fixed six report sections; the template is frozen so outputs stay snapshot-testable. */
export const REVIEW_REPORT_SECTIONS: readonly string[] = [
  '周期数据概览',
  '爆款内容分析',
  '低效内容诊断',
  '受众反馈总结',
  '可落地优化建议',
  '下期行动清单',
]

/** Chinese labels of the platforms, as the prompts phrase them. */
const PLATFORM_LABELS: Record<ReviewPlatformId, string> = {
  xhs: '小红书',
  douyin: '抖音',
  gzh: '公众号',
  bilibili: 'B站',
}

/** Verdict labels the diagnosis prompt argues from — the same classes the UI thresholds produced. */
const VERDICT_LABELS = { viral: '爆款', weak: '低表现', neutral: '表现中性' } as const

/** Whether the value is one well-typed platform id. */
function isPlatformId(value: unknown): value is ReviewPlatformId {
  return typeof value === 'string' && (REVIEW_PLATFORMS as readonly string[]).includes(value)
}

/**
 * Render one metrics record as a compact Chinese facts line, skipping null
 * metrics entirely so the model never sees faked zeros.
 * @param metrics - the metrics with nulls for missing platform fields.
 * @returns the facts line.
 */
export function metricsLine(metrics: ReviewMetrics): string {
  const parts: string[] = []
  if (metrics.impressions !== null) parts.push(`曝光 ${metrics.impressions}`)
  if (metrics.reads !== null) parts.push(`阅读/播放 ${metrics.reads}`)
  if (metrics.likes !== null) parts.push(`点赞 ${metrics.likes}`)
  if (metrics.collects !== null) parts.push(`收藏 ${metrics.collects}`)
  if (metrics.comments !== null) parts.push(`评论 ${metrics.comments}`)
  if (metrics.shares !== null) parts.push(`转发/分享 ${metrics.shares}`)
  if (metrics.followersGained !== null) parts.push(`涨粉 ${metrics.followersGained}`)
  if (metrics.coverCtr !== null) parts.push(`封面点击率 ${(metrics.coverCtr * 100).toFixed(1)}%`)
  return parts.length > 0 ? parts.join('，') : '（该平台未提供指标数据）'
}

/** Render one engagement rate as a percent label, or the missing-metric dash. */
function rateLabel(rate: number | null): string {
  return rate === null ? '—' : `${(rate * 100).toFixed(1)}%`
}

/**
 * Render one work digest as the numbered block the report prompt embeds.
 * @param digest - the digest.
 * @param index - the 1-based position in its list.
 * @returns the block text.
 */
export function digestBlock(digest: ReviewWorkDigest, index: number): string {
  return [
    `${index}. 《${digest.title}》（${PLATFORM_LABELS[digest.platformId]}，${digest.contentType ?? '形式未知'}，发布于 ${digest.publishedAt ?? '未知时间'}）`,
    `   互动率 ${rateLabel(digest.engagementRate)}，收藏率 ${rateLabel(digest.collectRate)}，阅读/播放 ${digest.reads ?? '—'}`,
    `   正文摘录：${digest.excerpt.length > 0 ? digest.excerpt : '（无）'}`,
  ].join('\n')
}

/**
 * Validate one diagnosis request and frame its user prompt. The draft text
 * must already be front-truncated by the caller; an absent body is legal —
 * the diagnosis then argues from metrics and tags alone.
 * @param request - the raw diagnosis request.
 * @param maxInputChars - the combined prompt character cap.
 * @returns the framed user prompt.
 */
export function frameAnalyzeRequest(request: ReviewAnalyzeWorkRequest, maxInputChars: number): string {
  if (!isPlatformId(request.platformId)) throw new Error(`invalid review platformId: ${String(request.platformId)}`)
  if (request.title.trim().length === 0) throw new Error('review diagnosis needs a non-empty title')
  const lines = [
    `作品：《${request.title}》`,
    `平台：${PLATFORM_LABELS[request.platformId]}`,
    `内容形式：${request.contentType ?? '未知'}`,
    `发布时间：${request.publishedAt ?? '未知'}`,
    `数据表现：${metricsLine(request.metrics)}`,
    `初判类别：${VERDICT_LABELS[request.verdict]}`,
  ]
  if (request.tags.length > 0) lines.push(`标签：${request.tags.join('、')}`)
  lines.push(`正文（可能截断）：\n${request.draftText ?? '（无正文引用）'}`)
  return lines.join('\n').slice(0, maxInputChars)
}

/**
 * Build the system prompt for one single-work diagnosis.
 * @param request - the diagnosis request.
 * @returns the complete system prompt.
 */
export function analyzeSystemPrompt(request: ReviewAnalyzeWorkRequest): string {
  const viral = request.verdict === 'viral'
  return [
    '你是内容创作工作台的复盘诊断助手。基于给定的作品信息、数据表现与正文，做一次内容诊断。',
    viral
      ? '这件作品是爆款。分析：标题、开头钩子、选题、结构哪部分效果好；提炼 2-4 个可复用元素，每个说明为什么可复用。'
      : '这件作品数据低。诊断：选题与受众匹配度、开头、标签、发布时段可能存在的问题；每个问题给出一句可操作的改进方向。',
    '用 Markdown 输出：一个二级标题（含作品名），下面 3-5 个要点，每点一行到两行。',
    '只依据给定事实，不要编造未提供的数据；不要输出解释或前言。',
  ].join('\n')
}

/**
 * Validate one report request and frame its user prompt: aggregate summary
 * plus the top/bottom digest blocks, nothing else.
 * @param request - the raw report request.
 * @param maxInputChars - the combined prompt character cap.
 * @returns the framed user prompt.
 */
export function frameReportRequest(request: ReviewGenerateReportRequest, maxInputChars: number): string {
  if (request.name.trim().length === 0) throw new Error('review report needs a non-empty name')
  if (!request.platforms.every(isPlatformId)) throw new Error('review report carries an invalid platform id')
  const lines = [
    `复盘名称：${request.name}`,
    `周期：${request.period.from} 至 ${request.period.to}`,
    `覆盖平台：${request.platforms.map(platform => PLATFORM_LABELS[platform]).join('、')}`,
    `基准：互动率 ${(request.baselines.engagementRate * 100).toFixed(1)}%，收藏率 ${(request.baselines.collectRate * 100).toFixed(1)}%（${request.baselines.source === 'default' ? '内置默认' : '用户设置'}）`,
    '',
    '## 周期汇总',
    `作品总数 ${request.summary.totalWorks}；爆款 ${request.summary.viralCount}；低表现 ${request.summary.weakCount}；长尾 ${request.summary.longtailCount}`,
    `平均互动率 ${rateLabel(request.summary.avgEngagementRate)}；总涨粉 ${request.summary.totalFollowersGained ?? '—'}`,
    '分平台（曝光不跨平台求和）：',
    ...(Object.entries(request.summary.perPlatform) as ReadonlyArray<readonly [string, {
      works: number
      impressions: number | null
      engagement: number | null
    }]>)
      .filter(([, value]) => value.works > 0)
      .map(([platform, value]) => `  ${PLATFORM_LABELS[platform as ReviewPlatformId]}：${value.works} 件，曝光 ${value.impressions ?? '—'}，互动 ${value.engagement ?? '—'}`),
    '',
    `## 表现最好的 ${request.topWorks.length} 件`,
    ...request.topWorks.map((digest, index) => digestBlock(digest, index + 1)),
    '',
    `## 表现最差的 ${request.bottomWorks.length} 件`,
    ...request.bottomWorks.map((digest, index) => digestBlock(digest, index + 1)),
  ]
  return lines.join('\n').slice(0, maxInputChars)
}

/**
 * Build the system prompt for one period report: the frozen six-section
 * template, with the audience section pinned to its placeholder while the
 * interaction view is absent.
 * @returns the complete system prompt.
 */
export function reportSystemPrompt(): string {
  return [
    '你是内容创作工作台的复盘报告助手。基于给定的周期汇总与作品摘录，输出一份结构化复盘报告（Markdown）。',
    '报告必须严格按以下六个二级标题组织，标题原文照抄：',
    ...REVIEW_REPORT_SECTIONS.map((section, index) => `${index + 1}. ## ${section}`),
    '其中「受众反馈总结」本期没有评论数据来源，正文固定写一句话说明该数据暂缺、待互动栏目上线后补充。',
    '「爆款内容分析」从表现最好的作品提炼共性特征与可复用策略；「低效内容诊断」从表现最差的作品归纳共性问题与规避要点；',
    '「可落地优化建议」覆盖选题方向、标题风格、发布时段、内容形式、标签策略五方面，每条建议必须能直接执行；',
    '「下期行动清单」输出 3-5 条带动词开头的具体行动。',
    '只依据给定事实与数字，不要编造数据；只输出报告本身，不要解释或前言。',
  ].join('\n')
}

/**
 * The queued AI processor behind the review view; not itself a cordis
 * service — the gateway carries the `llm` injection and passes the resolved
 * policy in.
 */
export class ReviewAiProcessor {
  /** Single-slot call queue: one model call at a time, shared policy with the other faces. */
  private readonly queue = new PQueue({ concurrency: 1 })

  /**
   * @param ctx - context exposing the registered LLM service.
   * @param policy - the gateway's already-resolved AI policy.
   */
  constructor(private readonly ctx: Context, private readonly policy: AiCallPolicy & { maxInputChars: number }) {}

  /**
   * Diagnose one work through the model. Rate limits retry with backoff;
   * every other failure surfaces immediately so the UI can offer its retry
   * button.
   * @param request - the diagnosis request.
   * @returns the markdown diagnosis with its provenance.
   */
  async analyzeWork(request: ReviewAnalyzeWorkRequest): Promise<ReviewAiResult> {
    const framed = frameAnalyzeRequest(request, this.policy.maxInputChars)
    return this.queued(analyzeSystemPrompt(request), framed)
  }

  /**
   * Generate one period report through the model. The caller stores the
   * markdown; on failure it renders the data-only fallback itself.
   * @param request - the report request.
   * @returns the markdown report with its provenance.
   */
  async generateReport(request: ReviewGenerateReportRequest): Promise<ReviewAiResult> {
    const framed = frameReportRequest(request, this.policy.maxInputChars)
    return this.queued(reportSystemPrompt(), framed)
  }

  /** One queued call with the shared rate-limit retry policy wrapped around it. */
  private queued(system: string, framed: string): Promise<ReviewAiResult> {
    return this.queue.add(() => pRetry(
      async () => {
        const markdown = await streamLlmText(this.ctx, this.policy, system, framed, REVIEW_AI_TIMEOUT_CODE)
        return { markdown, model: this.policy.model, promptVersion: REVIEW_PROMPT_VERSION }
      },
      {
        retries: AI_RETRY_MAX,
        minTimeout: 1000,
        maxTimeout: 30_000,
        factor: 2,
        shouldRetry: isRateLimitError,
        onFailedAttempt: error => honorRetryAfter(error),
      },
    ))
  }
}
