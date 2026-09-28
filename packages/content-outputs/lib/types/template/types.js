/**
 * Wire vocabulary of the global template library on the content-outputs
 * Remote: the reusable skeleton assets every Content Studio column can
 * initialize a form or prompt from, their shared tag taxonomy, the per-save
 * history snapshots, and the template AI operations (skeleton generation,
 * body optimization, variable extraction). Client-safe by construction — no
 * Node or filesystem imports. Templates live outside the outputs library on
 * purpose: they are global assets, never theme business data.
 */
/** Every template category, one per studio column plus the dashboard placeholder. */
export const TEMPLATE_CATEGORIES = [
    'topic', 'creation', 'publish', 'calendar', 'retro',
    'interaction', 'persona', 'benchmark', 'intel', 'dashboard',
];
//# sourceMappingURL=types.js.map