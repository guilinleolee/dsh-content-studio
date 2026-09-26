# @guilinleolee/dsh-content-topics

[English](README.md) | 中文

内容创作库的选题库 Remote：`contentTopics/list|put|delete`，落在产物库根目录的一个系统文件 `_topics.json` 上（默认 `<dsh home>/outputs`，可用 `root` 配置覆盖）。`_` 前缀让产物扫描器把它当作系统条目，库目录保持为 agent 也能读取的唯一内容创作磁盘面。

一个选题是一条贯穿创作流程的创意：标题、一句话简介、`idea → todo → creating → done → shelved` 五态、溯源（`manual`/`gather`/`benchmark` 三类来源，外加素材 id、原始外链和创建时的标题/摘要快照——链接失效也不丢证据）、自由标签与描述、可选的 0–10 打分（手动或 AI；逐因子明细是预留形态）、计划日期 `YYYY-MM-DD`、指向 `_schedule.json` 日历条目的关联、以及指向 `outputs/<topic>/` 项目目录的关联。`createdAt`/`updatedAt` 由存储侧管理——客户端不传；`put` 仅按 id 做 upsert（缺失或未知的 id 即新建；id 为生成的 UUID；更新时保留原 `createdAt`）；`delete` 对未知 id 是无操作而非报错。`list` 按 `updatedAt` 倒序返回。每个方法都在 atomic-write 写者锁下读取或提交文件——读不加锁，并发写串行化。校验遵循产物扫描器的规则：一条损坏的记录在 `problems` 中具名并跳过、绝不静默丢弃；`formatVersion` 不支持的文件按空选题库加载并上报问题。

## Model Experience

无，本包为客户端展示读写选题文件；没有任何内容进入模型请求。

#### KV Cache effect

无；本包不组装也不发送任何 provider 请求。

## Known Limitations and Deferred Work

- **无 agent 侧工具**——模型尚不能读取或驱动选题库；这需要 capability Consumer（工具）或 context 插件，刻意推迟到真实用例指明形态。
- **打分因子为预留字段**——手动打分的 `factors` 恒为 null；逐因子明细为后续 AI 打分阶段预留，本期只校验不产生。
- **身份字段自由**——`put` 接受任意非空字符串 id（身份仅由 id 决定）；只有网关生成的 id 是 UUID，`scheduleItemId`/`refId` 是指向其他包存储的未校验字符串。
- **全新格式**——`formatVersion 0` 无兼容性承诺，遵循仓库的预发布立场。
