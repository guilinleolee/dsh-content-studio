/**
 * Pure client-side rules of the gather view: draft filtering, manifest
 * merging, retention trimming, and failure backoff. Refreshes merge by the
 * composite (sourceId, id) key and never touch an existing entry, so read /
 * favorite / picked state and AI results survive every collection run;
 * `favorite` and `picked` entries are exempt from the retention quota. The
 * gateway re-applies the same quota at the storage layer, so both sides
 * agree even if a second writer touches the manifest.
 */

import type { GatherItemDraft, GatherMaterial } from './types.ts'

/** Per-source retention quota for `unread`/`read` materials in one theme. */
export const GATHER_QUOTA_PER_SOURCE = 50

/** Body snapshots larger than this many characters are written truncated. */
export const GATHER_BODY_CHAR_LIMIT = 100_000

/** Failure backoff sequence: doubling hours capped at 24h. */
const BACKOFF_BASE_MS = 60 * 60 * 1000
const BACKOFF_MAX_MS = 24 * 60 * 60 * 1000

/** Whether one material is exempt from retention trimming. */
export function isRetentionExempt(material: GatherMaterial): boolean {
  return material.status === 'favorite' || material.status === 'picked'
}

/** Newest-first comparison for retention selection; ties stay in place (stable sort). */
function compareRetention(a: GatherMaterial, b: GatherMaterial): number {
  if (a.gatheredAt !== b.gatheredAt) return a.gatheredAt < b.gatheredAt ? 1 : -1
  return 0
}

/**
 * Apply the retention quota: per source, keep `unread`/`read` materials up
 * to {@link GATHER_QUOTA_PER_SOURCE} (newest first); `favorite`/`picked`
 * entries always survive. Selection is newest-first, but the kept list
 * preserves the manifest's original order — trimming never reshuffles it.
 * @param materials - the manifest's current entries.
 * @returns the trimmed list plus every entry the quota dropped (the caller
 * deletes their body snapshots after the manifest write commits).
 */
export function applyQuota(materials: readonly GatherMaterial[]): { kept: GatherMaterial[]; dropped: GatherMaterial[] } {
  const keep = new Array<boolean>(materials.length).fill(true)
  const order = materials.map((material, index) => ({ material, index }))
  order.sort(compareRetentionEntry)
  const perSource = new Map<string, number>()
  const dropped: GatherMaterial[] = []
  for (const { material, index } of order) {
    if (isRetentionExempt(material)) continue
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

/** Newest-first entry pair with the original index carried for stability. */
function compareRetentionEntry(a: { material: GatherMaterial; index: number }, b: { material: GatherMaterial; index: number }): number {
  return compareRetention(a.material, b.material)
}

/** All keyword filters that apply to one draft: the source's and the task's. */
export interface GatherKeywordFilters {
  readonly sourceExcludeKeywords: readonly string[]
  readonly includeKeywords: readonly string[]
  readonly excludeKeywords: readonly string[]
}

/** Whether one draft passes the keyword filters (case-insensitive substring match on title + summary). */
export function passesKeywordFilters(draft: GatherItemDraft, filters: GatherKeywordFilters): boolean {
  const haystack = `${draft.title ?? ''}\n${draft.summary ?? ''}`.toLowerCase()
  const matches = (word: string): boolean => haystack.includes(word.toLowerCase())
  if (filters.sourceExcludeKeywords.some(matches)) return false
  if (filters.excludeKeywords.some(matches)) return false
  if (filters.includeKeywords.length > 0 && !filters.includeKeywords.some(matches)) return false
  return true
}

/**
 * Filter one feed run's drafts for one task: keyword filters, the `since`
 * cursor (publication instant strictly after it), and the per-run cap
 * (newest first). Deduplication against the manifest happens at merge time.
 * @param drafts - the feed's item drafts.
 * @param filters - keyword filters in effect.
 * @param since - task publication cursor, or null.
 * @param maxItems - per-run cap.
 * @returns the drafts that may enter the manifest, newest first.
 */
export function filterDrafts(
  drafts: readonly GatherItemDraft[],
  filters: GatherKeywordFilters,
  since: string | null,
  maxItems: number,
): GatherItemDraft[] {
  const eligible = drafts.filter((draft) => {
    if (!passesKeywordFilters(draft, filters)) return false
    if (since !== null && draft.publishedAt !== null && draft.publishedAt <= since) return false
    return true
  })
  // Newest first for the per-run cap; ties keep the feed's own order (stable).
  eligible.sort((a, b) => {
    if (a.publishedAt === b.publishedAt) return 0
    if (a.publishedAt === null) return 1
    if (b.publishedAt === null) return -1
    return a.publishedAt < b.publishedAt ? 1 : -1
  })
  return eligible.slice(0, maxItems)
}

/** Options for one merge: nothing here mutates existing entries. */
export interface MergeOptions {
  /** Collection instant stamped on new entries (ISO 8601). */
  readonly now: string
}

/**
 * Merge one source's drafts into the manifest materials. Existing entries
 * win over drafts for their whole lifetime of the run: user state, AI
 * results, excerpts, and snapshot references are never overwritten.
 * @param materials - current manifest entries.
 * @param sourceId - collecting source's id.
 * @param sourceName - collecting source's display name.
 * @param drafts - the (already filtered) drafts of this run.
 * @param options - merge options.
 * @returns the merged list, new entries appended, plus the drafts that were new.
 */
export function mergeDrafts(
  materials: readonly GatherMaterial[],
  sourceId: string,
  sourceName: string,
  drafts: readonly GatherItemDraft[],
  options: MergeOptions,
): { merged: GatherMaterial[]; added: GatherMaterial[] } {
  const existing = new Set(materials.map(material => `${material.sourceId}\u0000${material.id}`))
  const added: GatherMaterial[] = []
  for (const draft of drafts) {
    const key = `${sourceId}\u0000${draft.id}`
    if (existing.has(key)) continue
    existing.add(key)
    added.push({
      // The wire erased the brand; the id is the gateway's dedup key verbatim.
      id: draft.id as GatherMaterial['id'],
      sourceId,
      sourceName,
      title: draft.title ?? draft.url,
      url: draft.url,
      // Absent feed fields stay absent (exactOptionalPropertyTypes).
      ...(draft.publishedAt !== null ? { publishedAt: draft.publishedAt } : {}),
      gatheredAt: options.now,
      status: 'unread',
      ...(draft.summary !== null ? { summary: draft.summary } : {}),
      ...(draft.rawGuid !== null ? { rawGuid: draft.rawGuid } : {}),
    })
  }
  return { merged: [...materials, ...added], added }
}

/**
 * Failure backoff for one source: 1h doubled per consecutive failure, capped
 * at 24h. The first failure pushes the next attempt one hour out.
 * @param consecutiveFailures - consecutive failed attempts so far.
 * @returns the backoff delay in milliseconds (0 when nothing has failed).
 */
export function failureBackoffMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return 0
  return Math.min(BACKOFF_BASE_MS * 2 ** (consecutiveFailures - 1), BACKOFF_MAX_MS)
}

/**
 * Earliest instant the source may be collected again: the later of its own
 * interval and its failure backoff, measured from the last attempt.
 * @param source - the source.
 * @param now - current instant (ISO 8601).
 * @returns true when the source is due for a run.
 */
export function isSourceDue(
  source: { intervalMinutes: number; lastFetchedAt: string | null; consecutiveFailures: number },
  now: string,
): boolean {
  if (source.lastFetchedAt === null) return true
  const elapsedMs = Date.parse(now) - Date.parse(source.lastFetchedAt)
  const backoffMs = failureBackoffMs(source.consecutiveFailures)
  const intervalMs = Math.max(source.intervalMinutes, 30) * 60 * 1000
  return elapsedMs >= Math.max(intervalMs, backoffMs)
}

/** Snapshot file name for one material's body. */
export function bodyFileName(materialId: string): string {
  return `body-${materialId}.html`
}
