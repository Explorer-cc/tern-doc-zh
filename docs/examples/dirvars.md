# 目录变量

`dirvars` 会让每个新 shell 使用其目录到主目录之间 `.tern-env` 文件中的变量，但前提是用户已明确批准每个文件的确切内容。与 `direnv` 一样，它不会自动信任由任意检出内容控制的环境文件。它是 Host 端的 `spawn` 过滤器示例：这是守护进程启动进程路径上的同步钩子，有严格的时间限制，而且它能访问的环境比你想象的少。

## 示例展示的内容

| 接口 | 用途 |
| --- | --- |
| `tern.on("spawn", fn(spec) -> spec?)` | 在 shell 启动前向其添加变量 |
| `tern.on("cwd")`、`EffectCx:toast` | 告知正在运行的 shell：当前目录适用的文件与其启动时加载的文件不同 |
| `tern.on("pane_exited")` | 清除窗格的基线记录 |
| `tern.fs.exists`、`tern.fs.read(path, max_bytes)` | 向上遍历目录树，并安全地限制常规文件读取大小 |
| `tern.block.define`、`tern.kv` | 在 Host 端审核并批准确切文件内容 |
| `tern.getenv` | 守护进程自身的环境，作为 `${NAME}` 的回退值 |
| `tern.log.warn` | 报告格式错误的行，但不中断任何操作 |
| `require("./envfile")` | 与钩子代码分开的解析器模块 |

此插件仅在 Host 端运行：manifest 未指定 Window 端入口。

## 安装

```sh
tern plugin install github.com/stencil-hq/tern-sdk/plugins/examples/dirvars
```

修改插件时，请改为克隆 SDK 并链接该文件夹，这样 Tern 会在每次保存时重新加载它：

```sh
git clone https://github.com/stencil-hq/tern-sdk
tern plugin link tern-sdk/plugins/examples/dirvars
```

将 `sample.tern-env` 复制到项目中并命名为 `.tern-env`。在该项目的块面板中打开 **Directory Variables**，审核转义后的完整内容，然后针对每个文件点击 **Approve these exact bytes**。只有完成这些步骤后，才打开新的 shell 窗格并运行 `echo $TERN_DIRVARS`。可选的块参数用于指定绝对项目目录。

### 审批针对特定内容

每次 spawn 都会使用原生的 64 KiB 上限重新读取每个文件，然后将其字节与插件现有 KV 中该路径已批准的字节进行比较。默认情况下，未知、已更改、不可读及非普通文件内容都会被拒绝；即使只改动注释，也会使审批失效；检测到变化时会移除已存储的审批。块会显示每个字节（非 ASCII/控制字节会转义），不提供截断的预览。点击审批时会重新读取文件；若文件自显示后发生变化，就会拒绝审批，因此无法批准未显示的内容。**Refresh files** 用于审核编辑内容，**Revoke approval** 用于拒绝未来的导入。每个路径最多存储 64 KiB 的审批内容，位置在守护进程所在机器；manifest 中列出的 host 块也会显示在远程 host 的面板中。

请审核整个文件，而不只是熟悉的变量名：`ZDOTDIR` 等变量可能导致 shell 执行由检出内容控制的启动代码。信任已安装的这个插件，不代表信任每个项目。变量拒绝列表不能替代这项明确的审批步骤。

## 文件格式

```sh
# A sample .tern-env: copy it to a project as `.tern-env`.
# Review and explicitly approve its bytes in the Directory Variables block.
# One KEY=VALUE per line; lines starting with # are comments.

# Bare values end at a ` #` comment and expand ${NAME}.
APP_ENV=development   # read by the app's config loader
DATABASE_URL=postgres://localhost:5432/${APP_ENV}

# Double quotes keep spaces and # and understand \n \t \" \\ \$.
GREETING="hello # not a comment"
PRICE="costs \${5}"

# Single quotes are literal: nothing expands.
PATTERN='${not expanded}'

# `export` is accepted, so the file also works with `source`.
export RUST_LOG=info

# A name no file set falls back to the daemon's own environment (${HOME});
# an undefined name expands to nothing.
TOOLS=${HOME}/src/app/bin

# PATH is accepted, but ${PATH} is the daemon's, and a login shell's
# profile runs after the filter and rebuilds PATH (on macOS, path_helper
# puts the system's entries first). Prefer project variables like TOOLS
# and prepend them in your shell's rc file when the order matters.
PATH=${TOOLS}:${PATH}
```

| 格式 | 含义 |
| --- | --- |
| `KEY=VALUE` | `KEY` 匹配 `[A-Za-z_][A-Za-z0-9_]*`；允许在 `=` 周围留空白 |
| `# …` | 注释行；裸值中的 ` #`（空格后跟 `#`）表示注释开始 |
| `export KEY=VALUE` | 与不带 `export` 的形式相同，因此该文件也可与 `source` 配合使用 |
| 裸值 | 在 ` #` 注释处结束；展开 `${NAME}` |
| `"double"` | 保留空格和 `#`；识别 `\n \t \" \\ \$`；展开 `${NAME}` |
| `'single'` | 字面值：不处理转义，也不展开变量 |

不带花括号的 `$NAME` 会保持原样：只有 `${NAME}` 会展开。无法解析的行会被跳过，并记录其文件名和行号。

## 设计

### 过滤器能看到什么

守护进程会按插件 ID 顺序运行每个插件的 `spawn` 过滤器，处理每个即将启动的 shell 窗格。`SpawnSpec` 包含 `program`、`args`、`cwd`（始终已设置）和 `env`；`env` 仅包含守护进程自身在窗格基础环境之上设置的内容：

| 在 `spec.env` 中 | 不在 `spec.env` 中 |
| --- | --- |
| `TERN_PANE`、`TERN_IDENTITY`、`TERN_PANE_SOCKET`、`TERN_WINDOW_KEY`、`TERN_WINDOW_SOCKET`、`TERN_EXE`、`TERN_LENSES`、`TERN_COMPLETE`、`TERN_BLOB_DIR` | `HOME`、`PATH`、`USER`、`SHELL`、以及 profile 中的任何内容 |

本地窗格以全新登录 shell 的环境启动（账户的 `HOME`、`USER`、`SHELL` 以及由登录 shell 构建的 `PATH`；在 Windows 上，则使用窗格启动时的系统和用户变量），而不是守护进程的环境；随后守护进程会将 `spec.env` 应用到其上。因此 `dirvars` 可以添加和覆盖变量，但无法读取窗格的基础环境。如果 `${NAME}` 未在任何文件中定义，且 `spec.env` 中也没有该变量，则会回退到 `tern.getenv(NAME)`：也就是守护进程进程的环境。`${HOME}` 两种情况下都相同；`${PATH}` 则是守护进程的 `PATH`，可能与 shell 的不同。

过滤器会直接向 `spec.env` 添加变量并返回 `spec`；若没有适用文件则返回 `nil`，不更改 spec。以 `TERN_` 开头的键会被跳过并给出警告，因为守护进程自己的变量是窗格与 Tern 通信所需的变量。

### 越近的文件优先

`chain(cwd)` 会从窗格目录向上遍历到 `$HOME`（Windows 上为 `USERPROFILE`）；若目录在 home 之外，则遍历到文件系统根目录，并按从最远到最近的顺序收集存在的 `.tern-env`。只有已批准的内容才会生效。随后 `apply` 按此顺序设置这些文件中的键，因此 `~/src/webapp/api/.tern-env` 中的键会覆盖 `~/src/webapp/.tern-env` 中同名的键。展开操作发生在应用过程中，因此较近的文件可以读取较远文件设置的值：

```sh
# ~/src/webapp/.tern-env
APP_ENV=development

# ~/src/webapp/api/.tern-env
APP_ENV=test
DATABASE_URL=postgres://localhost:5432/app_${APP_ENV}   # app_test
```

`TERN_DIRVARS` 会按从最远到最近的顺序列出已生效文件，并以 `:` 连接，shell 提示符或脚本可以据此显示变量的来源。

### 保持在 50 毫秒以内

守护进程从将 spec 交给过滤器时开始计时，每个插件的过滤器最多等待 50 ms。运行时间更长的过滤器会在本次 spawn 中被跳过（日志会显示 `plugin spawn filter took over 50 ms; skipped`），shell 将不带该过滤器设置的变量启动。等待时间包含队列等待：Host 工作线程一次处理一条消息，因此同一插件中较慢的钩子或块渲染会延迟过滤器。审批块只读取并渲染有界大小的文件；它与过滤器共用该队列。

每次 spawn 的工作量是对每个祖先目录执行一次 `exists`（通常为四到八次），并对找到的每个文件执行一次 `read`。`tern.fs` 没有 `stat`，因此插件无法询问文件自上次 spawn 后是否发生变化。它改为按内容缓存：

| 缓存键 | 每次 spawn 的开销 | 陈旧情况 |
| --- | --- | --- |
| 仅路径 | 不读取 | 编辑后的文件只有在插件重新加载后才会生效 |
| 路径加存活时间 | 在 TTL 内不读取 | 编辑需要等到 TTL 过期 |
| 路径加内容（本插件） | 每次读取所有文件，仅解析已更改的文件 | 无 |

操作系统已缓存这些文件时，读取少量小文件只需微秒；值得跳过的是解析，而将文本与缓存副本比较即可跳过解析。超过 64 KiB 的文件会被拒绝，从而限制缓冲读取和解析的大小。该限制在原生 IO 中、分配/读取超大内容之前执行，而不是在创建 Lua 字符串之后才执行。只接受普通的非符号链接文件：Unix 和 Windows 上都会拒绝 FIFO、设备、目录以及在竞争中被替换为非普通文件的目标。探测一个额外字节即可检测文件是否增长到超出上限。较慢的普通文件（例如位于网络文件系统上的文件）仍可能超出过滤器的时间限制；大小限制并不等同于截止时间。

### 正在运行的 shell

进程的环境在启动时即固定：任何插件都无法更改已运行 shell 的变量。`dirvars` 会改为发出提示。spawn 时，它会按 `TERN_PANE` 记住哪些文件已生效及其内容。每次收到 `cwd` 事件时，它都会计算新目录下适用的文件，并保留 shell 启动时没有的文件或自启动以来已更改的文件。只要仍有文件，就会针对该窗格、目录和文件集合提示一次：

> ~/src/webapp/.tern-env 在此处生效
> 此 shell 未加载它；新窗格会应用它。

离开项目时不会报告：提示针对的是你缺少的变量，而不是你仍然拥有的变量。`pane_exited` 会丢弃窗格记录。

## 限制

- **仅适用于新 shell。** 插件加载前（或插件重新加载前）启动的 shell 没有记录的基线，因此既不会获得这些变量，也不会收到提示。
- **启动文件在过滤器之后运行。** shell 的 profile 和 rc 文件可以覆盖任何变量；登录 shell 还会重建 `PATH`（在 macOS 上，`path_helper` 会把系统条目放在最前面）。顺序很重要时，请在 rc 文件中将内容前置到 `PATH`。
- **守护进程所在机器。** 文件是在守护进程运行的位置读取的；远程 host 需要在那里安装此插件。
- **仅适用于 shell。** 插件块不会经过 `spawn` 过滤器。
- **不能取消设置。** 文件可以将变量设为空字符串，但不能移除变量。

## 代码

`plugin.toml`：

```toml
schema = 1
id = "dirvars"
name = "Directory Variables"
version = "0.1.0"
description = "New shells get explicitly approved .tern-env variables above their directory."
icon = "key"
host = "host.luau"

[[blocks]]
id = "approve"
title = "Directory Variables"
palette = true
```

`envfile.luau`：

```lua
--!strict
-- Reads `.tern-env` files: one `KEY=VALUE` per line, `#` comments, an
-- optional `export ` prefix, and values that are bare, 'single-quoted'
-- (literal) or "double-quoted" (escapes `\n \t \" \\ \$`). Bare and
-- double-quoted values expand `${NAME}`; single-quoted ones never do.
--
-- Parsing keeps a value as parts (literal text and variable names), so
-- expanding it later, against whatever came before, is a concatenation.

local envfile = {}

-- Literal `text`, or the name (`var`) of a variable to substitute.
export type Part = { text: string?, var: string? }

export type Entry = {
	key: string,
	parts: { Part },
	line: number,
}

local ESCAPES: { [string]: string } = { n = "\n", t = "\t", ['"'] = '"', ["\\"] = "\\", ["$"] = "$" }

-- Appends `text` to `parts`, splitting out `${NAME}` references.
local function expanding(parts: { Part }, text: string)
	local at = 1
	while true do
		local from, to, name = string.find(text, "%${([%a_][%w_]*)}", at)
		if from == nil then
			break
		end
		if from > at then
			table.insert(parts, { text = string.sub(text, at, from - 1) })
		end
		table.insert(parts, { var = name :: string })
		at = (to :: number) + 1
	end
	if at <= #text then
		table.insert(parts, { text = string.sub(text, at) })
	end
end

-- The parts of a double-quoted value starting after its opening quote, and
-- what follows the closing quote; nil when the quote never closes.
local function quoted(value: string): ({ Part }?, string)
	local parts: { Part } = {}
	local run = {} -- characters since the last escape, still to be expanded
	local i = 1
	while i <= #value do
		local c = string.sub(value, i, i)
		if c == '"' then
			expanding(parts, table.concat(run))
			return parts, string.sub(value, i + 1)
		elseif c == "\\" and i < #value then
			local escaped = ESCAPES[string.sub(value, i + 1, i + 1)]
			if escaped then
				expanding(parts, table.concat(run))
				table.clear(run)
				-- An escaped character is literal: `\$` never starts `${`.
				table.insert(parts, { text = escaped })
				i += 2
				continue
			end
		end
		table.insert(run, c)
		i += 1
	end
	return nil, ""
end

-- Whether what follows a closing quote is only blanks and a comment.
local function trailing_ok(rest: string): boolean
	return string.match(rest, "^%s*$") ~= nil or string.match(rest, "^%s+#") ~= nil
end

-- The entries of `text` in file order, and a message for each line that
-- doesn't read (`"line 4: …"`); those lines are skipped.
function envfile.parse(text: string): ({ Entry }, { string })
	local entries: { Entry } = {}
	local problems: { string } = {}
	local number = 0
	for raw in string.gmatch(text .. "\n", "([^\n]*)\n") do
		number += 1
		local line = string.match(raw, "^%s*(.-)%s*$") :: string
		line = string.gsub(line, "^export%s+", "")
		if line == "" or string.sub(line, 1, 1) == "#" then
			continue
		end
		local key, value = string.match(line, "^([%a_][%w_]*)%s*=%s*(.*)$")
		if key == nil or value == nil then
			table.insert(problems, string.format("line %d: expected KEY=VALUE", number))
			continue
		end
		local parts: { Part } = {}
		local first = string.sub(value, 1, 1)
		if first == "'" then
			local body, rest = string.match(value, "^'([^']*)'(.*)$")
			if body == nil or not trailing_ok(rest :: string) then
				table.insert(problems, string.format("line %d: unterminated single quote", number))
				continue
			end
			table.insert(parts, { text = body })
		elseif first == '"' then
			local got, rest = quoted(string.sub(value, 2))
			if got == nil or not trailing_ok(rest) then
				table.insert(problems, string.format("line %d: unterminated double quote", number))
				continue
			end
			parts = got
		else
			-- A bare value ends at a ` #` comment.
			local bare = string.gsub(value, "%s+#.*$", "")
			expanding(parts, bare)
		end
		table.insert(entries, { key = key, parts = parts, line = number })
	end
	return entries, problems
end

-- `parts` with each variable replaced by `lookup(name)` (empty when nil).
function envfile.expand(parts: { Part }, lookup: (string) -> string?): string
	local out = table.create(#parts)
	for _, part in parts do
		if part.var then
			table.insert(out, lookup(part.var) or "")
		else
			table.insert(out, part.text or "")
		end
	end
	return table.concat(out)
end

return envfile
```

`host.luau`：

```lua
--!strict
-- dirvars, host half: a `spawn` filter that gives each new shell the
-- variables of the `.tern-env` files between its directory and the home
-- directory, but only after the user approves each file's exact contents
-- in the Directory Variables block. A `cwd` hook reports approved changes.

local envfile = require("./envfile")

local FILE = ".tern-env"
-- Larger files are skipped: an env file this big is a mistake.
local MAX_BYTES = 64 * 1024
local function normalize(path: string): string
	local clean = string.gsub(string.gsub(path, "\\", "/"), "/+$", "")
	if clean == "" then
		return "/"
	end
	return if string.match(clean, "^%a:$") then clean .. "/" else clean
end

local home = tern.getenv("HOME") or tern.getenv("USERPROFILE")
local HOME = if home then normalize(home) else nil
local ui = tern.ui
local APPROVAL = "approved:"

-- A file read this far, with what it parsed to. `text` is the cache key:
-- `tern.fs` has no mtime, so every lookup reads the file and parsing runs
-- only when its content changed.
type Parsed = {
	text: string,
	entries: { envfile.Entry },
}

-- The files that applied, farthest first, and their contents.
type Applied = {
	paths: { string },
	texts: { [string]: string },
}

local parsed: { [string]: Parsed } = {}
local invalidated: { [string]: boolean } = {}
-- What each pane started with, by pane id (from the spec's `TERN_PANE`).
local started: { [number]: Applied } = {}
-- Directories each pane was already told about.
local told: { [number]: { [string]: boolean } } = {}

local function parent(dir: string): string?
	if dir == "/" or string.match(dir, "^%a:/$") or string.match(dir, "^//[^/]+/[^/]+$") then
		return nil
	end
	local up = string.match(dir, "^(.*)/[^/]*$")
	return if up == nil or up == "" then "/" else normalize(up)
end

local function join(dir: string, name: string): string
	return if string.sub(dir, -1) == "/" then dir .. name else dir .. "/" .. name
end

local function tilde(path: string): string
	if HOME and string.sub(path, 1, #HOME + 1) == HOME .. "/" then
		return "~" .. string.sub(path, #HOME + 1)
	end
	return path
end

-- The `.tern-env` paths from `cwd` up to the home directory (or the root,
-- for a directory outside home), farthest first.
local function chain(cwd: string): { string }
	local found: { string } = {}
	local dir: string? = normalize(cwd)
	while dir do
		local path = join(dir, FILE)
		if tern.fs.exists(path) then
			table.insert(found, 1, path)
		end
		if dir == HOME then
			break
		end
		dir = parent(dir)
	end
	return found
end

-- The entries of `path`, parsing only when its content changed; nil when it
-- can't be read (gone since `exists`, a directory, no permission) or is too
-- large.
local function load(path: string): Parsed?
	local ok, text = pcall(tern.fs.read, path, MAX_BYTES)
	if not ok then
		return nil
	end
	local hit = parsed[path]
	if hit and hit.text == text then
		return hit
	end
	local entries, problems = envfile.parse(text)
	for _, problem in problems do
		tern.log.warn(string.format("%s %s", path, problem))
	end
	local fresh = { text = text, entries = entries }
	parsed[path] = fresh
	return fresh
end

-- Persist the bounded bytes, not a path-only trust flag. KV failures deny.
-- Forget approval as soon as different or unreadable content is observed.
local function approved(path: string, file: Parsed?): boolean
	local ok, text = pcall(tern.kv.get, APPROVAL .. path)
	if not ok then
		invalidated[path] = true
		return false
	end
	if not invalidated[path] and file and type(text) == "string" and #text <= MAX_BYTES and text == file.text then
		return true
	end
	if text ~= nil then
		invalidated[path] = true
		pcall(tern.kv.set, APPROVAL .. path, nil)
	end
	return false
end

-- The files that apply in `cwd` and their contents.
local function applied(cwd: string): Applied
	local result: Applied = { paths = {}, texts = {} }
	for _, path in chain(cwd) do
		local file = load(path)
		local allowed = approved(path, file)
		if file and allowed then
			table.insert(result.paths, path)
			result.texts[path] = file.text
		end
	end
	return result
end

-- Applies `files` over `env` in place, farthest first, so nearer files win.
-- `${NAME}` sees the keys set so far, then `env`, then the daemon's own
-- environment (`HOME`, `PATH`, …).
local function apply(files: Applied, env: { [string]: string })
	for _, path in files.paths do
		for _, entry in parsed[path].entries do
			if string.sub(entry.key, 1, 5) == "TERN_" then
				-- The daemon's own variables (TERN_PANE, …) aren't ours to change.
				tern.log.warn(string.format("%s line %d: %s is reserved; skipped", path, entry.line, entry.key))
				continue
			end
			env[entry.key] = envfile.expand(entry.parts, function(name: string): string?
				return env[name] or tern.getenv(name)
			end)
		end
	end
	env.TERN_DIRVARS = table.concat(files.paths, ":")
end

tern.on("spawn", function(spec: SpawnSpec): SpawnSpec?
	if spec.cwd == nil then
		return nil
	end
	local files = applied(spec.cwd)
	local pane = tonumber(spec.env.TERN_PANE)
	if pane then
		started[pane] = files
	end
	if #files.paths == 0 then
		return nil
	end
	apply(files, spec.env)
	return spec
end)

-- Files that apply in `now` but that `before` didn't have or had with other
-- content.
local function news(before: Applied, now: Applied): { string }
	local out = {}
	for _, path in now.paths do
		if before.texts[path] ~= now.texts[path] then
			table.insert(out, path)
		end
	end
	return out
end

tern.on("cwd", function(ev: CwdEvent, cx: EffectCx)
	local before = started[ev.pane]
	if before == nil then
		return -- started before this plugin loaded: unknown baseline
	end
	local changed = news(before, applied(ev.path))
	if #changed == 0 then
		return
	end
	local seen = told[ev.pane] or {}
	told[ev.pane] = seen
	local key = ev.path .. "\0" .. table.concat(changed, "\0")
	if seen[key] then
		return
	end
	seen[key] = true
	if #changed == 1 then
		cx:toast("info", tilde(changed[1]) .. " applies here", "This shell didn't load it; new panes pick it up.")
	else
		local text = string.format("%d .tern-env files apply here", #changed)
		cx:toast("info", text, "This shell didn't load them; new panes pick them up.")
	end
end)

tern.on("pane_exited", function(ev: PaneExitedEvent, _cx: EffectCx)
	started[ev.pane] = nil
	told[ev.pane] = nil
end)

-- An approval always refers to the bytes last displayed, never a fresh
-- unseen file. Re-read at click time to reject edits while the block is open.
type Review = { path: string, text: string, token: string }
type State = { cwd: string?, review: { Review } }

local function button(label: string, action: string): Node
	local node = ui.badge(label, "accent")
	local props: { [string]: any } = node.p or {}
	props.actions = { click = action }
	node.p = props
	return node
end

tern.block.define("approve", {
	init = function(cx: BlockCx, args: { string }, _saved: unknown): State
		return { cwd = args[1] or cx.cwd, review = {} }
	end,
	title = function(_state: State): string?
		return "Directory Variables"
	end,
	view = function(state: State, _cx: BlockCx): BlockView
		state.review = {}
		local parts: { Node } = {
			ui.text("Review every byte before approving. These variables can execute shell startup code. Approval is for this path and exact content only."),
		}
		if state.cwd == nil or state.cwd == "" then
			table.insert(parts, ui.text("No working directory. Open this block from a project pane, or pass an absolute directory as its argument."))
		else
			for _, path in chain(state.cwd) do
				local file = load(path)
				local allowed = approved(path, file)
				table.insert(parts, ui.text(path))
				if file then
					local token = tern.json.encode({ path = path, text = file.text })
					table.insert(state.review, { path = path, text = file.text, token = token })
					-- Quote each line so controls and escape sequences cannot hide bytes.
					-- Include comments and malformed lines too; no truncated preview.
					local lines: { Node } = {}
					for line in string.gmatch(file.text .. "\n", "(.-)\n") do
						local quoted = string.format("%q", line)
						quoted = string.gsub(quoted, "[^ -~]", function(byte: string): string
							return string.format("\\x%02X", string.byte(byte))
						end)
						table.insert(lines, ui.text(quoted))
					end
					table.insert(parts, ui.lines(lines))
					table.insert(parts, button(
						if allowed then "Revoke approval" else "Approve these exact bytes",
						(if allowed then "revoke=" else "approve=") .. token
					))
				else
					table.insert(parts, ui.text("Rejected: unreadable, nonregular, symlink, or larger than 64 KiB."))
				end
			end
			if #state.review == 0 then
				table.insert(parts, ui.text("No readable .tern-env files here. Nothing will be imported."))
			end
		end
		return {
			main = ui.col(parts),
			dock = ui.row({ button("Refresh files", "refresh") }),
		}
	end,
	event = function(state: State, ev: UiEvent, cx: BlockCx)
		if ev.ev ~= "action" then
			return
		end
		if ev.act == "refresh" then
			cx:render()
			return
		end
		-- A delayed click carries the bytes that its own frame displayed,
		-- even if another render or block restart has replaced state.review.
		local review: Review? = nil
		for _, candidate in state.review do
			if candidate.token == ev.value then
				review = candidate
				break
			end
		end
		if review == nil then
			return
		end
		if ev.act == "revoke" then
			invalidated[review.path] = true
			tern.kv.set(APPROVAL .. review.path, nil)
		elseif ev.act == "approve" then
			local current = load(review.path)
			if current == nil or current.text ~= review.text then
				approved(review.path, current)
				cx:toast("error", "File changed; not approved", "Refresh and review the new contents.")
			else
				tern.kv.set(APPROVAL .. review.path, review.text)
				invalidated[review.path] = nil
				cx:toast("info", "Exact contents approved", "Only new shells load these variables.")
			end
		end
		cx:render()
	end,
})
```
