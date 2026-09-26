/**
 * Server-side HTML sanitization for gathered body snapshots. The allowlist
 * (sanitize-html) decides what survives: a written `*.html` snapshot keeps
 * prose and embedded media markup and drops every other tag with its
 * content. Hand-rolled tag stripping is not an option here — script and
 * iframe deletion cannot cover `javascript:`/`data:` URIs, SVG/MathML
 * mutation vectors, or DOM clobbering; the browser side re-runs DOMPurify at
 * render as the second layer.
 */

import sanitizeHtml from 'sanitize-html'

/**
 * Sanitize one gathered HTML body into its storable form.
 * @param raw - untrusted HTML as the feed carried it.
 * @returns HTML restricted to the allowlist, safe to persist and (with the
 * render-side DOMPurify pass) to inject into the detail view.
 */
export function sanitizeGatherHtml(raw: string): string {
  return sanitizeHtml(raw, {
    allowedTags: [
      // Text and structure.
      'p', 'br', 'hr', 'blockquote', 'pre', 'code',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup', 'span', 'div',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      // Tables.
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
      // Media and references.
      'a', 'img', 'figure', 'figcaption', 'picture', 'source', 'video', 'audio', 'track',
      // Inline semantics kept for meaning, not styling.
      'abbr', 'cite', 'q', 'dfn', 'kbd', 'samp', 'var', 'time', 'mark', 'wbr',
    ],
    allowedAttributes: {
      // `rel`/`target` are re-added by the `transformTags` link hardening below.
      a: ['href', 'title', 'name', 'rel', 'target'],
      img: ['src', 'srcset', 'sizes', 'alt', 'title', 'width', 'height', 'loading'],
      picture: [], source: ['src', 'srcset', 'sizes', 'media', 'type'],
      video: ['src', 'poster', 'controls', 'width', 'height'],
      audio: ['src', 'controls'], track: ['src', 'kind', 'srclang', 'label'],
      abbr: ['title'], cite: [], q: ['cite'], time: ['datetime'],
      th: ['scope', 'colspan', 'rowspan'], td: ['colspan', 'rowspan'],
      col: ['span'], colgroup: ['span'],
      code: ['class'], span: ['class'], div: ['class'],
      h1: ['id'], h2: ['id'], h3: ['id'], h4: ['id'], h5: ['id'], h6: ['id'],
    },
    // http/https only for every URL-bearing attribute; relative scheme-less
    // URLs pass through `transformTags` normalization below.
    allowedSchemes: ['http', 'https'],
    allowedSchemesByTag: { img: ['http', 'https'], source: ['http', 'https'], video: ['http', 'https'], audio: ['http', 'https'], track: ['http', 'https'] },
    allowProtocolRelative: false,
    // Non-allowlisted content is removed with its content (`script`, `style`,
    // `iframe`, SVG/MathML, forms); keeping inner text would smuggle payloads.
    nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'noembed', 'embed', 'object'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
    // Feed markup rarely closes cleanly; the parser recovers instead of failing.
    disallowedTagsMode: 'discard',
  })
}

/**
 * Reduce one sanitized (or any) HTML document to its visible text.
 * @param raw - untrusted HTML.
 * @returns text content with tags and their inner scripting dropped.
 */
export function htmlToText(raw: string): string {
  return sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} })
}
