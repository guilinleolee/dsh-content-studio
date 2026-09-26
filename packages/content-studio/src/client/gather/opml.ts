/**
 * OPML import preview and export for the gather source list, built on
 * feedsmith's OPML grammar. Import returns a preview (folder grouping,
 * duplicates against the current list marked, invalid rows flagged) and the
 * caller decides what to write; export warns about private tokens in feed
 * URLs at the UI layer, not here.
 */

import { ParseError, generateOpml, parseOpml } from 'feedsmith'
import type { GatherSource } from './types.ts'

/** One previewed import row. */
export interface OpmlPreviewRow {
  readonly name: string
  readonly url: string
  /** Folder path the outline sat in (outer outline texts), outermost first. */
  readonly folder: readonly string[]
  /** Same URL already exists in the current source list; import skips it. */
  readonly duplicate: boolean
  /** Outline carried no usable xmlUrl; import skips it. */
  readonly invalid: boolean
}

/** Flatten OPML outlines into rows, keeping folder grouping. */
function flattenOutlines(outlines: ReadonlyArray<OpmlOutline>, folder: readonly string[]): OpmlPreviewRow[] {
  const rows: OpmlPreviewRow[] = []
  for (const outline of outlines) {
    if (outline.outlines !== undefined && outline.outlines.length > 0) {
      rows.push(...flattenOutlines(outline.outlines, [...folder, outline.text ?? '']))
      continue
    }
    const url = outline.xmlUrl
    if (url === undefined || url.length === 0) {
      rows.push({ name: outline.text ?? '', url: '', folder, duplicate: false, invalid: true })
      continue
    }
    rows.push({ name: outline.text ?? url, url, folder, duplicate: false, invalid: false })
  }
  return rows
}

/** Loosely typed OPML outline as feedsmith's parser emits it. */
interface OpmlOutline {
  readonly text?: string
  readonly xmlUrl?: string
  readonly outlines?: OpmlOutline[]
}

/**
 * Build the import preview for one OPML document.
 * @param raw - exact OPML text.
 * @param sources - the current source list, for duplicate marking.
 * @returns the preview rows (never empty-input throws), or the parse problem.
 */
export function previewOpmlImport(raw: string, sources: readonly GatherSource[]): { rows?: OpmlPreviewRow[]; problem?: string } {
  let parsed: ReturnType<typeof parseOpml>
  try {
    parsed = parseOpml(raw)
  } catch (error) {
    if (error instanceof ParseError) return { problem: error.message }
    throw error
  }
  const knownUrls = new Set(sources.map(source => source.url))
  const rows = flattenOutlines(parsed.body?.outlines ?? [], []).map(row => ({
    ...row,
    duplicate: !row.invalid && knownUrls.has(row.url),
  }))
  return { rows }
}

/**
 * Generate one OPML document from the source list; the first tag becomes the
 * folder an entry sits in, untagged sources stay at the top level.
 * @param sources - the sources to export.
 * @returns the OPML text.
 */
export function exportSourcesAsOpml(sources: readonly GatherSource[]): string {
  const byFolder = new Map<string, GatherSource[]>()
  for (const source of sources) {
    const folder = source.tags[0] ?? ''
    const bucket = byFolder.get(folder) ?? []
    bucket.push(source)
    byFolder.set(folder, bucket)
  }
  const folders = [...byFolder.entries()]
    .filter(([folder]) => folder.length > 0)
    .map(([folder, bucket]) => ({
      text: folder,
      outlines: bucket.map(source => ({ text: source.name, type: 'rss', xmlUrl: source.url })),
    }))
  const flat = (byFolder.get('') ?? []).map(source => ({ text: source.name, type: 'rss', xmlUrl: source.url }))
  return generateOpml({ head: { title: '内容创作 · 信息收集' }, body: { outlines: [...folders, ...flat] } })
}
