/**
 * On-disk store for the interactions face: the library-root
 * `_interactions.json` system file (underscore = invisible to the outputs
 * scanner). `.dsh-output.json`, theme directories, and every other face's
 * file are never touched. One malformed conversation never hides the rest —
 * it is named in `problems` and dropped; a malformed envelope reads as an
 * empty manifest with the rejection named. Writes reject wholesale (the
 * caller fixes its list, the store never repairs it) and recompute the
 * derived summary under the same commit, so the cache can never drift from
 * the conversations it summarizes.
 */
import type { InteractionConversation, InteractionImportCommitRequest, InteractionImportCommitResult, InteractionSummary, InteractionsManifest, InteractionsManifestRead } from './types.ts';
/** System file name of the interactions manifest at the library root. */
export declare const INTERACTIONS_FILENAME = "_interactions.json";
/** Hard conversation count; the write path rejects past it. */
export declare const INTERACTIONS_MAX_CONVERSATIONS = 20000;
/** Hard messages-per-conversation cap; the write path rejects past it. */
export declare const INTERACTIONS_MAX_MESSAGES = 5000;
/**
 * Recompute the derived summary from the conversations: the cache the
 * workbench badge reads, always rebuilt — never trusted from the file.
 * @param conversations - the validated conversations.
 * @returns the per-status counts.
 */
export declare function summarizeInteractions(conversations: readonly InteractionConversation[]): InteractionSummary;
/**
 * Parse and validate one interactions manifest. One malformed conversation
 * never hides the rest: it is named in `problems` and dropped. The summary
 * cache is always recomputed from the surviving conversations, and the
 * message/conversation orderings are normalized on read.
 * @param raw - exact file contents.
 * @returns the manifest with only valid entries, plus every dropped one named.
 */
export declare function parseInteractionsManifest(raw: string): {
    manifest: InteractionsManifest;
    problems: string[];
};
/**
 * Validate one incoming manifest wholesale; used by the write path to reject
 * rather than repair caller mistakes.
 * @param manifest - the manifest the caller wants stored.
 * @throws when the envelope, insights, or any conversation violates the format.
 */
export declare function assertInteractionsManifest(manifest: InteractionsManifest): void;
/**
 * Read the interactions manifest.
 * @param root - absolute outputs library root.
 * @returns the manifest (null when absent) with only valid entries, every
 *   dropped one named in `problems`; callers must not write back while
 *   `problems` is non-empty.
 */
export declare function readInteractionsFile(root: string): Promise<InteractionsManifestRead>;
/**
 * Replace the interactions manifest with an atomic, locked commit. The
 * summary cache is recomputed here and the canonical orderings applied, so
 * the stored file is always normalized regardless of what the caller sent.
 * @param root - absolute outputs library root.
 * @param manifest - the complete next manifest.
 * @returns the stored manifest (recomputed summary, canonical order).
 */
export declare function writeInteractionsFile(root: string, manifest: InteractionsManifest): Promise<InteractionsManifest>;
/**
 * Commit confirmed import rows: group messages into conversations by
 * `platform + external_user_id`, dedupe against stored and batch messages by
 * `platform + external_message_id` (an existing id updates content and time
 * in place), and resolve threading against the library plus the batch —
 * unresolved parents keep the message with a null link and a named warning.
 * Runs under the file lock so two importers cannot interleave.
 * @param root - absolute outputs library root.
 * @param request - the confirmed parsed rows.
 * @returns the append/update accounting and the thread warnings.
 */
export declare function commitInteractionImportFile(root: string, request: InteractionImportCommitRequest): Promise<InteractionImportCommitResult>;
//# sourceMappingURL=store.d.ts.map