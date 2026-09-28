# DSH 内容创作插件｜【日历】视图开发提示词 v2（排期工作台升级版）

> 2026-09-27 经天龙 10-01-prompt-architect（结构诊断）+ 01-investigator（GitHub API 逐项核验）后由 v1 重写。
> 核验结论：FullCalendar / Mixpost / Postiz 真实存在；v1 引用的 "workspace-mcp content-calendar"
> 经 GitHub 搜索 API 核验为 0 结果，判定疑似虚构，已剔除。诊断结论：v1 事件模型二义
> （视图派生 vs 落库实体）、"单向/双向同步"自相矛盾、删除语义死循环，均在本版锁死。

## 〇、与 v1 的差异（已锁定决策，开发时不再讨论）

1. **升级既有视图，非新建栏目**：`calendar` 视图与 `ContentCalendar.tsx` 已存在（月视图 +
   内联新增表单），本单把它从"发布日历"升级为"全链路排期工作台"；`NAV_ITEMS` 追加
   `calendar` 导航项（当前该视图不在左侧导航数组中，仅经 workbench 内链可达）。
2. **事件 = ScheduleItem 单一事实源**：不建第二事件表、不做"视图派生 + 落库实体"混合模型
   （v1 的致命二义）。选题排期、发布排期、独立日程全部是 `_schedule.json` 条目；
   日历自有扩展仅"备注"，落新全局文件 `_calendar.json`（见 §2）。
3. **一题一事件**：v1 的"预计撰写 + 预计发布双时间派生两事件"无契约支撑——`TopicItem`
   冻结契约只有单一 `planDate`，本期不扩选题 schema。撰写计划归创作工作台域。
4. **不引入 FullCalendar**：插件裁决过"不新增运行时依赖"（选题库看板用原生 DnD 先例）。
   周/列表视图与拖拽全部手写，扩展既有 `calendar.ts` 纯函数模块；FullCalendar（MIT）仅作
   备选记录在案，确需引库须按选题库六.3 条款单独立项说明。
5. **视图偏好 localStorage 带 version**（选题库二.3 已裁决先例）；业务数据零 localStorage
   （共同教训）。v1 的"偏好本期不落盘"不成立，也不需要落盘。
6. **AI 排期建议 = P2 禁用占位**（选题库 AI 评估同款处理）：本期插件保持零 AI 调用增量。
7. **发布联动只做弱关联预留**：`publish` 视图（publish-dev-prompt-v2，并行开发中）上线前，
   日历只识别 `_schedule.json` 可选字段 `publishTaskId` 做跳转占位，不假设其存在。

## 一、前置事实（开发前必读，均已核实 2026-09-27）

- **真源码在 harness 检出**，四包：前端 `packages/client/ui-content-studio/`，网关
  `packages/creation/content-outputs/`（作品库只读 + 对标/创作/发布写面）、
  `packages/creation/content-schedule/`（排期读写）、`packages/creation/content-topics/`
  （选题库）。`D:\dsh-content-studio` 是发行仓库，**禁改其 `dist/` 与 zip**；发布流程：
  harness 源码 → `pnpm run build` → `node sync.mjs D:/deepseek-harness` → `node release.mjs`。
- **既有日历实现**：`calendar.ts`（84 行纯函数：`monthGrid`/`groupByDate`/`todayDate`，
  周一起始，零 React 零 IO）+ `ContentCalendar.tsx`（232 行：月网格、按日分组的条目 chip、
  内联新增表单、标记已发布、删除）。状态全部视图本地，"磁盘文件是唯一事实"，快照重渲染
  ——这是仓库确立的日历模式，本单全部扩展点照此模板。
- **ScheduleItem 契约（冻结，禁扩）**：`{ id(branded), title, date: 'YYYY-MM-DD',
  time: 'HH:mm'|null, platform: string|null, status: 'idea'|'draft'|'scheduled'|'published',
  kind: 'content'|'event', topic: string|null, url: string|null }`。读写只经
  `contentSchedule` Remote（`list/put/remove`，写路径已有 `withFileLock` + 原子写 +
  `formatVersion !== 0` 整体拒载 + `problems` 告警）。
- **选题库排期联动已存在**：选题设计划时间 = `contentSchedule.put` 一条
  `kind:'content'` 条目并回存 `scheduleItemId`；选题删除时弹窗可选"同时移除对应排期"。
  **禁止直改 `_schedule.json`、禁止扩 `ScheduleItem` schema** 是全插件既定红线。
- 带参跳转走 controller 方法先例（`startTopicCreate` / `pushToCreate`），`onNavigate`
  本身无参；`SplitDetail.tsx` 详情面板模式已建立（gather/选题库共用）。
- 依赖仅 `clsx`/`dompurify`/`feedsmith`；CSS 为单文件 CSS Modules + `--dsw-alias-*`
  令牌；主 CSS 已超千行，**新样式拆独立 `xxx.module.css`**。

## 二、数据契约（冻结先行，先出类型评审再写 UI；实现期不得私改）

1. **事件模型**：一个 ScheduleItem 就是一个日历事件。月/周/列表三视图、筛选、冲突检测、
   导出全部以 `listSchedule()` 快照 + `_calendar.json` 备注合并后的视图模型渲染，
   不新增任何事件持久化。
2. **新增全局文件 `~/.dsh/outputs/_calendar.json`**（下划线隐身，天然不进作品库 scanner）：

```jsonc
{
  "formatVersion": 0,            // 拒载未知版本，整体走 problems 告警
  "notes": {
    "<scheduleItemId>": { "text": "延期到周三，等素材", "updatedAt: "ISO" }
  }
}
```

   读写经 `content-schedule` 包内**新增的独立 store 模块**（照 `store.ts` 样板：
   `withFileLock` + 原子写 + 首次 `mkdir -p`），Remote 增 `getNote/putNote` 两个方法；
   与 `_schedule.json` 零耦合，既有读写逻辑零 diff。条目删除后无主备注在下次写入时惰性清理，
   读取时忽略即不渲染。
3. **跨栏目弱关联（只读）**：`item.topic`（outputs 主题目录名 / 选题库经此定位）→
   跳转选题库；`publishTaskId`（未来发布侧写入的可选字段）→ 跳转发布的禁用态占位。
   跳转前校验目标存在，失效降级 toast，不抛错。
4. **派生视图模型（纯函数，照 `calendar.ts` 模式，可单测）**：
   `CalendarEvent { item: ScheduleItem, note: string|null, overdue: boolean,
   conflict: boolean, topicTitle: string|null }`。`overdue`/`conflict` 是渲染时派生，
   **不落盘、不进任何存储枚举**；`topicTitle` 从选题库快照 join，查无则 null。

## 三、状态与颜色（存储态/派生态分离，修复 v1 混乱）

| 层 | 值 | 来源 | 渲染 |
|---|---|---|---|
| 存储态 | `idea / draft / scheduled / published` | ScheduleItem.status（契约冻结，禁扩） | 既有四色 dot 延用 |
| 存储态 | `kind: 'content' / 'event'` | ScheduleItem.kind | chip 左侧类型图标（📄 选题排期 / 📌 独立日程），平台显示为徽标 |
| 派生态 | 逾期 = `date < today && status !== 'published'` | 渲染时计算 | 红色描边叠加原 dot 色 |

- 不引入 v1 的"失败"态：发布失败属发布侧 `PlatformTask` 域，日历本期不承接。
- 类型为底、状态为点、逾期为描边，三者叠加规则写死在纯函数里，组件只渲染不判断。

## 四、模块与本期范围

### M1 视图切换（扩展）
月（既有）/ 周 / 列表三视图。`calendar.ts` 新增 `weekGrid(year, month, day)` 与列表
排序过滤纯函数（全部带单测，照 `monthGrid` 测试模式）；视图状态视图本地 +
偏好持久化按 §〇.5（键 `dsh-content-studio.calendar.`，对象带 `version`，加载归一化，
识别不了整体回默认）。今日/前后翻页/今天跳转沿用既有月份状态机扩展到周粒度。

### M2 拖拽改期（核心，原生 HTML5 DnD）
拖 chip 到目标日 → 确认框（旧日期 → 新日期）→ `contentSchedule.put({ ...item, date: 新 })`。
写失败网格自动回原状（快照重渲染天然支持）+ toast。乐观更新在确认框之后，不做预拖影。
若条目 `topic` 反查选题库命中 → 第二写 `contentTopics.put(planDate = 新 date)`；
第二条失败**不回滚**第一条，toast 指明"选题计划时间未同步"。

### M3 新建入口（升级既有内联表单）
- 空白日点击 → 既有内联表单（`kind:'event'` 独立日程：标题必填 + 平台可选 + 时间可选）。
- 「转为选题排期」→ controller 方法带参跳转选题库（照 `startTopicCreate` 先例，预填
  `planDate`）；选题库侧未消费参数（并行冲突）时降级为复制日期到剪贴板 + toast。
- 事件删除语义（修复 v1 死循环）：`kind:'event'` 直接 `contentSchedule.remove`；
  `kind:'content'` 弹确认框，勾选项"同时清空选题计划时间"（默认勾选，置
  `planDate = null`），不勾则仅删排期条目、选题保留计划时间（其 `scheduleItemId` 失效由
  选题库既有校验降级兜底）。无"隐藏标记"机制——排期条目即事件，删了即没了，源稿件永不动。

### M4 详情面板
复用 `SplitDetail` 模式：全字段只读 + 备注编辑（写 `_calendar.json`）+ 跳转按钮
（选题库带参；发布占位禁用态）+ 删除按钮（语义同 M3）。

### M5 筛选面板
类型（kind）/ 平台多选 / 状态 / 时间范围 / 关键词 / 「仅看逾期」（派生态实时计算）。
三视图共用同一筛选语义；筛选条件持久化按 §〇.5。

### M6 排期冲突提醒（提醒不阻断）
规则写死为纯函数 + 单一来源常量：同 `platform` + 同 `date` + 两条 `scheduled` 态条目
`time` 差 < `CONFLICT_WINDOW_MINUTES`（常量 120，`time:null` 视为全天不参与时刻差、
仅在同平台同日 ≥3 条时提示"当日拥挤"）→ 双方红色描边 + 视图顶部冲突列表。
跨平台同发不告警。

### M7 CSV 导出
前端纯函数生成，仅导当前筛选结果；**UTF-8 with BOM（`\uFEFF`）+ CRLF**；列固定：
`日期,时间,类型,状态,标题,平台,关联选题,备注`；文件名 `calendar-export-YYYYMMDD.csv`；
经网关写当前主题 `assets/`（复用选题库 `writeExport` 路径校验模式）。

### M8 AI 排期建议（P2 占位）
渲染为禁用态按钮，title 提示「AI 能力后续版本开放」。不写任何 AI 调用代码。

## 五、联动规则（现实化版，替代 v1 的"双向同步"）

- 选题 → 日历：选题库设计划时间时已落 `kind:'content'` 条目，日历自动可见（既有）。
- 日历 → 选题：仅 M2 拖拽与 M3 删除确认两条路径，全部经网关。
- 创作/发布 → 日历：创作定稿与发布任务的排期由其自身栏目写 `_schedule.json`
  （或 `publishTaskId` 条目），日历零代码自动可见；发布侧时间同步属发布通道二期。
- workbench（工作台）：维持既有 `listSchedule` 内链，本期不让工作台消费更多日历数据
  （待办提取属后续单）。

## 六、禁止约束

1. `.dsh-output.json` 零接触；不修改 outputs 目录结构与 scanner `_`/`.` 隐身规则。
2. 不直改 `_schedule.json`、不扩 `ScheduleItem` schema，全部经 `contentSchedule` 网关。
3. 业务数据禁 localStorage；视图偏好 localStorage 必须带 `version` + 迁移回退。
4. 不新增运行时依赖；不引入 AI/网络调用。
5. 逾期/冲突是派生态，禁止写入任何文件。
6. 源码改动全部在 harness 侧包；共享文件（`ContentStudio.tsx`、`locales.ts`、
   `cordis.patch.yml`）最小增量编辑（并行会话约束）。
7. 测试：`calendar.ts` 新增纯函数单测、`_calendar.json` store 单测（put/拒载/坏记录/
   problems）、locales 钉住测试；UI 变更按仓库测试政策补 keyless snapshot。

## 七、降级与兜底

- `_calendar.json` 损坏/未知版本 → 整体拒载走 `problems` 告警，日历主体（排期条目）照常渲染。
- 选题库快照不可用 → `topicTitle` 显示为 null，跳转按钮禁用态，不阻塞日历。
- 拖拽任一写失败 → 网格回原状 + 具名 toast，永不出现半态或假装成功。

## 八、验收标准（全过才算完成）

1. 拖拽 `content` 条目 D1→D2 确认后：`_schedule.json` 该条 date=D2；`topic` 反查命中时
   选题 `planDate` 同步 D2；反查不中时仅改排期且 toast 说明。
2. 拖拽写失败（模拟网关错误）→ 网格回原状，无中间态落盘。
3. 删除 `content` 条目不勾"清空选题计划"→ 选题保留 `planDate`，条目消失；
   勾选 → `planDate=null`。两种路径源稿件文件均零改动。
4. 逾期条目红描边实时反映（改系统日期或造历史数据验证），且全仓 grep 无逾期字段落盘。
5. 同平台同日 10:00/11:00 两条 `scheduled` → 双方高亮 + 冲突列表；不同平台同时刻不告警。
6. 三视图 + 筛选组合语义一致；「仅看逾期」结果与描边集合一致；刷新后视图与筛选恢复。
7. CSV 以 Excel 打开中文无乱码（BOM 存在、CRLF），仅含筛选结果，落 `assets/`。
8. 备注写入 `_calendar.json`；删除条目后其备注不再渲染。
9. `calendar` 导航项出现且三视图可达；`locales` 词条有钉住测试。
10. 红线自查：grep 确认无 `.dsh-output.json` 写、`_schedule.json` 既有读写零 diff、
    无新依赖、无 AI 调用、无业务数据 localStorage。

## 附｜参考项目速查（2026-09-27 已经 GitHub API 逐一核验）

| 项目 | 借鉴点 | 红线 |
|---|---|---|
| [fullcalendar/fullcalendar](https://github.com/fullcalendar/fullcalendar)（MIT，20.7k★） | 月/周/列表+拖拽全免费的成熟方案；仅当原生 DnD 失控时的备选 | 引库须按选题库六.3 单独立项说明 |
| [inovector/mixpost](https://github.com/inovector/mixpost)（MIT，Lite 版） | 日历操作=改单一 date 字段；同日多平台单卡片+徽标 | 仅 Lite 开源，约半年未更新 |
| [calcom/cal.diy](https://github.com/calcom/cal.diy)（MIT，48.7k★） | 日历=事实源映射层、不建第二事件表 | — |
| [publishpress/publishpress-planner](https://github.com/publishpress/publishpress-planner)（GPL-2.0+） | 自定义状态驱动渲染与筛选 | 只看概念不复代码 |
| [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app)（AGPL-3.0，36.4k★） | 三层状态机对照 | **AGPL：只看交互禁抄码** |
| [bigcalendar/react-big-calendar](https://github.com/bigcalendar/react-big-calendar)（MIT，8.8k★） | 组件备选 2 | — |
| schedule-x（schedule-x/schedule-x，核心 MIT） | — | 拖拽是付费功能，排除 |
| "workspace-mcp content-calendar" | — | **GitHub API 搜索 0 结果，疑似虚构，禁引用** |
