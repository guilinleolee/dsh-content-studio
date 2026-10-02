/**
 * On-disk store for the review face: the `_review.json` sidecar manifest and
 * the report/template files under `outputs/<theme>/assets/review/`, plus the
 * global `_review-index.json` aggregation aid. `.dsh-output.json` is never
 * touched. Paths enter through the same plain-name guards as the other faces;
 * manifest and index writes commit through the shared atomic-rename lock. A
 * malformed manifest reads back with its bad entries dropped and named;
 * writes reject wholesale — the caller fixes its list, the store never
 * repairs it.
 */

import { mkdir, readdir, readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveAssetsDir, writeAtomicallyLocked } from '../gather/store.ts'
import type {
  MetricSnapshot, ReviewBaselines, ReviewIndexDoc, ReviewIndexRead, ReviewIndexRow,
  ReviewImportCommitRequest, ReviewImportCommitResult, ReviewManifest, ReviewManifestRead,
  ReviewStatus, ReviewTask,
} from '../types.ts'
import { DEFAULT_BASELINES, REVIEW_PLATFORMS, REVIEW_STATUSES } from './types.ts'

/** Sidecar manifest file name inside the theme's `assets/` directory. */
export const REVIEW_MANIFEST_FILENAME = '_review.json'

/** Global index file name at the outputs library root (underscore = invisible to the scanner). */
export const REVIEW_INDEX_FILENAME = '_review-index.json'

/** Directory under `assets/` holding the reports and saved templates. */
export const REVIEW_DIRNAME = 'review'

/** Directory under `assets/review/` holding the generated and edited reports. */
export const REVIEW_REPORTS_DIRNAME = 'reports'

/** Directory under `assets/review/` holding saved viral-work templates. */
export const REVIEW_TEMPLATES_DIRNAME = 'templates'

/** Hard snapshot count per theme; the oldest same-work snapshots evict first past it. */
export const REVIEW_MAX_SNAPSHOTS = 20_000

/** Hard report size cap. */
export const REVIEW_MAX_REPORT_CHARS = 400_000

/** Whether the value is one well-typed platform id. */
function isPlatformId(value: unknown): value is (typeof REVIEW_PLATFORMS)[number] {
  return typeof value === 'string' && (REVIEW_PLATFORMS as readonly string[]).includes(value)
}

/** Whether the value is one well-typed review status. */
function isStatus(value: unknown): value is ReviewStatus {
  return typeof value === 'string' && (REVIEW_STATUSES as readonly string[]).includes(value)
}

/** Whether the value is one number or null — the missing-metric reading. */
function isMetricValue(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

/** Whether the value carries one well-typed metrics record. */
function isMetrics(value: unknown): value is MetricSnapshot['metrics'] {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return Object.values(record).every(isMetricValue)
}

/** Whether the value is one content form or null. */
function isContentType(value: unknown): value is MetricSnapshot['contentType'] {
  return value === null || value === 'image-text' || value === 'video'
}

/** Whether the value is one binding method or null. */
function isMatchMethod(value: unknown): value is MetricSnapshot['matchMethod'] {
  return value === null || value === 'url' || value === 'title' || value === 'manual'
}

/** Whether one stored snapshot has every field present and well-typed. */
function isSnapshot(value: unknown): value is MetricSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.snapshotId === 'string' && record.snapshotId.length > 0
    && isPlatformId(record.platformId)
    && typeof record.platformWorkId === 'string' && record.platformWorkId.length > 0
    && typeof record.title === 'string' && record.title.length > 0
    && (record.publishedAt === null || typeof record.publishedAt === 'string')
    && typeof record.capturedAt === 'string' && record.capturedAt.length > 0
    && (record.contentId === null || typeof record.contentId === 'string')
    && isMatchMethod(record.matchMethod)
    && isContentType(record.contentType)
    && isMetrics(record.metrics)
}

/** Whether one stored task has every field present and well-typed. */
function isTask(value: unknown): value is ReviewTask {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const period = record.period as Record<string, unknown> | undefined
  const filters = record.filters as Record<string, unknown> | undefined
  // The period/filters shape checks are load-bearing on this parse path:
  // the values arrived as parsed-unknown JSON, so the literal guards carry
  // the type.
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  const periodOk = typeof period === 'object' && period !== null
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  const filtersOk = typeof filters === 'object' && filters !== null
  return typeof record.taskId === 'string' && record.taskId.length > 0
    && typeof record.name === 'string' && record.name.length > 0
    && periodOk
    && typeof period.from === 'string' && typeof period.to === 'string'
    && filtersOk
    && Array.isArray(filters.platforms) && filters.platforms.every(isPlatformId)
    && Array.isArray(filters.contentTypes) && filters.contentTypes.every(isContentType)
    && (filters.workFilter === 'all' || filters.workFilter === 'viral' || filters.workFilter === 'weak' || filters.workFilter === 'longtail')
    && isStatus(record.status)
    && (record.reportFile === null || (typeof record.reportFile === 'string' && record.reportFile.length > 0))
    && typeof record.degraded === 'boolean'
    && typeof record.createdAt === 'string' && record.createdAt.length > 0
}

/** Whether one stored baselines record is well-typed with finite ratios. */
function isBaselines(value: unknown): value is ReviewBaselines {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (record.source === 'user' || record.source === 'default')
    && typeof record.engagementRate === 'number' && Number.isFinite(record.engagementRate) && record.engagementRate >= 0
    && typeof record.collectRate === 'number' && Number.isFinite(record.collectRate) && record.collectRate >= 0
    && typeof record.updatedAt === 'string'
}

/**
 * Parse and validate one review manifest. One malformed snapshot or task
 * never hides the rest: it is named in `problems` and dropped; an unreadable
 * envelope reads as an empty manifest with the rejection named.
 * @param raw - exact file contents.
 * @returns the manifest with only valid entries, plus every dropped one named.
 */
export function parseReviewManifest(raw: string): { manifest: ReviewManifest; problems: string[] } {
  const empty: ReviewManifest = {
    formatVersion: 0, baselines: { ...DEFAULT_BASELINES, updatedAt: '' }, snapshots: [], tasks: [],
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { manifest: empty, problems: ['review manifest is not valid JSON'] }
  }
  const record = parsed as Record<string, unknown>
  if (record.formatVersion !== 0) {
    return { manifest: empty, problems: [`unsupported review manifest formatVersion ${String(record.formatVersion)}`] }
  }
  const problems: string[] = []
  const snapshots: MetricSnapshot[] = []
  if (Array.isArray(record.snapshots)) {
    for (const entry of record.snapshots) {
      if (isSnapshot(entry)) snapshots.push(entry)
      else problems.push(`dropped one invalid review snapshot: ${JSON.stringify(entry).slice(0, 120)}`)
    }
  } else {
    problems.push('review manifest has no snapshots array')
  }
  const tasks: ReviewTask[] = []
  if (Array.isArray(record.tasks)) {
    for (const entry of record.tasks) {
      if (isTask(entry)) tasks.push(entry)
      else problems.push(`dropped one invalid review task: ${JSON.stringify(entry).slice(0, 120)}`)
    }
  } else {
    problems.push('review manifest has no tasks array')
  }
  const baselines = isBaselines(record.baselines) ? record.baselines : { ...DEFAULT_BASELINES, updatedAt: '' }
  return { manifest: { formatVersion: 0, baselines, snapshots, tasks }, problems }
}

/**
 * Validate one incoming manifest wholesale; used by the write path to reject
 * rather than repair caller mistakes.
 * @param manifest - the manifest the caller wants stored.
 * @throws when the envelope, baselines, or any entry violates the format.
 */
export function assertReviewManifest(manifest: ReviewManifest): void {
  // The read path feeds parsed-unknown JSON through this assert cast to the
  // typed shape, so the envelope version gate is load-bearing.
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (manifest.formatVersion !== 0) throw new Error(`unsupported review manifest formatVersion ${String(manifest.formatVersion)}`)
  if (!isBaselines(manifest.baselines)) throw new Error('review manifest baselines are malformed')
  for (const snapshot of manifest.snapshots) {
    if (!isSnapshot(snapshot)) throw new Error(`invalid review snapshot: ${JSON.stringify(snapshot).slice(0, 120)}`)
  }
  for (const task of manifest.tasks) {
    if (!isTask(task)) throw new Error(`invalid review task: ${JSON.stringify(task).slice(0, 120)}`)
  }
}

/** Absolute path of the theme's `_review.json`. */
function manifestPath(root: string, theme: string): string {
  return join(resolveAssetsDir(root, theme), REVIEW_MANIFEST_FILENAME)
}

/**
 * Read the theme's `_review.json`.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the manifest (null when absent) with only valid entries, every
 *   dropped one named in `problems`; callers must not write back while
 *   `problems` is non-empty.
 */
export async function readReviewManifestFile(root: string, theme: string): Promise<ReviewManifestRead> {
  let raw: string
  try {
    raw = await readFile(manifestPath(root, theme), 'utf8')
  } catch {
    return { manifest: null, problems: [] }
  }
  const { manifest, problems } = parseReviewManifest(raw)
  return { manifest, problems }
}

/**
 * Replace the theme's `_review.json` with an atomic, locked commit, and
 * refresh the theme's rows in the global `_review-index.json` under the same
 * commit sequence. Snapshot appends and task retries ride full-manifest
 * writes: the caller sends the complete next manifest.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param manifest - the complete next manifest.
 */
export async function writeReviewManifestFile(root: string, theme: string, manifest: ReviewManifest): Promise<void> {
  assertReviewManifest(manifest)
  if (manifest.snapshots.length > REVIEW_MAX_SNAPSHOTS) {
    throw new Error(`review manifest exceeds the ${REVIEW_MAX_SNAPSHOTS}-snapshot cap`)
  }
  await writeAtomicallyLocked(manifestPath(root, theme), `${JSON.stringify(manifest, null, 2)}\n`)
  // Index refresh after the manifest commit: the index is a projection, so a
  // failed refresh leaves a stale row that the next write or a scan rebuild
  // repairs — never a lost task.
  const { doc } = await readReviewIndexFile(root)
  const rows: ReviewIndexRow[] = [
    ...(doc?.rows ?? []).filter(row => row.theme !== theme),
    ...manifest.tasks.map(task => ({
      taskId: task.taskId,
      theme,
      name: task.name,
      period: task.period,
      platforms: task.filters.platforms,
      status: task.status,
      updatedAt: new Date().toISOString(),
    })),
  ]
  await writeReviewIndexFile(root, { formatVersion: 0, rows })
}

/**
 * Read the global `_review-index.json`. A malformed file reads as empty with
 * the rejection named — the next manifest write rebuilds the theme's rows,
 * and the history list falls back to scanning.
 * @param root - absolute outputs library root.
 * @returns the index plus the parse problems.
 */
export async function readReviewIndexFile(root: string): Promise<ReviewIndexRead> {
  const file = join(root, REVIEW_INDEX_FILENAME)
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch {
    return { doc: null, problems: [] }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return { doc: null, problems: [`review index is not valid JSON: ${error instanceof Error ? error.message : String(error)}`] }
  }
  const record = parsed as Record<string, unknown>
  if (record.formatVersion !== 0 || !Array.isArray(record.rows)) {
    return { doc: null, problems: ['unknown review index format; rows rebuild on the next write'] }
  }
  const rows: ReviewIndexRow[] = []
  const problems: string[] = []
  record.rows.forEach((entry, position) => {
    const candidate = entry as Record<string, unknown>
    const period = candidate.period as Record<string, unknown> | undefined
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- parsed-unknown JSON; the literal guard carries the type
    const periodOk = typeof period === 'object' && period !== null
    if (typeof candidate.taskId === 'string' && typeof candidate.theme === 'string'
      && typeof candidate.name === 'string'
      && periodOk
      && typeof period.from === 'string' && typeof period.to === 'string'
      && Array.isArray(candidate.platforms) && candidate.platforms.every(isPlatformId)
      && isStatus(candidate.status)
      && typeof candidate.updatedAt === 'string') {
      rows.push({
        taskId: candidate.taskId,
        theme: candidate.theme,
        name: candidate.name,
        period: { from: period.from, to: period.to },
        platforms: candidate.platforms,
        status: candidate.status,
        updatedAt: candidate.updatedAt,
      })
    } else {
      problems.push(`review index row #${position} is malformed and was dropped`)
    }
  })
  return { doc: { formatVersion: 0, rows }, problems }
}

/** Write the global index document (projection only — no validation round-trip). */
async function writeReviewIndexFile(root: string, doc: ReviewIndexDoc): Promise<void> {
  await writeAtomicallyLocked(join(root, REVIEW_INDEX_FILENAME), `${JSON.stringify(doc, null, 2)}\n`)
}

/** The UTC day bucket of one instant: the same-day overwrite key of the commit face. */
function utcDayKey(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * Commit confirmed import rows as snapshots: append new works, overwrite the
 * same UTC day's snapshot of a known work (idempotent re-import), and keep
 * every historical day (long-tail detection depends on the history).
 * @param root - absolute outputs library root.
 * @param request - the theme, platform, and the confirmed rows.
 * @returns the append and overwrite accounting.
 */
export async function commitReviewImportFile(root: string, request: ReviewImportCommitRequest): Promise<ReviewImportCommitResult> {
  const { manifest, problems } = await readReviewManifestFile(root, request.theme)
  if (problems.length > 0) throw new Error(`review manifest unreadable: ${problems[0]}`)
  const today = new Date().toISOString()
  const current = manifest ?? {
    formatVersion: 0,
    baselines: { ...DEFAULT_BASELINES, updatedAt: '' },
    snapshots: [],
    tasks: [],
  }
  let added = 0
  let overwritten = 0
  const snapshots = [...current.snapshots]
  for (const row of request.rows) {
    const capturedAt = today
    const existingIndex = snapshots.findIndex(snapshot =>
      snapshot.platformId === request.platformId
      && snapshot.platformWorkId === row.platformWorkId
      && utcDayKey(snapshot.capturedAt) === utcDayKey(capturedAt))
    const snapshot: MetricSnapshot = {
      snapshotId: crypto.randomUUID(),
      platformId: request.platformId,
      platformWorkId: row.platformWorkId,
      title: row.title,
      publishedAt: row.publishedAt,
      capturedAt,
      contentId: null,
      matchMethod: null,
      contentType: row.contentType,
      metrics: row.metrics,
    }
    if (existingIndex === -1) {
      snapshots.push(snapshot)
      added += 1
    } else {
      snapshots[existingIndex] = snapshot
      overwritten += 1
    }
  }
  await writeReviewManifestFile(root, request.theme, { ...current, snapshots })
  return { added, overwritten }
}

/**
 * Replace the theme's whole manifest — the binding, baseline, and task faces
 * all ride this one write after the caller has patched its copy.
 * Alias of {@link writeReviewManifestFile} kept for face naming symmetry.
 */
export const putReviewManifestFile = writeReviewManifestFile

/**
 * Remove one review task and delete its report file. Snapshots and bindings
 * survive: other tasks and the dashboard reuse them.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param taskId - the task to remove; an unknown id rejects so a stale UI
 *   cannot silently no-op.
 */
export async function deleteReviewTaskFile(root: string, theme: string, taskId: string): Promise<void> {
  const { manifest, problems } = await readReviewManifestFile(root, theme)
  if (manifest === null) throw new Error(`review manifest unreadable: ${problems[0] ?? 'absent'}`)
  const task = manifest.tasks.find(candidate => candidate.taskId === taskId)
  if (task === undefined) throw new Error(`unknown review task: ${taskId}`)
  const tasks = manifest.tasks.filter(candidate => candidate.taskId !== taskId)
  await writeReviewManifestFile(root, theme, { ...manifest, tasks })
  if (task.reportFile !== null) {
    await unlink(resolveStoredReportPath(root, theme, task.reportFile)).catch(() => undefined)
  }
}

/** Whether one plain file name is safe to place under `assets/review/`. */
function isPlainFileName(file: string): boolean {
  return file.length > 0
    && !file.includes('/') && !file.includes('\\')
    && file !== '.' && file !== '..'
    && !file.startsWith('.')
    && !/[\u0000-\u001f]/.test(file)
}

/** Guarded absolute path of one file under `assets/review/<subdir>/`. */
function resolveReviewFilePath(root: string, theme: string, subdir: string, file: string): string {
  if (!isPlainFileName(file)) {
    throw new Error(`invalid review file name: ${JSON.stringify(file)}`)
  }
  return join(resolveAssetsDir(root, theme), REVIEW_DIRNAME, subdir, file)
}

/** Guarded absolute path of one stored report reference (`reports/<name>.md`). */
function resolveStoredReportPath(root: string, theme: string, reference: string): string {
  const prefix = `${REVIEW_REPORTS_DIRNAME}/`
  if (!reference.startsWith(prefix)) throw new Error(`invalid review report reference: ${JSON.stringify(reference)}`)
  return resolveReviewFilePath(root, theme, REVIEW_REPORTS_DIRNAME, reference.slice(prefix.length))
}

/**
 * Write one report file under `assets/review/reports/`. The caller owns the
 * name (`report-<taskId>-<ts>.md`) so every save is a new file — the
 * generated original is never overwritten.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - plain report file name.
 * @param content - the complete report markdown.
 * @returns the stored reference, relative to `assets/review/`.
 */
export async function writeReviewReportFile(root: string, theme: string, file: string, content: string): Promise<{ file: string }> {
  if (content.length > REVIEW_MAX_REPORT_CHARS) {
    throw new Error(`review report exceeds the ${REVIEW_MAX_REPORT_CHARS}-character cap`)
  }
  await mkdir(join(resolveAssetsDir(root, theme), REVIEW_DIRNAME, REVIEW_REPORTS_DIRNAME), { recursive: true })
  await writeAtomicallyLocked(resolveReviewFilePath(root, theme, REVIEW_REPORTS_DIRNAME, file), content)
  return { file: `${REVIEW_REPORTS_DIRNAME}/${file}` }
}

/**
 * Read one report file back from its stored reference.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param reference - the stored report reference, relative to `assets/review/`.
 * @returns the markdown, or an empty record when the file does not exist.
 */
export async function readReviewReportFile(root: string, theme: string, reference: string): Promise<{ content?: string }> {
  // The reference guard throws (a caller bug), while a missing file reads as
  // empty — only I/O failures are tolerated here.
  const path = resolveStoredReportPath(root, theme, reference)
  try {
    const content = await readFile(path, 'utf8')
    return { content }
  } catch {
    return {}
  }
}

/**
 * Save one viral-work template under `assets/review/templates/`.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - plain template file name.
 * @param content - the template markdown.
 * @returns the stored reference, relative to `assets/review/`.
 */
export async function writeReviewTemplateFile(root: string, theme: string, file: string, content: string): Promise<{ file: string }> {
  if (content.length > REVIEW_MAX_REPORT_CHARS) {
    throw new Error(`review template exceeds the ${REVIEW_MAX_REPORT_CHARS}-character cap`)
  }
  await mkdir(join(resolveAssetsDir(root, theme), REVIEW_DIRNAME, REVIEW_TEMPLATES_DIRNAME), { recursive: true })
  await writeAtomicallyLocked(resolveReviewFilePath(root, theme, REVIEW_TEMPLATES_DIRNAME, file), content)
  return { file: `${REVIEW_TEMPLATES_DIRNAME}/${file}` }
}

/**
 * List saved template file names under `assets/review/templates/`.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the sorted plain file names.
 */
export async function listReviewTemplatesFile(root: string, theme: string): Promise<readonly string[]> {
  const dir = join(resolveAssetsDir(root, theme), REVIEW_DIRNAME, REVIEW_TEMPLATES_DIRNAME)
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  return names.filter(name => isTemplateFileName(name)).sort()
}

/** Whether one templates-directory entry is a plain markdown file name. */
function isTemplateFileName(name: string): boolean {
  return name.endsWith('.md') && !name.startsWith('.') && !name.includes('/') && !name.includes('\\')
}

/**
 * Read one saved template's content.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - plain template file name.
 * @returns the markdown, or an empty record when the file does not exist.
 */
export async function readReviewTemplateFile(root: string, theme: string, file: string): Promise<{ content?: string }> {
  try {
    const content = await readFile(resolveReviewFilePath(root, theme, REVIEW_TEMPLATES_DIRNAME, file), 'utf8')
    return { content }
  } catch {
    return {}
  }
}
