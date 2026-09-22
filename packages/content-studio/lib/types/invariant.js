/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-content-studio`.
 * @module @deepseek-ai/dsh-client-ui-content-studio/invariant
 */
const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-content-studio';
/** Cordis companion plugin name. */
export const name = 'client-ui-content-studio-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/**
 * No runtime invariant: a pure-consumer plugin registering a presentational
 * entry into the ui-sidebar-declared `sidebar.footer.action` hole and a
 * presentational surface into the ui-layout-declared `shell.overlay` hole,
 * plus its locale dictionaries — its inject face is one open/close controller
 * shared between the two registrations; it emits no cordis events and owns no
 * cross-plugin mutable state.
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