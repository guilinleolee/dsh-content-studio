import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The sidebar entry occupying the `sidebar.footer.action` hole: a labeled
 * row while the column is wide, a 16px icon on the 56px rail. Clicking opens
 * the frame-wide workbench surface through the shared controller.
 */
import { IconSparkle16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './ContentStudio.module.css';
/**
 * Render the Content Studio sidebar entry.
 * @param props - the column state, the shared controller, and the locale seat.
 * @returns the entry button element tree.
 */
export function StudioEntry({ wide, studio, t }) {
    const button = (_jsxs("button", { type: "button", className: wide ? css.entryWide : css.entryRail, "aria-label": t('entry.aria'), onClick: () => { studio.open(); }, children: [_jsx(IconSparkle16, { size: wide ? 16 : 18 }), wide && _jsx("span", { className: css.entryLabel, children: t('entry.label') })] }));
    return wide ? button : _jsx(Tooltip, { label: t('entry.label'), delayMs: 500, children: button });
}
//# sourceMappingURL=StudioEntry.js.map