/**
 * A capability page: one titled grid of capability cards for a nav view that
 * fronts a slice of the catalog (对标 / 选题). Pick = copy the instruction.
 */
import { clsx } from 'clsx'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { CapabilityItem } from './capabilities.ts'
import { CAPABILITY_ITEMS } from './capabilities.ts'
import type { StudioKey } from './locales.ts'
import css from './ContentStudio.module.css'

/** Props: the slice of capability ids, this page's title, and copy state. */
export type CapabilityPageProps = {
  title: string
  ids: readonly CapabilityItem['id'][]
  copiedId: string | undefined
  pick: (item: CapabilityItem) => void
} & PropsLocale<'content-studio'>

/**
 * Render one capability page.
 * @param props - ids, title, copy state, and the locale seat.
 * @returns the page element tree.
 */
export function CapabilityPage({ title, ids, copiedId, pick, t }: CapabilityPageProps) {
  const items = ids.map(id => CAPABILITY_ITEMS.find(item => item.id === id)).filter(item => item !== undefined)
  return (
    <div className={css.workbench}>
      <h2 className={css.pageTitle}>{title}</h2>
      <div className={css.grid}>
        {items.map((item) => {
          const copied = copiedId === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={clsx(css.card, copied && css.cardCopied)}
              onClick={() => { pick(item) }}
            >
              <span className={css.cardHead}>
                <span className={css.cardTitle}>{t(`cap.${item.id}.title` as StudioKey)}</span>
                <span className={clsx(css.badge, css.badgeReady)}>
                  {t('badge.ready')}
                </span>
              </span>
              <span className={css.cardDetail}>{t(`cap.${item.id}.detail` as StudioKey)}</span>
              <span className={clsx(css.cardHint, copied && css.cardHintCopied)}>
                {copied ? t('card.copied') : t('card.copyHint')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
