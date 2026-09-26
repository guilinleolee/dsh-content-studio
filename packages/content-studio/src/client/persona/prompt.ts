/**
 * The packed account-persona prompt (`persona-prompt@1`): the deterministic
 * rendering that turns one persona's fields and style into the text the
 * create face injects as its style layer. Pure functions of the persona
 * content — the wizard's live preview, the card digest display, and the
 * future create-side profile injection all read this one rendering, so the
 * prompt the user previews is byte-for-byte the prompt that gets injected.
 * Empty fields drop their whole line; AI-sourced values carry the inference
 * annotation; banned words and red lines render as structured hard
 * constraints, never blended into the prose.
 */

import type { PersonaEntry, PersonaField, PersonaFieldKey, PersonaStyle } from '@deepseek-ai/dsh-content-outputs/types'
import { PERSONA_STYLE_PRESET_LABELS } from './model.ts'

/** Version stamped beside every rendering of the packed prompt. */
export const PERSONA_PROMPT_VERSION = 'persona-prompt@1'

/** The annotation appended to AI-inferred values, in the prompt and the report alike. */
export const PERSONA_AI_MARK = '（AI 推断，供参考）'

/** The pieces of one persona the packed prompt renders. */
export interface PersonaPromptSource {
  readonly name: string
  readonly revision: number
  readonly fields: Readonly<Record<PersonaFieldKey, PersonaField>>
  readonly style: PersonaStyle
}

/**
 * Render one persona field value with its provenance: empty values become
 * `null` (the line drops), AI-sourced values carry the inference annotation.
 * @param field - the stored or drafted field.
 * @returns the prompt text for the value, or null when the field is empty.
 */
function promptValue(field: PersonaField): string | null {
  if (field.value === null || field.value.trim().length === 0) return null
  return field.source === 'ai' ? `${field.value.trim()}${PERSONA_AI_MARK}` : field.value.trim()
}

/**
 * Render the packed persona prompt for one persona. Same content in, same
 * bytes out — the create face's style layer and the wizard's preview cannot
 * drift apart.
 * @param source - the persona's name, revision, fields, and style.
 * @returns the packed prompt text (`persona-prompt@1`).
 */
export function renderPersonaPrompt(source: PersonaPromptSource): string {
  const lines: string[] = [`【账号人设 · ${source.name.trim()}（v${source.revision}）】`]
  const valueOf = (key: PersonaFieldKey): string | null => promptValue(source.fields[key])
  const who = valueOf('whoAmI')
  if (who !== null) lines.push(`身份/背景：${who}`)
  const niche = valueOf('niche')
  if (niche !== null) lines.push(`赛道 / 行业：${niche}`)
  const audience = valueOf('audience')
  if (audience !== null) lines.push(`目标受众：${audience}`)
  const goal = valueOf('goal')
  const monetize = valueOf('monetize')
  if (goal !== null || monetize !== null) lines.push(`运营目标/变现：${[goal, monetize].filter(part => part !== null).join('；')}`)
  const contentValue = valueOf('contentValue')
  if (contentValue !== null) lines.push(`内容价值：${contentValue}`)
  const cadence = valueOf('cadence')
  if (cadence !== null) lines.push(`更新节奏：${cadence}`)
  const custom = source.style.customText?.trim() ?? ''
  const styleText = custom.length > 0
    ? custom
    : source.style.preset === null ? null : PERSONA_STYLE_PRESET_LABELS[source.style.preset]
  if (styleText !== null) {
    const strength = source.style.strength === 'strict' ? '严格遵循：硬约束，输出前逐条自检' : '轻度遵循：倾向参考，允许自然偏离'
    lines.push(`表达风格：${styleText}（遵循强度：${strength}）`)
  }
  const phrases = valueOf('phrases')
  if (phrases !== null) lines.push(`表达习惯/推荐句式：${phrases}`)
  if (source.style.bannedWords.length > 0) lines.push(`禁用词（硬约束，输出中不得出现）：${source.style.bannedWords.join('；')}`)
  if (source.style.redLines.length > 0) lines.push(`内容红线（触线即不合格）：${source.style.redLines.join('；')}`)
  return lines.join('\n')
}

/**
 * Render the packed prompt for a stored entry, pinned to that entry's saved
 * revision.
 * @param entry - the stored persona.
 * @returns the packed prompt text.
 */
export function renderEntryPrompt(entry: PersonaEntry): string {
  return renderPersonaPrompt({ name: entry.name, revision: entry.revision, fields: entry.fields, style: entry.style })
}
