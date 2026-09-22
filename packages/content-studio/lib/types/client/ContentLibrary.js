import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The library view: one card per outputs project, read through the
 * `contentOutputs/list` Remote wrapped by the injected face. Loading, error,
 * and empty are first-class states; a project without valid metadata stays
 * visible with a repair hint instead of disappearing.
 */
import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { IconRefreshOutline14, IconWarningOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './ContentStudio.module.css';
/** Status → its badge modifier class. */
const STATUS_CLASS = {
    draft: css.statusDraft ?? '',
    ready: css.statusReady ?? '',
    published: css.statusPublished ?? '',
};
/**
 * Render the outputs library.
 * @param props - the Remote list wrapper and the locale seat.
 * @returns the library element tree.
 */
export function ContentLibrary({ listOutputs, t }) {
    const [snapshot, setSnapshot] = useState(undefined);
    const [failed, setFailed] = useState(false);
    const load = useCallback(async () => {
        setFailed(false);
        setSnapshot(undefined);
        try {
            setSnapshot(await listOutputs());
        }
        catch {
            setFailed(true);
        }
    }, [listOutputs]);
    useEffect(() => { void load(); }, [load]);
    if (failed) {
        return (_jsxs("div", { className: css.libraryState, children: [_jsx(IconWarningOutline16, { size: 16 }), _jsx("span", { children: t('library.error') }), _jsxs("button", { type: "button", className: css.retry, onClick: () => { void load(); }, children: [_jsx(IconRefreshOutline14, { size: 14 }), t('library.retry')] })] }));
    }
    if (snapshot === undefined) {
        return _jsx("div", { className: css.libraryState, children: t('library.loading') });
    }
    if (snapshot.projects.length === 0) {
        return (_jsx("div", { className: css.libraryState, children: _jsx("span", { children: t('library.empty') }) }));
    }
    return (_jsxs("div", { className: css.library, children: [snapshot.problems.length > 0 && (_jsxs("div", { className: css.libraryProblems, role: "alert", children: [_jsx(IconWarningOutline16, { size: 14 }), _jsx("span", { children: t('library.problems', { n: snapshot.problems.length }) })] })), _jsx("div", { className: css.grid, children: snapshot.projects.map(project => (_jsx(ProjectCard, { project: project, t: t }, project.topic))) })] }));
}
/** One outputs project as a read-only card. */
function ProjectCard({ project, t }) {
    return (_jsxs("div", { className: css.libraryCard, children: [_jsxs("span", { className: css.cardHead, children: [_jsx("span", { className: css.cardTitle, children: project.title }), _jsx("span", { className: clsx(css.badge, STATUS_CLASS[project.status]), children: t(`status.${project.status}`) })] }), _jsxs("span", { className: css.cardDetail, children: [t(`kind.${project.kind}`), project.platform !== null && ` · ${project.platform}`] }), project.summary !== null && _jsx("span", { className: css.cardDetail, children: project.summary }), project.tags.length > 0 && (_jsx("span", { className: css.libraryTags, children: project.tags.map(tag => _jsx("span", { className: css.libraryTag, children: tag }, tag)) })), _jsxs("span", { className: css.cardHint, children: [project.hasMetadata
                        ? t('library.deliverables', { n: project.deliverables.length })
                        : t('library.noMetadata'), ' · ', t('library.assets', { n: project.assetCount }), ' · ', project.updatedAt.slice(0, 10)] })] }));
}
//# sourceMappingURL=ContentLibrary.js.map