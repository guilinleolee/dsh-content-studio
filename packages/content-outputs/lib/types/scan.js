/**
 * Outputs library scanner: reads the on-disk project convention directly on
 * every call. The convention is one directory per creation under the library
 * root — finished files at the project root, intermediate material under
 * `assets/`, and `.dsh-output.json` as the only metadata. Names beginning
 * with `.` or `_` are system entries, not projects.
 *
 * A malformed metadata file never kills the whole snapshot: the project is
 * projected with fallbacks and named through `hasMetadata`, because one bad
 * file must not take the library view down while the other projects stay
 * readable.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
/** Metadata file name every project directory carries. */
export const METADATA_FILENAME = '.dsh-output.json';
/** Intermediate-material directory inside a project. */
export const ASSETS_DIRNAME = 'assets';
const KINDS = ['article', 'xhs-note', 'video', 'cards', 'poster', 'audio', 'other'];
const STATUSES = ['draft', 'ready', 'published'];
function isProjectEntry(name, type) {
    return type === 'directory' && !name.startsWith('.') && !name.startsWith('_');
}
/**
 * Parse and fully validate one metadata file. Any violation — wrong JSON,
 * unknown format version, a field of the wrong type — returns undefined; the
 * caller keeps the project visible with fallbacks instead.
 * @param raw - exact file contents.
 * @returns the metadata only when it conforms to format version 0.
 */
export function parseMetadata(raw) {
    let value;
    try {
        value = JSON.parse(raw);
    }
    catch {
        return undefined;
    }
    if (typeof value !== 'object' || value === null)
        return undefined;
    const record = value;
    if (record.formatVersion !== 0)
        return undefined;
    if (typeof record.title !== 'string' || record.title.length === 0)
        return undefined;
    if (!KINDS.includes(record.kind))
        return undefined;
    if (record.platform !== null && typeof record.platform !== 'string')
        return undefined;
    if (!STATUSES.includes(record.status))
        return undefined;
    if (!Array.isArray(record.tags) || !record.tags.every(tag => typeof tag === 'string'))
        return undefined;
    if (record.summary !== null && typeof record.summary !== 'string')
        return undefined;
    return value;
}
/**
 * Read one project directory into its projection.
 * @param root - absolute library root.
 * @param topic - project directory name.
 * @returns the project projection, plus a problem entry instead when the
 * directory is unreadable.
 */
export async function scanProject(root, topic) {
    const dir = join(root, topic);
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    }
    catch (error) {
        return { problem: `unreadable project directory: ${error instanceof Error ? error.message : String(error)}` };
    }
    const deliverables = [];
    let assetCount = 0;
    for (const entry of entries) {
        if (entry.name === METADATA_FILENAME)
            continue;
        if (entry.isDirectory()) {
            if (entry.name === ASSETS_DIRNAME) {
                try {
                    assetCount = (await readdir(join(dir, ASSETS_DIRNAME))).length;
                }
                catch {
                    // An unreadable assets directory counts as empty; the deliverable
                    // surface — the reason the library exists — stays intact.
                }
            }
            continue;
        }
        if (!entry.isFile() || entry.name.startsWith('.'))
            continue;
        deliverables.push(entry.name);
    }
    let metadata;
    let hasMetadata = false;
    try {
        metadata = parseMetadata(await readFile(join(dir, METADATA_FILENAME), 'utf8'));
        hasMetadata = true;
    }
    catch {
        // No metadata file: project with fallbacks, surfaced through hasMetadata
        // so the UI can ask for a repair instead of hiding the directory.
    }
    let updatedAt;
    try {
        updatedAt = (await stat(dir)).mtime.toISOString();
    }
    catch {
        updatedAt = new Date(0).toISOString();
    }
    const project = {
        topic: topic,
        title: metadata?.title ?? topic,
        kind: metadata?.kind ?? 'other',
        platform: metadata?.platform ?? null,
        status: metadata?.status ?? 'draft',
        tags: metadata?.tags ?? [],
        summary: metadata?.summary ?? null,
        updatedAt,
        deliverables,
        assetCount,
        hasMetadata,
    };
    return { project };
}
/**
 * Scan the whole library root.
 * @param root - absolute library root; a missing root is an empty library.
 * @returns the snapshot with projects in name order and every failure named.
 */
export async function scanOutputs(root) {
    let entries;
    try {
        entries = await readdir(root, { withFileTypes: true });
    }
    catch {
        return { root, projects: [], problems: [] };
    }
    const topics = entries
        .map(entry => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other' }))
        .filter(entry => isProjectEntry(entry.name, entry.type))
        .map(entry => entry.name)
        .sort();
    const projects = [];
    const problems = [];
    for (const topic of topics) {
        const scanned = await scanProject(root, topic);
        if (scanned.project !== undefined)
            projects.push(scanned.project);
        else if (scanned.problem !== undefined)
            problems.push({ topic, detail: scanned.problem });
    }
    return { root, projects, problems };
}
//# sourceMappingURL=scan.js.map