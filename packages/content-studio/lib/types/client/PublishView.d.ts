import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { PublishController } from './publish/publish-store.ts';
import type { PickedManuscript } from './studio-store.ts';
/** Injected face of the publish view. */
export interface PublishViewProps {
    readonly publish: PublishController;
    /** The active persona text, prefilled as the adaptation style reference. */
    readonly persona: string;
    /** Manuscript handed over from the create view, if any. */
    readonly pickedManuscript: PickedManuscript | null;
    readonly onClearPickedManuscript: () => void;
    readonly t: PropsLocale<'content-studio'>['t'];
}
/**
 * Render the publish view.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export declare function PublishView({ publish, persona, pickedManuscript, onClearPickedManuscript, t }: PublishViewProps): import("react").JSX.Element;
//# sourceMappingURL=PublishView.d.ts.map