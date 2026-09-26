/**
 * AI processing for the competitor write face: three explicit, controlled
 * operations behind the competitors view — single-work teardown, single-
 * account panorama report, and two-account face-off. Calls ride the shared
 * `llm` Service Definition through the same one-shot helper the gather face
 * established; the queue runs one call at a time and retries only upstream
 * rate limits. Nothing persists here: the caller writes results back into
 * the manifest and asset files. Report digests carry aggregated facts only —
 * raw work text never enters a report prompt.
 */

import type { Context } from '@deepseek-ai/cordis'
import PQueue from 'p-queue'
import pRetry from 'p-retry'
import type {
  CompetitorAnalyzeWorkRequest, CompetitorAnalyzeWorkResult,
  CompetitorReportRequest, CompetitorReportResult, CompetitorWorkAnalysisResult,
} from '../types.ts'
import { htmlToText } from '../gather/sanitize.ts'
import {
  AI_RETRY_MAX, honorRetryAfter, isRateLimitError, streamLlmText, type AiCallPolicy,
} from '../gather/ai.ts'

/** Timeout reason code carried by aborted competitor AI calls. */
export const COMPETITOR_AI_TIMEOUT_CODE = 'COMPETITOR_AI_TIMEOUT'

/** The comment-insight value every comment-less teardown carries. */
export const COMMENT_INSIGHT_UNAVAILABLE = 'unavailable'

/** System prompt: the single-work teardown skill (paradigm borrowing only). */
const ANALYZE_SYSTEM_PROMPT = [
  '你是内容创作工作台的对标账号拆解助手。对给定的一条对标作品（标题、链接、正文或文案、互动数据、可选的热门评论），只做范式借鉴分析，禁止输出可直接替代原文的洗稿文本。输出：',
  '1. hookType：开头钩子类型，从 痛点/悬念/反常识/故事/其他 中判定并用一句话说明；',
  '2. structure：内容结构（段落框架、案例类型、论据方式），不超过 120 字；',
  '3. painPoints：最多 5 条该作品瞄准的人群痛点；',
  '4. topics：最多 5 个选题归类标签；',
  '5. risks：为什么这条内容互动高，以及风险点（同质化、违规词等），最多 5 条；',
  '6. reusable：可复用的范式点，最多 5 条；',
  '7. migrationTopics：基于这条爆款生成的差异化选题建议，最多 5 条；',
  '8. commentInsight：提供热门评论时，总结高赞评论的核心诉求、提问与情绪倾向（不超过 100 字）；未提供评论时输出 unavailable。',
  '只输出一个 JSON 对象，形如 {"hookType":"...","structure":"...","painPoints":["..."],"topics":["..."],"risks":["..."],"reusable":["..."],"migrationTopics":["..."],"commentInsight":"..."}，不要输出其他任何文字。',
].join('\n')

/** System prompt: the report skill (account panorama or two-account face-off). */
const REPORT_SYSTEM_PROMPT = [
  '你是内容创作工作台的对标账号分析助手。输入是一个或两个对标账号的聚合统计摘要（选题分布、钩子类型频次、更新频率、爆款率等，不含作品原文），输出一份 Markdown 分析报告。',
  '单账号报告（kind: account）章节：账号内容策略（选题分布表、固定栏目、更新节奏）；标题与钩子模板；爆款规律（爆款 vs 普通差异）；受众画像（无评论数据时明确标注"无评论数据"）；变现路径；短板与机会。',
  '双账号对比报告（kind: compare）章节：选题分布对比；发布频率对比；爆款选题交集与差异；标题钩子风格对比；赛道空白机会点；差异化内容建议。',
  '只输出 Markdown 正文，不要输出其他任何文字。',
].join('\n')

/** Cap for one account digest, keeping report prompts inside the token budget. */
const MAX_DIGEST_CHARS = 1000

/**
 * Parse the model's JSON answer into the structured teardown result. Model
 * output is a JSON boundary: anything that is not the requested object
 * rejects here.
 * @param text - exact model text output.
 * @returns the validated teardown result.
 */
export function parseCompetitorAnalysisOutput(text: string): CompetitorWorkAnalysisResult {
  const record = parseJsonObject(text)
  const list = (value: unknown): readonly string[] => {
    if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
      throw new Error('competitor AI output has an invalid string array')
    }
    return value.slice(0, 8).map(item => item.trim()).filter(item => item.length > 0)
  }
  if (typeof record.hookType !== 'string' || record.hookType.trim().length === 0) throw new Error('competitor AI output has no hookType')
  if (typeof record.structure !== 'string' || record.structure.trim().length === 0) throw new Error('competitor AI output has no structure')
  const commentInsight = typeof record.commentInsight === 'string' && record.commentInsight.trim().length > 0
    ? record.commentInsight.trim()
    : COMMENT_INSIGHT_UNAVAILABLE
  return {
    hookType: record.hookType.trim(),
    structure: record.structure.trim(),
    painPoints: list(record.painPoints),
    topics: list(record.topics),
    risks: list(record.risks),
    reusable: list(record.reusable),
    migrationTopics: list(record.migrationTopics),
    commentInsight,
  }
}

/**
 * Parse the model's answer into the report result: the markdown body only.
 * @param text - exact model text output.
 * @returns the non-empty markdown report.
 */
export function parseCompetitorReportOutput(text: string): CompetitorReportResult {
  const markdown = text.trim()
  if (markdown.length === 0) throw new Error('competitor AI report is empty')
  return { markdown }
}

/** Extract and JSON-parse the first object in the model output, tolerating fences. */
function parseJsonObject(text: string): Record<string, unknown> {
  const fenced = text.trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '')
  const start = fenced.indexOf('{')
  const end = fenced.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('competitor AI output contains no JSON object')
  let parsed: unknown
  try {
    parsed = JSON.parse(fenced.slice(start, end + 1))
  } catch {
    throw new Error('competitor AI output is not valid JSON')
  }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('competitor AI output is not a JSON object')
  return parsed as Record<string, unknown>
}

/**
 * The queued AI processor owned by the content-outputs gateway for the
 * competitors view; not itself a cordis service — the gateway carries the
 * `llm` injection and the config.
 */
export class CompetitorAiProcessor {
  /** Call policy shared with the gather face's resolved config. */
  private readonly policy: AiCallPolicy

  /** Single-slot call queue: one model call at a time, per the gather policy. */
  private readonly queue = new PQueue({ concurrency: 1 })

  /**
   * @param ctx - context exposing the registered LLM service.
   * @param config - declared AI policy; defaults resolve in the gather face's
   *   validation rules, so both faces stay on one policy.
   */
  constructor(private readonly ctx: Context, config: {
    provider?: string
    model?: string
    timeoutMs?: number
    maxOutputTokens?: number
    maxInputChars?: number
  }) {
    const timeoutMs = config.timeoutMs ?? 60_000
    const maxOutputTokens = config.maxOutputTokens ?? 2000
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600_000) throw new Error('contentOutputs aiTimeoutMs must be an integer from 1000 through 600000')
    if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 32_000) throw new Error('contentOutputs aiMaxOutputTokens must be an integer from 256 through 32000')
    this.policy = {
      provider: config.provider ?? 'deepseek',
      model: config.model ?? 'deepseek-chat',
      timeoutMs,
      maxOutputTokens,
    }
  }

  /**
   * Tear down one work through the model. Rate limits retry with backoff;
   * every other failure surfaces immediately so the UI can offer its own
   * retry button.
   * @param request - the work's display facts, snapshot reference, and any
   *   user-pasted hot comments.
   * @param readSnapshot - reads one text file body (theme, file name).
   * @returns the structured teardown plus the full markdown report.
   */
  async analyzeWork(
    request: CompetitorAnalyzeWorkRequest,
    readSnapshot: (theme: string, file: string) => Promise<string | undefined>,
  ): Promise<CompetitorAnalyzeWorkResult> {
    if (request.title.trim().length === 0) throw new Error('competitor AI work has no title')
    const text = await this.collectWorkText(request, readSnapshot)
    const framed = [
      `标题：${request.title}`,
      request.url === undefined ? '' : `链接：${request.url}`,
      `互动数据：${request.stats ?? '未知'}`,
      text,
      request.comments === undefined || request.comments.trim().length === 0
        ? '热门评论：未提供'
        : `热门评论：\n${request.comments.trim().slice(0, 4000)}`,
    ].filter(part => part.length > 0).join('\n\n')
    const output = await this.enqueue(() => streamLlmText(this.ctx, this.policy, ANALYZE_SYSTEM_PROMPT, framed, COMPETITOR_AI_TIMEOUT_CODE))
    const result = parseCompetitorAnalysisOutput(output)
    return { ...result, markdown: renderAnalysisMarkdown(request.title, request.url, result) }
  }

  /**
   * Generate one report from aggregated account digests. Raw work text never
   * enters this call — the digests are the caller's aggregation.
   * @param request - one digest for an account report, exactly two for compare.
   * @returns the markdown report.
   */
  async generateReport(request: CompetitorReportRequest): Promise<CompetitorReportResult> {
    const expected = request.kind === 'account' ? 1 : 2
    if (request.accounts.length !== expected) {
      throw new Error(`competitor ${request.kind} report needs exactly ${expected} account digest(s)`)
    }
    for (const digest of request.accounts) {
      if (digest.name.trim().length === 0) throw new Error('competitor report digest has no account name')
      if (digest.digest.trim().length === 0) throw new Error('competitor report digest has no content')
    }
    const framed = request.accounts
      .map(digest => `【账号：${digest.name}】\n${digest.digest.trim().slice(0, MAX_DIGEST_CHARS)}`)
      .join('\n\n')
      + `\n\n报告类型：${request.kind === 'account' ? 'account（单账号全景）' : 'compare（双账号对比）'}`
    const output = await this.enqueue(() => streamLlmText(this.ctx, this.policy, REPORT_SYSTEM_PROMPT, framed, COMPETITOR_AI_TIMEOUT_CODE))
    return parseCompetitorReportOutput(output)
  }

  /** One queued call with the shared rate-limit retry policy wrapped around it. */
  private enqueue(call: () => Promise<string>): Promise<string> {
    return pRetry(
      () => this.queue.add(call),
      {
        retries: AI_RETRY_MAX,
        minTimeout: 1000,
        maxTimeout: 30_000,
        factor: 2,
        shouldRetry: isRateLimitError,
        onFailedAttempt: error => honorRetryAfter(error),
      },
    )
  }

  /** Gather the model input: snapshot text when present; a teardown needs some body. */
  private async collectWorkText(
    request: CompetitorAnalyzeWorkRequest,
    readSnapshot: (theme: string, file: string) => Promise<string | undefined>,
  ): Promise<string> {
    let text = ''
    if (request.textFile !== undefined && request.theme !== undefined) {
      const raw = await readSnapshot(request.theme, request.textFile)
      text = raw === undefined ? '' : htmlToText(raw)
    }
    text = text.trim()
    if (text.length === 0 && (request.stats === undefined || request.stats.trim().length === 0)) {
      throw new Error('competitor AI work has no content to analyze')
    }
    return text.slice(0, 60_000)
  }
}

/** Render the persisted teardown report around the structured result. */
function renderAnalysisMarkdown(title: string, url: string | undefined, result: CompetitorWorkAnalysisResult): string {
  const lines = [
    `# 对标作品拆解：${title}`,
    '',
    url === undefined ? '' : `来源：${url}`,
    '',
    '## 钩子类型',
    result.hookType,
    '',
    '## 内容结构',
    result.structure,
    '',
    '## 人群痛点',
    ...result.painPoints.map(point => `- ${point}`),
    '',
    '## 选题归类',
    ...result.topics.map(topic => `- ${topic}`),
    '',
    '## 爆点与风险',
    ...result.risks.map(risk => `- ${risk}`),
    '',
    '## 可复用点',
    ...result.reusable.map(item => `- ${item}`),
    '',
    '## 可迁移选题建议',
    ...result.migrationTopics.map(topic => `- ${topic}`),
    '',
    '## 评论洞察',
    result.commentInsight,
    '',
    '---',
    '仅供内部研究使用（范式借鉴）。',
  ]
  return `${lines.join('\n')}\n`
}
