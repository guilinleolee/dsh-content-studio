# @guilinleolee/dsh-content-schedule

[English](README.md) | 中文

内容创作库的发布日历 Remote：`contentSchedule/list|put|delete`，落在产物库根目录的一个系统文件 `_schedule.json` 上（默认 `<dsh home>/outputs`，可用 `root` 配置覆盖）。`_` 前缀让产物扫描器把它当作系统条目，库目录保持为 agent 也能读取的唯一内容创作磁盘面。

一个条目是一个日程：标题、`YYYY-MM-DD`（可选 `HH:mm`）、平台、`idea → draft → scheduled → published` 状态、内容或活动类型、可选的产物项目 topic 关联、发布后的 URL。`put` 仅按 id 做 upsert（缺失或未知的 id 即新建；id 为生成的 UUID）；`delete` 对未知 id 是无操作而非报错。每个方法都在 atomic-write 写者锁下读取或提交文件——读不加锁，并发写串行化。校验遵循产物扫描器的规则：一条损坏的记录在 `problems` 中具名并跳过、绝不静默丢弃；`formatVersion` 不支持的文件按空日历加载并上报问题。

## Model Experience

无，本包为客户端展示读写日历文件；没有任何内容进入模型请求。

#### KV Cache effect

无；本包不组装也不发送任何 provider 请求。

## Known Limitations and Deferred Work

- **无 agent 侧工具**——模型尚不能读取或驱动日历；这需要 capability Consumer（工具）或 context 插件，刻意推迟到真实用例指明形态。
- **无平台目录**——平台是自由文本；尚无平台约束目录或校验。
- **全新格式**——`formatVersion 0` 无兼容性承诺，遵循仓库的预发布立场。
