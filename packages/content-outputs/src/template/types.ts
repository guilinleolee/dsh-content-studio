/**
 * Wire vocabulary of the global template library on the content-outputs
 * Remote: the reusable skeleton assets every Content Studio column can
 * initialize a form or prompt from, their shared tag taxonomy, the per-save
 * history snapshots, and the template AI operations (skeleton generation,
 * body optimization, variable extraction). Client-safe by construction — no
 * Node or filesystem imports. Templates live outside the outputs library on
 * purpose: they are global assets, never theme business data.
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Stable identity of one template. */
export type TemplateId = Branded<'TemplateId'>

/** Stable identity of one shared tag. */
export type TemplateTagId = Branded<'TemplateTagId'>

/** Every template category, one per studio column plus the dashboard placeholder. */
export const TEMPLATE_CATEGORIES = [
  'topic', 'creation', 'publish', 'calendar', 'retro',
  'interaction', 'persona', 'benchmark', 'intel', 'dashboard',
] as const

/** Category of one template; equals the studio column it initializes. */
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

/** Lifecycle state: `archived` templates survive but are never callable. */
export type TemplateStatus = 'active' | 'archived'

/** One `{{name}}` placeholder's editable metadata. */
export interface TemplateVariable {
  /** Placeholder identifier inside the body, `^[a-zA-Z][a-zA-Z0-9_]{0,63}$`. */
  readonly name: string
  /** Display name shown by the fill form. */
  readonly label: string
  /** One-line hint shown by the fill form. */
  readonly description: string
  /** Rendered when the caller leaves the variable empty. */
  readonly defaultValue: string
  /** Required variables block a picker confirmation until filled. */
  readonly required: boolean
}

/** One reusable skeleton asset as stored in `templates.json`. */
export interface TemplateRecord {
  readonly id: TemplateId
  /** Globally unique display name; a save rejects a duplicate. */
  readonly name: string
  readonly category: TemplateCategory
  readonly description: string
  readonly tagIds: readonly TemplateTagId[]
  /** Markdown skeleton with `{{var}}` placeholders. */
  readonly body: string
  readonly variables: readonly TemplateVariable[]
  readonly status: TemplateStatus
  /** Monotonic save counter starting at 1; one history snapshot per value. */
  readonly version: number
  readonly createdAt: string
  readonly updatedAt: string
}

/** The `templates.json` document; `formatVersion 0` has no compatibility promise. */
export interface TemplatesManifest {
  readonly formatVersion: 0
  readonly templates: readonly TemplateRecord[]
}

/** One shared tag as stored in `taxonomy.json`. */
export interface TemplateTag {
  readonly id: TemplateTagId
  /** Unique tag name; the taxonomy replaces wholesale. */
  readonly name: string
}

/** The `taxonomy.json` document; `formatVersion 0` has no compatibility promise. */
export interface TemplateTaxonomy {
  readonly formatVersion: 0
  readonly tags: readonly TemplateTag[]
}

/** Result face of listing the library: valid records and tags plus every dropped one named. */
export interface TemplatesSnapshot {
  readonly templates: readonly TemplateRecord[]
  readonly tags: readonly TemplateTag[]
  readonly problems: readonly string[]
}

/**
 * Upsert payload of `putTemplate`: everything a client owns, with the
 * gateway-owned `version`, `status` transitions, and timestamps absent. Every
 * call is a manual save and writes one history snapshot.
 */
export interface TemplateInput {
  /** Present when updating an existing template; absent for create. */
  readonly id?: TemplateId
  readonly name: string
  readonly category: TemplateCategory
  readonly description: string
  readonly tagIds: readonly TemplateTagId[]
  readonly body: string
  readonly variables: readonly TemplateVariable[]
  /** Human-readable note stored on the snapshot this save produces. */
  readonly changeNote?: string
}

/** One full-record snapshot under `history/<template-id>/<version>.json`. */
export interface TemplateHistoryEntry {
  readonly version: number
  readonly changeNote: string
  readonly createdAt: string
  /** The complete record exactly as it was at this version. */
  readonly record: TemplateRecord
}

/** Result face of `getTemplateHistory`, newest version first. */
export interface TemplateHistoryRead {
  readonly entries: readonly TemplateHistoryEntry[]
}

/** Import conflict resolution for a pack entry whose `id` already exists. */
export type TemplateImportStrategy = 'skip' | 'overwrite' | 'rename'

/** The portable import/export document. */
export interface TemplatePack {
  readonly format: 'dsh-template-pack'
  /** Pack format version; readers reject unknown values. */
  readonly formatVersion: 1
  readonly exportedAt: string
  readonly templates: readonly TemplateRecord[]
  readonly tags: readonly TemplateTag[]
}

/** Result face of `importTemplates`: one entry lands in exactly one bucket. */
export interface TemplateImportSummary {
  readonly added: number
  readonly skipped: number
  readonly overwritten: number
  /** Entries stored under a fresh id because their id already existed. */
  readonly renamed: number
  /** Every rejected entry with its reason; the rest still imported. */
  readonly failed: readonly string[]
}

/** Operation identifier of the template AI call. */
export type TemplateAiOperation = 'generate' | 'optimize' | 'extract'

/** Request face of the template AI call; exactly one operation per request. */
export type TemplateAiRequest =
  | {
    /** Draft a whole skeleton from a natural-language description. */
    readonly operation: 'generate'
    readonly category: TemplateCategory
    readonly description: string
  }
  | {
    /** Rewrite one existing body per the user's instruction. */
    readonly operation: 'optimize'
    readonly body: string
    readonly instruction: string
  }
  | {
    /** Distill one business instance into a skeleton with placeholders. */
    readonly operation: 'extract'
    readonly content: string
  }

/** The editable draft an AI operation proposes; nothing is persisted here. */
export interface TemplateAiDraft {
  /** Suggested display name; empty means the caller names it. */
  readonly name: string
  /** Suggested description; empty means the caller writes one. */
  readonly description: string
  /** The proposed skeleton body with `{{var}}` placeholders. */
  readonly body: string
  /** Variable metadata the model proposed; the body stays the source of truth. */
  readonly variables: readonly TemplateVariable[]
}

/** Result face of the template AI call; nothing here touches disk. */
export interface TemplateAiResult {
  readonly operation: TemplateAiOperation
  /** Prompt version for provenance display. */
  readonly promptVersion: string
  readonly draft: TemplateAiDraft
  /** Field-level rejections the caller surfaces without failing the draft. */
  readonly problems: readonly string[]
}
