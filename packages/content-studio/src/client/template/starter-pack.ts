/**
 * The bundled starter pack: eight seed skeletons across six categories that
 * make an empty template library immediately usable, and demonstrate the
 * pack format for the freemium "paid template pack" distribution channel.
 * Ids are stable and readable (not UUIDs) so a re-import with the `skip`
 * strategy is idempotent; the gateway re-validates every record, and the
 * pack spec pins each body's placeholders to its declared variables.
 * Client-safe data only — the bundle purity gate sees an in-plugin constant.
 */

import type { TemplateId, TemplatePack, TemplateRecord, TemplateTagId } from '@deepseek-ai/dsh-content-outputs/types'

/** Display name used in the import report. */
export const STARTER_PACK_NAME = 'starter-pack'

const PACKED_AT = '2026-09-27T00:00:00.000Z'

const TAGS = [
  { id: 'starter-tag-hot', name: '爆款' },
  { id: 'starter-tag-xhs', name: '小红书' },
  { id: 'starter-tag-prompt', name: '提示词' },
  { id: 'starter-tag-retro', name: '复盘' },
  { id: 'starter-tag-script', name: '话术' },
  { id: 'starter-tag-checklist', name: '清单' },
] as const

/** Brand the compile-time constants at this file's single boundary. */
function record(overrides: Omit<TemplateRecord, 'id' | 'tagIds' | 'status' | 'version' | 'createdAt' | 'updatedAt'> & {
  readonly id: string
  readonly tagIds: readonly string[]
}): TemplateRecord {
  return {
    status: 'active',
    version: 1,
    createdAt: PACKED_AT,
    updatedAt: PACKED_AT,
    ...overrides,
    id: overrides.id as TemplateId,
    tagIds: overrides.tagIds.map(tagId => tagId as TemplateTagId),
  }
}

const TEMPLATES: readonly TemplateRecord[] = [
  record({
    id: 'starter-topic-five-questions',
    name: '选题五问卡',
    category: 'topic',
    description: '一条选题立项前的五个必答问题，答不上来就不开工。',
    tagIds: ['starter-tag-hot', 'starter-tag-xhs'],
    body: [
      '# {{title}}',
      '',
      '1. 给谁看：{{audience}}',
      '2. 凭什么看：与已有内容的差异是 {{differentiation}}',
      '3. 看完得到：{{payoff}}',
      '4. 什么形式：{{format}}',
      '5. 为什么是现在：{{timing}}',
    ].join('\n'),
    variables: [
      { name: 'title', label: '选题名', description: '工作标题，会作为新建选题的标题', defaultValue: '', required: true },
      { name: 'audience', label: '给谁看', description: '目标受众，越具体越好', defaultValue: '', required: true },
      { name: 'differentiation', label: '差异点', description: '与同类内容的不同', defaultValue: '', required: false },
      { name: 'payoff', label: '看完得到', description: '读者带走什么', defaultValue: '', required: false },
      { name: 'format', label: '形式', description: '图文 / 短视频 / 长文', defaultValue: '图文', required: false },
      { name: 'timing', label: '为什么是现在', description: '热点 / 节点 / 需求', defaultValue: '', required: false },
    ],
  }),
  record({
    id: 'starter-topic-benchmark-card',
    name: '对标拆解选题卡',
    category: 'topic',
    description: '从一条对标爆款反推自己的选题。',
    tagIds: ['starter-tag-hot'],
    body: [
      '# {{title}}',
      '',
      '- 对标爆款：{{benchmark}}（数据：{{metrics}}）',
      '- 它击中的需求：{{need}}',
      '- 我能接住的切入：{{angle}}',
      '- 风险与雷区：{{risk}}',
    ].join('\n'),
    variables: [
      { name: 'title', label: '选题名', description: '工作标题', defaultValue: '', required: true },
      { name: 'benchmark', label: '对标作品', description: '链接或标题', defaultValue: '', required: false },
      { name: 'metrics', label: '它的数据', description: '点赞 / 收藏 / 评论', defaultValue: '', required: false },
      { name: 'need', label: '击中的需求', description: '它为什么火', defaultValue: '', required: false },
      { name: 'angle', label: '我的切入', description: '差异化角度', defaultValue: '', required: false },
      { name: 'risk', label: '风险', description: '不宜碰的部分', defaultValue: '', required: false },
    ],
  }),
  record({
    id: 'starter-creation-xhs-prompt',
    name: '小红书图文三段式提示词',
    category: 'creation',
    description: '钩子—干货—互动三段式，喂给 AI 的创作指令骨架。',
    tagIds: ['starter-tag-xhs', 'starter-tag-prompt'],
    body: [
      '请以 {{persona}} 的口吻写一篇小红书图文，主题：{{topic}}。',
      '',
      '结构要求：',
      '1. 开头钩子（不超过 30 字，制造 {{hook_type}}）：',
      '2. 干货主体：分 {{point_count}} 个要点展开，每点配一个具体例子；',
      '3. 结尾互动：抛出一个让读者愿意评论的问题。',
      '',
      '全文口语化，多用换行，总字数 {{word_count}} 字左右，文末给出 {{tag_count}} 个话题标签。',
    ].join('\n'),
    variables: [
      { name: 'persona', label: '账号口吻', description: '账号画像的一句话风格', defaultValue: '', required: true },
      { name: 'topic', label: '主题', description: '这篇写什么', defaultValue: '', required: true },
      { name: 'hook_type', label: '钩子类型', description: '反常识 / 提问 / 数字', defaultValue: '反常识', required: false },
      { name: 'point_count', label: '要点数', description: '干货分几点', defaultValue: '3', required: false },
      { name: 'word_count', label: '字数', description: '总字数', defaultValue: '600', required: false },
      { name: 'tag_count', label: '标签数', description: '文末话题标签数量', defaultValue: '5', required: false },
    ],
  }),
  record({
    id: 'starter-creation-article-prompt',
    name: '公众号长文写作提示词',
    category: 'creation',
    description: '观点—论证—案例—行动的长文指令骨架。',
    tagIds: ['starter-tag-prompt'],
    body: [
      '请写一篇公众号文章，标题方向：{{title_direction}}，目标读者：{{audience}}。',
      '',
      '要求：',
      '- 开头用一个 {{opening}} 引入，三段内点明核心观点：{{viewpoint}}；',
      '- 论证部分给出 {{argument_count}} 个论据，其中至少一个来自 {{source_domain}}；',
      '- 一个完整案例贯穿，案例主角是 {{case_persona}}；',
      '- 结尾给读者一个今天就能做的行动；',
      '- 全文 {{word_count}} 字左右，避免套话和排比堆砌。',
    ].join('\n'),
    variables: [
      { name: 'title_direction', label: '标题方向', description: '想起的标题感觉', defaultValue: '', required: true },
      { name: 'audience', label: '目标读者', description: '写给谁', defaultValue: '', required: true },
      { name: 'opening', label: '开头方式', description: '故事 / 数据 / 提问', defaultValue: '故事', required: false },
      { name: 'viewpoint', label: '核心观点', description: '一句话主张', defaultValue: '', required: true },
      { name: 'argument_count', label: '论据数', description: '几个论据', defaultValue: '3', required: false },
      { name: 'source_domain', label: '论据来源领域', description: '引用哪里的素材', defaultValue: '', required: false },
      { name: 'case_persona', label: '案例主角', description: '案例讲谁', defaultValue: '', required: false },
      { name: 'word_count', label: '字数', description: '总字数', defaultValue: '2000', required: false },
    ],
  }),
  record({
    id: 'starter-retro-weekly',
    name: '周复盘报告骨架',
    category: 'retro',
    description: '数据—归因—下一步的固定三节复盘。',
    tagIds: ['starter-tag-retro'],
    body: [
      '# 周复盘：{{week}}',
      '',
      '## 一、数据',
      '- 发布：{{published_count}} 篇；最好一篇：{{best_post}}',
      '- 核心指标：{{metrics}}',
      '',
      '## 二、归因',
      '- 做对的：{{what_worked}}',
      '- 做错的：{{what_failed}}',
      '',
      '## 三、下一步',
      '- 下周唯一重点：{{next_focus}}',
      '- 要停掉的事：{{to_stop}}',
    ].join('\n'),
    variables: [
      { name: 'week', label: '复盘周期', description: '如 9 月第 4 周', defaultValue: '', required: true },
      { name: 'published_count', label: '发布数', description: '本周发布篇数', defaultValue: '', required: false },
      { name: 'best_post', label: '最好一篇', description: '数据最好的内容', defaultValue: '', required: false },
      { name: 'metrics', label: '核心指标', description: '阅读 / 涨粉 / 互动', defaultValue: '', required: false },
      { name: 'what_worked', label: '做对的', description: '有效动作', defaultValue: '', required: false },
      { name: 'what_failed', label: '做错的', description: '无效动作', defaultValue: '', required: false },
      { name: 'next_focus', label: '下周重点', description: '只写一件', defaultValue: '', required: true },
      { name: 'to_stop', label: '停掉的事', description: '不再投入的事', defaultValue: '', required: false },
    ],
  }),
  record({
    id: 'starter-interaction-three-styles',
    name: '互动回复话术·三风格',
    category: 'interaction',
    description: '同一条评论的三种回法：捧场、专业、留钩子。',
    tagIds: ['starter-tag-script'],
    body: [
      '针对评论「{{comment}}」：',
      '',
      '- 捧场式：{{enthusiastic}}',
      '- 专业式：{{professional}}',
      '- 留钩子式：{{hooked}}（引导私信或看主页）',
    ].join('\n'),
    variables: [
      { name: 'comment', label: '原始评论', description: '粉丝说了什么', defaultValue: '', required: true },
      { name: 'enthusiastic', label: '捧场式回复', description: '热情拉近距离', defaultValue: '', required: false },
      { name: 'professional', label: '专业式回复', description: '给增量信息', defaultValue: '', required: false },
      { name: 'hooked', label: '留钩子式回复', description: '引导私信 / 主页', defaultValue: '', required: false },
    ],
  }),
  record({
    id: 'starter-publish-checklist',
    name: '平台发布检查清单',
    category: 'publish',
    description: '发布前逐项打勾；正文示例放在代码块里，渲染时原样保留。',
    tagIds: ['starter-tag-checklist'],
    body: [
      '# {{platform}} 发布检查',
      '',
      '- 字数：{{word_count}} 字（平台上限 {{limit}}）',
      '- 标签：{{tags}}',
      '- 封面与首图：{{cover}}',
      '- 发布时间：{{publish_time}}',
      '',
      '示例（代码块内不渲染占位符）:',
      '',
      '```',
      '文案示例：{{example}}',
      '```',
    ].join('\n'),
    variables: [
      { name: 'platform', label: '平台', description: '小红书 / 公众号 / 抖音…', defaultValue: '', required: true },
      { name: 'word_count', label: '字数', description: '实际字数', defaultValue: '', required: false },
      { name: 'limit', label: '字数上限', description: '平台限制', defaultValue: '1000', required: false },
      { name: 'tags', label: '标签', description: '话题标签清单', defaultValue: '', required: false },
      { name: 'cover', label: '封面', description: '封面确认', defaultValue: '', required: false },
      { name: 'publish_time', label: '发布时间', description: '计划时间', defaultValue: '', required: false },
      { name: 'example', label: '示例', description: '这个占位符在代码块内，渲染时原样保留', defaultValue: '', required: false },
    ],
  }),
  record({
    id: 'starter-persona-quick-form',
    name: '人设速填表',
    category: 'persona',
    description: '注册新账号画像前，先把六个关键问题答清楚。',
    tagIds: ['starter-tag-checklist'],
    body: [
      '# 人设速填：{{account}}',
      '',
      '- 我是谁：{{who_am_i}}',
      '- 写给谁：{{audience}}',
      '- 提供什么价值：{{value}}',
      '- 风格关键词：{{style_keywords}}',
      '- 绝不说的话（红线）：{{red_lines}}',
      '- 更新节奏：{{cadence}}',
    ].join('\n'),
    variables: [
      { name: 'account', label: '账号名', description: '账号名称', defaultValue: '', required: true },
      { name: 'who_am_i', label: '我是谁', description: '主体背景一句话', defaultValue: '', required: true },
      { name: 'audience', label: '写给谁', description: '目标受众', defaultValue: '', required: false },
      { name: 'value', label: '价值', description: '读者得到什么', defaultValue: '', required: false },
      { name: 'style_keywords', label: '风格关键词', description: '三五个词', defaultValue: '', required: false },
      { name: 'red_lines', label: '红线', description: '绝不说的话', defaultValue: '', required: false },
      { name: 'cadence', label: '更新节奏', description: '每周几更', defaultValue: '', required: false },
    ],
  }),
]

/** The bundled starter pack document, imported with the idempotent `skip` strategy. */
export const STARTER_TEMPLATE_PACK: TemplatePack = {
  format: 'dsh-template-pack',
  formatVersion: 1,
  exportedAt: PACKED_AT,
  templates: TEMPLATES,
  tags: TAGS.map(tag => ({ ...tag, id: tag.id as TemplateTagId })),
}
