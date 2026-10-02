/**
 * Feed fetching and parsing for the gather write face. One document is
 * fetched per call with conditional-request cursors (ETag / Last-Modified),
 * parsed through feedsmith (RSS 2.0, Atom, RDF, JSON Feed in one grammar),
 * and normalized into item drafts with stable deduplication keys. Network
 * reading only: nothing here touches the filesystem, and the HTTP fetch
 * happens exclusively inside this gateway-side module — the browser never
 * reaches cross-origin feeds itself.
 */
import type { AnyFeed } from 'feedsmith';
import type { GatherFeedRequest, GatherFeedResult, GatherItemDraft, GatherMaterialId } from '../types.ts';
/** Single-feed request deadline; a slow source must not pin the gateway. */
export declare const GATHER_FETCH_TIMEOUT_MS = 30000;
/** Hard response-size cap; a runaway feed is rejected instead of buffered. */
export declare const GATHER_MAX_FEED_BYTES: number;
/** Injection face for tests: the fetch implementation defaults to the global one. */
export interface GatherFetchDeps {
    readonly fetchImpl?: typeof fetch;
}
/** The fetch failure carries the HTTP status for caller-facing messages. */
export declare class GatherFeedHttpError extends Error {
    /** HTTP status of the failed response. */
    readonly status: number;
    constructor(status: number, url: string);
}
/**
 * Normalize one item link for deduplication and storage: tracking query
 * parameters (utm_* and friends) are dropped and the query string is sorted,
 * so ref-tagged reposts of one article collapse onto one key.
 * @param url - raw link as the feed carried it.
 * @returns the normalized absolute URL.
 */
export declare function normalizeDedupUrl(url: string): string;
/**
 * Compute one draft's deduplication key: the feed guid when present, else
 * the SHA-1 of the normalized link. The guid is kept beside the key so a
 * later strategy change can recompute without refetching.
 * @param rawGuid - feed guid when the item carries one.
 * @param link - item link (already normalized by the caller when reused).
 * @returns the branded deduplication key.
 */
export declare function dedupKey(rawGuid: string | undefined, link: string): GatherMaterialId;
/**
 * Normalize one parsed feed document (any supported format) into drafts.
 * @param parsed - the feedsmith-parsed document (RSS or Atom).
 * @returns the feed title plus one draft per entry that has a link.
 */
export declare function normalizeParsedFeed(parsed: AnyFeed): {
    feedTitle: string | null;
    items: GatherItemDraft[];
};
/**
 * Fetch and parse one feed document.
 * @param request - feed URL plus the source's stored conditional-request cursors.
 * @param deps - injected fetch implementation for tests.
 * @param signal - caller cancellation; combined with the per-request deadline.
 * @returns the drafts plus the cursors to store for the next run; a 304
 * result carries no items and `notModified: true`.
 */
export declare function fetchFeedDocument(request: GatherFeedRequest, deps?: GatherFetchDeps, signal?: AbortSignal): Promise<GatherFeedResult>;
//# sourceMappingURL=feed.d.ts.map