/**
 * AI processing for the interactions face: three explicit, controlled model
 * calls behind the reply-drafts button, the batch classifier button, and the
 * insight-extraction button. Calls ride the same shared `llm` Service
 * Definition, one-shot pattern, queue, and rate-limit retry policy as every
 * other AI face; nothing is persisted here — the caller stores drafts and
 * taggings through the manifest write face. Inputs are thread excerpts and
 * message texts only; outputs are strict JSON contracts, and one unparseable
 * reply batch fails the call rather than storing half a draft set.
 */

import pRetry from 'p-retry'
import PQueue from 'p-queue'
import type { Context } from '@deepseek-ai/cordis'
import type {
  InteractionClassifyEntry, InteractionClassifyRequest, InteractionClassifyResult,
  InteractionInsightBatch, InteractionInsightEntry, InteractionInsightRequest,
  InteractionInsightResult, InteractionIntent, InteractionReplyDraftResult,
  InteractionReplyRequest, InteractionReplyResult, InteractionSentiment,
  InteractionStyle,
} from './types.ts'
import { INTERACTION_STYLES } from './types.ts'
import {
  AI_RETRY_MAX, honorRetryAfter, isRateLimitError, streamLlmText,
} from '../gather/ai.ts'
import type { AiCallPolicy } from '../gather/ai.ts'

/** Timeout reason code carried by aborted interaction AI calls. */
export const INTERACTION_AI_TIMEOUT_CODE = 'INTERACTION_AI_TIMEOUT'

/** Prompt vocabulary versions pinned into every result for provenance. */
export const INTERACTION_REPLY_PROMPT_VERSION = 'interaction-reply@1'
export const INTERACTION_SENTIMENT_PROMPT_VERSION = 'interaction-sentiment@1'
export const INTERACTION_INSIGHT_PROMPT_VERSION = 'interaction-insight@1'

/** The reply face's fixed candidate count; the contract freezes it at three. */
export const INTERACTION_REPLY_CANDIDATES = 3

/** Hard thread size the reply prompt accepts; the caller trims to the latest lines. */
export const INTERACTION_MAX_THREAD_LINES = 20

/** Whether the value is one well-typed reply style. */
function isStyle(value: unknown): value is InteractionStyle {
  return typeof value === 'string' && (INTERACTION_STYLES as readonly string[]).includes(value)
}

/**
 * Render the persona block the reply prompt embeds: digest, phrases, and
 * tone samples, each section present only when the caller has the facts.
 * @param digest - the persona's ≤200-char style summary, or null.
 * @param phrases - recommended phrasings, possibly empty.
 * @param samples - tone sample texts, possibly empty.
 * @returns the persona block lines, empty when no persona is bound.
 */
export function personaBlock(digest: string | null, phrases: readonly string[], samples: readonly string[]): string[] {
  if (digest === null && phrases.length === 0 && samples.length === 0) return []
  const lines = ['绑定画像（语气必须遵循）：']
  if (digest !== null) lines.push(`风格摘要：${digest}`)
  if (phrases.length > 0) lines.push(`推荐句式：${phrases.join('；')}`)
  if (samples.length > 0) lines.push(`语气样本：${samples.join('／')}`)
  return lines
}

/**
 * Build the system prompt for one reply-draft generation. The persona is the
 * tone base; the style parameter layers on top and loses to the persona on
 * conflict, exactly as the plan freezes.
 * @param request - the reply request.
 * @returns the complete system prompt.
 */
export function replySystemPrompt(request: InteractionReplyRequest): string {
  const lines = [
    '你是内容创作工作台的粉丝互动回复助手。基于给定的会话上下文，为最后一条粉丝留言生成回复草稿。',
    `固定输出 ${INTERACTION_REPLY_CANDIDATES} 条候选，语气均为「${request.style}」。`,
    ...personaBlock(request.personaDigest, request.personaPhrases, request.personaSamples),
    '粉丝消息按时间排列；只回复最后一条粉丝留言，但可引用上文。',
    '回复要具体、可发送：不编造订单/物流/承诺等未提供的事实；不过度承诺；一条 1-4 句。',
    request.template !== null
      ? '以下模板是初稿骨架，在其结构上填充本会话的具体内容：\n<模板>\n' + request.template + '\n</模板>'
      : '',
    '只输出 JSON，不要解释或前言，格式：',
    `{"drafts":[{"style":"${request.style}","content":"…"},…]}，drafts 恰好 ${INTERACTION_REPLY_CANDIDATES} 条。`,
  ]
  return lines.filter(line => line.length > 0).join('\n')
}

/**
 * Validate one reply request and frame its user prompt: the thread lines
 * plus a clear pointer at the message to answer.
 * @param request - the raw reply request.
 * @param maxInputChars - the combined prompt character cap.
 * @returns the framed user prompt.
 */
export function frameReplyRequest(request: InteractionReplyRequest, maxInputChars: number): string {
  if (!isStyle(request.style)) throw new Error(`invalid interaction reply style: ${String(request.style)}`)
  if (request.thread.length === 0) throw new Error('interaction reply needs a non-empty thread')
  const thread = request.thread.slice(-INTERACTION_MAX_THREAD_LINES)
  const lines = thread.map(line => `${line.direction === 'in' ? '粉丝' : '我方'}：${line.content}`)
  lines.push('', '请为最后一条「粉丝」消息生成回复草稿。')
  return lines.join('\n').slice(0, maxInputChars)
}

/**
 * Parse one reply-draft output: extract the JSON object, require exactly the
 * frozen candidate count, and coerce unknown styles to the requested one.
 * @param text - the raw model output.
 * @param style - the style the caller requested (fallback for unknown values).
 * @returns the validated drafts.
 */
export function parseReplyOutput(text: string, style: InteractionStyle): InteractionReplyDraftResult[] {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('reply output carries no JSON object')
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    throw new Error('reply output is not valid JSON')
  }
  const record = parsed as Record<string, unknown>
  const drafts = record.drafts
  if (!Array.isArray(drafts) || drafts.length !== INTERACTION_REPLY_CANDIDATES) {
    throw new Error(`reply output must carry exactly ${INTERACTION_REPLY_CANDIDATES} drafts`)
  }
  return drafts.map((candidate) => {
    const entry = candidate as Record<string, unknown>
    if (typeof entry.content !== 'string' || entry.content.trim().length === 0) {
      throw new Error('reply draft has empty content')
    }
    return { style: isStyle(entry.style) ? entry.style : style, content: entry.content.trim() }
  })
}

/**
 * Build the system prompt for one classification batch: the two orthogonal
 * taggings, their closed unions, and the unknown fallback.
 * @returns the complete system prompt.
 */
export function classifySystemPrompt(): string {
  return [
    '你是内容创作工作台的粉丝留言分类助手。对给定的每条粉丝消息，输出两个正交标签。',
    'sentiment（语气）：positive / negative / question / unknown。',
    'intent（诉求）：consult（咨询）/ praise（夸奖）/ complain（吐槽）/ demand（需求建议）/ spam（广告垃圾）/ unknown。',
    '拿不准一律 unknown，不要猜测。',
    '只输出 JSON，不要解释或前言，格式：',
    '{"entries":[{"messageId":"…","sentiment":"…","intent":"…"},…]}，entries 覆盖全部输入消息。',
  ].join('\n')
}

/**
 * Frame one classification batch: numbered messages so the model can echo
 * the ids back.
 * @param request - the batch request (at most fifty messages).
 * @param maxInputChars - the combined prompt character cap.
 * @returns the framed user prompt.
 */
export function frameClassifyRequest(request: InteractionClassifyRequest, maxInputChars: number): string {
  if (request.messages.length === 0) throw new Error('interaction classify needs at least one message')
  const lines = request.messages.map(message => `- ${message.messageId}：${message.content}`)
  return lines.join('\n').slice(0, maxInputChars)
}

/**
 * Parse one classification output: keep only entries whose id was sent and
 * coerce unknown tag values to `unknown` — one bad batch degrades to
 * unknowns, never to a failure.
 * @param text - the raw model output.
 * @param validIds - the message ids the batch sent.
 * @returns the sanitized entries.
 */
export function parseClassifyOutput(text: string, validIds: ReadonlySet<string>): InteractionClassifyEntry[] {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return []
  }
  const record = parsed as Record<string, unknown>
  const entries = record.entries
  if (!Array.isArray(entries)) return []
  const results: InteractionClassifyEntry[] = []
  for (const candidate of entries) {
    const entry = candidate as Record<string, unknown>
    if (typeof entry.messageId !== 'string' || !validIds.has(entry.messageId)) continue
    const sentiment = (SENTIMENT_VALUES as readonly string[]).includes(entry.sentiment as string)
      ? entry.sentiment as InteractionSentiment
      : 'unknown'
    const intent = (INTENT_VALUES as readonly string[]).includes(entry.intent as string)
      ? entry.intent as InteractionIntent
      : 'unknown'
    results.push({ messageId: entry.messageId, sentiment, intent })
  }
  return results
}

const SENTIMENT_VALUES = ['positive', 'negative', 'question', 'unknown'] as const
const INTENT_VALUES = ['consult', 'praise', 'complain', 'demand', 'spam', 'unknown'] as const

/**
 * Build the system prompt for one insight batch: the three lists and their
 * count-grounding rule.
 * @returns the complete system prompt.
 */
export function insightSystemPrompt(): string {
  return [
    '你是内容创作工作台的粉丝洞察助手。分析给定的粉丝消息（已按时间排列），提炼三类洞察。',
    'questions：高频问题，label 为问题概括，count 为出现次数，exampleMessageId 任取一条示例消息的 id。',
    'painPoints：痛点，字段同上，topicHint 为 null。',
    'interests：感兴趣的内容方向，label 为方向，count 为消息数，topicHint 为一句选题建议草稿。',
    '每类最多 5 条，按代表性排序；count 只依据给定消息，不要编造；没有的类输出空数组。',
    '只输出 JSON，不要解释或前言，格式：',
    '{"questions":[{"label":"…","count":1,"exampleMessageId":"…","topicHint":null}],"painPoints":[…],"interests":[…]}',
  ].join('\n')
}

/**
 * Frame one insight batch.
 * @param request - the batch request (at most two hundred messages).
 * @param maxInputChars - the combined prompt character cap.
 * @returns the framed user prompt.
 */
export function frameInsightRequest(request: InteractionInsightRequest, maxInputChars: number): string {
  if (request.messages.length === 0) throw new Error('interaction insight needs at least one message')
  const lines = request.messages.map(message => `- ${message.messageId}：${message.content}`)
  return lines.join('\n').slice(0, maxInputChars)
}

/** The minimum insight-entry shape the parser accepts from the model. */
interface RawInsightLine {
  label: string
  count: number
  exampleMessageId: string | null
  topicHint: string | null
}

/** Whether one parsed insight entry has the minimum viable shape. */
function isInsightLine(value: unknown): value is RawInsightLine {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.label === 'string' && record.label.trim().length > 0
    && typeof record.count === 'number' && Number.isFinite(record.count) && record.count >= 1
}

/**
 * Sanitize one insight entry: trim the label, clamp the count, drop junk.
 * @param entry - the raw parsed entry.
 * @returns the clean entry, or null when unusable.
 */
function cleanInsightEntry(entry: unknown): InteractionInsightEntry | null {
  if (!isInsightLine(entry)) return null
  return {
    label: entry.label.trim().slice(0, 120),
    count: Math.min(Math.floor(entry.count), 100_000),
    exampleMessageId: entry.exampleMessageId !== null && entry.exampleMessageId.trim().length > 0
      ? entry.exampleMessageId.trim()
      : null,
    topicHint: entry.topicHint !== null && entry.topicHint.trim().length > 0
      ? entry.topicHint.trim().slice(0, 300)
      : null,
  }
}

/** Sanitize one parsed insight list. */
function cleanInsightList(value: unknown): InteractionInsightEntry[] {
  if (!Array.isArray(value)) return []
  return value.map(cleanInsightEntry).filter((entry): entry is InteractionInsightEntry => entry !== null).slice(0, 5)
}

/**
 * Parse one insight batch output; a batch the model garbled reads as an
 * empty batch (the caller records the failure and continues).
 * @param text - the raw model output.
 * @returns the sanitized batch.
 */
export function parseInsightOutput(text: string): InteractionInsightBatch {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return { questions: [], painPoints: [], interests: [] }
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return { questions: [], painPoints: [], interests: [] }
  }
  const record = parsed as Record<string, unknown>
  return {
    questions: cleanInsightList(record.questions),
    painPoints: cleanInsightList(record.painPoints),
    interests: cleanInsightList(record.interests),
  }
}

/**
 * The queued AI processor behind the interaction view; not itself a cordis
 * service — the gateway carries the `llm` injection and passes the resolved
 * policy in.
 */
export class InteractionAiProcessor {
  /** Single-slot call queue: one model call at a time, shared policy with the other faces. */
  private readonly queue = new PQueue({ concurrency: 1 })

  /**
   * @param ctx - context exposing the registered LLM service.
   * @param policy - the gateway's already-resolved AI policy.
   */
  constructor(private readonly ctx: Context, private readonly policy: AiCallPolicy & { maxInputChars: number }) {}

  /**
   * Generate the fixed candidate set of reply drafts. Rate limits retry with
   * backoff; an unparseable output surfaces immediately so the UI can offer
   * its retry button.
   * @param request - the reply request.
   * @returns the drafts with their provenance.
   */
  async replyDrafts(request: InteractionReplyRequest): Promise<InteractionReplyResult> {
    const framed = frameReplyRequest(request, this.policy.maxInputChars)
    const drafts = await this.queued(
      replySystemPrompt(request),
      framed,
      text => parseReplyOutput(text, request.style),
    )
    return { drafts, model: this.policy.model, promptVersion: INTERACTION_REPLY_PROMPT_VERSION }
  }

  /**
   * Classify one batch of messages. A garbled batch degrades to an empty
   * entry list (the caller leaves those messages unknown) instead of
   * failing — classification never blocks the local workflow.
   * @param request - the batch request.
   * @returns the sanitized entries with their provenance.
   */
  async classify(request: InteractionClassifyRequest): Promise<InteractionClassifyResult> {
    const framed = frameClassifyRequest(request, this.policy.maxInputChars)
    const validIds = new Set(request.messages.map(message => message.messageId))
    const entries = await this.queued(
      classifySystemPrompt(),
      framed,
      text => parseClassifyOutput(text, validIds),
    )
    return { entries, model: this.policy.model, promptVersion: INTERACTION_SENTIMENT_PROMPT_VERSION }
  }

  /**
   * Extract one insight batch. A garbled batch reads as an empty batch; the
   * caller records it and keeps going.
   * @param request - the batch request.
   * @returns the sanitized batch with its provenance.
   */
  async insights(request: InteractionInsightRequest): Promise<InteractionInsightResult> {
    const framed = frameInsightRequest(request, this.policy.maxInputChars)
    const batch = await this.queued(
      insightSystemPrompt(),
      framed,
      parseInsightOutput,
    )
    return { batch, model: this.policy.model, promptVersion: INTERACTION_INSIGHT_PROMPT_VERSION }
  }

  /** One queued call with the shared rate-limit retry policy wrapped around it. */
  private queued<T>(system: string, framed: string, parse: (text: string) => T): Promise<T> {
    return this.queue.add(() => pRetry(
      async () => {
        const text = await streamLlmText(this.ctx, this.policy, system, framed, INTERACTION_AI_TIMEOUT_CODE)
        return parse(text)
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
