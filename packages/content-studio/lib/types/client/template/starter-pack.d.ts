/**
 * The bundled starter pack: eight seed skeletons across six categories that
 * make an empty template library immediately usable, and demonstrate the
 * pack format for the freemium "paid template pack" distribution channel.
 * Ids are stable and readable (not UUIDs) so a re-import with the `skip`
 * strategy is idempotent; the gateway re-validates every record, and the
 * pack spec pins each body's placeholders to its declared variables.
 * Client-safe data only — the bundle purity gate sees an in-plugin constant.
 */
import type { TemplatePack } from '@deepseek-ai/dsh-content-outputs/types';
/** Display name used in the import report. */
export declare const STARTER_PACK_NAME = "starter-pack";
/** The bundled starter pack document, imported with the idempotent `skip` strategy. */
export declare const STARTER_TEMPLATE_PACK: TemplatePack;
//# sourceMappingURL=starter-pack.d.ts.map