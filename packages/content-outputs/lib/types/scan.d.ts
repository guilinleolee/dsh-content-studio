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
import type { ContentOutputsSnapshot, OutputMetadata, OutputProject } from './types.ts';
/** Metadata file name every project directory carries. */
export declare const METADATA_FILENAME = ".dsh-output.json";
/** Intermediate-material directory inside a project. */
export declare const ASSETS_DIRNAME = "assets";
/**
 * Parse and fully validate one metadata file. Any violation — wrong JSON,
 * unknown format version, a field of the wrong type — returns undefined; the
 * caller keeps the project visible with fallbacks instead.
 * @param raw - exact file contents.
 * @returns the metadata only when it conforms to format version 0.
 */
export declare function parseMetadata(raw: string): OutputMetadata | undefined;
/**
 * Read one project directory into its projection.
 * @param root - absolute library root.
 * @param topic - project directory name.
 * @returns the project projection, plus a problem entry instead when the
 * directory is unreadable.
 */
export declare function scanProject(root: string, topic: string): Promise<{
    project?: OutputProject;
    problem?: string;
}>;
/**
 * Scan the whole library root.
 * @param root - absolute library root; a missing root is an empty library.
 * @returns the snapshot with projects in name order and every failure named.
 */
export declare function scanOutputs(root: string): Promise<ContentOutputsSnapshot>;
//# sourceMappingURL=scan.d.ts.map