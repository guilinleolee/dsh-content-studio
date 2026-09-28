/**
 * Wire vocabulary of the content-outputs publish face: the distribution-task
 * state stored as `assets/_publish.json`, the derived per-platform drafts
 * under `assets/publish/<taskId>/`, the global `_publish-index.json`
 * aggregation aid, the `_publish-profiles.json` platform-account cards, and
 * the one-shot per-platform AI adaptation call. Client-safe by construction —
 * no Node or filesystem imports.
 */

/** Lifecycle of one publish task. `recorded` is this phase's terminal state:
 * the package exists and the real upload awaits the phase-2 MCP channel. */
export type PublishStatus = 'draft' | 'pendingReview' | 'scheduled' | 'recorded'

/** All statuses, in lifecycle order; the store validates against this list.
 * The phase-2 execution states (`executing` `partialSuccess` `success`
 * `failed`) are deliberately absent: they arrive with the MCP channel and
 * every consumer switch ends in a documented default until then. */
export const PUBLISH_STATUSES: readonly PublishStatus[] = ['draft', 'pendingReview', 'scheduled', 'recorded']

/** Lifecycle of one platform leg of a task. */
export type PlatformStatus = 'pending' | 'adapted' | 'edited' | 'recorded'

/** All platform statuses, in lifecycle order; the store validates against this list. */
export const PLATFORM_STATUSES: readonly PlatformStatus[] = ['pending', 'adapted', 'edited', 'recorded']

/** Publishing mode of one task. */
export type PublishMode = 'immediate' | 'scheduled'

/** All modes; the store validates against this list. */
export const PUBLISH_MODES: readonly PublishMode[] = ['immediate', 'scheduled']

/** What one attempt log entry records. */
export type PlatformAttemptAction = 'adapt' | 'edit' | 'record'

/** All attempt actions; the store validates against this list. */
export const PLATFORM_ATTEMPT_ACTIONS: readonly PlatformAttemptAction[] = ['adapt', 'edit', 'record']

/** One append-only log entry: retry appends, it never rewrites history. */
export interface PlatformAttempt {
  /** When the attempt happened, ISO 8601. */
  readonly at: string
  readonly action: PlatformAttemptAction
  /** Whether the attempt succeeded; failures stay logged. */
  readonly ok: boolean
  /** One-line outcome, human-readable. */
  readonly detail: string
}

/** One platform leg of a publish task; its draft lives at
 * `assets/publish/<taskId>/<platformId>.md`. */
export interface PlatformTask {
  readonly platformId: string
  /** The account card alias this leg publishes as. */
  readonly accountAlias: string
  /** Derived-draft file name inside the task's `assets/publish/<taskId>/` directory. */
  readonly contentFile: string
  /** Cover suggestion from the adaptation, or null. */
  readonly coverPrompt: string | null
  readonly tags: readonly string[]
  readonly status: PlatformStatus
  /** Append-only attempt log; the idempotency basis for retries. */
  readonly attempts: readonly PlatformAttempt[]
}

/** One distribution task, stored inside its theme's `assets/_publish.json`. */
export interface PublishTask {
  readonly taskId: string
  /** Display title; defaults to the manuscript title. */
  readonly title: string
  /** The theme-root deliverable this task distributes. */
  readonly manuscriptFile: string
  /** The create workbench content id behind the manuscript, or null. */
  readonly manuscriptId: string | null
  /** Linked topic-bank id, or null; the reflow flips it to `done`. */
  readonly topicId: string | null
  /** Persona digest applied to the adaptations, or null. */
  readonly personaDigest: string | null
  readonly mode: PublishMode
  /** Planned time for `scheduled` tasks, ISO 8601; null otherwise. */
  readonly scheduledAt: string | null
  /** Calendar entry id created for `scheduled` tasks, or null. */
  readonly scheduleItemId: string | null
  readonly status: PublishStatus
  readonly note: string | null
  readonly platforms: readonly PlatformTask[]
  readonly createdAt: string
  readonly updatedAt: string
}

/** Theme-side publish state, stored as `assets/_publish.json`. */
export interface PublishManifest {
  readonly formatVersion: 0
  readonly tasks: readonly PublishTask[]
}

/** Read face of the theme-side state: the validated manifest plus every
 * dropped stored task named; callers must not write back while non-empty. */
export interface PublishManifestRead {
  readonly manifest: PublishManifest | null
  readonly problems: readonly string[]
}

/** One aggregation row of the global `_publish-index.json`. */
export interface PublishIndexEntry {
  readonly taskId: string
  /** Theme directory the task's sidecar lives under. */
  readonly theme: string
  readonly title: string
  readonly status: PublishStatus
  readonly platformIds: readonly string[]
  readonly updatedAt: string
}

/** Global aggregation aid over every theme's sidecar. The sidecars are the
 * truth; a stale or corrupted index is rebuilt by a full scan. */
export interface PublishIndex {
  readonly formatVersion: 0
  readonly entries: readonly PublishIndexEntry[]
}

/** Read face of the global index. */
export interface PublishIndexRead {
  readonly index: PublishIndex
  readonly problems: readonly string[]
}

/** One platform-account card: an alias and switches, never credentials. */
export interface PublishProfile {
  readonly platformId: string
  /** Account alias shown on the card and carried into tasks. */
  readonly alias: string
  readonly enabled: boolean
  /** Free-form adaptation overrides folded into the AI prompt, or null. */
  readonly adaptationOverrides: string | null
}

/** Global account cards, stored as `_publish-profiles.json`. */
export interface PublishProfilesDoc {
  readonly formatVersion: 0
  readonly profiles: readonly PublishProfile[]
}

/** Read face of the account cards. */
export interface PublishProfilesRead {
  readonly profiles: readonly PublishProfile[]
  readonly problems: readonly string[]
}

/** One platform leg of the frozen phase-2 MCP handoff package. */
export interface PublishPackagePlatform {
  readonly platformId: string
  readonly accountAlias: string
  readonly contentFile: string
  readonly tags: readonly string[]
  readonly coverPrompt: string | null
  readonly scheduledAt: string | null
}

/** The MCP publish handoff, generated by 执行发布 and consumed by the
 * phase-2 channel. Frozen contract: the browser never calls it this phase. */
export interface PublishPackage {
  readonly taskId: string
  readonly theme: string
  readonly title: string
  readonly manuscriptFile: string
  readonly topicId: string | null
  readonly personaDigest: string | null
  readonly mode: PublishMode
  readonly scheduledAt: string | null
  readonly platforms: readonly PublishPackagePlatform[]
  readonly generatedAt: string
}

/** One explicit per-platform adaptation request. */
export interface PublishAdaptRequest {
  readonly platformId: string
  readonly platformName: string
  /** Platform style rules from the registry, phrased for the prompt. */
  readonly styleHints: string
  /** Character cap from the registry, or null when the platform is unlimited. */
  readonly charLimit: number | null
  /** Title of the source manuscript. */
  readonly title: string
  /** Full source manuscript text. */
  readonly sourceText: string
  /** Persona digest applied as the style reference, or null. */
  readonly personaDigest: string | null
}

/** One adaptation result for the caller to write back as a derived draft. */
export interface PublishAdaptResult {
  readonly content: string
  readonly coverPrompt: string | null
  readonly tags: readonly string[]
  readonly model: string
  readonly promptVersion: number
}
