import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The create workbench view: three entries (blank new as the main path,
 * paste-a-topic, and the topic-bank push once that column ships), then the
 * editor — one-shot generation, selection rewrites with a diff preview,
 * version snapshots with a pin/prune quota, the local banned-word pre-check,
 * and the copy-plus-register publish handoff. The capability card catalog
 * stays reachable behind the 指令库 toggle. Editor logic lives in the pure
 * `create.ts` / `banned-words.ts` modules; this surface only orchestrates.
 */
import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { extractKeywords, geoKeywords, layoutSuggestions } from "./seo.js";
import { appendHashtagBlock, appendVersion, buildExportMarkdown, contentTypeKind, countWords, defaultManifest, deliverableName, exportFileName, formatHashtags, lineDiff, localMetrics, mergeManualSave, newId, pinVersion, readingMinutes, replaceRange, suggestHashtags, triggerClass, versionContent, isBatchable, REWRITE_STYLES, } from "./create.js";
import { scanBannedWords } from "./banned-words.js";
import workbenchCss from './ContentStudio.module.css';
import css from './CreateView.module.css';
/** The selection rewrites the toolbar offers; titles runs on the whole text. */
const SELECTION_OPS = ['condense', 'expand', 'style', 'perspective', 'extract', 'humanize-light', 'humanize-deep'];
/** Classify an AI failure for its locale stem: quota, paid tier, or generic. */
export function aiErrorClass(message) {
    if (message.includes('quota exceeded'))
        return 'quota';
    if (message.includes('paid tier'))
        return 'paid';
    return 'generic';
}
/** Style provenance of the current persona: inline text, or none. */
function profileRefOf(persona) {
    const digest = persona.trim().slice(0, 500);
    return digest.length > 0 ? { mode: 'inline', digest } : null;
}
/** Parse a pasted topic brief: the first non-empty line is the title. */
function parseBrief(pasted) {
    const lines = pasted.split('\n');
    let title = '';
    let restIndex = 0;
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]?.trim().replace(/^#+\s*/, '') ?? '';
        if (line.length > 0) {
            title = line;
            restIndex = index + 1;
            break;
        }
    }
    return { title, rest: lines.slice(restIndex).join('\n').trim() };
}
/**
 * Render the create workbench view.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export function CreateView({ create, listThemes, persona, picked, onClearPicked, pickedTopic, onClearPickedTopic, topics, schedule, onSendToPublish, catalog, templateLibrary, t, }) {
    const [showCatalog, setShowCatalog] = useState(false);
    const [entryMode, setEntryMode] = useState('blank');
    const [themeChoice, setThemeChoice] = useState('new');
    const [newThemeName, setNewThemeName] = useState('');
    const [existingTheme, setExistingTheme] = useState('');
    const [themes, setThemes] = useState([]);
    const [title, setTitle] = useState('');
    const [pasted, setPasted] = useState('');
    const [entryError, setEntryError] = useState(null);
    const [editor, setEditor] = useState(null);
    const [dirty, setDirty] = useState(false);
    const [notice, setNotice] = useState(null);
    const [error, setError] = useState(null);
    const [aiPending, setAiPending] = useState(null);
    const [rewritePreview, setRewritePreview] = useState(null);
    const [banned, setBanned] = useState(null);
    const [overwritePending, setOverwritePending] = useState(null);
    const [registerRetry, setRegisterRetry] = useState(null);
    const [count, setCount] = useState(1);
    const [batch, setBatch] = useState(null);
    const [evaluation, setEvaluation] = useState(null);
    const [titles, setTitles] = useState(null);
    const [hashtags, setHashtags] = useState(null);
    const [hashtagPicks, setHashtagPicks] = useState([]);
    const [assets, setAssets] = useState(null);
    const [pendingTopic, setPendingTopic] = useState(null);
    const [writebackFailed, setWritebackFailed] = useState(false);
    const [templates, setTemplates] = useState(null);
    const [templateProblems, setTemplateProblems] = useState([]);
    const [activeTemplateId, setActiveTemplateId] = useState(null);
    const [templateForm, setTemplateForm] = useState(null);
    const [seoKeywords, setSeoKeywords] = useState(null);
    const [seoRegion, setSeoRegion] = useState('');
    const textareaRef = useRef(null);
    const activeTemplate = templates?.find(template => template.id === activeTemplateId) ?? null;
    useEffect(() => {
        let alive = true;
        listThemes().then((names) => {
            if (alive)
                setThemes(names);
        }).catch(() => {
            if (alive)
                setThemes([]);
        });
        return () => { alive = false; };
    }, [listThemes]);
    // The gather handoff lands once: turn it into a reference line.
    useEffect(() => {
        if (picked === null)
            return;
        const line = `${picked.title}（${picked.url}）`;
        setTitle(current => current.length > 0 ? current : picked.title);
        setPasted(current => current.length > 0 ? `${current}\n${line}` : line);
        setEntryMode('paste');
        onClearPicked();
    }, [picked, onClearPicked]);
    // The topic-bank handoff lands once: title plus the brief fields fold into
    // the paste entry (mirroring the gather handoff), and the topic id rides
    // into the manifest's topicRef so the finalize write-back can find it.
    useEffect(() => {
        if (pickedTopic === null)
            return;
        const brief = [pickedTopic.oneLiner ?? '', pickedTopic.description ?? ''].filter(part => part.trim().length > 0).join('\n');
        setTitle(current => current.length > 0 ? current : pickedTopic.title);
        setPasted(current => current.length > 0 ? `${current}\n${brief}` : brief);
        setPendingTopic(pickedTopic);
        setEntryMode('paste');
        onClearPickedTopic();
    }, [pickedTopic, onClearPickedTopic]);
    /** The topic ref a new creation starts from, when one was handed over. */
    const topicRefOf = (workTitle) => pendingTopic === null ? null : { topicId: pendingTopic.id, title: pendingTopic.title.length > 0 ? pendingTopic.title : workTitle, syncState: 'linked' };
    const text = editor?.text ?? '';
    const words = countWords(text);
    const minutes = editor === null ? 1 : readingMinutes(words, editor.manifest.contentType);
    const startBlank = () => {
        const trimmed = title.trim();
        const themeName = newThemeName.trim();
        if (trimmed.length === 0) {
            setEntryError(t('create.error.title'));
            return;
        }
        if (themeChoice === 'new' && themeName.length === 0) {
            setEntryError(t('create.error.theme'));
            return;
        }
        setEntryError(null);
        setError(null);
        setNotice(null);
        const manifest = { ...defaultManifest(newId(), 'gzh-article'), topicRef: topicRefOf(trimmed) };
        setEditor({
            theme: themeChoice === 'new' ? themeName : existingTheme,
            manifest,
            text: '',
            title: trimmed,
            publishedFile: null,
        });
        setDirty(false);
        setBanned(null);
        setRewritePreview(null);
        setOverwritePending(null);
        setRegisterRetry(null);
    };
    const startPasted = () => {
        if (pasted.trim().length === 0) {
            setEntryError(t('create.error.title'));
            return;
        }
        const themeName = newThemeName.trim();
        if (themeChoice === 'new' && themeName.length === 0) {
            setEntryError(t('create.error.theme'));
            return;
        }
        const brief = parseBrief(pasted);
        if (brief.title.length === 0) {
            setEntryError(t('create.error.title'));
            return;
        }
        setEntryError(null);
        setError(null);
        setNotice(null);
        const workTitle = title.trim().length > 0 ? title.trim() : brief.title;
        const manifest = { ...defaultManifest(newId(), 'gzh-article'), topicRef: topicRefOf(workTitle) };
        setEditor({
            theme: themeChoice === 'new' ? themeName : existingTheme,
            manifest,
            text: '',
            title: workTitle,
            publishedFile: null,
        });
        setDirty(false);
        setBanned(null);
        setRewritePreview(null);
        setOverwritePending(null);
        setRegisterRetry(null);
    };
    const openTheme = async (theme) => {
        setError(null);
        setNotice(null);
        try {
            const state = await create.readCreateState(theme);
            if (state.manifest === null) {
                if (state.problems.length > 0) {
                    setError(t('create.manifestProblem').replace('{detail}', state.problems.join('；')));
                    return;
                }
                setEntryError(t('create.versions.empty'));
                return;
            }
            const metadata = await create.readCreateMetadata(theme);
            const newest = state.manifest.versions.at(-1);
            setEditor({
                theme,
                manifest: state.manifest,
                text: state.draft ?? newest?.content ?? '',
                title: metadata.metadata?.title ?? theme,
                publishedFile: null,
            });
            setDirty(false);
            setBanned(null);
            setRewritePreview(null);
            setOverwritePending(null);
            setRegisterRetry(null);
        }
        catch (cause) {
            setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)));
        }
    };
    /** Persist the draft, the manifest, and (create-or-merge) the metadata. */
    const persist = async (nextManifest, nextText, nextTitle) => {
        const theme = editor?.theme ?? '';
        await create.writeAsset(theme, `${nextManifest.contentId}.md`, nextText);
        await create.writeCreateState(theme, nextManifest);
        const existing = await create.readCreateMetadata(theme);
        if (existing.metadata === null) {
            if (existing.problem !== null) {
                setError(t('create.metadataProblem').replace('{detail}', existing.problem));
            }
            else {
                await create.writeCreateMetadata(theme, {
                    formatVersion: 0,
                    title: nextTitle,
                    kind: contentTypeKind(nextManifest.contentType),
                    platform: null,
                    status: 'draft',
                    tags: [],
                    summary: null,
                });
            }
        }
        else if (existing.metadata.title !== nextTitle || existing.metadata.kind !== contentTypeKind(nextManifest.contentType)) {
            await create.writeCreateMetadata(theme, {
                ...existing.metadata,
                title: nextTitle,
                kind: contentTypeKind(nextManifest.contentType),
            });
        }
        setEditor(current => current === null ? current : { ...current, manifest: nextManifest, text: nextText, title: nextTitle });
        setDirty(false);
        setNotice(t('create.saved').replace('{n}', String(nextManifest.currentVersion)));
    };
    const save = async () => {
        if (editor === null)
            return;
        const merged = mergeManualSave(editor.manifest, {
            content: editor.text, now: new Date().toISOString(), profileRef: profileRefOf(persona),
        });
        try {
            await persist(merged.manifest, editor.text, editor.title);
        }
        catch (cause) {
            setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)));
        }
    };
    /** One generation request for the editor's current context. */
    const generateOnce = async (manifest, workTitle) => create.generateCreateContent({
        contentType: manifest.contentType,
        title: workTitle,
        audience: manifest.context.audience,
        points: manifest.context.points,
        references: manifest.context.references,
        profileDigest: persona.trim().length > 0 ? persona.trim() : null,
        count: 1,
        customTemplate: activeTemplate === null
            ? null : { id: activeTemplate.id, revision: activeTemplate.revision, body: activeTemplate.body },
    });
    /** Attach the advisory evaluation to the current version, best effort. */
    const evaluateCurrentVersion = async (theme, manifest, workTitle, body) => {
        try {
            const result = await create.evaluateCreateContent({ contentType: manifest.contentType, title: workTitle, text: body });
            const versions = manifest.versions.map(version => (version.v === manifest.currentVersion ? { ...version, evaluation: result } : version));
            await create.writeCreateState(theme, { ...manifest, versions });
            setEvaluation(result);
            setEditor(current => current === null ? current : { ...current, manifest: { ...current.manifest, versions } });
        }
        catch (cause) {
            const message = cause instanceof Error ? cause.message : String(cause);
            // Evaluation is advisory: a failure never blocks the draft; the error
            // line names quota rejections and generic failures alike.
            setError(t('create.aiFailed').replace('{detail}', message));
        }
    };
    /** Adopt one batch card as the working draft: snapshot it, then evaluate. */
    const adoptBatchCard = async (index) => {
        if (editor === null || batch === null)
            return;
        const card = batch[index];
        if (card === undefined || card.kind !== 'done')
            return;
        const trigger = batch.length > 1 ? `ai-generate#${index + 1}` : 'ai-generate';
        const nextManifest = appendVersion(editor.manifest, {
            content: card.text,
            trigger,
            now: new Date().toISOString(),
            profileRef: profileRefOf(persona),
        });
        try {
            await persist(nextManifest, card.text, editor.title);
        }
        catch (cause) {
            setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)));
            return;
        }
        void evaluateCurrentVersion(editor.theme, nextManifest, editor.title, card.text);
    };
    const generate = async () => {
        if (editor === null || aiPending !== null)
            return;
        const requested = count;
        const batchable = isBatchable(editor.manifest.contentType);
        if (requested === 3 && !batchable) {
            // Long types ride serial single calls: cards fill as each returns, one
            // failure never takes the others down, and a quota wall stops the run.
            setAiPending('generate');
            setError(null);
            setBatch([{ kind: 'pending' }, { kind: 'pending' }, { kind: 'pending' }]);
            let stopped = false;
            for (let index = 0; index < 3; index += 1) {
                try {
                    const result = await generateOnce(editor.manifest, editor.title);
                    setBatch(current => current === null ? current : current.map((card, at) => at === index ? { kind: 'done', text: result.text } : card));
                }
                catch (cause) {
                    const message = cause instanceof Error ? cause.message : String(cause);
                    setBatch(current => current === null ? current : current.map((card, at) => at === index ? { kind: 'failed', detail: message } : card));
                    if (aiErrorClass(message) !== 'generic') {
                        setError(t('create.batch.degraded').replace('{detail}', message));
                        stopped = true;
                    }
                }
                if (stopped)
                    break;
            }
            setAiPending(null);
            return;
        }
        setAiPending('generate');
        setError(null);
        try {
            const result = await create.generateCreateContent({
                contentType: editor.manifest.contentType,
                title: editor.title,
                audience: editor.manifest.context.audience,
                points: editor.manifest.context.points,
                references: editor.manifest.context.references,
                profileDigest: persona.trim().length > 0 ? persona.trim() : null,
                count: requested,
                customTemplate: activeTemplate === null
                    ? null : { id: activeTemplate.id, revision: activeTemplate.revision, body: activeTemplate.body },
            });
            if (result.variants !== null) {
                setBatch(result.variants.map(text => ({ kind: 'done', text })));
                setNotice(t('create.batch.done'));
            }
            else {
                const nextManifest = appendVersion(editor.manifest, {
                    content: result.text,
                    trigger: 'ai-generate',
                    now: new Date().toISOString(),
                    profileRef: profileRefOf(persona),
                });
                await persist(nextManifest, result.text, editor.title);
                void evaluateCurrentVersion(editor.theme, nextManifest, editor.title, result.text);
            }
        }
        catch (cause) {
            const message = cause instanceof Error ? cause.message : String(cause);
            if (aiErrorClass(message) === 'quota')
                setError(t('create.error.quota'));
            else if (aiErrorClass(message) === 'paid')
                setError(t('create.error.paid'));
            else
                setError(t('create.aiFailed').replace('{detail}', message));
        }
        finally {
            setAiPending(null);
        }
    };
    const runEvaluate = async () => {
        if (editor === null || aiPending !== null || editor.text.trim().length === 0)
            return;
        setAiPending('rewrite');
        setError(null);
        try {
            const result = await create.evaluateCreateContent({
                contentType: editor.manifest.contentType,
                title: editor.title,
                text: editor.text,
            });
            const versions = editor.manifest.versions.map(version => (version.v === editor.manifest.currentVersion ? { ...version, evaluation: result } : version));
            await create.writeCreateState(editor.theme, { ...editor.manifest, versions });
            setEditor({ ...editor, manifest: { ...editor.manifest, versions } });
            setEvaluation(result);
            setNotice(t('create.evaluated'));
        }
        catch (cause) {
            const message = cause instanceof Error ? cause.message : String(cause);
            if (aiErrorClass(message) === 'quota')
                setError(t('create.error.quota'));
            else if (aiErrorClass(message) === 'paid')
                setError(t('create.error.paid'));
            else
                setError(t('create.aiFailed').replace('{detail}', message));
        }
        finally {
            setAiPending(null);
        }
    };
    /** Title batch rides the rewrite face over the whole text, no selection needed. */
    const runTitles = async () => {
        if (editor === null || aiPending !== null || editor.text.trim().length === 0) {
            setNotice(t('create.rewrite.needSelection'));
            return;
        }
        setAiPending('rewrite');
        setError(null);
        try {
            const result = await create.rewriteCreateSelection({ operation: 'titles', style: null, text: editor.text });
            setTitles(result.text.split('\n').map(line => line.trim().replace(/^[-*]\s*/, '')).filter(line => line.length > 0).slice(0, 8));
        }
        catch (cause) {
            const message = cause instanceof Error ? cause.message : String(cause);
            if (aiErrorClass(message) === 'quota')
                setError(t('create.error.quota'));
            else if (aiErrorClass(message) === 'paid')
                setError(t('create.error.paid'));
            else
                setError(t('create.aiFailed').replace('{detail}', message));
        }
        finally {
            setAiPending(null);
        }
    };
    const suggestTags = () => {
        if (editor === null)
            return;
        setHashtags(suggestHashtags(editor.title, editor.text));
        setHashtagPicks([]);
    };
    const toggleHashtag = (tag) => {
        setHashtagPicks(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag]);
    };
    const insertHashtags = () => {
        if (editor === null)
            return;
        const block = formatHashtags(hashtagPicks, editor.manifest.contentType);
        if (block.length === 0)
            return;
        setEditor({ ...editor, text: appendHashtagBlock(editor.text, block) });
        setDirty(true);
        setNotice(t('create.hashtags.inserted'));
    };
    const loadAssets = async () => {
        if (editor === null)
            return;
        try {
            const list = await create.listCreateAssets(editor.theme);
            setAssets(list.files);
        }
        catch (cause) {
            setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)));
        }
    };
    const addSource = (file) => {
        if (editor === null)
            return;
        if (editor.manifest.sources.some(source => source.file === file))
            return;
        const kind = file.endsWith('.html') ? 'gather' : 'image';
        setEditor({
            ...editor,
            manifest: {
                ...editor.manifest,
                sources: [...editor.manifest.sources, {
                        kind, refId: null, file, title: file, url: null, addedAt: new Date().toISOString(),
                    }],
            },
        });
        setDirty(true);
    };
    const removeSource = (file) => {
        if (editor === null)
            return;
        setEditor({ ...editor, manifest: { ...editor.manifest, sources: editor.manifest.sources.filter(source => source.file !== file) } });
        setDirty(true);
    };
    const runRewrite = async (operation, style) => {
        if (editor === null || aiPending !== null)
            return;
        const node = textareaRef.current;
        if (node === null || node.selectionStart === node.selectionEnd) {
            setNotice(t('create.rewrite.needSelection'));
            return;
        }
        const start = node.selectionStart;
        const end = node.selectionEnd;
        const before = editor.text.slice(start, end);
        setAiPending('rewrite');
        setError(null);
        try {
            const result = await create.rewriteCreateSelection({
                operation,
                style: operation === 'style' ? style : null,
                text: before,
            });
            setRewritePreview({ operation, start, end, before, after: result.text });
        }
        catch (cause) {
            setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)));
        }
        finally {
            setAiPending(null);
        }
    };
    const applyRewrite = async () => {
        if (editor === null || rewritePreview === null)
            return;
        const nextText = replaceRange(editor.text, rewritePreview.start, rewritePreview.end, rewritePreview.after);
        const nextManifest = appendVersion(editor.manifest, {
            content: nextText,
            trigger: `rewrite:${rewritePreview.operation}`,
            now: new Date().toISOString(),
            profileRef: profileRefOf(persona),
        });
        setRewritePreview(null);
        try {
            await persist(nextManifest, nextText, editor.title);
        }
        catch (cause) {
            setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)));
        }
    };
    /**
     * The module-6 write-back: flip the linked topic to done and its calendar
     * entry to published, both idempotent reads-then-writes, both failures
     * non-fatal (the ref degrades to pendingSync for the retry button).
     */
    const runWriteback = async (state) => {
        const ref = state.manifest.topicRef;
        if (ref === null || ref.topicId === null || ref.syncState === 'completed')
            return;
        try {
            const snapshot = await topics.list();
            const item = snapshot.items.find(candidate => candidate.id === ref.topicId);
            if (item === undefined) {
                const nextManifest = { ...state.manifest, topicRef: { ...ref, syncState: 'orphan' } };
                await create.writeCreateState(state.theme, nextManifest);
                setEditor({ ...state, manifest: nextManifest });
                setWritebackFailed(false);
                return;
            }
            if (item.status !== 'done')
                await topics.put({ ...item, status: 'done' });
            if (item.scheduleItemId !== null) {
                const calendar = await schedule.list();
                const entry = calendar.items.find(candidate => candidate.id === item.scheduleItemId);
                if (entry !== undefined && entry.status !== 'published') {
                    await schedule.put({ ...entry, status: 'published' });
                }
            }
            const nextManifest = { ...state.manifest, topicRef: { ...ref, syncState: 'completed' } };
            await create.writeCreateState(state.theme, nextManifest);
            setEditor({ ...state, manifest: nextManifest });
            setWritebackFailed(false);
            setNotice(t('create.writeback.done'));
        }
        catch {
            // The topic bank (or calendar) is unreachable: keep the intent local.
            try {
                const nextManifest = { ...state.manifest, topicRef: { ...ref, syncState: 'pendingSync' } };
                await create.writeCreateState(state.theme, nextManifest);
                setEditor({ ...state, manifest: nextManifest });
            }
            catch { /* the local intent write failing keeps the retry button armed */ }
            setWritebackFailed(true);
        }
    };
    const detachTopic = async () => {
        if (editor === null)
            return;
        const nextManifest = { ...editor.manifest, topicRef: null };
        try {
            await create.writeCreateState(editor.theme, nextManifest);
            setEditor({ ...editor, manifest: nextManifest });
            setWritebackFailed(false);
        }
        catch (cause) {
            setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)));
        }
    };
    const loadTemplates = async () => {
        try {
            const list = await create.listCreateTemplates();
            setTemplates(list.templates);
            setTemplateProblems(list.problems);
            if (activeTemplateId !== null && !list.templates.some(template => template.id === activeTemplateId)) {
                setActiveTemplateId(null);
            }
        }
        catch (cause) {
            setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)));
        }
    };
    const saveTemplate = async () => {
        if (templateForm === null)
            return;
        try {
            const base = { title: templateForm.title, contentType: editor?.manifest.contentType ?? 'gzh-article', body: templateForm.body };
            const list = templateForm.id === null
                ? await create.putCreateTemplate(base)
                : await create.putCreateTemplate({ ...base, id: templateForm.id });
            setTemplates(list.templates);
            setTemplateForm(null);
            setNotice(t('create.template.saved'));
        }
        catch (cause) {
            setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)));
        }
    };
    const removeTemplate = async (id) => {
        if (!window.confirm(t('create.template.deleteConfirm')))
            return;
        try {
            const list = await create.deleteCreateTemplate(id);
            setTemplates(list.templates);
            if (activeTemplateId === id)
                setActiveTemplateId(null);
        }
        catch (cause) {
            setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)));
        }
    };
    const publish = async (overwrite) => {
        if (editor === null)
            return;
        const file = deliverableName(editor.title, editor.manifest.contentId);
        setError(null);
        setOverwritePending(null);
        try {
            if (dirty)
                await save();
            await create.publishCreateFinal(editor.theme, { file, content: editor.text, overwrite });
            try {
                await create.registerCreatePublish(editor.theme, { file, version: editor.manifest.currentVersion });
            }
            catch (cause) {
                setRegisterRetry(file);
                setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)));
                return;
            }
            setEditor(current => current === null ? current : { ...current, publishedFile: file });
            setNotice(t('create.published').replace('{file}', file));
            // The write-back runs after the deliverable is safely registered; its
            // own failures degrade to pendingSync, never to a failed publish.
            await runWriteback({ ...editor, publishedFile: file });
        }
        catch (cause) {
            const message = cause instanceof Error ? cause.message : String(cause);
            if (message.includes('already exists')) {
                setOverwritePending(file);
                return;
            }
            setError(t('create.aiFailed').replace('{detail}', message));
        }
    };
    const runExport = async () => {
        if (editor === null)
            return;
        const file = exportFileName(editor.title, editor.manifest.contentId);
        try {
            await create.writeAsset(editor.theme, file, buildExportMarkdown({
                title: editor.title,
                contentType: editor.manifest.contentType,
                status: editor.publishedFile === null ? 'draft' : 'published',
                version: editor.manifest.currentVersion,
                exportedAt: new Date().toISOString(),
            }, editor.text));
            setNotice(t('create.exported').replace('{file}', file));
        }
        catch (cause) {
            setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)));
        }
    };
    const retarget = async (contentType) => {
        if (editor === null || editor.manifest.contentType === contentType)
            return;
        const nextManifest = { ...editor.manifest, contentType };
        if (editor.text.trim().length === 0) {
            setEditor({ ...editor, manifest: nextManifest });
            setDirty(true);
            return;
        }
        const withVersion = appendVersion(nextManifest, {
            content: editor.text,
            trigger: 'retarget',
            now: new Date().toISOString(),
            profileRef: profileRefOf(persona),
        });
        try {
            await persist(withVersion, editor.text, editor.title);
        }
        catch (cause) {
            setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)));
        }
    };
    if (editor === null) {
        return (_jsxs("div", { children: [_jsx("button", { type: "button", className: css.catalogToggle, onClick: () => { setShowCatalog(value => !value); }, children: showCatalog ? t('create.tab.workbench') : t('create.tab.catalog') }), showCatalog && catalog, !showCatalog && (_jsxs("div", { className: workbenchCss.compForm, children: [_jsxs("div", { className: css.entryGrid, children: [_jsxs("button", { type: "button", className: clsx(css.entryCard, entryMode === 'blank' && css.entryCardActive), onClick: () => { setEntryMode('blank'); }, children: [_jsx("span", { className: css.entryCardTitle, children: t('create.entry.blank') }), _jsx("span", { className: css.entryCardHint, children: t('create.entry.blankHint') })] }), _jsxs("button", { type: "button", className: clsx(css.entryCard, entryMode === 'paste' && css.entryCardActive), onClick: () => { setEntryMode('paste'); }, children: [_jsx("span", { className: css.entryCardTitle, children: t('create.entry.paste') }), _jsx("span", { className: css.entryCardHint, children: t('create.entry.pasteHint') })] })] }), entryMode === 'paste' && (_jsxs("div", { className: workbenchCss.compFormRow, children: [_jsx("span", { className: workbenchCss.compFieldLabel, children: t('create.entry.pastePlaceholder') }), _jsx("textarea", { className: workbenchCss.compTextarea, value: pasted, rows: 5, onChange: (event) => { setPasted(event.target.value); } })] })), _jsxs("div", { className: workbenchCss.compFormRow, children: [_jsx("span", { className: workbenchCss.compFieldLabel, children: t('create.entry.title') }), entryMode === 'blank' && _jsx("input", { className: workbenchCss.compInput, value: title, placeholder: t('create.entry.titlePlaceholder'), onChange: (event) => { setTitle(event.target.value); } })] }), _jsxs("div", { className: workbenchCss.compFormRow, children: [_jsx("span", { className: workbenchCss.compFieldLabel, children: t('create.entry.theme') }), _jsxs("label", { className: css.versionMeta, children: [_jsx("input", { type: "radio", checked: themeChoice === 'new', onChange: () => { setThemeChoice('new'); } }), t('create.entry.themeNew')] }), themes.length > 0 && (_jsxs("label", { className: css.versionMeta, children: [_jsx("input", { type: "radio", checked: themeChoice === 'existing', onChange: () => { setThemeChoice('existing'); } }), t('create.entry.themeExisting'), _jsxs("select", { value: existingTheme, disabled: themeChoice !== 'existing', onChange: (event) => { setExistingTheme(event.target.value); }, children: [_jsx("option", { value: "", disabled: true, children: "\u2014" }), themes.map(name => _jsx("option", { value: name, children: name }, name))] })] })), themeChoice === 'new' && (_jsx("input", { className: workbenchCss.compInput, value: newThemeName, placeholder: t('create.entry.themePlaceholder'), onChange: (event) => { setNewThemeName(event.target.value); } }))] }), entryError !== null && _jsx("span", { className: css.aiError, children: entryError }), _jsxs("div", { className: workbenchCss.compActions, children: [_jsx("button", { type: "button", className: workbenchCss.retry, onClick: () => {
                                        if (entryMode === 'blank') {
                                            startBlank();
                                        }
                                        else {
                                            startPasted();
                                        }
                                    }, children: t('create.entry.start') }), themes.map(name => (_jsx("button", { type: "button", className: workbenchCss.chip, onClick: () => { void openTheme(name); }, children: name }, name)))] })] }))] }));
    }
    const diffRows = rewritePreview === null ? [] : lineDiff(rewritePreview.before, rewritePreview.after);
    return (_jsxs("div", { children: [_jsxs("div", { className: workbenchCss.compDetailHead, children: [_jsx("input", { className: workbenchCss.compInput, value: editor.title, "aria-label": t('create.entry.title'), onChange: (event) => { setEditor({ ...editor, title: event.target.value }); setDirty(true); } }), _jsx("select", { value: editor.manifest.contentType, "aria-label": t('create.type.label'), onChange: (event) => { void retarget(event.target.value); }, children: ['gzh-article', 'xhs-note', 'video-script', 'voiceover', 'product-page', 'rewrite'].map(id => (_jsx("option", { value: id, children: t(`create.type.${id}`) }, id))) }), _jsx("span", { className: `${workbenchCss.badge} ${editor.publishedFile === null ? workbenchCss.statusDraft : workbenchCss.statusPublished}`, children: editor.publishedFile === null ? t('status.draft') : t('status.published') })] }), _jsxs("div", { className: workbenchCss.compActions, children: [_jsx("button", { type: "button", className: workbenchCss.retry, disabled: aiPending !== null, onClick: () => { void generate(); }, children: aiPending === 'generate' ? t('create.generating') : t('create.generate') }), _jsxs("label", { className: css.versionMeta, children: [_jsx("input", { type: "radio", checked: count === 1, onChange: () => { setCount(1); } }), t('create.count.one')] }), _jsxs("label", { className: css.versionMeta, children: [_jsx("input", { type: "radio", checked: count === 3, disabled: !isBatchable(editor.manifest.contentType), onChange: () => { setCount(3); } }), t('create.count.three')] }), _jsx("button", { type: "button", disabled: aiPending !== null, onClick: () => { void save(); }, children: t('create.save') }), _jsx("button", { type: "button", disabled: aiPending !== null, onClick: () => { void publish(false); }, children: t('create.publish') }), onSendToPublish !== undefined && editor.publishedFile !== null && (_jsx("button", { type: "button", className: workbenchCss.retry, onClick: () => {
                            onSendToPublish({
                                theme: editor.theme,
                                file: editor.publishedFile,
                                title: editor.title.trim().length > 0 ? editor.title.trim() : editor.publishedFile,
                                // The linked creation topic rides the handoff so the publish
                                // task can reflow its status when the platforms report back.
                                topicId: editor.manifest.topicRef?.topicId ?? null,
                            });
                        }, children: t('create.sendToPublish') })), _jsx("button", { type: "button", onClick: () => { void runExport(); }, children: t('create.export') }), dirty && _jsx("span", { className: css.noticeLine, children: t('create.dirty') })] }), batch !== null && (_jsx("div", { className: css.entryGrid, children: batch.map((card, index) => (_jsxs("div", { className: css.versionRow, children: [card.kind === 'pending' && _jsx("span", { className: css.versionMeta, children: t('create.batch.pending') }), card.kind === 'failed' && _jsxs("span", { className: css.aiError, children: [t('create.batch.failed'), card.detail] }), card.kind === 'done' && (_jsxs(_Fragment, { children: [_jsx("span", { className: css.versionMeta, children: t('create.batch.card').replace('{n}', String(index + 1)) }), _jsx("div", { className: css.diffBlock, children: card.text.slice(0, 240) }), _jsx("div", { className: css.versionActions, children: _jsx("button", { type: "button", className: workbenchCss.retry, disabled: aiPending !== null, onClick: () => { void adoptBatchCard(index); }, children: t('create.batch.adopt') }) })] }))] }, index))) })), notice !== null && _jsx("div", { className: css.noticeLine, role: "status", children: notice }), error !== null && _jsx("div", { className: css.aiError, role: "alert", children: error }), overwritePending !== null && (_jsxs("div", { className: workbenchCss.compActions, children: [_jsx("span", { children: t('create.publishConfirm').replace('{file}', overwritePending) }), _jsx("button", { type: "button", className: workbenchCss.retry, onClick: () => { void publish(true); }, children: t('create.overwrite') })] })), registerRetry !== null && (_jsx("div", { className: workbenchCss.compActions, children: _jsx("button", { type: "button", className: workbenchCss.retry, onClick: () => {
                        void (async () => {
                            try {
                                await create.registerCreatePublish(editor.theme, { file: registerRetry, version: editor.manifest.currentVersion });
                                setRegisterRetry(null);
                                setEditor({ ...editor, publishedFile: registerRetry });
                                setNotice(t('create.published').replace('{file}', registerRetry));
                            }
                            catch (cause) {
                                setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)));
                            }
                        })();
                    }, children: t('create.registerRetry') }) })), editor.manifest.topicRef !== null && (_jsxs("div", { className: workbenchCss.compActions, children: [_jsxs("span", { className: css.noticeLine, children: [t('create.topic.label'), editor.manifest.topicRef.title, editor.manifest.topicRef.syncState !== 'linked' && _jsxs("span", { children: [" \u00B7 ", t(`create.topic.${editor.manifest.topicRef.syncState}`)] })] }), writebackFailed && (_jsx("button", { type: "button", className: workbenchCss.retry, onClick: () => { void runWriteback(editor); }, children: t('create.writeback.retry') })), editor.manifest.topicRef.syncState === 'orphan' && (_jsx("button", { type: "button", onClick: () => { void detachTopic(); }, children: t('create.writeback.detached') }))] })), _jsxs("div", { className: css.editorGrid, children: [_jsxs("div", { className: css.editorPane, children: [_jsxs("div", { className: css.editorToolbar, children: [_jsx("span", { className: css.versionMeta, children: t('create.rewrite.label') }), SELECTION_OPS.map(op => (_jsx("button", { type: "button", disabled: aiPending !== null, onClick: () => { void runRewrite(op, REWRITE_STYLES[0] ?? null); }, children: t(`create.op.${op}`) }, op))), _jsxs("select", { "aria-label": t('create.op.style'), onChange: (event) => {
                                            const style = event.target.value;
                                            void runRewrite('style', style);
                                        }, value: "", children: [_jsx("option", { value: "", disabled: true, children: t('create.op.style') }), REWRITE_STYLES.map(style => _jsx("option", { value: style, children: t(`create.style.${style}`) }, style))] }), _jsx("button", { type: "button", disabled: aiPending !== null, onClick: () => { void runTitles(); }, children: t('create.op.titles') }), _jsx("button", { type: "button", disabled: aiPending !== null, onClick: () => { void runEvaluate(); }, children: t('create.evaluate') }), templateLibrary != null && (_jsx("button", { type: "button", onClick: () => {
                                            templateLibrary.openPicker({
                                                category: 'creation',
                                                targetLabel: t('create.pickTemplate.target'),
                                                hasContent: () => editor.text.trim().length > 0,
                                                apply: (draft) => {
                                                    setEditor(prev => prev === null ? prev : { ...prev, text: draft.body });
                                                    setDirty(true);
                                                },
                                            });
                                        }, children: t('create.pickTemplate') })), aiPending === 'rewrite' && _jsx("span", { className: css.noticeLine, children: t('create.rewriting') })] }), _jsx("textarea", { ref: textareaRef, className: css.editorTextarea, value: editor.text, onChange: (event) => { setEditor({ ...editor, text: event.target.value }); setDirty(true); setNotice(null); } }), _jsxs("div", { className: css.statsLine, children: [_jsx("span", { children: t('create.words').replace('{n}', String(words)) }), _jsx("span", { children: t('create.reading').replace('{n}', String(minutes)) }), _jsx("span", { children: t('create.paragraphs').replace('{n}', String(localMetrics(editor.text).paragraphs)) }), persona.trim().length > 0 && _jsx("span", { children: t('create.profile.applied') })] }), rewritePreview !== null && (_jsxs("div", { children: [_jsxs("div", { className: workbenchCss.compActions, children: [_jsx("strong", { children: t('create.rewrite.preview') }), _jsx("button", { type: "button", className: workbenchCss.retry, onClick: () => { void applyRewrite(); }, children: t('create.rewrite.apply') }), _jsx("button", { type: "button", onClick: () => { setRewritePreview(null); }, children: t('create.rewrite.discard') })] }), _jsx("div", { className: css.diffBlock, children: diffRows.map((row, index) => (_jsx("div", { className: clsx(css.diffRow, row.kind === 'add' && css.diffAdd, row.kind === 'del' && css.diffDel), children: row.text }, index))) })] }))] }), _jsxs("div", { className: css.sideStack, children: [_jsxs("div", { children: [_jsx("strong", { children: t('create.context.title') }), _jsxs("div", { className: css.contextField, children: [_jsx("span", { className: css.versionMeta, children: t('create.context.audience') }), _jsx("textarea", { className: css.contextInput, value: editor.manifest.context.audience ?? '', onChange: (event) => {
                                                    setEditor({
                                                        ...editor,
                                                        manifest: { ...editor.manifest, context: { ...editor.manifest.context, audience: event.target.value || null } },
                                                    });
                                                    setDirty(true);
                                                } })] }), _jsxs("div", { className: css.contextField, children: [_jsx("span", { className: css.versionMeta, children: t('create.context.points') }), _jsx("textarea", { className: css.contextInput, value: editor.manifest.context.points ?? '', onChange: (event) => {
                                                    setEditor({
                                                        ...editor,
                                                        manifest: { ...editor.manifest, context: { ...editor.manifest.context, points: event.target.value || null } },
                                                    });
                                                    setDirty(true);
                                                } })] }), _jsxs("div", { className: css.contextField, children: [_jsx("span", { className: css.versionMeta, children: t('create.context.references') }), _jsx("textarea", { className: css.contextInput, value: editor.manifest.context.references ?? '', onChange: (event) => {
                                                    setEditor({
                                                        ...editor,
                                                        manifest: { ...editor.manifest, context: { ...editor.manifest.context, references: event.target.value || null } },
                                                    });
                                                    setDirty(true);
                                                } })] })] }), _jsxs("div", { children: [_jsxs("div", { className: workbenchCss.compActions, children: [_jsx("strong", { children: t('create.template.title') }), _jsx("button", { type: "button", onClick: () => { void loadTemplates(); }, children: templates === null ? t('create.template.load') : t('create.template.reload') }), templates !== null && (_jsx("button", { type: "button", onClick: () => { setTemplateForm({ id: null, title: '', body: '' }); }, children: t('create.template.new') }))] }), templateProblems.length > 0 && (_jsx("span", { className: css.aiError, children: t('create.template.problems').replace('{n}', String(templateProblems.length)) })), templates !== null && templateForm === null && (_jsxs("div", { children: [templates.length === 0 && _jsx("span", { className: css.versionMeta, children: t('create.template.empty') }), templates.map(template => (_jsxs("div", { className: css.bannedRow, children: [_jsxs("button", { type: "button", className: clsx(workbenchCss.chip, activeTemplateId === template.id && workbenchCss.chipCopied), onClick: () => { setActiveTemplateId(current => current === template.id ? null : template.id); }, children: [template.title, activeTemplateId === template.id ? ` · ${t('create.template.active')}` : ''] }), _jsxs("span", { className: css.versionActions, children: [_jsx("button", { type: "button", onClick: () => { setTemplateForm({ id: template.id, title: template.title, body: template.body }); }, children: t('create.template.edit') }), _jsx("button", { type: "button", onClick: () => { void removeTemplate(template.id); }, children: t('create.template.delete') })] })] }, template.id))), _jsx("span", { className: css.versionMeta, children: t('create.template.hint') })] })), templateForm !== null && (_jsxs("div", { className: css.contextField, children: [_jsx("input", { className: workbenchCss.compInput, value: templateForm.title, placeholder: t('create.template.namePlaceholder'), onChange: (event) => { setTemplateForm({ ...templateForm, title: event.target.value }); } }), _jsx("textarea", { className: css.contextInput, value: templateForm.body, rows: 6, placeholder: t('create.template.bodyPlaceholder'), onChange: (event) => { setTemplateForm({ ...templateForm, body: event.target.value }); } }), _jsxs("div", { className: css.versionActions, children: [_jsx("button", { type: "button", className: workbenchCss.retry, onClick: () => { void saveTemplate(); }, children: t('create.template.save') }), _jsx("button", { type: "button", onClick: () => { setTemplateForm(null); }, children: t('create.rewrite.discard') })] })] }))] }), _jsxs("div", { children: [_jsx("strong", { children: t('create.seo.title') }), _jsx("div", { className: css.versionActions, children: _jsx("button", { type: "button", onClick: () => { setSeoKeywords(extractKeywords(editor.text)); }, children: t('create.seo.extract') }) }), seoKeywords !== null && (_jsxs("div", { children: [seoKeywords.length === 0 && _jsx("span", { className: css.versionMeta, children: t('create.seo.none') }), _jsx("div", { children: seoKeywords.map(keyword => _jsxs("span", { className: css.bannedWord, children: [keyword, "\u3000"] }, keyword)) }), _jsxs("div", { className: css.contextField, children: [_jsx("span", { className: css.versionMeta, children: t('create.seo.region') }), _jsx("input", { className: workbenchCss.compInput, value: seoRegion, placeholder: t('create.seo.regionPlaceholder'), onChange: (event) => { setSeoRegion(event.target.value); } })] }), geoKeywords(seoRegion, seoKeywords).length > 0 && (_jsx("div", { children: geoKeywords(seoRegion, seoKeywords).map(combo => _jsxs("span", { className: css.bannedCat, children: [combo, "\u3000"] }, combo)) })), _jsx("span", { className: css.versionMeta, children: t('create.seo.layout') }), layoutSuggestions(editor.manifest.contentType).map(stem => (_jsx("div", { className: css.bannedRow, children: _jsxs("span", { className: css.versionMeta, children: ["\u00B7 ", t(`create.seo.layout.${stem}`)] }) }, stem)))] }))] }), _jsx("div", { children: titles !== null && (_jsxs("div", { children: [_jsx("strong", { children: t('create.titles.title') }), titles.length === 0 && _jsx("span", { className: css.versionMeta, children: t('create.banned.clean') }), titles.map(line => (_jsxs("div", { className: css.bannedRow, children: [_jsx("span", { children: line }), _jsx("span", { className: css.versionActions, children: _jsx("button", { type: "button", onClick: () => { setEditor({ ...editor, title: line }); setDirty(true); }, children: t('create.titles.use') }) })] }, line)))] })) }), _jsxs("div", { children: [_jsx("strong", { children: t('create.evaluation.title') }), evaluation === null && _jsx("div", { children: _jsx("span", { className: css.versionMeta, children: t('create.evaluation.none') }) }), evaluation !== null && (_jsxs("div", { className: css.versionRow, children: [_jsx("div", { className: css.versionHead, children: _jsx("strong", { children: t('create.evaluation.grade').replace('{grade}', evaluation.grade) }) }), [['attraction', 'create.evaluation.attraction'], ['readability', 'create.evaluation.readability'], ['differentiation', 'create.evaluation.differentiation'], ['audienceFit', 'create.evaluation.audienceFit']].map(([key, labelKey]) => (_jsxs("div", { className: css.bannedRow, children: [_jsx("span", { className: css.bannedCat, children: t(labelKey) }), _jsx("span", { className: css.bannedWord, children: evaluation[key].grade }), _jsx("span", { className: css.versionMeta, children: evaluation[key].reason })] }, key))), _jsx("span", { className: css.versionMeta, children: t('create.banned.disclaimer') })] }))] }), _jsxs("div", { children: [_jsx("strong", { children: t('create.hashtags.title') }), _jsxs("div", { className: css.versionActions, children: [_jsx("button", { type: "button", onClick: () => { suggestTags(); }, children: hashtags === null ? t('create.hashtags.suggest') : t('create.hashtags.resuggest') }), _jsx("button", { type: "button", disabled: hashtagPicks.length === 0, onClick: () => { insertHashtags(); }, children: t('create.hashtags.insert') })] }), hashtags !== null && (_jsxs("div", { children: [hashtags.length === 0 && _jsx("span", { className: css.versionMeta, children: t('create.hashtags.none') }), hashtags.map(tag => (_jsx("button", { type: "button", className: clsx(workbenchCss.chip, hashtagPicks.includes(tag) && workbenchCss.chipCopied), onClick: () => { toggleHashtag(tag); }, children: tag }, tag)))] }))] }), _jsxs("div", { children: [_jsxs("div", { className: workbenchCss.compActions, children: [_jsx("strong", { children: t('create.sources.title') }), _jsx("button", { type: "button", onClick: () => { void loadAssets(); }, children: assets === null ? t('create.sources.load') : t('create.sources.reload') })] }), assets !== null && (_jsxs("div", { children: [assets.length === 0 && _jsx("span", { className: css.versionMeta, children: t('create.sources.empty') }), assets.filter(file => !editor.manifest.sources.some(source => source.file === file)).map(file => (_jsxs("div", { className: css.bannedRow, children: [_jsx("span", { children: file }), _jsx("span", { className: css.versionActions, children: _jsx("button", { type: "button", onClick: () => { addSource(file); }, children: t('create.sources.add') }) })] }, file)))] })), editor.manifest.sources.map((source) => {
                                        const missing = assets !== null && source.file !== null && !assets.includes(source.file);
                                        return (_jsxs("div", { className: css.bannedRow, children: [_jsx("span", { children: source.file ?? source.title }), missing && _jsx("span", { className: css.aiError, children: t('create.sources.missing') }), _jsx("span", { className: css.versionActions, children: _jsx("button", { type: "button", onClick: () => { removeSource(source.file); }, children: t('gather.picked.clear') }) })] }, source.file ?? source.title));
                                    })] }), _jsxs("div", { children: [_jsxs("div", { className: workbenchCss.compActions, children: [_jsx("strong", { children: t('create.versions') }), _jsx("button", { type: "button", onClick: () => { setBanned(scanBannedWords(editor.text)); }, children: banned === null ? t('create.banned.run') : t('create.banned.rescan') })] }), banned !== null && (_jsxs("div", { children: [banned.length === 0 && _jsx("span", { className: css.versionMeta, children: t('create.banned.clean') }), banned.map(hit => (_jsxs("div", { className: css.bannedRow, children: [_jsx("span", { className: css.bannedWord, children: hit.word }), _jsx("span", { className: css.bannedCat, children: t(`create.banned.cat.${hit.category}`) }), _jsx("span", { className: css.bannedCount, children: t('create.banned.count').replace('{n}', String(hit.count)) })] }, hit.word))), _jsx("span", { className: css.versionMeta, children: t('create.banned.disclaimer') })] }))] }), _jsxs("div", { children: [editor.manifest.versions.length === 0 && _jsx("span", { className: css.versionMeta, children: t('create.versions.empty') }), [...editor.manifest.versions].reverse().map(version => (_jsxs("div", { className: css.versionRow, children: [_jsxs("div", { className: css.versionHead, children: [_jsxs("strong", { children: ["v", version.v, version.v === editor.manifest.currentVersion && _jsxs("span", { children: [" \u00B7 ", t('create.version.current')] }), version.pinned && _jsx("span", { children: " \uD83D\uDCCC" })] }), _jsxs("span", { className: css.versionActions, children: [_jsx("button", { type: "button", onClick: () => { setEditor({ ...editor, text: versionContent(editor.manifest, version.v) ?? editor.text }); setDirty(true); }, children: t('create.version.restore') }), _jsx("button", { type: "button", onClick: () => {
                                                                    const next = pinVersion(editor.manifest, version.v);
                                                                    if (next !== editor.manifest) {
                                                                        setEditor({ ...editor, manifest: next });
                                                                        setDirty(true);
                                                                    }
                                                                }, children: version.pinned ? t('create.version.unpin') : t('create.version.pin') })] })] }), _jsxs("span", { className: css.versionMeta, children: [t(`create.trigger.${triggerClass(version.trigger)}`), " \u00B7 ", t('create.words').replace('{n}', String(version.words)), version.evaluation != null && _jsxs("span", { children: [" \u00B7 ", t('create.evaluation.grade').replace('{grade}', version.evaluation.grade)] })] })] }, version.v)))] })] })] })] }));
}
//# sourceMappingURL=CreateView.js.map