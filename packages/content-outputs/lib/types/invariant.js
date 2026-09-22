/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-content-outputs`.
 * @module @deepseek-ai/dsh-content-outputs/invariant
 */
const PACKAGE_NAME = '@deepseek-ai/dsh-content-outputs';
/** Cordis companion plugin name. */
export const name = 'content-outputs-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/**
 * No runtime invariant: every snapshot is projected directly from the
 * filesystem per call — the library root is the agent's write surface, so
 * there is no second truth for an invariant to assert relationships over.
 */
const install = () => { };
/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
/* jscpd:ignore-end */
//# sourceMappingURL=invariant.js.map