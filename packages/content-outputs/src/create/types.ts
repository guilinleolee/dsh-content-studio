/**
 * Wire vocabulary of the content-outputs create face: the creation workbench
 * state stored as `assets/_create.json`, the theme-root publishing handoff,
 * and the one-shot AI generation/rewrite calls. Client-safe by construction —
 * no Node or filesystem imports.
 */

/** The six built-in content types of the create workbench. */
export type CreateContentType =
  | 'gzh-article'
  | 'xhs-note'
  | 'video-script'
  | 'voiceover'
  | 'product-page'
  | 'rewrite'

/** All content types, in picker order; the store and the AI face validate against this list. */
export const CREATE_CONTENT_TYPES: readonly CreateContentType[] = [
  'gzh-article',
  'xhs-note',
  'video-script',
  'voiceover',
  'product-page',
  'rewrite',
]

/** Style switch for the `style` rewrite operation. */
export type CreateStyleKey = 'professional' | 'friendly' | 'hardcore' | 'story' | 'concise'

/** The rewrite operations of the selection toolbar. */
export type CreateRewriteOperation =
  | 'condense'
  | 'expand'
  | 'style'
  | 'perspective'
  | 'extract'
  | 'humanize-light'
  | 'humanize-deep'
  | 'titles'

/** All rewrite operations, in toolbar order. */
export const CREATE_REWRITE_OPERATIONS: readonly CreateRewriteOperation[] = [
  'condense',
  'expand',
  'style',
  'perspective',
  'extract',
  'humanize-light',
  'humanize-deep',
  'titles',
]

/** Style choices of the `style` operation, in toolbar order. */
export const CREATE_STYLES: readonly CreateStyleKey[] = ['professional', 'friendly', 'hardcore', 'story', 'concise']

/** Style provenance stored with every version: inline text today, profile refs once the persona column lands. */
export interface CreateProfileRef {
  readonly mode: 'profile' | 'inline'
  /** Style text digest (≤500 chars) so historical versions stay explainable. */
  readonly digest: string
}

/** One referenced source: a record only — source files are never copied. */
export interface CreateSourceRef {
  readonly kind: 'gather' | 'benchmark' | 'image' | 'note'
  readonly refId: string | null
  /** Asset file name inside the theme's `assets/` directory, when the reference points at one. */
  readonly file: string | null
  readonly title: string
  readonly url: string | null
  readonly addedAt: string
}

/** Cross-column handoff to the topic bank; `pendingSync` while that column is absent. */
export interface CreateTopicRef {
  readonly topicId: string | null
  readonly title: string
  readonly syncState: 'linked' | 'completed' | 'pendingSync' | 'orphan'
}

/** The editable creation context the generation prompt is built from. */
export interface CreateContext {
  readonly audience: string | null
  readonly points: string | null
  readonly references: string | null
}

/** Advisory grade of one evaluation dimension. */
export type CreateGrade = '优' | '良' | '中' | '弱'

/** All grades, weakest last; the AI face validates against this list. */
export const CREATE_GRADES: readonly CreateGrade[] = ['优', '良', '中', '弱']

/** One evaluated dimension: the grade plus its one-sentence justification. */
export interface CreateEvaluationDimension {
  readonly grade: CreateGrade
  readonly reason: string
}

/** G-Eval-style advisory evaluation stored with a version. */
export interface CreateEvaluation {
  readonly model: string
  readonly promptVersion: number
  readonly evaluatedAt: string
  readonly grade: CreateGrade
  readonly attraction: CreateEvaluationDimension
  readonly readability: CreateEvaluationDimension
  readonly differentiation: CreateEvaluationDimension
  readonly audienceFit: CreateEvaluationDimension
}

/** One full-text snapshot in the version list; self-contained, never a file reference. */
export interface CreateVersion {
  readonly v: number
  readonly ts: string
  /**
   * How the version came into being: `ai-generate`, `ai-generate#2/3`,
   * `manual-save`, `restore`, `retarget`, or `rewrite:<operation>`.
   */
  readonly trigger: string
  readonly words: number
  readonly content: string
  readonly pinned: boolean
  readonly profileRef: CreateProfileRef | null
  /** Advisory AI evaluation; null when never evaluated. Absent on pre-evaluation manifests. */
  readonly evaluation?: CreateEvaluation | null
}

/** Creation workbench state for one theme, stored as `assets/_create.json`. */
export interface CreateManifest {
  readonly formatVersion: 0
  readonly contentId: string
  readonly contentType: CreateContentType
  readonly currentVersion: number
  readonly context: CreateContext
  readonly topicRef: CreateTopicRef | null
  readonly sources: readonly CreateSourceRef[]
  readonly versions: readonly CreateVersion[]
}

/** Read face of the creation state: the validated manifest plus the current draft body. */
export interface CreateStateRead {
  readonly manifest: CreateManifest | null
  readonly draft: string | null
  /** Why the stored manifest was rejected; callers must not write back while non-empty. */
  readonly problems: readonly string[]
}

/** Publish request: copy `content` to the theme root under `file`. */
export interface CreatePublishRequest {
  readonly file: string
  readonly content: string
  readonly overwrite: boolean
}

/** Publish result: the stored root file name. */
export interface CreatePublishResult {
  readonly file: string
}

/** Registration retry after the root file landed but the metadata write failed. */
export interface CreateRegisterRequest {
  readonly file: string
  readonly version: number
}

/** Non-system asset file names of one theme's `assets/` directory. */
export interface CreateAssetList {
  readonly files: readonly string[]
}

/** One-shot generation request: the six built-in templates frame the prompt. */
export interface CreateGenerateRequest {
  readonly contentType: CreateContentType
  readonly title: string
  readonly audience: string | null
  readonly points: string | null
  readonly references: string | null
  readonly profileDigest: string | null
  /**
   * How many variants one call produces. Only the short content types accept
   * 3 (one request, three variants); long types generate serially, one call
   * per variant, from the client.
   */
  readonly count?: 1 | 3
  /**
   * A user-defined template driving this generation. The body is
   * re-validated server-side (placeholder whitelist) before use.
   */
  readonly customTemplate?: { readonly id: string; readonly revision: number; readonly body: string } | null
}

/** Evaluation request: the current draft judged against its content type. */
export interface CreateEvaluateRequest {
  readonly contentType: CreateContentType
  readonly title: string
  readonly text: string
}

/** One-shot rewrite request over a text selection. */
export interface CreateRewriteRequest {
  readonly operation: CreateRewriteOperation
  /** Style key for the `style` operation; ignored otherwise. */
  readonly style: CreateStyleKey | null
  readonly text: string
}

/** Result of both AI faces: the text plus its provenance. */
export interface CreateAiResult {
  readonly text: string
  /** The split variants when the call produced more than one; null otherwise. */
  readonly variants: readonly string[] | null
  readonly model: string
  readonly promptVersion: number
}

/** Creation bookkeeping mirrored into `.dsh-output.json` for the library view. */
export interface OutputCreateState {
  readonly currentVersion: number
  readonly publishedVersion: number | null
  readonly publishedPath: string | null
  readonly publishedAt: string | null
}

/** One user-defined content template stored in the global `_templates.json`. */
export interface CreateTemplate {
  readonly id: string
  /** Display name; never empty. */
  readonly title: string
  /** The content type the template targets, or `rewrite`-style free framing. */
  readonly contentType: CreateContentType
  /**
   * The prompt body. Carries only whitelisted placeholders
   * (`{{title}}` `{{audience}}` `{{points}}` `{{references}}` `{{profile}}`);
   * anything else fails the save and the run.
   */
  readonly body: string
  /** Server-managed monotonic revision; increments on every update. */
  readonly revision: number
  /** Last-write time, ISO 8601. */
  readonly updatedAt: string
}

/** Input face of a template upsert: `id` absent creates; `revision` is store-managed. */
export interface CreateTemplateInput {
  readonly id?: string
  readonly title: string
  readonly contentType: CreateContentType
  readonly body: string
}

/** Point-in-time template bank returned by the template face. */
export interface CreateTemplateList {
  readonly templates: readonly CreateTemplate[]
  /** Why stored entries (or the whole bank) were rejected; empty when clean. */
  readonly problems: readonly string[]
}
