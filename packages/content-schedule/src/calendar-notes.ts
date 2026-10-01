/**
 * Calendar-notes store: reads and writes the day-note sidecar
 * `_calendar.json` at the library root, next to `_schedule.json`. Notes are
 * the calendar view's only owned data — every schedule fact lives on the
 * `_schedule.json` item itself, and a note merely annotates one item by its
 * stable id. A note whose item is gone is inert: readers ignore unknown ids
 * and the next write to that id replaces or clears the entry.
 */

import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import type { CalendarNoteEntry, CalendarNotesSnapshot } from './types.ts'

/** System file name of the notes sidecar at the library root. */
export const CALENDAR_FILENAME = '_calendar.json'

function isEntry(value: unknown): value is CalendarNoteEntry {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.text === 'string' && record.text.length > 0
    && typeof record.updatedAt === 'string' && record.updatedAt.length > 0
}

/**
 * Read the notes file.
 * @param file - absolute `_calendar.json` path; a missing file is empty.
 * @returns the snapshot with valid entries and every bad record named.
 */
export async function readNotes(file: string): Promise<CalendarNotesSnapshot> {
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch {
    return { file, notes: {}, problems: [] }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { file, notes: {}, problems: ['calendar notes file is not valid JSON'] }
  }
  const root = parsed as Record<string, unknown>
  // Same version gate as the schedule file: future on-disk formats never
  // load as current records — one backend, one format.
  if (root.formatVersion !== 0) return { file, notes: {}, problems: [`unsupported calendar-notes formatVersion ${String(root.formatVersion)}`] }
  if (typeof root.notes !== 'object' || root.notes === null || Array.isArray(root.notes)) {
    return { file, notes: {}, problems: ['calendar notes file has no notes object'] }
  }
  const entries: Record<string, CalendarNoteEntry> = {}
  const problems: string[] = []
  for (const [id, entry] of Object.entries(root.notes as Record<string, unknown>)) {
    if (isEntry(entry)) entries[id] = entry
    else problems.push(`dropped one invalid calendar note for ${JSON.stringify(id.slice(0, 40))}`)
  }
  return { file, notes: entries, problems }
}

/**
 * Write one note under a file lock, atomically: a non-empty text upserts the
 * entry, an empty (or whitespace) text clears it.
 * @param file - absolute `_calendar.json` path; parent directories are
 * created when missing (the lock file requires its parent to exist).
 * @param id - the annotated schedule item's stable id.
 * @param text - the note body; empty clears the entry.
 * @returns the post-write notes snapshot.
 */
export async function writeNote(file: string, id: string, text: string): Promise<CalendarNotesSnapshot> {
  return withFileLock(file, async () => {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 })
    const before = await readNotes(file)
    const body = text.trim()
    // Rebuild the map instead of deleting: an empty text clears the entry.
    const notes: Record<string, CalendarNoteEntry> = {}
    for (const [key, entry] of Object.entries(before.notes)) {
      if (body.length === 0 && key === id) continue
      notes[key] = entry
    }
    if (body.length > 0) notes[id] = { text: body, updatedAt: new Date().toISOString() }
    const serialized = `${JSON.stringify({ formatVersion: 0, notes }, null, 2)}\n`
    await writeFileAtomic(file, serialized, { mode: 0o600, dirMode: 0o700 })
    return readNotes(file)
  })
}
