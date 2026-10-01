# 内容创作插件 · 未完成任务清单

- 审计基线：2026-09-27 晚，`D:\deepseek-harness` 工作区（含未提交改动）对照《完整项目总需求文档 v0.1.2-rc.5》
- 审计方式：天龙引擎六组并行调研代理逐条核对，关键结论经二次核实现场
- 文中行号为审计时点快照，代码推进后请按符号搜索重新定位
- **注意**：复盘前端为并行会话施工中的未提交代码（`ReviewView.tsx` 等），除「复盘」节外勿动其文件
- 标注约定：**[二期]** = v2 专项文档有意推迟，不算本期欠账；**[P2占位]** = 按钮/字段已预留待实现

---

## 一、整栏目级缺口

### 栏目9 互动（0%，仅规划）

- [ ] 新增 `contentInteractions` 网关（照抄 content-topics 样板），唯一真源 `~/.dsh/outputs/_interactions.json`
- [ ] 互动收件箱：平台/画像/消息类型筛选；会话状态（未读/待回复/已回复/已归档/垃圾）；AI 识别消息类型；点击跳【发布】对应稿件
- [ ] 会话详情 + AI 回复草稿：绑定画像人设多版本、语气切换（正式/亲切/幽默/简短）、人工编辑；消费 `_personas.json`（前置已就绪）
- [ ] 回复操作：存草稿/预览/发送调预留 MCP（本期仅本地存档，MCP 恒失败 stub）
- [ ] 批量处理：批量已读/归档/打标签/批量草稿；垃圾隐藏；归档检索
- [ ] 用户洞察提取：AI 批量分析留言提炼高频问题/痛点；一键生成选题送【选题】；互动统计同步【复盘】
- [ ] 互动历史记录：检索筛选/溯源/导出 CSV
- [ ] 数据录入：本期仅手动导入 CSV
- [ ] 左导航注册入口

规划依据：`docs/interaction-dev-prompt-v1.md`（已定稿）

### 栏目8 复盘·前端（后端约 90%，前端施工中）

后端 13 个 `@Remote` 已全注册（`content-outputs/src/index.ts:834-975`），3 份测试齐备。前端 `ReviewView.tsx`（670 行）已落盘但未接线，以下按需求条目验收：

- [ ] `client/index.ts` 封装 review Remote 调用（当前 0 处 review 引用，13 个后端方法无一被消费）
- [ ] 范围筛选 UI：时间（本周/上月/自定义）+ 平台/内容类型/作品筛选（全部/爆款/低表现/长尾）
- [ ] CSV 手动导入 UI（后端 `parseReviewImport`/`commitReviewImport` 两步导入已就绪，仅支持 CSV 文本，无 Excel）
- [ ] 基准线设置 UI（后端 `ReviewBaselines` 已有，缺"平均阅读"基准字段）
- [ ] 指标总览看板：汇总卡片/趋势折线/平台对比/作品排行榜 + 点击跳创作/发布（指标模型缺"转化率"）
- [ ] 单作品深度分析 UI：详情卡片、快照增量（长尾识别）、AI 诊断按钮
- [ ] AI 结构化复盘报告：在线编辑/保存/导出 UI（后端六节报告生成已就绪 `review/ai.ts:34-41`）
- [ ] 结论回流：优质方向一键生成选题草稿送【选题】（review 与 content-topics 无回流代码）；标记低效选题标签；爆款模板存【模板】（后端 `writeReviewTemplate` 已就绪）
- [ ] 历史复盘记录：列表/查看/重编辑/复制/删除、溯源跳发布/创作（后端 `_review-index.json` 索引已就绪）
- [ ] MCP 自动拉取接口预留（review 域当前连预留都没有，publish 域有可参照）

## 二、结构性断点（最小闭环修复集，约半天）

> **2026-09-28：前三条已全部修复并验证**（581/581 回归 + client typecheck 清零 + bundle 重建；Agent Note: `.agents/notes/implemented/feature/2026-09-28-dsh-content-studio-loop-closure.md`）。第 4 条（总览数据源）未动。


- [x] **发布→选题回流死链（2026-09-28 已修）**：`PublishView.tsx:131` 表单硬编码 `topicId: null` → "回流：选题标记已发布"按钮渲染条件（`PublishView.tsx:488-492`）永假、任务关联选题落空。另回流目标状态是 `done` 而非需求的「已发布上线」（`TopicStatus` 无已发布态，需决定加态或文档让步）
- [x] **对标→选题库未切换（2026-09-28 已修）**：`CompetitorsView.tsx:431-440` `addIdea` 只写 `idea-<id>.md` 资产文件，不写 `_topics.json`；`pushTopic` 预留接口在代码中不存在。可照抄信息侧 `joinTopicBank`（`ContentStudio.tsx:245-260`）→ `gatherMaterialToTopicInput`（`topic-bank.ts:398-419`）链路；补"前往选题库查看"轻提示链接
- [x] **对标账号视图无导航入口（2026-09-28 已修）**：`CompetitorsView` 已完整实现且有渲染分支（`ContentStudio.tsx:342-343`），但 `NAV_ITEMS`（`ContentStudio.tsx:59-75`）无 `competitors` 项（导航里的"对标"指向提示词切片页 `CapabilityPage`）；`nav.competitors` locale 键已存在未被引用，加一行即修
- [ ] **总览数据源过窄**：`ContentWorkbench.tsx:23-26` 只接 outputs+schedule 两个 Remote；topics/review Remote 均已存在，接入可补齐大部分缺失指标

## 三、栏目内功能缺口

### 栏目1 总览（约 40%）

- [ ] 统计卡补选题维度：总数/待创作/待发布/已发布（需接 topics Remote）
- [ ] 统计卡补：今日待发布切片（现为全量 pending，`ContentWorkbench.tsx:118`）、定时任务数、成功/失败任务统计（依赖发布执行态，可随二期）
- [ ] 待回复评论/私信数（依赖互动栏目）
- [ ] 「快捷新建×5」改为真实创建入口：新建素材/对标任务/选题/画像/发布任务（现状 `ContentWorkbench.tsx:148-205` 是页面跳转+复制提示词）
- [ ] 近期动态时间线（跨栏目统一动态流，现状是两个独立列表）
- [ ] 数据简易预览：近期阅读/点赞汇总，接 review 后端（`review/types.ts:28-29` 字段现成）
- [ ] 最近 5 条选题 + 最近 5 篇定稿两类卡片，可点击跳详情（现状仅"最近产物"只读列表，`ContentWorkbench.tsx:216-221` 无 onClick）

### 栏目2 信息（约 80%）

- [ ] 源编辑表单（控制器有 `updateSource` `gather-store.ts:460`，UI 只有启停按钮）
- [ ] 手动添加源时的标签输入（现状硬编码 `tags: []`，`GatherView.tsx:140`）
- [ ] 素材标签筛选项
- [ ] 素材卡片/详情展示采集时间（`gatheredAt` 已存不渲染）
- [ ] `aiEnabled` 死字段处理：做成真开关或删除（现状硬编码 true 且无消费点，`GatherView.tsx:425`）
- [ ] 素材推送【对标】通道（gather 与 competitor 无任何通信）
- [ ] 通用网页抓取去留决策：RSS 已真实现（`gather/feed.ts:163-205`，全插件唯一真实外联），通用抓取既无实现也无 MCP 预留——需求侧明确豁免或补预留
- [ ] 文档导入（RSS/网页/文档三源中的"文档"未做）

### 栏目3 对标（约 75%）

- [ ] 收录为选题写入 `_topics.json`（见断点 2）
- [ ] 封面全链路：导入表单封面字段（URL/本地上传）→ 列表封面预览 → 拆解"封面策略"维度（`CompetitorWork` 无 cover 字段 `competitor/types.ts:70-97`）
- [ ] 拆解补"标题范式""发布时间"两维度（`competitor/ai.ts:31-42` 提示词无此三章）
- [ ] 作品筛选补平台、热度等级两维；搜索含正文（V2 文档 `:56` 承诺）
- [ ] "清空该账号本地缓存素材"操作（账号操作菜单缺失）
- [ ] 互动数据数值展示（模型有 `competitor/types.ts:25-33`，列表/详情不显示）
- [ ] **[二期]** 定时监控自动拉取+自动拆解（现状手动补采横幅符合 V2 `:16` 修订）
- [ ] **[二期]** 多账号对比放开至 2~5 个（现状后端硬限 2，`competitor/ai.ts:185-189`，V2 `:70` 一期约定）
- [ ] **[二期]** MCP 五方法采集接口 stub（五方法签名仅存在于文档契约层）

### 栏目4 选题（约 85%）

- [ ] 选题 AI 评估：0-10 四因子（受众需求/差异化/竞争/成本）+ 优势/风险/竞争分析 + 3 备选标题 **[P2占位]**（`TopicScore.source:'ai'`、`TopicScoreFactor` 结构已预留 `content-topics/types.ts:48-72`，UI 仅手填总分）
- [ ] AI 优化选题：扩写思路 + 3 套备选标题 **[P2占位]**（按钮已置灰 `TopicBankView.tsx:681-683`）
- [ ] 溯源 `refId` 页内跳转（跳回信息素材/对标拆解；现状仅 source.url 外链，`TopicBankView.tsx:722-726`）
- [ ] 详情面板描述结构化：核心观点/目标人群/差异化建议/素材引用列表（现状单 textarea）
- [ ] 表格补"预估工作量"列（模型无此字段，需决定加或删需求）

### 栏目5 创作（约 90%）

- [ ] 画像引用 ID 化：`profileRef mode:'profile'` 接线（契约已冻结 `create/types.ts:56-61` 但零构造点），读画像字段+画像报告全文作上下文；创作页内画像下拉（现状激活动作在画像列、只传 500 字内联摘要 `ContentStudio.tsx:156-160`）
- [ ] 选题溯源 ID 传递：`PickedTopic` 携带 `sourceRef`（`studio-store.ts:18-25` 无此字段），上下文面板可跳转溯源素材
- [ ] 二创子任务补"优化开头钩子/结尾引导"（`rewriteBrief` 全集 `create/ai.ts:103-122` 无此分支）
- [ ] 跨版本复制片段（版本列表只有恢复/钉住 `CreateView.tsx:1246-1272`）
- [ ] 正文插入当前主题 assets 图片（无任何插入 `![]()` 代码）
- [ ] 任意两版本对比（lineDiff 仅用于改写预览）
- [ ] 违禁词修改建议 + 正文内定位高亮（现状只报词/类别/次数 `CreateView.tsx:1230-1242`）
- [ ] 话题标签按平台推荐 + 热门/小众筛选（现状本地静态词池，`create.ts:373-393`）
- [ ] 导出纯文本（现仅 Markdown）
- [ ] 素材引用面板内容注入生成上下文（现状 sources 仅溯源记录，prompt 只读手填 references，`create/ai.ts:93-100`）
- [ ] 小修：版本 `trigger:'restore'` 类型有定义无写入路径（`create.ts:356-362`）

### 栏目6 发布（约 80%）

- [ ] topicId 传递修复（见断点 1）
- [ ] 发布流违禁词预检（创作列有 `banned-words.ts`，发布列无引用）
- [ ] 原创度提示（全库无实现）
- [ ] 稿件 MD 渲染预览（池卡片/任务详情只有标题+路径文本）
- [ ] 溯源跳转：任务详情跳创作/选题
- [ ] 发布时间列（现显示 updatedAt）
- [ ] 平台反馈字段回写预留（publish 后端无 feedback 字段）
- [ ] **[二期随MCP]** 执行态状态机：执行中/部分成功/全部成功/全部失败（`publish/types.ts:14-17` 有意预留，现有 `recorded` 终态）
- [ ] 小修：AI 适配契约补独立标题字段（现仅 content/coverPrompt/tags，`publish/ai.ts:43-47`）

### 栏目7 日历（约 80%）

- [ ] 事件编辑功能（详情面板只读+备注，只能删/标发布，`ContentCalendar.tsx:739-757`）
- [ ] 画像维度：`ScheduleItem` 加 persona 字段（`content-schedule/types.ts:19-37` 无），连带事件卡片画像名、画像筛选
- [ ] 发布结果（recorded）回写日历事件状态（`publish-store.ts` 只 put/remove 不更新）
- [ ] 事件点击按 id 定位跳选题（现状仅泛化"前往选题库"，`onNavigate` 只有 `'topicBank'`）
- [ ] 跳【发布】的入口
- [ ] 拖拽改期回写发布任务时间（现只回写选题 planDate，`ContentCalendar.tsx:284-291`）
- [ ] 空白日新建改为模式 A 跳选题 / 模式 B 跳发布（现状内联表单，属交互路径偏差，可文档让步或改造）
- [ ] AI 排期建议 **[P2占位]**（按钮置灰 `ContentCalendar.tsx:546-548`）
- [ ] 小修：事件色值对齐需求（现 idea=灰/draft=黄，需求 🟡待撰写/🟢定稿）

### 栏目10 画像（约 85%）

- [ ] 列表搜索筛选（名称/赛道/平台；`PersonaView.tsx` 无 filter/search 逻辑）
- [ ] AI 一句话生成完整画像草稿（AI 操作仅 fill/resume/report，`persona/types.ts:191`）
- [ ] 内置人设模板快速新建
- [ ] PDF 简历解析 **[P2占位]**（现仅 TXT/MD，`PersonaView.tsx:297` accept 限制，V2 `:141` 规划）
- [ ] 小修：报告章节措辞与需求八段式对齐或文档让步（实质覆盖，`persona/ai.ts:61`）

### +1 模板（约 90%）

- [ ] 模板选择器接入创作以外栏目（现仅创作 `CreateView.tsx:984-990` 接了 openPicker；`TemplatePickerModal` 按栏目过滤已就绪）
- [ ] 业务实例"一键另存为模板"入口（后端 extract 完整 `template/types.ts:162-166`，现只有库内粘贴提炼）
- [ ] 小修：需求"合并/覆盖"→实际"跳过/覆盖/重命名"，语义超集，文档追认即可

---

## 四、全局与发布流程任务

### 需求文档回写（实现已超前，文档过时）

- [ ] 版本号：文档 v0.1.2-rc.5 → 0.1.3-rc.1（先完成下方"版本收口"再改）
- [ ] localStorage 条款改写：画像/模板/发布账号/自定义模板实际全落盘（`_personas.json`、`~/.dsh/templates/`、`_publish-profiles.json`、`_templates.json`），各 v2 文档已记录推翻理由
- [ ] 存储族谱补记：`_topics.json`/`_personas.json`/`_review.json`/`_publish-index.json` 等 `_` 前缀族 + content-topics 第三网关（"只有两个网关"表述过时；模式合规）
- [ ] RSS 抓取豁免说明（"网页抓取只留 MCP"条款 vs `gather/feed.ts` 真实现）
- [ ] 消除自相矛盾：第二章"禁止 ~/.dsh 根目录新建文件夹" vs 模板章节"`~/.dsh/templates/`"（实现取后者，子目录+`templatesRoot` 可配）
- [ ] V2 降级项同步：对标定时监控→手动补采、对比 2~5→一期 2 个、选题 AI 评估 P2、简历 PDF P1
- [ ] Chart.js 条款决策：引入（复盘看板需要）或从验收清单删除（全库零命中零图表）

### 版本与仓库收口

- [ ] `content-topics` 版本 0.1.0 → 对齐组内 0.1.3-rc.1
- [ ] 工作区未提交 13 文件（+2138/-137）收口提交（**先与并行会话确认复盘前端完工**）
- [ ] 复核 `content-schedule/src/store.ts` 未提交的 +2 行（该文件历史仅创建 commit `46d9fcdb05`，是"_schedule.json 原逻辑未动"验收点的关键证据）
- [ ] 0.1.3-rc.1 发 tag + GitHub Release + dist zip（pack.mjs/release.mjs 就绪）
- [ ] 端到端实测：`~/.dsh/outputs/` 仅有 `gather-smoke` 冒烟主题，全链路（信息→对标→选题→创作→发布→日历→复盘→画像→模板）未跑过真实数据；验收前至少跑通一条主线
- [ ] 追平：主仓库→发行仓库 sync（sync.mjs rescope）+ `dsh plugin --profile web add file:...` 重装验证

---

## 五、跨栏目联动对照（验收用）

已通（10 条）：信息→选题 ✅ / 信息→创作 ✅ / 选题→创作 ✅ / 选题→日历 ✅ / 创作→发布 ✅ / 创作→选题回流 ✅ / 创作→日历回流 ✅ / 发布→日历（定时）✅ / 日历拖拽→选题回写 ✅ / 画像→创作 ✅ / 模板→创作 ✅

未通（6 条）：对标→选题（断点 2）/ 发布→选题回流（断点 1）/ 信息→对标 / 日历→发布回写 / 复盘全链（前端施工中）/ 模板→其他栏目

---

## 六、建议收口顺序

1. **断点 1-4**（约半天）：发布 topicId、对标 pushTopic、CompetitorsView 导航行、总览接 topics/review Remote → 业务闭环即通
2. **复盘前端接线收尾**（并行会话进行中，勿重复开工）
3. **互动栏目开工**（规划已定稿，画像前置就绪）
4. **总览指标补齐**（依赖 1 和 2 的数据源）
5. **零散缺口按栏目清**（创作画像 ID 化、日历事件编辑优先级较高）
6. **文档回写 + Chart.js 决策 + 版本收口 + 端到端实测** → 发 0.1.3-rc.1
