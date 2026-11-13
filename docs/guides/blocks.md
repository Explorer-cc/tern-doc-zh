# 块

插件块是一个窗格，其程序由你的 Lua 编写。它像 shell 一样位于会话守护进程的窗格表中，因此每个窗口、iOS app 和 Web 客户端都能显示它；即使窗口关闭、插件重新加载或守护进程重启，它也会继续存在。本页介绍如何定义和渲染块，如何通过按键、事件和后台任务驱动块，如何保存和恢复块，以及如何打开块。

## 块是什么

块类型在 manifest 中声明，并在 Host 端实现。每个运行中的块都是 Host 上的一个窗格，包含：

- **状态**：`init` 返回的值，保存在插件的 worker 中；
- **视图**：`view` 返回的节点树，worker 会对其进行差异比较，并以 surface protocol 帧发送到窗格；
- **已保存的值**：`save` 返回的内容，由守护进程与窗格一起存储。

窗口不会为块保存 Lua。它们绘制窗格发送的帧，并回传按键和指针事件，就像处理绘制原生界面的任何程序一样。因此，即使某个窗口中的插件两端都从未运行过，块也能正常工作，例如 Web 客户端。

## 声明与定义

```toml
[[blocks]]
id = "list"
title = "Checklist"
```

块的 kind 是 `<plugin>.<id>`，此处插件为 `checklist`，所以是 `checklist.list`。`title` 为命令面板中的一行命名为“New Checklist block”；在你的 `title` 处理器提供标题之前，它也是窗格标题。可选键 `icon`、`files` 和 `palette` 见 [清单参考](../reference/manifest.md)。

`host.luau` 通过 `tern.block.define(id, def)` 实现块：

| 字段 | 必需 | 调用时机 |
| --- | --- | --- |
| `init(cx, args, saved) -> state` | 是 | 块启动时，以及重新加载或守护进程重启后块重新启动时 |
| `view(state, cx) -> {main?, dock?, layer?}` | 是 | 每个处理器和每次 `cx:render()` 之后 |
| `title(state) -> string?` | 否 | 每次 `view` 之后 |
| `key(state, key, cx) -> boolean?` | 否 | 窗格有焦点时，每次按键和粘贴都会调用；对于没有产生任何变化的按键，必须恰好返回 `false` |
| `event(state, ev, cx)` | 否 | 有人操作视图中的节点时 |
| `resize(state, cols, rows, cx)` | 否 | 窗格的单元格尺寸改变时；若没有此处理器，块会自行重新渲染 |
| `save(state) -> any` | 否 | 每个处理器之后（返回 `false` 的 `key` 除外），以及 `cx:save()` 时 |

除了处理器，定义还会设置块的绘制方式（用于原生编辑的 `features` 见 [Host API](../reference/api-host.md#blockdef)）：

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `font` | `"mono"` | `"sans"` 会使用 UI 字体绘制块，就像 Tern 自带的应用一样；ID、路径和数字则通过 span token 和 `mono` 表格列保持等宽（见[设计视图](design.md#字体与排版)和[Surface](../protocol/surfaces.md#打开与关闭)）。除 `"sans"` 或 `"mono"` 外，任何值都会在定义块时导致插件失败：`tern.block.define: <id>: unknown font "<x>" (mono, sans)` |

如果 `host.luau` 加载结束时某个已声明的块尚未定义，插件就会失败。每次调用都受 Host 的 2 s 时限约束。

## 块的 `cx`

除 `title` 和 `save` 外，每个处理器都会收到块的 `cx`。每个运行中的块各有一个 `cx`，因此计时器和进程回调可以保留它；但保留它既不会让块继续存活，也不会取消后台工作。块结束后，如果该窗格中没有运行中的块，应用 `render`、`save`、`exit`、`frame` 和 `blob` 请求时会忽略这些请求（`blob` 仍会返回计算出的 id）。这些检查基于窗格，而不是保留上下文的生命周期令牌。`toast`、`open` 和 `copy` 不会检查块是否仍在运行，所以块结束后仍可能影响窗口。

| 成员 | 含义 |
| --- | --- |
| `cx.pane` | 块所在 Host 上的窗格 ID |
| `cx.cwd` | 块启动时窗格的工作目录，或 `nil` |
| `cx.cols`, `cx.rows` | 窗格的单元格尺寸；在运行 `resize` 之前更新 |
| `cx:render()` | 重新渲染：像处理器之后一样调用 `view`、`title` 和 `save` |
| `cx:save()` | 立即运行 `save`；仅当结果改变时才存储 |
| `cx:exit(code)` | 以退出状态 `code` 结束块 |
| `cx:frame(ops)` | 发送原始 surface protocol 帧操作 |
| `cx:blob(bytes, mime)` | 发送字节（例如 `"image/png"`），并返回供 `image` 节点的 `blob` 属性使用的 blob ID |
| `cx:toast(level, text, sub?)` | 在显示该窗格的窗口中显示一条 toast |
| `cx:open(target)` | 通过这些窗口的路由打开路径或 URL |
| `cx:copy(text)` | 将内容复制到这些窗口的剪贴板 |

通过 `cx` 发出的请求会排队，并在当前处理器返回后按顺序应用，因此处理器不会在另一个处理器内部运行。

## 渲染周期

你不需要自行发送视图。每个处理器（`init`、`key`（恰好返回 `false` 时除外）、`event`、`resize`）以及每次 `cx:render()` 之后，worker 都会：

1. 调用 `view`，并将结果与上次发送的视图进行差异比较；
2. 如果有更改，则发送一帧；
3. 调用 `title`，并在标题改变时发送新标题；
4. 调用 `save`，并在其 JSON 改变时存储结果。

没有 `resize` 处理器的块调整大小时，会执行步骤 1 到 3：视图可以读取 `cx.cols` 和 `cx.rows`，但状态没有改变，因此无需保存。

因此，整体模式是：在处理器中修改 `state`，然后返回，视图随之更新。处理器抛出错误时，该次调用会丢失，并显示 toast：“Plugin *name*: list.key failed”；之后仍会执行渲染。如果 `view` 抛出错误或返回格式错误的内容，也会以相同方式报告，屏幕上仍保留上一次正常的视图。

## 区域、节点 ID 和键

`view` 最多返回三个区域：

| 区域 | 位置 |
| --- | --- |
| `main` | 块的主要区域 |
| `dock` | 块下方的一条区域 |
| `layer` | 覆盖在上方的图层，用于面板和叠层。绘制在其中的内容会接收点击；其余部分会将点击传递给 `main` |

省略的区域不会显示任何内容。每个区域的根节点就是该区域本身：Tern 会将其子节点绘制到窗格中，并将根节点的 `role` 属性应用到区域元素，但不会绘制根节点自身的内容。每个区域根节点都应是容器，例如 `ui.col({ … })`；单独使用 `main = ui.text(…)` 不会显示任何内容。

worker 会为每个节点命名，以便对视图进行差异比较。区域根节点使用区域名（`main`）；每个子节点的名称是 `<parent id>.<key>`，其中 `key` 是子节点的 `p.key`（字符串或数字），若不存在则使用其同级节点中的从 0 开始的索引：

```text
main                 ui.col({ listing })
main.items           the list, p.key = "items"
main.items.i7        an item, p.key = "i7"
main.items.i3        an item, p.key = "i3"
dock.0               the dock's first child, unkeyed
```

在两个视图之间，ID 和 kind 相同的节点只会更新有变化的属性；文本节点若文本只在末尾增长，则会追加文本；kind 改变时会替换节点；消失、出现或移动的子节点则会按 ID 删除、添加或移动。

任何可能重新排序、插入或删除的内容都需要键。若列表项不带键，第三项无论显示什么都会是 `main.items.2`，因此删除第一项会导致所有 ID 位移：每一行都会重写，而 Tern 的视图状态（滚动位置、焦点、某个区段的折叠状态）会留在原来的位置，而不是跟随该项。若使用稳定的键（例如项目 ID），行无论移动到哪里都会保留其 ID 和视图状态，差异比较只需移动该行。两个同级节点使用相同的键会报错（`main.items: duplicate child key "i3"`），并且该视图会被拒绝。

视图也通过 ID 引用自身节点：列表的 `selected` 属性存储所选项目的 ID；事件则通过 `ev.id` 报告被操作的节点。

## 按键与粘贴

块的窗格有焦点时，按键会像发送给任何程序一样传递给它：窗口会先处理自己绑定的按键，所有其他按键都会交给 `key`：

```lua
key = { name = "j", text = "j", ctrl = false, alt = false, shift = false, meta = false }
```

`name` 是按键名称：小写字符（`"a"`、`"+"`）或命名按键（`"enter"`、`"tab"`、`"backspace"`、`"escape"`、`"space"`、`"up"`、`"down"`、`"left"`、`"right"`、`"home"`、`"end"`、`"page_up"`、`"page_down"`、`"delete"`、`"f1"` 到 `"f35"`、……）。`text` 是按键实际输入的内容（如果有）。在 macOS 上，`meta` 对应 Cmd。完整列表见 [Host API](../reference/api-host.md#key)。

粘贴内容会作为一次调用传入，`name = "paste"`，`text` 中包含粘贴的文本，包括换行符。

`key` 的返回值决定是否进行后续渲染。按键未产生任何变化时，必须恰好返回 `false`：worker 会跳过渲染和保存，因此块忽略的按键不会触发 `view` 调用。返回其他任何值（`true` 或不返回值）都会渲染并保存。若处理器先改变状态再返回 `false`，视图（以及已保存状态）会一直保持原样，直到其他操作触发渲染，因此所有会改变内容的分支都应返回 `true`（或不返回值），只有未使用的按键才返回 `false`。返回值不会将按键转发到其他位置：`key` 忽略的按键不会被传递到别处。

窗格调整大小时，`cx.cols` 和 `cx.rows` 会改变，块会重新渲染，因此按 `cx.cols` 布局的 `view` 无需 `resize` 处理器也会跟随窗格变化。如果定义了 `resize` 处理器，它会先运行（以便根据新尺寸重新计算内容），随后块进行渲染和保存；如果没有该处理器，则只进行渲染。

## 来自视图的事件

带有 `actions` 属性的节点在被点击时会发送事件。节点设置 `p.actions = { click = "check=7" }` 后，`event` 收到：

```lua
ev = { ev = "action", id = "main.items.i7", act = "check", value = "7" }
```

名称会在第一个 `=` 处拆分为 `act` 和 `value`；若有按住的修饰键，则会在 `mods` 中列出。`event` 还会接收发出请求的节点生成的 `select`、`activate` 和 `toggle` 事件，以及复选框和单选框发出的 `change` 事件（[表单与控件](views.md#表单与控件)）。完整事件列表和内置 action 名称见[构建视图](views.md#操作与事件)。

## 后台更新

处理器会在块发生某种情况时运行。若要按自己的节奏更新视图（例如轮询或进程完成时），请在计时器、进程或 fetch 回调中修改 `state`，并调用 `cx:render()`。Host 端的计时器、进程和 fetch 回调不会收到 `cx`，因此应在闭包中保留 `init` 收到的块的 `cx`。

块没有“关闭”处理器，因此后台工作必须自行检测块是否已消失。`tern.pane.list()` 会列出 Host 上程序尚未退出的窗格，其中也包括块；当块所在的窗格不在列表中时就应停止。尽可能取消生产者，并在完成回调中再次检查，再更新状态或发送副作用。若代码通过 `cx:exit()` 结束块，还应在排队退出请求之前设置本地 stopped 标志：在处理器返回之前，窗格列表不会反映已排队的请求。

以下块每两秒将启动参数作为命令运行，并显示输出：

```lua
--!strict
local ui = tern.ui

type WatchState = { argv: { string }, out: string, status: number?, at: number }

local EVERY_MS = 2000

-- Whether pane `pane` still runs (a block that ended is gone from the list).
local function running(pane: number): boolean
	for _, p in tern.pane.list() do
		if p.pane == pane then
			return true
		end
	end
	return false
end

local watch: BlockDef<WatchState> = {
	init = function(cx, args, _saved)
		local state: WatchState = { argv = args, out = "", status = nil, at = 0 }
		local function tick()
			if not running(cx.pane) then
				return
			end
			tern.process.run(state.argv, { cwd = cx.cwd, timeout_ms = 10000 }, function(r)
				if not running(cx.pane) then
					return
				end
				state.out, state.status, state.at = r.stdout .. r.stderr, r.status, tern.now()
				cx:render()
				tern.timer(EVERY_MS, function()
					if running(cx.pane) then
						tick()
					end
				end)
			end)
		end
		if #args > 0 then
			tick()
		end
		return state
	end,
	title = function(state)
		return if #state.argv > 0 then "watch " .. table.concat(state.argv, " ") else nil
	end,
	view = function(state, _cx)
		if #state.argv == 0 then
			return { main = ui.col({ ui.text({ ui.span("Pass the command to run as arguments", "muted") }) }) }
		end
		return {
			main = ui.col({ ui.ansi(state.out) }),
			dock = ui.row({ ui.text({
				ui.span(if state.status == 0 then "ok" else "exit " .. tostring(state.status), if state.status == 0 then "success" else "error"),
				ui.span(" · every " .. EVERY_MS // 1000 .. "s", "muted"),
			}) }),
		}
	end,
}

tern.block.define("watch", watch)
```

每次启动进程前、进程完成回调中，以及计时器安排下一次运行前，都会检查块是否仍在运行。
块所在的窗格在 `init` 运行之前就已列出，因此在 `init` 中执行相同检查也会通过。进程本身运行在线程池中，所以 worker 在此期间仍可处理按键和其他块。重新加载会停止旧 worker，包括计时器；新块的 `init` 会重新启动循环。

## 保存与恢复

块会在两种情况下重新启动：插件重新加载会将运行中的块迁移到新 worker；守护进程重启会将块与会话的其余部分一起恢复。两种情况都会再次调用 `init`，传入相同的 `args` 以及 `saved`（即 `save` 上次返回、从 JSON 解码而来的值）。其他内容都不会保留：旧运行中的状态表、计时器和进程都会消失；守护进程重启后，块会从空白屏幕开始。

因此，所有需要保留的内容都必须通过 `save` 保存：

- `save` 返回可转换为 JSON 的值：表、字符串、数字、布尔值、`tern.json.null`。每个处理器之后都会运行它；守护进程只会在 JSON 发生变化时存储该值，因此返回相同值的开销很低。
- 可能为空的列表应使用 `tern.json.array(t)` 包装，否则空列表会编码为 `{}`。解码后的数组会作为 Lua 数组返回。
- 在 `init` 中，如果 `saved` 和 `args` 均存在，应优先使用 `saved`；`args` 是启动参数，每次都会传入。
- 派生数据和临时数据（选择项、滚动位置、缓存）不要放入 `save`；或者在恢复时为其设置默认值。

若 `init` 抛出错误，块会结束：错误会显示在窗格中，窗格以状态码 1 退出。

## 打开块

| 来源 | 方式 | `args` | 放置位置 |
| --- | --- | --- | --- |
| 命令面板 | 对于当前 Host 上每个 `palette` 不为 `false` 的 Ready 块类型，显示“New *title* block” | 无 | 聚焦窗格旁边，或按命令面板的位置修饰符放置 |
| 文件菜单 | Files 窗格和文件块菜单中的“Open with *title*”；适用于 `files` glob 与文件名匹配的块类型 | `{ path }` | 聚焦窗格旁边，位于文件所在文件夹 |
| 路由 | `tern.route.open` 或 `tern.route.link` 返回 `{ block = "checklist.list", args = { … } }` | 按给定值 | 原本打开目标的位置 |
| 窗口处理器 | 在命令、绑定或事件中调用 `cx:new_block("checklist.list", args?, how?)`；返回窗格 | 按给定值 | `how`，与 `cx:open` 类似 |
| 布局 | 在 `cx.layout:new_tab`、`:split` 或工作区叶节点的 `launch` 中使用 `{ block = "checklist.list", args = { … } }` | 按给定值 | 对应标签页或拆分窗格 |

kind 的格式为 `<plugin>.<block>`，不带 `plugin.` 前缀。窗口必须能在 Host 的目录中找到该 kind：如果某个 Host 上的插件失败或已禁用，该 Host 上的块类型就无法打开。见[路由打开与链接](routing.md)和[布局与工作区](layout.md)。

## 标题与退出

`title(state)` 为窗格（以及块聚焦时的标签页）命名。每次 `view` 后都会运行；如果返回了不同的字符串，就会发送新标题；返回 `nil` 则保留当前标题。在尚无标题时，窗格会显示 manifest 中的 `title`。

`cx:exit(code)` 会结束块：块会从 worker 中移除，窗格中的程序会以该状态码退出，并且不会在重新加载时重启。之后窗格的行为与任何程序已退出的窗格相同。可用于已完成工作的块，例如最后一步完成后的向导。

## 完整示例：清单

清单从启动参数初始化；可将粘贴的行作为新项目，使用 `j`/`k` 或方向键移动，使用 Space、Enter 或点击切换状态，使用 `d` 删除，并且可以在重新加载和重启后恢复。

`plugin.toml`：

```toml
schema = 1
id = "checklist"
name = "Checklist"
version = "0.1.0"
description = "A checklist pane that survives restarts."
host = "host.luau"

[[blocks]]
id = "list"
title = "Checklist"
```

`host.luau`：

```lua
--!strict
-- Block `checklist.list`: launch arguments become items; j/k (or the
-- arrows) move, space toggles, d deletes, pasted lines are added, clicks
-- toggle. Items keep their ids, so reorders and deletes keep view state.

local ui = tern.ui

type Entry = { id: number, text: string, done: boolean }
type State = { items: { Entry }, sel: number, seq: number }

local function add(state: State, text: string)
	local trimmed = string.match(text, "^%s*(.-)%s*$") or ""
	if trimmed ~= "" then
		state.seq += 1
		table.insert(state.items, { id = state.seq, text = trimmed, done = false })
	end
end

local function clickable(node: Node, act: string): Node
	local p: { [string]: any } = node.p or {}
	p.actions = { click = act }
	node.p = p
	return node
end

local function counts(state: State): (number, number)
	local done = 0
	for _, item in state.items do
		if item.done then
			done += 1
		end
	end
	return done, #state.items
end

local list: BlockDef<State> = {
	init = function(_cx, args, saved)
		if saved then
			return { items = saved.items or {}, sel = 1, seq = saved.seq or 0 }
		end
		local state: State = { items = {}, sel = 1, seq = 0 }
		for _, arg in args do
			add(state, arg)
		end
		return state
	end,

	title = function(state)
		local done, total = counts(state)
		return string.format("Checklist %d/%d", done, total)
	end,

	view = function(state, _cx)
		local rows: { Entry } = state.items
		local items = {}
		for i, item in rows do
			items[i] = {
				label = if item.done then { ui.span(item.text, "del muted") } else item.text,
				icon = if item.done then "check" else nil,
			}
		end
		local listing = ui.list(items)
		local children: { Node } = listing.c or {}
		for i, child in children do
			clickable(child, "check=" .. rows[i].id)
			local p: { [string]: any } = child.p or {}
			p.key = "i" .. rows[i].id
		end
		local current = rows[state.sel]
		listing.p = {
			key = "items",
			selected = if current then "main.items.i" .. current.id else nil,
			empty = { ui.span("Paste lines to add items", "muted") },
		}
		local done, total = counts(state)
		return {
			main = ui.col({ listing }),
			dock = ui.col({
				ui.row({
					ui.text({ ui.span(string.format("%d of %d done", done, total), "muted") }),
					clickable(ui.badge("Clear done", "accent"), "clear"),
				}),
			}),
		}
	end,

	key = function(state, key, _cx)
		local n = #state.items
		if key.name == "paste" then
			for line in string.gmatch(key.text or "", "[^\r\n]+") do
				add(state, line)
			end
		elseif key.name == "j" or key.name == "down" then
			state.sel = math.min(state.sel + 1, math.max(n, 1))
		elseif key.name == "k" or key.name == "up" then
			state.sel = math.max(state.sel - 1, 1)
		elseif key.name == "space" or key.name == "enter" then
			local item = state.items[state.sel]
			if item then
				item.done = not item.done
			end
		elseif key.name == "d" or key.name == "backspace" then
			table.remove(state.items, state.sel)
			state.sel = math.max(math.min(state.sel, #state.items), 1)
		else
			return false
		end
		return true
	end,

	event = function(state, ev, _cx)
		if ev.ev ~= "action" then
			return
		end
		if ev.act == "check" then
			for i, item in state.items do
				if tostring(item.id) == ev.value then
					item.done = not item.done
					state.sel = i
				end
			end
		elseif ev.act == "clear" then
			local kept = {}
			for _, item in state.items do
				if not item.done then
					table.insert(kept, item)
				end
			end
			state.items = kept
			state.sel = 1
		end
	end,

	save = function(state)
		return { items = tern.json.array(state.items), seq = state.seq }
	end,
}

tern.block.define("list", list)
```

上述示例的用法：

- **稳定的键。** 每个项目的 ID 来自 `seq`，它只会递增并且会被保存，因此在删除、重新加载或重启前后，`i7` 始终代表同一个项目。列表的 `selected` 属性通过节点 ID 指定所选项目：`main.items.i<id>`；根据这些键可以推导出该 ID，因为列表在 `main` 下以 `items` 为键。
- **操作携带目标。** 点击会发送 `check=<id>`，因此 `event` 会通过 `ev.value` 查找项目，而不是依据位置。
- **区域。** `main` 和 `dock` 都以 `col` 作为根节点；`dock` 的 `row` 位于其根节点内，使计数和按钮排列在同一行。
- **保存内容。** 会保存项目和 `seq`；不会保存选择项，重启后从第一项开始。`tern.json.array` 可确保空列表仍是 JSON 数组。
- **打开方式。** 在命令面板中选择“New Checklist block”会打开空清单。Window 端可以通过 `cx:new_block("checklist.list", { "Write tests", "Update docs" })` 打开预先填好内容的清单。

## 相关页面

- [Host API](../reference/api-host.md#tern-block-define)：所有字段、操作和消息。
- [构建视图](views.md)：构建器、操作、色调和 CSS。
- [生命周期与重新加载](../concepts/lifecycle.md)：哪些内容会重启。
- [文件、进程与存储](io.md)：计时器、进程和 `tern.kv`。
