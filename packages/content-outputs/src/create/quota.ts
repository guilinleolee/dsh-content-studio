/**
 * The freemium quota gate of the create face: one daily counter file at the
 * library root (an underscore entry, invisible to the scanner) counts the
 * AI generations and rewrites a deployment serves per local day, and the
 * paid-tier switch gates the batch and evaluation features. Values are
 * deployment configuration, not code constants; the local helper features
 * (banned-word scan, hashtag rules, reading time) never touch this gate.
 * Counters check-and-increment inside the file lock, so two browsers cannot
 * overspend the day; the day flips lazily on first use after midnight.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeFileAtomic, withFileLock } from '@deepseek-ai/dsh-atomic-write'

/** Counter file name at the outputs library root. */
export const CREATE_QUOTA_FILENAME = '_create-quota.json'

/** Deployment policy of the gate; every default lives in {@link CreateQuotaGate}. */
export interface CreateQuotaConfig {
  /** Free generations served per local day (0–1000; default 10). */
  readonly freeDailyGenerates?: number
  /** Free rewrites served per local day (0–5000; default 50). */
  readonly freeDailyRewrites?: number
  /** Whether the paid-tier features (batch of 3, AI evaluation) are enabled. */
  readonly paidTierEnabled?: boolean
}

/** Validated policy after default resolution. */
export interface ResolvedQuotaConfig {
  readonly freeDailyGenerates: number
  readonly freeDailyRewrites: number
  readonly paidTierEnabled: boolean
}

/** Stored counter state for one local day. */
export interface CreateQuotaState {
  /** Local day key the counters belong to (`YYYY-MM-DD`). */
  readonly date: string
  readonly generates: number
  readonly rewrites: number
}

/** The gate's own failure: quota and paid-tier rejections the UI presents verbatim. */
export class CreateQuotaError extends Error {
  /** Stable machine code: `QUOTA_EXCEEDED` or `PAID_TIER_DISABLED`. */
  readonly code: 'QUOTA_EXCEEDED' | 'PAID_TIER_DISABLED'

  constructor(code: 'QUOTA_EXCEEDED' | 'PAID_TIER_DISABLED', message: string) {
    super(message)
    this.code = code
  }
}

/**
 * Resolve the declared quota policy into its validated form.
 * @param config - the declared policy; every field optional.
 * @returns the validated policy, fail loud on out-of-range values.
 */
export function resolveQuotaConfig(config: CreateQuotaConfig): ResolvedQuotaConfig {
  const freeDailyGenerates = config.freeDailyGenerates ?? 10
  const freeDailyRewrites = config.freeDailyRewrites ?? 50
  if (!Number.isInteger(freeDailyGenerates) || freeDailyGenerates < 0 || freeDailyGenerates > 1000) {
    throw new Error('contentOutputs freeDailyGenerates must be an integer from 0 through 1000')
  }
  if (!Number.isInteger(freeDailyRewrites) || freeDailyRewrites < 0 || freeDailyRewrites > 5000) {
    throw new Error('contentOutputs freeDailyRewrites must be an integer from 0 through 5000')
  }
  return { freeDailyGenerates, freeDailyRewrites, paidTierEnabled: config.paidTierEnabled ?? false }
}

/** Today's local day key (`YYYY-MM-DD` in the gateway's timezone). */
export function localDayKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Whether the stored state is usable for `today`: same day key with sane
 * counters. Anything else (absent, malformed, stale) resets to zero.
 * @param raw - the parsed file value, or null when absent.
 * @param today - today's day key.
 * @returns the counters to build on.
 */
export function normalizeQuotaState(raw: unknown, today: string): CreateQuotaState {
  if (typeof raw !== 'object' || raw === null) return { date: today, generates: 0, rewrites: 0 }
  const record = raw as Record<string, unknown>
  if (record.date !== today) return { date: today, generates: 0, rewrites: 0 }
  const count = (value: unknown): number => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0
  return { date: today, generates: count(record.generates), rewrites: count(record.rewrites) }
}

/**
 * The freemium gate owned by the content-outputs gateway; not itself a
 * cordis service. Every consume call reads the counter file under the lock,
 * checks the budget, and commits the incremented state atomically.
 */
export class CreateQuotaGate {
  /** Validated policy, defaults resolved once at construction. */
  private readonly resolved: ResolvedQuotaConfig

  /**
   * @param root - absolute outputs library root (the counter file lives there).
   * @param config - declared quota policy; defaults resolve here, fail loud.
   */
  constructor(private readonly root: string, config: CreateQuotaConfig) {
    this.resolved = resolveQuotaConfig(config)
  }

  /** Whether the paid-tier features are switched on for this deployment. */
  get paidTierEnabled(): boolean {
    return this.resolved.paidTierEnabled
  }

  /**
   * Charge `units` generations against today's free budget. The paid tier is
   * unmetered by design: the batch size and evaluation are gated by
   * {@link requirePaidFeature} instead.
   * @param units - how many generations the call consumes (1, or 3 for a batch).
   */
  async consumeGenerate(units: number): Promise<void> {
    if (this.resolved.paidTierEnabled) return
    await this.consume('generates', this.resolved.freeDailyGenerates, units, 'create quota exceeded: daily generation budget used up')
  }

  /**
   * Charge one rewrite against today's free budget. The paid tier is
   * unmetered by design.
   */
  async consumeRewrite(): Promise<void> {
    if (this.resolved.paidTierEnabled) return
    await this.consume('rewrites', this.resolved.freeDailyRewrites, 1, 'create quota exceeded: daily rewrite budget used up')
  }

  /**
   * Require the paid-tier switch for the batch and evaluation features.
   * @param feature - the feature name the error names.
   */
  requirePaidFeature(feature: 'batch' | 'evaluation'): Promise<void> {
    if (this.resolved.paidTierEnabled) return Promise.resolve()
    return Promise.reject(new CreateQuotaError('PAID_TIER_DISABLED', `create paid tier is not enabled: ${feature}`))
  }

  /** Shared check-and-increment under the file lock, committed atomically. */
  private async consume(counter: 'generates' | 'rewrites', budget: number, units: number, message: string): Promise<void> {
    const file = join(this.root, CREATE_QUOTA_FILENAME)
    await withFileLock(file, async () => {
      const today = localDayKey(new Date())
      let raw: unknown = null
      try {
        raw = JSON.parse(await readFile(file, 'utf8'))
      } catch {
        // Absent or unreadable counter: start the day at zero.
      }
      const state = normalizeQuotaState(raw, today)
      if (state[counter] + units > budget) throw new CreateQuotaError('QUOTA_EXCEEDED', message)
      const next: CreateQuotaState = { ...state, [counter]: state[counter] + units }
      await writeFileAtomic(file, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
    })
  }
}
