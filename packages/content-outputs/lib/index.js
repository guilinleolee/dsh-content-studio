import z from "@deepseek-ai/schemastery";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { dirname, join } from "node:path";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { lstat, mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { DetectError, ParseError, parseFeed } from "feedsmith";
import normalizeUrl from "normalize-url";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import sanitizeHtml from "sanitize-html";
import { BlockAssembler, LlmError, createUserMessage, deepFreeze } from "@deepseek-ai/dsh-llm";
import { deadline } from "@deepseek-ai/dsh-timeout";
import PQueue from "p-queue";
import pRetry from "p-retry";
//#region lib/types/scan.js
/**
* Outputs library scanner: reads the on-disk project convention directly on
* every call. The convention is one directory per creation under the library
* root — finished files at the project root, intermediate material under
* `assets/`, and `.dsh-output.json` as the only metadata. Names beginning
* with `.` or `_` are system entries, not projects and not deliverables;
* inside `assets/` they are system files (the gather manifest), not
* intermediate material.
*
* A malformed metadata file never kills the whole snapshot: the project is
* projected with fallbacks and named through `hasMetadata`, because one bad
* file must not take the library view down while the other projects stay
* readable.
*/
/** Metadata file name every project directory carries. */
const METADATA_FILENAME = ".dsh-output.json";
/** Intermediate-material directory inside a project. */
const ASSETS_DIRNAME = "assets";
const KINDS = [
	"article",
	"xhs-note",
	"video",
	"cards",
	"poster",
	"audio",
	"other"
];
const STATUSES = [
	"draft",
	"ready",
	"published"
];
function isProjectEntry(name, type) {
	return type === "directory" && !name.startsWith(".") && !name.startsWith("_");
}
/**
* Parse and fully validate one metadata file. Any violation — wrong JSON,
* unknown format version, a field of the wrong type — returns undefined; the
* caller keeps the project visible with fallbacks instead.
* @param raw - exact file contents.
* @returns the metadata only when it conforms to format version 0.
*/
function parseMetadata(raw) {
	let value;
	try {
		value = JSON.parse(raw);
	} catch {
		return;
	}
	if (typeof value !== "object" || value === null) return void 0;
	const record = value;
	if (record.formatVersion !== 0) return void 0;
	if (typeof record.title !== "string" || record.title.length === 0) return void 0;
	if (!KINDS.includes(record.kind)) return void 0;
	if (record.platform !== null && typeof record.platform !== "string") return void 0;
	if (!STATUSES.includes(record.status)) return void 0;
	if (!Array.isArray(record.tags) || !record.tags.every((tag) => typeof tag === "string")) return void 0;
	if (record.summary !== null && typeof record.summary !== "string") return void 0;
	return value;
}
/**
* Read one project directory into its projection.
* @param root - absolute library root.
* @param topic - project directory name.
* @returns the project projection, plus a problem entry instead when the
* directory is unreadable.
*/
async function scanProject(root, topic) {
	const dir = join(root, topic);
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch (error) {
		return { problem: `unreadable project directory: ${error instanceof Error ? error.message : String(error)}` };
	}
	const deliverables = [];
	let assetCount = 0;
	for (const entry of entries) {
		if (entry.name === ".dsh-output.json") continue;
		if (entry.isDirectory()) {
			if (entry.name === "assets") try {
				assetCount = (await readdir(join(dir, ASSETS_DIRNAME))).filter((name) => !name.startsWith(".") && !name.startsWith("_")).length;
			} catch {}
			continue;
		}
		if (!entry.isFile() || entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
		deliverables.push(entry.name);
	}
	let metadata;
	let hasMetadata = false;
	try {
		metadata = parseMetadata(await readFile(join(dir, METADATA_FILENAME), "utf8"));
		hasMetadata = true;
	} catch {}
	let updatedAt;
	try {
		updatedAt = (await stat(dir)).mtime.toISOString();
	} catch {
		updatedAt = (/* @__PURE__ */ new Date(0)).toISOString();
	}
	return { project: {
		topic,
		title: metadata?.title ?? topic,
		kind: metadata?.kind ?? "other",
		platform: metadata?.platform ?? null,
		status: metadata?.status ?? "draft",
		tags: metadata?.tags ?? [],
		summary: metadata?.summary ?? null,
		updatedAt,
		deliverables,
		assetCount,
		hasMetadata
	} };
}
/**
* Scan the whole library root.
* @param root - absolute library root; a missing root is an empty library.
* @returns the snapshot with projects in name order and every failure named.
*/
async function scanOutputs(root) {
	let entries;
	try {
		entries = await readdir(root, { withFileTypes: true });
	} catch {
		return {
			root,
			projects: [],
			problems: []
		};
	}
	const topics = entries.map((entry) => ({
		name: entry.name,
		type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other"
	})).filter((entry) => isProjectEntry(entry.name, entry.type)).map((entry) => entry.name).sort();
	const projects = [];
	const problems = [];
	for (const topic of topics) {
		const scanned = await scanProject(root, topic);
		if (scanned.project !== void 0) projects.push(scanned.project);
		else if (scanned.problem !== void 0) problems.push({
			topic,
			detail: scanned.problem
		});
	}
	return {
		root,
		projects,
		problems
	};
}
//#endregion
//#region lib/types/gather/feed.js
/**
* Feed fetching and parsing for the gather write face. One document is
* fetched per call with conditional-request cursors (ETag / Last-Modified),
* parsed through feedsmith (RSS 2.0, Atom, RDF, JSON Feed in one grammar),
* and normalized into item drafts with stable deduplication keys. Network
* reading only: nothing here touches the filesystem, and the HTTP fetch
* happens exclusively inside this gateway-side module — the browser never
* reaches cross-origin feeds itself.
*/
/** Single-feed request deadline; a slow source must not pin the gateway. */
const GATHER_FETCH_TIMEOUT_MS = 3e4;
/** Declared fetcher identity of the gather face. */
const GATHER_USER_AGENT = "dsh-content-gather/0.1 (dsh content studio gather view)";
/** The fetch failure carries the HTTP status for caller-facing messages. */
var GatherFeedHttpError = class extends Error {
	/** HTTP status of the failed response. */
	status;
	constructor(status, url) {
		super(`feed request to ${url} failed with HTTP ${status}`);
		this.name = "GatherFeedHttpError";
		this.status = status;
	}
};
/**
* Normalize one item link for deduplication and storage: tracking query
* parameters (utm_* and friends) are dropped and the query string is sorted,
* so ref-tagged reposts of one article collapse onto one key.
* @param url - raw link as the feed carried it.
* @returns the normalized absolute URL.
*/
function normalizeDedupUrl(url) {
	return normalizeUrl(url.trim(), { defaultProtocol: "https" });
}
/**
* Compute one draft's deduplication key: the feed guid when present, else
* the SHA-1 of the normalized link. The guid is kept beside the key so a
* later strategy change can recompute without refetching.
* @param rawGuid - feed guid when the item carries one.
* @param link - item link (already normalized by the caller when reused).
* @returns the branded deduplication key.
*/
function dedupKey(rawGuid, link) {
	if (rawGuid !== void 0 && rawGuid.length > 0) return rawGuid;
	return createHash("sha1").update(normalizeDedupUrl(link)).digest("hex");
}
/** Parse one feed date into ISO 8601, or null when absent or unparseable. */
function toIsoDate(value) {
	if (value === void 0 || value.trim().length === 0) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
/** Atom titles and links are wrapped; flatten to the plain shapes. */
function atomLink(entry) {
	const links = entry.links ?? [];
	return (links.find((link) => link.rel === void 0 || link.rel === "alternate") ?? links[0])?.href;
}
/** Flatten one feedsmith text node (plain string or `{ value }` wrapper). */
function textValue(value) {
	if (value === void 0) return null;
	if (typeof value === "string") return value;
	return value.value ?? null;
}
/** Normalize one parsed feed document (any supported format) into drafts. */
function normalizeParsedFeed(parsed) {
	if (parsed.format === "rss") {
		const { feed } = parsed;
		return {
			feedTitle: textValue(feed.title),
			items: (feed.items ?? []).map((item) => ({
				id: dedupKey(item.guid?.value, item.link ?? ""),
				rawGuid: item.guid?.value ?? null,
				url: item.link === void 0 ? "" : normalizeDedupUrl(item.link),
				title: item.title ?? null,
				publishedAt: toIsoDate(item.pubDate),
				summary: item.description ?? null,
				content: item.content?.encoded ?? null
			})).filter((draft) => draft.url.length > 0)
		};
	}
	if (parsed.format === "atom") {
		const { feed } = parsed;
		return {
			feedTitle: textValue(feed.title),
			items: (feed.entries ?? []).map((entry) => {
				const link = atomLink(entry);
				return {
					id: dedupKey(entry.id, link ?? ""),
					rawGuid: entry.id ?? null,
					url: link === void 0 ? "" : normalizeDedupUrl(link),
					title: textValue(entry.title),
					publishedAt: toIsoDate(entry.published ?? entry.updated),
					summary: textValue(entry.summary),
					content: entry.content?.value ?? null
				};
			}).filter((draft) => draft.url.length > 0)
		};
	}
	if (parsed.format === "rdf") {
		const { feed } = parsed;
		return {
			feedTitle: textValue(feed.title),
			items: (feed.items ?? []).map((item) => {
				const link = item.link ?? "";
				return {
					id: dedupKey(item.rdf?.about ?? item.dc?.identifiers?.[0], link),
					rawGuid: item.rdf?.about ?? item.dc?.identifiers?.[0] ?? null,
					url: link.length === 0 ? "" : normalizeDedupUrl(link),
					title: item.title ?? null,
					publishedAt: toIsoDate(item.dc?.dates?.[0] ?? item.dcterms?.dates?.[0]),
					summary: item.description ?? null,
					content: item.content?.encoded ?? null
				};
			}).filter((draft) => draft.url.length > 0)
		};
	}
	const { feed } = parsed;
	return {
		feedTitle: feed.title ?? null,
		items: (feed.items ?? []).map((item) => ({
			id: dedupKey(item.id, item.url ?? ""),
			rawGuid: item.id ?? null,
			url: item.url === void 0 ? "" : normalizeDedupUrl(item.url),
			title: item.title ?? null,
			publishedAt: toIsoDate(item.date_published),
			summary: item.summary ?? item.content_text ?? null,
			content: item.content_html ?? null
		})).filter((draft) => draft.url.length > 0)
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
async function fetchFeedDocument(request, deps = {}, signal) {
	const headers = {
		"user-agent": GATHER_USER_AGENT,
		"accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, application/feed+json;q=0.9, */*;q=0.1"
	};
	if (request.etag !== void 0 && request.etag.length > 0) headers["if-none-match"] = request.etag;
	if (request.lastModified !== void 0 && request.lastModified.length > 0) headers["if-modified-since"] = request.lastModified;
	const deadline = AbortSignal.timeout(GATHER_FETCH_TIMEOUT_MS);
	const response = await (deps.fetchImpl ?? fetch)(request.url, {
		headers,
		redirect: "follow",
		signal: signal === void 0 ? deadline : AbortSignal.any([deadline, signal])
	});
	const etag = response.headers.get("etag");
	const lastModified = response.headers.get("last-modified");
	if (response.status === 304) return {
		notModified: true,
		etag,
		lastModified,
		feedTitle: null,
		items: []
	};
	if (!response.ok) throw new GatherFeedHttpError(response.status, request.url);
	if (Number(response.headers.get("content-length") ?? "0") > 10485760) throw new GatherFeedHttpError(413, request.url);
	const body = await response.text();
	if (body.length > 10485760) throw new GatherFeedHttpError(413, request.url);
	let parsed;
	try {
		parsed = parseFeed(body);
	} catch (error) {
		if (error instanceof ParseError || error instanceof DetectError) throw new Error(`feed at ${request.url} is not a parseable RSS/Atom/RDF/JSON Feed document: ${error.message}`);
		throw error;
	}
	const { feedTitle, items } = normalizeParsedFeed(parsed);
	return {
		notModified: false,
		etag,
		lastModified,
		feedTitle,
		items
	};
}
//#endregion
//#region lib/types/gather/sanitize.js
/**
* Server-side HTML sanitization for gathered body snapshots. The allowlist
* (sanitize-html) decides what survives: a written `*.html` snapshot keeps
* prose and embedded media markup and drops every other tag with its
* content. Hand-rolled tag stripping is not an option here — script and
* iframe deletion cannot cover `javascript:`/`data:` URIs, SVG/MathML
* mutation vectors, or DOM clobbering; the browser side re-runs DOMPurify at
* render as the second layer.
*/
/**
* Sanitize one gathered HTML body into its storable form.
* @param raw - untrusted HTML as the feed carried it.
* @returns HTML restricted to the allowlist, safe to persist and (with the
* render-side DOMPurify pass) to inject into the detail view.
*/
function sanitizeGatherHtml(raw) {
	return sanitizeHtml(raw, {
		allowedTags: [
			"p",
			"br",
			"hr",
			"blockquote",
			"pre",
			"code",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"strong",
			"em",
			"b",
			"i",
			"u",
			"s",
			"sub",
			"sup",
			"span",
			"div",
			"ul",
			"ol",
			"li",
			"dl",
			"dt",
			"dd",
			"table",
			"thead",
			"tbody",
			"tfoot",
			"tr",
			"th",
			"td",
			"caption",
			"colgroup",
			"col",
			"a",
			"img",
			"figure",
			"figcaption",
			"picture",
			"source",
			"video",
			"audio",
			"track",
			"abbr",
			"cite",
			"q",
			"dfn",
			"kbd",
			"samp",
			"var",
			"time",
			"mark",
			"wbr"
		],
		allowedAttributes: {
			a: [
				"href",
				"title",
				"name",
				"rel",
				"target"
			],
			img: [
				"src",
				"srcset",
				"sizes",
				"alt",
				"title",
				"width",
				"height",
				"loading"
			],
			picture: [],
			source: [
				"src",
				"srcset",
				"sizes",
				"media",
				"type"
			],
			video: [
				"src",
				"poster",
				"controls",
				"width",
				"height"
			],
			audio: ["src", "controls"],
			track: [
				"src",
				"kind",
				"srclang",
				"label"
			],
			abbr: ["title"],
			cite: [],
			q: ["cite"],
			time: ["datetime"],
			th: [
				"scope",
				"colspan",
				"rowspan"
			],
			td: ["colspan", "rowspan"],
			col: ["span"],
			colgroup: ["span"],
			code: ["class"],
			span: ["class"],
			div: ["class"],
			h1: ["id"],
			h2: ["id"],
			h3: ["id"],
			h4: ["id"],
			h5: ["id"],
			h6: ["id"]
		},
		allowedSchemes: ["http", "https"],
		allowedSchemesByTag: {
			img: ["http", "https"],
			source: ["http", "https"],
			video: ["http", "https"],
			audio: ["http", "https"],
			track: ["http", "https"]
		},
		allowProtocolRelative: false,
		nonTextTags: [
			"style",
			"script",
			"textarea",
			"option",
			"noscript",
			"noembed",
			"embed",
			"object"
		],
		transformTags: { a: sanitizeHtml.simpleTransform("a", {
			rel: "noopener noreferrer",
			target: "_blank"
		}) },
		disallowedTagsMode: "discard"
	});
}
/**
* Reduce one sanitized (or any) HTML document to its visible text.
* @param raw - untrusted HTML.
* @returns text content with tags and their inner scripting dropped.
*/
function htmlToText(raw) {
	return sanitizeHtml(raw, {
		allowedTags: [],
		allowedAttributes: {}
	});
}
//#endregion
//#region lib/types/gather/store.js
/**
* On-disk store for the gather write face: the `_gather.json` manifest and
* body-snapshot files under `outputs/<theme>/assets/`. Every path enters
* through the guards here — a theme is one plain directory name and a file
* is one plain file name inside that theme's `assets/`, so `..`, absolute
* paths, theme roots, and separator tricks cannot reach anything else.
* Manifest replacement is serialized through a file lock and committed with
* an atomic rename; on Windows a just-closed file can be briefly pinned by
* antivirus or the search indexer, so renames retry the pinning error codes
* with backoff. Retention trimming runs before every manifest write: a
* source keeps its newest `unread`/`read` materials up to the quota, while
* `favorite` and `picked` markers and their snapshots are never removed.
*/
/** Manifest file name inside the theme's `assets/` directory. */
const GATHER_MANIFEST_FILENAME = "_gather.json";
/** Per-source retention quota for `unread`/`read` materials in one theme. */
const GATHER_QUOTA_PER_SOURCE = 50;
/** Sanitized body snapshots are truncated to this many characters. */
const GATHER_MAX_BODY_CHARS = 1e5;
/** Hard per-file size cap for any asset write, truncation aside. */
const GATHER_MAX_ASSET_CHARS = 2e6;
const MATERIAL_STATUSES = [
	"unread",
	"read",
	"favorite",
	"picked"
];
/** Themes are project directories: one plain name, never system-prefixed. */
function isThemeName(theme) {
	return theme.length > 0 && !theme.includes("/") && !theme.includes("\\") && theme !== "." && theme !== ".." && !theme.startsWith(".") && !theme.startsWith("_") && !/[\u0000-\u001f]/.test(theme);
}
/** Asset files are one plain file name inside `assets/`, never a path. */
function isAssetFileName(file) {
	return file.length > 0 && !file.includes("/") && !file.includes("\\") && file !== "." && file !== ".." && !file.startsWith(".") && !/[\u0000-\u001f]/.test(file);
}
/**
* Resolve and guard one theme's assets directory.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @returns the absolute `assets/` path.
* @throws when the theme name is not a plain project-directory name.
*/
function resolveAssetsDir(root, theme) {
	if (!isThemeName(theme)) throw new Error(`invalid gather theme name: ${JSON.stringify(theme)}`);
	return join(root, theme, "assets");
}
/**
* Resolve and guard one asset file path.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @param file - plain file name inside the theme's `assets/`.
* @returns the absolute file path.
* @throws when the theme or file name could escape the assets directory.
*/
function resolveAssetPath(root, theme, file) {
	if (!isAssetFileName(file)) throw new Error(`invalid gather asset file name: ${JSON.stringify(file)}`);
	return join(resolveAssetsDir(root, theme), file);
}
/** Structural validation for one manifest entry; unknown or mistyped fields reject the entry. */
function isMaterial(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.id === "string" && record.id.length > 0 && typeof record.sourceId === "string" && record.sourceId.length > 0 && typeof record.sourceName === "string" && record.sourceName.length > 0 && typeof record.title === "string" && record.title.length > 0 && typeof record.url === "string" && (record.publishedAt === void 0 || typeof record.publishedAt === "string") && typeof record.gatheredAt === "string" && MATERIAL_STATUSES.includes(record.status) && (record.summary === void 0 || typeof record.summary === "string") && (record.points === void 0 || Array.isArray(record.points) && record.points.every((point) => typeof point === "string")) && (record.score === void 0 || typeof record.score === "number") && (record.tags === void 0 || Array.isArray(record.tags) && record.tags.every((tag) => typeof tag === "string")) && (record.excerpts === void 0 || Array.isArray(record.excerpts) && record.excerpts.every((excerpt) => typeof excerpt === "string")) && (record.bodyFile === void 0 || typeof record.bodyFile === "string" && isAssetFileName(record.bodyFile)) && (record.rawGuid === void 0 || typeof record.rawGuid === "string");
}
/**
* Parse and validate one manifest document. One malformed entry never hides
* the rest: it is named in `problems` and dropped, like the outputs scanner
* treats bad metadata.
* @param raw - exact file contents.
* @returns the manifest with only valid entries, plus every dropped one named.
*/
function parseGatherManifest(raw) {
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {
			manifest: {
				formatVersion: 0,
				materials: []
			},
			problems: ["gather manifest is not valid JSON"]
		};
	}
	const record = parsed;
	if (record.formatVersion !== 0) return {
		manifest: {
			formatVersion: 0,
			materials: []
		},
		problems: [`unsupported gather manifest formatVersion ${String(record.formatVersion)}`]
	};
	if (!Array.isArray(record.materials)) return {
		manifest: {
			formatVersion: 0,
			materials: []
		},
		problems: ["gather manifest has no materials array"]
	};
	const materials = [];
	const problems = [];
	for (const entry of record.materials) if (isMaterial(entry)) materials.push(entry);
	else problems.push(`dropped one invalid gather material: ${JSON.stringify(entry).slice(0, 120)}`);
	return {
		manifest: {
			formatVersion: 0,
			materials
		},
		problems
	};
}
/**
* Validate one incoming manifest wholesale; used by the write path to reject
* rather than repair caller mistakes.
* @param manifest - the manifest the caller wants stored.
* @throws when the envelope or any entry violates the format.
*/
function assertGatherManifest(manifest) {
	for (const entry of manifest.materials) if (!isMaterial(entry)) throw new Error(`invalid gather material: ${JSON.stringify(entry).slice(0, 120)}`);
}
/** Whether one material is exempt from retention trimming. */
function isRetentionExempt(material, exemptFiles) {
	return material.status === "favorite" || material.status === "picked" || material.bodyFile !== void 0 && exemptFiles.has(material.bodyFile);
}
/** Newest-first comparison for retention selection; ties stay in place (stable sort). */
function compareRetention(a, b) {
	if (a.gatheredAt !== b.gatheredAt) return a.gatheredAt < b.gatheredAt ? 1 : -1;
	return 0;
}
/**
* Apply the retention quota: per source, keep `unread`/`read` materials up
* to {@link GATHER_QUOTA_PER_SOURCE} (newest first); `favorite`/`picked`
* entries and the files the create workbench references always survive.
* Returns the kept entries and the dropped ones — dropping is only decided
* here, snapshot deletion stays with the caller after the trimmed manifest
* is durably committed.
* @param materials - the manifest's current entries.
* @param exemptFiles - asset file names exempt from trimming (the create
*   workbench's referenced snapshots).
* @returns the trimmed list plus every entry the quota dropped.
*/
function applyRetentionQuota(materials, exemptFiles = /* @__PURE__ */ new Set()) {
	const keep = new Array(materials.length).fill(true);
	const order = materials.map((material, index) => ({
		material,
		index
	}));
	order.sort((a, b) => compareRetention(a.material, b.material));
	const perSource = /* @__PURE__ */ new Map();
	const dropped = [];
	for (const { material, index } of order) {
		if (isRetentionExempt(material, exemptFiles)) continue;
		const count = perSource.get(material.sourceId) ?? 0;
		if (count >= 50) {
			keep[index] = false;
			dropped.push(material);
			continue;
		}
		perSource.set(material.sourceId, count + 1);
	}
	return {
		kept: materials.filter((_, index) => keep[index]),
		dropped
	};
}
/** Whether an error is the Windows rename-pinning trio (antivirus, indexer, open handle). */
function isWindowsRenamePin(error) {
	if (process.platform !== "win32") return false;
	const code = error?.code;
	return code === "EPERM" || code === "EACCES" || code === "EBUSY";
}
/** Retry cadence for pinned renames: 100 ms doubling, five tries, per the gather write-face policy. */
const RENAME_RETRY_BASE_MS = 100;
const RENAME_RETRY_MAX_TRIES = 5;
/**
* Rename with retry for the Windows pinning window: antivirus and the search
* indexer hold a transient handle on just-closed files, which surfaces as
* EPERM/EACCES/EBUSY on rename and passes on a later attempt.
* @param from - source path.
* @param to - destination path.
*/
async function renameWithRetry(from, to) {
	for (let attempt = 0;; attempt += 1) try {
		await rename(from, to);
		return;
	} catch (error) {
		if (attempt >= RENAME_RETRY_MAX_TRIES || !isWindowsRenamePin(error)) throw error;
		await new Promise((resolve) => setTimeout(resolve, RENAME_RETRY_BASE_MS * 2 ** attempt));
	}
}
/**
* Replace one file atomically, serialized against other writers of the same
* path. The parent directory is created before the lock is taken — the lock
* file lives beside the target, so a first write into a fresh theme needs
* the directory to exist first. A pinned commit rename (the Windows pinning
* window) retries the whole replacement: the temp is cleaned on failure and
* the old file stays intact, so a retry is always safe. Shared with the
* competitor write face.
* @param file - absolute destination path.
* @param content - complete next file content.
*/
async function writeAtomicallyLocked(file, content) {
	await mkdir(dirname(file), { recursive: true });
	await withFileLock(file, async () => {
		for (let attempt = 0;; attempt += 1) try {
			await writeFileAtomic(file, content, {
				mode: 384,
				dirMode: 448
			});
			return;
		} catch (error) {
			if (attempt >= RENAME_RETRY_MAX_TRIES || !isWindowsRenamePin(error)) throw error;
			await new Promise((resolve) => setTimeout(resolve, RENAME_RETRY_BASE_MS * 2 ** attempt));
		}
	});
}
/**
* Write one asset file. `*.html` content is sanitized through the allowlist
* first and truncated to the body cap; other text files pass through with
* only the hard size cap applied.
* @param root - absolute outputs library root.
* @param write - theme, file name, and content.
* @returns whether the stored snapshot was truncated.
*/
async function writeAssetFile(root, write) {
	const target = resolveAssetPath(root, write.theme, write.file);
	let content = write.content;
	if (write.file.endsWith(".html")) {
		const sanitized = sanitizeGatherHtml(content);
		if (sanitized.length > 1e5) {
			const cut = sanitized.slice(0, GATHER_MAX_BODY_CHARS);
			const closed = cut.lastIndexOf(">");
			content = closed > 0 ? cut.slice(0, closed + 1) : cut;
			await writeAtomicallyLocked(target, content);
			return { truncated: true };
		}
		content = sanitized;
		await writeAtomicallyLocked(target, content);
		return { truncated: false };
	}
	if (content.length > 2e6) throw new Error(`gather asset ${write.file} exceeds the ${GATHER_MAX_ASSET_CHARS}-character cap`);
	await writeAtomicallyLocked(target, content);
	return { truncated: false };
}
/**
* Read one asset file as text, capped. Serves the gather view's detail pane
* (the browser has no other way to display a stored snapshot) and the AI
* face's snapshot input; `*.html` snapshots were already sanitized when they
* were written.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @param file - plain file name inside `assets/`.
* @returns the file content, or undefined when absent.
* @throws when the file exceeds the read cap.
*/
async function readAssetText(root, theme, file) {
	try {
		return await readFile(resolveAssetPath(root, theme, file), "utf8");
	} catch {
		return;
	}
}
/**
* Rename or relocate one file between two themes' `assets/` directories.
* The destination theme's `assets/` directory is created when absent, so a
* material can move into a theme that has not stored assets before.
* @param root - absolute outputs library root.
* @param move - source theme/name and destination theme/name.
* @throws when the source is missing or the destination already exists.
*/
async function moveAssetFile(root, move) {
	const from = resolveAssetPath(root, move.fromTheme, move.from);
	const to = resolveAssetPath(root, move.toTheme, move.to);
	await mkdir(resolveAssetsDir(root, move.toTheme), { recursive: true });
	await withFileLock(to, async () => {
		let destinationExists = false;
		try {
			await lstat(to);
			destinationExists = true;
		} catch {}
		if (destinationExists) throw new Error(`gather asset ${move.to} already exists in ${move.toTheme}`);
		await renameWithRetry(from, to);
	});
}
/**
* Delete one asset file; deleting an absent file is a no-op.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @param file - plain file name inside `assets/`.
*/
async function deleteAssetFile(root, theme, file) {
	await rm(resolveAssetPath(root, theme, file), { force: true });
}
/**
* Read the theme's gather manifest.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @returns the manifest with only valid entries, plus every dropped one named.
*/
async function readGatherManifestFile(root, theme) {
	const file = join(resolveAssetsDir(root, theme), GATHER_MANIFEST_FILENAME);
	let raw;
	try {
		raw = await readFile(file, "utf8");
	} catch {
		return {
			manifest: {
				formatVersion: 0,
				materials: []
			},
			problems: []
		};
	}
	return parseGatherManifest(raw);
}
/**
* Replace the theme's gather manifest under a lock with an atomic commit.
* The stored manifest is quota-trimmed first; snapshots of trimmed entries
* are deleted only after the trimmed manifest is durably on disk, so a crash
* can leave an untracked file but never a tracked-but-missing one.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @param manifest - the complete next manifest.
* @param exemptFiles - asset file names exempt from trimming (the create
*   workbench's referenced snapshots; the gateway collects them per write).
* @returns the stored (trimmed) manifest.
*/
async function writeGatherManifestFile(root, theme, manifest, exemptFiles = /* @__PURE__ */ new Set()) {
	assertGatherManifest(manifest);
	const assetsDir = resolveAssetsDir(root, theme);
	const { kept, dropped } = applyRetentionQuota(manifest.materials, exemptFiles);
	const stored = {
		formatVersion: 0,
		materials: kept
	};
	await writeAtomicallyLocked(join(assetsDir, GATHER_MANIFEST_FILENAME), `${JSON.stringify(stored, null, 2)}\n`);
	for (const material of dropped) if (material.bodyFile !== void 0) await rm(join(assetsDir, material.bodyFile), { force: true });
	return stored;
}
/**
* Delete orphaned atomic-write temp files (`<name>.<hex>.tmp`) left behind by
* a crashed gateway process, across every theme's assets directory. Best
* effort: a sweep failure must never block startup, because the temp files
* are inert.
* @param root - absolute outputs library root.
*/
async function sweepOrphanTempFiles(root) {
	let themes;
	try {
		themes = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory() && isThemeName(entry.name)).map((entry) => entry.name);
	} catch {
		return;
	}
	for (const theme of themes) {
		const assetsDir = join(root, theme, "assets");
		let entries;
		try {
			entries = await readdir(assetsDir);
		} catch {
			continue;
		}
		for (const name of entries) {
			if (!/^.+\.[0-9a-f]{6}\.tmp$/.test(name)) continue;
			await rm(join(assetsDir, name), { force: true }).catch(() => void 0);
		}
	}
}
//#endregion
//#region lib/types/gather/ai.js
/**
* AI processing for the gather write face: one explicit, controlled model
* call per request behind the gather view's AI processing button. Calls ride
* the shared `llm` Service Definition — no new model interface — through the
* same hand-built one-shot pattern the session-title provider established.
* The processor runs one call at a time (p-queue), retries only upstream
* rate limits (p-retry: provider `Retry-After` first, else exponential
* backoff capped at 30 s, at most four retries), and never persists
* anything: the caller writes the structured result back into the manifest.
*/
var __addDisposableResource = function(env, value, async) {
	if (value !== null && value !== void 0) {
		if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
		var dispose, inner;
		if (async) {
			if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
			dispose = value[Symbol.asyncDispose];
		}
		if (dispose === void 0) {
			if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
			dispose = value[Symbol.dispose];
			if (async) inner = dispose;
		}
		if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
		if (inner) dispose = function() {
			try {
				inner.call(this);
			} catch (e) {
				return Promise.reject(e);
			}
		};
		env.stack.push({
			value,
			dispose,
			async
		});
	} else if (async) env.stack.push({ async: true });
	return value;
};
var __disposeResources = (function(SuppressedError) {
	return function(env) {
		function fail(e) {
			env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
			env.hasError = true;
		}
		var r, s = 0;
		function next() {
			while (r = env.stack.pop()) try {
				if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
				if (r.dispose) {
					var result = r.dispose.call(r.value);
					if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
						fail(e);
						return next();
					});
				} else s |= 1;
			} catch (e) {
				fail(e);
			}
			if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
			if (env.hasError) throw env.error;
		}
		return next();
	};
})(typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
	var e = new Error(message);
	return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
/** Timeout reason code carried by aborted AI processing calls. */
const GATHER_AI_TIMEOUT_CODE = "GATHER_AI_TIMEOUT";
/**
* Resolve the declared AI policy into its validated form, defaults applied.
* Shared by every AI face of this gateway so the bounds live in one place.
* @param config - the declared policy; every field optional.
* @returns the validated policy, fail loud on out-of-range values.
*/
function resolveAiConfig(config) {
	const timeoutMs = config.timeoutMs ?? 6e4;
	const maxOutputTokens = config.maxOutputTokens ?? 2e3;
	const maxInputChars = config.maxInputChars ?? 12e3;
	if (!Number.isInteger(timeoutMs) || timeoutMs < 1e3 || timeoutMs > 6e5) throw new Error("contentOutputs aiTimeoutMs must be an integer from 1000 through 600000");
	if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 32e3) throw new Error("contentOutputs aiMaxOutputTokens must be an integer from 256 through 32000");
	if (!Number.isInteger(maxInputChars) || maxInputChars < 1e3 || maxInputChars > 1e5) throw new Error("contentOutputs aiMaxInputChars must be an integer from 1000 through 100000");
	return {
		provider: config.provider ?? "deepseek",
		model: config.model ?? "deepseek-chat",
		timeoutMs,
		maxOutputTokens,
		maxInputChars
	};
}
/**
* The error behind a p-retry v8 failure context. p-retry v8 hands
* `shouldRetry` / `onFailedAttempt` a frozen context object
* (`{ error, attemptNumber, retriesLeft, … }`), not the raw error; plain
* errors (direct callers, tests) pass through unchanged.
* @param error - the raw error or a p-retry failure context.
* @returns the underlying thrown error.
*/
function underlyingError(error) {
	if (typeof error === "object" && error !== null && "error" in error) {
		const nested = error.error;
		if (nested instanceof Error) return nested;
	}
	return error;
}
/**
* Honor a provider `Retry-After` before p-retry's own backoff runs.
* @param failure - the failed attempt's error or its p-retry context.
*/
async function honorRetryAfter(failure) {
	const delay = retryAfterMs(failure);
	if (delay !== void 0) await new Promise((resolve) => setTimeout(resolve, delay));
}
/** System prompt: the gather view's built-in processing skill. */
const SYSTEM_PROMPT = [
	"你是内容创作工作台的信息收集助手。对给定的一条素材（标题、链接、正文或摘要）输出：",
	"1. summary：不超过 120 字的中文摘要，保留关键事实与数字；",
	"2. points：最多 5 条要点，每条不超过 40 字；",
	"3. score：选题分数 0-100 整数，衡量该素材作为创作选题的价值（时效性、话题性、受众相关性）；",
	"4. tags：最多 5 个简短主题标签。",
	"只输出一个 JSON 对象，形如 {\"summary\":\"...\",\"points\":[\"...\"],\"score\":88,\"tags\":[\"...\"]}，不要输出其他任何文字。"
].join("\n");
/** Whether one thrown error (or its p-retry context) is an upstream rate limit worth retrying. */
function isRateLimitError(failure) {
	const error = underlyingError(failure);
	if (error instanceof LlmError) return error.failure.code === "RATE_LIMIT" || error.failure.status === 429;
	const code = error?.code;
	return code === "RATE_LIMIT" || code === "429";
}
/** Provider-requested retry delay in milliseconds, capped so one source cannot pin the queue. */
function retryAfterMs(failure) {
	const error = underlyingError(failure);
	if (error instanceof LlmError && error.failure.providerRetryAfterMs !== void 0) return Math.min(error.failure.providerRetryAfterMs, 3e4);
}
/** Terminal model finish reasons that mean the call failed. */
function finishError(finish) {
	switch (finish.kind) {
		case "stop": return;
		case "error":
		case "aborted": {
			const error = new Error(finish.failure.message);
			error.code = finish.failure.code;
			return error;
		}
		case "max-tokens": return /* @__PURE__ */ new Error("gather AI output reached the token cap");
		case "tool-calls": return /* @__PURE__ */ new Error("gather AI model unexpectedly requested a tool");
		default: return /* @__PURE__ */ new Error(`gather AI unsupported finish reason "${String(finish.kind)}"`);
	}
}
/**
* Parse the model's JSON answer into the structured result. Model output is
* a JSON boundary: anything that is not the requested object rejects here.
* @param text - exact model text output.
* @returns the validated result.
*/
function parseGatherAiOutput(text) {
	const fenced = text.trim().replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "");
	const start = fenced.indexOf("{");
	const end = fenced.lastIndexOf("}");
	if (start === -1 || end <= start) throw new Error("gather AI output contains no JSON object");
	let parsed;
	try {
		parsed = JSON.parse(fenced.slice(start, end + 1));
	} catch {
		throw new Error("gather AI output is not valid JSON");
	}
	const record = parsed;
	const points = record.points;
	const tags = record.tags;
	if (typeof record.summary !== "string" || record.summary.trim().length === 0) throw new Error("gather AI output has no summary");
	if (!Array.isArray(points) || !points.every((point) => typeof point === "string")) throw new Error("gather AI output has invalid points");
	if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) throw new Error("gather AI output has invalid tags");
	if (typeof record.score !== "number" || !Number.isFinite(record.score) || record.score < 0 || record.score > 100) throw new Error("gather AI output has invalid score");
	return {
		summary: record.summary.trim(),
		points: points.slice(0, 8).map((point) => point.trim()).filter((point) => point.length > 0),
		score: Math.round(record.score),
		tags: tags.slice(0, 8).map((tag) => tag.trim()).filter((tag) => tag.length > 0)
	};
}
/**
* The queued AI processor owned by the content-outputs gateway; not itself a
* cordis service — the gateway carries the `llm` injection and the config.
*/
var GatherAiProcessor = class {
	ctx;
	/** Validated policy, defaults resolved once at construction. */
	resolved;
	/** Single-slot call queue: one model call at a time, per the gather policy. */
	queue = new PQueue({ concurrency: 1 });
	/**
	* @param ctx - context exposing the registered LLM service.
	* @param config - declared AI policy; defaults resolve here, fail loud.
	*/
	constructor(ctx, config) {
		this.ctx = ctx;
		this.resolved = resolveAiConfig(config);
	}
	/**
	* Process one material through the model: summary, key points, topic
	* score, and tags. Rate limits retry with backoff; every other failure
	* surfaces immediately so the UI can offer its own retry button.
	* @param request - the material's display facts plus its snapshot reference.
	* @param readSnapshot - reads one snapshot file body (theme, file name) as text.
	* @returns the structured result for the caller to write back into the manifest.
	*/
	async process(request, readSnapshot) {
		if (request.operation !== "process") throw new Error(`unsupported gather AI operation: ${String(request.operation)}`);
		const text = await this.collectInputText(request, readSnapshot);
		return await this.queue.add(() => this.processWithRetry(request, text));
	}
	/** Gather the model input: snapshot text when present, else the summary; never empty. */
	async collectInputText(request, readSnapshot) {
		let text = "";
		if (request.bodyFile !== void 0 && request.theme !== void 0) {
			const raw = await readSnapshot(request.theme, request.bodyFile);
			text = raw === void 0 ? "" : htmlToText(raw);
		}
		if (text.trim().length === 0 && request.summary !== void 0) text = request.summary;
		text = text.trim().slice(0, this.resolved.maxInputChars);
		if (text.length === 0) throw new Error("gather AI material has no content to process");
		return text;
	}
	/** One queued call with the rate-limit retry policy wrapped around it. */
	processWithRetry(request, text) {
		return pRetry(() => this.callModel(request, text), {
			retries: 4,
			minTimeout: 1e3,
			maxTimeout: 3e4,
			factor: 2,
			shouldRetry: isRateLimitError,
			onFailedAttempt: (error) => honorRetryAfter(error)
		});
	}
	/** One model call: framed prompt in, streamed text out, JSON validated. */
	async callModel(request, text) {
		const framed = [
			request.title,
			request.url === void 0 ? "" : `链接：${request.url}`,
			text
		].filter((part) => part.length > 0).join("\n\n");
		return parseGatherAiOutput(await streamLlmText(this.ctx, this.resolved, SYSTEM_PROMPT, framed, GATHER_AI_TIMEOUT_CODE));
	}
};
/**
* One framed one-shot model call riding the shared `llm` Service Definition:
* framed prompt in, streamed text out. Shared by the gather and competitor
* AI faces — both live behind this gateway, so the call source names this
* plugin. No persistence happens here.
* @param ctx - context exposing the registered LLM service.
* @param policy - provider, model, deadline, and output cap of the call.
* @param system - the face's system prompt.
* @param framed - complete user-prompt text.
* @param timeoutCode - abort reason code carried by the deadline.
* @returns the concatenated text output of the call.
*/
async function streamLlmText(ctx, policy, system, framed, timeoutCode) {
	const env_1 = {
		stack: [],
		error: void 0,
		hasError: false
	};
	try {
		const messages = [createUserMessage({
			content: [{
				type: "text",
				text: framed
			}],
			source: {
				kind: "plugin",
				plugin: "dsh-content-outputs"
			}
		})];
		const callDeadline = __addDisposableResource(env_1, deadline(void 0, policy.timeoutMs, timeoutCode), false);
		const options = deepFreeze({
			provider: policy.provider,
			model: policy.model,
			messages,
			system,
			maxTokens: policy.maxOutputTokens,
			signal: callDeadline.signal
		});
		const assembler = new BlockAssembler();
		for await (const chunk of ctx.llm.stream(options)) {
			callDeadline.signal.throwIfAborted();
			assembler.push(chunk);
		}
		callDeadline.signal.throwIfAborted();
		const terminalError = finishError(assembler.finish);
		if (terminalError !== void 0) throw terminalError;
		return assembler.blocks().filter((block) => block.type === "text").map((block) => block.text).join(" ");
	} catch (e_1) {
		env_1.error = e_1;
		env_1.hasError = true;
	} finally {
		__disposeResources(env_1);
	}
}
//#endregion
//#region lib/types/competitor/store.js
/**
* On-disk store for the competitor write face: the `_competitors.json`
* manifest under `outputs/<theme>/assets/`. Path guards and the atomic,
* Windows-retry commit are shared with the gather write face; this module
* owns only the manifest schema — parse with per-entry problems instead of a
* wholesale failure, validate incoming writes loudly, and commit under the
* same per-file lock. Works carry user markers (`hot`/`favorite`) and
* append-only metric snapshots, so the store never trims or reorders them:
* what the caller sends is what lands, after validation.
*/
/** Manifest file name inside the theme's `assets/` directory. */
const COMPETITOR_MANIFEST_FILENAME = "_competitors.json";
const PLATFORMS$1 = [
	"xhs",
	"douyin",
	"wechat",
	"bili",
	"zhihu",
	"toutiao"
];
/** Whether one value is a string array (every member a non-empty string after trim). */
function isStringArray(value) {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}
/** Whether one value is a metric snapshot with non-negative numbers. */
function isMetricSnapshot(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	const nonNegative = (candidate) => typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0;
	return typeof record.t === "string" && record.t.length > 0 && nonNegative(record.likes) && nonNegative(record.comments) && nonNegative(record.shares) && (record.views === void 0 || nonNegative(record.views));
}
/** Whether one value is a persisted analysis block (`pending`/`running` never persist). */
function isAnalysis(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	if (record.status !== "none" && record.status !== "done" && record.status !== "failed") return false;
	if (record.error !== void 0 && typeof record.error !== "string") return false;
	if (record.ref !== void 0 && typeof record.ref !== "string") return false;
	if (record.result === void 0) return record.status !== "done";
	if (typeof record.result !== "object" || record.result === null) return false;
	const result = record.result;
	return typeof result.hookType === "string" && result.hookType.length > 0 && typeof result.structure === "string" && result.structure.length > 0 && isStringArray(result.painPoints) && isStringArray(result.topics) && isStringArray(result.risks) && isStringArray(result.reusable) && isStringArray(result.migrationTopics) && typeof result.commentInsight === "string" && result.commentInsight.length > 0;
}
/** Structural validation for one work entry; unknown or mistyped fields reject the entry. */
function isWork(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.id === "string" && record.id.length > 0 && typeof record.accountId === "string" && record.accountId.length > 0 && typeof record.accountName === "string" && record.accountName.length > 0 && PLATFORMS$1.includes(record.platform) && typeof record.platformWorkId === "string" && record.platformWorkId.length > 0 && typeof record.title === "string" && record.title.length > 0 && (record.url === void 0 || typeof record.url === "string") && (record.publishedAt === void 0 || typeof record.publishedAt === "string") && typeof record.importedAt === "string" && record.importedAt.length > 0 && (record.textFile === void 0 || typeof record.textFile === "string") && Array.isArray(record.metrics) && record.metrics.every(isMetricSnapshot) && typeof record.hot === "boolean" && typeof record.favorite === "boolean" && record.via === "manual" && (record.gatheredRef === void 0 || typeof record.gatheredRef === "string") && isAnalysis(record.analysis);
}
/** Structural validation for one report entry. */
function isReport$1(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.id === "string" && record.id.length > 0 && (record.kind === "account" || record.kind === "compare") && isStringArray(record.accountIds) && record.accountIds.length > 0 && isStringArray(record.accountNames) && record.accountNames.length > 0 && typeof record.ref === "string" && record.ref.length > 0 && typeof record.createdAt === "string" && record.createdAt.length > 0 && typeof record.workCount === "number" && Number.isFinite(record.workCount) && record.workCount >= 0;
}
/**
* Parse and validate one manifest document. One malformed entry never hides
* the rest: it is named in `problems` and dropped, like the outputs scanner
* treats bad metadata.
* @param raw - exact file contents.
* @returns the manifest with only valid entries, plus every dropped one named.
*/
function parseCompetitorManifest(raw) {
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {
			manifest: emptyManifest(),
			problems: ["competitor manifest is not valid JSON"]
		};
	}
	const record = parsed;
	if (record.formatVersion !== 0) return {
		manifest: emptyManifest(),
		problems: [`unsupported competitor manifest formatVersion ${String(record.formatVersion)}`]
	};
	const syncedAt = {};
	const problems = [];
	if (record.syncedAt !== void 0) if (typeof record.syncedAt !== "object" || record.syncedAt === null) problems.push("competitor manifest syncedAt is not an object");
	else for (const [accountId, instant] of Object.entries(record.syncedAt)) if (typeof instant === "string" && instant.length > 0) syncedAt[accountId] = instant;
	else problems.push(`dropped one invalid competitor syncedAt entry: ${JSON.stringify(accountId).slice(0, 80)}`);
	const works = [];
	if (record.works !== void 0) if (!Array.isArray(record.works)) problems.push("competitor manifest works is not an array");
	else for (const entry of record.works) if (isWork(entry)) works.push(entry);
	else problems.push(`dropped one invalid competitor work: ${JSON.stringify(entry).slice(0, 120)}`);
	const reports = [];
	if (record.reports !== void 0) if (!Array.isArray(record.reports)) problems.push("competitor manifest reports is not an array");
	else for (const entry of record.reports) if (isReport$1(entry)) reports.push(entry);
	else problems.push(`dropped one invalid competitor report: ${JSON.stringify(entry).slice(0, 120)}`);
	return {
		manifest: {
			formatVersion: 0,
			syncedAt,
			works,
			reports
		},
		problems
	};
}
/** The empty manifest every absent or unreadable manifest reads as. */
function emptyManifest() {
	return {
		formatVersion: 0,
		syncedAt: {},
		works: [],
		reports: []
	};
}
/**
* Validate one incoming manifest wholesale; used by the write path to reject
* rather than repair caller mistakes.
* @param manifest - the manifest the caller wants stored.
* @throws when the envelope or any entry violates the format.
*/
function assertCompetitorManifest(manifest) {
	if (manifest.formatVersion !== 0) throw new Error(`unsupported competitor manifest formatVersion ${String(manifest.formatVersion)}`);
	if (typeof manifest.syncedAt !== "object" || manifest.syncedAt === null) throw new Error("competitor manifest syncedAt is not an object");
	if (!Array.isArray(manifest.works)) throw new Error("competitor manifest works is not an array");
	if (!Array.isArray(manifest.reports)) throw new Error("competitor manifest reports is not an array");
	for (const work of manifest.works) if (!isWork(work)) throw new Error(`invalid competitor work: ${JSON.stringify(work).slice(0, 120)}`);
	for (const report of manifest.reports) if (!isReport$1(report)) throw new Error(`invalid competitor report: ${JSON.stringify(report).slice(0, 120)}`);
}
/**
* Read the theme's competitor manifest.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @returns the manifest with only valid entries, plus every dropped one named.
* @throws when the theme name is not a plain project-directory name.
*/
async function readCompetitorManifestFile(root, theme) {
	const file = join(resolveAssetsDir(root, theme), COMPETITOR_MANIFEST_FILENAME);
	let raw;
	try {
		raw = await readFile(file, "utf8");
	} catch {
		return {
			manifest: emptyManifest(),
			problems: []
		};
	}
	return parseCompetitorManifest(raw);
}
/**
* Replace the theme's competitor manifest under a lock with an atomic
* commit. No retention trimming runs here: works carry user markers and
* append-only snapshots, so the caller's list is stored verbatim.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @param manifest - the complete next manifest.
*/
async function writeCompetitorManifestFile(root, theme, manifest) {
	assertCompetitorManifest(manifest);
	await writeAtomicallyLocked(join(resolveAssetsDir(root, theme), COMPETITOR_MANIFEST_FILENAME), `${JSON.stringify(manifest, null, 2)}\n`);
}
//#endregion
//#region lib/types/competitor/ai.js
/**
* AI processing for the competitor write face: three explicit, controlled
* operations behind the competitors view — single-work teardown, single-
* account panorama report, and two-account face-off. Calls ride the shared
* `llm` Service Definition through the same one-shot helper the gather face
* established; the queue runs one call at a time and retries only upstream
* rate limits. Nothing persists here: the caller writes results back into
* the manifest and asset files. Report digests carry aggregated facts only —
* raw work text never enters a report prompt.
*/
/** Timeout reason code carried by aborted competitor AI calls. */
const COMPETITOR_AI_TIMEOUT_CODE = "COMPETITOR_AI_TIMEOUT";
/** The comment-insight value every comment-less teardown carries. */
const COMMENT_INSIGHT_UNAVAILABLE = "unavailable";
/** System prompt: the single-work teardown skill (paradigm borrowing only). */
const ANALYZE_SYSTEM_PROMPT = [
	"你是内容创作工作台的对标账号拆解助手。对给定的一条对标作品（标题、链接、正文或文案、互动数据、可选的热门评论），只做范式借鉴分析，禁止输出可直接替代原文的洗稿文本。输出：",
	"1. hookType：开头钩子类型，从 痛点/悬念/反常识/故事/其他 中判定并用一句话说明；",
	"2. structure：内容结构（段落框架、案例类型、论据方式），不超过 120 字；",
	"3. painPoints：最多 5 条该作品瞄准的人群痛点；",
	"4. topics：最多 5 个选题归类标签；",
	"5. risks：为什么这条内容互动高，以及风险点（同质化、违规词等），最多 5 条；",
	"6. reusable：可复用的范式点，最多 5 条；",
	"7. migrationTopics：基于这条爆款生成的差异化选题建议，最多 5 条；",
	"8. commentInsight：提供热门评论时，总结高赞评论的核心诉求、提问与情绪倾向（不超过 100 字）；未提供评论时输出 unavailable。",
	"只输出一个 JSON 对象，形如 {\"hookType\":\"...\",\"structure\":\"...\",\"painPoints\":[\"...\"],\"topics\":[\"...\"],\"risks\":[\"...\"],\"reusable\":[\"...\"],\"migrationTopics\":[\"...\"],\"commentInsight\":\"...\"}，不要输出其他任何文字。"
].join("\n");
/** System prompt: the report skill (account panorama or two-account face-off). */
const REPORT_SYSTEM_PROMPT$1 = [
	"你是内容创作工作台的对标账号分析助手。输入是一个或两个对标账号的聚合统计摘要（选题分布、钩子类型频次、更新频率、爆款率等，不含作品原文），输出一份 Markdown 分析报告。",
	"单账号报告（kind: account）章节：账号内容策略（选题分布表、固定栏目、更新节奏）；标题与钩子模板；爆款规律（爆款 vs 普通差异）；受众画像（无评论数据时明确标注\"无评论数据\"）；变现路径；短板与机会。",
	"双账号对比报告（kind: compare）章节：选题分布对比；发布频率对比；爆款选题交集与差异；标题钩子风格对比；赛道空白机会点；差异化内容建议。",
	"只输出 Markdown 正文，不要输出其他任何文字。"
].join("\n");
/** Cap for one account digest, keeping report prompts inside the token budget. */
const MAX_DIGEST_CHARS = 1e3;
/**
* Parse the model's JSON answer into the structured teardown result. Model
* output is a JSON boundary: anything that is not the requested object
* rejects here.
* @param text - exact model text output.
* @returns the validated teardown result.
*/
function parseCompetitorAnalysisOutput(text) {
	const record = parseJsonObject(text);
	const list = (value) => {
		if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new Error("competitor AI output has an invalid string array");
		return value.slice(0, 8).map((item) => item.trim()).filter((item) => item.length > 0);
	};
	if (typeof record.hookType !== "string" || record.hookType.trim().length === 0) throw new Error("competitor AI output has no hookType");
	if (typeof record.structure !== "string" || record.structure.trim().length === 0) throw new Error("competitor AI output has no structure");
	const commentInsight = typeof record.commentInsight === "string" && record.commentInsight.trim().length > 0 ? record.commentInsight.trim() : COMMENT_INSIGHT_UNAVAILABLE;
	return {
		hookType: record.hookType.trim(),
		structure: record.structure.trim(),
		painPoints: list(record.painPoints),
		topics: list(record.topics),
		risks: list(record.risks),
		reusable: list(record.reusable),
		migrationTopics: list(record.migrationTopics),
		commentInsight
	};
}
/**
* Parse the model's answer into the report result: the markdown body only.
* @param text - exact model text output.
* @returns the non-empty markdown report.
*/
function parseCompetitorReportOutput(text) {
	const markdown = text.trim();
	if (markdown.length === 0) throw new Error("competitor AI report is empty");
	return { markdown };
}
/** Extract and JSON-parse the first object in the model output, tolerating fences. */
function parseJsonObject(text) {
	const fenced = text.trim().replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "");
	const start = fenced.indexOf("{");
	const end = fenced.lastIndexOf("}");
	if (start === -1 || end <= start) throw new Error("competitor AI output contains no JSON object");
	let parsed;
	try {
		parsed = JSON.parse(fenced.slice(start, end + 1));
	} catch {
		throw new Error("competitor AI output is not valid JSON");
	}
	if (typeof parsed !== "object" || parsed === null) throw new Error("competitor AI output is not a JSON object");
	return parsed;
}
/**
* The queued AI processor owned by the content-outputs gateway for the
* competitors view; not itself a cordis service — the gateway carries the
* `llm` injection and the config.
*/
var CompetitorAiProcessor = class {
	ctx;
	/** Call policy shared with the gather face's resolved config. */
	policy;
	/** Single-slot call queue: one model call at a time, per the gather policy. */
	queue = new PQueue({ concurrency: 1 });
	/**
	* @param ctx - context exposing the registered LLM service.
	* @param config - declared AI policy; defaults resolve in the gather face's
	*   validation rules, so both faces stay on one policy.
	*/
	constructor(ctx, config) {
		this.ctx = ctx;
		const timeoutMs = config.timeoutMs ?? 6e4;
		const maxOutputTokens = config.maxOutputTokens ?? 2e3;
		if (!Number.isInteger(timeoutMs) || timeoutMs < 1e3 || timeoutMs > 6e5) throw new Error("contentOutputs aiTimeoutMs must be an integer from 1000 through 600000");
		if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 32e3) throw new Error("contentOutputs aiMaxOutputTokens must be an integer from 256 through 32000");
		this.policy = {
			provider: config.provider ?? "deepseek",
			model: config.model ?? "deepseek-chat",
			timeoutMs,
			maxOutputTokens
		};
	}
	/**
	* Tear down one work through the model. Rate limits retry with backoff;
	* every other failure surfaces immediately so the UI can offer its own
	* retry button.
	* @param request - the work's display facts, snapshot reference, and any
	*   user-pasted hot comments.
	* @param readSnapshot - reads one text file body (theme, file name).
	* @returns the structured teardown plus the full markdown report.
	*/
	async analyzeWork(request, readSnapshot) {
		if (request.title.trim().length === 0) throw new Error("competitor AI work has no title");
		const text = await this.collectWorkText(request, readSnapshot);
		const framed = [
			`标题：${request.title}`,
			request.url === void 0 ? "" : `链接：${request.url}`,
			`互动数据：${request.stats ?? "未知"}`,
			text,
			request.comments === void 0 || request.comments.trim().length === 0 ? "热门评论：未提供" : `热门评论：\n${request.comments.trim().slice(0, 4e3)}`
		].filter((part) => part.length > 0).join("\n\n");
		const result = parseCompetitorAnalysisOutput(await this.enqueue(() => streamLlmText(this.ctx, this.policy, ANALYZE_SYSTEM_PROMPT, framed, COMPETITOR_AI_TIMEOUT_CODE)));
		return {
			...result,
			markdown: renderAnalysisMarkdown(request.title, request.url, result)
		};
	}
	/**
	* Generate one report from aggregated account digests. Raw work text never
	* enters this call — the digests are the caller's aggregation.
	* @param request - one digest for an account report, exactly two for compare.
	* @returns the markdown report.
	*/
	async generateReport(request) {
		const expected = request.kind === "account" ? 1 : 2;
		if (request.accounts.length !== expected) throw new Error(`competitor ${request.kind} report needs exactly ${expected} account digest(s)`);
		for (const digest of request.accounts) {
			if (digest.name.trim().length === 0) throw new Error("competitor report digest has no account name");
			if (digest.digest.trim().length === 0) throw new Error("competitor report digest has no content");
		}
		const framed = request.accounts.map((digest) => `【账号：${digest.name}】\n${digest.digest.trim().slice(0, MAX_DIGEST_CHARS)}`).join("\n\n") + `\n\n报告类型：${request.kind === "account" ? "account（单账号全景）" : "compare（双账号对比）"}`;
		return parseCompetitorReportOutput(await this.enqueue(() => streamLlmText(this.ctx, this.policy, REPORT_SYSTEM_PROMPT$1, framed, COMPETITOR_AI_TIMEOUT_CODE)));
	}
	/** One queued call with the shared rate-limit retry policy wrapped around it. */
	enqueue(call) {
		return pRetry(() => this.queue.add(call), {
			retries: 4,
			minTimeout: 1e3,
			maxTimeout: 3e4,
			factor: 2,
			shouldRetry: isRateLimitError,
			onFailedAttempt: (error) => honorRetryAfter(error)
		});
	}
	/** Gather the model input: snapshot text when present; a teardown needs some body. */
	async collectWorkText(request, readSnapshot) {
		let text = "";
		if (request.textFile !== void 0 && request.theme !== void 0) {
			const raw = await readSnapshot(request.theme, request.textFile);
			text = raw === void 0 ? "" : htmlToText(raw);
		}
		text = text.trim();
		if (text.length === 0 && (request.stats === void 0 || request.stats.trim().length === 0)) throw new Error("competitor AI work has no content to analyze");
		return text.slice(0, 6e4);
	}
};
/** Render the persisted teardown report around the structured result. */
function renderAnalysisMarkdown(title, url, result) {
	return `${[
		`# 对标作品拆解：${title}`,
		"",
		url === void 0 ? "" : `来源：${url}`,
		"",
		"## 钩子类型",
		result.hookType,
		"",
		"## 内容结构",
		result.structure,
		"",
		"## 人群痛点",
		...result.painPoints.map((point) => `- ${point}`),
		"",
		"## 选题归类",
		...result.topics.map((topic) => `- ${topic}`),
		"",
		"## 爆点与风险",
		...result.risks.map((risk) => `- ${risk}`),
		"",
		"## 可复用点",
		...result.reusable.map((item) => `- ${item}`),
		"",
		"## 可迁移选题建议",
		...result.migrationTopics.map((topic) => `- ${topic}`),
		"",
		"## 评论洞察",
		result.commentInsight,
		"",
		"---",
		"仅供内部研究使用（范式借鉴）。"
	].join("\n")}\n`;
}
//#endregion
//#region lib/types/create/types.js
/**
* Wire vocabulary of the content-outputs create face: the creation workbench
* state stored as `assets/_create.json`, the theme-root publishing handoff,
* and the one-shot AI generation/rewrite calls. Client-safe by construction —
* no Node or filesystem imports.
*/
/** All content types, in picker order; the store and the AI face validate against this list. */
const CREATE_CONTENT_TYPES = [
	"gzh-article",
	"xhs-note",
	"video-script",
	"voiceover",
	"product-page",
	"rewrite"
];
/** All rewrite operations, in toolbar order. */
const CREATE_REWRITE_OPERATIONS = [
	"condense",
	"expand",
	"style",
	"perspective",
	"extract",
	"humanize-light",
	"humanize-deep",
	"titles"
];
/** Style choices of the `style` operation, in toolbar order. */
const CREATE_STYLES = [
	"professional",
	"friendly",
	"hardcore",
	"story",
	"concise"
];
/** All grades, weakest last; the AI face validates against this list. */
const CREATE_GRADES = [
	"优",
	"良",
	"中",
	"弱"
];
//#endregion
//#region lib/types/create/store.js
/**
* On-disk store for the create write face: the `_create.json` manifest and
* the publishing handoff under `outputs/<theme>/`. Paths enter through the
* guards here — a theme is one plain directory name and a deliverable is one
* plain file name at the theme root, so `..`, absolute paths, and separator
* tricks cannot reach anything else. Manifest and metadata writes serialize
* through the shared file lock and commit with an atomic rename (with the
* Windows rename-pinning retry the gather write face established). A
* malformed manifest rejects whole: unlike gather materials, a version list
* must stay consistent, so no entry is ever dropped or repaired.
*/
/** Template bank file name at the outputs library root. */
const CREATE_TEMPLATES_FILENAME = "_templates.json";
/** The placeholder whitelist a custom template body may carry. */
const CREATE_TEMPLATE_PLACEHOLDERS = [
	"title",
	"audience",
	"points",
	"references",
	"profile"
];
/** Manifest file name inside the theme's `assets/` directory. */
const CREATE_MANIFEST_FILENAME = "_create.json";
/** Hard version-count cap enforced on write; the client prunes to its own lower quota. */
const CREATE_MAX_STORED_VERSIONS = 60;
/** Hard per-version size cap; generation and drafts stay far below it. */
const CREATE_MAX_CONTENT_CHARS = 4e5;
/** Whether the value is one well-typed content type. */
function isContentType$1(value) {
	return typeof value === "string" && CREATE_CONTENT_TYPES.includes(value);
}
/** Whether the value carries the style provenance of one version. */
function isProfileRef(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	const mode = record.mode;
	return (mode === "profile" || mode === "inline") && typeof record.digest === "string" && record.digest.length > 0;
}
/** Whether the value is one advisory grade. */
function isGrade$1(value) {
	return typeof value === "string" && CREATE_GRADES.includes(value);
}
/** Whether the value is one evaluated dimension with a grade and a short reason. */
function isDimension$1(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return isGrade$1(record.grade) && typeof record.reason === "string" && record.reason.trim().length > 0;
}
/** Whether the value carries one stored AI evaluation. */
function isEvaluation(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.model === "string" && record.model.length > 0 && typeof record.promptVersion === "number" && Number.isInteger(record.promptVersion) && typeof record.evaluatedAt === "string" && record.evaluatedAt.length > 0 && isGrade$1(record.grade) && isDimension$1(record.attraction) && isDimension$1(record.readability) && isDimension$1(record.differentiation) && isDimension$1(record.audienceFit);
}
/** Whether one stored version has every field present and well-typed. */
function isVersion(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.v === "number" && Number.isInteger(record.v) && record.v >= 1 && typeof record.ts === "string" && record.ts.length > 0 && typeof record.trigger === "string" && record.trigger.length > 0 && typeof record.words === "number" && Number.isInteger(record.words) && record.words >= 0 && typeof record.content === "string" && record.content.length <= 4e5 && typeof record.pinned === "boolean" && (record.profileRef === null || isProfileRef(record.profileRef)) && (record.evaluation === void 0 || record.evaluation === null || isEvaluation(record.evaluation));
}
/** Whether the value carries the creation bookkeeping mirrored into metadata. */
function isCreateState(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.currentVersion === "number" && Number.isInteger(record.currentVersion) && record.currentVersion >= 0 && (record.publishedVersion === null || typeof record.publishedVersion === "number" && Number.isInteger(record.publishedVersion)) && (record.publishedPath === null || typeof record.publishedPath === "string") && (record.publishedAt === null || typeof record.publishedAt === "string");
}
/** Whether the value carries the editable generation context. */
function isContext(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	const isText = (field) => field === null || typeof field === "string";
	return isText(record.audience) && isText(record.points) && isText(record.references);
}
/** Whether the manifest envelope and every version conform; one violation rejects whole. */
function assertCreateManifest(manifest) {
	if (manifest.formatVersion !== 0) throw new Error(`unsupported create manifest formatVersion ${String(manifest.formatVersion)}`);
	if (typeof manifest.contentId !== "string" || manifest.contentId.length === 0) throw new Error("create manifest has no contentId");
	if (!isContentType$1(manifest.contentType)) throw new Error(`invalid create contentType: ${String(manifest.contentType)}`);
	if (typeof manifest.currentVersion !== "number" || !Number.isInteger(manifest.currentVersion) || manifest.currentVersion < 0) throw new Error("create manifest currentVersion must be a non-negative integer");
	if (!isContext(manifest.context)) throw new Error("create manifest context is malformed");
	if (!Array.isArray(manifest.versions)) throw new Error("create manifest has no versions array");
	if (manifest.versions.length > 60) throw new Error(`create manifest exceeds 60 versions`);
	for (const version of manifest.versions) if (!isVersion(version)) throw new Error(`invalid create version: ${JSON.stringify(version).slice(0, 120)}`);
	if (!Array.isArray(manifest.sources)) throw new Error("create manifest has no sources array");
}
/**
* Parse and validate one manifest document. The manifest rejects whole on
* any violation — a truncated or hand-edited file never loads as partial
* state; the caller shows the problem and keeps the last known state.
* @param raw - exact file contents.
* @returns the manifest, or null with a problem when it does not conform.
*/
function parseCreateManifest(raw) {
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {
			manifest: null,
			problems: ["create manifest is not valid JSON"]
		};
	}
	try {
		assertCreateManifest(parsed);
	} catch (error) {
		return {
			manifest: null,
			problems: [error instanceof Error ? error.message : String(error)]
		};
	}
	return {
		manifest: parsed,
		problems: []
	};
}
/**
* Read the theme's creation state: the validated manifest plus the current
* draft body (`assets/<contentId>.md`). A missing state reads as empty
* without problems; a malformed manifest reads as empty with the rejection
* named, so the UI can warn instead of silently overwriting it.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @returns the manifest (or null) and the draft body (or null).
*/
async function readCreateStateFile(root, theme) {
	const assetsDir = resolveAssetsDir(root, theme);
	let raw;
	try {
		raw = await readFile(join(assetsDir, CREATE_MANIFEST_FILENAME), "utf8");
	} catch {
		return {
			manifest: null,
			draft: null,
			problems: []
		};
	}
	const { manifest, problems } = parseCreateManifest(raw);
	if (manifest === null) return {
		manifest: null,
		draft: null,
		problems
	};
	let draft = null;
	try {
		draft = await readFile(join(assetsDir, `${manifest.contentId}.md`), "utf8");
	} catch {}
	return {
		manifest,
		draft,
		problems
	};
}
/**
* Replace the theme's creation manifest with an atomic, locked commit.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @param manifest - the complete next manifest.
*/
async function writeCreateStateFile(root, theme, manifest) {
	assertCreateManifest(manifest);
	await writeAtomicallyLocked(join(resolveAssetsDir(root, theme), CREATE_MANIFEST_FILENAME), `${JSON.stringify(manifest, null, 2)}\n`);
}
/** Deliverable file names sit at the theme root: plain, never system-prefixed, never the metadata file. */
function isRootFileName(file) {
	return file.length > 0 && !file.includes("/") && !file.includes("\\") && file !== "." && file !== ".." && !file.startsWith(".") && !file.startsWith("_") && !/[\u0000-\u001f]/.test(file);
}
/**
* Resolve and guard one theme-root file path.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @param file - plain deliverable file name at the theme root.
* @returns the absolute file path.
* @throws when the theme or file name could escape the theme directory.
*/
function resolveThemeFilePath(root, theme, file) {
	if (!isRootFileName(file)) throw new Error(`invalid create deliverable file name: ${JSON.stringify(file)}`);
	if (theme.length === 0 || theme.includes("/") || theme.includes("\\") || theme.startsWith(".") || theme.startsWith("_")) throw new Error(`invalid create theme name: ${JSON.stringify(theme)}`);
	return join(root, theme, file);
}
/**
* Publish one deliverable: copy the given content to the theme root under an
* atomic, locked commit. A collision rejects instead of overwriting unless
* `overwrite` is set — the caller confirms with the user first. The metadata
* registration is a separate, later write so a failure between the two steps
* is recoverable through the register retry.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @param request - file name, complete content, and the overwrite decision.
* @returns the stored root file name.
*/
async function publishFinalFile(root, theme, request) {
	if (request.content.length > 4e5) throw new Error(`create deliverable exceeds the ${CREATE_MAX_CONTENT_CHARS}-character cap`);
	const target = resolveThemeFilePath(root, theme, request.file);
	if (!request.overwrite) {
		let exists = false;
		try {
			await lstat(target);
			exists = true;
		} catch (error) {
			if (error?.code !== "ENOENT") throw error;
		}
		if (exists) throw new Error(`deliverable ${request.file} already exists in ${theme}`);
	}
	await writeAtomicallyLocked(target, request.content);
	return request.file;
}
/**
* Validate one metadata document on the create write path: the known fields
* keep the scanner's format-0 rules, unknown fields pass through untouched,
* and the optional `create` bookkeeping must be well-typed when present.
* @param metadata - the metadata the caller wants stored.
*/
function assertOutputMetadata(metadata) {
	const record = metadata;
	if (parseMetadata(JSON.stringify(record)) === void 0) throw new Error("output metadata violates the format-0 rules");
	if (record.create !== void 0 && !isCreateState(record.create)) throw new Error("output metadata create state is malformed");
}
/**
* Resolve and guard one theme's `.dsh-output.json` path.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @returns the absolute metadata path.
* @throws when the theme name could escape the library root.
*/
function resolveThemeMetadataPath(root, theme) {
	if (theme.length === 0 || theme.includes("/") || theme.includes("\\") || theme === "." || theme === ".." || theme.startsWith(".") || theme.startsWith("_")) throw new Error(`invalid create theme name: ${JSON.stringify(theme)}`);
	return join(root, theme, METADATA_FILENAME);
}
/**
* Read and validate the theme's `.dsh-output.json`.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @returns the metadata, or null with the violation named when the file is
*   absent (null metadata, no problem) or malformed (both set).
*/
async function readCreateMetadataFile(root, theme) {
	let raw;
	try {
		raw = await readFile(resolveThemeMetadataPath(root, theme), "utf8");
	} catch {
		return {
			metadata: null,
			problem: null
		};
	}
	const metadata = parseMetadata(raw);
	return metadata === void 0 ? {
		metadata: null,
		problem: "metadata violates the format-0 rules"
	} : {
		metadata,
		problem: null
	};
}
/**
* Register one publish into the theme's metadata: flip the status to
* `published` and mirror the creation bookkeeping. The deliverable must
* already sit at the theme root — this is the retry half of the publish
* handoff, never the copy.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @param request - the root file name and the version being published.
*/
async function registerCreatePublishFile(root, theme, request) {
	const deliverable = resolveThemeFilePath(root, theme, request.file);
	try {
		await lstat(deliverable);
	} catch {
		throw new Error(`deliverable ${request.file} is not in ${theme}; publish before registering`);
	}
	const { metadata, problem } = await readCreateMetadataFile(root, theme);
	if (metadata === null) throw new Error(problem !== null ? "existing output metadata violates the format-0 rules" : `theme ${theme} has no output metadata to register the publish into`);
	await writeOutputMetadataFile(root, theme, {
		...metadata,
		status: "published",
		create: {
			currentVersion: request.version,
			publishedVersion: request.version,
			publishedPath: request.file,
			publishedAt: (/* @__PURE__ */ new Date()).toISOString()
		}
	});
}
/**
* Write the theme's `.dsh-output.json` with an atomic, locked commit after
* validating the known fields and the creation bookkeeping.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @param metadata - the complete next metadata record.
*/
async function writeOutputMetadataFile(root, theme, metadata) {
	assertOutputMetadata(metadata);
	await writeAtomicallyLocked(join(root, theme, METADATA_FILENAME), `${JSON.stringify(metadata, null, 2)}\n`);
}
/**
* Collect the asset files the theme's creation state references, for the
* gather retention exemption: a gather material whose snapshot file is
* referenced by the create workbench must never be trimmed as stale.
* A malformed create manifest contributes an empty set — trimming then runs
* by its own rules, which is the safe direction (worst case a referenced
* snapshot ages out; the versions carry the text).
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @returns the referenced asset file names.
*/
async function collectCreateReferencedFiles(root, theme) {
	const { manifest } = await readCreateStateFile(root, theme);
	const files = /* @__PURE__ */ new Set();
	if (manifest !== null) {
		for (const source of manifest.sources) if (source.file !== null && source.file.length > 0) files.add(source.file);
	}
	return files;
}
/**
* List the theme's non-system asset file names, sorted. Serves the material
* reference list and the image inserter; `_`-prefixed system files (the
* gather and create manifests) never appear.
* @param root - absolute outputs library root.
* @param theme - outputs-project directory name.
* @returns the sorted plain file names.
*/
async function listAssetFiles(root, theme) {
	const assetsDir = resolveAssetsDir(root, theme);
	await mkdir(assetsDir, { recursive: true });
	return (await readdir(assetsDir, { withFileTypes: true })).filter((entry) => entry.isFile() && !entry.name.startsWith(".") && !entry.name.startsWith("_")).map((entry) => entry.name).sort();
}
/** Whether one value is one stored custom template. */
function isTemplate(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.id === "string" && record.id.length > 0 && typeof record.title === "string" && record.title.length > 0 && isContentType$1(record.contentType) && typeof record.body === "string" && record.body.length > 0 && typeof record.revision === "number" && Number.isInteger(record.revision) && record.revision >= 1 && typeof record.updatedAt === "string" && record.updatedAt.length > 0;
}
/**
* Validate one custom template body: non-empty, and its `{{…}}` placeholders
* stay inside the whitelist — an unknown placeholder fails the save here and
* the run there, never silently misfills.
* @param body - the template body.
* @throws when the body is empty or carries an unknown placeholder.
*/
function assertTemplateBody(body) {
	if (body.trim().length === 0) throw new Error("create template body is empty");
	for (const match of body.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/gu)) {
		const name = match[1] ?? "";
		if (!CREATE_TEMPLATE_PLACEHOLDERS.includes(name)) throw new Error(`create template body carries an unknown placeholder {{${name}}}; allowed: ${CREATE_TEMPLATE_PLACEHOLDERS.map((placeholder) => `{{${placeholder}}}`).join(" ")}`);
	}
}
/**
* Read the global template bank. A missing file reads as empty; a malformed
* bank reads as empty with the rejection named, so the manager can warn
* instead of silently overwriting it.
* @param root - absolute outputs library root.
* @returns the valid templates plus every rejection named.
*/
async function readCreateTemplatesFile(root) {
	let raw;
	try {
		raw = await readFile(join(root, CREATE_TEMPLATES_FILENAME), "utf8");
	} catch {
		return {
			templates: [],
			problems: []
		};
	}
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {
			templates: [],
			problems: ["create template bank is not valid JSON"]
		};
	}
	const record = parsed;
	if (record.formatVersion !== 0 || !Array.isArray(record.templates)) return {
		templates: [],
		problems: ["create template bank violates the format-0 rules"]
	};
	const templates = [];
	const problems = [];
	for (const entry of record.templates) if (isTemplate(entry)) templates.push(entry);
	else problems.push(`dropped one invalid create template: ${JSON.stringify(entry).slice(0, 120)}`);
	return {
		templates,
		problems
	};
}
/**
* Upsert one custom template: an absent id creates (revision 1), a present
* id updates and bumps the revision. The bank rewrites with an atomic,
* locked commit; the read-modify-write window is the same granularity the
* gather manifest face accepts for this single-user data class.
* @param root - absolute outputs library root.
* @param input - the template facts; timestamps and the revision are store-managed.
* @returns the stored templates.
*/
async function putCreateTemplateFile(root, input) {
	if (input.title.trim().length === 0) throw new Error("create template needs a non-empty title");
	if (input.title.length > 60) throw new Error("create template title exceeds 60 characters");
	if (!isContentType$1(input.contentType)) throw new Error(`invalid create contentType: ${String(input.contentType)}`);
	assertTemplateBody(input.body);
	const { templates } = await readCreateTemplatesFile(root);
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const next = input.id === void 0 ? [...templates, {
		id: `ct-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
		title: input.title.trim(),
		contentType: input.contentType,
		body: input.body,
		revision: 1,
		updatedAt: now
	}] : templates.map((template) => template.id === input.id ? {
		...template,
		title: input.title.trim(),
		contentType: input.contentType,
		body: input.body,
		revision: template.revision + 1,
		updatedAt: now
	} : template);
	await writeAtomicallyLocked(join(root, CREATE_TEMPLATES_FILENAME), `${JSON.stringify({
		formatVersion: 0,
		templates: next
	}, null, 2)}\n`);
	return next;
}
/**
* Delete one custom template; deleting an unknown id is a no-op.
* @param root - absolute outputs library root.
* @param id - the template id.
* @returns the stored templates.
*/
async function deleteCreateTemplateFile(root, id) {
	const { templates } = await readCreateTemplatesFile(root);
	const next = templates.filter((template) => template.id !== id);
	await writeAtomicallyLocked(join(root, CREATE_TEMPLATES_FILENAME), `${JSON.stringify({
		formatVersion: 0,
		templates: next
	}, null, 2)}\n`);
	return next;
}
//#endregion
//#region lib/types/create/ai.js
/**
* AI processing for the create write face: one explicit, controlled model
* call per request behind the workbench's generate and rewrite buttons. Calls
* ride the same shared `llm` Service Definition, one-shot pattern, queue, and
* rate-limit retry policy as the gather and competitor AI faces; nothing is
* persisted here — the caller writes the text back as a version snapshot.
*/
/** Timeout reason code carried by aborted create AI calls. */
const CREATE_AI_TIMEOUT_CODE = "CREATE_AI_TIMEOUT";
/** Prompt vocabulary version pinned into every result for provenance. */
const CREATE_PROMPT_VERSION = 1;
/** Chinese labels of the style switch, as the prompts phrase them. */
const STYLE_LABELS = {
	professional: "专业",
	friendly: "亲切",
	hardcore: "硬核",
	story: "故事化",
	concise: "简短有力"
};
/** Per-type creation briefs: the six built-in templates' output contracts. */
const TYPE_BRIEFS = {
	"gzh-article": [
		"写一篇公众号文章：给出 1 个主标题（吸睛但不标题党）、一段导语（3 句内建立钩子）、",
		"正文分 3-5 个小节（每节一个小标题）、一个互动引导结尾、文末 3-5 个话题标签。",
		"全文 1500-2500 字，Markdown 输出，标题用 # 层级。"
	].join(""),
	"xhs-note": [
		"写一篇小红书图文笔记：给出 1 个带 emoji 的标题（20 字内）、分段正文（每段 ≤80 字，",
		"段间空行）、每段可配一张图的配图提示词（格式：[配图 N] 描述）、文末话题标签",
		"（#标签# 格式，5-8 个）。总字数 300-800 字，Markdown 输出。"
	].join(""),
	"video-script": [
		"写一条短视频脚本：前 3 秒钩子开场，之后按镜头分节（镜头 1、镜头 2……），每镜给出",
		"台词、时长（秒）与画面提示，结尾行动引导。总时长控制在 45-90 秒，口语化，",
		"Markdown 输出（每镜一个小节，台词与画面提示分行）。"
	].join(""),
	voiceover: ["写一篇口播稿：自然口语，短句为主，标注停顿（用「（停顿）」），开头 3 句内进入主题，", "结尾有引导。不写镜头与画面，只写要说的话。全文 300-1200 字，Markdown 输出。"].join(""),
	"product-page": [
		"写一页商品详情文案：卖点拆解（3-5 个卖点，每个一句话+一段展开）、用户痛点呼应、",
		"关键参数列表、信任背书（资质/销量/口碑角度）、转化引导结尾。避免绝对化用语，",
		"Markdown 输出。"
	].join(""),
	rewrite: ["对给定素材做文案二创：保留核心事实与观点，重写表达。先给 1 个新标题，再输出改写", "后的全文，Markdown 输出。不要逐句翻译式改写，要重组结构换个讲法。"].join("")
};
/**
* Build the system prompt for one generation: the type brief, the style
* provenance, and the shared output discipline.
* @param request - the generation request.
* @returns the complete system prompt.
*/
function generateSystemPrompt(request) {
	const lines = ["你是内容创作工作台的写作助手。遵守：只输出正文内容本身，不要输出解释、前言或 apologies。", TYPE_BRIEFS[request.contentType]];
	if (request.profileDigest !== null) lines.push(`写作风格要求（必须贯穿全文的语气、用词与句式）：${request.profileDigest}`);
	return lines.join("\n");
}
/**
* Frame the user prompt for one generation: identity facts first, then
* audience, points, and reference material.
* @param request - the generation request.
* @returns the complete user prompt.
*/
function generateFramedPrompt(request) {
	return [
		`主题：${request.title}`,
		request.audience === null ? "" : `目标人群：${request.audience}`,
		request.points === null ? "" : `差异化要点：\n${request.points}`,
		request.references === null ? "" : `参考素材（只做参考，不要照抄）：\n${request.references}`
	].filter((part) => part.length > 0).join("\n\n");
}
/** Per-operation rewrite instructions; `style` reads its label from the request. */
function rewriteBrief(operation, style) {
	switch (operation) {
		case "condense": return "把这段文字压缩到原来的一半左右，只删冗余，不改事实与结构。";
		case "expand": return "把这段文字扩写到原来的两倍左右：补细节、补例子、补过渡，不改核心观点。";
		case "style": return `把这段文字改写成「${STYLE_LABELS[style ?? "professional"]}」的风格：调整用词与句式，保留信息量。`;
		case "perspective": return "换一个受众视角重写这段文字（换叙事入口与关切点），保留核心事实。";
		case "extract": return "从这段文字中提炼：3 句金句、3 个备选标题、3 条要点。分三节输出（## 金句 / ## 备选标题 / ## 要点），每节用列表。";
		case "humanize-light": return [
			"轻度去 AI 味：只做词汇与句式调整——删除 AI 高频套话（\"综上所述\"\"值得注意的是\"\"总而言之\"、",
			"\"不是……而是……\"式排比、三连排比、空洞总结段），打散机械句式，调节奏；",
			"禁止改变事实、数据、结构与段落顺序；字数浮动不超过 ±10%。"
		].join("");
		case "humanize-deep": return ["深度去 AI 味：允许重构叙事——换开头钩子、换叙事视角、口语化、补具体细节、重排段落；", "保留全部事实与核心观点，信息量只增不减。"].join("");
		case "titles": return "从全文提炼 5 个备选标题：角度覆盖悬念、数字、痛点、反差、利益承诺，每行一个标题，不要序号，不要解释。";
		default: return "改写这段文字。";
	}
}
/**
* Build the system prompt for one rewrite: the operation brief plus the
* shared discipline (keep facts, output only the rewritten text).
* @param request - the rewrite request.
* @returns the complete system prompt.
*/
function rewriteSystemPrompt(request) {
	return [
		"你是内容创作工作台的改写助手。遵守：只输出改写结果本身，保留原文的事实信息，",
		"不要输出解释或对比说明。",
		rewriteBrief(request.operation, request.style)
	].join("\n");
}
/**
* Validate one generation request and frame it; shared by the remote face.
* @param request - the raw request.
* @param maxInputChars - the combined user-prompt character cap.
* @returns the framed user prompt.
*/
function frameGenerateRequest(request, maxInputChars) {
	if (!isContentType(request.contentType)) throw new Error(`invalid create contentType: ${String(request.contentType)}`);
	const title = request.title.trim();
	if (title.length === 0) throw new Error("create generation needs a non-empty title");
	if (title.length > 200) throw new Error("create generation title exceeds 200 characters");
	return generateFramedPrompt(request).slice(0, maxInputChars);
}
/**
* Validate one rewrite request; shared by the remote face.
* @param request - the raw request.
* @param maxInputChars - the selection character cap.
* @returns the validated selection text.
*/
function validateRewriteRequest(request, maxInputChars) {
	if (!CREATE_REWRITE_OPERATIONS.includes(request.operation)) throw new Error(`invalid create rewrite operation: ${request.operation}`);
	if (request.operation === "style" && (request.style === null || !CREATE_STYLES.includes(request.style))) throw new Error("create rewrite style operation needs a valid style key");
	const text = request.text;
	if (text.trim().length === 0) throw new Error("create rewrite selection is empty");
	if (text.length > maxInputChars) throw new Error(`create rewrite selection exceeds the ${maxInputChars}-character cap`);
	return text;
}
/** Whether the value is one well-typed content type. */
function isContentType(value) {
	return typeof value === "string" && CREATE_CONTENT_TYPES.includes(value);
}
/** Whether the value is one advisory grade. */
function isGrade(value) {
	return typeof value === "string" && CREATE_GRADES.includes(value);
}
/** Whether the value is one evaluated dimension with a grade and a short reason. */
function isDimension(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return isGrade(record.grade) && typeof record.reason === "string" && record.reason.trim().length > 0;
}
/** The only content type short enough for one-request variant batches. */
const BATCHABLE_CONTENT_TYPES = ["xhs-note"];
/**
* Fill one custom template body: whitelisted placeholders take the request
* facts, and any placeholder that survives the fill rejects the run.
* @param body - the validated template body.
* @param request - the generation request.
* @returns the filled user prompt.
*/
function fillCustomTemplate(body, request) {
	const values = {
		title: request.title,
		audience: request.audience ?? "",
		points: request.points ?? "",
		references: request.references ?? "",
		profile: request.profileDigest ?? ""
	};
	const filled = body.replace(/\{\{\s*([\w.-]+)\s*\}\}/gu, (match, name) => values[name] ?? match);
	const leftover = filled.match(/\{\{\s*[\w.-]+\s*\}\}/u);
	if (leftover !== null) throw new Error(`create template carries an unknown placeholder ${leftover[0]}`);
	return filled;
}
/** System-prompt suffix that turns one generation into a JSON variant batch. */
const VARIANT_CONTRACT = ["一次输出 3 套互相差异明显的完整方案（不同角度或结构，不要微调措辞凑数）。", "只输出一个 JSON 对象：{\"variants\":[\"方案一全文\",\"方案二全文\",\"方案三全文\"]}，不要输出其他任何文字。"].join("\n");
/**
* Parse a variant-batch answer into its variants. The model output is a JSON
* boundary: anything that is not the requested array of exactly `expected`
* non-empty strings rejects here.
* @param text - exact model text output.
* @param expected - the requested variant count.
* @returns the trimmed variants.
*/
function parseCreateVariants(text, expected) {
	const fenced = text.trim().replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "");
	const start = fenced.indexOf("{");
	const end = fenced.lastIndexOf("}");
	if (start === -1 || end <= start) throw new Error("create batch output contains no JSON object");
	let parsed;
	try {
		parsed = JSON.parse(fenced.slice(start, end + 1));
	} catch {
		throw new Error("create batch output is not valid JSON");
	}
	const variants = parsed.variants;
	if (!Array.isArray(variants) || variants.length !== expected || !variants.every((variant) => typeof variant === "string" && variant.trim().length > 0)) throw new Error(`create batch output must carry exactly ${expected} non-empty variants`);
	return variants.map((variant) => variant.trim());
}
/**
* Build the system prompt for one evaluation: G-Eval style — list each
* dimension's rubric checkpoints, judge, then emit the fixed JSON.
* @param request - the evaluation request.
* @returns the complete system prompt.
*/
function evaluateSystemPrompt(request) {
	return [
		"你是内容创作工作台的评审助手。按以下步骤评估这篇内容：",
		"1. 吸引力（attraction）：开头 3 句是否建立钩子、标题与内容是否匹配目标人群的兴趣；",
		"2. 可读性（readability）：句长节奏、段落划分、口语与书面的匹配度；",
		"3. 差异化（differentiation）：观点或结构是否与同题材内容拉开了距离；",
		"4. 人群匹配（audienceFit）：用词与案例是否贴合给定的目标人群。",
		"每个维度先在心里列出检查点再评级，只输出结论。评级用四级：优 / 良 / 中 / 弱。",
		"只输出一个 JSON 对象：{\"attraction\":{\"grade\":\"良\",\"reason\":\"一句话依据\"},\"readability\":{...},\"differentiation\":{...},\"audienceFit\":{...},\"grade\":\"总体评级\"}，",
		"reason 不超过 60 字，不要输出其他任何文字。",
		`内容类型：${request.contentType}；标题：${request.title}。`
	].join("\n");
}
/**
* Parse an evaluation answer into the structured result. Model output is a
* JSON boundary: any missing dimension, unknown grade, or empty reason
* rejects here.
* @param text - exact model text output.
* @param model - the model identity recorded into the result.
* @returns the validated evaluation with its provenance.
*/
function parseCreateEvaluation(text, model) {
	const fenced = text.trim().replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "");
	const start = fenced.indexOf("{");
	const end = fenced.lastIndexOf("}");
	if (start === -1 || end <= start) throw new Error("create evaluation output contains no JSON object");
	let parsed;
	try {
		parsed = JSON.parse(fenced.slice(start, end + 1));
	} catch {
		throw new Error("create evaluation output is not valid JSON");
	}
	const record = parsed;
	const dim = (key) => {
		const value = record[key];
		if (!isDimension(value)) throw new Error(`create evaluation output has an invalid ${key} dimension`);
		return {
			grade: value.grade,
			reason: value.reason.trim().slice(0, 120)
		};
	};
	if (!isGrade(record.grade)) throw new Error("create evaluation output has an invalid overall grade");
	return {
		model,
		promptVersion: 1,
		evaluatedAt: (/* @__PURE__ */ new Date()).toISOString(),
		grade: record.grade,
		attraction: dim("attraction"),
		readability: dim("readability"),
		differentiation: dim("differentiation"),
		audienceFit: dim("audienceFit")
	};
}
/**
* Validate one evaluation request; shared by the remote face.
* @param request - the raw request.
* @param maxInputChars - the text character cap.
* @returns the validated text.
*/
function validateEvaluateRequest(request, maxInputChars) {
	if (!isContentType(request.contentType)) throw new Error(`invalid create contentType: ${String(request.contentType)}`);
	if (request.title.trim().length === 0) throw new Error("create evaluation needs a non-empty title");
	if (request.text.trim().length === 0) throw new Error("create evaluation text is empty");
	if (request.text.length > maxInputChars) throw new Error(`create evaluation text exceeds the ${maxInputChars}-character cap`);
	return request.text;
}
/**
* The queued AI processor behind the create workbench; not itself a cordis
* service — the gateway carries the `llm` injection and passes the resolved
* policy in.
*/
var CreateAiProcessor = class {
	ctx;
	policy;
	/** Single-slot call queue: one model call at a time, shared policy with the other faces. */
	queue = new PQueue({ concurrency: 1 });
	/**
	* @param ctx - context exposing the registered LLM service.
	* @param policy - the gateway's already-resolved AI policy.
	*/
	constructor(ctx, policy) {
		this.ctx = ctx;
		this.policy = policy;
	}
	/**
	* Generate one draft (or, for the short content types, one variant batch)
	* through the model. Rate limits retry with backoff; every other failure
	* surfaces immediately so the UI can offer its retry button.
	* @param request - the generation request; `count: 3` is short-types only.
	* @returns the draft text, the split variants when batched, and provenance.
	*/
	async generate(request) {
		const count = request.count ?? 1;
		if (count === 3 && !BATCHABLE_CONTENT_TYPES.includes(request.contentType)) throw new Error("create generation count 3 is only available for the short content types");
		const custom = request.customTemplate ?? null;
		let system;
		let framed;
		if (custom === null) {
			system = generateSystemPrompt(request);
			framed = frameGenerateRequest(request, this.policy.maxInputChars);
		} else {
			assertTemplateBody(custom.body);
			system = ["你是内容创作工作台的写作助手。遵守：只输出正文内容本身，不要输出解释、前言或 apologies。", request.profileDigest === null ? "" : `写作风格要求（必须贯穿全文的语气、用词与句式）：${request.profileDigest}`].filter((part) => part.length > 0).join("\n");
			framed = fillCustomTemplate(custom.body, request).slice(0, this.policy.maxInputChars);
		}
		if (count === 3) system += `\n${VARIANT_CONTRACT}`;
		return this.queued(system, framed, (text) => {
			if (count === 1) return {
				text,
				variants: null,
				model: this.policy.model,
				promptVersion: 1
			};
			const variants = parseCreateVariants(text, count);
			const first = variants[0];
			if (first === void 0) throw new Error("create AI produced no variants");
			return {
				text: first,
				variants,
				model: this.policy.model,
				promptVersion: 1
			};
		});
	}
	/**
	* Rewrite one selection through the model, under the same retry policy.
	* @param request - the rewrite request.
	* @returns the rewritten text with its provenance.
	*/
	async rewrite(request) {
		const text = validateRewriteRequest(request, this.policy.maxInputChars);
		return this.queued(rewriteSystemPrompt(request), text, (output) => ({
			text: output,
			variants: null,
			model: this.policy.model,
			promptVersion: 1
		}));
	}
	/**
	* Evaluate one draft through the model: four rubric dimensions plus an
	* overall advisory grade. Advisory only — the result never blocks
	* anything, and a failure surfaces to the caller as a normal error.
	* @param request - the evaluation request.
	* @returns the structured evaluation with its provenance.
	*/
	async evaluate(request) {
		const text = validateEvaluateRequest(request, this.policy.maxInputChars);
		return this.queue.add(() => pRetry(async () => {
			return parseCreateEvaluation(await streamLlmText(this.ctx, this.policy, evaluateSystemPrompt(request), text, CREATE_AI_TIMEOUT_CODE), this.policy.model);
		}, {
			retries: 4,
			minTimeout: 1e3,
			maxTimeout: 3e4,
			factor: 2,
			shouldRetry: isRateLimitError,
			onFailedAttempt: (error) => honorRetryAfter(error)
		}));
	}
	/** One queued call with the shared rate-limit retry policy wrapped around it. */
	queued(system, framed, finish) {
		return this.queue.add(() => pRetry(async () => {
			return finish(await streamLlmText(this.ctx, this.policy, system, framed, CREATE_AI_TIMEOUT_CODE));
		}, {
			retries: 4,
			minTimeout: 1e3,
			maxTimeout: 3e4,
			factor: 2,
			shouldRetry: isRateLimitError,
			onFailedAttempt: (error) => honorRetryAfter(error)
		}));
	}
};
//#endregion
//#region lib/types/create/quota.js
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
const CREATE_QUOTA_FILENAME = "_create-quota.json";
/** The gate's own failure: quota and paid-tier rejections the UI presents verbatim. */
var CreateQuotaError = class extends Error {
	/** Stable machine code: `QUOTA_EXCEEDED` or `PAID_TIER_DISABLED`. */
	code;
	constructor(code, message) {
		super(message);
		this.code = code;
	}
};
/**
* Resolve the declared quota policy into its validated form.
* @param config - the declared policy; every field optional.
* @returns the validated policy, fail loud on out-of-range values.
*/
function resolveQuotaConfig(config) {
	const freeDailyGenerates = config.freeDailyGenerates ?? 10;
	const freeDailyRewrites = config.freeDailyRewrites ?? 50;
	if (!Number.isInteger(freeDailyGenerates) || freeDailyGenerates < 0 || freeDailyGenerates > 1e3) throw new Error("contentOutputs freeDailyGenerates must be an integer from 0 through 1000");
	if (!Number.isInteger(freeDailyRewrites) || freeDailyRewrites < 0 || freeDailyRewrites > 5e3) throw new Error("contentOutputs freeDailyRewrites must be an integer from 0 through 5000");
	return {
		freeDailyGenerates,
		freeDailyRewrites,
		paidTierEnabled: config.paidTierEnabled ?? false
	};
}
/** Today's local day key (`YYYY-MM-DD` in the gateway's timezone). */
function localDayKey(now) {
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${now.getFullYear()}-${month}-${day}`;
}
/**
* Whether the stored state is usable for `today`: same day key with sane
* counters. Anything else (absent, malformed, stale) resets to zero.
* @param raw - the parsed file value, or null when absent.
* @param today - today's day key.
* @returns the counters to build on.
*/
function normalizeQuotaState(raw, today) {
	if (typeof raw !== "object" || raw === null) return {
		date: today,
		generates: 0,
		rewrites: 0
	};
	const record = raw;
	if (record.date !== today) return {
		date: today,
		generates: 0,
		rewrites: 0
	};
	const count = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
	return {
		date: today,
		generates: count(record.generates),
		rewrites: count(record.rewrites)
	};
}
/**
* The freemium gate owned by the content-outputs gateway; not itself a
* cordis service. Every consume call reads the counter file under the lock,
* checks the budget, and commits the incremented state atomically.
*/
var CreateQuotaGate = class {
	root;
	/** Validated policy, defaults resolved once at construction. */
	resolved;
	/**
	* @param root - absolute outputs library root (the counter file lives there).
	* @param config - declared quota policy; defaults resolve here, fail loud.
	*/
	constructor(root, config) {
		this.root = root;
		this.resolved = resolveQuotaConfig(config);
	}
	/** Whether the paid-tier features are switched on for this deployment. */
	get paidTierEnabled() {
		return this.resolved.paidTierEnabled;
	}
	/**
	* Charge `units` generations against today's free budget. The paid tier is
	* unmetered by design: the batch size and evaluation are gated by
	* {@link requirePaidFeature} instead.
	* @param units - how many generations the call consumes (1, or 3 for a batch).
	*/
	async consumeGenerate(units) {
		if (this.resolved.paidTierEnabled) return;
		await this.consume("generates", this.resolved.freeDailyGenerates, units, "create quota exceeded: daily generation budget used up");
	}
	/**
	* Charge one rewrite against today's free budget. The paid tier is
	* unmetered by design.
	*/
	async consumeRewrite() {
		if (this.resolved.paidTierEnabled) return;
		await this.consume("rewrites", this.resolved.freeDailyRewrites, 1, "create quota exceeded: daily rewrite budget used up");
	}
	/**
	* Require the paid-tier switch for the batch and evaluation features.
	* @param feature - the feature name the error names.
	*/
	requirePaidFeature(feature) {
		if (this.resolved.paidTierEnabled) return Promise.resolve();
		return Promise.reject(new CreateQuotaError("PAID_TIER_DISABLED", `create paid tier is not enabled: ${feature}`));
	}
	/** Shared check-and-increment under the file lock, committed atomically. */
	async consume(counter, budget, units, message) {
		const file = join(this.root, CREATE_QUOTA_FILENAME);
		await withFileLock(file, async () => {
			const today = localDayKey(/* @__PURE__ */ new Date());
			let raw = null;
			try {
				raw = JSON.parse(await readFile(file, "utf8"));
			} catch {}
			const state = normalizeQuotaState(raw, today);
			if (state[counter] + units > budget) throw new CreateQuotaError("QUOTA_EXCEEDED", message);
			const next = {
				...state,
				[counter]: state[counter] + units
			};
			await writeFileAtomic(file, `${JSON.stringify(next, null, 2)}\n`, {
				mode: 384,
				dirMode: 448
			});
		});
	}
};
//#endregion
//#region lib/types/persona/types.js
/**
* Wire vocabulary of the persona write face on the content-outputs Remote:
* the account-persona entries behind the 画像 view, their `_personas.json`
* manifest at the library root, and the persona AI operations (field fill,
* résumé extraction, report generation). Client-safe by construction — no
* Node or filesystem imports. Entry text is embedded in the manifest, so a
* persona never references an external file and the manifest is the whole
* backup. Enum label tables live here (not in locales) so the browser
* dropdowns, the packed prompt preview, and the gateway-side digest all read
* one home.
*/
/** Every persona platform, frozen for wire validation and picker order. */
const PERSONA_PLATFORMS = [
	"xhs",
	"douyin",
	"bili",
	"zhihu",
	"wechat",
	"channels",
	"weibo",
	"toutiao"
];
/** Chinese label of one persona platform; shared by the picker, the packed prompt, and the digest. */
const PERSONA_PLATFORM_LABELS = {
	xhs: "小红书",
	douyin: "抖音",
	bili: "B 站",
	zhihu: "知乎",
	wechat: "公众号",
	channels: "视频号",
	weibo: "微博",
	toutiao: "今日头条"
};
/** Every persona field key, frozen for wire validation and form order. */
const PERSONA_FIELD_KEYS = [
	"whoAmI",
	"audience",
	"oneLiner",
	"niche",
	"goal",
	"monetize",
	"contentValue",
	"cadence",
	"phrases"
];
/** Chinese label of one persona field; shared by the wizard, the preview, and the AI prompts. */
const PERSONA_FIELD_LABELS = {
	whoAmI: "我是谁（主体背景）",
	audience: "目标受众",
	oneLiner: "人设一句话简介",
	niche: "赛道 / 行业",
	goal: "核心目标",
	monetize: "变现方式",
	contentValue: "内容核心价值",
	cadence: "更新节奏",
	phrases: "推荐句式 / 表达习惯"
};
/** Field keys the generic fill operation must never produce: the subject background is a fact only the user or the résumé face supplies. */
const PERSONA_FILL_PROHIBITED = ["whoAmI"];
/** Every style preset, frozen for wire validation and picker order. */
const PERSONA_STYLE_PRESETS = [
	"professional",
	"friendly",
	"humor",
	"concise",
	"narrative",
	"hardcore",
	"empathy"
];
/** Chinese label of one style preset; shared by the picker, the packed prompt, and the digest. */
const PERSONA_STYLE_PRESET_LABELS = {
	professional: "专业严谨",
	friendly: "亲切接地气",
	humor: "幽默网感",
	concise: "简洁干练",
	narrative: "故事叙事",
	hardcore: "硬核干货",
	empathy: "温柔共情"
};
//#endregion
//#region lib/types/persona/store.js
/**
* Persona file store: reads and writes the account-persona manifest
* directly on every call. The file lives at the library root under
* `_personas.json` — the `_` prefix keeps the outputs scanner treating it as
* a system entry, and one library directory stays the whole content-creation
* surface on disk. Entry text is embedded; a persona never references a
* file, so the manifest alone is a complete backup and nothing can dangle.
*
* Validation follows the same rule as the outputs scanner: one malformed
* record never hides the rest — it is named in `problems` and skipped. Every
* write, though, refuses to touch a file whose current state dropped
* entries: a save must never be the step that silently deletes user
* personas.
*/
/** System file name of the persona manifest at the library root. */
const PERSONAS_FILENAME = "_personas.json";
const PERSONA_MAX_FIELD_VALUE = 5e3;
const PERSONA_MAX_TEXT = 1e5;
const PERSONA_MAX_URL = 2e3;
const PERSONA_MAX_LINK_TEXT = 5e3;
/** The fields every persona entry carries; wire records must be complete. */
const FIELD_KEYS = PERSONA_FIELD_KEYS;
const PLATFORMS = PERSONA_PLATFORMS;
const PRESETS = PERSONA_STYLE_PRESETS;
const SOURCES = [
	"user",
	"ai",
	"template"
];
const STRENGTHS = ["light", "strict"];
const STAGES = ["fresh", "existing"];
function isRecord(value) {
	return typeof value === "object" && value !== null;
}
function isNullableText(value, max) {
	return value === null || typeof value === "string" && value.length <= max;
}
function isTextField(value, max) {
	return typeof value === "string" && value.length > 0 && value.length <= max;
}
function isField(value) {
	if (!isRecord(value)) return false;
	if (!SOURCES.includes(value.source)) return false;
	if (!isNullableText(value.value, 5e3)) return false;
	if (value.source !== "ai") return value.aiMeta === null;
	if (!isRecord(value.aiMeta)) return false;
	return isTextField(value.aiMeta.promptVersion, 100) && isTextField(value.aiMeta.at, 40);
}
function isFields(value) {
	if (!isRecord(value)) return false;
	return FIELD_KEYS.every((key) => isField(value[key]));
}
function isLink(value) {
	if (!isRecord(value)) return false;
	return PLATFORMS.includes(value.platform) && isTextField(value.url, 2e3) && isNullableText(value.bio, 5e3) && isNullableText(value.sampleText, 5e3);
}
function isWordList(value) {
	return Array.isArray(value) && value.length <= 50 && value.every((word) => isTextField(word, 100));
}
function isStyle(value) {
	if (!isRecord(value)) return false;
	return (value.preset === null || PRESETS.includes(value.preset)) && isNullableText(value.customText, 5e3) && STRENGTHS.includes(value.strength) && isWordList(value.bannedWords) && isWordList(value.redLines);
}
function isReport(value) {
	if (!isRecord(value)) return false;
	return isTextField(value.markdown, 1e5) && typeof value.sourceRevision === "number" && Number.isInteger(value.sourceRevision) && value.sourceRevision >= 1 && typeof value.editedByUser === "boolean" && isTextField(value.generatedAt, 40) && isTextField(value.promptVersion, 100);
}
function isEntry(value) {
	if (!isRecord(value)) return false;
	return isTextField(value.id, 64) && isTextField(value.name, 100) && Array.isArray(value.platforms) && value.platforms.length <= PLATFORMS.length && value.platforms.every((platform) => PLATFORMS.includes(platform)) && STAGES.includes(value.accountStage) && typeof value.revision === "number" && Number.isInteger(value.revision) && value.revision >= 1 && isTextField(value.digest, 200) && isFields(value.fields) && Array.isArray(value.links) && value.links.length <= 10 && value.links.every((link) => isLink(link)) && isRecord(value.site) && isNullableText(value.site.url, 2e3) && isNullableText(value.site.pastedText, 1e5) && isStyle(value.style) && isRecord(value.assets) && isNullableText(value.assets.resumeText, 1e5) && isNullableText(value.assets.resumeName, 2e3) && (value.report === null || isReport(value.report)) && (value.clonedFrom === null || isTextField(value.clonedFrom, 64)) && isTextField(value.createdAt, 40) && isTextField(value.updatedAt, 40);
}
/** Newest save first; the id breaks ties so the order is total and stable. */
function compareEntries(a, b) {
	if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? -1 : 1;
	return a.id < b.id ? -1 : 1;
}
/**
* Parse one stored manifest body. Future on-disk formats never load as
* current records: the version gate mirrors the outputs metadata contract
* (one backend, one format), and invalid JSON is its own refuse-write state.
* @param raw - exact file contents; empty string means the file does not exist yet.
* @returns the parse outcome with every dropped entry named.
*/
function parsePersonasManifest(raw) {
	if (raw.length === 0) return { kind: "empty" };
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {
			kind: "invalid",
			problem: "personas file is not valid JSON"
		};
	}
	const root = parsed;
	if (root.formatVersion !== 0) return {
		kind: "invalid",
		problem: `unsupported personas formatVersion ${String(root.formatVersion)}`
	};
	if (!Array.isArray(root.personas)) return {
		kind: "invalid",
		problem: "personas file has no personas array"
	};
	const personas = [];
	const problems = [];
	for (const entry of root.personas) if (isEntry(entry)) personas.push(entry);
	else problems.push(`dropped one invalid persona record: ${JSON.stringify(entry).slice(0, 120)}`);
	personas.sort(compareEntries);
	return {
		kind: "ok",
		manifest: {
			formatVersion: 0,
			personas
		},
		problems
	};
}
/**
* Read the manifest for the list projection.
* @param file - absolute `_personas.json` path; a missing file is empty.
* @returns the snapshot with entries newest-first and every bad record named.
*/
async function readPersonasFile(file) {
	let raw;
	try {
		raw = await readFile(file, "utf8");
	} catch {
		return {
			personas: [],
			problems: []
		};
	}
	const parsed = parsePersonasManifest(raw);
	if (parsed.kind === "empty") return {
		personas: [],
		problems: []
	};
	if (parsed.kind === "invalid") return {
		personas: [],
		problems: [parsed.problem]
	};
	return {
		personas: parsed.manifest.personas,
		problems: parsed.problems
	};
}
/**
* The deterministic ≤200-character style summary stored as `digest`: the
* identity, style, and intent fields joined in a fixed order, the banned
* words and red lines never included, truncated, and suffixed with the
* revision the summary was computed from. Same content in, same bytes out.
* @param entry - the entry's name, fields, style, and revision.
* @returns the digest text, at most {@link PERSONA_MAX_DIGEST} characters.
*/
function personaDigest(entry) {
	const custom = entry.style.customText?.trim() ?? "";
	const styleText = custom.length > 0 ? custom : entry.style.preset === null ? "" : PERSONA_STYLE_PRESET_LABELS[entry.style.preset];
	const strengthSuffix = entry.style.strength === "strict" ? "（严格遵循）" : "";
	const parts = [
		entry.fields.whoAmI.value,
		styleText.length > 0 ? `${styleText}${strengthSuffix}` : "",
		entry.fields.niche.value,
		entry.fields.audience.value,
		entry.fields.goal.value,
		entry.fields.monetize.value,
		entry.fields.oneLiner.value
	].map((part) => part?.trim() ?? "").filter((part) => part.length > 0);
	const body = (parts.length > 0 ? parts : [entry.name.trim()]).join("；");
	const suffix = `（v${entry.revision}）`;
	const budget = 200 - suffix.length;
	return `${body.length > budget ? body.slice(0, budget) : body}${suffix}`;
}
function normalizeField(value) {
	if (!isRecord(value)) return { detail: "field must be an object" };
	if (!SOURCES.includes(value.source)) return { detail: "unknown field source" };
	const raw = value.value;
	if (raw !== null && typeof raw !== "string") return { detail: "field value must be a string or null" };
	if (typeof raw === "string" && raw.length > 5e3) return { detail: "field value exceeds the length cap" };
	const text = raw === null || raw.trim().length === 0 ? null : raw.trim();
	if (value.source !== "ai") return { field: {
		value: text,
		source: value.source,
		aiMeta: null
	} };
	const meta = value.aiMeta;
	if (!isRecord(meta) || !isTextField(meta.promptVersion, 100) || !isTextField(meta.at, 40)) return { detail: "an ai-sourced field requires its promptVersion and time" };
	return { field: {
		value: text,
		source: "ai",
		aiMeta: {
			promptVersion: meta.promptVersion,
			at: meta.at
		}
	} };
}
function normalizeFields(value) {
	if (!isRecord(value)) return { detail: "fields must be an object" };
	const fields = {};
	for (const key of FIELD_KEYS) {
		const normalized = normalizeField(value[key]);
		if (normalized.field === void 0) return { detail: `${key}: ${normalized.detail}` };
		fields[key] = normalized.field;
	}
	return { fields };
}
function normalizeOptionalText(value, max) {
	if (value === void 0 || value === null) return { text: null };
	if (typeof value !== "string") return { detail: "text must be a string or null" };
	if (value.length > max) return { detail: `text exceeds the ${String(max)}-character cap` };
	return { text: value };
}
function normalizeLinks(value) {
	if (!Array.isArray(value)) return { detail: "links must be an array" };
	if (value.length > 10) return { detail: `links exceed ${String(10)}` };
	const links = [];
	for (const link of value) {
		if (!isRecord(link) || !PLATFORMS.includes(link.platform)) return { detail: "link platform is unknown" };
		if (!isTextField(link.url, 2e3)) return { detail: "link url must be a non-empty string within the cap" };
		const bio = normalizeOptionalText(link.bio, PERSONA_MAX_LINK_TEXT);
		if (bio.text === void 0) return { detail: `link bio: ${bio.detail}` };
		const sample = normalizeOptionalText(link.sampleText, PERSONA_MAX_LINK_TEXT);
		if (sample.text === void 0) return { detail: `link sampleText: ${sample.detail}` };
		links.push({
			platform: link.platform,
			url: link.url.trim(),
			bio: bio.text,
			sampleText: sample.text
		});
	}
	return { links };
}
function normalizeWords(value) {
	if (!Array.isArray(value)) return { detail: "word list must be an array" };
	if (value.length > 50) return { detail: `word list exceeds ${String(50)}` };
	const words = [];
	for (const word of value) {
		if (typeof word !== "string" || word.trim().length === 0) return { detail: "word list entries must be non-empty strings" };
		if (word.length > 100) return { detail: "word list entry exceeds the length cap" };
		words.push(word.trim());
	}
	return { words };
}
function normalizeStyle(value) {
	if (!isRecord(value)) return { detail: "style must be an object" };
	if (value.preset !== null && value.preset !== void 0 && !PRESETS.includes(value.preset)) return { detail: "unknown style preset" };
	if (!STRENGTHS.includes(value.strength)) return { detail: "unknown style strength" };
	const custom = normalizeOptionalText(value.customText, PERSONA_MAX_FIELD_VALUE);
	if (custom.text === void 0) return { detail: `style customText: ${custom.detail}` };
	const banned = normalizeWords(value.bannedWords);
	if (banned.words === void 0) return { detail: `style bannedWords: ${banned.detail}` };
	const red = normalizeWords(value.redLines);
	if (red.words === void 0) return { detail: `style redLines: ${red.detail}` };
	return { style: {
		preset: value.preset ?? null,
		customText: custom.text,
		strength: value.strength,
		bannedWords: banned.words,
		redLines: red.words
	} };
}
function normalizeReport(value) {
	if (value === void 0 || value === null) return { report: null };
	if (!isRecord(value)) return { detail: "report must be an object or null" };
	if (!isTextField(value.markdown, 1e5)) return { detail: "report markdown must be non-empty within the cap" };
	if (typeof value.sourceRevision !== "number" || !Number.isInteger(value.sourceRevision) || value.sourceRevision < 1) return { detail: "report sourceRevision must be a positive integer" };
	if (typeof value.editedByUser !== "boolean") return { detail: "report editedByUser must be a boolean" };
	if (!isTextField(value.generatedAt, 40)) return { detail: "report generatedAt is missing" };
	if (!isTextField(value.promptVersion, 100)) return { detail: "report promptVersion is missing" };
	return { report: {
		markdown: value.markdown,
		sourceRevision: value.sourceRevision,
		editedByUser: value.editedByUser,
		generatedAt: value.generatedAt,
		promptVersion: value.promptVersion
	} };
}
/**
* Validate one upsert input into its stored shape; the revision increments
* from the stored entry, the digest derives from the stored content, and a
* clone (`clonedFrom` on a fresh entry) carries a fresh id and revision 1.
* @param input - the upsert payload from the browser.
* @param existing - the stored entry when `input.id` addresses one.
* @param now - the save instant (ISO 8601).
* @returns the stored entry, or the reason the input is invalid.
*/
function normalizePersonaInput(input, existing, now) {
	if (existing === void 0 && input.id !== void 0 && !isTextField(input.id, 64)) return { detail: "id must be a non-empty string within the cap" };
	if (typeof input.name !== "string" || input.name.trim().length === 0) return { detail: "name must be a non-empty string" };
	if (input.name.length > 100) return { detail: "name exceeds the length cap" };
	if (!Array.isArray(input.platforms)) return { detail: "platforms must be an array" };
	const platforms = input.platforms;
	if (platforms.length > PLATFORMS.length) return { detail: "platforms exceed the word list size" };
	if (!platforms.every((platform) => PLATFORMS.includes(platform))) return { detail: "unknown platform" };
	if (new Set(platforms).size !== platforms.length) return { detail: "platforms must not repeat" };
	if (!STAGES.includes(input.accountStage)) return { detail: "unknown account stage" };
	const fields = normalizeFields(input.fields);
	if (fields.fields === void 0) return { detail: `fields: ${fields.detail}` };
	const links = normalizeLinks(input.links);
	if (links.links === void 0) return { detail: `links: ${links.detail}` };
	const siteUrl = normalizeOptionalText(input.site.url, PERSONA_MAX_URL);
	if (siteUrl.text === void 0) return { detail: `site url: ${siteUrl.detail}` };
	const siteText = normalizeOptionalText(input.site.pastedText, PERSONA_MAX_TEXT);
	if (siteText.text === void 0) return { detail: `site pastedText: ${siteText.detail}` };
	const style = normalizeStyle(input.style);
	if (style.style === void 0) return { detail: `style: ${style.detail}` };
	const resumeText = normalizeOptionalText(input.assets.resumeText, PERSONA_MAX_TEXT);
	if (resumeText.text === void 0) return { detail: `assets resumeText: ${resumeText.detail}` };
	const resumeName = normalizeOptionalText(input.assets.resumeName, PERSONA_MAX_URL);
	if (resumeName.text === void 0) return { detail: `assets resumeName: ${resumeName.detail}` };
	const report = normalizeReport(input.report);
	if (report.report === void 0) return { detail: `report: ${report.detail}` };
	const clonedFrom = normalizeOptionalText(existing === void 0 ? input.clonedFrom : existing.clonedFrom, 64);
	if (clonedFrom.text === void 0) return { detail: `clonedFrom: ${clonedFrom.detail}` };
	const id = existing === void 0 ? input.id ?? randomUUID() : existing.id;
	const revision = existing === void 0 ? 1 : existing.revision + 1;
	const entry = {
		id,
		name: input.name.trim(),
		platforms: [...platforms],
		accountStage: input.accountStage,
		revision,
		digest: "",
		fields: fields.fields,
		links: links.links,
		site: {
			url: siteUrl.text,
			pastedText: siteText.text
		},
		style: style.style,
		assets: {
			resumeText: resumeText.text,
			resumeName: resumeName.text
		},
		report: report.report,
		clonedFrom: clonedFrom.text,
		createdAt: existing?.createdAt ?? now,
		updatedAt: now
	};
	return { entry: {
		...entry,
		digest: personaDigest(entry)
	} };
}
/**
* Read the manifest inside a lock and refuse every state that a write would
* corrupt: invalid JSON, a future format version, or entries a parse had to
* drop. A save must never be the step that silently deletes user personas.
* @param file - absolute `_personas.json` path; parent directories are
*   created when missing.
* @returns the valid stored entries.
*/
async function readForWrite(file) {
	await mkdir(dirname(file), {
		recursive: true,
		mode: 448
	});
	let raw = "";
	try {
		raw = await readFile(file, "utf8");
	} catch {}
	const parsed = parsePersonasManifest(raw);
	if (parsed.kind === "empty") return [];
	if (parsed.kind === "invalid") throw new Error(`refusing to write ${PERSONAS_FILENAME}: ${parsed.problem}`);
	if (parsed.problems.length > 0) throw new Error(`refusing to write ${PERSONAS_FILENAME}: resolve the stored invalid entries first (${String(parsed.problems.length)} dropped)`);
	return [...parsed.manifest.personas];
}
async function writePersonas(file, personas) {
	await writeFileAtomic(file, `${JSON.stringify({
		formatVersion: 0,
		personas
	}, null, 2)}\n`, {
		mode: 384,
		dirMode: 448
	});
}
/**
* Upsert one persona under a file lock, atomically: the revision increments,
* the digest recomputes, and the timestamps are gateway-owned. Creating with
* an id that is absent from the manifest rejects — a stale client must
* reload, not resurrect a deleted persona.
* @param file - absolute `_personas.json` path.
* @param input - the upsert payload from the browser.
* @param now - the save instant (ISO 8601); defaults to the current time.
* @returns the stored entry.
*/
async function putPersonaFile(file, input, now = (/* @__PURE__ */ new Date()).toISOString()) {
	return withFileLock(file, async () => {
		const stored = await readForWrite(file);
		const existing = input.id === void 0 ? void 0 : stored.find((entry) => entry.id === input.id);
		if (input.id !== void 0 && existing === void 0) throw new Error(`unknown persona: ${input.id}`);
		const normalized = normalizePersonaInput(input, existing, now);
		if (normalized.entry === void 0) throw new Error(`invalid persona input: ${normalized.detail}`);
		const entry = normalized.entry;
		await writePersonas(file, [entry, ...stored.filter((candidate) => candidate.id !== entry.id)].sort(compareEntries));
		return entry;
	});
}
/**
* Replace one persona's report without touching its form state: the
* revision and digest stay, `updatedAt` moves. Report edits are a separate
* save path from form saves exactly so the staleness banner (`revision >
* sourceRevision`) tracks form changes only.
* @param file - absolute `_personas.json` path.
* @param id - the persona to update; unknown ids reject.
* @param report - the complete next report.
* @param now - the save instant (ISO 8601); defaults to the current time.
* @returns the stored entry.
*/
async function putPersonaReportFile(file, id, report, now = (/* @__PURE__ */ new Date()).toISOString()) {
	return withFileLock(file, async () => {
		const stored = await readForWrite(file);
		const existing = stored.find((entry) => entry.id === id);
		if (existing === void 0) throw new Error(`unknown persona: ${id}`);
		const normalized = normalizeReport(report);
		if (normalized.report === void 0) throw new Error(`invalid persona report: ${normalized.detail}`);
		const entry = {
			...existing,
			report: normalized.report,
			updatedAt: now
		};
		await writePersonas(file, [entry, ...stored.filter((candidate) => candidate.id !== id)].sort(compareEntries));
		return entry;
	});
}
/**
* Remove one persona under a file lock; the embedded report goes with it,
* and there is no file left to dangle. Removing an unknown id is a no-op.
* @param file - absolute `_personas.json` path.
* @param id - the persona to remove.
*/
async function deletePersonaFile(file, id) {
	await withFileLock(file, async () => {
		const stored = await readForWrite(file);
		const next = stored.filter((entry) => entry.id !== id);
		if (next.length === stored.length) return;
		await writePersonas(file, next);
	});
}
//#endregion
//#region lib/types/persona/ai.js
/**
* AI processing for the persona write face: one explicit, controlled model
* call per request behind the 画像 view's explicit buttons (field fill,
* résumé extraction, report generation). Calls ride the shared `llm` Service
* Definition through the same one-shot helper as the gather and competitor
* faces; the processor runs one call at a time and retries only upstream
* rate limits. Nothing is persisted here: the caller previews the result and
* writes adopted values back through the persona store.
*/
/** Timeout reason code carried by aborted persona AI calls. */
const PERSONA_AI_TIMEOUT_CODE = "PERSONA_AI_TIMEOUT";
/** Prompt version of the blank-field fill face; stamped into adopted fields' provenance. */
const PERSONA_FILL_PROMPT_VERSION = "persona-fill@1";
/** Prompt version of the résumé extraction face; stamped into adopted fields' provenance. */
const PERSONA_RESUME_PROMPT_VERSION = "persona-resume@1";
/** Prompt version of the report face; stamped onto the stored report. */
const PERSONA_REPORT_PROMPT_VERSION = "persona-report@1";
/** Longest single extracted field value accepted from the model. */
const PERSONA_AI_FIELD_CAP = 2e3;
const FILL_SYSTEM_PROMPT = [
	"你是内容创作工作台的账号画像助手。根据已有画像信息，推断并填写空白字段。",
	"要求：",
	"- 基于已有信息做行业通用推断，不得编造具体事实（不要虚构具体的公司名、人名、经历）；",
	"- 每个值不超过 200 字，用中文；",
	"- 只输出一个 JSON 对象，键为字段英文名，不要输出其他任何文字。"
].join("\n");
const RESUME_SYSTEM_PROMPT = [
	"你是内容创作工作台的简历解析助手。从给定的简历或背景文本中提取结构化字段。",
	"字段：whoAmI（主体背景概括，不超过 500 字）、niche（赛道/行业）、audience（目标受众推断）、oneLiner（人设一句话简介）、goal（核心目标推断）、phrases（文字表达习惯）。",
	"要求：",
	"- 只提取文本中有依据的内容；没有依据的字段不要出现在输出里；",
	"- 每个值用中文，不超过 500 字；",
	"- 只输出一个 JSON 对象，不要输出其他任何文字。"
].join("\n");
const REPORT_SYSTEM_PROMPT = [
	"你是内容创作工作台的账号画像报告助手。根据给定的画像事实，输出完整的 Markdown《账号画像报告》。",
	"要求：",
	"- 以 \"# 账号画像报告\" 一级标题开头；",
	"- 依次包含五个部分：账号定位、受众画像、人设要点、表达风格与红线清单、运营建议；",
	"- 事实中标注了\"（AI 推断，供参考）\"的内容，在报告中保留该标注；",
	"- 直接输出 Markdown 正文，不要用代码块包裹。"
].join("\n");
/**
* Extract the JSON object from a model answer: bare JSON parses directly,
* prose-wrapped JSON is cut between the outermost braces. Model output is a
* JSON boundary: anything that is not one object rejects here.
* @param text - exact model text output.
* @returns the parsed object.
*/
function extractJsonObject(text) {
	const stripped = text.trim().replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "");
	let parsed;
	try {
		parsed = JSON.parse(stripped);
	} catch {
		const start = stripped.indexOf("{");
		const end = stripped.lastIndexOf("}");
		if (start === -1 || end <= start) throw new Error("persona AI output contains no JSON object");
		try {
			parsed = JSON.parse(stripped.slice(start, end + 1));
		} catch {
			throw new Error("persona AI output is not valid JSON");
		}
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("persona AI output is not a JSON object");
	return parsed;
}
/**
* Parse a fill or résumé answer into candidate field values. Keys outside
* `allowed` are dropped (the fill face can never produce `whoAmI`), values
* are trimmed and capped, empty values are dropped: the caller previews what
* survives.
* @param text - exact model text output.
* @param allowed - the field keys the caller may receive.
* @returns the candidate values keyed by field.
*/
function parsePersonaFieldsOutput(text, allowed) {
	const record = extractJsonObject(text);
	const fields = {};
	for (const key of PERSONA_FIELD_KEYS) {
		if (!allowed.includes(key)) continue;
		const value = record[key];
		if (typeof value !== "string") continue;
		const trimmed = value.trim().slice(0, PERSONA_AI_FIELD_CAP);
		if (trimmed.length === 0) continue;
		fields[key] = trimmed;
	}
	return fields;
}
/**
* Parse the report answer into its Markdown body: fenced wrappers are
* stripped, and an empty body rejects.
* @param text - exact model text output.
* @returns the report Markdown.
*/
function parsePersonaReportOutput(text) {
	const stripped = text.trim().replace(/^```(?:markdown)?\s*/u, "").replace(/\s*```$/u, "").trim();
	if (stripped.length === 0) throw new Error("persona AI report is empty");
	return stripped.slice(0, PERSONA_MAX_TEXT);
}
/**
* Render one saved entry as the report prompt's fact sheet: every non-empty
* field with its provenance mark, the style and hard constraints, and the
* embedded text assets. AI-sourced values carry the "（AI 推断，供参考）"
* annotation so the report never presents an inference as a user fact.
* @param entry - the saved persona entry.
* @returns the plain-text fact sheet.
*/
function buildFactsText(entry) {
	const platforms = entry.platforms.map((platform) => PERSONA_PLATFORM_LABELS[platform]).join("、");
	const lines = [
		`画像名：${entry.name}`,
		`运营平台：${platforms.length > 0 ? platforms : "未填写"}`,
		`起号状态：${entry.accountStage === "fresh" ? "全新起号" : "已有账号"}`
	];
	for (const key of PERSONA_FIELD_KEYS) {
		const value = entry.fields[key].value;
		if (value === null) continue;
		const mark = entry.fields[key].source === "ai" ? "（AI 推断，供参考）" : "";
		lines.push(`${PERSONA_FIELD_LABELS[key]}：${value}${mark}`);
	}
	const custom = entry.style.customText?.trim() ?? "";
	const styleText = custom.length > 0 ? custom : entry.style.preset === null ? "未填写" : PERSONA_STYLE_PRESET_LABELS[entry.style.preset];
	lines.push(`写作风格：${styleText}（遵循强度：${entry.style.strength === "strict" ? "严格遵循" : "轻度遵循"}）`);
	lines.push(`禁用词：${entry.style.bannedWords.length > 0 ? entry.style.bannedWords.join("、") : "无"}`);
	lines.push(`内容红线：${entry.style.redLines.length > 0 ? entry.style.redLines.join("、") : "无"}`);
	if (entry.site.pastedText !== null) lines.push(`企业官网信息：${entry.site.pastedText}`);
	for (const link of entry.links) {
		const detail = [link.bio, link.sampleText].filter((part) => part !== null && part.trim().length > 0).join("；");
		lines.push(`社媒链接（${PERSONA_PLATFORM_LABELS[link.platform]}）：${link.url}${detail.length > 0 ? `；${detail}` : ""}`);
	}
	if (entry.assets.resumeText !== null) lines.push(`简历/背景文本：${entry.assets.resumeText}`);
	return lines.join("\n");
}
/**
* The queued AI processor owned by the content-outputs gateway; not itself a
* cordis service — the gateway carries the `llm` injection and the config.
*/
var PersonaAiProcessor = class {
	ctx;
	/** Validated policy, defaults resolved once at construction. */
	resolved;
	/** Single-slot call queue: one model call at a time, per the plugin AI policy. */
	queue = new PQueue({ concurrency: 1 });
	/**
	* @param ctx - context exposing the registered LLM service.
	* @param config - declared AI policy; defaults resolve here, fail loud.
	*/
	constructor(ctx, config) {
		this.ctx = ctx;
		this.resolved = resolveAiConfig(config);
	}
	/**
	* Run one persona AI operation. Rate limits retry with backoff; every
	* other failure surfaces immediately so the UI can offer its own retry.
	* @param request - the operation and its input.
	* @returns the structured result with its prompt version.
	*/
	async process(request) {
		switch (request.operation) {
			case "fill": return this.enqueue(() => this.fill(request));
			case "resume": return this.enqueue(() => this.resume(request));
			case "report": return this.enqueue(() => this.report(request));
			default: throw new Error(`unsupported persona AI operation: ${String(request.operation)}`);
		}
	}
	/** One queued call with the rate-limit retry policy wrapped around it. */
	enqueue(call) {
		return this.queue.add(() => pRetry(call, {
			retries: 4,
			minTimeout: 1e3,
			maxTimeout: 3e4,
			factor: 2,
			shouldRetry: isRateLimitError,
			onFailedAttempt: (error) => honorRetryAfter(error)
		}));
	}
	/** Fill blank fields from the known ones; `whoAmI` is never fillable here. */
	async fill(request) {
		const allowed = request.blanks.filter((key) => !PERSONA_FILL_PROHIBITED.includes(key));
		if (allowed.length === 0) throw new Error("persona fill has no fillable blank fields");
		const known = Object.entries(request.known).filter(([, value]) => typeof value === "string" && value.trim().length > 0).map(([key, value]) => `${PERSONA_FIELD_LABELS[key]}：${value.trim().slice(0, PERSONA_MAX_FIELD_VALUE)}`);
		const framed = [known.length > 0 ? `已有画像信息：\n${known.join("\n")}` : "已有画像信息：无", `请为以下字段给出推断值：${allowed.map((key) => PERSONA_FIELD_LABELS[key]).join("、")}`].join("\n");
		return {
			operation: "fill",
			promptVersion: PERSONA_FILL_PROMPT_VERSION,
			fields: parsePersonaFieldsOutput(await this.call(FILL_SYSTEM_PROMPT, framed), allowed)
		};
	}
	/** Extract structured fields from one résumé / background text. */
	async resume(request) {
		const text = request.resumeText.trim();
		if (text.length === 0) throw new Error("persona résumé extraction has no text to extract from");
		const framed = text.slice(0, this.resolved.maxInputChars);
		return {
			operation: "resume",
			promptVersion: PERSONA_RESUME_PROMPT_VERSION,
			fields: parsePersonaFieldsOutput(await this.call(RESUME_SYSTEM_PROMPT, framed), PERSONA_FIELD_KEYS)
		};
	}
	/** Generate the full report from one saved entry's facts. */
	async report(request) {
		const framed = buildFactsText(request.facts).slice(0, this.resolved.maxInputChars);
		return {
			operation: "report",
			promptVersion: PERSONA_REPORT_PROMPT_VERSION,
			markdown: parsePersonaReportOutput(await this.call(REPORT_SYSTEM_PROMPT, framed))
		};
	}
	/** One framed one-shot call under the resolved policy. */
	async call(system, framed) {
		const policy = {
			provider: this.resolved.provider,
			model: this.resolved.model,
			timeoutMs: this.resolved.timeoutMs,
			maxOutputTokens: this.resolved.maxOutputTokens
		};
		return streamLlmText(this.ctx, policy, system, framed, PERSONA_AI_TIMEOUT_CODE);
	}
};
//#endregion
//#region lib/types/index.js
/**
* Content-outputs Remote: the read-only projection of the outputs library
* plus the gather and competitor write faces — the single authorized write
* path for the Content Studio information-gathering and benchmark-account
* views (asset and manifest storage under `outputs/<theme>/assets/`, and AI
* processing). The projection stays exactly as it was: `list` scans the
* library from disk on every call.
*/
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
const Config = z.object({
	root: z.string(),
	provider: z.string(),
	model: z.string(),
	timeoutMs: z.number(),
	maxOutputTokens: z.number(),
	maxInputChars: z.number(),
	freeDailyGenerates: z.number(),
	freeDailyRewrites: z.number(),
	paidTierEnabled: z.boolean()
});
/**
* Remote gateway over the outputs library: the read-only `list` projection,
* the gather write face (`fetchFeed`, asset and manifest storage, AI
* processing), the competitor write face (manifest storage, asset reads,
* teardown and report AI), the create workbench face, and the persona face
* (the `_personas.json` account-persona manifest and persona AI). AI calls
* inject the shared `llm` service; everything else is filesystem-local.
*/
let ContentOutputsGateway = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _list_decorators;
	let _fetchFeed_decorators;
	let _writeAsset_decorators;
	let _readGatherManifest_decorators;
	let _writeGatherManifest_decorators;
	let _moveAsset_decorators;
	let _deleteAsset_decorators;
	let _processMaterial_decorators;
	let _readCompetitorManifest_decorators;
	let _writeCompetitorManifest_decorators;
	let _readAsset_decorators;
	let _analyzeCompetitorWork_decorators;
	let _generateCompetitorReport_decorators;
	let _readCreateState_decorators;
	let _writeCreateState_decorators;
	let _publishCreateFinal_decorators;
	let _registerCreatePublish_decorators;
	let _readCreateMetadata_decorators;
	let _writeCreateMetadata_decorators;
	let _listCreateAssets_decorators;
	let _generateCreateContent_decorators;
	let _rewriteCreateSelection_decorators;
	let _listCreateTemplates_decorators;
	let _putCreateTemplate_decorators;
	let _deleteCreateTemplate_decorators;
	let _evaluateCreateContent_decorators;
	let _listPersonas_decorators;
	let _getPersona_decorators;
	let _putPersona_decorators;
	let _putPersonaReport_decorators;
	let _deletePersona_decorators;
	let _processPersonaAi_decorators;
	return class ContentOutputsGateway extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_list_decorators = [Remote("list")];
			_fetchFeed_decorators = [Remote("fetchFeed")];
			_writeAsset_decorators = [Remote("writeAsset")];
			_readGatherManifest_decorators = [Remote("readGatherManifest")];
			_writeGatherManifest_decorators = [Remote("writeGatherManifest")];
			_moveAsset_decorators = [Remote("moveAsset")];
			_deleteAsset_decorators = [Remote("deleteAsset")];
			_processMaterial_decorators = [Remote("processMaterial")];
			_readCompetitorManifest_decorators = [Remote("readCompetitorManifest")];
			_writeCompetitorManifest_decorators = [Remote("writeCompetitorManifest")];
			_readAsset_decorators = [Remote("readAsset")];
			_analyzeCompetitorWork_decorators = [Remote("analyzeCompetitorWork")];
			_generateCompetitorReport_decorators = [Remote("generateCompetitorReport")];
			_readCreateState_decorators = [Remote("readCreateState")];
			_writeCreateState_decorators = [Remote("writeCreateState")];
			_publishCreateFinal_decorators = [Remote("publishCreateFinal")];
			_registerCreatePublish_decorators = [Remote("registerCreatePublish")];
			_readCreateMetadata_decorators = [Remote("readCreateMetadata")];
			_writeCreateMetadata_decorators = [Remote("writeCreateMetadata")];
			_listCreateAssets_decorators = [Remote("listCreateAssets")];
			_generateCreateContent_decorators = [Remote("generateCreateContent")];
			_rewriteCreateSelection_decorators = [Remote("rewriteCreateSelection")];
			_listCreateTemplates_decorators = [Remote("listCreateTemplates")];
			_putCreateTemplate_decorators = [Remote("putCreateTemplate")];
			_deleteCreateTemplate_decorators = [Remote("deleteCreateTemplate")];
			_evaluateCreateContent_decorators = [Remote("evaluateCreateContent")];
			_listPersonas_decorators = [Remote("listPersonas")];
			_getPersona_decorators = [Remote("getPersona")];
			_putPersona_decorators = [Remote("putPersona")];
			_putPersonaReport_decorators = [Remote("putPersonaReport")];
			_deletePersona_decorators = [Remote("deletePersona")];
			_processPersonaAi_decorators = [Remote("processPersonaAi")];
			__esDecorate(this, null, _list_decorators, {
				kind: "method",
				name: "list",
				static: false,
				private: false,
				access: {
					has: (obj) => "list" in obj,
					get: (obj) => obj.list
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _fetchFeed_decorators, {
				kind: "method",
				name: "fetchFeed",
				static: false,
				private: false,
				access: {
					has: (obj) => "fetchFeed" in obj,
					get: (obj) => obj.fetchFeed
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _writeAsset_decorators, {
				kind: "method",
				name: "writeAsset",
				static: false,
				private: false,
				access: {
					has: (obj) => "writeAsset" in obj,
					get: (obj) => obj.writeAsset
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _readGatherManifest_decorators, {
				kind: "method",
				name: "readGatherManifest",
				static: false,
				private: false,
				access: {
					has: (obj) => "readGatherManifest" in obj,
					get: (obj) => obj.readGatherManifest
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _writeGatherManifest_decorators, {
				kind: "method",
				name: "writeGatherManifest",
				static: false,
				private: false,
				access: {
					has: (obj) => "writeGatherManifest" in obj,
					get: (obj) => obj.writeGatherManifest
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _moveAsset_decorators, {
				kind: "method",
				name: "moveAsset",
				static: false,
				private: false,
				access: {
					has: (obj) => "moveAsset" in obj,
					get: (obj) => obj.moveAsset
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _deleteAsset_decorators, {
				kind: "method",
				name: "deleteAsset",
				static: false,
				private: false,
				access: {
					has: (obj) => "deleteAsset" in obj,
					get: (obj) => obj.deleteAsset
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _processMaterial_decorators, {
				kind: "method",
				name: "processMaterial",
				static: false,
				private: false,
				access: {
					has: (obj) => "processMaterial" in obj,
					get: (obj) => obj.processMaterial
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _readCompetitorManifest_decorators, {
				kind: "method",
				name: "readCompetitorManifest",
				static: false,
				private: false,
				access: {
					has: (obj) => "readCompetitorManifest" in obj,
					get: (obj) => obj.readCompetitorManifest
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _writeCompetitorManifest_decorators, {
				kind: "method",
				name: "writeCompetitorManifest",
				static: false,
				private: false,
				access: {
					has: (obj) => "writeCompetitorManifest" in obj,
					get: (obj) => obj.writeCompetitorManifest
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _readAsset_decorators, {
				kind: "method",
				name: "readAsset",
				static: false,
				private: false,
				access: {
					has: (obj) => "readAsset" in obj,
					get: (obj) => obj.readAsset
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _analyzeCompetitorWork_decorators, {
				kind: "method",
				name: "analyzeCompetitorWork",
				static: false,
				private: false,
				access: {
					has: (obj) => "analyzeCompetitorWork" in obj,
					get: (obj) => obj.analyzeCompetitorWork
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _generateCompetitorReport_decorators, {
				kind: "method",
				name: "generateCompetitorReport",
				static: false,
				private: false,
				access: {
					has: (obj) => "generateCompetitorReport" in obj,
					get: (obj) => obj.generateCompetitorReport
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _readCreateState_decorators, {
				kind: "method",
				name: "readCreateState",
				static: false,
				private: false,
				access: {
					has: (obj) => "readCreateState" in obj,
					get: (obj) => obj.readCreateState
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _writeCreateState_decorators, {
				kind: "method",
				name: "writeCreateState",
				static: false,
				private: false,
				access: {
					has: (obj) => "writeCreateState" in obj,
					get: (obj) => obj.writeCreateState
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _publishCreateFinal_decorators, {
				kind: "method",
				name: "publishCreateFinal",
				static: false,
				private: false,
				access: {
					has: (obj) => "publishCreateFinal" in obj,
					get: (obj) => obj.publishCreateFinal
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _registerCreatePublish_decorators, {
				kind: "method",
				name: "registerCreatePublish",
				static: false,
				private: false,
				access: {
					has: (obj) => "registerCreatePublish" in obj,
					get: (obj) => obj.registerCreatePublish
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _readCreateMetadata_decorators, {
				kind: "method",
				name: "readCreateMetadata",
				static: false,
				private: false,
				access: {
					has: (obj) => "readCreateMetadata" in obj,
					get: (obj) => obj.readCreateMetadata
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _writeCreateMetadata_decorators, {
				kind: "method",
				name: "writeCreateMetadata",
				static: false,
				private: false,
				access: {
					has: (obj) => "writeCreateMetadata" in obj,
					get: (obj) => obj.writeCreateMetadata
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listCreateAssets_decorators, {
				kind: "method",
				name: "listCreateAssets",
				static: false,
				private: false,
				access: {
					has: (obj) => "listCreateAssets" in obj,
					get: (obj) => obj.listCreateAssets
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _generateCreateContent_decorators, {
				kind: "method",
				name: "generateCreateContent",
				static: false,
				private: false,
				access: {
					has: (obj) => "generateCreateContent" in obj,
					get: (obj) => obj.generateCreateContent
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _rewriteCreateSelection_decorators, {
				kind: "method",
				name: "rewriteCreateSelection",
				static: false,
				private: false,
				access: {
					has: (obj) => "rewriteCreateSelection" in obj,
					get: (obj) => obj.rewriteCreateSelection
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listCreateTemplates_decorators, {
				kind: "method",
				name: "listCreateTemplates",
				static: false,
				private: false,
				access: {
					has: (obj) => "listCreateTemplates" in obj,
					get: (obj) => obj.listCreateTemplates
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _putCreateTemplate_decorators, {
				kind: "method",
				name: "putCreateTemplate",
				static: false,
				private: false,
				access: {
					has: (obj) => "putCreateTemplate" in obj,
					get: (obj) => obj.putCreateTemplate
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _deleteCreateTemplate_decorators, {
				kind: "method",
				name: "deleteCreateTemplate",
				static: false,
				private: false,
				access: {
					has: (obj) => "deleteCreateTemplate" in obj,
					get: (obj) => obj.deleteCreateTemplate
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _evaluateCreateContent_decorators, {
				kind: "method",
				name: "evaluateCreateContent",
				static: false,
				private: false,
				access: {
					has: (obj) => "evaluateCreateContent" in obj,
					get: (obj) => obj.evaluateCreateContent
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listPersonas_decorators, {
				kind: "method",
				name: "listPersonas",
				static: false,
				private: false,
				access: {
					has: (obj) => "listPersonas" in obj,
					get: (obj) => obj.listPersonas
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _getPersona_decorators, {
				kind: "method",
				name: "getPersona",
				static: false,
				private: false,
				access: {
					has: (obj) => "getPersona" in obj,
					get: (obj) => obj.getPersona
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _putPersona_decorators, {
				kind: "method",
				name: "putPersona",
				static: false,
				private: false,
				access: {
					has: (obj) => "putPersona" in obj,
					get: (obj) => obj.putPersona
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _putPersonaReport_decorators, {
				kind: "method",
				name: "putPersonaReport",
				static: false,
				private: false,
				access: {
					has: (obj) => "putPersonaReport" in obj,
					get: (obj) => obj.putPersonaReport
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _deletePersona_decorators, {
				kind: "method",
				name: "deletePersona",
				static: false,
				private: false,
				access: {
					has: (obj) => "deletePersona" in obj,
					get: (obj) => obj.deletePersona
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _processPersonaAi_decorators, {
				kind: "method",
				name: "processPersonaAi",
				static: false,
				private: false,
				access: {
					has: (obj) => "processPersonaAi" in obj,
					get: (obj) => obj.processPersonaAi
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = ["llm"];
		static Config = Config;
		/** Absolute library root; a missing directory scans as an empty library. */
		root = __runInitializers(this, _instanceExtraInitializers);
		/** Queued AI processor behind the gather view's explicit processing button. */
		ai;
		/** Queued AI processor behind the competitors view's explicit buttons. */
		competitorAi;
		/** Queued AI processor behind the create workbench's generate/rewrite buttons. */
		createAi;
		/** Queued AI processor behind the persona view's explicit buttons. */
		personaAi;
		/** Freemium gate over the create AI faces. */
		createQuota;
		constructor(ctx, config) {
			super(ctx, "contentOutputs");
			this.root = join(resolveDshHome(config.root), "outputs");
			this.ai = new GatherAiProcessor(ctx, config);
			this.competitorAi = new CompetitorAiProcessor(ctx, config);
			this.createAi = new CreateAiProcessor(ctx, resolveAiConfig(config));
			this.personaAi = new PersonaAiProcessor(ctx, config);
			this.createQuota = new CreateQuotaGate(this.root, config);
			sweepOrphanTempFiles(this.root).catch(() => void 0);
		}
		/**
		* Read the library root directly on every call: the library is the agent's
		* write surface, so a cache would only add a second truth to synchronize.
		* @returns Current projects in topic order, with every unreadable
		* directory named in `problems`.
		*/
		async list() {
			return scanOutputs(this.root);
		}
		/**
		* Fetch and parse one feed document with the source's conditional-request
		* cursors. Network reading only: nothing is persisted, and the fetch
		* happens here — never in the browser, whose cross-origin feeds would be
		* blocked by CORS anyway.
		* @param request - feed URL plus the stored ETag / Last-Modified cursors.
		* @param signal - caller cancellation.
		* @returns item drafts plus the cursors to store for the next run.
		*/
		async fetchFeed(request, signal) {
			return fetchFeedDocument(request, {}, signal);
		}
		/**
		* Write one file inside the theme's `assets/` directory. `*.html` content
		* is sanitized through the allowlist and truncated to the body cap before
		* it reaches disk; the replacement is atomic and serialized per file.
		* @param write - theme, plain file name, and complete content.
		* @returns whether the stored snapshot was truncated.
		*/
		async writeAsset(write) {
			return writeAssetFile(this.root, write);
		}
		/**
		* Read the theme's `_gather.json` manifest.
		* @param theme - outputs-project directory name.
		* @returns the manifest with only valid entries, every dropped one named
		* in `problems`; callers must not write back while `problems` is non-empty.
		*/
		async readGatherManifest(theme) {
			return readGatherManifestFile(this.root, theme);
		}
		/**
		* Replace the theme's `_gather.json` manifest with an atomic, locked
		* commit. The stored manifest is quota-trimmed: per source the newest
		* `unread`/`read` entries up to the quota survive, `favorite`/`picked`
		* entries and their snapshots are never removed.
		* @param theme - outputs-project directory name.
		* @param manifest - the complete next manifest.
		* @returns the stored (trimmed) manifest.
		*/
		async writeGatherManifest(theme, manifest) {
			return writeGatherManifestFile(this.root, theme, manifest, await collectCreateReferencedFiles(this.root, theme));
		}
		/**
		* Rename or relocate one file between two themes' `assets/` directories:
		* a within-theme rename for renaming, the cross-theme form for rebinding
		* one material to another theme.
		* @param move - source theme/name and destination theme/name.
		*/
		async moveAsset(move) {
			await moveAssetFile(this.root, move);
		}
		/**
		* Delete one file from the theme's `assets/` directory; absent files are
		* a no-op.
		* @param theme - outputs-project directory name.
		* @param file - plain file name inside `assets/`.
		*/
		async deleteAsset(theme, file) {
			await deleteAssetFile(this.root, theme, file);
		}
		/**
		* Process one material through the model: summary, key points, topic
		* score, and tags. Explicit per call, queued one at a time, rate limits
		* retried with backoff; nothing is persisted here.
		* @param request - the material's display facts plus its snapshot reference.
		* @returns the structured result for the caller to write back.
		*/
		async processMaterial(request) {
			return this.ai.process(request, (theme, file) => readAssetText(this.root, theme, file));
		}
		/**
		* Read the theme's `_competitors.json` manifest.
		* @param theme - outputs-project directory name.
		* @returns the manifest with only valid entries, every dropped one named
		*   in `problems`; callers must not write back while `problems` is
		*   non-empty.
		*/
		async readCompetitorManifest(theme) {
			return readCompetitorManifestFile(this.root, theme);
		}
		/**
		* Replace the theme's `_competitors.json` manifest with an atomic, locked
		* commit. No trimming runs: works carry user markers and append-only
		* snapshots, so the caller's list is stored verbatim after validation.
		* @param theme - outputs-project directory name.
		* @param manifest - the complete next manifest.
		*/
		async writeCompetitorManifest(theme, manifest) {
			await writeCompetitorManifestFile(this.root, theme, manifest);
		}
		/**
		* Read one asset file as text for the work side preview. Read-only and
		* path-guarded like every other asset access.
		* @param theme - outputs-project directory name.
		* @param file - plain file name inside `assets/`.
		* @returns the file content, or an empty record when absent.
		*/
		async readAsset(theme, file) {
			const content = await readAssetText(this.root, theme, file);
			return content === void 0 ? {} : { content };
		}
		/**
		* Tear one benchmark work down through the model: hook, structure, pain
		* points, risks, reusable patterns, and differentiated topic suggestions.
		* Explicit per call, queued one at a time, rate limits retried with
		* backoff; nothing is persisted here.
		* @param request - the work's display facts, snapshot reference, and any
		*   user-pasted hot comments.
		* @returns the structured result plus the full markdown teardown.
		*/
		async analyzeCompetitorWork(request) {
			return this.competitorAi.analyzeWork(request, (theme, file) => readAssetText(this.root, theme, file));
		}
		/**
		* Generate one benchmark report through the model: a single-account
		* panorama or a two-account face-off, from aggregated digests only.
		* Explicit per call, queued one at a time, rate limits retried with
		* backoff; nothing is persisted here.
		* @param request - report kind plus one or two account digests.
		* @returns the markdown report for the caller to store as an asset file.
		*/
		async generateCompetitorReport(request) {
			return this.competitorAi.generateReport(request);
		}
		/**
		* Read the theme's creation state: the validated `_create.json` manifest
		* plus the current draft body. A malformed manifest reads as empty with
		* the rejection named, so the editor can warn instead of overwriting it.
		* @param theme - outputs-project directory name.
		* @returns the manifest (or null) and the draft body (or null).
		*/
		async readCreateState(theme) {
			return readCreateStateFile(this.root, theme);
		}
		/**
		* Replace the theme's `_create.json` manifest with an atomic, locked
		* commit. The caller owns version pruning and ordering; this face only
		* validates the format.
		* @param theme - outputs-project directory name.
		* @param manifest - the complete next manifest.
		*/
		async writeCreateState(theme, manifest) {
			await writeCreateStateFile(this.root, theme, manifest);
		}
		/**
		* Publish one deliverable: copy the given content to the theme root. A
		* name collision rejects unless `overwrite` is set — the caller confirms
		* with the user first. Registration into `.dsh-output.json` is the
		* separate {@link registerCreatePublish} step.
		* @param theme - outputs-project directory name.
		* @param request - file name, complete content, and the overwrite decision.
		* @returns the stored root file name.
		*/
		async publishCreateFinal(theme, request) {
			return { file: await publishFinalFile(this.root, theme, request) };
		}
		/**
		* Register one publish into the theme's metadata: flip the status to
		* `published` and mirror the version bookkeeping. The retry half of the
		* handoff — the deliverable must already sit at the theme root.
		* @param theme - outputs-project directory name.
		* @param request - the root file name and the published version.
		*/
		async registerCreatePublish(theme, request) {
			await registerCreatePublishFile(this.root, theme, request);
		}
		/**
		* Read the theme's `.dsh-output.json` for the merge-before-write the
		* metadata face does. A malformed file reads as null with the violation
		* named, so the editor warns instead of silently overwriting it.
		* @param theme - outputs-project directory name.
		* @returns the metadata, or null with the problem when malformed.
		*/
		async readCreateMetadata(theme) {
			return readCreateMetadataFile(this.root, theme);
		}
		/**
		* Write the theme's `.dsh-output.json` — theme initialization and any
		* later bookkeeping merge go through here, validated against the format-0
		* rules before the atomic commit.
		* @param theme - outputs-project directory name.
		* @param metadata - the complete next metadata.
		*/
		async writeCreateMetadata(theme, metadata) {
			await writeOutputMetadataFile(this.root, theme, metadata);
		}
		/**
		* List the theme's non-system asset file names, sorted. Serves the image
		* inserter; system files never appear.
		* @param theme - outputs-project directory name.
		* @returns the sorted plain file names.
		*/
		async listCreateAssets(theme) {
			return { files: await listAssetFiles(this.root, theme) };
		}
		/**
		* Generate one draft through the model under the selected built-in
		* template. Explicit per call, queued one at a time, rate limits retried
		* with backoff; nothing is persisted here. Charges the daily generation
		* budget per variant; `count: 3` additionally requires the paid tier.
		* @param request - the creation context, content type, and variant count.
		* @returns the draft text, the split variants when batched, and provenance.
		*/
		async generateCreateContent(request) {
			const count = request.count ?? 1;
			if (count === 3) await this.createQuota.requirePaidFeature("batch");
			await this.createQuota.consumeGenerate(count);
			return this.createAi.generate(request);
		}
		/**
		* Rewrite one selection through the model (condense, expand, style switch,
		* perspective switch, extract, humanize light/deep, or title batch).
		* Explicit per call, queued one at a time, rate limits retried with
		* backoff; nothing is persisted here. Charges the daily rewrite budget.
		* @param request - the operation and the selection text.
		* @returns the rewritten text with its provenance.
		*/
		async rewriteCreateSelection(request) {
			await this.createQuota.consumeRewrite();
			return this.createAi.rewrite(request);
		}
		/**
		* Evaluate one draft through the model: four rubric dimensions plus an
		* overall advisory grade. Explicit per call, queued one at a time,
		* rate limits retried with backoff; nothing is persisted here. A
		* paid-tier feature — the advisory result never blocks anything.
		* @param request - the content type, title, and draft text.
		* @returns the structured evaluation with its provenance.
		*/
		/**
		* List the global custom templates. A malformed bank reads as empty with
		* the rejection named, so the manager can warn before overwriting.
		* @returns the valid templates plus every rejection.
		*/
		async listCreateTemplates() {
			const { templates, problems } = await readCreateTemplatesFile(this.root);
			return {
				templates,
				problems
			};
		}
		/**
		* Upsert one custom template: absent id creates, present id updates and
		* bumps the revision. The body re-validates against the placeholder
		* whitelist here, and again at every generation that uses it.
		* @param input - the template facts; id, revision, and timestamps are store-managed.
		* @returns the stored templates.
		*/
		async putCreateTemplate(input) {
			return {
				templates: await putCreateTemplateFile(this.root, input),
				problems: []
			};
		}
		/**
		* Delete one custom template; an unknown id is a no-op.
		* @param id - the template id.
		* @returns the stored templates.
		*/
		async deleteCreateTemplate(id) {
			return {
				templates: await deleteCreateTemplateFile(this.root, id),
				problems: []
			};
		}
		async evaluateCreateContent(request) {
			await this.createQuota.requirePaidFeature("evaluation");
			return this.createAi.evaluate(request);
		}
		/**
		* List every account persona from the library root's `_personas.json`.
		* @returns the entries newest-first, with every dropped stored record named
		*   in `problems`.
		*/
		async listPersonas() {
			return readPersonasFile(join(this.root, PERSONAS_FILENAME));
		}
		/**
		* Read one account persona by id.
		* @param id - the persona id.
		* @returns the stored entry, or an empty record when absent.
		*/
		async getPersona(id) {
			const persona = (await readPersonasFile(join(this.root, PERSONAS_FILENAME))).personas.find((entry) => entry.id === id);
			return persona === void 0 ? {} : { persona };
		}
		/**
		* Upsert one persona: the revision increments, the digest recomputes from
		* the stored content, and the timestamps are gateway-owned. Report edits
		* never ride this face — it is the form save, and the report staleness
		* banner tracks form revisions only.
		* @param input - the upsert payload from the browser.
		* @returns the stored entry.
		*/
		async putPersona(input) {
			return putPersonaFile(join(this.root, PERSONAS_FILENAME), input);
		}
		/**
		* Replace one persona's report without touching its form state: revision
		* and digest stay, so editing the report text never marks the report stale.
		* @param id - the persona to update; unknown ids reject.
		* @param report - the complete next report.
		* @returns the stored entry.
		*/
		async putPersonaReport(id, report) {
			return putPersonaReportFile(join(this.root, PERSONAS_FILENAME), id, report);
		}
		/**
		* Remove one persona; the embedded report goes with it and no file is left
		* to dangle. Removing an unknown id is a no-op.
		* @param id - the persona id.
		*/
		async deletePersona(id) {
			await deletePersonaFile(join(this.root, PERSONAS_FILENAME), id);
		}
		/**
		* Run one persona AI operation (blank-field fill, résumé extraction, or
		* report generation). Explicit per call, queued one at a time, rate limits
		* retried with backoff; nothing is persisted here — the caller previews
		* the result and writes adopted values back through the persona faces.
		* @param request - the operation and its input.
		* @returns the candidate fields or report, with the prompt version for
		*   provenance stamping.
		*/
		async processPersonaAi(request) {
			return this.personaAi.process(request);
		}
	};
})();
//#endregion
export { ASSETS_DIRNAME, COMPETITOR_AI_TIMEOUT_CODE, COMPETITOR_MANIFEST_FILENAME, CREATE_AI_TIMEOUT_CODE, CREATE_MANIFEST_FILENAME, CREATE_MAX_STORED_VERSIONS, CREATE_PROMPT_VERSION, CREATE_QUOTA_FILENAME, CREATE_TEMPLATES_FILENAME, CREATE_TEMPLATE_PLACEHOLDERS, Config, ContentOutputsGateway, ContentOutputsGateway as default, CreateQuotaError, GATHER_AI_TIMEOUT_CODE, GATHER_MANIFEST_FILENAME, GATHER_MAX_BODY_CHARS, GATHER_QUOTA_PER_SOURCE, METADATA_FILENAME, PERSONAS_FILENAME, PERSONA_AI_TIMEOUT_CODE, PERSONA_FILL_PROMPT_VERSION, PERSONA_REPORT_PROMPT_VERSION, PERSONA_RESUME_PROMPT_VERSION, assertCreateManifest, assertTemplateBody, buildFactsText, collectCreateReferencedFiles, localDayKey, normalizeQuotaState, parseCompetitorAnalysisOutput, parseCompetitorReportOutput, parseCreateManifest, parseGatherAiOutput, parsePersonaFieldsOutput, parsePersonaReportOutput, parsePersonasManifest, personaDigest, resolveQuotaConfig, scanOutputs, scanProject };
