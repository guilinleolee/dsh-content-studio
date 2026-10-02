/**
 * On-disk store for the create write face: the `_create.json` manifest and
 * the publishing handoff under `outputs/<theme>/`. Paths enter through the
 * guards here — a theme is one plain directory name and a deliverable is one
 * plain file name at the theme root, so `..`, absolute paths, and separator
 * tricks cannot reach anything else. Manifest and metadata writes serialize
 * through the shared file lock and commit with an atomic rename (with the
 * Windows rename-pinning retry the gather write face established). A
 * malformed manifest rejects whole: unlike gather materials, a version list
 * must stay consistent, so no entry is ever dropped or repaired.
 */

import { lstat, mkdir, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveAssetsDir, writeAtomicallyLocked } from '../gather/store.ts'
import { METADATA_FILENAME, parseMetadata } from '../scan.ts'
import type {
  CreateContext, CreateEvaluation, CreateEvaluationDimension, CreateGrade, CreateManifest,
  CreateProfileRef, CreateTemplate, CreateTemplateInput, CreateVersion, OutputCreateState, OutputMetadata,
} from '../types.ts'
import { CREATE_CONTENT_TYPES, CREATE_GRADES } from './types.ts'
import type { CreateContentType } from './types.ts'

/** Template bank file name at the outputs library root. */
export const CREATE_TEMPLATES_FILENAME = '_templates.json'

/** The placeholder whitelist a custom template body may carry. */
export const CREATE_TEMPLATE_PLACEHOLDERS: readonly string[] = ['title', 'audience', 'points', 'references', 'profile']

/** Manifest file name inside the theme's `assets/` directory. */
export const CREATE_MANIFEST_FILENAME = '_create.json'

/** Hard version-count cap enforced on write; the client prunes to its own lower quota. */
export const CREATE_MAX_STORED_VERSIONS = 60

/** Hard per-version size cap; generation and drafts stay far below it. */
export const CREATE_MAX_CONTENT_CHARS = 400_000

/** Whether the value is one well-typed content type. */
function isContentType(value: unknown): value is CreateContentType {
  return typeof value === 'string' && (CREATE_CONTENT_TYPES as readonly string[]).includes(value)
}

/** Whether the value carries the style provenance of one version. */
function isProfileRef(value: unknown): value is CreateProfileRef {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const mode = record.mode
  return (mode === 'profile' || mode === 'inline')
    && typeof record.digest === 'string' && record.digest.length > 0
}

/** Whether the value is one advisory grade. */
function isGrade(value: unknown): value is CreateGrade {
  return typeof value === 'string' && (CREATE_GRADES as readonly string[]).includes(value)
}

/** Whether the value is one evaluated dimension with a grade and a short reason. */
function isDimension(value: unknown): value is CreateEvaluationDimension {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return isGrade(record.grade) && typeof record.reason === 'string' && record.reason.trim().length > 0
}

/** Whether the value carries one stored AI evaluation. */
function isEvaluation(value: unknown): value is CreateEvaluation {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.model === 'string' && record.model.length > 0
    && typeof record.promptVersion === 'number' && Number.isInteger(record.promptVersion)
    && typeof record.evaluatedAt === 'string' && record.evaluatedAt.length > 0
    && isGrade(record.grade)
    && isDimension(record.attraction) && isDimension(record.readability)
    && isDimension(record.differentiation) && isDimension(record.audienceFit)
}

/** Whether one stored version has every field present and well-typed. */
function isVersion(value: unknown): value is CreateVersion {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.v === 'number' && Number.isInteger(record.v) && record.v >= 1
    && typeof record.ts === 'string' && record.ts.length > 0
    && typeof record.trigger === 'string' && record.trigger.length > 0
    && typeof record.words === 'number' && Number.isInteger(record.words) && record.words >= 0
    && typeof record.content === 'string' && record.content.length <= CREATE_MAX_CONTENT_CHARS
    && typeof record.pinned === 'boolean'
    && (record.profileRef === null || isProfileRef(record.profileRef))
    // Absent on pre-evaluation manifests; present-or-null once the face writes them.
    && (record.evaluation === undefined || record.evaluation === null || isEvaluation(record.evaluation))
}

/** Whether the value carries the creation bookkeeping mirrored into metadata. */
function isCreateState(value: unknown): value is OutputCreateState {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.currentVersion === 'number' && Number.isInteger(record.currentVersion) && record.currentVersion >= 0
    && (record.publishedVersion === null || (typeof record.publishedVersion === 'number' && Number.isInteger(record.publishedVersion)))
    && (record.publishedPath === null || typeof record.publishedPath === 'string')
    && (record.publishedAt === null || typeof record.publishedAt === 'string')
    && (record.topicId === undefined || record.topicId === null || typeof record.topicId === 'string')
}

/** Whether the value carries the editable generation context. */
function isContext(value: unknown): value is CreateContext {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const isText = (field: unknown): boolean => field === null || typeof field === 'string'
  return isText(record.audience) && isText(record.points) && isText(record.references)
}

/**
 * Whether the manifest envelope and every version conform; one violation rejects whole.
 * @param manifest - the manifest being read or written.
 * @throws naming the first format violation.
 */
export function assertCreateManifest(manifest: CreateManifest): void {
  // The read path feeds parsed-unknown JSON through this assert cast to the
  // typed shape, so the envelope version gate is load-bearing.
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (manifest.formatVersion !== 0) throw new Error(`unsupported create manifest formatVersion ${String(manifest.formatVersion)}`)
  if (typeof manifest.contentId !== 'string' || manifest.contentId.length === 0) throw new Error('create manifest has no contentId')
  if (!isContentType(manifest.contentType)) throw new Error(`invalid create contentType: ${String(manifest.contentType)}`)
  if (typeof manifest.currentVersion !== 'number' || !Number.isInteger(manifest.currentVersion) || manifest.currentVersion < 0) {
    throw new Error('create manifest currentVersion must be a non-negative integer')
  }
  if (!isContext(manifest.context)) throw new Error('create manifest context is malformed')
  if (!Array.isArray(manifest.versions)) throw new Error('create manifest has no versions array')
  if (manifest.versions.length > CREATE_MAX_STORED_VERSIONS) throw new Error(`create manifest exceeds ${CREATE_MAX_STORED_VERSIONS} versions`)
  for (const version of manifest.versions) {
    if (!isVersion(version)) throw new Error(`invalid create version: ${JSON.stringify(version).slice(0, 120)}`)
  }
  if (!Array.isArray(manifest.sources)) throw new Error('create manifest has no sources array')
}

/**
 * Parse and validate one manifest document. The manifest rejects whole on
 * any violation — a truncated or hand-edited file never loads as partial
 * state; the caller shows the problem and keeps the last known state.
 * @param raw - exact file contents.
 * @returns the manifest, or null with a problem when it does not conform.
 */
export function parseCreateManifest(raw: string): { manifest: CreateManifest | null; problems: string[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { manifest: null, problems: ['create manifest is not valid JSON'] }
  }
  try {
    assertCreateManifest(parsed as CreateManifest)
  } catch (error) {
    return { manifest: null, problems: [error instanceof Error ? error.message : String(error)] }
  }
  return { manifest: parsed as CreateManifest, problems: [] }
}

/**
 * Read the theme's creation state: the validated manifest plus the current
 * draft body (`assets/<contentId>.md`). A missing state reads as empty
 * without problems; a malformed manifest reads as empty with the rejection
 * named, so the UI can warn instead of silently overwriting it.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the manifest (or null) and the draft body (or null).
 */
export async function readCreateStateFile(
  root: string, theme: string,
): Promise<{ manifest: CreateManifest | null; draft: string | null; problems: string[] }> {
  const assetsDir = resolveAssetsDir(root, theme)
  let raw: string
  try {
    raw = await readFile(join(assetsDir, CREATE_MANIFEST_FILENAME), 'utf8')
  } catch {
    return { manifest: null, draft: null, problems: [] }
  }
  const { manifest, problems } = parseCreateManifest(raw)
  if (manifest === null) return { manifest: null, draft: null, problems }
  let draft: string | null = null
  try {
    draft = await readFile(join(assetsDir, `${manifest.contentId}.md`), 'utf8')
  } catch {
    // No draft body (or the manifest is ahead of it): versions carry the
    // text, so the editor can restore from the newest snapshot.
  }
  return { manifest, draft, problems }
}

/**
 * Replace the theme's creation manifest with an atomic, locked commit.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param manifest - the complete next manifest.
 */
export async function writeCreateStateFile(root: string, theme: string, manifest: CreateManifest): Promise<void> {
  assertCreateManifest(manifest)
  await writeAtomicallyLocked(join(resolveAssetsDir(root, theme), CREATE_MANIFEST_FILENAME), `${JSON.stringify(manifest, null, 2)}\n`)
}

/** Deliverable file names sit at the theme root: plain, never system-prefixed, never the metadata file. */
function isRootFileName(file: string): boolean {
  return file.length > 0
    && !file.includes('/') && !file.includes('\\')
    && file !== '.' && file !== '..'
    && !file.startsWith('.') && !file.startsWith('_')
    && !/[\u0000-\u001f]/.test(file)
}

/**
 * Resolve and guard one theme-root file path.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - plain deliverable file name at the theme root.
 * @returns the absolute file path.
 * @throws when the theme or file name could escape the theme directory.
 */
export function resolveThemeFilePath(root: string, theme: string, file: string): string {
  if (!isRootFileName(file)) throw new Error(`invalid create deliverable file name: ${JSON.stringify(file)}`)
  if (theme.length === 0 || theme.includes('/') || theme.includes('\\') || theme.startsWith('.') || theme.startsWith('_')) {
    throw new Error(`invalid create theme name: ${JSON.stringify(theme)}`)
  }
  return join(root, theme, file)
}

/**
 * Publish one deliverable: copy the given content to the theme root under an
 * atomic, locked commit. A collision rejects instead of overwriting unless
 * `overwrite` is set — the caller confirms with the user first. The metadata
 * registration is a separate, later write so a failure between the two steps
 * is recoverable through the register retry.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param request - file name, complete content, and the overwrite decision.
 * @returns the stored root file name.
 */
export async function publishFinalFile(
  root: string, theme: string, request: { file: string; content: string; overwrite: boolean },
): Promise<string> {
  if (request.content.length > CREATE_MAX_CONTENT_CHARS) throw new Error(`create deliverable exceeds the ${CREATE_MAX_CONTENT_CHARS}-character cap`)
  const target = resolveThemeFilePath(root, theme, request.file)
  if (!request.overwrite) {
    let exists = false
    try {
      await lstat(target)
      exists = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException | null)?.code !== 'ENOENT') throw error
    }
    if (exists) throw new Error(`deliverable ${request.file} already exists in ${theme}`)
  }
  await writeAtomicallyLocked(target, request.content)
  return request.file
}

/**
 * Validate one metadata document on the create write path: the known fields
 * keep the scanner's format-0 rules, unknown fields pass through untouched,
 * and the optional `create` bookkeeping must be well-typed when present.
 * @param metadata - the metadata the caller wants stored.
 */
export function assertOutputMetadata(metadata: object): void {
  const record = metadata as Record<string, unknown>
  if (parseMetadata(JSON.stringify(record)) === undefined) throw new Error('output metadata violates the format-0 rules')
  if (record.create !== undefined && !isCreateState(record.create)) throw new Error('output metadata create state is malformed')
}

/**
 * Resolve and guard one theme's `.dsh-output.json` path.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the absolute metadata path.
 * @throws when the theme name could escape the library root.
 */
export function resolveThemeMetadataPath(root: string, theme: string): string {
  if (theme.length === 0 || theme.includes('/') || theme.includes('\\') || theme === '.' || theme === '..' || theme.startsWith('.') || theme.startsWith('_')) {
    throw new Error(`invalid create theme name: ${JSON.stringify(theme)}`)
  }
  return join(root, theme, METADATA_FILENAME)
}

/**
 * Read and validate the theme's `.dsh-output.json`.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the metadata, or null with the violation named when the file is
 *   absent (null metadata, no problem) or malformed (both set).
 */
export async function readCreateMetadataFile(
  root: string, theme: string,
): Promise<{ metadata: OutputMetadata | null; problem: string | null }> {
  let raw: string
  try {
    raw = await readFile(resolveThemeMetadataPath(root, theme), 'utf8')
  } catch {
    return { metadata: null, problem: null }
  }
  const metadata = parseMetadata(raw)
  return metadata === undefined
    ? { metadata: null, problem: 'metadata violates the format-0 rules' }
    : { metadata, problem: null }
}

/**
 * Register one publish into the theme's metadata: flip the status to
 * `published` and mirror the creation bookkeeping. The deliverable must
 * already sit at the theme root — this is the retry half of the publish
 * handoff, never the copy.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param request - the root file name and the version being published.
 */
export async function registerCreatePublishFile(root: string, theme: string, request: { file: string; version: number }): Promise<void> {
  const deliverable = resolveThemeFilePath(root, theme, request.file)
  try {
    await lstat(deliverable)
  } catch {
    throw new Error(`deliverable ${request.file} is not in ${theme}; publish before registering`)
  }
  const { metadata, problem } = await readCreateMetadataFile(root, theme)
  if (metadata === null) {
    throw new Error(problem !== null
      ? 'existing output metadata violates the format-0 rules'
      : `theme ${theme} has no output metadata to register the publish into`)
  }
  const { manifest } = await readCreateStateFile(root, theme)
  await writeOutputMetadataFile(root, theme, {
    ...metadata,
    status: 'published',
    create: {
      currentVersion: request.version,
      publishedVersion: request.version,
      publishedPath: request.file,
      publishedAt: new Date().toISOString(),
      topicId: manifest?.topicRef?.topicId ?? null,
    },
  })
}

/**
 * Write the theme's `.dsh-output.json` with an atomic, locked commit after
 * validating the known fields and the creation bookkeeping.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param metadata - the complete next metadata record.
 */
export async function writeOutputMetadataFile(
  root: string, theme: string, metadata: OutputMetadata | Record<string, unknown>,
): Promise<void> {
  assertOutputMetadata(metadata)
  await writeAtomicallyLocked(join(root, theme, METADATA_FILENAME), `${JSON.stringify(metadata, null, 2)}\n`)
}

/**
 * Collect the asset files the theme's creation state references, for the
 * gather retention exemption: a gather material whose snapshot file is
 * referenced by the create workbench must never be trimmed as stale.
 * A malformed create manifest contributes an empty set — trimming then runs
 * by its own rules, which is the safe direction (worst case a referenced
 * snapshot ages out; the versions carry the text).
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the referenced asset file names.
 */
export async function collectCreateReferencedFiles(root: string, theme: string): Promise<Set<string>> {
  const { manifest } = await readCreateStateFile(root, theme)
  const files = new Set<string>()
  if (manifest !== null) {
    for (const source of manifest.sources) {
      if (source.file !== null && source.file.length > 0) files.add(source.file)
    }
  }
  return files
}

/**
 * List the theme's non-system asset file names, sorted. Serves the material
 * reference list and the image inserter; `_`-prefixed system files (the
 * gather and create manifests) never appear.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the sorted plain file names.
 */
export async function listAssetFiles(root: string, theme: string): Promise<string[]> {
  const assetsDir = resolveAssetsDir(root, theme)
  await mkdir(assetsDir, { recursive: true })
  const entries = await readdir(assetsDir, { withFileTypes: true })
  return entries
    .filter(entry => entry.isFile() && !entry.name.startsWith('.') && !entry.name.startsWith('_'))
    .map(entry => entry.name)
    .sort()
}

/** Whether one value is one stored custom template. */
function isTemplate(value: unknown): value is CreateTemplate {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && record.id.length > 0
    && typeof record.title === 'string' && record.title.length > 0
    && isContentType(record.contentType)
    && typeof record.body === 'string' && record.body.length > 0
    && typeof record.revision === 'number' && Number.isInteger(record.revision) && record.revision >= 1
    && typeof record.updatedAt === 'string' && record.updatedAt.length > 0
}

/**
 * Validate one custom template body: non-empty, and its `{{…}}` placeholders
 * stay inside the whitelist — an unknown placeholder fails the save here and
 * the run there, never silently misfills.
 * @param body - the template body.
 * @throws when the body is empty or carries an unknown placeholder.
 */
export function assertTemplateBody(body: string): void {
  if (body.trim().length === 0) throw new Error('create template body is empty')
  for (const match of body.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/gu)) {
    const name = match[1] ?? ''
    if (!(CREATE_TEMPLATE_PLACEHOLDERS).includes(name)) {
      throw new Error(`create template body carries an unknown placeholder {{${name}}}; allowed: ${CREATE_TEMPLATE_PLACEHOLDERS.map(placeholder => `{{${placeholder}}}`).join(' ')}`)
    }
  }
}

/**
 * Read the global template bank. A missing file reads as empty; a malformed
 * bank reads as empty with the rejection named, so the manager can warn
 * instead of silently overwriting it.
 * @param root - absolute outputs library root.
 * @returns the valid templates plus every rejection named.
 */
export async function readCreateTemplatesFile(root: string): Promise<{ templates: CreateTemplate[]; problems: string[] }> {
  let raw: string
  try {
    raw = await readFile(join(root, CREATE_TEMPLATES_FILENAME), 'utf8')
  } catch {
    return { templates: [], problems: [] }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { templates: [], problems: ['create template bank is not valid JSON'] }
  }
  const record = parsed as Record<string, unknown>
  if (record.formatVersion !== 0 || !Array.isArray(record.templates)) {
    return { templates: [], problems: ['create template bank violates the format-0 rules'] }
  }
  const templates: CreateTemplate[] = []
  const problems: string[] = []
  for (const entry of record.templates) {
    if (isTemplate(entry)) templates.push(entry)
    else problems.push(`dropped one invalid create template: ${JSON.stringify(entry).slice(0, 120)}`)
  }
  return { templates, problems }
}

/**
 * Upsert one custom template: an absent id creates (revision 1), a present
 * id updates and bumps the revision. The bank rewrites with an atomic,
 * locked commit; the read-modify-write window is the same granularity the
 * gather manifest face accepts for this single-user data class.
 * @param root - absolute outputs library root.
 * @param input - the template facts; timestamps and the revision are store-managed.
 * @returns the stored templates.
 */
export async function putCreateTemplateFile(root: string, input: CreateTemplateInput): Promise<CreateTemplate[]> {
  if (input.title.trim().length === 0) throw new Error('create template needs a non-empty title')
  if (input.title.length > 60) throw new Error('create template title exceeds 60 characters')
  if (!isContentType(input.contentType)) throw new Error(`invalid create contentType: ${String(input.contentType)}`)
  assertTemplateBody(input.body)
  const { templates } = await readCreateTemplatesFile(root)
  const now = new Date().toISOString()
  const next = input.id === undefined
    ? [...templates, {
      id: `ct-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      title: input.title.trim(), contentType: input.contentType, body: input.body,
      revision: 1, updatedAt: now,
    }]
    : templates.map(template => template.id === input.id
      ? {
        ...template,
        title: input.title.trim(),
        contentType: input.contentType,
        body: input.body,
        revision: template.revision + 1,
        updatedAt: now,
      }
      : template)
  await writeAtomicallyLocked(join(root, CREATE_TEMPLATES_FILENAME), `${JSON.stringify({ formatVersion: 0, templates: next }, null, 2)}\n`)
  return next
}

/**
 * Delete one custom template; deleting an unknown id is a no-op.
 * @param root - absolute outputs library root.
 * @param id - the template id.
 * @returns the stored templates.
 */
export async function deleteCreateTemplateFile(root: string, id: string): Promise<CreateTemplate[]> {
  const { templates } = await readCreateTemplatesFile(root)
  const next = templates.filter(template => template.id !== id)
  await writeAtomicallyLocked(join(root, CREATE_TEMPLATES_FILENAME), `${JSON.stringify({ formatVersion: 0, templates: next }, null, 2)}\n`)
  return next
}
