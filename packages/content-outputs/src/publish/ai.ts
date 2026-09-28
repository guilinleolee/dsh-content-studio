/**
 * AI processing for the publish face: one explicit, controlled model call
 * per platform adaptation behind the view's adapt buttons. Calls ride the
 * same shared `llm` Service Definition, one-shot pattern, queue, and
 * rate-limit retry policy as the other AI faces; nothing is persisted here —
 * the caller writes each result back as a derived draft through the store.
 */

import pRetry from 'p-retry'
import PQueue from 'p-queue'
import type { Context } from '@deepseek-ai/cordis'
import type { PublishAdaptRequest, PublishAdaptResult } from './types.ts'
import {
  AI_RETRY_MAX, honorRetryAfter, isRateLimitError, streamLlmText,
} from '../gather/ai.ts'
import type { AiCallPolicy } from '../gather/ai.ts'

/** Timeout reason code carried by aborted publish AI calls. */
export const PUBLISH_AI_TIMEOUT_CODE = 'PUBLISH_AI_TIMEOUT'

/** Prompt vocabulary version pinned into every result for provenance. */
export const PUBLISH_PROMPT_VERSION = 1

/**
 * Build the system prompt for one platform adaptation: the registry's style
 * rules, the persona digest as the style reference, and the fixed JSON
 * output contract.
 * @param request - the adaptation request.
 * @returns the complete system prompt.
 */
export function adaptSystemPrompt(request: PublishAdaptRequest): string {
  const lines = [
    '你是内容发布工作台的多平台适配助手。把一篇定稿改写成指定平台的独立版本。遵守：',
    `目标平台：${request.platformName}。`,
    `平台规则：${request.styleHints}`,
    request.charLimit === null
      ? '该平台没有硬性字数上限，按平台习惯控制篇幅。'
      : `全文正文字数不得超过 ${request.charLimit} 字（不含话题标签），必要时做信息取舍，保留核心观点。`,
  ]
  if (request.personaDigest !== null) {
    lines.push(`写作人设（必须贯穿改写版本的语气、用词与句式）：${request.personaDigest}`)
  }
  lines.push([
    '只输出一个 JSON 对象，不要输出其他任何文字：',
    '{"content":"改写后的全文（Markdown）","coverPrompt":"一张封面图的画面描述，60字内；无封面建议则填空字符串","tags":["话题标签数组"]}',
    'content 只含正文本身；tags 按平台习惯生成 3-8 个，不含 # 前缀。',
  ].join('\n'))
  return lines.join('\n')
}

/**
 * Frame the user prompt: title first, then the full source manuscript.
 * @param request - the adaptation request.
 * @param maxInputChars - the combined prompt character cap.
 * @returns the complete user prompt.
 */
export function adaptFramedPrompt(request: PublishAdaptRequest, maxInputChars: number): string {
  return [`标题：${request.title}`, `定稿原文：\n${request.sourceText}`].join('\n\n').slice(0, maxInputChars)
}

/**
 * Validate one adaptation request.
 * @param request - the raw request.
 * @param maxInputChars - the source text character cap.
 * @returns the validated request.
 */
export function validateAdaptRequest(request: PublishAdaptRequest, maxInputChars: number): PublishAdaptRequest {
  if (typeof request.platformId !== 'string' || request.platformId.length === 0) throw new Error('publish adaptation needs a platformId')
  if (request.platformName.trim().length === 0) throw new Error('publish adaptation needs a platform name')
  if (request.styleHints.trim().length === 0) throw new Error('publish adaptation needs style hints')
  if (request.title.trim().length === 0) throw new Error('publish adaptation needs a non-empty title')
  if (request.sourceText.trim().length === 0) throw new Error('publish adaptation source text is empty')
  if (request.sourceText.length > maxInputChars) throw new Error(`publish adaptation source exceeds the ${maxInputChars}-character cap`)
  return request
}

/**
 * Parse an adaptation answer into the structured result. The model output is
 * a JSON boundary: missing content, or non-string tags, rejects here.
 * @param text - exact model text output.
 * @param model - the model identity recorded into the result.
 * @returns the validated adaptation with its provenance.
 */
export function parsePublishAdaptOutput(text: string, model: string): PublishAdaptResult {
  const fenced = text.trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '')
  const start = fenced.indexOf('{')
  const end = fenced.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('publish adaptation output contains no JSON object')
  let parsed: unknown
  try {
    parsed = JSON.parse(fenced.slice(start, end + 1))
  } catch {
    throw new Error('publish adaptation output is not valid JSON')
  }
  const record = parsed as Record<string, unknown>
  if (typeof record.content !== 'string' || record.content.trim().length === 0) {
    throw new Error('publish adaptation output has no content')
  }
  const tags = Array.isArray(record.tags) && record.tags.every(tag => typeof tag === 'string')
    ? (record.tags as readonly string[]).map(tag => tag.trim()).filter(tag => tag.length > 0).slice(0, 8)
    : []
  const coverPrompt = typeof record.coverPrompt === 'string' && record.coverPrompt.trim().length > 0
    ? record.coverPrompt.trim().slice(0, 200)
    : null
  return { content: record.content.trim(), coverPrompt, tags, model, promptVersion: PUBLISH_PROMPT_VERSION }
}

/**
 * The queued AI processor behind the publish view; not itself a cordis
 * service — the gateway carries the `llm` injection and passes the resolved
 * policy in.
 */
export class PublishAiProcessor {
  /** Single-slot call queue: one model call at a time, shared policy with the other faces. */
  private readonly queue = new PQueue({ concurrency: 1 })

  /**
   * @param ctx - context exposing the registered LLM service.
   * @param policy - the gateway's already-resolved AI policy.
   */
  constructor(private readonly ctx: Context, private readonly policy: AiCallPolicy & { maxInputChars: number }) {}

  /**
   * Adapt one manuscript into one platform version. Rate limits retry with
   * backoff; every other failure surfaces immediately so the platform card
   * can show its 未生成 state and retry button.
   * @param request - the adaptation request.
   * @returns the structured result for the caller to write back.
   */
  async adapt(request: PublishAdaptRequest): Promise<PublishAdaptResult> {
    const validated = validateAdaptRequest(request, this.policy.maxInputChars)
    return this.queue.add(() => pRetry(
      async () => {
        const text = await streamLlmText(
          this.ctx, this.policy,
          adaptSystemPrompt(validated), adaptFramedPrompt(validated, this.policy.maxInputChars),
          PUBLISH_AI_TIMEOUT_CODE,
        )
        return parsePublishAdaptOutput(text, this.policy.model)
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
