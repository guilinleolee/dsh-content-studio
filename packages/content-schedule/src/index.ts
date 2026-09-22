/** Publication calendar Remote for the content-creation library. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { join } from 'node:path'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type { ContentScheduleSnapshot, ScheduleItem, ScheduleItemInput } from './types.ts'
import { SCHEDULE_FILENAME, mutateSchedule, normalizeInput, readSchedule } from './store.ts'

export type * from './types.ts'
export { SCHEDULE_FILENAME, normalizeInput, readSchedule, mutateSchedule } from './store.ts'

/** Content-schedule Remote configuration. */
export interface Config {
  /** Outputs library root. Defaults to `<dsh home>/outputs`. */
  root?: string
}

export const Config: Schema<Config> = z.object({
  root: z.string(),
})

/**
 * Remote calendar service over `_schedule.json` at the library root. Every
 * method reads or commits the file directly — the calendar is small, and the
 * file stays the single truth the agent can also read.
 */
export class ContentScheduleGateway extends TypertRemoteService {
  static inject = []

  static Config: Schema<Config> = Config

  /** Absolute calendar file path. */
  private readonly file: string

  constructor(ctx: Context, config: Config) {
    super(ctx, 'contentSchedule')
    this.file = join(resolveDshHome(config.root), 'outputs', SCHEDULE_FILENAME)
  }

  /**
   * Read the whole calendar.
   * @returns items sorted by date, with every bad stored record named.
   */
  @Remote('list')
  async list(): Promise<ContentScheduleSnapshot> {
    return readSchedule(this.file)
  }

  /**
   * Upsert one item: an absent `id` (or an unknown one) creates; a known one
   * replaces in place. Identity is decided by id alone — no title/date
   * matching.
   * @param input - the upsert payload.
   * @returns the post-write calendar snapshot.
   */
  @Remote('put')
  async put(input: ScheduleItemInput): Promise<ContentScheduleSnapshot> {
    const { item, detail } = normalizeInput(input)
    if (item === undefined) throw new Error(`invalid schedule item: ${detail ?? 'unknown reason'}`)
    return mutateSchedule(this.file, (items) => {
      const index = items.findIndex(candidate => candidate.id === item.id)
      if (index === -1) return [...items, item]
      const next = [...items]
      next[index] = item
      return next
    })
  }

  /**
   * Delete one item by id; deleting an unknown id is a no-op, not an error.
   * @param id - the item's stable identity.
   * @returns the post-write calendar snapshot.
   */
  @Remote('delete')
  async delete(id: ScheduleItem['id']): Promise<ContentScheduleSnapshot> {
    return mutateSchedule(this.file, items => items.filter(candidate => candidate.id !== id))
  }
}

export default ContentScheduleGateway
