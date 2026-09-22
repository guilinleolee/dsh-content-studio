import z from "@deepseek-ai/schemastery";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { dirname, join } from "node:path";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { mkdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
//#region lib/types/store.js
/**
* Schedule file store: reads and writes the calendar JSON directly on every
* call. The file lives at the library root under `_schedule.json` — the `_`
* prefix keeps the outputs scanner treating it as a system entry, and one
* library directory stays the whole content-creation surface on disk.
*
* Validation follows the same rule as the outputs scanner: one malformed
* record never hides the rest — it is named in `problems` and skipped, while
* valid items keep their place on the calendar.
*/
/** System file name of the calendar at the library root. */
const SCHEDULE_FILENAME = "_schedule.json";
const STATUSES = [
	"idea",
	"draft",
	"scheduled",
	"published"
];
const KINDS = ["content", "event"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
function isValidTime(value) {
	if (!TIME_PATTERN.test(value)) return false;
	const hours = Number(value.slice(0, 2));
	const minutes = Number(value.slice(3, 5));
	return hours <= 23 && minutes <= 59;
}
function isItem(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.id === "string" && record.id.length > 0 && typeof record.title === "string" && record.title.length > 0 && typeof record.date === "string" && DATE_PATTERN.test(record.date) && (record.time === null || typeof record.time === "string" && isValidTime(record.time)) && (record.platform === null || typeof record.platform === "string") && STATUSES.includes(record.status) && KINDS.includes(record.kind) && (record.topic === null || typeof record.topic === "string") && (record.url === null || typeof record.url === "string");
}
/** Sort key: date, then time (undated times last within a day), then id. */
function compareItems(a, b) {
	if (a.date !== b.date) return a.date < b.date ? -1 : 1;
	const at = a.time ?? "99:99";
	const bt = b.time ?? "99:99";
	if (at !== bt) return at < bt ? -1 : 1;
	return a.id < b.id ? -1 : 1;
}
/**
* Validate one upsert input into its stored shape; `id` is generated when
* absent and trimmed fields are normalized.
* @param input - the upsert payload.
* @returns the stored item, or the reason the input is invalid.
*/
function normalizeInput(input) {
	if (typeof input.title !== "string" || input.title.trim().length === 0) return { detail: "title must be a non-empty string" };
	if (typeof input.date !== "string" || !DATE_PATTERN.test(input.date)) return { detail: "date must be YYYY-MM-DD" };
	if (input.time !== null && (typeof input.time !== "string" || !isValidTime(input.time))) return { detail: "time must be HH:mm (00:00–23:59) or null" };
	if (!STATUSES.includes(input.status)) return { detail: "unknown status" };
	if (!KINDS.includes(input.kind)) return { detail: "unknown kind" };
	return { item: {
		id: input.id ?? randomUUID(),
		title: input.title.trim(),
		date: input.date,
		time: input.time,
		platform: input.platform === null ? null : input.platform.trim() || null,
		status: input.status,
		kind: input.kind,
		topic: input.topic ?? null,
		url: input.url ?? null
	} };
}
/**
* Read the calendar file.
* @param file - absolute `_schedule.json` path; a missing file is empty.
* @returns the snapshot with items sorted and every bad record named.
*/
async function readSchedule(file) {
	let raw;
	try {
		raw = await readFile(file, "utf8");
	} catch {
		return {
			file,
			items: [],
			problems: []
		};
	}
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {
			file,
			items: [],
			problems: ["calendar file is not valid JSON"]
		};
	}
	const root = parsed;
	if (root.formatVersion !== 0) return {
		file,
		items: [],
		problems: [`unsupported calendar formatVersion ${String(root.formatVersion)}`]
	};
	if (!Array.isArray(root.items)) return {
		file,
		items: [],
		problems: ["calendar file has no items array"]
	};
	const items = [];
	const problems = [];
	for (const entry of root.items) if (isItem(entry)) items.push(entry);
	else problems.push(`dropped one invalid calendar record: ${JSON.stringify(entry).slice(0, 120)}`);
	items.sort(compareItems);
	return {
		file,
		items,
		problems
	};
}
/**
* Apply one mutation to the calendar under a file lock, atomically.
* @param file - absolute `_schedule.json` path; parent directories are
* created when missing (the lock file requires its parent to exist).
* @param mutate - pure transform over the current item list.
* @returns the mutation's write snapshot (post-write state).
*/
async function mutateSchedule(file, mutate) {
	return withFileLock(file, async () => {
		await mkdir(dirname(file), {
			recursive: true,
			mode: 448
		});
		const before = await readSchedule(file);
		const items = await mutate(before.items);
		await writeFileAtomic(file, `${JSON.stringify({
			formatVersion: 0,
			items
		}, null, 2)}\n`, {
			mode: 384,
			dirMode: 448
		});
		const after = await readSchedule(file);
		return {
			...after,
			problems: [...before.problems, ...after.problems]
		};
	});
}
//#endregion
//#region lib/types/index.js
/** Publication calendar Remote for the content-creation library. */
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
/**
* Remote calendar service over `_schedule.json` at the library root. Every
* method reads or commits the file directly — the calendar is small, and the
* file stays the single truth the agent can also read.
*/
let ContentScheduleGateway = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _list_decorators;
	let _put_decorators;
	let _delete_decorators;
	return class ContentScheduleGateway extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_list_decorators = [Remote("list")];
			_put_decorators = [Remote("put")];
			_delete_decorators = [Remote("delete")];
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
			__esDecorate(this, null, _put_decorators, {
				kind: "method",
				name: "put",
				static: false,
				private: false,
				access: {
					has: (obj) => "put" in obj,
					get: (obj) => obj.put
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _delete_decorators, {
				kind: "method",
				name: "delete",
				static: false,
				private: false,
				access: {
					has: (obj) => "delete" in obj,
					get: (obj) => obj.delete
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
		/** Absolute calendar file path. */
		file = __runInitializers(this, _instanceExtraInitializers);
		constructor(ctx, config) {
			super(ctx, "contentSchedule");
			this.file = join(resolveDshHome(config.root), "outputs", SCHEDULE_FILENAME);
		}
		/**
		* Read the whole calendar.
		* @returns items sorted by date, with every bad stored record named.
		*/
		async list() {
			return readSchedule(this.file);
		}
		/**
		* Upsert one item: an absent `id` (or an unknown one) creates; a known one
		* replaces in place. Identity is decided by id alone — no title/date
		* matching.
		* @param input - the upsert payload.
		* @returns the post-write calendar snapshot.
		*/
		async put(input) {
			const { item, detail } = normalizeInput(input);
			if (item === void 0) throw new Error(`invalid schedule item: ${detail ?? "unknown reason"}`);
			return mutateSchedule(this.file, (items) => {
				const index = items.findIndex((candidate) => candidate.id === item.id);
				if (index === -1) return [...items, item];
				const next = [...items];
				next[index] = item;
				return next;
			});
		}
		/**
		* Delete one item by id; deleting an unknown id is a no-op, not an error.
		* @param id - the item's stable identity.
		* @returns the post-write calendar snapshot.
		*/
		async delete(id) {
			return mutateSchedule(this.file, (items) => items.filter((candidate) => candidate.id !== id));
		}
	};
})();
//#endregion
export { Config, ContentScheduleGateway, ContentScheduleGateway as default, SCHEDULE_FILENAME, mutateSchedule, normalizeInput, readSchedule };
