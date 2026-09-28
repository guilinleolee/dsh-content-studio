import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { TemplateController } from './template-store.ts';
/** Props: the injected controller plus the locale seat. */
export type TemplatePickerModalProps = {
    templates: TemplateController;
} & PropsLocale<'content-studio'>;
/**
 * Render the picker modal; null while no picker session is open.
 * @param props - the injected controller and the locale seat.
 * @returns the modal element tree, or null.
 */
export declare function TemplatePickerModal({ templates, t }: TemplatePickerModalProps): import("react").JSX.Element | null;
//# sourceMappingURL=TemplatePickerModal.d.ts.map