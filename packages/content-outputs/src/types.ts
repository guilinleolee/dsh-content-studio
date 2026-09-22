/**
 * Wire vocabulary of the content-outputs Remote: the on-disk outputs library
 * contract projected to trusted clients. Client-safe by construction — no
 * Node or filesystem imports.
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Directory name of one output project under the library root. */
export type OutputTopic = Branded<'OutputTopic'>

/** Production state of one output project. */
export type OutputStatus = 'draft' | 'ready' | 'published'

/** Content medium of one output project. */
export type OutputKind =
  | 'article'
  | 'xhs-note'
  | 'video'
  | 'cards'
  | 'poster'
  | 'audio'
  | 'other'

/** Metadata file every output project carries at its root. */
export interface OutputMetadata {
  /** On-disk format version; 0 has no compatibility promise. */
  readonly formatVersion: 0
  readonly title: string
  readonly kind: OutputKind
  /** Target platform, or null when the project is platform-agnostic. */
  readonly platform: string | null
  readonly status: OutputStatus
  readonly tags: readonly string[]
  /** One-line summary, or null when the project carries none. */
  readonly summary: string | null
}

/** One output project directory projected from the library. */
export interface OutputProject {
  readonly topic: OutputTopic
  /** Metadata title; falls back to the topic name when metadata is absent. */
  readonly title: string
  readonly kind: OutputKind
  readonly platform: string | null
  readonly status: OutputStatus
  readonly tags: readonly string[]
  readonly summary: string | null
  /** Latest modification instant of the project directory (ISO 8601). */
  readonly updatedAt: string
  /** Finished files sitting at the project root (names only). */
  readonly deliverables: readonly string[]
  /** Number of intermediate files under the project's `assets/` directory. */
  readonly assetCount: number
  /** True when the project directory carries a valid `.dsh-output.json`. */
  readonly hasMetadata: boolean
}

/** One project directory the scanner could not project. */
export interface OutputProjectProblem {
  readonly topic: string
  /** What failed and why nothing else can recover it. */
  readonly detail: string
}

/** Point-in-time library snapshot returned by the content-outputs Remote. */
export interface ContentOutputsSnapshot {
  /** Absolute library root the snapshot was read from. */
  readonly root: string
  readonly projects: readonly OutputProject[]
  readonly problems: readonly OutputProjectProblem[]
}
