# 术语表

本页按术语英文原词的字母顺序，列出这些文档使用的术语。每个条目说明该术语在插件 SDK 中的含义，并链接到深入介绍它的位置。

| 术语 | 含义 | 参见 |
| --- | --- | --- |
| 操作（Action） | 按键映射可以运行的名称：内置命令 id（`new_tab`）、仅限按键映射的操作（`palette`、`goto_tab:3`）、视图按键组合（`editor.toggle_comment`）或插件操作（`plugin.<plugin>.<id>`）。`tern.bind` 将按键组合绑定到操作；状态栏片段会在被点击时运行一个操作 | [内置操作](actions.md) |
| `available` | 窗口命令的可选谓词，命令面板每次列出行时都会调用；返回假值会隐藏该行。预算 4 ms | [Window API](api-window.md#tern-command) |
| 块（Block） | 程序为 Lua 的窗格：由插件的 Host 端定义的块类型，可由命令面板、“Open with”、路由决策、`cx:new_block` 或工作区启动。它像 shell 一样位于守护进程的窗格表中，并通过 Surface Protocol 绘制 | [块](../guides/blocks.md)、[Host API](api-host.md#tern-block-define) |
| 块上下文（Block cx） | 每个块处理器都会收到的 `cx`：包含副作用，外加 `pane`、`cwd`、`cols`、`rows`、`render`、`save`、`exit`、`frame`、`blob` | [Host API](api-host.md#块上下文-cx) |
| 块类型（Block type） | 一条 `[[blocks]]` 声明，加上实现它的 `tern.block.define` | [Manifest 参考](manifest.md#blocks) |
| 预算（Budget） | 一次进入 Lua 的调用的时间上限：Host 端为 2 s，窗口中为 50 ms，chrome 格式化器和 `available` 为 4 ms。超出上限的调用会失败，其钩子会暂停 | [运行时、预算与 JIT](../concepts/runtime.md#预算) |
| 目录（Catalog） | 主机上的插件所提供内容的数据形式：每个插件的 id、name、version、status、块类型、Lens 规则和拼接后的样式，外加该文件夹的问题。主机会把它发送给每个窗口、iOS 和 Web 标签页，这样它们无需运行 Lua 就能列出块类型并作出 Lens 认领 | [架构](../concepts/architecture.md#目录) |
| 按键组合（Chord） | 按 `tern.bind` 和 `keys` 的写法表示的一个按键组合（`cmd+shift+h`），或由若干按键组合组成的序列（`ctrl+a>c`） | [内置操作](actions.md#按键组合) |
| Chrome | 窗格周围的窗口部分：标签页标题、窗口标题和状态栏。插件通过格式化器和 CSS 塑造它 | [Chrome 与样式](../guides/chrome.md) |
| 认领（Claim） | Lens 接管一条命令行的决定，仅由清单的 `match` glob 作出：按 id 顺序取第一个有 glob 匹配 `program args…` 的 Ready 插件，再取该插件中按清单顺序第一个 glob 匹配的 Lens。认领是声明式的，因此每个副本都会得出相同的决定 | [Manifest 参考](manifest.md#匹配模式) |
| 命令（Command） | 命令面板中的一行。内置命令有 id（`split_right`）；插件使用 `tern.command` 注册自己的命令，名称为 `plugin.<plugin>.<id>` | [Window API](api-window.md#tern-command)、[内置操作](actions.md#命令) |
| 上下文（Context） | VM 运行的是哪一个部分：`tern.context` 为 `"host"` 或 `"window"`。每个上下文都有各自的成员 | [API 参考](api.md#上下文) |
| cx | 传给处理器的处理器上下文对象：根据调用方的不同，是副作用上下文、块上下文或 Window 上下文。Window `cx` 仅在收到它的那次调用期间有效 | [API 参考](api.md#上下文) |
| 守护进程（Daemon） | 即会话守护进程：每位用户各有一个的进程，拥有本机的窗格，并运行本机的各个 Host 端。窗口连接到它 | [架构](../concepts/architecture.md#每个部分的运行位置) |
| 数据文件夹（Data folder） | `<state>/plugin-data/<id>/`，由插件的两个部分共用：对应 `tern.plugin.data` 和 `TERN_PLUGIN_DATA`，是 `kv.json` 的所在处 | [包与清单](../concepts/packages.md#数据文件夹) |
| 决策（Decision） | `tern.route.open` 或 `tern.route.link` 的处理器为接管一次打开或一个链接而返回的值：`{block = kind, args?}`、`{url = …}`、`{path = …, how?}` 或 `{handled = true}`；返回 `nil` 表示放行 | [Window API](api-window.md#路由决策) |
| Disabled | 一种插件状态：被 `plugins` 或 `plugins_disabled` 设置关闭。它不加载任何内容，也不认领任何内容 | [包与清单](../concepts/packages.md#问题与状态) |
| Dock, layer, main | 块视图的三个区域：`main` 是块的区域，`dock` 是其下方的条带，`layer` 在其上方 | [Host API](api-host.md#视图模型) |
| 副作用（Effect） | 主机上的 Lua 向显示某个窗格的窗口提出的请求：一条提示、一次打开或一次剪贴板复制。副作用以数据形式从主机传送到窗口 | [Host API](api-host.md#副作用上下文-cx) |
| 副作用上下文（Effect cx） | Lens 的 `open` 和 `event` 以及 Host 事件处理器所获得的 `cx`；它只有 `toast`、`open` 和 `copy` | [Host API](api-host.md#副作用上下文-cx) |
| 入口（Entry） | 某个上下文在加载时运行的 Luau 文件：即清单的 `host` 或 `window` | [Manifest 参考](manifest.md#host、window) |
| 事件（Event） | `tern.on` 订阅的通知。Host 事件（`command_finished`、`pane_exited` 等）和窗口事件（`focus`、`tab_created` 等）是相互独立的集合 | [事件](events.md) |
| Failed | 一种插件状态：其入口在加载时抛出错误或预算超限，或者有已声明的块或 Lens 未定义 | [错误](errors.md#加载失败) |
| 格式化器（Formatter） | 计算 chrome 文本的纯窗口函数：`tern.chrome.tab_title`、`window_title` 或 `status`。它接收一个小型输入表，没有 `cx`，预算为 4 ms；其结果按输入缓存，直到调用 `tern.chrome.refresh()` 或重新加载 | [Window API](api-window.md#chrome-格式化器) |
| 帧（Frame） | 块发送的一批 Surface Protocol 操作：即两个视图之间的差异，或来自 `cx:frame` 的原始操作。超过 64 KiB 的帧会分块发送 | [Host API](api-host.md#视图模型) |
| Glob | 带有 `*`（任意一串字符）和 `?`（单个字符）的模式。Lens 的 `match` glob 对命令区分大小写；块的 `files` glob 对文件名忽略 ASCII 大小写 | [Manifest 参考](manifest.md#匹配模式) |
| 部分（Half） | 插件两个部分之一：Host 端（`host.luau`）和 Window 端（`window.luau`）。它们通常运行在不同的进程中，往往还在不同的机器上；位于同一台机器时，二者只共用数据文件夹 | [架构](../concepts/architecture.md#两个部分) |
| 钩子（Hook） | 一次进入 Lua 的调用所用的名称（`pods.view`、`command <id>`、`focus`、`timer`）。它会出现在失败提示中，也是预算超限后被暂停的单位 | [运行时、预算与 JIT](../concepts/runtime.md#预算超限) |
| 主机（Host） | Tern 在其上运行窗格的机器：本机，或窗口连接到的远程主机。每个主机都为它自己的窗格运行它自己已安装插件的 Host 端 | [架构](../concepts/architecture.md#每个部分的运行位置) |
| Host 端（Host half） | 插件中位于 `host.luau` 的部分：块类型、Lens、Host 事件、`spawn` 过滤器和 `tern.pane`。它在运行这些窗格的主机上的一个工作线程中运行 | [Host API](api-host.md) |
| 放置方式（How） | 文件或块的打开位置：`default`、`beside`（或 `split`）、`below`、`tab`、`replace`、`over` 或 `preview` | [Window API](api-window.md#路由决策) |
| 类型标识（Kind） | 块类型的完整名称，即 `<plugin>.<block>`（`k8s.pods`）。路由决策、`cx:new_block` 和 `launch.block` 都使用它 | [包与清单](../concepts/packages.md#id-与名称) |
| Launch | 描述新窗格运行什么内容的表：`cwd`、`command`，或 `block` 加 `args` | [Window API](api-window.md#launch) |
| Lens | 插件为命令输出提供的原生视图。清单的 glob 认领该命令；Host 端的 `open`、`line`、`finish` 和 `view` 把捕获的行转换为视图，显示在 Lens 块中 | [命令 Lens](../guides/lenses.md)、[Host API](api-host.md#tern-lens-define) |
| Lens 块（Lens block） | shell 窗格中保存被认领命令的原始输出并显示其 Lens 视图的块；Raw 显示输出本身 | [架构](../concepts/architecture.md#lens-声明式认领-视图带外传递) |
| Lens id | `plugin.<plugin>.<lens>`；Lens 块的角色是 `lens.` 加上它 | [包与清单](../concepts/packages.md#id-与名称) |
| Lens 状态（Lens state） | Lens 的 `open` 返回的值：工作线程为每个插件保留最近 256 次捕获各自的状态，并通过重新水合重建 | [Host API](api-host.md#lens-状态与重新水合) |
| 链接（Link） | 插件文件夹中的一个 `<name>.path` 文件，指明位于别处的包目录；由 `tern plugin link` 写入。也指在窗格中点击的超链接，`tern.route.link` 可以接管它 | [命令行](cli.md#tern-plugin-link) |
| 清单（Manifest） | `plugin.toml`，schema 1 | [Manifest 参考](manifest.md) |
| 节点（Node） | 视图中的一个元素：`{k = kind, p = props, c = children}`，使用 `tern.ui` 构建 | [UI 构建器](ui.md#节点与文本片段) |
| 覆盖（Override） | 在内置命令之前运行的窗口处理器（`tern.override`）；返回真值会跳过内置命令 | [Window API](api-window.md#tern-override) |
| 包（Package） | 包含 `plugin.toml`、其入口、样式和模块的目录 | [包与清单](../concepts/packages.md) |
| 暂停的钩子（Paused hook） | 某次调用预算超限的钩子：此后在该 VM 中对它的调用会被跳过 5 s，反复超限则更久（最多 5 分钟），或者直到重新加载 | [运行时、预算与 JIT](../concepts/runtime.md#预算超限) |
| 插件顺序（Plugin order） | 先按插件 id 排序，同一插件内按注册顺序。凡是插件需要轮流处理的场景（覆盖、路由、格式化器、`spawn` 过滤器、认领、窗口事件）都按此顺序运行 | [生命周期与重新加载](../concepts/lifecycle.md#加载) |
| 插件文件夹（Plugins folder） | `<config>/plugins/`（`tern plugin dir`），在 iOS 上则是 Files 应用的 Tern › Plugins | [包与清单](../concepts/packages.md#plugins-文件夹) |
| 问题（Problem） | 插件文件夹中不可用作插件的条目，及其原因 | [错误](errors.md#插件文件夹问题) |
| Ready | 一种插件状态：已加载并正在运行 | [包与清单](../concepts/packages.md#问题与状态) |
| 区域（Region） | 见 Dock, layer, main | |
| 重新水合（Rehydration） | 在工作线程丢失 Lens 块的状态后（重新加载、守护进程重启、逐出）重建该状态：Host 端先让该块已保存的命令和原始输出重新经过 `open`、`line` 和 `finish`，然后才处理该块的事件 | [生命周期与重新加载](../concepts/lifecycle.md#lens-重新水合) |
| 重新加载（Reload） | 在插件文件夹发生变化、执行 `tern plugin reload` 或在偏好设置中触发之后，丢弃某个上下文的 VM 并重新加载所有插件。运行中的块会从其上次 `save` 的结果重启 | [生命周期与重新加载](../concepts/lifecycle.md#重新加载) |
| 副本（Replica） | 窗格屏幕的一份副本：守护进程的副本、每个已连接窗口的副本、iOS 的副本、Web 标签页的副本。只有 Host 端运行 Lua；副本从目录获知认领，从主机获知视图 | [架构](../concepts/architecture.md#lens-声明式认领-视图带外传递) |
| 角色（Role） | 节点或块向 CSS 暴露的字符串：节点的 `role` 属性会成为 `data-role`；Lens 块的角色是 `lens.plugin.<plugin>.<lens>`；插件块的 surface 携带 `data-surface="plugin.<plugin>.<block>"` | [Chrome 与样式](../guides/chrome.md) |
| 路由（Route） | Tern 在打开文件（`tern.route.open`）或跟随被点击的链接（`tern.route.link`）之前询问的窗口处理器；第一个决策胜出 | [路由打开与链接](../guides/routing.md) |
| 片段（Segment） | `tern.chrome.status` 格式化器添加到状态栏的一个条目：文本，以及可选的图标、色调和点击操作 | [Window API](api-window.md#tern-chrome-status) |
| 会话（Session） | 窗口中一个有名称的标签页集合，即 `cx.session` 所读取的内容；一个窗口可以包含多个会话 | [布局与工作区](../guides/layout.md) |
| 样式表（Sheet） | 窗口层叠中的一张全局样式表：插件的清单样式（`plugin:local:<id>:styles`）、`tern.css` 样式表（`plugin:local:<id>:<name>`），或远程主机上插件的样式（`plugin:<host>:<id>:styles`） | [Chrome 与样式](../guides/chrome.md) |
| 文本片段（Span） | 节点中的一段带样式文本：`{t = text, s = style?}` | [UI 构建器](ui.md#文本片段) |
| `spawn` 过滤器（Spawn filter） | 主机的 `spawn` 事件：一个同步处理器，可以在每个进程窗格启动之前改写其程序、参数、目录和环境变量；每个插件最多被等待 50 ms | [事件](events.md#启动过滤器) |
| 状态（State） | 块中由 `init` 返回、传给每个处理器并通过 `save` 持久化的值；或 Lens 捕获中由 `open` 返回的值 | [Host API](api-host.md#blockdef) |
| 插件状态（Status） | Ready、Disabled 或 Failed；每个部分各有一份 | [生命周期与重新加载](../concepts/lifecycle.md#目录与状态) |
| Surface | 窗格屏幕中的结构化视图层，块和 Lens 块通过 Surface Protocol 绘制到其中 | [构建视图](../guides/views.md) |
| 色调（Tone） | 用于文本片段、徽章、行和片段的语义颜色名称：`accent`、`success`、`warning`、`error`、`info`、`muted` 等 | [UI 构建器](ui.md#节点与文本片段) |
| 视图（View） | 块的 `view` 或 Lens 的 `view` 所返回的内容：块返回按区域组织的节点，Lens 返回一个节点 | [构建视图](../guides/views.md) |
| VM | 一台 Luau 虚拟机：每台主机上每个插件一个（位于其工作线程中），每个窗口中每个插件一个。沙箱化、256 MiB、受预算约束。除数据文件夹外，VM 之间不共享任何内容 | [运行时、预算与 JIT](../concepts/runtime.md#vm) |
| Window 上下文（Window cx） | 命令、绑定、覆盖、路由、窗口事件、窗口定时器、进程回调和 fetch 回调所获得的 `cx`：包含 `session`、`layout`、`run`、`open`、`new_block`、`command`、`toast`、`copy` | [Window API](api-window.md#window-上下文-cx) |
| Window 端（Window half） | 插件中位于 `window.luau` 的部分，在每个 Tern 窗口的 UI 线程上运行：命令、绑定、覆盖、路由、格式化器、CSS、窗口事件和布局 | [Window API](api-window.md) |
| 窗口键（Window key） | 在守护进程中标识一个窗口全部会话的键：第一个窗口为 `""`，其他窗口为 `"2"`、`"3"` 等。窗格以及 Window 端启动的进程通过 `$TERN_WINDOW_KEY` 看到它，窗口处理器用 `cx:window_key()` 读取它，`tern inspect` 在每个客户端的 `conn` 旁列出它，`tern` 命令用 `--window` 选择一个窗口（第一个窗口用 `--window ""`）。Host 端的副作用会发送到具有该窗格窗口键的所有窗口 | [命令行](cli.md#常见行为) |
| 工作线程（Worker） | 主机在其上运行某个插件 Host 端的线程，带有自己的 VM。各工作线程并行运行；每个工作线程一次处理其插件的一个请求、事件或回调 | [架构](../concepts/architecture.md#host-工作线程) |
| 工作区（Workspace） | Window 端使用 `cx.layout` 构建的标签页布局，通常在 `window_start` 中构建 | [布局与工作区](../guides/layout.md#工作区) |
