# DSH 内容创作插件｜【复盘】视图开发提示词 v2

> 2026-09-27 经天龙 01-investigator（GitHub API 逐项核验）+ 10-01-prompt-architect（结构评审）后由 v1 重写。
> 核验结论：Mixpost 真实存在（inovector/mixpost，MIT，开源 Lite 版分析深度受限于 Pro 商业版）；
> Postiz 真实存在（gitroomhq/postiz-app，AGPL-3.0）；xhs-trail 真实存在但为 7★ 单日停更僵尸项目
> （DeanThompson/xhs-trail，MIT，仅借鉴其数据模型与导入映射结构）；**social-tracker 未找到任何匹配
> 描述的真实仓库，判定编造，v1 引用作废**。XHSSpec（liyown/XHSSpec）无 license 文件，仅借鉴理念不搬代码。
> v1 → v2 关键修正：①存储从 `.dsh-output.json` 改为 sidecar（对齐 publish v2 已冻结的"零接触"裁决）；
> ②删除对不存在的【互动】栏目的依赖；③爆款/低表现/长尾量化定义；④AI 执行主体与 token 预算显式化；
> ⑤交付要求改为验收标准。

## 0. 定位与本期边界

`@guilinleolee/content-studio` 工作台左侧导航新增视图【复盘】（nav key: `review`，
与 create/persona/publish 同级，零新增槽位）。承接【发布】`recorded` 任务对应的作品，
聚合多平台指标快照，做可视化分析、AI 诊断、结构化复盘报告，结论回流【选题】。

**环境事实（防引用不存在的依赖）：**
- 已存在视图：信息 gather、对标 competitor、选题 topic-bank、创作 create、
  画像 persona、发布 publish。
- 【互动】视图**本期未实现**（其 interaction-dev-prompt-v1 已就绪，并已
  预留"复盘主动读 insights"的读取方向）。报告"受众反馈"节固定输出占位
  文案；一切依赖评论数据的功能延后，互动落地后仅接通本视图读取侧。
- 全局【模板库】有独立提示词 v2（未实现）。本期"存入模板库"= 写入
  `assets/review/templates/` 并列表展示；模板库落地后仅迁移存储位置。

**本期语义边界（硬约束，UI 文案须如实呈现）：**
- 本期做：Excel/CSV 手动导入 + 指标看板 + AI 诊断/报告 + 回流 + 历史记录。
- 本期不做（非目标）：平台 API 自动拉取（仅预留 MCP 接口签名，§7）；修改已发布
  稿件；数据上传第三方云端；团队权限；【互动】评论数据分析。
- 单作品 AI 诊断、复盘报告生成为**显式按钮触发**，不混入保存主路径（共同教训）。

## 1. 参考项目（2026-09-27 经 GitHub API 逐一核验）

- xhs-trail（DeanThompson/xhs-trail，MIT）：与本期数据源模式最贴近（小红书
  `笔记列表明细表-YYMMDD.xlsx` 导出 → 本地快照看板）。**仅借鉴其数据模型**：
  Note（作品主表，含 content_type 视频/图文、series 分类）+ Snapshot（快照表，
  唯一键 note_id + snapshot_date，指标 exposure/views/cover_ctr/likes/comments/
  collects/fans_gained/shares/avg_watch_time）+ ContentSource（本地源关联表：
  match_method + confidence + note_id 可空——正是稿件绑定三级的现成范式）。
  7★ 单日停更，工程质量不背书，禁整体搬代码。
- XHSSpec（liyown/XHSSpec，无 license）：idea→draft→review→publish→archive→
  reusable knowledge 链路，复盘结论沉淀为可复用知识的理念与回流【选题】同构。
  无 license 默认版权保留，只借鉴理念。
- Mixpost（inovector/mixpost，MIT）：仅借鉴其多平台汇总卡片/指标分类的信息架构；
  其 Advanced Analytics 深度绑定商业 Pro 版且数据源为平台 API，与本期
  手动导入模式不同，禁指望代码级复用。
- Postiz（gitroomhq/postiz-app，AGPL-3.0）：AGPL 传染，禁搬代码，仅产品定位参考。
- vivy-yi/xiaohongshu-skills（460★，无 license）：其"数据分析"技能分类的
  提示词拆解方式可参考，禁搬代码。

## 2. 术语与指标口径（唯一权威定义，全文引用此处）

- **爆款**：互动率 ≥ 2 × 账号基准互动率（基准见 §3 基准线；未设基准时用内置
  默认值：互动率 ≥ 5%，且 UI 明示"当前使用默认基准，请在筛选面板设置"）。
- **低表现**：互动率 < 0.5 × 账号基准互动率。
- **长尾**：发布 ≥ 30 天，且最近 7 天互动增量 ≥ 该作品周期内日均增量的 20%；
  需 ≥ 2 个快照，仅 1 个快照时该筛选返回空并在 UI 说明原因。
- **指标字典**（互动率分母统一为"阅读/播放"，全局唯一）：

  | 指标 | 公式/来源 | 平台差异备注 |
  |---|---|---|
  | 曝光 impressions | 平台原始值 | 各平台定义不同，**跨平台禁止直接求和**，汇总卡片分平台展示 |
  | 阅读/播放 reads | 平台原始值 | 公众号=阅读；抖音/B站=播放；小红书=观看量 views |
  | 互动率 engagementRate | (likes+collects+comments+shares) / reads | 转发缺失的平台该分项按 0 计 |
  | 收藏率 collectRate | collects / reads | - |
  | 涨粉 followersGained | 平台原始值 | 小红书个人版导出常缺失，缺失置 null |
  | 封面点击率 coverCtr | 平台原始值 | 仅小红书/抖音提供，缺失置 null |
  | 转化率 conversionRate | 本期恒为 null，UI 不展示 | 预留字段 |

- 缺失指标一律 null；聚合时跳过 null 并在卡片角标提示"部分平台无此指标"。

## 3. 数据契约（冻结先行，先出类型评审通过再写 UI；实现期不得私改）

新增网关写面 `content-outputs` 包内 `src/review/{types,store,importers,ai}.ts`
（照 publish 模块样板，零新包）：

- 主题级 sidecar `outputs/<主题>/assets/_review.json`（formatVersion 0，
  拒载未知版本；**`.dsh-output.json` 零接触**——v1 的存储规范第 2 条作废，
  六栏目已裁决其 schema 严格拒载）：
  `ReviewManifest { baselines: Baselines; tasks: ReviewTask[]; snapshots: MetricSnapshot[]; bindings: WorkBinding[] }`
- `Baselines { engagementRate; collectRate; source: 'user'|'default'; updatedAt }`
  ——账号基准线是**持久业务配置，落 sidecar，禁 localStorage**（localStorage
  仅允许筛选条件、图表偏好等会话级临时态）。
- `MetricSnapshot { snapshotId: UUID; platformId; platformWorkId; title;
  publishedAt; capturedAt; draftId?: string; metrics: { impressions?; reads?;
  likes?; collects?; comments?; shares?; followersGained?; coverCtr? } }`
  ——快照唯一键 = `platformId + platformWorkId + capturedAt`；重复导入同日
  同作品 = 覆盖当日快照（幂等），历史快照只追加不改写（长尾识别依赖）。
- `WorkBinding { platformWorkId; platformId; draftId?; matchMethod:
  'url'|'title'|'manual'; boundAt }`——绑定三级顺序：① 平台链接精确匹配 →
  ② 标题完全一致匹配 → ③ 进入"待绑定"列表人工指派。**只有含 draftId 的
  快照进入分析池**；未绑定条目不参与任何聚合。
- `ReviewTask { taskId: UUID; name; period: { from; to }; platforms: string[];
  filters: ReviewFilters; status: ReviewStatus; reportAssetPath?; createdAt }`
- `ReviewStatus = 'generating'|'ready'|'failed'`（closed union + assertNever；
  编辑报告不迁移状态；failed 可重试，重试生成新报告文件不覆盖旧文件）。
- 报告文件：`outputs/<主题>/assets/review/report-<taskId>-<UTC时间戳>.md`；
  模板沉淀：`assets/review/templates/<slug>.md`。
- 全局索引 `outputs/_review-index.json`（下划线隐身，跨主题历史聚合）：
  `[{ taskId, theme, name, period, platforms, status, updatedAt }]`；
  与 sidecar 双写，读取以 sidecar 为准、索引仅加速，不一致时扫描重建兜底。

### 3.1 导入映射（importers/，每平台一个解析器模块）

统一内部指标 schema 即 `MetricSnapshot.metrics`。字段名以各平台真实导出文件
表头为准，开发前先核对（xhs-trail 仓库 `sample-data/笔记列表明细表-*.xlsx`
是小红书专业号导出的实证样例）；本表为开发基线，实现期允许修正列名映射、
禁改内部 schema：
- 小红书：专业号数据中心 `笔记列表明细表-YYMMDD.xlsx`（曝光/观看量/点赞/
  收藏/评论/分享/涨粉，列名以实测为准）
- 抖音：创作者中心导出（作品数据表：播放量/点赞/评论/转发/完播率）
- 公众号：内容分析导出（已发表内容表：阅读/在看/分享/留言）
- B站：创作中心导出（播放效果表：播放/点赞/投币/收藏/分享/弹幕）

规则：未知列**不静默丢弃**——预览弹窗列出并让用户勾选忽略，勾选记入导入
日志；日期统一解析为 UTC ISO8601；数字含"万/w"后缀归一化为数值；解析失败
行进失败清单不中断批次（单行失败不连坐）。

## 4. 状态机（全表）

```
导入: 上传 --解析校验--> 预览 --确认--> 快照落盘(+绑定/待绑定列表)
绑定: 待绑定 --URL/标题自动--> 已绑定；待绑定 --人工指派--> 已绑定
任务: 新建复盘 --生成中--> generating --成功--> ready；generating --失败--> failed
failed --重试--> generating(新报告文件)；ready --编辑--> 仍 ready(内容变状态不变)
删除任务：删任务记录 + 报告文件 + 索引条目；**快照与绑定保留**（其他任务/看板复用）；删除前二次确认。
```

## 5. 模块与功能（7 模块）

M1 数据导入（地基，先开发）：CSV/Excel 多文件上传 → 按平台选择解析器 →
逐行预览校验（未知列勾选、失败行清单）→ 绑定（自动三级 + 待绑定人工指派）→
导入日志（成功/忽略/失败计数）。空文件/全失败文件给明确错误不落任何快照。

M2 筛选面板：时间（自定义/本周/上周/本月/上月）；过滤（平台多选、画像、
图文/短视频、选题标签）；作品筛选（全部/爆款/低表现/长尾，判定引用 §2，
UI 展示当前生效阈值）；基准线设置（写入 `_review.json`，展示来源 user/default）。

M3 指标总览看板（Chart.js）：汇总卡片（总曝光**分平台**展示、总互动、平均
互动率、爆款数）；趋势折线图；平台/内容形式/画像对比图；作品排行榜
（互动率/收藏率排序 Top 与垫底）。作品卡片点击 `onNavigate('create'|'publish',
{ draftId })` 跳转溯源。空态/加载态/错误态三态必备。

M4 单作品深度分析：详情卡片（标题/平台/发布时间/画像/选题链接）；指标
快照与增量（<2 个快照时增量区显示"导入第二次数据后可用"）；AI 内容诊断
（显式按钮，走 §6）：爆款分析可复用元素（标题/钩子/选题/结构），低效分析
归因（选题受众匹配/开篇/标签/发布时段）。

M5 AI 复盘报告（核心）：选定范围 → 生成 Markdown 报告，**固定六节模板
（标题写死，保证可快照测试）**：① 周期数据概览 ② 爆款共性 ③ 低效诊断
④ 受众反馈（本期固定占位："【互动】视图未上线，本节暂缺"）⑤ 可落地优化
建议（选题方向/标题风格/发布时段/内容形式/标签策略）⑥ 下期行动清单。
支持在线编辑、保存（新文件，不覆盖生成版）、导出 Markdown。

M6 结论回流：报告/诊断中的优质方向一键生成选题草稿（复用 topic-bank
现有草稿创建入口与 schema，终态幂等）；低效选题标记（新建选题时提示）；
爆款模板存 `assets/review/templates/`。

M7 历史复盘：读 `_review-index.json` 聚合（空/损坏→扫描重建）；字段=
任务名/周期/创建时间/平台集合；操作=查看报告、编辑、复制任务（复用筛选
新建）、删除（级联语义见 §4）；溯源跳转发布任务与创作稿件。

## 6. AI 执行规范

1. **执行主体**：全部 AI 调用（单作品诊断、复盘报告）复用 create 的
   `streamLlmText + resolveAiConfig` 模式走 AI 网关；p-queue 并发 1；
   429 读 Retry-After 退避；计入配额网关，新增 `review` 桶需与 create/quota
   现有计数协调。**禁止前端直连 LLM API，密钥不落浏览器。**
2. **上下文组装与预算**：单作品诊断 = 稿件原文（超 4000 字截取前 4000）+
   标签 + 画像摘要 + 该作品指标；复盘报告 = 聚合统计表（不含逐条原文）+
   Top5/Bottom5 作品摘要（各含前 500 字）；作品数 > 50 时只取 Top10/Bottom10
   并在报告注明采样。
3. **失败降级**：LLM 失败/429 → 输出纯数据版报告（仅 §1 统计 + 排行榜
   表格），任务置 ready 但标注"AI 增强部分生成失败"；不连坐导入与看板。

## 7. MCP 指标拉取契约（本期冻结签名、不实现 provider）

```
fetchPlatformMetrics(platformId, workRef, timeRange)
  -> { snapshots: MetricSnapshot[]; errors: [{ platformId, code, message? }] }
```
适配器注册点预留于 `importers/` 同级；本期零实现，UI 不出现任何
"自动拉取"入口（避免假装成功）。

## 8. 集成契约（横切，非独立页面；对端缺失一律降级不阻塞）

| 对端 | 机制 | 方向 | 降级 |
|---|---|---|---|
| 发布 | 读 recorded 任务清单（复用其现有查询） | 读 | 无 recorded 任务时空态引导先去发布 |
| 日历 | 时间范围参数透传筛选面板（onNavigate 带参） | 入参 | 缺省自定义时间段 |
| 仪表盘 | 摘要写 `_review-index.json`，仪表盘自行读取 | 写（对方读） | 仪表盘未接则无影响 |
| 选题 | 草稿创建入口（§5 M6） | 写 | 创建失败 toast + 重试，选题不存在记 orphan 不阻塞 |
| 互动 | 本期未实现（其 v2 已预留 insights 读取方向）；落地后本视图读 insights，不反向同步 | 读（延后） | 报告 §4 固定占位 |
| 画像 | 读画像定义用于对比筛选 | 读 | 无画像时该筛选项隐藏 |

## 9. 禁止约束

1. `.dsh-output.json` 零接触；不修改 DSH 目录结构与 output 文件规范。
2. 基准线、绑定关系、快照等持久业务数据禁 localStorage；localStorage 仅
   筛选条件/图表偏好等会话级临时态。
3. 稿件内容只存 draftId 引用禁复制原文落盘；AI 运行时经文件服务按
   draftId 读取（"不复制"指持久化层）。
4. 快照历史只追加不改写；当日重复导入覆盖当日快照（幂等）。
5. 报告六节模板、指标口径、判定阈值一律来自本契约，禁散落硬编码。
6. AI 产出仅显式按钮触发；MCP 自动拉取本期零 UI 入口。
7. 跨平台总曝光禁直接求和；指标缺失禁补 0 伪造（null 语义贯穿）。

## 10. 降级与兜底

- 解析器不可用/未知平台文件 → 明确错误提示支持的平台清单，不落脏快照。
- 全部作品未绑定 → 分析池空态引导"先完成稿件绑定"，不展示空看板。
- 索引损坏 → 扫描 `assets/review/` 重建；sidecar 拒载 → 命名问题清单不静默丢弃。
- LLM 不可用 → 纯数据版报告（永不出现假装"AI 分析完成"）。

## 11. 里程碑与验收标准

开发顺序：M1 导入 → M2 筛选 → M3 看板 → M4 单作品 → M5 报告 → M6 回流
→ M7 历史（UI 不先于数据层；§3 类型评审冻结后才开写 UI）。

**验收 = 以下场景全部通过，而非"页面能打开"：**
1. 导入小红书 + 抖音各一份含脏数据（未知列/"万"后缀/坏日期）的样例 CSV →
   预览正确、未知列进忽略清单、日志计数正确、坏行不中断批次；
2. 绑定 3 条、留 1 条待绑定 → 看板与报告聚合只含 3 条；
3. 设基准后爆款/低表现/长尾筛选与 §2 公式手工计算一致；未设基准时
   UI 明示"默认基准"；
4. 生成报告 → 六节结构完整、§4 占位正确、报告落盘、`_review.json`
   新增且 `.dsh-output.json` 零 diff；
5. 一键回流 → 选题视图出现草稿且符合 topic-bank 现有 schema；
6. 删除复盘任务 → 报告文件删除、快照与绑定保留；
7. LLM 不可用 → 纯数据版报告正常输出且标注降级；
8. 单作品仅 1 个快照 → 增量区文案正确、长尾筛选为空且说明原因。

**测试要求**：报告六节结构、筛选判定、导入映射补 keyless 快照测试；
状态机每条转移有对应测试；样例数据 fixture（含坏 CSV 边界）随代码提交，
fixture 须在 macOS/Linux 可回放；红线自查：grep 确认无 `.dsh-output.json`
写入、无持久 localStorage、无前端 LLM 直连。
