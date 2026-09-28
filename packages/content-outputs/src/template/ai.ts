/**
 * AI processing for the global template library: one explicit, controlled
 * model call per request behind the 模板库 view's explicit buttons (skeleton
 * generation, body optimization, variable extraction from a business
 * instance). Calls ride the shared `llm` Service Definition through the same
 * one-shot helper as the gather, competitor, create, and persona faces; the
 * processor runs one call at a time and retries only upstream rate limits.
 * Nothing is persisted here: the caller previews the draft and stores it
 * only through an explicit save.
 */

import type { Context } from '@deepseek-ai/cordis'
import PQueue from 'p-queue'
import pRetry from 'p-retry'
import type {
  TemplateAiDraft, TemplateAiRequest, TemplateAiResult, TemplateCategory, TemplateVariable,
} from './types.ts'
import { TEMPLATE_CATEGORIES } from './types.ts'
import {
  TEMPLATE_MAX_BODY, TEMPLATE_MAX_VARIABLES, TEMPLATE_VARIABLE_NAME_PATTERN,
} from './store.ts'
import {
  AI_RETRY_MAX, honorRetryAfter, isRateLimitError, resolveAiConfig, streamLlmText,
  type AiCallPolicy, type GatherAiConfig, type ResolvedAiConfig,
} from '../gather/ai.ts'

/** Timeout reason code carried by aborted template AI calls. */
export const TEMPLATE_AI_TIMEOUT_CODE = 'TEMPLATE_AI_TIMEOUT'

/** Prompt version of the skeleton generation face. */
export const TEMPLATE_GENERATE_PROMPT_VERSION = 'template-generate@1'

/** Prompt version of the body optimization face. */
export const TEMPLATE_OPTIMIZE_PROMPT_VERSION = 'template-optimize@1'

/** Prompt version of the variable extraction face. */
export const TEMPLATE_EXTRACT_PROMPT_VERSION = 'template-extract@1'

/** Longest single variable text field accepted from the model. */
const TEMPLATE_AI_VARIABLE_TEXT_CAP = 500

/** Longest single default value accepted from the model. */
const TEMPLATE_AI_VARIABLE_DEFAULT_CAP = 2_000

const CATEGORY_HINTS: Record<TemplateCategory, string> = {
  topic: '选题模板：一条选题的结构化骨架（选题名、切入点、受众、预期形式等）',
  creation: '创作提示词模板：喂给 AI 的创作指令骨架',
  publish: '发布平台适配模板：某平台的字数、标签、排版规则骨架',
  calendar: '日历排期模板：排期计划骨架',
  retro: '复盘报告模板：复盘报告的结构框架',
  interaction: '互动回复话术模板：多风格回复话术骨架',
  persona: '画像表单模板：账号人设的预设表单骨架',
  benchmark: '对标分析提示词模板：拆解对标账号的指令骨架',
  intel: '信息素材采集模板：采集任务的配置或整理骨架',
  dashboard: '仪表盘看板模板：预留分类，仅占位',
}

const GENERATE_SYSTEM_PROMPT = [
  '你是内容创作工作台的模板库助手。根据用户描述，起草一个可复用的业务模板骨架。',
  '要求：',
  '- 正文用 Markdown，把可变部分写成 {{变量名}} 占位符，变量名只用英文字母、数字和下划线且以字母开头；',
  '- 每个占位符在 variables 中给出一条元数据（name 与正文占位符完全一致、label 展示名、description 用途说明、defaultValue 默认值、required 是否必填）；',
  '- 正文与占位符是唯一事实：variables 里不要出现正文没有的变量；',
  '- 只输出一个 JSON 对象：{"name":"模板名","description":"一句话说明","body":"Markdown 正文","variables":[…]}，不要输出其他任何文字。',
].join('\n')

const OPTIMIZE_SYSTEM_PROMPT = [
  '你是内容创作工作台的模板库助手。按照用户要求优化给定的模板正文。',
  '要求：',
  '- 保留原有 {{变量名}} 占位符的名称与语义，除非用户明确要求改写；',
  '- 直接在正文中落实用户的优化要求（精简、改写、调整结构等）；',
  '- 只输出一个 JSON 对象：{"body":"优化后的 Markdown 正文"}，不要输出其他任何文字。',
].join('\n')

const EXTRACT_SYSTEM_PROMPT = [
  '你是内容创作工作台的模板库助手。把给定的一份业务内容实例提炼成可复用的模板骨架。',
  '要求：',
  '- 把实例中每处会因次而异的内容改写为 {{变量名}} 占位符，变量名只用英文字母、数字和下划线且以字母开头；',
  '- 固定结构、连接语、格式骨架保持原样；',
  '- 每个占位符在 variables 中给出一条元数据（name 与正文占位符完全一致、label 展示名、description 原内容概括、defaultValue 用原实例的对应内容、required 一般为 true）；',
  '- 只输出一个 JSON 对象：{"body":"骨架 Markdown","variables":[…]}，不要输出其他任何文字。',
].join('\n')

/**
 * Extract the JSON object from a model answer: bare JSON parses directly,
 * prose-wrapped JSON is cut between the outermost braces. Model output is a
 * JSON boundary: anything that is not one object rejects here.
 * @param text - exact model text output.
 * @returns the parsed object.
 */
function extractJsonObject(text: string): Record<string, unknown> {
  const stripped = text.trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    const start = stripped.indexOf('{')
    const end = stripped.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error('template AI output contains no JSON object')
    try {
      parsed = JSON.parse(stripped.slice(start, end + 1))
    } catch {
      throw new Error('template AI output is not valid JSON')
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('template AI output is not a JSON object')
  return parsed as Record<string, unknown>
}

/** Field-level draft texts before the per-variable validation. */
interface RawDraftVariables {
  readonly variables: TemplateVariable[]
  readonly problems: string[]
}

/**
 * Parse the model's variable list: entries with an unusable name drop into
 * `problems`, duplicate names keep their first occurrence, text fields are
 * trimmed and capped. The body stays the source of truth — a caller
 * reconciles these entries against the placeholders actually present.
 * @param value - the raw `variables` value from the model answer.
 * @returns the surviving variables plus every rejection.
 */
export function parseTemplateVariablesOutput(value: unknown): RawDraftVariables {
  const variables: TemplateVariable[] = []
  const problems: string[] = []
  if (!Array.isArray(value)) {
    problems.push('variables is not an array')
    return { variables, problems }
  }
  const seen = new Set<string>()
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) {
      problems.push('dropped one invalid variable entry')
      continue
    }
    const record = raw as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    if (!TEMPLATE_VARIABLE_NAME_PATTERN.test(name)) {
      problems.push(`dropped variable with unusable name: ${JSON.stringify(record.name).slice(0, 60)}`)
      continue
    }
    if (seen.has(name)) continue
    seen.add(name)
    const text = (field: string, cap: number): string => {
      const raw = record[field]
      return typeof raw === 'string' ? raw.trim().slice(0, cap) : ''
    }
    variables.push({
      name,
      label: text('label', TEMPLATE_AI_VARIABLE_TEXT_CAP) || name,
      description: text('description', TEMPLATE_AI_VARIABLE_TEXT_CAP),
      defaultValue: text('defaultValue', TEMPLATE_AI_VARIABLE_DEFAULT_CAP),
      required: record.required !== false,
    })
  }
  if (variables.length > TEMPLATE_MAX_VARIABLES) {
    problems.push(`variables exceed ${String(TEMPLATE_MAX_VARIABLES)}; kept the first ${String(TEMPLATE_MAX_VARIABLES)}`)
    variables.length = TEMPLATE_MAX_VARIABLES
  }
  return { variables, problems }
}

function draftText(record: Record<string, unknown>, field: string): string {
  const raw = record[field]
  return typeof raw === 'string' ? raw.trim() : ''
}

/**
 * Parse a generation answer into its full draft. A missing or oversized body
 * rejects; the suggested name and description are advisory and may be empty.
 * @param text - exact model text output.
 * @returns the draft plus every field-level rejection.
 */
export function parseTemplateGenerateOutput(text: string): { draft: TemplateAiDraft; problems: string[] } {
  const record = extractJsonObject(text)
  const body = draftText(record, 'body').slice(0, TEMPLATE_MAX_BODY)
  if (body.length === 0) throw new Error('template AI generate output has no body')
  const parsed = parseTemplateVariablesOutput(record.variables)
  return {
    draft: {
      name: draftText(record, 'name').slice(0, 100),
      description: draftText(record, 'description').slice(0, 500),
      body,
      variables: parsed.variables,
    },
    problems: parsed.problems,
  }
}

/**
 * Parse an optimization answer into its body-only draft. The caller merges
 * the body into its editor; name, description, and variables stay untouched.
 * @param text - exact model text output.
 * @returns the draft plus an empty problem list (kept for shape parity).
 */
export function parseTemplateOptimizeOutput(text: string): { draft: TemplateAiDraft; problems: string[] } {
  const record = extractJsonObject(text)
  const body = draftText(record, 'body').slice(0, TEMPLATE_MAX_BODY)
  if (body.length === 0) throw new Error('template AI optimize output has no body')
  return {
    draft: { name: '', description: '', body, variables: [] },
    problems: [],
  }
}

/**
 * Parse an extraction answer into its skeleton draft: body plus the
 * proposed variable metadata.
 * @param text - exact model text output.
 * @returns the draft plus every field-level rejection.
 */
export function parseTemplateExtractOutput(text: string): { draft: TemplateAiDraft; problems: string[] } {
  const record = extractJsonObject(text)
  const body = draftText(record, 'body').slice(0, TEMPLATE_MAX_BODY)
  if (body.length === 0) throw new Error('template AI extract output has no body')
  const parsed = parseTemplateVariablesOutput(record.variables)
  return {
    draft: { name: '', description: '', body, variables: parsed.variables },
    problems: parsed.problems,
  }
}

/**
 * The queued AI processor owned by the content-outputs gateway; not itself a
 * cordis service — the gateway carries the `llm` injection and the config.
 */
export class TemplateAiProcessor {
  /** Validated policy, defaults resolved once at construction. */
  private readonly resolved: ResolvedAiConfig

  /** Single-slot call queue: one model call at a time, per the plugin AI policy. */
  private readonly queue = new PQueue({ concurrency: 1 })

  /**
   * @param ctx - context exposing the registered LLM service.
   * @param config - declared AI policy; defaults resolve here, fail loud.
   */
  constructor(private readonly ctx: Context, config: GatherAiConfig) {
    this.resolved = resolveAiConfig(config)
  }

  /**
   * Run one template AI operation. Rate limits retry with backoff; every
   * other failure surfaces immediately so the UI can offer its own retry.
   * @param request - the operation and its input.
   * @returns the draft with its prompt version.
   */
  async process(request: TemplateAiRequest): Promise<TemplateAiResult> {
    switch (request.operation) {
      case 'generate': return this.enqueue(() => this.generate(request))
      case 'optimize': return this.enqueue(() => this.optimize(request))
      case 'extract': return this.enqueue(() => this.extract(request))
      default: throw new Error(`unsupported template AI operation: ${String((request as { operation?: unknown }).operation)}`)
    }
  }

  /** One queued call with the rate-limit retry policy wrapped around it. */
  private enqueue(call: () => Promise<TemplateAiResult>): Promise<TemplateAiResult> {
    return this.queue.add(() => pRetry(call, {
      retries: AI_RETRY_MAX,
      minTimeout: 1000,
      maxTimeout: 30_000,
      factor: 2,
      shouldRetry: isRateLimitError,
      onFailedAttempt: error => honorRetryAfter(error),
    }))
  }

  /** Draft a whole skeleton from a natural-language description. */
  private async generate(request: Extract<TemplateAiRequest, { operation: 'generate' }>): Promise<TemplateAiResult> {
    if (!TEMPLATE_CATEGORIES.includes(request.category)) throw new Error(`unknown template category: ${request.category}`)
    const description = request.description.trim()
    if (description.length === 0) throw new Error('template generation has no description')
    const framed = [
      `模板分类：${CATEGORY_HINTS[request.category]}`,
      `用户描述：${description.slice(0, this.resolved.maxInputChars)}`,
    ].join('\n')
    const output = await this.call(GENERATE_SYSTEM_PROMPT, framed)
    const parsed = parseTemplateGenerateOutput(output)
    return { operation: 'generate', promptVersion: TEMPLATE_GENERATE_PROMPT_VERSION, draft: parsed.draft, problems: parsed.problems }
  }

  /** Rewrite one existing body per the user's instruction. */
  private async optimize(request: Extract<TemplateAiRequest, { operation: 'optimize' }>): Promise<TemplateAiResult> {
    const body = request.body.trim()
    const instruction = request.instruction.trim()
    if (body.length === 0) throw new Error('template optimization has no body')
    if (instruction.length === 0) throw new Error('template optimization has no instruction')
    const framed = [
      `优化要求：${instruction.slice(0, 2_000)}`,
      `模板正文：\n${body.slice(0, this.resolved.maxInputChars)}`,
    ].join('\n')
    const output = await this.call(OPTIMIZE_SYSTEM_PROMPT, framed)
    const parsed = parseTemplateOptimizeOutput(output)
    return { operation: 'optimize', promptVersion: TEMPLATE_OPTIMIZE_PROMPT_VERSION, draft: parsed.draft, problems: parsed.problems }
  }

  /** Distill one business instance into a skeleton with placeholders. */
  private async extract(request: Extract<TemplateAiRequest, { operation: 'extract' }>): Promise<TemplateAiResult> {
    const content = request.content.trim()
    if (content.length === 0) throw new Error('template extraction has no content')
    const framed = content.slice(0, this.resolved.maxInputChars)
    const output = await this.call(EXTRACT_SYSTEM_PROMPT, framed)
    const parsed = parseTemplateExtractOutput(output)
    return { operation: 'extract', promptVersion: TEMPLATE_EXTRACT_PROMPT_VERSION, draft: parsed.draft, problems: parsed.problems }
  }

  /** One framed one-shot call under the resolved policy. */
  private async call(system: string, framed: string): Promise<string> {
    const policy: AiCallPolicy = {
      provider: this.resolved.provider,
      model: this.resolved.model,
      timeoutMs: this.resolved.timeoutMs,
      maxOutputTokens: this.resolved.maxOutputTokens,
    }
    return streamLlmText(this.ctx, policy, system, framed, TEMPLATE_AI_TIMEOUT_CODE)
  }
}
