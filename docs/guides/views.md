# 构建视图

块和 Lens 视图是由普通 Lua 表构成的树，用于描述原生 UI 节点：表格、列表、卡片、图表、代码。`tern.ui` 使用与 Tern 内置 Lens 相同的函数构建视图，因此插件的表格看起来和表现都与内置视图一致。本页介绍节点模型、构建器、如何让节点具有交互性、色调和样式，以及用于读取命令输出的 `tern.parse`。

## 节点

视图是由节点组成的树，采用 Tern Surface Protocol（TSP）的传输格式：

```lua
type Node = {
	k: string,              -- kind: "text", "col", "table", "badge", …
	p: { [string]: any }?,  -- props
	c: { Node }?,           -- children
}
```

构建器只返回这些表，不包含其他内容，因此你可以在交回树之前检查、修改和组合它们。文本由 span 构成：`{ t = "text", s = "style tokens", href = "link" }`。span 列表（`Spans`）是由 span 和字符串组成的列表，也可以是一个 span 或一个字符串。

```lua
local ui = tern.ui

local node = ui.card({ ui.span("Build", "strong") }, {
	ui.kv({
		{ "Target", { ui.span("aarch64-apple-darwin", "code") } },
		{ "Took", { ui.span("41.2s", "num") } },
	}),
	ui.progress(0.6, "linking"),
})
-- node = { k = "card", p = { head = { … } }, c = { { k = "kv", … }, { k = "progress", … } } }
```

接收树的位置有所不同：

| | 块 `view` | Lens `view` |
| --- | --- | --- |
| 返回值 | `{main?, dock?, layer?}`，每个区域一棵树 | 一个节点；原始输出时为 `nil` |
| 区域根节点 | 仅绘制其子节点；请使用容器 | 按原样绘制该节点 |
| 更新 | 根据节点 id 与上一个视图进行差异比较 | 根据位置与上一个视图进行差异比较 |
| 节点 id | `main.<key or index>…`，使用 `p.key` 时稳定 | Tern 根据每个节点的位置分配 |

节点 id 和键见[块](blocks.md#区域、节点-id-和键)，Lens 视图见[命令 Lens](lenses.md#命令运行时的视图)。

## 构建器

每个构建器都会检查参数，参数错误时会抛出 `tern.ui.<builder>: <argument>: <problem>`。[UI 构建器](../reference/ui.md)列出了每个构建器的精确输出。

| 用途 | 构建器 |
| --- | --- |
| 文本片段 | `span(t, s?)`, `link(t, href, s?)`, `path(p, cwd?)` |
| 文本 | `text(spans)` |
| 布局 | `col(children)` (带间距), `lines(children)` (无间距), `row(children)`, `card(head, children, props?)`, `section(head, children)`, `rule(label)` |
| 操作 | `button(text, props?)` |
| 值 | `badge(t, tone)`, `kv({ {key, value}, … })`, `stats({ {label, value, sub?}, … })`, `meter(value, label)`, `progress(value?, label)` |
| 表格 | `table(cols, rows, opts?)`, `meter_cell(value, {warn, bad}?)`, `meter_parts_cell({ {value, token}, … })` |
| 树和列表 | `tree({ {label, icon?, open?, children?}, … })`, `list({ {label, detail?, value?, icon?, tone?}, … })` |
| 文本和代码 | `code(text, lang?, start?)`, `diff(text, path?)`, `md(text)`, `ansi(text)` |
| 图表 | `bars({ {label, value}, … })`, `spark({ {label, value}, … })` |
| 结果 | `diagnostic(d, cwd?)`, `test_summary(passed, failed, skipped, took?)`, `overflow(hidden)` |
| 其他 | `node(kind, props?, children?)` |

有几个构建器需要补充说明：

- **`table(cols, rows, opts?)`。** 每列是 `{id, head, align?, priority?, grow?, truncate?, mono?}`。`rows[i][j]` 是 `cols[j]` 对应的单元格：span 列表、meter 单元格，或文本、徽章、按钮、spark 单元格；若行以 `{id, cells, disabled?, menu?, title?}` 形式给出，则会保留其 id。窗格过窄时，`priority` 最低的列最先隐藏；`grow` 用于分配剩余宽度；`truncate` 指定长单元格的截断位置（`"end"`、`"start"`、`"middle"`）。`opts`（`selectable`、`selected`、`empty`）可使行变为可选（见[数据](../elements/data.md#table)）。
- **`path(p, cwd?)`。** 创建链接到文件的路径 span。相对路径根据 `cwd` 解析（在 Lens 中传入 `run.cwd`，在块中传入 `cx.cwd`）；若未提供，则 span 不会创建链接。
- **`ansi(text)`。** 用于显示未解析输出的简易终端，可显示包含转义序列的文本。
- **`overflow(hidden)`。** 显示弱化的“……还有 N 项”行。内置 Lens 最多显示 5,000 行，并以此行结尾；你的视图也应采用相同上限。

`node` 可使用 surface protocol 定义的所有节点类型，包括没有对应构建器的类型：

```lua
ui.node("spinner", { style = "dots", label = { ui.span("Fetching", "muted") } })
ui.node("kbd", { keys = { "ctrl", "o" } })
ui.node("elapsed", { age = 1500, format = "short" })
```

[元素](../elements/index.md)介绍每种类型及其属性、事件和样式钩子。

## 每个节点都接受的属性

| 属性 | 含义 |
| --- | --- |
| `key` | 块视图中同级节点之间的身份标识（见[块](blocks.md#区域、节点-id-和键)）。本地状态按同一父节点下的此键记忆，而不是按整个 surface 范围内的键记忆；即使删除节点后使用新 id 重新添加，也会保留。没有键时使用节点的 id |
| `tone` | 节点界面装饰的语义颜色（见下文） |
| `role` | 你指定的名称，通过 `data-role` 暴露给 CSS |
| `collapsible` | 用于 `card` 和 `section`；设为 `true` 时启用标题栏的展开/折叠控件 |
| `collapsed` | 当 `collapsible = true` 时，设为 `true` 可使 `card` 或 `section` 初始折叠；单独设置不会折叠内容 |
| `actions` | 指针操作的行为：`{ click = "name", dblclick = "name", menu = { … } }` |

当节点没有 props 时，构建器会省略 `p`；声明类型也将 `p` 定义为可选。因此，在 `--!strict` 下，应通过局部变量设置 props：

```lua
local ui = tern.ui
local function with(node: Node, props: { [string]: any }): Node
	local p: { [string]: any } = node.p or {}
	for k, v in props do
		p[k] = v
	end
	node.p = p
	return node
end

local retry = with(ui.badge("Retry", "accent"), { actions = { click = "retry" }, key = "retry" })
local details = with(ui.card("Details", { ui.text("Expandable content") }), {
	collapsible = true,
	collapsed = true,
})
return ui.col({ retry, details }) -- lens view; for a block wrap in { main = ... }
```

## 操作与事件

`actions` 将指针手势映射到操作名称。有些名称由 Tern 自己处理，并在窗口中执行，不会传到你的代码；其他名称属于你，并会作为事件到达。

| 操作 | 行为 | 事件 |
| --- | --- | --- |
| `toggle` | Tern 展开或折叠可折叠节点 | `{ev = "toggle", id, key, collapsed}` |
| `copy` | Tern 复制节点文本（若有 `href`，则复制该链接） | 无 |
| `open` | Tern 打开节点的 `href` 或 `path` | 无 |
| `zoom` | Tern 放大显示 `image` 节点 | 无 |
| `select` | 由你的代码决定 | `{ev = "select", id, item}` |
| `activate` | 由你的代码决定（双击） | `{ev = "activate", id, item}` |
| 其他任意名称 | 由你的代码决定 | `{ev = "action", id, act, value?, item?, mods?, checked?}` |

对于 `list` 项上的 `select` 和 `activate`，`id` 是列表，`item` 是该项；对于 `selectable` 表格中的行，`id` 是表格，`item` 是该行的 `id`；其他情况下二者都是节点。表格的按钮单元格和行菜单会发送 `action`，其中 `item` 是该行（见[数据](../elements/data.md#table)）。[`button`](../elements/input.md#button) 会发送包含其 `actions.click` 的 `action`，若未设置则 `act = "click"`。

当 `toggle`、`open` 或 `zoom` 没有可操作对象时（节点不可折叠、没有 `href` 或 `path`，或不是 `image`），Tern 会像处理其他名称一样将其作为 `{ev = "action", id, act}` 发送。

自定义操作的事件根据其名称构建：

```lua
p.actions = { click = "sort=name" }
-- a shift-click sends:
-- { ev = "action", id = "main.0.1", act = "sort", value = "name", mods = { "shift" } }
```

- `act` 是第一个 `=` 之前的名称；`value` 是其余部分，仅当名称中包含 `=` 时才存在。请将操作目标（项目 id、列）放在此处，以免处理器依赖位置。
- `mods` 列出按住的修饰键（`"shift"`、`"ctrl"`、`"alt"`、`"meta"`）；未按下修饰键时该字段不存在。
- `id` 是节点的 id：在块中是 worker 提供的 id；在 Lens 中是 Tern 为该视图生成的 id。

`menu` 按顺序列出右键菜单提供的项目，随后是 Tern 的 Copy，除非列表中包含 `copy`（当菜单含图标、按键或分隔符时，Copy 会放在分隔线之后）。字符串是根据名称生成标签的操作（`open-file` 显示为 Open file），`"-"` 表示分隔符，`{ header = "…" }` 表示弱化的分区标题。菜单项对象接受 [`menu`](../elements/lists.md#menu) 行的字段：`id`（操作）、`label`、`icon`、`keys`（仅显示；绑定由你完成）、`detail`（此处用作工具提示）、`checked`（用于复选行）、`radio`（指定单选行的分组）、`disabled`（字符串表示禁用原因）、`danger` 和 `items`（子菜单）。选择某一行会像点击一样执行其 `id`，但不会带有 `mods`；复选或单选行的事件还会携带 `checked`，表示该行的新状态。

```lua
p.actions = { menu = {
	{ header = "deploy.log" },
	{ id = "open", label = "Open", icon = "file", keys = "enter" },
	{ id = "follow", label = "Follow output", checked = state.follow },
	"-",
	{ id = "sort=name", label = "By name", radio = "sort", checked = state.sort == "name" },
	{ id = "sort=time", label = "By time", radio = "sort", checked = state.sort == "time" },
	"-",
	{ id = "export", label = "Export", icon = "export", items = { "export=json", "export=csv" } },
	{ id = "trash", label = "Move to Trash", icon = "trash", danger = true, disabled = state.locked and "Locked" or false },
} }
-- choosing Follow output while it is checked sends:
-- { ev = "action", id = "main.0.1", act = "follow", checked = false }
```

块的 `event(state, ev, cx)` 会接收 `action`、`select`、`activate`、`change` 和 `toggle` 事件（以及来自编辑器节点的 `focus`）。Lens 的 `event` 以相同方式接收其视图事件。两者都会在处理器运行后重新渲染：块会运行其渲染周期，Lens 会运行 `view`。

`toggle` 无需处理：Tern 已经切换了节点。由于块的视图会进行差异比较，如果视图中的 `collapsed` 属性保持不变，也不会撤销用户的选择。只有当你想在重启后保留该状态时，才需要记录 `ev.collapsed`。

## 表单与控件

`tern.ui.el` 可绘制普通元素（`div`、`label`、`button`、`form` 等）和两种控件：`type = "checkbox"` 或 `"radio"` 的 `input`。控件只能通过指针操作：点击后会立即在窗口中切换，无需等待你的代码，并发送 `change` 事件。按键由你处理。控件可用于块；在 Lens 视图中不会切换（见 [HTML 元素](../elements/el.md)）。

```lua
local ui = tern.ui
view = function(state, _cx)
	local function size(v)
		return ui.el("label", { class = "opt" }, {
			ui.el("input", { type = "radio", name = "size", value = v, checked = state.size == v }),
			ui.el("span", { text = v }),
		})
	end
	return { main = ui.col({
		ui.el("form", { class = "order" }, {
			size("small"), size("large"),
			ui.el("label", { class = "opt" }, {
				ui.el("input", { type = "checkbox", name = "gift", checked = state.gift }),
				ui.el("span", { text = "Gift wrap" }),
			}),
			ui.button("Order", { variant = "primary", actions = { click = "order" } }),
		}),
	}) }
end,
event = function(state, ev, _cx)
	if ev.ev == "change" then
		-- { ev = "change", id, name = "size", value = "large", checked = true, values = {…} }
	elseif ev.ev == "action" and ev.act == "order" then
		state.size, state.gift = ev.values.size, ev.values.gift
	end
end,
```

来自 `el` 表单内节点的每个 `action`、`select`、`activate` 和 `change` 事件都会携带 `values`：当时该表单中已启用且带名称的控件值。单选组提供其已选中的 `value`（未选中时为 nil）；单个复选框提供布尔值；多个共享名称的复选框则提供已选中项的值数组。因此，按钮处理器可以读取整个表单，而无需逐一跟踪每个 `change`。[`button`](../elements/input.md#button) 类型在表单外也可用于操作：Tern 的外观、键帽、`busy` 和 `disabled` 原因均由其提供，无需 CSS（见[设计视图](design.md#按钮)）。单选按钮在表单内按 `name` 分组。点击 `label` 会切换其中第一个控件。在视图中设置 `checked` 会覆盖用户的选择；若保持不变，则会保留用户选择。

使用块的 surface 和你自己的类，通过 manifest 的 `styles` 设置表单样式；已选控件匹配 `:checked`，禁用控件匹配 `:disabled`：

```css
[data-surface='plugin.shop.order'] .opt {
	padding: 2px 6px;
}

[data-surface='plugin.shop.order'] .opt :checked {
	outline: 1px solid currentColor;
}
```

## 色调与 Span 样式

节点的 `tone` 根据主题为其界面装饰着色（例如徽章的胶囊、卡片边缘、列表行）：`neutral`、`accent`、`info`、`success`、`warning`、`error`、`pending`、`muted`、`user`。

Span 的 `s` 是以空格分隔的 token 列表：

| 标记 | 效果 |
| --- | --- |
| `accent`、`success`、`warning`、`error`、`info`、`pending`、`muted`、`dim` | 颜色 |
| `strong`、`em` | 字重、斜体 |
| `title` | 页面标题，显示在其标题行中 |
| `code`、`mono` | 代码颜色、等宽字体 |
| `num`、`path`、`key`、`link` | 数字、路径、按键和链接的颜色 |
| `ins`、`del` | 新增和删除的文本，如差异视图中所示 |
| `mark` | 高亮显示，例如搜索匹配项 |

完整列表（包括 omp 的主题标记及各自效果）见[文本与代码](../elements/text.md)。

未知 token 会被忽略。色调和 token 表示角色，而非颜色：当前主题会提供颜色，因此视图在浅色和深色主题中都能正确显示，无需你额外处理。

## 使用 CSS 设置样式

插件可以通过 manifest 的 `styles` 或 `tern.css` 添加全局 CSS（见 [Chrome 与样式](chrome.md#全局-css)）。插件样式表会在 Tern 自身样式之后应用于这台机器上的每个窗口。视图节点的样式钩子如下：

| 元素 | 选择器 |
| --- | --- |
| kind 为 `k` 的节点 | `.sf-<k>`：`.sf-table`、`.sf-badge`、`.sf-card`、`.sf-item` |
| 带有 `role` prop 的节点 | `[data-role='<role>']` |
| 带有 `tone` 的节点 | `[data-tone='<tone>']` |
| 文本片段标记 | `.sf-t-<token>`：`.sf-t-num`、`.sf-t-del` |
| 插件块的区域 | `.sf-main[data-surface='plugin.<plugin>.<block>']`，以及 `.sf-dock` 和 `.sf-layer` |
| Lens 块 | `.sf-block[data-role='lens.plugin.<plugin>.<lens>']` |

块的 kind 是其区域元素的 `data-surface` 属性，而非 `data-role`。区域根节点上的 role 会作用于区域元素本身，因此，使用 `p.role = "checklist.main"` 的 `main = ui.col({ … })` 会采用 `.sf-main[data-role='checklist.main']` 样式。

请在插件 id 下为节点指定 role，并按 role 设置样式；Tern 的类名描述的是结构，可能会随版本变化。

```css
/* checklist.css, listed in plugin.toml as styles = ["checklist.css"] */
.sf-main[data-surface='plugin.checklist.list'] .sf-item .sf-t-del {
	opacity: 0.6;
}

.sf-block[data-role='lens.plugin.disk.du'] .sf-table {
	font-variant-numeric: tabular-nums;
}
```

## 读取命令输出：`tern.parse`

`tern.parse` 包含内置 Lens 使用的读取器，可处理许多命令共有的输出格式。它们在两种上下文中都可用。

| 函数 | 读取内容 |
| --- | --- |
| `columns(lines) -> {head, rows}?` | 空白对齐的表格，首个非空行是表头（`docker ps`、`kubectl get`、`ps aux`、`df`）。每列从所有行均为空白的位置处分隔，因此右对齐数字和多词表头（`Mounted on`）会保持完整。对于散文或行对齐不一致的内容返回 `nil` |
| `packed(lines) -> {string}` | 读取 `ls` 风格输出中紧凑排列成多列的条目 |
| `json_tree(text) -> Node?` | 将 JSON 文档或 JSON 流解析为可折叠树；内容不是 JSON 时返回 `nil` |
| `location(s) -> (path?, line?, col?)` | 从 `s` 开头解析 `file:line[:col]`，格式与编译器和 `grep -n` 输出相同 |
| `size(s) -> number?` | 以字节为单位的人类可读大小：`4.0K` 和 `1.2Gi` 按 1024 进制计数，`1.2GB` 和 `512kB` 按 1000 进制计数，`512` 和 `512B` 表示字节数 |

`columns` 需要完整表格才能找到列边界，因此应在 `line` 中收集行，并在 `view` 中解析。此 Lens 会将 `df` 显示为表格，并为每个百分比单元格显示 meter：

```toml
[[lenses]]
id = "df"
match = ["df", "df *"]
```

```lua
--!strict
local ui = tern.ui

type DfState = { lines: { string } }

local function percent(cell: string): number?
	local n = string.match(cell, "^(%d+)%%$")
	return if n then tonumber(n) else nil
end

local df: LensDef<DfState> = {
	open = function(_run, _cx)
		return { lines = {} }
	end,
	line = function(state, l)
		table.insert(state.lines, l.text)
	end,
	finish = function(_state, _status) end,
	view = function(state)
		local t = tern.parse.columns(state.lines)
		if not t then
			return nil
		end
		local cols: { Col } = {}
		for j, head in t.head do
			cols[j] = { id = "c" .. j, head = head, align = if j > 1 and j < #t.head then "end" else nil }
		end
		local rows: { { Cell } } = {}
		for i, cells in t.rows do
			local row: { Cell } = {}
			for j, cell in cells do
				local pct = percent(cell)
				row[j] = if pct then ui.meter_cell(pct / 100, { 0.8, 0.95 }) else cell
			end
			rows[i] = row
		end
		return ui.table(cols, rows)
	end,
}

tern.lens.define("df", df)
```

表头决定列，因此同一段代码可读取 macOS 的 `df -h`（含 `Capacity`、`iused` 和 `%iused`）以及 Linux 的输出（含 `Use%`）。meter 在 80% 时变为警告色，在 95% 时变为错误色。不能构成表格的行会使 `columns` 返回 `nil`，Lens 随后回退到原始输出。

## 相关页面

- [UI 构建器](../reference/ui.md)：每个构建器的精确输出和参数错误。
- [元素](../elements/index.md)：每种节点类型及其属性、事件和 DOM。
- [设置视图样式](../styles/index.md)：所有样式钩子、CSS 变量和受支持的 CSS 功能。
- [块](blocks.md)和[命令 Lens](lenses.md)：视图的归属位置。
- [Chrome 与样式](chrome.md)：样式表、层叠和状态片段。
