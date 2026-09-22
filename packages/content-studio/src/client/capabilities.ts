/**
 * The Content Studio capability catalog: the static dual-tab menu of creation
 * and operation verbs this plugin ships. Display copy lives in the locale
 * dictionaries under `cap.<id>.title` / `cap.<id>.detail`; this module owns
 * the structure, the clipboard payload, and the maturity classification.
 */

/** Maturity of one capability entry (four states, rendered as badges). */
export type CapabilityMaturity = 'done' | 'ready' | 'need' | 'incoming'

/** One pickable verb of the workbench: pick copies `prompt` to the clipboard. */
export interface CapabilityItem {
  /** Stable id; also the locale key stem (`cap.<id>.title` / `.detail`). */
  id: string
  /** The group this item renders under within its tab. */
  group: string
  /** Structured instruction template copied on pick; 【…】 marks user fill-ins. */
  prompt: string
  maturity: CapabilityMaturity
}

/** One titled group of items within a tab. */
export interface CapabilityGroup {
  id: string
  items: readonly CapabilityItem[]
}

/** The dual intent tabs: finished artifacts versus operation actions. */
export type StudioTab = 'create' | 'operate'

/** Tab order and the group sequence each tab renders. */
export const STUDIO_TABS: readonly { id: StudioTab; groups: readonly string[] }[] = [
  {
    id: 'create',
    groups: ['visual', 'article', 'video', 'audio'],
  },
  {
    id: 'operate',
    groups: ['discover', 'plan', 'publish', 'review'],
  },
] as const

/** All catalog items across both tabs, in render order. */
export const CAPABILITY_ITEMS: readonly CapabilityItem[] = [
  // ── create tab ──
  { id: 'social-card', group: 'visual', maturity: 'ready', prompt: '请为我创作一组社媒图文卡片。\n主题：【主题】\n平台：【小红书 / 微博 / 朋友圈】\n要求：共【3-6】张，首图有钩子，每张一个要点，末图带行动引导，附每张的文案。' },
  { id: 'cover-poster', group: 'visual', maturity: 'ready', prompt: '请为我设计一张封面海报的方案。\n主题：【主题】\n用途：【文章封面 / 视频封面】\n要求：给出标题排版、副标题、视觉主体与配色的完整描述，并附两版备选方案。' },
  { id: 'infographic', group: 'visual', maturity: 'need', prompt: '请把下面的信息整理成一张信息图的制作方案。\n原始信息：【粘贴数据或要点】\n要求：给出分区结构、每区的图表类型与文案，标注数据来源。' },
  { id: 'gzh-article', group: 'article', maturity: 'ready', prompt: '请为我写一篇公众号文章。\n主题：【主题】\n目标读者：【读者画像】\n要求：标题给 3 个备选，开头 3 句内建立钩子，正文分 3-5 个小节，结尾有互动引导，全文【1500-2500】字。' },
  { id: 'long-form', group: 'article', maturity: 'ready', prompt: '请为我写一篇深度长文。\n主题：【主题】\n核心观点：【一句话立场】\n要求：先列大纲待我确认，再展开成文；引用处标注来源，全文【3000】字以上。' },
  { id: 'polish', group: 'article', maturity: 'done', prompt: '请润色下面这段文字，保持原意与个人语气。\n原文：【粘贴原文】\n要求：先指出 3 个最主要的问题，再给出改写版，最后逐条说明改动理由。' },
  { id: 'short-script', group: 'video', maturity: 'ready', prompt: '请为我写一条短视频口播脚本。\n主题：【主题】\n时长：【45-60】秒\n要求：前 3 秒钩子、口播正文分镜编号、每镜一句画面提示，结尾行动引导，口语化。' },
  { id: 'storyboard', group: 'video', maturity: 'incoming', prompt: '请把下面的脚本扩写为分镜表。\n脚本：【粘贴脚本】\n要求：每镜给出景别、运镜、画面内容、口播与时长，输出为表格。' },
  { id: 'podcast-outline', group: 'audio', maturity: 'incoming', prompt: '请为我设计一期播客的大纲。\n主题：【主题】\n时长：【30】分钟\n要求：开场引入、3-4 个章节话题与各章提问清单、结尾总结，标注时间分配。' },
  // ── operate tab ──
  { id: 'hotspot', group: 'discover', maturity: 'need', prompt: '请围绕我的账号方向做一次热点选题。\n账号方向：【一句话定位】\n要求：列出 5 个可切入的热点，每个给出热度理由、切入角度与标题草稿，并标注风险。' },
  { id: 'breakdown', group: 'discover', maturity: 'ready', prompt: '请拆解下面这条爆款内容。\n内容：【粘贴链接或全文】\n要求：从选题、标题、结构、情绪、发布时间五个维度归因，最后给出可复用的 3 条模板。' },
  { id: 'positioning', group: 'plan', maturity: 'ready', prompt: '请帮我做账号定位。\n我的背景：【经历 / 优势 / 资源】\n目标平台：【平台】\n要求：给出 3 个定位方向，各含人设一句话、内容支柱、对标账号与变现路径，并推荐其一。' },
  { id: 'calendar-plan', group: 'plan', maturity: 'incoming', prompt: '请为我制定下个月的内容日历。\n定位：【一句话定位】\n更新频率：【每周 N 篇】\n要求：按周排布选题，标注内容类型与预期目标，预留 2 个机动热点位。' },
  { id: 'multi-platform', group: 'publish', maturity: 'ready', prompt: '请把这篇母版内容适配为多平台版本。\n母版：【粘贴全文】\n目标平台：【小红书 / 公众号 / 抖音 / 知乎】\n要求：每个平台一份改写稿，遵守该平台的标题与正文字数约束，并附发布建议。' },
  { id: 'pre-publish', group: 'publish', maturity: 'ready', prompt: '请在发布前检查下面这篇内容。\n内容：【粘贴全文】\n目标平台：【平台】\n要求：从事实准确性、平台合规、标题党风险、错别字四项逐条检查，每项给出通过或修改建议。' },
  { id: 'retro', group: 'review', maturity: 'ready', prompt: '请帮我做一次内容复盘。\n数据：【粘贴各篇的阅读 / 互动数据】\n要求：找出表现最好与最差的各 2 篇并归因，总结 3 条下阶段可执行的调整。' },
] as const

/**
 * The items of one tab, grouped in the tab's declared group order.
 * @param tab - the active intent tab.
 * @returns the tab's groups with their items; a group with no items is omitted.
 */
export function capabilityGroups(tab: StudioTab): CapabilityGroup[] {
  const declared = STUDIO_TABS.find(candidate => candidate.id === tab)
  if (declared === undefined) return []
  const groups: CapabilityGroup[] = []
  for (const id of declared.groups) {
    const items = CAPABILITY_ITEMS.filter(item => item.group === id)
    if (items.length > 0) groups.push({ id, items })
  }
  return groups
}
