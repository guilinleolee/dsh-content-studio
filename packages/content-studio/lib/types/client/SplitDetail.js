import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import css from './SplitDetail.module.css';
/**
 * Render the two-pane master-detail layout.
 * @param props - the list pane, the detail pane, and the detail label.
 * @returns the split layout element tree.
 */
export function SplitDetail({ list, detail, detailLabel }) {
    return (_jsxs("div", { className: css.split, children: [_jsx("div", { className: css.listPane, children: list }), _jsx("section", { className: css.detailPane, "aria-label": detailLabel, children: detail })] }));
}
//# sourceMappingURL=SplitDetail.js.map