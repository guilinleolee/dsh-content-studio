/**
 * Client-side model of the gather view: sources, tasks, and task logs live
 * in browser storage only; materials mirror the on-disk manifest entries.
 * Field sets follow the gather development prompt exactly — the one
 * addition is `consecutiveFailures` on a source, the counter the failure
 * backoff (1h → 2h → 4h, capped at 24h) is computed from.
 */
/**
 * Contract name reserved with the topic-bank feature: joining one material
 * into the topic bank. The gather view renders the entry under this name
 * today as a pending toast; once the topic bank ships, its handler plugs in
 * as `addToTopicBank(materialId)` and the material's stable id becomes the
 * topic's `source.refId`.
 */
export const ADD_TO_TOPIC_BANK = 'addToTopicBank';
//# sourceMappingURL=types.js.map