/**
 * Render-side sanitization for gathered body snapshots: DOMPurify runs at
 * render as the second layer behind the gateway's sanitize-html allowlist,
 * so a snapshot that was written by an older gateway (or tampered on disk)
 * still cannot execute anything in the workbench page.
 */
/**
 * Sanitize one stored HTML body for injection into the detail view.
 * @param html - the stored (gateway-sanitized) snapshot HTML.
 * @returns HTML restricted to the HTML profile, non-allowlisted content
 * dropped with its content.
 */
export declare function sanitizeForRender(html: string): string;
//# sourceMappingURL=purify.d.ts.map