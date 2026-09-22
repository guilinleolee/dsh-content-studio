/** Read-only Remote projection of the content-creation outputs library. */
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
import { scanOutputs } from "./scan.js";
export { METADATA_FILENAME, ASSETS_DIRNAME, scanOutputs, scanProject } from "./scan.js";
export const Config = z.object({
    root: z.string(),
});
/** Remote-only service projecting the outputs library from disk per call. */
let ContentOutputsGateway = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _list_decorators;
    return class ContentOutputsGateway extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _list_decorators = [Remote('list')];
            __esDecorate(this, null, _list_decorators, { kind: "method", name: "list", static: false, private: false, access: { has: obj => "list" in obj, get: obj => obj.list }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = [];
        static Config = Config;
        /** Absolute library root; a missing directory scans as an empty library. */
        root = __runInitializers(this, _instanceExtraInitializers);
        constructor(ctx, config) {
            super(ctx, 'contentOutputs');
            this.root = join(resolveDshHome(config.root), 'outputs');
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
export { ContentOutputsGateway };
export default ContentOutputsGateway;
//# sourceMappingURL=index.js.map