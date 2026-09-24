window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-content-studio",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react = require("react");
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/core.js
		var _a$1;
		function $constructor(name, initializer, params) {
			function init(inst, def) {
				if (!inst._zod) Object.defineProperty(inst, "_zod", {
					value: {
						def,
						constr: _,
						traits: /* @__PURE__ */ new Set()
					},
					enumerable: false
				});
				if (inst._zod.traits.has(name)) return;
				inst._zod.traits.add(name);
				initializer(inst, def);
				const proto = _.prototype;
				const keys = Object.keys(proto);
				for (let i = 0; i < keys.length; i++) {
					const k = keys[i];
					if (!(k in inst)) inst[k] = proto[k].bind(inst);
				}
			}
			const Parent = params?.Parent ?? Object;
			class Definition extends Parent {}
			Object.defineProperty(Definition, "name", { value: name });
			function _(def) {
				var _a;
				const inst = params?.Parent ? new Definition() : this;
				init(inst, def);
				(_a = inst._zod).deferred ?? (_a.deferred = []);
				for (const fn of inst._zod.deferred) fn();
				return inst;
			}
			Object.defineProperty(_, "init", { value: init });
			Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
				if (params?.Parent && inst instanceof params.Parent) return true;
				return inst?._zod?.traits?.has(name);
			} });
			Object.defineProperty(_, "name", { value: name });
			return _;
		}
		var $ZodAsyncError = class extends Error {
			constructor() {
				super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
			}
		};
		var $ZodEncodeError = class extends Error {
			constructor(name) {
				super(`Encountered unidirectional transform during encode: ${name}`);
				this.name = "ZodEncodeError";
			}
		};
		(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
		const globalConfig = globalThis.__zod_globalConfig;
		function config(newConfig) {
			if (newConfig) Object.assign(globalConfig, newConfig);
			return globalConfig;
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/util.js
		function getEnumValues(entries) {
			const numericValues = Object.values(entries).filter((v) => typeof v === "number");
			return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
		}
		function jsonStringifyReplacer(_, value) {
			if (typeof value === "bigint") return value.toString();
			return value;
		}
		function cached(getter) {
			return { get value() {
				{
					const value = getter();
					Object.defineProperty(this, "value", { value });
					return value;
				}
				throw new Error("cached value already set");
			} };
		}
		function nullish(input) {
			return input === null || input === void 0;
		}
		function cleanRegex(source) {
			const start = source.startsWith("^") ? 1 : 0;
			const end = source.endsWith("$") ? source.length - 1 : source.length;
			return source.slice(start, end);
		}
		function floatSafeRemainder(val, step) {
			const ratio = val / step;
			const roundedRatio = Math.round(ratio);
			const tolerance = Number.EPSILON * Math.max(Math.abs(ratio), 1);
			if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
			return ratio - roundedRatio;
		}
		const EVALUATING = /* @__PURE__*/ Symbol("evaluating");
		function defineLazy(object, key, getter) {
			let value = void 0;
			Object.defineProperty(object, key, {
				get() {
					if (value === EVALUATING) return;
					if (value === void 0) {
						value = EVALUATING;
						value = getter();
					}
					return value;
				},
				set(v) {
					Object.defineProperty(object, key, { value: v });
				},
				configurable: true
			});
		}
		function assignProp(target, prop, value) {
			Object.defineProperty(target, prop, {
				value,
				writable: true,
				enumerable: true,
				configurable: true
			});
		}
		function mergeDefs(...defs) {
			const mergedDescriptors = {};
			for (const def of defs) Object.assign(mergedDescriptors, Object.getOwnPropertyDescriptors(def));
			return Object.defineProperties({}, mergedDescriptors);
		}
		function esc(str) {
			return JSON.stringify(str);
		}
		function slugify(input) {
			return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
		}
		const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
		function isObject(data) {
			return typeof data === "object" && data !== null && !Array.isArray(data);
		}
		const allowsEval = /* @__PURE__*/ cached(() => {
			if (globalConfig.jitless) return false;
			if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
			try {
				new Function("");
				return true;
			} catch (_) {
				return false;
			}
		});
		function isPlainObject(o) {
			if (isObject(o) === false) return false;
			const ctor = o.constructor;
			if (ctor === void 0) return true;
			if (typeof ctor !== "function") return true;
			const prot = ctor.prototype;
			if (isObject(prot) === false) return false;
			if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
			return true;
		}
		function shallowClone(o) {
			if (isPlainObject(o)) return { ...o };
			if (Array.isArray(o)) return [...o];
			if (o instanceof Map) return new Map(o);
			if (o instanceof Set) return new Set(o);
			return o;
		}
		const propertyKeyTypes = /* @__PURE__*/ new Set([
			"string",
			"number",
			"symbol"
		]);
		function escapeRegex(str) {
			return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
		function clone(inst, def, params) {
			const cl = new inst._zod.constr(def ?? inst._zod.def);
			if (!def || params?.parent) cl._zod.parent = inst;
			return cl;
		}
		function normalizeParams(_params) {
			const params = _params;
			if (!params) return {};
			if (typeof params === "string") return { error: () => params };
			if (params?.message !== void 0) {
				if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
				params.error = params.message;
			}
			delete params.message;
			if (typeof params.error === "string") return {
				...params,
				error: () => params.error
			};
			return params;
		}
		function optionalKeys(shape) {
			return Object.keys(shape).filter((k) => {
				return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
			});
		}
		const NUMBER_FORMAT_RANGES = {
			safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
			int32: [-2147483648, 2147483647],
			uint32: [0, 4294967295],
			float32: [-34028234663852886e22, 34028234663852886e22],
			float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
		};
		function pick(schema, mask) {
			const currDef = schema._zod.def;
			const checks = currDef.checks;
			if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
			return clone(schema, mergeDefs(schema._zod.def, {
				get shape() {
					const newShape = {};
					for (const key in mask) {
						if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
						if (!mask[key]) continue;
						newShape[key] = currDef.shape[key];
					}
					assignProp(this, "shape", newShape);
					return newShape;
				},
				checks: []
			}));
		}
		function omit(schema, mask) {
			const currDef = schema._zod.def;
			const checks = currDef.checks;
			if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
			return clone(schema, mergeDefs(schema._zod.def, {
				get shape() {
					const newShape = { ...schema._zod.def.shape };
					for (const key in mask) {
						if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
						if (!mask[key]) continue;
						delete newShape[key];
					}
					assignProp(this, "shape", newShape);
					return newShape;
				},
				checks: []
			}));
		}
		function extend(schema, shape) {
			if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
			const checks = schema._zod.def.checks;
			if (checks && checks.length > 0) {
				const existingShape = schema._zod.def.shape;
				for (const key in shape) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
			}
			return clone(schema, mergeDefs(schema._zod.def, { get shape() {
				const _shape = {
					...schema._zod.def.shape,
					...shape
				};
				assignProp(this, "shape", _shape);
				return _shape;
			} }));
		}
		function safeExtend(schema, shape) {
			if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
			return clone(schema, mergeDefs(schema._zod.def, { get shape() {
				const _shape = {
					...schema._zod.def.shape,
					...shape
				};
				assignProp(this, "shape", _shape);
				return _shape;
			} }));
		}
		function merge(a, b) {
			if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
			return clone(a, mergeDefs(a._zod.def, {
				get shape() {
					const _shape = {
						...a._zod.def.shape,
						...b._zod.def.shape
					};
					assignProp(this, "shape", _shape);
					return _shape;
				},
				get catchall() {
					return b._zod.def.catchall;
				},
				checks: b._zod.def.checks ?? []
			}));
		}
		function partial(Class, schema, mask) {
			const checks = schema._zod.def.checks;
			if (checks && checks.length > 0) throw new Error(".partial() cannot be used on object schemas containing refinements");
			return clone(schema, mergeDefs(schema._zod.def, {
				get shape() {
					const oldShape = schema._zod.def.shape;
					const shape = { ...oldShape };
					if (mask) for (const key in mask) {
						if (!(key in oldShape)) throw new Error(`Unrecognized key: "${key}"`);
						if (!mask[key]) continue;
						shape[key] = Class ? new Class({
							type: "optional",
							innerType: oldShape[key]
						}) : oldShape[key];
					}
					else for (const key in oldShape) shape[key] = Class ? new Class({
						type: "optional",
						innerType: oldShape[key]
					}) : oldShape[key];
					assignProp(this, "shape", shape);
					return shape;
				},
				checks: []
			}));
		}
		function required(Class, schema, mask) {
			return clone(schema, mergeDefs(schema._zod.def, { get shape() {
				const oldShape = schema._zod.def.shape;
				const shape = { ...oldShape };
				if (mask) for (const key in mask) {
					if (!(key in shape)) throw new Error(`Unrecognized key: "${key}"`);
					if (!mask[key]) continue;
					shape[key] = new Class({
						type: "nonoptional",
						innerType: oldShape[key]
					});
				}
				else for (const key in oldShape) shape[key] = new Class({
					type: "nonoptional",
					innerType: oldShape[key]
				});
				assignProp(this, "shape", shape);
				return shape;
			} }));
		}
		function aborted(x, startIndex = 0) {
			if (x.aborted === true) return true;
			for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
			return false;
		}
		function explicitlyAborted(x, startIndex = 0) {
			if (x.aborted === true) return true;
			for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
			return false;
		}
		function prefixIssues(path, issues) {
			return issues.map((iss) => {
				var _a;
				(_a = iss).path ?? (_a.path = []);
				iss.path.unshift(path);
				return iss;
			});
		}
		function unwrapMessage(message) {
			return typeof message === "string" ? message : message?.message;
		}
		function finalizeIssue(iss, ctx, config) {
			const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
			const { inst: _inst, continue: _continue, input: _input, ...rest } = iss;
			rest.path ?? (rest.path = []);
			rest.message = message;
			if (ctx?.reportInput) rest.input = _input;
			return rest;
		}
		function getLengthableOrigin(input) {
			if (Array.isArray(input)) return "array";
			if (typeof input === "string") return "string";
			return "unknown";
		}
		function issue(...args) {
			const [iss, input, inst] = args;
			if (typeof iss === "string") return {
				message: iss,
				code: "custom",
				input,
				inst
			};
			return { ...iss };
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/errors.js
		const initializer$1 = (inst, def) => {
			inst.name = "$ZodError";
			Object.defineProperty(inst, "_zod", {
				value: inst._zod,
				enumerable: false
			});
			Object.defineProperty(inst, "issues", {
				value: def,
				enumerable: false
			});
			inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
			Object.defineProperty(inst, "toString", {
				value: () => inst.message,
				enumerable: false
			});
		};
		const $ZodError = $constructor("$ZodError", initializer$1);
		const $ZodRealError = $constructor("$ZodError", initializer$1, { Parent: Error });
		function flattenError(error, mapper = (issue) => issue.message) {
			const fieldErrors = {};
			const formErrors = [];
			for (const sub of error.issues) if (sub.path.length > 0) {
				fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
				fieldErrors[sub.path[0]].push(mapper(sub));
			} else formErrors.push(mapper(sub));
			return {
				formErrors,
				fieldErrors
			};
		}
		function formatError(error, mapper = (issue) => issue.message) {
			const fieldErrors = { _errors: [] };
			const processError = (error, path = []) => {
				for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
				else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
				else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
				else {
					const fullpath = [...path, ...issue.path];
					if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
					else {
						let curr = fieldErrors;
						let i = 0;
						while (i < fullpath.length) {
							const el = fullpath[i];
							if (!(i === fullpath.length - 1)) curr[el] = curr[el] || { _errors: [] };
							else {
								curr[el] = curr[el] || { _errors: [] };
								curr[el]._errors.push(mapper(issue));
							}
							curr = curr[el];
							i++;
						}
					}
				}
			};
			processError(error);
			return fieldErrors;
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/parse.js
		const _parse = (_Err) => (schema, value, _ctx, _params) => {
			const ctx = _ctx ? {
				..._ctx,
				async: false
			} : { async: false };
			const result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) throw new $ZodAsyncError();
			if (result.issues.length) {
				const e = new ((_params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
				captureStackTrace(e, _params?.callee);
				throw e;
			}
			return result.value;
		};
		const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
			const ctx = _ctx ? {
				..._ctx,
				async: true
			} : { async: true };
			let result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) result = await result;
			if (result.issues.length) {
				const e = new ((params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
				captureStackTrace(e, params?.callee);
				throw e;
			}
			return result.value;
		};
		const _safeParse = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				async: false
			} : { async: false };
			const result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) throw new $ZodAsyncError();
			return result.issues.length ? {
				success: false,
				error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
			} : {
				success: true,
				data: result.value
			};
		};
		const safeParse$1 = /* @__PURE__*/ _safeParse($ZodRealError);
		const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				async: true
			} : { async: true };
			let result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) result = await result;
			return result.issues.length ? {
				success: false,
				error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
			} : {
				success: true,
				data: result.value
			};
		};
		const safeParseAsync$1 = /* @__PURE__*/ _safeParseAsync($ZodRealError);
		const _encode = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _parse(_Err)(schema, value, ctx);
		};
		const _decode = (_Err) => (schema, value, _ctx) => {
			return _parse(_Err)(schema, value, _ctx);
		};
		const _encodeAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _parseAsync(_Err)(schema, value, ctx);
		};
		const _decodeAsync = (_Err) => async (schema, value, _ctx) => {
			return _parseAsync(_Err)(schema, value, _ctx);
		};
		const _safeEncode = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _safeParse(_Err)(schema, value, ctx);
		};
		const _safeDecode = (_Err) => (schema, value, _ctx) => {
			return _safeParse(_Err)(schema, value, _ctx);
		};
		const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _safeParseAsync(_Err)(schema, value, ctx);
		};
		const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
			return _safeParseAsync(_Err)(schema, value, _ctx);
		};
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/regexes.js
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link cuid2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const cuid = /^[cC][0-9a-z]{6,}$/;
		const cuid2 = /^[0-9a-z]+$/;
		const ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
		const xid = /^[0-9a-vA-V]{20}$/;
		const ksuid = /^[A-Za-z0-9]{27}$/;
		const nanoid = /^[a-zA-Z0-9_-]{21}$/;
		/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
		const duration$1 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
		/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
		const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
		/** Returns a regex for validating an RFC 9562/4122 UUID.
		*
		* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
		const uuid = (version) => {
			if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
			return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
		};
		/** Practical email validation */
		const email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
		const _emoji$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
		function emoji() {
			return new RegExp(_emoji$1, "u");
		}
		const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
		const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
		const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
		const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
		const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
		const base64url = /^[A-Za-z0-9_-]*$/;
		const httpProtocol = /^https?$/;
		const e164 = /^\+[1-9]\d{6,14}$/;
		const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
		const date$1 = /*@__PURE__*/ new RegExp(`^${dateSource}$`);
		function timeSource(args) {
			const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
			return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
		}
		function time$1(args) {
			return new RegExp(`^${timeSource(args)}$`);
		}
		function datetime$1(args) {
			const time = timeSource({ precision: args.precision });
			const opts = ["Z"];
			if (args.local) opts.push("");
			if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
			const timeRegex = `${time}(?:${opts.join("|")})`;
			return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
		}
		const string$1 = (params) => {
			const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
			return new RegExp(`^${regex}$`);
		};
		const integer = /^-?\d+$/;
		const number$1 = /^-?\d+(?:\.\d+)?$/;
		const boolean$1 = /^(?:true|false)$/i;
		const lowercase = /^[^A-Z]*$/;
		const uppercase = /^[^a-z]*$/;
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/checks.js
		const $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
			var _a;
			inst._zod ?? (inst._zod = {});
			inst._zod.def = def;
			(_a = inst._zod).onattach ?? (_a.onattach = []);
		});
		const numericOriginMap = {
			number: "number",
			bigint: "bigint",
			object: "date"
		};
		const $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
			$ZodCheck.init(inst, def);
			const origin = numericOriginMap[typeof def.value];
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
				if (def.value < curr) if (def.inclusive) bag.maximum = def.value;
				else bag.exclusiveMaximum = def.value;
			});
			inst._zod.check = (payload) => {
				if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
				payload.issues.push({
					origin,
					code: "too_big",
					maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
					input: payload.value,
					inclusive: def.inclusive,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
			$ZodCheck.init(inst, def);
			const origin = numericOriginMap[typeof def.value];
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
				if (def.value > curr) if (def.inclusive) bag.minimum = def.value;
				else bag.exclusiveMinimum = def.value;
			});
			inst._zod.check = (payload) => {
				if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
				payload.issues.push({
					origin,
					code: "too_small",
					minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
					input: payload.value,
					inclusive: def.inclusive,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMultipleOf = /*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
			$ZodCheck.init(inst, def);
			inst._zod.onattach.push((inst) => {
				var _a;
				(_a = inst._zod.bag).multipleOf ?? (_a.multipleOf = def.value);
			});
			inst._zod.check = (payload) => {
				if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
				if (typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
				payload.issues.push({
					origin: typeof payload.value,
					code: "not_multiple_of",
					divisor: def.value,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
			$ZodCheck.init(inst, def);
			def.format = def.format || "float64";
			const isInt = def.format?.includes("int");
			const origin = isInt ? "int" : "number";
			const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.format = def.format;
				bag.minimum = minimum;
				bag.maximum = maximum;
				if (isInt) bag.pattern = integer;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				if (isInt) {
					if (!Number.isInteger(input)) {
						payload.issues.push({
							expected: origin,
							format: def.format,
							code: "invalid_type",
							continue: false,
							input,
							inst
						});
						return;
					}
					if (!Number.isSafeInteger(input)) {
						if (input > 0) payload.issues.push({
							input,
							code: "too_big",
							maximum: Number.MAX_SAFE_INTEGER,
							note: "Integers must be within the safe integer range.",
							inst,
							origin,
							inclusive: true,
							continue: !def.abort
						});
						else payload.issues.push({
							input,
							code: "too_small",
							minimum: Number.MIN_SAFE_INTEGER,
							note: "Integers must be within the safe integer range.",
							inst,
							origin,
							inclusive: true,
							continue: !def.abort
						});
						return;
					}
				}
				if (input < minimum) payload.issues.push({
					origin: "number",
					input,
					code: "too_small",
					minimum,
					inclusive: true,
					inst,
					continue: !def.abort
				});
				if (input > maximum) payload.issues.push({
					origin: "number",
					input,
					code: "too_big",
					maximum,
					inclusive: true,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = (payload) => {
				const val = payload.value;
				return !nullish(val) && val.length !== void 0;
			});
			inst._zod.onattach.push((inst) => {
				const curr = inst._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
				if (def.maximum < curr) inst._zod.bag.maximum = def.maximum;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				if (input.length <= def.maximum) return;
				const origin = getLengthableOrigin(input);
				payload.issues.push({
					origin,
					code: "too_big",
					maximum: def.maximum,
					inclusive: true,
					input,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = (payload) => {
				const val = payload.value;
				return !nullish(val) && val.length !== void 0;
			});
			inst._zod.onattach.push((inst) => {
				const curr = inst._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
				if (def.minimum > curr) inst._zod.bag.minimum = def.minimum;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				if (input.length >= def.minimum) return;
				const origin = getLengthableOrigin(input);
				payload.issues.push({
					origin,
					code: "too_small",
					minimum: def.minimum,
					inclusive: true,
					input,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = (payload) => {
				const val = payload.value;
				return !nullish(val) && val.length !== void 0;
			});
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.minimum = def.length;
				bag.maximum = def.length;
				bag.length = def.length;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				const length = input.length;
				if (length === def.length) return;
				const origin = getLengthableOrigin(input);
				const tooBig = length > def.length;
				payload.issues.push({
					origin,
					...tooBig ? {
						code: "too_big",
						maximum: def.length
					} : {
						code: "too_small",
						minimum: def.length
					},
					inclusive: true,
					exact: true,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
			var _a, _b;
			$ZodCheck.init(inst, def);
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.format = def.format;
				if (def.pattern) {
					bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
					bag.patterns.add(def.pattern);
				}
			});
			if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
				def.pattern.lastIndex = 0;
				if (def.pattern.test(payload.value)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: def.format,
					input: payload.value,
					...def.pattern ? { pattern: def.pattern.toString() } : {},
					inst,
					continue: !def.abort
				});
			});
			else (_b = inst._zod).check ?? (_b.check = () => {});
		});
		const $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
			$ZodCheckStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				def.pattern.lastIndex = 0;
				if (def.pattern.test(payload.value)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "regex",
					input: payload.value,
					pattern: def.pattern.toString(),
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
			def.pattern ?? (def.pattern = lowercase);
			$ZodCheckStringFormat.init(inst, def);
		});
		const $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
			def.pattern ?? (def.pattern = uppercase);
			$ZodCheckStringFormat.init(inst, def);
		});
		const $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
			$ZodCheck.init(inst, def);
			const escapedRegex = escapeRegex(def.includes);
			const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
			def.pattern = pattern;
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
				bag.patterns.add(pattern);
			});
			inst._zod.check = (payload) => {
				if (payload.value.includes(def.includes, def.position)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "includes",
					includes: def.includes,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
			$ZodCheck.init(inst, def);
			const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
			def.pattern ?? (def.pattern = pattern);
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
				bag.patterns.add(pattern);
			});
			inst._zod.check = (payload) => {
				if (payload.value.startsWith(def.prefix)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "starts_with",
					prefix: def.prefix,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
			$ZodCheck.init(inst, def);
			const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
			def.pattern ?? (def.pattern = pattern);
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
				bag.patterns.add(pattern);
			});
			inst._zod.check = (payload) => {
				if (payload.value.endsWith(def.suffix)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "ends_with",
					suffix: def.suffix,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
			$ZodCheck.init(inst, def);
			inst._zod.check = (payload) => {
				payload.value = def.tx(payload.value);
			};
		});
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/doc.js
		var Doc = class {
			constructor(args = []) {
				this.content = [];
				this.indent = 0;
				if (this) this.args = args;
			}
			indented(fn) {
				this.indent += 1;
				fn(this);
				this.indent -= 1;
			}
			write(arg) {
				if (typeof arg === "function") {
					arg(this, { execution: "sync" });
					arg(this, { execution: "async" });
					return;
				}
				const lines = arg.split("\n").filter((x) => x);
				const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
				const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
				for (const line of dedented) this.content.push(line);
			}
			compile() {
				const F = Function;
				const args = this?.args;
				const lines = [...(this?.content ?? [``]).map((x) => `  ${x}`)];
				return new F(...args, lines.join("\n"));
			}
		};
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/versions.js
		const version = {
			major: 4,
			minor: 4,
			patch: 3
		};
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/schemas.js
		const $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
			var _a;
			inst ?? (inst = {});
			inst._zod.def = def;
			inst._zod.bag = inst._zod.bag || {};
			inst._zod.version = version;
			const checks = [...inst._zod.def.checks ?? []];
			if (inst._zod.traits.has("$ZodCheck")) checks.unshift(inst);
			for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
			if (checks.length === 0) {
				(_a = inst._zod).deferred ?? (_a.deferred = []);
				inst._zod.deferred?.push(() => {
					inst._zod.run = inst._zod.parse;
				});
			} else {
				const runChecks = (payload, checks, ctx) => {
					let isAborted = aborted(payload);
					let asyncResult;
					for (const ch of checks) {
						if (ch._zod.def.when) {
							if (explicitlyAborted(payload)) continue;
							if (!ch._zod.def.when(payload)) continue;
						} else if (isAborted) continue;
						const currLen = payload.issues.length;
						const _ = ch._zod.check(payload);
						if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
						if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
							await _;
							if (payload.issues.length === currLen) return;
							if (!isAborted) isAborted = aborted(payload, currLen);
						});
						else {
							if (payload.issues.length === currLen) continue;
							if (!isAborted) isAborted = aborted(payload, currLen);
						}
					}
					if (asyncResult) return asyncResult.then(() => {
						return payload;
					});
					return payload;
				};
				const handleCanaryResult = (canary, payload, ctx) => {
					if (aborted(canary)) {
						canary.aborted = true;
						return canary;
					}
					const checkResult = runChecks(payload, checks, ctx);
					if (checkResult instanceof Promise) {
						if (ctx.async === false) throw new $ZodAsyncError();
						return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
					}
					return inst._zod.parse(checkResult, ctx);
				};
				inst._zod.run = (payload, ctx) => {
					if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
					if (ctx.direction === "backward") {
						const canary = inst._zod.parse({
							value: payload.value,
							issues: []
						}, {
							...ctx,
							skipChecks: true
						});
						if (canary instanceof Promise) return canary.then((canary) => {
							return handleCanaryResult(canary, payload, ctx);
						});
						return handleCanaryResult(canary, payload, ctx);
					}
					const result = inst._zod.parse(payload, ctx);
					if (result instanceof Promise) {
						if (ctx.async === false) throw new $ZodAsyncError();
						return result.then((result) => runChecks(result, checks, ctx));
					}
					return runChecks(result, checks, ctx);
				};
			}
			defineLazy(inst, "~standard", () => ({
				validate: (value) => {
					try {
						const r = safeParse$1(inst, value);
						return r.success ? { value: r.data } : { issues: r.error?.issues };
					} catch (_) {
						return safeParseAsync$1(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
					}
				},
				vendor: "zod",
				version: 1
			}));
		});
		const $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string$1(inst._zod.bag);
			inst._zod.parse = (payload, _) => {
				if (def.coerce) try {
					payload.value = String(payload.value);
				} catch (_) {}
				if (typeof payload.value === "string") return payload;
				payload.issues.push({
					expected: "string",
					code: "invalid_type",
					input: payload.value,
					inst
				});
				return payload;
			};
		});
		const $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
			$ZodCheckStringFormat.init(inst, def);
			$ZodString.init(inst, def);
		});
		const $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
			def.pattern ?? (def.pattern = guid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
			if (def.version) {
				const v = {
					v1: 1,
					v2: 2,
					v3: 3,
					v4: 4,
					v5: 5,
					v6: 6,
					v7: 7,
					v8: 8
				}[def.version];
				if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
				def.pattern ?? (def.pattern = uuid(v));
			} else def.pattern ?? (def.pattern = uuid());
			$ZodStringFormat.init(inst, def);
		});
		const $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
			def.pattern ?? (def.pattern = email);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				try {
					const trimmed = payload.value.trim();
					if (!def.normalize && def.protocol?.source === httpProtocol.source) {
						if (!/^https?:\/\//i.test(trimmed)) {
							payload.issues.push({
								code: "invalid_format",
								format: "url",
								note: "Invalid URL format",
								input: payload.value,
								inst,
								continue: !def.abort
							});
							return;
						}
					}
					const url = new URL(trimmed);
					if (def.hostname) {
						def.hostname.lastIndex = 0;
						if (!def.hostname.test(url.hostname)) payload.issues.push({
							code: "invalid_format",
							format: "url",
							note: "Invalid hostname",
							pattern: def.hostname.source,
							input: payload.value,
							inst,
							continue: !def.abort
						});
					}
					if (def.protocol) {
						def.protocol.lastIndex = 0;
						if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) payload.issues.push({
							code: "invalid_format",
							format: "url",
							note: "Invalid protocol",
							pattern: def.protocol.source,
							input: payload.value,
							inst,
							continue: !def.abort
						});
					}
					if (def.normalize) payload.value = url.href;
					else payload.value = trimmed;
					return;
				} catch (_) {
					payload.issues.push({
						code: "invalid_format",
						format: "url",
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
			};
		});
		const $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
			def.pattern ?? (def.pattern = emoji());
			$ZodStringFormat.init(inst, def);
		});
		const $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
			def.pattern ?? (def.pattern = nanoid);
			$ZodStringFormat.init(inst, def);
		});
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
			def.pattern ?? (def.pattern = cuid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
			def.pattern ?? (def.pattern = cuid2);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
			def.pattern ?? (def.pattern = ulid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
			def.pattern ?? (def.pattern = xid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
			def.pattern ?? (def.pattern = ksuid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
			def.pattern ?? (def.pattern = datetime$1(def));
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
			def.pattern ?? (def.pattern = date$1);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
			def.pattern ?? (def.pattern = time$1(def));
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
			def.pattern ?? (def.pattern = duration$1);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
			def.pattern ?? (def.pattern = ipv4);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.format = `ipv4`;
		});
		const $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
			def.pattern ?? (def.pattern = ipv6);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.format = `ipv6`;
			inst._zod.check = (payload) => {
				try {
					new URL(`http://[${payload.value}]`);
				} catch {
					payload.issues.push({
						code: "invalid_format",
						format: "ipv6",
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
			};
		});
		const $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
			def.pattern ?? (def.pattern = cidrv4);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
			def.pattern ?? (def.pattern = cidrv6);
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				const parts = payload.value.split("/");
				try {
					if (parts.length !== 2) throw new Error();
					const [address, prefix] = parts;
					if (!prefix) throw new Error();
					const prefixNum = Number(prefix);
					if (`${prefixNum}` !== prefix) throw new Error();
					if (prefixNum < 0 || prefixNum > 128) throw new Error();
					new URL(`http://[${address}]`);
				} catch {
					payload.issues.push({
						code: "invalid_format",
						format: "cidrv6",
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
			};
		});
		function isValidBase64(data) {
			if (data === "") return true;
			if (/\s/.test(data)) return false;
			if (data.length % 4 !== 0) return false;
			try {
				atob(data);
				return true;
			} catch {
				return false;
			}
		}
		const $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
			def.pattern ?? (def.pattern = base64);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.contentEncoding = "base64";
			inst._zod.check = (payload) => {
				if (isValidBase64(payload.value)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "base64",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		function isValidBase64URL(data) {
			if (!base64url.test(data)) return false;
			const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
			return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
		}
		const $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
			def.pattern ?? (def.pattern = base64url);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.contentEncoding = "base64url";
			inst._zod.check = (payload) => {
				if (isValidBase64URL(payload.value)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "base64url",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
			def.pattern ?? (def.pattern = e164);
			$ZodStringFormat.init(inst, def);
		});
		function isValidJWT(token, algorithm = null) {
			try {
				const tokensParts = token.split(".");
				if (tokensParts.length !== 3) return false;
				const [header] = tokensParts;
				if (!header) return false;
				const parsedHeader = JSON.parse(atob(header));
				if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
				if (!parsedHeader.alg) return false;
				if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
				return true;
			} catch {
				return false;
			}
		}
		const $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				if (isValidJWT(payload.value, def.alg)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "jwt",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
			inst._zod.parse = (payload, _ctx) => {
				if (def.coerce) try {
					payload.value = Number(payload.value);
				} catch (_) {}
				const input = payload.value;
				if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
				const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : void 0 : void 0;
				payload.issues.push({
					expected: "number",
					code: "invalid_type",
					input,
					inst,
					...received ? { received } : {}
				});
				return payload;
			};
		});
		const $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
			$ZodCheckNumberFormat.init(inst, def);
			$ZodNumber.init(inst, def);
		});
		const $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = boolean$1;
			inst._zod.parse = (payload, _ctx) => {
				if (def.coerce) try {
					payload.value = Boolean(payload.value);
				} catch (_) {}
				const input = payload.value;
				if (typeof input === "boolean") return payload;
				payload.issues.push({
					expected: "boolean",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload) => payload;
		});
		const $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, _ctx) => {
				payload.issues.push({
					expected: "never",
					code: "invalid_type",
					input: payload.value,
					inst
				});
				return payload;
			};
		});
		function handleArrayResult(result, final, index) {
			if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
			final.value[index] = result.value;
		}
		const $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, ctx) => {
				const input = payload.value;
				if (!Array.isArray(input)) {
					payload.issues.push({
						expected: "array",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				payload.value = Array(input.length);
				const proms = [];
				for (let i = 0; i < input.length; i++) {
					const item = input[i];
					const result = def.element._zod.run({
						value: item,
						issues: []
					}, ctx);
					if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
					else handleArrayResult(result, payload, i);
				}
				if (proms.length) return Promise.all(proms).then(() => payload);
				return payload;
			};
		});
		function handlePropertyResult(result, final, key, input, isOptionalIn, isOptionalOut) {
			const isPresent = key in input;
			if (result.issues.length) {
				if (isOptionalIn && isOptionalOut && !isPresent) return;
				final.issues.push(...prefixIssues(key, result.issues));
			}
			if (!isPresent && !isOptionalIn) {
				if (!result.issues.length) final.issues.push({
					code: "invalid_type",
					expected: "nonoptional",
					input: void 0,
					path: [key]
				});
				return;
			}
			if (result.value === void 0) {
				if (isPresent) final.value[key] = void 0;
			} else final.value[key] = result.value;
		}
		function normalizeDef(def) {
			const keys = Object.keys(def.shape);
			for (const k of keys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
			const okeys = optionalKeys(def.shape);
			return {
				...def,
				keys,
				keySet: new Set(keys),
				numKeys: keys.length,
				optionalKeys: new Set(okeys)
			};
		}
		function handleCatchall(proms, input, payload, ctx, def, inst) {
			const unrecognized = [];
			const keySet = def.keySet;
			const _catchall = def.catchall._zod;
			const t = _catchall.def.type;
			const isOptionalIn = _catchall.optin === "optional";
			const isOptionalOut = _catchall.optout === "optional";
			for (const key in input) {
				if (key === "__proto__") continue;
				if (keySet.has(key)) continue;
				if (t === "never") {
					unrecognized.push(key);
					continue;
				}
				const r = _catchall.run({
					value: input[key],
					issues: []
				}, ctx);
				if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
				else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
			}
			if (unrecognized.length) payload.issues.push({
				code: "unrecognized_keys",
				keys: unrecognized,
				input,
				inst
			});
			if (!proms.length) return payload;
			return Promise.all(proms).then(() => {
				return payload;
			});
		}
		const $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
			$ZodType.init(inst, def);
			if (!Object.getOwnPropertyDescriptor(def, "shape")?.get) {
				const sh = def.shape;
				Object.defineProperty(def, "shape", { get: () => {
					const newSh = { ...sh };
					Object.defineProperty(def, "shape", { value: newSh });
					return newSh;
				} });
			}
			const _normalized = cached(() => normalizeDef(def));
			defineLazy(inst._zod, "propValues", () => {
				const shape = def.shape;
				const propValues = {};
				for (const key in shape) {
					const field = shape[key]._zod;
					if (field.values) {
						propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
						for (const v of field.values) propValues[key].add(v);
					}
				}
				return propValues;
			});
			const isObject$1 = isObject;
			const catchall = def.catchall;
			let value;
			inst._zod.parse = (payload, ctx) => {
				value ?? (value = _normalized.value);
				const input = payload.value;
				if (!isObject$1(input)) {
					payload.issues.push({
						expected: "object",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				payload.value = {};
				const proms = [];
				const shape = value.shape;
				for (const key of value.keys) {
					const el = shape[key];
					const isOptionalIn = el._zod.optin === "optional";
					const isOptionalOut = el._zod.optout === "optional";
					const r = el._zod.run({
						value: input[key],
						issues: []
					}, ctx);
					if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
					else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
				}
				if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
				return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
			};
		});
		const $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
			$ZodObject.init(inst, def);
			const superParse = inst._zod.parse;
			const _normalized = cached(() => normalizeDef(def));
			const generateFastpass = (shape) => {
				const doc = new Doc([
					"shape",
					"payload",
					"ctx"
				]);
				const normalized = _normalized.value;
				const parseStr = (key) => {
					const k = esc(key);
					return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
				};
				doc.write(`const input = payload.value;`);
				const ids = Object.create(null);
				let counter = 0;
				for (const key of normalized.keys) ids[key] = `key_${counter++}`;
				doc.write(`const newResult = {};`);
				for (const key of normalized.keys) {
					const id = ids[key];
					const k = esc(key);
					const schema = shape[key];
					const isOptionalIn = schema?._zod?.optin === "optional";
					const isOptionalOut = schema?._zod?.optout === "optional";
					doc.write(`const ${id} = ${parseStr(key)};`);
					if (isOptionalIn && isOptionalOut) doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
					else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${k} in input;
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
        }

        if (${id}_present) {
          if (${id}.value === undefined) {
            newResult[${k}] = undefined;
          } else {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
					else doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
				}
				doc.write(`payload.value = newResult;`);
				doc.write(`return payload;`);
				const fn = doc.compile();
				return (payload, ctx) => fn(shape, payload, ctx);
			};
			let fastpass;
			const isObject$2 = isObject;
			const jit = !globalConfig.jitless;
			const fastEnabled = jit && allowsEval.value;
			const catchall = def.catchall;
			let value;
			inst._zod.parse = (payload, ctx) => {
				value ?? (value = _normalized.value);
				const input = payload.value;
				if (!isObject$2(input)) {
					payload.issues.push({
						expected: "object",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
					if (!fastpass) fastpass = generateFastpass(def.shape);
					payload = fastpass(payload, ctx);
					if (!catchall) return payload;
					return handleCatchall([], input, payload, ctx, value, inst);
				}
				return superParse(payload, ctx);
			};
		});
		function handleUnionResults(results, final, inst, ctx) {
			for (const result of results) if (result.issues.length === 0) {
				final.value = result.value;
				return final;
			}
			const nonaborted = results.filter((r) => !aborted(r));
			if (nonaborted.length === 1) {
				final.value = nonaborted[0].value;
				return nonaborted[0];
			}
			final.issues.push({
				code: "invalid_union",
				input: final.value,
				inst,
				errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
			});
			return final;
		}
		const $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
			defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
			defineLazy(inst._zod, "values", () => {
				if (def.options.every((o) => o._zod.values)) return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
			});
			defineLazy(inst._zod, "pattern", () => {
				if (def.options.every((o) => o._zod.pattern)) {
					const patterns = def.options.map((o) => o._zod.pattern);
					return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
				}
			});
			const first = def.options.length === 1 ? def.options[0]._zod.run : null;
			inst._zod.parse = (payload, ctx) => {
				if (first) return first(payload, ctx);
				let async = false;
				const results = [];
				for (const option of def.options) {
					const result = option._zod.run({
						value: payload.value,
						issues: []
					}, ctx);
					if (result instanceof Promise) {
						results.push(result);
						async = true;
					} else {
						if (result.issues.length === 0) return result;
						results.push(result);
					}
				}
				if (!async) return handleUnionResults(results, payload, inst, ctx);
				return Promise.all(results).then((results) => {
					return handleUnionResults(results, payload, inst, ctx);
				});
			};
		});
		const $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, ctx) => {
				const input = payload.value;
				const left = def.left._zod.run({
					value: input,
					issues: []
				}, ctx);
				const right = def.right._zod.run({
					value: input,
					issues: []
				}, ctx);
				if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
					return handleIntersectionResults(payload, left, right);
				});
				return handleIntersectionResults(payload, left, right);
			};
		});
		function mergeValues(a, b) {
			if (a === b) return {
				valid: true,
				data: a
			};
			if (a instanceof Date && b instanceof Date && +a === +b) return {
				valid: true,
				data: a
			};
			if (isPlainObject(a) && isPlainObject(b)) {
				const bKeys = Object.keys(b);
				const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
				const newObj = {
					...a,
					...b
				};
				for (const key of sharedKeys) {
					const sharedValue = mergeValues(a[key], b[key]);
					if (!sharedValue.valid) return {
						valid: false,
						mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
					};
					newObj[key] = sharedValue.data;
				}
				return {
					valid: true,
					data: newObj
				};
			}
			if (Array.isArray(a) && Array.isArray(b)) {
				if (a.length !== b.length) return {
					valid: false,
					mergeErrorPath: []
				};
				const newArray = [];
				for (let index = 0; index < a.length; index++) {
					const itemA = a[index];
					const itemB = b[index];
					const sharedValue = mergeValues(itemA, itemB);
					if (!sharedValue.valid) return {
						valid: false,
						mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
					};
					newArray.push(sharedValue.data);
				}
				return {
					valid: true,
					data: newArray
				};
			}
			return {
				valid: false,
				mergeErrorPath: []
			};
		}
		function handleIntersectionResults(result, left, right) {
			const unrecKeys = /* @__PURE__ */ new Map();
			let unrecIssue;
			for (const iss of left.issues) if (iss.code === "unrecognized_keys") {
				unrecIssue ?? (unrecIssue = iss);
				for (const k of iss.keys) {
					if (!unrecKeys.has(k)) unrecKeys.set(k, {});
					unrecKeys.get(k).l = true;
				}
			} else result.issues.push(iss);
			for (const iss of right.issues) if (iss.code === "unrecognized_keys") for (const k of iss.keys) {
				if (!unrecKeys.has(k)) unrecKeys.set(k, {});
				unrecKeys.get(k).r = true;
			}
			else result.issues.push(iss);
			const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
			if (bothKeys.length && unrecIssue) result.issues.push({
				...unrecIssue,
				keys: bothKeys
			});
			if (aborted(result)) return result;
			const merged = mergeValues(left.value, right.value);
			if (!merged.valid) throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
			result.value = merged.data;
			return result;
		}
		const $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
			$ZodType.init(inst, def);
			const values = getEnumValues(def.entries);
			const valuesSet = new Set(values);
			inst._zod.values = valuesSet;
			inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
			inst._zod.parse = (payload, _ctx) => {
				const input = payload.value;
				if (valuesSet.has(input)) return payload;
				payload.issues.push({
					code: "invalid_value",
					values,
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodLiteral = /*@__PURE__*/ $constructor("$ZodLiteral", (inst, def) => {
			$ZodType.init(inst, def);
			if (def.values.length === 0) throw new Error("Cannot create literal schema with no valid values");
			const values = new Set(def.values);
			inst._zod.values = values;
			inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
			inst._zod.parse = (payload, _ctx) => {
				const input = payload.value;
				if (values.has(input)) return payload;
				payload.issues.push({
					code: "invalid_value",
					values: def.values,
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
				const _out = def.transform(payload.value, payload);
				if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
					payload.value = output;
					payload.fallback = true;
					return payload;
				});
				if (_out instanceof Promise) throw new $ZodAsyncError();
				payload.value = _out;
				payload.fallback = true;
				return payload;
			};
		});
		function handleOptionalResult(result, input) {
			if (input === void 0 && (result.issues.length || result.fallback)) return {
				issues: [],
				value: void 0
			};
			return result;
		}
		const $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			inst._zod.optout = "optional";
			defineLazy(inst._zod, "values", () => {
				return def.innerType._zod.values ? new Set([...def.innerType._zod.values, void 0]) : void 0;
			});
			defineLazy(inst._zod, "pattern", () => {
				const pattern = def.innerType._zod.pattern;
				return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				if (def.innerType._zod.optin === "optional") {
					const input = payload.value;
					const result = def.innerType._zod.run(payload, ctx);
					if (result instanceof Promise) return result.then((r) => handleOptionalResult(r, input));
					return handleOptionalResult(result, input);
				}
				if (payload.value === void 0) return payload;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodExactOptional = /*@__PURE__*/ $constructor("$ZodExactOptional", (inst, def) => {
			$ZodOptional.init(inst, def);
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
			inst._zod.parse = (payload, ctx) => {
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
			defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
			defineLazy(inst._zod, "pattern", () => {
				const pattern = def.innerType._zod.pattern;
				return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
			});
			defineLazy(inst._zod, "values", () => {
				return def.innerType._zod.values ? new Set([...def.innerType._zod.values, null]) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				if (payload.value === null) return payload;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				if (payload.value === void 0) {
					payload.value = def.defaultValue;
					/**
					* $ZodDefault returns the default value immediately in forward direction.
					* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
					return payload;
				}
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
				return handleDefaultResult(result, def);
			};
		});
		function handleDefaultResult(payload, def) {
			if (payload.value === void 0) payload.value = def.defaultValue;
			return payload;
		}
		const $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				if (payload.value === void 0) payload.value = def.defaultValue;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "values", () => {
				const v = def.innerType._zod.values;
				return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
				return handleNonOptionalResult(result, inst);
			};
		});
		function handleNonOptionalResult(payload, inst) {
			if (!payload.issues.length && payload.value === void 0) payload.issues.push({
				code: "invalid_type",
				expected: "nonoptional",
				input: payload.value,
				inst
			});
			return payload;
		}
		const $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => {
					payload.value = result.value;
					if (result.issues.length) {
						payload.value = def.catchValue({
							...payload,
							error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
							input: payload.value
						});
						payload.issues = [];
						payload.fallback = true;
					}
					return payload;
				});
				payload.value = result.value;
				if (result.issues.length) {
					payload.value = def.catchValue({
						...payload,
						error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
						input: payload.value
					});
					payload.issues = [];
					payload.fallback = true;
				}
				return payload;
			};
		});
		const $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "values", () => def.in._zod.values);
			defineLazy(inst._zod, "optin", () => def.in._zod.optin);
			defineLazy(inst._zod, "optout", () => def.out._zod.optout);
			defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") {
					const right = def.out._zod.run(payload, ctx);
					if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
					return handlePipeResult(right, def.in, ctx);
				}
				const left = def.in._zod.run(payload, ctx);
				if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
				return handlePipeResult(left, def.out, ctx);
			};
		});
		function handlePipeResult(left, next, ctx) {
			if (left.issues.length) {
				left.aborted = true;
				return left;
			}
			return next._zod.run({
				value: left.value,
				issues: left.issues,
				fallback: left.fallback
			}, ctx);
		}
		const $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
			defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then(handleReadonlyResult);
				return handleReadonlyResult(result);
			};
		});
		function handleReadonlyResult(payload) {
			payload.value = Object.freeze(payload.value);
			return payload;
		}
		const $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
			$ZodCheck.init(inst, def);
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, _) => {
				return payload;
			};
			inst._zod.check = (payload) => {
				const input = payload.value;
				const r = def.fn(input);
				if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
				handleRefineResult(r, payload, input, inst);
			};
		});
		function handleRefineResult(result, payload, input, inst) {
			if (!result) {
				const _iss = {
					code: "custom",
					input,
					inst,
					path: [...inst._zod.def.path ?? []],
					continue: !inst._zod.def.abort
				};
				if (inst._zod.def.params) _iss.params = inst._zod.def.params;
				payload.issues.push(issue(_iss));
			}
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/registries.js
		var _a;
		var $ZodRegistry = class {
			constructor() {
				this._map = /* @__PURE__ */ new WeakMap();
				this._idmap = /* @__PURE__ */ new Map();
			}
			add(schema, ..._meta) {
				const meta = _meta[0];
				this._map.set(schema, meta);
				if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
				return this;
			}
			clear() {
				this._map = /* @__PURE__ */ new WeakMap();
				this._idmap = /* @__PURE__ */ new Map();
				return this;
			}
			remove(schema) {
				const meta = this._map.get(schema);
				if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
				this._map.delete(schema);
				return this;
			}
			get(schema) {
				const p = schema._zod.parent;
				if (p) {
					const pm = { ...this.get(p) ?? {} };
					delete pm.id;
					const f = {
						...pm,
						...this._map.get(schema)
					};
					return Object.keys(f).length ? f : void 0;
				}
				return this._map.get(schema);
			}
			has(schema) {
				return this._map.has(schema);
			}
		};
		function registry() {
			return new $ZodRegistry();
		}
		(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
		const globalRegistry = globalThis.__zod_globalRegistry;
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/api.js
		// @__NO_SIDE_EFFECTS__
		function _string(Class, params) {
			return new Class({
				type: "string",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _email(Class, params) {
			return new Class({
				type: "string",
				format: "email",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _guid(Class, params) {
			return new Class({
				type: "string",
				format: "guid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuid(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv4(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v4",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv6(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v6",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv7(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v7",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _url(Class, params) {
			return new Class({
				type: "string",
				format: "url",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _emoji(Class, params) {
			return new Class({
				type: "string",
				format: "emoji",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _nanoid(Class, params) {
			return new Class({
				type: "string",
				format: "nanoid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link _cuid2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		// @__NO_SIDE_EFFECTS__
		function _cuid(Class, params) {
			return new Class({
				type: "string",
				format: "cuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cuid2(Class, params) {
			return new Class({
				type: "string",
				format: "cuid2",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ulid(Class, params) {
			return new Class({
				type: "string",
				format: "ulid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _xid(Class, params) {
			return new Class({
				type: "string",
				format: "xid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ksuid(Class, params) {
			return new Class({
				type: "string",
				format: "ksuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ipv4(Class, params) {
			return new Class({
				type: "string",
				format: "ipv4",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ipv6(Class, params) {
			return new Class({
				type: "string",
				format: "ipv6",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cidrv4(Class, params) {
			return new Class({
				type: "string",
				format: "cidrv4",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cidrv6(Class, params) {
			return new Class({
				type: "string",
				format: "cidrv6",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _base64(Class, params) {
			return new Class({
				type: "string",
				format: "base64",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _base64url(Class, params) {
			return new Class({
				type: "string",
				format: "base64url",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _e164(Class, params) {
			return new Class({
				type: "string",
				format: "e164",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _jwt(Class, params) {
			return new Class({
				type: "string",
				format: "jwt",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDateTime(Class, params) {
			return new Class({
				type: "string",
				format: "datetime",
				check: "string_format",
				offset: false,
				local: false,
				precision: null,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDate(Class, params) {
			return new Class({
				type: "string",
				format: "date",
				check: "string_format",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoTime(Class, params) {
			return new Class({
				type: "string",
				format: "time",
				check: "string_format",
				precision: null,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDuration(Class, params) {
			return new Class({
				type: "string",
				format: "duration",
				check: "string_format",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _number(Class, params) {
			return new Class({
				type: "number",
				checks: [],
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _int(Class, params) {
			return new Class({
				type: "number",
				check: "number_format",
				abort: false,
				format: "safeint",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _boolean(Class, params) {
			return new Class({
				type: "boolean",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _unknown(Class) {
			return new Class({ type: "unknown" });
		}
		// @__NO_SIDE_EFFECTS__
		function _never(Class, params) {
			return new Class({
				type: "never",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lt(value, params) {
			return new $ZodCheckLessThan({
				check: "less_than",
				...normalizeParams(params),
				value,
				inclusive: false
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lte(value, params) {
			return new $ZodCheckLessThan({
				check: "less_than",
				...normalizeParams(params),
				value,
				inclusive: true
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _gt(value, params) {
			return new $ZodCheckGreaterThan({
				check: "greater_than",
				...normalizeParams(params),
				value,
				inclusive: false
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _gte(value, params) {
			return new $ZodCheckGreaterThan({
				check: "greater_than",
				...normalizeParams(params),
				value,
				inclusive: true
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _multipleOf(value, params) {
			return new $ZodCheckMultipleOf({
				check: "multiple_of",
				...normalizeParams(params),
				value
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _maxLength(maximum, params) {
			return new $ZodCheckMaxLength({
				check: "max_length",
				...normalizeParams(params),
				maximum
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _minLength(minimum, params) {
			return new $ZodCheckMinLength({
				check: "min_length",
				...normalizeParams(params),
				minimum
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _length(length, params) {
			return new $ZodCheckLengthEquals({
				check: "length_equals",
				...normalizeParams(params),
				length
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _regex(pattern, params) {
			return new $ZodCheckRegex({
				check: "string_format",
				format: "regex",
				...normalizeParams(params),
				pattern
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lowercase(params) {
			return new $ZodCheckLowerCase({
				check: "string_format",
				format: "lowercase",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uppercase(params) {
			return new $ZodCheckUpperCase({
				check: "string_format",
				format: "uppercase",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _includes(includes, params) {
			return new $ZodCheckIncludes({
				check: "string_format",
				format: "includes",
				...normalizeParams(params),
				includes
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _startsWith(prefix, params) {
			return new $ZodCheckStartsWith({
				check: "string_format",
				format: "starts_with",
				...normalizeParams(params),
				prefix
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _endsWith(suffix, params) {
			return new $ZodCheckEndsWith({
				check: "string_format",
				format: "ends_with",
				...normalizeParams(params),
				suffix
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _overwrite(tx) {
			return new $ZodCheckOverwrite({
				check: "overwrite",
				tx
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _normalize(form) {
			return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
		}
		// @__NO_SIDE_EFFECTS__
		function _trim() {
			return /* @__PURE__ */ _overwrite((input) => input.trim());
		}
		// @__NO_SIDE_EFFECTS__
		function _toLowerCase() {
			return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
		}
		// @__NO_SIDE_EFFECTS__
		function _toUpperCase() {
			return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
		}
		// @__NO_SIDE_EFFECTS__
		function _slugify() {
			return /* @__PURE__ */ _overwrite((input) => slugify(input));
		}
		// @__NO_SIDE_EFFECTS__
		function _array(Class, element, params) {
			return new Class({
				type: "array",
				element,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _refine(Class, fn, _params) {
			return new Class({
				type: "custom",
				check: "custom",
				fn,
				...normalizeParams(_params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _superRefine(fn, params) {
			const ch = /* @__PURE__ */ _check((payload) => {
				payload.addIssue = (issue$2) => {
					if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
					else {
						const _issue = issue$2;
						if (_issue.fatal) _issue.continue = false;
						_issue.code ?? (_issue.code = "custom");
						_issue.input ?? (_issue.input = payload.value);
						_issue.inst ?? (_issue.inst = ch);
						_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
						payload.issues.push(issue(_issue));
					}
				};
				return fn(payload.value, payload);
			}, params);
			return ch;
		}
		// @__NO_SIDE_EFFECTS__
		function _check(fn, params) {
			const ch = new $ZodCheck({
				check: "custom",
				...normalizeParams(params)
			});
			ch._zod.check = fn;
			return ch;
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/to-json-schema.js
		function initializeContext(params) {
			let target = params?.target ?? "draft-2020-12";
			if (target === "draft-4") target = "draft-04";
			if (target === "draft-7") target = "draft-07";
			return {
				processors: params.processors ?? {},
				metadataRegistry: params?.metadata ?? globalRegistry,
				target,
				unrepresentable: params?.unrepresentable ?? "throw",
				override: params?.override ?? (() => {}),
				io: params?.io ?? "output",
				counter: 0,
				seen: /* @__PURE__ */ new Map(),
				cycles: params?.cycles ?? "ref",
				reused: params?.reused ?? "inline",
				external: params?.external ?? void 0
			};
		}
		function process(schema, ctx, _params = {
			path: [],
			schemaPath: []
		}) {
			var _a;
			const def = schema._zod.def;
			const seen = ctx.seen.get(schema);
			if (seen) {
				seen.count++;
				if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
				return seen.schema;
			}
			const result = {
				schema: {},
				count: 1,
				cycle: void 0,
				path: _params.path
			};
			ctx.seen.set(schema, result);
			const overrideSchema = schema._zod.toJSONSchema?.();
			if (overrideSchema) result.schema = overrideSchema;
			else {
				const params = {
					..._params,
					schemaPath: [..._params.schemaPath, schema],
					path: _params.path
				};
				if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
				else {
					const _json = result.schema;
					const processor = ctx.processors[def.type];
					if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
					processor(schema, ctx, _json, params);
				}
				const parent = schema._zod.parent;
				if (parent) {
					if (!result.ref) result.ref = parent;
					process(parent, ctx, params);
					ctx.seen.get(parent).isParent = true;
				}
			}
			const meta = ctx.metadataRegistry.get(schema);
			if (meta) Object.assign(result.schema, meta);
			if (ctx.io === "input" && isTransforming(schema)) {
				delete result.schema.examples;
				delete result.schema.default;
			}
			if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
			delete result.schema._prefault;
			return ctx.seen.get(schema).schema;
		}
		function extractDefs(ctx, schema) {
			const root = ctx.seen.get(schema);
			if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
			const idToSchema = /* @__PURE__ */ new Map();
			for (const entry of ctx.seen.entries()) {
				const id = ctx.metadataRegistry.get(entry[0])?.id;
				if (id) {
					const existing = idToSchema.get(id);
					if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
					idToSchema.set(id, entry[0]);
				}
			}
			const makeURI = (entry) => {
				const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
				if (ctx.external) {
					const externalId = ctx.external.registry.get(entry[0])?.id;
					const uriGenerator = ctx.external.uri ?? ((id) => id);
					if (externalId) return { ref: uriGenerator(externalId) };
					const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
					entry[1].defId = id;
					return {
						defId: id,
						ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}`
					};
				}
				if (entry[1] === root) return { ref: "#" };
				const defUriPrefix = `#/${defsSegment}/`;
				const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
				return {
					defId,
					ref: defUriPrefix + defId
				};
			};
			const extractToDef = (entry) => {
				if (entry[1].schema.$ref) return;
				const seen = entry[1];
				const { ref, defId } = makeURI(entry);
				seen.def = { ...seen.schema };
				if (defId) seen.defId = defId;
				const schema = seen.schema;
				for (const key in schema) delete schema[key];
				schema.$ref = ref;
			};
			if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
			}
			for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (schema === entry[0]) {
					extractToDef(entry);
					continue;
				}
				if (ctx.external) {
					const ext = ctx.external.registry.get(entry[0])?.id;
					if (schema !== entry[0] && ext) {
						extractToDef(entry);
						continue;
					}
				}
				if (ctx.metadataRegistry.get(entry[0])?.id) {
					extractToDef(entry);
					continue;
				}
				if (seen.cycle) {
					extractToDef(entry);
					continue;
				}
				if (seen.count > 1) {
					if (ctx.reused === "ref") {
						extractToDef(entry);
						continue;
					}
				}
			}
		}
		function finalize(ctx, schema) {
			const root = ctx.seen.get(schema);
			if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
			const flattenRef = (zodSchema) => {
				const seen = ctx.seen.get(zodSchema);
				if (seen.ref === null) return;
				const schema = seen.def ?? seen.schema;
				const _cached = { ...schema };
				const ref = seen.ref;
				seen.ref = null;
				if (ref) {
					flattenRef(ref);
					const refSeen = ctx.seen.get(ref);
					const refSchema = refSeen.schema;
					if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
						schema.allOf = schema.allOf ?? [];
						schema.allOf.push(refSchema);
					} else Object.assign(schema, refSchema);
					Object.assign(schema, _cached);
					if (zodSchema._zod.parent === ref) for (const key in schema) {
						if (key === "$ref" || key === "allOf") continue;
						if (!(key in _cached)) delete schema[key];
					}
					if (refSchema.$ref && refSeen.def) for (const key in schema) {
						if (key === "$ref" || key === "allOf") continue;
						if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
					}
				}
				const parent = zodSchema._zod.parent;
				if (parent && parent !== ref) {
					flattenRef(parent);
					const parentSeen = ctx.seen.get(parent);
					if (parentSeen?.schema.$ref) {
						schema.$ref = parentSeen.schema.$ref;
						if (parentSeen.def) for (const key in schema) {
							if (key === "$ref" || key === "allOf") continue;
							if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
						}
					}
				}
				ctx.override({
					zodSchema,
					jsonSchema: schema,
					path: seen.path ?? []
				});
			};
			for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
			const result = {};
			if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
			else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
			else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
			else if (ctx.target === "openapi-3.0") {}
			if (ctx.external?.uri) {
				const id = ctx.external.registry.get(schema)?.id;
				if (!id) throw new Error("Schema is missing an `id` property");
				result.$id = ctx.external.uri(id);
			}
			Object.assign(result, root.def ?? root.schema);
			const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
			if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
			const defs = ctx.external?.defs ?? {};
			for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (seen.def && seen.defId) {
					if (seen.def.id === seen.defId) delete seen.def.id;
					defs[seen.defId] = seen.def;
				}
			}
			if (ctx.external) {} else if (Object.keys(defs).length > 0) if (ctx.target === "draft-2020-12") result.$defs = defs;
			else result.definitions = defs;
			try {
				const finalized = JSON.parse(JSON.stringify(result));
				Object.defineProperty(finalized, "~standard", {
					value: {
						...schema["~standard"],
						jsonSchema: {
							input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
							output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
						}
					},
					enumerable: false,
					writable: false
				});
				return finalized;
			} catch (_err) {
				throw new Error("Error converting schema to JSON.");
			}
		}
		function isTransforming(_schema, _ctx) {
			const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
			if (ctx.seen.has(_schema)) return false;
			ctx.seen.add(_schema);
			const def = _schema._zod.def;
			if (def.type === "transform") return true;
			if (def.type === "array") return isTransforming(def.element, ctx);
			if (def.type === "set") return isTransforming(def.valueType, ctx);
			if (def.type === "lazy") return isTransforming(def.getter(), ctx);
			if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") return isTransforming(def.innerType, ctx);
			if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
			if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
			if (def.type === "pipe") {
				if (_schema._zod.traits.has("$ZodCodec")) return true;
				return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
			}
			if (def.type === "object") {
				for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
				return false;
			}
			if (def.type === "union") {
				for (const option of def.options) if (isTransforming(option, ctx)) return true;
				return false;
			}
			if (def.type === "tuple") {
				for (const item of def.items) if (isTransforming(item, ctx)) return true;
				if (def.rest && isTransforming(def.rest, ctx)) return true;
				return false;
			}
			return false;
		}
		/**
		* Creates a toJSONSchema method for a schema instance.
		* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
		*/
		const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
			const ctx = initializeContext({
				...params,
				processors
			});
			process(schema, ctx);
			extractDefs(ctx, schema);
			return finalize(ctx, schema);
		};
		const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
			const { libraryOptions, target } = params ?? {};
			const ctx = initializeContext({
				...libraryOptions ?? {},
				target,
				io,
				processors
			});
			process(schema, ctx);
			extractDefs(ctx, schema);
			return finalize(ctx, schema);
		};
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/json-schema-processors.js
		const formatMap = {
			guid: "uuid",
			url: "uri",
			datetime: "date-time",
			json_string: "json-string",
			regex: ""
		};
		const stringProcessor = (schema, ctx, _json, _params) => {
			const json = _json;
			json.type = "string";
			const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
			if (typeof minimum === "number") json.minLength = minimum;
			if (typeof maximum === "number") json.maxLength = maximum;
			if (format) {
				json.format = formatMap[format] ?? format;
				if (json.format === "") delete json.format;
				if (format === "time") delete json.format;
			}
			if (contentEncoding) json.contentEncoding = contentEncoding;
			if (patterns && patterns.size > 0) {
				const regexes = [...patterns];
				if (regexes.length === 1) json.pattern = regexes[0].source;
				else if (regexes.length > 1) json.allOf = [...regexes.map((regex) => ({
					...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
					pattern: regex.source
				}))];
			}
		};
		const numberProcessor = (schema, ctx, _json, _params) => {
			const json = _json;
			const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
			if (typeof format === "string" && format.includes("int")) json.type = "integer";
			else json.type = "number";
			const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
			const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
			const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
			if (exMin) if (legacy) {
				json.minimum = exclusiveMinimum;
				json.exclusiveMinimum = true;
			} else json.exclusiveMinimum = exclusiveMinimum;
			else if (typeof minimum === "number") json.minimum = minimum;
			if (exMax) if (legacy) {
				json.maximum = exclusiveMaximum;
				json.exclusiveMaximum = true;
			} else json.exclusiveMaximum = exclusiveMaximum;
			else if (typeof maximum === "number") json.maximum = maximum;
			if (typeof multipleOf === "number") json.multipleOf = multipleOf;
		};
		const booleanProcessor = (_schema, _ctx, json, _params) => {
			json.type = "boolean";
		};
		const neverProcessor = (_schema, _ctx, json, _params) => {
			json.not = {};
		};
		const enumProcessor = (schema, _ctx, json, _params) => {
			const def = schema._zod.def;
			const values = getEnumValues(def.entries);
			if (values.every((v) => typeof v === "number")) json.type = "number";
			if (values.every((v) => typeof v === "string")) json.type = "string";
			json.enum = values;
		};
		const literalProcessor = (schema, ctx, json, _params) => {
			const def = schema._zod.def;
			const vals = [];
			for (const val of def.values) if (val === void 0) {
				if (ctx.unrepresentable === "throw") throw new Error("Literal `undefined` cannot be represented in JSON Schema");
			} else if (typeof val === "bigint") if (ctx.unrepresentable === "throw") throw new Error("BigInt literals cannot be represented in JSON Schema");
			else vals.push(Number(val));
			else vals.push(val);
			if (vals.length === 0) {} else if (vals.length === 1) {
				const val = vals[0];
				json.type = val === null ? "null" : typeof val;
				if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") json.enum = [val];
				else json.const = val;
			} else {
				if (vals.every((v) => typeof v === "number")) json.type = "number";
				if (vals.every((v) => typeof v === "string")) json.type = "string";
				if (vals.every((v) => typeof v === "boolean")) json.type = "boolean";
				if (vals.every((v) => v === null)) json.type = "null";
				json.enum = vals;
			}
		};
		const customProcessor = (_schema, ctx, _json, _params) => {
			if (ctx.unrepresentable === "throw") throw new Error("Custom types cannot be represented in JSON Schema");
		};
		const transformProcessor = (_schema, ctx, _json, _params) => {
			if (ctx.unrepresentable === "throw") throw new Error("Transforms cannot be represented in JSON Schema");
		};
		const arrayProcessor = (schema, ctx, _json, params) => {
			const json = _json;
			const def = schema._zod.def;
			const { minimum, maximum } = schema._zod.bag;
			if (typeof minimum === "number") json.minItems = minimum;
			if (typeof maximum === "number") json.maxItems = maximum;
			json.type = "array";
			json.items = process(def.element, ctx, {
				...params,
				path: [...params.path, "items"]
			});
		};
		const objectProcessor = (schema, ctx, _json, params) => {
			const json = _json;
			const def = schema._zod.def;
			json.type = "object";
			json.properties = {};
			const shape = def.shape;
			for (const key in shape) json.properties[key] = process(shape[key], ctx, {
				...params,
				path: [
					...params.path,
					"properties",
					key
				]
			});
			const allKeys = new Set(Object.keys(shape));
			const requiredKeys = new Set([...allKeys].filter((key) => {
				const v = def.shape[key]._zod;
				if (ctx.io === "input") return v.optin === void 0;
				else return v.optout === void 0;
			}));
			if (requiredKeys.size > 0) json.required = Array.from(requiredKeys);
			if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
			else if (!def.catchall) {
				if (ctx.io === "output") json.additionalProperties = false;
			} else if (def.catchall) json.additionalProperties = process(def.catchall, ctx, {
				...params,
				path: [...params.path, "additionalProperties"]
			});
		};
		const unionProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const isExclusive = def.inclusive === false;
			const options = def.options.map((x, i) => process(x, ctx, {
				...params,
				path: [
					...params.path,
					isExclusive ? "oneOf" : "anyOf",
					i
				]
			}));
			if (isExclusive) json.oneOf = options;
			else json.anyOf = options;
		};
		const intersectionProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const a = process(def.left, ctx, {
				...params,
				path: [
					...params.path,
					"allOf",
					0
				]
			});
			const b = process(def.right, ctx, {
				...params,
				path: [
					...params.path,
					"allOf",
					1
				]
			});
			const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
			json.allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
		};
		const nullableProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const inner = process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			if (ctx.target === "openapi-3.0") {
				seen.ref = def.innerType;
				json.nullable = true;
			} else json.anyOf = [inner, { type: "null" }];
		};
		const nonoptionalProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
		};
		const defaultProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			json.default = JSON.parse(JSON.stringify(def.defaultValue));
		};
		const prefaultProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			if (ctx.io === "input") json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
		};
		const catchProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			let catchValue;
			try {
				catchValue = def.catchValue(void 0);
			} catch {
				throw new Error("Dynamic catch values are not supported in JSON Schema");
			}
			json.default = catchValue;
		};
		const pipeProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			const inIsTransform = def.in._zod.traits.has("$ZodTransform");
			const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
			process(innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = innerType;
		};
		const readonlyProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			json.readOnly = true;
		};
		const optionalProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
		};
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/classic/iso.js
		const ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
			$ZodISODateTime.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function datetime(params) {
			return /* @__PURE__ */ _isoDateTime(ZodISODateTime, params);
		}
		const ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
			$ZodISODate.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function date(params) {
			return /* @__PURE__ */ _isoDate(ZodISODate, params);
		}
		const ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
			$ZodISOTime.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function time(params) {
			return /* @__PURE__ */ _isoTime(ZodISOTime, params);
		}
		const ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
			$ZodISODuration.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function duration(params) {
			return /* @__PURE__ */ _isoDuration(ZodISODuration, params);
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/classic/errors.js
		const initializer = (inst, issues) => {
			$ZodError.init(inst, issues);
			inst.name = "ZodError";
			Object.defineProperties(inst, {
				format: { value: (mapper) => formatError(inst, mapper) },
				flatten: { value: (mapper) => flattenError(inst, mapper) },
				addIssue: { value: (issue) => {
					inst.issues.push(issue);
					inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
				} },
				addIssues: { value: (issues) => {
					inst.issues.push(...issues);
					inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
				} },
				isEmpty: { get() {
					return inst.issues.length === 0;
				} }
			});
		};
		const ZodRealError = /*@__PURE__*/ $constructor("ZodError", initializer, { Parent: Error });
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/classic/parse.js
		const parse = /* @__PURE__ */ _parse(ZodRealError);
		const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
		const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
		const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
		const encode = /* @__PURE__ */ _encode(ZodRealError);
		const decode = /* @__PURE__ */ _decode(ZodRealError);
		const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
		const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
		const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
		const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
		const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
		const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
		//#endregion
		//#region ../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/classic/schemas.js
		const _installedGroups = /* @__PURE__ */ new WeakMap();
		function _installLazyMethods(inst, group, methods) {
			const proto = Object.getPrototypeOf(inst);
			let installed = _installedGroups.get(proto);
			if (!installed) {
				installed = /* @__PURE__ */ new Set();
				_installedGroups.set(proto, installed);
			}
			if (installed.has(group)) return;
			installed.add(group);
			for (const key in methods) {
				const fn = methods[key];
				Object.defineProperty(proto, key, {
					configurable: true,
					enumerable: false,
					get() {
						const bound = fn.bind(this);
						Object.defineProperty(this, key, {
							configurable: true,
							writable: true,
							enumerable: true,
							value: bound
						});
						return bound;
					},
					set(v) {
						Object.defineProperty(this, key, {
							configurable: true,
							writable: true,
							enumerable: true,
							value: v
						});
					}
				});
			}
		}
		const ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
			$ZodType.init(inst, def);
			Object.assign(inst["~standard"], { jsonSchema: {
				input: createStandardJSONSchemaMethod(inst, "input"),
				output: createStandardJSONSchemaMethod(inst, "output")
			} });
			inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
			inst.def = def;
			inst.type = def.type;
			Object.defineProperty(inst, "_def", { value: def });
			inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
			inst.safeParse = (data, params) => safeParse(inst, data, params);
			inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
			inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
			inst.spa = inst.safeParseAsync;
			inst.encode = (data, params) => encode(inst, data, params);
			inst.decode = (data, params) => decode(inst, data, params);
			inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
			inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
			inst.safeEncode = (data, params) => safeEncode(inst, data, params);
			inst.safeDecode = (data, params) => safeDecode(inst, data, params);
			inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
			inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
			_installLazyMethods(inst, "ZodType", {
				check(...chks) {
					const def = this.def;
					return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
						check: ch,
						def: { check: "custom" },
						onattach: []
					} } : ch)] }), { parent: true });
				},
				with(...chks) {
					return this.check(...chks);
				},
				clone(def, params) {
					return clone(this, def, params);
				},
				brand() {
					return this;
				},
				register(reg, meta) {
					reg.add(this, meta);
					return this;
				},
				refine(check, params) {
					return this.check(refine(check, params));
				},
				superRefine(refinement, params) {
					return this.check(superRefine(refinement, params));
				},
				overwrite(fn) {
					return this.check(/* @__PURE__ */ _overwrite(fn));
				},
				optional() {
					return optional(this);
				},
				exactOptional() {
					return exactOptional(this);
				},
				nullable() {
					return nullable(this);
				},
				nullish() {
					return optional(nullable(this));
				},
				nonoptional(params) {
					return nonoptional(this, params);
				},
				array() {
					return array(this);
				},
				or(arg) {
					return union([this, arg]);
				},
				and(arg) {
					return intersection(this, arg);
				},
				transform(tx) {
					return pipe(this, transform(tx));
				},
				default(d) {
					return _default(this, d);
				},
				prefault(d) {
					return prefault(this, d);
				},
				catch(params) {
					return _catch(this, params);
				},
				pipe(target) {
					return pipe(this, target);
				},
				readonly() {
					return readonly(this);
				},
				describe(description) {
					const cl = this.clone();
					globalRegistry.add(cl, { description });
					return cl;
				},
				meta(...args) {
					if (args.length === 0) return globalRegistry.get(this);
					const cl = this.clone();
					globalRegistry.add(cl, args[0]);
					return cl;
				},
				isOptional() {
					return this.safeParse(void 0).success;
				},
				isNullable() {
					return this.safeParse(null).success;
				},
				apply(fn) {
					return fn(this);
				}
			});
			Object.defineProperty(inst, "description", {
				get() {
					return globalRegistry.get(inst)?.description;
				},
				configurable: true
			});
			return inst;
		});
		/** @internal */
		const _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
			$ZodString.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
			const bag = inst._zod.bag;
			inst.format = bag.format ?? null;
			inst.minLength = bag.minimum ?? null;
			inst.maxLength = bag.maximum ?? null;
			_installLazyMethods(inst, "_ZodString", {
				regex(...args) {
					return this.check(/* @__PURE__ */ _regex(...args));
				},
				includes(...args) {
					return this.check(/* @__PURE__ */ _includes(...args));
				},
				startsWith(...args) {
					return this.check(/* @__PURE__ */ _startsWith(...args));
				},
				endsWith(...args) {
					return this.check(/* @__PURE__ */ _endsWith(...args));
				},
				min(...args) {
					return this.check(/* @__PURE__ */ _minLength(...args));
				},
				max(...args) {
					return this.check(/* @__PURE__ */ _maxLength(...args));
				},
				length(...args) {
					return this.check(/* @__PURE__ */ _length(...args));
				},
				nonempty(...args) {
					return this.check(/* @__PURE__ */ _minLength(1, ...args));
				},
				lowercase(params) {
					return this.check(/* @__PURE__ */ _lowercase(params));
				},
				uppercase(params) {
					return this.check(/* @__PURE__ */ _uppercase(params));
				},
				trim() {
					return this.check(/* @__PURE__ */ _trim());
				},
				normalize(...args) {
					return this.check(/* @__PURE__ */ _normalize(...args));
				},
				toLowerCase() {
					return this.check(/* @__PURE__ */ _toLowerCase());
				},
				toUpperCase() {
					return this.check(/* @__PURE__ */ _toUpperCase());
				},
				slugify() {
					return this.check(/* @__PURE__ */ _slugify());
				}
			});
		});
		const ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
			$ZodString.init(inst, def);
			_ZodString.init(inst, def);
			inst.email = (params) => inst.check(/* @__PURE__ */ _email(ZodEmail, params));
			inst.url = (params) => inst.check(/* @__PURE__ */ _url(ZodURL, params));
			inst.jwt = (params) => inst.check(/* @__PURE__ */ _jwt(ZodJWT, params));
			inst.emoji = (params) => inst.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
			inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
			inst.uuid = (params) => inst.check(/* @__PURE__ */ _uuid(ZodUUID, params));
			inst.uuidv4 = (params) => inst.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
			inst.uuidv6 = (params) => inst.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
			inst.uuidv7 = (params) => inst.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
			inst.nanoid = (params) => inst.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
			inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
			inst.cuid = (params) => inst.check(/* @__PURE__ */ _cuid(ZodCUID, params));
			inst.cuid2 = (params) => inst.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
			inst.ulid = (params) => inst.check(/* @__PURE__ */ _ulid(ZodULID, params));
			inst.base64 = (params) => inst.check(/* @__PURE__ */ _base64(ZodBase64, params));
			inst.base64url = (params) => inst.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
			inst.xid = (params) => inst.check(/* @__PURE__ */ _xid(ZodXID, params));
			inst.ksuid = (params) => inst.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
			inst.ipv4 = (params) => inst.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
			inst.ipv6 = (params) => inst.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
			inst.cidrv4 = (params) => inst.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
			inst.cidrv6 = (params) => inst.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
			inst.e164 = (params) => inst.check(/* @__PURE__ */ _e164(ZodE164, params));
			inst.datetime = (params) => inst.check(datetime(params));
			inst.date = (params) => inst.check(date(params));
			inst.time = (params) => inst.check(time(params));
			inst.duration = (params) => inst.check(duration(params));
		});
		function string(params) {
			return /* @__PURE__ */ _string(ZodString, params);
		}
		const ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			_ZodString.init(inst, def);
		});
		const ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
			$ZodEmail.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
			$ZodGUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
			$ZodUUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
			$ZodURL.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
			$ZodEmoji.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
			$ZodNanoID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
			$ZodCUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
			$ZodCUID2.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
			$ZodULID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
			$ZodXID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
			$ZodKSUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
			$ZodIPv4.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
			$ZodIPv6.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
			$ZodCIDRv4.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
			$ZodCIDRv6.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
			$ZodBase64.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
			$ZodBase64URL.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
			$ZodE164.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
			$ZodJWT.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
			$ZodNumber.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
			_installLazyMethods(inst, "ZodNumber", {
				gt(value, params) {
					return this.check(/* @__PURE__ */ _gt(value, params));
				},
				gte(value, params) {
					return this.check(/* @__PURE__ */ _gte(value, params));
				},
				min(value, params) {
					return this.check(/* @__PURE__ */ _gte(value, params));
				},
				lt(value, params) {
					return this.check(/* @__PURE__ */ _lt(value, params));
				},
				lte(value, params) {
					return this.check(/* @__PURE__ */ _lte(value, params));
				},
				max(value, params) {
					return this.check(/* @__PURE__ */ _lte(value, params));
				},
				int(params) {
					return this.check(int(params));
				},
				safe(params) {
					return this.check(int(params));
				},
				positive(params) {
					return this.check(/* @__PURE__ */ _gt(0, params));
				},
				nonnegative(params) {
					return this.check(/* @__PURE__ */ _gte(0, params));
				},
				negative(params) {
					return this.check(/* @__PURE__ */ _lt(0, params));
				},
				nonpositive(params) {
					return this.check(/* @__PURE__ */ _lte(0, params));
				},
				multipleOf(value, params) {
					return this.check(/* @__PURE__ */ _multipleOf(value, params));
				},
				step(value, params) {
					return this.check(/* @__PURE__ */ _multipleOf(value, params));
				},
				finite() {
					return this;
				}
			});
			const bag = inst._zod.bag;
			inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
			inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
			inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? .5);
			inst.isFinite = true;
			inst.format = bag.format ?? null;
		});
		function number(params) {
			return /* @__PURE__ */ _number(ZodNumber, params);
		}
		const ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
			$ZodNumberFormat.init(inst, def);
			ZodNumber.init(inst, def);
		});
		function int(params) {
			return /* @__PURE__ */ _int(ZodNumberFormat, params);
		}
		const ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
			$ZodBoolean.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
		});
		function boolean(params) {
			return /* @__PURE__ */ _boolean(ZodBoolean, params);
		}
		const ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
			$ZodUnknown.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => void 0;
		});
		function unknown() {
			return /* @__PURE__ */ _unknown(ZodUnknown);
		}
		const ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
			$ZodNever.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
		});
		function never(params) {
			return /* @__PURE__ */ _never(ZodNever, params);
		}
		const ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
			$ZodArray.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
			inst.element = def.element;
			_installLazyMethods(inst, "ZodArray", {
				min(n, params) {
					return this.check(/* @__PURE__ */ _minLength(n, params));
				},
				nonempty(params) {
					return this.check(/* @__PURE__ */ _minLength(1, params));
				},
				max(n, params) {
					return this.check(/* @__PURE__ */ _maxLength(n, params));
				},
				length(n, params) {
					return this.check(/* @__PURE__ */ _length(n, params));
				},
				unwrap() {
					return this.element;
				}
			});
		});
		function array(element, params) {
			return /* @__PURE__ */ _array(ZodArray, element, params);
		}
		const ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
			$ZodObjectJIT.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
			defineLazy(inst, "shape", () => {
				return def.shape;
			});
			_installLazyMethods(inst, "ZodObject", {
				keyof() {
					return _enum(Object.keys(this._zod.def.shape));
				},
				catchall(catchall) {
					return this.clone({
						...this._zod.def,
						catchall
					});
				},
				passthrough() {
					return this.clone({
						...this._zod.def,
						catchall: unknown()
					});
				},
				loose() {
					return this.clone({
						...this._zod.def,
						catchall: unknown()
					});
				},
				strict() {
					return this.clone({
						...this._zod.def,
						catchall: never()
					});
				},
				strip() {
					return this.clone({
						...this._zod.def,
						catchall: void 0
					});
				},
				extend(incoming) {
					return extend(this, incoming);
				},
				safeExtend(incoming) {
					return safeExtend(this, incoming);
				},
				merge(other) {
					return merge(this, other);
				},
				pick(mask) {
					return pick(this, mask);
				},
				omit(mask) {
					return omit(this, mask);
				},
				partial(...args) {
					return partial(ZodOptional, this, args[0]);
				},
				required(...args) {
					return required(ZodNonOptional, this, args[0]);
				}
			});
		});
		function object(shape, params) {
			return new ZodObject({
				type: "object",
				shape: shape ?? {},
				...normalizeParams(params)
			});
		}
		const ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
			$ZodUnion.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
			inst.options = def.options;
		});
		function union(options, params) {
			return new ZodUnion({
				type: "union",
				options,
				...normalizeParams(params)
			});
		}
		const ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
			$ZodIntersection.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
		});
		function intersection(left, right) {
			return new ZodIntersection({
				type: "intersection",
				left,
				right
			});
		}
		const ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
			$ZodEnum.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
			inst.enum = def.entries;
			inst.options = Object.values(def.entries);
			const keys = new Set(Object.keys(def.entries));
			inst.extract = (values, params) => {
				const newEntries = {};
				for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
				else throw new Error(`Key ${value} not found in enum`);
				return new ZodEnum({
					...def,
					checks: [],
					...normalizeParams(params),
					entries: newEntries
				});
			};
			inst.exclude = (values, params) => {
				const newEntries = { ...def.entries };
				for (const value of values) if (keys.has(value)) delete newEntries[value];
				else throw new Error(`Key ${value} not found in enum`);
				return new ZodEnum({
					...def,
					checks: [],
					...normalizeParams(params),
					entries: newEntries
				});
			};
		});
		function _enum(values, params) {
			return new ZodEnum({
				type: "enum",
				entries: Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values,
				...normalizeParams(params)
			});
		}
		const ZodLiteral = /*@__PURE__*/ $constructor("ZodLiteral", (inst, def) => {
			$ZodLiteral.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
			inst.values = new Set(def.values);
			Object.defineProperty(inst, "value", { get() {
				if (def.values.length > 1) throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
				return def.values[0];
			} });
		});
		function literal(value, params) {
			return new ZodLiteral({
				type: "literal",
				values: Array.isArray(value) ? value : [value],
				...normalizeParams(params)
			});
		}
		const ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
			$ZodTransform.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
			inst._zod.parse = (payload, _ctx) => {
				if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
				payload.addIssue = (issue$1) => {
					if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
					else {
						const _issue = issue$1;
						if (_issue.fatal) _issue.continue = false;
						_issue.code ?? (_issue.code = "custom");
						_issue.input ?? (_issue.input = payload.value);
						_issue.inst ?? (_issue.inst = inst);
						payload.issues.push(issue(_issue));
					}
				};
				const output = def.transform(payload.value, payload);
				if (output instanceof Promise) return output.then((output) => {
					payload.value = output;
					payload.fallback = true;
					return payload;
				});
				payload.value = output;
				payload.fallback = true;
				return payload;
			};
		});
		function transform(fn) {
			return new ZodTransform({
				type: "transform",
				transform: fn
			});
		}
		const ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
			$ZodOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function optional(innerType) {
			return new ZodOptional({
				type: "optional",
				innerType
			});
		}
		const ZodExactOptional = /*@__PURE__*/ $constructor("ZodExactOptional", (inst, def) => {
			$ZodExactOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function exactOptional(innerType) {
			return new ZodExactOptional({
				type: "optional",
				innerType
			});
		}
		const ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
			$ZodNullable.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function nullable(innerType) {
			return new ZodNullable({
				type: "nullable",
				innerType
			});
		}
		const ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
			$ZodDefault.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
			inst.removeDefault = inst.unwrap;
		});
		function _default(innerType, defaultValue) {
			return new ZodDefault({
				type: "default",
				innerType,
				get defaultValue() {
					return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
				}
			});
		}
		const ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
			$ZodPrefault.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function prefault(innerType, defaultValue) {
			return new ZodPrefault({
				type: "prefault",
				innerType,
				get defaultValue() {
					return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
				}
			});
		}
		const ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
			$ZodNonOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function nonoptional(innerType, params) {
			return new ZodNonOptional({
				type: "nonoptional",
				innerType,
				...normalizeParams(params)
			});
		}
		const ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
			$ZodCatch.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
			inst.removeCatch = inst.unwrap;
		});
		function _catch(innerType, catchValue) {
			return new ZodCatch({
				type: "catch",
				innerType,
				catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
			});
		}
		const ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
			$ZodPipe.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
			inst.in = def.in;
			inst.out = def.out;
		});
		function pipe(in_, out) {
			return new ZodPipe({
				type: "pipe",
				in: in_,
				out
			});
		}
		const ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
			$ZodReadonly.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function readonly(innerType) {
			return new ZodReadonly({
				type: "readonly",
				innerType
			});
		}
		const ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
			$ZodCustom.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
		});
		function refine(fn, _params = {}) {
			return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
		}
		function superRefine(fn, params) {
			return /* @__PURE__ */ _superRefine(fn, params);
		}
		const TYPERT_REMOTE$1 = {
			package: "@deepseek-ai/dsh-content-outputs",
			descriptors: [{
				id: "@deepseek-ai/dsh-content-outputs#contentOutputs/list",
				service: "contentOutputs",
				namespace: "contentOutputs",
				method: "list",
				invocation: { kind: "direct" },
				parameters: [],
				result: {
					mode: "strict",
					typeSymbol: "@deepseek-ai/dsh-content-outputs/types#ContentOutputsSnapshot",
					schema: object({
						"root": string().readonly(),
						"projects": array(object({
							"topic": intersection(string(), unknown()).readonly(),
							"title": string().readonly(),
							"kind": union([
								literal("article"),
								literal("xhs-note"),
								literal("video"),
								literal("cards"),
								literal("poster"),
								literal("audio"),
								literal("other")
							]).readonly(),
							"platform": union([literal(null), string()]).readonly(),
							"status": union([
								literal("draft"),
								literal("ready"),
								literal("published")
							]).readonly(),
							"tags": array(string()).readonly(),
							"summary": union([literal(null), string()]).readonly(),
							"updatedAt": string().readonly(),
							"deliverables": array(string()).readonly(),
							"assetCount": number().readonly(),
							"hasMetadata": boolean().readonly()
						})).readonly(),
						"problems": array(object({
							"topic": string().readonly(),
							"detail": string().readonly()
						})).readonly()
					})
				},
				sourceLocation: {
					"file": "packages/creation/content-outputs/src/index.ts",
					"line": 48,
					"column": 9
				}
			}]
		};
		//#endregion
		//#region ../../creation/content-schedule/lib/typert.remote-client.js
		const _deepseek_ai_dsh_content_schedule_contentSchedule_delete_parameter_0$schema = intersection(string(), unknown());
		const _deepseek_ai_dsh_content_schedule_contentSchedule_delete_result$schema = object({
			"file": string().readonly(),
			"items": array(object({
				"id": intersection(string(), unknown()).readonly(),
				"title": string().readonly(),
				"date": string().readonly(),
				"time": union([literal(null), string()]).readonly(),
				"platform": union([literal(null), string()]).readonly(),
				"status": union([
					literal("draft"),
					literal("published"),
					literal("idea"),
					literal("scheduled")
				]).readonly(),
				"kind": union([literal("content"), literal("event")]).readonly(),
				"topic": union([literal(null), string()]).readonly(),
				"url": union([literal(null), string()]).readonly()
			})).readonly(),
			"problems": array(string()).readonly()
		});
		const _deepseek_ai_dsh_content_schedule_contentSchedule_list_result$schema = object({
			"file": string().readonly(),
			"items": array(object({
				"id": intersection(string(), unknown()).readonly(),
				"title": string().readonly(),
				"date": string().readonly(),
				"time": union([literal(null), string()]).readonly(),
				"platform": union([literal(null), string()]).readonly(),
				"status": union([
					literal("draft"),
					literal("published"),
					literal("idea"),
					literal("scheduled")
				]).readonly(),
				"kind": union([literal("content"), literal("event")]).readonly(),
				"topic": union([literal(null), string()]).readonly(),
				"url": union([literal(null), string()]).readonly()
			})).readonly(),
			"problems": array(string()).readonly()
		});
		const _deepseek_ai_dsh_content_schedule_contentSchedule_put_parameter_0$schema = object({
			"id": intersection(string(), unknown()).readonly().optional(),
			"title": string().readonly(),
			"date": string().readonly(),
			"time": union([literal(null), string()]).readonly(),
			"platform": union([literal(null), string()]).readonly(),
			"status": union([
				literal("draft"),
				literal("published"),
				literal("idea"),
				literal("scheduled")
			]).readonly(),
			"kind": union([literal("content"), literal("event")]).readonly(),
			"topic": union([literal(null), string()]).readonly(),
			"url": union([literal(null), string()]).readonly()
		});
		const _deepseek_ai_dsh_content_schedule_contentSchedule_put_result$schema = object({
			"file": string().readonly(),
			"items": array(object({
				"id": intersection(string(), unknown()).readonly(),
				"title": string().readonly(),
				"date": string().readonly(),
				"time": union([literal(null), string()]).readonly(),
				"platform": union([literal(null), string()]).readonly(),
				"status": union([
					literal("draft"),
					literal("published"),
					literal("idea"),
					literal("scheduled")
				]).readonly(),
				"kind": union([literal("content"), literal("event")]).readonly(),
				"topic": union([literal(null), string()]).readonly(),
				"url": union([literal(null), string()]).readonly()
			})).readonly(),
			"problems": array(string()).readonly()
		});
		const TYPERT_REMOTE = {
			package: "@deepseek-ai/dsh-content-schedule",
			descriptors: [
				{
					id: "@deepseek-ai/dsh-content-schedule#contentSchedule/delete",
					service: "contentSchedule",
					namespace: "contentSchedule",
					method: "delete",
					invocation: { kind: "direct" },
					parameters: [{
						name: "id",
						wire: "id",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-content-schedule#contentSchedule/delete:id",
							schema: _deepseek_ai_dsh_content_schedule_contentSchedule_delete_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-content-schedule/types#ContentScheduleSnapshot",
						schema: _deepseek_ai_dsh_content_schedule_contentSchedule_delete_result$schema
					},
					sourceLocation: {
						"file": "packages/creation/content-schedule/src/index.ts",
						"line": 80,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-content-schedule#contentSchedule/list",
					service: "contentSchedule",
					namespace: "contentSchedule",
					method: "list",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-content-schedule/types#ContentScheduleSnapshot",
						schema: _deepseek_ai_dsh_content_schedule_contentSchedule_list_result$schema
					},
					sourceLocation: {
						"file": "packages/creation/content-schedule/src/index.ts",
						"line": 50,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-content-schedule#contentSchedule/put",
					service: "contentSchedule",
					namespace: "contentSchedule",
					method: "put",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						wire: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-content-schedule/types#ScheduleItemInput",
							schema: _deepseek_ai_dsh_content_schedule_contentSchedule_put_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-content-schedule/types#ContentScheduleSnapshot",
						schema: _deepseek_ai_dsh_content_schedule_contentSchedule_put_result$schema
					},
					sourceLocation: {
						"file": "packages/creation/content-schedule/src/index.ts",
						"line": 62,
						"column": 9
					}
				}
			]
		};
		//#endregion
		//#region lib/types/client/studio-store.js
		/**
		* The open/close controller shared by the sidebar entry and the frame-wide
		* surface. apply() creates one instance and injects it into both slot
		* registrations — component state cannot cross two slot entries, and no
		* store seat is needed for a single boolean observable.
		*/
		/**
		* Create the shared open/close controller.
		* @returns the controller with an initially closed state.
		*/
		function createContentStudioController() {
			let open = false;
			const listeners = /* @__PURE__ */ new Set();
			const emit = () => {
				for (const listener of listeners) listener();
			};
			return {
				isOpen: () => open,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				open: () => {
					if (open) return;
					open = true;
					emit();
				},
				close: () => {
					if (!open) return;
					open = false;
					emit();
				}
			};
		}
		//#endregion
		//#region \0dsh-css:D:\deepseek-harness\packages\client\ui-content-studio\src\client\ContentStudio.module.css.mjs
		const css = ".jTHpnG_entryWide{width:100%;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:8px;align-items:center;gap:8px;padding:8px 10px;font-size:13px;transition:background .14s,color .14s;display:flex}.jTHpnG_entryWide:hover,.jTHpnG_entryRail:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.jTHpnG_entryRail{width:36px;height:36px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:8px;justify-content:center;align-items:center;margin:0 auto;padding:0;transition:background .14s,color .14s;display:flex}.jTHpnG_entryLabel{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.jTHpnG_surface{background:var(--dsw-alias-bg-layer-1);position:fixed;inset:0;overflow:hidden}.jTHpnG_shell{height:100%;display:flex}.jTHpnG_side{border-right:1px solid var(--dsw-alias-border-l1);flex-direction:column;flex:none;width:208px;padding:20px 12px 16px;display:flex}.jTHpnG_sideBrand{color:var(--dsw-alias-label-primary);align-items:center;gap:8px;margin-bottom:14px;padding:6px 10px;font-size:15px;font-weight:600;display:flex}.jTHpnG_accountBox{margin:0 4px 14px;position:relative}.jTHpnG_accountButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:100%;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;font-size:13px;display:flex}.jTHpnG_accountButton:hover{border-color:var(--dsw-alias-border-l4)}.jTHpnG_accountName{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.jTHpnG_accountList{z-index:5;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);box-shadow:0 8px 24px color-mix(in srgb, var(--dsw-alias-bg-mask-1) 20%, transparent);border-radius:8px;padding:4px;position:absolute;top:calc(100% + 4px);left:0;right:0}.jTHpnG_accountOption{width:100%;color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;background:0 0;border:none;border-radius:6px;align-items:center;gap:6px;padding:8px 10px;font-size:12px;display:flex}.jTHpnG_accountOption:hover{background:var(--dsw-alias-interactive-bg-hover)}.jTHpnG_accountOptionActive,.jTHpnG_accountOptionActive:hover{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}.jTHpnG_accountCreateRow{align-items:center;gap:6px;padding:4px;display:flex}.jTHpnG_accountInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);min-width:0;color:var(--dsw-alias-label-primary);border-radius:6px;flex:1;padding:5px 8px;font-size:12px}.jTHpnG_accountCreateAdd{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);cursor:pointer;border:none;border-radius:6px;flex:none;padding:5px 10px;font-size:11px}.jTHpnG_sideNav{flex-direction:column;gap:2px;display:flex}.jTHpnG_navItem{color:var(--dsw-alias-label-secondary);text-align:left;cursor:pointer;background:0 0;border:none;border-radius:8px;align-items:center;padding:9px 12px;font-size:13px;transition:background .14s,color .14s;display:flex}.jTHpnG_navItem:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.jTHpnG_navItemActive,.jTHpnG_navItemActive:hover{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}.jTHpnG_sideFoot{flex-direction:column;gap:10px;margin-top:auto;padding:10px 6px 0;display:flex}.jTHpnG_main{flex:1;position:relative;overflow-y:auto}.jTHpnG_main .jTHpnG_close{z-index:1;position:absolute;top:24px;right:28px}.jTHpnG_workbench{flex-direction:column;gap:24px;display:flex}.jTHpnG_pageTitle{color:var(--dsw-alias-label-primary);margin:0;font-size:20px;font-weight:600}.jTHpnG_accountsPane{flex-direction:column;gap:14px;max-width:420px;display:flex}.jTHpnG_accountsList{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:4px 12px}.jTHpnG_accountActiveTag{background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent);color:var(--dsw-alias-state-business-primary);border-radius:999px;margin-left:8px;padding:1px 8px;font-size:10px}.jTHpnG_personaInput{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);width:100%;max-width:640px;color:var(--dsw-alias-label-primary);font:inherit;resize:vertical;border-radius:10px;padding:12px;font-size:13px;line-height:1.6}.jTHpnG_personaRow{align-items:center;gap:12px;display:flex}.jTHpnG_personaSaved{color:var(--dsw-alias-state-success-primary);font-size:12px}.jTHpnG_helloRow{padding-right:56px}.jTHpnG_hello{color:var(--dsw-alias-label-primary);margin:0;font-size:26px;font-weight:600}.jTHpnG_helloSub{color:var(--dsw-alias-label-tertiary);margin:8px 0 0;font-size:13px}.jTHpnG_quickRow{flex-wrap:wrap;gap:10px;display:flex}.jTHpnG_chip{align-items:center;gap:6px;display:inline-flex}.jTHpnG_panelTitle{color:var(--dsw-alias-state-business-primary);align-items:center;gap:6px;display:inline-flex}.jTHpnG_panelRowThree{grid-template-columns:repeat(3,1fr);gap:12px;display:grid}.jTHpnG_panelRowTwo{grid-template-columns:1fr 1fr;gap:12px;display:grid}.jTHpnG_statIcon{background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent);width:30px;height:30px;color:var(--dsw-alias-state-business-primary);border-radius:8px;justify-content:center;align-items:center;margin-bottom:8px;display:flex}.jTHpnG_listRowButton{border:none;border-top:1px solid var(--dsw-alias-border-l1);width:100%;font:inherit;text-align:left;cursor:pointer;background:0 0;justify-content:space-between;align-items:center;gap:8px;padding:7px 0;display:flex}.jTHpnG_listRowButton:first-of-type{border-top:none}.jTHpnG_listRowCopied .jTHpnG_listTitle,.jTHpnG_listRowCopied .jTHpnG_listMeta{color:var(--dsw-alias-state-success-primary)}.jTHpnG_dataPills{flex-wrap:wrap;gap:6px;margin-bottom:8px;display:flex}.jTHpnG_dataPill{border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:3px 10px;font-size:11px}.jTHpnG_chip{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:999px;padding:8px 16px;font-size:13px;transition:border-color .14s}.jTHpnG_chip:hover{border-color:var(--dsw-alias-state-business-primary)}.jTHpnG_chipCopied,.jTHpnG_chipCopied:hover{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}.jTHpnG_statRow{grid-template-columns:repeat(4,1fr);gap:12px;display:grid}.jTHpnG_statCard{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;flex-direction:column;gap:4px;padding:18px;display:flex}.jTHpnG_statValue{color:var(--dsw-alias-label-primary);font-size:26px;font-weight:600}.jTHpnG_statLabel{color:var(--dsw-alias-label-tertiary);font-size:12px}.jTHpnG_panelRow{grid-template-columns:1fr 1fr;gap:12px;display:grid}.jTHpnG_panel{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:16px}.jTHpnG_panelHead{justify-content:space-between;align-items:center;margin-bottom:10px;display:flex}.jTHpnG_panelTitle{color:var(--dsw-alias-label-primary);margin:0;font-size:13px;font-weight:600}.jTHpnG_panelMore{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;font-size:12px}.jTHpnG_panelMore:hover{color:var(--dsw-alias-state-business-primary)}.jTHpnG_panelEmpty{color:var(--dsw-alias-label-dimmed);margin:8px 0;font-size:12px}.jTHpnG_listRow{border-top:1px solid var(--dsw-alias-border-l1);justify-content:space-between;align-items:center;gap:8px;padding:7px 0;font-size:12px;display:flex}.jTHpnG_listRow:first-of-type{border-top:none}.jTHpnG_listTitle{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);overflow:hidden}.jTHpnG_listMeta{color:var(--dsw-alias-label-tertiary);flex:none}.jTHpnG_frame{max-width:960px;margin:0 auto;padding:40px 32px 64px}.jTHpnG_header{justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:24px;display:flex}.jTHpnG_headerControls{align-items:center;gap:12px;display:flex}.jTHpnG_views{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;gap:4px;padding:4px;display:inline-flex}.jTHpnG_title{color:var(--dsw-alias-label-primary);margin:0;font-size:22px;font-weight:600}.jTHpnG_subtitle{color:var(--dsw-alias-label-tertiary);margin:6px 0 0;font-size:13px}.jTHpnG_close{border:1px solid var(--dsw-alias-border-l1);width:32px;height:32px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border-radius:8px;flex:none;justify-content:center;align-items:center;transition:background .14s,color .14s;display:flex}.jTHpnG_back{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);cursor:pointer;border:none;border-radius:8px;flex:none;padding:6px 14px;font-size:13px;transition:background .14s}.jTHpnG_back:hover{background:var(--dsw-alias-button-primary-hover)}.jTHpnG_close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.jTHpnG_tabs{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;gap:4px;margin-bottom:28px;padding:4px;display:inline-flex}.jTHpnG_tab{color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:7px;padding:6px 14px;font-size:13px;transition:background .14s,color .14s}.jTHpnG_tab:hover{color:var(--dsw-alias-label-primary)}.jTHpnG_tabActive,.jTHpnG_tabActive:hover{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}.jTHpnG_group{margin-bottom:28px}.jTHpnG_groupTitle{color:var(--dsw-alias-label-secondary);margin:0 0 10px;font-size:13px;font-weight:600}.jTHpnG_grid{grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;display:grid}.jTHpnG_card{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:inherit;text-align:left;font:inherit;cursor:pointer;border-radius:10px;flex-direction:column;gap:8px;padding:14px;transition:transform .14s,border-color .14s;display:flex}.jTHpnG_card:hover{border-color:var(--dsw-alias-border-l2);transform:translateY(-2px)}.jTHpnG_cardCopied,.jTHpnG_cardCopied:hover{border-color:var(--dsw-alias-state-success-primary)}.jTHpnG_cardHead{justify-content:space-between;align-items:center;gap:8px;display:flex}.jTHpnG_cardTitle{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600}.jTHpnG_cardDetail{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}.jTHpnG_cardHint{color:var(--dsw-alias-label-dimmed);font-size:11px}.jTHpnG_cardHintCopied{color:var(--dsw-alias-state-success-primary)}.jTHpnG_library{flex-direction:column;gap:12px;display:flex}.jTHpnG_libraryState{border:1px dashed var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);border-radius:10px;justify-content:center;align-items:center;gap:8px;padding:48px 16px;font-size:13px;display:flex}.jTHpnG_libraryProblems{color:var(--dsw-alias-state-warn-primary);border-radius:8px;align-items:center;gap:6px;padding:8px 12px;font-size:12px;display:flex}.jTHpnG_libraryCard{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;flex-direction:column;gap:8px;padding:14px;display:flex}.jTHpnG_libraryTags{flex-wrap:wrap;gap:4px;display:flex}.jTHpnG_libraryTag{border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px}.jTHpnG_statusDraft{color:var(--dsw-alias-label-tertiary);background:color-mix(in srgb, var(--dsw-alias-label-tertiary) 12%, transparent)}.jTHpnG_statusReady{color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent)}.jTHpnG_statusPublished{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent)}.jTHpnG_retry{border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border-radius:7px;align-items:center;gap:4px;padding:4px 10px;font-size:12px;display:inline-flex}.jTHpnG_retry:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.jTHpnG_calendar{flex-direction:column;gap:10px;display:flex}.jTHpnG_calendarBar{align-items:center;gap:8px;display:flex}.jTHpnG_calendarMonth{color:var(--dsw-alias-label-primary);text-align:center;min-width:88px;font-size:14px;font-weight:600}.jTHpnG_calendarNav,.jTHpnG_calendarToday{border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border-radius:7px;font-size:12px}.jTHpnG_calendarNav{width:26px;height:26px}.jTHpnG_calendarToday{padding:4px 12px}.jTHpnG_calendarNav:hover,.jTHpnG_calendarToday:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.jTHpnG_calendarHead,.jTHpnG_calendarGrid{grid-template-columns:repeat(7,1fr);gap:4px;display:grid}.jTHpnG_calendarWeekday{text-align:center;color:var(--dsw-alias-label-tertiary);padding:2px 0;font-size:11px}.jTHpnG_calendarCell{border:1px solid var(--dsw-alias-border-l1);cursor:pointer;border-radius:8px;flex-direction:column;gap:3px;min-height:76px;padding:4px;transition:border-color .14s;display:flex}.jTHpnG_calendarCell:hover{border-color:var(--dsw-alias-border-l2)}.jTHpnG_calendarCellOutside{opacity:.45}.jTHpnG_calendarCellToday{border-color:var(--dsw-alias-state-business-primary)}.jTHpnG_calendarDayNum{color:var(--dsw-alias-label-secondary);font-size:11px}.jTHpnG_calendarChip{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);cursor:default;border-radius:5px;align-items:center;gap:4px;min-width:0;padding:1px 4px;font-size:10px;display:flex}.jTHpnG_calendarChipTitle{text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}.jTHpnG_calendarChipAction{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;align-items:center;padding:0 2px;font-size:10px;display:inline-flex}.jTHpnG_calendarChipAction:hover{color:var(--dsw-alias-label-primary)}.jTHpnG_calendarDot{border-radius:999px;flex:none;width:6px;height:6px}.jTHpnG_dotIdea{background:var(--dsw-alias-label-tertiary)}.jTHpnG_dotDraft{background:var(--dsw-alias-state-warn-primary)}.jTHpnG_dotScheduled{background:var(--dsw-alias-state-business-primary)}.jTHpnG_dotPublished{background:var(--dsw-alias-state-success-primary)}.jTHpnG_calendarForm{flex-direction:column;gap:4px;margin-top:2px;display:flex}.jTHpnG_calendarInput{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);width:100%;color:var(--dsw-alias-label-primary);border-radius:5px;padding:3px 6px;font-size:10px}.jTHpnG_calendarFormRow{align-items:center;gap:6px;display:flex}.jTHpnG_calendarSubmit{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);cursor:pointer;border:none;border-radius:5px;align-items:center;gap:3px;padding:2px 8px;font-size:10px;display:inline-flex}.jTHpnG_calendarHint{border:1px dashed var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);text-align:center;border-radius:8px;padding:12px;font-size:12px}.jTHpnG_about{border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-dimmed);justify-content:center;align-items:center;gap:12px;margin-top:32px;padding-top:16px;font-size:11px;display:flex}.jTHpnG_aboutLink{color:var(--dsw-alias-label-tertiary);text-decoration:none}.jTHpnG_aboutLink:hover{color:var(--dsw-alias-state-business-primary)}.jTHpnG_badge{white-space:nowrap;border-radius:999px;flex:none;padding:2px 8px;font-size:11px}.jTHpnG_badgeDone{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent)}.jTHpnG_badgeReady{color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent)}.jTHpnG_badgeNeed{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent)}.jTHpnG_badgeIncoming{color:var(--dsw-alias-label-tertiary);background:color-mix(in srgb, var(--dsw-alias-label-tertiary) 12%, transparent)}";
		const tagId = "@deepseek-ai/dsh-client-ui-content-studio/ContentStudio.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-content-studio";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var ContentStudio_module_css_default = {
			"about": "jTHpnG_about",
			"aboutLink": "jTHpnG_aboutLink",
			"accountActiveTag": "jTHpnG_accountActiveTag",
			"accountBox": "jTHpnG_accountBox",
			"accountButton": "jTHpnG_accountButton",
			"accountCreateAdd": "jTHpnG_accountCreateAdd",
			"accountCreateRow": "jTHpnG_accountCreateRow",
			"accountInput": "jTHpnG_accountInput",
			"accountList": "jTHpnG_accountList",
			"accountName": "jTHpnG_accountName",
			"accountOption": "jTHpnG_accountOption",
			"accountOptionActive": "jTHpnG_accountOptionActive",
			"accountsList": "jTHpnG_accountsList",
			"accountsPane": "jTHpnG_accountsPane",
			"back": "jTHpnG_back",
			"badge": "jTHpnG_badge",
			"badgeDone": "jTHpnG_badgeDone",
			"badgeIncoming": "jTHpnG_badgeIncoming",
			"badgeNeed": "jTHpnG_badgeNeed",
			"badgeReady": "jTHpnG_badgeReady",
			"calendar": "jTHpnG_calendar",
			"calendarBar": "jTHpnG_calendarBar",
			"calendarCell": "jTHpnG_calendarCell",
			"calendarCellOutside": "jTHpnG_calendarCellOutside",
			"calendarCellToday": "jTHpnG_calendarCellToday",
			"calendarChip": "jTHpnG_calendarChip",
			"calendarChipAction": "jTHpnG_calendarChipAction",
			"calendarChipTitle": "jTHpnG_calendarChipTitle",
			"calendarDayNum": "jTHpnG_calendarDayNum",
			"calendarDot": "jTHpnG_calendarDot",
			"calendarForm": "jTHpnG_calendarForm",
			"calendarFormRow": "jTHpnG_calendarFormRow",
			"calendarGrid": "jTHpnG_calendarGrid",
			"calendarHead": "jTHpnG_calendarHead",
			"calendarHint": "jTHpnG_calendarHint",
			"calendarInput": "jTHpnG_calendarInput",
			"calendarMonth": "jTHpnG_calendarMonth",
			"calendarNav": "jTHpnG_calendarNav",
			"calendarSubmit": "jTHpnG_calendarSubmit",
			"calendarToday": "jTHpnG_calendarToday",
			"calendarWeekday": "jTHpnG_calendarWeekday",
			"card": "jTHpnG_card",
			"cardCopied": "jTHpnG_cardCopied",
			"cardDetail": "jTHpnG_cardDetail",
			"cardHead": "jTHpnG_cardHead",
			"cardHint": "jTHpnG_cardHint",
			"cardHintCopied": "jTHpnG_cardHintCopied",
			"cardTitle": "jTHpnG_cardTitle",
			"chip": "jTHpnG_chip",
			"chipCopied": "jTHpnG_chipCopied",
			"close": "jTHpnG_close",
			"dataPill": "jTHpnG_dataPill",
			"dataPills": "jTHpnG_dataPills",
			"dotDraft": "jTHpnG_dotDraft",
			"dotIdea": "jTHpnG_dotIdea",
			"dotPublished": "jTHpnG_dotPublished",
			"dotScheduled": "jTHpnG_dotScheduled",
			"entryLabel": "jTHpnG_entryLabel",
			"entryRail": "jTHpnG_entryRail",
			"entryWide": "jTHpnG_entryWide",
			"frame": "jTHpnG_frame",
			"grid": "jTHpnG_grid",
			"group": "jTHpnG_group",
			"groupTitle": "jTHpnG_groupTitle",
			"header": "jTHpnG_header",
			"headerControls": "jTHpnG_headerControls",
			"hello": "jTHpnG_hello",
			"helloRow": "jTHpnG_helloRow",
			"helloSub": "jTHpnG_helloSub",
			"library": "jTHpnG_library",
			"libraryCard": "jTHpnG_libraryCard",
			"libraryProblems": "jTHpnG_libraryProblems",
			"libraryState": "jTHpnG_libraryState",
			"libraryTag": "jTHpnG_libraryTag",
			"libraryTags": "jTHpnG_libraryTags",
			"listMeta": "jTHpnG_listMeta",
			"listRow": "jTHpnG_listRow",
			"listRowButton": "jTHpnG_listRowButton",
			"listRowCopied": "jTHpnG_listRowCopied",
			"listTitle": "jTHpnG_listTitle",
			"main": "jTHpnG_main",
			"navItem": "jTHpnG_navItem",
			"navItemActive": "jTHpnG_navItemActive",
			"pageTitle": "jTHpnG_pageTitle",
			"panel": "jTHpnG_panel",
			"panelEmpty": "jTHpnG_panelEmpty",
			"panelHead": "jTHpnG_panelHead",
			"panelMore": "jTHpnG_panelMore",
			"panelRow": "jTHpnG_panelRow",
			"panelRowThree": "jTHpnG_panelRowThree",
			"panelRowTwo": "jTHpnG_panelRowTwo",
			"panelTitle": "jTHpnG_panelTitle",
			"personaInput": "jTHpnG_personaInput",
			"personaRow": "jTHpnG_personaRow",
			"personaSaved": "jTHpnG_personaSaved",
			"quickRow": "jTHpnG_quickRow",
			"retry": "jTHpnG_retry",
			"shell": "jTHpnG_shell",
			"side": "jTHpnG_side",
			"sideBrand": "jTHpnG_sideBrand",
			"sideFoot": "jTHpnG_sideFoot",
			"sideNav": "jTHpnG_sideNav",
			"statCard": "jTHpnG_statCard",
			"statIcon": "jTHpnG_statIcon",
			"statLabel": "jTHpnG_statLabel",
			"statRow": "jTHpnG_statRow",
			"statValue": "jTHpnG_statValue",
			"statusDraft": "jTHpnG_statusDraft",
			"statusPublished": "jTHpnG_statusPublished",
			"statusReady": "jTHpnG_statusReady",
			"subtitle": "jTHpnG_subtitle",
			"surface": "jTHpnG_surface",
			"tab": "jTHpnG_tab",
			"tabActive": "jTHpnG_tabActive",
			"tabs": "jTHpnG_tabs",
			"title": "jTHpnG_title",
			"views": "jTHpnG_views",
			"workbench": "jTHpnG_workbench"
		};
		//#endregion
		//#region lib/types/client/StudioEntry.js
		/**
		* The sidebar entry occupying the `sidebar.footer.action` hole: a labeled
		* row while the column is wide, a 16px icon on the 56px rail. Clicking opens
		* the frame-wide workbench surface through the shared controller.
		*/
		/**
		* Render the Content Studio sidebar entry.
		* @param props - the column state, the shared controller, and the locale seat.
		* @returns the entry button element tree.
		*/
		function StudioEntry({ wide, studio, t }) {
			const button = (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: wide ? ContentStudio_module_css_default.entryWide : ContentStudio_module_css_default.entryRail,
				"aria-label": t("entry.aria"),
				onClick: () => {
					studio.open();
				},
				children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkle16, { size: wide ? 16 : 18 }), wide && (0, react_jsx_runtime.jsx)("span", {
					className: ContentStudio_module_css_default.entryLabel,
					children: t("entry.label")
				})]
			});
			return wide ? button : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: t("entry.label"),
				delayMs: 500,
				children: button
			});
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region lib/types/client/capabilities.js
		/**
		* The Content Studio capability catalog: the static dual-tab menu of creation
		* and operation verbs this plugin ships. Display copy lives in the locale
		* dictionaries under `cap.<id>.title` / `cap.<id>.detail`; this module owns
		* the structure, the clipboard payload, and the maturity classification.
		*/
		/** Tab order and the group sequence each tab renders. */
		const STUDIO_TABS = [{
			id: "create",
			groups: [
				"visual",
				"article",
				"video",
				"audio"
			]
		}, {
			id: "operate",
			groups: [
				"discover",
				"plan",
				"publish",
				"review"
			]
		}];
		/** All catalog items across both tabs, in render order. */
		const CAPABILITY_ITEMS = [
			{
				id: "social-card",
				group: "visual",
				maturity: "ready",
				prompt: "请为我创作一组社媒图文卡片。\n主题：【主题】\n平台：【小红书 / 微博 / 朋友圈】\n要求：共【3-6】张，首图有钩子，每张一个要点，末图带行动引导，附每张的文案。"
			},
			{
				id: "cover-poster",
				group: "visual",
				maturity: "ready",
				prompt: "请为我设计一张封面海报的方案。\n主题：【主题】\n用途：【文章封面 / 视频封面】\n要求：给出标题排版、副标题、视觉主体与配色的完整描述，并附两版备选方案。"
			},
			{
				id: "infographic",
				group: "visual",
				maturity: "need",
				prompt: "请把下面的信息整理成一张信息图的制作方案。\n原始信息：【粘贴数据或要点】\n要求：给出分区结构、每区的图表类型与文案，标注数据来源。"
			},
			{
				id: "gzh-article",
				group: "article",
				maturity: "ready",
				prompt: "请为我写一篇公众号文章。\n主题：【主题】\n目标读者：【读者画像】\n要求：标题给 3 个备选，开头 3 句内建立钩子，正文分 3-5 个小节，结尾有互动引导，全文【1500-2500】字。"
			},
			{
				id: "long-form",
				group: "article",
				maturity: "ready",
				prompt: "请为我写一篇深度长文。\n主题：【主题】\n核心观点：【一句话立场】\n要求：先列大纲待我确认，再展开成文；引用处标注来源，全文【3000】字以上。"
			},
			{
				id: "polish",
				group: "article",
				maturity: "done",
				prompt: "请润色下面这段文字，保持原意与个人语气。\n原文：【粘贴原文】\n要求：先指出 3 个最主要的问题，再给出改写版，最后逐条说明改动理由。"
			},
			{
				id: "short-script",
				group: "video",
				maturity: "ready",
				prompt: "请为我写一条短视频口播脚本。\n主题：【主题】\n时长：【45-60】秒\n要求：前 3 秒钩子、口播正文分镜编号、每镜一句画面提示，结尾行动引导，口语化。"
			},
			{
				id: "storyboard",
				group: "video",
				maturity: "incoming",
				prompt: "请把下面的脚本扩写为分镜表。\n脚本：【粘贴脚本】\n要求：每镜给出景别、运镜、画面内容、口播与时长，输出为表格。"
			},
			{
				id: "podcast-outline",
				group: "audio",
				maturity: "incoming",
				prompt: "请为我设计一期播客的大纲。\n主题：【主题】\n时长：【30】分钟\n要求：开场引入、3-4 个章节话题与各章提问清单、结尾总结，标注时间分配。"
			},
			{
				id: "hotspot",
				group: "discover",
				maturity: "need",
				prompt: "请围绕我的账号方向做一次热点选题。\n账号方向：【一句话定位】\n要求：列出 5 个可切入的热点，每个给出热度理由、切入角度与标题草稿，并标注风险。"
			},
			{
				id: "breakdown",
				group: "discover",
				maturity: "ready",
				prompt: "请拆解下面这条爆款内容。\n内容：【粘贴链接或全文】\n要求：从选题、标题、结构、情绪、发布时间五个维度归因，最后给出可复用的 3 条模板。"
			},
			{
				id: "positioning",
				group: "plan",
				maturity: "ready",
				prompt: "请帮我做账号定位。\n我的背景：【经历 / 优势 / 资源】\n目标平台：【平台】\n要求：给出 3 个定位方向，各含人设一句话、内容支柱、对标账号与变现路径，并推荐其一。"
			},
			{
				id: "calendar-plan",
				group: "plan",
				maturity: "incoming",
				prompt: "请为我制定下个月的内容日历。\n定位：【一句话定位】\n更新频率：【每周 N 篇】\n要求：按周排布选题，标注内容类型与预期目标，预留 2 个机动热点位。"
			},
			{
				id: "multi-platform",
				group: "publish",
				maturity: "ready",
				prompt: "请把这篇母版内容适配为多平台版本。\n母版：【粘贴全文】\n目标平台：【小红书 / 公众号 / 抖音 / 知乎】\n要求：每个平台一份改写稿，遵守该平台的标题与正文字数约束，并附发布建议。"
			},
			{
				id: "pre-publish",
				group: "publish",
				maturity: "ready",
				prompt: "请在发布前检查下面这篇内容。\n内容：【粘贴全文】\n目标平台：【平台】\n要求：从事实准确性、平台合规、标题党风险、错别字四项逐条检查，每项给出通过或修改建议。"
			},
			{
				id: "retro",
				group: "review",
				maturity: "ready",
				prompt: "请帮我做一次内容复盘。\n数据：【粘贴各篇的阅读 / 互动数据】\n要求：找出表现最好与最差的各 2 篇并归因，总结 3 条下阶段可执行的调整。"
			}
		];
		/**
		* The items of one tab, grouped in the tab's declared group order.
		* @param tab - the active intent tab.
		* @returns the tab's groups with their items; a group with no items is omitted.
		*/
		function capabilityGroups(tab) {
			const declared = STUDIO_TABS.find((candidate) => candidate.id === tab);
			if (declared === void 0) return [];
			const groups = [];
			for (const id of declared.groups) {
				const items = CAPABILITY_ITEMS.filter((item) => item.group === id);
				if (items.length > 0) groups.push({
					id,
					items
				});
			}
			return groups;
		}
		//#endregion
		//#region lib/types/client/ContentLibrary.js
		/**
		* The library view: one card per outputs project, read through the
		* `contentOutputs/list` Remote wrapped by the injected face. Loading, error,
		* and empty are first-class states; a project without valid metadata stays
		* visible with a repair hint instead of disappearing.
		*/
		/** Status → its badge modifier class. */
		const STATUS_CLASS = {
			draft: ContentStudio_module_css_default.statusDraft ?? "",
			ready: ContentStudio_module_css_default.statusReady ?? "",
			published: ContentStudio_module_css_default.statusPublished ?? ""
		};
		/**
		* Render the outputs library.
		* @param props - the Remote list wrapper and the locale seat.
		* @returns the library element tree.
		*/
		function ContentLibrary({ listOutputs, t }) {
			const [snapshot, setSnapshot] = (0, react.useState)(void 0);
			const [failed, setFailed] = (0, react.useState)(void 0);
			const load = (0, react.useCallback)(async () => {
				setFailed(void 0);
				setSnapshot(void 0);
				try {
					setSnapshot(await listOutputs());
				} catch (error) {
					console.error("[content-studio] contentOutputs/list failed:", error);
					setFailed(error instanceof Error ? error.message : String(error));
				}
			}, [listOutputs]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			if (failed) return (0, react_jsx_runtime.jsxs)("div", {
				className: ContentStudio_module_css_default.libraryState,
				children: [
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutline16, { size: 16 }),
					(0, react_jsx_runtime.jsxs)("span", { children: [
						t("library.error"),
						": ",
						failed
					] }),
					(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: ContentStudio_module_css_default.retry,
						onClick: () => {
							load();
						},
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline14, { size: 14 }), t("library.retry")]
					})
				]
			});
			if (snapshot === void 0) return (0, react_jsx_runtime.jsx)("div", {
				className: ContentStudio_module_css_default.libraryState,
				children: t("library.loading")
			});
			if (snapshot.projects.length === 0) return (0, react_jsx_runtime.jsx)("div", {
				className: ContentStudio_module_css_default.libraryState,
				children: (0, react_jsx_runtime.jsx)("span", { children: t("library.empty") })
			});
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ContentStudio_module_css_default.library,
				children: [snapshot.problems.length > 0 && (0, react_jsx_runtime.jsxs)("div", {
					className: ContentStudio_module_css_default.libraryProblems,
					role: "alert",
					children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutline16, { size: 14 }), (0, react_jsx_runtime.jsx)("span", { children: t("library.problems", { n: snapshot.problems.length }) })]
				}), (0, react_jsx_runtime.jsx)("div", {
					className: ContentStudio_module_css_default.grid,
					children: snapshot.projects.map((project) => (0, react_jsx_runtime.jsx)(ProjectCard, {
						project,
						t
					}, project.topic))
				})]
			});
		}
		/** One outputs project as a read-only card. */
		function ProjectCard({ project, t }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ContentStudio_module_css_default.libraryCard,
				children: [
					(0, react_jsx_runtime.jsxs)("span", {
						className: ContentStudio_module_css_default.cardHead,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: ContentStudio_module_css_default.cardTitle,
							children: project.title
						}), (0, react_jsx_runtime.jsx)("span", {
							className: clsx(ContentStudio_module_css_default.badge, STATUS_CLASS[project.status]),
							children: t(`status.${project.status}`)
						})]
					}),
					(0, react_jsx_runtime.jsxs)("span", {
						className: ContentStudio_module_css_default.cardDetail,
						children: [t(`kind.${project.kind}`), project.platform !== null && ` · ${project.platform}`]
					}),
					project.summary !== null && (0, react_jsx_runtime.jsx)("span", {
						className: ContentStudio_module_css_default.cardDetail,
						children: project.summary
					}),
					project.tags.length > 0 && (0, react_jsx_runtime.jsx)("span", {
						className: ContentStudio_module_css_default.libraryTags,
						children: project.tags.map((tag) => (0, react_jsx_runtime.jsx)("span", {
							className: ContentStudio_module_css_default.libraryTag,
							children: tag
						}, tag))
					}),
					(0, react_jsx_runtime.jsxs)("span", {
						className: ContentStudio_module_css_default.cardHint,
						children: [
							project.hasMetadata ? t("library.deliverables", { n: project.deliverables.length }) : t("library.noMetadata"),
							" · ",
							t("library.assets", { n: project.assetCount }),
							" · ",
							project.updatedAt.slice(0, 10)
						]
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/calendar.js
		/**
		* Pure month-grid math for the calendar view: no React, no IO — weeks start
		* Monday, and every day carries its `YYYY-MM-DD` wire date plus an
		* in-month flag so leading/trailing padding renders dimmed.
		*/
		/**
		* Local-time today as `YYYY-MM-DD`.
		* @returns today's wire date in the host time zone.
		*/
		function todayDate() {
			const now = /* @__PURE__ */ new Date();
			return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
		}
		/**
		* Compose a wire date from local year/month(1-12)/day.
		* @param year - calendar year.
		* @param month - calendar month, 1-12.
		* @param day - calendar day.
		* @returns the zero-padded `YYYY-MM-DD` date.
		*/
		function formatDate(year, month, day) {
			return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		}
		/** Days in one month (month is 1-12). */
		function daysInMonth(year, month) {
			return new Date(year, month, 0).getDate();
		}
		/**
		* Build the month grid: whole weeks, Monday first, including the leading and
		* trailing days borrowed from adjacent months.
		* @param year - calendar year.
		* @param month - calendar month, 1-12.
		* @returns rows of 7 cells covering the month.
		*/
		function monthGrid(year, month) {
			const today = todayDate();
			const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
			const total = lead + daysInMonth(year, month);
			const rows = Math.ceil(total / 7);
			const grid = [];
			for (let index = 0; index < rows * 7; index += 7) {
				const row = [];
				for (let cell = 0; cell < 7; cell++) {
					const offset = index + cell - lead + 1;
					const day = new Date(year, month - 1, offset);
					const date = formatDate(day.getFullYear(), day.getMonth() + 1, day.getDate());
					row.push({
						date,
						inMonth: day.getMonth() === month - 1,
						isToday: date === today
					});
				}
				grid.push(row);
			}
			return grid;
		}
		/**
		* Group items by their wire date for per-day chip rendering.
		* @param items - items carrying a `YYYY-MM-DD` date.
		* @returns a date-keyed map preserving each bucket's item order.
		*/
		function groupByDate(items) {
			const byDate = /* @__PURE__ */ new Map();
			for (const item of items) {
				const bucket = byDate.get(item.date);
				if (bucket === void 0) byDate.set(item.date, [item]);
				else bucket.push(item);
			}
			return byDate;
		}
		//#endregion
		//#region lib/types/client/ContentCalendar.js
		/**
		* The calendar view: one month grid over the publication calendar, read and
		* mutated through the injected `contentSchedule` wrappers. Clicking a day
		* opens an inline add form; each item chip offers mark-published and remove.
		* All state is view-local — the file on disk is the only truth.
		*/
		/** Weekday headers, Monday first; rendered through the locale seat. */
		const WEEKDAY_KEYS = [
			"weekday.mon",
			"weekday.tue",
			"weekday.wed",
			"weekday.thu",
			"weekday.fri",
			"weekday.sat",
			"weekday.sun"
		];
		/** Status → its dot modifier class. */
		const DOT_CLASS = {
			idea: ContentStudio_module_css_default.dotIdea ?? "",
			draft: ContentStudio_module_css_default.dotDraft ?? "",
			scheduled: ContentStudio_module_css_default.dotScheduled ?? "",
			published: ContentStudio_module_css_default.dotPublished ?? ""
		};
		/**
		* Render the publication calendar.
		* @param props - the Remote wrappers and the locale seat.
		* @returns the calendar element tree.
		*/
		function ContentCalendar({ listSchedule, putSchedule, removeSchedule, t }) {
			const [snapshot, setSnapshot] = (0, react.useState)(void 0);
			const [failed, setFailed] = (0, react.useState)(false);
			const [month, setMonth] = (0, react.useState)(() => {
				const now = /* @__PURE__ */ new Date();
				return {
					year: now.getFullYear(),
					month: now.getMonth() + 1
				};
			});
			const [form, setForm] = (0, react.useState)(void 0);
			const [submitting, setSubmitting] = (0, react.useState)(false);
			const load = (0, react.useCallback)(async () => {
				setFailed(false);
				try {
					setSnapshot(await listSchedule());
				} catch (error) {
					console.error("[content-studio] contentSchedule failed:", error);
					setFailed(true);
				}
			}, [listSchedule]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			const grid = (0, react.useMemo)(() => monthGrid(month.year, month.month), [month]);
			const byDate = (0, react.useMemo)(() => groupByDate(snapshot?.items ?? []), [snapshot]);
			const shiftMonth = (delta) => {
				setMonth((current) => {
					const zero = current.year * 12 + current.month - 1 + delta;
					return {
						year: Math.floor(zero / 12),
						month: (zero % 12 + 12) % 12 + 1
					};
				});
			};
			const submit = async () => {
				if (form === void 0 || form.title.trim().length === 0) return;
				setSubmitting(true);
				try {
					setSnapshot(await putSchedule({
						title: form.title,
						date: form.date,
						time: null,
						platform: form.platform.trim().length > 0 ? form.platform.trim() : null,
						status: "scheduled",
						kind: "content",
						topic: null,
						url: null
					}));
					setForm(void 0);
				} catch (error) {
					console.error("[content-studio] contentSchedule failed:", error);
					setFailed(true);
				} finally {
					setSubmitting(false);
				}
			};
			const markPublished = async (item) => {
				try {
					setSnapshot(await putSchedule({
						...item,
						status: "published",
						url: item.url
					}));
				} catch (error) {
					console.error("[content-studio] contentSchedule failed:", error);
					setFailed(true);
				}
			};
			const remove = async (id) => {
				try {
					setSnapshot(await removeSchedule(id));
				} catch (error) {
					console.error("[content-studio] contentSchedule failed:", error);
					setFailed(true);
				}
			};
			if (failed) return (0, react_jsx_runtime.jsx)("div", {
				className: ContentStudio_module_css_default.libraryState,
				children: t("library.error")
			});
			if (snapshot === void 0) return (0, react_jsx_runtime.jsx)("div", {
				className: ContentStudio_module_css_default.libraryState,
				children: t("calendar.loading")
			});
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ContentStudio_module_css_default.calendar,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: ContentStudio_module_css_default.calendarBar,
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ContentStudio_module_css_default.calendarNav,
								"aria-label": t("calendar.prev"),
								onClick: () => {
									shiftMonth(-1);
								},
								children: "‹"
							}),
							(0, react_jsx_runtime.jsxs)("span", {
								className: ContentStudio_module_css_default.calendarMonth,
								children: [
									month.year,
									" · ",
									t(`calendar.month.${month.month}`)
								]
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ContentStudio_module_css_default.calendarNav,
								"aria-label": t("calendar.next"),
								onClick: () => {
									shiftMonth(1);
								},
								children: "›"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ContentStudio_module_css_default.calendarToday,
								onClick: () => {
									const now = /* @__PURE__ */ new Date();
									setMonth({
										year: now.getFullYear(),
										month: now.getMonth() + 1
									});
								},
								children: t("calendar.today")
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: ContentStudio_module_css_default.calendarHead,
						children: WEEKDAY_KEYS.map((key) => (0, react_jsx_runtime.jsx)("span", {
							className: ContentStudio_module_css_default.calendarWeekday,
							children: t(key)
						}, key))
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: ContentStudio_module_css_default.calendarGrid,
						children: grid.flat().map((day) => {
							const items = byDate.get(day.date) ?? [];
							return (0, react_jsx_runtime.jsxs)("div", {
								className: clsx(ContentStudio_module_css_default.calendarCell, !day.inMonth && ContentStudio_module_css_default.calendarCellOutside, day.isToday && ContentStudio_module_css_default.calendarCellToday),
								role: "button",
								tabIndex: 0,
								"aria-label": day.date,
								onClick: () => {
									setForm(form?.date === day.date ? void 0 : {
										date: day.date,
										title: "",
										platform: ""
									});
								},
								onKeyDown: (event) => {
									if (event.key === "Enter") setForm(form?.date === day.date ? void 0 : {
										date: day.date,
										title: "",
										platform: ""
									});
								},
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: ContentStudio_module_css_default.calendarDayNum,
										children: Number(day.date.slice(8, 10))
									}),
									items.map((item) => (0, react_jsx_runtime.jsxs)("span", {
										className: ContentStudio_module_css_default.calendarChip,
										onClick: (event) => {
											event.stopPropagation();
										},
										children: [
											(0, react_jsx_runtime.jsx)("span", {
												className: clsx(ContentStudio_module_css_default.calendarDot, DOT_CLASS[item.status]),
												"aria-hidden": "true"
											}),
											(0, react_jsx_runtime.jsxs)("span", {
												className: ContentStudio_module_css_default.calendarChipTitle,
												children: [item.time !== null && `${item.time} `, item.title]
											}),
											item.status !== "published" && (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: ContentStudio_module_css_default.calendarChipAction,
												"aria-label": t("calendar.publish.aria"),
												title: t("calendar.publish"),
												onClick: () => {
													markPublished(item);
												},
												children: "✓"
											}),
											(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: ContentStudio_module_css_default.calendarChipAction,
												"aria-label": t("calendar.remove.aria"),
												onClick: () => {
													remove(item.id);
												},
												children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, { size: 11 })
											})
										]
									}, item.id)),
									form?.date === day.date && (0, react_jsx_runtime.jsxs)("div", {
										className: ContentStudio_module_css_default.calendarForm,
										onClick: (event) => {
											event.stopPropagation();
										},
										children: [
											(0, react_jsx_runtime.jsx)("input", {
												className: ContentStudio_module_css_default.calendarInput,
												autoFocus: true,
												placeholder: t("calendar.titlePlaceholder"),
												value: form.title,
												onChange: (event) => {
													setForm({
														...form,
														title: event.currentTarget.value
													});
												},
												onKeyDown: (event) => {
													if (event.key === "Enter") submit();
												}
											}),
											(0, react_jsx_runtime.jsx)("input", {
												className: ContentStudio_module_css_default.calendarInput,
												placeholder: t("calendar.platformPlaceholder"),
												value: form.platform,
												onChange: (event) => {
													setForm({
														...form,
														platform: event.currentTarget.value
													});
												}
											}),
											(0, react_jsx_runtime.jsxs)("div", {
												className: ContentStudio_module_css_default.calendarFormRow,
												children: [(0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: ContentStudio_module_css_default.calendarSubmit,
													disabled: submitting,
													onClick: () => {
														submit();
													},
													children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 12 }), t("calendar.add")]
												}), (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: ContentStudio_module_css_default.calendarChipAction,
													"aria-label": t("calendar.cancel"),
													onClick: () => {
														setForm(void 0);
													},
													children: t("calendar.cancel")
												})]
											})
										]
									})
								]
							}, day.date);
						})
					}),
					form === void 0 && snapshot.items.length === 0 && (0, react_jsx_runtime.jsx)("div", {
						className: ContentStudio_module_css_default.calendarHint,
						children: t("calendar.empty")
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/ContentWorkbench.js
		/**
		* The workbench home (Easel-style dashboard): greeting, icon verb chips
		* (navigate or copy a capability instruction), four stat cards with tinted
		* icon tiles, and a 3+2 panel grid — quick-create rows, recent outputs,
		* upcoming schedule, and a creation-data breakdown — each panel hopping to
		* its full view.
		*/
		/** Quick-create panel rows: these capability ids, in this order. */
		const QUICK_IDS = [
			"social-card",
			"gzh-article",
			"short-script",
			"multi-platform",
			"pre-publish"
		];
		/** How long a row shows its copied state before reverting. */
		const COPIED_FEEDBACK_MS$1 = 1600;
		/** Greeting bucket by hour of day. */
		function greetKey(hour) {
			return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
		}
		/** Find one capability by id (the catalog is static, ids are pinned by test). */
		function cap(id) {
			const found = CAPABILITY_ITEMS.find((item) => item.id === id);
			if (found === void 0) throw new Error(`unknown capability id: ${id}`);
			return found;
		}
		/**
		* Render the workbench home.
		* @param props - the Remote read wrappers, view navigation, and the locale seat.
		* @returns the dashboard element tree.
		*/
		function ContentWorkbench({ listOutputs, listSchedule, onNavigate, onChat, account, persona, t }) {
			const [outputs, setOutputs] = (0, react.useState)({ state: "loading" });
			const [schedule, setSchedule] = (0, react.useState)({ state: "loading" });
			const [copiedId, setCopiedId] = (0, react.useState)(void 0);
			const loadOutputs = (0, react.useCallback)(async () => {
				setOutputs({ state: "loading" });
				try {
					setOutputs({
						state: "ok",
						value: await listOutputs()
					});
				} catch (error) {
					console.error("[content-studio] contentOutputs/list failed:", error);
					setOutputs({
						state: "failed",
						detail: error instanceof Error ? error.message : String(error)
					});
				}
			}, [listOutputs]);
			const loadSchedule = (0, react.useCallback)(async () => {
				setSchedule({ state: "loading" });
				try {
					setSchedule({
						state: "ok",
						value: await listSchedule()
					});
				} catch (error) {
					console.error("[content-studio] contentSchedule/list failed:", error);
					setSchedule({
						state: "failed",
						detail: error instanceof Error ? error.message : String(error)
					});
				}
			}, [listSchedule]);
			(0, react.useEffect)(() => {
				loadOutputs();
			}, [loadOutputs]);
			(0, react.useEffect)(() => {
				loadSchedule();
			}, [loadSchedule]);
			(0, react.useEffect)(() => {
				if (copiedId === void 0) return;
				const timer = window.setTimeout(() => {
					setCopiedId(void 0);
				}, COPIED_FEEDBACK_MS$1);
				return () => {
					window.clearTimeout(timer);
				};
			}, [copiedId]);
			const quick = (0, react.useMemo)(() => QUICK_IDS.map((id) => cap(id)), []);
			const pick = async (item) => {
				const identity = account === "通用模式" ? persona.length > 0 ? `账号画像：${persona}` : "" : persona.length > 0 ? `我的账号/画像：${account}
账号画像：${persona}` : `我的账号/画像：${account}`;
				if (await (0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(identity.length > 0 ? `${identity}

${item.prompt}` : item.prompt)) setCopiedId(item.id);
			};
			if (outputs.state === "failed") console.warn("[content-studio] outputs panel degraded:", outputs.detail);
			if (schedule.state === "failed") console.warn("[content-studio] schedule panel degraded:", schedule.detail);
			const projects = outputs.state === "ok" ? outputs.value.projects : [];
			const ready = projects.filter((project) => project.status === "ready").length;
			const items = schedule.state === "ok" ? schedule.value.items : [];
			const pending = items.filter((item) => item.status !== "published").length;
			const published = items.filter((item) => item.status === "published").length;
			const recent = [...projects].sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1).slice(0, 5);
			const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
			const upcoming = items.filter((item) => item.status !== "published" && item.date >= today).slice(0, 5);
			const allSchedule = items;
			/** Loading / failed seat for a panel fed by one Remote. */
			const panelState = (load, retry) => {
				if (load.state === "loading") return (0, react_jsx_runtime.jsx)("p", {
					className: ContentStudio_module_css_default.panelEmpty,
					children: t("library.loading")
				});
				if (load.state === "failed") return (0, react_jsx_runtime.jsxs)("div", {
					className: ContentStudio_module_css_default.libraryState,
					children: [(0, react_jsx_runtime.jsxs)("span", { children: [
						t("library.error"),
						": ",
						load.detail
					] }), (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: ContentStudio_module_css_default.retry,
						onClick: retry,
						children: t("library.retry")
					})]
				});
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ContentStudio_module_css_default.workbench,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: ContentStudio_module_css_default.helloRow,
						children: [(0, react_jsx_runtime.jsxs)("h1", {
							className: ContentStudio_module_css_default.hello,
							children: [t(`greet.${greetKey((/* @__PURE__ */ new Date()).getHours())}`), " 👋"]
						}), (0, react_jsx_runtime.jsx)("p", {
							className: ContentStudio_module_css_default.helloSub,
							children: t("workbench.subtitle")
						})]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: ContentStudio_module_css_default.quickRow,
						children: [
							(0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: ContentStudio_module_css_default.chip,
								onClick: onChat,
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconNewChatOutline16, { size: 14 }), t("action.chat")]
							}),
							(0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: ContentStudio_module_css_default.chip,
								onClick: () => {
									onNavigate("create");
								},
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkle16, { size: 14 }), t("nav.create")]
							}),
							(0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: ContentStudio_module_css_default.chip,
								onClick: () => {
									onNavigate("calendar");
								},
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, { size: 14 }), t("action.schedule")]
							}),
							(0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: clsx(ContentStudio_module_css_default.chip, copiedId === "social-card" && ContentStudio_module_css_default.chipCopied),
								onClick: () => {
									pick(cap("social-card"));
								},
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, { size: 14 }), copiedId === "social-card" ? t("card.copied") : t("cap.social-card.title")]
							}),
							(0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: clsx(ContentStudio_module_css_default.chip, copiedId === "pre-publish" && ContentStudio_module_css_default.chipCopied),
								onClick: () => {
									pick(cap("pre-publish"));
								},
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, { size: 14 }), copiedId === "pre-publish" ? t("card.copied") : t("cap.pre-publish.title")]
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: ContentStudio_module_css_default.statRow,
						children: [
							(0, react_jsx_runtime.jsx)(StatCard, {
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutline16, { size: 16 }),
								value: outputs.state === "ok" ? projects.length : void 0,
								label: t("stat.projects")
							}),
							(0, react_jsx_runtime.jsx)(StatCard, {
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, { size: 16 }),
								value: schedule.state === "ok" ? pending : void 0,
								label: t("stat.scheduled")
							}),
							(0, react_jsx_runtime.jsx)(StatCard, {
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, { size: 16 }),
								value: outputs.state === "ok" ? ready : void 0,
								label: t("stat.ready")
							}),
							(0, react_jsx_runtime.jsx)(StatCard, {
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGoalOutline16, { size: 16 }),
								value: schedule.state === "ok" ? published : void 0,
								label: t("stat.published")
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: ContentStudio_module_css_default.panelRowThree,
						children: [
							(0, react_jsx_runtime.jsxs)("section", {
								className: ContentStudio_module_css_default.panel,
								children: [(0, react_jsx_runtime.jsxs)("header", {
									className: ContentStudio_module_css_default.panelHead,
									children: [(0, react_jsx_runtime.jsxs)("h2", {
										className: ContentStudio_module_css_default.panelTitle,
										children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkle16, { size: 13 }), t("panel.quickCreate")]
									}), (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: ContentStudio_module_css_default.panelMore,
										onClick: () => {
											onNavigate("create");
										},
										children: [t("nav.create"), " →"]
									})]
								}), quick.map((item) => (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: clsx(ContentStudio_module_css_default.listRowButton, copiedId === item.id && ContentStudio_module_css_default.listRowCopied),
									onClick: () => {
										pick(item);
									},
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: ContentStudio_module_css_default.listTitle,
										children: copiedId === item.id ? t("card.copied") : t(`cap.${item.id}.title`)
									}), (0, react_jsx_runtime.jsx)("span", {
										className: ContentStudio_module_css_default.listMeta,
										children: copiedId === item.id ? "" : t("card.copyHint")
									})]
								}, item.id))]
							}),
							(0, react_jsx_runtime.jsxs)("section", {
								className: ContentStudio_module_css_default.panel,
								children: [(0, react_jsx_runtime.jsxs)("header", {
									className: ContentStudio_module_css_default.panelHead,
									children: [(0, react_jsx_runtime.jsxs)("h2", {
										className: ContentStudio_module_css_default.panelTitle,
										children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutline16, { size: 13 }), t("panel.recent")]
									}), (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: ContentStudio_module_css_default.panelMore,
										onClick: () => {
											onNavigate("library");
										},
										children: [t("nav.library"), " →"]
									})]
								}), panelState(outputs, () => {
									loadOutputs();
								}) ?? (recent.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
									className: ContentStudio_module_css_default.panelEmpty,
									children: t("panel.emptyRecent")
								}) : recent.map((project) => (0, react_jsx_runtime.jsxs)("div", {
									className: ContentStudio_module_css_default.listRow,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: ContentStudio_module_css_default.listTitle,
										children: project.title
									}), (0, react_jsx_runtime.jsx)("span", {
										className: ContentStudio_module_css_default.listMeta,
										children: t(`status.${project.status}`)
									})]
								}, project.topic)))]
							}),
							(0, react_jsx_runtime.jsxs)("section", {
								className: ContentStudio_module_css_default.panel,
								children: [(0, react_jsx_runtime.jsxs)("header", {
									className: ContentStudio_module_css_default.panelHead,
									children: [(0, react_jsx_runtime.jsxs)("h2", {
										className: ContentStudio_module_css_default.panelTitle,
										children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, { size: 13 }), t("panel.upcoming")]
									}), (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: ContentStudio_module_css_default.panelMore,
										onClick: () => {
											onNavigate("calendar");
										},
										children: [t("nav.calendar"), " →"]
									})]
								}), panelState(schedule, () => {
									loadSchedule();
								}) ?? (upcoming.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
									className: ContentStudio_module_css_default.panelEmpty,
									children: t("panel.emptyUpcoming")
								}) : upcoming.map((item) => (0, react_jsx_runtime.jsxs)("div", {
									className: ContentStudio_module_css_default.listRow,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: ContentStudio_module_css_default.listTitle,
										children: item.title
									}), (0, react_jsx_runtime.jsx)("span", {
										className: ContentStudio_module_css_default.listMeta,
										children: item.date
									})]
								}, item.id)))]
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: ContentStudio_module_css_default.panelRowTwo,
						children: [(0, react_jsx_runtime.jsxs)("section", {
							className: ContentStudio_module_css_default.panel,
							children: [(0, react_jsx_runtime.jsxs)("header", {
								className: ContentStudio_module_css_default.panelHead,
								children: [(0, react_jsx_runtime.jsxs)("h2", {
									className: ContentStudio_module_css_default.panelTitle,
									children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGoalOutline16, { size: 13 }), t("panel.data")]
								}), (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: ContentStudio_module_css_default.panelMore,
									onClick: () => {
										onNavigate("library");
									},
									children: [t("nav.library"), " →"]
								})]
							}), outputs.state === "ok" ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("div", {
								className: ContentStudio_module_css_default.dataPills,
								children: [
									(0, react_jsx_runtime.jsxs)("span", {
										className: ContentStudio_module_css_default.dataPill,
										children: [
											t("stat.projects"),
											" · ",
											projects.length
										]
									}),
									(0, react_jsx_runtime.jsxs)("span", {
										className: ContentStudio_module_css_default.dataPill,
										children: [
											t("status.draft"),
											" · ",
											projects.filter((project) => project.status === "draft").length
										]
									}),
									(0, react_jsx_runtime.jsxs)("span", {
										className: ContentStudio_module_css_default.dataPill,
										children: [
											t("stat.ready"),
											" · ",
											ready
										]
									}),
									(0, react_jsx_runtime.jsxs)("span", {
										className: ContentStudio_module_css_default.dataPill,
										children: [
											t("stat.published"),
											" · ",
											published
										]
									})
								]
							}), (0, react_jsx_runtime.jsx)("p", {
								className: ContentStudio_module_css_default.panelEmpty,
								children: t("panel.dataHint")
							})] }) : panelState(outputs, () => {
								loadOutputs();
							})]
						}), (0, react_jsx_runtime.jsxs)("section", {
							className: ContentStudio_module_css_default.panel,
							children: [(0, react_jsx_runtime.jsxs)("header", {
								className: ContentStudio_module_css_default.panelHead,
								children: [(0, react_jsx_runtime.jsxs)("h2", {
									className: ContentStudio_module_css_default.panelTitle,
									children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, { size: 13 }), t("panel.recentSchedule")]
								}), (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: ContentStudio_module_css_default.panelMore,
									onClick: () => {
										onNavigate("calendar");
									},
									children: [t("nav.calendar"), " →"]
								})]
							}), schedule.state === "ok" ? allSchedule.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
								className: ContentStudio_module_css_default.panelEmpty,
								children: t("panel.emptyUpcoming")
							}) : allSchedule.slice(-5).reverse().map((item) => (0, react_jsx_runtime.jsxs)("div", {
								className: ContentStudio_module_css_default.listRow,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: ContentStudio_module_css_default.listTitle,
									children: item.title
								}), (0, react_jsx_runtime.jsxs)("span", {
									className: ContentStudio_module_css_default.listMeta,
									children: [
										item.date,
										" · ",
										t(`status.${item.status}`)
									]
								})]
							}, item.id)) : panelState(schedule, () => {
								loadSchedule();
							})]
						})]
					})
				]
			});
		}
		/** One stat card with a tinted icon tile over the value and label. */
		function StatCard({ icon, value, label }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ContentStudio_module_css_default.statCard,
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: ContentStudio_module_css_default.statIcon,
						children: icon
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: ContentStudio_module_css_default.statValue,
						children: value === void 0 ? "—" : String(value)
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: ContentStudio_module_css_default.statLabel,
						children: label
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/AccountSelect.js
		/**
		* The account selector under the workbench brand row (Easel's persona
		* dropdown): a bordered select showing the active creation account, a
		* dropdown with all accounts plus "+ 新建账号...", and an inline create row.
		* State is browser-local (localStorage) — the selection is injected into
		* copied capability instructions by the callers.
		*/
		/**
		* Render the account dropdown.
		* @param props - controlled state and the locale seat.
		* @returns the selector element tree.
		*/
		function AccountSelect({ account, accounts, onSelect, onAdd, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [creating, setCreating] = (0, react.useState)(false);
			const [draft, setDraft] = (0, react.useState)("");
			const boxRef = (0, react.useRef)(null);
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(boxRef, open, setOpen);
			const inputRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (creating) inputRef.current?.focus();
			}, [creating]);
			const commitDraft = () => {
				const name = draft.trim();
				if (name.length === 0) return;
				onAdd(name);
				setDraft("");
				setCreating(false);
				setOpen(false);
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ContentStudio_module_css_default.accountBox,
				ref: boxRef,
				children: [(0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: ContentStudio_module_css_default.accountButton,
					"aria-haspopup": "listbox",
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: ContentStudio_module_css_default.accountName,
						children: account
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { size: 14 })]
				}), open && (0, react_jsx_runtime.jsxs)("div", {
					className: ContentStudio_module_css_default.accountList,
					role: "listbox",
					"aria-label": t("account.label"),
					children: [accounts.map((name) => (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						role: "option",
						"aria-selected": name === account,
						className: clsx(ContentStudio_module_css_default.accountOption, name === account && ContentStudio_module_css_default.accountOptionActive),
						onClick: () => {
							onSelect(name);
							setOpen(false);
						},
						children: name
					}, name)), creating ? (0, react_jsx_runtime.jsxs)("div", {
						className: ContentStudio_module_css_default.accountCreateRow,
						children: [(0, react_jsx_runtime.jsx)("input", {
							ref: inputRef,
							className: ContentStudio_module_css_default.accountInput,
							placeholder: t("account.placeholder"),
							value: draft,
							onChange: (event) => {
								setDraft(event.currentTarget.value);
							},
							onKeyDown: (event) => {
								if (event.key === "Enter") commitDraft();
								if (event.key === "Escape") {
									setCreating(false);
									setDraft("");
								}
							}
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: ContentStudio_module_css_default.accountCreateAdd,
							onClick: commitDraft,
							children: t("account.add")
						})]
					}) : (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: ContentStudio_module_css_default.accountOption,
						onClick: () => {
							setCreating(true);
						},
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 12 }), t("account.new")]
					})]
				})]
			});
		}
		//#endregion
		//#region lib/types/client/CapabilityPage.js
		/**
		* A capability page: one titled grid of capability cards for a nav view that
		* fronts a slice of the catalog (对标 / 选题). Pick = copy the instruction.
		*/
		/**
		* Render one capability page.
		* @param props - ids, title, copy state, and the locale seat.
		* @returns the page element tree.
		*/
		function CapabilityPage({ title, ids, copiedId, pick, t }) {
			const items = ids.map((id) => CAPABILITY_ITEMS.find((item) => item.id === id)).filter((item) => item !== void 0);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ContentStudio_module_css_default.workbench,
				children: [(0, react_jsx_runtime.jsx)("h2", {
					className: ContentStudio_module_css_default.pageTitle,
					children: title
				}), (0, react_jsx_runtime.jsx)("div", {
					className: ContentStudio_module_css_default.grid,
					children: items.map((item) => {
						const copied = copiedId === item.id;
						return (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: clsx(ContentStudio_module_css_default.card, copied && ContentStudio_module_css_default.cardCopied),
							onClick: () => {
								pick(item);
							},
							children: [
								(0, react_jsx_runtime.jsxs)("span", {
									className: ContentStudio_module_css_default.cardHead,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: ContentStudio_module_css_default.cardTitle,
										children: t(`cap.${item.id}.title`)
									}), (0, react_jsx_runtime.jsx)("span", {
										className: clsx(ContentStudio_module_css_default.badge, ContentStudio_module_css_default.badgeReady),
										children: t("badge.ready")
									})]
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: ContentStudio_module_css_default.cardDetail,
									children: t(`cap.${item.id}.detail`)
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: clsx(ContentStudio_module_css_default.cardHint, copied && ContentStudio_module_css_default.cardHintCopied),
									children: copied ? t("card.copied") : t("card.copyHint")
								})
							]
						}, item.id);
					})
				})]
			});
		}
		//#endregion
		//#region lib/types/client/AccountsView.js
		/**
		* The accounts view: select the active creation account, add new ones, and
		* delete non-default ones. State is browser-local and owned by the workbench
		* surface; 通用模式 can never be deleted.
		*/
		/**
		* Render the accounts management page.
		* @param props - controlled state, mutators, and the locale seat.
		* @returns the page element tree.
		*/
		function AccountsView({ account, accounts, onSelect, onAdd, onRemove, t }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ContentStudio_module_css_default.workbench,
				children: [
					(0, react_jsx_runtime.jsx)("h2", {
						className: ContentStudio_module_css_default.pageTitle,
						children: t("accounts.title")
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: ContentStudio_module_css_default.helloSub,
						children: t("accounts.hint")
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: ContentStudio_module_css_default.accountsPane,
						children: [(0, react_jsx_runtime.jsx)(AccountSelect, {
							account,
							accounts,
							onSelect,
							onAdd,
							t
						}), (0, react_jsx_runtime.jsx)("div", {
							className: ContentStudio_module_css_default.accountsList,
							children: accounts.map((name) => (0, react_jsx_runtime.jsxs)("div", {
								className: ContentStudio_module_css_default.listRow,
								children: [(0, react_jsx_runtime.jsxs)("span", {
									className: ContentStudio_module_css_default.listTitle,
									children: [name, name === account && (0, react_jsx_runtime.jsx)("span", {
										className: ContentStudio_module_css_default.accountActiveTag,
										children: t("account.active")
									})]
								}), name !== "通用模式" && (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: ContentStudio_module_css_default.calendarChipAction,
									"aria-label": t("accounts.delete"),
									onClick: () => {
										onRemove(name);
									},
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, { size: 12 })
								})]
							}, name))
						})]
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/PersonaView.js
		/**
		* The persona view: a browser-local persona description for the active
		* account, injected into copied capability instructions alongside the
		* account name.
		*/
		/** How long the saved flash shows. */
		const SAVED_FEEDBACK_MS = 1600;
		/**
		* Render the persona editor.
		* @param props - the controlled persona text, saver, and the locale seat.
		* @returns the page element tree.
		*/
		function PersonaView({ persona, onSave, t }) {
			const [draft, setDraft] = (0, react.useState)(persona);
			const [saved, setSaved] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				setDraft(persona);
			}, [persona]);
			(0, react.useEffect)(() => {
				if (!saved) return;
				const timer = window.setTimeout(() => {
					setSaved(false);
				}, SAVED_FEEDBACK_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [saved]);
			const save = () => {
				onSave(draft.trim());
				setSaved(true);
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ContentStudio_module_css_default.workbench,
				children: [
					(0, react_jsx_runtime.jsx)("h2", {
						className: ContentStudio_module_css_default.pageTitle,
						children: t("persona.title")
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: ContentStudio_module_css_default.helloSub,
						children: t("persona.hint")
					}),
					(0, react_jsx_runtime.jsx)("textarea", {
						className: ContentStudio_module_css_default.personaInput,
						rows: 10,
						placeholder: t("persona.placeholder"),
						value: draft,
						onChange: (event) => {
							setDraft(event.currentTarget.value);
						}
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: ContentStudio_module_css_default.personaRow,
						children: [(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: ContentStudio_module_css_default.back,
							onClick: save,
							children: t("persona.save")
						}), saved && (0, react_jsx_runtime.jsx)("span", {
							className: ContentStudio_module_css_default.personaSaved,
							children: t("persona.saved")
						})]
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/ContentStudio.js
		/**
		* The frame-wide workbench surface occupying the `shell.overlay` hole.
		* Easel-style two-column shell: a left inner nav — 工作台 / 对话 / 对标 /
		* 选题 / 内容 / 创作 / 账号 / 画像, with the back-to-chat verb and the
		* feedback link at the foot — and a main column rendering the active view,
		* defaulting to the workbench home dashboard. 对话 closes back to the chat;
		* 对标 and 选题 are capability slices of the catalog; 账号 and 画像 manage the
		* browser-local creation identity that is injected into every copied
		* capability instruction. Escape dismisses the surface; closed state renders
		* null while the slot entry stays mounted.
		*/
		/** How long a card shows its copied state before reverting. */
		const COPIED_FEEDBACK_MS = 1600;
		/** The nav order exactly as specified: 对话 rides between 工作台 and 对标 as a verb. */
		const NAV_ITEMS = [
			{
				view: "workbench",
				key: "nav.workbench"
			},
			{
				view: "chat",
				key: "nav.chat"
			},
			{
				view: "benchmark",
				key: "nav.benchmark"
			},
			{
				view: "topics",
				key: "nav.topics"
			},
			{
				view: "library",
				key: "nav.content"
			},
			{
				view: "create",
				key: "nav.create"
			},
			{
				view: "accounts",
				key: "nav.accounts"
			},
			{
				view: "persona",
				key: "nav.persona"
			}
		];
		/** Capability slices behind the 对标 / 选题 nav views. */
		const BENCHMARK_IDS = ["breakdown"];
		const TOPICS_IDS = ["hotspot", "calendar-plan"];
		/** Maturity → its badge modifier class. */
		const BADGE_CLASS = {
			done: ContentStudio_module_css_default.badgeDone ?? "",
			ready: ContentStudio_module_css_default.badgeReady ?? "",
			need: ContentStudio_module_css_default.badgeNeed ?? "",
			incoming: ContentStudio_module_css_default.badgeIncoming ?? ""
		};
		/**
		* Render the Content Studio workbench surface.
		* @param props - the injected face and the locale seat.
		* @returns the surface element tree while open; null while closed.
		*/
		function ContentStudio({ studio, listOutputs, schedule, t }) {
			const open = (0, react.useSyncExternalStore)((fn) => studio.subscribe(fn), () => studio.isOpen());
			const [view, setView] = (0, react.useState)("workbench");
			const [accounts, setAccounts] = (0, react.useState)(() => {
				try {
					return JSON.parse(localStorage.getItem("dsh-content-studio.accounts") ?? "");
				} catch {
					return ["通用模式"];
				}
			});
			const [account, setAccount] = (0, react.useState)(() => localStorage.getItem("dsh-content-studio.account") ?? "通用模式");
			const [persona, setPersona] = (0, react.useState)(() => localStorage.getItem("dsh-content-studio.persona") ?? "");
			const selectAccount = (name) => {
				setAccount(name);
				localStorage.setItem("dsh-content-studio.account", name);
			};
			const addAccount = (name) => {
				const next = accounts.includes(name) ? accounts : [...accounts, name];
				setAccounts(next);
				localStorage.setItem("dsh-content-studio.accounts", JSON.stringify(next));
				selectAccount(name);
			};
			const removeAccount = (name) => {
				const next = accounts.filter((candidate) => candidate !== name);
				setAccounts(next);
				localStorage.setItem("dsh-content-studio.accounts", JSON.stringify(next));
				if (account === name) selectAccount("通用模式");
			};
			const savePersona = (text) => {
				setPersona(text);
				localStorage.setItem("dsh-content-studio.persona", text);
			};
			const withIdentity = (prompt) => {
				const identity = account === "通用模式" ? persona.length > 0 ? `账号画像：${persona}` : "" : persona.length > 0 ? `我的账号/画像：${account}\n账号画像：${persona}` : `我的账号/画像：${account}`;
				return identity.length > 0 ? `${identity}\n\n${prompt}` : prompt;
			};
			const [tab, setTab] = (0, react.useState)("create");
			const [copiedId, setCopiedId] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onKeyDown = (event) => {
					if (event.key === "Escape") studio.close();
				};
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open, studio]);
			(0, react.useEffect)(() => {
				if (copiedId === void 0) return;
				const timer = window.setTimeout(() => {
					setCopiedId(void 0);
				}, COPIED_FEEDBACK_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [copiedId]);
			if (!open) return null;
			const groups = capabilityGroups(tab);
			const pickItem = (item) => {
				(async () => {
					if (await (0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(withIdentity(item.prompt))) setCopiedId(item.id);
				})();
			};
			const pick = async (id, prompt) => {
				if (await (0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(withIdentity(prompt))) setCopiedId(id);
			};
			return (0, react_jsx_runtime.jsx)("div", {
				className: ContentStudio_module_css_default.surface,
				role: "dialog",
				"aria-modal": "true",
				"aria-label": t("studio.title"),
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: ContentStudio_module_css_default.shell,
					children: [(0, react_jsx_runtime.jsxs)("aside", {
						className: ContentStudio_module_css_default.side,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: ContentStudio_module_css_default.sideBrand,
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkle16, { size: 16 }), (0, react_jsx_runtime.jsx)("span", { children: t("studio.title") })]
							}),
							(0, react_jsx_runtime.jsx)(AccountSelect, {
								account,
								accounts,
								onSelect: selectAccount,
								onAdd: addAccount,
								t
							}),
							(0, react_jsx_runtime.jsx)("nav", {
								className: ContentStudio_module_css_default.sideNav,
								"aria-label": t("studio.title"),
								children: NAV_ITEMS.map(({ view: candidate, key }) => (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: clsx(ContentStudio_module_css_default.navItem, view === candidate && ContentStudio_module_css_default.navItemActive),
									"aria-current": view === candidate || void 0,
									onClick: () => {
										if (candidate === "chat") studio.close();
										else setView(candidate);
									},
									children: t(key)
								}, candidate))
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: ContentStudio_module_css_default.sideFoot,
								children: [(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: ContentStudio_module_css_default.back,
									onClick: () => {
										studio.close();
									},
									children: t("studio.back")
								}), (0, react_jsx_runtime.jsx)("a", {
									className: ContentStudio_module_css_default.aboutLink,
									href: "https://github.com/guilinleolee/dsh-content-studio/issues",
									target: "_blank",
									rel: "noreferrer",
									children: t("studio.feedback")
								})]
							})
						]
					}), (0, react_jsx_runtime.jsxs)("div", {
						className: ContentStudio_module_css_default.main,
						children: [(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: ContentStudio_module_css_default.close,
							"aria-label": t("studio.close"),
							onClick: () => {
								studio.close();
							},
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 16 })
						}), (0, react_jsx_runtime.jsxs)("div", {
							className: ContentStudio_module_css_default.frame,
							children: [
								view === "workbench" && (0, react_jsx_runtime.jsx)(ContentWorkbench, {
									listOutputs,
									listSchedule: schedule.list,
									onNavigate: setView,
									onChat: () => {
										studio.close();
									},
									account,
									persona,
									t
								}),
								view === "benchmark" && (0, react_jsx_runtime.jsx)(CapabilityPage, {
									title: t("benchmark.title"),
									ids: BENCHMARK_IDS,
									copiedId,
									pick: pickItem,
									t
								}),
								view === "topics" && (0, react_jsx_runtime.jsx)(CapabilityPage, {
									title: t("topics.title"),
									ids: TOPICS_IDS,
									copiedId,
									pick: pickItem,
									t
								}),
								view === "accounts" && (0, react_jsx_runtime.jsx)(AccountsView, {
									account,
									accounts,
									onSelect: selectAccount,
									onAdd: addAccount,
									onRemove: removeAccount,
									t
								}),
								view === "persona" && (0, react_jsx_runtime.jsx)(PersonaView, {
									persona,
									onSave: savePersona,
									t
								}),
								view === "library" && (0, react_jsx_runtime.jsx)(ContentLibrary, {
									listOutputs,
									t
								}),
								view === "calendar" && (0, react_jsx_runtime.jsx)(ContentCalendar, {
									listSchedule: schedule.list,
									putSchedule: schedule.put,
									removeSchedule: schedule.remove,
									t
								}),
								view === "create" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("div", {
									className: ContentStudio_module_css_default.tabs,
									role: "tablist",
									children: STUDIO_TABS.map((candidate) => (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										role: "tab",
										"aria-selected": tab === candidate.id,
										"aria-label": t(candidate.id === "create" ? "tab.create.aria" : "tab.operate.aria"),
										className: clsx(ContentStudio_module_css_default.tab, tab === candidate.id && ContentStudio_module_css_default.tabActive),
										onClick: () => {
											setTab(candidate.id);
										},
										children: t(candidate.id === "create" ? "tab.create" : "tab.operate")
									}, candidate.id))
								}), (0, react_jsx_runtime.jsx)("div", {
									className: ContentStudio_module_css_default.body,
									children: groups.map((group) => (0, react_jsx_runtime.jsxs)("section", {
										className: ContentStudio_module_css_default.group,
										children: [(0, react_jsx_runtime.jsx)("h2", {
											className: ContentStudio_module_css_default.groupTitle,
											children: t(`group.${group.id}`)
										}), (0, react_jsx_runtime.jsx)("div", {
											className: ContentStudio_module_css_default.grid,
											children: group.items.map((item) => {
												const copied = copiedId === item.id;
												return (0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: clsx(ContentStudio_module_css_default.card, copied && ContentStudio_module_css_default.cardCopied),
													onClick: () => {
														pick(item.id, item.prompt);
													},
													children: [
														(0, react_jsx_runtime.jsxs)("span", {
															className: ContentStudio_module_css_default.cardHead,
															children: [(0, react_jsx_runtime.jsx)("span", {
																className: ContentStudio_module_css_default.cardTitle,
																children: t(`cap.${item.id}.title`)
															}), (0, react_jsx_runtime.jsx)("span", {
																className: clsx(ContentStudio_module_css_default.badge, BADGE_CLASS[item.maturity]),
																children: t(`badge.${item.maturity}`)
															})]
														}),
														(0, react_jsx_runtime.jsx)("span", {
															className: ContentStudio_module_css_default.cardDetail,
															children: t(`cap.${item.id}.detail`)
														}),
														(0, react_jsx_runtime.jsx)("span", {
															className: clsx(ContentStudio_module_css_default.cardHint, copied && ContentStudio_module_css_default.cardHintCopied),
															children: copied ? t("card.copied") : t("card.copyHint")
														})
													]
												}, item.id);
											})
										})]
									}, group.id))
								})] })
							]
						})]
					})]
				})
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/**
		* `content-studio` namespace dictionaries: the sidebar entry, the workbench
		* surface chrome, tab/group labels, maturity badges, and every capability
		* item's title and detail (`cap.<id>.title` / `cap.<id>.detail`). The
		* clipboard payload is the capability's `prompt` data, not locale copy.
		*/
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"entry.label": "内容创作",
			"entry.aria": "打开内容创作工作台",
			"studio.title": "内容创作",
			"studio.subtitle": "从一个想法开始：选题、创作、发布、复盘",
			"studio.close": "关闭工作台",
			"studio.back": "← 返回主界面",
			"studio.brand": "内容创作工作台",
			"studio.feedback": "问题与反馈",
			"view.create": "开始创作",
			"view.library": "内容库",
			"view.calendar": "内容日历",
			"nav.workbench": "工作台",
			"nav.create": "创作",
			"nav.chat": "对话",
			"nav.benchmark": "对标",
			"nav.topics": "选题",
			"nav.content": "内容",
			"nav.accounts": "账号",
			"nav.persona": "画像",
			"nav.library": "内容库",
			"nav.calendar": "内容日历",
			"benchmark.title": "对标拆解",
			"topics.title": "选题规划",
			"accounts.title": "账号管理",
			"accounts.hint": "选择当前创作账号；账号会注入到每条复制的创作指令中。",
			"accounts.delete": "删除账号",
			"account.active": "当前",
			"persona.title": "画像设定",
			"persona.hint": "描述该账号的定位、人设、语气与目标受众；保存后随创作指令一起注入。",
			"persona.placeholder": "例：专注 AI 工具测评的科技博主，语气专业但亲切，受众为 25-40 岁职场人群……",
			"persona.save": "保存画像",
			"persona.saved": "已保存",
			"greet.morning": "上午好",
			"greet.afternoon": "下午好",
			"greet.evening": "晚上好",
			"workbench.subtitle": "从一个想法到发布，今天从这里开始。",
			"stat.projects": "内容项目",
			"stat.ready": "已就绪",
			"stat.scheduled": "待发排期",
			"stat.published": "已发布",
			"panel.recent": "最近产物",
			"panel.upcoming": "近期排期",
			"panel.viewAll": "全部",
			"panel.emptyRecent": "还没有作品，去「开始创作」生成第一个吧",
			"panel.emptyUpcoming": "暂无排期，去「内容日历」安排一条吧",
			"action.chat": "开始对话",
			"account.label": "账号",
			"account.new": "新建账号...",
			"account.placeholder": "输入账号名称",
			"account.add": "添加",
			"account.default": "通用模式",
			"action.schedule": "记排期",
			"panel.quickCreate": "快捷创作",
			"panel.data": "创作数据",
			"panel.dataHint": "以上为本地产物库与日历的实时统计",
			"panel.recentSchedule": "排期记录",
			"calendar.loading": "正在读取日历…",
			"calendar.prev": "上个月",
			"calendar.next": "下个月",
			"calendar.today": "今天",
			"calendar.empty": "还没有排期。点击某一天，把要发布的内容放上去。",
			"calendar.titlePlaceholder": "要发布什么？",
			"calendar.platformPlaceholder": "平台（可选）",
			"calendar.add": "添加",
			"calendar.cancel": "取消",
			"calendar.publish": "标记为已发布",
			"calendar.publish.aria": "标记为已发布",
			"calendar.remove.aria": "删除这条排期",
			"weekday.mon": "一",
			"weekday.tue": "二",
			"weekday.wed": "三",
			"weekday.thu": "四",
			"weekday.fri": "五",
			"weekday.sat": "六",
			"weekday.sun": "日",
			"calendar.month.1": "1 月",
			"calendar.month.2": "2 月",
			"calendar.month.3": "3 月",
			"calendar.month.4": "4 月",
			"calendar.month.5": "5 月",
			"calendar.month.6": "6 月",
			"calendar.month.7": "7 月",
			"calendar.month.8": "8 月",
			"calendar.month.9": "9 月",
			"calendar.month.10": "10 月",
			"calendar.month.11": "11 月",
			"calendar.month.12": "12 月",
			"library.loading": "正在读取内容库…",
			"library.error": "内容库读取失败",
			"library.retry": "重试",
			"library.empty": "还没有作品。回到会话里完成一次创作，成品会出现在这里。",
			"library.noMetadata": "缺少 .dsh-output.json 元数据",
			"library.deliverables": "{n} 个成品",
			"library.assets": "{n} 个素材",
			"library.problems": "{n} 个项目目录无法读取",
			"status.idea": "想法",
			"status.scheduled": "已排期",
			"status.draft": "草稿",
			"status.ready": "就绪",
			"status.published": "已发布",
			"kind.article": "文章",
			"kind.xhs-note": "小红书笔记",
			"kind.video": "视频",
			"kind.cards": "图文卡片",
			"kind.poster": "海报",
			"kind.audio": "音频",
			"kind.other": "其他",
			"tab.create": "做内容 · 要成品",
			"tab.operate": "做运营 · 要动作",
			"tab.create.aria": "做内容，要成品",
			"tab.operate.aria": "做运营，要动作",
			"card.copyHint": "点击复制创作指令",
			"card.copied": "已复制，到会话输入框粘贴即可开始",
			"badge.done": "已验证",
			"badge.ready": "可用",
			"badge.need": "需配置",
			"badge.incoming": "接入中",
			"group.visual": "图文与视觉",
			"group.article": "文章写作",
			"group.video": "视频",
			"group.audio": "音频",
			"group.discover": "发现与选题",
			"group.plan": "策划与定位",
			"group.publish": "发布与质检",
			"group.review": "数据与复盘",
			"cap.social-card.title": "社媒图文卡片",
			"cap.social-card.detail": "多卡片图文：首图钩子 + 逐张要点 + 行动引导",
			"cap.cover-poster.title": "封面海报方案",
			"cap.cover-poster.detail": "标题排版、视觉主体与配色的完整设计描述",
			"cap.infographic.title": "信息图方案",
			"cap.infographic.detail": "把原始数据整理成分区结构与图表建议",
			"cap.gzh-article.title": "公众号文章",
			"cap.gzh-article.detail": "备选标题 + 钩子开头 + 分节正文 + 互动引导",
			"cap.long-form.title": "深度长文",
			"cap.long-form.detail": "先大纲后成文，立场明确，引用带来源",
			"cap.polish.title": "改写润色",
			"cap.polish.detail": "指出问题 → 给出改写 → 逐条说明理由",
			"cap.short-script.title": "短视频脚本",
			"cap.short-script.detail": "3 秒钩子 + 分镜口播 + 画面提示",
			"cap.storyboard.title": "分镜表",
			"cap.storyboard.detail": "脚本扩写为景别 / 运镜 / 时长的分镜表",
			"cap.podcast-outline.title": "播客大纲",
			"cap.podcast-outline.detail": "章节话题 + 提问清单 + 时间分配",
			"cap.hotspot.title": "热点选题",
			"cap.hotspot.detail": "按账号方向给出可切入热点与角度",
			"cap.breakdown.title": "爆款拆解",
			"cap.breakdown.detail": "五维归因，输出可复用模板",
			"cap.positioning.title": "账号定位",
			"cap.positioning.detail": "3 个方向：人设、内容支柱、变现路径",
			"cap.calendar-plan.title": "内容日历",
			"cap.calendar-plan.detail": "按周排布选题，预留机动热点位",
			"cap.multi-platform.title": "多平台适配",
			"cap.multi-platform.detail": "一份母版改写成各平台约束内的版本",
			"cap.pre-publish.title": "发布前检查",
			"cap.pre-publish.detail": "事实、合规、标题党、错别字四项门禁",
			"cap.retro.title": "复盘报告",
			"cap.retro.detail": "好坏表现归因，输出可执行调整"
		};
		/** English dictionary; every zh key must be present. */
		const en = {
			"entry.label": "Content Studio",
			"entry.aria": "Open the Content Studio workbench",
			"studio.title": "Content Studio",
			"studio.subtitle": "From one idea: discover, create, publish, review",
			"studio.close": "Close the workbench",
			"studio.back": "← Back to chat",
			"studio.brand": "Content Studio",
			"studio.feedback": "Feedback",
			"view.create": "Create",
			"view.library": "Library",
			"view.calendar": "Calendar",
			"nav.workbench": "Workbench",
			"nav.create": "Create",
			"nav.chat": "Chat",
			"nav.benchmark": "Benchmark",
			"nav.topics": "Topics",
			"nav.content": "Content",
			"nav.accounts": "Accounts",
			"nav.persona": "Persona",
			"benchmark.title": "Benchmark teardown",
			"topics.title": "Topic planning",
			"accounts.title": "Accounts",
			"accounts.hint": "Pick the active creation account; it is injected into every copied instruction.",
			"accounts.delete": "Delete account",
			"account.active": "active",
			"persona.title": "Persona",
			"persona.hint": "Describe the account positioning, voice, and audience; saved text is injected with every instruction.",
			"persona.placeholder": "e.g. a tech reviewer focused on AI tools; professional but friendly; audience 25-40…",
			"persona.save": "Save persona",
			"persona.saved": "Saved",
			"nav.library": "Library",
			"nav.calendar": "Calendar",
			"greet.morning": "Good morning",
			"greet.afternoon": "Good afternoon",
			"greet.evening": "Good evening",
			"workbench.subtitle": "From one idea to published — start here.",
			"stat.projects": "Projects",
			"stat.ready": "Ready",
			"stat.scheduled": "Scheduled",
			"stat.published": "Published",
			"panel.recent": "Recent outputs",
			"panel.upcoming": "Upcoming schedule",
			"panel.viewAll": "All",
			"panel.emptyRecent": "Nothing yet — create your first piece in Create.",
			"panel.emptyUpcoming": "Nothing scheduled — plan one in Calendar.",
			"action.chat": "New chat",
			"account.label": "Account",
			"account.new": "New account...",
			"account.placeholder": "Account name",
			"account.add": "Add",
			"account.default": "Generic",
			"action.schedule": "Plan",
			"panel.quickCreate": "Quick create",
			"panel.data": "Creation data",
			"panel.dataHint": "Live counts from the local outputs library and calendar",
			"panel.recentSchedule": "Schedule log",
			"calendar.loading": "Reading the calendar…",
			"calendar.prev": "Previous month",
			"calendar.next": "Next month",
			"calendar.today": "Today",
			"calendar.empty": "Nothing scheduled yet. Click a day to plan a publication.",
			"calendar.titlePlaceholder": "What is being published?",
			"calendar.platformPlaceholder": "Platform (optional)",
			"calendar.add": "Add",
			"calendar.cancel": "Cancel",
			"calendar.publish": "Mark as published",
			"calendar.publish.aria": "Mark as published",
			"calendar.remove.aria": "Remove this item",
			"weekday.mon": "Mo",
			"weekday.tue": "Tu",
			"weekday.wed": "We",
			"weekday.thu": "Th",
			"weekday.fri": "Fr",
			"weekday.sat": "Sa",
			"weekday.sun": "Su",
			"calendar.month.1": "Jan",
			"calendar.month.2": "Feb",
			"calendar.month.3": "Mar",
			"calendar.month.4": "Apr",
			"calendar.month.5": "May",
			"calendar.month.6": "Jun",
			"calendar.month.7": "Jul",
			"calendar.month.8": "Aug",
			"calendar.month.9": "Sep",
			"calendar.month.10": "Oct",
			"calendar.month.11": "Nov",
			"calendar.month.12": "Dec",
			"library.loading": "Reading the library…",
			"library.error": "Failed to read the library",
			"library.retry": "Retry",
			"library.empty": "No works yet. Finish a creation in a session and it will appear here.",
			"library.noMetadata": "Missing .dsh-output.json metadata",
			"library.deliverables": "{n} deliverables",
			"library.assets": "{n} assets",
			"library.problems": "{n} project directories unreadable",
			"status.idea": "Idea",
			"status.scheduled": "Scheduled",
			"status.draft": "Draft",
			"status.ready": "Ready",
			"status.published": "Published",
			"kind.article": "Article",
			"kind.xhs-note": "XHS note",
			"kind.video": "Video",
			"kind.cards": "Cards",
			"kind.poster": "Poster",
			"kind.audio": "Audio",
			"kind.other": "Other",
			"tab.create": "Create · finished work",
			"tab.operate": "Operate · actions",
			"tab.create.aria": "Create finished work",
			"tab.operate.aria": "Run operations",
			"card.copyHint": "Click to copy the instruction",
			"card.copied": "Copied — paste it into a session composer to start",
			"badge.done": "Verified",
			"badge.ready": "Ready",
			"badge.need": "Needs setup",
			"badge.incoming": "Incoming",
			"group.visual": "Visual & cards",
			"group.article": "Writing",
			"group.video": "Video",
			"group.audio": "Audio",
			"group.discover": "Discover & topics",
			"group.plan": "Plan & positioning",
			"group.publish": "Publish & quality gate",
			"group.review": "Data & review",
			"cap.social-card.title": "Social media cards",
			"cap.social-card.detail": "Multi-card layout: hook cover, per-card points, call to action",
			"cap.cover-poster.title": "Cover poster plan",
			"cap.cover-poster.detail": "Full design description: title layout, subject, palette",
			"cap.infographic.title": "Infographic plan",
			"cap.infographic.detail": "Turn raw data into sections and chart suggestions",
			"cap.gzh-article.title": "Long-form article",
			"cap.gzh-article.detail": "Title options, hook opening, sections, engagement close",
			"cap.long-form.title": "In-depth essay",
			"cap.long-form.detail": "Outline first, then prose; sourced citations",
			"cap.polish.title": "Rewrite & polish",
			"cap.polish.detail": "Problems, rewrite, then per-change rationale",
			"cap.short-script.title": "Short video script",
			"cap.short-script.detail": "3-second hook, shot-by-shot voiceover, visual hints",
			"cap.storyboard.title": "Storyboard",
			"cap.storyboard.detail": "Expand a script into a shot table with framing and timing",
			"cap.podcast-outline.title": "Podcast outline",
			"cap.podcast-outline.detail": "Chapter topics, question lists, time budget",
			"cap.hotspot.title": "Trending topics",
			"cap.hotspot.detail": "Angles you can take, matched to your account positioning",
			"cap.breakdown.title": "Hit-content teardown",
			"cap.breakdown.detail": "Five-dimension attribution, reusable templates out",
			"cap.positioning.title": "Account positioning",
			"cap.positioning.detail": "Three directions: persona, content pillars, monetization",
			"cap.calendar-plan.title": "Content calendar",
			"cap.calendar-plan.detail": "Weekly topic plan with slack for trending pieces",
			"cap.multi-platform.title": "Multi-platform adaptation",
			"cap.multi-platform.detail": "One master piece rewritten within each platform’s limits",
			"cap.pre-publish.title": "Pre-publish check",
			"cap.pre-publish.detail": "Facts, compliance, clickbait, typos — four gates",
			"cap.retro.title": "Performance review",
			"cap.retro.detail": "Attribute wins and misses; actionable adjustments out"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin. */
		const NS = "content-studio";
		/**
		* Services required by the Content Studio plugin. The two Remote namespaces
		* are mounted by this plugin's own apply (not waited on as services): the
		* mount completes before the slot registrations below run.
		*/
		const inject = [
			"slots",
			"locale",
			"remote"
		];
		/**
		* Mount the plugin's own Remote contributions, then register the sidebar
		* entry and the workbench surface once their slot declarations are on the
		* ledger; both registrations install and roll back atomically through one
		* generator. The mounts unwound in reverse order after every registration.
		* @param ctx - client root context.
		*/
		async function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-content-studio: dictionaries");
			const disposers = [];
			try {
				for (const contribution of [TYPERT_REMOTE$1, TYPERT_REMOTE]) disposers.push(await ctx.remote.$mount(contribution));
			} catch (error) {
				for (const dispose of disposers.reverse()) await dispose();
				throw error;
			}
			const studio = createContentStudioController();
			const listOutputs = async () => {
				const result = await ctx.remote.contentOutputs.list();
				if (!result.ok) throw new Error(`contentOutputs.list failed: ${result.error.code}: ${result.error.message}`);
				return result.value;
			};
			const schedule = {
				list: async () => {
					const result = await ctx.remote.contentSchedule.list();
					if (!result.ok) throw new Error(`contentSchedule.list failed: ${result.error.code}: ${result.error.message}`);
					return result.value;
				},
				put: async (input) => {
					const result = await ctx.remote.contentSchedule.put(input);
					if (!result.ok) throw new Error(`contentSchedule.put failed: ${result.error.code}: ${result.error.message}`);
					return result.value;
				},
				remove: async (id) => {
					const result = await ctx.remote.contentSchedule.delete(id);
					if (!result.ok) throw new Error(`contentSchedule.delete failed: ${result.error.code}: ${result.error.message}`);
					return result.value;
				}
			};
			ctx.slots.inject("sidebar.footer.action", function* () {
				yield ctx.slots.register({
					name: "sidebar.footer.action",
					id: "content-studio-entry",
					locale: NS,
					inject: () => ({ studio })
				}, StudioEntry);
				yield ctx.slots.register({
					name: "shell.overlay",
					id: "content-studio",
					order: 50,
					locale: NS,
					inject: () => ({
						studio,
						listOutputs,
						schedule
					})
				}, ContentStudio);
			});
			return async () => {
				for (const dispose of disposers.reverse()) await dispose();
			};
		}
		//#endregion
		exports.CAPABILITY_ITEMS = CAPABILITY_ITEMS;
		exports.STUDIO_TABS = STUDIO_TABS;
		exports.apply = apply;
		exports.capabilityGroups = capabilityGroups;
		exports.createContentStudioController = createContentStudioController;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map