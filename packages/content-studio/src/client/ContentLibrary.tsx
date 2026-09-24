/**
 * The library view: one card per outputs project, read through the
 * `contentOutputs/list` Remote wrapped by the injected face. Loading, error,
 * and empty are first-class states; a project without valid metadata stays
 * visible with a repair hint instead of disappearing.
 */
import { useCallback, useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { IconRefreshOutline14, IconWarningOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ContentOutputsSnapshot, OutputProject, OutputStatus } from '@deepseek-ai/dsh-content-outputs/types'
import css from './ContentStudio.module.css'

/** Injected face of the library view: the Remote list wrapper. */
export interface ContentLibraryInjected {
  listOutputs: () => Promise<ContentOutputsSnapshot>
}

/** Full library props: the injected face plus the locale seat. */
export type ContentLibraryProps = ContentLibraryInjected & PropsLocale<'content-studio'>

/** Status → its badge modifier class. */
const STATUS_CLASS: Record<OutputStatus, string> = {
  draft: css.statusDraft ?? '',
  ready: css.statusReady ?? '',
  published: css.statusPublished ?? '',
}

/**
 * Render the outputs library.
 * @param props - the Remote list wrapper and the locale seat.
 * @returns the library element tree.
 */
export function ContentLibrary({ listOutputs, t }: ContentLibraryProps) {
  const [snapshot, setSnapshot] = useState<ContentOutputsSnapshot | undefined>(undefined)
  const [failed, setFailed] = useState<string | undefined>(undefined)
  const load = useCallback(async (): Promise<void> => {
    setFailed(undefined)
    setSnapshot(undefined)
    try {
      setSnapshot(await listOutputs())
    } catch (error) {
      console.error('[content-studio] contentOutputs/list failed:', error)
      setFailed(error instanceof Error ? error.message : String(error))
    }
  }, [listOutputs])
  useEffect(() => { void load() }, [load])

  if (failed) {
    return (
      <div className={css.libraryState}>
        <IconWarningOutline16 size={16} />
        <span>{t('library.error')}: {failed}</span>
        <button type="button" className={css.retry} onClick={() => { void load() }}>
          <IconRefreshOutline14 size={14} />
          {t('library.retry')}
        </button>
      </div>
    )
  }
  if (snapshot === undefined) {
    return <div className={css.libraryState}>{t('library.loading')}</div>
  }
  if (snapshot.projects.length === 0) {
    return (
      <div className={css.libraryState}>
        <span>{t('library.empty')}</span>
      </div>
    )
  }

  return (
    <div className={css.library}>
      {snapshot.problems.length > 0 && (
        <div className={css.libraryProblems} role="alert">
          <IconWarningOutline16 size={14} />
          <span>{t('library.problems', { n: snapshot.problems.length })}</span>
        </div>
      )}
      <div className={css.grid}>
        {snapshot.projects.map(project => (
          <ProjectCard key={project.topic} project={project} t={t} />
        ))}
      </div>
    </div>
  )
}

/** One outputs project as a read-only card. */
function ProjectCard({ project, t }: { project: OutputProject; t: PropsLocale<'content-studio'>['t'] }) {
  return (
    <div className={css.libraryCard}>
      <span className={css.cardHead}>
        <span className={css.cardTitle}>{project.title}</span>
        <span className={clsx(css.badge, STATUS_CLASS[project.status])}>{t(`status.${project.status}` as const)}</span>
      </span>
      <span className={css.cardDetail}>
        {t(`kind.${project.kind}` as const)}
        {project.platform !== null && ` · ${project.platform}`}
      </span>
      {project.summary !== null && <span className={css.cardDetail}>{project.summary}</span>}
      {project.tags.length > 0 && (
        <span className={css.libraryTags}>
          {project.tags.map(tag => <span key={tag} className={css.libraryTag}>{tag}</span>)}
        </span>
      )}
      <span className={css.cardHint}>
        {project.hasMetadata
          ? t('library.deliverables', { n: project.deliverables.length })
          : t('library.noMetadata')}
        {' · '}
        {t('library.assets', { n: project.assetCount })}
        {' · '}
        {project.updatedAt.slice(0, 10)}
      </span>
    </div>
  )
}
