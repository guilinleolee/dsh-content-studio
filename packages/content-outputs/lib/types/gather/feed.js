/**
 * Feed fetching and parsing for the gather write face. One document is
 * fetched per call with conditional-request cursors (ETag / Last-Modified),
 * parsed through feedsmith (RSS 2.0, Atom, RDF, JSON Feed in one grammar),
 * and normalized into item drafts with stable deduplication keys. Network
 * reading only: nothing here touches the filesystem, and the HTTP fetch
 * happens exclusively inside this gateway-side module — the browser never
 * reaches cross-origin feeds itself.
 */
import { createHash } from 'node:crypto';
import { DetectError, ParseError, parseFeed } from 'feedsmith';
import normalizeUrl from 'normalize-url';
/** Single-feed request deadline; a slow source must not pin the gateway. */
export const GATHER_FETCH_TIMEOUT_MS = 30_000;
/** Hard response-size cap; a runaway feed is rejected instead of buffered. */
export const GATHER_MAX_FEED_BYTES = 10 * 1024 * 1024;
/** Declared fetcher identity of the gather face. */
const GATHER_USER_AGENT = 'dsh-content-gather/0.1 (dsh content studio gather view)';
/** The fetch failure carries the HTTP status for caller-facing messages. */
export class GatherFeedHttpError extends Error {
    /** HTTP status of the failed response. */
    status;
    constructor(status, url) {
        super(`feed request to ${url} failed with HTTP ${status}`);
        this.name = 'GatherFeedHttpError';
        this.status = status;
    }
}
/**
 * Normalize one item link for deduplication and storage: tracking query
 * parameters (utm_* and friends) are dropped and the query string is sorted,
 * so ref-tagged reposts of one article collapse onto one key.
 * @param url - raw link as the feed carried it.
 * @returns the normalized absolute URL.
 */
export function normalizeDedupUrl(url) {
    return normalizeUrl(url.trim(), { defaultProtocol: 'https' });
}
/**
 * Compute one draft's deduplication key: the feed guid when present, else
 * the SHA-1 of the normalized link. The guid is kept beside the key so a
 * later strategy change can recompute without refetching.
 * @param rawGuid - feed guid when the item carries one.
 * @param link - item link (already normalized by the caller when reused).
 * @returns the branded deduplication key.
 */
export function dedupKey(rawGuid, link) {
    if (rawGuid !== undefined && rawGuid.length > 0)
        return rawGuid;
    return createHash('sha1').update(normalizeDedupUrl(link)).digest('hex');
}
/** Parse one feed date into ISO 8601, or null when absent or unparseable. */
function toIsoDate(value) {
    if (value === undefined || value.trim().length === 0)
        return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
/** Atom titles and links are wrapped; flatten to the plain shapes. */
function atomLink(entry) {
    const links = entry.links ?? [];
    return (links.find(link => link.rel === undefined || link.rel === 'alternate') ?? links[0])?.href;
}
/** Flatten one feedsmith text node (plain string or `{ value }` wrapper). */
function textValue(value) {
    if (value === undefined)
        return null;
    if (typeof value === 'string')
        return value;
    return value.value ?? null;
}
/**
 * Normalize one parsed feed document (any supported format) into drafts.
 * @param parsed - the feedsmith-parsed document (RSS or Atom).
 * @returns the feed title plus one draft per entry that has a link.
 */
export function normalizeParsedFeed(parsed) {
    if (parsed.format === 'rss') {
        const { feed } = parsed;
        return {
            feedTitle: textValue(feed.title),
            items: (feed.items ?? []).map((item) => ({
                id: dedupKey(item.guid?.value, item.link ?? ''),
                rawGuid: item.guid?.value ?? null,
                url: item.link === undefined ? '' : normalizeDedupUrl(item.link),
                title: item.title ?? null,
                publishedAt: toIsoDate(item.pubDate),
                summary: item.description ?? null,
                content: item.content?.encoded ?? null,
            })).filter(draft => draft.url.length > 0),
        };
    }
    if (parsed.format === 'atom') {
        const { feed } = parsed;
        return {
            feedTitle: textValue(feed.title),
            items: (feed.entries ?? []).map((entry) => {
                const link = atomLink(entry);
                return {
                    id: dedupKey(entry.id, link ?? ''),
                    rawGuid: entry.id ?? null,
                    url: link === undefined ? '' : normalizeDedupUrl(link),
                    title: textValue(entry.title),
                    publishedAt: toIsoDate(entry.published ?? entry.updated),
                    summary: textValue(entry.summary),
                    content: entry.content?.value ?? null,
                };
            }).filter(draft => draft.url.length > 0),
        };
    }
    if (parsed.format === 'rdf') {
        const { feed } = parsed;
        return {
            feedTitle: textValue(feed.title),
            items: (feed.items ?? []).map((item) => {
                const link = item.link ?? '';
                return {
                    id: dedupKey(item.rdf?.about ?? item.dc?.identifiers?.[0], link),
                    rawGuid: item.rdf?.about ?? item.dc?.identifiers?.[0] ?? null,
                    url: link.length === 0 ? '' : normalizeDedupUrl(link),
                    title: item.title ?? null,
                    publishedAt: toIsoDate(item.dc?.dates?.[0] ?? item.dcterms?.dates?.[0]),
                    summary: item.description ?? null,
                    content: item.content?.encoded ?? null,
                };
            }).filter(draft => draft.url.length > 0),
        };
    }
    const { feed } = parsed;
    return {
        feedTitle: feed.title ?? null,
        items: (feed.items ?? []).map((item) => ({
            id: dedupKey(item.id, item.url ?? ''),
            rawGuid: item.id ?? null,
            url: item.url === undefined ? '' : normalizeDedupUrl(item.url),
            title: item.title ?? null,
            publishedAt: toIsoDate(item.date_published),
            summary: item.summary ?? item.content_text ?? null,
            content: item.content_html ?? null,
        })).filter(draft => draft.url.length > 0),
    };
}
/**
 * Fetch and parse one feed document.
 * @param request - feed URL plus the source's stored conditional-request cursors.
 * @param deps - injected fetch implementation for tests.
 * @param signal - caller cancellation; combined with the per-request deadline.
 * @returns the drafts plus the cursors to store for the next run; a 304
 * result carries no items and `notModified: true`.
 */
export async function fetchFeedDocument(request, deps = {}, signal) {
    const headers = {
        'user-agent': GATHER_USER_AGENT,
        'accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/feed+json;q=0.9, */*;q=0.1',
    };
    if (request.etag !== undefined && request.etag.length > 0)
        headers['if-none-match'] = request.etag;
    if (request.lastModified !== undefined && request.lastModified.length > 0)
        headers['if-modified-since'] = request.lastModified;
    const deadline = AbortSignal.timeout(GATHER_FETCH_TIMEOUT_MS);
    const response = await (deps.fetchImpl ?? fetch)(request.url, {
        headers,
        redirect: 'follow',
        signal: signal === undefined ? deadline : AbortSignal.any([deadline, signal]),
    });
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    if (response.status === 304)
        return { notModified: true, etag, lastModified, feedTitle: null, items: [] };
    if (!response.ok)
        throw new GatherFeedHttpError(response.status, request.url);
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > GATHER_MAX_FEED_BYTES)
        throw new GatherFeedHttpError(413, request.url);
    const body = await response.text();
    if (body.length > GATHER_MAX_FEED_BYTES)
        throw new GatherFeedHttpError(413, request.url);
    let parsed;
    try {
        parsed = parseFeed(body);
    }
    catch (error) {
        // feedsmith signals an unrecognized or malformed document through
        // DetectError / ParseError; both are the caller-facing "not a feed".
        if (error instanceof ParseError || error instanceof DetectError) {
            throw new Error(`feed at ${request.url} is not a parseable RSS/Atom/RDF/JSON Feed document: ${error.message}`);
        }
        throw error;
    }
    const { feedTitle, items } = normalizeParsedFeed(parsed);
    return { notModified: false, etag, lastModified, feedTitle, items };
}
//# sourceMappingURL=feed.js.map