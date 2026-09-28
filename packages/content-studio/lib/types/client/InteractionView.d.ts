import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { PersonaController } from './persona/persona-store.ts';
import type { TemplateController } from './template/template-store.ts';
import type { InteractionController } from './interaction/interaction-store.ts';
/** Injected face of the interaction view. */
export interface InteractionViewInjected {
    interaction: InteractionController;
    personas: PersonaController;
    templates: TemplateController;
    /** Current theme directory names, projected from the outputs library. */
    listThemes: () => Promise<readonly string[]>;
}
/** Full view props: the injected face plus the locale seat. */
export type InteractionViewProps = InteractionViewInjected & PropsLocale<'content-studio'>;
/**
 * Render the interaction workbench.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export declare function InteractionView({ interaction, personas, templates, listThemes, t }: InteractionViewProps): import("react").JSX.Element;
//# sourceMappingURL=InteractionView.d.ts.map