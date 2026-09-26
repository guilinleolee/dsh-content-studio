/**
 * On-disk store for the gather write face: the `_gather.json` manifest and
 * body-snapshot files under `outputs/<theme>/assets/`. Every path enters
 * through the guards here — a theme is one plain directory name and a file
 * is one plain file name inside that theme's `assets/`, so `..`, absolute
 * paths, theme roots, and separator tricks cannot reach anything else.
 * Manifest replacement is serialized through a file lock and committed with
 * an atomic rename; on Windows a just-closed file can be briefly pinned by
 * antivirus or the search indexer, so renames retry the pinning error codes
 * with backoff. Retention trimming runs before every manifest write: a
 * source keeps its newest `unread`/`read` materials up to the quota, while
 * `favorite` and `picked` markers and their snapshots are never removed.
 */

import { lstat, mkdir, readdir, readFile, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { writeFileAtomic, withFileLock } from '@deepseek-ai/dsh-atomic-write'
import type { GatherAssetMove, GatherAssetWrite, GatherManifest, GatherMaterial, GatherMaterialStatus } from '../types.ts'
import { sanitizeGatherHtml } from './sanitize.ts'

/** Manifest file name inside the theme's `assets/` directory. */
export const GATHER_MANIFEST_FILENAME = '_gather.json'

/** Per-source retention quota for `unread`/`read` materials in one theme. */
export const GATHER_QUOTA_PER_SOURCE = 50

/** Sanitized body snapshots are truncated to this many characters. */
export const GATHER_MAX_BODY_CHARS = 100_000

/** Hard per-file size cap for any asset write, truncation aside. */
export const GATHER_MAX_ASSET_CHARS = 2_000_000

const MATERIAL_STATUSES: readonly GatherMaterialStatus[] = ['unread', 'read', 'favorite', 'picked']

/** Themes are project directories: one plain name, never system-prefixed. */
function isThemeName(theme: string): boolean {
  return theme.length > 0
    && !theme.includes('/') && !theme.includes('\\')
    && theme !== '.' && theme !== '..'
    && !theme.startsWith('.') && !theme.startsWith('_')
    && !/[\u0000-\u001f]/.test(theme)
}

/** Asset files are one plain file name inside `assets/`, never a path. */
function isAssetFileName(file: string): boolean {
  return file.length > 0
    && !file.includes('/') && !file.includes('\\')
    && file !== '.' && file !== '..'
    && !file.startsWith('.')
    && !/[\u0000-\u001f]/.test(file)
}

/**
 * Resolve and guard one theme's assets directory.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the absolute `assets/` path.
 * @throws when the theme name is not a plain project-directory name.
 */
export function resolveAssetsDir(root: string, theme: string): string {
  if (!isThemeName(theme)) throw new Error(`invalid gather theme name: ${JSON.stringify(theme)}`)
  return join(root, theme, 'assets')
}

/**
 * Resolve and guard one asset file path.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - plain file name inside the theme's `assets/`.
 * @returns the absolute file path.
 * @throws when the theme or file name could escape the assets directory.
 */
export function resolveAssetPath(root: string, theme: string, file: string): string {
  if (!isAssetFileName(file)) throw new Error(`invalid gather asset file name: ${JSON.stringify(file)}`)
  return join(resolveAssetsDir(root, theme), file)
}

/** Structural validation for one manifest entry; unknown or mistyped fields reject the entry. */
function isMaterial(value: unknown): value is GatherMaterial {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && record.id.length > 0
    && typeof record.sourceId === 'string' && record.sourceId.length > 0
    && typeof record.sourceName === 'string' && record.sourceName.length > 0
    && typeof record.title === 'string' && record.title.length > 0
    && typeof record.url === 'string'
    && (record.publishedAt === undefined || typeof record.publishedAt === 'string')
    && typeof record.gatheredAt === 'string'
    && MATERIAL_STATUSES.includes(record.status as GatherMaterialStatus)
    && (record.summary === undefined || typeof record.summary === 'string')
    && (record.points === undefined || (Array.isArray(record.points) && record.points.every(point => typeof point === 'string')))
    && (record.score === undefined || typeof record.score === 'number')
    && (record.tags === undefined || (Array.isArray(record.tags) && record.tags.every(tag => typeof tag === 'string')))
    && (record.excerpts === undefined || (Array.isArray(record.excerpts) && record.excerpts.every(excerpt => typeof excerpt === 'string')))
    && (record.bodyFile === undefined || (typeof record.bodyFile === 'string' && isAssetFileName(record.bodyFile)))
    && (record.rawGuid === undefined || typeof record.rawGuid === 'string')
}

/**
 * Parse and validate one manifest document. One malformed entry never hides
 * the rest: it is named in `problems` and dropped, like the outputs scanner
 * treats bad metadata.
 * @param raw - exact file contents.
 * @returns the manifest with only valid entries, plus every dropped one named.
 */
export function parseGatherManifest(raw: string): { manifest: GatherManifest; problems: string[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { manifest: { formatVersion: 0, materials: [] }, problems: ['gather manifest is not valid JSON'] }
  }
  const record = parsed as Record<string, unknown>
  if (record.formatVersion !== 0) {
    return { manifest: { formatVersion: 0, materials: [] }, problems: [`unsupported gather manifest formatVersion ${String(record.formatVersion)}`] }
  }
  if (!Array.isArray(record.materials)) {
    return { manifest: { formatVersion: 0, materials: [] }, problems: ['gather manifest has no materials array'] }
  }
  const materials: GatherMaterial[] = []
  const problems: string[] = []
  for (const entry of record.materials) {
    if (isMaterial(entry)) materials.push(entry)
    else problems.push(`dropped one invalid gather material: ${JSON.stringify(entry).slice(0, 120)}`)
  }
  return { manifest: { formatVersion: 0, materials }, problems }
}

/**
 * Validate one incoming manifest wholesale; used by the write path to reject
 * rather than repair caller mistakes.
 * @param manifest - the manifest the caller wants stored.
 * @throws when the envelope or any entry violates the format.
 */
export function assertGatherManifest(manifest: GatherManifest): void {
  // The envelope shape (formatVersion, materials array) is owned by the
  // generated Remote schema; per-entry runtime shapes are what remains here.
  for (const entry of manifest.materials) {
    if (!isMaterial(entry)) throw new Error(`invalid gather material: ${JSON.stringify(entry).slice(0, 120)}`)
  }
}

/** Whether one material is exempt from retention trimming. */
function isRetentionExempt(material: GatherMaterial, exemptFiles: ReadonlySet<string>): boolean {
  return material.status === 'favorite' || material.status === 'picked'
    || (material.bodyFile !== undefined && exemptFiles.has(material.bodyFile))
}

/** Newest-first comparison for retention selection; ties stay in place (stable sort). */
function compareRetention(a: GatherMaterial, b: GatherMaterial): number {
  if (a.gatheredAt !== b.gatheredAt) return a.gatheredAt < b.gatheredAt ? 1 : -1
  return 0
}

/**
 * Apply the retention quota: per source, keep `unread`/`read` materials up
 * to {@link GATHER_QUOTA_PER_SOURCE} (newest first); `favorite`/`picked`
 * entries and the files the create workbench references always survive.
 * Returns the kept entries and the dropped ones — dropping is only decided
 * here, snapshot deletion stays with the caller after the trimmed manifest
 * is durably committed.
 * @param materials - the manifest's current entries.
 * @param exemptFiles - asset file names exempt from trimming (the create
 *   workbench's referenced snapshots).
 * @returns the trimmed list plus every entry the quota dropped.
 */
export function applyRetentionQuota(
  materials: readonly GatherMaterial[],
  exemptFiles: ReadonlySet<string> = new Set(),
): { kept: GatherMaterial[]; dropped: GatherMaterial[] } {
  const keep = new Array<boolean>(materials.length).fill(true)
  const order = materials.map((material, index) => ({ material, index }))
  order.sort((a, b) => compareRetention(a.material, b.material))
  const perSource = new Map<string, number>()
  const dropped: GatherMaterial[] = []
  for (const { material, index } of order) {
    if (isRetentionExempt(material, exemptFiles)) continue
    const count = perSource.get(material.sourceId) ?? 0
    if (count >= GATHER_QUOTA_PER_SOURCE) {
      keep[index] = false
      dropped.push(material)
      continue
    }
    perSource.set(material.sourceId, count + 1)
  }
  return { kept: materials.filter((_, index) => keep[index]), dropped }
}

/** Whether an error is the Windows rename-pinning trio (antivirus, indexer, open handle). */
function isWindowsRenamePin(error: unknown): boolean {
  if (process.platform !== 'win32') return false
  const code = (error as NodeJS.ErrnoException | null)?.code
  return code === 'EPERM' || code === 'EACCES' || code === 'EBUSY'
}

/** Retry cadence for pinned renames: 100 ms doubling, five tries, per the gather write-face policy. */
const RENAME_RETRY_BASE_MS = 100
const RENAME_RETRY_MAX_TRIES = 5

/**
 * Rename with retry for the Windows pinning window: antivirus and the search
 * indexer hold a transient handle on just-closed files, which surfaces as
 * EPERM/EACCES/EBUSY on rename and passes on a later attempt.
 * @param from - source path.
 * @param to - destination path.
 */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      if (attempt >= RENAME_RETRY_MAX_TRIES || !isWindowsRenamePin(error)) throw error
      await new Promise(resolve => setTimeout(resolve, RENAME_RETRY_BASE_MS * 2 ** attempt))
    }
  }
}

/**
 * Replace one file atomically, serialized against other writers of the same
 * path. The parent directory is created before the lock is taken — the lock
 * file lives beside the target, so a first write into a fresh theme needs
 * the directory to exist first. A pinned commit rename (the Windows pinning
 * window) retries the whole replacement: the temp is cleaned on failure and
 * the old file stays intact, so a retry is always safe. Shared with the
 * competitor write face.
 * @param file - absolute destination path.
 * @param content - complete next file content.
 */
export async function writeAtomicallyLocked(file: string, content: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  await withFileLock(file, async () => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await writeFileAtomic(file, content, { mode: 0o600, dirMode: 0o700 })
        return
      } catch (error) {
        if (attempt >= RENAME_RETRY_MAX_TRIES || !isWindowsRenamePin(error)) throw error
        await new Promise(resolve => setTimeout(resolve, RENAME_RETRY_BASE_MS * 2 ** attempt))
      }
    }
  })
}

/**
 * Write one asset file. `*.html` content is sanitized through the allowlist
 * first and truncated to the body cap; other text files pass through with
 * only the hard size cap applied.
 * @param root - absolute outputs library root.
 * @param write - theme, file name, and content.
 * @returns whether the stored snapshot was truncated.
 */
export async function writeAssetFile(root: string, write: GatherAssetWrite): Promise<{ truncated: boolean }> {
  const target = resolveAssetPath(root, write.theme, write.file)
  let content = write.content
  if (write.file.endsWith('.html')) {
    const sanitized = sanitizeGatherHtml(content)
    if (sanitized.length > GATHER_MAX_BODY_CHARS) {
      // Cut at the last closed tag boundary so the snapshot stays well-formed.
      const cut = sanitized.slice(0, GATHER_MAX_BODY_CHARS)
      const closed = cut.lastIndexOf('>')
      content = closed > 0 ? cut.slice(0, closed + 1) : cut
      await writeAtomicallyLocked(target, content)
      return { truncated: true }
    }
    content = sanitized
    await writeAtomicallyLocked(target, content)
    return { truncated: false }
  }
  if (content.length > GATHER_MAX_ASSET_CHARS) throw new Error(`gather asset ${write.file} exceeds the ${GATHER_MAX_ASSET_CHARS}-character cap`)
  await writeAtomicallyLocked(target, content)
  return { truncated: false }
}

/**
 * Read one asset file as text, capped. Serves the gather view's detail pane
 * (the browser has no other way to display a stored snapshot) and the AI
 * face's snapshot input; `*.html` snapshots were already sanitized when they
 * were written.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - plain file name inside `assets/`.
 * @returns the file content, or undefined when absent.
 * @throws when the file exceeds the read cap.
 */
export async function readAssetText(root: string, theme: string, file: string): Promise<string | undefined> {
  try {
    return await readFile(resolveAssetPath(root, theme, file), 'utf8')
  } catch {
    return undefined
  }
}

/** Hard cap for one detail-pane snapshot read; snapshots are written under this size. */
export const GATHER_MAX_ASSET_READ_CHARS = GATHER_MAX_ASSET_CHARS

/**
 * Read one asset file for the Remote read face, rejecting oversized files
 * instead of streaming them to the browser.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - plain file name inside `assets/`.
 * @returns the file content, or undefined when absent.
 */
export async function readGatherAssetFile(root: string, theme: string, file: string): Promise<string | undefined> {
  const text = await readAssetText(root, theme, file)
  if (text !== undefined && text.length > GATHER_MAX_ASSET_READ_CHARS) {
    throw new Error(`gather asset ${file} exceeds the ${GATHER_MAX_ASSET_READ_CHARS}-character read cap`)
  }
  return text
}

/**
 * Rename or relocate one file between two themes' `assets/` directories.
 * The destination theme's `assets/` directory is created when absent, so a
 * material can move into a theme that has not stored assets before.
 * @param root - absolute outputs library root.
 * @param move - source theme/name and destination theme/name.
 * @throws when the source is missing or the destination already exists.
 */
export async function moveAssetFile(root: string, move: GatherAssetMove): Promise<void> {
  const from = resolveAssetPath(root, move.fromTheme, move.from)
  const to = resolveAssetPath(root, move.toTheme, move.to)
  // The lock file lives beside the destination, so the destination assets
  // directory must exist before the lock is taken.
  await mkdir(resolveAssetsDir(root, move.toTheme), { recursive: true })
  await withFileLock(to, async () => {
    let destinationExists = false
    try {
      await lstat(to)
      destinationExists = true
    } catch {
      // Absent destination: the expected case.
    }
    if (destinationExists) throw new Error(`gather asset ${move.to} already exists in ${move.toTheme}`)
    await renameWithRetry(from, to)
  })
}

/**
 * Delete one asset file; deleting an absent file is a no-op.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param file - plain file name inside `assets/`.
 */
export async function deleteAssetFile(root: string, theme: string, file: string): Promise<void> {
  await rm(resolveAssetPath(root, theme, file), { force: true })
}

/**
 * Read the theme's gather manifest.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @returns the manifest with only valid entries, plus every dropped one named.
 */
export async function readGatherManifestFile(root: string, theme: string): Promise<{ manifest: GatherManifest; problems: string[] }> {
  const file = join(resolveAssetsDir(root, theme), GATHER_MANIFEST_FILENAME)
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch {
    return { manifest: { formatVersion: 0, materials: [] }, problems: [] }
  }
  return parseGatherManifest(raw)
}

/**
 * Replace the theme's gather manifest under a lock with an atomic commit.
 * The stored manifest is quota-trimmed first; snapshots of trimmed entries
 * are deleted only after the trimmed manifest is durably on disk, so a crash
 * can leave an untracked file but never a tracked-but-missing one.
 * @param root - absolute outputs library root.
 * @param theme - outputs-project directory name.
 * @param manifest - the complete next manifest.
 * @param exemptFiles - asset file names exempt from trimming (the create
 *   workbench's referenced snapshots; the gateway collects them per write).
 * @returns the stored (trimmed) manifest.
 */
export async function writeGatherManifestFile(
  root: string,
  theme: string,
  manifest: GatherManifest,
  exemptFiles: ReadonlySet<string> = new Set(),
): Promise<GatherManifest> {
  assertGatherManifest(manifest)
  const assetsDir = resolveAssetsDir(root, theme)
  const { kept, dropped } = applyRetentionQuota(manifest.materials, exemptFiles)
  const stored: GatherManifest = { formatVersion: 0, materials: kept }
  await writeAtomicallyLocked(join(assetsDir, GATHER_MANIFEST_FILENAME), `${JSON.stringify(stored, null, 2)}\n`)
  for (const material of dropped) {
    if (material.bodyFile !== undefined) await rm(join(assetsDir, material.bodyFile), { force: true })
  }
  return stored
}

/**
 * Delete orphaned atomic-write temp files (`<name>.<hex>.tmp`) left behind by
 * a crashed gateway process, across every theme's assets directory. Best
 * effort: a sweep failure must never block startup, because the temp files
 * are inert.
 * @param root - absolute outputs library root.
 */
export async function sweepOrphanTempFiles(root: string): Promise<void> {
  let themes: string[]
  try {
    themes = (await readdir(root, { withFileTypes: true }))
      .filter(entry => entry.isDirectory() && isThemeName(entry.name))
      .map(entry => entry.name)
  } catch {
    // No library root yet: nothing to sweep.
    return
  }
  for (const theme of themes) {
    const assetsDir = join(root, theme, 'assets')
    let entries: string[]
    try {
      entries = await readdir(assetsDir)
    } catch {
      continue
    }
    for (const name of entries) {
      if (!/^.+\.[0-9a-f]{6}\.tmp$/.test(name)) continue
      await rm(join(assetsDir, name), { force: true }).catch(() => undefined)
    }
  }
}
