/**
 * Pure model of the publish view: the built-in platform registry (the single
 * source of platform rules — the AI prompt, the char counter, and the tag
 * formatting all read it), the task-level helpers behind the state machine,
 * the due-task scan for the open-time prompt, and the manuscript-pool
 * projection from the outputs library snapshot.
 */

import type { OutputProject } from '@deepseek-ai/dsh-content-outputs/types'
import type {
  PlatformAttemptAction, PlatformStatus, PlatformTask, PublishTask,
} from '@deepseek-ai/dsh-content-outputs/types'

/** How tags are written on one platform. */
export type TagStyle = 'space' | 'closed' | 'none'

/** One built-in platform rule row. Adding a platform is appending a row —
 * never a code change. */
export interface PlatformProfile {
  readonly platformId: string
  readonly name: string
  /** Character cap of the body text, or null when the platform is unlimited. */
  readonly charLimit: number | null
  readonly tagStyle: TagStyle
  /** Cover aspect ratio hint, or null when covers do not apply. */
  readonly coverRatio: string | null
  readonly longForm: boolean
  /** Line-break convention phrased for the prompt. */
  readonly newlineRule: string
  /** Platform style rules, phrased for the prompt. */
  readonly styleHints: string
}

/** The built-in registry, one row per platform, domestic first. */
export const PLATFORM_PROFILES: readonly PlatformProfile[] = [
  {
    platformId: 'xhs',
    name: '小红书',
    charLimit: 1000,
    tagStyle: 'space',
    coverRatio: '3:4',
    longForm: false,
    newlineRule: '段间空行，每段不超过 3 行',
    styleHints: '短句为主，口语化，多用 emoji 点缀；开头两行是钩子；正文分段紧凑，结尾引导互动。',
  },
  {
    platformId: 'gzh',
    name: '公众号',
    charLimit: null,
    tagStyle: 'none',
    coverRatio: '2.35:1',
    longForm: true,
    newlineRule: '正常段落排版，小标题分层',
    styleHints: '长文结构：导语建立钩子、小标题分节、结尾引导在看/转发；书面语与口语平衡，信息密度高。',
  },
  {
    platformId: 'zhihu',
    name: '知乎',
    charLimit: null,
    tagStyle: 'closed',
    coverRatio: null,
    longForm: true,
    newlineRule: '正常段落排版，可用引用块',
    styleHints: '问答/科普风格：先给结论再展开论证，讲逻辑讲依据，适度专业术语，结尾可补个人观点。',
  },
  {
    platformId: 'douyin',
    name: '抖音',
    charLimit: 300,
    tagStyle: 'space',
    coverRatio: '9:16',
    longForm: false,
    newlineRule: '短行，每行一个信息点',
    styleHints: '短视频文案：前三秒钩子、口语化短句、节奏快；文案是口播脚本底稿，画面提示用方括号标注。',
  },
  {
    platformId: 'channels',
    name: '视频号',
    charLimit: 600,
    tagStyle: 'space',
    coverRatio: '9:16',
    longForm: false,
    newlineRule: '短行，每行一个信息点',
    styleHints: '短视频文案：钩子开场、口语短句；受众偏成熟，表达稳一些，少用夸张网感词。',
  },
  {
    platformId: 'bilibili',
    name: 'B站',
    charLimit: null,
    tagStyle: 'space',
    coverRatio: '16:9',
    longForm: true,
    newlineRule: '正常段落排版，分节清晰',
    styleHints: '社区向表达：可以玩梗但不过度，正文像和观众聊天；视频简介版精炼列点，专栏版可长文。',
  },
  {
    platformId: 'weibo',
    name: '微博',
    charLimit: 2000,
    tagStyle: 'space',
    coverRatio: null,
    longForm: false,
    newlineRule: '短行，可带转发语',
    styleHints: '快节奏短内容：一条主帖讲清一件事，可带话题词；首句抓眼球，结尾可引导讨论。',
  },
]

/**
 * Registry lookup by platform id.
 * @param platformId - the platform id to look up.
 * @returns the platform's profile, or undefined when the id is not in the registry.
 */
export function platformProfileOf(platformId: string): PlatformProfile | undefined {
  return PLATFORM_PROFILES.find(profile => profile.platformId === platformId)
}

/** All registry platform ids. */
export const PLATFORM_IDS: readonly string[] = PLATFORM_PROFILES.map(profile => profile.platformId)

/** One manuscript-pool card: a finished deliverable awaiting distribution. */
export interface ManuscriptCard {
  readonly theme: string
  readonly file: string
  readonly title: string
  readonly status: OutputProject['status']
  /** Topic the creation started from, when the mirror carries it; null otherwise. */
  readonly topicId: string | null
}

/**
 * Project the outputs library snapshot into the manuscript pool: every
 * project with at least one root deliverable contributes its deliverables.
 * @param projects - the library snapshot's projects.
 * @returns the pool cards, newest project first.
 */
export function manuscriptCards(projects: readonly OutputProject[]): ManuscriptCard[] {
  const cards: ManuscriptCard[] = []
  for (const project of projects) {
    for (const file of project.deliverables) {
      cards.push({ theme: project.topic, file, title: project.title, status: project.status, topicId: project.topicId ?? null })
    }
  }
  return cards.reverse()
}

/**
 * Format one task's tags for its platform: `#标签 ` per tag for the space
 * style, `#标签#` pairs for the closed style, nothing for `none`.
 * @param tags - the bare tag words.
 * @param tagStyle - the platform's tag style.
 * @returns the formatted tag block, or an empty string.
 */
export function formatTags(tags: readonly string[], tagStyle: TagStyle): string {
  if (tagStyle === 'none' || tags.length === 0) return ''
  if (tagStyle === 'closed') return tags.map(tag => `#${tag}#`).join('')
  return tags.map(tag => `#${tag}`).join(' ')
}

/**
 * Append one attempt entry to a platform leg's log. Appending is the
 * idempotency basis: a retry adds a new entry and never rewrites history.
 * @param platform - the platform leg.
 * @param action - what was attempted.
 * @param ok - whether it succeeded.
 * @param detail - one-line outcome.
 * @param at - when it happened, ISO 8601.
 * @returns the platform leg with the entry appended.
 */
export function withAttempt(platform: PlatformTask, action: PlatformAttemptAction, ok: boolean, detail: string, at: string): PlatformTask {
  return { ...platform, attempts: [...platform.attempts, { at, action, ok, detail }] }
}

/**
 * Replace one platform leg inside a task, bumping the task's timestamp.
 * @param task - the owning task.
 * @param platformId - the leg to replace.
 * @param next - the new leg state.
 * @param at - the bump time, ISO 8601.
 * @returns the task with the leg replaced.
 */
export function withPlatform(task: PublishTask, platformId: string, next: PlatformTask, at: string): PublishTask {
  return {
    ...task,
    platforms: task.platforms.map(platform => platform.platformId === platformId ? next : platform),
    updatedAt: at,
  }
}

/**
 * Map a task onto a new task-level status with a fresh timestamp.
 * @param task - the task.
 * @param status - the next status.
 * @param at - the bump time, ISO 8601.
 * @returns the task with the status applied.
 */
export function withStatus(task: PublishTask, status: PublishTask['status'], at: string): PublishTask {
  return { ...task, status, updatedAt: at }
}

/**
 * Whether every platform leg has reached a status.
 * @param task - the task.
 * @param status - the platform status to test.
 * @returns true when no leg differs.
 */
export function allPlatformsAt(task: PublishTask, status: PlatformStatus): boolean {
  return task.platforms.length > 0 && task.platforms.every(platform => platform.status === status)
}

/**
 * Scan one theme's tasks for scheduled ones whose time has passed — the
 * open-view prompt. This phase never auto-executes: the scan only surfaces
 * candidates for the manual run.
 * @param tasks - the theme's stored tasks.
 * @param now - the current instant.
 * @returns the scheduled, overdue, not-yet-recorded tasks, oldest first.
 */
export function dueScheduledTasks(tasks: readonly PublishTask[], now: Date): PublishTask[] {
  return tasks
    .filter(task => task.mode === 'scheduled' && task.status === 'scheduled'
      && task.scheduledAt !== null && new Date(task.scheduledAt).getTime() <= now.getTime())
    .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))
}

/**
 * Whether a draft's body exceeds its platform's char cap (tags excluded).
 * @param content - the draft body text.
 * @param charLimit - the platform cap, or null when unlimited.
 * @returns true when the draft is over the cap.
 */
export function exceedsCharLimit(content: string, charLimit: number | null): boolean {
  return charLimit !== null && content.length > charLimit
}
