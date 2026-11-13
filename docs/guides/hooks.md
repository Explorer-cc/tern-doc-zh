# Host 钩子与 Spawn 过滤器

Host 钩子让插件的 Host 端能够响应计算机上各个窗格的活动：命令开始或结束、目录或标题改变、程序退出。Spawn 过滤器更进一步，会在 shell 启动前重写其程序、参数、目录和环境。本页介绍这些事件、其处理器可以执行的操作、过滤器的约定，以及所有这些功能的运行位置。

## 钩子的运行位置

钩子属于 Host 端，它与窗格运行在同一位置：

- **使用会话守护进程时**（通常如此），每个插件的 Host 端都在守护进程中自己的工作线程上运行。钩子会收到守护进程运行的所有窗格的事件，无论哪个窗口正在显示这些窗格；即使没有打开任何窗口，钩子也会继续运行。
- **不使用守护进程时**，如果窗口自行运行其窗格，该窗口就会为自己的窗格运行 Host 端及其钩子。你的代码无需更改，但 `tern.pane.list()` 和事件只涵盖该窗口的窗格，产生的效果也只会作用于该窗口。
- **远程主机**会为其窗格运行自己的插件 Host 端。你机器上的 Host 端永远收不到远程主机窗格的事件；你的 Window 端则会通过窗口事件收到这些事件。
- **iOS** 不运行任何 Host 端。

由于 Host 端运行在守护进程中，其中的 `tern.getenv`、`tern.fs` 和 `tern.process` 访问的是守护进程的环境和机器，而不是某个窗口的环境和机器。

## 事件

`host.luau` 中的 `tern.on(name, fn)` 会将 `fn` 注册为事件处理器：

| 事件 | 触发时机 | 负载 |
| --- | --- | --- |
| `command_started` | shell 报告命令行开始运行 | `{pane, line, cwd?}` |
| `command_finished` | 命令结束 | `{pane, line, status, took_ms}` |
| `cwd` | 窗格的工作目录改变 | `{pane, path}` |
| `title` | 窗格的标题改变 | `{pane, title}` |
| `pane_exited` | 窗格中的程序退出 | `{pane, status}` |
| `spawn` | shell 窗格即将启动 | spawn 规格；见[下文](#spawn-过滤器) |

- `pane` 是此主机上窗格的 ID，也是 `tern.pane.write` 接受的 ID。
- `line` 是 shell 报告的命令行，保持输入时的样子（不会展开别名）。如果能确定，`cwd` 是命令启动时 shell 所在的目录。
- `status` 是退出状态；`took_ms` 是主机测得的命令运行时长，单位为毫秒。
- `command_started` 和 `command_finished` 需要 Shell 集成来报告命令行。`command_finished` 只会对已观察到启动事件的命令触发。

如果主机不认识某个事件名称，`tern.on` 调用时会引发错误。同一插件的处理器会按注册顺序在该插件的工作线程上运行。每个插件都有自己的工作线程，因此不同插件的处理器会并发运行，顺序未定义。每次处理器调用的预算为主机规定的 2 s；运行缓慢的处理器只会拖慢所属插件。

## 钩子 `cx`

事件处理器接收 `(ev, cx)`。`cx` 会将效果发送到显示该事件所涉窗格的会话的所有窗口：

| 方法 | 效果 |
| --- | --- |
| `cx:toast(level, text, sub?)` | 显示 toast；`level` 为 `"success"`、`"info"` 或 `"error"` |
| `cx:open(target)` | 打开路径或 URL，效果如同在窗格中点击链接，因此每个窗口的路由都会生效 |
| `cx:copy(text)` | 将 `text` 放入剪贴板 |

如果没有关联的窗口，这些效果会被丢弃。钩子不能操作布局、命令面板或窗口状态；这些是 Window 端的工作（窗口事件见[布局与工作区](layout.md#窗口事件)）。

## 写入窗格

`tern.pane.write(pane, text)` 会将 `text` 写入窗格的伪终端，就像输入文本一样。在末尾加上 `"\r"` 即可运行命令；不加 `"\r"` 则会将文本放到提示符处，等待用户确认。写入会在处理器返回后应用；如果窗格已不存在，则会忽略写入。

`tern.pane.list()` 会返回此主机上所有程序尚未退出的窗格，记录格式为 `{pane, cwd?, program, title, busy}`。`program` 是程序名称；对于插件块，则是块类型。块窗格从其 `init` 运行之前就会列出。`busy` 表示是否有 Shell 集成命令正在运行，不代表一般的进程活动。

```lua
local function title_of(pane: number): string?
	for _, info in tern.pane.list() do
		if info.pane == pane then
			return info.title
		end
	end
	return nil
end
```

向 shell 写入功能强大，也很容易出错：用户可能正在输入，也可能正在运行全屏程序。优先将命令留在提示符处，而不是直接运行；并且只为响应用户刚刚在该窗格中执行的操作而写入。

## Spawn 过滤器

每个主机上的 shell 窗格启动前，都会运行 `spawn` 处理器（插件块不会启动进程，因此不会进入此处理器）。它接收规格，并返回要使用的规格；返回 `nil` 则保持不变：

```lua
tern.on("spawn", function(spec: SpawnSpec): SpawnSpec?
	spec.env.EDITOR = "nvim"
	return spec
end)
```

| 字段 | 内容 |
| --- | --- |
| `program` | 已解析的程序：登录 shell（例如 `/bin/zsh`），除非窗格指定运行其他程序 |
| `args` | 程序参数，包括守护进程添加的登录标志 |
| `cwd` | 窗格启动时所在的目录 |
| `env` | Tern 按名称为窗格设置的变量 |

`env` 只包含 Tern 在窗格继承的环境之上添加的内容，不包含继承的环境本身。守护进程窗格中，这些变量是 `TERN_IDENTITY`、`TERN_PANE`、`TERN_PANE_SOCKET`、`TERN_WINDOW_KEY`、`TERN_WINDOW_SOCKET`（空值）、`TERN_EXE`、`TERN_LENSES`、`TERN_COMPLETE` 和 `TERN_BLOB_DIR`。因此，你可以添加变量并覆盖这些变量，但不能移除继承的变量：移除某个键只会停止 Tern 设置它。使用 `tern.getenv` 读取继承的值。

返回的表会按以下方式应用：

- `program` 和 `args` 各自在缺失时保留先前的值。
- 如果缺少 `cwd` 或其不是目录，则会忽略它：窗格仍在原本会使用的位置启动。守护进程会展开开头的 `~`。
- `env` 会被视为完整的变量集合：已移除的键不会被设置，新增的键则会加入。请修改并返回收到的规格，而不要返回只包含修改内容的新表。

守护进程会等待过滤器，因此处理过程是同步的，应当简短：

- **顺序。** 带有 `spawn` 处理器的插件按插件 ID 顺序运行，每个插件接收前一个插件返回的结果。同一插件中的多个处理器则按注册顺序运行。
- **每个插件 50 ms。** 窗格对每个插件的响应最多等待 50 ms，计时从请求进入队列时开始，因此工作线程完成另一个处理器所花的时间也计入其中。超时响应会被丢弃，窗格使用原样的规格启动，日志会显示 `plugin spawn filter took over 50 ms; skipped`。
- **不能等待进程或请求。** `tern.process.run` 和 `tern.fetch` 会在窗格启动后才回调。请使用 `tern.fs`、`tern.kv` 和字符串处理，并提前缓存任何耗时操作的结果。
- **失败。** 如果处理器引发错误，或返回的既不是表也不是 `nil`，规格会保持原样，并向每个窗口显示 toast，因为此时尚不存在可用于定位目标的窗格。

窗口在没有守护进程时自行运行其窗格，过滤器也会运行。在这种情况下，`env` 包含该窗口的变量，具体为 `TERN_WINDOW_SOCKET`、`TERN_WINDOW_PANE`、`TERN_EXE`、`TERN_LENSES`、`TERN_COMPLETE` 和 `TERN_BLOB_DIR`。

## 示例：projects

这个 Host 端会为每个新 shell 设置 `TERN_PROJECT`，其值为 shell 启动所在 git 仓库的名称；它会对运行时间超过 30 秒的命令显示 toast，并记住最近 20 条；此外还会发现 `gti` 这个拼写错误，并将更正后的命令放到提示符处。

`plugin.toml`：

```toml
schema = 1
id = "projects"
name = "Projects"
version = "0.1.0"
description = "TERN_PROJECT in new shells, toasts for slow commands."
host = "host.luau"
```

`host.luau`：

```lua
--!strict
-- New shells get TERN_PROJECT (the name of the git repository they start
-- in); commands that run longer than SLOW_MS toast when they finish; a
-- `gti` typo is corrected on the prompt, waiting for Enter.

local SLOW_MS = 30000

local function repo_root(dir: string): string?
	local at: string? = dir
	while at and at ~= "" do
		if tern.fs.exists(at .. "/.git") then
			return at
		end
		at = string.match(at, "^(.*)/[^/]*$")
	end
	return nil
end

tern.on("spawn", function(spec: SpawnSpec): SpawnSpec?
	local root = if spec.cwd then repo_root(spec.cwd) else nil
	if not root then
		return nil
	end
	spec.env.TERN_PROJECT = string.match(root, "[^/]+$") or root
	return spec
end)

local function title_of(pane: number): string?
	for _, info in tern.pane.list() do
		if info.pane == pane then
			return info.title
		end
	end
	return nil
end

tern.on("command_finished", function(ev: CommandFinishedEvent, cx: EffectCx)
	if ev.took_ms < SLOW_MS then
		return
	end
	local seconds = ev.took_ms // 1000
	local where = title_of(ev.pane) or ("pane " .. ev.pane)
	if ev.status == 0 then
		cx:toast("success", ev.line, string.format("Finished in %ds · %s", seconds, where))
	else
		cx:toast("error", ev.line, string.format("Exit %d after %ds · %s", ev.status, seconds, where))
	end
	local recent = tern.kv.get("slow") or {}
	table.insert(recent, 1, { line = ev.line, status = ev.status, took_ms = ev.took_ms })
	while #recent > 20 do
		table.remove(recent)
	end
	tern.kv.set("slow", recent)
end)

tern.on("command_finished", function(ev: CommandFinishedEvent, _cx: EffectCx)
	local rest = string.match(ev.line, "^gti (.*)$")
	if ev.status == 127 and rest then
		tern.pane.write(ev.pane, "git " .. rest) -- no "\r": Enter runs it
	end
end)
```

在 `~/work/stencil/crates` 中打开一个标签页，会得到一个 shell，其中 `echo $TERN_PROJECT` 会打印 `stencil`。运行 `gti status` 会失败并显示 "command not found"（状态 127），接着 `git status` 会出现在下一个提示符处，等待按 Enter。

这些选择的说明：

- **过滤器保持轻量。** `repo_root` 每个目录层级只调用一次 `exists`，远低于 50 ms。若当前目录不在仓库中，它会返回 `nil`，规格因此保持不变。
- **修改收到的规格。** 赋值到 `spec.env` 可以保留 Tern 设置的变量；如果返回一个新的 `{ env = { TERN_PROJECT = … } }`，这些变量就会丢失。
- **同一事件有两个处理器。** 它们在同一工作线程上按顺序运行；其中一个失败不会阻止另一个运行。
- **Toast 会显示在命令运行的位置。** `cx` 会将效果发送到显示该窗格的窗口，窗格标题则会告诉用户命令在哪个窗格中运行。
- **`tern.kv` 保存历史记录。** 列表会保存在插件的数据目录中，因此重启后仍然存在，窗口命令也可以显示它。两个端共用同一个 `kv.json`，因此 Window 端可以读取 Host 端最近设置的值；参见[文件、进程与存储](io.md)。
- **输入，而非运行。** 拼写错误修正不会附加 `"\r"`，因此除非用户按下 Enter，否则命令不会运行。

## 相关页面

- [Host API](../reference/api-host.md#tern-on) 和[事件](../reference/events.md)：所有事件及其字段。
- [布局与工作区](layout.md)：窗口事件和 Window 端的 `cx`。
- [架构](../concepts/architecture.md)：Host 端的运行位置。
- [信任与安全](../concepts/security.md)：向窗格写入内容意味着什么。
