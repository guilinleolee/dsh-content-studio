import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The publish view: the manuscript pool on the left of the create flow, the
 * platform-matrix task builder, the per-platform AI adaptation board with
 * append-only attempt logs, the record handoff that freezes the phase-2 MCP
 * package, the global history list, and the topic reflow. Orchestration
 * only — task logic lives in the pure `model.ts` and the controller.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { clsx } from 'clsx';
import { PLATFORM_PROFILES, exceedsCharLimit, formatTags, platformProfileOf } from "./publish/model.js";
import css from './PublishView.module.css';
/** Status → its badge modifier class. */
const STATUS_CLASS = {
    draft: css.badgeDraft ?? '',
    pendingReview: css.badgeReview ?? '',
    scheduled: css.badgeScheduled ?? '',
    recorded: css.badgeRecorded ?? '',
};
/** Platform-leg status → its badge modifier class. */
const LEG_STATUS_CLASS = {
    pending: css.badgeDraft ?? '',
    adapted: css.badgeReview ?? '',
    edited: css.badgeScheduled ?? '',
    recorded: css.badgeRecorded ?? '',
};
/** Whether the locale key exists in the publish notice family. */
const NOTICE_KEYS = [
    'profiles-saved', 'profiles-failed', 'task-created', 'task-create-failed', 'adapt-done', 'adapt-failed',
    'draft-saved', 'draft-save-failed', 'recorded', 'record-failed', 'scheduled', 'schedule-failed',
    'task-deleted', 'task-deleted-schedule-stale', 'delete-failed', 'copied', 'reflowed', 'reflow-orphan', 'reflow-failed', 'due-tasks', 'load-failed',
];
/**
 * Render the publish view.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export function PublishView({ publish, persona, pickedManuscript, onClearPickedManuscript, t }) {
    const state = useSyncExternalStore(listener => publish.subscribe(listener), () => publish.getState());
    const [tab, setTab] = useState('tasks');
    const [showProfiles, setShowProfiles] = useState(false);
    const [form, setForm] = useState(null);
    const [draftEdit, setDraftEdit] = useState(null);
    const [profileDraft, setProfileDraft] = useState(state.profiles);
    const [scheduleInputs, setScheduleInputs] = useState({ date: '', time: '09:00' });
    useEffect(() => { void publish.init(); }, [publish]);
    // A create-view handoff opens the form prefilled once.
    useEffect(() => {
        if (pickedManuscript === null)
            return;
        setTab('tasks');
        setForm({
            theme: pickedManuscript.theme,
            file: pickedManuscript.file,
            title: pickedManuscript.title,
            platformIds: [],
            mode: 'immediate',
            scheduledLocal: '',
            note: '',
            topicId: pickedManuscript.topicId ?? null,
        });
        onClearPickedManuscript();
    }, [pickedManuscript, onClearPickedManuscript]);
    // Keep the profile editor draft aligned when the stored cards load.
    useEffect(() => {
        setProfileDraft(state.profiles);
    }, [state.profiles]);
    const openTask = state.tasks.find(task => task.taskId === state.openTaskId) ?? null;
    const startFormFrom = (card) => {
        setForm({
            theme: card.theme, file: card.file, title: card.title,
            platformIds: [], mode: 'immediate', scheduledLocal: '', note: '',
            topicId: card.topicId,
        });
    };
    const submitForm = async () => {
        if (form === null)
            return;
        const scheduledAt = form.mode === 'scheduled' && form.scheduledLocal.length > 0
            ? new Date(form.scheduledLocal).toISOString()
            : null;
        await publish.createTask({
            manuscript: { theme: form.theme, file: form.file, title: form.title },
            platformIds: form.platformIds,
            mode: form.mode,
            scheduledAt,
            note: form.note.trim().length > 0 ? form.note.trim() : null,
            topicId: form.topicId,
            personaDigest: persona.trim().length > 0 ? persona.trim().slice(0, 500) : null,
            manuscriptId: null,
        });
        setTab('tasks');
        setForm(null);
    };
    const togglePlatform = (platformId) => {
        setForm(current => current === null ? current : {
            ...current,
            platformIds: current.platformIds.includes(platformId)
                ? current.platformIds.filter(candidate => candidate !== platformId)
                : [...current.platformIds, platformId],
        });
    };
    const openHistoryRow = async (theme, taskId) => {
        await publish.openTheme(theme);
        publish.selectTask(taskId);
        setTab('tasks');
    };
    return (_jsxs("div", { className: css.view, children: [_jsxs("header", { className: css.head, children: [_jsxs("div", { children: [_jsx("h2", { className: css.title, children: t('publish.title') }), _jsx("p", { className: css.hint, children: t('publish.hint') })] }), _jsx("div", { className: css.headActions, children: _jsx("button", { type: "button", className: css.ghost, onClick: () => { setShowProfiles(current => !current); }, children: t('publish.profiles.toggle') }) })] }), state.notice !== null && NOTICE_KEYS.includes(state.notice) && (_jsxs("div", { className: clsx(css.notice, state.notice.endsWith('failed') || state.notice === 'load-failed' ? css.noticeWarn : css.noticeOk), role: "status", children: [_jsx("span", { children: t(`publish.notice.${state.notice}`) }), state.error !== null && _jsx("span", { className: css.noticeDetail, children: state.error }), _jsx("button", { type: "button", className: css.mini, onClick: () => { publish.clearNotice(); }, children: t('publish.notice.dismiss') })] })), showProfiles && (_jsxs("section", { className: css.profiles, "aria-label": t('publish.profiles.title'), children: [_jsx("h3", { className: css.sectionTitle, children: t('publish.profiles.title') }), _jsx("p", { className: css.hint, children: t('publish.profiles.hint') }), _jsx("div", { className: css.profileGrid, children: PLATFORM_PROFILES.map((profile) => {
                            const stored = profileDraft.find(candidate => candidate.platformId === profile.platformId);
                            return (_jsxs("div", { className: css.profileCard, children: [_jsxs("label", { className: css.profileHead, children: [_jsx("input", { type: "checkbox", checked: stored?.enabled ?? false, onChange: (event) => {
                                                    const enabled = event.target.checked;
                                                    setProfileDraft((current) => {
                                                        const base = current.some(candidate => candidate.platformId === profile.platformId)
                                                            ? current
                                                            : [...current, {
                                                                    platformId: profile.platformId, alias: profile.name,
                                                                    enabled: false, adaptationOverrides: null,
                                                                }];
                                                        return base.map(candidate => candidate.platformId === profile.platformId ? { ...candidate, enabled } : candidate);
                                                    });
                                                } }), _jsx("span", { children: profile.name })] }), _jsx("input", { type: "text", className: css.aliasInput, placeholder: t('publish.profiles.alias'), value: stored?.alias ?? '', onChange: (event) => {
                                            const alias = event.target.value;
                                            setProfileDraft(current => current.map(candidate => candidate.platformId === profile.platformId ? { ...candidate, alias } : candidate));
                                        } }), _jsx("textarea", { className: css.overrideInput, placeholder: t('publish.profiles.overrides'), value: stored?.adaptationOverrides ?? '', onChange: (event) => {
                                            const adaptationOverrides = event.target.value;
                                            setProfileDraft(current => current.map(candidate => candidate.platformId === profile.platformId ? { ...candidate, adaptationOverrides } : candidate));
                                        } })] }, profile.platformId));
                        }) }), _jsxs("div", { className: css.profilesActions, children: [_jsx("button", { type: "button", className: css.primary, onClick: () => { void publish.saveProfiles(profileDraft); }, children: t('publish.profiles.save') }), _jsx("button", { type: "button", className: css.ghost, onClick: () => { setShowProfiles(false); }, children: t('publish.profiles.close') })] })] })), _jsxs("nav", { className: css.tabs, role: "tablist", children: [_jsx("button", { type: "button", role: "tab", "aria-selected": tab === 'tasks', className: clsx(css.tab, tab === 'tasks' && css.tabActive), onClick: () => { setTab('tasks'); }, children: t('publish.tab.tasks') }), _jsx("button", { type: "button", role: "tab", "aria-selected": tab === 'history', className: clsx(css.tab, tab === 'history' && css.tabActive), onClick: () => { setTab('history'); }, children: t('publish.tab.history') })] }), tab === 'tasks' && (_jsxs("div", { className: css.columns, children: [_jsxs("aside", { className: css.taskList, "aria-label": t('publish.tab.tasks'), children: [state.theme === null && _jsx("p", { className: css.empty, children: t('publish.theme.none') }), state.tasks.length === 0 && state.theme !== null && _jsx("p", { className: css.empty, children: t('publish.tasks.empty') }), state.tasks.map(task => (_jsxs("button", { type: "button", className: clsx(css.taskItem, task.taskId === state.openTaskId && css.taskItemActive), onClick: () => { publish.selectTask(task.taskId); }, children: [_jsx("span", { className: css.taskItemTitle, children: task.title }), _jsx("span", { className: clsx(css.badge, STATUS_CLASS[task.status]), children: t(`publish.status.${task.status}`) })] }, task.taskId)))] }), _jsxs("div", { className: css.main, children: [state.manifestProblems.length > 0 && (_jsx("p", { className: css.problem, children: t('publish.problems').replace('{list}', state.manifestProblems.join('；')) })), form === null && openTask === null && (_jsxs("section", { className: css.pool, "aria-label": t('publish.pool.title'), children: [_jsx("h3", { className: css.sectionTitle, children: t('publish.pool.title') }), _jsx("p", { className: css.hint, children: t('publish.pool.hint') }), state.manuscripts.length === 0 && _jsx("p", { className: css.empty, children: t('publish.pool.empty') }), _jsx("div", { className: css.poolGrid, children: state.manuscripts.map(card => (_jsxs("button", { type: "button", className: css.poolCard, onClick: () => { startFormFrom(card); }, children: [_jsx("span", { className: css.poolTitle, children: card.title }), _jsxs("span", { className: css.poolMeta, children: [card.theme, "/", card.file] })] }, `${card.theme}/${card.file}`))) })] })), form !== null && (_jsxs("section", { className: css.form, "aria-label": t('publish.form.title'), children: [_jsx("h3", { className: css.sectionTitle, children: t('publish.form.title') }), _jsxs("p", { className: css.formManuscript, children: [form.title, _jsxs("span", { className: css.formMeta, children: [form.theme, "/", form.file] })] }), _jsx("div", { className: css.platformGrid, children: PLATFORM_PROFILES.map((profile) => {
                                            const card = state.profiles.find(candidate => candidate.platformId === profile.platformId);
                                            const checked = form.platformIds.includes(profile.platformId);
                                            return (_jsxs("label", { className: clsx(css.platformCard, checked && css.platformCardActive, card?.enabled === false && css.platformCardOff), children: [_jsx("input", { type: "checkbox", checked: checked, onChange: () => { togglePlatform(profile.platformId); } }), _jsx("span", { className: css.platformName, children: profile.name }), _jsx("span", { className: css.platformMeta, children: card?.alias ?? profile.name })] }, profile.platformId));
                                        }) }), _jsxs("div", { className: css.formRow, children: [_jsxs("label", { className: css.formLabel, children: [_jsx("input", { type: "radio", name: "publish-mode", checked: form.mode === 'immediate', onChange: () => { setForm({ ...form, mode: 'immediate' }); } }), t('publish.form.immediate')] }), _jsxs("label", { className: css.formLabel, children: [_jsx("input", { type: "radio", name: "publish-mode", checked: form.mode === 'scheduled', onChange: () => { setForm({ ...form, mode: 'scheduled' }); } }), t('publish.form.scheduled')] }), form.mode === 'scheduled' && (_jsx("input", { type: "datetime-local", className: css.input, value: form.scheduledLocal, onChange: (event) => { setForm({ ...form, scheduledLocal: event.target.value }); } }))] }), _jsx("textarea", { className: css.noteInput, placeholder: t('publish.form.note'), value: form.note, onChange: (event) => { setForm({ ...form, note: event.target.value }); } }), _jsxs("p", { className: css.hint, children: [t('publish.form.persona'), persona.trim().length > 0 ? t('publish.form.personaOn') : t('publish.form.personaOff')] }), _jsxs("div", { className: css.formActions, children: [_jsx("button", { type: "button", className: css.primary, disabled: form.platformIds.length === 0, onClick: () => { void submitForm(); }, children: t('publish.form.submit') }), _jsx("button", { type: "button", className: css.ghost, onClick: () => { setForm(null); }, children: t('publish.form.cancel') })] })] })), form === null && openTask !== null && (_jsx(TaskDetail, { task: openTask, state: state, publish: publish, draftEdit: draftEdit, setDraftEdit: setDraftEdit, scheduleInputs: scheduleInputs, setScheduleInputs: setScheduleInputs, t: t }))] })] })), tab === 'history' && (_jsxs("section", { className: css.history, "aria-label": t('publish.tab.history'), children: [state.indexProblems.length > 0 && (_jsx("p", { className: css.problem, children: t('publish.problems').replace('{list}', state.indexProblems.join('；')) })), state.index.length === 0 && _jsx("p", { className: css.empty, children: t('publish.history.empty') }), _jsxs("table", { className: css.historyTable, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: t('publish.history.task') }), _jsx("th", { children: t('publish.history.theme') }), _jsx("th", { children: t('publish.history.platforms') }), _jsx("th", { children: t('publish.history.status') }), _jsx("th", { children: t('publish.history.updated') }), _jsx("th", { "aria-label": t('publish.history.actions') })] }) }), _jsx("tbody", { children: [...state.index].reverse().map(entry => (_jsxs("tr", { children: [_jsx("td", { children: entry.title }), _jsx("td", { children: entry.theme }), _jsx("td", { children: entry.platformIds.map(id => platformProfileOf(id)?.name ?? id).join('、') }), _jsx("td", { children: _jsx("span", { className: clsx(css.badge, STATUS_CLASS[entry.status]), children: t(`publish.status.${entry.status}`) }) }), _jsx("td", { children: entry.updatedAt.slice(0, 16).replace('T', ' ') }), _jsx("td", { children: _jsx("button", { type: "button", className: css.mini, onClick: () => { void openHistoryRow(entry.theme, entry.taskId); }, children: t('publish.history.open') }) })] }, `${entry.theme}/${entry.taskId}`))) })] })] }))] }));
}
/**
 * Render one open task: the fact header, the platform legs with their
 * adaptation/edit/log surfaces, and the task-level actions.
 */
function TaskDetail({ task, state, publish, draftEdit, setDraftEdit, scheduleInputs, setScheduleInputs, t }) {
    const isRecorded = task.status === 'recorded';
    return (_jsxs("section", { className: css.detail, "aria-label": task.title, children: [_jsxs("header", { className: css.detailHead, children: [_jsx("h3", { className: css.sectionTitle, children: task.title }), _jsx("span", { className: clsx(css.badge, STATUS_CLASS[task.status]), children: t(`publish.status.${task.status}`) })] }), _jsxs("p", { className: css.facts, children: [_jsxs("span", { children: [t('publish.fact.manuscript'), task.manuscriptFile] }), task.topicId !== null && _jsxs("span", { children: [t('publish.fact.topic'), task.topicId] }), task.scheduledAt !== null && _jsxs("span", { children: [t('publish.fact.scheduledAt'), task.scheduledAt.slice(0, 16).replace('T', ' ')] }), task.note !== null && _jsxs("span", { children: [t('publish.fact.note'), task.note] })] }), !isRecorded && (_jsxs("div", { className: css.detailActions, children: [_jsx("button", { type: "button", className: css.primary, disabled: task.platforms.every(leg => leg.status !== 'pending'), onClick: () => {
                            void (async () => {
                                for (const leg of task.platforms) {
                                    if (leg.status === 'pending')
                                        await publish.adaptPlatform(task.taskId, leg.platformId);
                                }
                            })();
                        }, children: t('publish.action.preview') }), _jsx("button", { type: "button", className: css.primary, disabled: state.recording, onClick: () => { void publish.recordTask(task.taskId); }, children: t('publish.action.record') }), task.mode === 'scheduled' && task.scheduleItemId === null && (_jsxs("span", { className: css.scheduleRow, children: [_jsx("input", { type: "date", className: css.input, value: scheduleInputs.date, onChange: (event) => { setScheduleInputs({ ...scheduleInputs, date: event.target.value }); } }), _jsx("input", { type: "time", className: css.input, value: scheduleInputs.time, onChange: (event) => { setScheduleInputs({ ...scheduleInputs, time: event.target.value }); } }), _jsx("button", { type: "button", className: css.ghost, disabled: scheduleInputs.date.length === 0, onClick: () => { void publish.scheduleTask(task.taskId, scheduleInputs.date, scheduleInputs.time); }, children: t('publish.action.schedule') })] })), _jsx("button", { type: "button", className: css.ghost, onClick: () => { void publish.copyTask(task.taskId); }, children: t('publish.action.copy') }), _jsx("button", { type: "button", className: css.danger, onClick: () => {
                            if (!window.confirm(t('publish.action.deleteConfirm')))
                                return;
                            void publish.deleteTask(task.taskId);
                        }, children: t('publish.action.delete') })] })), isRecorded && (_jsxs("div", { className: css.detailActions, children: [_jsx("p", { className: css.recordedNote, children: t('publish.recorded.note') }), task.topicId !== null && (_jsx("button", { type: "button", className: css.primary, onClick: () => { void publish.reflowTask(task.taskId); }, children: t('publish.action.reflow') }))] })), _jsx("div", { className: css.legGrid, children: task.platforms.map((leg) => {
                    const profile = platformProfileOf(leg.platformId);
                    const busy = state.busyPlatforms[`${task.taskId}:${leg.platformId}`] === true;
                    const editing = draftEdit !== null && draftEdit.taskId === task.taskId && draftEdit.platformId === leg.platformId;
                    return (_jsxs("div", { className: css.legCard, children: [_jsxs("header", { className: css.legHead, children: [_jsx("span", { className: css.platformName, children: profile?.name ?? leg.platformId }), _jsx("span", { className: css.platformMeta, children: leg.accountAlias }), _jsx("span", { className: clsx(css.badge, LEG_STATUS_CLASS[leg.status]), children: t(`publish.leg.${leg.status}`) })] }), leg.coverPrompt !== null && _jsxs("p", { className: css.legCover, children: [t('publish.leg.cover'), leg.coverPrompt] }), leg.tags.length > 0 && profile !== undefined && (_jsx("p", { className: css.legTags, children: formatTags(leg.tags, profile.tagStyle) })), _jsxs("div", { className: css.legActions, children: [_jsx("button", { type: "button", className: css.mini, disabled: busy, onClick: () => { void publish.adaptPlatform(task.taskId, leg.platformId); }, children: leg.status === 'pending' ? t('publish.leg.adapt') : t('publish.leg.readapt') }), !editing && (_jsx("button", { type: "button", className: css.mini, onClick: () => {
                                            void (async () => {
                                                const content = await publish.loadDraft(task.taskId, leg.platformId);
                                                setDraftEdit({ taskId: task.taskId, platformId: leg.platformId, content: content ?? '' });
                                            })();
                                        }, children: t('publish.leg.edit') }))] }), editing && (_jsxs("div", { className: css.editBlock, children: [_jsx("textarea", { className: css.editArea, value: draftEdit.content, onChange: (event) => { setDraftEdit({ ...draftEdit, content: event.target.value }); } }), exceedsCharLimit(draftEdit.content, profile?.charLimit ?? null) && (_jsx("p", { className: css.problem, children: t('publish.leg.overLimit') })), _jsxs("div", { className: css.editActions, children: [_jsx("button", { type: "button", className: css.primary, onClick: () => {
                                                    void (async () => {
                                                        await publish.saveDraftEdit(task.taskId, leg.platformId, draftEdit.content);
                                                        setDraftEdit(null);
                                                    })();
                                                }, children: t('publish.leg.save') }), _jsx("button", { type: "button", className: css.ghost, onClick: () => { setDraftEdit(null); }, children: t('publish.leg.cancel') })] })] })), leg.attempts.length > 0 && (_jsxs("details", { className: css.logBox, children: [_jsx("summary", { children: t('publish.leg.log').replace('{count}', String(leg.attempts.length)) }), _jsx("ul", { className: css.logList, children: [...leg.attempts].reverse().map((attempt, index) => (_jsxs("li", { className: attempt.ok ? css.logOk : css.logFail, children: [attempt.at.slice(11, 19), " ", t(`publish.attempt.${attempt.action}`), " \u2014 ", attempt.detail] }, `${attempt.at}-${index}`))) })] }))] }, leg.platformId));
                }) })] }));
}
//# sourceMappingURL=PublishView.js.map