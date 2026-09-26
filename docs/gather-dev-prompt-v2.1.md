# ZCode 开发提示词 v2.1：内容创作工作台・【信息收集】（gather 视图）开发

> 用途：在现有内容创作插件内新增"信息收集"页面。改哪里、怎么改、何为完成，以本文为准；
> 本文与现实代码冲突时，停下报告，不要自行发明机制。
> 修订：v2.1（2026-09-25）——依 GitHub 同类项目（Miniflux / FreshRSS / Folo / Karakeep）调研合入六处修订：
> ① feed 拉取收敛到网关（CORS，一.4 / 五.1）；② 限额清理豁免收藏/待创作（模块 3）；
> ③ 正文清洗改白名单 + CSP 兜底（模块 3）；④ Windows 原子写与重试（五.5）；
> ⑤ 打开时补抓与 visibilitychange，仍非后台轮询（模块 2）；⑥ 库选型 feedsmith / normalize-url / write-file-atomic / p-queue + p-retry（五.4 / 五.5）。

## 前置事实（已核对，直接采用）
- 工作仓库：D:\deepseek-harness 源码包：packages/client/ui-content-studio（前端）、
  packages/creation/content-outputs、packages/creation/content-schedule（Typert Remote）。
  本次可改范围=这三个插件包；DSH core/vendor 及其余包零改动（消费既有能力不算改动）。
  发行仓库 D:\dsh-content-studio\ 仅经现有 build/sync/pack 脚本产出（当前 v0.1.2-rc.5），
  禁止手改 dist 与 zip。
- UI 落点：DSH 侧边栏没有二级栏目概念。sidebar.footer.action 槽位已被现有入口按钮占用，
  shell.overlay 已承载工作台（现有导航：workbench/chat/benchmark/topics/library/create/accounts/persona）。
  本页面 = 工作台 overlay 左侧导航新增视图 gather（导航名"信息收集"），注册方式沿用现有导航数组，
  不注册任何新槽位。前端入口路径沿用现有挂载产物机制，动手前核对 bundle/web-app 依赖与
  打包产物中的实际 client.js 路径，不硬编码新 URL。
- content-outputs 现为只读投影网关（唯一方法 list()）。本任务授权在该网关内新增受控写面
  （见五.1），list() 与扫描投影逻辑不变。
- AI 上游额度不稳定（429/无额度是常态）：AI 功能必须显式触发、可失败、可重试（见五.3）。
- 运行环境为 Windows 本机：网关侧文件整体替换必须容忍杀软/搜索索引器对刚关闭文件的瞬时句柄占用
  （重试退避，见五.5）；数据目录不得位于 OneDrive 等同步文件夹内。

## 术语表
源=RSS/Atom 订阅配置；任务=一次采集配置（源+主题+过滤）；素材=一条采集结果；
主题=~/.dsh/outputs/<主题>/ 作品主题；清单文件=主题下 assets/_gather.json。

## 一、架构约束（不可违反）
1. 插件形态不变：前端 Bundle 动态加载，不进 DSH 主 Vite 构建图；插件自注册 Remote，DSH 官方 BFF 零感知。
2. 存储分两层：
   - 磁盘（仅经五.1 网关写面）：素材正文快照、摘录 → outputs/<主题>/assets/；
     素材元数据 → outputs/<主题>/assets/_gather.json（下划线前缀，与 _schedule.json 同惯例，
     作品库不渲染；若现有扫描未过滤下划线文件，在 content-outputs 投影处补过滤）。
   - 浏览器侧（本期不落盘）：源配置、任务配置、采集日志、已读状态 → 优先复用现有
     studio-store/slot 持久化轴；若无现成命名空间，用裸 localStorage 统一前缀
     content-studio.gather.，集中一个 storage 模块读写，禁止散落调用；
     该模块读不到数据时用默认值重建、写失败（配额/隐私模式）时降级为仅内存并提示。
     清空浏览器数据只丢源/任务配置，素材仍完整。
3. 禁止在 ~/.dsh 根目录新增文件夹；不修改 _schedule.json 与 ScheduleItem schema；
   不扩 OutputMetadata（formatVersion 不动）。
4. feed 的 HTTP 拉取只发生在网关侧：浏览器内禁止直接 fetch 跨源 RSS/Atom
   （绝大多数源不带 CORS 响应头，直抓必被拦；Miniflux/FreshRSS/Folo 均为服务端抓取）。
   前端只负责调度与触发；网关侧实现可消费 packages/web 既有 fetch 能力（对该包零改动）；
   网关外禁止任何网络抓取。

## 二、页面定位
工作台内"信息收集"视图 = 素材采集入口：源管理、采集任务、素材库、素材详情，
面向中小企业/自媒体/超级个体/OPC 的选题情报采集。视觉与交互沿用现有工作台风格
（左侧导航+分栏）。本期支持 RSS/Atom；网页抓取与 MCP 仅预留接口（见五.4），不实现。

## 三、模块清单与交互语义

### 模块 1 源管理
- 字段见四.1。操作：增/删/改、启停、测试连接（经网关 fetchFeed 拉一次 feed 摘要验证）、
  标签、排除关键词。
- OPML 导入：先预览列表（还原 folder 分组、标重复项、默认全选有效项）、确认后写入；
  URL 重复自动跳过；不覆盖同名已有源；
  导出前警示"源地址可能含私有 token，导出文件请妥善保管"。
- 上限：源总数 ≤100。

### 模块 2 采集任务
- 字段见四.2。操作：手动触发单次、暂停/恢复、删除、查看日志（每任务环形保留最近 20 条）。
- 定时：仅工作台打开期间前端调度（setInterval，允许后台标签节流漂移）；
  visibilitychange 隐藏时暂停、恢复可见时若距上次采集已超间隔则立即补跑；
  工作台打开时若距上次采集已超间隔，带任务 since 游标补抓一次
  （这是"不做后台轮询"约束下的通行补偿，不算后台轮询）；
  浏览器或工作台关闭即停，不做任何后台轮询。UI 文案如实呈现该限制
  （"仅工作台打开时采集"）——这是产品事实，不是缺陷，禁止私下实现后台补偿。
- 失败语义：拉取失败保留该源已有全部素材与已读/收藏状态，任务标记 failed
  并记录时间与错误摘要，绝不因失败清空或覆盖已有数据；
  连续失败的源按 1h→2h→4h 指数退避（封顶 24h）；
  网关按源持久化 etag/lastModified 条件请求游标，命中 304 视为成功、仅更新 lastFetchedAt
  （对齐 Miniflux 的条件请求行为）。

### 模块 3 素材库（左列表+右详情分栏）
- 列表字段见四.3。筛选：主题/来源/标签/状态；搜索标题与摘要。
- 去重：素材唯一 ID = feed item guid，缺失则 sha1(normalize-url 规范化后的 link)
  （normalize-url 默认剔除 utm_* 等跟踪参数并对查询串排序）；网页抓取用 sha1(规范化 URL)；
  去重键按 (sourceId, dedupKey) 复合，条目落盘时同时保留原始 guid 与规范化 link，
  便于后续更换策略重算。刷新按 ID 去重，已读/收藏/标签等用户状态永不覆盖。
- 限额：每源每主题保留最近 50 条 unread|read 状态的素材；
  favorite|picked 素材及其正文快照永不自动清理（业界通行：用户标记条目豁免清理）；
  单篇正文快照超 100,000 字符截断并显示"打开原文"入口；
  只有摘要的源不强行抓全文，直接提供"打开原文"。
- 安全：正文在网关落盘前经 sanitize-html 白名单（allowlist）清洗——
  禁止手写"删 script/iframe/内联事件"式黑名单（挡不住 javascript:/data: URI、
  SVG/MathML mXSS、DOM clobbering 等向量）；前端渲染前再用 DOMPurify 兜底
  （USE_PROFILES:{html:true}、KEEP_CONTENT:false）；
  工作台页面配 CSP（script-src 'self'、object-src 'none'、base-uri 'self'）作纵深；
  正文快照按需生成，不自动抓取全站资源。
- 用户操作：标已读/收藏/待创作；显式"AI 处理"按钮（摘要/要点/选题打分/打标签，见五.3）；
  绑定/切换主题（素材文件与清单条目一起迁移）；
  一键推送至创作视图（经现有 studio-store/controller 标记 picked 并跳转 create 携带素材 ID，
  不复制正文）。

### 模块 4 素材详情
右侧详情区展示原文（已清理）、AI 摘要/要点/分数/标签、采集元信息；
支持摘录片段，保存至当前主题 assets 并写回清单条目。不新开 shell.overlay 实例。

## 四、数据模型（字段级，照此实现）
1. 源（浏览器侧）：id(随机稳定ID) / name / url / intervalMinutes(≥30) / enabled / tags[] /
   excludeKeywords[] / createdAt / lastFetchedAt / lastStatus(ok|failed) /
   etag? / lastModified?（条件请求游标，见模块 2 失败语义）。
2. 任务（浏览器侧）：id / name / sourceIds[] / themeName(对应 outputs/<主题>/) /
   maxItemsPerRun / since / includeKeywords[]? / excludeKeywords[] /
   aiEnabled(仅控制手动 AI 按钮默认显隐，不代表自动调用) / intervalMinutes?(空=仅手动) /
   status(idle|running|done|failed，运行态仅内存) / log[](环形 20 条)。
3. 素材（清单条目）：id(去重键) / sourceId / sourceName / title / url(规范化后) / publishedAt /
   gatheredAt / status(unread|read|favorite|picked) / summary? / points[]? / score? /
   tags[]? / excerpts[]? / bodyFile?(正文快照文件名，可选) / rawGuid?（原始 guid，便于重算）。
4. 清单文件：{ "formatVersion": 0, "materials": [...上述条目] }；
   写入经网关整体读改写，实现方式见五.5（临时文件 + 原子替换，写失败不得破坏旧文件）。

## 五、网关与 AI 约定
1. content-outputs 新增 gather 写面（唯一授权写路径，网关外禁止直接 fs）：
   fetchFeed(source) / writeAsset(theme, file, content) / readGatherManifest(theme) /
   writeGatherManifest(theme, manifest) / moveAsset(theme, from, to) / deleteAsset(theme, file)。
   fetchFeed 按源拉取并解析 feed，返回条目草稿数组与 http 元信息（etag/lastModified/notModified），
   仅网络读取、不落盘，实现消费 packages/web 既有 fetch 能力（对该包零改动）。
   路径硬限制在 outputs/<主题>/assets/ 内，拒绝 ..、主题根与绝对路径。list() 只读投影不变。
2. content-schedule 零改动：仅当用户显式"加入内容日历"时，经现有网关写入 kind:'event' 条目；
   采集任务与源配置不写 _schedule.json。
3. AI 调用：经插件内置 skill 走 DSH Agent 能力，不新增直连模型接口。全部显式按钮触发，
   不自动批量处理；同一时刻并发 1（队列实现用 p-queue）；
   上游 429/无额度时条目显示"未生成（AI 暂不可用）"与重试按钮
   （重试用 p-retry：429 优先读 Retry-After 头，否则指数退避封顶 30s，最多 4 次）；
   AI 失败不影响采集、入库、浏览；结果写回清单条目（幂等，重复点击不产生重复条目）。
4. 采集器抽象：定义 GatherAdapter 接口（fetch(source): MaterialDraft[]），
   本期只实现 RssAdapter；RssAdapter 解析统一用 feedsmith
   （单库覆盖 RSS 2.0/Atom/RDF/JSON Feed 解析与 OPML 读写），URL 规范化用 normalize-url；
   MCP 网页抓取未来作为另一 adapter 接入，不硬编码爬虫逻辑。
5. 原子写规范：清单与元数据的整体替换一律用 write-file-atomic
   （tmp+rename、默认 fsync、同文件写自动串行、失败自动清理 tmp 不碰旧文件）；
   Windows 上对 rename 的 EPERM/EACCES/EBUSY 按指数退避重试（100ms 起，最多 5 次）；
   tmp 与目标同目录同卷（跨卷 rename 报 EXDEV）；网关进程启动时清理孤儿 tmp 文件。

## 六、禁用清单
- 禁止修改 DSH 主仓库目录结构、outputs 文件规范、OutputMetadata schema、
  _schedule.json 与 ScheduleItem。
- 禁止把源配置/账号画像/任务配置写入磁盘（本期仅浏览器侧）。
- 禁止素材写入主题根目录（必须 assets/）；禁止网关外的直接文件读写。
- 禁止浏览器内直接 fetch 跨源 RSS/Atom；禁止网关外发起任何 feed 抓取。
- 禁止手写 HTML 清洗黑名单；清洗只允许 sanitize-html（网关落盘前）与 DOMPurify（渲染兜底）。
- 禁止注册新槽位或新 footer action；禁止侵入主 Vite 构建。
- 禁止自动/后台 AI 调用；禁止后台轮询采集
  （打开时超间隔带 since 补抓一次与 visibilitychange 暂停/恢复不在此列）。
- 禁止手改发行仓库 dist 与 zip。

## 七、验收 checklist
1. 侧边栏与槽位零新增；"信息收集"出现在现有工作台 overlay 左侧导航。
2. 源增删改测（测试连接走网关 fetchFeed）、OPML 预览导入（重复跳过）；
   清空 localStorage 后源/任务消失、素材与清单完整保留。
3. 手动采集：素材写入 outputs/<主题>/assets/_gather.json 与快照文件；
   断网重试不丢已有素材、用户状态保留；限额清理不触及 favorite/picked 及其快照。
4. 切换主题绑定：文件与清单条目同步迁移。
5. AI 按钮：模拟上游 429 → 显示"未生成"，采集/浏览不受影响；成功 → 摘要/分数写回清单。
6. 恶意正文 fixture（含 script/iframe、javascript: URL、SVG/MathML 向量）经网关 sanitize-html
   与前端 DOMPurify 后渲染无脚本执行。
7. 作品库不把 _gather.json 当作品渲染；list() 行为不变；content-schedule 零改动。
8. 构建经源码包完成，相关包 pnpm run test 通过；工作台关闭后无残留定时器。
9. 在 :3080 web profile 安装后手动冒烟：打开工作台 → 信息收集 → 添加一个真实源 →
   采集 → 素材出现在作品库对应主题 assets。
10. 打开即补抓：关闭工作台期间源有更新 → 重新打开后自动带 since 补抓一次；
    标签页隐藏再恢复且超间隔后补跑；网关返回 304 时仅更新 lastFetchedAt、素材零变化。
