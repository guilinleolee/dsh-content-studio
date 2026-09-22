/** Read-only Remote projection of the content-creation outputs library. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { join } from 'node:path'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type { ContentOutputsSnapshot } from './types.ts'
import { scanOutputs } from './scan.ts'

export type * from './types.ts'
export { METADATA_FILENAME, ASSETS_DIRNAME, scanOutputs, scanProject } from './scan.ts'

/** Content-outputs Remote configuration. */
export interface Config {
  /** Outputs library root. Defaults to `<dsh home>/outputs`. */
  root?: string
}

export const Config: Schema<Config> = z.object({
  root: z.string(),
})

/** Remote-only service projecting the outputs library from disk per call. */
export class ContentOutputsGateway extends TypertRemoteService {
  static inject = []

  static Config: Schema<Config> = Config

  /** Absolute library root; a missing directory scans as an empty library. */
  private readonly root: string

  constructor(ctx: Context, config: Config) {
    super(ctx, 'contentOutputs')
    this.root = join(resolveDshHome(config.root), 'outputs')
  }

  /**
   * Read the library root directly on every call: the library is the agent's
   * write surface, so a cache would only add a second truth to synchronize.
   * @returns Current projects in topic order, with every unreadable
   * directory named in `problems`.
   */
  @Remote('list')
  async list(): Promise<ContentOutputsSnapshot> {
    return scanOutputs(this.root)
  }
}

export default ContentOutputsGateway
