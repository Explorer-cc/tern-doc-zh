# 示例插件

在 [SDK](../index.md#the-sdk) 的 [`plugins/examples/`](https://github.com/stencil-hq/tern-sdk/tree/main/plugins/examples) 中附带七个完整插件。每个插件都端到端解决一个实际问题，并基于当前 API 编写，因此也可作为了解各部分如何协作的参考。每个页面都会说明设计决策，然后提供完整源代码。

## 示例

| 示例 | 功能 | 端 | 展示的界面能力 |
| --- | --- | --- | --- |
| [Terraform 计划](terraform.md)（`terraform`） | 将 `terraform plan` 和 `tofu plan` 显示为摘要徽标、诊断信息，以及按操作分组的资源；点击可复制地址 | Host | 使用 `match` glob 的命令 Lens、逐行解析、徽标色调、可折叠分区、通过 Lens `event` cx 触发点击操作、按角色限定的 manifest CSS |
| [审核队列](review-queue.md)（`review-queue`） | 每两分钟从 `gh` 轮询并列出等待你审查的拉取请求 | Host、Window | 带按键、事件和已保存状态的块；带超时的 `tern.process.run`；`tern.timer` 轮询；错误视图；通过 `cx:new_block` 打开块的命令面板命令和快捷键绑定 |
| [JSON 浏览器](jsonx.md)（`jsonx`） | 将 JSON 文件显示为可折叠树并复制 jq 路径 | Host、Window | 由 `files` glob 和启动参数驱动的文件块；经过大小检查后使用 `tern.fs.read`；列表选择和滚动；已保存状态；通过保存在 `tern.kv` 中的开关调用 `tern.route.open` |
| [长时间运行的命令](longrun.md)（`longrun`） | 慢速命令结束时显示 toast，并保留其历史记录 | Host、Window | `command_started`/`command_finished` host 钩子、toast、带实时计时的历史块、状态片段、供两端共享的模块 |
| [目录变量](dirvars.md)（`dirvars`） | 将 `.tern-env` 文件载入每个新 shell 的环境 | Host | `spawn` 过滤器及其时间限制、文件变更时提供提示的 `cwd` 钩子、解析器模块 |
| [项目工作区](workspaces.md)（`workspaces`） | 打开项目在 `.tern/workspace.json` 中描述的标签页和分屏 | Window | `cx.layout:tab` 布局、`window_start`、`new_tab` 覆盖、状态片段、manifest CSS |
| [画布仪表板](../reference/api-window.md#画布上下文-cx)（`canvas-demo`） | 保持持久化仪表板并提供 Refresh 操作 | Window | `cx.canvas` 所有权、副本读取、键控补丁，以及仅限所有者的 `canvas_action` 处理器 |

## 应该阅读哪个示例

| 你想要…… | 从这里开始 |
| --- | --- |
| 将命令输出转换为原生视图 | [Terraform 计划](terraform.md) |
| 构建带按键和已保存状态的交互式块 | [JSON 浏览器](jsonx.md)，然后阅读 [审核队列](review-queue.md) |
| 不使用 Host 工作线程显示持久化内容 | [画布仪表板](../reference/api-window.md#画布上下文-cx) |
| 在后台运行程序并保持视图为最新 | [审核队列](review-queue.md) |
| 接管某类文件的打开方式 | [JSON 浏览器](jsonx.md) |
| 对每个窗格中的命令作出响应 | [长时间运行的命令](longrun.md) |
| 更改新 shell 启动时的环境 | [目录变量](dirvars.md) |
| 安排标签页和窗格，或替换内置命令 | [项目工作区](workspaces.md) |

## 试用示例

每个示例都是一个插件目录，包含 `plugin.toml`、Luau 文件和 `README.md`。你可以直接从 [SDK](../index.md#the-sdk) 安装副本：

```sh
tern plugin install github.com/stencil-hq/tern-sdk/plugins/examples/jsonx
```

或者克隆 SDK 并链接该目录，这样每次保存其中的文件时，Tern 都会重新加载插件：

```sh
git clone https://github.com/stencil-hq/tern-sdk
tern plugin link tern-sdk/plugins/examples/jsonx
```

`tern plugin list` 会显示插件是否已加载；运行 `tern plugin unlink jsonx` 或 `tern plugin remove jsonx` 可将其移除。每个示例都以 `--!strict` 开头，并根据 `tern plugin types DIR` 生成的定义文件进行类型检查；luau-lsp 设置请参阅[入门指南](../guides/getting-started.md)。

在 SDK 之外编写的插件也可从自己的仓库以相同方式安装；社区目录请参阅[查找和分享插件](../guides/distribution.md#查找和分享插件)。
