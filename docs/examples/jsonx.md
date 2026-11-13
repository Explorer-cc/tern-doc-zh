# JSON 浏览器

`jsonx` 会在“JSON Explorer”块中打开 JSON 文件：以可折叠树呈现，成员按文档顺序排列，并显示面包屑导航；只需按一个键，就能获取所选值的 jq 路径。它的 Window 端会将普通的 `.json` 打开操作路由到浏览器，是否启用由用户控制的开关决定。这是一个基于文件的块以及 `tern.route.open` 的示例。

## 示例内容

| 项目 | 端 | 用途 |
| --- | --- | --- |
| 含 `files` 和 `palette = false` 的 `[[blocks]]` | manifest | 为 `*.json` 和 `*.geojson` 提供“Open with › JSON Explorer” |
| 含 `init`、`title`、`view`、`key`、`event`、`save` 的 `tern.block.define` | Host | 浏览器 |
| 启动参数 `args`、`BlockCx.cwd` | Host | 要显示的文件 |
| `tern.process.run`（`wc -c`）、`tern.fs.read` | Host | 先测量文件，再读取文件 |
| 含 `selected`、`max` 和带键条目的 `ui.list` | Host | 树、光标和点击操作 |
| `ui.diagnostic`、`ui.card`、徽标 `actions` | Host | 带有 Open as text 和 Reload 操作的错误视图 |
| `BlockCx:copy`、`BlockCx:toast`、`BlockCx:open` | Host | 复制 jq 路径、将文件作为文本打开 |
| `save` 和 `init` 的 `saved` | Host | 已展开的容器和光标 |
| `tern.route.open` | Window | 将 `.json` 打开操作发送到浏览器 |
| `tern.command`、`tern.kv` | Window | 开关及其状态记忆 |

## 安装

```sh
tern plugin install github.com/stencil-hq/tern-sdk/plugins/examples/jsonx
```

开发期间，可以克隆 SDK 并改为链接该目录，这样每次保存时 Tern 都会重新加载：

```sh
git clone https://github.com/stencil-hq/tern-sdk
tern plugin link tern-sdk/plugins/examples/jsonx
```

从 Files 窗格或命令面板打开 `.json` 文件，或在任意 JSON 文件的菜单中选择
**Open with › JSON Explorer**。

## 设计

### 文件如何进入块

该块需要一个路径，有三种传入方式：

| 入口 | 路径的传入方式 |
| --- | --- |
| 文件菜单中的“Open with › JSON Explorer” | Tern 将文件名与块的 `files` glob 匹配，并以绝对路径作为 `args[1]` 启动该块，其 `cwd` 为文件所在文件夹 |
| Window 的路由 | `{block = "jsonx.explorer", args = {req.path}}` |
| 另一个插件 | `cx:new_block("jsonx.explorer", { path })` |

`palette = false` 会将“New JSON Explorer block”从命令面板中移除：没有文件启动的块只能提示这一点。`init` 会根据 `cx.cwd` 解析相对路径，因为 `tern.fs` 是相对于插件自身目录解析路径的。

### 先测量再读取

`tern.fs.read` 会先在守护进程中将整个文件读入内存，然后才交给 Luau。若有人把 2 GB 的日志文件命名为 `.json`，在任何检查执行前就会完整读取它。因此，该块会先通过 `tern.process.run` 调用 `wc -c` 获取文件大小，此操作不会阻塞工作线程。对于常规文件，`wc -c` 会从文件元数据获取大小，而非读取文件内容。只有不超过 4 MiB 的文件才会继续读取和解析。
当 `wc` 失败（文件不存在、目标是目录或权限不足）时，该块仍会尝试读取，以便错误视图显示 `tern.fs.read` 自身的错误信息；如果根本无法启动进程（`tern.process.run` 抛出异常，例如在 iOS 上），则会直接读取，然后检查长度。

此限制来自 Host 的调用预算。解析发生在进程回调中，该回调是一次调用插件的操作，预算为 2 秒；运行时间超出预算的调用会失败，Tern 也会暂停该钩子一段时间。在 Apple M4 Max 上，解析 4 MiB 文件不会超出预算。速度较慢的机器可用余量更少；若限制更大，大文件就会导致预算错误，而不是显示错误视图。

### 为什么自行解析 JSON

`tern.json.decode` 看似是最自然的首选，但并不适合查看器：

| `tern.json.decode` 的行为 | 查看器所需的行为 |
| --- | --- |
| 对象会变成 Lua 表，而 Lua 表没有成员顺序 | 按文件中列出的顺序显示成员 |
| 对象中的 `null` 成员会被丢弃 | 显示所有成员，包括 `null` |
| 数字会变成 Lua 数字（`1.50` → `1.5`，大整数会丢失数字） | 完全按原文显示数字 |
| 重复成员名只会静默保留一个 | 显示重复项数量 |

因此，`host.luau` 实现了一个小型严格 JSON 解析器。它使用 `string.find` 扫描，而非逐字符处理；在各对象的值之外，另用数组按顺序保存成员名；将数字字面量保留为文本；解码字符串转义（包括代理项对）；跳过 UTF-8 字节顺序标记；并拒绝嵌套超过 512 层的内容，以免递归下降耗尽堆栈。与 jq 一样，重复成员名会原位替换较早的值，停靠栏会报告重复数量。文件必须是有效的 UTF-8（`tern.fs.read` 返回原始字节，而视图文本必须为 UTF-8），解析前会由 `utf8.len` 检查。

解析错误会以 `{msg, pos}` 表的形式抛出，并由 `pcall` 捕获。该块会将字节偏移量转换为行和列，并通过 `ui.diagnostic` 显示；其中的位置链接到对应文件。压缩后的 JSON 只有一长行，因此错误附近的片段会截取为 120 个字符。

### 行及其键

该树是一个扁平的 `ui.list`。每次更改后，`relayout` 都会遍历解析后的值，并为每个可见节点生成一行：根节点，以及每个已展开容器的子节点。每行的键是其 jq 路径（`.`, `.features`, `.features[3]`, `.features[3].properties["name:en"]`），该路径唯一，也正是按 `y` 时复制的内容。节点 ID 由键构成，因此无论上方行如何变化，行 ID 都是 `main.tree.<jq path>`；列表的 `selected` 属性及其 `select`/`activate` 事件都使用这些 ID。

标签开头每层缩进两个空格；列表行会保留这些空格，不会折叠空白。容器会显示 `▸` 或 `▾`，并在右对齐的值区域显示其大小；标量会显示其值并按类型着色，字符串则截断为 200 个字符。

以下两项限制可确保视图足够小，能在每次按键时重新构建：

| 限制 | 效果 |
| --- | --- |
| 每个容器最多显示 1000 个子项 | 显示“… N more”行；在该行按 `Enter` 可再显示 1000 项 |
| 总计 20 000 行 | 到达上限后停止显示，停靠栏会提示你折叠部分内容 |

与[审查队列](review-queue.md)一样，列表位于 `ui.col({ … })` 中，因为区域绘制的是 `view` 返回节点的子节点，而非该节点本身。其 `max = { lines = … }` 高度根据 `cx.rows` 计算，因此列表会自行滚动并使光标保持在可见范围内。该块没有 `resize` 处理器：窗格大小变化时，Tern 会再次运行 `view`，高度也会随 `cx.rows` 调整。

### 按键

| 按键 | 操作 |
| --- | --- |
| `↑`/`↓`、`k`/`j` | 移动 |
| `PageUp`/`PageDown`、`Home`/`End`、`g`/`G` | 跳转 |
| `→`、`l` | 展开容器，或移动到其第一个子项 |
| `←`、`h` | 折叠容器，或返回父项 |
| `Enter`、`Space`、双击 | 切换；位于“… N more”行时显示更多 |
| `y` | 复制 jq 路径 |
| `c` | 全部折叠 |
| `r` | 重新读取文件，并保留展开状态 |
| `o` | 将文件作为文本打开 |

停靠栏会显示面包屑导航（从根节点到光标所在位置的标签）、带有值类型和大小的 jq 路径、各类提示，以及按键说明。

### 保存的状态

`save` 会返回已展开的路径和光标位置：

```lua
return { expanded = tern.json.array(open), cursor = state.cursor }
```

Tern 会在每个处理器运行后调用 `save`，并且仅当结果与上次保存的 JSON 不同时才存储。Lua 表的迭代顺序不固定，因此路径会先排序；否则，即使集合未改变，编码结果也可能不同，导致再次存储。`tern.json.array` 会将空集合保留为数组。重启后，`init` 会通过 `saved` 重新获得该表；文件中已不存在的路径不会造成问题，而已不存在的光标位置会回退到根节点。

### 打开为文本且不产生循环

“Open as text”会在该块的 cx 上调用 `cx:open(path)`。块的 open 会被当作链接处理：它会经过 `tern.route.link`，然后以 `link` 为来源打开文件。下方路由会忽略来源为 `link` 的打开操作，因此打开的是编辑器，而不是另一个浏览器。

### 路由及其开关

```lua
tern.route.open(function(req: OpenRequest, _cx: WindowCx): RouteDecision?
```

只有满足以下所有条件时，该路由才会接管打开操作：

| 条件 | 原因 |
| --- | --- |
| 开关已开启 | 用户可以关闭接管功能 |
| `req.how == "default"` | Beside、below、split、tab、replace 和 preview 都是明确要求由编辑器打开的放置方式 |
| `req.line == nil` | 从命令面板请求的 `file.json:12` 指定了行号，但浏览器无法使用该行号 |
| `req.origin` 为 `files` 或 `palette` | 窗格中的链接、拖放、`tern open` 和系统操作都保持原有行为 |
| 路径以 `.json` 结尾（不区分大小写） | `.geojson` 仍需通过“Open with”显式选择 |

决策为 `{block = "jsonx.explorer", args = {req.path}}`。

该开关对应命令“Toggle JSON explorer for .json opens”，状态存储在 `tern.kv` 的 `route_json` 下。未设置时表示开启。每次打开时路由都会读取此值：所有窗口共享同一个 `tern.kv` 存储（VM 仅在 `kv.json` 文件发生变化时重新读取），因此在一个窗口切换开关后会立即应用到其他窗口。

## 限制

- 路由打开操作会在文件所在的 Host 上启动该块，因此远程 Host 上的 `.json` 文件由该 Host 上的插件副本读取。
- 如果文件所在的 Host 未安装该插件，路由打开操作只会显示错误 toast（“Could not open the block”）；请在该 Host 安装插件，或关闭此开关。
- 超过 4 MiB 的文件会被拒绝，而不会采用流式读取。
- 重复成员名保留最后一个值；较早的值不会显示。

## 代码

`plugin.toml`:

```toml
schema = 1
id = "jsonx"
name = "JSON Explorer"
version = "1.0.0"
description = "Browse JSON files as a collapsible tree and copy jq paths."
icon = "braces"
host = "host.luau"
window = "window.luau"

[[blocks]]
id = "explorer"
title = "JSON Explorer"
files = ["*.json", "*.geojson"]
# The block needs a file: it opens from "Open with", the route or a command.
palette = false
```

`host.luau`:

```lua
--!strict
-- The `explorer` block: a JSON file as a collapsible tree. The file path is
-- the block's first launch argument ("Open with › JSON Explorer", the
-- window's route, or `cx:new_block("jsonx.explorer", { path })`).
--
-- Keys: ↑/↓ (or k/j) move, → (or l) expands or steps in, ← (or h) collapses
-- or steps out, Enter/Space toggles, Home/End and PageUp/PageDown jump,
-- y copies the jq path, c collapses everything, r reloads, o opens the file
-- as text.

local ui = tern.ui

-- Files above this are refused: parsing runs in Luau, inside one 2-second
-- host call.
local MAX_BYTES = 4 * 1024 * 1024
-- Containers deeper than this are refused (the parser recurses).
local MAX_DEPTH = 512
-- Children an expanded container shows before a "… N more" row.
local CHILD_ROWS = 1000
-- Rows the tree shows in total; expanding past it shows a notice instead.
local MAX_ROWS = 20000
-- Characters of a string value shown in its row.
local PREVIEW = 200

-- A parsed JSON value. `tern.json.decode` can't be used for a viewer: Lua
-- tables forget member order and the decoder drops `null` members, so the
-- block parses the text itself and keeps numbers as written.
type Value = {
	kind: string, -- "object" | "array" | "string" | "number" | "boolean" | "null"
	text: string?, -- scalars: the string's value, or the literal as written
	keys: { string }?, -- objects: member names in document order
	items: { Value }?, -- containers: member values or elements in order
}

-- One visible line of the tree. `path` is its jq path and the list item key.
type Row = {
	path: string,
	label: string, -- breadcrumb segment: a member name or `[i]`
	name: string?, -- object members: the name
	depth: number,
	parent: string?,
	value: Value?, -- nil for a "… N more" row
	more: number?, -- "… N more" rows: how many children are hidden
}

-- Why there is no tree: `nofile`, `large`, `read` or `parse`.
type Problem = { kind: string, title: string, text: string, diag: Diag? }

type State = {
	cx: BlockCx,
	path: string?,
	name: string,
	root: Value?,
	bytes: number,
	dupes: number,
	loading: boolean,
	problem: Problem?,
	expanded: { [string]: boolean },
	limits: { [string]: number },
	rows: { Row },
	index: { [string]: number },
	capped: boolean,
	cursor: string,
}

type ParseError = { msg: string, pos: number }

local ESCAPES: { [string]: string } = {
	['"'] = '"',
	["\\"] = "\\",
	["/"] = "/",
	b = "\b",
	f = "\f",
	n = "\n",
	r = "\r",
	t = "\t",
}

-- Literals are immutable, so every occurrence shares one table.
local TRUE: Value = table.freeze({ kind = "boolean", text = "true" })
local FALSE: Value = table.freeze({ kind = "boolean", text = "false" })
local NULL: Value = table.freeze({ kind = "null", text = "null" })

-- Parses JSON text into a `Value`; raises a `ParseError` at the first fault.
-- Also returns how many duplicate member names it folded (the last wins,
-- as in jq).
local function parse(src: string): (Value, number)
	local pos = 1
	local dupes = 0

	local function fail(msg: string, at: number?)
		local err: ParseError = { msg = msg, pos = at or pos }
		error(err, 0)
	end

	local function skip()
		pos = string.find(src, "[^ \t\r\n]", pos) or #src + 1
	end

	local function expect(byte: number, what: string)
		skip()
		if string.byte(src, pos) ~= byte then
			fail(if pos > #src then "unexpected end of file, expected " .. what else "expected " .. what)
		end
		pos += 1
	end

	local function str(): string
		local open = pos
		pos += 1
		local parts: { string } = {}
		local seg = pos
		while true do
			local at = string.find(src, '["\\%c]', pos)
			if at == nil then
				fail("unterminated string", open)
				return ""
			end
			local b = string.byte(src, at)
			if b == 34 then -- the closing quote
				table.insert(parts, string.sub(src, seg, at - 1))
				pos = at + 1
				return table.concat(parts)
			elseif b == 92 then -- a backslash escape
				table.insert(parts, string.sub(src, seg, at - 1))
				local e = string.sub(src, at + 1, at + 1)
				if e == "u" then
					local hex = string.match(src, "^%x%x%x%x", at + 2)
					if hex == nil then
						fail("\\u needs four hex digits", at)
						return ""
					end
					local code = tonumber(hex, 16) :: number
					local after = at + 6
					if code >= 0xD800 and code <= 0xDBFF then
						local lo = string.match(src, "^\\u(%x%x%x%x)", after)
						local low = if lo then tonumber(lo, 16) :: number else 0
						if low >= 0xDC00 and low <= 0xDFFF then
							code = 0x10000 + (code - 0xD800) * 0x400 + (low - 0xDC00)
							after += 6
						else
							code = 0xFFFD -- a lone high surrogate
						end
					elseif code >= 0xDC00 and code <= 0xDFFF then
						code = 0xFFFD -- a lone low surrogate
					end
					table.insert(parts, utf8.char(code))
					pos = after
				else
					local ch = ESCAPES[e]
					if ch == nil then
						fail("invalid escape \\" .. e, at)
					end
					table.insert(parts, ch)
					pos = at + 2
				end
				seg = pos
			elseif b == 127 then
				pos = at + 1 -- DEL may appear unescaped
			else
				fail("control character in a string; it must be escaped", at)
			end
		end
	end

	local function number(): Value
		local start = pos
		if string.byte(src, pos) == 45 then -- -
			pos += 1
		end
		local _, int = string.find(src, "^0", pos)
		if int == nil then
			_, int = string.find(src, "^[1-9]%d*", pos)
		end
		if int == nil then
			fail("invalid number", start)
			return NULL
		end
		pos = int + 1
		if string.byte(src, pos) == 46 then -- .
			local _, frac = string.find(src, "^%.%d+", pos)
			if frac == nil then
				fail("a digit must follow the decimal point")
				return NULL
			end
			pos = frac + 1
		end
		local e = string.byte(src, pos)
		if e == 101 or e == 69 then -- e E
			local _, exp = string.find(src, "^[eE][%+%-]?%d+", pos)
			if exp == nil then
				fail("invalid exponent")
				return NULL
			end
			pos = exp + 1
		end
		return { kind = "number", text = string.sub(src, start, pos - 1) }
	end

	local function literal(word: string, v: Value): Value
		if string.sub(src, pos, pos + #word - 1) ~= word then
			fail("unexpected `" .. string.sub(src, pos, pos) .. "`")
		end
		pos += #word
		return v
	end

	local value: (depth: number) -> Value

	local function container(depth: number, object: boolean): Value
		if depth > MAX_DEPTH then
			fail("nested deeper than " .. MAX_DEPTH .. " levels")
		end
		local close = if object then 125 else 93 -- } ]
		pos += 1
		local items: { Value } = {}
		local keys: { string } = {}
		local seen: { [string]: number } = {}
		skip()
		if string.byte(src, pos) == close then
			pos += 1
		else
			while true do
				if object then
					skip()
					if string.byte(src, pos) ~= 34 then
						fail("expected a member name in double quotes")
					end
					local key = str()
					expect(58, "`:` after the member name")
					local v = value(depth + 1)
					local at = seen[key]
					if at then
						items[at] = v
						dupes += 1
					else
						table.insert(keys, key)
						table.insert(items, v)
						seen[key] = #items
					end
				else
					table.insert(items, value(depth + 1))
				end
				skip()
				local b = string.byte(src, pos)
				pos += 1
				if b == close then
					break
				elseif b ~= 44 then -- ,
					pos -= 1
					fail(if object then "expected `,` or `}`" else "expected `,` or `]`")
				end
			end
		end
		if object then
			return { kind = "object", keys = keys, items = items }
		end
		return { kind = "array", items = items }
	end

	value = function(depth: number): Value
		skip()
		local b = string.byte(src, pos)
		if b == 123 then -- {
			return container(depth, true)
		elseif b == 91 then -- [
			return container(depth, false)
		elseif b == 34 then -- "
			return { kind = "string", text = str() }
		elseif b == 116 then
			return literal("true", TRUE)
		elseif b == 102 then
			return literal("false", FALSE)
		elseif b == 110 then
			return literal("null", NULL)
		elseif b == 45 or (b ~= nil and b >= 48 and b <= 57) then
			return number()
		elseif b == nil then
			fail("unexpected end of file, expected a value")
		else
			fail("unexpected `" .. string.sub(src, pos, pos) .. "`")
		end
		return NULL
	end

	if string.sub(src, 1, 3) == "\239\187\191" then
		pos = 4 -- a UTF-8 byte order mark
	end
	skip()
	if pos > #src then
		fail("the file is empty")
	end
	local root = value(0)
	skip()
	if pos <= #src then
		fail("unexpected text after the JSON value")
	end
	return root, dupes
end

local function basename(path: string): string
	return string.match(path, "([^/]+)/*$") or path
end

local function plural(n: number, word: string): string
	return n .. " " .. word .. (if n == 1 then "" else "s")
end

local function bytes(n: number): string
	if n < 1024 then
		return plural(n, "byte")
	elseif n < 1024 * 1024 then
		return string.format("%.1f KiB", n / 1024)
	end
	return string.format("%.1f MiB", n / (1024 * 1024))
end

-- The first `max` characters of `s`, and whether it was longer.
local function clip(s: string, max: number): (string, boolean)
	if #s <= max then
		return s, false
	end
	local cut = utf8.offset(s, max + 1)
	if cut == nil then
		return s, false
	end
	return string.sub(s, 1, cut - 1), true
end

-- A diagnostic for a parse error at byte `pos`: line, column and an excerpt
-- of that line around the column.
local function locate(src: string, pos: number, msg: string, path: string): Diag
	local newlines, start = 0, 1
	while true do
		local nl = string.find(src, "\n", start, true)
		if nl == nil or nl >= pos then
			break
		end
		newlines += 1
		start = nl + 1
	end
	local text = string.match(src, "^[^\n]*", start) or ""
	local col = pos - start + 1
	if #text > 160 then -- minified JSON: one very long line
		local from = math.max(1, col - 60)
		text = (if from > 1 then "…" else "") .. string.sub(text, from, from + 119) .. "…"
	end
	return {
		severity = "error",
		message = msg,
		path = path,
		line = newlines + 1,
		col = col,
		snippet = { (newlines + 1) :: any, text },
	}
end

-- The jq path of a child of `parent`: member `name`, or element `i` (0-based).
local function child_path(parent: string, name: string?, i: number): string
	local seg = if name == nil
		then "[" .. i .. "]"
		elseif string.find(name, "^[%a_][%w_]*$") then "." .. name
		else "[" .. tern.json.encode(name) .. "]"
	if parent == "." then
		return if string.sub(seg, 1, 1) == "." then seg else "." .. seg
	end
	return parent .. seg
end

local function is_container(v: Value?): boolean
	return v ~= nil and (v.kind == "object" or v.kind == "array")
end

-- Rebuilds the visible rows from the tree, the expanded set and the limits.
local function relayout(state: State)
	local rows: { Row } = {}
	local index: { [string]: number } = {}
	state.capped = false
	local function add(row: Row)
		table.insert(rows, row)
		index[row.path] = #rows
	end
	local function walk(v: Value, row: Row)
		if #rows >= MAX_ROWS then
			state.capped = true
			return
		end
		add(row)
		if not (is_container(v) and state.expanded[row.path]) then
			return
		end
		local items = v.items or {}
		local keys = v.keys
		local limit = state.limits[row.path] or CHILD_ROWS
		for i = 1, math.min(#items, limit) do
			local name = if keys then keys[i] else nil
			local path = child_path(row.path, name, i - 1)
			walk(items[i], {
				path = path,
				label = name or ("[" .. (i - 1) .. "]"),
				name = name,
				depth = row.depth + 1,
				parent = row.path,
				value = items[i],
			})
			if state.capped then
				return
			end
		end
		if #items > limit then
			add({
				path = row.path .. "#more",
				label = "…",
				depth = row.depth + 1,
				parent = row.path,
				more = #items - limit,
			})
		end
	end
	local root = state.root
	if root then
		walk(root, { path = ".", label = state.name, depth = 0, value = root })
	end
	state.rows = rows
	state.index = index
	if index[state.cursor] == nil then
		state.cursor = "."
	end
end

-- Reads and parses the file now; on success the tree replaces any problem.
local function read(state: State)
	local path = state.path :: string
	local ok, src = pcall(tern.fs.read, path)
	if not ok then
		state.problem = {
			kind = "read",
			title = "Could not read " .. state.name,
			text = tostring(src),
		}
		return
	end
	if #src > MAX_BYTES then -- it grew since `wc`, or `wc` was not there
		state.bytes = #src
		state.problem = {
			kind = "large",
			title = state.name .. " is too large to explore",
			text = state.name .. " is " .. bytes(#src) .. "; JSON Explorer reads files up to " .. bytes(MAX_BYTES) .. ".",
		}
		return
	end
	if utf8.len(src) == nil then
		state.problem = {
			kind = "read",
			title = state.name .. " is not UTF-8 text",
			text = "JSON files are UTF-8; this one has bytes that are not.",
		}
		return
	end
	local parsed, root, dupes = pcall(parse, src)
	if not parsed then
		local err = root :: any
		if type(err) == "table" then
			state.problem = {
				kind = "parse",
				title = state.name .. " is not valid JSON",
				text = err.msg,
				diag = locate(src, err.pos, err.msg, path),
			}
		else
			state.problem = { kind = "read", title = "Could not parse " .. state.name, text = tostring(err) }
		end
		return
	end
	state.root = root
	state.dupes = dupes
	state.bytes = #src
	state.problem = nil
	relayout(state)
end

-- Loads the file in the background: `wc -c` measures it first, so a huge
-- file is refused before it is read into memory.
local function load(state: State)
	if state.path == nil or state.loading then
		return
	end
	state.loading = true
	local argv = { "wc", "-c", "--", state.path :: string }
	local started = pcall(function()
		tern.process.run(argv, { timeout_ms = 5000 }, function(result: ProcessResult, _)
			state.loading = false
			local size = tonumber(string.match(result.stdout, "^%s*(%d+)"))
			if result.status == 0 and size and size > MAX_BYTES then
				state.bytes = size
				state.problem = {
					kind = "large",
					title = state.name .. " is too large to explore",
					text = state.name .. " is " .. bytes(size) .. "; JSON Explorer reads files up to " .. bytes(MAX_BYTES) .. ".",
				}
			else
				-- wc failing (no such file, a directory) is reported by the read.
				read(state)
			end
			state.cx:render()
		end)
	end)
	if not started then
		-- No `wc` here (or no processes at all): read directly.
		state.loading = false
		read(state)
	end
end

local function button(label: string, act: string, tone: string): Node
	local node = ui.badge(label, tone)
	local p: { [string]: any } = node.p or {}
	p.actions = { click = act }
	node.p = p
	return node
end

local function problem_view(state: State, problem: Problem): Node
	local children: { Node } = {}
	local diag = problem.diag
	if diag then
		table.insert(children, ui.diagnostic(diag, state.cx.cwd))
	elseif problem.kind == "nofile" then
		table.insert(children, ui.md(problem.text))
	else
		table.insert(children, ui.text({ ui.span(problem.text) }))
	end
	if state.path then
		local buttons: { Node } = { button("Open as text", "open", "accent") }
		table.insert(buttons, button("Reload", "reload", "neutral"))
		table.insert(children, ui.row(buttons))
	end
	local card = ui.card({ ui.span(problem.title, "strong") }, children)
	local p: { [string]: any } = card.p or {}
	p.tone = if problem.kind == "large" or problem.kind == "nofile" then "warning" else "error"
	card.p = p
	return card
end

-- The value part of a scalar row.
local function scalar(v: Value): Span
	local text = v.text or ""
	if v.kind == "string" then
		local shown, cut = clip(text, PREVIEW)
		local quoted = tern.json.encode(shown)
		if cut then
			quoted = string.sub(quoted, 1, -2) .. "…"
		end
		return ui.span(quoted, "success")
	elseif v.kind == "number" then
		return ui.span(text, "num")
	elseif v.kind == "boolean" then
		return ui.span(text, "accent")
	end
	return ui.span(text, "muted")
end

local function name_span(name: string): Span
	if name == "" or string.find(name, "%c") then
		return ui.span(tern.json.encode(name), "info")
	end
	return ui.span(name, "info")
end

local function item(state: State, row: Row): Item
	local indent = string.rep("  ", row.depth)
	local hidden = row.more
	if hidden then
		return {
			label = { ui.span(indent .. "  … " .. hidden .. " more", "muted") },
			detail = { ui.span("Enter shows " .. math.min(hidden, CHILD_ROWS) .. " more", "dim") },
		}
	end
	local v = row.value :: Value
	local glyph = if not is_container(v) then "  " elseif state.expanded[row.path] then "▾ " else "▸ "
	local label: { Span | string } = { ui.span(indent .. glyph, "muted") }
	if row.depth == 0 then
		table.insert(label, ui.span(state.name, "strong"))
	elseif row.name then
		table.insert(label, name_span(row.name))
	else
		table.insert(label, ui.span(row.label, "muted num"))
	end
	if not is_container(v) then
		table.insert(label, ui.span(": ", "muted"))
		table.insert(label, scalar(v))
		return { label = label }
	end
	local n = #(v.items or {})
	local count = if v.kind == "object" then plural(n, "key") else plural(n, "item")
	return { label = label, value = { ui.span(count, "muted num") } }
end

-- The tree as a list keyed `tree`: its id is `main.tree` and each row's
-- `main.tree.<jq path>`, the ids `selected` and the list's events use.
local LIST_ID = "main.tree."

-- How many rows the list shows before it scrolls itself. A list with a
-- `max` height keeps its selected row in view; without one, `main` scrolls
-- and the cursor can leave the screen. List rows are about a third taller
-- than the pane's cells, and the dock takes about five cells.
local function list_lines(cx: BlockCx): number
	return math.max(4, math.floor((cx.rows - 5) * 0.72))
end

local function tree_view(state: State, cx: BlockCx): Node
	local items: { Item } = {}
	for _, row in state.rows do
		table.insert(items, item(state, row))
	end
	local list = ui.list(items)
	local kids = list.c or {}
	for i, row in state.rows do
		local p: { [string]: any } = kids[i].p or {}
		p.key = row.path
		kids[i].p = p
	end
	local p: { [string]: any } = list.p or {}
	p.key = "tree"
	p.selected = LIST_ID .. state.cursor
	p.max = { lines = list_lines(cx) }
	list.p = p
	return list
end

-- The dock: the breadcrumb, the jq path and size, notices, the keys.
local function dock_view(state: State): Node
	local chain: { Row } = {}
	local at: string? = state.cursor
	while at do
		local row = state.rows[state.index[at] or 0]
		if row == nil then
			break
		end
		table.insert(chain, 1, row)
		at = row.parent
	end
	local crumbs: { Span | string } = {}
	for i, row in chain do
		if i > 1 then
			table.insert(crumbs, ui.span("  ›  ", "dim"))
		end
		table.insert(crumbs, ui.span(row.label, if i == #chain then "strong" else "muted"))
	end

	local cursor = state.rows[state.index[state.cursor] or 0]
	local info: { Span | string } = { ui.span(if cursor and cursor.more then "" else state.cursor, "mono") }
	local v = cursor and cursor.value
	if v then
		local what = if v.kind == "object"
			then " · " .. plural(#(v.keys or {}), "key")
			elseif v.kind == "array" then " · " .. plural(#(v.items or {}), "item")
			elseif v.kind == "string" then " · " .. plural(utf8.len(v.text or "") or #(v.text or ""), "character")
			else ""
		table.insert(info, ui.span("  " .. v.kind .. what, "muted"))
	end
	table.insert(info, ui.span("  " .. bytes(state.bytes), "dim"))

	local lines: { Node } = { ui.text(crumbs), ui.text(info) }
	if state.capped then
		table.insert(
			lines,
			ui.text({ ui.span("Showing the first " .. MAX_ROWS .. " rows: collapse something to see the rest.", "warning") })
		)
	end
	if state.dupes > 0 then
		local what = plural(state.dupes, "duplicate member name")
		table.insert(lines, ui.text({ ui.span(what .. ": the last value of each is shown, as jq does.", "warning") }))
	end
	table.insert(
		lines,
		ui.text({ ui.span("↑↓ move  ←→ fold  ⏎ toggle  y copy path  c collapse all  r reload  o open as text", "dim") })
	)
	return ui.col({ ui.lines(lines) })
end

local function move(state: State, to: number)
	local row = state.rows[math.clamp(to, 1, math.max(1, #state.rows))]
	if row then
		state.cursor = row.path
	end
end

-- Enter on a row: toggles a container, or shows more of a long one.
local function toggle(state: State, row: Row)
	if row.more and row.parent then
		-- The cursor lands on the first child the "more" row revealed.
		local at = state.index[row.path] or 1
		state.limits[row.parent] = (state.limits[row.parent] or CHILD_ROWS) + CHILD_ROWS
		relayout(state)
		move(state, at)
	elseif is_container(row.value) then
		if state.expanded[row.path] then
			state.expanded[row.path] = nil
		else
			state.expanded[row.path] = true
		end
		relayout(state)
	end
end

local function open_as_text(state: State, cx: BlockCx)
	if state.path then
		-- A block's open goes through link routes and then opens as a
		-- link would (origin "link"), which this plugin's route leaves alone.
		cx:open(state.path :: string)
	end
end

tern.block.define("explorer", {
	init = function(cx: BlockCx, args: { string }, saved: any): State
		local path: string? = args[1]
		if path and string.sub(path, 1, 1) ~= "/" and cx.cwd then
			path = cx.cwd .. "/" .. path
		end
		local state: State = {
			cx = cx,
			path = path,
			name = if path then basename(path) else "JSON Explorer",
			root = nil,
			bytes = 0,
			dupes = 0,
			loading = false,
			problem = nil,
			expanded = { ["."] = true },
			limits = {},
			rows = {},
			index = {},
			capped = false,
			cursor = ".",
		}
		if type(saved) == "table" and type(saved.expanded) == "table" then
			state.expanded = {}
			for _, p in saved.expanded do
				if type(p) == "string" then
					state.expanded[p] = true
				end
			end
			if type(saved.cursor) == "string" then
				state.cursor = saved.cursor
			end
		end
		if path == nil then
			state.problem = {
				kind = "nofile",
				title = "No file to explore",
				text = "Open a `.json` file from the Files pane, or choose **Open with › JSON Explorer** in a file's menu.",
			}
		else
			load(state)
		end
		return state
	end,

	title = function(state: State): string?
		return state.name
	end,

	view = function(state: State, cx: BlockCx): BlockView
		-- A region draws its root node's children, not the root itself (a
		-- list there would lose its selection and events), so each view
		-- sits inside a column.
		if state.root and not state.problem then
			return { main = ui.col({ tree_view(state, cx) }), dock = dock_view(state) }
		elseif state.problem then
			return { main = ui.col({ problem_view(state, state.problem) }) }
		end
		return { main = ui.col({ ui.progress(nil, "Reading " .. state.name .. "…") }) }
	end,

	key = function(state: State, key: Key, cx: BlockCx): boolean?
		if key.ctrl or key.alt or key.meta then
			return false
		end
		local k = key.text or key.name
		if k == "r" then
			load(state)
			return true
		elseif k == "o" then
			open_as_text(state, cx)
			return true
		end
		if state.root == nil or state.problem then
			return false
		end
		local i = state.index[state.cursor] or 1
		local row = state.rows[i]
		local page = math.max(1, cx.rows - 6)
		if key.name == "up" or k == "k" then
			move(state, i - 1)
		elseif key.name == "down" or k == "j" then
			move(state, i + 1)
		elseif key.name == "page_up" then
			move(state, i - page)
		elseif key.name == "page_down" then
			move(state, i + page)
		elseif key.name == "home" or k == "g" then
			move(state, 1)
		elseif key.name == "end" or k == "G" then
			move(state, #state.rows)
		elseif key.name == "right" or k == "l" then
			local v = row.value
			if v and is_container(v) and not state.expanded[row.path] then
				toggle(state, row)
			elseif v and is_container(v) and #(v.items or {}) > 0 then
				move(state, i + 1) -- step onto the first child
			end
		elseif key.name == "left" or k == "h" then
			if is_container(row.value) and state.expanded[row.path] then
				toggle(state, row)
			elseif row.parent then
				state.cursor = row.parent
			end
		elseif key.name == "enter" or key.name == "space" then
			toggle(state, row)
		elseif k == "y" then
			if row.more == nil then
				cx:copy(row.path)
				cx:toast("success", "Copied jq path", row.path)
			end
		elseif k == "c" then
			state.expanded = { ["."] = true }
			state.cursor = "."
			relayout(state)
		else
			return false
		end
		return true
	end,

	event = function(state: State, ev: UiEvent, cx: BlockCx)
		if ev.ev == "action" and ev.act == "open" then
			open_as_text(state, cx)
		elseif ev.ev == "action" and ev.act == "reload" then
			load(state)
		elseif (ev.ev == "select" or ev.ev == "activate") and type(ev.item) == "string" then
			local path = string.sub(ev.item, #LIST_ID + 1)
			local row = state.rows[state.index[path] or 0]
			if row then
				state.cursor = path
				if ev.ev == "activate" then
					toggle(state, row)
				end
			end
		end
	end,

	save = function(state: State): any
		local open: { string } = {}
		for path in state.expanded do
			table.insert(open, path)
		end
		table.sort(open) -- stable output, so an unchanged set isn't sent again
		return { expanded = tern.json.array(open), cursor = state.cursor }
	end,
})
```

`window.luau`:

```lua
--!strict
-- The window half: `.json` files opened from the Files pane or the palette
-- go to the JSON Explorer block instead of the editor, unless the command
-- "Toggle JSON explorer for .json opens" turned that off.

-- The kv key of the switch; absent means on.
local ROUTE_KEY = "route_json"

-- Read on every open: `tern.kv` is one store for every window, so a toggle
-- in one window applies in the others at once.
local function enabled(): boolean
	return tern.kv.get(ROUTE_KEY) ~= false
end

tern.command({
	id = "toggle_route",
	title = "Toggle JSON explorer for .json opens",
	icon = "braces",
	run = function(cx: WindowCx)
		local on = not enabled()
		tern.kv.set(ROUTE_KEY, on)
		if on then
			cx:toast("success", ".json files open in JSON Explorer", "From the Files pane and the palette")
		else
			cx:toast("info", ".json files open in the editor", "Open with › JSON Explorer still works")
		end
	end,
})

tern.route.open(function(req: OpenRequest, _cx: WindowCx): RouteDecision?
	if not enabled() then
		return nil
	end
	-- Only a plain open a person made in the Files pane or the palette. A
	-- placement (beside, split, preview) or a line to reveal asks for the
	-- editor, and links, drops and `tern open` keep their usual behavior.
	if req.how ~= "default" or req.line ~= nil then
		return nil
	end
	if req.origin ~= "files" and req.origin ~= "palette" then
		return nil
	end
	if string.lower(string.sub(req.path, -5)) ~= ".json" then
		return nil
	end
	return { block = "jsonx.explorer", args = { req.path } }
end)
```