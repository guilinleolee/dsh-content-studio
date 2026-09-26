import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { PersonaController } from './persona/persona-store.ts';
/** Props: the injected controller plus the locale seat. */
export type PersonaViewProps = {
    personas: PersonaController;
} & PropsLocale<'content-studio'>;
/**
 * Render the persona page.
 * @param props - the injected controller and the locale seat.
 * @returns the page element tree.
 */
export declare function PersonaView({ personas, t }: PersonaViewProps): import("react").JSX.Element;
//# sourceMappingURL=PersonaView.d.ts.map