# DSH 内容创作插件｜【选题库】二级栏目开发提示词 v2（调研修订版）

> 用途：`@guilinleolee/content-studio` 新增二级栏目【选题库】，收纳来自「信息收集素材」「对标账号拆解」「手动录入」的选题，做打分、管理、排期，推送至创作工作台。
> 本版依据 2026-09-25 的插件现状摸底与 GitHub 开源对标调研修订，修正了 v1 与代码现实的脱节；以下 4 项决策已锁定，开发时不再讨论。

## 〇、与 v1 的差异（已锁定决策）

1. **gather 先行**：信息收集（gather）先于选题库发版。本期溯源降级为「外链 URL + 创建时只读快照」，跨栏目「加入选题库」只做 gather 侧预留入口（见第七节）。
2. **导航用新 id `topicBank`**：原 `topics`「选题规划」静态能力页从 NAV_ITEMS 移除，其两张能力卡并入选题库空态引导页。
3. **并行开发、gather 先发版**：选题库立即开工，数据模型直接消费 gather v2.1 已定稿的字段（素材 `id` 为 UUID，作为溯源 `refId`）。
4. **AI 评估独立成期（P2）**：本提示词只覆盖 P0/P1（纯文件 + UI，零 AI 依赖）。AI 打分/优化另出提示词。

## 一、前置事实（开发前必读，均已核实）

- **真源码在 harness 检出**，三包：前端 `packages/client/ui-content-studio/`，网关 `packages/creation/content-outputs/`（作品库只读）、`packages/creation/content-schedule/`（排期读写）。`D:\dsh-content-studio` 是发行仓库（`sync.mjs` 从 harness 拷贝改名），**禁改其 `dist/` 与 zip**；发布流程：harness 源码 → `pnpm run build` → `node sync.mjs D:/deepseek-harness` → `node release.mjs`。
- 现有带数据的栏目只有【内容库】（只读）与【内容日历】（读写）；【对标账号】`benchmark` 与【选题规划】`topics` 是静态提示词卡页（点击复制）；【信息收集】未实现（规划文档 `D:\dsh-content-studio\docs\gather-dev-prompt-v2.1.md`，并行开工）。
- **可复用 UI**：卡片网格（`ContentLibrary.tsx`）、列表行（`ContentWorkbench.tsx`）、加载/错误/空三态 + `problems` 告警条、月历的「纯函数模块 + 视图局部 state + 快照重渲染」模式（`calendar.ts` + `ContentCalendar.tsx`，看板状态管理照此模板）。**表格、看板、拖拽、侧边详情面板均不存在，全部新建**。
- **插件当前零 AI 调用、零网络调用**；依赖仅 `clsx`/`dompurify`/`feedsmith`；CSS 为单文件 CSS Modules（`ContentStudio.module.css`），只用 `--dsw-alias-*` 设计令牌。
- 二级导航 = `ContentStudio.tsx` 内 `NAV_ITEMS` 数组（非路由，无 URL/深链）；跨视图跳转 `onNavigate(view)` 当前**无参**。
- outputs scanner 排除 `.` / `_` 前缀条目（`content-outputs/src/scan.ts`），`_` 前缀文件天然不进作品库；元数据门控：`formatVersion !== 0` 整体拒载。

## 二、存储规范

1. **选题元数据不写 `<主题>/.dsh-output.json`**（那是作品元数据，schema 严格且有拒载门控）。选题库使用全局单文件 `~/.dsh/outputs/_topics.json`：

```jsonc
{
  "formatVersion": 0,
  "items": [ /* 按 updatedAt 倒序 */ ]
}
// TopicItem 字段：
//   id: string(UUID, branded)
//   title: string(非空)
//   oneLiner: string | null            // 一句话简介
//   status: "idea"|"todo"|"creating"|"done"|"shelved"
//     // 灵感待评估 / 待创作 / 创作中 / 已完成 / 暂存搁置（状态定义放单一来源配置，组件只渲染）
//   source: {
//     type: "manual" | "gather" | "benchmark",
//     refId: string | null,            // gather 素材 id（v2.1 已定 UUID）/ 拆解记录 id
//     url: string | null,              // 原始外链（本期溯源形态，见五.3）
//     snapshot: { title: string, summary: string | null, capturedAt: string(ISO) } | null
//   }                                  // ID + 快照双份，防源失效成死链
//   tags: string[]
//   description: string | null         // 核心观点/目标人群/差异化建议/素材引用（Markdown 文本）
//   score: { total: number(0-10), source: "manual"|"ai",
//            factors: [{ name, score, reason, confidence, estimated }] | null,
//            evaluatedAt: string(ISO) } | null
//     // P0 仅支持手动打分（source:"manual"，factors 留空）；AI 打分是 P2，本期只预留字段不实现
//   planDate: "YYYY-MM-DD" | null
//   scheduleItemId: string | null      // 关联 _schedule.json 条目，用于回跳；ScheduleItem 无来源字段，关联只存本侧
//   topicDir: string | null            // 关联 outputs/<主题>/
//   createdAt / updatedAt: string(ISO)
```

2. **新增网关包** `@deepseek-ai/dsh-content-topics`（照抄 `content-schedule` 样板）：`TypertRemoteService` 暴露 `list/put/delete`；写路径 `withFileLock` + `writeFileAtomic`（`@deepseek-ai/dsh-atomic-write`），首次写入 `mkdir -p`；坏记录进 `problems` 不静默丢弃；`formatVersion !== 0` 整体拒载。前端经插件自挂载 Remote 使用（`src/client/index.ts` 的 `ctx.remote.$mount()` 模式），同步更新 `cordis.patch.yml` insert 清单与 `dsh.client.inject`。
3. 视图/筛选配置存 localStorage，键前缀 `dsh-content-studio.topicBank.`，**配置对象必须自带 `version` 字段**；加载时跑归一化迁移，识别不了的配置整体回默认值，不带脏数据渲染。
4. 导出的选题清单 Markdown 写入 `<主题>/assets/`（经网关，路径校验限 outputs 根内）。

## 三、栏目注册与导航

1. `NAV_ITEMS` 追加 `topicBank`（词典建议：zh「选题库」/ en "Topic Bank"）；`locales.ts` 新增词条并用测试钉住（目录 id 即词条词干的既有约定）。
2. **移除 `topics` 导航项**：原「选题规划」的两张能力卡（热点选题 `hotspot` / 排期规划 `calendar-plan`）改挂选题库**空态引导页**（无选题时展示，点击仍复制提示词）。
3. **带参跳转机制（与 gather 共用，本期一并实现）**：把 overlay 视图状态从 `ContentStudio` 内部 useState 提升到 `studio-store.ts` controller（或扩展 `onNavigate(view, params?)`），支持「选题 → 创作工作台携带 topicId」「溯源 → 未来 gather 页携带素材 id」。

## 四、核心模块与本期范围

### 模块 1｜选题总览（P0 表格 / P1 看板）

- 表格视图列：标题、来源（含溯源入口）、分数（`score.total`，无分显示「未评」）、标签、状态、计划时间、更新时间。行点击开详情面板。
- 筛选与搜索：来源类型、分数区间、标签、状态、关键词；视图配置持久化按二.3。
- 批量操作（P1）：批量改标签、批量改状态、批量导出。
- 看板视图（P1）：按五状态分栏，**原生 HTML5 drag events 实现跨栏拖拽**（不新增依赖）；拖放即 `put` 状态变更，写失败回滚 UI 并 toast。
- 空态：引导页含两张并入的能力卡 + 「新建选题」主按钮。

### 模块 2｜选题详情侧边面板（P0）

侧栏弹出（本插件首个详情面板，布局模式建立后供 gather 复用）。展示全部字段；操作按钮：

- 【开始创作】（P1）：带参跳转 `create` 视图并预填选题标题/简介/描述；若 create 视图无预填面，降级为复制选题 brief 到剪贴板 + toast（沿用现有复制反馈模式）。
- 【AI 优化选题】：**P2 占位，本期渲染为禁用态按钮**，title 提示「AI 能力后续版本开放」。
- 【编辑】：表单内联修改全部字段。
- 【删除】：只删选题记录，不动原始素材；若存在 `scheduleItemId`，确认弹窗提供「同时移除对应排期」（默认勾选，走 `contentSchedule.delete`）。

### 模块 3｜新增入口

- 手动新增（P0）：**捕捉与正式化分两档成本——仅标题必填**，创建即入「灵感待评估」栏；简介/标签/来源/打分/排期均为事后在详情面板补录的动作。
- 跨栏目「加入选题库」（本期不实现，见第七节 gather 侧预留；数据模型 `source.type` 已支持）。

### 模块 4｜排期联动（P1）

- 设置计划时间：`contentSchedule.put` 一条 `{ kind: "content", topic: <topicDir>, title, date: planDate, time: null, status: "idea" }`，返回 id 回存 `scheduleItemId`。**禁止直改 `_schedule.json`、禁止扩 `ScheduleItem` schema**。
- 状态语义独立，**不做双向状态同步**（选题五态 ≠ 排期四态 idea/draft/scheduled/published）；日历展示以 ScheduleItem 自身状态为准。
- 周/月筛选：按 `planDate` 过滤选题；日历中已排期选题通过 `scheduleItemId`/`topic` 弱关联定位，跳转前校验目标存在，失效则降级 toast。
- 选题删除联动见模块 2。

### 模块 5｜导出（P0）

- 前端 TS 纯函数生成 Markdown；frontmatter 走严格类型 schema（日期 `YYYY-MM-DD` 不带引号、分数为数字），保证「导出 → 再导入」round-trip 无损。
- 保存到当前主题 `assets/`；批量导出为单文件清单。

## 五、接口与交互约定

1. 文件读写全部经网关收口，不新增独立文件服务，不直连 fs。
2. 本期**无任何 AI/模型调用**；【AI 优化选题】与 AI 打分入口一律禁用态占位。
3. 溯源（本期形态）：`source.url` 存在则新窗口打开外链；`snapshot` 存在则面板内只读快照块（标题/摘要/抓取时间）；`refId` 已存但暂无页内跳转目标，gather 上线后升级。
4. UI 风格与现有两栏目统一：复用卡片/列表行/三态/复制反馈模式与 `--dsw-alias-*` 令牌；**新视图样式拆独立 `xxx.module.css`**（主 CSS 已 1023 行，不再堆）。
5. 加载/错误/空三态与 `problems` 告警条照 `ContentLibrary` 模式，坏数据点名不隐藏。

## 六、开发限制（禁止操作）

1. 不修改 `outputs` 目录结构与 `.dsh-output.json` schema；不破坏 scanner `_`/`.` 前缀隐身规则。
2. 不直改 `_schedule.json`，不扩 `ScheduleItem` schema，排期只走 `contentSchedule` 网关。
3. 不引入任何 AI/网络直连；不新增运行时依赖（拖拽用原生 DnD；确需引库须 MIT/Apache 且单独说明理由）。
4. localStorage 配置必须带 `version` 并实现迁移回退（否则升级后视图崩）。
5. 源码改动全部在 harness 三包，禁改 `D:\dsh-content-studio\dist`；版本号在发行仓库 `packages/content-studio/package.json` 维护。
6. 测试：网关 store 单测（put/delete/拒载/坏记录/problems）、locales 钉住测试、看板状态纯函数单测（照 `calendar.ts` 模式）；UI 变更按仓库测试政策补 keyless snapshot。

## 七、与 gather v2.1 的并行契约（gather 侧增补，开工时一并带上）

1. gather 素材卡片/详情预留「加入选题库」入口：本期渲染为禁用态或 toast「选题库上线后开放」，约定事件名 `addToTopicBank(materialId)`，选题库上线后接通。
2. gather 素材 `id` 必须稳定持久（UUID），作为选题 `source.refId`。
3. gather 的「左列表 + 右详情」布局先行建立；选题库侧边详情面板与其共用组件模式，不各写一份。

## 八、交付要求

- 交付 P0 + P1 全量：`_topics.json` 网关、topicBank 栏目（表格 + 看板双视图）、详情面板、手动新增、排期联动、导出、空态引导页（含并入的能力卡）、带参跳转机制。
- 验收路径：`dsh plugin --profile web add file:D:/dsh-content-studio/packages/content-studio` 安装三包 → 空 `outputs/` 下首启见空态引导 → 手动建选题 → 表格/看板流转 → 设排期后内容日历可见条目 → 导出 Markdown 落 assets → 删除选题联动确认。损坏的 `_topics.json`（formatVersion 非 0 / 截断 JSON）必须整体拒载并走 problems 告警，不得静默丢数据。

## 附｜参考项目速查（2026-09-25 已逐一核实）

| 项目 | 借鉴点 | 红线 |
|---|---|---|
| [ItsVeyra/glitter-idea-repo](https://github.com/ItsVeyra/glitter-idea-repo)（GPL-3.0） | 灵感快捕、「卡片升级为正式任务」= 灵感→待创作流转 | GPL：只看设计不复代码 |
| [obsmd-projects/obsidian-projects](https://github.com/obsmd-projects/obsidian-projects)（Apache-2.0，已归档） | 视图配置与数据解耦、看板列=字段枚举、日历读 date 字段 | 已停维，勿引为依赖 |
| [kanriapp/kanri](https://github.com/kanriapp/kanri)（GPL-3.0） | 离线看板 board/columns/cards JSON schema | 只看设计 |
| [obsidian-tasks](https://github.com/obsidian-tasks-group/obsidian-tasks)（MIT） | due/scheduled 日期语义分离 | 可复用思路 |
| [iniwap/AIWriteX](https://github.com/iniwap/AIWriteX)（Apache-2.0） | 选题→写作→发布状态机对照（P2 用） | — |
| MediaCrawler（约 65.7k★） | 仅作采集流程设计参考（P2 之后） | **非商业许可，明文禁商用，禁止复制代码或依赖集成** |
