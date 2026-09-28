/**
 * Wire vocabulary of the content-outputs publish face: the distribution-task
 * state stored as `assets/_publish.json`, the derived per-platform drafts
 * under `assets/publish/<taskId>/`, the global `_publish-index.json`
 * aggregation aid, the `_publish-profiles.json` platform-account cards, and
 * the one-shot per-platform AI adaptation call. Client-safe by construction —
 * no Node or filesystem imports.
 */
/** All statuses, in lifecycle order; the store validates against this list.
 * The phase-2 execution states (`executing` `partialSuccess` `success`
 * `failed`) are deliberately absent: they arrive with the MCP channel and
 * every consumer switch ends in a documented default until then. */
export const PUBLISH_STATUSES = ['draft', 'pendingReview', 'scheduled', 'recorded'];
/** All platform statuses, in lifecycle order; the store validates against this list. */
export const PLATFORM_STATUSES = ['pending', 'adapted', 'edited', 'recorded'];
/** All modes; the store validates against this list. */
export const PUBLISH_MODES = ['immediate', 'scheduled'];
/** All attempt actions; the store validates against this list. */
export const PLATFORM_ATTEMPT_ACTIONS = ['adapt', 'edit', 'record'];
//# sourceMappingURL=types.js.map