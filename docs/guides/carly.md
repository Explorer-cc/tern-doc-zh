# 扩展 Carly

桌面窗口插件通过函数扩展 Carly 的有状态 Lua 工具，而不是通过 JSON Schema 工具。每个已加载的本地窗口插件所注册的导出函数和请求上下文默认都可供 Carly 使用。仅限 Host 端的插件和远程插件无法提供这些集成。

## 内置窗口工具

无需插件，Carly 即可检查和操作活动 Tern 窗口：

- `inspect` 列出会话、主机、标签页、窗格、代理和进程；`object="block"` 会返回屏幕、看板、Markdown、浏览器及其他块的类型化状态。`read_block` 会返回它们的内容。
- `inspect object="settings"` 会将每个持久化设置列为点分隔键，并显示其值、类型、选项、范围和说明。`configure` 会应用这些键的补丁；支持嵌套对象和点分隔路径。
- `session` 可切换、创建、重命名和关闭会话。`arrange` 可重新分组、重命名和更改标签页颜色。`actions` 可发现并运行内置操作、插件操作和键位映射操作。`processes` 会列出本地进程 ID，或向其发送信号。
- `run_command`、`send_input` 和 `lua` 可打开或操作块；Lua 上下文还会公开完整的窗口插件 API，包括文件、文档、看板、代理、屏幕、浏览器、数据库、主机和进程，但不包括插件自己的 `tern.secrets`。
- `canvas_read`、`canvas_shot`、`canvas_edit` 和 `canvas_history` 可操作画布块：按 ID 列出图形及其页面框、文本和样式；将某个区域作为图片查看；添加、移动、调整大小、旋转、重新设置样式、改类型、分组、对齐、排序或删除图形（每次调用对应一个撤销步骤）；以及列出、撤销或重做该块的步骤。

## 同步和异步结果

`await(value)` 会原样返回同步值，或者等待一个可等待对象。例如，`cx.agents:start(...)` 会立即返回新窗格，`cx.agents:list()` 会返回行；`await(cx.agents:wait(pane))` 则会等待回复。只有可等待对象会暂停 Lua 调用。`await_all` 接收可等待对象列表。

## 导出函数

将注册代码放入插件的 `window.luau`：

```lua
local tern = require("tern")

tern.carly.export("current", {
	sig = "() -> {pane: number?}",
	doc = "The pane currently focused in this window.",
}, function(cx, call)
	return { pane = cx.session:focused() }
end)

tern.carly.export("pwd", {
	sig = "() -> string",
	doc = "Run pwd and return its output.",
}, function(cx, call)
	tern.process.run({ "pwd" }, { timeout_ms = 5000 }, function(result, fresh_cx)
		if result.status ~= 0 then
			call:fail(result.stderr)
		else
			call:reply(result.stdout)
		end
	end)
	return call:wait(6000)
end)
```

Carly 会通过 `help()` 或 `help("plugins.my-plugin")` 发现函数，并按如下方式调用：

```lua
local focused = await(plugins["my-plugin"].current())
local directory = await(plugins["my-plugin"].pwd())
return { focused = focused, directory = directory }
```

`cx, call` 之前的参数是位置参数。即使不用，也要声明这两个末尾参数：省略的固定参数会用 nil 补齐，这样可选值就不会挤占上下文和调用句柄的位置。向该固定签名传入过多参数会失败；可变参数导出可以解包其参数和末尾句柄。所有结果都是可等待对象，包括即时返回值。多个返回值会变成数组。值通过 JSON 跨 VM 传递：支持表、字符串、布尔值、有限数值和 null；函数、userdata、线程和循环引用会导致失败，并在错误中指出出问题的路径。参数和回答的编码 JSON 上限为 1 MiB：较长的字符串回答会被截断至上限以内，并以 `[… N bytes cut]` 结尾；任何其他超出上限的值都会失败。没有返回值且没有回答属于错误；若要返回 null 结果，请显式返回 `nil`。

将导出函数所需的凭据保存在 [`tern.secrets`](../reference/api-window.md#tern-secrets) 中，而非 `tern.kv`：Carly 自己的 VM 无法读取这些凭据，只能调用使用它们的导出函数。

导出名称须匹配 `[a-z][a-z0-9_]{0,23}`，每个插件最多 16 个。`sig` 和 `doc` 都是必需项，不能为空且各自最多 1024 字节。同名注册会替换原有注册。重新加载会替换实现，但不会重置 Carly 的全局变量；任何仍在等待旧插件的调用都会在该 VM 被丢弃前失败。

## 稍后回答

函数在 UI 线程上运行，受插件 50 ms 预算限制。通过进程、fetch 或计时器 API 启动耗时工作。返回 `call:wait(ms)`，并在回调中通过 `call:reply(value)` 或 `call:fail(message)` 恰好回答一次。默认等待时间为 30000 ms，上限为 120000。回答、取消、超时或重新加载后，reply/fail 会返回 false；此时 `call.cancelled` 会读取为 true。

调用句柄的生命周期会超出函数本身；但 `cx` 不会：回调必须使用收到的新上下文。不要在闭包中保存有作用域的上下文。

## 添加请求数据

```lua
tern.carly.context(function(cx)
	local pane = cx.session:focused()
	return pane and ("Focused pane " .. tostring(pane)) or nil
end)
```

每个插件只能有一个上下文提供函数，重新注册时会替换现有函数。`fn(cx)` 返回字符串或 nil。插件 VM 会强制执行 4 ms 预算；出错或因超出预算而被中断时，其结果会被忽略，不会阻塞提问。成功结果不会因第二次墙钟时间检查而被丢弃。已注册的上下文提供函数和导出名称会显示在标为 **Plugins** 的标题下。每个插件最多贡献 400 个字符，总计最多 1600 个字符。

## 从插件提问

```lua
tern.command({
	id = "explain",
	title = "Ask Carly about this pane",
	run = function(cx)
		cx:ask_carly("Explain the failure in this pane.")
	end,
})
```

`cx:ask_carly(text)` 会打开 Carly 并提交一条会显示出来的非空问题；任何窗口插件上下文都可调用，包括回调、导出函数和 Carly 自己的上下文。

`cx:action(name)` 可让插件或 Carly 运行任意操作名称，包括其他已加载插件的 `plugin.<id>.<command>`、内置命令、键位映射操作和焦点视图操作。

## 安排提醒和监视任务

每个已加载的桌面窗口插件都可以在有作用域的窗口回调中调用 `tern.carly.schedule(spec)`。Carly 的 Lua 工具也有相同 API。由插件创建的任务会记录 `by = "plugin:<id>"`。任务会在重新加载和启动后保留，并且只在创建它们的窗口中运行。使用 `tern.carly.tasks()` 可列出所有窗口的任务，使用 `tern.carly.cancel(id)` 可删除任务；ID 不存在时返回 false。心跳是内置任务 0，由其间隔设置管理，不会被替换或删除。

```lua
-- A reminder: no check, so the due time starts a Carly turn.
local reminder = tern.carly.schedule({
	title = "Stand-up",
	when = "in 20m",
	prompt = "Remind the user that stand-up starts now.",
})

-- A cheap watch: no model call until a matching command finishes.
tern.carly.schedule({
	title = "Build finished",
	on = "command_finished",
	pane = 14,
	check = [[return function(ev, cx, state)
		if ev.ev == "command_finished" and ev.pane == 14 then
			return {line = ev.line, status = ev.status}
		end
	end]],
	prompt = "The build in pane 14 finished. Read it and summarize the result.",
})
```

`TaskSpec` 包含 `title`、`when`/`on` 中的恰好一项、可选的 `check` 源码、`prompt`、锚定窗格 `pane`、`once`、事件监视的 `expires`，以及用于替换的 `id`。时间格式包括 `in 20m`、`at 15:00`、`at 2026-10-04 09:00`、`every 30m`、`daily 09:00`、`weekdays 09:00` 和 `mon,thu 18:30`。若重复间隔可能启动模型轮次，则至少为五分钟；对于不带 prompt 的检查，至少为一分钟。事件任务必须有 check 或 pane，默认 12 小时后过期（最长七天）。一次性时间任务和事件监视默认 `once = true`。最多可安排 50 个任务。

检查项是返回 `function(ev, cx, state)` 的源码字符串，而不是闭包。每个检查项都在自己的 VM 中同步运行，受 50 ms 预算限制；不要使用 `await`。`state` 以 JSON 持久化。`nil` 表示不采取操作，`false` 会结束任务，字符串或带有 `prompt` 的表会启动一轮。没有 prompt 的字符串会触发提醒，但不会调用模型。不带检查项时，每次触发都会启动一轮。创建时检查项还会收到 `dry_run`，窗口重新打开后会收到 `resume`；监视跨重启的工作时，应将当前窗格状态与保存的基线进行比较。上述示例只响应实时的命令完成事件，不响应恢复事件。无效的任务描述、编译失败和试运行失败都会抛出指出字段名称的错误。

**Settings › Carly › Scheduled**，或 `carly_tasks` 操作，可管理任务并显示最近十次运行记录。`TaskInfo` 包含 spec、id、创建窗口 `window`、`by`（`carly`、`user`、`plugin:<id>` 或 `heartbeat`）、`paused`、下一个 RFC 3339 时间，以及包含 `at`、`outcome`（`quiet`、`said`、`failed`、`missed`、`skipped`）和可选 `text` 的 `runs`。

## API 能力

安装插件即表示信任其本地代码。导出函数会收到新的普通窗口插件 `cx`；其共享 API 和后续回调拥有常规插件能力和预算。Carly 自己的 Lua 工具也可以读取环境变量、读写文件、运行程序、获取 URL 内容、向任何指定窗格输入文字，并通过这些 API 操作窗口。Carly 没有单独的审批流程，也没有按轮次划分的访问级别。

常规参数验证、查找错误、操作失败、超时和资源限制仍然适用。重新加载不会重置 Carly 的会话内 VM。

请参阅 [窗口 API](../reference/api-window.md#carly-导出项与请求上下文) 和[操作名称](../reference/actions.md)。
