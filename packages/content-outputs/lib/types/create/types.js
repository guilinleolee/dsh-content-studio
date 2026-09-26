/**
 * Wire vocabulary of the content-outputs create face: the creation workbench
 * state stored as `assets/_create.json`, the theme-root publishing handoff,
 * and the one-shot AI generation/rewrite calls. Client-safe by construction —
 * no Node or filesystem imports.
 */
/** All content types, in picker order; the store and the AI face validate against this list. */
export const CREATE_CONTENT_TYPES = [
    'gzh-article',
    'xhs-note',
    'video-script',
    'voiceover',
    'product-page',
    'rewrite',
];
/** All rewrite operations, in toolbar order. */
export const CREATE_REWRITE_OPERATIONS = [
    'condense',
    'expand',
    'style',
    'perspective',
    'extract',
    'humanize-light',
    'humanize-deep',
    'titles',
];
/** Style choices of the `style` operation, in toolbar order. */
export const CREATE_STYLES = ['professional', 'friendly', 'hardcore', 'story', 'concise'];
/** All grades, weakest last; the AI face validates against this list. */
export const CREATE_GRADES = ['优', '良', '中', '弱'];
//# sourceMappingURL=types.js.map