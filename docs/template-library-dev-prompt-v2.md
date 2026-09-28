# DSH 内容创作插件｜全局【模板库】开发提示词 v2

> 版本：v2（2026-09-27，经天龙 10-01-prompt-architect 提示词评审 + 01-investigator GitHub API 核验后重写）。
> 落地包：`packages/creation/content-outputs`（网关）+ `packages/client/ui-content-studio`（前端），同 gather/create/persona 模式，零新包。
> 里程碑：M1 主闭环（本文全部 P0）→ M2 全栏目 manifest 推广与既有模板机制统一评估。

## 0. 定位与铁律

**一句话定位**：跨 10 个二级栏目（选题/创作/发布/日历/复盘/互动/画像/对标/信息/仪表盘）的全局模板资产仓库，只提供"初始化骨架"，不产生业务数据。它是【互动】v2 中"LocalStorage 预置表"所消解的悬空依赖的正主，也是 freemium 商业化中"近零边际成本模板包"的分发载体。

**铁律（编码代理不可违背）**：

1. **数据隔离**：模板全部数据落盘 `<dsh home>/templates/`（Config 字段 `templatesRoot`，默认 `<dsh home>/templates`）；使用模板生成的业务数据写入对应 `<主题>/.dsh-output.json`，二者互不引用。
2. **渲染不落盘**：渲染仅做变量替换，结果只进当前表单/草稿态，不自动提交、不写业务文件。
3. **LocalStorage 禁令**：分类、标签是业务数据，必须落盘；LocalStorage 只允许存丢失无损失的视图偏好（排序方式、列表折叠状态）。
4. **AI 铁律**：所有 AI 功能显式按钮触发 → 产出草稿态预览 → 用户可编辑 → 用户点击保存才写盘；AI 不可用（无 key / 429 / 超时）时，所有功能保留纯手动路径（手动选中文字标记为变量）。
5. **不做范围**：团队权限；模板参与业务流转；自动生成业务实例；仪表盘模板仅保留分类枚举占位不实现；单模板diff存储（用全量快照）。

## 1. 数据契约（冻结，先行交付，实现期不得私改）

### 1.1 模板记录（`<templatesRoot>/templates.json`）

```json
{
  "formatVersion": 0,
  "templates": [{
    "id": "uuid-v4",
    "name": "string，全局唯一，保存时校验重名",
    "category": "topic | creation | publish | calendar | retro | interaction | persona | benchmark | intel | dashboard",
    "description": "string",
    "tagIds": ["tag-uuid"],
    "body": "string，Markdown 正文，含 {{var}} 占位符",
    "variables": [{
      "name": "string，匹配 ^[a-zA-Z][a-zA-Z0-9_]{0,63}$",
      "label": "string，展示名",
      "description": "string",
      "defaultValue": "string，选填",
      "required": "boolean"
    }],
    "status": "active | archived",
    "version": "number，单调递增，从 1 开始",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }]
}
```

`formatVersion: 0`，拒载更旧与更新（同 `.dsh-output.json` 门控）；解析丢记录时 put/delete 一律拒绝（保存永不静默删数据，同 persona 拒写策略）。

### 1.2 标签（`<templatesRoot>/taxonomy.json`）

```json
{ "formatVersion": 0, "tags": [{ "id": "tag-uuid", "name": "string，唯一" }] }
```

分类为固定枚举对应 10 栏目，不开放自定义。删除标签时同一写者锁内同步剥离所有模板的 `tagIds` 引用。

### 1.3 版本快照（`<templatesRoot>/history/<template-id>/<version>.json`）

全量字段拷贝（不用 diff）+ `changeNote` 备注 + `createdAt`。仅**手动保存**触发（前端无自动保存；或自动保存不产生快照）。单模板保留最近 20 份，超出丢弃最旧。回滚 = 以历史版本内容走 putTemplate 创建新版本号，不覆盖历史。

### 1.4 导入导出包

```json
{
  "format": "dsh-template-pack",
  "formatVersion": 1,
  "exportedAt": "ISO8601",
  "templates": ["…模板记录全量…"],
  "tags": ["…标签记录…"]
}
```

单导/批导同构。导入判定键 = `id`，冲突三选：`skip`（保留本地）/ `overwrite`（整条替换，版本号取 max+1）/ `rename`（另存新 uuid，名称加后缀 `-2` 递增至唯一）。非法条目（schema 校验失败）跳过并列入失败清单，其余正常导入，不做整体回滚。不同 id 但同名的导入条目名称自动加后缀至唯一。

## 2. 变量语义（精确规范）

- 匹配：`/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*?)\s*\}\}/g`；变量名仅 `[a-zA-Z][a-zA-Z0-9_]*`。
- Markdown 围栏代码块（``` 与 ~~~）与行内代码内的 `{{}}` **不渲染、不计入变量**。
- 字面量输出：`\{{name}}` 转义写法（占位符前置反斜杠）渲染为字面量 `{{name}}`。
- **变量以正文为准**：解析占位符得活跃变量集合，与 `variables` 元数据按 name 对齐；正文已删的占位符元数据进入"未引用"提示区，不自动删除。
- 渲染：必填变量未填 → 禁止确认；选填留空 → 用 defaultValue，仍空则输出保留 `{{name}}`。渲染遇未知变量（正文有占位符但变量表无元数据）→ 保留占位符并在预览警示。
- 渲染结果一律 HTML 转义后插入，禁止 innerHTML 直插未转义内容（XSS）。

## 3. 功能模块规格

### M1 列表与检索
分类（单选）+ 标签（多选）+ 状态筛选；搜索范围 = 名称+描述+正文（大小写不敏感）；列表字段 = 名称/分类/标签/版本号/更新时间/状态；归档模板不可被弹窗调用，可在管理页恢复/删除。

### M2 编辑器
基础信息 + Markdown 正文（textarea，与 studio 既有编辑面一致）+ 变量定义表（名称/展示名/说明/默认值/必填）。每次手动保存生成快照并弹版本备注（可空）。AI 辅助（显式按钮）：「AI 生成模板」（描述→草稿→确认保存）、「AI 优化」（正文+指令→草稿 diff 预览→采纳/放弃）、「AI 提取变量」（实例内容→骨架草稿+变量切分→人工逐条确认）。

### M3 模板操作
新建（手动空白）；从业务实例另存 = AI 提取变量草稿 → 弹窗人工确认/修改变量切分 → 命名保存，AI 失败降级为手动选中文字标记变量。复制 = 新 id、版本重置 1、名称加"副本"后缀。删除级联删除全部快照，二次确认文案注明"将删除 N 个历史版本"。归档/恢复即时生效。

### M4 导入导出
按 §1.4 执行；导入完成展示摘要（新增/跳过/覆盖/重命名/失败 n 及失败原因清单）；导出经浏览器下载 JSON。

### M5 跨栏目调用（核心集成）
- **栏目 field manifest 注册接口**：每个栏目声明可被模板填充的字段 `[{ key, label, accept: "text" | "markdown", required }]`，注册在前端共享的 manifest 注册表中。
- **模板输出契约**：渲染结果为结构化对象 `{ title?, body, tags?, meta? }`；表单类模板按键名映射 manifest 字段，正文类填充 `body`。
- **弹窗流程**：统一为手动点击【使用模板】触发（不做自动弹出）→ 列表仅展示当前栏目分类下 active 模板 → 变量表单（必填校验，未满足禁用确认）→ 确认渲染 → 当前表单已有内容时先弹覆盖确认 → 填充后可继续编辑，原模板不变。中途关闭弹窗 = 丢弃，无副作用。
- **降级规则**：未注册 manifest 的栏目，弹窗仅展示正文 + "复制正文"按钮。

### M6 错误处理
`<templatesRoot>` 读写失败 = toast 报错 + 脏数据留在内存不落盘；导入非法 JSON = 整包拒绝并提示原因；AI 失败 = 明示"未生成"（上游无额度是常态），不阻塞手动路径。

## 4. AI 执行规范

- AI 全部经网关 `processTemplateAi` 单入口（llm Service Definition，同 persona `processPersonaAi` 模式），前端禁直连。
- 结构化 JSON 契约：generate/optimize/extract 三操作统一返回 `{ draft, problems[] }`，problems 逐字段丢弃不整包失败。
- 网关常量提示词 + `TEMPLATE_AI_PROMPT_VERSION` 常量；429 读 Retry-After 退避；一次性调用无批量队列。

## 5. 与既有机制的关系（边界写明；M2 评估结论已回填）

- 创作栏目 `_templates.json`（生成管线模板，占位符白名单 {{title}}/{{audience}}/…）与互动栏目 `interaction.replyTemplates` 预置表**一期保留原地，模板库不接管不迁移**——模板库输出进"表单初始化"层，二者作用层不同；二期再评估统一。
- **M2 评估结论（2026-09-27）——不统一，维持分离**：
  - `_templates.json` 保留：它的占位符是白名单契约（`assertTemplateBody` 保存与生成双重校验），被网关生成管线消费（framed prompt 注入）；模板库变量自由、面向人填。统一要么打破白名单校验，要么把自由变量塞进管线，两边都受损。
  - `interaction.replyTemplates`：互动栏目尚未实现，其 v1 文档中"模板=LocalStorage 预置表"的止损方案**建议废弃**——互动上线时直接经模板库弹窗（category `interaction`）取用，无迁移成本。
- 模板库不写 `.dsh-output.json`、不写 `outputs/` 下任何文件；`_topics.json`/`_schedule.json`/`_personas.json` 等既有系统文件零接触。
- 模板库内容不进 AI 生成主路径（创作栏目的提示词注入仍走画像 + 指令库）；模板库只做初始化。
- 内置模板包（starter-pack.ts，8 模板跨 6 分类）作为 freemium 分发载体样例：稳定可读 id + `skip` 策略使重导入幂等；付费模板包后续走同一 `dsh-template-pack` 格式与导入面。

## 6. 里程碑与验收

### M1 主闭环（本期）
网关 template 模块 + 8 个 @Remote + 前端模板库页面（列表/编辑器/版本/导入导出/AI 草稿确认）+ TemplatePickerModal + manifest 注册机制 + 首个试点栏目接入（创作）。

**验收标准（逐条可验证）**：
1. 新建含 3 变量模板保存 → `templates.json` 出现记录、`history/<id>/1.json` 存在；
2. 正文新增 1 个占位符再保存 → 版本号 +1，变量表自动出现新变量；
3. 导出 2 个模板 → 清空数据 → 导入 → 模板、标签、版本历史完整恢复；
4. 导入含重复 id 的包：选"覆盖"→ 内容更新且版本号 +1；选"跳过"→ 本地内容与版本记录不变；选"重命名"→ 新 id 新名称、原模板不变；
5. 必填变量未填 → 确认按钮禁用；选填留空 → 渲染结果保留占位符高亮；
6. 无 API key 状态下「从实例另存模板」走手动标记路径可完成全流程；
7. 归档模板在栏目弹窗中不可见，恢复后可见；
8. 渲染填充前弹覆盖确认，取消则表单保持原内容；
9. 清空 LocalStorage + 换浏览器访问 → 模板库（含标签）完整无损；
10. 围栏代码块与行内代码内的 `{{x}}` 不渲染、不计入变量；`{\{x}}` 输出字面量。

### M2（已交付 2026-09-27）
- **结构化输出兑现**：picker apply 草稿升为 `TemplatePickDraft { title, body, tags, values, template }`——title 取自填写的 `{{title}}` 变量（未填回退模板名），tags 为模板标签名解析结果；多字段宿主从 `values` 按名取用。
- **第二消费者接入（选题库）**：TopicBankView 头部与空态「从模板新建」→ category `topic` 弹窗 → 结构化草稿**预填创建表单**（标题/描述/标签，永不利 put——渲染不落盘铁律）；创建表单在有预填内容时条件渲染可选字段，保存路径携带可选字段（纯手工快加路径形状不变）。
- **必填语义修正**：`missingRequired` 按**正文活跃占位符**过滤——required 声明但其占位符已从正文移除的变量不再阻塞确认（正文为准原则贯彻到校验）。
- **内置模板包**：starter-pack.ts 8 模板跨 6 分类 + 库页「内置模板包」按钮 + 空态 CTA，`skip` 策略幂等重导入。
- **日历不接入（裁决）**：排期条目是时间元组（标题/时间/平台），无正文落点，骨架模板无处可填；待日历 v2（事件=派生视图）落地后再评估 note 类落点。
- **发布/复盘/互动**：由各栏目上线时接一行 `openPicker`（弹窗已挂 surface 层全栏目可见）。

## 附录：设计参考（只借设计与数据格式；AGPL/无 license 项目禁搬代码）

| 项目 | 核验数据（2026-09-27） | 借鉴点 |
|------|------|------|
| yarin-zhang/AI-Gist | 889★ AGPL-3.0 | 变量元数据结构、以正文为准的对齐（reconcilePromptVariables 思路）、PromptHistory 全字段快照+备注、AI 提取变量交互 |
| jonathanbertholet/promptmanager（Open Prompt Manager） | 103★ 无 license | 导出格式带 formatVersion、稳定 ID 去重、`#variable#`→我们用 `{{var}}` |
| espanso/espanso | 14.5k★ GPL | 变量分类学、"触发→弹表单填变量→展开"交互 |
| langfuse/langfuse | 35k★ MIT 核心+ee 商业条款 | 版本号+commit message 版本模型 |
| pezzolabs/pezzo | 3.3k★ Apache-2.0 | Prompt 与 PromptVersion 实体分离 |
| microsoft/PromptWizard | 4k★ MIT | AI 反向生成/优化提示词思路 |

不采用：PromptPal（79★，Go+GraphQL 企业 on-prem，"分类/标签/预览"无证据，版本备份 WIP）、Dify（157k★，平台过重，性价比低）。
