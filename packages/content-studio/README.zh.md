# @guilinleolee/dsh-content-studio

[English](README.md) | 中文

内容创作工作台插件：侧边栏入口 + 全帧创作工作台页面。入口填充侧栏外壳的 `sidebar.footer.action` 槽（宽栏时为带文字的行，窄栏时为图标），工作台填充框架的加法位 `shell.overlay` 槽——两处都是增量挂载，不替换任何现有界面。

一条命令即可装入任何 DSH web profile：`dsh plugin --profile web add @guilinleolee/dsh-content-studio`——本包声明了 `dsh.bundle.patch`，其 insert 清单会一并带上两个 host Remote 网关（`content-outputs`、`content-schedule`），无需任何手工步骤。

本插件是**自包含的 Remote 装配**：`apply` 通过 `ctx.remote.$mount()` 挂载自己的两个 host 贡献（`contentOutputs`、`contentSchedule`）——沿用 api-remotes 确立的模式——浏览器 bundle 自带完整服务端通信面，任何树内 BFF 装配都无需感知本插件的存在。

工作台有三个顶层视图。**开始创作**是双意图能力菜单：成品页签按媒介分组（图文与视觉、文章写作、视频、音频），运营页签按流程阶段分组（发现与选题、策划与定位、发布与质检、数据与复盘）。每项能力带成熟度徽标——**已验证**、**可用**、**需配置**、**接入中**——让选择在运行前就有预期。点击会把含【…】填空标记的结构化指令模板复制到剪贴板；由于 composer 预填通道尚不存在，"粘贴到会话输入框"是用户的一步操作。**内容库**通过 `contentOutputs/list` Remote（`@guilinleolee/dsh-content-outputs`）读取 agent 的产物库，为每个项目目录渲染一张只读卡片——状态徽标、媒介、平台、标签、成品与素材计数——缺元数据的项目以修复提示保持可见，无法读取的目录在 problems 横幅中具名报告。**内容日历**读写发布日历（`contentSchedule/list|put|delete`，`@guilinleolee/dsh-content-schedule`），以周一起始的月历呈现：点击某天打开内联添加表单，每个日程 chip 提供标记已发布与删除——所有操作都经 Remote 提交并按返回快照重渲染。

Escape 或头部关闭按钮收起页面；关闭态渲染 null，槽位注册保持挂载。两个目标槽都由其他插件声明，因此 `apply` 通过单个 `slots.inject()` 生成器按声明生命周期原子安装两个注册，组件共享一个注入的开关控制器。

**信息收集**（Gather）视图是素材采集入口：RSS/Atom 源管理（增删改、启停、测试连接、排除关键词、带重复与分组预览的 OPML 导入、带 token 警示的 OPML 导出）、采集任务（按任务圈定源、绑定主题、关键词过滤、单次上限、可选定时间隔、20 条环形日志），以及由磁盘上 `_gather.json` 清单支撑的双栏素材库。素材支持已读/收藏/待创作标记、摘录片段、主题迁移、显式"AI 处理"按钮（摘要、要点、评分、标签——始终手动触发）、把素材以参考行（而非正文）推送进创作视图，以及加入发布日历。定时采集仅在工作台打开期间运行——主节拍器、对标签页可见性的暂停/恢复、打开时一次超限补抓；关闭工作台即停止全部定时器，界面文案如实说明这一点。源、任务与日志经统一存储模块存放在浏览器侧 `content-studio.gather.` 前缀下；清空浏览器数据只丢这些，素材不受影响。

**复盘**（Review）视图补完运营闭环：各平台指标导出以「解析预览—确认导入」两步流导入 CSV（未知列以勾选框呈现、坏行具名不静默丢弃），只有绑定到创作内容 ID 的作品进入分析池；看板、单作品 AI 诊断与固定六节的周期报告全部以持久化的账号基准线判定（互动率达基准两倍为爆款、低于一半为低表现、发布满 30 天按增速闸门判长尾）。AI 调用失败仍会落一份纯数据版报告；结论一键回流产入选题库，爆款模板存入 `assets/review/templates/`。存储位于主题的 `_review.json` sidecar 与隐藏全局索引——绝不触碰 `.dsh-output.json`。

## Model Experience

间接地，经由其按钮触发的 `dsh-content-outputs` Remote：该网关在共享 `llm` 服务上组装每个框架化请求，本包只拥有点击、进行中状态与重试入口。

#### KV Cache effect

无；本包不组装也不发送任何 provider 请求，不拥有任何请求前缀。

## Known Limitations and Deferred Work

- **无 composer 交接**——点击能力项是复制指令而非预填会话草稿；运行时补上 draft/prefill 通道即可消除粘贴一步。
- **能力目录为静态数据**——菜单项是随包发布的数据，不是从已挂载的技能注册表派生的，因此在目录 RPC 出现之前成熟度徽标需手工维护。
- **内容库只读**——重命名、改标题、发布都通过 agent 完成，本页面不提供；也没有文件内容传输。
- **单实例状态**——开关状态存于每次 apply 的一个控制器实例；该页面不区分会话，也不持有会话上下文。
