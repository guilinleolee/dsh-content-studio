/**
 * Wire vocabulary of the gather write face on the content-outputs Remote:
 * RSS/Atom collection drafts, the `_gather.json` manifest, and the AI
 * processing request/result. Client-safe by construction — no Node or
 * filesystem imports. Storage rules live with the gateway; the browser side
 * owns source and task configuration and never appears here.
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Stable identity of one gathered material: the feed guid, else the SHA-1 of the normalized link. */
export type GatherMaterialId = Branded<'GatherMaterialId'>

/** Read state of one gathered material. `favorite` and `picked` are user markers and exempt from retention trimming. */
export type GatherMaterialStatus = 'unread' | 'read' | 'favorite' | 'picked'

/**
 * One feed entry draft produced by `fetchFeed`. Network reading only — the
 * draft is not persisted; the caller decides what enters the manifest.
 * `content` carries the feed's raw item HTML and is never rendered directly:
 * persisting it goes through `writeAsset`, which sanitizes before writing.
 * Absent feed fields arrive as `null`, never `undefined`.
 */
export interface GatherItemDraft {
  /** Deduplication key: the feed guid when present, else the SHA-1 of the normalized link. */
  readonly id: GatherMaterialId
  /** Original feed guid, kept so the key strategy can be recomputed later. */
  readonly rawGuid: string | null
  /** Normalized item link. */
  readonly url: string
  readonly title: string | null
  /** Item publication instant (ISO 8601), or null when the feed states none. */
  readonly publishedAt: string | null
  /** Item summary text as the feed states it, or null. */
  readonly summary: string | null
  /** Raw item HTML body, or null when the feed carries summary only. */
  readonly content: string | null
}

/** Request face of `fetchFeed`: the feed URL plus the source's stored conditional-request cursors. */
export interface GatherFeedRequest {
  readonly url: string
  /** Stored `ETag` echoed back as `If-None-Match`, when the source has one. */
  readonly etag?: string
  /** Stored `Last-Modified` echoed back as `If-Modified-Since`, when the source has one. */
  readonly lastModified?: string
}

/** Result face of `fetchFeed`: fresh drafts plus the conditional-request cursors for the next run. */
export interface GatherFeedResult {
  /** True when the server answered 304: `items` is empty and nothing changed. */
  readonly notModified: boolean
  /** `ETag` response cursor to store on the source, or null when the server sent none. */
  readonly etag: string | null
  /** `Last-Modified` response cursor to store on the source, or null when the server sent none. */
  readonly lastModified: string | null
  /** Feed title, or null when the document states none. */
  readonly feedTitle: string | null
  readonly items: readonly GatherItemDraft[]
}

/** One gathered material as stored in the `_gather.json` manifest. */
export interface GatherMaterial {
  /** Deduplication key within its source: guid, else SHA-1 of the normalized link. */
  readonly id: GatherMaterialId
  readonly sourceId: string
  readonly sourceName: string
  readonly title: string
  /** Normalized link. */
  readonly url: string
  /** Item publication instant (ISO 8601), when the feed states one. */
  readonly publishedAt?: string
  /** Collection instant (ISO 8601). */
  readonly gatheredAt: string
  readonly status: GatherMaterialStatus
  /** Short summary, either from the feed or AI-generated. */
  readonly summary?: string
  /** AI-generated key points. */
  readonly points?: readonly string[]
  /** AI-generated topic score (0–100). */
  readonly score?: number
  /** AI-generated tags. */
  readonly tags?: readonly string[]
  /** User-created excerpt snippets. */
  readonly excerpts?: readonly string[]
  /** Body-snapshot file name under the theme's `assets/`, when one was saved. */
  readonly bodyFile?: string
  /** Original feed guid, kept beside the deduplication key. */
  readonly rawGuid?: string
}

/** The `_gather.json` manifest document; `formatVersion 0` has no compatibility promise. */
export interface GatherManifest {
  readonly formatVersion: 0
  readonly materials: readonly GatherMaterial[]
}

/** Result face of reading a gather manifest: the valid entries plus every dropped one named. */
export interface GatherManifestRead {
  readonly manifest: GatherManifest
  /** Stored entries that failed validation, named but not dropped silently. */
  readonly problems: readonly string[]
}

/**
 * Request face of `writeAsset`: one file inside the theme's `assets/`
 * directory. `*.html` content is sanitized server-side through the
 * allowlist before it reaches disk; other text files are stored verbatim.
 */
export interface GatherAssetWrite {
  /** Outputs-project (theme) directory name; never a path with separators. */
  readonly theme: string
  /** File name relative to the theme's `assets/` directory; traversal is rejected. */
  readonly file: string
  /** Complete file content. */
  readonly content: string
}

/**
 * Request face of `moveAsset`: renaming or relocating one file between two
 * themes' `assets/` directories. A within-theme rename (`fromTheme` equal to
 * `toTheme`) is the special case the gather view uses for renaming; the
 * cross-theme form is what rebinding one material to another theme needs,
 * because the browser never reads a snapshot back to rewrite it by hand.
 */
export interface GatherAssetMove {
  /** Outputs-project directory the file currently sits under. */
  readonly fromTheme: string
  /** Current file name relative to `fromTheme`'s `assets/`. */
  readonly from: string
  /** Outputs-project directory to move the file into. */
  readonly toTheme: string
  /** Next file name relative to `toTheme`'s `assets/`; must not exist. */
  readonly to: string
}

/** Operation identifier for the AI processing call. */
export type GatherAiOperation = 'process'

/** Request face of the AI processing call: one material's display facts plus its snapshot reference. */
export interface GatherAiRequest {
  /** Which operation to run; the gateway currently implements `process` only. */
  readonly operation: GatherAiOperation
  /** Outputs-project directory that holds the snapshot, when `bodyFile` is set. */
  readonly theme?: string
  /** Body-snapshot file name under the theme's `assets/`, when one exists. */
  readonly bodyFile?: string
  readonly title: string
  /** Feed or user-known summary, used when no snapshot exists. */
  readonly summary?: string
  readonly url?: string
}

/** Structured AI processing result written back into the manifest entry by the caller. */
export interface GatherAiResult {
  /** One-paragraph summary in the material's language. */
  readonly summary: string
  /** Up to five key points. */
  readonly points: readonly string[]
  /** Topic score from 0 to 100. */
  readonly score: number
  /** Up to five topic tags. */
  readonly tags: readonly string[]
}
