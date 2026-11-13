# 审核队列

`review-queue` 会将等待你审核的 pull request 保存在一个块中：它每两分钟运行一次 GitHub CLI 的 `gh search prs --review-requested=@me`，并列出结果及其仓库、标题、作者、创建至今的时长和草稿状态。它展示了如何通过后台进程为长期运行的块提供数据，以及如何通过窗口命令打开块。

## 示例演示内容

| 接口 | 端 | 用途 |
| --- | --- | --- |
| `tern.block.define` 与 `init`、`title`、`view`、`key`、`event`、`save` | Host | Review Queue 块 |
| `tern.process.run` 与 `timeout_ms`、`env` | Host | 在工作线程之外运行 `gh` |
| `tern.timer`、`TimerHandle:cancel`、`BlockCx:render`、`tern.pane.list` | Host | 每次块运行各自的一条轮询链，在重启或关闭时停止 |
| `tern.json.decode` | Host | 读取 `gh` 的 JSON |
| `ui.list` 与 `selected`、`max` 和带键的项目 | Host | 列表、光标和点击事件 |
| `ui.card`、`ui.md`、`ui.code`、徽标 `actions` | Host | 带 Retry 和 Install 按钮的错误视图 |
| `BlockCx:open` | Host | 在浏览器中打开 pull request |
| `save` 和 `init` 的 `saved` | Host | 记住是否显示草稿 |
| `tern.command`、`tern.bind` | Window | “Open review queue”及其快捷键 |
| `cx.session:panes()`、`cx.layout:focus`、`cx:new_block` | Window | 聚焦已打开的队列，或打开一个新队列 |

## 安装

该块会在运行窗格的机器（守护进程的 host）上运行 `gh`，因此请在该机器上安装 [GitHub CLI](https://cli.github.com)，并使用 `gh auth login` 登录。然后运行：

```sh
tern plugin install github.com/stencil-hq/tern-sdk/plugins/examples/review-queue
```

修改代码时，请克隆 SDK 并链接该目录，这样 Tern 会在每次保存时重新加载它：

```sh
git clone https://github.com/stencil-hq/tern-sdk
tern plugin link tern-sdk/plugins/examples/review-queue
```

按 `alt+shift+cmd+r`，或从命令面板运行 **Open review queue**。

## 设计

### 运行 `gh` 而不阻塞

每次调用 host 插件都会在其工作线程上运行，预算为 2 秒，而 GitHub 搜索可能耗时更久。`tern.process.run` 会在池线程上启动程序并立即返回；其回调稍后会在工作线程上携带结果运行。第一个结果到达前，块会显示进度条。每个回调首先检查其状态是否仍属于块的当前运行，然后以 `state.cx:render()` 结束，因为只有在处理器之后，Tern 才会自行重新运行 `view`。

```lua
tern.process.run(argv, opts, function(result: ProcessResult, _)
	done(result)
end)
```

守护进程启动的程序需要关注以下选项：

| 选项 | 原因 |
| --- | --- |
| `timeout_ms = 30000` | 挂起的网络调用会以 `timed_out` 结束，不会让块永远处于“刷新中” |
| `GH_PROMPT_DISABLED=1` | `gh` 不会在它无法访问的终端上等待输入 |
| `GH_NO_UPDATE_NOTIFIER=1`、`NO_COLOR=1` | stderr 会保持为纯错误消息，便于块显示 |

由 launchd 或 systemd 启动的守护进程通常具有较短的 `PATH`。该块会先按名称尝试运行 `gh`，然后尝试磁盘上存在的常见安装位置（`/opt/homebrew/bin`、`/usr/local/bin`、Linuxbrew、`/usr/bin`）。如果无法启动程序，`tern.process.run` 会抛出错误，因此每次尝试都会在 `pcall` 下运行；只有所有尝试均失败时，该块才会报告缺少 `gh`。

### 轮询与停止

`init` 会将状态注册到以 pane ID 为键的 `running` 表中，启动首次刷新，并存储一个 2 分钟的 `tern.timer` 句柄。重启会保留相同的 pane ID，因此仅凭窗格是否存在无法判断其生命周期：状态对象还必须与 `running[state.cx.pane]` 匹配。

替换用的 `init` 会先停止旧状态，再注册新状态：它只取消旧状态的计时器，并释放其 PR 列表。每次刷新、进程回调和计时器回调都会检查状态对象的身份。过期回调无法更新列表、渲染、启动另一个请求或重新设置计时器；也无法移除或取消替代它的状态或计时器。

插件块没有关闭回调，因此存活的回调还会检查 `tern.pane.list()`。窗格消失时，回调会停止其状态并取消尚未触发的计时器。如果没有待处理的进程，这项清理会在下一个 2 分钟计时点发生。此 API 没有取消已启动进程的句柄：进程会运行完毕或达到现有的 30 秒超时，其过期结果则会被忽略。

计时器会在刷新并设置下一个计时器之前清除自己的句柄，从而确保每次当前运行最多只有一个待处理计时器。`loading` 标志可防止手动刷新（`r`、Retry）在已有 `gh` 运行时再启动一个。

### 区分故障

一次失败的运行会转换为 `Problem`，共有三种类型，每种都有各自的标题和建议：

| 类型 | 检测方式 | 视图显示 |
| --- | --- | --- |
| `missing` | 没有候选 `gh` 能够启动 | “GitHub CLI not found”，并附 Install guide 按钮 |
| `auth` | 退出状态为 4（`gh` 的“authentication required”），或 stderr 提到 `gh auth login`、`GH_TOKEN` 或 HTTP 401 | “GitHub CLI not signed in”：运行 `gh auth login`，然后按 `r` |
| `failed` | 其他任何情况，包括超时或 JSON 不是列表 | “Could not load review requests”，并显示 stderr 的首几行 |

首次成功加载之前，问题会以卡片形式占满块，并带有 Retry 按钮（若为 `missing`，还会带有 Install guide 按钮）。列表至少成功加载过一次后，若之后发生故障，屏幕上会保留上一次列表，并将问题添加到停靠栏；短暂中断期间，带警告的过期数据比错误页面更有用。

### 列表

`ui.list` 会绘制各行；随后块会为每个项目设置 `owner/repo#number` 形式的 `key`，并将列表自身的键设为 `queue`。节点 ID 根据键构建，因此无论下一次轮询时列表如何重排，每行的 ID 都是 `main.queue.<owner/repo#number>`。列表的 `selected` 属性指定的就是该 ID，`select`（点击）和 `activate`（双击）事件也会通过 `ev.item` 携带该 ID，因此光标会跟随某个 pull request，而不是某个位置。选中的 pull request 消失时，光标会移到第一行。

块的两项绘制细节会影响视图：

- 区域绘制的是 `view` 返回节点的子节点，而不是该节点本身。如果直接将列表作为 `main` 返回，列表就会失去选中状态和事件，因此 `main` 始终是用 `ui.col({ … })` 包裹列表、卡片或进度条。
- 只有列表自行滚动时，它才会让选中行保持在视图内；只有设置了 `max` 高度时，它才会自行滚动。该块根据 `cx.rows` 设置 `max = { lines = … }`。它不需要 `resize` 处理器：窗格大小变化时，Tern 会再次运行 `view`，高度也会随之调整。

行标签会将仓库和编号放在标题之前，右对齐的值则显示作者和创建至今的时长。列表项的 `detail` 只能使用标签剩余的空间，因此长标题会挤掉放在其中的内容。草稿以 `draft` 标记开头，并使用 muted 色调。

`age` 列需要 pull request 的创建时间（Unix 时间）。`gh` 会输出 UTC 时区的 ISO 8601 时间，而向 `os.time` 传入表时，它会按本地时间解释，因此 `epoch` 使用 days-from-civil 算法转换日期。

### 快捷键与保存的状态

| 快捷键 | 操作 |
| --- | --- |
| `↑`/`↓`、`k`/`j` | 移动 |
| `PageUp`/`PageDown`、`Home`/`End`、`g`/`G` | 跳转 |
| `Enter`、`o` | 打开 pull request（`cx:open(url)`） |
| `r` | 立即刷新 |
| `d` | 显示或隐藏草稿 |

处理器会忽略 Ctrl、Alt 或 Cmd 按下时的按键；对于不处理的按键，它会返回 `false`，因此这些按键不会触发渲染或保存；对于处理的每个按键，它都会返回 `true`。

草稿是否显示是该块唯一保存的状态：`save` 会返回 `{drafts = …}`，`init` 会在重启后从 `saved` 中读取该值。Tern 会在每次处理器运行后调用 `save`，且仅在结果发生变化时保存，因此块本身从不调用 `cx:save()`。

### Window 端

Window 端会添加一个命令面板命令并绑定快捷键：

```lua
tern.command({ id = "open", title = "Open review queue", icon = "merge", run = open_queue })
tern.bind("alt+shift+cmd+r", "plugin.review-queue.open")
```

每个已打开的队列都会轮询 GitHub，因此 `open_queue` 会先遍历 `cx.session:panes()`，查找标题为“Review Queue…”的窗格并聚焦它。否则，`cx:new_block("review-queue.queue", nil, "beside")` 会在当前聚焦窗格旁打开一个队列。如果运行窗口窗格的 host 没有该块类型（插件安装在当前窗口所在的机器上，却没有安装在该窗口所连接的远程 host 上），`new_block` 会返回 `nil`，命令会通过 toast 说明这一点。如果插件绑定的快捷键与键盘预设已有快捷键冲突，该绑定会被忽略，并在日志中发出警告；参见[命令、按键与覆盖](../guides/commands.md)。

## 限制

- 搜索最多请求 100 个结果（`--limit=100`）。
- 新的审核请求会在下一次轮询时出现，最多延迟两分钟；也可以按 `r` 立即刷新。
- 每个已打开的队列都会各自轮询；该命令会将每个窗口中的队列限制为一个，但其他窗口仍可打开自己的队列。

## 代码

`plugin.toml`：

```toml
schema = 1
id = "review-queue"
name = "Review Queue"
version = "1.0.0"
description = "Pull requests waiting for your review, from the GitHub CLI."
icon = "merge"
host = "host.luau"
window = "window.luau"

[[blocks]]
id = "queue"
title = "Review Queue"
```

`host.luau`：

```lua
--!strict
-- The `queue` block: open pull requests that request your review, read from
-- `gh search prs` and refreshed every two minutes.
--
-- Keys: ↑/↓ (or k/j) move, Home/End jump, Enter (or o) opens the pull
-- request, r refreshes, d shows or hides drafts.

local ui = tern.ui

local POLL_MS = 2 * 60 * 1000
local GH_TIMEOUT_MS = 30 * 1000
local INSTALL_URL = "https://cli.github.com"

local SEARCH = {
	"search",
	"prs",
	"--review-requested=@me",
	"--state=open",
	"--limit=100",
	"--json=number,title,url,repository,author,createdAt,isDraft",
}

-- `gh` by name first, then where package managers put it: a daemon started
-- by launchd or systemd often has a PATH without those directories.
local GH = {
	"gh",
	"/opt/homebrew/bin/gh",
	"/usr/local/bin/gh",
	"/home/linuxbrew/.linuxbrew/bin/gh",
	"/usr/bin/gh",
}

type Pr = {
	key: string,
	repo: string,
	number: number,
	title: string,
	author: string,
	url: string,
	created: number,
	draft: boolean,
}

-- Why the list could not be loaded: `missing` (no gh), `auth` (gh is not
-- signed in) or `failed` (anything else).
type Problem = { kind: string, text: string, detail: string? }

type State = {
	cx: BlockCx,
	prs: { Pr }?,
	shown: { Pr },
	cursor: string?,
	drafts: boolean,
	loading: boolean,
	fetched: number?,
	problem: Problem?,
	timer: TimerHandle?,
}

-- A pane ID survives Restart; the state object identifies this block run.
local running: { [number]: State } = {}

local function retire(state: State)
	if running[state.cx.pane] == state then
		running[state.cx.pane] = nil
	end
	if state.timer then
		state.timer:cancel()
		state.timer = nil
	end
	-- A pending process may retain its callback until the 30-second timeout.
	-- Release the old list now; its callback must not populate it again.
	state.loading = false
	state.prs = nil
	state.shown = {}
	state.cursor = nil
	state.problem = nil
	state.fetched = nil
end

-- Seconds since the epoch of an ISO 8601 UTC time (`2026-09-30T14:03:11Z`),
-- by the days-from-civil algorithm: `os.time` with a table reads local time.
local function epoch(iso: string): number?
	local y, m, d, hh, mm, ss = string.match(iso, "^(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)")
	if not (y and m and d and hh and mm and ss) then
		return nil
	end
	local year, month, day = tonumber(y) :: number, tonumber(m) :: number, tonumber(d) :: number
	if month <= 2 then
		year -= 1
	end
	local era = year // 400
	local yoe = year - era * 400
	local doy = (153 * (if month > 2 then month - 3 else month + 9) + 2) // 5 + day - 1
	local doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
	local days = era * 146097 + doe - 719468
	return days * 86400 + (tonumber(hh) :: number) * 3600 + (tonumber(mm) :: number) * 60 + (tonumber(ss) :: number)
end

-- How long ago `t` was, compactly: `12m`, `5h`, `3d`.
local function age(t: number): string
	local s = math.max(0, os.time() - t)
	if s < 3600 then
		return math.max(1, s // 60) .. "m"
	elseif s < 86400 then
		return s // 3600 .. "h"
	end
	return s // 86400 .. "d"
end

-- Check this run first, not just its pane: Restart reuses the pane ID.
-- Blocks have no close hook, so callbacks also retire a disappeared pane.
local function alive(state: State): boolean
	if running[state.cx.pane] ~= state then
		return false
	end
	for _, p in tern.pane.list() do
		if p.pane == state.cx.pane then
			return true
		end
	end
	retire(state)
	return false
end

-- The pull requests the list shows, oldest first, and a cursor on one of them.
local function refilter(state: State)
	local shown: { Pr } = {}
	local prs: { Pr } = state.prs or {}
	for _, pr in prs do
		if state.drafts or not pr.draft then
			table.insert(shown, pr)
		end
	end
	table.sort(shown, function(a, b)
		return a.created < b.created
	end)
	state.shown = shown
	local found = false
	for _, pr in shown do
		found = found or pr.key == state.cursor
	end
	if not found then
		state.cursor = if shown[1] then shown[1].key else nil
	end
end

local function index_of(state: State): number
	for i, pr in state.shown do
		if pr.key == state.cursor then
			return i
		end
	end
	return 0
end

local function first_lines(text: string, n: number): string
	local out = {}
	for line in string.gmatch(text, "[^\n]+") do
		table.insert(out, line)
		if #out == n then
			break
		end
	end
	return table.concat(out, "\n")
end

-- What a failed `gh` run means.
local function problem_of(result: ProcessResult): Problem
	if result.timed_out then
		return { kind = "failed", text = "gh did not answer within 30 seconds." }
	end
	local err = result.stderr
	local auth = result.status == 4
		or string.find(err, "gh auth login", 1, true) ~= nil
		or string.find(err, "GH_TOKEN", 1, true) ~= nil
		or string.find(err, "HTTP 401", 1, true) ~= nil
	if auth then
		return { kind = "auth", text = "The GitHub CLI is not signed in.", detail = first_lines(err, 3) }
	end
	return {
		kind = "failed",
		text = "gh exited with status " .. result.status .. ".",
		detail = first_lines(err, 8),
	}
end

-- The pull requests in `gh`'s JSON, or nil when it isn't the expected list.
local function parse(stdout: string): { Pr }?
	local ok, data = pcall(tern.json.decode, stdout)
	if not ok or type(data) ~= "table" then
		return nil
	end
	local prs: { Pr } = {}
	for _, item in data do
		local repo = if type(item.repository) == "table" then item.repository.nameWithOwner else nil
		local number = tonumber(item.number)
		if type(repo) == "string" and number and type(item.url) == "string" then
			table.insert(prs, {
				key = repo .. "#" .. number,
				repo = repo,
				number = number,
				title = tostring(item.title or ""),
				author = if type(item.author) == "table" then tostring(item.author.login) else "?",
				url = item.url,
				created = epoch(tostring(item.createdAt or "")) or os.time(),
				draft = item.isDraft == true,
			})
		end
	end
	return prs
end

-- Starts `gh` with `args`, trying each place it may be installed; the spawn
-- error of the last attempt when none starts.
local function run_gh(args: { string }, done: (ProcessResult) -> ()): string?
	local last = "gh is not on this machine's PATH"
	for _, gh in GH do
		if gh == "gh" or tern.fs.exists(gh) then
			local argv: { string } = { gh }
			for _, a in args do
				table.insert(argv, a)
			end
			local opts: ProcessOptions = {
				timeout_ms = GH_TIMEOUT_MS,
				env = { GH_PROMPT_DISABLED = "1", GH_NO_UPDATE_NOTIFIER = "1", NO_COLOR = "1" },
			}
			local ok, err = pcall(function()
				tern.process.run(argv, opts, function(result: ProcessResult, _)
					done(result)
				end)
			end)
			if ok then
				return nil
			end
			last = tostring(err)
		end
	end
	return last
end

-- Loads the list in the background; the callback re-renders the block.
local function refresh(state: State)
	if not alive(state) or state.loading then
		return
	end
	state.loading = true
	local spawn_error = run_gh(SEARCH, function(result)
		if not alive(state) then
			return
		end
		state.loading = false
		if result.status ~= 0 then
			state.problem = problem_of(result)
		else
			local prs = parse(result.stdout)
			if prs then
				state.prs = prs
				state.problem = nil
				state.fetched = os.time()
				refilter(state)
			else
				state.problem = {
					kind = "failed",
					text = "gh printed something other than a list of pull requests.",
					detail = first_lines(result.stdout, 4),
				}
			end
		end
		state.cx:render()
	end)
	if spawn_error then
		state.loading = false
		state.problem = { kind = "missing", text = "Tern could not start the GitHub CLI.", detail = spawn_error }
	end
end

-- One pending timer per live run, canceled explicitly when it is replaced.
local function poll(state: State)
	if not alive(state) or state.timer then
		return
	end
	state.timer = tern.timer(POLL_MS, function()
		if not alive(state) then
			return
		end
		state.timer = nil
		refresh(state)
		state.cx:render()
		poll(state)
	end)
end

local function button(label: string, act: string, tone: string): Node
	local node = ui.badge(label, tone)
	local p: { [string]: any } = node.p or {}
	p.actions = { click = act }
	node.p = p
	return node
end

-- The full-pane view of a problem when there is no list to show.
local function problem_view(problem: Problem): Node
	local heads = {
		missing = "GitHub CLI not found",
		auth = "GitHub CLI not signed in",
		failed = "Could not load review requests",
	}
	local help = {
		missing = "Review Queue runs `gh search prs` on the machine that runs your panes. "
			.. "Install the GitHub CLI there, then press **r**.",
		auth = "Run `gh auth login` in a shell on this machine, then press **r**.",
		failed = "Press **r** to try again.",
	}
	local children: { Node } = { ui.md(problem.text .. " " .. (help[problem.kind] or "")) }
	if problem.detail and problem.detail ~= "" then
		table.insert(children, ui.code(problem.detail))
	end
	local buttons: { Node } = { button("Retry", "retry", "accent") }
	if problem.kind == "missing" then
		table.insert(buttons, button("Install guide", "install", "neutral"))
	end
	table.insert(children, ui.row(buttons))
	local card = ui.card({ ui.span(heads[problem.kind] or "Review Queue", "strong") }, children)
	local p: { [string]: any } = card.p or {}
	p.tone = "error"
	card.p = p
	return card
end

-- The list is keyed `queue`: its id is `main.queue` and each row's
-- `main.queue.<owner/repo#number>`, the ids `selected` and its events use.
local LIST_ID = "main.queue."

-- How many rows the list shows before it scrolls itself. A list with a
-- `max` height keeps its selected row in view; without one, `main` scrolls
-- and the cursor can leave the screen. List rows are about a third taller
-- than the pane's cells, and the dock takes about four cells.
local function list_lines(cx: BlockCx): number
	return math.max(4, math.floor((cx.rows - 4) * 0.72))
end

local function list_view(state: State): Node
	local items: { Item } = {}
	for _, pr in state.shown do
		-- A long title would squeeze out a `detail`, so the repository leads
		-- the label and the author sits in the right-aligned value.
		local label: { Span | string } = {}
		if pr.draft then
			table.insert(label, ui.span("draft  ", "warning"))
		end
		table.insert(label, ui.span(pr.repo .. "#" .. pr.number .. "  ", "muted"))
		table.insert(label, ui.span(pr.title))
		table.insert(items, {
			label = label,
			value = { ui.span("@" .. pr.author .. "  ", "muted"), ui.span(age(pr.created), "muted num") },
			icon = "merge",
			tone = if pr.draft then "muted" else nil,
		})
	end
	local list = ui.list(items)
	local kids = list.c or {}
	for i, pr in state.shown do
		local p: { [string]: any } = kids[i].p or {}
		p.key = pr.key
		kids[i].p = p
	end
	local p: { [string]: any } = list.p or {}
	p.key = "queue"
	p.selected = if state.cursor then LIST_ID .. state.cursor else nil
	p.empty = { ui.span("No pull requests are waiting for your review.", "muted") }
	p.max = { lines = list_lines(state.cx) }
	list.p = p
	return list
end

-- The dock: counts, freshness, a refresh problem, the keys.
local function dock_view(state: State): Node
	local total = if state.prs then #state.prs else 0
	local hidden = total - #state.shown
	local status: { Span | string } = { ui.span(#state.shown .. " to review", "strong") }
	if hidden > 0 then
		table.insert(status, ui.span("  " .. hidden .. " drafts hidden", "muted"))
	end
	if state.loading then
		table.insert(status, ui.span("  refreshing…", "muted"))
	elseif state.fetched then
		table.insert(status, ui.span("  updated " .. os.date("%H:%M", state.fetched), "muted"))
	end
	local lines: { Node } = { ui.text(status) }
	local problem = state.problem
	if problem then
		table.insert(lines, ui.text({ ui.span(problem.text, "warning"), ui.span("  showing the last list", "muted") }))
	end
	table.insert(
		lines,
		ui.text({
			ui.span("↑↓ move  ⏎ open  r refresh  d " .. (if state.drafts then "hide" else "show") .. " drafts", "dim"),
		})
	)
	return ui.col({ ui.lines(lines) })
end

local function open_selected(state: State, cx: BlockCx)
	local pr = state.shown[index_of(state)]
	if pr then
		cx:open(pr.url)
	end
end

local function move(state: State, to: number)
	local pr = state.shown[math.clamp(to, 1, math.max(1, #state.shown))]
	if pr then
		state.cursor = pr.key
	end
end

tern.block.define("queue", {
	init = function(cx: BlockCx, _args: { string }, saved: any): State
		local previous = running[cx.pane]
		if previous then
			retire(previous)
		end
		local state: State = {
			cx = cx,
			prs = nil,
			shown = {},
			cursor = nil,
			drafts = type(saved) == "table" and saved.drafts == true,
			loading = false,
			fetched = nil,
			problem = nil,
			timer = nil,
		}
		running[cx.pane] = state
		refresh(state)
		poll(state)
		return state
	end,

	title = function(state: State): string?
		if state.prs then
			return "Review Queue (" .. #state.shown .. ")"
		end
		return "Review Queue"
	end,

	view = function(state: State, _cx: BlockCx): BlockView
		local main: Node
		if state.prs then
			main = list_view(state)
		elseif state.problem then
			main = problem_view(state.problem)
		else
			main = ui.progress(nil, "Loading review requests…")
		end
		-- A region draws its root node's children, not the root itself (a
		-- list there would lose its selection and events), so the view
		-- sits inside a column.
		return { main = ui.col({ main }), dock = if state.prs then dock_view(state) else nil }
	end,

	key = function(state: State, key: Key, cx: BlockCx): boolean?
		if key.ctrl or key.alt or key.meta then
			return false
		end
		local i = index_of(state)
		local k = key.text or key.name
		if key.name == "up" or k == "k" then
			move(state, i - 1)
		elseif key.name == "down" or k == "j" then
			move(state, i + 1)
		elseif key.name == "page_up" then
			move(state, i - 10)
		elseif key.name == "page_down" then
			move(state, i + 10)
		elseif key.name == "home" or k == "g" then
			move(state, 1)
		elseif key.name == "end" or k == "G" then
			move(state, #state.shown)
		elseif key.name == "enter" or k == "o" then
			open_selected(state, cx)
		elseif k == "r" then
			refresh(state)
		elseif k == "d" then
			state.drafts = not state.drafts
			refilter(state)
		else
			return false
		end
		return true
	end,

	event = function(state: State, ev: UiEvent, cx: BlockCx)
		if ev.ev == "action" and ev.act == "retry" then
			refresh(state)
		elseif ev.ev == "action" and ev.act == "install" then
			cx:open(INSTALL_URL)
		elseif (ev.ev == "select" or ev.ev == "activate") and type(ev.item) == "string" then
			state.cursor = string.sub(ev.item, #LIST_ID + 1)
			if ev.ev == "activate" then
				open_selected(state, cx)
			end
		end
	end,

	save = function(state: State): any
		return { drafts = state.drafts }
	end,
})
```

`window.luau`：

```lua
--!strict
-- The window half: a palette command and a key bind that open the queue, or
-- focus the one already open in this window.

local KIND = "review-queue.queue"

local function open_queue(cx: WindowCx)
	-- One queue per window is enough: each open block polls GitHub.
	for _, pane in cx.session:panes() do
		if string.sub(pane.title, 1, #"Review Queue") == "Review Queue" then
			cx.layout:focus(pane.pane)
			return
		end
	end
	if cx:new_block(KIND, nil, "beside") == nil then
		cx:toast("error", "Review Queue is not loaded on this host", "Install the plugin where your panes run.")
	end
end

tern.command({
	id = "open",
	title = "Open review queue",
	icon = "merge",
	run = open_queue,
})

tern.bind("alt+shift+cmd+r", "plugin.review-queue.open")
```
