---
layout: home
hero:
  name: Tern
  text: Tern 中文文档
  tagline: 插件 SDK 与 Surface Protocol 的简体中文指南
  actions:
    - theme: brand
      text: 开始阅读
      link: ./guides/getting-started.md
    - theme: alt
      text: 官方文档
      link: https://docs.stencil.so/tern/
features:
  - title: 扩展 Tern
    details: 使用 Luau 插件扩展窗格、命令、快捷键和窗口行为。
  - title: 构建原生界面
    details: 使用 Surface Protocol 让终端程序输出 Tern 原生界面。
  - title: 查阅完整 API
    details: 浏览插件 API、界面元素、样式和协议参考。
---

# Tern 插件 SDK

Tern 插件是用于扩展和修改 Tern 的 Luau 软件包。插件可以添加块类型（由 Lua 绘制的原生窗格）、将 shell 命令的输出读取为命令 Lens、响应窗格生命周期、添加命令面板命令和快捷键、覆盖内置命令、路由文件打开和链接、格式化标签栏、窗口标题和状态行、使用 CSS 重新设置应用样式，以及编写窗口布局脚本。

插件是一个包含 `plugin.toml` manifest（清单）和最多两个 Luau 入口文件的文件夹。将它放在 `<config>/plugins/` 下（或使用 `tern plugin link` 链接到该目录），即可在这台机器上更改 Tern 的行为。

```toml
schema = 1
id = "hello"
name = "Hello"
version = "0.1.0"
host = "host.luau"
window = "window.luau"
```

## 两个端

每个插件最多有两个端，各自在独立的 Luau VM 中运行：

| 端 | 入口 | 运行位置 | 能做什么 |
| --- | --- | --- | --- |
| **Host** | `host = "host.luau"` | 会话守护进程，或在没有守护进程时运行窗格的窗口 | 块、命令 Lens、窗格钩子、spawn 过滤器、向窗格写入 |
| **Window** | `window = "window.luau"` | 每个 Tern 窗口的 UI 线程 | 命令、快捷键、覆盖项、路由、窗口外观格式化器、Files 窗格按钮、CSS、布局、窗口事件 |

Host 端在窗格运行的位置运行，因此它定义的块就是普通窗格：所有连接到会话的窗口都会显示它，而且即使某个窗口退出，它也会继续运行。Window 端可以查看并更改一个窗口。请参阅[架构](concepts/architecture.md)。

## 选择入门路径

- **以原生方式读取命令输出：**[命令 Lens](guides/lenses.md)通过 manifest 中的 glob 模式匹配命令行，并将其输出转换为表格、树和徽标。
- **添加窗格类型：**[块](guides/blocks.md)在 Lua 中保存状态，使用 [`tern.ui`](guides/views.md) 渲染视图，并处理按键和点击。
- **更改 Tern 的行为：**[命令、按键和覆盖项](guides/commands.md)、[路由](guides/routing.md)、[窗口外观与样式](guides/chrome.md)和[布局](guides/layout.md)在 Window 端运行。
- **响应 shell 的行为：**[Host 钩子](guides/hooks.md)可以查看命令的启动和结束、目录和标题的更改，还可以重写 shell 的启动方式。
- **让任意程序绘制原生界面：**非插件的 CLI、TUI 或智能体可以在其 pty 上使用 [Surface Protocol](protocol/index.md)，从而获得相同的原生元素，并可将界面显示在输出流中或全屏显示。
- **查找节点类型或样式钩子：**[元素](elements/index.md)记录视图可包含的所有类型；[视图样式](styles/index.md)记录样式表可使用的所有类、属性和变量。
- **编写 Tern 脚本：**[脚本](scripts/index.md)可以逐条命令驱动窗口或无头运行，从打开窗格到截图。
- **重新着色或设置 Tern 样式：**[自定义主题](guides/themes.md)是一个可叠加到任意主题上的 CSS 文件，无需插件。
- **使用他人编写的插件：**Tern 没有官方注册表；[查找和分享插件](guides/distribution.md#查找和分享插件)介绍社区目录，并说明如何从 GitHub 仓库或其子目录安装插件。

从[快速开始](guides/getting-started.md)开始，然后阅读[示例插件](examples/index.md)：每个示例都是完整、贴近实际的插件。

## SDK {#the-sdk}

SDK 位于 [stencil-hq/tern-sdk](https://github.com/stencil-hq/tern-sdk) 仓库。仓库中的 `plugins/examples/` 包含[示例插件](examples/index.md)，每个插件都是一个可安装文件夹；`plugins/tern.d.luau` 则包含用于类型检查的定义；[Surface Protocol SDK](protocol/sdks.md)也位于该仓库中。

```sh
git clone https://github.com/stencil-hq/tern-sdk
```

仓库的 `tern.d.luau` 与本文档相符；`tern plugin types DIR` 会写出当前 Tern 自带的定义文件。

## 文档约定

代码使用 Tern 实际运行的 Luau：支持 `--!strict`，而 `tern plugin types DIR` 会生成 luau-lsp 所需的 `tern.d.luau` 声明。写作 `<config>` 和 `<state>` 的路径分别是 Tern 的配置目录和状态目录（[包与清单](concepts/packages.md#目录)）。[API 参考](reference/api.md)遵循运行时自带的 `tern.d.luau` 声明；如果指南与参考资料不一致，以参考资料为准。

官方文档的每个页面也以 Markdown 形式发布在其对应路径下，只需将 `.html` 替换为 `.md`（例如 `protocol/surfaces.md`、`index.md`），供智能体和其他读取文本的工具使用。

安装插件就意味着信任它，与 Neovim 或 WezTerm 插件一样：`tern` API 可以写入文件并启动进程。请参阅[信任与安全](concepts/security.md)。
