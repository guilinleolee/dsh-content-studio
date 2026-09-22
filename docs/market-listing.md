# dshmarket 上架材料（awesome-dsh-plugin）

> dshmarket 的插件目录来自策展仓库 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)。
> 向该仓库提一个 PR（一条条目），站点与市场一天内自动收录。**不要**向 dsh-market/dsh-market 仓库提插件条目。
>
> 前置条件（当前未完成，完成即可提交）：
> 1. 在 GitHub 创建公开仓库 `guilinleolee/dsh-content-studio`，push 本发行仓库
> 2. 创建一个 Release（tag 如 `v0.1.1-rc.2`），附 `pack.mjs` 产出的 zip（dist/dsh-content-studio-<version>.zip）
>    —— 市场安装源优先级：npm > **GitHub Release 预构建 tarball/zip** > 源码下载；预构建秒装且不需要构建脚本
> 3. 把下方条目中的仓库地址核对为实际地址；本文件占位链接即为该地址

## 条目草稿（提交时按目标仓库的 PR 模板/格式微调）

```markdown
## dsh-content-studio

**@guilinleolee/dsh-content-studio** — 内容创作工作台 for DeepSeek Harness.

- 仓库: https://github.com/guilinleolee/dsh-content-studio
- 安装: `dsh plugin --profile web add file:<clone>/packages/content-studio`
  （或市场一键安装，Release 附预构建包）
- 语言: 中文 / English

一站式自媒体内容生产线：

- **开始创作** — 双意图能力菜单：「做内容·要成品」（图文卡片 / 文章 / 视频 / 音频）
  与「做运营·要动作」（热点选题 / 策划定位 / 发布质检 / 数据复盘），
  15 个能力卡片带成熟度徽标（已验证/可用/需配置/接入中），
  点击复制结构化创作指令，粘贴到会话即开始
- **内容库** — 自动投影 `~/.dsh/outputs/`：一次创作一个目录（成品在根、素材在
  assets/、`.dsh-output.json` 唯一元数据），状态徽标（草稿/就绪/已发布）、
  成品与素材计数
- **内容日历** — 发布排期月历：点日添加、一键标记已发布、四色状态点，
  数据落在库根 `_schedule.json`（agent 也能直接读）

自包含 Remote 装配：插件自带全部服务端通信面，安装后无任何手工步骤。
```

## 提交清单

- [ ] GitHub 公开仓库已建并 push
- [ ] GitHub Release 已附 `pack.mjs` 产出的 zip
- [ ] zip 解压后 `packages/content-studio` 的 `dsh plugin add file:` 安装已本机复验
- [ ] PR 提交到 awesome-dsh-plugin/awesome-dsh-plugin（按其模板）
- [ ] 合并后次日：在已装 dshmarket 的 DSH 里搜 "content-studio" 确认收录
