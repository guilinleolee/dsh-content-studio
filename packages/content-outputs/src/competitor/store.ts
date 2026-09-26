/**
 * On-disk store for the competitor write face: the `_competitors.json`
 * manifest under `outputs/<theme>/assets/`. Path guards and the atomic,
 * Windows-retry commit are shared with the gather write face; this module
 * owns only the manifest schema — parse with per-entry problems instead of a
 * wholesale failure, validate incoming writes loudly, and commit under the
 * same per-file lock. Works carry user markers (`hot`/`favorite`) and
 * append-only metric snapshots, so the store never trims or reorders them:
 * what the caller sends is what lands, after validation.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  CompetitorManifest, CompetitorManifestRead, CompetitorMetricSnapshot, CompetitorPlatform,
  CompetitorReport, CompetitorWork, CompetitorWorkAnalysis,
} from '../types.ts'
import { resolveAssetsDir, writeAtomicallyLocked } from '../gather/store.ts'

/** Manifest file name inside the theme's `assets/` directory. */
export const COMPETITOR_MANIFEST_FILENAME = '_competitors.json'

const PLATFORMS: readonly CompetitorPlatform[] = ['xhs', 'douyin', 'wechat', 'bili', 'zhihu', 'toutiao']

/** Whether one value is a string array (every member a non-empty string after trim). */
function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

/** Whether one value is a metric snapshot with non-negative numbers. */
function isMetricSnapshot(value: unknown): value is CompetitorMetricSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const nonNegative = (candidate: unknown): candidate is number =>
    typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0
  return typeof record.t === 'string' && record.t.length > 0
    && nonNegative(record.likes) && nonNegative(record.comments) && nonNegative(record.shares)
    && (record.views === undefined || nonNegative(record.views))
}

/** Whether one value is a persisted analysis block (`pending`/`running` never persist). */
function isAnalysis(value: unknown): value is CompetitorWorkAnalysis {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (record.status !== 'none' && record.status !== 'done' && record.status !== 'failed') return false
  if (record.error !== undefined && typeof record.error !== 'string') return false
  if (record.ref !== undefined && typeof record.ref !== 'string') return false
  if (record.result === undefined) return record.status !== 'done'
  if (typeof record.result !== 'object' || record.result === null) return false
  const result = record.result as Record<string, unknown>
  return typeof result.hookType === 'string' && result.hookType.length > 0
    && typeof result.structure === 'string' && result.structure.length > 0
    && isStringArray(result.painPoints) && isStringArray(result.topics)
    && isStringArray(result.risks) && isStringArray(result.reusable)
    && isStringArray(result.migrationTopics)
    && typeof result.commentInsight === 'string' && result.commentInsight.length > 0
}

/** Structural validation for one work entry; unknown or mistyped fields reject the entry. */
function isWork(value: unknown): value is CompetitorWork {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && record.id.length > 0
    && typeof record.accountId === 'string' && record.accountId.length > 0
    && typeof record.accountName === 'string' && record.accountName.length > 0
    && PLATFORMS.includes(record.platform as CompetitorPlatform)
    && typeof record.platformWorkId === 'string' && record.platformWorkId.length > 0
    && typeof record.title === 'string' && record.title.length > 0
    && (record.url === undefined || typeof record.url === 'string')
    && (record.publishedAt === undefined || typeof record.publishedAt === 'string')
    && typeof record.importedAt === 'string' && record.importedAt.length > 0
    && (record.textFile === undefined || typeof record.textFile === 'string')
    && Array.isArray(record.metrics) && record.metrics.every(isMetricSnapshot)
    && typeof record.hot === 'boolean' && typeof record.favorite === 'boolean'
    && record.via === 'manual'
    && (record.gatheredRef === undefined || typeof record.gatheredRef === 'string')
    && isAnalysis(record.analysis)
}

/** Structural validation for one report entry. */
function isReport(value: unknown): value is CompetitorReport {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && record.id.length > 0
    && (record.kind === 'account' || record.kind === 'compare')
    && isStringArray(record.accountIds) && record.accountIds.length > 0
    && isStringArray(record.accountNames) && record.accountNames.length > 0
    && typeof record.ref === 'string' && record.ref.length > 0
    && typeof record.createdAt === 'string' && record.createdAt.length > 0
    && typeof record.workCount === 'number' && Number.isFinite(record.workCount) && record.workCount >= 0
}

/**
 * Parse and validate one manifest document. One malformed entry never hides
 * the rest: it is named in `problems` and dropped, like the outputs scanner
 * treats bad metadata.
 * @param raw - exact file contents.
 * @returns the manifest with only valid entries, plus every dropped one named.
 */
export function parseCompetitorManifest(raw: string): CompetitorManifestRead {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { manifest: emptyManifest(), problems: ['competitor manifest is not valid JSON'] }
  }
  const record = parsed as Record<string, unknown>
  if (record.formatVersion !== 0) {
    return { manifest: emptyManifest(), problems: [`unsupported competitor manifest formatVersion ${String(record.formatVersion)}`] }
  }
  const syncedAt: Record<string, string> = {}
  const problems: string[] = []
  if (record.syncedAt !== undefined) {
    if (typeof record.syncedAt !== 'object' || record.syncedAt === null) {
      problems.push('competitor manifest syncedAt is not an object')
    } else {
      for (const [accountId, instant] of Object.entries(record.syncedAt)) {
        if (typeof instant === 'string' && instant.length > 0) syncedAt[accountId] = instant
        else problems.push(`dropped one invalid competitor syncedAt entry: ${JSON.stringify(accountId).slice(0, 80)}`)
      }
    }
  }
  const works: CompetitorWork[] = []
  if (record.works !== undefined) {
    if (!Array.isArray(record.works)) problems.push('competitor manifest works is not an array')
    else {
      for (const entry of record.works) {
        if (isWork(entry)) works.push(entry)
        else problems.push(`dropped one invalid competitor work: ${JSON.stringify(entry).slice(0, 120)}`)
      }
    }
  }
  const reports: CompetitorReport[] = []
  if (record.reports !== undefined) {
    if (!Array.isArray(record.reports)) problems.push('competitor manifest reports is not an array')
    else {
      for (const entry of record.reports) {
        if (isReport(entry)) reports.push(entry)
        else problems.push(`dropped one invalid competitor report: ${JSON.stringify(entry).slice(0, 120)}`)
      }
    }
  }
  return { manifest: { formatVersion: 0, syncedAt, works, reports }, problems }
}

/** The empty manifest every absent or unreadable manifest reads as. */
export function emptyManifest(): CompetitorManifest {
  return { formatVersion: 0, syncedAt: {}, works: [], reports: [] }
}

/**
 * Validate one incoming manifest wholesale; used by the write path to reject
 * rather than repair caller mistakes.
 * @param manifest - the manifest the caller wants stored.
 * @throws when the envelope or any entry violates the format.
 */
export function assertCompetitorManifest(manifest: CompetitorManifest): void {
  // The read path feeds parsed-unknown JSON through this assert cast to the
  // typed shape, so the envelope gates are load-bearing.
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (manifest.formatVersion !== 0) throw new Error(`unsupported competitor manifest formatVersion ${String(manifest.formatVersion)}`)
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (typeof manifest.syncedAt !== 'object' || manifest.syncedAt === null) throw new Error('competitor manifest syncedAt is not an object')
  if (!Array.isArray(manifest.works)) throw new Error('competitor manifest works is not an array')
  if (!Array.isArray(manifest.reports)) throw new Error('competitor manifest reports is not an array')
  for (const work of manifest.works) {
    if (!isWork(work)) throw new Error(`invalid competitor work: ${JSON.stringify(work).slice(0, 120)}`)
  }
  for (const report of manifest.reports) {
    if (!isReport(report)) throw new Error(`invalid competitor report: ${JSON.stringify(report).slice(0, 120)}`)
  }
}

/**
 * Read the theme's competitor manifest.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the manifest with only valid entries, plus every dropped one named.
 * @throws when the theme name is not a plain project-directory name.
 */
export async function readCompetitorManifestFile(root: string, theme: string): Promise<CompetitorManifestRead> {
  const file = join(resolveAssetsDir(root, theme), COMPETITOR_MANIFEST_FILENAME)
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch {
    return { manifest: emptyManifest(), problems: [] }
  }
  return parseCompetitorManifest(raw)
}

/**
 * Replace the theme's competitor manifest under a lock with an atomic
 * commit. No retention trimming runs here: works carry user markers and
 * append-only snapshots, so the caller's list is stored verbatim.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param manifest - the complete next manifest.
 */
export async function writeCompetitorManifestFile(root: string, theme: string, manifest: CompetitorManifest): Promise<void> {
  assertCompetitorManifest(manifest)
  const file = join(resolveAssetsDir(root, theme), COMPETITOR_MANIFEST_FILENAME)
  await writeAtomicallyLocked(file, `${JSON.stringify(manifest, null, 2)}\n`)
}
