/**
 * The create workbench view: three entries (blank new as the main path,
 * paste-a-topic, and the topic-bank push once that column ships), then the
 * editor — one-shot generation, selection rewrites with a diff preview,
 * version snapshots with a pin/prune quota, the local banned-word pre-check,
 * and the copy-plus-register publish handoff. The capability card catalog
 * stays reachable behind the 指令库 toggle. Editor logic lives in the pure
 * `create.ts` / `banned-words.ts` modules; this surface only orchestrates.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import type {
  CreateContentType, CreateEvaluation, CreateManifest, CreatePublishRequest, CreatePublishResult,
  CreateRegisterRequest, CreateRewriteOperation, CreateRewriteRequest, CreateStateRead,
  CreateStyleKey, CreateAiResult, CreateTemplate, CreateTemplateInput, OutputMetadata,
} from '@deepseek-ai/dsh-content-outputs/types'
import type { ContentScheduleSnapshot, ScheduleItemInput } from '@deepseek-ai/dsh-content-schedule/types'
import type { ContentTopicsSnapshot, TopicItemInput } from '@deepseek-ai/dsh-content-topics/types'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { extractKeywords, geoKeywords, layoutSuggestions } from './seo.ts'
import {
  appendHashtagBlock, appendVersion, buildExportMarkdown, contentTypeKind, countWords, defaultManifest,
  deliverableName, exportFileName, formatHashtags, lineDiff, localMetrics, mergeManualSave, newId,
  pinVersion, readingMinutes, replaceRange, suggestHashtags, triggerClass, versionContent,
  isBatchable, REWRITE_STYLES,
} from './create.ts'
import { scanBannedWords, type BannedHit } from './banned-words.ts'
import type { TemplateController } from './template/template-store.ts'
import type { PickedMaterial, PickedTopic } from './studio-store.ts'
import type { StudioKey } from './locales.ts'
import workbenchCss from './ContentStudio.module.css'
import css from './CreateView.module.css'

/** Server face of the create workbench, served by the content-outputs Remote. */
export interface CreateGateway {
  readCreateState(theme: string): Promise<CreateStateRead>
  writeCreateState(theme: string, manifest: CreateManifest): Promise<void>
  writeAsset(theme: string, file: string, content: string): Promise<{ truncated: boolean }>
  publishCreateFinal(theme: string, request: CreatePublishRequest): Promise<CreatePublishResult>
  registerCreatePublish(theme: string, request: CreateRegisterRequest): Promise<void>
  readCreateMetadata(theme: string): Promise<{ metadata: OutputMetadata | null; problem: string | null }>
  writeCreateMetadata(theme: string, metadata: OutputMetadata): Promise<void>
  listCreateAssets(theme: string): Promise<{ files: readonly string[] }>
  generateCreateContent(request: {
    contentType: CreateContentType
    title: string
    audience: string | null
    points: string | null
    references: string | null
    profileDigest: string | null
    count?: 1 | 3
    customTemplate?: { readonly id: string; readonly revision: number; readonly body: string } | null
  }): Promise<CreateAiResult>
  rewriteCreateSelection(request: CreateRewriteRequest): Promise<CreateAiResult>
  evaluateCreateContent(request: { contentType: CreateContentType; title: string; text: string }): Promise<CreateEvaluation>
  listCreateTemplates(): Promise<{ templates: readonly CreateTemplate[]; problems: readonly string[] }>
  putCreateTemplate(input: CreateTemplateInput): Promise<{ templates: readonly CreateTemplate[] }>
  deleteCreateTemplate(id: string): Promise<{ templates: readonly CreateTemplate[] }>
}

/** The selection rewrites the toolbar offers; titles runs on the whole text. */
const SELECTION_OPS: readonly CreateRewriteOperation[] = ['condense', 'expand', 'style', 'perspective', 'extract', 'humanize-light', 'humanize-deep']

/** One batch card of the multi-variant generation. */
export type BatchCard = { kind: 'pending' } | { kind: 'done'; text: string } | { kind: 'failed'; detail: string }

/** Classify an AI failure for its locale stem: quota, paid tier, or generic. */
export function aiErrorClass(message: string): 'quota' | 'paid' | 'generic' {
  if (message.includes('quota exceeded')) return 'quota'
  if (message.includes('paid tier')) return 'paid'
  return 'generic'
}

/** Injected face of the create view. */
export interface CreateViewProps {
  readonly create: CreateGateway
  /** Current theme directory names, from the outputs projection. */
  readonly listThemes: () => Promise<readonly string[]>
  /** The active account persona text, applied as the inline style reference. */
  readonly persona: string
  /** Material handed over from the gather view, if any. */
  readonly picked: PickedMaterial | null
  readonly onClearPicked: () => void
  /** Topic handed over from the topic bank, if any. */
  readonly pickedTopic: PickedTopic | null
  readonly onClearPickedTopic: () => void
  /** The topic-bank face, for the finalize write-back. */
  readonly topics: {
    list(): Promise<ContentTopicsSnapshot>
    put(input: TopicItemInput): Promise<unknown>
  }
  /** The schedule face, for pushing the linked calendar entry to published. */
  readonly schedule: {
    list(): Promise<ContentScheduleSnapshot>
    put(input: ScheduleItemInput): Promise<ContentScheduleSnapshot>
  }
  /** The publish-view handoff for a registered deliverable; absent when the publish view is not mounted. */
  readonly onSendToPublish?: (manuscript: {
    readonly theme: string
    readonly file: string
    readonly title: string
    readonly topicId: string | null
  }) => void
  /** The capability card catalog, reachable behind the 指令库 toggle. */
  readonly catalog: ReactNode
  /** The global template library controller; absent hides the 模板 picker entry. */
  readonly templateLibrary?: TemplateController | null
  readonly t: PropsLocale<'content-studio'>['t']
}

type EntryMode = 'blank' | 'paste'

/** The loaded editor state; every field is component-local until saved. */
interface EditorState {
  readonly theme: string
  readonly manifest: CreateManifest
  readonly text: string
  readonly title: string
  readonly publishedFile: string | null
}

/** Style provenance of the current persona: inline text, or none. */
function profileRefOf(persona: string): { mode: 'inline'; digest: string } | null {
  const digest = persona.trim().slice(0, 500)
  return digest.length > 0 ? { mode: 'inline', digest } : null
}

/** Parse a pasted topic brief: the first non-empty line is the title. */
function parseBrief(pasted: string): { title: string; rest: string } {
  const lines = pasted.split('\n')
  let title = ''
  let restIndex = 0
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim().replace(/^#+\s*/, '') ?? ''
    if (line.length > 0) {
      title = line
      restIndex = index + 1
      break
    }
  }
  return { title, rest: lines.slice(restIndex).join('\n').trim() }
}

/**
 * Render the create workbench view.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export function CreateView({
  create, listThemes, persona, picked, onClearPicked, pickedTopic, onClearPickedTopic, topics, schedule,
  onSendToPublish, catalog, templateLibrary, t,
}: CreateViewProps) {
  const [showCatalog, setShowCatalog] = useState(false)
  const [entryMode, setEntryMode] = useState<EntryMode>('blank')
  const [themeChoice, setThemeChoice] = useState<'new' | 'existing'>('new')
  const [newThemeName, setNewThemeName] = useState('')
  const [existingTheme, setExistingTheme] = useState('')
  const [themes, setThemes] = useState<readonly string[]>([])
  const [title, setTitle] = useState('')
  const [pasted, setPasted] = useState('')
  const [entryError, setEntryError] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aiPending, setAiPending] = useState<'generate' | 'rewrite' | null>(null)
  const [rewritePreview, setRewritePreview] = useState<{
    operation: CreateRewriteOperation
    start: number
    end: number
    before: string
    after: string
  } | null>(null)
  const [banned, setBanned] = useState<readonly BannedHit[] | null>(null)
  const [overwritePending, setOverwritePending] = useState<string | null>(null)
  const [registerRetry, setRegisterRetry] = useState<string | null>(null)
  const [count, setCount] = useState<1 | 3>(1)
  const [batch, setBatch] = useState<readonly BatchCard[] | null>(null)
  const [evaluation, setEvaluation] = useState<CreateEvaluation | null>(null)
  const [titles, setTitles] = useState<readonly string[] | null>(null)
  const [hashtags, setHashtags] = useState<readonly string[] | null>(null)
  const [hashtagPicks, setHashtagPicks] = useState<readonly string[]>([])
  const [assets, setAssets] = useState<readonly string[] | null>(null)
  const [pendingTopic, setPendingTopic] = useState<PickedTopic | null>(null)
  const [writebackFailed, setWritebackFailed] = useState(false)
  const [templates, setTemplates] = useState<readonly CreateTemplate[] | null>(null)
  const [templateProblems, setTemplateProblems] = useState<readonly string[]>([])
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [templateForm, setTemplateForm] = useState<{ id: string | null; title: string; body: string } | null>(null)
  const [seoKeywords, setSeoKeywords] = useState<readonly string[] | null>(null)
  const [seoRegion, setSeoRegion] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const activeTemplate = templates?.find(template => template.id === activeTemplateId) ?? null

  useEffect(() => {
    let alive = true
    listThemes().then((names) => {
      if (alive) setThemes(names)
    }).catch(() => {
      if (alive) setThemes([])
    })
    return () => { alive = false }
  }, [listThemes])

  // The gather handoff lands once: turn it into a reference line.
  useEffect(() => {
    if (picked === null) return
    const line = `${picked.title}（${picked.url}）`
    setTitle(current => current.length > 0 ? current : picked.title)
    setPasted(current => current.length > 0 ? `${current}\n${line}` : line)
    setEntryMode('paste')
    onClearPicked()
  }, [picked, onClearPicked])

  // The topic-bank handoff lands once: title plus the brief fields fold into
  // the paste entry (mirroring the gather handoff), and the topic id rides
  // into the manifest's topicRef so the finalize write-back can find it.
  useEffect(() => {
    if (pickedTopic === null) return
    const brief = [pickedTopic.oneLiner ?? '', pickedTopic.description ?? ''].filter(part => part.trim().length > 0).join('\n')
    setTitle(current => current.length > 0 ? current : pickedTopic.title)
    setPasted(current => current.length > 0 ? `${current}\n${brief}` : brief)
    setPendingTopic(pickedTopic)
    setEntryMode('paste')
    onClearPickedTopic()
  }, [pickedTopic, onClearPickedTopic])

  /** The topic ref a new creation starts from, when one was handed over. */
  const topicRefOf = (workTitle: string): { topicId: string; title: string; syncState: 'linked' } | null =>
    pendingTopic === null ? null : { topicId: pendingTopic.id, title: pendingTopic.title.length > 0 ? pendingTopic.title : workTitle, syncState: 'linked' }

  const text = editor?.text ?? ''
  const words = countWords(text)
  const minutes = editor === null ? 1 : readingMinutes(words, editor.manifest.contentType)

  const startBlank = (): void => {
    const trimmed = title.trim()
    const themeName = newThemeName.trim()
    if (trimmed.length === 0) { setEntryError(t('create.error.title')); return }
    if (themeChoice === 'new' && themeName.length === 0) { setEntryError(t('create.error.theme')); return }
    setEntryError(null)
    setError(null)
    setNotice(null)
    const manifest = { ...defaultManifest(newId(), 'gzh-article'), topicRef: topicRefOf(trimmed) }
    setEditor({
      theme: themeChoice === 'new' ? themeName : existingTheme,
      manifest,
      text: '',
      title: trimmed,
      publishedFile: null,
    })
    setDirty(false)
    setBanned(null)
    setRewritePreview(null)
    setOverwritePending(null)
    setRegisterRetry(null)
  }

  const startPasted = (): void => {
    if (pasted.trim().length === 0) { setEntryError(t('create.error.title')); return }
    const themeName = newThemeName.trim()
    if (themeChoice === 'new' && themeName.length === 0) { setEntryError(t('create.error.theme')); return }
    const brief = parseBrief(pasted)
    if (brief.title.length === 0) { setEntryError(t('create.error.title')); return }
    setEntryError(null)
    setError(null)
    setNotice(null)
    const workTitle = title.trim().length > 0 ? title.trim() : brief.title
    const manifest = { ...defaultManifest(newId(), 'gzh-article'), topicRef: topicRefOf(workTitle) }
    setEditor({
      theme: themeChoice === 'new' ? themeName : existingTheme,
      manifest,
      text: '',
      title: workTitle,
      publishedFile: null,
    })
    setDirty(false)
    setBanned(null)
    setRewritePreview(null)
    setOverwritePending(null)
    setRegisterRetry(null)
  }

  const openTheme = async (theme: string): Promise<void> => {
    setError(null)
    setNotice(null)
    try {
      const state = await create.readCreateState(theme)
      if (state.manifest === null) {
        if (state.problems.length > 0) {
          setError(t('create.manifestProblem').replace('{detail}', state.problems.join('；')))
          return
        }
        setEntryError(t('create.versions.empty'))
        return
      }
      const metadata = await create.readCreateMetadata(theme)
      const newest = state.manifest.versions.at(-1)
      setEditor({
        theme,
        manifest: state.manifest,
        text: state.draft ?? newest?.content ?? '',
        title: metadata.metadata?.title ?? theme,
        publishedFile: null,
      })
      setDirty(false)
      setBanned(null)
      setRewritePreview(null)
      setOverwritePending(null)
      setRegisterRetry(null)
    } catch (cause) {
      setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)))
    }
  }

  /** Persist the draft, the manifest, and (create-or-merge) the metadata. */
  const persist = async (nextManifest: CreateManifest, nextText: string, nextTitle: string): Promise<void> => {
    const theme = editor?.theme ?? ''
    await create.writeAsset(theme, `${nextManifest.contentId}.md`, nextText)
    await create.writeCreateState(theme, nextManifest)
    const existing = await create.readCreateMetadata(theme)
    if (existing.metadata === null) {
      if (existing.problem !== null) {
        setError(t('create.metadataProblem').replace('{detail}', existing.problem))
      } else {
        await create.writeCreateMetadata(theme, {
          formatVersion: 0,
          title: nextTitle,
          kind: contentTypeKind(nextManifest.contentType),
          platform: null,
          status: 'draft',
          tags: [],
          summary: null,
        })
      }
    } else if (existing.metadata.title !== nextTitle || existing.metadata.kind !== contentTypeKind(nextManifest.contentType)) {
      await create.writeCreateMetadata(theme, {
        ...existing.metadata,
        title: nextTitle,
        kind: contentTypeKind(nextManifest.contentType),
      })
    }
    setEditor(current => current === null ? current : { ...current, manifest: nextManifest, text: nextText, title: nextTitle })
    setDirty(false)
    setNotice(t('create.saved').replace('{n}', String(nextManifest.currentVersion)))
  }

  const save = async (): Promise<void> => {
    if (editor === null) return
    const merged = mergeManualSave(editor.manifest, {
      content: editor.text, now: new Date().toISOString(), profileRef: profileRefOf(persona),
    })
    try {
      await persist(merged.manifest, editor.text, editor.title)
    } catch (cause) {
      setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)))
    }
  }

  /** One generation request for the editor's current context. */
  const generateOnce = async (manifest: CreateManifest, workTitle: string): Promise<CreateAiResult> =>
    create.generateCreateContent({
      contentType: manifest.contentType,
      title: workTitle,
      audience: manifest.context.audience,
      points: manifest.context.points,
      references: manifest.context.references,
      profileDigest: persona.trim().length > 0 ? persona.trim() : null,
      count: 1,
      customTemplate: activeTemplate === null
        ? null : { id: activeTemplate.id, revision: activeTemplate.revision, body: activeTemplate.body },
    })

  /** Attach the advisory evaluation to the current version, best effort. */
  const evaluateCurrentVersion = async (theme: string, manifest: CreateManifest, workTitle: string, body: string): Promise<void> => {
    try {
      const result = await create.evaluateCreateContent({ contentType: manifest.contentType, title: workTitle, text: body })
      const versions = manifest.versions.map(version => (
        version.v === manifest.currentVersion ? { ...version, evaluation: result } : version
      ))
      await create.writeCreateState(theme, { ...manifest, versions })
      setEvaluation(result)
      setEditor(current => current === null ? current : { ...current, manifest: { ...current.manifest, versions } })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      // Evaluation is advisory: a failure never blocks the draft; the error
      // line names quota rejections and generic failures alike.
      setError(t('create.aiFailed').replace('{detail}', message))
    }
  }

  /** Adopt one batch card as the working draft: snapshot it, then evaluate. */
  const adoptBatchCard = async (index: number): Promise<void> => {
    if (editor === null || batch === null) return
    const card = batch[index]
    if (card === undefined || card.kind !== 'done') return
    const trigger = batch.length > 1 ? `ai-generate#${index + 1}` : 'ai-generate'
    const nextManifest = appendVersion(editor.manifest, {
      content: card.text,
      trigger,
      now: new Date().toISOString(),
      profileRef: profileRefOf(persona),
    })
    try {
      await persist(nextManifest, card.text, editor.title)
    } catch (cause) {
      setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)))
      return
    }
    void evaluateCurrentVersion(editor.theme, nextManifest, editor.title, card.text)
  }

  const generate = async (): Promise<void> => {
    if (editor === null || aiPending !== null) return
    const requested = count
    const batchable = isBatchable(editor.manifest.contentType)
    if (requested === 3 && !batchable) {
      // Long types ride serial single calls: cards fill as each returns, one
      // failure never takes the others down, and a quota wall stops the run.
      setAiPending('generate')
      setError(null)
      setBatch([ { kind: 'pending' }, { kind: 'pending' }, { kind: 'pending' } ])
      let stopped = false
      for (let index = 0; index < 3; index += 1) {
        try {
          const result = await generateOnce(editor.manifest, editor.title)
          setBatch(current => current === null ? current : current.map((card, at) => at === index ? { kind: 'done', text: result.text } : card))
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause)
          setBatch(current => current === null ? current : current.map((card, at) => at === index ? { kind: 'failed', detail: message } : card))
          if (aiErrorClass(message) !== 'generic') {
            setError(t('create.batch.degraded').replace('{detail}', message))
            stopped = true
          }
        }
        if (stopped) break
      }
      setAiPending(null)
      return
    }
    setAiPending('generate')
    setError(null)
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
      })
      if (result.variants !== null) {
        setBatch(result.variants.map(text => ({ kind: 'done' as const, text })))
        setNotice(t('create.batch.done'))
      } else {
        const nextManifest = appendVersion(editor.manifest, {
          content: result.text,
          trigger: 'ai-generate',
          now: new Date().toISOString(),
          profileRef: profileRefOf(persona),
        })
        await persist(nextManifest, result.text, editor.title)
        void evaluateCurrentVersion(editor.theme, nextManifest, editor.title, result.text)
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      if (aiErrorClass(message) === 'quota') setError(t('create.error.quota'))
      else if (aiErrorClass(message) === 'paid') setError(t('create.error.paid'))
      else setError(t('create.aiFailed').replace('{detail}', message))
    } finally {
      setAiPending(null)
    }
  }

  const runEvaluate = async (): Promise<void> => {
    if (editor === null || aiPending !== null || editor.text.trim().length === 0) return
    setAiPending('rewrite')
    setError(null)
    try {
      const result = await create.evaluateCreateContent({
        contentType: editor.manifest.contentType,
        title: editor.title,
        text: editor.text,
      })
      const versions = editor.manifest.versions.map(version => (
        version.v === editor.manifest.currentVersion ? { ...version, evaluation: result } : version
      ))
      await create.writeCreateState(editor.theme, { ...editor.manifest, versions })
      setEditor({ ...editor, manifest: { ...editor.manifest, versions } })
      setEvaluation(result)
      setNotice(t('create.evaluated'))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      if (aiErrorClass(message) === 'quota') setError(t('create.error.quota'))
      else if (aiErrorClass(message) === 'paid') setError(t('create.error.paid'))
      else setError(t('create.aiFailed').replace('{detail}', message))
    } finally {
      setAiPending(null)
    }
  }

  /** Title batch rides the rewrite face over the whole text, no selection needed. */
  const runTitles = async (): Promise<void> => {
    if (editor === null || aiPending !== null || editor.text.trim().length === 0) {
      setNotice(t('create.rewrite.needSelection'))
      return
    }
    setAiPending('rewrite')
    setError(null)
    try {
      const result = await create.rewriteCreateSelection({ operation: 'titles', style: null, text: editor.text })
      setTitles(result.text.split('\n').map(line => line.trim().replace(/^[-*]\s*/, '')).filter(line => line.length > 0).slice(0, 8))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      if (aiErrorClass(message) === 'quota') setError(t('create.error.quota'))
      else if (aiErrorClass(message) === 'paid') setError(t('create.error.paid'))
      else setError(t('create.aiFailed').replace('{detail}', message))
    } finally {
      setAiPending(null)
    }
  }

  const suggestTags = (): void => {
    if (editor === null) return
    setHashtags(suggestHashtags(editor.title, editor.text))
    setHashtagPicks([])
  }

  const toggleHashtag = (tag: string): void => {
    setHashtagPicks(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag])
  }

  const insertHashtags = (): void => {
    if (editor === null) return
    const block = formatHashtags(hashtagPicks, editor.manifest.contentType)
    if (block.length === 0) return
    setEditor({ ...editor, text: appendHashtagBlock(editor.text, block) })
    setDirty(true)
    setNotice(t('create.hashtags.inserted'))
  }

  const loadAssets = async (): Promise<void> => {
    if (editor === null) return
    try {
      const list = await create.listCreateAssets(editor.theme)
      setAssets(list.files)
    } catch (cause) {
      setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)))
    }
  }

  const addSource = (file: string): void => {
    if (editor === null) return
    if (editor.manifest.sources.some(source => source.file === file)) return
    const kind = file.endsWith('.html') ? 'gather' : 'image'
    setEditor({
      ...editor,
      manifest: {
        ...editor.manifest,
        sources: [...editor.manifest.sources, {
          kind, refId: null, file, title: file, url: null, addedAt: new Date().toISOString(),
        }],
      },
    })
    setDirty(true)
  }

  const removeSource = (file: string | null): void => {
    if (editor === null) return
    setEditor({ ...editor, manifest: { ...editor.manifest, sources: editor.manifest.sources.filter(source => source.file !== file) } })
    setDirty(true)
  }


  const runRewrite = async (operation: CreateRewriteOperation, style: CreateStyleKey | null): Promise<void> => {
    if (editor === null || aiPending !== null) return
    const node = textareaRef.current
    if (node === null || node.selectionStart === node.selectionEnd) {
      setNotice(t('create.rewrite.needSelection'))
      return
    }
    const start = node.selectionStart
    const end = node.selectionEnd
    const before = editor.text.slice(start, end)
    setAiPending('rewrite')
    setError(null)
    try {
      const result = await create.rewriteCreateSelection({
        operation,
        style: operation === 'style' ? style : null,
        text: before,
      })
      setRewritePreview({ operation, start, end, before, after: result.text })
    } catch (cause) {
      setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)))
    } finally {
      setAiPending(null)
    }
  }

  const applyRewrite = async (): Promise<void> => {
    if (editor === null || rewritePreview === null) return
    const nextText = replaceRange(editor.text, rewritePreview.start, rewritePreview.end, rewritePreview.after)
    const nextManifest = appendVersion(editor.manifest, {
      content: nextText,
      trigger: `rewrite:${rewritePreview.operation}`,
      now: new Date().toISOString(),
      profileRef: profileRefOf(persona),
    })
    setRewritePreview(null)
    try {
      await persist(nextManifest, nextText, editor.title)
    } catch (cause) {
      setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)))
    }
  }

  /**
   * The module-6 write-back: flip the linked topic to done and its calendar
   * entry to published, both idempotent reads-then-writes, both failures
   * non-fatal (the ref degrades to pendingSync for the retry button).
   */
  const runWriteback = async (state: EditorState): Promise<void> => {
    const ref = state.manifest.topicRef
    if (ref === null || ref.topicId === null || ref.syncState === 'completed') return
    try {
      const snapshot = await topics.list()
      const item = snapshot.items.find(candidate => candidate.id === ref.topicId)
      if (item === undefined) {
        const nextManifest = { ...state.manifest, topicRef: { ...ref, syncState: 'orphan' as const } }
        await create.writeCreateState(state.theme, nextManifest)
        setEditor({ ...state, manifest: nextManifest })
        setWritebackFailed(false)
        return
      }
      if (item.status !== 'done') await topics.put({ ...item, status: 'done' })
      if (item.scheduleItemId !== null) {
        const calendar = await schedule.list()
        const entry = calendar.items.find(candidate => candidate.id === item.scheduleItemId)
        if (entry !== undefined && entry.status !== 'published') {
          await schedule.put({ ...entry, status: 'published' })
        }
      }
      const nextManifest = { ...state.manifest, topicRef: { ...ref, syncState: 'completed' as const } }
      await create.writeCreateState(state.theme, nextManifest)
      setEditor({ ...state, manifest: nextManifest })
      setWritebackFailed(false)
      setNotice(t('create.writeback.done'))
    } catch {
      // The topic bank (or calendar) is unreachable: keep the intent local.
      try {
        const nextManifest = { ...state.manifest, topicRef: { ...ref, syncState: 'pendingSync' as const } }
        await create.writeCreateState(state.theme, nextManifest)
        setEditor({ ...state, manifest: nextManifest })
      } catch { /* the local intent write failing keeps the retry button armed */ }
      setWritebackFailed(true)
    }
  }

  const detachTopic = async (): Promise<void> => {
    if (editor === null) return
    const nextManifest = { ...editor.manifest, topicRef: null }
    try {
      await create.writeCreateState(editor.theme, nextManifest)
      setEditor({ ...editor, manifest: nextManifest })
      setWritebackFailed(false)
    } catch (cause) {
      setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)))
    }
  }

  const loadTemplates = async (): Promise<void> => {
    try {
      const list = await create.listCreateTemplates()
      setTemplates(list.templates)
      setTemplateProblems(list.problems)
      if (activeTemplateId !== null && !list.templates.some(template => template.id === activeTemplateId)) {
        setActiveTemplateId(null)
      }
    } catch (cause) {
      setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)))
    }
  }

  const saveTemplate = async (): Promise<void> => {
    if (templateForm === null) return
    try {
      const base = { title: templateForm.title, contentType: editor?.manifest.contentType ?? 'gzh-article' as const, body: templateForm.body }
      const list = templateForm.id === null
        ? await create.putCreateTemplate(base)
        : await create.putCreateTemplate({ ...base, id: templateForm.id })
      setTemplates(list.templates)
      setTemplateForm(null)
      setNotice(t('create.template.saved'))
    } catch (cause) {
      setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)))
    }
  }

  const removeTemplate = async (id: string): Promise<void> => {
    if (!window.confirm(t('create.template.deleteConfirm'))) return
    try {
      const list = await create.deleteCreateTemplate(id)
      setTemplates(list.templates)
      if (activeTemplateId === id) setActiveTemplateId(null)
    } catch (cause) {
      setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)))
    }
  }

  const publish = async (overwrite: boolean): Promise<void> => {
    if (editor === null) return
    const file = deliverableName(editor.title, editor.manifest.contentId)
    setError(null)
    setOverwritePending(null)
    try {
      if (dirty) await save()
      await create.publishCreateFinal(editor.theme, { file, content: editor.text, overwrite })
      try {
        await create.registerCreatePublish(editor.theme, { file, version: editor.manifest.currentVersion })
      } catch (cause) {
        setRegisterRetry(file)
        setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)))
        return
      }
      setEditor(current => current === null ? current : { ...current, publishedFile: file })
      setNotice(t('create.published').replace('{file}', file))
      // The write-back runs after the deliverable is safely registered; its
      // own failures degrade to pendingSync, never to a failed publish.
      await runWriteback({ ...editor, publishedFile: file })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      if (message.includes('already exists')) {
        setOverwritePending(file)
        return
      }
      setError(t('create.aiFailed').replace('{detail}', message))
    }
  }

  const runExport = async (): Promise<void> => {
    if (editor === null) return
    const file = exportFileName(editor.title, editor.manifest.contentId)
    try {
      await create.writeAsset(editor.theme, file, buildExportMarkdown({
        title: editor.title,
        contentType: editor.manifest.contentType,
        status: editor.publishedFile === null ? 'draft' : 'published',
        version: editor.manifest.currentVersion,
        exportedAt: new Date().toISOString(),
      }, editor.text))
      setNotice(t('create.exported').replace('{file}', file))
    } catch (cause) {
      setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)))
    }
  }

  const retarget = async (contentType: CreateContentType): Promise<void> => {
    if (editor === null || editor.manifest.contentType === contentType) return
    const nextManifest = { ...editor.manifest, contentType }
    if (editor.text.trim().length === 0) {
      setEditor({ ...editor, manifest: nextManifest })
      setDirty(true)
      return
    }
    const withVersion = appendVersion(nextManifest, {
      content: editor.text,
      trigger: 'retarget',
      now: new Date().toISOString(),
      profileRef: profileRefOf(persona),
    })
    try {
      await persist(withVersion, editor.text, editor.title)
    } catch (cause) {
      setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)))
    }
  }

  if (editor === null) {
    return (
      <div>
        <button type="button" className={css.catalogToggle} onClick={() => { setShowCatalog(value => !value) }}>
          {showCatalog ? t('create.tab.workbench') : t('create.tab.catalog')}
        </button>
        {showCatalog && catalog}
        {!showCatalog && (
          <div className={workbenchCss.compForm}>
            <div className={css.entryGrid}>
              <button type="button" className={clsx(css.entryCard, entryMode === 'blank' && css.entryCardActive)} onClick={() => { setEntryMode('blank') }}>
                <span className={css.entryCardTitle}>{t('create.entry.blank')}</span>
                <span className={css.entryCardHint}>{t('create.entry.blankHint')}</span>
              </button>
              <button type="button" className={clsx(css.entryCard, entryMode === 'paste' && css.entryCardActive)} onClick={() => { setEntryMode('paste') }}>
                <span className={css.entryCardTitle}>{t('create.entry.paste')}</span>
                <span className={css.entryCardHint}>{t('create.entry.pasteHint')}</span>
              </button>
            </div>
            {entryMode === 'paste' && (
              <div className={workbenchCss.compFormRow}>
                <span className={workbenchCss.compFieldLabel}>{t('create.entry.pastePlaceholder')}</span>
                <textarea
                  className={workbenchCss.compTextarea}
                  value={pasted}
                  rows={5}
                  onChange={(event) => { setPasted(event.target.value) }}
                />
              </div>
            )}
            <div className={workbenchCss.compFormRow}>
              <span className={workbenchCss.compFieldLabel}>{t('create.entry.title')}</span>
              {entryMode === 'blank' && <input className={workbenchCss.compInput} value={title} placeholder={t('create.entry.titlePlaceholder')} onChange={(event) => { setTitle(event.target.value) }} />}
            </div>
            <div className={workbenchCss.compFormRow}>
              <span className={workbenchCss.compFieldLabel}>{t('create.entry.theme')}</span>
              <label className={css.versionMeta}>
                <input type="radio" checked={themeChoice === 'new'} onChange={() => { setThemeChoice('new') }} />
                {t('create.entry.themeNew')}
              </label>
              {themes.length > 0 && (
                <label className={css.versionMeta}>
                  <input type="radio" checked={themeChoice === 'existing'} onChange={() => { setThemeChoice('existing') }} />
                  {t('create.entry.themeExisting')}
                  <select
                    value={existingTheme}
                    disabled={themeChoice !== 'existing'}
                    onChange={(event) => { setExistingTheme(event.target.value) }}
                  >
                    <option value="" disabled>—</option>
                    {themes.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
              )}
              {themeChoice === 'new' && (
                <input className={workbenchCss.compInput} value={newThemeName} placeholder={t('create.entry.themePlaceholder')} onChange={(event) => { setNewThemeName(event.target.value) }} />
              )}
            </div>
            {entryError !== null && <span className={css.aiError}>{entryError}</span>}
            <div className={workbenchCss.compActions}>
              <button
                type="button"
                className={workbenchCss.retry}
                onClick={() => {
                  if (entryMode === 'blank') { startBlank() } else { startPasted() }
                }}>
                {t('create.entry.start')}
              </button>
              {themes.map(name => (
                <button key={name} type="button" className={workbenchCss.chip} onClick={() => { void openTheme(name) }}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const diffRows = rewritePreview === null ? [] : lineDiff(rewritePreview.before, rewritePreview.after)

  return (
    <div>
      <div className={workbenchCss.compDetailHead}>
        <input
          className={workbenchCss.compInput}
          value={editor.title}
          aria-label={t('create.entry.title')}
          onChange={(event) => { setEditor({ ...editor, title: event.target.value }); setDirty(true) }}
        />
        <select value={editor.manifest.contentType} aria-label={t('create.type.label')} onChange={(event) => { void retarget(event.target.value as CreateContentType) }}>
          {(['gzh-article', 'xhs-note', 'video-script', 'voiceover', 'product-page', 'rewrite'] as const).map(id => (
            <option key={id} value={id}>{t(`create.type.${id}`)}</option>
          ))}
        </select>
        <span className={`${workbenchCss.badge} ${editor.publishedFile === null ? workbenchCss.statusDraft : workbenchCss.statusPublished}`}>
          {editor.publishedFile === null ? t('status.draft') : t('status.published')}
        </span>
      </div>
      <div className={workbenchCss.compActions}>
        <button type="button" className={workbenchCss.retry} disabled={aiPending !== null} onClick={() => { void generate() }}>
          {aiPending === 'generate' ? t('create.generating') : t('create.generate')}
        </button>
        <label className={css.versionMeta}>
          <input type="radio" checked={count === 1} onChange={() => { setCount(1) }} />
          {t('create.count.one')}
        </label>
        <label className={css.versionMeta}>
          <input type="radio" checked={count === 3} disabled={!isBatchable(editor.manifest.contentType)} onChange={() => { setCount(3) }} />
          {t('create.count.three')}
        </label>
        <button type="button" disabled={aiPending !== null} onClick={() => { void save() }}>{t('create.save')}</button>
        <button type="button" disabled={aiPending !== null} onClick={() => { void publish(false) }}>{t('create.publish')}</button>
        {onSendToPublish !== undefined && editor.publishedFile !== null && (
          <button
            type="button" className={workbenchCss.retry}
            onClick={() => {
              onSendToPublish({
                theme: editor.theme,
                file: editor.publishedFile as string,
                title: editor.title.trim().length > 0 ? editor.title.trim() : editor.publishedFile as string,
                // The linked creation topic rides the handoff so the publish
                // task can reflow its status when the platforms report back.
                topicId: editor.manifest.topicRef?.topicId ?? null,
              })
            }}
          >
            {t('create.sendToPublish')}
          </button>
        )}
        <button type="button" onClick={() => { void runExport() }}>{t('create.export')}</button>
        {dirty && <span className={css.noticeLine}>{t('create.dirty')}</span>}
      </div>
      {batch !== null && (
        <div className={css.entryGrid}>
          {batch.map((card, index) => (
            <div key={index} className={css.versionRow}>
              {card.kind === 'pending' && <span className={css.versionMeta}>{t('create.batch.pending')}</span>}
              {card.kind === 'failed' && <span className={css.aiError}>{t('create.batch.failed')}{card.detail}</span>}
              {card.kind === 'done' && (
                <>
                  <span className={css.versionMeta}>{t('create.batch.card').replace('{n}', String(index + 1))}</span>
                  <div className={css.diffBlock}>{card.text.slice(0, 240)}</div>
                  <div className={css.versionActions}>
                    <button type="button" className={workbenchCss.retry} disabled={aiPending !== null} onClick={() => { void adoptBatchCard(index) }}>
                      {t('create.batch.adopt')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {notice !== null && <div className={css.noticeLine} role="status">{notice}</div>}
      {error !== null && <div className={css.aiError} role="alert">{error}</div>}
      {overwritePending !== null && (
        <div className={workbenchCss.compActions}>
          <span>{t('create.publishConfirm').replace('{file}', overwritePending)}</span>
          <button type="button" className={workbenchCss.retry} onClick={() => { void publish(true) }}>{t('create.overwrite')}</button>
        </div>
      )}
      {registerRetry !== null && (
        <div className={workbenchCss.compActions}>
          <button type="button" className={workbenchCss.retry} onClick={() => {
            void (async () => {
              try {
                await create.registerCreatePublish(editor.theme, { file: registerRetry, version: editor.manifest.currentVersion })
                setRegisterRetry(null)
                setEditor({ ...editor, publishedFile: registerRetry })
                setNotice(t('create.published').replace('{file}', registerRetry))
              } catch (cause) {
                setError(t('create.aiFailed').replace('{detail}', cause instanceof Error ? cause.message : String(cause)))
              }
            })()
          }}>{t('create.registerRetry')}</button>
        </div>
      )}
      {editor.manifest.topicRef !== null && (
        <div className={workbenchCss.compActions}>
          <span className={css.noticeLine}>
            {t('create.topic.label')}
            {editor.manifest.topicRef.title}
            {editor.manifest.topicRef.syncState !== 'linked' && <span> · {t(`create.topic.${editor.manifest.topicRef.syncState}`)}</span>}
          </span>
          {writebackFailed && (
            <button type="button" className={workbenchCss.retry} onClick={() => { void runWriteback(editor) }}>{t('create.writeback.retry')}</button>
          )}
          {editor.manifest.topicRef.syncState === 'orphan' && (
            <button type="button" onClick={() => { void detachTopic() }}>{t('create.writeback.detached')}</button>
          )}
        </div>
      )}
      <div className={css.editorGrid}>
        <div className={css.editorPane}>
          <div className={css.editorToolbar}>
            <span className={css.versionMeta}>{t('create.rewrite.label')}</span>
            {SELECTION_OPS.map(op => (
              <button key={op} type="button" disabled={aiPending !== null} onClick={() => { void runRewrite(op, REWRITE_STYLES[0] ?? null) }}>
                {t(`create.op.${op}` as StudioKey)}
              </button>
            ))}
            <select aria-label={t('create.op.style')} onChange={(event) => {
              const style = event.target.value as CreateStyleKey
              void runRewrite('style', style)
            }} value="">
              <option value="" disabled>{t('create.op.style')}</option>
              {REWRITE_STYLES.map(style => <option key={style} value={style}>{t(`create.style.${style}`)}</option>)}
            </select>
            <button type="button" disabled={aiPending !== null} onClick={() => { void runTitles() }}>{t('create.op.titles')}</button>
            <button type="button" disabled={aiPending !== null} onClick={() => { void runEvaluate() }}>{t('create.evaluate')}</button>
            {templateLibrary != null && (
              <button
                type="button"
                onClick={() => {
                  templateLibrary.openPicker({
                    category: 'creation',
                    targetLabel: t('create.pickTemplate.target'),
                    hasContent: () => editor.text.trim().length > 0,
                    apply: (draft) => {
                      setEditor(prev => prev === null ? prev : { ...prev, text: draft.body })
                      setDirty(true)
                    },
                  })
                }}
              >
                {t('create.pickTemplate')}
              </button>
            )}
            {aiPending === 'rewrite' && <span className={css.noticeLine}>{t('create.rewriting')}</span>}
          </div>
          <textarea
            ref={textareaRef}
            className={css.editorTextarea}
            value={editor.text}
            onChange={(event) => { setEditor({ ...editor, text: event.target.value }); setDirty(true); setNotice(null) }}
          />
          <div className={css.statsLine}>
            <span>{t('create.words').replace('{n}', String(words))}</span>
            <span>{t('create.reading').replace('{n}', String(minutes))}</span>
            <span>{t('create.paragraphs').replace('{n}', String(localMetrics(editor.text).paragraphs))}</span>
            {persona.trim().length > 0 && <span>{t('create.profile.applied')}</span>}
          </div>
          {rewritePreview !== null && (
            <div>
              <div className={workbenchCss.compActions}>
                <strong>{t('create.rewrite.preview')}</strong>
                <button type="button" className={workbenchCss.retry} onClick={() => { void applyRewrite() }}>{t('create.rewrite.apply')}</button>
                <button type="button" onClick={() => { setRewritePreview(null) }}>{t('create.rewrite.discard')}</button>
              </div>
              <div className={css.diffBlock}>
                {diffRows.map((row, index) => (
                  <div key={index} className={clsx(css.diffRow, row.kind === 'add' && css.diffAdd, row.kind === 'del' && css.diffDel)}>
                    {row.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className={css.sideStack}>
          <div>
            <strong>{t('create.context.title')}</strong>
            <div className={css.contextField}>
              <span className={css.versionMeta}>{t('create.context.audience')}</span>
              <textarea className={css.contextInput} value={editor.manifest.context.audience ?? ''} onChange={(event) => {
                setEditor({
                  ...editor,
                  manifest: { ...editor.manifest, context: { ...editor.manifest.context, audience: event.target.value || null } },
                })
                setDirty(true)
              }} />
            </div>
            <div className={css.contextField}>
              <span className={css.versionMeta}>{t('create.context.points')}</span>
              <textarea className={css.contextInput} value={editor.manifest.context.points ?? ''} onChange={(event) => {
                setEditor({
                  ...editor,
                  manifest: { ...editor.manifest, context: { ...editor.manifest.context, points: event.target.value || null } },
                })
                setDirty(true)
              }} />
            </div>
            <div className={css.contextField}>
              <span className={css.versionMeta}>{t('create.context.references')}</span>
              <textarea className={css.contextInput} value={editor.manifest.context.references ?? ''} onChange={(event) => {
                setEditor({
                  ...editor,
                  manifest: { ...editor.manifest, context: { ...editor.manifest.context, references: event.target.value || null } },
                })
                setDirty(true)
              }} />
            </div>
          </div>
          <div>
            <div className={workbenchCss.compActions}>
              <strong>{t('create.template.title')}</strong>
              <button type="button" onClick={() => { void loadTemplates() }}>
                {templates === null ? t('create.template.load') : t('create.template.reload')}
              </button>
              {templates !== null && (
                <button type="button" onClick={() => { setTemplateForm({ id: null, title: '', body: '' }) }}>
                  {t('create.template.new')}
                </button>
              )}
            </div>
            {templateProblems.length > 0 && (
              <span className={css.aiError}>{t('create.template.problems').replace('{n}', String(templateProblems.length))}</span>
            )}
            {templates !== null && templateForm === null && (
              <div>
                {templates.length === 0 && <span className={css.versionMeta}>{t('create.template.empty')}</span>}
                {templates.map(template => (
                  <div key={template.id} className={css.bannedRow}>
                    <button
                      type="button"
                      className={clsx(workbenchCss.chip, activeTemplateId === template.id && workbenchCss.chipCopied)}
                      onClick={() => { setActiveTemplateId(current => current === template.id ? null : template.id) }}
                    >
                      {template.title}
                      {activeTemplateId === template.id ? ` · ${t('create.template.active')}` : ''}
                    </button>
                    <span className={css.versionActions}>
                      <button type="button" onClick={() => { setTemplateForm({ id: template.id, title: template.title, body: template.body }) }}>
                        {t('create.template.edit')}
                      </button>
                      <button type="button" onClick={() => { void removeTemplate(template.id) }}>{t('create.template.delete')}</button>
                    </span>
                  </div>
                ))}
                <span className={css.versionMeta}>{t('create.template.hint')}</span>
              </div>
            )}
            {templateForm !== null && (
              <div className={css.contextField}>
                <input className={workbenchCss.compInput} value={templateForm.title} placeholder={t('create.template.namePlaceholder')} onChange={(event) => { setTemplateForm({ ...templateForm, title: event.target.value }) }} />
                <textarea className={css.contextInput} value={templateForm.body} rows={6} placeholder={t('create.template.bodyPlaceholder')} onChange={(event) => { setTemplateForm({ ...templateForm, body: event.target.value }) }} />
                <div className={css.versionActions}>
                  <button type="button" className={workbenchCss.retry} onClick={() => { void saveTemplate() }}>{t('create.template.save')}</button>
                  <button type="button" onClick={() => { setTemplateForm(null) }}>{t('create.rewrite.discard')}</button>
                </div>
              </div>
            )}
          </div>
          <div>
            <strong>{t('create.seo.title')}</strong>
            <div className={css.versionActions}>
              <button type="button" onClick={() => { setSeoKeywords(extractKeywords(editor.text)) }}>{t('create.seo.extract')}</button>
            </div>
            {seoKeywords !== null && (
              <div>
                {seoKeywords.length === 0 && <span className={css.versionMeta}>{t('create.seo.none')}</span>}
                <div>
                  {seoKeywords.map(keyword => <span key={keyword} className={css.bannedWord}>{keyword}　</span>)}
                </div>
                <div className={css.contextField}>
                  <span className={css.versionMeta}>{t('create.seo.region')}</span>
                  <input className={workbenchCss.compInput} value={seoRegion} placeholder={t('create.seo.regionPlaceholder')} onChange={(event) => { setSeoRegion(event.target.value) }} />
                </div>
                {geoKeywords(seoRegion, seoKeywords).length > 0 && (
                  <div>
                    {geoKeywords(seoRegion, seoKeywords).map(combo => <span key={combo} className={css.bannedCat}>{combo}　</span>)}
                  </div>
                )}
                <span className={css.versionMeta}>{t('create.seo.layout')}</span>
                {layoutSuggestions(editor.manifest.contentType).map(stem => (
                  <div key={stem} className={css.bannedRow}>
                    <span className={css.versionMeta}>· {t(`create.seo.layout.${stem}` as StudioKey)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            {titles !== null && (
              <div>
                <strong>{t('create.titles.title')}</strong>
                {titles.length === 0 && <span className={css.versionMeta}>{t('create.banned.clean')}</span>}
                {titles.map(line => (
                  <div key={line} className={css.bannedRow}>
                    <span>{line}</span>
                    <span className={css.versionActions}>
                      <button type="button" onClick={() => { setEditor({ ...editor, title: line }); setDirty(true) }}>{t('create.titles.use')}</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <strong>{t('create.evaluation.title')}</strong>
            {evaluation === null && <div><span className={css.versionMeta}>{t('create.evaluation.none')}</span></div>}
            {evaluation !== null && (
              <div className={css.versionRow}>
                <div className={css.versionHead}><strong>{t('create.evaluation.grade').replace('{grade}', evaluation.grade)}</strong></div>
                {([['attraction', 'create.evaluation.attraction'], ['readability', 'create.evaluation.readability'], ['differentiation', 'create.evaluation.differentiation'], ['audienceFit', 'create.evaluation.audienceFit']] as const).map(([key, labelKey]) => (
                  <div key={key} className={css.bannedRow}>
                    <span className={css.bannedCat}>{t(labelKey as StudioKey)}</span>
                    <span className={css.bannedWord}>{evaluation[key].grade}</span>
                    <span className={css.versionMeta}>{evaluation[key].reason}</span>
                  </div>
                ))}
                <span className={css.versionMeta}>{t('create.banned.disclaimer')}</span>
              </div>
            )}
          </div>
          <div>
            <strong>{t('create.hashtags.title')}</strong>
            <div className={css.versionActions}>
              <button type="button" onClick={() => { suggestTags() }}>{hashtags === null ? t('create.hashtags.suggest') : t('create.hashtags.resuggest')}</button>
              <button type="button" disabled={hashtagPicks.length === 0} onClick={() => { insertHashtags() }}>{t('create.hashtags.insert')}</button>
            </div>
            {hashtags !== null && (
              <div>
                {hashtags.length === 0 && <span className={css.versionMeta}>{t('create.hashtags.none')}</span>}
                {hashtags.map(tag => (
                  <button key={tag} type="button" className={clsx(workbenchCss.chip, hashtagPicks.includes(tag) && workbenchCss.chipCopied)} onClick={() => { toggleHashtag(tag) }}>
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className={workbenchCss.compActions}>
              <strong>{t('create.sources.title')}</strong>
              <button type="button" onClick={() => { void loadAssets() }}>
                {assets === null ? t('create.sources.load') : t('create.sources.reload')}
              </button>
            </div>
            {assets !== null && (
              <div>
                {assets.length === 0 && <span className={css.versionMeta}>{t('create.sources.empty')}</span>}
                {assets.filter(file => !editor.manifest.sources.some(source => source.file === file)).map(file => (
                  <div key={file} className={css.bannedRow}>
                    <span>{file}</span>
                    <span className={css.versionActions}>
                      <button type="button" onClick={() => { addSource(file) }}>{t('create.sources.add')}</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {editor.manifest.sources.map((source) => {
              const missing = assets !== null && source.file !== null && !assets.includes(source.file)
              return (
                <div key={source.file ?? source.title} className={css.bannedRow}>
                  <span>{source.file ?? source.title}</span>
                  {missing && <span className={css.aiError}>{t('create.sources.missing')}</span>}
                  <span className={css.versionActions}>
                    <button type="button" onClick={() => { removeSource(source.file) }}>{t('gather.picked.clear')}</button>
                  </span>
                </div>
              )
            })}
          </div>
          <div>
            <div className={workbenchCss.compActions}>
              <strong>{t('create.versions')}</strong>
              <button type="button" onClick={() => { setBanned(scanBannedWords(editor.text)) }}>
                {banned === null ? t('create.banned.run') : t('create.banned.rescan')}
              </button>
            </div>
            {banned !== null && (
              <div>
                {banned.length === 0 && <span className={css.versionMeta}>{t('create.banned.clean')}</span>}
                {banned.map(hit => (
                  <div key={hit.word} className={css.bannedRow}>
                    <span className={css.bannedWord}>{hit.word}</span>
                    <span className={css.bannedCat}>{t(`create.banned.cat.${hit.category}`)}</span>
                    <span className={css.bannedCount}>{t('create.banned.count').replace('{n}', String(hit.count))}</span>
                  </div>
                ))}
                <span className={css.versionMeta}>{t('create.banned.disclaimer')}</span>
              </div>
            )}
          </div>
          <div>
            {editor.manifest.versions.length === 0 && <span className={css.versionMeta}>{t('create.versions.empty')}</span>}
            {[...editor.manifest.versions].reverse().map(version => (
              <div key={version.v} className={css.versionRow}>
                <div className={css.versionHead}>
                  <strong>
                    v{version.v}
                    {version.v === editor.manifest.currentVersion && <span> · {t('create.version.current')}</span>}
                    {version.pinned && <span> 📌</span>}
                  </strong>
                  <span className={css.versionActions}>
                    <button type="button" onClick={() => { setEditor({ ...editor, text: versionContent(editor.manifest, version.v) ?? editor.text }); setDirty(true) }}>
                      {t('create.version.restore')}
                    </button>
                    <button type="button" onClick={() => {
                      const next = pinVersion(editor.manifest, version.v)
                      if (next !== editor.manifest) {
                        setEditor({ ...editor, manifest: next })
                        setDirty(true)
                      }
                    }}>{version.pinned ? t('create.version.unpin') : t('create.version.pin')}</button>
                  </span>
                </div>
                <span className={css.versionMeta}>
                  {t(`create.trigger.${triggerClass(version.trigger)}`)} · {t('create.words').replace('{n}', String(version.words))}
                  {version.evaluation != null && <span> · {t('create.evaluation.grade').replace('{grade}', version.evaluation.grade)}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
