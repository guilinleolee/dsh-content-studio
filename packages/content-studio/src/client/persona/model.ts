/**
 * The persona wizard's editable form model: the browser-side shape between
 * the wire `PersonaEntry` and the four-step form. Every wire round-trip goes
 * through {@link formFromEntry} / {@link inputFromForm}, and every field
 * edit flips its provenance back to `user` — the AI never stays the source
 * of a value the user has touched.
 */

import type {
  PersonaAccountStage, PersonaEntry, PersonaField, PersonaFieldKey, PersonaFieldSource,
  PersonaId, PersonaInput, PersonaLink, PersonaPlatform, PersonaReport, PersonaStylePreset,
  PersonaStyleStrength,
} from '@deepseek-ai/dsh-content-outputs/types'

/**
 * The persona vocabulary the browser owns: the platform, field, and style
 * enum tables for the pickers, the packed prompt preview, and the fill
 * scope. The gateway carries the same keys for wire validation and the
 * digest; the sync between the two sides is pinned by a cross-check test,
 * because the bundle purity gate forbids importing the gateway's tables as
 * values here.
 */

/** Every persona platform, in picker order; the competitor face's word list extended. */
export const PERSONA_PLATFORMS = ['xhs', 'douyin', 'bili', 'zhihu', 'wechat', 'channels', 'weibo', 'toutiao'] as const

/** Chinese label of one persona platform. */
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

/** Every persona field key, in wizard order. */
export const PERSONA_FIELD_KEYS = ['whoAmI', 'audience', 'oneLiner', 'niche', 'goal', 'monetize', 'contentValue', 'cadence', 'phrases'] as const

/** Chinese label of one persona field. */
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

/** Every style preset, in picker order. */
export const PERSONA_STYLE_PRESETS = ['professional', 'friendly', 'humor', 'concise', 'narrative', 'hardcore', 'empathy'] as const

/** Chinese label of one style preset. */
export const PERSONA_STYLE_PRESET_LABELS: Readonly<Record<PersonaStylePreset, string>> = {
  professional: '专业严谨',
  friendly: '亲切接地气',
  humor: '幽默网感',
  concise: '简洁干练',
  narrative: '故事叙事',
  hardcore: '硬核干货',
  empathy: '温柔共情',
}

/** One editable structured field: the text plus the provenance it keeps. */
export interface PersonaFormField {
  value: string
  source: PersonaFieldSource
  aiMeta: PersonaField['aiMeta']
}

/** The wizard's editable form. Text areas hold raw text; word lists are parsed on save. */
export interface PersonaForm {
  editingId: PersonaId | null
  clonedFrom: PersonaId | null
  name: string
  platforms: PersonaPlatform[]
  accountStage: PersonaAccountStage
  fields: Record<PersonaFieldKey, PersonaFormField>
  links: PersonaLink[]
  siteUrl: string
  sitePastedText: string
  preset: PersonaStylePreset | null
  customText: string
  strength: PersonaStyleStrength
  bannedWordsText: string
  redLinesText: string
  resumeText: string
  resumeName: string | null
  resumeConsent: boolean
  /** The stored report rides the form untouched: editing it is a separate save path. */
  report: PersonaReport | null
}

/** The empty form of a brand-new persona. */
export function emptyForm(): PersonaForm {
  const fields = {} as Record<PersonaFieldKey, PersonaFormField>
  for (const key of PERSONA_FIELD_KEYS) fields[key] = { value: '', source: 'user', aiMeta: null }
  return {
    editingId: null,
    clonedFrom: null,
    name: '',
    platforms: [],
    accountStage: 'fresh',
    fields,
    links: [],
    siteUrl: '',
    sitePastedText: '',
    preset: null,
    customText: '',
    strength: 'light',
    bannedWordsText: '',
    redLinesText: '',
    resumeText: '',
    resumeName: null,
    resumeConsent: false,
    report: null,
  }
}

/** Stored field → editable text; nulls become empty strings. */
function fieldText(field: PersonaField): PersonaFormField {
  return { value: field.value ?? '', source: field.source, aiMeta: field.aiMeta }
}

/**
 * Build the form from a stored entry.
 * @param entry - the stored persona.
 * @param options - `clone: true` builds a clone draft: no editing id, the
 *   source recorded as `clonedFrom`, and the report remapped to the clone's
 *   revision 1 so the staleness banner stays correct.
 * @returns the editable form.
 */
export function formFromEntry(entry: PersonaEntry, options: { clone?: boolean } = {}): PersonaForm {
  const base = emptyForm()
  return {
    ...base,
    editingId: options.clone === true ? null : entry.id,
    clonedFrom: options.clone === true ? entry.id : null,
    name: entry.name,
    platforms: [...entry.platforms],
    accountStage: entry.accountStage,
    fields: Object.fromEntries(
      PERSONA_FIELD_KEYS.map(key => [key, fieldText(entry.fields[key])]),
    ) as Record<PersonaFieldKey, PersonaFormField>,
    links: entry.links.map(link => ({ ...link })),
    siteUrl: entry.site.url ?? '',
    sitePastedText: entry.site.pastedText ?? '',
    preset: entry.style.preset,
    customText: entry.style.customText ?? '',
    strength: entry.style.strength,
    bannedWordsText: entry.style.bannedWords.join('；'),
    redLinesText: entry.style.redLines.join('；'),
    resumeText: entry.assets.resumeText ?? '',
    resumeName: entry.assets.resumeName,
    report: options.clone === true && entry.report !== null
      ? { ...entry.report, sourceRevision: 1 }
      : entry.report,
  }
}

/**
 * Parse one textarea's word list: entries separated by newlines, Chinese or
 * ASCII commas and semicolons (the join separator on the way back into the
 * form); blanks drop.
 * @param text - the raw textarea text.
 * @returns the trimmed, non-empty entries.
 */
export function parseWordList(text: string): string[] {
  return text.split(/\n|，|,|；|;/u).map(word => word.trim()).filter(word => word.length > 0)
}

/**
 * Build the upsert payload from the form. Empty field texts become `null`
 * values; a touched field keeps `user` provenance and loses any AI metadata.
 * @param form - the wizard form.
 * @returns the gateway upsert payload (digest, revision, timestamps are gateway-owned).
 */
export function inputFromForm(form: PersonaForm): PersonaInput {
  const fields = {} as Record<PersonaFieldKey, PersonaField>
  for (const key of PERSONA_FIELD_KEYS) {
    const field = form.fields[key]
    const value = field.value.trim()
    fields[key] = {
      value: value.length === 0 ? null : value,
      source: field.source,
      aiMeta: field.source === 'ai' ? field.aiMeta : null,
    }
  }
  return {
    ...(form.editingId === null ? {} : { id: form.editingId }),
    name: form.name.trim(),
    platforms: [...form.platforms],
    accountStage: form.accountStage,
    fields,
    links: form.links.map(link => ({ ...link })),
    site: {
      url: form.siteUrl.trim().length === 0 ? null : form.siteUrl.trim(),
      pastedText: form.sitePastedText.trim().length === 0 ? null : form.sitePastedText,
    },
    style: {
      preset: form.preset,
      customText: form.customText.trim().length === 0 ? null : form.customText.trim(),
      strength: form.strength,
      bannedWords: parseWordList(form.bannedWordsText),
      redLines: parseWordList(form.redLinesText),
    },
    assets: { resumeText: form.resumeText.trim().length === 0 ? null : form.resumeText, resumeName: form.resumeName },
    report: form.report,
    clonedFrom: form.clonedFrom,
  }
}

/**
 * Adopt one AI candidate into the form: the value lands with `ai` source
 * and the prompt's provenance stamped at the adoption instant.
 * @param form - the wizard form (mutated copy returned).
 * @param key - the field to fill.
 * @param value - the adopted text.
 * @param promptVersion - the AI prompt that produced the value.
 * @returns the next form.
 */
export function adoptField(form: PersonaForm, key: PersonaFieldKey, value: string, promptVersion: string): PersonaForm {
  return {
    ...form,
    fields: {
      ...form.fields,
      [key]: { value, source: 'ai', aiMeta: { promptVersion, at: new Date().toISOString() } },
    },
  }
}
