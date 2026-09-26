//#region lib/types/invariant.js
/**
* Package-owned invariant companion for `@deepseek-ai/dsh-content-topics`.
* @module @deepseek-ai/dsh-content-topics/invariant
*/
const PACKAGE_NAME = "@deepseek-ai/dsh-content-topics";
/** Cordis companion plugin name. */
const name = "content-topics-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: the topic bank file is the single truth, read and
* committed under the atomic-write file lock per call — there is no second
* state for an invariant to assert relationships over.
*/
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
