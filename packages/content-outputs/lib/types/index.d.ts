/** Read-only Remote projection of the content-creation outputs library. */
import type { Context } from '@deepseek-ai/cordis';
import type Schema from '@deepseek-ai/schemastery';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ContentOutputsSnapshot } from './types.ts';
export type * from './types.ts';
export { METADATA_FILENAME, ASSETS_DIRNAME, scanOutputs, scanProject } from './scan.ts';
/** Content-outputs Remote configuration. */
export interface Config {
    /** Outputs library root. Defaults to `<dsh home>/outputs`. */
    root?: string;
}
export declare const Config: Schema<Config>;
/** Remote-only service projecting the outputs library from disk per call. */
export declare class ContentOutputsGateway extends TypertRemoteService {
    static inject: never[];
    static Config: Schema<Config>;
    /** Absolute library root; a missing directory scans as an empty library. */
    private readonly root;
    constructor(ctx: Context, config: Config);
    /**
     * Read the library root directly on every call: the library is the agent's
     * write surface, so a cache would only add a second truth to synchronize.
     * @returns Current projects in topic order, with every unreadable
     * directory named in `problems`.
     */
    list(): Promise<ContentOutputsSnapshot>;
}
export default ContentOutputsGateway;
//# sourceMappingURL=index.d.ts.map