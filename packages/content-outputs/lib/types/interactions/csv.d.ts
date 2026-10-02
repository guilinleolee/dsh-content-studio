/**
 * CSV parsing for the interactions face: the frozen import contract in, and
 * the round-trip export builder out. Nothing touches disk here — the
 * preview returns parsed rows plus every rejection, and only the confirmed
 * rows land through the commit face. Unlike the review importers, the
 * columns are this plugin's own contract (exact header names), not a
 * platform's export template, so no alias table exists.
 */
import type { InteractionImportPreview, InteractionImportPreviewRequest } from './types.ts';
/** Hard input cap: the largest CSV text one parse accepts. */
export declare const INTERACTION_MAX_IMPORT_CHARS = 2000000;
/** Hard row cap: the most data rows one file may carry. */
export declare const INTERACTION_MAX_IMPORT_ROWS = 5000;
/** Hard content cap; longer messages truncate rather than reject. */
export declare const INTERACTION_MAX_MESSAGE_CHARS = 20000;
/**
 * The export column order: exactly the import columns plus
 * `conversation_id`, `status`, and `tags` — an export re-imports unchanged.
 */
export declare const INTERACTION_CSV_COLUMNS: readonly string[];
/**
 * Escape one CSV field per RFC 4180: quotes double, delimiters force quoting.
 * @param value - the raw field text.
 * @returns the field safe to place as one CSV record cell.
 */
export declare function escapeCsvField(value: string): string;
/**
 * Parse one import file into the preview: validated message rows plus
 * per-row rejections with 1-based physical row numbers. Text that decodes
 * with replacement characters reads as a non-UTF-8 (typically GBK) export
 * and rejects wholesale — no silent mojibake, no auto-transcode guessing.
 * @param request - the file name and the raw CSV text (browser-decoded).
 * @returns the preview; nothing is stored.
 */
export declare function parseInteractionImport(request: InteractionImportPreviewRequest): InteractionImportPreview;
/**
 * Build one export CSV from whole conversations: the import columns plus
 * `conversation_id`, `status`, and `tags`, UTF-8 BOM first and CRLF lines,
 * so Excel opens it cleanly and the file re-imports unchanged. Threads
 * export the parent's external message id in `in_reply_to`, resolved
 * through the internal-id map; unresolved parents export empty.
 * @param conversations - the conversations to export.
 * @returns the complete CSV text with BOM.
 */
export declare function buildInteractionExportCsv(conversations: readonly {
    readonly id: string;
    readonly platform: string;
    readonly status: string;
    readonly tags: readonly string[];
    readonly participant: {
        readonly externalUserId: string;
        readonly nickname: string;
    };
    readonly messages: readonly {
        readonly id: string;
        readonly externalMessageId: string;
        readonly type: string;
        readonly content: string;
        readonly inReplyTo: string | null;
        readonly sentAt: string;
    }[];
}[]): string;
//# sourceMappingURL=csv.d.ts.map