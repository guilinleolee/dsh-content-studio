/** Publication calendar Remote for the content-creation library. */
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import z from '@deepseek-ai/schemastery';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { join } from 'node:path';
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol';
import { SCHEDULE_FILENAME, mutateSchedule, normalizeInput, readSchedule } from "./store.js";
export { SCHEDULE_FILENAME, normalizeInput, readSchedule, mutateSchedule } from "./store.js";
export const Config = z.object({
    root: z.string(),
});
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
            _list_decorators = [Remote('list')];
            _put_decorators = [Remote('put')];
            _delete_decorators = [Remote('delete')];
            __esDecorate(this, null, _list_decorators, { kind: "method", name: "list", static: false, private: false, access: { has: obj => "list" in obj, get: obj => obj.list }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _put_decorators, { kind: "method", name: "put", static: false, private: false, access: { has: obj => "put" in obj, get: obj => obj.put }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _delete_decorators, { kind: "method", name: "delete", static: false, private: false, access: { has: obj => "delete" in obj, get: obj => obj.delete }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = [];
        static Config = Config;
        /** Absolute calendar file path. */
        file = __runInitializers(this, _instanceExtraInitializers);
        constructor(ctx, config) {
            super(ctx, 'contentSchedule');
            this.file = join(resolveDshHome(config.root), 'outputs', SCHEDULE_FILENAME);
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
            if (item === undefined)
                throw new Error(`invalid schedule item: ${detail ?? 'unknown reason'}`);
            return mutateSchedule(this.file, (items) => {
                const index = items.findIndex(candidate => candidate.id === item.id);
                if (index === -1)
                    return [...items, item];
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
            return mutateSchedule(this.file, items => items.filter(candidate => candidate.id !== id));
        }
    };
})();
export { ContentScheduleGateway };
export default ContentScheduleGateway;
//# sourceMappingURL=index.js.map