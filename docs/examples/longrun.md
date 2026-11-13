# 长时间运行的命令

`longrun` 会注意那些让你等待的命令。命令行运行超过阈值（默认 15 秒）时，它会在命令结束时提示结果，保留最近 50 条此类命令，并在“Slow Commands”块中将其与当前运行的命令一同列出。这是同时使用 Host 和 Window 两端实现单个功能并共享模块的最小示例。

## 演示内容

| 接口 | 端 | 用途 |
| --- | --- | --- |
| `tern.on("command_started" / "command_finished" / "pane_exited")` | Host | 为每个窗格的命令计时，包括没有窗口显示的窗格 |
| `EffectCx:toast` | Host | “cargo build --release finished in 1m 12s” |
| `tern.kv` | Host | 由单一写入方维护历史记录和阈值 |
| 带有 `title`、`view`、`key`、`event` 的 `tern.block.define` | Host | Slow Commands 块、其停靠栏和按键 |
| `tern.timer`, `BlockCx:render` | Host | 实时运行时长，仅在有命令运行时 |
| `tern.command`, `tern.bind` | Window | “Show slow commands”及其快捷键 |
| `cx.session:panes()`, `cx.layout:focus`, `cx:new_block` | Window | 聚焦块或打开块 |
| 窗口事件、`cx.session:focused()`、`cx.session:panes()` | Window | 根据当前快照刷新焦点和命令活动状态 |
| `tern.chrome.status`, `tern.chrome.refresh`, `tern.timer` | Window | 显示聚焦窗格运行时长的状态栏片段，每秒更新一次 |
| `require("./common")` | 两端 | 共享解析和格式化 |

## 安装

```sh
tern plugin install github.com/stencil-hq/tern-sdk/plugins/examples/longrun
```

修改时，克隆 SDK 并改为链接该目录，这样 Tern 会在每次保存时重新加载：

```sh
git clone https://github.com/stencil-hq/tern-sdk
tern plugin link tern-sdk/plugins/examples/longrun
```

计时来自 Shell 集成的提示符标记，因此窗格必须启用该功能（默认启用）。运行 `sleep 20` 并等待提示，然后按 `cmd+alt+shift+l`（非 macOS 上为 `ctrl+alt+shift+l`）查看该块。

## 设计

### 为什么工作由 Host 端负责

守护进程自行测量每条命令：当 Shell 报告命令行结束时，守护进程会发出 `command_finished`，其中包含退出状态和 `took_ms`（自匹配的 `command_started` 起经过的时间）。两端都能接收这些事件，而 `longrun` 有意在 Host 端记录它们：

| 关注点 | Host 端 | Window 端 |
| --- | --- | --- |
| 接收事件的窗格 | 守护进程的所有窗格，包括没有窗口显示的会话 | 仅其自身窗口的窗格，且仅在窗口打开时 |
| `tern.kv` 写入方 | 每个守护进程一个 VM | 每个窗口一个 VM，因此每个打开的窗口都会写入一条历史记录 |
| 命令目录 | `command_started` 携带 `cwd` | 事件中没有 `cwd` |

即使某个会话的窗口已关闭，在其中完成的构建仍会进入历史记录；如果有窗口打开，提示会发送到该窗格窗口键对应的每个窗口。Window 端只负责需要窗口的工作：命令、快捷键和状态栏片段。它会接收自身窗格的相同事件，这正是该片段所需的全部信息。

### 判断哪些命令运行缓慢

`command_finished` 会将 `took_ms` 与阈值比较；每次事件都会从 kv 读取 `threshold_ms`，因此块上的 `+` 和 `-` 按键会立即生效。某些程序会被排除：编辑器、分页器、`ssh` 会话或 REPL 会一直运行到你退出为止，提示“vim finished in 41m”只会造成干扰。`common.interactive` 会找出命令行运行的程序（跳过 `VAR=value` 前缀以及 `sudo`、`env` 和 `time` 等包装器），并与列表比对。解释器只有在未提供脚本时才算交互式：`python` 是提示符，`python train.py` 则是作业。

时长采用自然的表达方式：十秒以内为 `8.4s`，以及 `42s`、`1m 12s`、`2h 5m`。失败时会以错误色调显示提示，并在次要行首显示退出状态。

### 历史记录

历史记录是一个 Lua 数组，在 Host 端加载时从 kv 读取一次，并在每次变更后整体写回。每条记录保留命令行、目录、`took_ms`、退出状态以及结束时的 `os.time()`，因此块可以在今天显示“14:02”，其他日期则显示“Mar 03 14:02”。最新记录排在最前，数组最多保留 50 条，以保持 `kv.json` 较小：kv 每次 `set` 都会重写整个文件。

`cwd` 来自钩子为该窗格观察到的 `command_started`。如果插件在命令运行期间加载，则没有该值，此时改由 `tern.pane.list()` 提供窗格当前目录。

### 块及其时钟

Slow Commands 块包含两部分：“Running now”列出至少运行一秒的命令及其经过时间；另一部分是历史记录表。标题会统计历史记录数量（“Slow Commands (12)”）。

经过时间必须持续变化，但 Tern 仅会在某个处理器（`init`、`key`、`event`、`resize`）运行后、窗格大小变化后，或调用 `cx:render()` 后，才运行块的 `view`。Host 会从 `init` 起保留每个打开块的 `BlockCx`（块的 `cx` 生命周期长于接收它的调用），并且只有在至少一个块打开且至少一条命令运行时，`schedule()` 才会启动每秒一次的 `tern.timer`。计时器会重新渲染块并再次安排自身。命令完成或 Shell 退出导致最后一条运行中的命令结束时，会立即取消计时；下一次计时会清理已关闭的块，并在没有剩余块时停止。没有命令运行时，`longrun` 不运行计时器。

历史记录和阈值变更也会调用 `refresh()`：在一个块中清除历史会更新其他所有已打开块的历史和计数；更改阈值则会更新所有块的标签，即使没有命令运行且没有安排计时器。每个视图都会将自身的选中项限制在当前历史记录范围内。

插件块没有关闭回调。`prune()` 会丢弃窗格不再出现在 `tern.pane.list()` 中的块，但会等待两秒，因为 `init` 可能早于守护进程列出新窗格。

按键遵循列表惯例：`↑`/`↓` 或 `j`/`k` 选择，`Enter` 复制所选命令行，`c` 清除历史记录，`+`/`-` 以五秒为步长更改阈值。停靠栏会重复这些按键并提供 Copy 和 Clear 徽标，其 `actions.click` 名称会以 `{ev = "action", act = ...}` 的形式进入块的 `event` 处理器。Copy 徽标的 action 是 `copy_line`，而非 `copy`：`copy` 是 Tern 自带的[动作](../guides/views.md#操作与事件)，用于复制徽标自身的文本，不会传递给插件。`key` 处理器对处理的按键返回 `true`，其他按键返回 `false`：恰好返回 `false` 就是在告知 Tern 该按键没有改变任何内容，因此 Tern 会跳过渲染和保存。

### 打开块

“Show slow commands”首先查找此窗口中标题以“Slow Commands”开头的窗格并将其聚焦；否则调用 `cx:new_block("longrun.slow", nil, "tab")` 打开一个块。如果窗格所在的 Host 上没有已加载插件定义该 kind（例如窗口连接到未安装 `longrun` 的远程 Host），`new_block` 会返回 `nil`，命令会改为发出提示，而不是静默失败。

manifest 在该块上设置了 `palette = false`，因此命令面板只显示命令，不会再显示“New Slow Commands block”一项。

### 持续更新的状态栏片段

聚焦窗格运行命令时，状态栏会显示程序及其运行时长，例如“cargo · 1m 12s”，并持续递增；点击它会运行 `plugin.longrun.show`，打开该块。

Window 端会根据窗口的 `command_started` 和 `command_finished` 事件维护自己的 `running` 表：记录程序（`common.program`，因此 `FOO=1 cargo build` 会显示 `cargo`）以及开始时的 `tern.now()`。与历史记录一样，交互式程序会被排除。它会在每个相关窗口事件（包括 `command_started`）发生时通过 `cx.session:focused()` 刷新焦点，而不是依赖启动事件。

插件重新加载时，可能保留同一个聚焦窗格而不发出 `window_start` 或 `focus`；下一条命令仍会启动计时。

状态格式化器接收 `{pane, cwd, program, title, busy}`，Tern 会按输入缓存其结果，但运行时长取决于时钟，而时钟并非输入的一部分。该片段通过以下方式保持最新：

- `schedule()` 仅在聚焦窗格存在已观察到的运行命令时，才会启动唯一一个每秒一次的 `tern.timer`。回调会收到新的 `WindowCx`；它刷新焦点并检查 `cx.session:panes()`，对于不存在或 `busy` 快照为 false 的窗格会丢弃其运行记录。随后即使命令已经结束，也会调用 `tern.chrome.refresh()` 来清除最后缓存的片段；只有聚焦命令仍在运行时才会再次安排计时。
- 如果 Shell 退出时没有提供下一条提示符标记，可能不会发出窗口 `command_finished`。其快照仍会变为空闲。下一次计时会检测到这一点并停止；即使程序和标题未变，格式化器也会在 `busy` 输入变化时立即隐藏空闲窗格的片段。
- 命令完成、窗格关闭和焦点变化都会协调快照，并立即取消不再需要的计时。命令开始/结束以及窗格关闭会使 chrome 缓存失效，因此不会显示先前运行的缓存时长。聚焦一个已观察到正在运行的窗格会重新启动其时钟。

上下文不会跨回调保留。只有当前聚焦且正在运行的命令才会驱动快照检查：空闲窗口不运行计时器（包括重新加载之后），远程窗格也适用相同的快照机制。

格式化器在命令运行的第一秒不返回内容，因此快速命令不会闪现片段；一分钟内显示整秒（`42s`），之后使用 `common.duration` 的格式 `1m 12s` 和 `2h 5m`。规则见[Chrome 与样式](../guides/chrome.md#刷新)。

## 限制

- 未启用 Shell 集成的窗格不会报告命令，因此不会进行计时。
- 片段只会为 Window 端观察到开始的命令计时：窗口打开或插件重新加载时已经运行的命令，在下一条命令开始前不会显示片段。
- 历史记录和阈值属于守护进程所在机器（`<state>/plugin-data/longrun/kv.json`）。

## 代码

`plugin.toml`：

```toml
schema = 1
id = "longrun"
name = "Long-Running Commands"
version = "0.1.0"
description = "Toasts when a slow command finishes and lists recent slow commands."
icon = "clock"
host = "host.luau"
window = "window.luau"

[[blocks]]
id = "slow"
title = "Slow Commands"
# The window half's "Show slow commands" command opens it.
palette = false
```

`common.luau`、由两端共同引用：

```lua
--!strict
-- Helpers both halves of longrun require: reading a command line's program
-- and writing durations the way people say them.

local common = {}

-- Words that run another program: the program is the next word.
local WRAPPERS: { [string]: boolean } = {
	sudo = true,
	env = true,
	time = true,
	nice = true,
	nohup = true,
	command = true,
	exec = true,
	caffeinate = true,
}

-- Programs that stay open until you leave them. Their run time measures how
-- long you used them, not how long you waited, so they are never "slow".
common.INTERACTIVE = {
	vi = true,
	vim = true,
	nvim = true,
	hx = true,
	nano = true,
	emacs = true,
	less = true,
	more = true,
	man = true,
	ssh = true,
	mosh = true,
	tmux = true,
	screen = true,
	top = true,
	htop = true,
	btop = true,
	watch = true,
	fzf = true,
	lazygit = true,
	tig = true,
	ipython = true,
	psql = true,
	mysql = true,
	sqlite3 = true,
	["redis-cli"] = true,
	omp = true,
}

-- Interpreters that are a prompt when run bare and a job when given a
-- script: `python` waits for you, `python train.py` makes you wait.
local REPLS: { [string]: boolean } = {
	python = true,
	python3 = true,
	node = true,
	irb = true,
	lua = true,
}

-- The program a command line runs (the first word that is not a
-- `VAR=value` prefix, a wrapper or a wrapper's flag, without its
-- directory), and whether more words follow it.
function common.program(line: string): (string?, boolean)
	local at = 1
	while true do
		local from, to, word = string.find(line, "(%S+)", at)
		if from == nil then
			return nil, false
		end
		local w = word :: string
		local assignment = string.find(w, "^[%a_][%w_]*=") ~= nil
		local flag = string.sub(w, 1, 1) == "-"
		if not assignment and not flag and not WRAPPERS[w] then
			local rest = string.sub(line, (to :: number) + 1)
			return string.match(w, "([^/]+)$"), string.find(rest, "%S") ~= nil
		end
		at = (to :: number) + 1
	end
end

-- Whether `line` runs a program you use rather than wait for: one
-- `INTERACTIVE` lists, or a bare interpreter.
function common.interactive(line: string): boolean
	local program, args = common.program(line)
	if program == nil then
		return false
	end
	return common.INTERACTIVE[program] == true or (REPLS[program] == true and not args)
end

-- `ms` as "8.4s", "42s", "1m 12s" or "2h 5m".
function common.duration(ms: number): string
	if ms < 10000 then
		return string.format("%.1fs", ms / 1000)
	end
	local seconds = math.floor(ms / 1000)
	if seconds < 60 then
		return string.format("%ds", seconds)
	end
	local minutes = seconds // 60
	if minutes < 60 then
		return string.format("%dm %ds", minutes, seconds % 60)
	end
	return string.format("%dh %dm", minutes // 60, minutes % 60)
end

-- `path` with the home directory written `~`.
function common.tilde(path: string, home: string?): string
	if home and home ~= "" then
		if path == home then
			return "~"
		end
		if string.sub(path, 1, #home + 1) == home .. "/" then
			return "~" .. string.sub(path, #home + 1)
		end
	end
	return path
end

-- `text` cut to `max` characters, the last one an ellipsis.
function common.clip(text: string, max: number): string
	local length = utf8.len(text)
	if length == nil then -- not UTF-8: count bytes
		return if #text <= max then text else string.sub(text, 1, max - 1) .. "…"
	end
	if length <= max then
		return text
	end
	local cut = utf8.offset(text, max) or (#text + 1)
	return string.sub(text, 1, cut - 1) .. "…"
end

return common
```

`host.luau`：

```lua
--!strict
-- longrun, host half: a `command_finished` hook that toasts when a command
-- took longer than the threshold and keeps the last 50 such commands in
-- `tern.kv`, and the "Slow Commands" block that lists them beside the
-- commands running right now.

local common = require("./common")
local ui = tern.ui

local DEFAULT_THRESHOLD_MS = 15000
local STEP_MS = 5000
local KEEP = 50
local HOME = tern.getenv("HOME")

-- A finished slow command, as stored under kv `history` (newest first).
type Record = {
	line: string,
	cwd: string?,
	took_ms: number,
	status: number,
	at: number, -- os.time() when it finished
}

-- A command a shell is running now.
type Run = {
	line: string,
	cwd: string?,
	started: number, -- tern.now() when it started
}

-- An open Slow Commands block.
type Open = {
	cx: BlockCx,
	since: number,
}

type State = {
	selected: number,
}

local function threshold(): number
	local value = tern.kv.get("threshold_ms")
	return if type(value) == "number" and value > 0 then value else DEFAULT_THRESHOLD_MS
end

-- The history, read once; every change writes it back.
local slow: { Record } = tern.kv.get("history") or {}
-- Commands running now, by pane.
local running: { [number]: Run } = {}
-- Open blocks, by pane.
local blocks: { [number]: Open } = {}
-- The pending re-render tick, while one is scheduled.
local tick: TimerHandle? = nil

local function cwd_of(pane: number): string?
	for _, info in tern.pane.list() do
		if info.pane == pane then
			return info.cwd
		end
	end
	return nil
end

-- Drops blocks whose pane is gone. A block registers in `init`, which can
-- run before the daemon lists its pane, so young entries are kept.
local function prune()
	local live: { [number]: boolean } = {}
	for _, info in tern.pane.list() do
		live[info.pane] = true
	end
	local now = tern.now()
	for pane, open in blocks do
		if not live[pane] and now - open.since > 2000 then
			blocks[pane] = nil
		end
	end
end

-- Re-renders every open block.
local function refresh()
	prune()
	for _, open in blocks do
		open.cx:render()
	end
end

-- Ticks once a second while a block is open and a command runs, so the
-- elapsed times move; stops by itself when either is no longer true.
local function schedule()
	if next(running) == nil or next(blocks) == nil then
		if tick ~= nil then
			tick:cancel()
			tick = nil
		end
		return
	end
	if tick ~= nil then
		return
	end
	tick = tern.timer(1000, function()
		tick = nil
		refresh()
		schedule()
	end)
end

local function remember(record: Record)
	table.insert(slow, 1, record)
	while #slow > KEEP do
		table.remove(slow)
	end
	tern.kv.set("history", slow)
end

tern.on("command_started", function(ev: CommandStartedEvent, _cx: EffectCx)
	running[ev.pane] = { line = ev.line, cwd = ev.cwd, started = tern.now() }
	schedule()
end)

tern.on("command_finished", function(ev: CommandFinishedEvent, cx: EffectCx)
	local run = running[ev.pane]
	running[ev.pane] = nil
	if ev.took_ms >= threshold() and not common.interactive(ev.line) then
		local cwd = if run then run.cwd else cwd_of(ev.pane)
		remember({ line = ev.line, cwd = cwd, took_ms = ev.took_ms, status = ev.status, at = os.time() })
		local line = common.clip(ev.line, 60)
		local took = common.duration(ev.took_ms)
		local where = if cwd then common.tilde(cwd, HOME) else nil
		if ev.status == 0 then
			cx:toast("success", string.format("%s finished in %s", line, took), where)
		else
			local sub = string.format("exit %d", ev.status) .. (if where then " · " .. where else "")
			cx:toast("error", string.format("%s failed after %s", line, took), sub)
		end
	end
	refresh()
	schedule()
end)

tern.on("pane_exited", function(ev: PaneExitedEvent, _cx: EffectCx)
	running[ev.pane] = nil
	refresh()
	schedule()
end)

-- Block views.

local function badge(text: string, tone: string, action: string): Node
	local node = ui.badge(text, tone)
	local props: { [string]: any } = node.p or {}
	props.actions = { click = action }
	node.p = props
	return node
end

local function when(at: number): string
	if os.date("%Y-%m-%d", at) == os.date("%Y-%m-%d") then
		return os.date("%H:%M", at)
	end
	return os.date("%b %d %H:%M", at)
end

local function running_view(): Node?
	local now = tern.now()
	local runs: { Run } = {}
	for _, run in running do
		-- Under a second is noise; interactive programs aren't waits.
		if now - run.started >= 1000 and not common.interactive(run.line) then
			table.insert(runs, run)
		end
	end
	if #runs == 0 then
		return nil
	end
	table.sort(runs, function(a: Run, b: Run)
		return a.started < b.started
	end)
	local rows = {}
	for _, run in runs do
		table.insert(rows, {
			{ ui.span(run.line, "mono") },
			{ ui.span(if run.cwd then common.tilde(run.cwd, HOME) else "", "muted") },
			{ ui.span(common.duration(now - run.started), "num accent") },
		})
	end
	local cols: { Col } = {
		{ id = "command", head = "Command", grow = 1 },
		{ id = "cwd", head = "Directory", truncate = "start", priority = -1 },
		{ id = "elapsed", head = "Running", align = "end" },
	}
	return ui.section("Running now", { ui.table(cols, rows) })
end

local function history_view(state: State): Node
	if #slow == 0 then
		return ui.text({
			ui.span(string.format("No command has taken %s or longer yet.", common.duration(threshold())), "muted"),
		})
	end
	local rows = {}
	for i, record in slow do
		local mark = if i == state.selected then ui.span("›", "accent strong") else ""
		local status = if record.status == 0
			then ui.span("ok", "success")
			else ui.span(string.format("exit %d", record.status), "error")
		table.insert(rows, {
			{ mark },
			{ ui.span(record.line, if i == state.selected then "mono strong" else "mono") },
			{ ui.span(if record.cwd then common.tilde(record.cwd, HOME) else "", "muted") },
			{ ui.span(common.duration(record.took_ms), "num") },
			{ status },
			{ ui.span(when(record.at), "muted num") },
		})
	end
	local cols: { Col } = {
		{ id = "mark", head = "" },
		{ id = "command", head = "Command", grow = 1 },
		{ id = "cwd", head = "Directory", truncate = "start", priority = -1 },
		{ id = "took", head = "Took", align = "end" },
		{ id = "status", head = "Status" },
		{ id = "when", head = "When", align = "end", priority = -2 },
	}
	return ui.table(cols, rows)
end

local function dock(): Node
	return ui.row({
		ui.text({
			ui.span("↑↓", "strong"),
			ui.span(" select  ", "muted"),
			ui.span("⏎", "strong"),
			ui.span(" copy  ", "muted"),
			ui.span("c", "strong"),
			ui.span(" clear  ", "muted"),
			ui.span("+ −", "strong"),
			ui.span(string.format(" threshold %s", common.duration(threshold())), "muted"),
		}),
		-- Not "copy": that is Tern's own action and would copy the badge's text.
		badge("Copy", "accent", "copy_line"),
		badge("Clear", "muted", "clear"),
	})
end

local function copy(state: State, cx: BlockCx)
	local record = slow[state.selected]
	if record then
		cx:copy(record.line)
		cx:toast("info", "Copied", common.clip(record.line, 60))
	end
end

local function clear(state: State)
	table.clear(slow)
	tern.kv.set("history", nil)
	state.selected = 1
	refresh()
end

local function nudge(delta: number)
	local value = math.max(STEP_MS, threshold() + delta)
	tern.kv.set("threshold_ms", value)
	refresh()
end

tern.block.define("slow", {
	init = function(cx: BlockCx, _args: { string }, _saved: any): State
		blocks[cx.pane] = { cx = cx, since = tern.now() }
		schedule()
		return { selected = 1 }
	end,
	title = function(_state: State): string?
		return if #slow > 0 then string.format("Slow Commands (%d)", #slow) else "Slow Commands"
	end,
	view = function(state: State, _cx: BlockCx): BlockView
		state.selected = math.clamp(state.selected, 1, math.max(1, #slow))
		local parts: { Node } = {}
		local now = running_view()
		if now then
			table.insert(parts, now)
		end
		table.insert(parts, history_view(state))
		return { main = ui.col(parts), dock = dock() }
	end,
	key = function(state: State, key: Key, cx: BlockCx): boolean?
		local press = key.text or key.name
		if key.name == "up" or press == "k" then
			state.selected = math.max(1, state.selected - 1)
		elseif key.name == "down" or press == "j" then
			state.selected = math.min(math.max(1, #slow), state.selected + 1)
		elseif key.name == "enter" then
			copy(state, cx)
		elseif press == "c" then
			clear(state)
		elseif press == "+" or press == "=" then
			nudge(STEP_MS)
		elseif press == "-" then
			nudge(-STEP_MS)
		else
			return false
		end
		return true
	end,
	event = function(state: State, ev: UiEvent, cx: BlockCx)
		if ev.ev ~= "action" then
			return
		end
		if ev.act == "copy_line" then
			copy(state, cx)
		elseif ev.act == "clear" then
			clear(state)
		end
	end,
})
```

`window.luau`：

```lua
--!strict
-- longrun, window half: the "Show slow commands" command and its key, and a
-- status line segment with the focused pane's running command and how long
-- it has been running, ticking once a second.

local common = require("./common")

local BLOCK = "longrun.slow"
local ACTION = "plugin.longrun.show"
-- The segment appears once a command has run this long, so quick commands
-- don't flash it.
local SHOW_AFTER_MS = 1000

-- A command running in one of this window's panes.
type Run = {
	program: string,
	started: number, -- tern.now() when it started
}

-- Commands running now, by pane. Only commands this window half saw start:
-- one already running when the plugin loaded has no entry.
local running: { [number]: Run } = {}
-- The focused pane, refreshed from the current session on events and ticks.
local focused: number? = nil
-- The pending tick, while one is scheduled.
local tick: TimerHandle? = nil

local function show(cx: WindowCx)
	-- Focus a Slow Commands block this window already shows, else open one.
	for _, pane in cx.session:panes() do
		if string.find(pane.title, "^Slow Commands") then
			cx.layout:focus(pane.pane)
			return
		end
	end
	if cx:new_block(BLOCK, nil, "tab") == nil then
		cx:toast("error", "Slow Commands is unavailable", "The longrun host half isn't loaded on this host.")
	end
end

tern.command({
	id = "show",
	title = "Show slow commands",
	icon = "clock",
	run = show,
})

tern.bind(if tern.runtime.os == "macos" then "cmd+alt+shift+l" else "ctrl+alt+shift+l", ACTION)

-- A reload need not emit window_start or focus. Every event and timer gets
-- a fresh context; never retain one. Snapshots also detect shell exits that
-- supplied no command_finished prompt mark.
local function reconcile(cx: WindowCx)
	focused = cx.session:focused()
	local busy: { [number]: boolean } = {}
	for _, pane in cx.session:panes() do
		busy[pane.pane] = pane.busy == true
	end
	for pane in running do
		if not busy[pane] then
			running[pane] = nil
		end
	end
end

-- Exactly one timer while the focused pane has an observed running command.
local function schedule()
	if focused == nil or running[focused :: number] == nil then
		if tick ~= nil then
			tick:cancel()
			tick = nil
		end
		return
	end
	if tick ~= nil then
		return
	end
	tick = tern.timer(1000, function(cx: WindowCx?)
		tick = nil
		reconcile(cx :: WindowCx)
		-- Refresh even when reconciliation removed the run, to erase its
		-- last cached segment before stopping the clock.
		tern.chrome.refresh()
		schedule()
	end)
end

tern.on("window_start", function(cx: WindowCx)
	reconcile(cx)
	schedule()
end)

tern.on("focus", function(_ev: FocusEvent, cx: WindowCx)
	reconcile(cx)
	schedule()
end)

tern.on("command_started", function(ev: CommandStartedEvent, cx: WindowCx)
	reconcile(cx)
	if not common.interactive(ev.line) then
		running[ev.pane] = { program = common.program(ev.line) or ev.line, started = tern.now() }
	end
	-- Drop any cached answer from an earlier run with the same input.
	tern.chrome.refresh()
	schedule()
end)

tern.on("command_finished", function(ev: CommandFinishedEvent, cx: WindowCx)
	running[ev.pane] = nil
	reconcile(cx)
	tern.chrome.refresh()
	schedule()
end)

tern.on("pane_closed", function(ev: PaneEvent, cx: WindowCx)
	running[ev.pane] = nil
	reconcile(cx)
	tern.chrome.refresh()
	schedule()
end)

-- Whole seconds under a minute, then as `common.duration` writes them.
local function elapsed(ms: number): string
	if ms < 60000 then
		return string.format("%ds", ms // 1000)
	end
	return common.duration(ms)
end

-- The formatter's answer depends on the clock, which is not part of its
-- input ({pane, cwd, program, title, busy}), so Tern would keep showing its first
-- answer: the timer above calls `tern.chrome.refresh()` to drop it.
tern.chrome.status(function(pane: PaneInfo): { StatusSegment }?
	-- busy changes the formatter input even if program/title happen to stay
	-- identical (for example a command that runs the login shell itself).
	if not pane.busy then
		running[pane.pane] = nil
		schedule()
		return nil
	end
	local run = running[pane.pane]
	if run == nil then
		return nil
	end
	local ms = tern.now() - run.started
	if ms < SHOW_AFTER_MS then
		return nil
	end
	return {
		{
			text = string.format("%s · %s", run.program, elapsed(ms)),
			icon = "clock",
			tone = "muted",
			command = ACTION,
		},
	}
end)
```
