# DSH 内容创作插件｜【画像】（persona 视图）开发提示词 v2（调研修订版）

> 用途：DSH 扩展模块 `@guilinleolee/content-studio`（v0.1.2-rc.5），【内容创作】菜单下二级栏目【画像】（persona 视图）在位升级，为【创作】栏目提供人设风格能力。改哪里、怎么改、何为完成，以本文为准；本文与现实代码冲突时，停下报告，不要自行发明机制。
> 修订：v2（2026-09-25）——依调研（GitHub 开源对标逐项 API 核验 + 架构审查 + 现实代码勘察）合入八项修订。v1 引用的 3 个参考项目核验结论：1 保留改标注（AGPL-3.0 仅借鉴设计）、2 替换；替换清单见文末附录。

## 〇、与 v1 的差异（已锁定决策）

1. **画像唯一真源落盘 `~/.dsh/outputs/_personas.json`**（全局单文件，`_` 前缀 scanner 隐身，与 `_templates.json`/`_topics.json`/`_schedule.json` 同惯例），经新 `contentPersonas` 网关读写。推翻 v1"画像清单保存在浏览器本地存储"——违反既定结论"跨端状态必须收进磁盘元数据"（create v2 〇.5 因同一条推翻过 v1）；localStorage 降级为向导草稿缓冲与 UI 偏好。
2. **放弃 v1"画像元数据写入 `<主题>/.dsh-output.json`、素材存 `<主题>/assets/`"**：`.dsh-output.json` 是主题级作品元数据（schema 严格 + `formatVersion` 拒载门控，禁改）；且画像跨平台跨主题，per-topic 归属无解（新建画像时表单没有主题字段，多主题查找需全库扫描）。全部文本资产（简历提取文本、官网粘贴文本、报告全文）内嵌 `_personas.json` 条目，主题目录与 `.dsh-output.json` 零接触。
3. **数据契约独立成章（第三章），先冻结再开发**：对齐 create v2 三.4/九.3 已公布的画像侧契约（稳定 id + 风格全文 + revision + digest + 经网关读取）——v1 无任何字段级契约，按 v1 实现创作侧将"永久保持内联主路径"，跨栏目联动落空。
4. **AI 从保存主流程拆出**：保存为纯本地确定性操作（必填校验过即落盘，空白字段允许留空）；AI 补全/简历解析/报告生成/一句话草稿全部显式按钮触发、可失败可重试。修复 v1"提交即强制 AI 补全"——无 Key/429/断网时保存被劫持，违反"AI 显式触发、可失败、可重试"既定约定。
5. **报告覆盖闭环**：report 记 `sourceRevision + editedByUser`；表单更新后报告面板黄条提示过期；手工编辑过的报告重新生成强制二次确认——封死 v1 未定义的"编辑报告→改表单→重新生成→手工编辑被静默覆盖"数据丢失路径。
6. **手动导入兜底主路径**（与 gather/对标账号同款决策）：简历 P0 = 粘贴或 TXT/MD 上传即提取纯文本（PDF 解析 P1）；官网 P0 = 手动粘贴文本为唯一路径、【解析】按钮禁用态占位；网页抓取 P2 经网关并带 SSRF 防护与白名单清洗。
7. **provenance 进数据与注入**：所有 AI 可补全结构化字段统一 `{ value, source, aiMeta }` 包装；`source: "ai"` 字段在报告与创作 Prompt 注入时追加"（AI 推断，供参考）"——把 v1"AI 仅为行业通用推断请人工核对"从一句 UI 文案变成可溯源的数据事实。
8. **参考项目替换**：ai-persona-hub（2★ 练手项目）、character-editor（130★ 无 license 停更）删除；替换为 Letta / character-card-spec-v3 / NextChat；SillyTavern 保留改标注（AGPL-3.0 仅借鉴设计禁抄代码）；新增 Resume-Matcher / crawl4ai / AIWriteX。详见附录。

## 一、前置事实（开发前必读）

- 真源码在 harness 检出包（同 create/gather）：前端 `packages/client/ui-content-studio/`，网关样板 `contentTopics`（选题库 v2）/`contentSchedule`。`D:\dsh-content-studio` 是发行仓库（`sync.mjs` 拷贝改名），禁改其 `dist/` 与 zip；发布流程照旧（build → sync → release）。本栏目开工范围新增：`contentPersonas` 网关（六.1）与 content-outputs 的 assetCount 补过滤（八.1）。
- persona 视图已注册于 `NAV_ITEMS`（现导航 workbench/chat/benchmark/topics/library/create/accounts/persona），现状 = 自由文本画像页（`PersonaView.tsx`；localStorage 键 `dsh-content-studio.persona`，经 `withIdentity` 拼进复制指令）。本文按"在位升级"编写；升级含旧数据迁移（六.4）。开工前核对视图现状；若视图不存在，停下报告。
- AI 前置事实：上游 429/无额度是常态（gather v2.1 同款前置事实）。画像全部 AI 动作显式触发、可取消、同一时刻并发 1、429 读 Retry-After 否则指数退避封顶 30s 最多 4 次、失败不产生半截数据。
- AI 调用复用 create v2 五.1 的 AI 网关（generate 类方法 + promptVersion 参数）；若两栏目并行开工，AI 网关作为共享前置任务只交付一次，双方禁止各自直连。画像 AI 动作计入同一配额网关（create v2 五.3）：补全/简历解析/报告生成/草稿各计 1 次 AI 调用，本地功能不计费。
- 选题库 v2 已定稿（`docs/topic-bank-dev-prompt-v2.md`）：全局 `_` 前缀单文件 + 网关 list/put/delete（`withFileLock` + `writeFileAtomic` + 拒载 + problems）+ `onNavigate(view, params?)` 带参跳转——本栏目照抄该惯例。
- outputs scanner 排除 `.`/`_` 前缀条目（`content-outputs/src/scan.ts`）；**已知缺陷：`assetCount` 统计未过滤 `_` 条目**（裸计数，gather 留有补过滤 TODO 未落地）。本栏目数据不进主题目录故不受影响，但该缺陷在 scanner 内，修正在本栏目开工范围内（八.1）。
- `.dsh-output.json` `formatVersion !== 0` 整体拒载；本栏目零接触该文件。pre-release（formatVersion 0）schema 一次性定型、无兼容承诺。
- 运行环境 Windows 本机：整体替换文件须容忍杀软/索引器对刚关闭文件的瞬时句柄占用（重试退避，照 gather 五.5）；数据目录不进 OneDrive 等同步文件夹。
- UI 复用既有模式：卡片网格、列表行、加载/错误/空三态 + `problems` 告警条、`--dsw-alias-*` 设计令牌；向导弹窗与侧边详情面板复用既有组件不重写；**新样式拆独立 `persona.module.css`**（主 CSS 不再堆行）。

## 二、存储规范

1. 唯一真源：`~/.dsh/outputs/_personas.json`。主题目录（`<主题>/`、`<主题>/assets/`）与 `.dsh-output.json` 零接触；不产生任何独立报告文件（全文内嵌，无引用悬空，一个文件即完整备份）。
2. `_personas.json` schema（`formatVersion: 0`，一次性定型）：

```jsonc
{
  "formatVersion": 0,
  "personas": [                                  // 按 updatedAt 倒序
    {
      "id": "p-3f9c…",                           // randomUUID，Branded；克隆生成新 id
      "name": "AI 工具测评老李",                  // 必填（唯一性由用户自担，不做唯一约束）
      "platforms": ["xhs", "douyin"],            // 枚举见 4.2
      "accountStage": "fresh",                   // fresh | existing
      "revision": 7,                             // 每次 put 成功 +1；创作侧 profileRef 锚定
      "digest": "…≤200字…",                      // persona-prompt@1 确定性生成（4.6）
      "fields": {                                // 结构化字段，统一 provenance 包装（4.3）
        "whoAmI":       { "value": "…|null", "source": "user|ai|template", "aiMeta": null },
        "audience":     { "value": "…|null", "source": "ai", "aiMeta": { "promptVersion": "persona-fill@1", "at": "ISO" } },
        "oneLiner":     { "…": "同构" },
        "niche":        { "…": "赛道/行业" },
        "goal":         { "…": "核心目标" },
        "monetize":     { "…": "变现方式" },
        "contentValue": { "…": "内容核心价值" },
        "cadence":      { "…": "更新节奏" },
        "phrases":      { "…": "推荐句式/表达习惯" }
      },
      "links": [                                 // 步骤2 社媒链接（按平台多条）
        { "platform": "xhs", "url": "…", "bio": "…", "sampleText": "…" }
      ],
      "site": { "url": "…|null", "pastedText": "…|null" },   // P0 不抓取，仅手动粘贴
      "style": {
        "preset": "professional|friendly|humor|concise|narrative|hardcore|empathy|null",
        "customText": "…|null",                  // preset 与 customText 至少其一，可并存（custom 优先）
        "strength": "light|strict",              // 缺省 light；映射见 4.6
        "bannedWords": ["…"],
        "redLines": ["…"]
      },
      "assets": {                                // 文本资产内嵌（P0 不落原始文件）
        "resumeText": "…|null",                  // 简历/简介提取文本（粘贴或 TXT/MD 上传）
        "resumeName": "简历.txt|null"
      },
      "report": {                                // 衍生文档，全文内嵌；未生成为 null
        "markdown": "# 账号画像报告\n…",
        "sourceRevision": 6,                     // 生成时基于的表单 revision
        "editedByUser": false,                   // 面板内保存过手工编辑 → true
        "generatedAt": "ISO",
        "promptVersion": "persona-report@1"
      },
      "clonedFrom": "p-…|null",
      "createdAt": "ISO", "updatedAt": "ISO"
    }
  ]
}
```

3. 拒载门控：`formatVersion !== 0` 或 `personas` 非数组 → 整体拒载进 `problems`（照 `content-schedule/src/store.ts` 先例）；单条画像坏记录（缺 id/name、字段类型错）点名跳过不静默，不整文件失败。
4. localStorage 边界（仅两类）：向导未保存草稿（键 `dsh-content-studio.persona.wizard`）、创作侧最近选中画像 id；配置对象带 `version` 字段，加载跑归一化迁移，识别不了整体回默认（同 create v2 二.6）。
5. 导出/导入（P1）：整份 `_personas.json` 经网关导出/导入（导入走校验 + 坏记录点名，ID 冲突条目跳过并提示），作为换机兜底。

## 三、数据契约（交付硬依据，先冻结本章再开发）

枚举、字段、状态机、promptVersion 不得在实现期私自变更；create v2 三.4/九.3 契约由本章满足。

### 4.1 id 与 revision
`id = "p-" + randomUUID()`（Branded，跨进程不透明）；`revision` 从 1 起，每次 put 成功 +1；克隆生成新 id、revision 重置 1；`digest` 为 `persona-prompt@1` 的确定性派生（4.6），随条目落盘并经 `list()` 返回。

### 4.2 platforms 枚举（与 competitor v2 4.2 词表对齐扩充）
`xhs | douyin | bili | zhihu | wechat(公众号) | channels(视频号) | weibo | toutiao`。channels/weibo 为本栏目新增、toutiao 为对齐预留；新增值已通知 create/competitor 侧同步词表（第十章）。

### 4.3 provenance 结构
所有 `fields` 字段统一 `{ value, source, aiMeta }`：`source: "user" | "ai" | "template"`；`aiMeta: { promptVersion, at } | null`（仅 source=ai 时非空）。报告与创作注入对 `source === "ai"` 字段追加"（AI 推断，供参考）"。**AI 通用补全作用域 = audience/oneLiner/niche/goal/monetize/contentValue/cadence/phrases；whoAmI 仅可经简历解析预填，通用补全不得改写**（主体背景是事实陈述，AI 不得编造）。

### 4.4 report 闭环状态机
生成/重新生成 → `report = { markdown, sourceRevision: 当前 revision, editedByUser: false, generatedAt, promptVersion: "persona-report@1" }`；面板内编辑保存 → `editedByUser: true`（sourceRevision 不变）。展示规则：`revision > sourceRevision` → 面板顶部黄条"该报告基于 v{sourceRevision} 生成，表单已更新"；重新生成时 `editedByUser === true` → 强制二次确认（"覆盖手工修改 / 取消"），确认前不落盘。

### 4.5 克隆与删除语义
克隆 = 新 id + `clonedFrom` 旧 id + revision 重置 1 + 全字段拷贝；报告随拷但 `sourceRevision` 重映射为 1（报告内容与克隆体表单内容一致，过期黄条逻辑保持正确）。删除 = 确认弹窗明示"画像与其报告一并删除；创作历史版本保留当时风格摘要，不再可跳转"；创作侧对 `mode:"profile"` 且 `get(id)` 失败的 `profileRef` 渲染"画像已删除"降级卡（create v2 三.3 `topicRef: orphan` 同款语义）。

### 4.6 persona-prompt@1 打包模板（全文）

```
【账号人设 · {name}（v{revision}）】
身份/背景：{whoAmI}
目标受众：{audience}（AI 推断字段自动追加"（AI 推断，供参考）"）
运营目标/变现：{goal}；{monetize}
内容价值：{contentValue}
更新节奏：{cadence}
表达风格：{preset 文案 | customText}（遵循强度：light = 倾向参考，允许自然偏离 / strict = 硬约束，输出前逐条自检）
表达习惯/推荐句式：{phrases}
禁用词（硬约束，输出中不得出现）：{bannedWords 逐条列举}
内容红线（触线即不合格）：{redLines 逐条列举}
```

- 空字段整行省略；`strength` 缺省 light；preset 七值与 UI 下拉一一对应（专业严谨/亲切接地气/幽默网感/简洁干练/故事叙事/硬核干货/温柔共情）。
- `digest` = 模板去除禁用词/红线明细后的 ≤200 字稳定摘要（固定字段顺序拼接 + 截断 + 尾部 `v{revision}`），同内容重复生成结果逐字节一致（单测钉住）。
- 注入规则（Letta 记忆块模式借鉴）：本模板属 create v2 五.4 的风格层；注入创作上下文上限 ≤2000 字符，超限按 更新节奏→内容价值→受众细节 顺序裁剪，身份/风格/禁用词/红线永不裁剪；禁用词与红线为结构化硬约束段，不混入自然语言段落；画像 `bannedWords` 同时并入创作侧本地违禁词预检词库（create v2 模块 4 Aho-Corasick）双保险。

### 4.7 promptVersion 清单
`persona-fill@1`（AI 补全）、`persona-resume@1`（简历解析）、`persona-report@1`（报告生成）、`persona-draft@1`（一句话草稿）、`persona-prompt@1`（打包模板，派生 digest）。全部随数据落盘可溯源；模板文案变更必须 bump 版本号。

## 四、模块清单与本期范围

### 模块 1｜画像卡片列表与四步向导（P0）

- 卡片：名称、平台标签、赛道、digest 摘要、有无报告标记、更新时间；操作：新建、编辑、克隆、删除（语义 4.5）、预览、查看画像报告。**"预览画像" = 侧边面板展示结构化字段摘要（provenance 标注）；"查看画像报告" = 打开报告 Markdown 面板（含过期黄条与编辑保存）**——两个动作、两种视图，UI 文案不得混用。
- 四步向导弹窗：步骤 1 基础信息（画像名必填/平台多选/起号状态/赛道/主体背景/目标受众/一句话简介）、步骤 2 社媒链接（多平台主页链接/简介/参考文案样例/企业官网）、步骤 3 运营意图（核心目标/变现方式/内容价值/更新节奏）、步骤 4 偏好与红线（风格下拉+自定义/强度滑块/推荐句式/禁用词/内容红线/预览打包 Prompt）。表单字段与 schema 一一对应（第三章）。
- 保存：纯本地——必填校验（画像名）通过即 `put`（revision+1）；向导中途关闭未保存内容写 localStorage 草稿缓冲（二.4），重开恢复。
- Prompt 预览（步骤 4）：按 `persona-prompt@1` 实时渲染当前表单的打包结果，只读展示 + 复制；"手动微调"指回表单改字段，不提供脱离表单的自由文本覆盖（保持"表单为源数据"单向流）。

### 模块 2｜简历解析与官网录入（P0 手动主路径）

- 简历：粘贴文本或上传 TXT/MD → 前端读取即提取纯文本，只落 `assets.resumeText`（原始文件不留盘）；显式【AI 解析预填】按钮 → AI 提取个人经历/擅长领域 → 复用补全预览面板逐字段采纳（source: "ai"，promptVersion `persona-resume@1`）。**解析前显式勾选知情同意"简历内容将发送给 AI 模型"**。解析失败兜底：`resumeText` 完整保留，结构化字段留空人工填，绝不静默丢弃。PDF 上传解析 P1（选型 docling 或同栈 MIT 库，开工前单独说明体积与引入理由）。
- 官网：URL 仅作字段存储；`pastedText` 手动粘贴为 P0 唯一路径；【解析】按钮渲染禁用态占位，title"网页抓取后续版本开放"。P2 实现：仅网关侧 fetch、http/https、拒私网/环回地址、响应大小上限、`sanitize-html` 白名单清洗后才进 `site.pastedText`。

### 模块 3｜AI 补全空白字段（P0，显式触发）

- 入口：向导步骤 4【AI 补全空白字段】按钮（可跳过）+ 详情页对未补全字段区域的补全按钮；作用域见 4.3（whoAmI 不在通用补全范围）。
- 流程：收集空白字段 → AI 网关 JSON 输出契约（字段名 = 表单字段名，逐字段短文本）→ 校验，失败字段丢弃进 `problems` 点名、不整单失败 → 【AI 补全预览面板】逐字段 采纳/手动修改/丢弃，顶部常驻提示"AI 仅为行业通用推断，请人工核对" → 采纳后二次 `put`（revision+1，source/aiMeta 按 4.3 落盘）。
- 失败语义：429/无 Key/断网 → 字段保持空白 + 角标"未补全"，toast 明确文案，可重试；保存主流程不受任何影响。

### 模块 4｜画像报告（P0）

- 显式【生成报告】/【重新生成】：读取全部表单字段（含 provenance）→ `persona-report@1` → Markdown 全文写 `report`（状态机 4.4）。报告结构：账号定位、受众画像（AI 推断字段标注）、人设要点、表达风格与红线清单、运营建议。
- 报告面板：查看全文、直接编辑、保存（`editedByUser: true`）、过期黄条、重新生成确认（4.4）。卡片列表【查看画像报告】随时打开已保存报告；无报告时按钮置灰引导生成。
- 报告历史版本（重生成前自动留上一版，上限 3）P2。

### 模块 5｜内置模板与一句话生成（P1）

- 内置人设模板随插件只读（照 create v2 二.4 内置模式）；数据格式借 prompts.chat 三件套（标题/描述/预填字段集），一键填入向导（source: "template"）。用户自定义画像模板 P2：并入 `_templates.json` 加 `kind: "persona"` 区分，不新建文件。
- 一句话生成草稿：输入一句话人设描述 → 显式触发 `persona-draft@1` → 生成结构化草稿预填向导（全部 source: "ai"），可整单丢弃；失败不阻塞手动填写。

### 模块 6｜跨栏目联动（契约与网关 P0；创作侧消费联调 M2）

- `contentPersonas` 网关（六.1）是联动唯一通道：`list()` 供卡片列表与创作侧下拉（id/name/platforms/revision/digest/updatedAt）；`get(id)` 供表单回填/创作上下文/报告面板。
- create 侧消费（该侧工作在 create M3）：选中画像 → `profileRef = { mode: "profile", id, name, revision, digest }` 写入版本快照，注入 `persona-prompt@1` 全文（快照自包含）；画像 `revision` 变更 → 创作面板提示"画像已更新"，用户显式【更新为最新画像】；画像删除 → 降级卡（4.5）。历史版本永远按当时 `revision + digest` 溯源。
- 创作页跳转画像详情：`onNavigate('persona', { personaId })`（选题库带参跳转契约同款）。

## 五、AI 调用与提示词架构

1. 全部 AI 调用（补全/简历解析/报告/草稿）经 create v2 五.1 的 AI 网关收口，前端零直连；每次调用携带 promptVersion（4.7）。
2. 失败语义（P0）：显式触发、可取消；重试策略见一；失败不产生半截数据——补全采纳才写盘、报告生成成功才落 `report`、草稿成功才预填。
3. 输出契约分流：补全/简历解析/草稿用 JSON 契约（固定字段名，校验失败逐字段丢弃进 problems）；报告用 Markdown（避免长文 JSON 截断）。
4. 配额（P1 起）：四类 AI 动作各计 1 次调用，计入 create v2 五.3 配额网关；免费档数值运营可配，本提示词不锁定；本地功能（保存/预览/digest/违禁词）一律不计费。

## 六、接口与交互约定

1. **`contentPersonas` 网关**（独立小包或并入既有 creation 网关包，开工前按 harness 插件划分定方案；store 写法照 `contentTopics`/`contentSchedule`）：`list()` / `get(id)` / `put(PersonaInput)`（revision 自增）/ `delete(id)`；`withFileLock` + `writeFileAtomic`（`mode: 0o600, dirMode: 0o700`）+ `formatVersion` 拒载 + `problems`。文件读写全部经网关收口，不直连 fs。
2. 并发写（多标签页常态）：元数据写入收敛单一序列化入口；写前校验 mtime/内容哈希，不匹配则重读合并重试，无法合并提示"另一标签页已修改，请刷新"；Windows 句柄占用退避重试（gather 五.5）。
3. localStorage 边界见二.4；键前缀 `dsh-content-studio.persona.`。
4. 旧数据迁移：首启检测旧键 `dsh-content-studio.persona` 非空 → 引导【一键导入为画像】（`style.customText = 旧文本`，source: "user"）→ 成功后清除旧键；`withIdentity` 注入逻辑切换为选中画像的 `persona-prompt@1` 渲染结果（创作侧无选中画像时回退旧内联行为——内联主路径永久保留为兜底）。
5. malformed 数据不隐藏：拒载与坏记录走 `problems` 告警条点名（照 ContentLibrary 模式）。
6. UI 复用既有三态/弹窗/侧边面板模式与 `--dsw-alias-*` 令牌；新样式拆 `persona.module.css`。

## 七、失败与降级（矩阵）

| 路径 | AI 正常 | 429 / 无额度 | 无 Key | 断网 |
|---|---|---|---|---|
| 保存画像（含报告编辑保存） | 落盘 revision+1 | **不受影响**（AI 不在保存路径） | 不受影响 | 不受影响 |
| AI 补全 / 简历解析 / 草稿 | 预览面板逐字段采纳 | 明确文案 + 稍后重试；字段保持空白标"未补全" | 提示配置 Key，入口保留 | 同左；重开页面草稿仍在 |
| 报告生成 / 重新生成 | 写 report | 保留旧报告 + toast 说明 | 同左 | 同左 |
| 创作联动 | list/get 正常 | —（纯本地读） | — | 同左；创作下拉空态提示，内联主路径兜底 |
| 多标签页并发 | — | — | — | 与 AI 无关：mtime/哈希冲突合并重试，无法合并提示刷新 |

原则：任何 AI 故障不得阻塞保存主路径；任何降级路径不得静默（toast + problems + 入口保留）。

## 八、开发限制（禁止操作）

1. 不接触主题目录与 `.dsh-output.json`；不修改 outputs 目录结构与 scanner `_`/`.` 隐身规则。**例外：`content-outputs/src/scan.ts` 的 `assetCount` 补 `_` 过滤在本栏目开工范围内一并落地**（附单测）。
2. AI 不进保存主路径；AI 调用不得绕过网关直连；禁止任何前端直发网络请求（P2 抓取也走网关）。
3. 第三章数据契约先冻结再开发；枚举、字段、状态机、promptVersion 不得实现期私自变更。
4. 开源红线见附录：GPL/AGPL 项目只看设计不复代码；引 npm 库须 MIT/Apache 且单独说明体积与 ESM 理由。
5. 源码改动全部在 harness 侧包内；禁改发行仓库 `dist`；版本号在发行仓库 `packages/content-studio/package.json` 维护。
6. 隐私：简历 AI 解析前必须知情同意勾选；`_personas.json` 落盘 0600；P0 不落原始上传文件；导出功能提示含 PII。
7. P2 网页抓取（实现时生效）：仅网关侧 fetch、http/https、拒私网/环回/非常规端口、响应大小上限、`sanitize-html` 白名单清洗后落盘；本期不写任何抓取代码。
8. 测试：`_personas.json` store 单测（put/revision 自增/拒载/坏记录/problems/克隆删除语义/并发合并）、digest 确定性单测、`persona-prompt@1` 渲染快照、旧键迁移单测、assetCount 过滤单测；用户可见输出变化按仓库测试政策补 keyless snapshot（fixtures 须 macOS/Linux 可回放）。

## 九、里程碑与交付

- **M1（本期交付）画像主闭环**：卡片列表五操作 + 两种预览、四步向导、保存/编辑纯本地、AI 补全（显式）+ 预览面板、简历粘贴/TXT 上传 + AI 解析预填（知情同意）、官网手动粘贴 + 占位按钮、风格配置 + `persona-prompt@1` 预览、报告生成/编辑/保存/过期黄条/重生成确认、`contentPersonas` 网关、旧画像迁移、assetCount 补过滤。M1 完成即不依赖任何未上线栏目的可独立上线产品。
- **M2 联动与增值**：创作侧下拉转正联调（profileRef 快照/升级提示/降级卡——与 create M3 排期对齐）、一句话生成草稿、内置人设模板、JSON 导出导入、PDF 简历解析。
- **P2 预留**：网关网页抓取（SSRF 防护 + 清洗）、报告历史版本、用户自定义画像模板、CHARX 式画像导出包（zip：`card.json` + 附件，CCv3 形态）。
- 验收路径（M1）：新建画像 → 四步填写（粘贴简历 → 知情同意 → AI 解析预填采纳）→ AI 补全空白字段采纳 → 步骤 4 预览打包 Prompt → 生成报告 → 手动编辑报告保存 → 改表单 → 报告黄条提示过期 → 重新生成强制确认 → 克隆（新 id/报告随拷）与删除（创作侧降级卡）语义正确 → 断网模拟下保存成功且 AI 动作给出明确文案 → 多标签页并发不丢数据 → `_personas.json` 截断整体拒载走 problems → 旧自由文本画像一键迁移。

## 十、与 create v2 / gather v2.1 / competitor v2 的并行契约（对方侧增补，开工时一并带上）

1. **create 侧**：三.4/九.3 画像契约由本栏目第三章满足；创作侧需实现 profileRef 写入、revision 升级提示、orphan 降级卡、内联→画像切换（该工作在 create M3）。画像 `bannedWords` 并入创作侧本地违禁词词库（create v2 模块 4）。platforms 词表扩充（channels/weibo）请 create/competitor 侧同步冻结。
2. **gather 侧**：无直接依赖——画像不进 `assets/`，不参与清理豁免；无需对方改动。
3. **content-outputs 侧**：assetCount `_` 过滤修正随本栏目落地（八.1）；`.dsh-output.json` schema 零变更。

## 附｜参考项目速查（2026-09-25 已逐一 GitHub API 核实：star / 最近推送 / license）

| 项目 | 借鉴点 | 红线 |
|---|---|---|
| [kwaroran/character-card-spec-v3](https://github.com/kwaroran/character-card-spec-v3)（MIT，111★，2024-07 定稿） | 字段三分法、`spec_version` 自描述（→ 本案 formatVersion + promptVersion）、CHARX zip 容器（P2 导出形态） | — |
| [malfoyslastname/character-card-spec-v2](https://github.com/malfoyslastname/character-card-spec-v2)（无 license，194★，停更） | V2 字段结构、creator_notes 不进 prompt 原则、extensions 永不销毁（编辑器保留不认识的键） | 仅读规范文本，不引代码 |
| [SillyTavern/SillyTavern](https://github.com/SillyTavern/SillyTavern)（AGPL-3.0，33.7k★，极活跃） | 角色卡管理/导入导出/lorebook 按预算注入设计 | AGPL：只看设计不复代码 |
| [letta-ai/letta](https://github.com/letta-ai/letta)（Apache-2.0，24.9k★，活跃） | 命名记忆块（persona/human）+ 字符预算上限 + read_only 红线块 + attach/detach 挂载（→ 4.6 注入规则） | — |
| [srbhr/Resume-Matcher](https://github.com/srbhr/Resume-Matcher)（Apache-2.0，28.5k★，极活跃） | 简历"本地解析 → LLM 结构化抽取 → 人工确认"链路（→ 模块 2） | — |
| [docling-project/docling](https://github.com/docling-project/docling)（MIT，IBM，67.9k★，极活跃） | P1 PDF 解析底座候选（本地文档 → 结构化/JSON） | 引库评估体积/ESM |
| [unclecode/crawl4ai](https://github.com/unclecode/crawl4ai)（Apache-2.0，84.2k★，活跃） | P2 官网抓取自托管底座（无需云 API、LLM 友好结构化输出） | — |
| [iniwap/AIWriteX](https://github.com/iniwap/AIWriteX)（Apache-2.0，2k★，活跃） | 中文"平台 × 人设 × 文风"数据组织 | 只借结构与 prompt 组织 |
| [ChatGPTNextWeb/NextChat](https://github.com/ChatGPTNextWeb/NextChat)（MIT，88.8k★，活跃） | mask 人设预设（name/context/roleSet）+ 内置/自定义两级来源 + 一键复制（→ 模块 1/5） | — |
| [f/prompts.chat](https://github.com/f/prompts.chat)（MIT，171k★） | 内置人设模板数据格式（标题/描述/prompt 三件套 + 分类标签） | — |
| [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl)（AGPL-3.0，184k★，极活跃） | P2 抓取 API 设计参照（scrape/extract 端点分离） | AGPL：只看 API 设计，禁闭源集成 |
| [xitanggg/open-resume](https://github.com/xitanggg/open-resume)（AGPL-3.0，8.9k★，停更） | 证明纯客户端简历解析可行（pdf.js + 启发式分段） | AGPL：只看设计 |
| ~~ai-persona-hub~~／~~character-editor~~ | **v1 误引，已删除**（前者 2★ 个人练手项目无 license；后者 130★ 无 license 停更 5 个月） | — |

> 评审门禁（自本版起执行，同 create v2）：提示词方案引用的开源项目必须附 GitHub 链接并经 API 核验（star / 活跃度 / license）；"名字像真的"不算存在。
