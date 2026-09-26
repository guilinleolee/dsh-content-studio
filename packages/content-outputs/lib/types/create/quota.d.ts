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
/** Counter file name at the outputs library root. */
export declare const CREATE_QUOTA_FILENAME = "_create-quota.json";
/** Deployment policy of the gate; every default lives in {@link CreateQuotaGate}. */
export interface CreateQuotaConfig {
    /** Free generations served per local day (0–1000; default 10). */
    readonly freeDailyGenerates?: number;
    /** Free rewrites served per local day (0–5000; default 50). */
    readonly freeDailyRewrites?: number;
    /** Whether the paid-tier features (batch of 3, AI evaluation) are enabled. */
    readonly paidTierEnabled?: boolean;
}
/** Validated policy after default resolution. */
export interface ResolvedQuotaConfig {
    readonly freeDailyGenerates: number;
    readonly freeDailyRewrites: number;
    readonly paidTierEnabled: boolean;
}
/** Stored counter state for one local day. */
export interface CreateQuotaState {
    /** Local day key the counters belong to (`YYYY-MM-DD`). */
    readonly date: string;
    readonly generates: number;
    readonly rewrites: number;
}
/** The gate's own failure: quota and paid-tier rejections the UI presents verbatim. */
export declare class CreateQuotaError extends Error {
    /** Stable machine code: `QUOTA_EXCEEDED` or `PAID_TIER_DISABLED`. */
    readonly code: 'QUOTA_EXCEEDED' | 'PAID_TIER_DISABLED';
    constructor(code: 'QUOTA_EXCEEDED' | 'PAID_TIER_DISABLED', message: string);
}
/**
 * Resolve the declared quota policy into its validated form.
 * @param config - the declared policy; every field optional.
 * @returns the validated policy, fail loud on out-of-range values.
 */
export declare function resolveQuotaConfig(config: CreateQuotaConfig): ResolvedQuotaConfig;
/** Today's local day key (`YYYY-MM-DD` in the gateway's timezone). */
export declare function localDayKey(now: Date): string;
/**
 * Whether the stored state is usable for `today`: same day key with sane
 * counters. Anything else (absent, malformed, stale) resets to zero.
 * @param raw - the parsed file value, or null when absent.
 * @param today - today's day key.
 * @returns the counters to build on.
 */
export declare function normalizeQuotaState(raw: unknown, today: string): CreateQuotaState;
/**
 * The freemium gate owned by the content-outputs gateway; not itself a
 * cordis service. Every consume call reads the counter file under the lock,
 * checks the budget, and commits the incremented state atomically.
 */
export declare class CreateQuotaGate {
    private readonly root;
    /** Validated policy, defaults resolved once at construction. */
    private readonly resolved;
    /**
     * @param root - absolute outputs library root (the counter file lives there).
     * @param config - declared quota policy; defaults resolve here, fail loud.
     */
    constructor(root: string, config: CreateQuotaConfig);
    /** Whether the paid-tier features are switched on for this deployment. */
    get paidTierEnabled(): boolean;
    /**
     * Charge `units` generations against today's free budget. The paid tier is
     * unmetered by design: the batch size and evaluation are gated by
     * {@link requirePaidFeature} instead.
     * @param units - how many generations the call consumes (1, or 3 for a batch).
     */
    consumeGenerate(units: number): Promise<void>;
    /**
     * Charge one rewrite against today's free budget. The paid tier is
     * unmetered by design.
     */
    consumeRewrite(): Promise<void>;
    /**
     * Require the paid-tier switch for the batch and evaluation features.
     * @param feature - the feature name the error names.
     */
    requirePaidFeature(feature: 'batch' | 'evaluation'): Promise<void>;
    /** Shared check-and-increment under the file lock, committed atomically. */
    private consume;
}
//# sourceMappingURL=quota.d.ts.map