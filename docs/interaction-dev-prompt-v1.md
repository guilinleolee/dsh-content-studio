# DSH 内容创作插件｜【互动】二级栏目开发提示词 v1.1（调研基线版）

> 用途：`@guilinleolee/content-studio` 新增二级栏目【互动】：多平台粉丝互动统一收件箱。**"统一"指数据模型与操作界面统一；本期消息唯一来源是手动导入 CSV**，不做任何平台自动拉取。AI 辅助生成回复草稿（口吻复用【画像】人设），会话全生命周期管理，用户洞察回流【选题库】。
> 本版依据 2026-09-27 的 GitHub 开源对标逐项 API 核验 + 现实代码勘察 + 提示词结构审查产出；初稿（会话起草版）的存储落点、数据契约、CSV 契约三处结构性缺陷已在本版修正。文末附录为参考项目核验结论。本文与现实代码冲突时，停下报告，不要自行发明机制。
>
> **v1.1（2026-09-27 开工前刷新，4 处对齐当晚已落地的兄弟栏目）**：
> 1. **回复模板改消费全局【模板库】**：模板库 M1 已上线（`~/.dsh/templates/`，`TemplatePickerModal` 跨栏目选择器），且十类分类中已预留 `interaction` 类。v1 的"LocalStorage 预置表 `interaction.replyTemplates`"裁决作废——回复模板经选择器按 `category: 'interaction'` 选取渲染骨架；库为空时提示「去模板库新建」，**不建任何 localStorage 模板表**。
> 2. **复盘联动兑现**：复盘栏目已全链路上线（`_review.json` + 13 Remote + ReviewView）。v1 按当时"复盘视图不存在"写的降级假设升级为：`summary`/`insights` 数据可读即视为复盘读侧可接入；工作台徽标 P0（读 `summary.pendingReply`）不变。
> 3. **导航现状更新**：`NAV_ITEMS` 现 13 项（workbench/chat/benchmark/topicBank/gather/library/calendar/create/publish/review/accounts/persona/templates，publish/review/calendar 均已入列）；本栏目仍需新增注册（见九）。
> 4. **网关落位修正——不建独立包**：v1 二.2 的"新增网关包 `@deepseek-ai/dsh-content-interactions`"作废。照 review/publish/template/persona 四例（四者均否决独立包、落 content-outputs 新面，review Agent Note 明文记录该裁决）：互动作为 content-outputs 的 `src/interactions/` 新面实现（`readInteractions`/`writeInteractions`/`parseInteractionImport`/`commitInteractionImport` + 3 个 AI Remote），直接复用共享 `streamLlmText` AI 网关、create 配额门与原子写锁，零新增打包接线（patch yml/sync.mjs 均不动）。数据契约、存储规范、CSV 契约、MCP 契约不变。

## 〇、与初稿的差异（已锁定决策）

1. **互动唯一真源落盘 `~/.dsh/outputs/_interactions.json`**（库根系统文件，`_` 前缀 scanner 隐身，与 `_templates.json`/`_topics.json`/`_schedule.json`/`_personas.json` 同惯例）。推翻初稿"会话记录存 `<主题>/assets/`、状态写 `<主题>/.dsh-output.json`"——互动不隶属任何一次创作，放主题目录会被 scanner 计入产物集并被创作重建误伤；`.dsh-output.json` 是主题级作品元数据（schema 严格 + `formatVersion` 拒载门控，禁改）。
2. **栏目名与导航对齐现实**：初稿"第 9 个二级栏目"与"仪表盘/发布/复盘"等栏目名与 `NAV_ITEMS` 现状（workbench/chat/benchmark/topicBank/gather/library/create/accounts/persona 共 9 视图）不符；现实**无独立发布视图、无复盘视图**。本栏目导航 id 定为 `interaction`，联动对象改用真实 view id（见八）。
3. **数据契约独立成章（第三章），先冻结再开发**：初稿零字段级契约。会话/消息两级模型、状态机、正交标签、关联键全部定死。
4. **AI 能力对齐既定约定**：全部 AI 调用走 create v2 五.1 的 AI 网关（generate 类方法 + `promptVersion`），显式触发、可失败可重试、并发 1、429 退避、计入配额网关——初稿未提任何 AI 调用约束。
5. **消解模板矛盾**（v1.1 已兑现升级）：初稿同时写"模板存 LocalStorage"与"取自全局【模板库】"。模板库 M1 已上线（全局 `~/.dsh/templates/`，跨栏目 `TemplatePickerModal`，分类含预留的 `interaction`）——回复模板最终裁决：**会话详情的草稿区经模板选择器按 `category: 'interaction'` 选取模板，渲染结果作为初稿骨架填入草稿编辑器**；模板库无适配模板时提示去模板库新建。不建 localStorage 模板表，不建第二套模板存储。
6. **MCP 通道具体化为可验证契约**（第六章）：接口签名 + 恒失败 stub + 发送按钮写死行为。初稿"预留接口"无签名无行为。
7. **参考项目核验修正**：Mixpost 开源 Lite 版**不含 Inbox**（Pro 付费闭源），降为概念参考；Postiz（AGPL-3.0）的 comments 是团队协作评论非粉丝互动，禁抄代码；OpenReply 实为关键词触发自动发 DM（ManyChat 替代品），与本期"必须人工审核"方向相反，仅作反面对照。第一参考改为 Chatwoot。详见附录。

## 一、前置事实（开发前必读，均已核实）

- **真源码在 harness 检出**（同 create/gather/选题库/画像）：前端 `packages/client/ui-content-studio/`，网关样板 `packages/creation/content-topics/`（选题库）/`content-schedule/`（排期）/`content-outputs/`（作品库只读）。`D:\dsh-content-studio` 是发行仓库（`sync.mjs` 从 harness 拷贝改名），**禁改其 `dist/` 与 zip**；发布流程：harness 源码 → `pnpm run build` → `node sync.mjs D:/deepseek-harness` → `node release.mjs`。本栏目开工范围新增：`contentInteractions` 网关（二.2）。
- **导航现状**（v1.1 核对）：`NAV_ITEMS` = workbench/chat/benchmark/topicBank/gather/library/calendar/create/publish/review/accounts/persona/templates 共 13 项（publish/review/calendar 已入列）；`StudioView` 枚举另含 `competitors`。本栏目追加 `interaction` 项与枚举成员。跨视图跳转 `onNavigate(view)` 现无参；带参跳转机制仍未落地——本栏目按第九章降级（展示 ref 文本 + 复制）。
- **画像前置**：persona v2 已定稿 `~/.dsh/outputs/_personas.json`（`contentPersonas` 网关；persona `id` 为 randomUUID + `revision` + `digest`；`fields.phrases` 推荐句式；`links[].sampleText` 语气样本）。回复草稿的画像注入读该文件。**若 persona 栏目未发版**：画像绑定降级为"无画像模式"（风格参数直接生效，草稿不带人设注入，UI 显式提示"画像功能待画像栏目上线"），**禁止自建第二套画像存储**。
- **AI 前置事实**：上游 429/无额度是常态。全部 AI 动作显式按钮触发、可取消、同一时刻并发 1、429 读 Retry-After 否则指数退避封顶 30s 最多 4 次、失败不产生半截数据。AI 网关是共享前置任务（create v2 五.1），**禁止各自直连**；AI 调用计入同一配额网关（create v2 五.3）：草稿生成每会话计 1 次、sentiment/intent 批量识别每 50 条计 1 次、洞察提取每批计 1 次。
- **provenance 惯例**（persona v2）：AI 可补全的结构化字段统一 `{ value, source: "user"|"ai", aiMeta: { promptVersion, at } | null }` 包装；`source: "ai"` 的值在 UI 展示时追加"（AI 推断，供参考）"。本栏目 sentiment/intent/sentiment 识别沿用（三.3）。
- outputs scanner 排除 `.`/`_` 前缀条目（`content-outputs/src/scan.ts`）；`formatVersion !== 0` 整体拒载；pre-release（formatVersion 0）schema 一次性定型、无兼容承诺。
- **可复用 UI**：卡片网格（ContentLibrary）、列表行（ContentWorkbench）、加载/错误/空三态 + `problems` 告警条、侧边详情面板（topic-bank/gather 建立后复用其组件模式）、`--dsw-alias-*` 设计令牌；**新样式拆独立 `interaction.module.css`**（主 CSS 不再堆行）。
- **运行环境 Windows 本机**：整体替换文件须容忍杀软/索引器对刚关闭文件的瞬时句柄占用（重试退避，照 gather 五.5）；数据目录不进 OneDrive 等同步文件夹。
- 多会话并行开发：`ContentStudio.tsx`/`locales.ts`/`cordis.patch.yml` 为共享文件，**最小增量编辑**，开工前核对他人中间态。

## 二、存储规范

1. **唯一真源**：`~/.dsh/outputs/_interactions.json`。主题目录（`<主题>/`、`<主题>/assets/`）与 `.dsh-output.json` 零接触。导出 CSV 经网关写目标目录 `assets/`（路径校验限 outputs 根内）。
2. **网关面**（v1.1 修正：content-outputs 内新增 `src/interactions/` 面，不建独立包）：`TypertRemoteService` 暴露 `readInteractions`/`writeInteractions`/`parseInteractionImport`/`commitInteractionImport` + AI 三方法（方法最小集按实现微调，读写全部收口网关，前端零直连 fs）；写路径 `withFileLock` + `writeFileAtomic`（`@deepseek-ai/dsh-atomic-write`），首次写入 `mkdir -p`；坏记录进 `problems` 不静默丢弃；`formatVersion !== 0` 整体拒载。前端经插件自挂载的 contentOutputs Remote 使用（零新增 `$mount`）。CSV 导出复用既有 `writeAsset` 受控写面（目标主题 `assets/`），不新增导出 Remote。
3. 顶层 schema（`formatVersion: 0`，一次性定型）：

```jsonc
{
  "formatVersion": 0,
  "conversations": [ /* 按 updatedAt 倒序 */ ],
  "insights": { "generatedAt": null, "topQuestions": [], "painPoints": [], "interests": [] },
  "summary": { "unread": 0, "pendingReply": 0, "replied": 0, "archived": 0, "spam": 0 }
  // summary 为派生缓存：每次 put/delete 后由网关重算，UI 只读不写
}
```

4. localStorage 仅存：筛选配置、视图偏好、默认风格参数。键前缀 `dsh-content-studio.interaction.`，**配置对象自带 `version` 字段**，加载跑归一化迁移，识别不了整体回默认。（v1.1：回复模板表已迁全局模板库，见〇.5/差异 1，localStorage 不再存任何模板。）

## 三、数据契约（冻结）

### 3.1 Conversation（聚合根，消息内嵌）

```jsonc
{
  "id": "uuid-v4",                          // randomUUID，Branded
  "platform": "weixin | xhs | douyin | bilibili",   // 枚举对齐 persona v2 平台表，新增平台先扩此处
  "participant": { "externalUserId": "", "nickname": "" },
  "topicRef": "主题目录名 | null",
  "outputRef": "主题名/文件名 | null",        // 关联作品库稿件，与该主题 .dsh-output.json 条目对应
  "personaId": "string | null",             // 引用 _personas.json 条目 id，人工绑定
  "status": "unread | pendingReply | replied | archived | spam",
  "tags": ["产品咨询"],                      // 诉求标签，固定枚举见 3.4
  "note": "",                               // 会话备注
  "starred": false,
  "createdAt": "ISO", "updatedAt": "ISO",
  "messages": [ /* Message[]，按 sentAt 升序 */ ]
}
```

### 3.2 Message

```jsonc
{
  "id": "uuid-v4",
  "externalMessageId": "",                  // 平台消息 ID，CSV 去重键（platform + externalMessageId 全局唯一）
  "direction": "in | out",
  "type": "comment | dm | mention",
  "content": "",
  "inReplyTo": "内部消息 id | null",         // 楼中楼；null = 无上游或上游不在库
  "sentAt": "ISO",
  "sentiment": { "value": "positive | negative | question | unknown", "source": "user | ai", "aiMeta": { "promptVersion": "interaction-sentiment@1", "at": "ISO" } | null },
  "intent":   { "value": "consult | praise | complain | demand | spam | unknown", "source": "user | ai", "aiMeta": { "…": "…" } | null },
  "replyDrafts": [ { "id": "uuid-v4", "style": "formal | friendly | humorous | brief", "content": "", "personaId": "string | null", "createdAt": "ISO" } ]
}
```

### 3.3 状态机与识别标签

- **状态机仅一个自动流转**：新会话导入 → `unread`。其余任意状态 ⇄ 其他状态均为用户显式标记（单条或批量）。`spam` 可从任意状态进入、可恢复为 `unread`；`archived` 仍可检索，不进默认列表、不进洞察分析。保存最终回复（五.4）自动 `pendingReply|unread → replied`。
- `sentiment` / `intent` 是**两套正交标签**：AI 导入后批量识别（显式按钮，非导入强制），人工可覆盖（覆盖即 `source: "user"`）；识别失败置 `unknown`，**不阻塞导入、不自动改会话状态**。

### 3.4 固定枚举（单一来源配置，组件只渲染）

- 诉求标签：产品咨询 / 价格疑问 / 内容建议 / 投诉 / 其他。
- 风格参数：`formal`（正式）/ `friendly`（亲切）/ `humorous`（幽默）/ `brief`（简短）。
- 平台枚举对齐 persona v2 4.2 平台表（`xhs`/`douyin`/`weixin`/`bilibili`），不另起一套命名。

## 四、CSV 导入契约

- **编码**：UTF-8（容忍 BOM）；检测到 GBK 整批拒绝并提示转码，不做自动转码探测。**单次上限 5000 行**，超限拒绝提示拆分。
- **列定义**（首行表头，缺必填列整批拒绝）：

| 列名 | 必填 | 说明 |
|------|------|------|
| `platform` | 是 | 枚举值，非法值该行报错 |
| `external_message_id` | 是 | 去重键 |
| `external_user_id` | 是 | |
| `nickname` | 否 | |
| `type` | 是 | `comment` / `dm` / `mention` |
| `content` | 是 | 原文 |
| `in_reply_to` | 否 | 对方消息的 external_message_id，表达楼中楼 |
| `sent_at` | 是 | ISO 8601；解析失败该行报错 |
| `topic_ref` / `output_ref` | 否 | 关联主题与稿件 |
| `persona_id` | 否 | 会话级画像绑定 |

- **会话归属**：`platform + external_user_id` 相同 → 同一会话（单人工作台：同一粉丝在同一平台归一个会话）。
- **Threading**：`in_reply_to` 在本批或已存数据中找得到 → 换成对应内部消息 id；找不到 → `inReplyTo: null` 并记入导入警告，**不丢弃消息**。
- **幂等**：`platform + external_message_id` 已存在 → 更新 content/sent_at，不新建、不重复计数。
- **错误处理**：逐行校验，**部分成功模式**——合法行照常导入，结束输出导入报告（成功 N 行、失败行号+原因、threading 警告数），报告在 UI 展示并可复制。
- **导出**（模块 5）：UTF-8 **带 BOM**（Excel 中文兼容）、标准 CSV 转义；列 = 导入列 + `conversation_id` + `status` + `tags`；导出文件可直接回导（round-trip 幂等）。

## 五、AI 能力契约（全部走 create v2 AI 网关，前端零直连）

1. **回复草稿生成**（会话详情，显式按钮）：
   - 画像注入（personaId 非空时）：读 `_personas.json` 条目的 `digest` + `fields.phrases` + `links[].sampleText` 拼入 system 上下文；生成后每条草稿回写 `personaId` 存档可审计。
   - **固定生成 3 条候选**。
   - 风格参数是**画像基底之上的叠加指令，冲突时画像人设优先**，风格参数降级为措辞微调；无画像时风格参数直接生效。
   - 模板（v1.1）：经全局模板库选择器（`category: 'interaction'`）选取，渲染结果作为初稿骨架注入生成上下文；库空则无模板直生成。`promptVersion: "interaction-reply@1"` 起版。
2. **sentiment/intent 批量识别**（收件箱，显式按钮）：对选中会话的未识别 `in` 消息批量识别，每 50 条一批，进度条展示，单批失败该批置 `unknown` 不中断。`promptVersion: "interaction-sentiment@1"`。
3. **用户洞察提取**（显式按钮，非自动）：分析范围 = 当前筛选内非 `archived`/非 `spam` 会话的全部 `in` 消息；>500 条按 200 条分批，进度条展示，单批失败降级该批不计入。产出写入 `insights`：`topQuestions[]`（问题 + 出现次数 + 示例消息 id）、`painPoints[]`、`interests[]`（兴趣方向 + 选题建议草稿）。`promptVersion: "interaction-insight@1"`。
4. **发送按钮行为**（写死，无 AI）：点击 → 最终回复写入 `direction: "out"` 消息 + 会话转 `replied` → 调用第六章 `sendReply` → stub 恒失败 → toast「外部 MCP 发送服务未接入，回复已本地存档」。**状态流转不依赖调用结果**。

## 六、MCP 通道接口契约（本期 stub）

```ts
/** 预留给外部 MCP 服务的互动通道；本期仅此接口 + 恒失败 stub，禁止第二套抽象 */
interface InteractionChannel {
  fetchMessages(req: { platform: string; sinceIso?: string }): Promise<
    | { ok: false; reason: "MCP_NOT_CONFIGURED" }
    | { ok: true; messages: RawMessage[] }>;
  sendReply(req: { conversationId: string; inReplyTo: string | null; content: string; personaId: string | null }): Promise<
    | { ok: false; reason: "MCP_NOT_CONFIGURED" }
    | { ok: true; externalMessageId: string }>;
}
```

本期 stub 两方法恒返回 `{ ok: false, reason: "MCP_NOT_CONFIGURED" }`。收件箱「导入来源」区渲染 MCP 拉取为禁用态入口（title「MCP 拉取后续版本开放」，照 topic-bank AI 占位模式）。

## 七、模块清单

1. **互动收件箱**（会话总列表）：列表主体是**会话**（最后一条消息摘要、未读数、平台、留言用户、时间、标签、关联稿件标题）。筛选：平台多选、类型、状态、关键词（搜 content 与 nickname）、sentiment、intent。点击会话开详情面板。
2. **会话详情**：按 `inReplyTo` 渲染线程上下文；头部显示绑定画像名（无画像模式显式提示）；草稿生成（五.1）+ 编辑保存；诉求标签/备注/收藏；发送按钮（五.4）。复用侧边详情面板组件模式。
3. **批量处理**：批量已读/归档/打标签/生成草稿（按各会话最新一条 `in` 消息，逐会话写入）；批量标垃圾并从默认列表隐藏；归档仍可检索。
4. **用户洞察**：五.3 提取 → `insights`；「一键送选题」见八.2；统计汇总读 `summary` + `insights` 展示（总量、正/负占比、高频问题 TOP）。
5. **历史与导出**：全量检索含归档；溯源跳转（九.2 降级规则）；导出 CSV（四）。

## 八、跨栏目联动（读写方向表，以真实 view id 为准）

| 栏目（view） | 方向 | 契约 |
|------|------|------|
| 工作台 `workbench` | workbench **读** | 待回复提醒：P0 = `NAV_ITEMS` 的 interaction 项渲染未处理数徽标（改动最小）；P1 = workbench 待办行读 `summary.pendingReply`。不新建仪表盘视图 |
| 画像 `persona` | 互动**读** | 经 `contentPersonas` 网关读 `digest`/`phrases`/`sampleText`，只读不写；未发版则无画像模式降级（一·画像前置） |
| 内容库 `library` | 互动**读** | `outputRef` 关联作品，列表展示稿件标题（经 content-outputs 投影），不复制原文 |
| 选题库 `topicBank` | 互动**写** | 见 8.2 |
| 复盘 `review` | 复盘**读** | 复盘已上线（v1.1）：`summary` + `insights` 数据可读即满足接入条件；本期不实现同步 UI，复盘读侧（受众反馈段）按数据就绪状态自行消费 |

### 8.2 一键送选题

写入选题库经 `contentTopics` 网关 `put`，最小字段集：`{ title, oneLiner, source: { type: "interaction", refId: <会话 id>, url: null, snapshot: { title, summary, capturedAt } }, status: "idea", tags: [] }`。**`TopicItem.source.type` 联合枚举追加 `"interaction"`**（选题库侧预期内的多来源扩展，`refId` 锚定互动会话 id）；禁改 TopicItem 其余 schema、禁直改 `_topics.json`。若 `contentTopics` 网关未发版，降级为复制选题 brief 到剪贴板 + toast（照 topic-bank 模块 2 降级模式），**禁止自建第二套选题存储**。

## 九、栏目注册与导航

1. `NAV_ITEMS` 追加 `{ view: 'interaction', key: 'nav.interaction' }`（词典：zh「互动」/ en "Engagement"）；`locales.ts` 新增词条并用测试钉住；`StudioView` 联合追加 `'interaction'`。共享文件最小增量编辑。
2. **跳转**：跳稿件 = `onNavigate('library', { outputRef })`、跳选题 = `onNavigate('topicBank', { topicId })`，走 topic-bank v2 三.3 带参跳转机制；**若该机制开工时未落地，全部跳转降级为展示 `outputRef`/`topicId` 文本 + 复制**，禁止为本栏目单独新建路由或跳转系统。

## 十、开发限制（禁止操作）

1. 不修改 outputs 目录结构与 `.dsh-output.json` schema；不破坏 scanner `_`/`.` 隐身规则；不直改 `_topics.json`/`_schedule.json`/`_personas.json`（一律走对应网关）。
2. AI 调用只走 AI 网关，不新增前端直连；不因 AI 失败阻塞任何本地确定性操作（导入、标记、存档全部本地优先）。
3. 不引入新运行时依赖；确需引库须 MIT/Apache 且单独说明理由。
4. localStorage 配置必须带 `version` 并实现迁移回退。
5. 源码改动全部在 harness 包（`ui-content-studio` + 新网关包），禁改发行仓库 `dist/`。
6. 本期禁止实现任何平台 API 拉取、真实发送、自动无审核发送；MCP 仅第六章契约 + stub。

## 十一、交付要求与验收路径

- 交付：`contentInteractions` 网关、interaction 栏目（收件箱 + 会话详情 + 批量 + 洞察 + 历史导出）、CSV 导入/导出、MCP stub、导航注册与徽标、带参跳转（或降级）。
- 测试：网关 store 单测（put/delete/拒载/坏记录/problems/summary 重算）、CSV 解析纯函数单测（编码/BOM/幂等/threading/部分成功）、状态机单测、locales 钉住测试；UI 变更按仓库政策补 keyless snapshot。
- 验收路径：`dsh plugin --profile web add file:D:/dsh-content-studio/packages/content-studio` 安装 → 导入含 3 行错误 + 楼中楼 + 重复行的混合 CSV → 部分成功 + 报告准确 → 5000 行导入不超时 → 生成草稿（有画像/无画像两态）→ 编辑 → 存档 → 标记已回复闭环 → 洞察提取 → 一键送选题（或剪贴板降级）→ 导出 CSV 用 Excel 打开无乱码且可回导 → 损坏 `_interactions.json`（formatVersion 非 0 / 截断 JSON）整体拒载走 problems，不得静默丢数据。

## 附｜参考项目速查（2026-09-27 已逐一 GitHub API 核验）

| 项目 | 核验 | 借鉴点 | 红线 |
|---|---|---|---|
| [chatwoot/chatwoot](https://github.com/chatwoot/chatwoot)（37.2k★，MIT） | ✅ 第一参考 | 统一收件箱信息架构、会话 labels、canned responses（= 回复模板原型）、会话状态机、Captain AI 辅助回复——均为开源版实功能 | Ruby/Rails 实现，只看交互与数据组织 |
| [inovector/mixpost](https://github.com/inovector/mixpost)（3.7k★，MIT） | ⚠️ 开源 Lite 版**不含 Inbox** | 仅产品概念参考（初稿误作"核心参考原型"） | 收件箱在 Pro 付费闭源版，无代码可看 |
| [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app)（36.4k★，**AGPL-3.0**） | ⚠️ 描述失真 | README 的 comments 是团队协作评论，非粉丝互动收件箱 | **AGPL 传染 + 本项目商业化：禁止引用任何代码** |
| [diwenne/openreply](https://github.com/diwenne/openreply)（2.5k★，MIT） | ⚠️ 身份修正 | 实为 ManyChat 替代品：关键词触发**自动**发 Instagram DM，非 AI 生成草稿 | 与本期"必须人工审核"方向相反，仅作反面对照 |
| MediaCrawler（约 65.7k★） | — | 仅作评论数据结构参考 | **非商业许可，明文禁商用，禁止复制爬取逻辑或依赖集成** |
