/**
 * Wire vocabulary of the persona write face on the content-outputs Remote:
 * the account-persona entries behind the 画像 view, their `_personas.json`
 * manifest at the library root, and the persona AI operations (field fill,
 * résumé extraction, report generation). Client-safe by construction — no
 * Node or filesystem imports. Entry text is embedded in the manifest, so a
 * persona never references an external file and the manifest is the whole
 * backup. Enum label tables live here (not in locales) so the browser
 * dropdowns, the packed prompt preview, and the gateway-side digest all read
 * one home.
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Stable identity of one account persona. */
export type PersonaId = Branded<'PersonaId'>

/** Operation platform of one persona; the competitor face's word list extended with 视频号 and 微博. */
export type PersonaPlatform = 'xhs' | 'douyin' | 'bili' | 'zhihu' | 'wechat' | 'channels' | 'weibo' | 'toutiao'

/** Every persona platform, frozen for wire validation and picker order. */
export const PERSONA_PLATFORMS = ['xhs', 'douyin', 'bili', 'zhihu', 'wechat', 'channels', 'weibo', 'toutiao'] as const

/** Chinese label of one persona platform; shared by the picker, the packed prompt, and the digest. */
export const PERSONA_PLATFORM_LABELS: Readonly<Record<PersonaPlatform, string>> = {
  xhs: '小红书',
  douyin: '抖音',
  bili: 'B 站',
  zhihu: '知乎',
  wechat: '公众号',
  channels: '视频号',
  weibo: '微博',
  toutiao: '今日头条',
}

/** Account stage: the persona starts a brand-new account, or runs an existing one. */
export type PersonaAccountStage = 'fresh' | 'existing'

/** Where one structured field's value came from. */
export type PersonaFieldSource = 'user' | 'ai' | 'template'

/** Keys of the structured persona fields; every key is AI-fillable except `whoAmI` (see {@link PERSONA_FILL_PROHIBITED}). */
export type PersonaFieldKey =
  | 'whoAmI'
  | 'audience'
  | 'oneLiner'
  | 'niche'
  | 'goal'
  | 'monetize'
  | 'contentValue'
  | 'cadence'
  | 'phrases'

/** Every persona field key, frozen for wire validation and form order. */
export const PERSONA_FIELD_KEYS = ['whoAmI', 'audience', 'oneLiner', 'niche', 'goal', 'monetize', 'contentValue', 'cadence', 'phrases'] as const

/** Chinese label of one persona field; shared by the wizard, the preview, and the AI prompts. */
export const PERSONA_FIELD_LABELS: Readonly<Record<PersonaFieldKey, string>> = {
  whoAmI: '我是谁（主体背景）',
  audience: '目标受众',
  oneLiner: '人设一句话简介',
  niche: '赛道 / 行业',
  goal: '核心目标',
  monetize: '变现方式',
  contentValue: '内容核心价值',
  cadence: '更新节奏',
  phrases: '推荐句式 / 表达习惯',
}

/** Field keys the generic fill operation must never produce: the subject background is a fact only the user or the résumé face supplies. */
export const PERSONA_FILL_PROHIBITED: readonly PersonaFieldKey[] = ['whoAmI']

/** Built-in writing style presets (step 4 of the wizard); `null` preset means custom text only. */
export type PersonaStylePreset = 'professional' | 'friendly' | 'humor' | 'concise' | 'narrative' | 'hardcore' | 'empathy'

/** Every style preset, frozen for wire validation and picker order. */
export const PERSONA_STYLE_PRESETS = ['professional', 'friendly', 'humor', 'concise', 'narrative', 'hardcore', 'empathy'] as const

/** Chinese label of one style preset; shared by the picker, the packed prompt, and the digest. */
export const PERSONA_STYLE_PRESET_LABELS: Readonly<Record<PersonaStylePreset, string>> = {
  professional: '专业严谨',
  friendly: '亲切接地气',
  humor: '幽默网感',
  concise: '简洁干练',
  narrative: '故事叙事',
  hardcore: '硬核干货',
  empathy: '温柔共情',
}

/** How strictly the style constrains generation. */
export type PersonaStyleStrength = 'light' | 'strict'

/** One structured persona field with its provenance: who produced the value. */
export interface PersonaField {
  readonly value: string | null
  readonly source: PersonaFieldSource
  /** Model provenance when `source` is `ai`: which prompt produced the value, and when. */
  readonly aiMeta: { readonly promptVersion: string; readonly at: string } | null
}

/** One social account link row (wizard step 2). */
export interface PersonaLink {
  readonly platform: PersonaPlatform
  readonly url: string
  readonly bio: string | null
  readonly sampleText: string | null
}

/** Writing style configuration (wizard step 4); `preset` and `customText` may coexist, the custom text wins. */
export interface PersonaStyle {
  readonly preset: PersonaStylePreset | null
  readonly customText: string | null
  readonly strength: PersonaStyleStrength
  readonly bannedWords: readonly string[]
  readonly redLines: readonly string[]
}

/**
 * The derived report document, embedded in full. The form is the source of
 * truth; editing the report never rewrites it, and a report whose
 * `sourceRevision` is behind the entry's revision may be stale.
 */
export interface PersonaReport {
  readonly markdown: string
  /** Form revision the report was generated from. */
  readonly sourceRevision: number
  /** True once the user edited the report text; regeneration then requires confirmation. */
  readonly editedByUser: boolean
  readonly generatedAt: string
  readonly promptVersion: string
}

/** One account persona as stored in the `_personas.json` manifest. */
export interface PersonaEntry {
  readonly id: PersonaId
  readonly name: string
  readonly platforms: readonly PersonaPlatform[]
  readonly accountStage: PersonaAccountStage
  /** Bumped on every form save; the create face's profileRef anchors `id + revision + digest`. */
  readonly revision: number
  /** ≤200-character deterministic style summary, computed by the gateway on save; never sent by a client. */
  readonly digest: string
  readonly fields: Readonly<Record<PersonaFieldKey, PersonaField>>
  readonly links: readonly PersonaLink[]
  readonly site: { readonly url: string | null; readonly pastedText: string | null }
  readonly style: PersonaStyle
  /** Embedded text assets; original files are never stored. */
  readonly assets: { readonly resumeText: string | null; readonly resumeName: string | null }
  readonly report: PersonaReport | null
  /** Source persona id when this entry is a clone; a clone carries a fresh id and revision 1. */
  readonly clonedFrom: PersonaId | null
  readonly createdAt: string
  readonly updatedAt: string
}

/** The `_personas.json` manifest document; `formatVersion 0` has no compatibility promise. */
export interface PersonasManifest {
  readonly formatVersion: 0
  readonly personas: readonly PersonaEntry[]
}

/** Result face of listing personas: valid entries plus every dropped one named. */
export interface PersonasSnapshot {
  readonly personas: readonly PersonaEntry[]
  readonly problems: readonly string[]
}

/**
 * Upsert payload of `putPersona`: everything a client owns, with the
 * gateway-owned `revision`, `digest`, `createdAt`, and `updatedAt` absent. A
 * report edit never rides this face (it would bump the form revision) — it
 * goes through `putPersonaReport`.
 */
export interface PersonaInput {
  /** Present when updating an existing persona; absent for create and clone (a clone gets a fresh id). */
  readonly id?: PersonaId
  readonly name: string
  readonly platforms: readonly PersonaPlatform[]
  readonly accountStage: PersonaAccountStage
  readonly fields: Readonly<Record<PersonaFieldKey, PersonaField>>
  readonly links: readonly PersonaLink[]
  readonly site: { readonly url: string | null; readonly pastedText: string | null }
  readonly style: PersonaStyle
  readonly assets: { readonly resumeText: string | null; readonly resumeName: string | null }
  /** Stored verbatim after validation; a clone may remap its `sourceRevision` to 1 before sending. */
  readonly report?: PersonaReport | null
  readonly clonedFrom?: PersonaId | null
}

/** Operation identifier of the persona AI call. */
export type PersonaAiOperation = 'fill' | 'resume' | 'report'

/** Request face of the persona AI call; exactly one operation per request. */
export type PersonaAiRequest =
  | {
    /** Fill blank fields from the known ones; `whoAmI` is never fillable. */
    readonly operation: 'fill'
    /** Non-empty field values the fill may use as context. */
    readonly known: Readonly<Partial<Record<PersonaFieldKey, string>>>
    /** The blank field keys the caller wants filled. */
    readonly blanks: readonly PersonaFieldKey[]
  }
  | {
    /** Extract structured fields from one résumé / background text; `whoAmI` is allowed here. */
    readonly operation: 'resume'
    readonly resumeText: string
  }
  | {
    /** Generate the full persona report from one saved entry's facts. */
    readonly operation: 'report'
    readonly facts: PersonaEntry
  }

/** Result face of the persona AI call; the prompt version rides along for provenance stamping. */
export type PersonaAiResult =
  | { readonly operation: 'fill'; readonly promptVersion: string; readonly fields: Readonly<Partial<Record<PersonaFieldKey, string>>> }
  | { readonly operation: 'resume'; readonly promptVersion: string; readonly fields: Readonly<Partial<Record<PersonaFieldKey, string>>> }
  | { readonly operation: 'report'; readonly promptVersion: string; readonly markdown: string }
