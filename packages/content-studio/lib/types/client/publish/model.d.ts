/**
 * Pure model of the publish view: the built-in platform registry (the single
 * source of platform rules — the AI prompt, the char counter, and the tag
 * formatting all read it), the task-level helpers behind the state machine,
 * the due-task scan for the open-time prompt, and the manuscript-pool
 * projection from the outputs library snapshot.
 */
import type { OutputProject } from '@deepseek-ai/dsh-content-outputs/types';
import type { PlatformAttemptAction, PlatformStatus, PlatformTask, PublishTask } from '@deepseek-ai/dsh-content-outputs/types';
/** How tags are written on one platform. */
export type TagStyle = 'space' | 'closed' | 'none';
/** One built-in platform rule row. Adding a platform is appending a row —
 * never a code change. */
export interface PlatformProfile {
    readonly platformId: string;
    readonly name: string;
    /** Character cap of the body text, or null when the platform is unlimited. */
    readonly charLimit: number | null;
    readonly tagStyle: TagStyle;
    /** Cover aspect ratio hint, or null when covers do not apply. */
    readonly coverRatio: string | null;
    readonly longForm: boolean;
    /** Line-break convention phrased for the prompt. */
    readonly newlineRule: string;
    /** Platform style rules, phrased for the prompt. */
    readonly styleHints: string;
}
/** The built-in registry, one row per platform, domestic first. */
export declare const PLATFORM_PROFILES: readonly PlatformProfile[];
/** Registry lookup by platform id. */
export declare function platformProfileOf(platformId: string): PlatformProfile | undefined;
/** All registry platform ids. */
export declare const PLATFORM_IDS: readonly string[];
/** One manuscript-pool card: a finished deliverable awaiting distribution. */
export interface ManuscriptCard {
    readonly theme: string;
    readonly file: string;
    readonly title: string;
    readonly status: OutputProject['status'];
}
/**
 * Project the outputs library snapshot into the manuscript pool: every
 * project with at least one root deliverable contributes its deliverables.
 * @param projects - the library snapshot's projects.
 * @returns the pool cards, newest project first.
 */
export declare function manuscriptCards(projects: readonly OutputProject[]): ManuscriptCard[];
/**
 * Format one task's tags for its platform: `#标签 ` per tag for the space
 * style, `#标签#` pairs for the closed style, nothing for `none`.
 * @param tags - the bare tag words.
 * @param tagStyle - the platform's tag style.
 * @returns the formatted tag block, or an empty string.
 */
export declare function formatTags(tags: readonly string[], tagStyle: TagStyle): string;
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
export declare function withAttempt(platform: PlatformTask, action: PlatformAttemptAction, ok: boolean, detail: string, at: string): PlatformTask;
/**
 * Replace one platform leg inside a task, bumping the task's timestamp.
 * @param task - the owning task.
 * @param platformId - the leg to replace.
 * @param next - the new leg state.
 * @param at - the bump time, ISO 8601.
 * @returns the task with the leg replaced.
 */
export declare function withPlatform(task: PublishTask, platformId: string, next: PlatformTask, at: string): PublishTask;
/**
 * Map a task onto a new task-level status with a fresh timestamp.
 * @param task - the task.
 * @param status - the next status.
 * @param at - the bump time, ISO 8601.
 * @returns the task with the status applied.
 */
export declare function withStatus(task: PublishTask, status: PublishTask['status'], at: string): PublishTask;
/**
 * Whether every platform leg has reached a status.
 * @param task - the task.
 * @param status - the platform status to test.
 * @returns true when no leg differs.
 */
export declare function allPlatformsAt(task: PublishTask, status: PlatformStatus): boolean;
/**
 * Scan one theme's tasks for scheduled ones whose time has passed — the
 * open-view prompt. This phase never auto-executes: the scan only surfaces
 * candidates for the manual run.
 * @param tasks - the theme's stored tasks.
 * @param now - the current instant.
 * @returns the scheduled, overdue, not-yet-recorded tasks, oldest first.
 */
export declare function dueScheduledTasks(tasks: readonly PublishTask[], now: Date): PublishTask[];
/**
 * Whether a draft's body exceeds its platform's char cap (tags excluded).
 * @param content - the draft body text.
 * @param charLimit - the platform cap, or null when unlimited.
 * @returns true when the draft is over the cap.
 */
export declare function exceedsCharLimit(content: string, charLimit: number | null): boolean;
//# sourceMappingURL=model.d.ts.map