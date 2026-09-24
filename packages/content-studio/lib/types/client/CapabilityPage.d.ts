import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { CapabilityItem } from './capabilities.ts';
/** Props: the slice of capability ids, this page's title, and copy state. */
export type CapabilityPageProps = {
    title: string;
    ids: readonly CapabilityItem['id'][];
    copiedId: string | undefined;
    pick: (item: CapabilityItem) => void;
} & PropsLocale<'content-studio'>;
/**
 * Render one capability page.
 * @param props - ids, title, copy state, and the locale seat.
 * @returns the page element tree.
 */
export declare function CapabilityPage({ title, ids, copiedId, pick, t }: CapabilityPageProps): import("react").JSX.Element;
//# sourceMappingURL=CapabilityPage.d.ts.map