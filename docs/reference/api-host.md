# Host API

Host 上下文会在每个插件的一个工作线程中运行 `host.luau`，运行位置是机器的窗格所在处：在会话守护进程内，或在没有守护进程为窗格提供服务时的窗口内。它负责插件块、命令 Lens、带有 spawn 过滤器的 Host 事件，以及向窗格写入内容。每次调用的预算为 2 s。关于工作线程所在位置，参见[架构](../concepts/architecture.md)；关于重新加载对运行中块和 Lens 的影响，参见[生命周期与重新加载](../concepts/lifecycle.md)。

处理器通过 `cx` 发出的请求（渲染、保存、退出、帧、blob、提示、打开、复制）以及通过 `tern.pane.write` 发出的请求都会排队，并在处理器返回后应用，因此不会在另一个处理器内部运行。

## `tern.block.define`

```lua
tern.block.define: (id: string, def: BlockDef<any>) -> ()
```

实现块类型 `id`，该类型必须由 `plugin.toml` 中的 `[[blocks]]` 表声明。块的类型标识为 `<plugin>.<id>`；其 surface 角色为 `plugin.<plugin>.<id>`。

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| `id` | `string` | 此插件的 `[[blocks]]` `id` |
| `def` | `BlockDef<S>` | 下文的处理器 |

会抛出：

- `tern.block.define: block "<id>" is not declared in plugin.toml`；
- ``tern.block.define: <id>: `init` must be a function``（`view` 也同样如此）；
- `tern.block.define: <id>: unknown feature "<name>" (edit, undo)`。
- `tern.block.define: <id>: unknown font "<x>" (mono, sans)`。

再次使用相同的 `id` 调用会替换定义，之后启动的块会使用新定义。若清单中声明的块在入口结束时仍未定义，插件会失败：`block <id> is declared in plugin.toml but not defined with tern.block.define`。

### `BlockDef`

```lua
type BlockDef<S> = {
	init: (cx: BlockCx, args: { string }, saved: any) -> S,
	view: (state: S, cx: BlockCx) -> BlockView,
	title: ((state: S) -> string?)?,
	key: ((state: S, key: Key, cx: BlockCx) -> boolean?)?,
	event: ((state: S, ev: UiEvent, cx: BlockCx) -> ())?,
	features: { "edit" | "undo" }?,
	font: ("sans" | "mono")?,
	resize: ((state: S, cols: number, rows: number, cx: BlockCx) -> ())?,
	save: ((state: S) -> any)?,
}

type BlockView = {
	main: Node?,
	dock: Node?,
	layer: Node?,
}
```

| 字段 | 必需 | 调用时机 | 钩子名称 |
| --- | --- | --- | --- |
| `init(cx, args, saved)` | 是 | 块启动时、重新加载后以及守护进程重启后 | `<id>.init` |
| `view(state, cx)` | 是 | 每个处理器之后以及每次 `cx:render()` 之后 | `<id>.view` |
| `title(state)` | 否 | 每次 `view` 之后 | `<id>.title` |
| `key(state, key, cx)` | 否 | 每次按键和粘贴时；对于没有改变任何内容的按键，必须准确返回 `false` | `<id>.key` |
| `event(state, ev, cx)` | 否 | 视图节点触发每个用户事件时 | `<id>.event` |
| `resize(state, cols, rows, cx)` | 否 | 窗格以单元格数计量的尺寸改变时（即使没有此处理器，块仍会重新渲染） | `<id>.resize` |
| `save(state)` | 否 | 每个处理器之后（返回 `false` 的 `key` 除外），以及 `cx:save()` 时 | `<id>.save` |

`features` 不是处理器：它列出块使用的 Surface Protocol 功能特性，并由块在 hello 中声明。`"edit"` 会在块的 `editor` 和 `input` 字段中启用[原生编辑（edit 和 undo）](../elements/input.md#原生编辑、edit-与-undo)（同时必须启用 Settings › Terminal › Native composer editing）：点击会放置插入光标，拖动或按住 ⇧ 并使用方向键会进行选择，变更会以 `edit` 事件传给 `event`。`"undo"` 会将 ⌃Z（macOS 上为 ⌘Z）作为 `undo` 事件发送，而不是按键。没有 `features` 时，每个按键都会传给 `key`，点击聚焦字段不会有任何效果。

`font` 也不是处理器：`"sans"` 会使用 UI 字体绘制块的区域（默认的 `"mono"` 则使用终端字体），与 TSP surface 的 [`font`](../protocol/surfaces.md#打开与关闭) 相同。应用应使用它；参见[设计视图](../guides/design.md#字体与排版)。

`init` 会收到：

- `args`：启动参数字符串数组（来自路由决策、`cx:new_block`、`launch` 表，或“打开方式”打开文件；后者会传入路径）；
- `saved`：上次 `save` 返回并从 JSON 解码的值；新块则为 `nil`。

`init` 的返回值是块的状态，并会传给其他每个处理器。应就地修改状态；除 `init` 外，其他处理器的返回值都不会被保留（`key` 的返回值只决定是否随后渲染）。

`init` 若抛出异常，块会结束：错误文本（含回溯）会打印在窗格中，窗格以状态码 1 退出，并显示错误提示。

**每个处理器之后**（`init`、除准确返回 `false` 外的 `key`、`event`、`resize` 和 `cx:render()`），工作线程会：

1. 调用 `view`，并将结果与上次发送的视图进行差异比较；
2. 有变更时发送一帧变更；
3. 调用 `title`，若返回的字符串与上次发送的标题不同，则发送标题（`nil` 会保留当前标题；尚无标题时，窗格显示清单中的 `title`）；
4. 调用 `save`，仅当结果与上次存储的值不同（按 JSON 比较）时，才将结果与窗格一同保存。

处理器抛出异常时，会报告该异常，且仅丢弃此次调用：之后的渲染和保存仍会运行。

没有 `resize` 处理器的块发生大小调整时，会运行步骤 1 到 3（`cx.cols` 和 `cx.rows` 已改变，因此 `view` 可能会采用不同布局）；状态没有变化，因此不会运行 `save`。若有此处理器，则会先运行处理器，再运行全部四个步骤。

`key` 在按键没有改变任何内容时准确返回 `false`：工作线程会跳过渲染和保存。任何其他返回值（`true`、`nil` 或无返回值）都会触发渲染和保存。若 `key` 改变了状态却返回 `false`，视图会一直过期到下次渲染，因此只应对块不会处理的按键返回 `false`。返回值不会路由按键：按键会像到达任何窗格程序一样到达块；窗口的按键映射会先处理其绑定的按键，其他按键无论 `key` 是否处理都会传给块。

### 视图模型

每次 `view` 都会返回每个区域的完整树：`main`（块的区域）、`dock`（其下方的条带）和 `layer`（其上方）。返回 `nil` 或省略某个区域，则该区域不显示任何内容。

区域的根节点是容器，而非绘制出来的节点：只有它的 `role` 属性（作为 `data-role` 设置在区域元素上）及其子节点会显示。每个区域都应使用 `tern.ui.col` 或 `tern.ui.row` 作为根节点；`main = tern.ui.text(…)` 不会显示任何内容，`main = tern.ui.col({ tern.ui.text(…) })` 则会显示文本。

工作线程会为每个节点分配一个 id：最顶层是区域名称，之后为 `<parent id>.<key>`，其中 `key` 是节点的 `p.key`（字符串或数字），否则使用其在同级节点中的索引（从 0 开始）。带键节点会保留其 id，Tern 也会在重新排序时保留其视图状态（滚动位置、焦点、折叠状态）。无键节点按位置匹配。

| 两个视图之间的变化 | 发送的操作 |
| --- | --- |
| ID 和类型相同，属性不同 | 对变更的属性执行 `set`；已删除的属性设为 `null` |
| 文本类型（`text`、`md`、`code`、`ansi`、`math`、`editor`、`input`、`shimmer`）的 `text` 仅在末尾增加了后缀 | 使用新后缀执行 `text … append` |
| 文本类型的 `text` 发生其他变化 | 执行 `text … replace` |
| ID 相同、类型不同 | 先 `del`，再 `add` |
| 子节点消失、增加或重新排序 | 执行 `del`、在下一个同级节点之前执行 `add`，按 id 移动 |

大于 64 KiB 的帧会拆分为多个块。

无法读取的视图会报告为 `<id>.view` 失败，屏幕上保留上一个视图：

| 问题 | 消息 |
| --- | --- |
| 既不是表，也不是 `nil` | `view: expected {main?, dock?, layer?}, got …` |
| 键不是三个区域之一 | `view: unknown region "<k>" (main, dock or layer)` |
| 节点不是表 | `<id>: a node must be a table, got …` |
| 节点没有字符串 `k` | ``<id>: a node needs a string `k` `` |
| `p` 不是表 | ``<id>: `p` must be a table, got …`` |
| `c` 不是列表 | ``<id>: `c` must be a list, got …`` |
| 两个同级节点具有相同的键 | `<id>: duplicate child key "<key>"` |

使用 [`tern.ui`](ui.md) 构建节点。参见[构建视图](../guides/views.md)。

### `Key`

```lua
type Key = {
	name: string,
	text: string?,
	ctrl: boolean,
	alt: boolean,
	shift: boolean,
	meta: boolean,
}
```

| 字段 | 含义 |
| --- | --- |
| `name` | 按键：小写字符（`"a"`、`"+"`、`"é"`）、`"space"`，或下文列出的命名按键 |
| `text` | 按键实际输入的内容（如 Shift+A 输入 `"A"`，Space 输入 `" "`）；命名按键和大多数组合键不会设置此字段 |
| `ctrl`、`alt`、`shift`、`meta` | 当前按住的修饰键；macOS 上的 `meta` 是 Cmd，其他系统上是 Super |

命名按键：`enter`、`tab`、`backspace`、`escape`、`space`、`up`、`down`、`left`、`right`、`home`、`end`、`begin`、`page_up`、`page_down`、`insert`、`delete`、`menu`、`f1` … `f35`、`caps_lock`、`scroll_lock`、`num_lock`、`print_screen`、`pause`。小键盘按键会报告其代表的字符。

粘贴内容会作为一个按键到达，其 `name = "paste"`，`text` 为粘贴的文本，且不带修饰键。不会传递按键释放、单独的修饰键按下以及媒体键。

### `UiEvent`

```lua
type UiEvent = {
	ev: string,
	[string]: any,
}
```

来自块节点的用户事件。只有以下 `ev` 值会传到 `event`；其余 Surface Protocol 流量（确认消息、大小调整、主题和可见性变更）不会传递：

| `ev` | 发送时机 | 字段 |
| --- | --- | --- |
| `action` | 自定义名称的指针操作运行（`p.actions = { click = "inc" }`）、点击 `button`，或选中表格的按钮单元格或行菜单项时 | `id`、`act`、`value`、`item`（表格行）、`mods` |
| `select` | 节点的 `select` 操作运行时 | `id`、`item` |
| `activate` | 节点的 `activate` 操作运行时（双击、Enter） | `id`、`item` |
| `toggle` | 可折叠节点展开或折叠时（Tern 在本地切换） | `id`、`key`、`collapsed` |
| `focus` | 点击请求将键盘输入交给某个 `editor` 或 `input` 时 | `id` |
| `edit` | 编辑器中的原生编辑 | `id`、`from`、`to`、`text`、`cursor`、`len` |
| `undo` | 原生编辑下的 ⌃Z（macOS 上为 ⌘Z） | `id` |

`id` 是工作线程分配的节点 id（`main.0.2`，或子节点键为 `rows` 时的 `main.rows`；参见[视图模型](#视图模型)）。载荷对应 Surface Protocol 的[输入与事件](../protocol/input.md#事件)。Tern 只会向 hello 中列出 `edit` 功能的程序发送 `edit`，只会向列出 `undo` 的程序发送 `undo`：块只有在其 `BlockDef` 中设置 `features = { "edit", "undo" }` 才会收到这些事件。

### 示例

```lua
tern.block.define("counter", {
	init = function(_cx, args, saved)
		return { count = if saved then saved.count else tonumber(args[1]) or 0 }
	end,
	title = function(state)
		return "Counter " .. state.count
	end,
	view = function(state, _cx)
		local plus = tern.ui.badge("+", "accent")
		local p: { [string]: any } = plus.p or {}
		p.actions = { click = "inc" }
		plus.p = p
		return { main = tern.ui.col({
			tern.ui.text({ tern.ui.span("Count: ", "muted"), tern.ui.span(tostring(state.count), "strong") }),
			plus,
		}) }
	end,
	key = function(state, key, _cx)
		if key.text == "+" then
			state.count += 1
		end
		return nil
	end,
	event = function(state, ev, _cx)
		if ev.ev == "action" and ev.act == "inc" then
			state.count += 1
		end
	end,
	save = function(state)
		return { count = state.count }
	end,
})
```

```toml
[[blocks]]
id = "counter"
title = "Counter"
```

## 块上下文（cx）

```lua
declare extern type BlockCx extends EffectCx with
	pane: number
	cwd: string?
	cols: number
	rows: number
	function render(self): ()
	function save(self): ()
	function exit(self, code: number): ()
	function frame(self, ops: { any }): ()
	function blob(self, bytes: string, mime: string): string
end
```

每个运行中的块有一个 `cx`，并传给 `init`、`view`、`key`、`event` 和 `resize`。定时器和进程回调可以保留它，但保留它不会让块继续存活，也不会在块结束时取消异步工作。

块结束后，应用绑定到块的请求（`render`、`save`、`exit`、`frame` 和 `blob`）时，若该窗格中没有正在运行的块，则会忽略这些请求。`blob` 仍会计算并返回其 ID，但不会为已结束的块存储 blob。这些检查以窗格为依据，而不是为保留的上下文提供生命周期令牌。

副作用有所不同：即使块结束，`toast`、`open` 和 `copy` 仍可转发到显示该窗格的窗口。它们不受块存活状态保护。应尽可能取消产生异步结果的任务，并在其回调执行操作前检查存活状态，尤其是在触发副作用之前。没有块关闭回调；关于使用 `tern.pane.list()` 检查，参见[在后台更新](../guides/blocks.md#后台更新)。当你自己的代码调用 `cx:exit()` 时，也应保留一个本地停止标记，因为请求只有在处理器返回后才会应用。

| 成员 | 行为 |
| --- | --- |
| `cx.pane` | 此 Host 上窗格的 id |
| `cx.cwd` | 块启动时窗格的工作目录，或 `nil` |
| `cx.cols`、`cx.rows` | 窗格当前的单元格尺寸（在运行 `resize` 前更新） |
| `cx:render()` | 将渲染排入队列：执行 `view`、标题更新和 `save`，与处理器之后的行为相同。在定时器、进程或获取数据的回调中更改状态后使用 |
| `cx:save()` | 将 `save` 排入队列，并在结果改变时立即存储 |
| `cx:exit(code?)` | 以退出状态 `code` 结束块（默认值为 `0`）：其 surface 关闭，窗格程序已退出 |
| `cx:frame(ops)` | 将 `ops`（原始 Surface Protocol 帧操作列表）作为一帧发送。若出错，会抛出 `cx:frame: ops must be a list` |
| `cx:blob(bytes, mime)` | 将 `bytes` 作为类型为 `mime` 的 blob 发送，并返回其 ID（`bytes` 的 SHA-256 小写十六进制值），供 `image` 节点的 `blob` 属性使用。只要 Tern 的 blob 缓存仍保留这些字节，此 ID 就能在其他块和重启后继续使用（若保存的状态持有该 ID）；因此块无需重复发送 |
| `cx:toast`、`cx:open`、`cx:copy` | 与 [副作用上下文（cx）](#副作用上下文-cx) 中相同，目标为显示此窗格的窗口 |

请求会在当前处理器返回后按顺序应用。在每个处理器中，排队的渲染最多重复 8 轮；超过此次数的剩余请求会被丢弃，并记录日志消息 `plugin keeps re-rendering; requests dropped`。

`cx:frame` 会绕过视图差异比较：下一次渲染仍会与上次 `view` 的结果进行比较，而不是与原始操作所做的变更比较。

```lua
init = function(cx, _args, _saved)
	local state = { lines = {} }
	tern.process.run({ "uptime" }, function(r)
		local live = false
		for _, pane in tern.pane.list() do
			if pane.pane == cx.pane then
				live = true
				break
			end
		end
		if not live then
			return
		end
		table.insert(state.lines, r.stdout)
		cx:render()
	end)
	return state
end,
```

## `tern.lens.define`

```lua
tern.lens.define: (id: string, def: LensDef<any>) -> ()
```

实现命令 Lens `id`，该 Lens 必须在 `plugin.toml` 的 `[[lenses]]` 表中声明，并设置其 `match` 通配模式。Lens ID 为 `plugin.<plugin>.<id>`，其块的角色为 `lens.plugin.<plugin>.<id>`。

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| `id` | `string` | 此插件的 `[[lenses]]` `id` |
| `def` | `LensDef<S>` | 下文的处理器 |

会抛出：

- `tern.lens.define: lens "<id>" is not declared in plugin.toml`；
- ``tern.lens.define: <id>: `open` must be a function``（`line`、`finish`、`view` 也同样如此）。

若已声明的 Lens 在入口结束时仍未定义，插件会失败：`lens <id> is declared in plugin.toml but not defined with tern.lens.define`。


### `LensDef`

```lua
type LensDef<S> = {
	open: (run: LensRun, cx: EffectCx) -> S,
	line: (state: S, l: LensLine) -> (),
	finish: (state: S, status: number) -> (),
	view: (state: S) -> Node?,
	event: ((state: S, ev: UiEvent, cx: EffectCx) -> ())?,
}
```

| 字段 | 必需 | 调用时机 | 钩子名称 |
| --- | --- | --- | --- |
| `open(run, cx)` | 是 | 被认领的命令启动时；返回状态 | `<id>.open` |
| `line(state, l)` | 是 | 每个输出行到达时 | `<id>.line` |
| `finish(state, status)` | 是 | 命令结束时，接收其退出状态 | `<id>.finish` |
| `view(state)` | 是 | 输出到达时（合并调用）、结束时，以及每次 `event` 之后 | `<id>.view` |
| `event(state, ev, cx)` | 否 | Lens 块视图上的用户事件发生时 | `<id>.event` |

命令是否使用此 Lens 仅由清单的 `match` 通配模式决定，并且在任何 Lua 运行前就已确定，因此 `open` 无法拒绝：模式匹配后块即已存在。应缩小 `match` 的匹配范围。关于认领顺序，参见[命令 Lens](../guides/lenses.md)和[清单参考](manifest.md#lenses)。

`view` 返回 `nil` 时，块会显示命令的原始输出；返回节点则会以原生视图替换原始输出。命令运行时，每个块上的 `view` 最多每 250 ms 运行一次（且仅当上次视图之后有新行到达时），命令结束时还会再运行一次。若 `open` 抛出异常，捕获结果没有状态，块会保留原始输出。
`finish` 始终会收到数字退出状态。若捕获在结束前终止（中止、窗格关闭），则不会调用 `finish`；其状态会被丢弃。

### `LensRun`

```lua
type LensRun = {
	line: string,
	typed: string,
	cwd: string?,
	program: string,
	args: { string },
}
```

| 字段 | 含义 |
| --- | --- |
| `line` | Shell 报告的命令行（已展开别名），否则为输入的内容 |
| `typed` | 输入的命令行 |
| `cwd` | Shell 的工作目录（若已知） |
| `program` | 程序名（不含目录）；已剥除包装程序（`sudo`、`doas`、`exec`、`time`、`nice`、`nohup`、`env`、`command`、`builtin`、`caffeinate`、`npx`、`bunx`、`pnpx`、`uvx`、`pipx`）和 `VAR=value` 前缀 |
| `args` | 程序参数；不含引号，且已移除重定向 |

### `LensLine`

```lua
type LensLine = {
	text: string,
	links: { LensLink },
}

type LensLink = {
	from: number,
	to: number,
	href: string,
}
```

| 字段 | 含义 |
| --- | --- |
| `text` | 此行文本，不含转义序列 |
| `links` | 终端在此行中识别出的链接 |
| `links[i].from`、`links[i].to` | 链接在 `text` 中的起始和结束字节位置，从 1 开始且包含边界（`string.sub(l.text, link.from, link.to)`） |
| `links[i].href` | 链接目标 |

### Lens 状态与重新水合

工作线程会为每个插件保留最近 256 个捕获结果；超过此数量时，会先丢弃已结束的捕获，并按最近最少使用顺序处理。如果 Lens 块上的用户事件所对应的状态已丢失（被丢弃，或因重新加载或守护进程重启而丢失），则会重建状态：工作线程会用插件当前的 `match` 通配模式匹配该块保存的命令行，调用 `open`，以捕获时的宽度重新拆分已保存的原始输出并传给 `line`；若命令已结束，则调用 `finish`，随后运行 `event`。如果当前通配模式不再认领该命令行，事件会被丢弃。

### 示例

```lua
tern.lens.define("grep", {
	open = function(run, _cx)
		return { cwd = run.cwd, rows = {} }
	end,
	line = function(state, l)
		local path, line = tern.parse.location(l.text)
		if path and line then
			table.insert(state.rows, {
				{ tern.ui.path(path, state.cwd), tern.ui.span(":" .. line) },
				{ tern.ui.span(l.text) },
			})
		end
	end,
	finish = function(_state, _status) end,
	view = function(state)
		if #state.rows == 0 then
			return nil
		end
		return tern.ui.table({
			{ id = "at", head = "Where" },
			{ id = "text", head = "Line", grow = 1 },
		}, state.rows)
	end,
})
```

```toml
[[lenses]]
id = "grep"
match = ["rg TODO*", "grep * TODO *"]
```

## 副作用上下文（cx）

```lua
declare extern type EffectCx with
	function toast(self, level: ToastLevel, text: string, sub: string?): ()
	function open(self, target: string): ()
	function copy(self, text: string): ()
end
```

`cx` 用于 Lens 的 `open` 和 `event`，以及 Host 事件处理器。其请求会发送给相关窗格所在窗口：该窗格的窗口键对应的所有窗口（实际上即显示其会话的每个窗口）。`cx` 仅持有目标，因此可以保留并在之后使用。

| 方法 | 行为 |
| --- | --- |
| `cx:toast(level, text, sub?)` | 显示提示。`"success"` 表示成功；`"error"`、`"warn"` 和 `"warning"` 会显示为错误；其他任何级别都会显示为信息 |
| `cx:open(target)` | 在每个接收窗口中打开路径或 URL，行为与点击窗格中的链接相同，因此会应用该窗口的 `tern.route.link` 和 `tern.route.open` 处理器 |
| `cx:copy(text)` | 将 `text` 放入每个接收窗口的剪贴板 |

这些方法都不会抛出异常。若没有附加窗口，请求会被丢弃。

## `tern.on`

```lua
tern.on: (name: string, fn: (...any) -> ...any) -> ()
```

将 `fn` 订阅到 Host 事件 `name`。同一插件的处理器按注册顺序运行；每个插件的工作线程会运行自己的处理器，因此不同插件的处理器会并发运行，且顺序未定义。

| 事件 | 处理器 | 载荷 |
| --- | --- | --- |
| `spawn` | `(spec: SpawnSpec) -> SpawnSpec?` | 见下文 |
| `command_started` | `(ev, cx: EffectCx)` | `{pane, line, cwd?}` |
| `command_finished` | `(ev, cx: EffectCx)` | `{pane, line, status, took_ms}` |
| `cwd` | `(ev, cx: EffectCx)` | `{pane, path}` |
| `title` | `(ev, cx: EffectCx)` | `{pane, title}` |
| `pane_exited` | `(ev, cx: EffectCx)` | `{pane, status}` |

会抛出 `tern.on: unknown host event "<name>" (spawn, command_started, command_finished, cwd, title, pane_exited)`。

每个处理器的钩子名称就是事件名称。[事件](events.md#host-事件)介绍了各事件的字段和触发时机。

### spawn 过滤器

```lua
type SpawnSpec = {
	program: string,
	args: { string },
	cwd: string?,
	env: { [string]: string },
}
```

此主机上的每个 Shell 窗格启动前，都会同步运行 `spawn` 处理器（插件块不会触发）。处理器接收启动规格，并返回要使用的启动规格；返回 `nil` 则保持不变。

| 字段 | 含义 |
| --- | --- |
| `program` | 要运行的程序 |
| `args` | 程序参数 |
| `cwd` | 工作目录 |
| `env` | Tern 在继承的环境变量基础上设置的变量 |

返回的表会逐字段替换启动规格：

- 缺少 `program` 或 `args`：保留之前的值；
- 缺少 `cwd`：过滤器不会设置目录，窗格会在原本应使用的位置启动；`cwd` 若不是目录则会被忽略（守护进程会展开开头的 `~`）；
- `env`：结果中的 `env` 是完整的变量集合。缺失的键会被删除；之前不存在的键会被添加（按名称排序）。结果中没有 `env` 时会全部删除。

应修改并返回收到的启动规格，而不是创建新的部分表。

插件按 ID 顺序运行，每个插件看到前一个插件的结果。窗格对每个插件最多等待 50 ms；若插件运行较慢，其结果会被丢弃（窗格仍会启动），并记录日志消息 `plugin spawn filter took over 50 ms; skipped`。同一插件的多个 `spawn` 处理器会在该插件的 50 ms 时限内按注册顺序运行。

`spawn` 处理器若返回表或 `nil` 以外的值，会报告错误：`spawn must return a spec table or nil, got <type>`。其失败会向每个窗口显示提示。

```lua
tern.on("spawn", function(spec)
	spec.env.EDITOR = "nvim"
	return spec
end)
```

## `tern.pane`

### `tern.pane.write`

```lua
tern.pane.write: (pane: number, text: string) -> ()
```

向窗格 `pane` 的 pty 写入 `text`，效果如同键入。若要运行 Shell 命令，应以 `"\r"` 结尾。写入请求会排队并在处理器返回后应用；未知窗格会被忽略。窗格不存在时不会抛出异常。

```lua
tern.on("cwd", function(ev, _cx)
	if ev.path:match("/node_modules$") then
		tern.pane.write(ev.pane, "cd ..\r")
	end
end)
```

### `tern.pane.list`

```lua
tern.pane.list: () -> { PaneInfo }

type PaneInfo = {
	pane: number,
	cwd: string?,
	program: string,
	title: string,
	busy: boolean,
}
```

返回此 Host 上所有程序尚未退出的窗格，信息以所有者最近一次报告的内容为准。块自身的窗格会在其 `init` 运行前列出。

| 字段 | 含义 |
| --- | --- |
| `pane` | 此 Host 上的窗格 id（`tern.pane.write` 和事件载荷使用的 id） |
| `cwd` | 窗格的工作目录 |
| `program` | 程序名称；插件块则为其块类型 |
| `title` | 窗格标题 |
| `busy` | Shell 集成报告是否有命令正在运行；退出后为 `false` |

## 相关页面

- [块](../guides/blocks.md)和[命令 Lens](../guides/lenses.md)：操作指南。
- [Host Hooks 与 spawn 过滤器](../guides/hooks.md)。
- [事件](events.md)和[限制](limits.md)。
