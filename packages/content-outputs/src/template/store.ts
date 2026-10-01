/**
 * Template library file store: reads and writes the global template assets
 * under `<templatesRoot>` — `templates.json` for the records, `taxonomy.json`
 * for the shared tag list, and one full-record snapshot per manual save under
 * `history/<template-id>/<version>.json`. The library sits outside the
 * outputs library on purpose: templates are global skeleton assets, never
 * theme business data, so no outputs scan can mistake them for a project and
 * no theme teardown can sweep them away.
 *
 * Validation follows the persona store's rules: one malformed record never
 * hides the rest on read — it is named in `problems` and skipped — while
 * every write refuses to touch a file whose current state dropped entries,
 * so a save can never be the step that silently deletes user templates.
 */

import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import type {
  TemplateCategory, TemplateHistoryEntry, TemplateId, TemplateImportStrategy,
  TemplateImportSummary, TemplateInput, TemplatePack, TemplateRecord, TemplateStatus,
  TemplateTag, TemplateTagId, TemplateTaxonomy, TemplateVariable, TemplatesManifest,
  TemplatesSnapshot,
} from './types.ts'
import { TEMPLATE_CATEGORIES } from './types.ts'

/** Library file names under `<templatesRoot>`. */
export const TEMPLATES_FILENAME = 'templates.json'
export const TAXONOMY_FILENAME = 'taxonomy.json'
export const HISTORY_DIRNAME = 'history'

/** Stored-shape caps enforced at the wire boundary; generous, never a product decision. */
export const TEMPLATE_MAX_NAME = 100
export const TEMPLATE_MAX_DESCRIPTION = 500
export const TEMPLATE_MAX_BODY = 100_000
export const TEMPLATE_MAX_VARIABLES = 50
export const TEMPLATE_MAX_VARIABLE_NAME = 64
export const TEMPLATE_MAX_VARIABLE_TEXT = 200
export const TEMPLATE_MAX_VARIABLE_DESCRIPTION = 500
export const TEMPLATE_MAX_VARIABLE_DEFAULT = 2_000
export const TEMPLATE_MAX_TAGS = 50
export const TEMPLATE_MAX_TAG_NAME = 50
export const TEMPLATE_MAX_CHANGE_NOTE = 200
export const TEMPLATE_HISTORY_LIMIT = 20
export const TEMPLATE_MAX_ID = 64
export const TEMPLATE_MAX_TIMESTAMP = 40

/** Placeholder identifier shape inside a template body. */
export const TEMPLATE_VARIABLE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/

const CATEGORIES: readonly TemplateCategory[] = TEMPLATE_CATEGORIES
const STATUSES: readonly TemplateStatus[] = ['active', 'archived']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTextField(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

function isText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max
}

function isTimestamp(value: unknown): value is string {
  return isTextField(value, TEMPLATE_MAX_TIMESTAMP)
}

function isVariable(value: unknown): value is TemplateVariable {
  if (!isRecord(value)) return false
  return typeof value.name === 'string' && value.name.length <= TEMPLATE_MAX_VARIABLE_NAME
    && TEMPLATE_VARIABLE_NAME_PATTERN.test(value.name)
    && isText(value.label, TEMPLATE_MAX_VARIABLE_TEXT)
    && isText(value.description, TEMPLATE_MAX_VARIABLE_DESCRIPTION)
    && isText(value.defaultValue, TEMPLATE_MAX_VARIABLE_DEFAULT)
    && typeof value.required === 'boolean'
}

function isVariables(value: unknown): value is readonly TemplateVariable[] {
  return Array.isArray(value) && value.length <= TEMPLATE_MAX_VARIABLES
    && value.every(variable => isVariable(variable))
    && value.every((variable, index) => value.findIndex(candidate => candidate.name === variable.name) === index)
}

function isTagId(value: unknown): value is TemplateTagId {
  return typeof value === 'string' && value.length > 0 && value.length <= TEMPLATE_MAX_ID
}

function isTemplateRecord(value: unknown): value is TemplateRecord {
  if (!isRecord(value)) return false
  return isTextField(value.id, TEMPLATE_MAX_ID)
    && isTextField(value.name, TEMPLATE_MAX_NAME)
    && CATEGORIES.includes(value.category as TemplateCategory)
    && isText(value.description, TEMPLATE_MAX_DESCRIPTION)
    && Array.isArray(value.tagIds) && value.tagIds.length <= TEMPLATE_MAX_TAGS
    && value.tagIds.every(tagId => isTagId(tagId))
    && isTextField(value.body, TEMPLATE_MAX_BODY)
    && isVariables(value.variables)
    && STATUSES.includes(value.status as TemplateStatus)
    && typeof value.version === 'number'
    && Number.isInteger(value.version) && value.version >= 1
    && isTimestamp(value.createdAt)
    && isTimestamp(value.updatedAt)
}

function isTag(value: unknown): value is TemplateTag {
  return isRecord(value) && isTagId(value.id) && isTextField(value.name, TEMPLATE_MAX_TAG_NAME)
}

/** One stored manifest parse: `empty` (no file yet), `invalid` (refuse-write state), or `ok`. */
export type TemplatesParse =
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid'; readonly problem: string }
  | { readonly kind: 'ok'; readonly manifest: TemplatesManifest; readonly problems: readonly string[] }

/** One stored taxonomy parse; same three states as the manifest parse. */
export type TaxonomyParse =
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid'; readonly problem: string }
  | { readonly kind: 'ok'; readonly taxonomy: TemplateTaxonomy; readonly problems: readonly string[] }

/**
 * Parse one stored templates manifest body. The version gate mirrors every
 * other store: future on-disk formats never load as current records.
 * @param raw - exact file contents; empty string means the file does not exist yet.
 * @returns the parse outcome with every dropped record named.
 */
export function parseTemplatesManifest(raw: string): TemplatesParse {
  if (raw.length === 0) return { kind: 'empty' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { kind: 'invalid', problem: 'templates file is not valid JSON' }
  }
  const root = parsed as Record<string, unknown>
  if (root.formatVersion !== 0) return { kind: 'invalid', problem: `unsupported templates formatVersion ${String(root.formatVersion)}` }
  if (!Array.isArray(root.templates)) return { kind: 'invalid', problem: 'templates file has no templates array' }
  const templates: TemplateRecord[] = []
  const problems: string[] = []
  for (const entry of root.templates) {
    if (isTemplateRecord(entry)) templates.push(entry)
    else problems.push(`dropped one invalid template record: ${JSON.stringify(entry).slice(0, 120)}`)
  }
  templates.sort(compareRecords)
  return { kind: 'ok', manifest: { formatVersion: 0, templates }, problems }
}

/**
 * Parse one stored taxonomy body, same rules as the manifest parse.
 * @param raw - exact file contents; empty string means the file does not exist yet.
 * @returns the parse outcome with every dropped tag named.
 */
export function parseTemplateTaxonomy(raw: string): TaxonomyParse {
  if (raw.length === 0) return { kind: 'empty' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { kind: 'invalid', problem: 'taxonomy file is not valid JSON' }
  }
  const root = parsed as Record<string, unknown>
  if (root.formatVersion !== 0) return { kind: 'invalid', problem: `unsupported taxonomy formatVersion ${String(root.formatVersion)}` }
  if (!Array.isArray(root.tags)) return { kind: 'invalid', problem: 'taxonomy file has no tags array' }
  const tags: TemplateTag[] = []
  const problems: string[] = []
  for (const tag of root.tags) {
    if (isTag(tag)) tags.push(tag)
    else problems.push(`dropped one invalid tag record: ${JSON.stringify(tag).slice(0, 120)}`)
  }
  return { kind: 'ok', taxonomy: { formatVersion: 0, tags }, problems }
}

/** Newest save first; the id breaks ties so the order is total and stable. */
function compareRecords(a: TemplateRecord, b: TemplateRecord): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? -1 : 1
  return a.id < b.id ? -1 : 1
}

interface LibraryState {
  readonly templates: TemplateRecord[]
  readonly tags: TemplateTag[]
}

async function readFileText(file: string): Promise<string> {
  try {
    return await readFile(file, 'utf8')
  } catch {
    // Missing file: an empty library is the legitimate first-write state.
    return ''
  }
}

/**
 * Read both library files leniently for the list and export projections.
 * @param root - absolute templates root directory.
 * @returns the valid records and tags, with every dropped stored record named.
 */
export async function readTemplateLibrary(root: string): Promise<TemplatesSnapshot> {
  const templatesParse = parseTemplatesManifest(await readFileText(join(root, TEMPLATES_FILENAME)))
  const taxonomyParse = parseTemplateTaxonomy(await readFileText(join(root, TAXONOMY_FILENAME)))
  const problems = [
    ...(templatesParse.kind === 'invalid' ? [templatesParse.problem] : templatesParse.kind === 'ok' ? templatesParse.problems : []),
    ...(taxonomyParse.kind === 'invalid' ? [taxonomyParse.problem] : taxonomyParse.kind === 'ok' ? taxonomyParse.problems : []),
  ]
  return {
    templates: templatesParse.kind === 'ok' ? templatesParse.manifest.templates : [],
    tags: taxonomyParse.kind === 'ok' ? taxonomyParse.taxonomy.tags : [],
    problems,
  }
}

/**
 * Read both files strictly for a write: every parse must be clean, so a save
 * never resolves a corrupted store by overwriting it.
 * @param root - absolute templates root directory; created when missing.
 * @returns the mutable stored state.
 */
async function readForWrite(root: string): Promise<LibraryState> {
  await mkdir(root, { recursive: true, mode: 0o700 })
  const templatesParse = parseTemplatesManifest(await readFileText(join(root, TEMPLATES_FILENAME)))
  if (templatesParse.kind === 'invalid') throw new Error(`refusing to write ${TEMPLATES_FILENAME}: ${templatesParse.problem}`)
  if (templatesParse.kind === 'ok' && templatesParse.problems.length > 0) {
    throw new Error(`refusing to write ${TEMPLATES_FILENAME}: resolve the stored invalid entries first (${String(templatesParse.problems.length)} dropped)`)
  }
  const taxonomyParse = parseTemplateTaxonomy(await readFileText(join(root, TAXONOMY_FILENAME)))
  if (taxonomyParse.kind === 'invalid') throw new Error(`refusing to write ${TAXONOMY_FILENAME}: ${taxonomyParse.problem}`)
  if (taxonomyParse.kind === 'ok' && taxonomyParse.problems.length > 0) {
    throw new Error(`refusing to write ${TAXONOMY_FILENAME}: resolve the stored invalid entries first (${String(taxonomyParse.problems.length)} dropped)`)
  }
  return {
    templates: templatesParse.kind === 'ok' ? [...templatesParse.manifest.templates] : [],
    tags: taxonomyParse.kind === 'ok' ? [...taxonomyParse.taxonomy.tags] : [],
  }
}

async function writeTemplates(root: string, templates: readonly TemplateRecord[]): Promise<void> {
  const body = `${JSON.stringify({ formatVersion: 0, templates } satisfies TemplatesManifest, null, 2)}\n`
  await writeFileAtomic(join(root, TEMPLATES_FILENAME), body, { mode: 0o600, dirMode: 0o700 })
}

async function writeTaxonomy(root: string, tags: readonly TemplateTag[]): Promise<void> {
  const body = `${JSON.stringify({ formatVersion: 0, tags } satisfies TemplateTaxonomy, null, 2)}\n`
  await writeFileAtomic(join(root, TAXONOMY_FILENAME), body, { mode: 0o600, dirMode: 0o700 })
}

/**
 * Validate one variable definition; every text field is trimmed at the cap.
 * @param value - the raw variable from the client.
 * @returns the stored variable, or the reason it is invalid.
 */
function normalizeVariable(value: unknown): { variable?: TemplateVariable; detail?: string } {
  if (!isRecord(value)) return { detail: 'variable must be an object' }
  if (typeof value.name !== 'string' || !TEMPLATE_VARIABLE_NAME_PATTERN.test(value.name)) {
    return { detail: 'variable name must match ^[a-zA-Z][a-zA-Z0-9_]{0,63}$' }
  }
  if (!isText(value.label, TEMPLATE_MAX_VARIABLE_TEXT)) return { detail: `variable ${value.name}: label exceeds the cap` }
  if (!isText(value.description, TEMPLATE_MAX_VARIABLE_DESCRIPTION)) return { detail: `variable ${value.name}: description exceeds the cap` }
  if (!isText(value.defaultValue, TEMPLATE_MAX_VARIABLE_DEFAULT)) return { detail: `variable ${value.name}: defaultValue exceeds the cap` }
  if (typeof value.required !== 'boolean') return { detail: `variable ${value.name}: required must be a boolean` }
  return {
    variable: {
      name: value.name,
      label: value.label.trim(),
      description: value.description.trim(),
      defaultValue: value.defaultValue,
      required: value.required,
    },
  }
}

/**
 * Validate one upsert input into its stored shape: the version increments
 * from the stored record, the status carries over (the archive face owns
 * transitions), and gateway-owned fields cannot be injected.
 * @param input - the upsert payload from the browser.
 * @param existing - the stored record when `input.id` addresses one.
 * @param storedNames - display names of every other stored record.
 * @param now - the save instant (ISO 8601).
 * @returns the stored record, or the reason the input is invalid.
 */
export function normalizeTemplateInput(
  input: TemplateInput,
  existing: TemplateRecord | undefined,
  storedNames: readonly string[],
  now: string,
): { record?: TemplateRecord; detail?: string } {
  if (existing === undefined && input.id !== undefined && !isTextField(input.id, TEMPLATE_MAX_ID)) {
    return { detail: 'id must be a non-empty string within the cap' }
  }
  if (typeof input.name !== 'string' || input.name.trim().length === 0) return { detail: 'name must be a non-empty string' }
  const name = input.name.trim()
  if (name.length > TEMPLATE_MAX_NAME) return { detail: 'name exceeds the length cap' }
  if (storedNames.includes(name)) return { detail: `duplicate template name: ${name}` }
  if (!CATEGORIES.includes(input.category)) return { detail: 'unknown template category' }
  if (!isText(input.description, TEMPLATE_MAX_DESCRIPTION)) return { detail: 'description exceeds the length cap' }
  if (!Array.isArray(input.tagIds) || input.tagIds.length > TEMPLATE_MAX_TAGS) return { detail: `tagIds must be an array within ${String(TEMPLATE_MAX_TAGS)}` }
  if (!input.tagIds.every(tagId => isTagId(tagId))) return { detail: 'tagIds entries must be non-empty strings' }
  if (new Set(input.tagIds).size !== input.tagIds.length) return { detail: 'tagIds must not repeat' }
  if (typeof input.body !== 'string' || input.body.trim().length === 0) return { detail: 'body must be a non-empty string' }
  if (input.body.length > TEMPLATE_MAX_BODY) return { detail: 'body exceeds the length cap' }
  if (!Array.isArray(input.variables) || input.variables.length > TEMPLATE_MAX_VARIABLES) return { detail: `variables must be an array within ${String(TEMPLATE_MAX_VARIABLES)}` }
  const variables: TemplateVariable[] = []
  for (const raw of input.variables) {
    const normalized = normalizeVariable(raw)
    if (normalized.variable === undefined) return { detail: normalized.detail ?? 'invalid variable' }
    variables.push(normalized.variable)
  }
  const names = variables.map(variable => variable.name)
  if (new Set(names).size !== names.length) return { detail: 'variable names must not repeat' }
  const changeNote = input.changeNote === undefined ? '' : input.changeNote
  if (!isText(changeNote, TEMPLATE_MAX_CHANGE_NOTE)) return { detail: 'changeNote exceeds the length cap' }

  const id = existing?.id ?? (input.id ?? (randomUUID() as TemplateId))
  const record: TemplateRecord = {
    id,
    name,
    category: input.category,
    description: input.description.trim(),
    tagIds: [...input.tagIds],
    body: input.body,
    variables,
    status: existing?.status ?? 'active',
    version: existing === undefined ? 1 : existing.version + 1,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  return { record }
}

/** Absolute path of one version's snapshot file. */
function historyFile(root: string, id: string, version: number): string {
  return join(root, HISTORY_DIRNAME, id, `${String(version)}.json`)
}

/**
 * Write one version's full-record snapshot and trim the history to the cap:
 * when the directory holds more than the newest {@link TEMPLATE_HISTORY_LIMIT}
 * versions, the oldest snapshot files are removed. Snapshot files are inert
 * on their own, so a trim failure never fails the save that already stored
 * the record.
 * @param root - absolute templates root directory.
 * @param entry - the snapshot to store.
 */
async function writeHistoryEntry(root: string, entry: TemplateHistoryEntry): Promise<void> {
  const file = historyFile(root, entry.record.id, entry.version)
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  const body = `${JSON.stringify(entry, null, 2)}\n`
  await writeFileAtomic(file, body, { mode: 0o600, dirMode: 0o700 })
  const dir = dirname(file)
  let names: string[] = []
  try {
    names = await readdir(dir)
  } catch {
    return
  }
  const versions = names
    .map(name => /^(\d+)\.json$/u.exec(name))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(match => Number(match[1]))
    .sort((a, b) => b - a)
  for (const version of versions.slice(TEMPLATE_HISTORY_LIMIT)) {
    await rm(historyFile(root, entry.record.id, version), { force: true }).catch(() => undefined)
  }
}

/**
 * Acquire the library write lock, creating the library directory first: the
 * lock file lives beside `templates.json`, so a first-ever write on a machine
 * without `<templatesRoot>/` would otherwise fail on the lock itself.
 * @param root - absolute templates root directory.
 * @param fn - the locked critical section.
 * @returns the section's result.
 */
async function withTemplatesLock<T>(root: string, fn: () => Promise<T>): Promise<T> {
  await mkdir(root, { recursive: true, mode: 0o700 })
  return withFileLock(join(root, TEMPLATES_FILENAME), fn)
}

/**
 * Upsert one template under a file lock, atomically: the version increments
 * and one full-record snapshot lands in `history/` before the manifest
 * commits. Creating with an id that is absent from the manifest rejects — a
 * stale client must reload, not resurrect a deleted template.
 * @param root - absolute templates root directory.
 * @param input - the upsert payload from the browser.
 * @param now - the save instant (ISO 8601); defaults to the current time.
 * @returns the stored record.
 */
export async function putTemplateFile(root: string, input: TemplateInput, now: string = new Date().toISOString()): Promise<TemplateRecord> {
  return withTemplatesLock(root, async () => {
    const state = await readForWrite(root)
    const existing = input.id === undefined ? undefined : state.templates.find(candidate => candidate.id === input.id)
    if (input.id !== undefined && existing === undefined) throw new Error(`unknown template: ${input.id}`)
    const others = state.templates.filter(candidate => candidate.id !== existing?.id).map(candidate => candidate.name)
    const normalized = normalizeTemplateInput(input, existing, others, now)
    if (normalized.record === undefined) throw new Error(`invalid template input: ${normalized.detail}`)
    const record = normalized.record
    await writeHistoryEntry(root, {
      version: record.version,
      changeNote: input.changeNote?.trim() ?? '',
      createdAt: now,
      record,
    })
    await writeTemplates(root, [record, ...state.templates.filter(candidate => candidate.id !== record.id)].sort(compareRecords))
    return record
  })
}

/**
 * Flip one template's lifecycle state without a content save: archiving and
 * restoring are bookkeeping, not edits, so no snapshot is written.
 * @param root - absolute templates root directory.
 * @param id - the template to update; unknown ids reject.
 * @param status - the next lifecycle state.
 * @param now - the transition instant (ISO 8601); defaults to the current time.
 * @returns the stored record.
 */
export async function setTemplateStatusFile(
  root: string, id: string, status: TemplateStatus, now: string = new Date().toISOString(),
): Promise<TemplateRecord> {
  return withTemplatesLock(root, async () => {
    const state = await readForWrite(root)
    const existing = state.templates.find(candidate => candidate.id === id)
    if (existing === undefined) throw new Error(`unknown template: ${id}`)
    const record: TemplateRecord = { ...existing, status, updatedAt: now }
    await writeTemplates(root, [record, ...state.templates.filter(candidate => candidate.id !== id)].sort(compareRecords))
    return record
  })
}

/**
 * Remove one template and its whole history directory under a file lock;
 * there is no file left to dangle. Removing an unknown id is a no-op.
 * @param root - absolute templates root directory.
 * @param id - the template to remove.
 */
export async function deleteTemplateFile(root: string, id: string): Promise<void> {
  await withTemplatesLock(root, async () => {
    const state = await readForWrite(root)
    const next = state.templates.filter(candidate => candidate.id !== id)
    if (next.length === state.templates.length) return
    await writeTemplates(root, next)
    await rm(join(root, HISTORY_DIRNAME, id), { recursive: true, force: true }).catch(() => undefined)
  })
}

/**
 * Replace the shared tag list wholesale under a file lock, stripping every
 * reference to a removed tag from the stored records in the same commit —
 * a template never carries a dangling `tagIds` entry.
 * @param root - absolute templates root directory.
 * @param tags - the complete next tag list; names must be unique.
 * @returns the stored tag list.
 */
export async function putTemplateTagsFile(root: string, tags: readonly TemplateTag[]): Promise<readonly TemplateTag[]> {
  return withTemplatesLock(root, async () => {
    const state = await readForWrite(root)
    if (tags.length > TEMPLATE_MAX_TAGS) throw new Error(`tags exceed ${String(TEMPLATE_MAX_TAGS)}`)
    for (const tag of tags) {
      if (!isTag(tag)) throw new Error('invalid tag record')
    }
    const names = tags.map(tag => tag.name)
    if (new Set(names).size !== names.length) throw new Error('duplicate tag name')
    const kept = new Set(tags.map(tag => tag.id))
    const templates = state.templates.map(record => ({
      ...record,
      tagIds: record.tagIds.filter(tagId => kept.has(tagId)),
    }))
    await writeTemplates(root, templates.sort(compareRecords))
    await writeTaxonomy(root, tags)
    return tags
  })
}

/**
 * Read one template's history snapshots, newest version first.
 * @param root - absolute templates root directory.
 * @param id - the template whose history to read.
 * @returns the valid snapshots; unreadable or malformed files are skipped.
 */
export async function readTemplateHistory(root: string, id: string): Promise<readonly TemplateHistoryEntry[]> {
  const dir = join(root, HISTORY_DIRNAME, id)
  let names: string[] = []
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const entries: TemplateHistoryEntry[] = []
  for (const name of names) {
    const match = /^(\d+)\.json$/u.exec(name)
    if (match === null) continue
    let entry: unknown
    try {
      entry = JSON.parse(await readFile(join(dir, name), 'utf8'))
    } catch {
      continue
    }
    if (!isRecord(entry) || !isTemplateRecord(entry.record)) continue
    if (entry.record.id !== id) continue
    if (typeof entry.version !== 'number' || !Number.isInteger(entry.version) || entry.version < 1) continue
    if (!isTimestamp(entry.createdAt)) continue
    entries.push({ version: entry.version, changeNote: isText(entry.changeNote, TEMPLATE_MAX_CHANGE_NOTE) ? entry.changeNote : '', createdAt: entry.createdAt, record: entry.record })
  }
  return entries.sort((a, b) => b.version - a.version)
}

/**
 * Build the portable pack document for the given ids (every template when
 * `ids` is empty), reading leniently like the list projection.
 * @param root - absolute templates root directory.
 * @param ids - the template ids to export; empty exports the whole library.
 * @param exportedAt - the export instant (ISO 8601).
 * @returns the pack document for the caller to hand the browser.
 */
export async function exportTemplatePack(root: string, ids: readonly string[], exportedAt: string): Promise<TemplatePack> {
  const library = await readTemplateLibrary(root)
  const selected = ids.length === 0
    ? library.templates
    : library.templates.filter(record => ids.includes(record.id))
  return {
    format: 'dsh-template-pack',
    formatVersion: 1,
    exportedAt,
    templates: selected,
    tags: library.tags,
  }
}

/** Suffix a display name until it differs from every taken name. */
function uniqueName(name: string, taken: readonly string[]): string {
  let candidate = name
  let counter = 2
  while (taken.includes(candidate)) {
    candidate = `${name}-${String(counter)}`
    counter += 1
  }
  return candidate
}

/**
 * Import one pack document under a file lock. Entries are independent: one
 * rejected entry is named in the summary's `failed` list while the rest land.
 * A conflicting id resolves per the strategy — `skip` keeps the local record,
 * `overwrite` replaces it (new version, new snapshot), `rename` stores the
 * incoming entry under a fresh id and a suffixed unique name. Every stored
 * entry also writes its snapshot so the history directory starts populated.
 * @param root - absolute templates root directory.
 * @param pack - the parsed pack document from the browser.
 * @param strategy - the conflict resolution for ids that already exist.
 * @param now - the import instant (ISO 8601); defaults to the current time.
 * @returns the per-bucket summary.
 */
export async function importTemplatePack(
  root: string, pack: TemplatePack, strategy: TemplateImportStrategy, now: string = new Date().toISOString(),
): Promise<TemplateImportSummary> {
  // The envelope checks are load-bearing: the import path feeds parsed-
  // unknown JSON cast to TemplatePack, so the literal gates carry the type.
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (pack.format !== 'dsh-template-pack') throw new Error(`unsupported pack format: ${String((pack as { format?: unknown }).format)}`)
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (pack.formatVersion !== 1) throw new Error(`unsupported pack formatVersion: ${String(pack.formatVersion)}`)
  return withTemplatesLock(root, async () => {
    const state = await readForWrite(root)
    const failed: string[] = []
    let added = 0
    let skipped = 0
    let overwritten = 0
    let renamed = 0

    // Pack tags merge additively: known ids keep their local names.
    const tagById = new Map(state.tags.map(tag => [tag.id, tag]))
    let taxonomyDirty = false
    for (const raw of pack.tags) {
      if (!isTag(raw)) {
        failed.push(`invalid tag record: ${JSON.stringify(raw).slice(0, 120)}`)
        continue
      }
      if (tagById.has(raw.id)) continue
      if (state.tags.some(tag => tag.name === raw.name)) {
        failed.push(`duplicate tag name: ${raw.name}`)
        continue
      }
      state.tags.push(raw)
      tagById.set(raw.id, raw)
      taxonomyDirty = true
    }

    const templates = [...state.templates]
    for (const raw of pack.templates) {
      if (!isTemplateRecord(raw)) {
        failed.push(`invalid template record: ${JSON.stringify(raw).slice(0, 120)}`)
        continue
      }
      const incoming: TemplateRecord = raw
      const existingIndex = templates.findIndex(candidate => candidate.id === incoming.id)
      if (existingIndex === -1) {
        const record: TemplateRecord = { ...incoming, name: uniqueName(incoming.name, templates.map(candidate => candidate.name)) }
        templates.push(record)
        await writeHistoryEntry(root, { version: record.version, changeNote: 'imported', createdAt: now, record })
        added += 1
        continue
      }
      if (strategy === 'skip') {
        skipped += 1
        continue
      }
      if (strategy === 'overwrite') {
        const existing = templates[existingIndex]
        if (existing === undefined) continue
        const record: TemplateRecord = {
          ...incoming,
          version: Math.max(existing.version, incoming.version) + 1,
          createdAt: existing.createdAt,
          updatedAt: now,
        }
        templates[existingIndex] = record
        await writeHistoryEntry(root, { version: record.version, changeNote: 'imported (overwritten)', createdAt: now, record })
        overwritten += 1
        continue
      }
      const record: TemplateRecord = {
        ...incoming,
        id: randomUUID() as TemplateId,
        name: uniqueName(incoming.name, templates.map(candidate => candidate.name)),
        version: 1,
        createdAt: now,
        updatedAt: now,
      }
      templates.push(record)
      await writeHistoryEntry(root, { version: 1, changeNote: 'imported (renamed)', createdAt: now, record })
      renamed += 1
    }

    await writeTemplates(root, templates.sort(compareRecords))
    if (taxonomyDirty) await writeTaxonomy(root, state.tags)
    return { added, skipped, overwritten, renamed, failed }
  })
}
