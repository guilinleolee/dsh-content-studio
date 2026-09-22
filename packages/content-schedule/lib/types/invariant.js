/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-content-schedule`.
 * @module @deepseek-ai/dsh-content-schedule/invariant
 */
const PACKAGE_NAME = '@deepseek-ai/dsh-content-schedule';
/** Cordis companion plugin name. */
export const name = 'content-schedule-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/**
 * No runtime invariant: the calendar file is the single truth, read and
 * committed under the atomic-write file lock per call — there is no second
 * state for an invariant to assert relationships over.
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