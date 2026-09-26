/**
 * AI processing for the persona write face: one explicit, controlled model
 * call per request behind the 画像 view's explicit buttons (field fill,
 * résumé extraction, report generation). Calls ride the shared `llm` Service
 * Definition through the same one-shot helper as the gather and competitor
 * faces; the processor runs one call at a time and retries only upstream
 * rate limits. Nothing is persisted here: the caller previews the result and
 * writes adopted values back through the persona store.
 */

import type { Context } from '@deepseek-ai/cordis'
import PQueue from 'p-queue'
import pRetry from 'p-retry'
import type { PersonaAiRequest, PersonaAiResult, PersonaEntry, PersonaFieldKey } from '../types.ts'
import {
  PERSONA_FIELD_KEYS, PERSONA_FIELD_LABELS, PERSONA_FILL_PROHIBITED,
  PERSONA_PLATFORM_LABELS, PERSONA_STYLE_PRESET_LABELS,
} from '../types.ts'
import {
  AI_RETRY_MAX, honorRetryAfter, isRateLimitError, resolveAiConfig, streamLlmText,
  type AiCallPolicy, type GatherAiConfig, type ResolvedAiConfig,
} from '../gather/ai.ts'
import { PERSONA_MAX_FIELD_VALUE, PERSONA_MAX_TEXT } from './store.ts'

/** Timeout reason code carried by aborted persona AI calls. */
export const PERSONA_AI_TIMEOUT_CODE = 'PERSONA_AI_TIMEOUT'

/** Prompt version of the blank-field fill face; stamped into adopted fields' provenance. */
export const PERSONA_FILL_PROMPT_VERSION = 'persona-fill@1'

/** Prompt version of the résumé extraction face; stamped into adopted fields' provenance. */
export const PERSONA_RESUME_PROMPT_VERSION = 'persona-resume@1'

/** Prompt version of the report face; stamped onto the stored report. */
export const PERSONA_REPORT_PROMPT_VERSION = 'persona-report@1'

/** Longest single extracted field value accepted from the model. */
const PERSONA_AI_FIELD_CAP = 2_000

const FILL_SYSTEM_PROMPT = [
  '你是内容创作工作台的账号画像助手。根据已有画像信息，推断并填写空白字段。',
  '要求：',
  '- 基于已有信息做行业通用推断，不得编造具体事实（不要虚构具体的公司名、人名、经历）；',
  '- 每个值不超过 200 字，用中文；',
  '- 只输出一个 JSON 对象，键为字段英文名，不要输出其他任何文字。',
].join('\n')

const RESUME_SYSTEM_PROMPT = [
  '你是内容创作工作台的简历解析助手。从给定的简历或背景文本中提取结构化字段。',
  '字段：whoAmI（主体背景概括，不超过 500 字）、niche（赛道/行业）、audience（目标受众推断）、oneLiner（人设一句话简介）、goal（核心目标推断）、phrases（文字表达习惯）。',
  '要求：',
  '- 只提取文本中有依据的内容；没有依据的字段不要出现在输出里；',
  '- 每个值用中文，不超过 500 字；',
  '- 只输出一个 JSON 对象，不要输出其他任何文字。',
].join('\n')

const REPORT_SYSTEM_PROMPT = [
  '你是内容创作工作台的账号画像报告助手。根据给定的画像事实，输出完整的 Markdown《账号画像报告》。',
  '要求：',
  '- 以 "# 账号画像报告" 一级标题开头；',
  '- 依次包含五个部分：账号定位、受众画像、人设要点、表达风格与红线清单、运营建议；',
  '- 事实中标注了"（AI 推断，供参考）"的内容，在报告中保留该标注；',
  '- 直接输出 Markdown 正文，不要用代码块包裹。',
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
    if (start === -1 || end <= start) throw new Error('persona AI output contains no JSON object')
    try {
      parsed = JSON.parse(stripped.slice(start, end + 1))
    } catch {
      throw new Error('persona AI output is not valid JSON')
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('persona AI output is not a JSON object')
  return parsed as Record<string, unknown>
}

/**
 * Parse a fill or résumé answer into candidate field values. Keys outside
 * `allowed` are dropped (the fill face can never produce `whoAmI`), values
 * are trimmed and capped, empty values are dropped: the caller previews what
 * survives.
 * @param text - exact model text output.
 * @param allowed - the field keys the caller may receive.
 * @returns the candidate values keyed by field.
 */
export function parsePersonaFieldsOutput(
  text: string,
  allowed: readonly PersonaFieldKey[],
): Partial<Record<PersonaFieldKey, string>> {
  const record = extractJsonObject(text)
  const fields: Partial<Record<PersonaFieldKey, string>> = {}
  for (const key of PERSONA_FIELD_KEYS) {
    if (!allowed.includes(key)) continue
    const value = record[key]
    if (typeof value !== 'string') continue
    const trimmed = value.trim().slice(0, PERSONA_AI_FIELD_CAP)
    if (trimmed.length === 0) continue
    fields[key] = trimmed
  }
  return fields
}

/**
 * Parse the report answer into its Markdown body: fenced wrappers are
 * stripped, and an empty body rejects.
 * @param text - exact model text output.
 * @returns the report Markdown.
 */
export function parsePersonaReportOutput(text: string): string {
  const stripped = text.trim().replace(/^```(?:markdown)?\s*/u, '').replace(/\s*```$/u, '').trim()
  if (stripped.length === 0) throw new Error('persona AI report is empty')
  return stripped.slice(0, PERSONA_MAX_TEXT)
}

/**
 * Render one saved entry as the report prompt's fact sheet: every non-empty
 * field with its provenance mark, the style and hard constraints, and the
 * embedded text assets. AI-sourced values carry the "（AI 推断，供参考）"
 * annotation so the report never presents an inference as a user fact.
 * @param entry - the saved persona entry.
 * @returns the plain-text fact sheet.
 */
export function buildFactsText(entry: PersonaEntry): string {
  const platforms = entry.platforms.map(platform => PERSONA_PLATFORM_LABELS[platform]).join('、')
  const lines = [
    `画像名：${entry.name}`,
    `运营平台：${platforms.length > 0 ? platforms : '未填写'}`,
    `起号状态：${entry.accountStage === 'fresh' ? '全新起号' : '已有账号'}`,
  ]
  for (const key of PERSONA_FIELD_KEYS) {
    const value = entry.fields[key].value
    if (value === null) continue
    const mark = entry.fields[key].source === 'ai' ? '（AI 推断，供参考）' : ''
    lines.push(`${PERSONA_FIELD_LABELS[key]}：${value}${mark}`)
  }
  const custom = entry.style.customText?.trim() ?? ''
  const styleText = custom.length > 0
    ? custom
    : entry.style.preset === null ? '未填写' : PERSONA_STYLE_PRESET_LABELS[entry.style.preset]
  lines.push(`写作风格：${styleText}（遵循强度：${entry.style.strength === 'strict' ? '严格遵循' : '轻度遵循'}）`)
  lines.push(`禁用词：${entry.style.bannedWords.length > 0 ? entry.style.bannedWords.join('、') : '无'}`)
  lines.push(`内容红线：${entry.style.redLines.length > 0 ? entry.style.redLines.join('、') : '无'}`)
  if (entry.site.pastedText !== null) lines.push(`企业官网信息：${entry.site.pastedText}`)
  for (const link of entry.links) {
    const detail = [link.bio, link.sampleText].filter((part): part is string => part !== null && part.trim().length > 0).join('；')
    lines.push(`社媒链接（${PERSONA_PLATFORM_LABELS[link.platform]}）：${link.url}${detail.length > 0 ? `；${detail}` : ''}`)
  }
  if (entry.assets.resumeText !== null) lines.push(`简历/背景文本：${entry.assets.resumeText}`)
  return lines.join('\n')
}

/**
 * The queued AI processor owned by the content-outputs gateway; not itself a
 * cordis service — the gateway carries the `llm` injection and the config.
 */
export class PersonaAiProcessor {
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
   * Run one persona AI operation. Rate limits retry with backoff; every
   * other failure surfaces immediately so the UI can offer its own retry.
   * @param request - the operation and its input.
   * @returns the structured result with its prompt version.
   */
  async process(request: PersonaAiRequest): Promise<PersonaAiResult> {
    switch (request.operation) {
      case 'fill': return this.enqueue(() => this.fill(request))
      case 'resume': return this.enqueue(() => this.resume(request))
      case 'report': return this.enqueue(() => this.report(request))
      default: throw new Error(`unsupported persona AI operation: ${String((request as { operation?: unknown }).operation)}`)
    }
  }

  /** One queued call with the rate-limit retry policy wrapped around it. */
  private enqueue(call: () => Promise<PersonaAiResult>): Promise<PersonaAiResult> {
    return this.queue.add(() => pRetry(call, {
      retries: AI_RETRY_MAX,
      minTimeout: 1000,
      maxTimeout: 30_000,
      factor: 2,
      shouldRetry: isRateLimitError,
      onFailedAttempt: error => honorRetryAfter(error),
    }))
  }

  /** Fill blank fields from the known ones; `whoAmI` is never fillable here. */
  private async fill(request: Extract<PersonaAiRequest, { operation: 'fill' }>): Promise<PersonaAiResult> {
    const allowed = request.blanks.filter(key => !PERSONA_FILL_PROHIBITED.includes(key))
    if (allowed.length === 0) throw new Error('persona fill has no fillable blank fields')
    const known = Object.entries(request.known)
      .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
      .map(([key, value]) => `${PERSONA_FIELD_LABELS[key as PersonaFieldKey]}：${value.trim().slice(0, PERSONA_MAX_FIELD_VALUE)}`)
    const framed = [
      known.length > 0 ? `已有画像信息：\n${known.join('\n')}` : '已有画像信息：无',
      `请为以下字段给出推断值：${allowed.map(key => PERSONA_FIELD_LABELS[key]).join('、')}`,
    ].join('\n')
    const output = await this.call(FILL_SYSTEM_PROMPT, framed)
    return { operation: 'fill', promptVersion: PERSONA_FILL_PROMPT_VERSION, fields: parsePersonaFieldsOutput(output, allowed) }
  }

  /** Extract structured fields from one résumé / background text. */
  private async resume(request: Extract<PersonaAiRequest, { operation: 'resume' }>): Promise<PersonaAiResult> {
    const text = request.resumeText.trim()
    if (text.length === 0) throw new Error('persona résumé extraction has no text to extract from')
    const framed = text.slice(0, this.resolved.maxInputChars)
    const output = await this.call(RESUME_SYSTEM_PROMPT, framed)
    return {
      operation: 'resume',
      promptVersion: PERSONA_RESUME_PROMPT_VERSION,
      fields: parsePersonaFieldsOutput(output, PERSONA_FIELD_KEYS),
    }
  }

  /** Generate the full report from one saved entry's facts. */
  private async report(request: Extract<PersonaAiRequest, { operation: 'report' }>): Promise<PersonaAiResult> {
    const framed = buildFactsText(request.facts).slice(0, this.resolved.maxInputChars)
    const output = await this.call(REPORT_SYSTEM_PROMPT, framed)
    return { operation: 'report', promptVersion: PERSONA_REPORT_PROMPT_VERSION, markdown: parsePersonaReportOutput(output) }
  }

  /** One framed one-shot call under the resolved policy. */
  private async call(system: string, framed: string): Promise<string> {
    const policy: AiCallPolicy = {
      provider: this.resolved.provider,
      model: this.resolved.model,
      timeoutMs: this.resolved.timeoutMs,
      maxOutputTokens: this.resolved.maxOutputTokens,
    }
    return streamLlmText(this.ctx, policy, system, framed, PERSONA_AI_TIMEOUT_CODE)
  }
}
