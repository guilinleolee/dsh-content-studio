/**
 * The review view controller: one observable state object over the
 * `_review.json` manifest (via the content-outputs review faces), the
 * two-step import flow (parse preview → confirmed commit), the explicit AI
 * calls (single-work diagnosis, period report with its data-only fallback),
 * the reflow into the topic bank, and the session-scoped filter/diagnosis
 * buffers. Persistent business data (baselines, bindings, snapshots, tasks)
 * lives in the manifest; only filters and in-progress diagnosis ride the
 * browser session.
 */
import { DEFAULT_BASELINES } from "./model.js";
import { aggregateSummary, dataOnlyReport, DIAGNOSE_DRAFT_CHARS, isLongtail, poolSnapshots, rankWorks, selectDigests, verdictOf, } from "./model.js";
/** Browser-local storage key of the session filter set. */
const FILTERS_KEY = 'dsh-content-studio.review.filters';
/** The default session filters: the trailing month. */
function defaultFilters(now) {
    const iso = (date) => date.toISOString().slice(0, 10);
    return {
        version: 1,
        platforms: [],
        contentTypes: [],
        workFilter: 'all',
        period: { from: iso(new Date(now.getTime() - 30 * 86_400_000)), to: iso(now) },
    };
}
/** Load the stored session filters; anything malformed drops back to defaults. */
function loadFilters(now) {
    try {
        const raw = localStorage.getItem(FILTERS_KEY);
        if (raw === null)
            return defaultFilters(now);
        const parsed = JSON.parse(raw);
        if (parsed.version !== 1 || typeof parsed.period?.from !== 'string')
            return defaultFilters(now);
        return parsed;
    }
    catch {
        return defaultFilters(now);
    }
}
/**
 * Create the review controller over the wired gateway and topic face.
 * @param gateway - the review half of the content-outputs Remote.
 * @param topics - the topic-bank write face for the reflow.
 * @returns the controller.
 */
export function createReviewController(gateway, topics) {
    let state = {
        theme: null,
        manifest: null,
        problems: [],
        loading: false,
        busy: false,
        notice: null,
        preview: null,
        ignoredColumns: [],
        reportDraft: null,
        editingTaskId: null,
        templates: [],
        diagnoses: {},
        filtersRevision: 0,
    };
    const listeners = new Set();
    const notify = () => {
        for (const listener of listeners)
            listener();
    };
    const patch = (next) => {
        state = { ...state, ...next };
        notify();
    };
    const requireManifest = () => {
        if (state.manifest === null)
            throw new Error('review manifest not loaded');
        return state.manifest;
    };
    const persist = async (manifest) => {
        await gateway.writeReviewManifest(state.theme, manifest);
        patch({ manifest });
    };
    /** Report file name for one save: new file per save, original never overwritten. */
    const reportFileName = (taskId) => `report-${taskId}-${new Date().toISOString().replace(/[:.]/gu, '-')}.md`;
    /** The active filters as the store-side ReviewFilters shape. */
    const activeFilters = (session) => ({
        platforms: session.platforms,
        contentTypes: session.contentTypes,
        workFilter: session.workFilter,
    });
    return {
        getState: () => state,
        subscribe(listener) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        async load(theme) {
            patch({ theme, loading: true, notice: null });
            try {
                const read = await gateway.readReviewManifest(theme);
                const templates = await gateway.listReviewTemplates(theme);
                patch({ manifest: read.manifest, problems: read.problems, loading: false, templates: templates.files });
            }
            catch {
                patch({ loading: false, notice: 'load-failed' });
            }
        },
        setIgnoredColumns(columns) {
            patch({ ignoredColumns: columns });
        },
        async stageImport(platformId, fileName, text) {
            if (state.theme === null) {
                patch({ notice: 'need-theme' });
                return;
            }
            patch({ busy: true, notice: null });
            try {
                const preview = await gateway.parseReviewImport({ platformId, fileName, text });
                patch({ preview, ignoredColumns: [], busy: false, notice: 'import-parsed' });
            }
            catch {
                patch({ busy: false, notice: 'import-failed' });
            }
        },
        async commitImport() {
            const theme = state.theme;
            const preview = state.preview;
            if (theme === null || preview === null)
                return;
            patch({ busy: true, notice: null });
            try {
                await gateway.commitReviewImport({ theme, platformId: preview.platformId, rows: preview.rows });
                const read = await gateway.readReviewManifest(theme);
                patch({ manifest: read.manifest, problems: read.problems, preview: null, busy: false, notice: 'import-committed' });
            }
            catch {
                patch({ busy: false, notice: 'import-failed' });
            }
        },
        discardImport() {
            patch({ preview: null, ignoredColumns: [] });
        },
        async bindWork(platformWorkId, platformId, contentId) {
            const manifest = requireManifest();
            const snapshots = manifest.snapshots.map((snapshot) => snapshot.platformId === platformId && snapshot.platformWorkId === platformWorkId
                ? { ...snapshot, contentId, matchMethod: 'manual' }
                : snapshot);
            try {
                await persist({ ...manifest, snapshots });
            }
            catch {
                patch({ notice: 'bind-failed' });
            }
        },
        async saveBaselines(engagementRate, collectRate) {
            const manifest = requireManifest();
            const baselines = {
                engagementRate, collectRate, source: 'user', updatedAt: new Date().toISOString(),
            };
            try {
                await persist({ ...manifest, baselines });
                patch({ notice: 'baselines-saved' });
            }
            catch {
                patch({ notice: 'baselines-failed' });
            }
        },
        filters: () => loadFilters(new Date()),
        setFilters(patchFilters) {
            const next = { ...loadFilters(new Date()), ...patchFilters };
            localStorage.setItem(FILTERS_KEY, JSON.stringify(next));
            patch({ filtersRevision: state.filtersRevision + 1 });
        },
        pool() {
            const manifest = state.manifest;
            if (manifest === null)
                return [];
            const baselines = manifest.baselines;
            const now = new Date();
            const session = loadFilters(now);
            const pooled = poolSnapshots(manifest, activeFilters(session), session.period, baselines);
            if (session.workFilter !== 'longtail') {
                return pooled.map(snapshot => ({ snapshot, verdict: verdictOf(snapshot.metrics, baselines), longtail: false }));
            }
            // Long-tail judges each work's full snapshot history; the pool keeps
            // every bound work whose history passes the pace gate, represented by
            // its latest snapshot.
            const byWork = new Map();
            for (const snapshot of pooled) {
                const key = `${snapshot.platformId}:${snapshot.platformWorkId}`;
                const list = byWork.get(key);
                if (list === undefined)
                    byWork.set(key, [snapshot]);
                else
                    list.push(snapshot);
            }
            const cards = [];
            for (const workSnapshots of byWork.values()) {
                const latest = [...workSnapshots].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
                if (latest === undefined)
                    continue;
                if (isLongtail(workSnapshots, now))
                    cards.push({ snapshot: latest, verdict: 'neutral', longtail: true });
            }
            return cards;
        },
        summary() {
            const manifest = state.manifest;
            if (manifest === null)
                return aggregateSummary([], DEFAULT_BASELINES, new Date());
            return aggregateSummary(this.pool().map(card => card.snapshot), manifest.baselines, new Date());
        },
        async createTask(name) {
            const theme = state.theme;
            if (theme === null) {
                patch({ notice: 'need-theme' });
                return;
            }
            const manifest = requireManifest();
            const session = loadFilters(new Date());
            const taskId = crypto.randomUUID();
            const task = {
                taskId,
                name,
                period: session.period,
                filters: {
                    platforms: session.platforms,
                    contentTypes: session.contentTypes,
                    workFilter: session.workFilter,
                },
                status: 'generating',
                reportFile: null,
                degraded: false,
                createdAt: new Date().toISOString(),
            };
            patch({ busy: true, notice: null });
            try {
                await persist({ ...manifest, tasks: [...manifest.tasks, task] });
            }
            catch {
                patch({ busy: false, notice: 'save-failed' });
                return;
            }
            const now = new Date();
            const pooled = poolSnapshots(manifest, activeFilters(session), session.period, manifest.baselines);
            const ranked = rankWorks(pooled);
            const summary = aggregateSummary(pooled, manifest.baselines, now);
            const digests = selectDigests(ranked, {});
            let degraded = true;
            let markdown;
            try {
                const result = await gateway.generateReviewReport({
                    name,
                    period: task.period,
                    platforms: task.filters.platforms,
                    baselines: manifest.baselines,
                    summary,
                    topWorks: digests.top,
                    bottomWorks: digests.bottom,
                });
                markdown = result.markdown;
                degraded = false;
            }
            catch {
                markdown = dataOnlyReport(name, task.period, summary, ranked, manifest.baselines);
            }
            try {
                const stored = await gateway.writeReviewReport(theme, reportFileName(taskId), markdown);
                const current = requireManifest();
                const tasks = current.tasks.map(candidate => candidate.taskId === taskId
                    ? { ...candidate, status: 'ready', degraded, reportFile: stored.file }
                    : candidate);
                await persist({ ...current, tasks });
                patch({ busy: false, notice: degraded ? 'report-degraded' : 'report-ready' });
            }
            catch {
                // The text lands in the editor even when the disk write failed, so
                // the user can copy it out; the task records the failure.
                const current = requireManifest();
                const tasks = current.tasks.map(candidate => candidate.taskId === taskId ? { ...candidate, status: 'failed' } : candidate);
                await persist({ ...current, tasks }).catch(() => undefined);
                patch({ busy: false, reportDraft: markdown, editingTaskId: taskId, notice: 'report-failed' });
            }
        },
        async editReport(taskId) {
            const theme = state.theme;
            const manifest = requireManifest();
            const task = manifest.tasks.find(candidate => candidate.taskId === taskId);
            if (theme === null || task === undefined || task.reportFile === null)
                return;
            try {
                const read = await gateway.readReviewReport(theme, task.reportFile);
                patch({ reportDraft: read.content ?? '', editingTaskId: taskId });
            }
            catch {
                patch({ notice: 'load-failed' });
            }
        },
        async saveReport() {
            const theme = state.theme;
            const taskId = state.editingTaskId;
            const draft = state.reportDraft;
            if (theme === null || taskId === null || draft === null)
                return;
            try {
                const stored = await gateway.writeReviewReport(theme, reportFileName(taskId), draft);
                const manifest = requireManifest();
                const tasks = manifest.tasks.map(candidate => candidate.taskId === taskId ? { ...candidate, reportFile: stored.file, status: 'ready' } : candidate);
                await persist({ ...manifest, tasks });
                patch({ reportDraft: null, editingTaskId: null, notice: 'report-saved' });
            }
            catch {
                patch({ notice: 'save-failed' });
            }
        },
        closeReport() {
            patch({ reportDraft: null, editingTaskId: null });
        },
        copyReportToEditor(content) {
            patch({ reportDraft: content });
        },
        async deleteTask(taskId) {
            const theme = state.theme;
            if (theme === null)
                return;
            try {
                await gateway.deleteReviewTask({ theme, taskId });
                const read = await gateway.readReviewManifest(theme);
                patch({ manifest: read.manifest, problems: read.problems, notice: 'task-deleted' });
            }
            catch {
                patch({ notice: 'delete-failed' });
            }
        },
        async saveTemplate(fileName, content) {
            const theme = state.theme;
            if (theme === null) {
                patch({ notice: 'need-theme' });
                return;
            }
            try {
                await gateway.writeReviewTemplate(theme, fileName.endsWith('.md') ? fileName : `${fileName}.md`, content);
                const templates = await gateway.listReviewTemplates(theme);
                patch({ templates: templates.files, notice: 'template-saved' });
            }
            catch {
                patch({ notice: 'save-failed' });
            }
        },
        async diagnoseWork(card, draftText, tags, personaDigest) {
            patch({ busy: true, notice: null });
            const key = `${card.snapshot.platformId}:${card.snapshot.platformWorkId}`;
            try {
                const result = await gateway.analyzeReviewWork({
                    title: card.snapshot.title,
                    platformId: card.snapshot.platformId,
                    contentType: card.snapshot.contentType,
                    publishedAt: card.snapshot.publishedAt,
                    period: loadFilters(new Date()).period,
                    metrics: card.snapshot.metrics,
                    verdict: card.verdict === 'viral' || card.verdict === 'weak' ? card.verdict : 'neutral',
                    draftText: draftText === null ? null : draftText.slice(0, DIAGNOSE_DRAFT_CHARS),
                    tags,
                    personaDigest,
                });
                patch({ busy: false, diagnoses: { ...state.diagnoses, [key]: result.markdown } });
            }
            catch {
                patch({ busy: false, notice: 'diagnose-failed' });
            }
        },
        async pushToTopicBank(title, oneLiner, description) {
            const input = {
                title,
                oneLiner,
                status: 'idea',
                source: { type: 'manual', refId: null, url: null, snapshot: null },
                tags: ['复盘'],
                description,
                score: null,
                planDate: null,
                scheduleItemId: null,
                topicDir: null,
            };
            try {
                await topics.put(input);
                patch({ notice: 'topic-added' });
            }
            catch {
                patch({ notice: 'topic-failed' });
            }
        },
        clearNotice() {
            patch({ notice: null });
        },
    };
}
//# sourceMappingURL=review-store.js.map