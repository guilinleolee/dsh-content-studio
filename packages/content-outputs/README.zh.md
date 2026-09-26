# @guilinleolee/dsh-content-outputs

[English](README.md) | 中文

内容创作产物库的 Remote 网关：面向"内容库"视图的只读投影，加上 gather 写面——工作台"信息收集"视图唯一获授权的写入路径。

库约定：库根目录（默认 `<dsh home>/outputs`，可用 `root` 配置项覆盖）下一次创作一个目录——成品文件放项目根，中间素材放 `assets/`，`.dsh-output.json` 是唯一元数据文件（format 版本 0——本后端同样拒绝更旧与更新的格式）。以 `.` 或 `_` 开头的目录名是系统条目，不是项目。`contentOutputs/list` Remote 每次调用直接扫描库根，按主题名序返回项目；损坏或未来格式的元数据不会隐藏其目录——项目以回退值投影并标记 `hasMetadata: false`，无法读取的目录在 `problems` 中具名报告。

## Gather 写面

gather 的全部存储都位于 `outputs/<主题>/assets/` 下：`_gather.json` 清单与 `*.html` 正文快照。路径受守卫（主题名与文件名必须是单一名称段，拒绝穿越）；清单整体替换一律先做限额裁剪，再经文件锁加原子重命名提交；Windows 上对杀软/索引器造成的瞬时占用按退避重试；网关启动时清扫孤儿临时文件。

- `fetchFeed` 在网关侧拉取并解析一份 feed 文档（RSS 2.0、Atom、RDF、JSON Feed），携带源上的 `ETag`/`Last-Modified` 游标；命中 304 只返回 `notModified`。浏览器自身从不抓取跨源 feed。
- `writeAsset` 对 `*.html` 内容先经 sanitize-html 白名单清洗并截断到正文上限再落盘；其他文本文件只受硬性大小上限约束。
- `readGatherManifest` / `writeGatherManifest` 读取与整体替换清单；校验失败的条目在 `problems` 中具名，调用方不得在存在 problems 时基于该读取结果写回。
- `moveAsset` / `deleteAsset` / `readAsset` 覆盖主题内重命名、删除与文本读取。
- `processMaterial` 经共享 `llm` 服务执行一次显式、排队的模型调用（摘要、要点、选题分、标签）；限流按 `Retry-After` 感知退避重试，调用本身不落任何盘。

保留策略：每源每主题保留最近 50 条 `unread`/`read` 素材；`favorite` 与 `picked` 标记及其快照永不自动清理。

## Model Experience

仅显式触发：`processMaterial` 每次用户点击发送一个框架化请求，走共享 `llm` 服务（session-title 一次性调用模式）。本包绝不自动调用模型，且调用失败不影响采集与浏览。

#### KV Cache effect

每次 `processMaterial` 都是隔离的一次性请求；没有可缓存的共享会话状态。

## Known Limitations and Deferred Work

- **投影保持只读**——`list` 永不变更；创建与更新产物项目仍是 agent 通过自身工具完成的职责。gather 写面只写 `assets/` 下的系统文件，从不写成品。
- **成品字节仍需文件服务面**——投影只携带名字与计数。
- **全新格式**——清单与元数据的 `formatVersion 0` 无兼容性承诺，遵循仓库的预发布立场。
