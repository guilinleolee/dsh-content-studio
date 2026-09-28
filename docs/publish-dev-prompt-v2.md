# DSH 内容创作插件｜【发布】视图开发提示词 v2

> 2026-09-27 经天龙 01-investigator（GitHub API 逐项核验）+ 10-01-prompt-architect（结构评审）后由 v1 重写。
> 核验结论：PostBot 真实存在（gitcoffee-os/postbot，Apache-2.0）；原稿 "Git Blind" 为 Postiz 前名 Gitroom 的误写；融媒宝商业闭源仅功能对标；MultiPost-Extension owner 为 leaperone。

## 0. 定位与本期边界

`@guilinleolee/content-studio` 新增工作台左侧导航视图【发布】（nav key: `publish`，
与 create/persona 同级，无"二级栏目"概念，零新增槽位）。承接【创作】定稿成品，
做多平台分发任务编排、AI 多平台适配、任务状态看板与历史回溯。

**本期语义边界（硬约束，UI 文案须如实呈现，不得假装成功）：**
- 本期做：UI + 任务编排 + AI 多平台适配 + 元数据落盘 + 发布包生成。
- 【执行发布】= 生成发布包并落盘任务记录，任务进入终态 `recorded`；
  按钮旁明示"发布通道未接入"。真实上传由二期 MCP 服务消费发布包完成。
- 【定时发布】= 仅写入 `_schedule.json` 计划条目（新增字段全部可选、合并写）；
  打开视图时扫描到期任务并提示，本期不自动触发任何真实发布。
- 【回流】= 用户手动确认某平台已发布后，可一键把选题置 `done`
  （复用创作 M3 的 contentTopics.put 幂等回流，终态 no-op）。
- 平台互动数据回读为二期预留字段，本期不实现。

## 1. 参考项目（2026-09-27 经 GitHub API 逐一核验）

- PostBot（gitcoffee-os/postbot，Apache-2.0）：浏览器本地登录态复用、不存账密、
  MCP 可扩展——账号模型与本栏目一致，可引用。
- social-auto-upload（dreammis/social-auto-upload，MIT）：平台覆盖参考；
  其"无通用重试、验证码人工干预"是反面教材，印证失败隔离必须强制化。
- Postiz（gitroomhq/postiz-app，AGPL-3.0）：三层状态机（稿件→平台版本→平台任务）
  只借鉴设计，禁止搬代码。
- MultiPost-Extension（leaperone/MultiPost-Extension，Apache-2.0）：每平台一个
  适配器模块，作为二期 MCP 工具契约的命名与参数参照。
- 融媒宝：商业闭源，仅功能对标。MediaCrawler：禁商用，不入发布链路。

## 2. 数据契约（冻结先行，先出类型评审通过再写 UI；实现期不得私改）

新增网关写面 `content-outputs` 包内 `src/publish/{types,store,ai}.ts`
（照 create/persona 模块样板，零新包）：

- 主题级 sidecar `outputs/<主题>/assets/_publish.json`（formatVersion 0，
  拒载未知版本；`.dsh-output.json` 零接触——其 schema 严格拒载，前五栏目同裁决）：
  `PublishManifest { tasks: PublishTask[] }`
- `PublishTask { taskId: UUID; title; manuscriptId; topicId?; personaId?;
    platforms: PlatformTask[]; mode: 'immediate'|'scheduled'; scheduledAt?;
    status: PublishStatus; note?; createdAt; updatedAt }`
- `PlatformTask { platformId; accountAlias; contentFile; coverPrompt?;
    tags: string[]; status: PlatformStatus; attempts: PlatformAttempt[] }`
  —— attempts 只追加（幂等基础：重试生成新 attempt，不改写历史）。
- `PublishStatus = 'draft'|'pendingReview'|'scheduled'|'recorded'`
  （二期扩 'executing'|'partialSuccess'|'success'|'failed'，类型一次定义全、
  closed union + assertNever，UI 本期只触达前四种）。
- `PlatformStatus = 'pending'|'adapted'|'edited'|'recorded'`（同理二期扩执行态）。
- 衍生稿：`outputs/<主题>/assets/publish/<taskId>/<platformId>.md`，
  手动修改写回原文件并置 status:'edited'。未建任务的编辑仅内存态，不落盘。
- 全局索引 `outputs/_publish-index.json`（下划线隐身，仅供历史列表跨主题聚合）：
  `[{ taskId, theme, title, status, platformIds, updatedAt }]`，
  与 sidecar 双写，读取以 sidecar 为准、索引仅加速，不一致时以扫描重建兜底。
- 账号与适配参数 `outputs/_publish-profiles.json`（**禁 localStorage 持久化**；
  本就不存密码，落盘无敏感性）：`[{ platformId, alias, enabled,
  adaptationOverrides? }]`。
- 平台规则注册表（数据驱动，禁硬编码 switch）：内置 `platform-profiles.json`
  随 bundle 分发——`{ platformId, name, charLimit?, tagStyle: 'space'|'closed'|'none',
  coverRatio?, longForm: boolean, newlineRule, styleHints }`；
  覆盖海外平台只需追加条目。UI 与 AI 适配提示词均消费注册表。
- `_schedule.json`：仅新增可选字段 `publishTaskId`，既有读写逻辑零改动。

## 3. 状态机（全表）

```
draft --新建任务--> pendingReview --选择定时+落 _schedule--> scheduled
pendingReview --执行发布(生成发布包)--> recorded
scheduled --打开视图扫描到期,提示手动执行--> (提示,不自动迁移)
recorded --手动确认已发布+回流--> 选题 status:'done'（幂等，已是 done 跳过）
平台级: pending --AI适配--> adapted --手动编辑--> edited；
recorded 前任一状态可回 pending 重新适配（显式触发）。
删除任务：仅删任务记录、索引条目与 `_schedule.json` 对应条目；
衍生稿目录保留（用户可二次利用），删除前二次确认。
```

## 4. 模块与功能（7 模块）

M1 稿件来源：创作定稿本就走"复制+登记"制（status:final），本视图读取
登记清单作为可发布稿件池；【送去发布】= 创作视图定稿卡片新增一个按钮，
走既有 `onNavigate('publish', { manuscriptId })` 带参跳转，创作侧零数据内联。
稿件预览渲染 Markdown + 选题/画像溯源链接跳转。

M2 平台账号矩阵：按 `_publish-profiles.json` 渲染账号卡片
（别名/启用禁用/多选加入任务）；平台列表来自注册表；
适配参数编辑写入 overrides。localStorage 仅允许会话级临时态。

M3 AI 多平台适配（核心，显式触发）：选中平台 →【AI 适配】按钮触发，
逐平台调用 AI 网关（复用 create 的 streamLlmText + resolveAiConfig 模式，
p-queue 并发 1 + 429 读 Retry-After 退避；计入配额网关，新增 publish 桶需与
create/quota 现有计数协调）；提示词 = 注册表 styleHints + 画像 personaText 注入，
产出独立 PlatformTask；分栏预览可手动修改（写回衍生稿，status:'edited'）；
配图提示词/封面建议随适配产出（同一次显式触发，不进保存主路径）。
429/失败平台单独标记"未生成"，不连坐其余平台。

M4 任务设置：立即/定时模式；定时写 `_schedule.json`（可选字段）；
预检复用创作 M2 `banned-words.ts` 本地词库（仅提示不拦截，不占配额）；
任务备注、topicId 记录；容错策略文案固定为"单平台失败不中断"。

M5 执行看板：【预演】= 仅 AI 适配产出全平台版本；【执行发布】= 生成发布包
+任务置 recorded +按明示"通道未接入"；每平台独立日志（attempts 数组渲染：
时间/动作/结果）；失败平台支持单独重试（新 attempt，幂等）。

M6 历史列表：读 `_publish-index.json` 聚合（空/损坏→扫描 assets/publish 重建）；
字段=任务名/主题/时间/平台集合/状态；操作=查看适配稿、查看日志、
复制任务（复用稿件与平台配置新建）、删除（级联语义见 §3）、
溯源跳转创作稿件与选题库（onNavigate 带参）。

M7 回流：平台级"标记已发布"→ 全部标记后可一键把选题置 done
（contentTopics.put 幂等；选题不存在记 orphan 不阻塞）；
预留 `metrics?` 预留字段本期不实现。

## 5. MCP 发布包契约（本期冻结、只生成不调用）

```
PublishPackage { taskId; manuscriptRef; topicId?; personaDigest?;
  platforms: [{ platformId; accountAlias; contentFile; tags; coverPrompt?;
  scheduledAt? }] }
```
二期 MCP 工具签名预留：`publish(package) -> { perPlatform:
[{ platformId, status: 'published'|'failed', externalUrl?, errorCode?, error? }] }`
（状态回传写回 attempts，枚举已在本期类型中预留）。

## 6. 禁止约束

1. 不修改 DSH 目录结构与 output 文件规范；`.dsh-output.json` 零接触。
2. 账号配置持久态禁 localStorage（共同教训）；localStorage 仅会话级。
3. 衍生稿一律 `assets/publish/<taskId>/` 下；禁写主题根目录。
4. `_schedule.json` 只增可选字段，既有读写逻辑零改动。
5. 保持动态 bundle 加载，不侵入主 Vite 构建图。
6. AI 一切产出（适配/封面/标签）仅显式按钮触发，不混入保存主路径。
7. 平台规则、状态枚举、错误码一律来自冻结契约/注册表，禁散落硬编码。

## 7. 降级与兜底

- 违禁词预检：创作词库网关不可达 → 隐藏预检入口，不阻塞主流程。
- AI 失败/429 → 平台卡"未生成"态 + 重试按钮；批量失败不连坐。
- 索引文件损坏 → 扫描重建；sidecar 拒载 → 命名问题清单，不静默丢弃。
- MCP 未配置 → recorded 终态 + 明示文案（永不出现假装"发布成功"）。

## 8. 验收标准

1. 数据契约文档（本提示词 §2/§3/§5 的 TS 类型）评审冻结后才开写 UI；
2. 状态机每条转移有对应测试；重试产生新 attempt 不覆盖历史（幂等用例）；
3. :3080 实机渲染冒烟 + keyless 快照覆盖任务列表/看板输出；
4. 红线自查：grep 确认无 localStorage 持久化、无主题根目录写入、
   `_schedule.json` 既有字段零 diff；
5. 从创作【送去发布】→ 适配 → 预演 → 执行(recorded) → 回流选题 done
   全链路走通演示。
