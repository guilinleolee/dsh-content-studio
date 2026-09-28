/**
 * Wire vocabulary of the content-outputs interactions face: the
 * multi-platform fan-interaction inbox (conversations with embedded
 * messages), the derived summary cache, the AI-extracted audience insights,
 * the two-step CSV import, and the one-shot AI calls (reply drafts,
 * sentiment/intent classification, insight extraction). Client-safe by
 * construction — no Node or filesystem imports.
 */
/** All platforms, in picker order; import and stores validate against this list. */
export const INTERACTION_PLATFORMS = ['xhs', 'douyin', 'weixin', 'bilibili'];
/** All message kinds, in picker order. */
export const INTERACTION_MESSAGE_TYPES = ['comment', 'dm', 'mention'];
/** All statuses, in pipeline order. */
export const INTERACTION_STATUSES = ['unread', 'pendingReply', 'replied', 'archived', 'spam'];
/** All reply tones, in picker order. */
export const INTERACTION_STYLES = ['formal', 'friendly', 'humorous', 'brief'];
/** The unclassified sentiment placeholder every imported message starts with. */
export const UNTAGGED_SENTIMENT = { value: 'unknown', source: 'user', aiMeta: null };
/** The unclassified intent placeholder every imported message starts with. */
export const UNTAGGED_INTENT = { value: 'unknown', source: 'user', aiMeta: null };
/** The empty insights value a fresh manifest starts with. */
export const EMPTY_INTERACTION_INSIGHTS = {
    generatedAt: null, topQuestions: [], painPoints: [], interests: [],
};
/** The empty summary a fresh manifest starts with. */
export const EMPTY_INTERACTION_SUMMARY = {
    unread: 0, pendingReply: 0, replied: 0, archived: 0, spam: 0,
};
//# sourceMappingURL=types.js.map