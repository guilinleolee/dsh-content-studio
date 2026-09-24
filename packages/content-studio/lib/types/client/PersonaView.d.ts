import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
/** Props: the controlled persona text and saver, plus the locale seat. */
export type PersonaViewProps = {
    persona: string;
    onSave: (persona: string) => void;
} & PropsLocale<'content-studio'>;
/**
 * Render the persona editor.
 * @param props - the controlled persona text, saver, and the locale seat.
 * @returns the page element tree.
 */
export declare function PersonaView({ persona, onSave, t }: PersonaViewProps): import("react").JSX.Element;
//# sourceMappingURL=PersonaView.d.ts.map