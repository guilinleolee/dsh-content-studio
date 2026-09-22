import z from "@deepseek-ai/schemastery";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { join } from "node:path";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { readFile, readdir, stat } from "node:fs/promises";
//#region lib/types/scan.js
/**
* Outputs library scanner: reads the on-disk project convention directly on
* every call. The convention is one directory per creation under the library
* root — finished files at the project root, intermediate material under
* `assets/`, and `.dsh-output.json` as the only metadata. Names beginning
* with `.` or `_` are system entries, not projects.
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
				assetCount = (await readdir(join(dir, ASSETS_DIRNAME))).length;
			} catch {}
			continue;
		}
		if (!entry.isFile() || entry.name.startsWith(".")) continue;
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
//#region lib/types/index.js
/** Read-only Remote projection of the content-creation outputs library. */
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
const Config = z.object({ root: z.string() });
/** Remote-only service projecting the outputs library from disk per call. */
let ContentOutputsGateway = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _list_decorators;
	return class ContentOutputsGateway extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_list_decorators = [Remote("list")];
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
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = [];
		static Config = Config;
		/** Absolute library root; a missing directory scans as an empty library. */
		root = __runInitializers(this, _instanceExtraInitializers);
		constructor(ctx, config) {
			super(ctx, "contentOutputs");
			this.root = join(resolveDshHome(config.root), "outputs");
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
	};
})();
//#endregion
export { ASSETS_DIRNAME, Config, ContentOutputsGateway, ContentOutputsGateway as default, METADATA_FILENAME, scanOutputs, scanProject };
