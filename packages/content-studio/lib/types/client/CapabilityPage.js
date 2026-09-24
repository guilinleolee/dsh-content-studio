import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * A capability page: one titled grid of capability cards for a nav view that
 * fronts a slice of the catalog (对标 / 选题). Pick = copy the instruction.
 */
import { clsx } from 'clsx';
import { CAPABILITY_ITEMS } from "./capabilities.js";
import css from './ContentStudio.module.css';
/**
 * Render one capability page.
 * @param props - ids, title, copy state, and the locale seat.
 * @returns the page element tree.
 */
export function CapabilityPage({ title, ids, copiedId, pick, t }) {
    const items = ids.map(id => CAPABILITY_ITEMS.find(item => item.id === id)).filter(item => item !== undefined);
    return (_jsxs("div", { className: css.workbench, children: [_jsx("h2", { className: css.pageTitle, children: title }), _jsx("div", { className: css.grid, children: items.map((item) => {
                    const copied = copiedId === item.id;
                    return (_jsxs("button", { type: "button", className: clsx(css.card, copied && css.cardCopied), onClick: () => { pick(item); }, children: [_jsxs("span", { className: css.cardHead, children: [_jsx("span", { className: css.cardTitle, children: t(`cap.${item.id}.title`) }), _jsx("span", { className: clsx(css.badge, css.badgeReady), children: t('badge.ready') })] }), _jsx("span", { className: css.cardDetail, children: t(`cap.${item.id}.detail`) }), _jsx("span", { className: clsx(css.cardHint, copied && css.cardHintCopied), children: copied ? t('card.copied') : t('card.copyHint') })] }, item.id));
                }) })] }));
}
//# sourceMappingURL=CapabilityPage.js.map