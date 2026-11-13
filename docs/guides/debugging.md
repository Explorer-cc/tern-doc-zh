# 调试

当插件行为异常时，Tern 会在三个位置告知你：窗口中的提示、插件列表（`tern plugin list`、Preferences › Plugins）以及日志文件。本页介绍各类故障会在哪里显示、如何获取插件自己的日志行、如何使用 luau-lsp 进行类型检查、如何通过开发工具用脚本驱动窗口，以及最常见的错误。

## 故障显示位置

故障会在发生故障的代码运行位置报告，每次故障报告一次：

| 故障 | 提示（文本 / 第二行） | 其他位置 |
| --- | --- | --- |
| manifest 或文件夹问题：没有 `plugin.toml`、id 无效、缺少入口或样式文件、id 重复 | “1 plugin has problems” 或 “*N* plugins have problems” / 第一条错误 | `tern plugin list` 中的 `problem DIR: ERROR`；不会列为插件 |
| Host 入口加载时抛出错误，或未定义声明的块或 Lens | 相同的插件列表提示 | `tern plugin list` 中状态为 `failed`，Preferences 中显示 Failed |
| Window 入口加载时抛出错误 | “Plugin *name* failed to load” / 错误的第一行 | Preferences 中显示 Failed；**不会**显示在 `tern plugin list` 中 |
| 处理器抛出错误、返回错误结构或超出预算 | “Plugin *name*: *hook* failed” / 错误的第一行 | 日志中出现 `plugin handler failed` 警告及回溯 |
| 按键组合或状态片段指定了未加载的插件操作 | “No plugin has this action” / 操作名称 | |
| 状态片段的 `command` 无法解析 | “A status segment's command is unknown” / 命令及原因 | |
| `tern.bind` 的按键组合或操作无法解析，或按键已被预设绑定 | 无 | 日志中出现 `plugin bind left out` 警告 |
| 样式表包含 CSS 错误 | 无 | 日志中出现指明样式表名称的 `plugin style sheet has errors` 警告 |

当主机的插件列表发生变化时（窗口连接时，以及重新加载导致列表变化后），会显示插件列表提示。如果窗口重新加载失败，且错误与上次加载完全相同，就不会再次显示提示；因此有问题的插件每次变更报告一次，而不是每次重新加载都报告。Host 处理器的提示会发送到显示相关窗格的窗口；对于计时器、进程和 fetch 回调以及 `spawn` 过滤器，则发送到该主机的每个窗口。参见[运行时、预算与 JIT](../concepts/runtime.md#故障与提示消息)。

“Plugin *name*: *hook* failed” 中的 hook 是处理器名称：`command scratch`、`bind 0`、`override new_tab`、`route.open`、`status`、`timer`、`counter.view`、`greet.line`、某个事件名称。完整列表见[运行时、预算与 JIT](../concepts/runtime.md#预算超限)。

## 插件列表 {#插件目录}

`tern plugin list` 会逐行打印为当前窗格提供服务的会话守护进程中的插件，然后逐行打印问题：

```text
hello 0.1.0 Hello — 1 blocks, 1 lenses, window  ready
problem /Users/me/Library/Application Support/Tern/plugins/broken: invalid id "Broken" (lowercase letters, digits and -, 1-32 long)
```

每行格式为 `ID VERSION NAME — N blocks, M lenses[, window]  STATUS`，其中 STATUS 为 `ready`、`disabled` 或 `failed: ` 加错误的第一行。
`--json` 会打印完整的插件列表，包括条目、问题以及主机的 `jit` 标记。

状态涵盖的内容：

- 该列表属于 **Host 端**。Window 入口加载失败时，此处插件仍显示为 `ready`；请查看 Preferences 或窗口中的提示。
- 如果没有运行中的守护进程，`tern plugin list` 会读取插件文件夹，但不会运行任何 Lua：此时 `ready` 仅表示 manifest 有效且设置允许该插件。

`tern plugin reload` 会让守护进程重新加载所有插件并打印新的插件列表。如果有插件加载失败或文件夹存在问题，命令会以 1 退出，因此可用作脚本或编辑器任务中的检查。该命令需要正在运行的守护进程（否则会提示 `no daemon running`）。`install`、`remove`、`link` 和 `unlink` 也会重新加载，并且只打印失败项。参见[命令行](../reference/cli.md)。

### Preferences › Plugins

Plugins 页面会列出此机器上的插件，并显示徽标：Ready、Off 或 “Failed: ” 加错误的第一行。徽标显示 Host 端状态和此窗口状态中较差的一个，因此即使 `tern plugin list` 显示 `ready`，此处仍会显示失败的 Window 入口。每个已连接远程主机的插件会按主机名称列在其下方，且为只读。页面上的 Reload 按钮会重新加载此窗口的插件及所有已连接主机的插件，效果与命令面板中的 **Reload plugins** 命令相同。

## 日志

### 插件自己的日志行

`tern.log.debug`、`info`、`warn` 和 `error` 会写入日志行，日志目标为 `tern::plugin`，并带有字段 `plugin=<id>`；`print` 等同于 `tern.log.info`。默认过滤器 `warn,stencil=info` 会保留 Tern 自身模块中 info 及以上级别的日志，以及其他所有模块中 warn 及以上级别的日志。`tern::plugin` 不是 Tern 模块，因此**默认只会写入 `tern.log.warn` 和 `tern.log.error`**；`print`、`info` 和 `debug` 会被丢弃。

因此，开发期间查看值最快的方式是使用 `tern.log.warn(...)`，或者在 Window 处理器中显示提示（`cx:toast("info", text)`）。若要保留所有级别的日志，请使用 `STENCIL_LOG` 启动进程；它会替换日志文件和标准错误的过滤器：

```sh
STENCIL_LOG=warn,stencil=info,tern::plugin=debug
```

进程会在启动时读取 `STENCIL_LOG`。这对 Host 端很重要，因为它运行在会话守护进程中：守护进程由第一个窗口启动，并在窗口关闭后继续运行，使用启动时的环境变量。若要为 Host 端设置独立过滤器，请运行单独的守护进程。使用 `TERN_DAEMON_SOCKET` 指定新套接字启动的窗口会在那里启动自己的守护进程，该守护进程会继承窗口的环境：

```sh
export STENCIL_LOG=warn,stencil=info,tern::plugin=debug
export STENCIL_LOG_DIR=/tmp/tern-plugin-logs
export TERN_DAEMON_SOCKET=/tmp/tern-plugin-dev.sock
tern ~/src/my-plugin
```

此窗口及其守护进程会将每条插件日志写入 `/tmp/tern-plugin-logs`。它打开的窗格属于该守护进程，与常用会话相互独立；`STENCIL_LOG_DIR` 可避免两个守护进程写入同一个文件。由于 Window 端运行在窗口进程中，它也会使用相同过滤器记录日志。

### 日志文件

| 平台 | 日志文件夹 |
| --- | --- |
| macOS | `~/Library/Logs/Tern` |
| Linux | `$XDG_STATE_HOME/tern/logs`（`~/.local/state/tern/logs`） |
| Windows | `%LOCALAPPDATA%\Tern\Logs` |
| 任意平台 | 设置后使用 `$STENCIL_LOG_DIR` |

Host 端写入 `tern-daemon.log`（窗口不使用守护进程而自行运行其窗格时写入该窗口的 `tern.log`）；Window 端写入 `tern.log`。文件达到 16 MiB 后会移动为 `<name>.1.log`。命令面板中的 **Open logs and app state** 会写出缓冲的日志行并打开日志文件夹。

Tern 自身有关插件的报告会按默认过滤器写入。可搜索以下消息：

| 消息 | 含义 |
| --- | --- |
| `plugin handler failed` | 处理器抛出错误；日志行包含 `plugin`、`hook` 以及带回溯的错误。 |
| `plugin hook exceeded its budget; paused` | 运行时间超出预算；`paused_ms` 表示暂停时长。 |
| `plugin hook resumed after its pause` | 暂停的处理器恢复运行。 |
| `plugin failed to load` | Host 入口加载失败。 |
| `plugin window entry failed to load` | Window 入口加载失败。 |
| `not a usable plugin` | 文件夹问题。 |
| `plugin bind left out` | 按键组合或操作无法解析，或预设已绑定这些按键。 |
| `plugin style sheet has errors` | CSS 无法解析，并附有样式表名称。 |
| `plugin spawn filter took over 50 ms; skipped` | `spawn` 过滤器运行缓慢。 |
| `plugin keeps re-rendering; requests dropped` | 块在循环中请求渲染。 |

## 将预算作为信号

处理器运行时间超过预算时，会抛出 `tern: <hook> exceeded <n> ms`，只显示一次提示，随后其 hook 会被**暂停**：首次触发后暂停 5 s；若在上次暂停后不久再次触发，暂停时长每次翻倍，最长为 5 分钟。暂停期间的调用会被跳过，不显示提示，并以 debug 级别记录为 `paused plugin hook skipped`；到期的计时器、进程和 fetch 回调会等待暂停结束后运行。其表现是：命令、绑定、格式化器或块视图显示一次提示后，就有一段时间毫无反应。Preferences › Plugins 和（对于 Host 端）`tern plugin list` 会显示已暂停的 hook；当 hook 暂停和恢复时，Window 端会收到 `tern.on("budget", …)`。
`tern plugin reload <id>` 会立即结束单个插件的暂停。

| 预算 | 适用对象 |
| --- | --- |
| 4 ms | Chrome 格式化器和 `available` 检查 |
| 50 ms | 其他所有 Window 调用，包括 Window 入口 |
| 2 s | 所有 Host 调用，包括 Host 入口 |

触发预算几乎总是意味着在不合适的位置执行了工作：在 Window 处理器中遍历文件或读取大量内容、解析工作量随输入增长，或循环等待某事。由于 hook 是预算单位，一个运行缓慢的计时器回调会禁用该 VM 中该插件的所有计时器回调。修复原因后重新加载：使用命令面板中的 **Reload plugins**、运行 `tern plugin reload`，或在包中保存文件。将耗时工作移至 `tern.process.run`，拆分到多个 `tern.timer` 回调中，或移至 Host 端。参见[运行时、预算与 JIT](../concepts/runtime.md#预算)。

## 使用 luau-lsp 进行类型检查

`tern plugin types DIR` 会写入 `DIR/tern.d.luau`，其中包含整个 `tern` 模块的定义。在包目录中将 luau-lsp 指向该文件：

```sh
cd ~/src/my-plugin
tern plugin types .
```

`.vscode/settings.json`（或编辑器的 luau-lsp 设置）：

```json
{
  "luau-lsp.platform.type": "standard",
  "luau-lsp.sourcemap.enabled": false,
  "luau-lsp.types.definitionFiles": { "@tern": "tern.d.luau" }
}
```

在命令行中执行相同的检查：

```sh
luau-lsp analyze --platform=standard --definitions=@tern=tern.d.luau host.luau window.luau
```

升级 Tern 后重新生成定义。类型检查器不会告诉你以下三件事：

- luau-lsp 会将 `require("tern")` 报告为未知 require。请使用全局变量 `tern`，它与该表相同。
- 文件为两个入口声明了同一个 `tern`。仅限某个上下文使用的成员会在文档中标记为 `Host only` 或 `Window only`，但在 `window.luau` 中调用 Host 成员仍能通过类型检查，运行时却会失败。
- 某些位置的类型比运行时实际情况更宽泛：窗格和标签页表中的 `cwd` 类型为 `string?`，因为 Host 端的 `tern.pane.list` 可能返回 `nil`；而 Window 端的表始终包含字符串（未知时为 `""`）。

## 通过脚本驱动窗口 {#通过脚本驱动-window}

Tern 的开发工具（`tern help dev`）可以运行带控制端点的窗口并向其发送命令，其中有三条用于插件：

| 命令 | 作用 |
| --- | --- |
| `plugins run <action>` | 按名称运行操作，就像绑定到该操作的按键会运行它一样：`plugins run plugin.scratch.scratch`、`plugins run new_tab`。 |
| `plugins expect "<text>"` | 等待聚焦窗格的 surface（插件块的视图、Lens 块的原生视图）显示该文本。 |
| `plugins fixtures` | 用 Tern 的测试插件替换插件文件夹并加载它们，包括 Host 端，同时遵循 `settings.json` 保存的 `plugins` 和 `plugins_disabled` 设置。 |

使用 `--control` 启动的窗口会照常运行插件，因此 `plugins run` 和 `plugins expect` 可用于测试真实的包：

```sh
tern --control /tmp/tern-ctl.sock ~/src/my-plugin &
tern ctl --control /tmp/tern-ctl.sock plugins run plugin.counter.open
tern ctl --control /tmp/tern-ctl.sock plugins expect '"Count: 0"'
tern ctl --control /tmp/tern-ctl.sock css
tern ctl --control /tmp/tern-ctl.sock tree "[data-surface='plugin.counter.counter']"
```

在 Tern 窗格中，不带 `--control` 的 `tern ctl` 会驱动你正在输入命令的窗口，无需设置端点：此处运行 `tern ctl css` 会列出该窗口的样式表。

[脚本](../scripts/index.md)记录了脚本或 `ctl` 可发送的所有命令。

`ctl` 会将各个词拼接成一条命令行，因此对于场景解析器中需要引号的文本，应在 shell 引号内再加引号。其他控制命令也有助于样式调试：`css` 按级联顺序列出已安装的样式表（查找 `plugin:local:<id>:styles` 和你的 `tern.css` 名称），`tree SEL` 显示选择器匹配的可见元素，而 `state` 会以 JSON 格式打印应用状态。

`plugins fixtures` 用于 Tern 本身的开发。它会从构建该二进制文件的源码树加载测试夹具，并且只在自行运行其窗格的进程中可用，也就是无头运行（`tern shot`、`tern serve`）；这些运行方式原本不加载任何插件。若窗口已连接到守护进程，则会报错 `a daemon runs this machine's panes, with its own plugins`。场景示例如下：

```text
ready
plugins fixtures
palette "New Counter"
key Enter
plugins expect "Count: 0"
type "+"
plugins expect "Count: 1"
shot plugin-block
```

## 常见错误

### 将 `cx` 留到之后使用

窗口的 `cx` 只在接收到它的调用期间有效。将其存入上值，并在计时器、进程或 fetch 回调中或之后的事件中使用，会抛出错误。计时器、进程和 fetch 回调会获得各自全新的 `cx`；请使用该实例。

```lua
tern.on("window_start", function(_cx)
	tern.timer(1000, function(cx)
		if cx then
			cx:toast("info", "Use the cx you were given")
		end
	end)
end)
```

### `--!strict` 下的属性

节点的 `p` 类型为 `{ [string]: any }?`，因此当 `p` 可能不存在时，`node.p.actions = …` 无法通过类型检查。先构建表，再进行赋值：

```lua
local node = tern.ui.badge("Retry", "accent")
local p: { [string]: any } = node.p or {}
p.actions = { click = "retry" }
node.p = p
```

在 `--!strict` 下，还应确保 span 列表只包含 span（在 span 表中混入裸字符串会导致检查失败），并将柱状图和迷你图的序列标注为 `local series: { { any } } = {}`。参见[UI 构建器](../reference/ui.md)。

### 通过 `data-role` 设置块样式

插件块的类型位于其区域元素的 `data-surface` 属性中，而不是 `data-role`：

| 目标 | 选择器 |
| --- | --- |
| 插件块 | `.sf-main[data-surface='plugin.<plugin>.<block>']`（也包括 `.sf-dock`、`.sf-layer`） |
| Lens 块 | `.sf-block[data-role='lens.plugin.<plugin>.<lens>']` |
| 你自己的节点 | 节点的 `role` 属性对应的 `[data-role='…']` |

对带有 `--control` 的窗口运行 `tern ctl tree SEL`，可查看选择器是否匹配。参见[Chrome 与样式](chrome.md#实用选择器)。

### 写入插件目录

系统会监视包目录，其中的任何变化都会重新加载该上下文中的所有插件。在入口文件旁写入缓存或日志文件的插件会陷入反复重新加载的循环。请写入 `tern.plugin.data`。

### 格式化器中的值始终不变

Chrome 格式化器会按输入缓存。读取时钟、文件或进程结果的格式化器会一直显示首次结果，直到其输入发生变化。将数据保存在上值中，并在数据变化时调用 `tern.chrome.refresh()`（对于时钟，可从计时器中调用）。参见[Chrome 与样式](chrome.md#刷新)。

### 按键序列没有任何效果

如果默认设置或 `keymap` 预设已绑定某个按键组合（或以该组合开头的序列），插件的绑定就会被排除，并记录 `plugin bind left out` 警告，且不显示提示。请选择默认设置未占用的按键组合，或在 `settings.json` 的 `keybinds` 中绑定该操作；它的优先级高于所有层。参见[命令、按键与覆盖](commands.md#按键映射分层)。

### 检查了错误的机器

`tern.fs` 和 `tern.process` 会作用于其所在端运行的机器。Window 端读取远程主机上窗格的 `pane.cwd` 时，检查的是窗口的磁盘，而不是主机的磁盘。针对远程窗格的文件检查应放在 Host 端，并将插件安装到该主机上。

## 另请参阅

- [生命周期与重新加载](../concepts/lifecycle.md)：插件何时加载和重新加载。
- [运行时、预算与 JIT](../concepts/runtime.md)：预算、提示和日志目标。
- [错误](../reference/errors.md)：错误消息及其原因。
- [命令行](../reference/cli.md)：`tern plugin` 的完整说明。
