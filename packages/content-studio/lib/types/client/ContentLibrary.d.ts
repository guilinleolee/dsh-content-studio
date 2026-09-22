import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ContentOutputsSnapshot } from '@deepseek-ai/dsh-content-outputs/types';
/** Injected face of the library view: the Remote list wrapper. */
export interface ContentLibraryInjected {
    listOutputs: () => Promise<ContentOutputsSnapshot>;
}
/** Full library props: the injected face plus the locale seat. */
export type ContentLibraryProps = ContentLibraryInjected & PropsLocale<'content-studio'>;
/**
 * Render the outputs library.
 * @param props - the Remote list wrapper and the locale seat.
 * @returns the library element tree.
 */
export declare function ContentLibrary({ listOutputs, t }: ContentLibraryProps): import("react").JSX.Element;
//# sourceMappingURL=ContentLibrary.d.ts.map