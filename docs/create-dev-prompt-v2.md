# DSH 内容创作插件｜【创作】（create 视图）开发提示词 v2（调研修订版）

> 用途：将现有 create 视图升级为完整创作工作台：选题上下文、多类型模板生成、二创改写、版本管理、素材引用、辅助工具、草稿成品与跨栏目回流。改哪里、怎么改、何为完成，以本文为准；本文与现实代码冲突时，停下报告，不要自行发明机制。
> 修订：v2（2026-09-25）——依调研（GitHub 开源对标逐项 API 核验 + 架构审查）合入八项修订。v1 引用的 4 个参考项目核验结论：1 保留、1 改标注闭源、2 删除（名称不存在）；替换清单见文末附录。

## 〇、与 v1 的差异（已锁定决策）

1. **入口解耦**：空白新建为兜底主路径，粘贴选题描述为次入口，选题库推送降为增强路径（选题库上线前隐藏）。修复 v1 把唯一主入口绑在尚不存在的选题库上的阻塞（与对标账号评审"手动兜底为主路径"同款教训）。
2. **版本快照迁出 assets 扫描面，落 `assets/_create.json` sidecar**（`_` 前缀，scanner 隐身，与 gather `_gather.json` 对称）。v1"版本存 assets"会被素材选择器污染，且受 gather 清理策略误清。版本全文内嵌 sidecar `versions[]`（上限 30 + 钉住），自包含、不依赖素材存活。
   说明：评审初稿曾建议内嵌 `.dsh-output.json`；因选题库 v2 已确认该文件是 schema 严格 + `formatVersion` 拒载门控的作品元数据（选题库亦因此不写它），重数据一律走 sidecar，`.dsh-output.json` 只追加作品级登记字段。
3. **发布 = 复制 + 登记**，替换 v1"移动文件 + 更新元数据"的两步无事务写法（任一步失败即永久不一致、重名行为未定义）；作品库改登记制：只认元数据 `status: "final"` 条目，不扫描主题根目录。
4. **AI 全量降级与配额设计**：本栏目是插件首个 AI 功能。上游 429/无额度是常态（gather v2.1 同款前置事实）：显式触发、可失败、可重试、批量串行、单套失败不连坐；配额网关网关侧收口，作为 freemium 分界。
5. **自定义模板落盘** `~/.dsh/outputs/_templates.json`（经网关），推翻 v1"只存浏览器本地"；localStorage 仅作编辑中未保存内容的缓冲。依据：对标账号评审既定结论"跨端状态必须收进磁盘元数据"。
6. **违禁词预检 = 本地词库离线扫描**，不做 AI 扫描（确定、免费、毫秒级、不占配额）；AI 语义审查列为后续增强。
7. **四维打分改为"AI 评估"**：独立轻量调用，输出四维理由 + 粗档（优/良/中/弱），随 model 与 promptVersion 落盘；弃用"模型自评 0-10 分"的伪精确呈现（自偏好、不可复现）。
8. **回流走网关幂等**：选题状态经 `contentTopics.put`（done 幂等 no-op），排期经 `contentSchedule.put`；禁止直写 `_schedule.json` 与 `_topics.json`（与选题库同款红线）。选题库未上线期间只记 `pendingSync` 意图，不阻塞定稿。

## 一、前置事实（开发前必读）

- 真源码在 harness 检出三包（同 gather/选题库）：前端 `packages/client/ui-content-studio/`，网关 `packages/creation/content-outputs/`（作品库投影）、`packages/creation/content-schedule/`（排期读写）。`D:\dsh-content-studio` 是发行仓库（`sync.mjs` 拷贝改名），禁改其 `dist/` 与 zip；发布流程照旧（build → sync → release）。本栏目开工范围新增：AI 网关（五.1）与模板 store 写面（二.4）。
- create 视图已注册于 `NAV_ITEMS`（现导航 workbench/chat/benchmark/topics/library/create/accounts/persona）。**开工前核对 create 视图现状**（可能仍为提示词卡页），本文按"在位升级"编写；若视图不存在，停下报告。
- 插件当前零 AI 调用、零网络调用；本栏目首次引入 AI，全部调用必须经网关收口（五.1），不新增前端直连。
- 选题库 v2 已定稿（`docs/topic-bank-dev-prompt-v2.md`）：`_topics.json` 全局单文件、`contentTopics` 网关（list/put/delete，`withFileLock` + `writeFileAtomic`）、选题五态 idea/todo/creating/done/shelved、`onNavigate(view, params?)` 带参跳转（选题库期实现）、【开始创作】= 跳 create 视图并预填标题/一句话简介/描述。
- gather v2.1 已定稿（`docs/gather-dev-prompt-v2.1.md`）：素材 `id` 为稳定 UUID；素材正文落 `assets/`、素材元数据落 `assets/_gather.json`；限额清理已豁免收藏/待创作素材；AI 功能必须显式触发、可失败、可重试。
- outputs scanner 排除 `.`/`_` 前缀条目（`content-outputs/src/scan.ts`）；`.dsh-output.json` `formatVersion !== 0` 整体拒载；pre-release（formatVersion 0）schema 可一次性定型、无兼容承诺。
- 运行环境 Windows 本机：网关侧文件整体替换必须容忍杀软/索引器对刚关闭文件的瞬时句柄占用（重试退避，照 gather 五.5）；数据目录不进 OneDrive 等同步文件夹。
- UI 复用既有模式：卡片网格、列表行、加载/错误/空三态 + `problems` 告警条、`--dsw-alias-*` 设计令牌；侧边详情面板若选题库/gather 已建立布局模式则复用不重写；**新视图样式拆独立 `create.module.css`**（主 CSS 不再堆行）。

## 二、存储规范

1. 主题三层落盘（目录结构不变，`~/.dsh/outputs/<主题>/`）：
   - 当前稿：`assets/<内容ID>.md`（内容ID = UUID，branded）；
   - 创作状态 sidecar：`assets/_create.json`（下划线隐身，不进素材选择器、不进作品库）；
   - 作品登记：`<主题>/.dsh-output.json` 追加字段（见二.3）。
2. `_create.json` schema（`formatVersion: 0`，一次性定型）：

```jsonc
{
  "formatVersion": 0,
  "contentId": "uuid",
  "contentType": "公众号长文",            // 六类之一；切换类型产生 trigger:"retarget" 新版本
  "currentVersion": 3,
  "versions": [                          // 按 v 倒序；上限 30，pinned 不计淘汰
    {
      "v": 3,
      "ts": "ISO",
      "pinned": false,
      "trigger": "ai-generate | ai-generate#2/3 | manual-save | rewrite:精简 | rewrite:去AI味-轻度 | retarget",
      "words": 1830,
      "content": "全文快照",              // 自包含，不依赖素材存活
      "templateRef": { "id": "...", "kind": "builtin|custom", "revision": 1 },
      "profileRef": { "mode": "profile|inline", "id": null, "name": null,
                      "revision": null, "digest": "≤200字风格摘要" },
      "evaluation": { "model": "...", "promptVersion": "...", "evaluatedAt": "ISO",
                      "dims": { "吸引力": { "grade": "良", "reason": "一句话" } },
                      "grade": "良" } | null
    }
  ],
  "topicRef": { "topicId": "uuid|null", "title": "...",
                "syncState": "linked | completed | pendingSync | orphan" },
  "sources": [ { "kind": "gather|benchmark|image", "refId": "素材UUID|null",
                 "path": "assets/...", "hash": "sha256前16位", "title": "...",
                 "addedAt": "ISO", "status": "ok|missing" } ],
  "stats": { "reads": null, "likes": null, "collects": null }   // 预留发布后效果数据手动回填
}
```

3. `.dsh-output.json` 追加作品级字段：`contentType`、`status: "draft"|"final"`、`currentPath`、`currentVersion`、`publishedPath`、`publishedAt`、`publishedVersion`。**开工前核对 content-outputs 对该文件的严格校验是否拒未知字段**：拒则在本栏目开工范围内同步适配投影（既有消费字段语义不变）；`formatVersion` 保持 0。同主题多类型成品并存 P2 再扩 `contents[]`，本期单内容。
4. 自定义模板：全局 `~/.dsh/outputs/_templates.json`（`formatVersion: 0`；items[]：id、标题、适配类型、占位符变量段、正文、revision、updatedAt），读写经网关（样板照 `contentTopics`：`withFileLock` + `writeFileAtomic` + 拒载 + problems）。内置六类模板随插件版本只读。localStorage 仅存编辑中未保存内容。
5. 排期只走 `contentSchedule` 网关（put/delete）；禁止直改 `_schedule.json`、禁止扩 `ScheduleItem` schema。
6. 前端视图配置（面板开合、编辑器偏好等）localStorage 前缀 `dsh-content-studio.create.`，配置对象带 `version` 字段，加载跑归一化迁移，识别不了整体回默认（同选题库二.3）。

## 三、入口与跨栏目契约

1. **三入口**（①② 为 P0）：
   - ① 空白新建（**兜底主路径**）：手填标题/类型/受众/差异化要点，即开即写；
   - ② 粘贴选题描述：自动解析为上下文草稿（LLM 解析走 AI 网关，失败则原文整段作为描述，不阻塞）；
   - ③ 选题库推送（增强路径）：消费 `onNavigate('create', { topicId, prefill })`，prefill 含标题/一句话简介/描述；**选题库上线前隐藏该入口**。
2. 选题上下文统一为可选对象（来源标记 topic/manual/paste）。无上下文时左侧面板展示可编辑的简化表单，不空态报错。
3. `topicRef.syncState` 语义：`linked`（选题存在，创作中）/ `completed`（已回流 done）/ `pendingSync`（选题库未上线或网关不可用，仅本地记录）/ `orphan`（关联选题已删除，面板降级提示，可解除关联）。
4. 画像联动（P2，M3）：画像栏目未上线前，**内联粘贴风格描述为等效主路径**（AI 同样遵循其语气/用词约束）。画像栏目立项时须满足契约：稳定 id、风格描述全文、revision hash、经其网关读取。`profileRef` 记 id + revision + ≤200 字摘要，保证历史版本可溯源"当时用什么风格生成"。无画像栏目时下拉隐藏而非禁用报错。

## 四、模块清单与本期范围

### 模块 1｜创作入口 & 上下文面板（P0）

- 三入口见三.1；进入后左侧上下文面板展示：标题、目标人群、差异化要点（可编辑）、参考素材列表（可增删，写 `sources[]`）。
- 内容类型六选一（切换即产生 `retarget` 新版本，不覆盖旧稿）：文案二创、公众号长文、图文笔记（小红书/知乎）、短视频脚本、口播稿、商品详情页。
- 自定义模板管理（P1）：增删改 + 试运行入口，持久化见二.4。
- 画像下拉（P2，M3）：见三.4。

### 模块 2｜生成 & 二创编辑区

- 一键生成（P0）：上下文 + 模板 + 风格 + 参考素材 → 单套初稿；已有稿件时默认追加新版本而非覆盖。
- 多版本批量（P1，M2）：默认 1 套；【生成 3 套方案】为增值档。**短类型**（图文/标题类）单请求产 3 套；**长类型**（长文/脚本/口播/详情页）逐套串行请求、并排卡片渐进填充、单套失败独立重试不连坐。429/余额不足自动降级"先生成 1 套"并明示。
- AI 评估（P1，随批量）：每套独立轻量调用，分步 rubric 评分法（参照 deepeval/promptfoo 的 prompt 结构，不引框架），输出四维（吸引力/可读性/差异化/人群匹配度）理由 + 粗档，落盘 `versions[].evaluation`；本地确定性指标（字数/段长/标题长度）免 AI 并列展示；评估失败不阻塞正文展示。
- 二创子任务（选区操作，交互统一为**选区 → AI → diff 预览 → 应用/拒绝**，参照 obsidian-smart-composer；应用即强制落版）：
  - P0 五项：精简压缩、扩写丰富、切换风格（专业/亲切/硬核/故事化/简短有力）、换受众视角、提取金句/标题备选/要点；
  - P1：开头钩子优化、结尾引导优化；
  - P1：**去 AI 味两档**——轻度只做词汇句式调整（禁改事实与结构，字数浮动 ±10%）；深度允许重构叙事（换开头/改视角/口语化/补细节），强制 diff 预览 + 自动落版兜底。规则源内化 blader/humanizer 的 MIT 规则清单，自补中文 AI 痕迹特征（"综上所述""值得注意的是"、四字堆叠等），固定 prompt 模板 + promptVersion。
- 版本管理（P0）：schema 见二.2。连续手动编辑按 5 分钟窗口合并快照；生成/二创各自强制落版；版本列表支持切换/对比/恢复/钉住，达上限淘汰最旧未钉住项。
- Markdown 编辑器（P0）：现有编辑器升级，或选型 vditor / cherry-markdown（引库须 MIT 且说明体积与 ESM 理由）；支持从主题 assets 选图插入（跳过 `_` 前缀文件）。

### 模块 3｜素材引用面板（P1，M2）

- 从主题 assets 挑选 gather 素材原文、对标拆解报告、图片，仅引用不复制：写 `sources[]`（path + hash + refId）。
- 打开溯源按存在性校验：失效显示"素材已清理"降级卡片；版本正文自包含，内容不受影响。
- 清理豁免契约：与 gather 定约"被创作 `sources[]` 引用的素材豁免清理"（九.1）；定约落地前创作侧按可失效设计。

### 模块 4｜辅助 AI 工具

- **违禁词预检（P0，M1）**：本地词库离线扫描——konsheng/Sensitive-lexicon（MIT）筛提 + 自建广告法极限词子集（"最/第一/国家级/绝无仅有"类），JSON 随插件打包、按类别分文件、可独立更新；命中高亮 + 类别 + 修改建议；仅提示不拦截，页面保留免责声明。前端 Aho-Corasick 匹配，数万词条毫秒级。不占 AI 配额。AI 语义审查（变相绝对化/暗示性用语）P2 增强。
- **平台话题标签（P1 规则版 / P2 AI 版）**：规则版 = 本地标签库 + 平台格式模板（小红书 `#标签#` 空格分隔、公众号文末话题、知乎话题绑定），挑选后一键插入文末。开源域无可对标项目，自建规则。
- **SEO & GEO 关键词（P2，M3 末，排期紧则砍）**：基础版 = 关键词提取 + 布局位置建议 + 目标区域本地化建议；prompt 方法论参照 open-seo-mcp-skills；不接真实 SERP 数据。
- 标题生成器（P1）：批量备选 + AI 评估粗档。关键词提取（P0 规则版：词频/TF-IDF 级，AI 版 P2）。阅读时长预估（P0，本地计算：公众号按 400 字/分钟、口播稿按 240 字/分钟）。以上本地功能一律不计费。

### 模块 5｜草稿 & 成品管理（P0）

- 保存草稿：写当前稿 + 落版（debounce 合并）；状态标记 draft。
- **发布（复制 + 登记三步）**：① 定稿以 `<slug>-<内容ID前8位>.md` 写入主题根，重名报错由用户改名或确认覆盖；② 成功后更新 `.dsh-output.json`：`status:"final"`、`publishedPath/publishedAt/publishedVersion`；③ assets 当前稿保留为工作副本。顺序先文件后元数据；元数据写失败 UI 报错并提供"重试登记"（文件已存在则跳过复制）。
- 状态机：`draft → final`。final 后再编辑产生新版本，`currentVersion > publishedVersion` 时作品库与面板提示"有更新未发布"，再发布走覆盖确认。选题状态不因改稿自动回退（done 为终态）；面板提供"重新打开选题"显式动作（经 `contentTopics.put` → creating，P2）。
- 导出（P0）：Markdown/纯文本写 assets（经网关，路径校验限主题目录内）；按平台格式化复制到剪贴板 P2 预留。

### 模块 6｜跨栏目回流（P1，M3 与选题库联调）

- 定稿回流两个独立写，均经网关、均幂等、均不阻塞定稿主流程：
  1. 选题状态：`contentTopics.put` 条件写 status → `done`（已是 done 则 no-op 返回成功）；`syncState: linked → completed`。
  2. 排期推进：若选题 `scheduleItemId` 存在，`contentSchedule.put` 将 ScheduleItem status 合法推进至 `published`（已 published 则 no-op）。
- 选题库未上线：只写本地 `pendingSync`；上线后打开面板时对账补写，并提供手动"同步"按钮。回流失败 toast + 面板常驻重试入口，不阻塞、不静默。
- 禁止直写 `_schedule.json`、禁止直写 `_topics.json`，一律走对应网关。

## 五、AI 调用与提示词架构

1. **网关收口（P0）**：新增 AI 网关（独立包或既有网关扩展，开工前按 harness LLM 能力接法定方案），Remote 暴露 generate / rewrite / evaluate 三类方法，作为全部 AI 调用（生成、二创、评估、去AI味、描述解析、标签 AI 版）唯一出口；前端零直连。
2. **失败语义（P0）**：显式触发、可取消；指数退避重试（照 gather 五.3）；429/额度不足给明确文案 + 稍后重试；失败不产生半截版本（生成成功才落版）。
3. **配额网关（P1）**：网关侧统一计数。免费档：日 N 次生成 + M 次二创；3 套批量与 AI 评估为付费档；本地功能不计费。具体额度数值运营可配，本提示词不锁定。
4. **提示词分层**：系统层（输出契约 + 安全约束，内置固定）→ 平台规范层（六类内置模板）→ 风格层（画像/内联）→ 用户模板变量段。全部内置 prompt 带 `promptVersion`，随 `templateRef`/`evaluation` 落盘可溯源。
5. **输出契约分流**：短结构化类型（脚本/图文/详情页/标题/标签）用 JSON 契约（title/分镜/标签各归其位）；长文（公众号/口播）用 Markdown + 约定标题行，避免长文 JSON 截断与转义错误。
6. **自定义模板安全**：占位符白名单（`{{topic.title}}` `{{topic.description}}` `{{materials}}` `{{profile}}` `{{type}}` 等），未知占位符保存与运行时均报错（fail loud）；模板编辑器带试运行入口。

## 六、接口与交互约定

1. 文件读写全部经网关收口，不直连 fs，不新增独立文件服务。
2. 元数据写入（`_create.json` / `_templates.json` / `.dsh-output.json`）收敛单一序列化入口（插件内单例队列）+ `withFileLock` + `writeFileAtomic`（Windows 重试退避）；写前校验 mtime/内容哈希，不匹配则重读合并重试，无法合并时提示"另一标签页已修改，请刷新"。
3. 路径安全：元数据中的文件路径写入与读取均校验落在主题目录（或 outputs 根）内，拒绝路径穿越，一处 gate。
4. malformed 元数据不隐藏项目：拒载与坏记录走 `problems` 告警条点名（照 ContentLibrary 模式）。
5. UI 复用既有三态/复制反馈/侧边面板模式与 `--dsw-alias-*` 令牌；新样式拆 `create.module.css`。
6. 带参跳转消费选题库 `onNavigate('create', params)` 契约；gather 素材的页内跳转待 gather 导航就绪后接通，本期 `sources[]` 仅记录。

## 七、开发限制（禁止操作）

1. 不修改 outputs 目录结构与 scanner `_`/`.` 隐身规则；`.dsh-output.json` 仅追加二.3 所列字段，`formatVersion` 保持 0，投影适配在开工范围内。
2. 不直改 `_schedule.json`、不扩 `ScheduleItem` schema、不直写 `_topics.json`——排期与选题状态一律走对应网关。
3. AI 调用不得绕过网关直连；禁止任何前端直发网络请求。
4. 引用开源项目以附录为准；GPL 项目只看设计不复代码；引 npm 库须 MIT/Apache 且单独说明体积与 ESM 理由。
5. 源码改动全部在 harness 侧包内；禁改发行仓库 `dist`；版本号在发行仓库 `packages/content-studio/package.json` 维护。
6. 测试：`_create.json` 与模板 store 单测（put/拒载/坏记录/problems/版本淘汰与钉住）、违禁词匹配纯函数单测、快照合并窗口纯函数单测、locales 钉住测试；用户可见输出变化按仓库测试政策补 keyless snapshot（fixtures 须 macOS/Linux 可回放）。

## 八、里程碑与交付

- **M1（本期交付）主闭环**：三入口（①②）、一键生成单套、核心二创五项、diff 预览、Markdown 编辑器、草稿 + 版本（sidecar）、发布复制 + 登记、导出、违禁词本地预检、阅读时长、AI 网关最小版（generate/rewrite + 失败语义）。M1 完成即不依赖任何未上线栏目的可独立上线产品。
- **M2 批量与合规**：3 套批量（串行降级）、AI 评估落盘、去 AI 味两档、标题生成器、素材引用面板（含豁免定约）、话题标签规则版、配额网关。
- **M3 联动与增值**：选题库回流联调（幂等 + pendingSync 对账）、画像联动（含内联兜底转正）、SEO GEO 基础版、话题标签 AI 版、平台格式化导出、stats 回填。
- 6 条新增需求落位：违禁词 = M1；批量 / 评估 / 去AI味 / 标签规则版 = M2；标签 AI 版 / 画像 / SEO GEO = M3。
- 验收路径（M1）：空白新建 → 生成 → 二创 diff 应用 → 版本回滚 → 违禁词高亮 → 保存草稿 → 发布登记 → 作品库可见 → 改稿提示"有更新未发布" → 再发布覆盖确认。断网/429 模拟下生成失败有明确文案且不产生脏版本；多标签页并发保存不丢元数据；`_create.json` 截断时整体拒载走 problems，不静默丢数据。

## 九、与 gather v2.1 / 选题库 v2 的并行契约（对方侧增补，开工时一并带上）

1. **gather 侧**：清理策略增补"被创作引用豁免"——`assets/_create.json` 的 `sources[].path + hash` 命中的素材跳过清理（与收藏/待创作豁免并列）；gather 素材 id 稳定 UUID（已定稿，作为 `sources[].refId`）。
2. **选题库侧**：【开始创作】带参契约以选题库 v2 模块 2 为准，创作侧按该契约消费；回流 `contentTopics.put` 的幂等语义（done 终态 no-op）请选题库侧在 store 单测中钉住。
3. **画像侧（未立项）**：画像栏目立项时须满足三.4 契约（稳定 id + 风格全文 + revision + 网关读取），否则创作侧永久保持内联主路径。

## 附｜参考项目速查（2026-09-25 已逐一 gh api 核实：star / 最近推送 / license）

| 项目 | 借鉴点 | 红线 |
|---|---|---|
| [blader/humanizer](https://github.com/blader/humanizer)（MIT，51.8k★，0906 推送） | 去AI味两档规则清单（AI 套话/排比三连/"不是X而是Y"句式）；与本文轻度/深度分档同构 | 规则文本内化保留 MIT 署名；需自补中文痕迹特征 |
| [iniwap/AIWriteX](https://github.com/iniwap/AIWriteX)（Apache-2.0，2k★，活跃） | 平台规范层×赛道层×风格层 prompt 分层；中文多平台适配 | 只借 prompt 结构与 workflow，不搬其服务端成分 |
| [confident-ai/deepeval](https://github.com/confident-ai/deepeval)（Apache-2.0，18.4k★）／[promptfoo/promptfoo](https://github.com/promptfoo/promptfoo)（MIT，25.4k★） | G-Eval 分步 rubric 评分法；固定 JSON 输出 + 逐维依据 | Node/Python 框架不引入，只抄 prompt 结构 |
| [nhaouari/obsidian-textgenerator-plugin](https://github.com/nhaouari/obsidian-textgenerator-plugin)（MIT，2k★） | 模板变量占位 + 多 provider 生成架构（v1 保留项） | — |
| [ziguishian/xhs-visual-director-skill](https://github.com/ziguishian/xhs-visual-director-skill)（MIT，1.4k★） | 图文笔记逐页结构 + 每页配图提示词 + 自检清单输出协议 | — |
| [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo)（MIT，125.5k★） | 短视频脚本 hook 前3秒 → 分镜要点 → CTA 分段结构 | — |
| [konsheng/Sensitive-lexicon](https://github.com/konsheng/Sensitive-lexicon)（MIT，4.2k★） | 违禁词库直接打包（筛提子集，按类别分文件） | — |
| [houbb/sensitive-word](https://github.com/houbb/sensitive-word)（Apache-2.0，6.1k★） | 词库分类分级、命中分级提示设计 | Java 实现不引码，借设计 |
| [saga-soft/novelWriter](https://github.com/saga-soft/novelWriter)（GPL-3.0，3.1k★） | 快照元数据字段集（ts/字数/hash/触发方式）；时间间隔去重 + 保留 N 份策略 | GPL：只看设计不复代码 |
| [glowingjade/obsidian-smart-composer](https://github.com/glowingjade/obsidian-smart-composer)（MIT，2.3k★） | 选区 → AI → diff 预览 → 应用/拒绝交互；素材 mention 机制 | — |
| [theJayTea/WritingTools](https://github.com/theJayTea/WritingTools)（GPL-3.0，2.5k★） | 二创动作菜单分类法 | GPL：只看交互 |
| [Vanessa219/vditor](https://github.com/Vanessa219/vditor)（MIT，11.4k★）／[Tencent/cherry-markdown](https://github.com/Tencent/cherry-markdown)（NOASSERTION，4.9k★） | Markdown 编辑器选型（替换 v1 误引的 Markdown Editor Enhanced） | cherry-markdown license 须单独评审；引库评估体积/ESM |
| [Ryze-AI-Adgent/open-seo-mcp-skills](https://github.com/Ryze-AI-Adgent/open-seo-mcp-skills)（MIT，1.5k★） | 关键词研究 prompt 流程（种子词→长尾→意图分类） | 服务端/MCP 部分全裁，只取方法论 |
| [coollabsio/shoutrrr](https://github.com/coollabsio/shoutrrr)（Apache-2.0，379★） | Typefully 开源替代的形态参考 | 仅形态，不引代码 |
| Typefully AI（闭源 SaaS） | 产品形态对标（v1 保留项，本版改标注闭源） | 无可引代码 |
| 话题标签生成 | 开源域无可对标项目（最高 47★ 且停更），自建平台格式规则 | — |
| ~~BMO AI Content Studio~~／~~Markdown Editor Enhanced~~ | **v1 误引，已删除**（前者名称不存在，实为 BMO Chatbot 且停更 1 年；后者无有规模同名项目） | — |

> 评审门禁（自本版起执行）：提示词方案引用的开源项目必须附 GitHub 链接并经 API 核验（star / 活跃度 / license）；"名字像真的"不算存在。
