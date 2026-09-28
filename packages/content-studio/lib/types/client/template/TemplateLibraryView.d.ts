import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { TemplateController } from './template-store.ts';
/** Props: the injected controller plus the locale seat. */
export type TemplateLibraryViewProps = {
    templates: TemplateController;
} & PropsLocale<'content-studio'>;
/**
 * Render the template library page.
 * @param props - the injected controller and the locale seat.
 * @returns the page element tree.
 */
export declare function TemplateLibraryView({ templates, t }: TemplateLibraryViewProps): import("react").JSX.Element;
//# sourceMappingURL=TemplateLibraryView.d.ts.map