/**
 * Reusable left-list + right-detail layout for workbench views that browse
 * one collection of items (the gather material library now; the topic-bank
 * side panel later). The component owns only the two-pane geometry — list
 * content, selection state, and detail content stay with the caller, so
 * both views render their own cards and panels through the same seam.
 */
import type { ReactNode } from 'react'
import css from './SplitDetail.module.css'

/** Props of the split layout: the two panes and the detail region's label. */
export interface SplitDetailProps {
  /** Left pane: the scrollable item list (filters, cards). */
  readonly list: ReactNode
  /** Right pane: the detail surface for the current selection. */
  readonly detail: ReactNode
  /** Accessible name of the detail region (its content varies by selection). */
  readonly detailLabel: string
}

/**
 * Render the two-pane master-detail layout.
 * @param props - the list pane, the detail pane, and the detail label.
 * @returns the split layout element tree.
 */
export function SplitDetail({ list, detail, detailLabel }: SplitDetailProps) {
  return (
    <div className={css.split}>
      <div className={css.listPane}>{list}</div>
      <section className={css.detailPane} aria-label={detailLabel}>
        {detail}
      </section>
    </div>
  )
}
