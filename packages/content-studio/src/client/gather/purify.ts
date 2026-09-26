/**
 * Render-side sanitization for gathered body snapshots: DOMPurify runs at
 * render as the second layer behind the gateway's sanitize-html allowlist,
 * so a snapshot that was written by an older gateway (or tampered on disk)
 * still cannot execute anything in the workbench page.
 */

import DOMPurify from 'dompurify'

/**
 * Sanitize one stored HTML body for injection into the detail view.
 * @param html - the stored (gateway-sanitized) snapshot HTML.
 * @returns HTML restricted to the HTML profile, non-allowlisted content
 * dropped with its content.
 */
export function sanitizeForRender(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    KEEP_CONTENT: false,
    FORBID_ATTR: ['style'],
    ADD_ATTR: ['target', 'rel'],
  })
}
