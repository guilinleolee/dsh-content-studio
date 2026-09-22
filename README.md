# @guilinleolee/dsh-content-studio — 发行仓库

内容创作工作台（Content Studio）for DeepSeek Harness 的**独立发行仓库**。三条命令为你的 DSH web profile 装上完整的内容创作功能：侧栏入口、双意图能力菜单（做内容/做运营）、内容库（`~/.dsh/outputs/` 的作品投影）、内容日历（`_schedule.json` 发布排期）。

## 安装（接收方）

```sh
git clone <本仓库地址> D:/dsh-content-studio
dsh plugin --profile web add file:D:/dsh-content-studio/packages/content-studio
dsh web
```

一条命令装齐三个包：前端工作台插件 + `content-outputs` / `content-schedule` 两个 host Remote 网关（studio 的 `dsh.bundle.patch` insert 清单自动带上它们）。重启后侧栏左下角出现 ✨「内容创作」入口。

> 需要 DSH web profile（`pnpm dsh web` 可跑的环境）。所有 `@deepseek-ai/*` 依赖由宿主 DSH 运行时提供，无需单独安装。

## 维护者（发布方）

本仓库不直接构建。源码与构建在 deepseek-harness 检出中完成：

```sh
cd D:/deepseek-harness
pnpm run build                     # 构建三包（lib/ 产物）
node D:/dsh-content-studio/sync.mjs D:/deepseek-harness
cd D:/dsh-content-studio && git add -A && git commit -m "release: <notes>"
```

`sync.mjs` 负责拷贝构建产物 + 源码 + 文档，并把 `@deepseek-ai/dsh-client-ui-content-studio|dsh-content-outputs|dsh-content-schedule` 统一改名为 `@guilinleolee/dsh-content-studio|dsh-content-outputs|dsh-content-schedule`，同时把 studio 对两个网关的依赖转成相对 `file:` 引用（同一克隆内自解析）。

## 包结构

| 包 | 角色 |
|---|---|
| `packages/content-studio` | 前端插件：侧栏入口 + 全帧工作台（自挂载自己的 Remote 贡献） |
| `packages/content-outputs` | host 网关：`contentOutputs/list`，产物库只读投影 |
| `packages/content-schedule` | host 网关：`contentSchedule/list|put|delete`，发布日历 |

## 后续发布到 npm（可选）

仓库形态已与 npm 发布兼容：三包元数据完整（exports/files/dsh 清单），届时 `pnpm publish --access public` 并把 studio 的两个 `file:` 依赖改为版本号即可；接收方安装命令变为 `dsh plugin --profile web add @guilinleolee/dsh-content-studio`。

## License

MIT
