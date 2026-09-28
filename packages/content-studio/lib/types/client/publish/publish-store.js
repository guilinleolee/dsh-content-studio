/**
 * The publish view controller: one observable state object over the publish
 * faces of the content-outputs Remote (theme-side `_publish.json` manifests,
 * the global index, the account cards, derived drafts, and the per-platform
 * AI adaptation), plus the calendar and topic-bank faces for the scheduling
 * and reflow handoffs. Every AI call is explicit; a per-platform failure
 * never blocks the other legs; task retries append attempt entries and never
 * rewrite the logged history.
 */
import { dueScheduledTasks, manuscriptCards, platformProfileOf, withAttempt, withPlatform, withStatus, } from "./model.js";
/**
 * Create the publish controller.
 * @param deps - the gateway plus the library, calendar, and topic faces.
 * @returns the controller with an idle state.
 */
export function createPublishController(deps) {
    const { gateway, listOutputs, schedule, topics } = deps;
    let state = {
        loading: false,
        manuscripts: [],
        profiles: [],
        profileProblems: [],
        index: [],
        indexProblems: [],
        theme: null,
        tasks: [],
        manifestProblems: [],
        openTaskId: null,
        busyPlatforms: {},
        recording: false,
        notice: null,
        error: null,
    };
    const listeners = new Set();
    const emit = () => {
        for (const listener of listeners)
            listener();
    };
    const set = (patch) => {
        state = { ...state, ...patch };
        emit();
    };
    const fail = (notice, cause) => {
        set({ notice, error: cause instanceof Error ? cause.message : String(cause) });
    };
    const taskOf = (taskId) => state.tasks.find(task => task.taskId === taskId);
    /** Persist one task back into the theme manifest (read-modify-write). */
    const persistTask = async (theme, next) => {
        const { manifest } = await gateway.readPublishManifest(theme);
        const tasks = (manifest?.tasks ?? []).map(task => task.taskId === next.taskId ? next : task);
        await gateway.writePublishManifest(theme, { formatVersion: 0, tasks });
        set({ tasks });
    };
    const loadIndex = async () => {
        try {
            const read = await gateway.listPublishIndex();
            set({ index: read.index.entries, indexProblems: read.problems });
        }
        catch (cause) {
            fail('load-failed', cause);
        }
    };
    const loadProfiles = async () => {
        try {
            const read = await gateway.readPublishProfiles();
            set({ profiles: read.profiles, profileProblems: read.problems });
        }
        catch (cause) {
            fail('load-failed', cause);
        }
    };
    const loadManuscripts = async () => {
        try {
            const snapshot = await listOutputs();
            set({ manuscripts: manuscriptCards(snapshot.projects) });
        }
        catch (cause) {
            fail('load-failed', cause);
        }
    };
    /** One alias per platform: the stored card, or the platform's own name. */
    const aliasFor = (platformId) => state.profiles.find(profile => profile.platformId === platformId && profile.enabled)?.alias
        ?? platformProfileOf(platformId)?.name
        ?? platformId;
    const controller = {
        subscribe(listener) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        getState: () => state,
        async init() {
            set({ loading: true });
            await Promise.all([loadIndex(), loadProfiles(), loadManuscripts()]);
            set({ loading: false });
        },
        async refresh() {
            await Promise.all([loadIndex(), loadProfiles(), loadManuscripts(),
                state.theme === null ? Promise.resolve() : controller.openTheme(state.theme)]);
        },
        async saveProfiles(profiles) {
            try {
                await gateway.writePublishProfiles(profiles);
                set({ profiles, notice: 'profiles-saved', error: null });
            }
            catch (cause) {
                fail('profiles-failed', cause);
            }
        },
        async openTheme(theme) {
            try {
                const read = await gateway.readPublishManifest(theme);
                const tasks = read.manifest?.tasks ?? [];
                const due = dueScheduledTasks(tasks, new Date());
                set({
                    theme, tasks, manifestProblems: read.problems,
                    openTaskId: state.openTaskId !== null && tasks.some(task => task.taskId === state.openTaskId)
                        ? state.openTaskId
                        : tasks.length > 0 ? tasks[tasks.length - 1]?.taskId ?? null : null,
                    notice: due.length > 0 ? 'due-tasks' : state.notice,
                });
            }
            catch (cause) {
                fail('load-failed', cause);
            }
        },
        selectTask(taskId) {
            set({ openTaskId: taskId });
        },
        async createTask(input) {
            if (input.platformIds.length === 0) {
                set({ notice: 'task-create-failed', error: null });
                return;
            }
            const now = new Date().toISOString();
            const taskId = crypto.randomUUID();
            const task = {
                taskId,
                title: input.manuscript.title,
                manuscriptFile: input.manuscript.file,
                manuscriptId: input.manuscriptId,
                topicId: input.topicId,
                personaDigest: input.personaDigest,
                mode: input.mode,
                scheduledAt: input.scheduledAt,
                scheduleItemId: null,
                status: 'pendingReview',
                note: input.note,
                platforms: input.platformIds.map(platformId => ({
                    platformId,
                    accountAlias: aliasFor(platformId),
                    contentFile: `${platformId}.md`,
                    coverPrompt: null,
                    tags: [],
                    status: 'pending',
                    attempts: [],
                })),
                createdAt: now,
                updatedAt: now,
            };
            try {
                const { manifest } = await gateway.readPublishManifest(input.manuscript.theme);
                await gateway.writePublishManifest(input.manuscript.theme, {
                    formatVersion: 0,
                    tasks: [...(manifest?.tasks ?? []), task],
                });
                await controller.openTheme(input.manuscript.theme);
                set({ openTaskId: taskId, notice: 'task-created', error: null });
            }
            catch (cause) {
                fail('task-create-failed', cause);
            }
        },
        async adaptPlatform(taskId, platformId) {
            const task = taskOf(taskId);
            const theme = state.theme;
            if (task === undefined || theme === null)
                return;
            const profile = platformProfileOf(platformId);
            if (profile === undefined) {
                set({ notice: 'adapt-failed', error: `unknown platform ${platformId}` });
                return;
            }
            const key = `${taskId}:${platformId}`;
            set({ busyPlatforms: { ...state.busyPlatforms, [key]: true } });
            try {
                const source = await gateway.readPublishSource(theme, task.manuscriptFile);
                if (source.content === undefined)
                    throw new Error(`manuscript ${task.manuscriptFile} is unreadable`);
                const overrides = state.profiles.find(card => card.platformId === platformId)?.adaptationOverrides ?? null;
                const result = await gateway.adaptPublishContent({
                    platformId,
                    platformName: profile.name,
                    styleHints: overrides === null ? profile.styleHints : `${profile.styleHints} 用户附加要求：${overrides}`,
                    charLimit: profile.charLimit,
                    title: task.title,
                    sourceText: source.content,
                    personaDigest: task.personaDigest,
                });
                await gateway.writePublishDerived(theme, taskId, platformId, result.content);
                const leg = task.platforms.find(candidate => candidate.platformId === platformId);
                if (leg === undefined)
                    throw new Error(`platform leg ${platformId} is missing`);
                const at = new Date().toISOString();
                const logged = withAttempt({ ...leg, coverPrompt: result.coverPrompt, tags: result.tags, status: 'adapted' }, 'adapt', true, `适配完成（${result.model}）`, at);
                await persistTask(theme, withPlatform(task, platformId, logged, at));
                set({ notice: 'adapt-done', error: null });
            }
            catch (cause) {
                // Failure isolation: only this leg logs the failed attempt.
                const at = new Date().toISOString();
                const leg = task.platforms.find(candidate => candidate.platformId === platformId);
                if (leg !== undefined) {
                    try {
                        const logged = withAttempt(leg, 'adapt', false, cause instanceof Error ? cause.message : String(cause), at);
                        await persistTask(theme, withPlatform(task, platformId, logged, at));
                    }
                    catch { /* the manifest write failing keeps the error visible below */ }
                }
                set({ notice: 'adapt-failed', error: cause instanceof Error ? cause.message : String(cause) });
            }
            finally {
                set({ busyPlatforms: { ...state.busyPlatforms, [key]: false } });
            }
        },
        async saveDraftEdit(taskId, platformId, content) {
            const task = taskOf(taskId);
            const theme = state.theme;
            if (task === undefined || theme === null)
                return;
            try {
                await gateway.writePublishDerived(theme, taskId, platformId, content);
                const leg = task.platforms.find(candidate => candidate.platformId === platformId);
                if (leg === undefined)
                    throw new Error(`platform leg ${platformId} is missing`);
                const at = new Date().toISOString();
                const logged = withAttempt({ ...leg, status: 'edited' }, 'edit', true, '手动修改已保存', at);
                await persistTask(theme, withPlatform(task, platformId, logged, at));
                set({ notice: 'draft-saved', error: null });
            }
            catch (cause) {
                fail('draft-save-failed', cause);
            }
        },
        async loadDraft(taskId, platformId) {
            const theme = state.theme;
            if (theme === null)
                return null;
            try {
                const read = await gateway.readPublishDerived(theme, taskId, platformId);
                return read.content ?? null;
            }
            catch {
                return null;
            }
        },
        async recordTask(taskId) {
            const task = taskOf(taskId);
            const theme = state.theme;
            if (task === undefined || theme === null)
                return;
            set({ recording: true });
            try {
                const taskPackage = await gateway.buildPublishPackage(theme, taskId);
                const at = new Date().toISOString();
                let next = withStatus(task, 'recorded', at);
                for (const leg of task.platforms) {
                    const logged = withAttempt({ ...leg, status: 'recorded' }, 'record', true, `发布包已生成（${taskPackage.platforms.length} 个平台）；发布通道未接入，等待二期 MCP`, at);
                    next = withPlatform(next, leg.platformId, logged, at);
                }
                await persistTask(theme, next);
                set({ notice: 'recorded', error: null, recording: false });
            }
            catch (cause) {
                set({ recording: false });
                fail('record-failed', cause);
            }
        },
        async scheduleTask(taskId, date, time) {
            const task = taskOf(taskId);
            const theme = state.theme;
            if (task === undefined || theme === null)
                return;
            try {
                // The task owns its calendar projection: reuse the linked entry's id so
                // a reschedule upserts in place instead of orphaning the previous entry.
                const scheduleItemId = (task.scheduleItemId ?? crypto.randomUUID());
                const snapshot = await schedule.put({
                    id: scheduleItemId,
                    title: task.title,
                    date,
                    time,
                    platform: task.platforms.map(leg => leg.platformId).join(','),
                    status: 'scheduled',
                    kind: 'content',
                    topic: theme,
                    url: null,
                });
                const entry = snapshot.items.find(candidate => candidate.id === scheduleItemId);
                const scheduledAt = new Date(`${date}T${time ?? '09:00'}:00`).toISOString();
                await persistTask(theme, {
                    ...task,
                    mode: 'scheduled',
                    scheduledAt,
                    scheduleItemId: entry?.id ?? null,
                    updatedAt: new Date().toISOString(),
                });
                set({ notice: 'scheduled', error: null });
            }
            catch (cause) {
                fail('schedule-failed', cause);
            }
        },
        async deleteTask(taskId) {
            const theme = state.theme;
            if (theme === null)
                return;
            try {
                const { manifest } = await gateway.readPublishManifest(theme);
                const task = manifest?.tasks.find(candidate => candidate.taskId === taskId);
                // A failed calendar cascade must not roll back the task deletion; the
                // leftover entry is surfaced through the notice instead of swallowed.
                let scheduleStale = false;
                if (task?.scheduleItemId != null) {
                    try {
                        await schedule.remove(task.scheduleItemId);
                    }
                    catch {
                        scheduleStale = true;
                    }
                }
                await gateway.writePublishManifest(theme, {
                    formatVersion: 0,
                    tasks: (manifest?.tasks ?? []).filter(candidate => candidate.taskId !== taskId),
                });
                const read = await gateway.listPublishIndex();
                set({
                    tasks: (manifest?.tasks ?? []).filter(candidate => candidate.taskId !== taskId),
                    index: read.index.entries,
                    openTaskId: state.openTaskId === taskId ? null : state.openTaskId,
                    notice: scheduleStale ? 'task-deleted-schedule-stale' : 'task-deleted', error: null,
                });
            }
            catch (cause) {
                fail('delete-failed', cause);
            }
        },
        async copyTask(taskId) {
            const task = taskOf(taskId);
            const theme = state.theme;
            if (task === undefined || theme === null)
                return;
            const now = new Date().toISOString();
            const fresh = {
                ...task,
                taskId: crypto.randomUUID(),
                mode: 'immediate',
                scheduledAt: null,
                scheduleItemId: null,
                status: 'pendingReview',
                platforms: task.platforms.map(leg => ({
                    ...leg,
                    status: 'pending',
                    attempts: [],
                })),
                createdAt: now,
                updatedAt: now,
            };
            try {
                const { manifest } = await gateway.readPublishManifest(theme);
                await gateway.writePublishManifest(theme, { formatVersion: 0, tasks: [...(manifest?.tasks ?? []), fresh] });
                await controller.openTheme(theme);
                set({ openTaskId: fresh.taskId, notice: 'copied', error: null });
            }
            catch (cause) {
                fail('task-create-failed', cause);
            }
        },
        async reflowTask(taskId) {
            const task = taskOf(taskId);
            if (task === undefined || task.topicId === null)
                return;
            try {
                const snapshot = await topics.list();
                const topic = snapshot.items.find(candidate => candidate.id === task.topicId);
                if (topic === undefined) {
                    set({ notice: 'reflow-orphan', error: null });
                    return;
                }
                // Idempotent: an already-done topic skips the write.
                if (topic.status !== 'done')
                    await topics.put({ ...topic, status: 'done' });
                set({ notice: 'reflowed', error: null });
            }
            catch (cause) {
                fail('reflow-failed', cause);
            }
        },
        clearNotice() {
            set({ notice: null, error: null });
        },
    };
    return controller;
}
//# sourceMappingURL=publish-store.js.map