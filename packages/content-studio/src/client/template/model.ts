/**
 * Pure template-library helpers: body segmentation (code regions are never
 * touched), placeholder scanning, variable reconciliation, rendering, and
 * import-pack validation. The body is the source of truth — the variables
 * metadata follows it, never the other way around. Rendering output is plain
 * text: views must render it through text nodes (React's own escaping), never
 * through `innerHTML`.
 */

import type { TemplateCategory, TemplatePack, TemplateVariable } from '@deepseek-ai/dsh-content-outputs/types'

/**
 * Every template category, mirrored client-side: the bundle purity gate
 * forbids cross-plugin value imports, so the wire type stays type-only and
 * this frozen list carries the runtime order for the pickers.
 */
export const TEMPLATE_CATEGORIES = [
  'topic', 'creation', 'publish', 'calendar', 'retro',
  'interaction', 'persona', 'benchmark', 'intel', 'dashboard',
] as const satisfies readonly TemplateCategory[]

/** Chinese label of one template category; shared by the library, the picker, and the generate box. */
export const TEMPLATE_CATEGORY_LABELS: Readonly<Record<TemplateCategory, string>> = {
  topic: '选题',
  creation: '创作',
  publish: '发布',
  calendar: '日历',
  retro: '复盘',
  interaction: '互动',
  persona: '画像',
  benchmark: '对标',
  intel: '信息',
  dashboard: '仪表盘',
}

/** Placeholder identifier shape inside a template body. */
export const TEMPLATE_VARIABLE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/

/** One placeholder occurrence the scanner found outside code regions. */
export interface PlaceholderMatch {
  readonly name: string
  /** Match start offset within the segment the match came from. */
  readonly escaped: boolean
}

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/gu

/** One body fragment: verbatim code (fenced block or inline span) or substitutable text. */
export interface TemplateSegment {
  readonly code: boolean
  readonly text: string
}

/**
 * Split one body into text and code segments. Fenced blocks (``` or ~~~)
 * toggle per line; inline backtick spans are code within a text line.
 * Unclosed fences run to the end of the body.
 * @param body - the template Markdown body.
 * @returns the ordered segments.
 */
export function segmentTemplateBody(body: string): readonly TemplateSegment[] {
  const segments: TemplateSegment[] = []
  let inFence = false
  let buffer: string[] = []
  let bufferCode = false
  const flush = (): void => {
    if (buffer.length > 0) {
      segments.push({ code: bufferCode, text: buffer.join('\n') })
      buffer = []
    }
  }
  for (const line of body.split('\n')) {
    if (/^\s{0,3}(?:```|~~~)/u.test(line)) {
      flush()
      segments.push({ code: true, text: line })
      inFence = !inFence
      continue
    }
    const code = inFence
    if (buffer.length > 0 && code !== bufferCode) flush()
    bufferCode = code
    buffer.push(line)
  }
  flush()
  return segments
}

/** Inline backtick span within one line. */
const INLINE_CODE_PATTERN = /`[^`\n]*`/gu

/** Split one text line into code spans and substitutable text parts. */
function splitInline(line: string): readonly { code: boolean; text: string }[] {
  const parts: { code: boolean; text: string }[] = []
  let last = 0
  line.replace(INLINE_CODE_PATTERN, (match, offset: number) => {
    if (offset > last) parts.push({ code: false, text: line.slice(last, offset) })
    parts.push({ code: true, text: match })
    last = offset + match.length
    return match
  })
  if (last < line.length) parts.push({ code: false, text: line.slice(last) })
  return parts
}

/**
 * Collect every placeholder occurrence in one substitutable text part.
 * A `{{` preceded by a backslash is the literal escape, not a variable.
 * @param text - the text part to scan.
 * @returns the occurrences in order.
 */
function scanText(text: string): readonly PlaceholderMatch[] {
  const matches: PlaceholderMatch[] = []
  text.replace(VARIABLE_PATTERN, (match: string, name: string, offset: number) => {
    matches.push({ name, escaped: offset > 0 && text[offset - 1] === '\\' })
    return match
  })
  return matches
}

/**
 * Scan one body for the variable names its placeholders introduce, in
 * first-occurrence order, deduplicated. Code regions never contribute.
 * @param body - the template Markdown body.
 * @returns the active variable names.
 */
export function scanTemplateVariables(body: string): readonly string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const segment of segmentTemplateBody(body)) {
    if (segment.code) continue
    for (const part of splitInline(segment.text)) {
      if (part.code) continue
      for (const match of scanText(part.text)) {
        if (match.escaped || seen.has(match.name)) continue
        seen.add(match.name)
        names.push(match.name)
      }
    }
  }
  return names
}

/** Variable metadata synthesized for a placeholder the user has not described yet. */
function freshVariable(name: string): TemplateVariable {
  return { name, label: name, description: '', defaultValue: '', required: false }
}

/** Result of aligning stored variable metadata with the body's placeholders. */
export interface ReconciledVariables {
  /** Metadata for every active placeholder, in body order. */
  readonly active: readonly TemplateVariable[]
  /** Metadata whose placeholder no longer appears in the body; kept, never auto-deleted. */
  readonly unused: readonly TemplateVariable[]
}

/**
 * Align variable metadata with the body's active placeholders: known names
 * keep their metadata, unknown names get fresh entries, and metadata whose
 * placeholder disappeared moves to `unused` (the editor shows it without
 * silently deleting it).
 * @param body - the template Markdown body.
 * @param existing - the stored variable metadata.
 * @returns the aligned metadata.
 */
export function reconcileVariables(body: string, existing: readonly TemplateVariable[]): ReconciledVariables {
  const names = scanTemplateVariables(body)
  const byName = new Map(existing.map(variable => [variable.name, variable]))
  const consumed = new Set<string>()
  const active = names.map((name) => {
    consumed.add(name)
    return byName.get(name) ?? freshVariable(name)
  })
  const unused = existing.filter(variable => !consumed.has(variable.name))
  return { active, unused }
}

/** Result of rendering one body: the output plus placeholders left visible. */
export interface TemplateRenderResult {
  /** The rendered plain text. */
  readonly output: string
  /** Names left as visible placeholders: filled empty with no default, or unknown. */
  readonly unresolved: readonly string[]
}

/**
 * Render one body: substitutes placeholders outside code regions, falls back
 * to each variable's default value, and keeps an unfilled optional without a
 * default (or a placeholder with no metadata at all) visible — reporting it
 * in `unresolved`. `\{{name}}` renders as the literal `{{name}}`.
 * @param body - the template Markdown body.
 * @param values - the filled values keyed by variable name.
 * @param variables - the stored metadata supplying default values.
 * @returns the output and the unresolved names.
 */
export function renderTemplate(
  body: string, values: Readonly<Record<string, string>>, variables: readonly TemplateVariable[],
): TemplateRenderResult {
  const defaults = new Map(variables.map(variable => [variable.name, variable.defaultValue]))
  const unresolved: string[] = []
  const seen = new Set<string>()
  const substitute = (text: string): string => {
    let out = ''
    let last = 0
    text.replace(VARIABLE_PATTERN, (match: string, name: string, offset: number) => {
      if (offset > 0 && text[offset - 1] === '\\') {
        out += `${text.slice(last, offset - 1)}${match}`
        last = offset + match.length
        return match
      }
      const filled = values[name]?.trim() ?? ''
      const fallback = defaults.get(name)?.trim() ?? ''
      const replacement = filled.length > 0 ? values[name] ?? '' : fallback
      if (replacement.length > 0) {
        out += `${text.slice(last, offset)}${replacement}`
      } else {
        out += `${text.slice(last, offset)}${match}`
        if (!seen.has(name)) {
          seen.add(name)
          unresolved.push(name)
        }
      }
      last = offset + match.length
      return match
    })
    out += text.slice(last)
    return out
  }
  const parts = segmentTemplateBody(body).map(segment =>
    segment.code ? segment.text : splitInline(segment.text).map(part => part.code ? part.text : substitute(part.text)).join(''))
  return { output: parts.join('\n'), unresolved }
}

/**
 * Names of body-active required variables without a filled value; the picker
 * disables its confirm button while any are missing. Only placeholders the
 * body actually uses count — a required declaration whose placeholder was
 * removed never blocks a pick.
 * @param body - the template Markdown body.
 * @param variables - the template's variable metadata.
 * @param values - the filled values keyed by variable name.
 * @returns the missing required names.
 */
export function missingRequired(
  body: string, variables: readonly TemplateVariable[], values: Readonly<Record<string, string>>,
): readonly string[] {
  const active = new Set(scanTemplateVariables(body))
  return variables
    .filter(variable => variable.required && active.has(variable.name) && (values[variable.name]?.trim().length ?? 0) === 0)
    .map(variable => variable.name)
}

/** Client-side pack validation result; the gateway re-validates every entry. */
export type TemplatePackParse =
  | { readonly kind: 'ok'; readonly pack: TemplatePack }
  | { readonly kind: 'invalid'; readonly problem: string }

/**
 * Parse one import-file body into a pack: the envelope must identify itself
 * and both lists must be arrays. Entries are not deeply validated here — the
 * import face rejects each bad entry by name.
 * @param raw - exact file contents.
 * @returns the parsed pack or the reason it is not one.
 */
export function parseTemplatePack(raw: string): TemplatePackParse {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { kind: 'invalid', problem: 'not valid JSON' }
  }
  if (typeof parsed !== 'object' || parsed === null) return { kind: 'invalid', problem: 'not a JSON object' }
  const record = parsed as Record<string, unknown>
  if (record.format !== 'dsh-template-pack') return { kind: 'invalid', problem: 'not a dsh-template-pack file' }
  if (record.formatVersion !== 1) return { kind: 'invalid', problem: `unsupported pack formatVersion ${String(record.formatVersion)}` }
  if (!Array.isArray(record.templates) || !Array.isArray(record.tags)) return { kind: 'invalid', problem: 'pack lists are missing' }
  return {
    kind: 'ok',
    pack: {
      format: 'dsh-template-pack',
      formatVersion: 1,
      exportedAt: typeof record.exportedAt === 'string' ? record.exportedAt : '',
      templates: record.templates as TemplatePack['templates'],
      tags: record.tags as TemplatePack['tags'],
    },
  }
}
