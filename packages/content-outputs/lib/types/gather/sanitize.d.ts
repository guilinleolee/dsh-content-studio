/**
 * Server-side HTML sanitization for gathered body snapshots. The allowlist
 * (sanitize-html) decides what survives: a written `*.html` snapshot keeps
 * prose and embedded media markup and drops every other tag with its
 * content. Hand-rolled tag stripping is not an option here — script and
 * iframe deletion cannot cover `javascript:`/`data:` URIs, SVG/MathML
 * mutation vectors, or DOM clobbering; the browser side re-runs DOMPurify at
 * render as the second layer.
 */
/**
 * Sanitize one gathered HTML body into its storable form.
 * @param raw - untrusted HTML as the feed carried it.
 * @returns HTML restricted to the allowlist, safe to persist and (with the
 * render-side DOMPurify pass) to inject into the detail view.
 */
export declare function sanitizeGatherHtml(raw: string): string;
/**
 * Reduce one sanitized (or any) HTML document to its visible text.
 * @param raw - untrusted HTML.
 * @returns text content with tags and their inner scripting dropped.
 */
export declare function htmlToText(raw: string): string;
//# sourceMappingURL=sanitize.d.ts.map