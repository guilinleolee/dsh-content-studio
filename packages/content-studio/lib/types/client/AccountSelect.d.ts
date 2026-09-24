import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
/** Props: the controlled account list and selection, plus the locale seat. */
export type AccountSelectProps = {
    account: string;
    accounts: readonly string[];
    onSelect: (account: string) => void;
    onAdd: (account: string) => void;
} & PropsLocale<'content-studio'>;
/**
 * Render the account dropdown.
 * @param props - controlled state and the locale seat.
 * @returns the selector element tree.
 */
export declare function AccountSelect({ account, accounts, onSelect, onAdd, t }: AccountSelectProps): import("react").JSX.Element;
//# sourceMappingURL=AccountSelect.d.ts.map