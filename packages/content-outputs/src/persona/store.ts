/**
 * Persona file store: reads and writes the account-persona manifest
 * directly on every call. The file lives at the library root under
 * `_personas.json` — the `_` prefix keeps the outputs scanner treating it as
 * a system entry, and one library directory stays the whole content-creation
 * surface on disk. Entry text is embedded; a persona never references a
 * file, so the manifest alone is a complete backup and nothing can dangle.
 *
 * Validation follows the same rule as the outputs scanner: one malformed
 * record never hides the rest — it is named in `problems` and skipped. Every
 * write, though, refuses to touch a file whose current state dropped
 * entries: a save must never be the step that silently deletes user
 * personas.
 */

import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import type {
  PersonaAccountStage, PersonaEntry, PersonaField, PersonaFieldKey, PersonaId, PersonaInput,
  PersonaLink, PersonaPlatform, PersonaReport, PersonaStyle, PersonasManifest, PersonasSnapshot,
  PersonaStylePreset, PersonaStyleStrength, PersonaFieldSource,
} from './types.ts'
import {
  PERSONA_FIELD_KEYS, PERSONA_PLATFORMS, PERSONA_STYLE_PRESETS, PERSONA_STYLE_PRESET_LABELS,
} from './types.ts'

/** System file name of the persona manifest at the library root. */
export const PERSONAS_FILENAME = '_personas.json'

/** Stored-shape caps enforced at the wire boundary; generous, never a product decision. */
export const PERSONA_MAX_NAME = 100
/** Character cap of one persona field's value. */
export const PERSONA_MAX_FIELD_VALUE = 5_000
/** Character cap of the free-text fields (custom style text, resume text, red lines). */
export const PERSONA_MAX_TEXT = 100_000
/** Cap on how many links one persona entry carries. */
export const PERSONA_MAX_LINKS = 10
/** Character cap of one link's URL. */
export const PERSONA_MAX_URL = 2_000
/** Character cap of one link's display text. */
export const PERSONA_MAX_LINK_TEXT = 5_000
/** Cap on how many entries a banned-words or style word list carries. */
export const PERSONA_MAX_WORD_ITEMS = 50
/** Character cap of one word inside a word list. */
export const PERSONA_MAX_WORD = 100
/** Character cap of the stored AI report digest. */
export const PERSONA_MAX_DIGEST = 200
/** Character cap of persona and related record ids. */
export const PERSONA_MAX_ID = 64
/** Character cap of the stored prompt-version string. */
export const PERSONA_MAX_PROMPT_VERSION = 100
/** Character cap of stored ISO-8601 timestamp strings. */
export const PERSONA_MAX_TIMESTAMP = 40

/** The fields every persona entry carries; wire records must be complete. */
const FIELD_KEYS: readonly PersonaFieldKey[] = PERSONA_FIELD_KEYS
const PLATFORMS: readonly PersonaPlatform[] = PERSONA_PLATFORMS
const PRESETS: readonly PersonaStylePreset[] = PERSONA_STYLE_PRESETS
const SOURCES: readonly PersonaFieldSource[] = ['user', 'ai', 'template']
const STRENGTHS: readonly PersonaStyleStrength[] = ['light', 'strict']
const STAGES: readonly PersonaAccountStage[] = ['fresh', 'existing']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNullableText(value: unknown, max: number): value is string | null {
  return value === null || (typeof value === 'string' && value.length <= max)
}

function isTextField(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

function isField(value: unknown): value is PersonaField {
  if (!isRecord(value)) return false
  if (!SOURCES.includes(value.source as PersonaFieldSource)) return false
  if (!isNullableText(value.value, PERSONA_MAX_FIELD_VALUE)) return false
  if (value.source !== 'ai') return value.aiMeta === null
  if (!isRecord(value.aiMeta)) return false
  return isTextField(value.aiMeta.promptVersion, PERSONA_MAX_PROMPT_VERSION)
    && isTextField(value.aiMeta.at, PERSONA_MAX_TIMESTAMP)
}

function isFields(value: unknown): value is PersonaEntry['fields'] {
  if (!isRecord(value)) return false
  return FIELD_KEYS.every(key => isField(value[key]))
}

function isLink(value: unknown): value is PersonaLink {
  if (!isRecord(value)) return false
  return PLATFORMS.includes(value.platform as PersonaPlatform)
    && isTextField(value.url, PERSONA_MAX_URL)
    && isNullableText(value.bio, PERSONA_MAX_LINK_TEXT)
    && isNullableText(value.sampleText, PERSONA_MAX_LINK_TEXT)
}

function isWordList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length <= PERSONA_MAX_WORD_ITEMS
    && value.every(word => isTextField(word, PERSONA_MAX_WORD))
}

function isStyle(value: unknown): value is PersonaStyle {
  if (!isRecord(value)) return false
  return (value.preset === null || PRESETS.includes(value.preset as PersonaStylePreset))
    && isNullableText(value.customText, PERSONA_MAX_FIELD_VALUE)
    && STRENGTHS.includes(value.strength as PersonaStyleStrength)
    && isWordList(value.bannedWords)
    && isWordList(value.redLines)
}

function isReport(value: unknown): value is PersonaReport {
  if (!isRecord(value)) return false
  return isTextField(value.markdown, PERSONA_MAX_TEXT)
    && typeof value.sourceRevision === 'number'
    && Number.isInteger(value.sourceRevision) && value.sourceRevision >= 1
    && typeof value.editedByUser === 'boolean'
    && isTextField(value.generatedAt, PERSONA_MAX_TIMESTAMP)
    && isTextField(value.promptVersion, PERSONA_MAX_PROMPT_VERSION)
}

function isEntry(value: unknown): value is PersonaEntry {
  if (!isRecord(value)) return false
  return isTextField(value.id, PERSONA_MAX_ID)
    && isTextField(value.name, PERSONA_MAX_NAME)
    && Array.isArray(value.platforms) && value.platforms.length <= PLATFORMS.length
    && value.platforms.every(platform => PLATFORMS.includes(platform as PersonaPlatform))
    && STAGES.includes(value.accountStage as PersonaAccountStage)
    && typeof value.revision === 'number'
    && Number.isInteger(value.revision) && value.revision >= 1
    && isTextField(value.digest, PERSONA_MAX_DIGEST)
    && isFields(value.fields)
    && Array.isArray(value.links) && value.links.length <= PERSONA_MAX_LINKS
    && value.links.every(link => isLink(link))
    && isRecord(value.site)
    && isNullableText(value.site.url, PERSONA_MAX_URL)
    && isNullableText(value.site.pastedText, PERSONA_MAX_TEXT)
    && isStyle(value.style)
    && isRecord(value.assets)
    && isNullableText(value.assets.resumeText, PERSONA_MAX_TEXT)
    && isNullableText(value.assets.resumeName, PERSONA_MAX_URL)
    && (value.report === null || isReport(value.report))
    && (value.clonedFrom === null || isTextField(value.clonedFrom, PERSONA_MAX_ID))
    && isTextField(value.createdAt, PERSONA_MAX_TIMESTAMP)
    && isTextField(value.updatedAt, PERSONA_MAX_TIMESTAMP)
}

/** Newest save first; the id breaks ties so the order is total and stable. */
function compareEntries(a: PersonaEntry, b: PersonaEntry): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? -1 : 1
  return a.id < b.id ? -1 : 1
}

/** One stored manifest parse: `empty` (no file yet), `invalid` (refuse-write state), or `ok`. */
export type PersonasParse =
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid'; readonly problem: string }
  | { readonly kind: 'ok'; readonly manifest: PersonasManifest; readonly problems: readonly string[] }

/**
 * Parse one stored manifest body. Future on-disk formats never load as
 * current records: the version gate mirrors the outputs metadata contract
 * (one backend, one format), and invalid JSON is its own refuse-write state.
 * @param raw - exact file contents; empty string means the file does not exist yet.
 * @returns the parse outcome with every dropped entry named.
 */
export function parsePersonasManifest(raw: string): PersonasParse {
  if (raw.length === 0) return { kind: 'empty' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { kind: 'invalid', problem: 'personas file is not valid JSON' }
  }
  const root = parsed as Record<string, unknown>
  if (root.formatVersion !== 0) return { kind: 'invalid', problem: `unsupported personas formatVersion ${String(root.formatVersion)}` }
  if (!Array.isArray(root.personas)) return { kind: 'invalid', problem: 'personas file has no personas array' }
  const personas: PersonaEntry[] = []
  const problems: string[] = []
  for (const entry of root.personas) {
    if (isEntry(entry)) personas.push(entry)
    else problems.push(`dropped one invalid persona record: ${JSON.stringify(entry).slice(0, 120)}`)
  }
  personas.sort(compareEntries)
  return { kind: 'ok', manifest: { formatVersion: 0, personas }, problems }
}

/**
 * Read the manifest for the list projection.
 * @param file - absolute `_personas.json` path; a missing file is empty.
 * @returns the snapshot with entries newest-first and every bad record named.
 */
export async function readPersonasFile(file: string): Promise<PersonasSnapshot> {
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch {
    return { personas: [], problems: [] }
  }
  const parsed = parsePersonasManifest(raw)
  if (parsed.kind === 'empty') return { personas: [], problems: [] }
  if (parsed.kind === 'invalid') return { personas: [], problems: [parsed.problem] }
  return { personas: parsed.manifest.personas, problems: parsed.problems }
}

/**
 * The deterministic ≤200-character style summary stored as `digest`: the
 * identity, style, and intent fields joined in a fixed order, the banned
 * words and red lines never included, truncated, and suffixed with the
 * revision the summary was computed from. Same content in, same bytes out.
 * @param entry - the entry's name, fields, style, and revision.
 * @returns the digest text, at most {@link PERSONA_MAX_DIGEST} characters.
 */
export function personaDigest(
  entry: Pick<PersonaEntry, 'name' | 'fields' | 'style'> & { readonly revision: number },
): string {
  const custom = entry.style.customText?.trim() ?? ''
  const styleText = custom.length > 0
    ? custom
    : entry.style.preset === null ? '' : PERSONA_STYLE_PRESET_LABELS[entry.style.preset]
  const strengthSuffix = entry.style.strength === 'strict' ? '（严格遵循）' : ''
  const parts = [
    entry.fields.whoAmI.value,
    styleText.length > 0 ? `${styleText}${strengthSuffix}` : '',
    entry.fields.niche.value,
    entry.fields.audience.value,
    entry.fields.goal.value,
    entry.fields.monetize.value,
    entry.fields.oneLiner.value,
  ].map(part => part?.trim() ?? '').filter(part => part.length > 0)
  const body = (parts.length > 0 ? parts : [entry.name.trim()]).join('；')
  const suffix = `（v${entry.revision}）`
  const budget = PERSONA_MAX_DIGEST - suffix.length
  const capped = body.length > budget ? body.slice(0, budget) : body
  return `${capped}${suffix}`
}

function normalizeField(value: unknown): { field?: PersonaField; detail?: string } {
  if (!isRecord(value)) return { detail: 'field must be an object' }
  if (!SOURCES.includes(value.source as PersonaFieldSource)) return { detail: 'unknown field source' }
  const raw = value.value
  if (raw !== null && typeof raw !== 'string') return { detail: 'field value must be a string or null' }
  if (typeof raw === 'string' && raw.length > PERSONA_MAX_FIELD_VALUE) return { detail: 'field value exceeds the length cap' }
  const text = raw === null || raw.trim().length === 0 ? null : raw.trim()
  if (value.source !== 'ai') return { field: { value: text, source: value.source as PersonaFieldSource, aiMeta: null } }
  const meta = value.aiMeta
  if (!isRecord(meta) || !isTextField(meta.promptVersion, PERSONA_MAX_PROMPT_VERSION) || !isTextField(meta.at, PERSONA_MAX_TIMESTAMP)) {
    return { detail: 'an ai-sourced field requires its promptVersion and time' }
  }
  return { field: { value: text, source: 'ai', aiMeta: { promptVersion: meta.promptVersion, at: meta.at } } }
}

function normalizeFields(value: unknown): { fields?: PersonaEntry['fields']; detail?: string } {
  if (!isRecord(value)) return { detail: 'fields must be an object' }
  const fields = {} as Record<PersonaFieldKey, PersonaField>
  for (const key of FIELD_KEYS) {
    const normalized = normalizeField(value[key])
    if (normalized.field === undefined) return { detail: `${key}: ${normalized.detail}` }
    fields[key] = normalized.field
  }
  return { fields }
}

function normalizeOptionalText(value: unknown, max: number): { text?: string | null; detail?: string } {
  if (value === undefined || value === null) return { text: null }
  if (typeof value !== 'string') return { detail: 'text must be a string or null' }
  if (value.length > max) return { detail: `text exceeds the ${String(max)}-character cap` }
  return { text: value }
}

function normalizeLinks(value: unknown): { links?: PersonaLink[]; detail?: string } {
  if (!Array.isArray(value)) return { detail: 'links must be an array' }
  if (value.length > PERSONA_MAX_LINKS) return { detail: `links exceed ${String(PERSONA_MAX_LINKS)}` }
  const links: PersonaLink[] = []
  for (const link of value) {
    if (!isRecord(link) || !PLATFORMS.includes(link.platform as PersonaPlatform)) return { detail: 'link platform is unknown' }
    if (!isTextField(link.url, PERSONA_MAX_URL)) return { detail: 'link url must be a non-empty string within the cap' }
    const bio = normalizeOptionalText(link.bio, PERSONA_MAX_LINK_TEXT)
    if (bio.text === undefined) return { detail: `link bio: ${bio.detail}` }
    const sample = normalizeOptionalText(link.sampleText, PERSONA_MAX_LINK_TEXT)
    if (sample.text === undefined) return { detail: `link sampleText: ${sample.detail}` }
    links.push({
      platform: link.platform as PersonaPlatform,
      url: link.url.trim(),
      bio: bio.text,
      sampleText: sample.text,
    })
  }
  return { links }
}

function normalizeWords(value: unknown): { words?: string[]; detail?: string } {
  if (!Array.isArray(value)) return { detail: 'word list must be an array' }
  if (value.length > PERSONA_MAX_WORD_ITEMS) return { detail: `word list exceeds ${String(PERSONA_MAX_WORD_ITEMS)}` }
  const words: string[] = []
  for (const word of value) {
    if (typeof word !== 'string' || word.trim().length === 0) return { detail: 'word list entries must be non-empty strings' }
    if (word.length > PERSONA_MAX_WORD) return { detail: 'word list entry exceeds the length cap' }
    words.push(word.trim())
  }
  return { words }
}

function normalizeStyle(value: unknown): { style?: PersonaStyle; detail?: string } {
  if (!isRecord(value)) return { detail: 'style must be an object' }
  if (value.preset !== null && value.preset !== undefined && !PRESETS.includes(value.preset as PersonaStylePreset)) return { detail: 'unknown style preset' }
  if (!STRENGTHS.includes(value.strength as PersonaStyleStrength)) return { detail: 'unknown style strength' }
  const custom = normalizeOptionalText(value.customText, PERSONA_MAX_FIELD_VALUE)
  if (custom.text === undefined) return { detail: `style customText: ${custom.detail}` }
  const banned = normalizeWords(value.bannedWords)
  if (banned.words === undefined) return { detail: `style bannedWords: ${banned.detail}` }
  const red = normalizeWords(value.redLines)
  if (red.words === undefined) return { detail: `style redLines: ${red.detail}` }
  return {
    style: {
      preset: (value.preset as PersonaStylePreset | null) ?? null,
      customText: custom.text,
      strength: value.strength as PersonaStyleStrength,
      bannedWords: banned.words,
      redLines: red.words,
    },
  }
}

function normalizeReport(value: unknown): { report?: PersonaReport | null; detail?: string } {
  if (value === undefined || value === null) return { report: null }
  if (!isRecord(value)) return { detail: 'report must be an object or null' }
  if (!isTextField(value.markdown, PERSONA_MAX_TEXT)) return { detail: 'report markdown must be non-empty within the cap' }
  if (typeof value.sourceRevision !== 'number' || !Number.isInteger(value.sourceRevision) || value.sourceRevision < 1) {
    return { detail: 'report sourceRevision must be a positive integer' }
  }
  if (typeof value.editedByUser !== 'boolean') return { detail: 'report editedByUser must be a boolean' }
  if (!isTextField(value.generatedAt, PERSONA_MAX_TIMESTAMP)) return { detail: 'report generatedAt is missing' }
  if (!isTextField(value.promptVersion, PERSONA_MAX_PROMPT_VERSION)) return { detail: 'report promptVersion is missing' }
  return {
    report: {
      markdown: value.markdown,
      sourceRevision: value.sourceRevision,
      editedByUser: value.editedByUser,
      generatedAt: value.generatedAt,
      promptVersion: value.promptVersion,
    },
  }
}

/**
 * Validate one upsert input into its stored shape; the revision increments
 * from the stored entry, the digest derives from the stored content, and a
 * clone (`clonedFrom` on a fresh entry) carries a fresh id and revision 1.
 * @param input - the upsert payload from the browser.
 * @param existing - the stored entry when `input.id` addresses one.
 * @param now - the save instant (ISO 8601).
 * @returns the stored entry, or the reason the input is invalid.
 */
export function normalizePersonaInput(
  input: PersonaInput,
  existing: PersonaEntry | undefined,
  now: string,
): { entry?: PersonaEntry; detail?: string } {
  if (existing === undefined && input.id !== undefined && !isTextField(input.id, PERSONA_MAX_ID)) return { detail: 'id must be a non-empty string within the cap' }
  if (typeof input.name !== 'string' || input.name.trim().length === 0) return { detail: 'name must be a non-empty string' }
  if (input.name.length > PERSONA_MAX_NAME) return { detail: 'name exceeds the length cap' }
  if (!Array.isArray(input.platforms)) return { detail: 'platforms must be an array' }
  const platforms = input.platforms as readonly PersonaPlatform[]
  if (platforms.length > PLATFORMS.length) return { detail: 'platforms exceed the word list size' }
  if (!platforms.every(platform => PLATFORMS.includes(platform))) return { detail: 'unknown platform' }
  if (new Set(platforms).size !== platforms.length) return { detail: 'platforms must not repeat' }
  if (!STAGES.includes(input.accountStage)) return { detail: 'unknown account stage' }
  const fields = normalizeFields(input.fields)
  if (fields.fields === undefined) return { detail: `fields: ${fields.detail}` }
  const links = normalizeLinks(input.links)
  if (links.links === undefined) return { detail: `links: ${links.detail}` }
  const siteUrl = normalizeOptionalText(input.site.url, PERSONA_MAX_URL)
  if (siteUrl.text === undefined) return { detail: `site url: ${siteUrl.detail}` }
  const siteText = normalizeOptionalText(input.site.pastedText, PERSONA_MAX_TEXT)
  if (siteText.text === undefined) return { detail: `site pastedText: ${siteText.detail}` }
  const style = normalizeStyle(input.style)
  if (style.style === undefined) return { detail: `style: ${style.detail}` }
  const resumeText = normalizeOptionalText(input.assets.resumeText, PERSONA_MAX_TEXT)
  if (resumeText.text === undefined) return { detail: `assets resumeText: ${resumeText.detail}` }
  const resumeName = normalizeOptionalText(input.assets.resumeName, PERSONA_MAX_URL)
  if (resumeName.text === undefined) return { detail: `assets resumeName: ${resumeName.detail}` }
  const report = normalizeReport(input.report)
  if (report.report === undefined) return { detail: `report: ${report.detail}` }
  const clonedFrom = normalizeOptionalText(existing === undefined ? input.clonedFrom : existing.clonedFrom, PERSONA_MAX_ID)
  if (clonedFrom.text === undefined) return { detail: `clonedFrom: ${clonedFrom.detail}` }

  const id = existing === undefined ? (input.id ?? (randomUUID() as PersonaId)) : existing.id
  const revision = existing === undefined ? 1 : existing.revision + 1
  const entry: PersonaEntry = {
    id,
    name: input.name.trim(),
    platforms: [...platforms],
    accountStage: input.accountStage,
    revision,
    digest: '',
    fields: fields.fields,
    links: links.links,
    site: { url: siteUrl.text, pastedText: siteText.text },
    style: style.style,
    assets: { resumeText: resumeText.text, resumeName: resumeName.text },
    report: report.report,
    clonedFrom: clonedFrom.text as PersonaId | null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  return { entry: { ...entry, digest: personaDigest(entry) } }
}

/**
 * Read the manifest inside a lock and refuse every state that a write would
 * corrupt: invalid JSON, a future format version, or entries a parse had to
 * drop. A save must never be the step that silently deletes user personas.
 * @param file - absolute `_personas.json` path; parent directories are
 *   created when missing.
 * @returns the valid stored entries.
 */
async function readForWrite(file: string): Promise<PersonaEntry[]> {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  let raw = ''
  try {
    raw = await readFile(file, 'utf8')
  } catch {
    // Missing file: an empty manifest is the legitimate first-write state.
  }
  const parsed = parsePersonasManifest(raw)
  if (parsed.kind === 'empty') return []
  if (parsed.kind === 'invalid') throw new Error(`refusing to write ${PERSONAS_FILENAME}: ${parsed.problem}`)
  if (parsed.problems.length > 0) throw new Error(`refusing to write ${PERSONAS_FILENAME}: resolve the stored invalid entries first (${String(parsed.problems.length)} dropped)`)
  return [...parsed.manifest.personas]
}

async function writePersonas(file: string, personas: readonly PersonaEntry[]): Promise<void> {
  const body = `${JSON.stringify({ formatVersion: 0, personas }, null, 2)}\n`
  await writeFileAtomic(file, body, { mode: 0o600, dirMode: 0o700 })
}

/**
 * Upsert one persona under a file lock, atomically: the revision increments,
 * the digest recomputes, and the timestamps are gateway-owned. Creating with
 * an id that is absent from the manifest rejects — a stale client must
 * reload, not resurrect a deleted persona.
 * @param file - absolute `_personas.json` path.
 * @param input - the upsert payload from the browser.
 * @param now - the save instant (ISO 8601); defaults to the current time.
 * @returns the stored entry.
 */
export async function putPersonaFile(file: string, input: PersonaInput, now: string = new Date().toISOString()): Promise<PersonaEntry> {
  return withFileLock(file, async () => {
    const stored = await readForWrite(file)
    const existing = input.id === undefined ? undefined : stored.find(entry => entry.id === input.id)
    if (input.id !== undefined && existing === undefined) throw new Error(`unknown persona: ${input.id}`)
    const normalized = normalizePersonaInput(input, existing, now)
    if (normalized.entry === undefined) throw new Error(`invalid persona input: ${normalized.detail}`)
    const entry = normalized.entry
    await writePersonas(file, [entry, ...stored.filter(candidate => candidate.id !== entry.id)].sort(compareEntries))
    return entry
  })
}

/**
 * Replace one persona's report without touching its form state: the
 * revision and digest stay, `updatedAt` moves. Report edits are a separate
 * save path from form saves exactly so the staleness banner (`revision >
 * sourceRevision`) tracks form changes only.
 * @param file - absolute `_personas.json` path.
 * @param id - the persona to update; unknown ids reject.
 * @param report - the complete next report.
 * @param now - the save instant (ISO 8601); defaults to the current time.
 * @returns the stored entry.
 */
export async function putPersonaReportFile(
  file: string, id: string, report: PersonaReport, now: string = new Date().toISOString(),
): Promise<PersonaEntry> {
  return withFileLock(file, async () => {
    const stored = await readForWrite(file)
    const existing = stored.find(entry => entry.id === id)
    if (existing === undefined) throw new Error(`unknown persona: ${id}`)
    const normalized = normalizeReport(report)
    if (normalized.report === undefined) throw new Error(`invalid persona report: ${normalized.detail}`)
    const entry: PersonaEntry = { ...existing, report: normalized.report, updatedAt: now }
    await writePersonas(file, [entry, ...stored.filter(candidate => candidate.id !== id)].sort(compareEntries))
    return entry
  })
}

/**
 * Remove one persona under a file lock; the embedded report goes with it,
 * and there is no file left to dangle. Removing an unknown id is a no-op.
 * @param file - absolute `_personas.json` path.
 * @param id - the persona to remove.
 */
export async function deletePersonaFile(file: string, id: string): Promise<void> {
  await withFileLock(file, async () => {
    const stored = await readForWrite(file)
    const next = stored.filter(entry => entry.id !== id)
    if (next.length === stored.length) return
    await writePersonas(file, next)
  })
}
