/**
 * Wire vocabulary of the content-outputs Remote: the on-disk outputs library
 * contract projected to trusted clients. Client-safe by construction — no
 * Node or filesystem imports.
 */

import type { Branded } from '@deepseek-ai/dsh-brand'
import type { OutputCreateState } from './create/types.ts'

export type {
  CreateAiResult,
  CreateAssetList,
  CreateContext,
  CreateContentType,
  CreateEvaluateRequest,
  CreateEvaluation,
  CreateEvaluationDimension,
  CreateGenerateRequest,
  CreateGrade,
  CreateManifest,
  CreateProfileRef,
  CreatePublishRequest,
  CreatePublishResult,
  CreateRegisterRequest,
  CreateRewriteOperation,
  CreateRewriteRequest,
  CreateSourceRef,
  CreateStateRead,
  CreateStyleKey,
  CreateTemplate,
  CreateTemplateInput,
  CreateTemplateList,
  CreateTopicRef,
  CreateVersion,
  OutputCreateState,
} from './create/types.ts'
export { CREATE_CONTENT_TYPES, CREATE_GRADES, CREATE_REWRITE_OPERATIONS, CREATE_STYLES } from './create/types.ts'

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
  /**
   * Creation workbench bookkeeping (version counters and the publish
   * registration), mirrored here for the library view; absent on projects
   * the workbench never touched.
   */
  readonly create?: OutputCreateState
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

export type {
  GatherAiOperation,
  GatherAiRequest,
  GatherAiResult,
  GatherAssetMove,
  GatherAssetWrite,
  GatherFeedRequest,
  GatherFeedResult,
  GatherItemDraft,
  GatherManifest,
  GatherManifestRead,
  GatherMaterial,
  GatherMaterialId,
  GatherMaterialStatus,
} from './gather/types.ts'
export type {
  CompetitorAccountDigest,
  CompetitorAnalyzeWorkRequest,
  CompetitorAnalyzeWorkResult,
  CompetitorHeatLevel,
  CompetitorManifest,
  CompetitorManifestRead,
  CompetitorMetricSnapshot,
  CompetitorPlatform,
  CompetitorReport,
  CompetitorReportId,
  CompetitorReportRequest,
  CompetitorReportResult,
  CompetitorWork,
  CompetitorWorkAnalysis,
  CompetitorWorkAnalysisResult,
  CompetitorWorkId,
} from './competitor/types.ts'
export type {
  PersonaAccountStage,
  PersonaAiOperation,
  PersonaAiRequest,
  PersonaAiResult,
  PersonaEntry,
  PersonaField,
  PersonaFieldKey,
  PersonaFieldSource,
  PersonaId,
  PersonaInput,
  PersonaLink,
  PersonaPlatform,
  PersonaReport,
  PersonaStyle,
  PersonaStylePreset,
  PersonaStyleStrength,
  PersonasManifest,
  PersonasSnapshot,
} from './persona/types.ts'
export {
  PERSONA_FIELD_KEYS, PERSONA_FIELD_LABELS, PERSONA_FILL_PROHIBITED, PERSONA_PLATFORMS,
  PERSONA_PLATFORM_LABELS, PERSONA_STYLE_PRESETS, PERSONA_STYLE_PRESET_LABELS,
} from './persona/types.ts'
