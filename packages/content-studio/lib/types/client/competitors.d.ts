/**
 * Browser-side configuration and pure logic for the competitors view: the
 * benchmark-account registry (localStorage), dedup/upsert semantics, the
 * account-relative heat ranking, report digests, and the catch-up check.
 * No React, no IO beyond the one localStorage namespace — everything here is
 * unit-testable, and the manifest itself lives on disk behind the gateway.
 */
import type { TopicItemInput } from '@deepseek-ai/dsh-content-topics/types';
import type { CompetitorHeatLevel, CompetitorManifest, CompetitorMetricSnapshot, CompetitorPlatform, CompetitorWork } from '@deepseek-ai/dsh-content-outputs/types';
/** localStorage namespace owned by the competitors view. */
export declare const COMPETITORS_STORAGE_KEY = "dsh-content-studio.competitors.accounts";
/** Browser-side benchmark account. Never written to disk by this phase. */
export interface CompetitorAccount {
    /** Stable id (`acc-` prefixed). */
    id: string;
    name: string;
    platform: CompetitorPlatform;
    /** Account homepage URL, when known. */
    homepageUrl: string;
    /** Niche tags (赛道标签). */
    topics: readonly string[];
    priority: 'high' | 'medium' | 'low';
    note: string;
    /** Account positioning (定位). */
    positioning: string;
    /** Follower tier (粉丝量级) as free text. */
    followerTier: string;
    /** Monetization path (变现方式) as free text. */
    monetization: string;
    /** Collection cadence in days; a hint for the catch-up check, not a scheduler. */
    intervalDays: 1 | 3 | 7;
    /** Disabled accounts drop out of the catch-up banner. */
    enabled: boolean;
    /** Creation instant (ISO 8601). */
    createdAt: string;
}
/** Heat verdict for one work inside its account's distribution. */
export interface CompetitorHeat {
    readonly level: CompetitorHeatLevel;
    readonly score: number;
}
/** Platforms the phase-one manual import supports. */
export declare const COMPETITOR_PLATFORMS: readonly CompetitorPlatform[];
/**
 * Build a stable prefixed id. `crypto.randomUUID` when available, else a
 * best-effort fallback (the id only needs uniqueness within one browser).
 * @param prefix - id prefix (`acc-`, `cw-`, `cr-`, `idea-`).
 * @returns the new id.
 */
export declare function newId(prefix: string): string;
/**
 * Load the account registry from localStorage.
 * @returns the valid accounts plus whether the save surface is degraded
 *   (private mode / quota), which the UI surfaces as a warning.
 */
export declare function loadAccounts(): {
    accounts: readonly CompetitorAccount[];
    degraded: boolean;
};
/**
 * Persist the account registry.
 * @param accounts - the complete next registry.
 * @returns whether the write succeeded; a failure degrades to memory-only.
 */
export declare function saveAccounts(accounts: readonly CompetitorAccount[]): boolean;
/**
 * Import an account JSON payload (the export file's content), skipping
 * entries that duplicate an existing or in-batch name+platform pair.
 * @param json - the imported file content.
 * @param existing - the current registry.
 * @returns the merged registry plus the added and skipped counts.
 */
export declare function importAccounts(json: string, existing: readonly CompetitorAccount[]): {
    accounts: readonly CompetitorAccount[];
    added: number;
    skipped: number;
};
/**
 * Export the registry as the import/export JSON payload.
 * @param accounts - the accounts to serialize.
 * @returns the pretty-printed JSON payload with a trailing newline, the exact format `importAccounts` accepts.
 */
export declare function exportAccounts(accounts: readonly CompetitorAccount[]): string;
/**
 * One work's interaction score: likes + 2×comments + 3×shares, with views
 * counted at 1/100 as a reach tiebreaker. Weights favor conversation over
 * applause, per the competitor-plan scoring rule.
 * @param metrics - the work's snapshots, oldest first.
 * @returns the score of the newest snapshot, or 0 without snapshots.
 */
export declare function interactionScore(metrics: readonly CompetitorMetricSnapshot[]): number;
/**
 * Rank one account's works by account-relative heat: the interaction score
 * of the newest snapshot, compared against the account's own recent
 * distribution (≥P90 hot, ≥P50 normal, else cold). Fewer than four works
 * cannot rank, so they all read normal — cross-account absolute values are
 * never compared.
 * @param works - the account's works (any order).
 * @returns heat per work id for the ranked window; works outside the window
 *   read cold once the account has enough sample.
 */
export declare function heatByWork(works: readonly CompetitorWork[]): ReadonlyMap<string, CompetitorHeat>;
/**
 * Upsert one manually imported work into the manifest. The dedup key is
 * `platform + accountId + platformWorkId`; an existing work keeps its id,
 * markers, analysis, and text file, and gains the new metrics snapshot.
 * A missing platform id falls back to the normalized title so re-importing
 * the same piece still dedupes.
 * @param manifest - the current manifest.
 * @param draft - the imported work's fields (id-less); omitted optional
 *   fields keep the stored values on update.
 * @returns the next manifest and whether this was an update of an existing work.
 */
export declare function upsertWork(manifest: CompetitorManifest, draft: Omit<CompetitorWork, 'id' | 'importedAt' | 'metrics' | 'hot' | 'favorite' | 'via' | 'analysis'> & {
    metrics: CompetitorMetricSnapshot;
}): {
    manifest: CompetitorManifest;
    updated: boolean;
};
/**
 * Whether one account is due for collection: enabled, and its interval has
 * elapsed since the last recorded collection (or it never recorded one).
 * @param account - the account to check.
 * @param manifest - the theme manifest carrying `syncedAt`.
 * @param now - reference instant.
 * @returns true when the catch-up banner should name this account.
 */
export declare function isAccountStale(account: CompetitorAccount, manifest: CompetitorManifest, now: Date): boolean;
/**
 * Aggregate one account's works into the report digest: structured facts
 * only, capped so a report prompt stays inside the token budget. Raw work
 * text never enters a digest.
 * @param accountName - display name of the account.
 * @param platform - platform id.
 * @param works - the account's works.
 * @returns the digest text (≤1000 characters).
 */
export declare function aggregateAccountDigest(accountName: string, platform: CompetitorPlatform, works: readonly CompetitorWork[]): string;
/**
 * Render the topic-idea asset file for the 收录为选题 action: structured
 * YAML header (title, source, platform, description, differentiation,
 * source reference) so a later information-gathering index can pick it up.
 * @param work - the work the idea derives from.
 * @param idea - the AI-suggested differentiated topic text, when analyzed.
 * @returns the markdown file content.
 */
/**
 * Build the topic-bank upsert for one benchmark work: a `benchmark`-source
 * idea whose `refId` anchors the work id and whose snapshot keeps the title
 * and the first differentiated topic suggestion readable if the work or its
 * teardown later goes away. Idempotency lives with the caller, which checks
 * the bank for the same `refId` before putting.
 * @param work - the benchmark work being collected.
 * @param capturedAt - the capture instant, ISO 8601.
 * @returns the upsert input for the contentTopics Remote.
 */
export declare function competitorWorkToTopicInput(work: CompetitorWork, capturedAt: string): TopicItemInput;
/**
 * Build the topic-idea markdown file the competitor view saves for one work.
 * @param work - the source competitor work the idea came from.
 * @param idea - the differentiated-angle suggestion; falls back to the work title when absent.
 * @returns the markdown document with a `kind: topic-idea` front matter and source-attribution footer.
 */
export declare function buildIdeaMarkdown(work: CompetitorWork, idea: string | undefined): string;
//# sourceMappingURL=competitors.d.ts.map