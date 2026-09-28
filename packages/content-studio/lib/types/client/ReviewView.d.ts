import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ReviewController } from './review/review-store.ts';
/** Injected face of the review view. */
export interface ReviewViewInjected {
    review: ReviewController;
    /** Current theme directory names, projected from the outputs library. */
    listThemes: () => Promise<readonly string[]>;
}
/** Full view props: the injected face plus the locale seat. */
export type ReviewViewProps = ReviewViewInjected & PropsLocale<'content-studio'>;
/**
 * Render the review workbench.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export declare function ReviewView({ review, listThemes, t }: ReviewViewProps): import("react").JSX.Element;
//# sourceMappingURL=ReviewView.d.ts.map