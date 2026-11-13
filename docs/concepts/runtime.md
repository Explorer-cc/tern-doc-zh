# 运行时、预算与 JIT

每个插件端都在自己的 Luau VM 中运行：该 VM 处于沙箱模式，内存限制为 256 MiB；调用超出时间预算时会被中断。失败的调用只影响该次调用；超时的调用还会让其钩子暂停一段时间。本页介绍 VM、预算及超限后的行为、故障的报告和记录方式，以及 Luau 何时以原生代码运行。

## VM

每个 VM 都是一个 Luau 状态，包含 Luau 标准库，并会在运行任何插件代码前进入沙箱模式：

| 可用 | 不可用 |
| --- | --- |
| Luau 基础函数（`pcall`、`error`、`pairs`、`setmetatable`、`typeof`、`loadstring`、…） | `io`：Luau 没有 I/O 库 |
| `string`、`table`、`math`、`coroutine`、`utf8`、`bit32`、`buffer`、`vector`、`integer` | 除 `clock`、`date`、`difftime` 和 `time` 外的 Luau `os`（没有 `os.execute`、`os.getenv`、`os.remove`、`os.exit`） |
| Luau 的 `debug`，仅包含 `debug.info` 和 `debug.traceback` | |
| `os.clock`、`os.date`、`os.difftime`、`os.time` | `package`、`dofile`、`loadfile` |
| `require`，范围限于插件（[模块](#模块)） | 除 `"count"` 以外的 `collectgarbage` 选项 |
| `print`，即 `tern.log.info` | 修改内置库：它们是只读的（执行 `string.upper = nil` 会报错） |
| 全局变量 `tern`（[API 参考](../reference/api.md)） | |

`os.time` 接收日期表时会将其视为本地时间，与标准 Lua 一样，因此它会还原 `os.date("*t")`：`os.time(os.date("*t", t)) == t`。Luau 自带的 `os.time` 会将日期表视为 UTC；Tern 则不会。本地时区取决于运行该端的机器：在远程主机上运行的 Host 端使用该主机的时区。超出范围的字段会顺延（`day = 32` 是下个月的第一天）；夏令时切换导致的不存在时间会顺延一小时；重复时间则取第一次，除非表中指定 `isdst = false`。对于以 UTC 表示的时间（`os.date("!*t")`、`Z` 时间戳），请自行转换日期，[审核队列](../examples/review-queue.md) 示例便是如此。

插件定义的全局变量是普通变量：它们位于只读库之上的可写层中，并在同一个 VM 内由入口文件及其加载的所有模块共享。

文件、进程、环境、网络和系统钥匙串只能通过 `tern`（`tern.fs`、`tern.process`、`tern.fetch`、`tern.getenv`、`tern.secrets`）访问；离开 VM 没有其他途径。这是稳健性边界，而非安全边界：这些 `tern` 成员可以访问用户能够访问的任何内容。请参阅[信任与安全](security.md)。

## 模块

`require` 接受字符串。`"tern"` 会返回 `tern` 表，也就是安装为全局变量的同一个表。其他字符串使用 Luau 的按字符串 require 机制：相对于调用 `require` 的文件解析，并限制在插件目录内：

- `./name` 和 `../name` 会解析为 `name.luau`、`name.lua`、`name/init.luau` 或 `name/init.lua`；匹配多个文件会报错。
- 会离开插件目录的路径会以未找到错误失败。
- 不会读取 `.luaurc` 文件和 `@alias` 路径。
- 每个模块在每个 VM 中只运行一次；之后对同一文件的 `require` 会返回缓存结果。

代码块以其绝对路径命名，因此错误消息和回溯会标出文件及行号。

```lua
-- host.luau
local pods = require("./lib/pods")

-- lib/pods.luau
local M = {}

function M.parse(text: string): { string }
	local out = {}
	for line in string.gmatch(text, "[^\n]+") do
		table.insert(out, line)
	end
	return out
end

return M
```

luau-lsp 不会解析 `require("tern")`；需要进行类型检查的代码应使用全局变量 `tern`。请参阅[API 参考](../reference/api.md#luau-lsp-类型)。

## 内存

每个 VM 最多可分配 256 MiB。超出上限的分配会在发起该分配的调用中引发 Luau 内存错误。这是普通错误：调用会失败并像其他错误一样报告，`pcall` 可以捕获它，钩子仍会保持启用。Host 端为块和 Lens 捕获保留的 Lua 状态也计入其 VM 的内存上限；这也是工作线程只保留最新 256 次 Lens 捕获状态的原因之一。

## 预算

每次进入 Lua 的调用都会受时间预算限制，具体取决于调用发生的位置：

| 调用 | 预算 | 原因 |
| --- | --- | --- |
| Host：每次调用，包括运行 `host.luau` | 2 s | 运行缓慢的工作线程只会阻塞它自己的插件 |
| Window：chrome 格式化器（`tab_title`、`window_title`、`status`）和 `available` | 4 ms | 它们在窗口构建一帧时运行 |
| Window：其他所有调用，包括运行 `window.luau` | 50 ms | 它在 UI 线程上运行；此时窗口不会做其他事情 |
| 守护进程等待 `spawn` 过滤器 | 每个插件 50 ms | Shell 正等待启动 |

`spawn` 等待时间不是 VM 预算：过滤器本身在工作线程上以 2 s 的 Host 端预算运行，但守护进程在等待该插件的答复 50 ms 后就会停止等待，并按照该插件处理前的启动配置启动 Shell（日志为 `plugin spawn filter took over 50 ms; skipped`）。请参阅[Host 钩子与 Spawn 过滤器](../guides/hooks.md)。

如果某次调用是在同一 VM 的另一次调用中发起的，内部调用会沿用外部调用的截止时间（如果外部截止时间更早）。

预算统计 Lua 运行的时间。原生代码耗时不计入：Tern API（`cx.board:open`、`cx.agents:list`、`tern.fs.read`、`tern.process.run`）、为 `require` 编译模块、运行耗时较长的内置函数（例如巨大的 `string.rep`），以及线程等待 CPU 的时间。定时器若延迟触发，会从实际运行时开始计算预算，而不是从原定触发时间开始。为确保一连串缓慢的原生调用最终也会结束，一次调用还受实际耗时上限约束：最多为时间预算的十倍，包含原生调用耗时（Window 端中为 500 ms、chrome 格式化器中为 40 ms、Host 端中为 20 s）；超过后会引发 `tern: <hook> exceeded <n> ms, native calls included`。

预算通过 Luau 中断机制强制执行，该机制会在函数调用、返回和循环迭代时运行。原生调用不会在中途停止：Tern 会在原生调用返回后再次检查；如果调用始终不返回，其线程就会挂起。无界的 `tern.fs.read` 若读取 FIFO，或读取已停止响应的网络挂载上的文件，会一直阻塞窗口；这可能持续到 Tern 被终止。请传入 `max_bytes`，它会拒绝读取任何非普通文件。`tern.process.run` 会在返回前于调用线程上启动进程，因此启动缓慢程序（例如加载繁重配置文件的 Shell，或 Windows 上的 PowerShell）也会占用 UI 线程时间。

预算用于捕获意外情况：无限循环、随输入增长而耗时增加的解析等。长时间工作应放在 `tern.process.run` 中，或分散到 `tern.timer` 回调中；绝不要在 UI 线程上的循环里执行。

## 预算超限

调用超过截止时间时会引发 `tern: <hook> exceeded <n> ms`。从那一刻起，直到调用返回，调用中的每次中断检查都会再次引发错误，因此处理器内部的 `pcall` 无法捕获错误并继续执行。调用返回后，该 VM 中的对应钩子会暂停：

- 第一次超限会让钩子暂停 5 s。在上次暂停结束后的 10 分钟内再次超限，暂停时长会翻倍，最多 5 分钟；若超过 10 分钟未再次超限，下次超限会重新从 5 s 开始。持续超限的钩子会按暂停间隔运行一次，不会被永久关闭。
- 钩子暂停期间，其调用会被跳过，不会运行，也不会显示提示消息（`tern: <hook> is paused for <n> s after exceeding its budget`，以 debug 级别记录为 `paused plugin hook skipped`）。此时到期的定时器、进程、fetch 和 await 回调不会丢失：暂停结束后会运行；若定时器在暂停期间多次到期，则只运行一次。
- 暂停及其结束会写入日志（`plugin hook exceeded its budget; paused`，带有 `paused_ms`，以及 `plugin hook resumed after its pause`）。Window 端还会收到这两种情况对应的 `budget` 事件（参见[Window API](../reference/api-window.md#tern-on)）：
  `{hook, state = "paused", ms, paused_ms}`，然后是 `{hook, state = "resumed"}`。
- 暂停的钩子会显示在 Preferences › Plugins 中（两端均显示）；对于 Host 端，也会显示在 `tern plugin list` 中（`paused over budget: <hooks>`）。

被暂停的单位是钩子：

| 上下文 | 钩子名称 |
| --- | --- |
| Host | `load`（入口）；`<block>.init`、`<block>.view`、`<block>.title`、`<block>.key`、`<block>.event`、`<block>.resize`、`<block>.save`；`<lens>.open`、`<lens>.line`、`<lens>.finish`、`<lens>.view`、`<lens>.event`；每个 `tern.on` 事件名称（`command_started`、`cwd`、…）和 `spawn`；`timer`；`process`；`fetch` |
| Window | `load`；`command <id>`；`bind <n>`；`override <command>`；`available plugin.<plugin>.<id>`；`route.open`；`route.link`；`tab_title`；`window_title`；`status`；每个 `tern.on` 事件名称（`window_start`、`focus`、…）；`timer`；`process`；`fetch` |

因此，若 `view` 超限，暂停期间所有该类型的块都会停止渲染；若某个定时器回调运行缓慢，同一 VM 中该插件的所有定时器回调都会暂停，直到暂停结束。钩子按 VM 隔离：一个窗口中超限不会暂停另一个窗口中的钩子。重新加载会创建新的 VM 并结束所有暂停；`tern plugin reload <id>` 会对单个插件执行此操作。

## 故障与提示消息

处理器引发错误时，只有该次调用会失败：插件会继续运行，其状态保持为处理器引发错误前留下的状态；故障会写入日志并显示：

| 故障 | 提示消息（第一行 / 第二行） | 显示位置 |
| --- | --- | --- |
| 处理器引发错误、返回了结构错误的值，或超出预算 | "Plugin *name*: *hook* failed" / 错误的第一行 | Host：显示相关窗格的窗口；对于定时器、进程、fetch 回调及 `spawn` 过滤器，则显示在该主机的每个窗口中。Window：当前窗口。 |
| Window 入口加载失败 | "Plugin *name* failed to load" / 错误的第一行 | 当前窗口；若相同故障已由上一次加载报告，则不再显示 |
| Host 的目录存在问题或有 Failed 插件 | "1 plugin has problems" 或 "*N* plugins have problems" / 第一条错误 | 目录发生变化时，显示在连接到该主机的每个窗口中 |
| 块的 `init` 引发错误 | 处理器的提示消息；块以退出状态 1 结束，并在窗格中打印错误 | 显示该块的窗口 |

预算超限时只会在超限那一刻显示一次提示消息；钩子暂停期间被跳过的调用不会再次显示提示消息。错误消息本身请参阅[错误](../reference/errors.md)。

## 日志

`tern.log.debug`、`info`、`warn` 和 `error` 会将参数转换为字符串（通过 `tostring`）后用制表符连接，并通过 Tern tracing 按对应级别记录一行，target 为 `tern::plugin`，字段为 `plugin=<id>`。`print` 即 `tern.log.info`。

日志行会写入运行该端的进程所用的日志文件：

| 平台 | 日志目录 |
| --- | --- |
| macOS、iOS | `~/Library/Logs/Tern`（在 iOS 上位于应用容器内） |
| Linux | `$XDG_STATE_HOME/tern/logs`（`~/.local/state/tern/logs`） |
| Windows | `%LOCALAPPDATA%\Tern\Logs` |
| 任意 | 设置后使用 `$STENCIL_LOG_DIR` |

Host 端写入 `tern-daemon.log`（若窗口在没有守护进程时运行其窗格，则写入该窗口的日志）；Window 端写入该窗口的 `tern.log`。文件达到 16 MiB 时会滚动为 `<name>.1.log`，`<name>.2.log` 是保留的最旧文件。警告和错误也会写入标准错误。

默认过滤器为 `warn,stencil=info`：Tern 自身模块（`stencil_*`）从 info 级别开始记录，其他所有内容从 warn 级别开始记录。`tern::plugin` 不是 `stencil` 日志目标，因此默认只有 `tern.log.warn` 和 `tern.log.error` 会写入文件；`print`、`tern.log.info` 和 `tern.log.debug` 会被丢弃。若要保留这些内容，请在启动进程时设置 `STENCIL_LOG`；它会替换文件和标准错误输出的过滤器：

```sh
STENCIL_LOG=warn,stencil=info,tern::plugin=debug
```

运行时自身的报告使用 Tern 的日志目标，并默认以 warn 级别写入文件：`plugin handler failed`（带有 `plugin`、`hook` 以及包含回溯的错误）、`plugin hook exceeded its budget; paused`、`plugin failed to load`、`plugin window entry failed to load`、`not a usable plugin`、`plugin spawn filter took over 50 ms; skipped`、`plugin keeps re-rendering; requests dropped`、`plugin bind left out` 和 `plugin style sheet has errors`。请参阅[调试](../guides/debugging.md)。

## 定时器、进程与 Fetch 回调

`tern.timer`、`tern.process.run` 和 `tern.fetch` 的回调绝不会在其他线程上运行。定时器到期、进程结束或请求完成时，VM 所有者会被唤醒，并在与该 VM 其他所有处理器相同的线程上自行运行回调：

| 上下文 | 运行位置 | 回调参数 | 预算 |
| --- | --- | --- | --- |
| Host | 插件的工作线程，在请求之间 | `fn()`、`cb(result)` | 2 s |
| Window | 窗口的 UI 线程，在渲染完成后 | `fn(cx)`、`cb(result, cx)`，每次都会使用新的 `cx` | 50 ms |

进程或请求会在 VM 线程之外运行；只有它们的回调会回到 VM 线程上。由于回调与其他所有处理器串行执行，Lua 状态无需加锁，回调也不会在处理器执行到一半时将其打断。到期的定时器、已结束的进程和已完成的请求会按发生时间从早到晚运行。待处理的定时器、进程和 fetch 回调会在下一次重新加载时随 VM 结束；进程或请求本身则会继续运行直至结束。请参阅[文件、进程与存储](../guides/io.md)。

## JIT

在 macOS、Linux 和 Windows 上，Tern 的发行版构建包含 Luau 原生代码生成器；当 CPU 属于 Luau 代码生成器支持的范围时，加载的每个代码块（入口和模块）都会编译为原生代码，否则使用解释器运行。源代码开发构建默认不包含代码生成器，除非使用 `luau-jit` 功能构建；此类构建使用解释器。macOS 应用签名包含 `com.apple.security.cs.allow-jit` 授权项（entitlement）；强化运行时要求进程具备该授权项才能创建可执行内存。iOS 禁止应用使用可执行内存，因此 Tern 的 iOS 版本不包含代码生成器，始终使用解释器。两种模式下的插件代码相同，只有速度不同。

当 VM 启用了原生代码生成时，`tern.runtime.jit` 为 `true`。Host 的目录也包含 `jit`（任意 Host 端加载时启用该功能则为 true），`tern plugin list --json` 会打印此值。

`jit` 能说明和不能说明的内容：

| `jit` 会报告 | `jit` 不会报告 |
| --- | --- |
| 构建是否包含 Luau 代码生成器（iOS 和开发构建中为 false） | 某个特定函数是否已编译为原生代码 |
| 代码生成器是否支持该 CPU；此项在创建 VM 时检查 | 操作系统是否实际授予了可执行内存 |
| | 关于另一端或其他主机的任何信息；每个 VM 都单独报告 |

请将其用于诊断，而不要据此选择不同代码路径。

## 数字与 ID

Luau 的 `number` 是 64 位浮点数：整数精确到 2<sup>53</sup>。`tern` API 接受或返回的所有数字都是 `number`。`tern.json.encode` 会将整数形式的数字写为 JSON 整数，其他数字写为浮点数；`tern.json.decode` 会将 JSON 数字读取为 Luau 数字。Luau 的 `integer` 库（将 64 位整数作为单独值类型）也已加载，但 `tern` 不会生成这类值。

窗格和标签页 ID 是数字。Host 端使用守护进程自己的 ID。在 Window 端，本机的 ID 与 `tern ls` 显示的相同。远程主机的窗格 ID 高位包含主机标记，无法用双精度浮点数完整保留，因此 Tern 会在交给 Lua 前将这些 ID 打包为小于 2<sup>53</sup> 的值，并在 Lua 传回时解包。

请将 ID 视为不透明值：原样传回，不要对其进行算术运算，也不要比较来自不同窗口的 ID。

## 另请参阅

- [限制](../reference/limits.md)：所有预算和大小汇总于一个表格。
- [生命周期与重新加载](lifecycle.md)：重新加载会重置哪些内容。
- [调试](../guides/debugging.md)：如何找到发生故障的处理器。
