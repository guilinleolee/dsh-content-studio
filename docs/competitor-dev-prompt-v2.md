# DSH 内容创作插件｜【分析竞争对手（对标账号）】二级栏目方案（V2）

> 用途：在现有内容创作插件内新增"对标账号"（competitors）视图。改哪里、怎么改、何为完成，以本文为准；
> 本文与现实代码冲突时，停下报告，不要自行发明机制。
> 修订：v2（2026-09-25）——依 GitHub 开源项目核验（MediaCrawler / Douyin_TikTok_Download_API / playwright-mcp /
> crawl4ai / RSSHub / instaloader 等）与架构评审重写 V1：数据契约独立成章、跨端状态随素材落盘、
> 手动导入成为一期采集主路径、【加入选题库】降级为【收录为选题】。

定位：【内容创作】下第二个二级栏目，和【信息收集】并列。用于开发 DSH 扩展模块 `@guilinleolee/content-studio`。复用同一套存储规范、UI 风格、MCP 预留架构：素材和报告写入 `~/.dsh/outputs/<主题>/assets/`，元数据与采集状态随素材落盘（见八章修订）；对标账号清单、监控偏好、UI 状态存浏览器本地存储（一期含 JSON 导入/导出备份）。面向用户：中小企业、自媒体、超级个体、OPC，与【信息收集】栏目配套，用于长期监控竞品账号、拆解爆款、挖掘选题、对比差异化。整体思路：对标账号管理 → 采集作品（一期主路径 = 手动导入，MCP 网页抓取为二期可替换 Provider）→ AI 批量拆解单条作品 → 账号维度汇总报告 → 多账号横向对比 → 选题 / 差异化建议输出。风险隔离原则：采集层外置可替换，任何单一采集通道失效（平台施压、登录态过期、上游项目归档）都不拖垮产品主流程；分析层复用 DSH Skill。

## V2 修订记录（相对 V1）

1. 新增第四章"数据契约"：条目 kind 枚举与 competitor-work 字段草案——V1 只写存储路径没有条目规范，字段先冻结才能避免实现期各自发挥。
2. 采集状态全部改随素材落盘：采集游标（lastSyncedAt）、去重键、拆解状态与结果、互动快照写入磁盘清单，杜绝"素材在磁盘、状态在浏览器"的分裂。
3. 一期采集主路径改为手动导入，MCP 抓取降为二期可替换 Provider 并冻结 5 方法接口签名——保证无任何采集器时全流程开箱可用；wewe-rss 等采集项目相继归档，印证主流程不能依赖外部通道。
4. 删除一期"浏览器侧定时任务"（标签页关闭即失效，属伪调度），一期改为"手动检查更新 + 打开栏目时补跑"，真调度移至二期 host 侧。
5. 一期不再写 `_schedule.json`：契约未定不污染排期文件，集成随二期定时监控一并设计。
6. 热度等级改为账号内相对分位（P90/P50 阈值），跨平台不比较绝对互动量——绝对互动值对小账号无业务含义。
7. 评论洞察增加降级规则与"手动粘贴热门评论"入口：主页列表/手动导入通常拿不到评论，拆解模块不得硬依赖。
8. 报告限流：账号汇总报告一期限定 Markdown 文字统计；多账号对比一期限 2 个账号、改用聚合摘要法（严禁作品原文进对比 prompt），控制 token 成本。
9. 原【加入选题库】改为【收录为选题】：【选题库】栏目本期不存在，一期落点为【信息收集】主题目录写入选题条目，预留 pushTopic 接口，后续仅切换写入目标。
10. 新增合规约束并入开发约束章节；第一章参考项目全部替换为已核验数据（V1 引用项目 star 极低，降级为同路人参照），并补充闭源产品功能基线对照。

## 一、GitHub 可参考开源项目（已核验，2026-09-25）

1. **NanmiCoder/MediaCrawler**（65.7k★，非商业协议）：第一采集参照。7 平台全支持"指定创作者主页"采集与评论采集；技术路线 = Playwright 保留登录态、在页面 JS 上下文取签名参数（不逆向）；数据字段与平台适配器分层可直接照抄；其 Pro 版"内容拆解 Agent + Claude Code 一键安装"证明"采集 + AI 拆解"路线已被市场验证。协议非商用，只借鉴设计不引入代码。
2. **Evil0ctal/Douyin_TikTok_Download_API**（20.3k★，Apache-2.0）：官方提供 MCP server，是第四章 MCP 采集接口的直接对照范本，协议无传染风险；验证期用它跑通单平台。
3. **microsoft/playwright-mcp**（37.5k★，Apache-2.0）+ **unclecode/crawl4ai**（84.2k★，Apache-2.0）：二期 MCP 采集层双底座——前者管登录态通道，后者管公开页通道。
4. **DIYgod/RSSHub**（46k★）：免登录哨兵通道，作账号更新触发器；拿不到互动明细与正文，只做增量监控哨兵，不做主干。
5. **instaloader**（13.4k★）/ **snscrape**（5.4k★）/ **TikTok-Api**（6.7k★）：设计范本——"账号 → 作品迭代器 → 每作品一个子目录"的素材组织、平台原生 ID 作去重主键、cursor 分页协议、限流退避重试。
6. **wechat-article-exporter**（13k★，MIT）：公众号通道首选（含阅读量/评论数据）。
7. **niupTang/douyin**（94★，2026-06 创建，实为 Sunbird OS）：产品形态与本场景几乎同构（对标账号主页同步 + 作品层/迁移层双层拆解 + 多账号矩阵），但极年轻、无标准 license，只借鉴设计不依赖。
8. 核验结论：V1 引用的 Roost（5★）、Trending Digest（1★）、niupTang/douyin 均真实存在，但皆为 2026 年新生个人项目，仅作同路人设计草稿参照，不构成成熟先例。
9. 风险信号：wewe-rss、bilibili-api、bilibili-API-collect 一年内相继归档——平台施压会让采集通道"猝死"，印证"采集层外置、主路径不依赖外部采集器"的决策。
10. 闭源产品功能基线（新榜/蝉妈妈/灰豚）：对标账号分组 + 仪表盘趋势 → 爆款素材库 → 多账号横向 PK → 粉丝画像/评论热词 → 定时监控 + 周报月报 → AI 分析入口；本功能模块清单已覆盖该基线。

共性可复用设计：账号档案 + 作品素材库 + 单作品拆解卡片 + 账号总览报告 + 多账号对比看板；所有采集素材本地保存，AI 分析结果与状态写入元数据。
共性坑点：国内社交平台（小红书/抖音/知乎）没有原生 RSS，只能网页抓取兜底，MCP 层预留网页抓取能力并与【信息收集】共用同一 MCP 抓取服务；且国内平台风控持续收紧、采集通道随时可能失效（见第 9 条），一期主路径必须不依赖它。

## 二、栏目完整功能清单（一期 / 二期）

### 一期（必须做）

**模块 1：对标账号档案管理面板**
1. 添加对标账号：账号名称、平台、主页链接、赛道标签、优先级（高/中/低）、备注；支持清单 JSON 批量导入。
2. 清单 JSON 导入/导出备份为必做项：账号清单存浏览器 localStorage，换浏览器即丢，导出文件是唯一兜底。
3. 账号列表卡片：账号名称、平台、赛道、最后采集时间（lastSyncedAt）、作品总数、爆款数量、启用/禁用监控开关。
4. 账号档案：简介、定位、粉丝量级、变现方式。
5. 更新检查与补采（替代定时监控的一期形态）：每账号可配置采集周期（每日/每 3 天/每周），仅作提示依据、不驱动定时任务；"手动检查更新"比对 lastSyncedAt 与采集周期，过期提示补采；"打开栏目时补跑"自动扫描过期账号并给出补采入口。
6. 操作：新增/编辑/删除账号、手动检查更新、清空该账号本地缓存素材。

**模块 2：作品素材库（手动导入通道 + 素材管理）**
1. 手动导入为一期采集主路径：粘贴标题/正文/链接/互动数据，封面可选 URL 或本地上传；保证没有任何采集器时全流程开箱可用。
2. 列表字段：作品标题、发布时间、最新互动数据、热度等级、平台链接、AI 拆解状态（none/pending/running/done/failed）。
3. 三元组去重：`platform + accountId + platformWorkId` 写入前查重，重复 upsert 并追加 metrics 快照，不覆盖历史（爆款增长曲线依赖时序）。
4. 筛选：按账号、平台、热度、是否爆款、拆解状态筛选；关键词搜索标题/正文。
5. 单作品卡片操作：侧边预览（正文/文案）；AI 拆解；标记爆款/收藏；关联【信息收集】素材库；【收录为选题】（见第七章）。
6. 素材存储：作品正文写 assets 内文件；拆解状态、互动快照、采集游标全部写入磁盘清单（见第四章），不驻留浏览器。

**模块 3：AI 单作品结构化拆解（核心 Skill 能力）**
1. 输入约束：只喂"标题 + 正文 + 互动数据"，不喂 HTML/截图/原始响应，控制 token 成本。
2. 拆解输出：基础信息（标题范式、封面策略、发布时间）；钩子分析（痛点/悬念/反常识/故事）；内容结构（段落框架、案例类型、论据）；人群痛点（用户需求、用户异议）；爆点判断（为何互动高、可复用点、风险点：同质化/违规词）；可迁移选题建议。结构化核心字段见第四章 analysis.result，完整报告写 ref 文件。
3. 评论降级：主页列表/手动导入通常拿不到评论，`commentInsight: "unavailable"` 是合法输出；拆解提示词必须含无评论分支；提供"手动粘贴热门评论"补充入口；模块不得硬依赖评论。
4. 队列与状态机：批量拆解经网关 AI 队列串行执行（上游 429/无额度是常态），状态 none|pending|running|done|failed，failed 记录 error 且可重试，部分成功不阻塞整体。

**模块 4：账号汇总报告（单对标账号全景分析，Markdown 文字统计版）**
采集完一批作品后一键生成，写 assets 报告文件：1. 账号内容策略：选题分布表、固定内容栏目、内容更新节奏；2. 标题&钩子模板：高频标题句式、最常用钩子类型频次；3. 爆款规律：哪些选题/格式更易出高互动作品、爆款 vs 普通作品差异；4. 受众画像：评论用户群体与核心诉求（无评论数据时明确标注）；5. 变现路径：变现方式与内容转化引导；6. 短板与机会：薄弱内容方向与机会点。报告标注数据来源与采集时间；饼图/图表化二期。

**模块 5：双账号横向对比报告（聚合摘要法）**
1. 一期限选 2 个账号生成横向对比（UI 预留多选控件，二期放开至 5）；对比维度：选题分布、发布频率、爆款选题交集/差异、标题与钩子风格、赛道空白机会点、差异化内容建议。
2. 严禁把作品原文喂进对比 prompt：每账号先聚合为 ≤1k token 结构化摘要（选题分布/钩子统计/更新频率/爆款率），再生成对比。

### 二期（后续迭代，本次开发预留 UI 入口）

**模块 6：定时监控任务（host 侧真调度）**
host 侧调度 + 自动拉新 + 自动拆解 + 新内容简报；`_schedule.json` 集成随本模块一并设计，不得改动其既有读写逻辑。

二期其余清单：
1. 评论批量情感统计、高频关键词热词词云
2. 竞品选题时序趋势图
3. 报告图表化（饼图/看板）
4. 竞品预警：热点内容发布、重大内容方向变更提醒
5. 多账号对比放开至 5 个账号
6. 【收录为选题】切换写入【选题库】二级栏目（仅切换写入目标，接口已预留）
7. 一键推送创作工作台（跨插件契约）
8. 账号配置迁移服务端存储
9. MCP 各平台适配器逐个接入（playwright-mcp / MediaCrawler 系）+ RSSHub 哨兵通道

## 三、数据存储规则（沿用现有规范，按"状态随素材走"修订）

DSH 根目录 `~/.dsh/`：
1. 作品正文、AI 拆解报告、账号/对比报告：保存至 `~/.dsh/outputs/<主题>/assets/`（落点命名见八章修订）。
2. 采集游标（lastSyncedAt 等）、去重键、AI 拆解状态与结果、互动数据快照：一律随条目写入主题目录下的磁盘清单——素材在磁盘，状态必须在同一份元数据里，杜绝跨端分裂。
3. 浏览器 localStorage 只保留三类：对标账号清单、监控偏好（采集周期/开关）、UI 状态；一期必须提供清单 JSON 导入/导出备份。
4. 一期不写 `~/.dsh/outputs/_schedule.json`：契约未定不污染排期文件；竞品监控简报与选题计划的 _schedule.json 集成随二期定时监控一并设计，且不得改动其既有读写逻辑。
5. 禁止在 `.dsh` 根目录新建自定义文件夹；所有素材严格复用现有 output 目录体系；仅智能体产出写入 output 目录后，作品库才会加载内容。

## 四、数据契约（交付硬依据，先冻结本章再开发）

### 4.1 条目 kind 枚举
`info-material | competitor-work | account-report | compare-report | topic-idea`（与【信息收集】栏目共用同一套条目规范；磁盘落点见八章修订）。

### 4.2 competitor-work 条目字段草案
```yaml
kind: competitor-work
id: cw-<uuid>
account_id: acc-<uuid>            # 指向浏览器侧账号清单
platform: xhs|douyin|wechat|bili|zhihu|toutiao
platform_work_id: "..."           # 与 platform、account_id 合成去重键
title: "..."
url: "..."
published_at: 2026-09-25
text_ref: assets/cw-<id>.md       # 正文素材（落点见八章修订）
metrics:                          # 互动快照数组，只追加
  - { t: 2026-09-25, likes: 0, comments: 0, shares: 0, views: 0 }
heat:
  level: hot|normal|cold
  score: 0
  method: account-p90
marks: { hot: false, favorite: false }
analysis:
  status: none|pending|running|done|failed
  error: ""
  ref: assets/ca-<id>.md
  result:                         # 结构化核心字段，完整报告见 ref
    hook_type: "..."
    structure: "..."
    pain_points: []
    topics: []
    risks: []
    reusable: []
    migration_topics: []
    comment_insight: unavailable|text
source: { via: manual|mcp, gathered_ref: "" }
```

account-report / compare-report 条目：`id`、`kind`、`accountIds[]`、`ref: assets/cr-<id>.md`、`createdAt`、`scope`（workCount、window 等）。

### 4.3 去重与状态机规则
1. 去重键 = `platform + account_id + platform_work_id`；写入前查重，重复则 upsert 并追加 metrics 快照，不覆盖历史快照（爆款增长曲线依赖时序）。
2. 拆解状态机 `none | pending | running | done | failed`；failed 记录 error 且可重试；批量拆解经网关 AI 队列串行执行，部分成功不阻塞整体。

### 4.4 热度规则（heat.method = account-p90）
互动分 = likes + 2×comments + 3×shares（有 views 再加权）；按该账号最近 30 条分布取相对分位：≥P90 → hot，P50–P90 → normal，<P50 → cold；跨平台不比较绝对互动量。

### 4.5 MCP 预留采集接口（一期只定义签名不实现，二期接入）
- `resolve_account(platform, homepage_url) -> AccountProfile { account_id, nickname, avatar_url, follower_count, work_count }`
- `list_works(account, cursor?, since?, limit?) -> { works: WorkMeta[], next_cursor }`（WorkMeta 必带 create_time + stats + dedup_key 三件套）
- `get_work(platform, work_id) -> WorkDetail`（正文/口播文案、互动明细）
- `list_comments(platform, work_id, cursor?, limit?) -> { comments, next_cursor }`（独立分页，深浅可控）
- `fetch_asset(url, save_path) -> AssetRef { local_path, bytes, sha256 }`

返回一律 normalized + raw 双层：normalized 供 UI/AI 消费，raw 存档供字段回溯。

### 4.6 采集 Provider 三态协议与错误码
1. 三态：成功 / 部分成功 / 失败；单平台失败不拖垮全局。
2. 结构化错误码：`NOT_LOGGED_IN / SIGN_EXPIRED / RATE_LIMITED / PLATFORM_CHANGED / NOT_SUPPORTED`；UI 必须给出"该平台登录态过期，请重登"级别的明确提示，而非笼统失败。

## 五、架构实现方案（和信息收集保持统一架构）

1. **采集层**：一期主路径 = 手动导入（UI 表单直写第四章契约，不经任何外部工具）；MCP 网页抓取仅预留第四章接口签名、二期实现；二期 Provider 按平台逐个接入（playwright-mcp 登录态通道 / crawl4ai 公开页通道 / MediaCrawler 系适配器 / RSSHub 哨兵），全部实现三态协议与结构化错误码；预留扩展第三方爬虫 API；不硬编码爬虫。
2. **AI 分析层**：DSH Skill，两套：①单作品拆解 Skill（输入仅标题+正文+互动数据，提示词含无评论分支）；②汇总/对比 Skill（每账号先聚合 ≤1k token 结构化摘要再对比）。Skill 不做网络抓取，只接收素材文本，执行结构化提取、分析、生成报告。
3. **UI 层**：DSH 侧边栏没有二级栏目概念——本栏目 = 工作台 overlay 左侧导航新增视图 `competitors`（导航名"对标账号"），注册方式沿用现有导航数组；UI 组件与视觉沿用现有工作台风格（左侧导航+分栏、列表/侧边预览/卡片）；复用 DSH 扩展槽位；浮层预览复用现有 overlay。
4. **文件读写**：经 content-outputs 网关的受控写面（gather 同款），网关外禁止直接 fs；AI 调用经网关注入的共享 `llm` 服务，显式按钮触发、可失败、可重试，不新增直连模型接口。

## 六、开发约束与合规（硬性限制）

开发约束（和信息收集保持一致）：
1. 可改范围 = packages/client/ui-content-studio、packages/creation/content-outputs 两个插件包（content-schedule 零改动）；DSH core/vendor 零改动。不修改 DSH 原有目录结构、output 文件规范、OutputMetadata schema；不改动 `_schedule.json` 原有读写逻辑（一期亦不写入该文件）。
2. 所有采集素材、报告文件统一放在 `<主题>/assets/` 子目录，不直接放主题根目录。
3. 浏览器本地存储只放账号清单、监控偏好、UI 状态；采集游标、去重键、拆解状态与结果、互动快照一律随素材落盘，不得驻留浏览器。
4. 第四章数据契约先行冻结再开发；kind 枚举、字段、状态机、错误码不得在实现期私自变更。
5. 保持插件动态加载模式，不改动主项目构建流程；禁止手改发行仓库 dist 与 zip。
6. 网页抓取只预留 MCP 调用入口（第四章签名）；本期优先完成 UI、素材管理、AI 拆解逻辑，不硬编码爬虫。

合规约束：
7. 只处理用户已登录可见、手动导入或授权采集的内容；界面标注"数据仅供内部研究使用，责任自负"。
8. AI 拆解输出限定"范式借鉴"（结构/钩子/选题角度），禁止生成可直接替代原文的洗稿文本。
9. 报告与拆解结果标注数据来源（平台/链接）与采集时间；永不存储平台账号凭证。

## 七、交付物

1. 工作台 overlay 左侧导航新增"对标账号"视图：对标账号档案管理面板（含清单 JSON 导入/导出备份）、作品素材列表库（手动导入通道 + 三元组去重 + 筛选搜索 + 爆款标记/收藏 + 关联信息收集）、作品侧边预览、AI 单作品拆解（队列状态机 + 评论降级 + 手动粘贴评论入口）、账号汇总报告（Markdown 文字统计版）、双账号横向对比报告、手动检查更新与打开栏目补跑。
2. 数据契约落地：磁盘清单新 kind 条目读写、去重与快照追加、拆解状态机，与【信息收集】条目规范同惯例（`_` 前缀清单文件，作品库不渲染）。
3. MCP 预留采集接口（4.5 五方法签名）、Provider 三态协议与错误码定义（4.6）；文件读写复用 content-outputs 网关既有能力；AI 拆解、汇总分析经网关共享 `llm` 服务。
4. UI 风格与现有内容工作台、【信息收集】栏目保持统一；不改动 DSH 原有目录与文件规范。

**落地顺序（必须按此推进）**：
定数据 schema（第四章契约）→ 手动导入闭环跑通 UI + AI 拆解 → 验证期用 Douyin_TikTok_Download_API 的现成 MCP 跑通单平台 → 二期按平台逐个接适配器（playwright-mcp / MediaCrawler 系）+ RSSHub 哨兵通道。

**新增交互需求（V2 修订版）**：
一期 UI 不出现【加入选题库】按钮（【选题库】栏目本期不存在），改为【收录为选题】：点击后在当前主题目录写入一条选题条目，自动携带标题、来源账号、平台、AI 提炼的选题描述、差异化建议、原文素材引用（source.workId）。预留 `pushTopic` 接口定义，待选题库栏目交付后仅切换写入目标即可。"一键推送至创作工作台"为二期跨插件契约，一期 UI 不出该入口。

## 八、实现修订（对照现实代码，2026-09-25 勘察结论）

> 以下六点是对第四章/第七章字面规定的落点修正，依据是现有代码的硬约束（gather 提示词 v2.1 与
> content-outputs 网关实现先行确立了惯例）。工程实现以本章为准。

1. **状态清单落点**：`OutputMetadata`（`.dsh-output.json`）是主题级单对象（title/kind/platform/status/tags/summary），且属禁改 schema；作品级状态不可写入。competitor 状态清单落盘为 `<主题>/assets/_competitors.json`（`_` 前缀惯例，作品库不渲染，scan 的 assetCount 已排除 `_` 条目），结构 `{ formatVersion: 0, syncedAt: {<accountId>: ISO}, works: [...], reports: [...] }`。
2. **资产文件平铺**：网关资产路径守卫只允许单层纯文件名（拒绝 `/`、`\`、`..`），不设 `assets/works/` 等子目录。文件命名前缀约定：`cw-<id>.md`（作品正文）、`ca-<id>.md`（单作品拆解报告）、`cr-<id>.md`（汇总/对比报告）、`idea-<id>.md`（收录为选题的选题条目）。
3. **analysis.status 持久化面**：`pending|running` 是视图内存态（崩溃后残留无意义）；磁盘只持久化 `none|done|failed`（+error）。
4. **AI 并发**：沿用 gather 网关 AI 队列策略"同一时刻并发 1"（≤ V2 上限 2；上游 429/无额度是常态），429 读 Retry-After、否则指数退避封顶 30s、最多 4 次。
5. **收录为选题落点**：`_gather.json` 条目 schema 严格校验且 gather 前端未交付，topic-idea 一期落为 `idea-<id>.md`（带结构化 YAML 头：标题/来源账号/平台/选题描述/差异化建议/原文引用），gather 后续可索引 `idea-*.md`。
6. **前端入口**：工作台 overlay 左侧导航数组（ContentStudio.tsx `NAV_ITEMS`）新增 `competitors` 视图，置于"对标"之后；不注册新槽位、不动 sidebar.footer.action。
