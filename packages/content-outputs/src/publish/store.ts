/**
 * File storage for the publish face: the theme-side `assets/_publish.json`
 * manifest, the derived per-platform drafts under
 * `assets/publish/<taskId>/<platformId>.md`, the global
 * `_publish-index.json` aggregation aid, and the `_publish-profiles.json`
 * account cards. Every write is an atomic, writer-locked commit; every path
 * is guarded against leaving its directory.
 */

import { join } from 'node:path'
import { mkdir, readFile, rm } from 'node:fs/promises'
import type {
  PlatformAttemptAction, PlatformStatus, PlatformTask, PublishIndex, PublishIndexEntry,
  PublishManifest, PublishMode, PublishProfile, PublishProfilesDoc, PublishPackage, PublishStatus,
  PublishTask,
} from './types.ts'
import { PUBLISH_MODES, PLATFORM_ATTEMPT_ACTIONS, PLATFORM_STATUSES, PUBLISH_STATUSES } from './types.ts'
import { resolveAssetsDir, writeAtomicallyLocked } from '../gather/store.ts'

/** Theme-side publish manifest file name (`_` keeps it out of the scanner). */
export const PUBLISH_MANIFEST_FILENAME = '_publish.json'

/** Derived-draft directory under the theme's `assets/`. */
export const PUBLISH_DIRNAME = 'publish'

/** Global aggregation aid at the library root. */
export const PUBLISH_INDEX_FILENAME = '_publish-index.json'

/** Global account cards at the library root. */
export const PUBLISH_PROFILES_FILENAME = '_publish-profiles.json'

/** Task ids are UUIDs: the store generates them and the derived path embeds them. */
const TASK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** Platform ids are registry keys: lowercase letters, digits, dashes. */
const PLATFORM_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/u

/** Whether the value is one well-formed task id. */
export function isTaskId(value: string): boolean {
  return TASK_ID_PATTERN.test(value)
}

/** Whether the value is one well-formed platform id. */
export function isPlatformId(value: string): boolean {
  return PLATFORM_ID_PATTERN.test(value)
}

/** Whether the value is one plain theme-root manuscript file name (never the
 * metadata file, never a system entry). */
function isManuscriptFileName(file: string): boolean {
  return file.length > 0
    && !file.includes('/') && !file.includes('\\')
    && file !== '.' && file !== '..'
    && !file.startsWith('.') && !file.startsWith('_')
    && file !== '.dsh-output.json'
    && !/[\u0000-\u001f]/.test(file)
}

/** Whether one attempt log entry carries the full structural shape. */
function isAttempt(value: unknown): value is PlatformTask['attempts'][number] {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.at === 'string' && record.at.length > 0
    && PLATFORM_ATTEMPT_ACTIONS.includes(record.action as PlatformAttemptAction)
    && typeof record.ok === 'boolean'
    && typeof record.detail === 'string'
}

/** Whether one platform leg carries the full structural shape. */
function isPlatformTask(value: unknown): value is PlatformTask {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.platformId === 'string' && isPlatformId(record.platformId)
    && typeof record.accountAlias === 'string' && record.accountAlias.trim().length > 0
    && typeof record.contentFile === 'string' && record.contentFile.length > 0
    && (record.coverPrompt === null || typeof record.coverPrompt === 'string')
    && Array.isArray(record.tags) && record.tags.every(tag => typeof tag === 'string')
    && PLATFORM_STATUSES.includes(record.status as PlatformStatus)
    && Array.isArray(record.attempts) && record.attempts.every(isAttempt)
}

/** Whether one task carries the full structural shape. */
function isTask(value: unknown): value is PublishTask {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.taskId === 'string' && isTaskId(record.taskId)
    && typeof record.title === 'string' && record.title.trim().length > 0
    && typeof record.manuscriptFile === 'string' && isManuscriptFileName(record.manuscriptFile)
    && (record.manuscriptId === null || typeof record.manuscriptId === 'string')
    && (record.topicId === null || typeof record.topicId === 'string')
    && (record.personaDigest === null || typeof record.personaDigest === 'string')
    && PUBLISH_MODES.includes(record.mode as PublishMode)
    && (record.scheduledAt === null || typeof record.scheduledAt === 'string')
    && (record.scheduleItemId === null || typeof record.scheduleItemId === 'string')
    && PUBLISH_STATUSES.includes(record.status as PublishStatus)
    && (record.note === null || typeof record.note === 'string')
    && Array.isArray(record.platforms) && record.platforms.length > 0 && record.platforms.every(isPlatformTask)
    && typeof record.createdAt === 'string' && record.createdAt.length > 0
    && typeof record.updatedAt === 'string' && record.updatedAt.length > 0
}

/**
 * Parse and validate one publish manifest. One malformed task never hides
 * the rest: it is named in `problems` and dropped.
 * @param raw - exact file contents.
 * @returns the manifest with only valid tasks, plus every dropped one named.
 */
export function parsePublishManifest(raw: string): { manifest: PublishManifest; problems: string[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return { manifest: { formatVersion: 0, tasks: [] }, problems: [`manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`] }
  }
  const record = parsed as Record<string, unknown>
  if (record.formatVersion !== 0) {
    return { manifest: { formatVersion: 0, tasks: [] }, problems: [`unknown publish manifest formatVersion ${String(record.formatVersion)}`] }
  }
  if (!Array.isArray(record.tasks)) {
    return { manifest: { formatVersion: 0, tasks: [] }, problems: ['publish manifest tasks is not an array'] }
  }
  const problems: string[] = []
  const tasks = record.tasks.filter((task, index): task is PublishTask => {
    if (isTask(task)) return true
    problems.push(`publish task #${index} is malformed and was dropped`)
    return false
  })
  return { manifest: { formatVersion: 0, tasks }, problems }
}

/**
 * Structural validation for one write. The whole manifest rejects together —
 * the caller holds the complete next state, so a partial acceptance would
 * only invite silent loss.
 * @param manifest - the complete next manifest.
 * @throws when any task is malformed.
 */
export function assertPublishManifest(manifest: PublishManifest): void {
  // The read path feeds parsed-unknown JSON through this assert cast to the
  // typed shape, so the envelope version gate is load-bearing.
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (manifest.formatVersion !== 0) throw new Error(`unknown publish manifest formatVersion ${String(manifest.formatVersion)}`)
  if (!Array.isArray(manifest.tasks)) throw new Error('publish manifest tasks is not an array')
  for (const task of manifest.tasks) {
    if (!isTask(task)) throw new Error(`malformed publish task: ${JSON.stringify(task).slice(0, 120)}`)
  }
}

/**
 * Read the theme's `_publish.json` manifest.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the manifest (null when absent) plus every dropped task named.
 */
export async function readPublishManifestFile(
  root: string,
  theme: string,
): Promise<{ manifest: PublishManifest | null; problems: string[] }> {
  const file = join(resolveAssetsDir(root, theme), PUBLISH_MANIFEST_FILENAME)
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch {
    return { manifest: null, problems: [] }
  }
  const { manifest, problems } = parsePublishManifest(raw)
  return { manifest, problems }
}

/**
 * Recompute one theme's aggregation rows from its validated tasks.
 * @param theme - outputs-project directory name.
 * @param tasks - the theme's stored tasks.
 * @returns one index entry per task.
 */
export function indexEntriesOf(theme: string, tasks: readonly PublishTask[]): PublishIndexEntry[] {
  return tasks.map(task => ({
    taskId: task.taskId,
    theme,
    title: task.title,
    status: task.status,
    platformIds: task.platforms.map(platform => platform.platformId),
    updatedAt: task.updatedAt,
  }))
}

/**
 * Read the global `_publish-index.json`. A malformed file reads as empty
 * with the rejection named — the next manifest write rebuilds the rows.
 * @param root - absolute outputs library root.
 * @returns the index plus the parse problems.
 */
export async function readPublishIndexFile(root: string): Promise<{ index: PublishIndex; problems: string[] }> {
  const file = join(root, PUBLISH_INDEX_FILENAME)
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch {
    return { index: { formatVersion: 0, entries: [] }, problems: [] }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return { index: { formatVersion: 0, entries: [] }, problems: [`publish index is not valid JSON: ${error instanceof Error ? error.message : String(error)}`] }
  }
  const record = parsed as Record<string, unknown>
  if (record.formatVersion !== 0 || !Array.isArray(record.entries)) {
    return { index: { formatVersion: 0, entries: [] }, problems: ['unknown publish index format; rows rebuild on the next write'] }
  }
  const entries: PublishIndexEntry[] = []
  const problems: string[] = []
  record.entries.forEach((entry, position) => {
    const candidate = entry as Record<string, unknown>
    if (typeof candidate.taskId === 'string' && typeof candidate.theme === 'string'
      && typeof candidate.title === 'string' && PUBLISH_STATUSES.includes(candidate.status as PublishStatus)
      && Array.isArray(candidate.platformIds) && candidate.platformIds.every(id => typeof id === 'string')
      && typeof candidate.updatedAt === 'string') {
      entries.push({
        taskId: candidate.taskId,
        theme: candidate.theme,
        title: candidate.title,
        status: candidate.status as PublishStatus,
        platformIds: candidate.platformIds,
        updatedAt: candidate.updatedAt,
      })
    } else {
      problems.push(`publish index entry #${position} is malformed and was dropped`)
    }
  })
  return { index: { formatVersion: 0, entries }, problems }
}

/**
 * Replace the theme's `_publish.json` with an atomic, locked commit and
 * refresh the theme's rows in the global index under the same lock.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param manifest - the complete next manifest.
 */
export async function writePublishManifestFile(root: string, theme: string, manifest: PublishManifest): Promise<void> {
  assertPublishManifest(manifest)
  const file = join(resolveAssetsDir(root, theme), PUBLISH_MANIFEST_FILENAME)
  await writeAtomicallyLocked(file, `${JSON.stringify(manifest, null, 2)}\n`)
  // Same-lock index refresh: the index is a projection, so its own write is
  // folded into the manifest commit instead of racing a second face.
  const indexPath = join(root, PUBLISH_INDEX_FILENAME)
  const { index } = await readPublishIndexFile(root)
  const fresh = indexEntriesOf(theme, manifest.tasks)
  const entries = [...index.entries.filter(entry => entry.theme !== theme), ...fresh]
  await writeAtomicallyLocked(indexPath, `${JSON.stringify({ formatVersion: 0, entries } satisfies PublishIndex, null, 2)}\n`)
}

/** Absolute path of one derived draft. */
export function resolvePublishDerivedPath(root: string, theme: string, taskId: string, platformId: string): string {
  if (!isTaskId(taskId)) throw new Error(`invalid publish task id: ${JSON.stringify(taskId)}`)
  if (!isPlatformId(platformId)) throw new Error(`invalid publish platform id: ${JSON.stringify(platformId)}`)
  return join(resolveAssetsDir(root, theme), PUBLISH_DIRNAME, taskId, `${platformId}.md`)
}

/**
 * Write one derived draft under `assets/publish/<taskId>/<platformId>.md`.
 * The replacement is atomic and serialized per file; the directory is
 * created on demand.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param taskId - the owning task's UUID.
 * @param platformId - the platform registry key.
 * @param content - the complete draft text.
 * @returns the stored path relative to the theme's `assets/`.
 */
export async function writePublishDerivedFile(
  root: string,
  theme: string,
  taskId: string,
  platformId: string,
  content: string,
): Promise<{ file: string }> {
  const path = resolvePublishDerivedPath(root, theme, taskId, platformId)
  await mkdir(join(path, '..'), { recursive: true })
  await writeAtomicallyLocked(path, content)
  return { file: join(PUBLISH_DIRNAME, taskId, `${platformId}.md`) }
}

/**
 * Read one derived draft back.
 * @returns the text, or undefined when the draft does not exist yet.
 */
export async function readPublishDerivedFile(root: string, theme: string, taskId: string, platformId: string): Promise<string | undefined> {
  const path = resolvePublishDerivedPath(root, theme, taskId, platformId)
  try {
    return await readFile(path, 'utf8')
  } catch {
    return undefined
  }
}

/**
 * Read one theme-root deliverable as the adaptation source. Guarded like
 * every asset read: one plain file name at the theme root, never the
 * metadata file, never a system entry.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - the deliverable file name.
 * @returns the text, or undefined when absent.
 */
export async function readPublishSourceFile(root: string, theme: string, file: string): Promise<string | undefined> {
  if (!isManuscriptFileName(file)) throw new Error(`invalid publish manuscript file name: ${JSON.stringify(file)}`)
  // resolveAssetsDir validates the theme name; the deliverable lives one
  // level above it, at the theme root.
  resolveAssetsDir(root, theme)
  const path = join(root, theme, file)
  try {
    return await readFile(path, 'utf8')
  } catch {
    return undefined
  }
}

/**
 * Read the global `_publish-profiles.json` account cards.
 * @param root - absolute outputs library root.
 * @returns the profiles plus every dropped stored card named.
 */
export async function readPublishProfilesFile(root: string): Promise<{ profiles: PublishProfilesDoc['profiles']; problems: string[] }> {
  const file = join(root, PUBLISH_PROFILES_FILENAME)
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch {
    return { profiles: [], problems: [] }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return { profiles: [], problems: [`publish profiles is not valid JSON: ${error instanceof Error ? error.message : String(error)}`] }
  }
  const record = parsed as Record<string, unknown>
  if (record.formatVersion !== 0 || !Array.isArray(record.profiles)) {
    return { profiles: [], problems: ['unknown publish profiles format'] }
  }
  const profiles: PublishProfile[] = []
  const problems: string[] = []
  record.profiles.forEach((profile, position) => {
    const candidate = profile as Record<string, unknown>
    if (typeof candidate.platformId === 'string' && isPlatformId(candidate.platformId)
      && typeof candidate.alias === 'string' && candidate.alias.trim().length > 0
      && typeof candidate.enabled === 'boolean'
      && (candidate.adaptationOverrides === null || typeof candidate.adaptationOverrides === 'string')) {
      profiles.push({
        platformId: candidate.platformId,
        alias: candidate.alias,
        enabled: candidate.enabled,
        adaptationOverrides: candidate.adaptationOverrides,
      })
    } else {
      problems.push(`publish profile #${position} is malformed and was dropped`)
    }
  })
  return { profiles, problems }
}

/**
 * Replace the global `_publish-profiles.json` with an atomic, locked commit.
 * @param root - absolute outputs library root.
 * @param profiles - the complete next card list.
 */
export async function writePublishProfilesFile(root: string, profiles: PublishProfilesDoc['profiles']): Promise<void> {
  for (const profile of profiles) {
    if (!isPlatformId(profile.platformId)) throw new Error(`invalid publish profile platform id: ${JSON.stringify(profile.platformId)}`)
    if (profile.alias.trim().length === 0) throw new Error(`publish profile ${profile.platformId} carries an empty alias`)
  }
  const doc: PublishProfilesDoc = { formatVersion: 0, profiles }
  await writeAtomicallyLocked(join(root, PUBLISH_PROFILES_FILENAME), `${JSON.stringify(doc, null, 2)}\n`)
}

/**
 * Assemble the frozen phase-2 MCP handoff for one task: every platform leg's
 * derived draft is read fresh from disk, and a leg without its draft yet
 * rejects — the package must be complete or not exist.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param taskId - the task's UUID.
 * @returns the complete package.
 */
export async function buildPublishPackageFile(root: string, theme: string, taskId: string): Promise<PublishPackage> {
  if (!isTaskId(taskId)) throw new Error(`invalid publish task id: ${JSON.stringify(taskId)}`)
  const { manifest, problems } = await readPublishManifestFile(root, theme)
  if (problems.length > 0) throw new Error(`publish manifest for ${theme} is rejected: ${problems.join('; ')}`)
  const task = manifest?.tasks.find(candidate => candidate.taskId === taskId)
  if (task === undefined) throw new Error(`publish task ${taskId} does not exist in theme ${theme}`)
  const platforms = await Promise.all(task.platforms.map(async (platform): Promise<PublishPackage['platforms'][number]> => {
    const content = await readPublishDerivedFile(root, theme, taskId, platform.platformId)
    if (content === undefined) throw new Error(`publish task ${taskId} has no derived draft for ${platform.platformId} yet`)
    return {
      platformId: platform.platformId,
      accountAlias: platform.accountAlias,
      contentFile: platform.contentFile,
      tags: platform.tags,
      coverPrompt: platform.coverPrompt,
      scheduledAt: task.scheduledAt,
    }
  }))
  return {
    taskId: task.taskId,
    theme,
    title: task.title,
    manuscriptFile: task.manuscriptFile,
    topicId: task.topicId,
    personaDigest: task.personaDigest,
    mode: task.mode,
    scheduledAt: task.scheduledAt,
    platforms,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Remove one task's derived-draft directory. Task deletion keeps drafts by
 * contract; this face exists for the explicit purge path and is a no-op when
 * nothing is on disk.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param taskId - the task's UUID.
 */
export async function purgePublishDerivedDir(root: string, theme: string, taskId: string): Promise<void> {
  if (!isTaskId(taskId)) throw new Error(`invalid publish task id: ${JSON.stringify(taskId)}`)
  await rm(join(resolveAssetsDir(root, theme), PUBLISH_DIRNAME, taskId), { recursive: true, force: true })
}
