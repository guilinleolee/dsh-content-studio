/**
 * AI processing for the create write face: one explicit, controlled model
 * call per request behind the workbench's generate and rewrite buttons. Calls
 * ride the same shared `llm` Service Definition, one-shot pattern, queue, and
 * rate-limit retry policy as the gather and competitor AI faces; nothing is
 * persisted here — the caller writes the text back as a version snapshot.
 */

import pRetry from 'p-retry'
import PQueue from 'p-queue'
import type { Context } from '@deepseek-ai/cordis'
import type {
  CreateContentType, CreateEvaluateRequest, CreateEvaluation, CreateEvaluationDimension, CreateGrade,
  CreateGenerateRequest, CreateRewriteOperation, CreateRewriteRequest, CreateStyleKey, CreateAiResult,
} from '../types.ts'
import { CREATE_CONTENT_TYPES, CREATE_GRADES, CREATE_REWRITE_OPERATIONS, CREATE_STYLES } from './types.ts'
import {
  AI_RETRY_MAX, honorRetryAfter, isRateLimitError, streamLlmText,
} from '../gather/ai.ts'
import type { AiCallPolicy } from '../gather/ai.ts'
import { assertTemplateBody } from './store.ts'

/** Timeout reason code carried by aborted create AI calls. */
export const CREATE_AI_TIMEOUT_CODE = 'CREATE_AI_TIMEOUT'

/** Prompt vocabulary version pinned into every result for provenance. */
export const CREATE_PROMPT_VERSION = 1

/** Chinese labels of the style switch, as the prompts phrase them. */
const STYLE_LABELS: Record<CreateStyleKey, string> = {
  professional: '专业',
  friendly: '亲切',
  hardcore: '硬核',
  story: '故事化',
  concise: '简短有力',
}

/** Per-type creation briefs: the six built-in templates' output contracts. */
const TYPE_BRIEFS: Record<CreateContentType, string> = {
  'gzh-article': [
    '写一篇公众号文章：给出 1 个主标题（吸睛但不标题党）、一段导语（3 句内建立钩子）、',
    '正文分 3-5 个小节（每节一个小标题）、一个互动引导结尾、文末 3-5 个话题标签。',
    '全文 1500-2500 字，Markdown 输出，标题用 # 层级。',
  ].join(''),
  'xhs-note': [
    '写一篇小红书图文笔记：给出 1 个带 emoji 的标题（20 字内）、分段正文（每段 ≤80 字，',
    '段间空行）、每段可配一张图的配图提示词（格式：[配图 N] 描述）、文末话题标签',
    '（#标签# 格式，5-8 个）。总字数 300-800 字，Markdown 输出。',
  ].join(''),
  'video-script': [
    '写一条短视频脚本：前 3 秒钩子开场，之后按镜头分节（镜头 1、镜头 2……），每镜给出',
    '台词、时长（秒）与画面提示，结尾行动引导。总时长控制在 45-90 秒，口语化，',
    'Markdown 输出（每镜一个小节，台词与画面提示分行）。',
  ].join(''),
  voiceover: [
    '写一篇口播稿：自然口语，短句为主，标注停顿（用「（停顿）」），开头 3 句内进入主题，',
    '结尾有引导。不写镜头与画面，只写要说的话。全文 300-1200 字，Markdown 输出。',
  ].join(''),
  'product-page': [
    '写一页商品详情文案：卖点拆解（3-5 个卖点，每个一句话+一段展开）、用户痛点呼应、',
    '关键参数列表、信任背书（资质/销量/口碑角度）、转化引导结尾。避免绝对化用语，',
    'Markdown 输出。',
  ].join(''),
  rewrite: [
    '对给定素材做文案二创：保留核心事实与观点，重写表达。先给 1 个新标题，再输出改写',
    '后的全文，Markdown 输出。不要逐句翻译式改写，要重组结构换个讲法。',
  ].join(''),
}

/**
 * Build the system prompt for one generation: the type brief, the style
 * provenance, and the shared output discipline.
 * @param request - the generation request.
 * @returns the complete system prompt.
 */
export function generateSystemPrompt(request: CreateGenerateRequest): string {
  const lines = [
    '你是内容创作工作台的写作助手。遵守：只输出正文内容本身，不要输出解释、前言或 apologies。',
    TYPE_BRIEFS[request.contentType],
  ]
  if (request.profileDigest !== null) {
    lines.push(`写作风格要求（必须贯穿全文的语气、用词与句式）：${request.profileDigest}`)
  }
  return lines.join('\n')
}

/**
 * Frame the user prompt for one generation: identity facts first, then
 * audience, points, and reference material.
 * @param request - the generation request.
 * @returns the complete user prompt.
 */
export function generateFramedPrompt(request: CreateGenerateRequest): string {
  return [
    `主题：${request.title}`,
    request.audience === null ? '' : `目标人群：${request.audience}`,
    request.points === null ? '' : `差异化要点：\n${request.points}`,
    request.references === null ? '' : `参考素材（只做参考，不要照抄）：\n${request.references}`,
  ].filter(part => part.length > 0).join('\n\n')
}

/** Per-operation rewrite instructions; `style` reads its label from the request. */
function rewriteBrief(operation: CreateRewriteOperation, style: CreateStyleKey | null): string {
  switch (operation) {
    case 'condense': return '把这段文字压缩到原来的一半左右，只删冗余，不改事实与结构。'
    case 'expand': return '把这段文字扩写到原来的两倍左右：补细节、补例子、补过渡，不改核心观点。'
    case 'style': return `把这段文字改写成「${STYLE_LABELS[style ?? 'professional']}」的风格：调整用词与句式，保留信息量。`
    case 'perspective': return '换一个受众视角重写这段文字（换叙事入口与关切点），保留核心事实。'
    case 'extract': return '从这段文字中提炼：3 句金句、3 个备选标题、3 条要点。分三节输出（## 金句 / ## 备选标题 / ## 要点），每节用列表。'
    case 'humanize-light': return [
      '轻度去 AI 味：只做词汇与句式调整——删除 AI 高频套话（"综上所述""值得注意的是""总而言之"、',
      '"不是……而是……"式排比、三连排比、空洞总结段），打散机械句式，调节奏；',
      '禁止改变事实、数据、结构与段落顺序；字数浮动不超过 ±10%。',
    ].join('')
    case 'humanize-deep': return [
      '深度去 AI 味：允许重构叙事——换开头钩子、换叙事视角、口语化、补具体细节、重排段落；',
      '保留全部事实与核心观点，信息量只增不减。',
    ].join('')
    case 'titles': return '从全文提炼 5 个备选标题：角度覆盖悬念、数字、痛点、反差、利益承诺，每行一个标题，不要序号，不要解释。'
    default: return '改写这段文字。'
  }
}

/**
 * Build the system prompt for one rewrite: the operation brief plus the
 * shared discipline (keep facts, output only the rewritten text).
 * @param request - the rewrite request.
 * @returns the complete system prompt.
 */
export function rewriteSystemPrompt(request: CreateRewriteRequest): string {
  return [
    '你是内容创作工作台的改写助手。遵守：只输出改写结果本身，保留原文的事实信息，',
    '不要输出解释或对比说明。',
    rewriteBrief(request.operation, request.style),
  ].join('\n')
}

/**
 * Validate one generation request and frame it; shared by the remote face.
 * @param request - the raw request.
 * @param maxInputChars - the combined user-prompt character cap.
 * @returns the framed user prompt.
 */
export function frameGenerateRequest(request: CreateGenerateRequest, maxInputChars: number): string {
  if (!isContentType(request.contentType)) throw new Error(`invalid create contentType: ${String(request.contentType)}`)
  const title = request.title.trim()
  if (title.length === 0) throw new Error('create generation needs a non-empty title')
  if (title.length > 200) throw new Error('create generation title exceeds 200 characters')
  return generateFramedPrompt(request).slice(0, maxInputChars)
}

/**
 * Validate one rewrite request; shared by the remote face.
 * @param request - the raw request.
 * @param maxInputChars - the selection character cap.
 * @returns the validated selection text.
 */
export function validateRewriteRequest(request: CreateRewriteRequest, maxInputChars: number): string {
  if (!(CREATE_REWRITE_OPERATIONS as readonly string[]).includes(request.operation)) {
    throw new Error(`invalid create rewrite operation: ${request.operation}`)
  }
  if (request.operation === 'style' && (request.style === null || !(CREATE_STYLES as readonly string[]).includes(request.style))) {
    throw new Error('create rewrite style operation needs a valid style key')
  }
  const text = request.text
  if (text.trim().length === 0) throw new Error('create rewrite selection is empty')
  if (text.length > maxInputChars) throw new Error(`create rewrite selection exceeds the ${maxInputChars}-character cap`)
  return text
}

/** Whether the value is one well-typed content type. */
function isContentType(value: unknown): value is CreateGenerateRequest['contentType'] {
  return typeof value === 'string' && (CREATE_CONTENT_TYPES as readonly string[]).includes(value)
}

/** Whether the value is one advisory grade. */
function isGrade(value: unknown): value is CreateGrade {
  return typeof value === 'string' && (CREATE_GRADES as readonly string[]).includes(value)
}

/** Whether the value is one evaluated dimension with a grade and a short reason. */
function isDimension(value: unknown): value is CreateEvaluationDimension {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return isGrade(record.grade) && typeof record.reason === 'string' && record.reason.trim().length > 0
}

/** The only content type short enough for one-request variant batches. */
const BATCHABLE_CONTENT_TYPES: readonly CreateContentType[] = ['xhs-note']

/**
 * Fill one custom template body: whitelisted placeholders take the request
 * facts, and any placeholder that survives the fill rejects the run.
 * @param body - the validated template body.
 * @param request - the generation request.
 * @returns the filled user prompt.
 */
export function fillCustomTemplate(body: string, request: CreateGenerateRequest): string {
  const values: Record<string, string> = {
    title: request.title,
    audience: request.audience ?? '',
    points: request.points ?? '',
    references: request.references ?? '',
    profile: request.profileDigest ?? '',
  }
  const filled = body.replace(/\{\{\s*([\w.-]+)\s*\}\}/gu, (match: string, name: string) => values[name] ?? match)
  const leftover = filled.match(/\{\{\s*[\w.-]+\s*\}\}/u)
  if (leftover !== null) throw new Error(`create template carries an unknown placeholder ${leftover[0]}`)
  return filled
}

/** System-prompt suffix that turns one generation into a JSON variant batch. */
const VARIANT_CONTRACT = [
  '一次输出 3 套互相差异明显的完整方案（不同角度或结构，不要微调措辞凑数）。',
  '只输出一个 JSON 对象：{"variants":["方案一全文","方案二全文","方案三全文"]}，不要输出其他任何文字。',
].join('\n')

/**
 * Parse a variant-batch answer into its variants. The model output is a JSON
 * boundary: anything that is not the requested array of exactly `expected`
 * non-empty strings rejects here.
 * @param text - exact model text output.
 * @param expected - the requested variant count.
 * @returns the trimmed variants.
 */
export function parseCreateVariants(text: string, expected: number): string[] {
  const fenced = text.trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '')
  const start = fenced.indexOf('{')
  const end = fenced.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('create batch output contains no JSON object')
  let parsed: unknown
  try {
    parsed = JSON.parse(fenced.slice(start, end + 1))
  } catch {
    throw new Error('create batch output is not valid JSON')
  }
  const variants = (parsed as Record<string, unknown>).variants
  if (!Array.isArray(variants) || variants.length !== expected
    || !variants.every(variant => typeof variant === 'string' && variant.trim().length > 0)) {
    throw new Error(`create batch output must carry exactly ${expected} non-empty variants`)
  }
  return variants.map(variant => (variant as string).trim())
}

/**
 * Build the system prompt for one evaluation: G-Eval style — list each
 * dimension's rubric checkpoints, judge, then emit the fixed JSON.
 * @param request - the evaluation request.
 * @returns the complete system prompt.
 */
export function evaluateSystemPrompt(request: CreateEvaluateRequest): string {
  return [
    '你是内容创作工作台的评审助手。按以下步骤评估这篇内容：',
    '1. 吸引力（attraction）：开头 3 句是否建立钩子、标题与内容是否匹配目标人群的兴趣；',
    '2. 可读性（readability）：句长节奏、段落划分、口语与书面的匹配度；',
    '3. 差异化（differentiation）：观点或结构是否与同题材内容拉开了距离；',
    '4. 人群匹配（audienceFit）：用词与案例是否贴合给定的目标人群。',
    '每个维度先在心里列出检查点再评级，只输出结论。评级用四级：优 / 良 / 中 / 弱。',
    '只输出一个 JSON 对象：{"attraction":{"grade":"良","reason":"一句话依据"},"readability":{...},"differentiation":{...},"audienceFit":{...},"grade":"总体评级"}，',
    'reason 不超过 60 字，不要输出其他任何文字。',
    `内容类型：${request.contentType}；标题：${request.title}。`,
  ].join('\n')
}

/**
 * Parse an evaluation answer into the structured result. Model output is a
 * JSON boundary: any missing dimension, unknown grade, or empty reason
 * rejects here.
 * @param text - exact model text output.
 * @param model - the model identity recorded into the result.
 * @returns the validated evaluation with its provenance.
 */
export function parseCreateEvaluation(text: string, model: string): CreateEvaluation {
  const fenced = text.trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '')
  const start = fenced.indexOf('{')
  const end = fenced.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('create evaluation output contains no JSON object')
  let parsed: unknown
  try {
    parsed = JSON.parse(fenced.slice(start, end + 1))
  } catch {
    throw new Error('create evaluation output is not valid JSON')
  }
  const record = parsed as Record<string, unknown>
  const dim = (key: string): CreateEvaluationDimension => {
    const value = record[key]
    if (!isDimension(value)) throw new Error(`create evaluation output has an invalid ${key} dimension`)
    return { grade: value.grade, reason: value.reason.trim().slice(0, 120) }
  }
  if (!isGrade(record.grade)) throw new Error('create evaluation output has an invalid overall grade')
  return {
    model,
    promptVersion: CREATE_PROMPT_VERSION,
    evaluatedAt: new Date().toISOString(),
    grade: record.grade,
    attraction: dim('attraction'),
    readability: dim('readability'),
    differentiation: dim('differentiation'),
    audienceFit: dim('audienceFit'),
  }
}

/**
 * Validate one evaluation request; shared by the remote face.
 * @param request - the raw request.
 * @param maxInputChars - the text character cap.
 * @returns the validated text.
 */
export function validateEvaluateRequest(request: CreateEvaluateRequest, maxInputChars: number): string {
  if (!isContentType(request.contentType)) throw new Error(`invalid create contentType: ${String(request.contentType)}`)
  if (request.title.trim().length === 0) throw new Error('create evaluation needs a non-empty title')
  if (request.text.trim().length === 0) throw new Error('create evaluation text is empty')
  if (request.text.length > maxInputChars) throw new Error(`create evaluation text exceeds the ${maxInputChars}-character cap`)
  return request.text
}

/**
 * The queued AI processor behind the create workbench; not itself a cordis
 * service — the gateway carries the `llm` injection and passes the resolved
 * policy in.
 */
export class CreateAiProcessor {
  /** Single-slot call queue: one model call at a time, shared policy with the other faces. */
  private readonly queue = new PQueue({ concurrency: 1 })

  /**
   * @param ctx - context exposing the registered LLM service.
   * @param policy - the gateway's already-resolved AI policy.
   */
  constructor(private readonly ctx: Context, private readonly policy: AiCallPolicy & { maxInputChars: number }) {}

  /**
   * Generate one draft (or, for the short content types, one variant batch)
   * through the model. Rate limits retry with backoff; every other failure
   * surfaces immediately so the UI can offer its retry button.
   * @param request - the generation request; `count: 3` is short-types only.
   * @returns the draft text, the split variants when batched, and provenance.
   */
  async generate(request: CreateGenerateRequest): Promise<CreateAiResult> {
    const count = request.count ?? 1
    if (count === 3 && !(BATCHABLE_CONTENT_TYPES as readonly string[]).includes(request.contentType)) {
      throw new Error('create generation count 3 is only available for the short content types')
    }
    const custom = request.customTemplate ?? null
    let system: string
    let framed: string
    if (custom === null) {
      system = generateSystemPrompt(request)
      framed = frameGenerateRequest(request, this.policy.maxInputChars)
    } else {
      // The stored body was validated at save time; re-validate so a
      // hand-edited bank fails loud at run instead of misfilling.
      assertTemplateBody(custom.body)
      system = [
        '你是内容创作工作台的写作助手。遵守：只输出正文内容本身，不要输出解释、前言或 apologies。',
        request.profileDigest === null ? '' : `写作风格要求（必须贯穿全文的语气、用词与句式）：${request.profileDigest}`,
      ].filter(part => part.length > 0).join('\n')
      framed = fillCustomTemplate(custom.body, request).slice(0, this.policy.maxInputChars)
    }
    if (count === 3) system += `\n${VARIANT_CONTRACT}`
    return this.queued(system, framed, (text) => {
      if (count === 1) return { text, variants: null, model: this.policy.model, promptVersion: CREATE_PROMPT_VERSION }
      const variants = parseCreateVariants(text, count)
      const first = variants[0]
      if (first === undefined) throw new Error('create AI produced no variants')
      return { text: first, variants, model: this.policy.model, promptVersion: CREATE_PROMPT_VERSION }
    })
  }

  /**
   * Rewrite one selection through the model, under the same retry policy.
   * @param request - the rewrite request.
   * @returns the rewritten text with its provenance.
   */
  async rewrite(request: CreateRewriteRequest): Promise<CreateAiResult> {
    const text = validateRewriteRequest(request, this.policy.maxInputChars)
    return this.queued(rewriteSystemPrompt(request), text, output => ({
      text: output, variants: null, model: this.policy.model, promptVersion: CREATE_PROMPT_VERSION,
    }))
  }

  /**
   * Evaluate one draft through the model: four rubric dimensions plus an
   * overall advisory grade. Advisory only — the result never blocks
   * anything, and a failure surfaces to the caller as a normal error.
   * @param request - the evaluation request.
   * @returns the structured evaluation with its provenance.
   */
  async evaluate(request: CreateEvaluateRequest): Promise<CreateEvaluation> {
    const text = validateEvaluateRequest(request, this.policy.maxInputChars)
    return this.queue.add(() => pRetry(
      async () => {
        const output = await streamLlmText(this.ctx, this.policy, evaluateSystemPrompt(request), text, CREATE_AI_TIMEOUT_CODE)
        return parseCreateEvaluation(output, this.policy.model)
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

  /** One queued call with the shared rate-limit retry policy wrapped around it. */
  private queued(
    system: string,
    framed: string,
    finish: (text: string) => CreateAiResult | Promise<CreateAiResult>,
  ): Promise<CreateAiResult> {
    return this.queue.add(() => pRetry(
      async () => {
        const text = await streamLlmText(this.ctx, this.policy, system, framed, CREATE_AI_TIMEOUT_CODE)
        return finish(text)
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
