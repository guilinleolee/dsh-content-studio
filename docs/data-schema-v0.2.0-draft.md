# DSH内容创作插件 · 统一 JSON 数据模型（Schema）

模块标识：@guilinleolee/content-studio　版本：v0.2.0-draft　状态：待评审
Schema 基准：JSON Schema Draft 2020-12（`$ref` 一律 `#/$defs/...` 片段指针；可空引用用 `anyOf` 表达，不将 `$ref` 与 `type` 并列）。
用途：定义全部栏目数据结构与 MCP 预留接口契约。所有数据类型遵循《全局通用规则》存储规范：正文/报告/快照与各栏目清单进主题 `assets/` 或库根系统文件，输出项目元数据在 `<主题>/.dsh-output.json`，排期在库根 `_schedule.json`，配置/轻量清单存 localStorage。

说明：以下用 JSON Schema 风格描述；`required` 一律为父级数组，不使用内联 `"required": true`；跨类型共享结构在 `$defs` 中定义并以 `$ref` 引用。字段名采用蛇形命名（snake_case），对应实现中的驼峰命名（camelCase）在同名义下一一对应。凡实现已定形的结构以实现为准；凡本版裁决先行而实现暂未落地的结构，均显式标注"裁决先行"，并列明与现状实现的冲突点。变更记录见附录A，文档与实现的逐项对账见附录B。

---

## 〇、通用基础约定

### 0.1 容器与版本约定

**存储落位**：系统清单文件分两层——库根（`outputs/` 根目录）与主题 `assets/` 目录。`_` 前缀文件名使 outputs 扫描器将其识别为系统条目而非项目内容。

统一容器形态：

```json
{
  "$id": "core.container",
  "type": "object",
  "properties": {
    "format_version": { "const": 0, "description": "容器级格式版本；0 表示无兼容性承诺（与实现注释一致），仅结构性变更才递增" }
  },
  "required": ["format_version"]
}
```

| 清单文件 | 落位层级 | 集合字段 | 实体类型 | 章节 |
|----------|----------|----------|----------|------|
| `assets/_gather.json` | 主题 `assets/` | `materials` | 素材 | 1.3 |
| `assets/_competitors.json` | 主题 `assets/` | `works` / `reports`（另含 `synced_at`） | 对标作品 / 对标报告 | 2.2 / 2.4 |
| `assets/_create.json` | 主题 `assets/` | （单稿清单，无集合字段） | 创作工作台状态 | 4.1 |
| `assets/_publish.json` | 主题 `assets/` | `tasks` | 发布任务 | 5.1 |
| `assets/_review.json` | 主题 `assets/` | `baselines` / `snapshots` / `tasks` | 复盘基线 / 指标快照 / 复盘任务 | 7.1 |
| `_topics.json` | 库根 | `items` | 选题 | 3.1 |
| `_schedule.json` | 库根 | `items` | 排期条目 | 6.2 |
| `_calendar.json` | 库根 | `notes`（按排期条目 id 键控） | 日历备注 | 6.1 |
| `_personas.json` | 库根 | `personas` | 画像 | 9.1 |
| `_templates.json` | 库根 | `templates` | 全局内容模板 | 10.1 |
| `_publish-index.json` | 库根 | `entries` | 发布任务全局聚合（可重建的加速层，sidecar 为事实源） | 5.1 |
| `_publish-profiles.json` | 库根 | `profiles` | 发布平台账号卡 | 5.1 |
| `_review-index.json` | 库根 | `rows` | 复盘任务全局聚合（可重建的加速层，sidecar 为事实源） | 7.1 |

- `.dsh-output.json` 是 outputs 项目（主题目录）级元数据文件，承载 `format_version/title/kind/platform/status/tags/summary/create`（见 0.8），不是实体容器；v0.1.x 中"实体 entries 登记于 .dsh-output.json"的说法自本版废止。
- 版本放容器级，不放实例级。
- 无兼容性承诺：后端拒绝 `format_version` 非 0 的文件，报 `unsupported <file> formatVersion`，不做旧格式迁移。
- localStorage 键带版本后缀的约定：`content-studio.<entity>.v<format_version>`（已实现于采集视图：`content-studio.gather.sources.v0`）。已存在的不带后缀键名维持现状，新增键一律带后缀（见 0.7）。

### 0.2 实例基字段 `$defs.instanceBase`

**存储落位**：由存储层在写入时统一注入，客户端提交面（Input）不含这些字段。

```json
{
  "$id": "core.instance",
  "$defs": {
    "instanceBase": {
      "type": "object",
      "properties": {
        "id":         { "type": "string", "description": "实例唯一ID，规则见 0.3" },
        "created_at": { "type": "string", "format": "date-time", "description": "创建时刻，跨更新保留" },
        "updated_at": { "type": "string", "format": "date-time", "description": "最后写入时刻，列表排序键" }
      },
      "required": ["id", "created_at", "updated_at"]
    }
  }
}
```

**适用范围（以实现核实为准，不是全实体通用）**：

| 实体 | 审计字段 | 证据 |
|------|----------|------|
| 选题 topic_draft | 有（`created_at/updated_at`，store 管理、客户端不可提交） | content-topics/src/types.ts |
| 画像 persona | 有（`created_at/updated_at`，网关注入） | content-outputs/src/persona/types.ts、store.ts |
| 模板 template | 部分（仅 `updated_at`，无 `created_at`） | content-outputs/src/create/types.ts |
| 素材 material | 无（仅业务时间 `gathered_at`） | content-outputs/src/gather/types.ts |
| 对标作品 competitor_work | 无（仅业务时间 `imported_at`） | content-outputs/src/competitor/types.ts |
| 排期条目 schedule_item | 无 | content-schedule/src/types.ts |

仅上表"有审计字段"的实体引用 `$defs/instanceBase`；其余实体不引用，不虚构注入行为。

- `collected_at` / `gathered_at` / `imported_at` / `captured_at` / `time` 等是业务时间字段（记录业务事实发生时刻），不顶替审计字段 `created_at/updated_at`。
- 归属主题不是基字段：清单多为全局或按主题目录归档，主题归属以各实体自己的 `topic_id` / `topic_dir` 字段表达（见各章）。

### 0.3 标识符规则（实体 ID 前缀表）

以实现为准。存在固定前缀的实体按下表；其余实体为裸 UUID（`randomUUID()`）。

| 前缀 | 实体 | 生成方 | 证据 |
|------|------|--------|------|
| `acc-` | 对标账号 | 浏览器侧 `newId('acc')` | content-studio/src/client/competitors.ts:158（导入路径）、CompetitorsView.tsx 同函数 |
| `cw-` | 对标作品 | 浏览器侧 `newId('cw')` | content-studio/src/client/CompetitorsView.tsx:322、competitors.ts:262 |
| `cr-` | 对标报告 | 浏览器侧 `newId('cr')` | content-studio/src/client/CompetitorsView.tsx:454 |
| `cc-` | 创作稿件 id（`content_id`） | `cc-<time36><rand>` | content-studio/src/client/create.ts:42 |
| `ct-` | 全局内容模板 | 网关 `ct-<time36><rand>` | content-outputs/src/create/store.ts（putCreateTemplateFile） |
| 无前缀 | 素材 | feed guid，否则规范化 link 的 SHA-1 | content-outputs/src/gather/types.ts |
| 无前缀 | 选题（常规与对标转选题均同） / 排期条目 / 画像 | `randomUUID()` | content-topics/src/store.ts:138、content-schedule/src/store.ts:73、content-outputs/src/persona/store.ts:379 |

> 注记：`idea-` 不是实体 ID 前缀。它仅是"收录选题"的 assets 文件名前缀（`idea-<cw序号>.md`，写入对标作品的 `collected_idea_ref`，见 content-studio/src/client/CompetitorsView.tsx:433），不创建任何实体；v0.1.x 审阅稿曾误将其列为选题实体前缀，本版更正。

v0.1.x 中"栏目类型前缀+随机"的笼统说法废止。新增实体类型时：能从 ID 直接辨认来源的才引入前缀，并在本表登记。

### 0.4 关联 ID 命名约定

单数引用字段以被引实体全名为字段名；复数引用（数组）一律加 `s`/`_ids` 后缀：

| 引用字段 | 指向 |
|----------|------|
| `topic_id` | 主题（outputs 项目目录名） |
| `topic_dir` | 关联的 `outputs/<topic>/` 项目目录名（选题侧实现字段） |
| `source_id` / `source_ids` | 信息源 / 多个信息源 |
| `material_id` | 素材 |
| `account_id` / `account_ids` | 对标账号 / 多个对标账号 |
| `platform_work_id` | 平台原生作品 ID（配合 platform+account_id 作去重键，见 2.2） |
| `topic_draft_id` | 选题 |
| `draft_id` | 创作稿件 |
| `persona_id` / `persona_ids` | 画像 / 多个画像 |
| `template_id` | 模板 |
| `publish_task_id` | 发布任务 |
| `schedule_item_id` | `_schedule.json` 排期条目 |
| `review_id` | 复盘任务 |
| `conversation_id` | 互动会话 |
| `topic_draft.source.ref_id` | 选题溯源引用（素材 id 或对标记录 id；仅存在于 topic_draft.source 内） |
| `ref` | 实体自带的 assets 文件引用（对标作品拆解报告、对标报告） |
| `cloned_from` | 画像克隆来源 |

**对标作品（work）引用的现落点**：v0.1.x 的 `work_id` 在实现中无独立字段，其职责由两处承接——选题溯源经 `topic_draft.source.ref_id`（source.type=benchmark 时指向对标记录 id）；对标作品反向关联收录产物经 `competitor_work.collected_idea_ref`（已收录选题的导出文件名 `idea-*.md`，兼已收录标记）。三轮修订已统一实现口径：原字段名 `gathered_ref` 与其"关联信息采集素材"注释废止（附录B#33，实现侧已同步改名）。

v0.1.x 的 `linked_publish_id` 更名 `publish_task_id`；`material_refs` 更名 `material_ids`（实现侧对应 CreateSourceRef 记录列表，见 4.1）。

### 0.5 受控词汇注册表

**存储落位**：词汇表是 Schema 约定，唯一出处为本节；全部引用点以 `$ref` 指向 `$defs`。

```json
{
  "$defs": {
    "platform": {
      "type": "string",
      "enum": ["xhs", "douyin", "bili", "zhihu", "wechat", "channels", "weibo", "toutiao"],
      "description": "平台词汇全集（画像栏目口径）"
    },
    "competitorPlatform": {
      "type": "string",
      "enum": ["xhs", "douyin", "wechat", "bili", "zhihu", "toutiao"],
      "description": "对标栏目平台子集（本期人工导入支持的 6 值）"
    }
  }
}
```

- 可空平台字段的写法：`"anyOf": [{"type": "null"}, {"$ref": "#/$defs/platform"}]`——null 由独立分支承担，词汇表本身不含 null。
- 全库引用点（对标账号/作品、画像、排期条目、日历事件、互动会话、复盘、发布任务）一律 `$ref` 到上表，不得各自内联 enum。
- 旧词汇映射：`xiaohongshu → xhs`，`bilibili → bili`，`weibo` 在新表中保留原词；`video_account → channels`。
- 扩展流程：新增平台先扩 `$defs.platform` 全集，再评估是否纳入 `competitorPlatform` 子集；中文名标签表与枚举同文件维护（content-outputs/src/persona/types.ts 的 `PERSONA_PLATFORM_LABELS` 模式），禁止只改一处的两表漂移。
- **分数标尺（以实现为准，双标尺并存）**：
  - 素材 AI 选题打分：0–100 整数域（gather 实现）。
  - 选题评分：0–10（总分与因子同标尺），因子置信度 0–1（content-topics 实现）。
  - 禁止跨标尺混写；新字段必须声明所属标尺。

### 0.6 单源规则（canonical）

全局规则：**文件为 canonical，内嵌字段仅限 ≤4KB 的小文本直存。** 本规则为全局默认，以下两处为**显式声明的例外**（实现有意内嵌自含，不适用本规则）：

- **例外一（画像报告）**：画像报告 `report.markdown` 全文内嵌于 `_personas.json`（实现注释明示：条目文本全部内嵌、条目即完整备份、画像永不引用外部文件）。
- **例外二（创作版本）**：创作版本 `versions[].content` 全文内嵌于 `assets/_create.json`（实现注释明示："self-contained, never a file reference"，见 content-outputs/src/create/types.ts 的 CreateVersion）。**冲突声明**：v0.1.x 审阅稿曾将版本正文改为 `file_ref` 外链，与实现相反，本版按实现改回内嵌。

默认规则覆盖的范围：

- 素材：正文以 `body_file`（assets/ 下正文快照文件名）为唯一正文源；清单内 `summary/points/tags/excerpts` 为短文本直存。原始 HTML 落盘前经服务端净化（allowlist）。
- 对标作品：正文以 `text_file` 为准；拆解全文以 `analysis.ref` 为准，`analysis.result` 仅存结构化核心字段。
- 报告类：对标报告以 `ref`（assets 文件名）为权威；复盘报告以 `report_file` 为权威，元数据内可存可选 `preview`（前 N 字）供列表展示。
- 创作当前工作稿：`assets/_create.json` 的当前稿正文随 `currentVersion` 指向的版本内嵌（同例外二），发布面将正文复制为主题根文件。

### 0.7 localStorage 键登记表

**存储落位**：localStorage 只存配置与轻量清单；单条 >4KB 文本一律入 assets 或清单文件。

| 键 | 内容 | 版本后缀 |
|----|------|----------|
| `content-studio.gather.sources.v0` | 信息源清单 | 有 |
| `content-studio.gather.tasks.v0` | 采集任务清单 | 有 |
| `content-studio.competitors.accounts` | 对标账号清单 | 无（现状保留） |
| `content-studio.competitors.theme` | 对标视图主题选择 | 无 |
| `dsh-content-studio.persona.selectedId` / `.wizard` / `.legacyDismissed` | 画像选中态/向导草稿/旧数据迁移标记 | 无 |
| `dsh-content-studio.persona` | 画像旧数据本体（localStorage 时代的存量）；一次性迁移源，迁移完成后删除该键 | 无 |
| `dsh-content-studio.accounts` | 全局模式列表（string[]） | 无 |
| `dsh-content-studio.account` | 全局模式当前选择 | 无 |
| `dsh-content-studio.topicBank.config` | 选题库视图配置 | 无 |

已迁出 localStorage（改为文件）：画像清单（→ `_personas.json`）、选题库（→ `_topics.json`）、素材（→ `_gather.json`）、对标作品与报告（→ `_competitors.json`）、排期（→ `_schedule.json`）、创作工作台（→ `assets/_create.json`）、内容模板（→ `_templates.json`）。v0.1.x "画像清单在 localStorage" 的说法废止。
日历视图：calendar 相关源（ContentCalendar.tsx / calendar.ts）未使用 localStorage，未发现独立视图配置键；如后续需要，按 0.1 的 `.v` 后缀约定新增（待核实）。

### 0.8 outputs 项目元数据 `.dsh-output.json`

**存储落位**：每个 outputs 项目（主题）目录根。

```json
{
  "$id": "core.outputMetadata",
  "type": "object",
  "properties": {
    "format_version": { "const": 0 },
    "title":   { "type": "string" },
    "kind":    { "enum": ["article", "xhs-note", "video", "cards", "poster", "audio", "other"] },
    "platform":{ "anyOf": [ { "type": "null" }, { "$ref": "#/$defs/platform" } ], "description": "目标平台，项目与平台无关时为 null" },
    "status":  { "enum": ["draft", "ready", "published"] },
    "tags":    { "type": "array", "items": { "type": "string" } },
    "summary": { "type": ["string", "null"] },
    "create":  { "type": "object", "description": "创作工作台簿记的镜像，未被工作台触碰的项目缺省",
      "properties": {
        "current_version":   { "type": "integer" },
        "published_version": { "type": ["integer", "null"] },
        "published_path":    { "type": ["string", "null"] },
        "published_at":      { "type": ["string", "null"], "format": "date-time" }
      },
      "required": ["current_version", "published_version", "published_path", "published_at"] }
  },
  "required": ["format_version", "title", "kind", "platform", "status", "tags", "summary"]
}
```

### 0.9 实现侧长度约束（注记）

网关在 wire 校验层执行一组宽松上限（实现注释："generous, never a product decision"），Schema 各章不再逐字段重复声明；本节登记唯一出处：

- 画像（content-outputs/src/persona/store.ts）：`MAX_NAME=100`、`MAX_FIELD_VALUE=5000`、`MAX_TEXT=100000`、`MAX_LINKS=10`、`MAX_URL=2000`、`MAX_LINK_TEXT=5000`、`MAX_WORD_ITEMS=50`、`MAX_WORD=100`、`MAX_DIGEST=200`、`MAX_ID=64`、`MAX_PROMPT_VERSION=100`、`MAX_TIMESTAMP=40`。
- 采集（content-outputs/src/gather/store.ts）：`GATHER_QUOTA_PER_SOURCE=50`（每源保留条数上限，最新优先；`favorite`/`picked` 豁免清理）、`GATHER_MAX_BODY_CHARS=100_000`（正文快照超限截断）。
- 模板（content-outputs/src/create/store.ts）：模板 `title` ≤60 字符。

---

## 一、信息栏目（素材采集）

**存储落位**：信息源与采集任务配置存 localStorage（`content-studio.gather.*.v0`）；素材入**主题 `assets/` 下的 `_gather.json`**；正文快照进同目录。

### 1.1 信息源 source

```json
{
  "$id": "gather.source",
  "type": "object",
  "properties": {
    "id":                  { "type": "string" },
    "name":                { "type": "string", "minLength": 1 },
    "url":                 { "type": "string", "format": "uri" },
    "interval_minutes":    { "type": "integer", "minimum": 30, "description": "采集间隔（分钟），最小 30" },
    "enabled":             { "type": "boolean" },
    "tags":                { "type": "array", "items": { "type": "string" } },
    "exclude_keywords":    { "type": "array", "items": { "type": "string" } },
    "created_at":          { "type": "string", "format": "date-time" },
    "last_fetched_at":     { "type": ["string", "null"], "format": "date-time" },
    "last_status":         { "type": ["string", "null"], "enum": ["ok", "failed", null], "description": "null=未跑过" },
    "consecutive_failures":{ "type": "integer" },
    "etag":                { "type": ["string", "null"], "description": "条件请求游标，回传 If-None-Match" },
    "last_modified":       { "type": ["string", "null"], "description": "条件请求游标，回传 If-Modified-Since" }
  },
  "required": ["id", "name", "url", "interval_minutes", "enabled", "tags", "exclude_keywords", "created_at", "last_fetched_at", "last_status", "consecutive_failures", "etag", "last_modified"]
}
```

v0.1.x 的 `type(enum rss/atom/web)`、`interval(小时)`、`last_result(文本)` 废止：实现统一走 RSS 拉取面（条件请求游标由 etag/last_modified 承担），间隔以分钟计，结果以 `last_status` 枚举承担。

### 1.2 采集任务 collect_task

```json
{
  "$id": "gather.task",
  "type": "object",
  "properties": {
    "id":                { "type": "string" },
    "name":              { "type": "string", "minLength": 1 },
    "source_ids":        { "type": "array", "items": { "type": "string" }, "description": "复数引用命名规则见 0.4；实现字段 sourceIds" },
    "theme_name":        { "type": "string", "minLength": 1, "description": "产出落到的主题（outputs 项目）目录名" },
    "max_items_per_run": { "type": "integer", "minimum": 1 },
    "since":             { "type": ["string", "null"], "format": "date-time" },
    "include_keywords":  { "type": "array", "items": { "type": "string" } },
    "exclude_keywords":  { "type": "array", "items": { "type": "string" } },
    "ai_enabled":        { "type": "boolean", "description": "AI预处理（摘要/打分/打标签）开关" },
    "interval_minutes":  { "type": ["integer", "null"], "minimum": 30 },
    "log":               { "type": "array",
      "items": { "type": "object",
        "properties": {
          "at":      { "type": "string", "format": "date-time" },
          "outcome": { "enum": ["ok", "failed", "notModified"] },
          "added":   { "type": "integer", "description": "本次运行新增入清单的素材数" },
          "detail":  { "type": "string", "description": "失败详情等补充说明" }
        },
        "required": ["at", "outcome", "added"] },
      "description": "运行日志；任务运行态 status（idle|running|done|failed）仅在内存，永不入盘" }
  },
  "required": ["id", "name", "source_ids", "theme_name", "max_items_per_run", "since", "include_keywords", "exclude_keywords", "ai_enabled", "interval_minutes", "log"]
}
```

v0.1.x 的单 `source_id`、`scope`、`status(pending/collecting/done/failed)`、`item_count` 废止：实现为多源任务，运行态（`idle|running|done|failed`，仅内存）不入盘，产出计数入 `log[].added`。

### 1.3 素材 material（主题 `assets/_gather.json`）

**本实体不含审计字段**（无 `created_at/updated_at`，存储层亦不注入），是 0.2 适用范围表中"仅业务时间字段"实体；`gathered_at` 承担业务时间。

```json
{
  "$id": "gather.material",
  "type": "object",
  "properties": {
    "id":          { "type": "string", "description": "去重键：feed guid，否则规范化 link 的 SHA-1；源内唯一" },
    "source_id":   { "type": "string" },
    "source_name": { "type": "string" },
    "title":       { "type": "string" },
    "url":         { "type": "string", "format": "uri", "description": "规范化后的链接" },
    "published_at":{ "type": "string", "format": "date-time", "description": "feed 声明时存在" },
    "gathered_at": { "type": "string", "format": "date-time", "description": "采集时刻（业务时间字段）" },
    "status":      { "enum": ["unread", "read", "favorite", "picked"], "description": "favorite/picked 为用户标记，豁免保留期清理" },
    "summary":     { "type": "string", "description": "feed 摘要或 AI 生成" },
    "points":      { "type": "array", "items": { "type": "string" }, "maxItems": 5, "description": "AI 要点，≤5 条" },
    "score":       { "type": "integer", "minimum": 0, "maximum": 100, "description": "AI 选题打分，0–100 标尺" },
    "tags":        { "type": "array", "items": { "type": "string" }, "maxItems": 5 },
    "excerpts":    { "type": "array", "items": { "type": "string" }, "description": "用户摘录片段" },
    "body_file":   { "type": "string", "description": "正文快照文件名（主题 assets/ 下相对路径），正文的唯一源" },
    "raw_guid":    { "type": "string", "description": "原始 guid，保留以便重算去重键" }
  },
  "required": ["id", "source_id", "source_name", "title", "url", "gathered_at", "status"]
}
```

容器：`{ "format_version": 0, "materials": [material] }`，文件位于主题 `assets/_gather.json`。
状态机：`unread → read →（favorite|picked 为正交用户标记，叠加语义由视图层解释）`。
保留策略：每源至多保留 `GATHER_QUOTA_PER_SOURCE=50` 条（最新优先），`favorite`/`picked` 豁免（0.9）。
v0.1.x 变更：`status` 的 `ready → picked`；`ai_score` 0–10 → `score` 0–100；`content/content_file → body_file`；`collected_at → gathered_at`；新增 `raw_guid`。`source_type_origin` 废止——素材的定义域本身即采集管道（本期仅 RSS 拉取），来源由 `source_id` 承接；素材无 `via` 字段。

---

## 二、对标栏目（竞品分析）

**存储落位**：对标账号清单存 localStorage（`content-studio.competitors.accounts`）；作品与报告入**主题 `assets/_competitors.json`**；正文与拆解/报告全文进同目录。

### 2.1 对标账号 competitor_account

```json
{
  "$id": "competitor.account",
  "type": "object",
  "properties": {
    "id":           { "type": "string", "pattern": "^acc-" },
    "name":         { "type": "string", "minLength": 1 },
    "platform":     { "$ref": "#/$defs/competitorPlatform" },
    "homepage_url": { "type": "string", "format": "uri" },
    "topics":       { "type": "array", "items": { "type": "string" }, "description": "赛道标签" },
    "priority":     { "enum": ["high", "medium", "low"] },
    "note":         { "type": "string" },
    "positioning":  { "type": "string", "description": "账号定位" },
    "follower_tier":{ "type": "string", "description": "粉丝量级，自由文本" },
    "monetization": { "type": "string", "description": "变现方式，自由文本" },
    "interval_days":{ "enum": [1, 3, 7], "description": "采集节奏提示（天），供补采检查，不是调度器" },
    "enabled":      { "type": "boolean", "description": "停用账号退出补采提醒" },
    "created_at":   { "type": "string", "format": "date-time" }
  },
  "required": ["id", "name", "platform", "homepage_url", "topics", "priority", "note", "positioning", "follower_tier", "monetization", "interval_days", "enabled", "created_at"]
}
```

**兼容口径注记（Schema 与实现的差异）**：实现的载入守卫 `isAccount` 为兼容旧数据，允许 `homepage_url/topics/priority` 三字段缺省（undefined 通过），仅强制 `id/name/platform/interval_days/enabled/created_at`；本 Schema 的 `required` 按完整形态声明。两者差异已知：存量数据可缺省三字段，新写入必须齐全。

v0.1.x 变更：`platform` 收敛至 `$defs/competitorPlatform`（xiaohongshu/bilibili 等旧词映射见 0.5）；`monitor_interval(daily/every_3_days/weekly) → interval_days(1|3|7)`；`track_tags → topics`；`home_url → homepage_url`；`profile` 嵌套拍平为 `positioning/follower_tier/monetization`；`last_collected_at/total_works/viral_count` 移出账号（采集时刻入容器 `synced_at`，作品统计由 works 聚合）。

### 2.2 对标作品 competitor_work（主题 `assets/_competitors.json` works）

```json
{
  "$id": "competitor.work",
  "type": "object",
  "properties": {
    "id":              { "type": "string", "pattern": "^cw-" },
    "account_id":      { "type": "string", "description": "浏览器侧账号 id" },
    "account_name":    { "type": "string", "description": "随行冗余，清单可独立阅读" },
    "platform":        { "$ref": "#/$defs/competitorPlatform" },
    "platform_work_id":{ "type": "string", "description": "平台原生作品 ID；与 platform、account_id 组成去重键；为空时以 title:<标题> 兜底参与去重" },
    "title":           { "type": "string" },
    "url":             { "type": ["string", "null"], "format": "uri" },
    "published_at":    { "type": ["string", "null"], "format": "date-time" },
    "imported_at":     { "type": "string", "format": "date-time", "description": "入库时刻（业务时间字段；本实体无审计字段）" },
    "text_file":       { "type": ["string", "null"], "description": "正文文件名（主题 assets/ 下），正文唯一源" },
    "metrics":         { "type": "array", "items": { "$ref": "#/$defs/competitorMetricSnapshot" }, "description": "互动指标快照，追加式，永不覆写" },
    "hot":             { "type": "boolean", "description": "用户爆款标记，豁免清理" },
    "favorite":        { "type": "boolean", "description": "用户收藏标记，豁免清理" },
    "via":             { "enum": ["manual"], "description": "入库途径；本期仅人工导入" },
    "collected_idea_ref": { "type": ["string", "null"], "description": "收录为选题后写入的导出文件名（idea-<work_id 去前缀>.md，主题 assets/ 下）；非空即已收录标记（收录按钮据此禁用）。文件名可由 id 推导，字段兼作标记与缓存" },
    "analysis":        { "$ref": "#/$defs/competitorWorkAnalysis" }
  },
  "required": ["id", "account_id", "account_name", "platform", "platform_work_id", "title", "imported_at", "metrics", "hot", "favorite", "via", "analysis"]
}
```

容器：`{ "format_version": 0, "synced_at": { "<account_id>": "ISO8601" }, "works": [competitor_work], "reports": [competitor_report] }`，文件位于主题 `assets/_competitors.json`。
**去重规则（含 title 兜底）**：`platform_work_id` 为空时以 `title:<trimmed 标题>` 作为其去重键值；匹配先按精确键、再按 title 键——重导入时即便已学到真实平台 ID，仍能按标题找回原记录（content-studio/src/client/competitors.ts:242-250）。
v0.1.x 变更：`heat_level(low/medium/high/viral)` 废止——热度改为账号内分布相对计算（`hot/normal/cold`，视图层基于最近 30 条、样本 ≥4 的窗口计算，不入盘）；`interaction` 单快照对象 → `metrics` 追加式快照数组；`content/content_file → text_file`；`breakdown_status+breakdown` 合并为 `analysis`；`cover_url` 废止（实现未采集封面，CompetitorWork 无对应字段）；`gathered_ref → collected_idea_ref`（原"关联信息采集素材"注释系误导——实现仅写入收录选题文件名并作已收录标记，已统一，见附录B#33）。

### 2.3 对标作品拆解 analysis（嵌套结构，非法状态不可构造）

```json
{
  "$defs": {
    "competitorMetricSnapshot": {
      "type": "object",
      "properties": {
        "t":       { "type": "string", "format": "date-time" },
        "likes":    { "type": "integer" },
        "comments": { "type": "integer" },
        "shares":   { "type": "integer" },
        "views":    { "type": "integer", "description": "平台暴露播放数时存在" }
      },
      "required": ["t", "likes", "comments", "shares"]
    },
    "competitorWorkAnalysisResult": {
      "type": "object",
      "properties": {
        "hook_type":        { "type": "string", "description": "开头钩子类型（痛点/悬念/反直觉/故事/其他），开放 string" },
        "structure":        { "type": "string", "description": "内容结构：段落框架、案例类型、论证风格" },
        "pain_points":      { "type": "array", "items": { "type": "string" } },
        "topics":           { "type": "array", "items": { "type": "string" } },
        "risks":            { "type": "array", "items": { "type": "string" }, "description": "为何奏效 + 风险（同质化、违禁词暴露）" },
        "reusable":         { "type": "array", "items": { "type": "string" } },
        "migration_topics": { "type": "array", "items": { "type": "string" }, "description": "可迁移选题建议" },
        "comment_insight":  { "type": "string", "description": "热评洞察文本；无评论输入时为 unavailable" }
      },
      "required": ["hook_type", "structure", "pain_points", "topics", "risks", "reusable", "migration_topics", "comment_insight"]
    },
    "competitorWorkAnalysis": {
      "type": "object",
      "properties": {
        "status": { "enum": ["none", "done", "failed"], "description": "pending/running 为视图局态，永不入盘" },
        "error":  { "type": ["string", "null"], "description": "仅 status=failed 时存在" },
        "ref":    { "type": ["string", "null"], "description": "拆解全文文件名（主题 assets/ 下），仅 done 时存在；全文权威" },
        "result": { "anyOf": [ { "type": "null" }, { "$ref": "#/$defs/competitorWorkAnalysisResult" } ], "description": "结构化核心字段，仅 done 时存在" }
      },
      "required": ["status"]
    }
  }
}
```

状态机：`none → done`（成功）/ `none → failed`（失败，`error` 记录摘要）；`failed` 可重试回 `done`。`ref`/`result` 与 `status` 的配对由构造侧保证：`failed` 不得携带 `result`。

### 2.4 对标报告 competitor_report（主题 `assets/_competitors.json` reports）

```json
{
  "$id": "competitor.report",
  "type": "object",
  "properties": {
    "id":            { "type": "string", "pattern": "^cr-" },
    "kind":          { "enum": ["account", "compare"], "description": "account=单账号全景；compare=双账号对垒" },
    "account_ids":   { "type": "array", "items": { "type": "string" }, "minItems": 1, "maxItems": 2, "description": "account 恰 1 个，compare 恰 2 个" },
    "account_names": { "type": "array", "items": { "type": "string" }, "description": "随行冗余" },
    "ref":           { "type": "string", "description": "报告文件名（主题 assets/ 下），报告正文权威" },
    "created_at":    { "type": "string", "format": "date-time", "description": "生成时刻（业务时间字段）" },
    "work_count":    { "type": "integer", "description": "纳入统计的作品数，用于范围标注" }
  },
  "required": ["id", "kind", "account_ids", "account_names", "ref", "created_at", "work_count"]
}
```

v0.1.x 变更：`report_type(single/comparison) → kind(account/compare)`；`content` 内嵌正文废止，`ref` 为权威（0.6 单源规则）；`sections` 固定键结构移入报告文档自身章节约定（策略/模板/爆款规律/受众/变现/机会点），元数据不再存 `sections`。对比报告上限由 2–5 收敛为恰 2（实现口径）。

---

## 三、选题栏目（选题库）

**存储落位**：全局选题库入库根 `_topics.json`（`{ "format_version": 0, "items": [topic_draft] }`）；计划日期同步日历经 `schedule_item_id` 回链。

### 3.1 选题 topic_draft

```json
{
  "$id": "topic.draft",
  "allOf": [ { "$ref": "#/$defs/instanceBase" } ],
  "type": "object",
  "properties": {
    "id":              { "type": "string", "description": "randomUUID 生成，无前缀（含对标转选收入库）" },
    "title":           { "type": "string", "minLength": 1 },
    "one_liner":       { "type": ["string", "null"], "description": "一句话简介" },
    "status":          { "enum": ["idea", "todo", "creating", "done", "shelved"] },
    "source":          { "anyOf": [ { "type": "null" }, { "$ref": "#/$defs/topicSource" } ], "description": "实现中 source 恒存在（manual 时 ref_id/url/snapshot 为 null）；本版保留可空以容错" },
    "tags":            { "type": "array", "items": { "type": "string" } },
    "description":     { "type": ["string", "null"], "description": "核心观点/受众/差异点/素材备注，Markdown 整文" },
    "score":           { "anyOf": [ { "type": "null" }, { "$ref": "#/$defs/topicScore" } ] },
    "plan_date":       { "type": ["string", "null"], "format": "date", "description": "计划创作日 YYYY-MM-DD" },
    "schedule_item_id":{ "type": ["string", "null"], "description": "关联 _schedule.json 条目 id，日历回链" },
    "topic_dir":       { "type": ["string", "null"], "description": "关联 outputs/<topic>/ 项目目录名" }
  },
  "required": ["id", "title", "one_liner", "status", "source", "tags", "description", "score", "plan_date", "schedule_item_id", "topic_dir", "created_at", "updated_at"]
}
```

```json
{
  "$defs": {
    "topicSource": {
      "type": "object",
      "properties": {
        "type":     { "enum": ["manual", "gather", "benchmark"] },
        "ref_id":   { "type": ["string", "null"], "description": "素材 id 或对标记录 id；manual 为 null" },
        "url":      { "type": ["string", "null"], "format": "uri" },
        "snapshot": { "anyOf": [ { "type": "null" },
          { "type": "object",
            "properties": {
              "title":       { "type": "string" },
              "summary":     { "type": ["string", "null"] },
              "captured_at": { "type": "string", "format": "date-time" }
            },
            "required": ["title", "summary", "captured_at"] } ],
          "description": "创建时的源材料快照；源被删后内容仍可读" }
      },
      "required": ["type", "ref_id", "url", "snapshot"]
    },
    "topicScore": {
      "type": "object",
      "properties": {
        "total":        { "type": "number", "minimum": 0, "maximum": 10, "description": "0–10 标尺" },
        "source":       { "enum": ["manual", "ai"] },
        "factors":      { "anyOf": [ { "type": "null" },
          { "type": "array",
            "items": { "type": "object",
              "properties": {
                "name":       { "type": "string" },
                "score":      { "type": "number", "minimum": 0, "maximum": 10 },
                "reason":     { "type": ["string", "null"] },
                "confidence": { "type": "number", "minimum": 0, "maximum": 1, "description": "人工因子恒 1" },
                "estimated":  { "type": "boolean" }
              },
              "required": ["name", "score", "reason", "confidence", "estimated"] } } ],
          "description": "人工 P0 评分可为 null" },
        "evaluated_at": { "type": "string", "format": "date-time" }
      },
      "required": ["total", "source", "factors", "evaluated_at"]
    }
  }
}
```

状态机：

| 当前态 | 迁移 | 触发 |
|--------|------|------|
| idea | → todo | 纳入计划 |
| todo | → creating | 开始创作（关联稿件产出） |
| creating | → done | 稿件定稿/发布闭环 |
| todo / creating | → shelved | 搁置 |
| shelved | → todo | 复活 |

v0.1.x 变更：
- `status` 的 `in_progress → creating`（实现口径）。
- 裸 `source_type+source_id` 替换为 `source: {type, ref_id, url, snapshot}` 结构，快照使溯源在源被删后仍可读。
- `brief → one_liner`；`ai_score(0-10)+score_breakdown` 合并为 `score`（含因子与置信度）；`persona_id` 字段废止（画像经由创作稿件的 `profile_ref` 关联，选题不直接挂画像——待产品确认，见附录B#31）。
- `description` 由嵌套对象（core_point/target_audience/differentiation/material_refs）改为 Markdown 整文；素材引用移入创作工作台的 `sources`（见 4.1）。
- `planned_time(date-time) → plan_date(YYYY-MM-DD)`，同步日历改由 `schedule_item_id` 承担。
- `optimize_suggestion`（AI 优化 3 备选标题）结构化：`{ "titles": "string[3]", "rationale": "string|null" }`。**裁决先行**：实现（content-topics）暂无此字段，为 v0.1.x 功能的规划保留，落地时回填对账。

---

## 四、创作栏目（AI生成）

**存储落位**：创作工作台状态为**主题 `assets/_create.json`**（`CreateManifest`，每主题一份单稿清单）；版本正文内嵌自含（0.6 例外二）；发布面将正文复制为主题根文件并镜像簿记进 `.dsh-output.json` 的 `create` 字段（0.8）。

### 4.1 创作工作台状态 create_manifest（实现定形）

```json
{
  "$id": "create.manifest",
  "type": "object",
  "properties": {
    "format_version":  { "const": 0 },
    "content_id":      { "type": "string", "pattern": "^cc-", "description": "稿件 id，工作台生成 cc-<time36><rand>" },
    "content_type":    { "enum": ["gzh-article", "xhs-note", "video-script", "voiceover", "product-page", "rewrite"], "description": "创作形态，六选一（picker 顺序）" },
    "current_version": { "type": "integer", "description": "当前版本号，指向 versions[].v" },
    "context":         { "type": "object", "description": "生成 prompt 的可编辑上下文",
      "properties": {
        "audience":   { "type": ["string", "null"] },
        "points":     { "type": ["string", "null"] },
        "references": { "type": ["string", "null"] }
      },
      "required": ["audience", "points", "references"] },
    "topic_ref":       { "anyOf": [ { "type": "null" },
      { "type": "object", "description": "跨栏目交接选题库；选题库栏目缺位时 syncState=pendingSync",
        "properties": {
          "topic_id":   { "type": ["string", "null"] },
          "title":      { "type": "string" },
          "sync_state": { "enum": ["linked", "completed", "pendingSync", "orphan"] }
        },
        "required": ["topic_id", "title", "sync_state"] } ] },
    "sources":         { "type": "array", "description": "引用源登记，仅记录不复制源文件",
      "items": { "type": "object",
        "properties": {
          "kind":    { "enum": ["gather", "benchmark", "image", "note"] },
          "ref_id":  { "type": ["string", "null"], "description": "素材 id / 对标记录 id" },
          "file":    { "type": ["string", "null"], "description": "指向主题 assets/ 文件时的文件名" },
          "title":   { "type": "string" },
          "url":     { "type": ["string", "null"], "format": "uri" },
          "added_at":{ "type": "string", "format": "date-time" }
        },
        "required": ["kind", "ref_id", "file", "title", "url", "added_at"] } },
    "versions":        { "type": "array", "description": "版本列表；正文内嵌自含（0.6 例外二）",
      "items": { "type": "object",
        "properties": {
          "v":          { "type": "integer" },
          "ts":         { "type": "string", "format": "date-time" },
          "trigger":    { "type": "string", "description": "版本来源：ai-generate / ai-generate#2/3 / manual-save / restore / retarget / rewrite:<operation>" },
          "words":      { "type": "integer", "description": "字数" },
          "content":    { "type": "string", "description": "版本正文全文，内嵌自含，永不外链" },
          "pinned":     { "type": "boolean", "description": "用户置顶标记" },
          "profile_ref":{ "anyOf": [ { "type": "null" },
            { "type": "object", "description": "风格来源；当前为 inline 文本，画像列落地后为 profile 引用",
              "properties": {
                "mode":   { "enum": ["profile", "inline"] },
                "digest": { "type": "string", "maxLength": 500, "description": "风格文本摘要（≤500 字符），保证历史版本可解释" }
              },
              "required": ["mode", "digest"] } ] },
          "evaluation": { "type": ["object", "null"], "description": "G-Eval 式顾问性评估，缺省=评估前版本的旧清单",
            "properties": {
              "model":          { "type": "string" },
              "prompt_version": { "type": "integer" },
              "evaluated_at":   { "type": "string", "format": "date-time" },
              "grade":          { "enum": ["优", "良", "中", "弱"] },
              "attraction":      { "$ref": "#/$defs/evaluationDimension" },
              "readability":     { "$ref": "#/$defs/evaluationDimension" },
              "differentiation": { "$ref": "#/$defs/evaluationDimension" },
              "audience_fit":    { "$ref": "#/$defs/evaluationDimension" }
            },
            "required": ["model", "prompt_version", "evaluated_at", "grade", "attraction", "readability", "differentiation", "audience_fit"] }
        },
        "required": ["v", "ts", "trigger", "words", "content", "pinned", "profile_ref"] } }
  },
  "required": ["format_version", "content_id", "content_type", "current_version", "context", "topic_ref", "sources", "versions"]
}
```

```json
{
  "$defs": {
    "evaluationDimension": {
      "type": "object",
      "properties": { "grade": { "enum": ["优", "良", "中", "弱"] }, "reason": { "type": "string" } },
      "required": ["grade", "reason"]
    }
  }
}
```

状态说明：实现无独立的 `status(draft|final)` 字段——发布动作由发布登记簿记表达（0.8 的 `published_version/published_path/published_at`），v0.1.x 的 draft/final 两态废止。

**裁决先行字段（实现暂无，显式声明冲突）**：v0.1.x 的以下字段在实现的 `CreateManifest` 中均不存在，本版保留为规划，不进入 required，落地时回填对账——

- `compliance_check`（违禁词预检）：`{ "checked_at", "violations": [{ "word", "level" }] }`，任何 `anyOf` 结构同 2.3 的写法。
- `seo_geo`：`{ "keywords": ["string"], "layout": "string|null" }`。
- `hashtags`：`["string"]`。
- `generated_batch`（3 套方案）：`items: { title, content, scores }`；`scores` 四维（attraction/readability/differentiation/audience_match）**沿用 0–10 标尺**（与选题评分一致，非素材的 0–100）。实现现以 `versions[].trigger = "ai-generate#n/3"` + `variants` 返回面表达多方案，批量评分结构待产品定夺。

v0.1.x → v0.2.0 结构对应：`title/content → versions[]`（v/ts/trigger/content）；`topic_draft_id → topic_ref{topic_id,...}`；`material_refs → sources[]`（kind/ref_id/file）；`persona_id + template_id → 生成请求面的 profile_digest 与 custom_template{id, revision, body}`（请求面参数，不落清单）；`topic_id → 主题目录本身（清单随主题落 assets/）`。

---

## 五、发布栏目（多平台分发）

**存储落位**：任务状态入主题 `assets/_publish.json`；衍生稿 `assets/publish/<task_id>/<platform_id>.md`（该腿正文唯一权威）；全局历史索引 `_publish-index.json` 与账号卡 `_publish-profiles.json` 在库根；定时以 `_schedule.json` 为唯一投影（同步规则见 6.3）；发布登记镜像 `.dsh-output.json` 的 `create` 字段（0.8）。

### 5.1 发布任务 publish_task（实现定形）

```json
{
  "$id": "publish.task",
  "type": "object",
  "properties": {
    "task_id":          { "type": "string" },
    "title":            { "type": "string", "description": "展示标题，默认取稿件标题" },
    "manuscript_file":  { "type": "string", "description": "被分发的主题根交付文件" },
    "manuscript_id":    { "type": ["string", "null"], "description": "创作工作台 content_id（cc- 前缀）；非创作工作台稿件为 null" },
    "topic_id":         { "type": ["string", "null"], "description": "选题库回链；回流成功置选题为 done（幂等，已 done 跳过写）" },
    "persona_digest":   { "type": ["string", "null"], "description": "适配所用画像摘要，注入 AI 提示词" },
    "mode":             { "enum": ["immediate", "scheduled"] },
    "scheduled_at":     { "type": ["string", "null"], "format": "date-time", "description": "scheduled 模式的计划时刻，其余为 null" },
    "schedule_item_id": { "type": ["string", "null"], "description": "业务→排期唯一回链（6.3）；排期条目不反持任务 id" },
    "status":           { "enum": ["draft", "pendingReview", "scheduled", "recorded"] },
    "note":             { "type": ["string", "null"] },
    "platforms":        { "type": "array", "items": { "type": "object",
        "properties": {
          "platform_id":   { "type": "string", "description": "发布平台注册表 id（数据驱动，现 7 平台，独立于 0.5 词汇表）" },
          "account_alias": { "type": "string", "description": "账号卡别名（_publish-profiles.json）；账号卡零凭据" },
          "content_file":  { "type": "string", "description": "衍生稿文件名，位于 assets/publish/<task_id>/ 下" },
          "cover_prompt":  { "type": ["string", "null"], "description": "适配给出的封面建议" },
          "tags":          { "type": "array", "items": { "type": "string" } },
          "status":        { "enum": ["pending", "adapted", "edited", "recorded"] },
          "attempts":      { "type": "array", "items": { "type": "object",
              "properties": {
                "at":     { "type": "string", "format": "date-time" },
                "action": { "enum": ["adapt", "edit", "record"] },
                "ok":     { "type": "boolean", "description": "失败同样留痕" },
                "detail": { "type": "string", "description": "一行人类可读结果" }
              },
              "required": ["at", "action", "ok", "detail"] },
            "description": "只追加执行日志；重试的幂等依据，永不改写历史" }
        },
        "required": ["platform_id", "account_alias", "content_file", "cover_prompt", "tags", "status", "attempts"] },
      "description": "平台腿" },
    "created_at":       { "type": "string", "format": "date-time" },
    "updated_at":       { "type": "string", "format": "date-time" }
  },
  "required": ["task_id", "title", "manuscript_file", "manuscript_id", "topic_id", "persona_digest", "mode", "scheduled_at", "schedule_item_id", "status", "note", "platforms", "created_at", "updated_at"]
}
```

容器：主题 `assets/_publish.json` → `{ "format_version": 0, "tasks": [publish_task] }`。库根两张全局辅助文件：`_publish-index.json` → `{ "format_version": 0, "entries": [{task_id, theme, title, status, platform_ids, updated_at}] }`（跨主题历史加速层，sidecar 为事实源，损坏可全扫描重建）；`_publish-profiles.json` → `{ "format_version": 0, "profiles": [{platform_id, alias, enabled, adaptation_overrides}] }`。

**执行语义（本期）**：执行发布 = 生成冻结的二期 MCP 交接包 `PublishPackage`（`{task_id, theme, title, manuscript_file, topic_id, persona_digest, mode, scheduled_at, platforms[{platform_id, account_alias, content_file, tags, cover_prompt, scheduled_at}], generated_at}`，浏览器本期不调用）+ 任务置 `recorded`；任一平台腿缺衍生稿即拒绝。`recorded` 为本期终态——二期执行态（`executing/partialSuccess/success/failed`）随 MCP 通道引入，**有意缺席**；定时无后台调度，到点后打开视图执行。

状态机（任务）：

| 当前态 | 迁移 | 触发 |
|--------|------|------|
| draft | → pendingReview | 提交待复核 |
| draft | → scheduled | 定时登记（同时写 `_schedule.json` 投影，本实体持 `schedule_item_id`） |
| draft | → recorded | 立即执行发布 |
| pendingReview | → draft / scheduled / recorded | 退回 / 定时 / 执行 |
| scheduled | → recorded | 到点后执行 |

状态机（平台腿）：`pending → adapted → edited → recorded`（AI 适配 → 人工编辑 → 执行登记）。

v0.1.x 变更：**整章按实现重写**（三轮修订废止二轮"裁决先行"标注）——六态（reviewing/running/partial_success/success/failed）裁剪为本期四态，执行态显式留待二期；`adapted_title/adapted_content/log` 内嵌废止，改为衍生稿文件 `content_file` + `attempts` 只追加日志；`account_ids` 数组改为 `platforms[]` 腿结构（`account_id → account_alias` 别名制，零凭据）；`draft_id → manuscript_file + manuscript_id`；`scheduled_time → scheduled_at`；`schedule_item_id` 由裁决转正为实现，且 `ScheduleItem` 侧反向字段 `publishTaskId` 已删除（回链单向，见 6.3）。

---

## 六、日历栏目（排期）

**存储落位**：`_schedule.json`（库根）为排期唯一事实源；日历视图是排期条目的派生呈现，不自持事件实体；日历自有数据仅 `_calendar.json`（库根）备注 sidecar；视图配置暂无 localStorage 键（0.7 注记）。

### 6.1 日历视图（排期条目派生；`calendar_event` 实体废止）

v0.1.x 的独立 `calendar_event` 实体（event_type/ref_id/planned_time/status）**废止**：实现裁决事件即排期条目——选题计划（`TopicItem.plan_date`）经排期模块写为 `kind:"content"` 条目，发布定时任务同理；一选题一事件（单一 `plan_date` 时间源），无独立事件表、无双向链。派生态（如逾期、冲突）渲染时计算，不入盘。

日历唯一自有数据是**备注**，挂在排期条目的稳定 id 上：

```json
{
  "$id": "calendar.note",
  "type": "object",
  "properties": {
    "text":       { "type": "string", "minLength": 1, "description": "备注正文；空白写=清除该条" },
    "updated_at": { "type": "string", "format": "date-time" }
  },
  "required": ["text", "updated_at"]
}
```

容器：库根 `_calendar.json` → `{ "format_version": 0, "notes": { "<schedule_item_id>": calendar_note } }`。读写规则：非空文本 upsert、空白文本清除，文件锁 + 原子写；指向已删条目的备注是惰性数据——读取方忽略未知 id，同 id 下次写入自然覆盖或清除。

### 6.2 排期条目 schedule_item（`_schedule.json`，实现已定）

```json
{
  "$id": "schedule.item",
  "type": "object",
  "properties": {
    "id":       { "type": "string", "description": "randomUUID 生成" },
    "title":    { "type": "string", "minLength": 1 },
    "date":     { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
    "time":     { "type": ["string", "null"], "pattern": "^\\d{2}:\\d{2}$", "description": "HH:mm，00:00–23:59" },
    "platform": { "anyOf": [ { "type": "null" }, { "$ref": "#/$defs/platform" } ] },
    "status":   { "enum": ["idea", "draft", "scheduled", "published"] },
    "kind":     { "enum": ["content", "event"] },
    "topic":    { "type": ["string", "null"], "description": "关联 outputs 项目目录名，独立条目为 null" },
    "url":      { "type": ["string", "null"], "description": "已发布链接，上线前为 null" }
  },
  "required": ["id", "title", "date", "time", "platform", "status", "kind", "topic", "url"]
}
```

容器：`{ "format_version": 0, "items": [schedule_item] }`，读入时按 `date → time（无时刻排当日末）→ id` 排序。
状态机：`idea → draft → scheduled → published`（Easel 递进）。

### 6.3 排期同步规则

- `_schedule.json` 由排期模块**单点写入**：文件锁（`withFileLock`）+ 原子写（`writeFileAtomic`，0600 权限），每次变更整文件重写。
- 业务实体（topic_draft / publish_task）为**源**，排期条目为**投影**；回链单向——业务实体持 `schedule_item_id`，排期条目不持业务 id（实现侧原 `ScheduleItem.publishTaskId` 反向字段已删除）。已落地两侧：`TopicItem.scheduleItemId`（选题）与 `PublishTask.scheduleItemId`（发布，定时登记以显式 id upsert，重排原位更新、不孤儿化旧条目）。
- 改期 = 更新源实体的计划时间 + 由排期模块单点重写对应投影条目；其他模块不得直写 `_schedule.json`（日历拖拽改发布时间必须走发布模块的更新函数）。
- 删除源实体级联删除其投影条目（发布侧 `deleteTask` 已如此）；删除投影条目须清空源的 `schedule_item_id`。
- 一条损坏记录不隐藏其余：校验失败条目进入 `problems` 具名跳过，其余照常上屏。

---

## 七、复盘栏目（数据分析）

**存储落位**：复盘状态入主题 `assets/_review.json`（基线 + 快照 + 任务一份清单）；报告与模板文件在主题 `assets/review/reports|templates/`；全局历史索引 `_review-index.json` 在库根（可重建加速层，sidecar 为事实源）。

### 7.0 共享指标集 `$defs.metricSet`（对齐实现 ReviewMetrics）

```json
{
  "$defs": {
    "metricSet": {
      "type": "object",
      "properties": {
        "impressions":      { "type": ["number", "null"], "description": "曝光" },
        "reads":            { "type": ["number", "null"], "description": "阅读/播放" },
        "likes":            { "type": ["number", "null"] },
        "collects":         { "type": ["number", "null"], "description": "收藏" },
        "comments":         { "type": ["number", "null"] },
        "shares":           { "type": ["number", "null"], "description": "转发" },
        "followers_gained": { "type": ["number", "null"], "description": "涨粉" },
        "cover_ctr":        { "type": ["number", "null"], "description": "封面点击率" }
      },
      "required": ["impressions", "reads", "likes", "collects", "comments", "shares", "followers_gained", "cover_ctr"],
      "description": "平台导出字段不一：缺失指标保持 null——聚合跳过、UI 显示破折号，永不伪造 0"
    }
  }
}
```

### 7.1 复盘 review（实现定形）

```json
{
  "$id": "review.manifest",
  "type": "object",
  "properties": {
    "baselines": { "type": "object",
      "properties": {
        "engagement_rate": { "type": "number", "description": "互动率基准；内置默认 0.05" },
        "collect_rate":    { "type": "number", "description": "收藏率基准；内置默认 0.02" },
        "source":          { "enum": ["user", "default"], "description": "数值来自用户或内置默认" },
        "updated_at":      { "type": "string", "format": "date-time" }
      },
      "required": ["engagement_rate", "collect_rate", "source", "updated_at"],
      "description": "持久业务配置，落清单禁 localStorage" },
    "snapshots": { "type": "array", "items": { "type": "object",
        "properties": {
          "snapshot_id":      { "type": "string" },
          "platform_id":      { "enum": ["xhs", "douyin", "gzh", "bilibili"], "description": "复盘面接受导出的平台（picker 序）" },
          "platform_work_id": { "type": "string", "description": "平台侧作品 id；与 captured_at 的 UTC 日组成去重键" },
          "title":            { "type": "string" },
          "published_at":     { "type": ["string", "null"], "format": "date-time" },
          "captured_at":      { "type": "string", "format": "date-time", "description": "快照时刻" },
          "content_id":       { "type": ["string", "null"], "description": "绑定的创作 content_id；null=未绑定，不进分析池" },
          "match_method":     { "enum": ["url", "title", "manual", null], "description": "绑定方式；null=未绑定" },
          "content_type":     { "enum": ["image-text", "video", null], "description": "导出未携带时读 null" },
          "metrics":          { "$ref": "#/$defs/metricSet" }
        },
        "required": ["snapshot_id", "platform_id", "platform_work_id", "title", "published_at", "captured_at", "content_id", "match_method", "content_type", "metrics"] },
      "description": "指标快照，追加式历史" },
    "tasks": { "type": "array", "items": { "type": "object",
        "properties": {
          "task_id":     { "type": "string" },
          "name":        { "type": "string" },
          "period":      { "type": "object",
            "properties": { "from": { "type": "string", "format": "date" }, "to": { "type": "string", "format": "date" } },
            "required": ["from", "to"] },
          "filters":     { "type": "object",
            "properties": {
              "platforms":     { "type": "array", "items": { "enum": ["xhs", "douyin", "gzh", "bilibili"] } },
              "content_types": { "type": "array", "items": { "enum": ["image-text", "video"] } },
              "work_filter":   { "enum": ["all", "viral", "weak", "longtail"] }
            },
            "required": ["platforms", "content_types", "work_filter"],
            "description": "创建时冻结的筛选集" },
          "status":      { "enum": ["generating", "ready", "failed"] },
          "report_file": { "type": ["string", "null"], "description": "assets/review/reports/ 下报告文件名，null=尚未生成；报告文件为权威（0.6）" },
          "degraded":    { "type": "boolean", "description": "true=纯数据降级报告（AI 部分失败不阻塞产出）" },
          "created_at":  { "type": "string", "format": "date-time" }
        },
        "required": ["task_id", "name", "period", "filters", "status", "report_file", "degraded", "created_at"] } }
  },
  "required": ["baselines", "snapshots", "tasks"]
}
```

容器：主题 `assets/_review.json` → `{ "format_version": 0, "baselines": …, "snapshots": […], "tasks": […] }`；全局库根 `_review-index.json` → `{ "format_version": 0, "rows": [{task_id, theme, name, period, platforms, status, updated_at}] }`（清单写锁内双写；损坏由该主题下次清单写重建行）。

**运行规则**：

- 快照追加式：同作品同 UTC 日重导入覆盖当日快照（幂等），跨日追加新行。
- 绑定三级：URL → 标题 → 人工；仅 `content_id` 非空的快照进分析池，未绑定行留列待绑。
- 判定阈值（视图层计算，verdict 随 AI 请求传递）：互动率 ≥2×基准 = viral、<0.5× = weak；长尾 = 发布 ≥30 天且近 7 天增量 ≥ 周期日均 20%；默认基准 5% 须 UI 明示。
- 聚合红线：曝光禁止跨平台直加（`per_platform` 各自聚合）。
- 报告：`report_file` 权威；在线编辑保存 = 新文件，永不覆写生成原件；爆款模板存 `assets/review/templates/`。
- AI 两面（走 create AI 网关）：单作品诊断（请求含 verdict 与前截断正文）与周期报告（聚合摘要 + 正/负作品摘要，摘录 ≤500 字，禁全文）；结果 `{markdown, model, prompt_version}`。
- 导入两步：parse 预览（拒绝行带 1-based 行号 + 未匹配列名单，不入盘）→ commit 确认行（返回 added/overwritten 计数）；本期仅 CSV（UTF-8 容 BOM）。

状态机（任务）：`generating → ready | failed`；编辑报告不迁移状态。

**裁决先行注**：v0.1.x 的 `per_work[{publish_task_id, platform, external_id, post_url, metrics}]` 分作品—发布任务明细，实现暂以 `content_id`（创作稿件）为绑定锚，发布任务外链留待后续；该结构保留为规划字段。11.3 的 `works[].metrics` 仍 `$ref` 本 7.0 的 metricSet。

v0.1.x 变更：**整章按实现重写**（三轮修订废止二轮"裁决先行"标注）——`review` 单实体拆为清单三段（baselines/snapshots/tasks）；`metrics{snapshot,delta}` 废止（增量由视图聚合），`$defs/metricSet` 对齐实现 ReviewMetrics（`follows → followers_gained`、`conversion_rate` 废止、`captured_at` 上移快照级）；`platforms/persona_ids/content_types` 收敛进 `filters` 冻结集；`baseline` 数组改双指标结构（+source 溯源）；`insights/recommendations` 内嵌废止（由报告文件承载）；`status draft/done → generating/ready/failed`；新增快照去重键、绑定三级、降级标记与 CSV 两步导入契约。

---

## 八、互动栏目（评论私信运营）

**存储落位**：唯一真源为库根 `_interactions.json`（互动不隶属单次创作，**禁入主题 `assets/` 与 `.dsh-output.json`**——放主题目录会被产物扫描计入并被创作重建误伤，v1 冻结裁决）；导出 CSV 经网关写主题 `assets/`（路径校验限 outputs 根内）。

### 8.1 互动会话 conversation（裁决先行，锚定 interaction-dev-prompt-v1 冻结契约）

> 实现不存在；本节转写 `docs/interaction-dev-prompt-v1.md` 第三章冻结契约（落地形态：content-outputs 新 `src/interactions/` 面，不建独立包）。两文冲突时以 v1 文档为准。

**Conversation（聚合根，消息内嵌）**：

```json
{
  "$id": "interaction.conversation",
  "type": "object",
  "properties": {
    "id":          { "type": "string", "description": "randomUUID" },
    "platform":    { "enum": ["weixin", "xhs", "douyin", "bilibili"], "description": "对齐画像平台表，新增平台先扩此处" },
    "participant": { "type": "object",
      "properties": { "external_user_id": { "type": "string" }, "nickname": { "type": "string" } },
      "required": ["external_user_id", "nickname"] },
    "topic_ref":   { "type": ["string", "null"], "description": "主题目录名 | null" },
    "output_ref":  { "type": ["string", "null"], "description": "主题名/文件名，关联作品库稿件" },
    "persona_id":  { "type": ["string", "null"], "description": "人工绑定的画像 id（_personas.json）" },
    "status":      { "enum": ["unread", "pendingReply", "replied", "archived", "spam"] },
    "tags":        { "type": "array", "items": { "enum": ["产品咨询", "价格疑问", "内容建议", "投诉", "其他"] }, "description": "诉求标签，固定枚举，组件只渲染" },
    "note":        { "type": ["string", "null"] },
    "starred":     { "type": "boolean" },
    "created_at":  { "type": "string", "format": "date-time" },
    "updated_at":  { "type": "string", "format": "date-time" },
    "messages":    { "type": "array", "items": { "$ref": "#/$defs/interactionMessage" }, "description": "按 sent_at 升序" }
  },
  "required": ["id", "platform", "participant", "topic_ref", "output_ref", "persona_id", "status", "tags", "note", "starred", "created_at", "updated_at", "messages"]
}
```

**Message 与标签溯源（`$defs/interactionMessage` / `$defs/provenanceLabel`）**：

```json
{
  "$defs": {
    "interactionMessage": {
      "type": "object",
      "properties": {
        "id":                  { "type": "string" },
    "external_message_id": { "type": "string", "description": "平台消息 id；platform + external_message_id 全局唯一，CSV 去重键" },
    "direction":           { "enum": ["in", "out"] },
    "type":                { "enum": ["comment", "dm", "mention"] },
    "content":             { "type": "string" },
    "in_reply_to":         { "type": ["string", "null"], "description": "楼中楼上游内部消息 id；null=无上游或上游不在库（置 null 不丢弃）" },
    "sent_at":             { "type": "string", "format": "date-time" },
    "sentiment":           { "$ref": "#/$defs/provenanceLabel", "description": "value ∈ positive|negative|question|unknown" },
    "intent":              { "$ref": "#/$defs/provenanceLabel", "description": "value ∈ consult|praise|complain|demand|spam|unknown" },
    "reply_drafts":        { "type": "array", "items": { "type": "object",
        "properties": {
          "id":         { "type": "string" },
          "style":      { "enum": ["formal", "friendly", "humorous", "brief"] },
          "content":    { "type": "string" },
          "persona_id": { "type": ["string", "null"] },
          "created_at": { "type": "string", "format": "date-time" }
        },
        "required": ["id", "style", "content", "persona_id", "created_at"] },
      "description": "AI 固定 3 候选，走 create AI 网关，显式触发" }
      },
      "required": ["id", "external_message_id", "direction", "type", "content", "in_reply_to", "sent_at", "sentiment", "intent", "reply_drafts"]
    },
    "provenanceLabel": {
      "type": "object",
      "properties": {
        "value":   { "type": "string", "description": "标签值，随使用处收窄（sentiment/intent 各有闭集，见上文字段描述）" },
        "source":  { "enum": ["user", "ai"] },
        "ai_meta": { "type": ["object", "null"],
          "properties": { "prompt_version": { "type": "string" }, "at": { "type": "string", "format": "date-time" } },
          "required": ["prompt_version", "at"] }
      },
      "required": ["value", "source", "ai_meta"],
      "description": "正交标签溯源包装，与画像 fields 同型；ai_meta.prompt_version 示例 interaction-sentiment@1、interaction-intent@1"
    }
  }
}
```

**状态机与标签规则**：唯一自动流转 = 导入 → `unread`；其余全部用户显式标记（单条或批量）——`spam` 可从任意态进入、可恢复为 `unread`；`archived` 可检索但不进默认列表、不进洞察分析；保存最终回复自动 `pendingReply|unread → replied`。`sentiment`/`intent` 为两套**正交**标签：AI 显式按钮批量识别（非导入强制），人工覆盖即 `source:"user"`，识别失败置 `unknown` 不阻塞导入、不自动改会话状态。

MCP 通道本期为恒失败 stub：`fetchMessages(req) / sendReply(req)`（11.4/11.6），发送按钮行为写死为"存档转 replied，不依赖 stub 结果"。

v0.1.x 变更：单消息实体改为 **Conversation + Message 聚合根**；`user → participant{external_user_id, nickname}`；`time → sent_at`（消息级）；`message_type → type` 并新增 `direction/in_reply_to`（楼中楼）；`tags` 收敛固定枚举；裸 `sentiment` 枚举 → provenance 包装并新增正交 `intent`；`reply_drafts` 字符串数组 → 结构化候选（含风格参数与画像引用）；`final_reply` 废止（最终回复以 `direction:"out"` 消息落库）；`publish_task_id` 废止（稿件关联走 `output_ref`）；落位由主题 assets 改为库根 `_interactions.json`。

---

## 九、画像栏目（账号人设资产）

**存储落位**：画像整体（含报告全文、简历文本）内嵌于库根 `_personas.json`（`{ "format_version": 0, "personas": [persona] }`），条目即完整备份，不引用外部文件；关联素材原文不入盘，仅存文本。

### 9.1 画像 persona

```json
{
  "$id": "persona.entry",
  "type": "object",
  "properties": {
    "id":            { "type": "string", "description": "randomUUID 生成" },
    "name":          { "type": "string", "minLength": 1 },
    "platforms":     { "type": "array", "items": { "$ref": "#/$defs/platform" } },
    "account_stage": { "enum": ["fresh", "existing"], "description": "新起号 / 存量号" },
    "revision":      { "type": "integer", "description": "每次表单保存自增；网关所有，客户端不可提交" },
    "digest":        { "type": "string", "maxLength": 200, "description": "确定性风格摘要，保存时网关计算，客户端永不上送" },
    "fields":        { "type": "object", "description": "九个固定键全部必带（实现守卫：wire records must be complete，缺键即拒载）",
      "additionalProperties": false,
      "properties": {
        "whoAmI":       { "$ref": "#/$defs/personaField" },
        "audience":     { "$ref": "#/$defs/personaField" },
        "oneLiner":     { "$ref": "#/$defs/personaField" },
        "niche":        { "$ref": "#/$defs/personaField" },
        "goal":         { "$ref": "#/$defs/personaField" },
        "monetize":     { "$ref": "#/$defs/personaField" },
        "contentValue": { "$ref": "#/$defs/personaField" },
        "cadence":      { "$ref": "#/$defs/personaField" },
        "phrases":      { "$ref": "#/$defs/personaField" }
      },
      "required": ["whoAmI", "audience", "oneLiner", "niche", "goal", "monetize", "contentValue", "cadence", "phrases"] },
    "links":         { "type": "array", "maxItems": 10,
      "items": { "type": "object",
        "properties": {
          "platform":   { "$ref": "#/$defs/platform" },
          "url":        { "type": "string", "format": "uri" },
          "bio":        { "type": ["string", "null"] },
          "sample_text":{ "type": ["string", "null"], "description": "参考文案样例文本" }
        },
        "required": ["platform", "url", "bio", "sample_text"] } },
    "site":          { "type": "object",
      "properties": { "url": { "type": ["string", "null"], "format": "uri" }, "pasted_text": { "type": ["string", "null"] } },
      "required": ["url", "pasted_text"],
      "description": "企业官网及粘贴的解析文本" },
    "style":         { "type": "object",
      "properties": {
        "preset":      { "type": ["string", "null"], "enum": ["professional", "friendly", "humor", "concise", "narrative", "hardcore", "empathy", null], "description": "null=仅自定义文本；preset 与 custom_text 可共存，自定义优先" },
        "custom_text": { "type": ["string", "null"] },
        "strength":    { "enum": ["light", "strict"] },
        "banned_words":{ "type": "array", "items": { "type": "string" }, "maxItems": 50 },
        "red_lines":   { "type": "array", "items": { "type": "string" }, "maxItems": 50 }
      },
      "required": ["preset", "custom_text", "strength", "banned_words", "red_lines"] },
    "assets":        { "type": "object",
      "properties": {
        "resume_text": { "type": ["string", "null"], "description": "简历解析文本，原文文件永不存储" },
        "resume_name": { "type": ["string", "null"] }
      },
      "required": ["resume_text", "resume_name"] },
    "report":        { "anyOf": [ { "type": "null" }, { "$ref": "#/$defs/personaReport" } ] },
    "cloned_from":   { "type": ["string", "null"], "description": "克隆来源画像 id；克隆持新 id、revision=1" },
    "created_at":    { "type": "string", "format": "date-time" },
    "updated_at":    { "type": "string", "format": "date-time" }
  },
  "required": ["id", "name", "platforms", "account_stage", "revision", "digest", "fields", "links", "site", "style", "assets", "report", "cloned_from", "created_at", "updated_at"]
}
```

```json
{
  "$defs": {
    "personaField": {
      "type": "object",
      "properties": {
        "value":   { "type": ["string", "null"] },
        "source":  { "enum": ["user", "ai", "template"] },
        "ai_meta": { "anyOf": [ { "type": "null" },
          { "type": "object",
            "properties": { "prompt_version": { "type": "string" }, "at": { "type": "string", "format": "date-time" } },
            "required": ["prompt_version", "at"] } ],
          "description": "仅 source=ai 时存在" }
      },
      "required": ["value", "source", "ai_meta"]
    },
    "personaReport": {
      "type": "object",
      "properties": {
        "markdown":        { "type": "string", "description": "报告全文，内嵌" },
        "source_revision": { "type": "integer", "description": "生成时基于的表单 revision；落后于条目 revision 即可能过期" },
        "edited_by_user":  { "type": "boolean", "description": "用户编辑过报告后，再生成需确认" },
        "generated_at":    { "type": "string", "format": "date-time" },
        "prompt_version":  { "type": "string" }
      },
      "required": ["markdown", "source_revision", "edited_by_user", "generated_at", "prompt_version"]
    }
  }
}
```

v0.1.x 变更（以实现为准全面重构）：
- **存储迁移**：清单从 localStorage 迁至 `_personas.json` 文件。
- `start_status(new/existing) → account_stage(fresh/existing)`；风格预设 `humorous → humor`、`solid → hardcore`、`empathetic → empathy`、`custom` 移除（自定义经 `custom_text`，`preset` 可为 null）。
- v0.1.x 的 `self_intro/target_audience/brief/operations/expressions/forbidden/website/website_resolved/reference_samples/prompt_preview` 拍平重构：`self_intro → fields.whoAmI`；`target_audience → fields.audience`；`brief → fields.oneLiner`；`operations`（goals/monetization/core_value/rhythm）→ `fields.goal/monetize/contentValue/cadence`；`expressions → fields.phrases`；`forbidden.words/topics → style.banned_words/red_lines`；`website+website_resolved → site`；`reference_samples → links[].sample_text`；`prompt_preview` 为网关打包时按字段+报告现算，不入盘。
- `ai_filled_fields`（自由对象）→ `fields` 九键全量结构化 `value/source/ai_meta`，溯源到 prompt 版本；`whoAmI` 为 AI 通用填充禁用键（仅用户或简历面可写）。
- `report` 结构化：全文内嵌 + `source_revision` 新鲜度判定 + `edited_by_user` 再生成确认；报告编辑走独立面，不 bump 表单 revision。
- 新增 `revision/digest`（创建面的画像引用锚定 `id + revision + digest`）与 `cloned_from`。
- **不适用 0.6 的 report_file 外链规则**：画像报告全文内嵌是本栏目显式例外（0.6 例外一）。

### 9.2 画像报告结构（衍生文档，Markdown）

`# 账号画像报告` 下八节：1 主体背景（我是谁）；2 账号基础概况；3 目标受众；4 企业与社媒信息；5 运营战略意图；6 写作风格规范；7 内容红线与禁用规则；8 AI创作提示词（可单独复制）。

规则不变：表单结构化字段为源数据；报告为衍生文档，编辑报告不反向改写表单；`source_revision` 落后即视图提示再生成；创作栏目读取画像时同时读取字段+报告。

---

## 十、全局模板栏目（内容模板）

**存储落位**：库根 `_templates.json`（`{ "format_version": 0, "templates": [template] }`），全局共享，不属主题。

### 10.1 模板 template（实现定形）

```json
{
  "$id": "create.template",
  "type": "object",
  "properties": {
    "id":           { "type": "string", "pattern": "^ct-", "description": "网关生成 ct-<time36><rand>" },
    "title":        { "type": "string", "minLength": 1, "maxLength": 60, "description": "显示名" },
    "content_type": { "enum": ["gzh-article", "xhs-note", "video-script", "voiceover", "product-page", "rewrite"], "description": "模板目标创作形态；rewrite 用作自由改写框架" },
    "body":         { "type": "string", "minLength": 1, "description": "prompt 正文；仅允许白名单占位符，保存与运行时双向校验" },
    "revision":     { "type": "integer", "minimum": 1, "description": "服务端单调计数：创建=1，每次更新+1；客户端不可提交" },
    "updated_at":   { "type": "string", "format": "date-time", "description": "最后写入时刻（实现仅此一个时间字段，无 created_at）" }
  },
  "required": ["id", "title", "content_type", "body", "revision", "updated_at"]
}
```

**占位符白名单**：`{{title}}` `{{audience}}` `{{points}}` `{{references}}` `{{profile}}`——body 中出现任何其他占位符即保存失败、运行也失败（content-outputs/src/create/types.ts 的 CreateTemplate 注释、create/store.ts 的 assertTemplateBody）。

**裁决先行字段（实现暂无，显式声明冲突）**：v0.1.x 的以下字段在实现的 `CreateTemplate` 中均不存在——`category/tags/description/variables/version/versions/status`。本版裁决：不保留进 Schema 主体。其中"版本历史"已由实现的 `revision` 单调计数承接（无快照数组）；若产品后续需要历史回滚或变量声明，须先扩实现再回填本 Schema。

---

## 十一、MCP 预留接口契约

本期只做结构稳定、返回占位（"未接入"）；后续外部 MCP 服务按此契约替换，插件零感知。

### 11.0 通用 envelope

```json
{ "request":  { "v": 1, "request_id": "string", "params": "object" } }
{ "response": { "ok": "bool", "request_id": "string", "data": "object|null", "error": { "code": "string", "message": "string", "retryable": "bool" } | "null" } }
```

错误码闭枚举：`not_connected | invalid_param | auth_failed | rate_limited | upstream_failed`。`retryable` 仅 `rate_limited/upstream_failed` 允许 true。

**落盘职责声明**：MCP 只返回 content（文本/结构化数据），落盘由插件封装层完成；接口中的 `file_ref` 为封装层写入后返回的 assets 相对路径。

**幂等键**：`publish_content` / `send_reply` 的 request 必填 `idempotency_key`（string）。确定性生成规则（封装层生成，同一逻辑操作重试复用同键）：
- `publish_content`：`sha1hex(platform + "|" + account_id + "|" + content_id + "|" + platform_index)`，`platform_index` 为该任务 `platforms[]` 中的序号。
- `send_reply`：`sha1hex(conversation_id + "|" + sha1hex(reply_content))`。

### 11.1 fetch_source —— 网页/账号内容抓取（信息/对标/画像官网解析）

```json
{ "request":  { "v": 1, "request_id": "string", "params": { "url": "string(uri)", "type": "enum[web, website]", "topic_dir": "string" } } }
{ "response": { "ok": true, "request_id": "string", "data": { "title": "string|null", "content": "string|null", "metadata": "object|null", "file_ref": "string|null" } } }
```

### 11.2 fetch_rss —— RSS拉取（信息）

```json
{ "request":  { "v": 1, "request_id": "string", "params": { "source_id": "string", "limit": "integer|null" } } }
{ "response": { "ok": true, "request_id": "string", "data": { "items": [ { "id": "string", "raw_guid": "string|null", "title": "string|null", "link": "string", "published_at": "string|null", "content": "string|null" } ] } } }
```

`id` 为去重键：feed guid 优先，否则规范化 link 的 SHA-1（与 1.3 素材 id 同规则，实现见 content-outputs/src/gather/types.ts 的 GatherItemDraft）；`raw_guid` 保留原始 guid 以便重算。

### 11.3 fetch_platform_stats —— 平台数据拉取（复盘）

```json
{ "request":  { "v": 1, "request_id": "string", "params": { "platform": "string", "account_id": "string|null", "period_start": "date", "period_end": "date" } } }
{ "response": { "ok": true, "request_id": "string", "data": { "works": [ { "external_id": "string", "post_url": "string|null", "metrics": { "$ref": "#/$defs/metricSet" } } ] } } }
```

`metrics` 引用 7.0 的共享 MetricSet；`work_id` 改名 `external_id`（平台原生 ID，与 2.2 的 `platform_work_id` 口径一致——待核实统一）。

### 11.4 fetch_messages —— 评论/私信拉取（互动）

```json
{ "request":  { "v": 1, "request_id": "string", "params": { "platform": "string", "account_id": "string|null", "since": "date-time|null" } } }
{ "response": { "ok": true, "request_id": "string", "data": { "messages": [ { "id": "string", "user": "string", "content": "string", "time": "string", "type": "enum[comment, dm, mention]" } ] } } }
```

新增 `id`（平台消息原生 ID，作为会话去重与回执键——生成规则待实现核实）。

### 11.5 publish_content —— 真实发布/上传（发布）

```json
{ "request":  { "v": 1, "request_id": "string", "params": { "platform": "string", "account_id": "string", "title": "string", "content": "string", "media_refs": "array<string>|null", "scheduled_at": "date-time|null", "idempotency_key": "string" } } }
{ "response": { "ok": true, "request_id": "string", "data": { "external_id": "string|null", "post_url": "string|null" } } }
```

`scheduled_at` 本期必须为 null：定时由插件侧调度（`_schedule.json`），MCP 只做即时发布。

### 11.6 send_reply —— 回复发送（互动）

```json
{ "request":  { "v": 1, "request_id": "string", "params": { "conversation_id": "string", "reply_content": "string", "persona_id": "string|null", "idempotency_key": "string" } } }
{ "response": { "ok": true, "request_id": "string", "data": { "external_id": "string|null" } } }
```

### 11.7 resolve_website —— 官网内容解析（画像，可由 fetch_source 复用）

```json
{ "request":  { "v": 1, "request_id": "string", "params": { "url": "string(uri)" } } }
{ "response": { "ok": true, "request_id": "string", "data": { "business": "string|null", "about": "string|null", "products": "array<string>|null", "brand_tone": "string|null" } } }
```

### MCP 通用约定

- 统一通过封装层调用，不在栏目代码散落细节。
- 未接入时返回 `ok:false + error.code:"not_connected"`，UI 提示"该能力待接入，请手动导入/稍后使用"，不静默失败。
- 入参/出参结构本期固定，便于后续无缝替换真实服务。
- 高风险接口（publish_content / send_reply）必须人工确认后才允许调用，禁止无审核自动执行；幂等键使人工重试不产生重复发布/回复。

---

## 附：Schema 与《全局通用规则》映射速查

| 数据 | 章节 | 落位 |
|------|------|------|
| 信息源 / 采集任务 | 1.1 / 1.2 | localStorage（`content-studio.gather.*.v0`） |
| 素材 | 1.3 | 主题 `assets/_gather.json`；正文快照→同目录（body_file 单源） |
| 对标账号 | 2.1 | localStorage（`content-studio.competitors.accounts`） |
| 对标作品 / 拆解 / 报告 | 2.2 / 2.3 / 2.4 | 主题 `assets/_competitors.json`；正文/拆解/报告全文→同目录（ref 单源） |
| 选题 | 3.1 | 库根 `_topics.json`；排期→`_schedule.json`（schedule_item_id 回链） |
| 创作工作台 | 4.1 | 主题 `assets/_create.json`（版本正文内嵌自含）；发布簿记镜像 `.dsh-output.json` |
| 发布任务 | 5.1 | 主题 `assets/_publish.json`；衍生稿→`assets/publish/<task_id>/`；账号卡/全局索引→库根；定时→`_schedule.json`（schedule_item_id 回链） |
| 排期条目 | 6.2 | 库根 `_schedule.json`（排期模块单点写：文件锁+原子写） |
| 日历视图（派生） | 6.1 | 排期事实源=库根 `_schedule.json`；日历自有数据仅 `_calendar.json` 备注；`calendar_event` 实体废止 |
| 复盘 | 7.1 | 主题 `assets/_review.json`（baselines/snapshots/tasks）；报告/模板→`assets/review/`；全局索引→库根 |
| 互动会话 | 8.1 | 库根 `_interactions.json`（Conversation+Message 聚合；禁入主题 assets，裁决先行锚 interaction v1） |
| 画像 | 9.1 / 9.2 | 库根 `_personas.json`（全文内嵌，含报告）；localStorage 仅选中态/向导草稿/旧数据迁移源 |
| 内容模板 | 10.1 | 库根 `_templates.json`（revision 单调计数，无版本快照数组） |
| outputs 项目元数据 | 0.8 | `<主题>/.dsh-output.json` |

---

## 附录A：v0.1.2-rc.5 → v0.2.0 变更日志

1. **容器模型重构（0.1）**：废止"实体 entries 登记于 .dsh-output.json"，改为系统清单文件落盘——主题 `assets/_gather.json`、`assets/_competitors.json`、`assets/_create.json` 与库根 `_topics.json`、`_schedule.json`、`_personas.json`、`_templates.json`，统一 `{ format_version, <集合> }` 容器；`.dsh-output.json` 明确为 outputs 项目元数据（0.8 新增）。理由：实现全部按分文件清单落盘，`.dsh-output.json` 实际承载项目级 title/kind/status。
2. **版本策略（0.1）**：版本号收拢到容器级；声明无兼容性承诺，后端拒绝非 0 版本文件。与实现注释（"0 has no compatibility promise"）一致。
3. **localStorage 键约定（0.1/0.7）**：确立 `content-studio.<entity>.v<format_version>` 后缀约定；登记全部现存键（含 `dsh-content-studio.accounts`、`dsh-content-studio.persona` 旧数据本体（一次性迁移源，迁移后删除）、`dsh-content-studio.topicBank.config`）；声明画像/选题/素材/对标/排期/创作工作台/内容模板清单已迁文件；日历视图暂无配置键（注记）。
4. **实例基字段（0.2）**：`$defs.instanceBase` 固定 `id/created_at/updated_at`，声明由存储层注入、客户端不可提交；`topic_id` 移出基字段；区分业务时间字段与审计字段；**新增适用范围表**——仅选题、画像具备完整审计字段，模板仅 `updated_at`，素材/对标作品/排期条目无审计字段，不虚构注入。
5. **标识符规则（0.3）**：以实现重建前缀表（`acc-/cw-/cr-/cc-/ct-`），其余实体为裸 UUID；`idea-` 更正为"仅 assets 文件名前缀（收录选题文件），非实体 ID"；废止"栏目类型前缀+随机"的笼统说法；素材 id 定义为 guid/SHA-1 去重键。
6. **引用命名（0.4）**：`linked_publish_id → publish_task_id`；`material_refs → material_ids`（实现落点为创作工作台 `sources`）；补复数引用 `_ids` 命名规则；`ref_id` 按所属实体拆为两行（选题溯源 / 日历事件关联）；登记 `schedule_item_id/ref/cloned_from/platform_work_id` 等新引用；补记 v0.1.x `work_id` 的现落点（`topic_draft.source.ref_id` 与 `gathered_ref`）及 `gathered_ref` 的实现内部口径不一致。
7. **词汇注册表（0.5）**：建 `$defs.platform`（8 值全集）与 `$defs/competitorPlatform`（6 值子集），全部引用点 `$ref`；可空平台字段用 `anyOf` + null 分支；给出 xiaohongshu/bilibili 等旧词映射与平台扩展流程。
8. **分数标尺（0.5）**：声明双标尺并存——素材打分 0–100、选题评分 0–10（因子置信度 0–1）、批量方案评分沿用 0–10；禁止跨标尺混写。
9. **单源规则（0.6，新章节）**：全局声明"文件为 canonical，内嵌仅限 ≤4KB 小文本"；**两个显式例外**——画像报告全文内嵌 `_personas.json`、创作版本正文内嵌 `_create.json`（实现注释 self-contained）；素材 body_file、对标作品 text_file/analysis.ref、对标报告 ref、复盘 report_file 各自确立权威。
10. **信息源（1.1）**：按实现重构——`interval(小时) → interval_minutes(≥30)`；`type/last_result` 废止，新增 `etag/last_modified/consecutive_failures/last_status`（null 为合法值，非字符串）。
11. **采集任务（1.2）**：单源改多源（`source_ids`）；`scope/status/item_count` 废止；新增 `theme_name/max_items_per_run/include_keywords/ai_enabled`；运行态枚举 `idle|running|done|failed` 仅内存不入盘；log 条目结构化为 `{at, outcome(ok|failed|notModified), added, detail?}`。
12. **素材（1.3）**：状态 `ready → picked`；`ai_score` 0–10 → `score` 0–100；`content/content_file → body_file` 单源；`collected_at → gathered_at`；新增 `raw_guid`；明确本实体无审计字段；`source_type_origin` 由素材定义域收窄承接（无 `via` 字段）；补容器定义与落位（主题 `assets/_gather.json`）。
13. **对标账号（2.1）**：platform 收敛至子集；`monitor_interval → interval_days(1|3|7)`；`profile` 嵌套拍平；统计字段移出账号（`synced_at` 入容器）；新增 Schema required 与实现守卫 isAccount（三字段允许缺省兼容旧数据）的兼容口径注记。
14. **对标作品（2.2）**：`heat_level` 废止（改账号内分布相对计算，视图层）；`interaction` 单快照 → `metrics` 追加式快照数组；新增 `platform_work_id`（去重键，空值以 `title:<标题>` 兜底，先精确键后 title 键匹配）、`hot/favorite/via/gathered_ref/account_name`；`cover_url` 废止（实现未采集封面）。
15. **拆解（2.3）**：`breakdown_status+breakdown` 合并为 `analysis` 嵌套结构（`status/error/ref/result`），非法状态不可构造；`pending/running` 声明为视图局态不入盘。
16. **对标报告（2.4）**：`report_type → kind(account/compare)`；对比上限 2–5 收敛为恰 2；`content` 内嵌废止、`ref` 为权威；`sections` 移入报告文档章节约定。
17. **选题（3.1）**：状态 `in_progress → creating`；裸 `source_type+source_id` 替换为 `source{type,ref_id,url,snapshot}` 快照结构；`brief → one_liner`；`ai_score+score_breakdown → score`（因子+置信度）；`description` 改 Markdown 整文；`planned_time → plan_date` + `schedule_item_id` 回链；`optimize_suggestion` 结构化（裁决先行，实现暂无）；容器 `_topics.json` 定义。
18. **创作栏目（4.1）**：**整章按实现重写**。v0.1.x 的多 draft 模型（id/title/content/status/versions 内嵌 content/generated_batch/compliance_check/seo_geo/hashtags）废止；实现为每主题一份 `assets/_create.json`（CreateManifest：content_id/content_type/current_version/context/topic_ref/sources/versions），版本 `{v, ts, trigger, words, content, pinned, profile_ref, evaluation?}` 正文内嵌自含；`content_type` 六值枚举（gzh-article/xhs-note/video-script/voiceover/product-page/rewrite）；`topic_draft_id → topic_ref{topic_id,title,sync_state}`；`material_refs → sources[{kind,ref_id,file,...}]`；`persona_id/template_id` 移至生成请求面（profile_digest / custom_template）；v0.1.x 的 compliance_check/seo_geo/hashtags/generated_batch 列为裁决先行规划字段（显式声明实现暂无）。
19. **发布任务（5.1）**：`topic_draft_id` 冗余删除；`platforms[].platform` 收敛至词汇表；新增 `schedule_item_id`；补状态机表；整节标注裁决先行（实现无此实体）。
20. **排期（6.2/6.3，新）**：`_schedule.json` 完整 Schema（date/time/status/kind/topic/url）；单点写规则（文件锁+原子写）；业务实体为源、排期为投影、改期=更新源+单点重写、删除级联。
21. **日历事件（6.1）**：`ref_id` 加入 required；`event_type ↔ ref_id` 配对表修正（选题 id 无前缀，移除幽灵前缀写法）；新增 `schedule_item_id`；补 status 迁移表；整节标注裁决先行。
22. **复盘（7.1）**：`$defs/metricSet` 共享；`metrics` 拆 `snapshot+delta`；新增 `per_work` 分作品明细；`baseline` 数组结构化；`report_file` 权威 + `report_preview`；11.3 的 works[].metrics 同 `$ref`；整节标注裁决先行。
23. **互动（8.1）**：`linked_publish_id → publish_task_id`；platform 收敛至词汇表；补状态机表；整节标注裁决先行。
24. **画像（9.1）**：按实现全面重构——清单迁 `_personas.json`；`start_status → account_stage`；风格预设词表更正（humor/hardcore/empathy，custom 经 custom_text）；v0.1.x 十余个嵌套字段拍平为九键 `fields`（九键全列 required + additionalProperties:false，实现守卫缺键拒载，每键 `value/source/ai_meta` 溯源）；`forbidden → style.banned_words/red_lines`；`site/links[].sample_text/assets` 承接官网/样例/简历；`report` 结构化（`source_revision/edited_by_user`）；新增 `revision/digest/cloned_from`。
25. **模板（10.1）**：**整章按实现重写**——`_templates.json` 库根容器；`CreateTemplate{id,title,content_type,body,revision,updated_at}`；占位符白名单五值双向校验；`revision` 单调计数承接版本职责；v0.1.x 的 `category/tags/description/variables/versions/status` 废止（显式声明实现暂无，不保留进主体）；模板 id 前缀 `ct-`。
26. **MCP 契约（11）**：统一 envelope（`v/request_id/params`、`ok/data/error{code,message,retryable}`）；错误码闭枚举五值；`publish_content/send_reply` 必填 `idempotency_key`（确定性生成规则，稿件侧键源改为 `content_id`）；`fetch_rss` items 加 `id/raw_guid`（guid 优先，否则规范化 link SHA-1）；`fetch_messages` 消息加 `id`；`fetch_source/fetch_platform_stats` 的 `topic_id → topic_dir`、`work_id → external_id`；声明落盘职责（MCP 只返 content，file_ref 为封装层返回的 assets 相对路径）；`publish_content.scheduled_at` 本期必须 null；响应中的 `error` 字符串字段由 envelope `error{code,message}` 承接。
27. **Schema 合法性（全文）**：声明 Draft 2020-12 基准；`$ref` 与 `type` 不并列（可空引用改 `anyOf` + null 分支，涉及 2.3 result、3.1 source/score、4.1 profile_ref、9.1 report/ai_meta、各 platform 可空字段）；`$ref` 片段指针统一 `#/$defs/...`。
28. **实现侧长度约束（0.9，新）**：登记 persona 12 项 caps、gather 配额与正文截断、模板标题上限，声明为 wire 校验上限、Schema 不重复声明（示例字段除外）。
29. **发布任务（5.1，三轮）**：**整章按实现重写**，废止二轮"裁决先行"标注——四态任务状态机（`recorded` 本期终态，执行态有意缺席随二期 MCP）、`attempts` 只追加日志、`platforms[]` 腿结构 + `account_alias` 别名制（账号卡零凭据）、衍生稿 `assets/publish/<task_id>/` 为腿正文唯一权威、冻结的 `PublishPackage` 二期交接包、`_publish-index.json`/`_publish-profiles.json` 两张库根辅助文件。
30. **日历（6.1/6.3，三轮）**：`calendar_event` 独立实体**废止**——事件即排期条目（一选题一事件），日历唯一自有数据为 `_calendar.json` 备注（非空 upsert、空白清除、惰性条目读取忽略）；回链统一为**业务→排期单向**：`ScheduleItem.publishTaskId` 反向字段已删除，`PublishTask.scheduleItemId` 为实现（定时登记显式 id upsert，重排不孤儿化旧条目）。
31. **复盘（7.0/7.1，三轮）**：**整章按实现重写**——`review` 单实体拆为 `_review.json` 三段清单（baselines/snapshots/tasks）+ `_review-index.json` 全局索引；`$defs/metricSet` 对齐实现 ReviewMetrics（`follows→followers_gained`、`conversion_rate` 废止、`captured_at` 上移快照级、八指标全列 required-nullable）；快照去重键 platform+platform_work_id+captured_at(UTC日)、绑定三级（URL→标题→人工）、判定阈值注记、CSV 两步导入、`degraded` 降级标记；`per_work` 发布任务关联降为裁决先行注。
32. **互动（8.1，三轮）**：由自由裁决改为**锚定 interaction-dev-prompt-v1 第三章冻结契约**转写——Conversation+Message 聚合根、库根 `_interactions.json`（废止二轮"会话记录进 assets"的错误落位）、platform+external_message_id 去重、provenance 包装的正交 sentiment/intent 标签、固定枚举、单自动流转状态机、恒失败 MCP stub。
33. **对标作品（2.2/0.4，三轮）**：`gathered_ref → collected_idea_ref` 改名统一（实现侧已同步改名并修注释）——语义定为"已收录选题的导出文件名 idea-*.md，兼已收录标记"；废止二轮"按类型注释声明语义、实现侧待办"的处理（附录A#6 的遗留就此闭合）。

---

## 附录B：文档 ↔ 实现差异对账清单

| # | 字段/机制 | 文档原说法（v0.1.2-rc.5） | 实现做法 | 证据文件 | 本版裁决 |
|---|-----------|---------------------------|----------|----------|----------|
| 1 | 实体容器 | 实体 entries 登记于 `<主题>/.dsh-output.json` | 分层系统清单：主题 `assets/_gather.json`、`assets/_competitors.json`、`assets/_create.json`；库根 `_topics.json`、`_schedule.json`、`_personas.json`、`_templates.json`；`.dsh-output.json` 是 outputs 项目元数据 | content-outputs/src/types.ts、gather/store.ts:22、competitor/store.ts:21、create/store.ts:25,31、content-topics/store.ts、content-schedule/store.ts、persona/store.ts | 采纳实现：分层清单容器；废止 entries 说法（0.1/0.8） |
| 2 | 格式版本 | 实例级 `formatVersion` 无说明 | 容器级 `formatVersion: 0`，非 0 拒载，无兼容承诺 | content-outputs/src/{gather,competitor,create,persona}/types.ts、content-schedule/src/store.ts | 容器级；声明无兼容承诺 |
| 3 | localStorage 键 | 未约定键名 | `content-studio.gather.sources.v0` 等（带 .v0）；`content-studio.competitors.*`（不带）；画像/选题库/全局模式用 `dsh-content-studio.*` 前缀 | content-studio/src/client/gather/storage.ts、persona/persona-store.ts、ContentStudio.tsx:119-137、TopicBankView.tsx:43 | 新增键一律带 `.v0` 后缀；现存键名如实登记，`content-studio.` 与 `dsh-content-studio.` 两种前缀并存待统一 |
| 4 | platform 词汇 | xiaohongshu/douyin/bilibili/wechat/weibo/zhihu/other | 对标 6 值（xhs/douyin/wechat/bili/zhihu/toutiao）；画像 8 值超集（+channels/weibo） | content-outputs/src/competitor/types.ts、persona/types.ts | 双层注册表：`$defs.platform` 8 值全集 + 6 值子集；旧词映射 |
| 5 | 分数标尺 | 素材与选题 ai_score 均 0–10 | 素材打分 0–100；选题评分 0–10（因子 0–10、置信度 0–1） | content-outputs/src/gather/types.ts、content-topics/src/types.ts | 双标尺并存，逐字段声明；"全库统一 0-100"不成立 |
| 6 | 素材状态 | unread/read/favorite/ready | unread/read/favorite/picked（favorite/picked 豁免清理） | content-outputs/src/gather/types.ts | picked |
| 7 | 选题状态 | idea/todo/in_progress/done/shelved | idea/todo/creating/done/shelved | content-topics/src/types.ts | creating |
| 8 | 选题溯源 | 裸 source_type + source_id | `source{type,ref_id,url,snapshot}` 快照结构（源删后仍可读） | content-topics/src/types.ts | 采纳实现结构 |
| 9 | 选题评分 | ai_score + score_breakdown 固定四维 | `score{total,source,factors[],evaluated_at}`，因子带 reason/confidence/estimated，人工可无因子 | content-topics/src/types.ts | 采纳实现结构 |
| 10 | 选题归属字段 | topic_id 必填 | TopicItem 无 topic_id，用 `topic_dir` 关联 outputs 目录 | content-topics/src/types.ts | topic_dir；instanceBase 不含 topic_id |
| 11 | 选题排期回链 | 无 | `schedule_item_id` 关联 `_schedule.json` 条目 | content-topics/src/types.ts | 采纳；回链已统一业务→排期单向（publish 侧同向落地，日历侧随 calendar_event 废止不适用，见 39） |
| 12 | ID 前缀 | "栏目类型前缀+随机" | acc-/cw-/cr-（浏览器侧 newId）、cc-（工作台）、ct-（模板，网关）；选题/排期/画像为裸 randomUUID；素材为 guid/SHA-1；`idea-` 仅为收录选题 assets 文件名前缀 | content-studio/src/client/competitors.ts:158,262、CompetitorsView.tsx:322,433,454、client/create.ts:42、content-topics/src/store.ts:138、content-schedule/src/store.ts:73、content-outputs/src/persona/store.ts:379、create/store.ts（putCreateTemplateFile） | 前缀表按实现重建；v0.1.x 审阅稿曾把 idea- 误列为选题实体前缀，更正 |
| 13 | 素材去重键与保留 | 无 | guid 优先，否则规范化 link 的 SHA-1；`raw_guid` 随行；每源保留 ≤50 条，favorite/picked 豁免 | content-outputs/src/gather/types.ts、gather/store.ts:25,28 | 采纳并写入 MCP fetch_rss 契约；配额入 0.9 |
| 14 | 素材正文 | content + content_file 双字段 | `body_file` 单源；原始 HTML 落盘前服务端净化并按 GATHER_MAX_BODY_CHARS=100_000 截断；summary/points/tags/excerpts 小文本直存 | content-outputs/src/gather/types.ts、gather/store.ts:258-260 | 0.6 单源规则；素材无审计字段 |
| 15 | 对标作品热度 | heat_level(low/medium/high/viral) 入盘 | 不入盘；视图层按账号内最近 30 条、样本 ≥4 计算相对热度 hot/normal/cold | content-outputs/src/competitor/types.ts、content-studio/src/client/competitors.ts | heat_level 废止 |
| 16 | 对标作品互动 | interaction 单快照对象 | `metrics[]` 追加式快照（t/likes/comments/shares/views?），永不覆写 | content-outputs/src/competitor/types.ts | 追加式快照数组 |
| 17 | 对标作品去重 | 无 | platform+account_id+platform_work_id；platform_work_id 空时以 `title:<标题>` 兜底；先精确键后 title 键匹配 | content-studio/src/client/competitors.ts:242-250 | 采纳（2.2 去重规则） |
| 18 | 对标账号载入 | required 全字段 | isAccount 允许 homepageUrl/topics/priority 缺省（兼容旧数据），其余必填 | content-studio/src/client/competitors.ts:108-110 | Schema 声明完整形态 required + 兼容口径注记（2.1） |
| 19 | 拆解状态 | breakdown_status(pending/done/failed) + breakdown 分离 | `analysis{status:none/done/failed, error?, ref?, result?}` 嵌套，pending/running 不入盘，result 仅 done 可存在 | content-outputs/src/competitor/types.ts | 合并嵌套，非法状态不可构造 |
| 20 | 对标报告 | report_type(single/comparison)，单 1 个对比 2–5 个 | `kind(account/compare)`，compare 恰 2 个；`ref` 文件权威 | content-outputs/src/competitor/types.ts | 采纳实现口径 |
| 21 | 画像存储 | 清单在 localStorage | `_personas.json`，条目全文内嵌（含报告/简历文本），"条目即完整备份" | content-outputs/src/persona/types.ts（模块注释）、persona/store.ts | 迁文件；localStorage 仅选中态/向导草稿/旧数据迁移源 |
| 22 | 画像字段 | self_intro/target_audience/operations/expressions/forbidden 等十余嵌套对象 | 九固定键 `fields` 全量必带（wire records must be complete，缺键拒载），每键 `value/source/ai_meta` 溯源；whoAmI 禁止 AI 通用填充 | content-outputs/src/persona/types.ts、persona/store.ts（FIELD_KEYS 注释） | 按实现重构；九键 required + additionalProperties:false |
| 23 | 画像风格预设 | professional/friendly/humorous/concise/narrative/solid/empathetic/custom | professional/friendly/humor/concise/narrative/hardcore/empathy；custom 移除（preset 可 null + custom_text，共存时自定义优先） | content-outputs/src/persona/types.ts | 实现词表；preset 可空用 type 数组 + enum 含 null |
| 24 | 画像新鲜度 | 无 | `revision` 每次表单保存自增 + `digest`（≤200 字符网关计算）；报告记 `source_revision`；报告编辑独立面不 bump revision | content-outputs/src/persona/types.ts | 采纳 |
| 25 | 创作栏目 | 多 draft 实体（id/title/content/status/versions 内嵌 content/generated_batch/compliance_check/seo_geo/hashtags） | 每主题一份 `assets/_create.json`（CreateManifest）；版本正文内嵌自含（never a file reference）；content_type 六值；topic_ref/sources 结构化引用；persona 经 profile_digest 请求面关联 | content-outputs/src/create/types.ts:9-25,57-79,112-139、create/store.ts:31 | v0.1.x 审阅稿"versions[].file_ref 外链"与实现相反，按实现改回内嵌（0.6 例外二）；4.1 整章重写 |
| 26 | 内容模板 | category 闭枚举 + variables/versions/status | `CreateTemplate{id,title,content_type,body,revision,updatedAt}`，库根 `_templates.json`；占位符白名单五值；无 versions/variables/status/tags | content-outputs/src/create/types.ts:225-242、create/store.ts:25,455-480 | 10.1 整章重写；v0.1.x 冗余字段废止 |
| 27 | 排期文件写法 | "定时写入 _schedule.json"（写法未约定） | 排期模块单点写：`withFileLock` + `writeFileAtomic`（0600），每次整文件重写；坏记录具名跳过 | content-schedule/src/store.ts | 6.3 单点写规则 |
| 28 | 排期条目结构 | （文档无此实体；calendar_event 为 date-time 粒度） | `ScheduleItem{date:YYYY-MM-DD, time:HH:mm|null, status:idea/draft/scheduled/published, kind:content/event, topic, url}`；无审计字段 | content-schedule/src/types.ts、store.ts | 6.2 独立成节；calendar_event 与之经 id 双链 |
| 29 | outputs 项目元数据 | 未定义 | `.dsh-output.json`：status(draft/ready/published)、kind 七值、create 簿记（currentVersion/publishedVersion/publishedPath/publishedAt） | content-outputs/src/types.ts、create/types.ts:218-223 | 0.8 新增（含 create 结构化） |
| 30 | publish_task / calendar_event / review / conversation | v0.1.x 结构 | 三轮核实：publish/review 已实现（publish M1、复盘全链路，二轮误判"无实现证据"系未读该两模块）；日历无独立事件实体；conversation 确无实现 | content-outputs/src/publish、content-outputs/src/review、content-schedule/src/calendar-notes.ts | publish/review 按实现重写（36/38），日历改派生模型（37），conversation 锚 v1（40） |
| 31 | topic_draft.persona_id | 选题可关联画像 | 实现无此字段；画像经创作稿件 `topic_ref`/`profile_ref` 关联 | content-topics/src/types.ts、create/types.ts | 字段废止，关联路径待产品确认 |
| 32 | MCP envelope | 扁平 request/response + error 字符串 | 无实现证据；本期契约自定 envelope 与闭枚举错误码 | —（契约先行） | 11.0 声明；接入实现时回填对账 |
| 33 | gathered_ref 语义 | 无 | 类型注释"关联信息采集素材"，视图实现写入收录选题文件名（idea-*.md）——实现内部口径不一致 | content-outputs/src/competitor/types.ts、content-studio/src/client/CompetitorsView.tsx:433-437 | **三轮已统一**：字段改名 `collectedIdeaRef`（注释与读写同步），语义=已收录选题导出文件名兼已收录标记（2.2 `collected_idea_ref`） |
| 34 | MCP 11.3 external_id 口径 | 11.3 返回 work_id | 对标侧平台原生 ID 名为 platform_work_id；复盘 per_work 用 external_id | content-outputs/src/competitor/types.ts、本版 7.1/11.3 | MCP 面统一 external_id，盘内对标实体保留 platform_work_id；待实现统一 |
| 35 | fetch_messages 消息 id | 无 id | 无实现证据；契约先行要求平台原生消息 id 作去重键 | —（契约先行） | id 必填，生成规则待实现核实 |
| 36 | publish_task 结构 | 六态（reviewing/running/partial_success/success/failed）+ 内嵌 adapted_title/content/log + account_ids | 四态（draft/pendingReview/scheduled/recorded，本期终态 recorded，执行态随二期 MCP）；衍生稿 content_file + attempts 只追加日志；platforms[] 腿 + account_alias 别名制（零凭据） | content-outputs/src/publish/types.ts | 5.1 整章按实现重写 |
| 37 | 日历事件实体 | 独立 calendar_event（event_type/ref_id/planned_time/status） | 无独立实体：事件=排期条目派生；日历自有数据仅 `_calendar.json` 备注（非空 upsert、空白清除、惰性条目忽略） | content-schedule/src/{types,store,calendar-notes}.ts | 6.1 废止 calendar_event，改派生模型 + 备注 sidecar |
| 38 | review 结构 | 单实体（metrics snapshot+delta/per_work/insights/recommendations） | `_review.json` 三段清单（baselines/snapshots/tasks）+ `_review-index.json` 全局索引；CSV 两步导入；绑定三级；degraded 降级标记 | content-outputs/src/review/{types,store,importers}.ts | 7.1 整章按实现重写；metricSet 对齐 ReviewMetrics |
| 39 | 排期回链方向 | "同步日历与 _schedule.json"（方向未约定） | 回链单向业务→排期：`TopicItem.scheduleItemId` 与 `PublishTask.scheduleItemId`；`ScheduleItem.publishTaskId` 反向字段已删除；发布定时以显式 id upsert（重排原位更新不孤儿化） | content-topics/src/types.ts、content-outputs/src/publish/types.ts:82、content-schedule/src/types.ts、ui-content-studio publish-store（scheduleTask） | 6.3 统一规则；主会话三轮代码已落地（293 用例绿、定向 tsc 净） |
| 40 | conversation 落位 | 会话记录进主题 assets | 冻结契约：库根 `_interactions.json`（禁主题 assets/ 与 .dsh-output.json，防产物扫描误伤）；Conversation+Message 聚合 | interaction-dev-prompt-v1.md 第二、三章 | 8.1 锚定 v1 转写（裁决先行） |

### 遗留待核实项（汇总）

1. **conversation（互动）**——唯一无实现实体；本版按 interaction-dev-prompt-v1 冻结契约转写（裁决先行），实现后回填对账（附录B#40）。
2. **复盘 `per_work` 发布任务关联 / 发布二期执行态与 MCP 通道**——契约已留位（7.1 注、5.1 执行语义），随二期落地回填。
3. **MCP envelope / 幂等键 / 消息 id 生成规则**——契约先行，接入实现时回填（附录B#32/35）。
4. **11.3 `external_id` 与盘内 `platform_work_id` 命名统一**（附录B#34）。
5. **`dsh-content-studio.*` 与 `content-studio.*` 两种 localStorage 键前缀**的统一时机；日历视图配置键（当前不存在）。
6. **4.1 裁决先行规划字段**（compliance_check/seo_geo/generated_batch 等）随实现回填。
4. MCP envelope、幂等键、fetch_messages 消息 id 生成规则（契约先行，接入时回填）。
5. `event_type ↔ ref_id` 配对校验的载入行为（拒绝单条 vs 拒绝整文件）；calendar_event 的 overdue 判定方与时机。
6. MCP 11.3 `external_id` 与对标实体 `platform_work_id` 的命名统一。
7. `gathered_ref` 实现内部口径统一（素材引用 vs 收录选题文件名，附录B#33）。
8. topic_draft 画像关联路径（原 persona_id 废止后的产品确认，附录B#31）。
9. 4.1 规划字段（compliance_check/seo_geo/hashtags/generated_batch）与 3.1 `optimize_suggestion` 的落地回填。
