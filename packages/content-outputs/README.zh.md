# @guilinleolee/dsh-content-outputs

[English](README.md) | 中文

内容创作产物库的只读 Remote 投影——产物库是 agent（及其技能）写入成品的磁盘面，也是内容创作工作台"内容库"视图读取的数据源。

库约定：库根目录（默认 `<dsh home>/outputs`，可用 `root` 配置项覆盖）下一次创作一个目录——成品文件放项目根，中间素材放 `assets/`，`.dsh-output.json` 是唯一元数据文件（format 版本 0——本后端同样拒绝更旧与更新的格式）。以 `.` 或 `_` 开头的目录名是系统条目，不是项目。`contentOutputs/list` Remote 每次调用直接扫描库根，按主题名序返回项目；损坏或未来格式的元数据不会隐藏其目录——项目以回退值投影并标记 `hasMetadata: false`，无法读取的目录在 `problems` 中具名报告。

## Model Experience

无，本包为客户端展示读取产物库；没有任何内容进入模型请求。

#### KV Cache effect

无；本包不组装也不发送任何 provider 请求。

## Known Limitations and Deferred Work

- **只读**——尚无写入或变更 Remote；创建与更新项目是 agent 通过自身工具完成的职责。
- **不传输文件内容**——投影只携带名字与计数；下载成品字节需要独立的文件服务面。
- **全新格式**——`formatVersion 0` 无兼容性承诺，遵循仓库的预发布立场。
