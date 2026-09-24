import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
/** Props: the controlled account state and mutators, plus the locale seat. */
export type AccountsViewProps = {
    account: string;
    accounts: readonly string[];
    onSelect: (account: string) => void;
    onAdd: (account: string) => void;
    onRemove: (account: string) => void;
} & PropsLocale<'content-studio'>;
/**
 * Render the accounts management page.
 * @param props - controlled state, mutators, and the locale seat.
 * @returns the page element tree.
 */
export declare function AccountsView({ account, accounts, onSelect, onAdd, onRemove, t }: AccountsViewProps): import("react").JSX.Element;
//# sourceMappingURL=AccountsView.d.ts.map