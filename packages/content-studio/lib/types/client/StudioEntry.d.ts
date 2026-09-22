import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ContentStudioController } from './studio-store.ts';
/** Injected face of the sidebar entry: the shared open/close controller. */
export interface StudioEntryInjected {
    studio: ContentStudioController;
}
/** Full entry props: the footer-action owner share plus the injected face and locale seat. */
export type StudioEntryProps = StudioEntryInjected & {
    wide: boolean;
} & PropsLocale<'content-studio'>;
/**
 * Render the Content Studio sidebar entry.
 * @param props - the column state, the shared controller, and the locale seat.
 * @returns the entry button element tree.
 */
export declare function StudioEntry({ wide, studio, t }: StudioEntryProps): import("react").JSX.Element;
//# sourceMappingURL=StudioEntry.d.ts.map