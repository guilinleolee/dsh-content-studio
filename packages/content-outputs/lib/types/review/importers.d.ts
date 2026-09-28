/**
 * Import parsing for the review face: RFC 4180 CSV text in, validated and
 * normalized work rows out. Nothing touches disk here — the preview returns
 * parsed rows plus every rejection, and only the confirmed rows land as
 * snapshots through the commit face. Column mapping is data-driven per
 * platform (aliased header names, since export templates differ per platform
 * and per release); unmapped columns are surfaced, never silently dropped.
 */
import type { ReviewImportPreview, ReviewImportPreviewRequest, ReviewMetrics, ReviewPlatformId } from '../types.ts';
/** Hard input cap: the largest CSV text one parse accepts. */
export declare const REVIEW_MAX_IMPORT_CHARS = 2000000;
/** Hard row cap: the most data rows one file may carry. */
export declare const REVIEW_MAX_IMPORT_ROWS = 5000;
/** Hard title cap; longer titles truncate rather than reject. */
export declare const REVIEW_MAX_TITLE_CHARS = 300;
/**
 * Parse one CSV document into physical rows: RFC 4180 quoted fields with
 * doubled-quote escapes, CR / LF / CRLF line endings, and a stripped UTF-8
 * BOM. A quote inside an unquoted field is literal; a newline inside quotes
 * keeps the physical-row count aligned with the caller's rejection numbering.
 * @param text - the raw file text.
 * @returns the rows, each a list of field strings.
 */
export declare function parseCsvRows(text: string): string[][];
/** Every internal field the column mapper resolves. */
type ImportField = keyof ReviewMetrics | 'workId' | 'title' | 'publishedAt' | 'contentType';
/**
 * Map one CSV header row onto the internal fields by alias.
 * @param header - the raw header cells.
 * @returns each field's column index (-1 when no header matched), plus the
 *   unmatched header names.
 */
export declare function mapImportColumns(header: readonly string[]): {
    columns: Record<ImportField, number>;
    unknownColumns: string[];
};
/**
 * Normalize one metric cell: numbers pass through, `万`/`w` suffixed values
 * scale to units, blanks and dashes read as null. Any other text rejects.
 * @param cell - the raw cell, or undefined when the column is absent.
 * @returns the number, or null when blank.
 */
export declare function parseMetricCell(cell: string | undefined): number | null;
/**
 * Normalize one date cell to an ISO 8601 instant. Accepts ISO strings and the
 * `YYYY/M/D H:m[:s]` / `YYYY-M-D` forms the platform exports use; blank reads
 * as null; anything else rejects.
 * @param cell - the raw cell, or undefined when the column is absent.
 * @returns the ISO instant, or null when blank.
 */
export declare function parseDateCell(cell: string | undefined): string | null;
/**
 * Parse one import file into the preview: mapped rows, per-row rejections
 * with 1-based physical row numbers, and the unmatched header names. The
 * work-id column must resolve or the whole file rejects — rows without an
 * identity cannot dedupe.
 * @param request - the platform, the file name, and the raw CSV text.
 * @returns the preview; nothing is stored.
 */
export declare function parseImportFile(request: ReviewImportPreviewRequest): ReviewImportPreview;
/**
 * The platform export shapes the importers document as their baseline
 * (verified against each platform's center export naming as of 2026-09;
 * aliases absorb the drift). UI copy may surface this list verbatim.
 */
export declare const PLATFORM_IMPORT_HINTS: Readonly<Record<ReviewPlatformId, string>>;
export {};
//# sourceMappingURL=importers.d.ts.map