# UI 构建器

`tern.ui` 用于构建插件视图所包含的节点，`tern.parse` 则将命令输出读取为这些构建器接受的数据结构。两者在两个上下文中都可用，且与 Tern 内置 Lens 使用的是同一份代码，因此插件表格看起来与内置表格完全一致。块会按区域从 `view` 返回节点；Lens 会从 `view` 返回一个节点。参见[构建视图](../guides/views.md)。

## 节点与文本片段

每个构建器都会返回一个普通 Lua 表，你可以在返回之前检查并修改它。

```lua
type Node = {
	k: string,               -- kind: "text", "col", "table", …
	p: { [string]: any }?,   -- props (absent when empty)
	c: { Node }?,            -- children (absent when empty)
}

type Span = {
	t: string,               -- text
	s: string?,              -- space-separated style tokens
	href: string?,           -- link target
	fx: string?,             -- effect: "shimmer", "pulse" or "none"
}

type Spans = { Span | string } | string
```

每个节点都接受的属性：

| 属性 | 含义 |
| --- | --- |
| `key` | 同级节点中的身份标识：在重新排序时保留节点的 ID。局部状态按此键保存在其父节点下，而非由整个 surface 统一记住；在同一父节点下删除节点并添加一个具有新 ID、相同键的节点后，状态仍会保留。同级节点不得共用键；另一个父节点下的相同键拥有独立状态 |
| `tone` | 语义颜色：`accent`、`success`、`warning`、`error`、`info`、`muted`、… |
| `role` | 作为 `data-role` 暴露给 CSS 的角色字符串 |
| `collapsible` | 对 `card` 和 `section`，设为 `true` 会启用标题中的展开/折叠控件 |
| `collapsed` | 当 `collapsible = true` 时，设为 `true` 会让 `card` 或 `section` 初始处于折叠状态；单独设置不会折叠内容 |
| `actions` | 指针操作，例如 `{ click = "name" }`；自定义名称会作为事件 `{ ev = "action", act = "name" }` 到达（块和 Lens） |

通过 `p` 设置属性；如果构建器未提供 `p`，则先创建它：

```lua
local node = tern.ui.badge("Retry", "accent")
local p: { [string]: any } = node.p or {}
p.actions = { click = "retry" }
p.key = "retry"
node.p = p
```

若要让卡片初始折叠并允许用户展开，请同时设置这两个属性（`section` 也一样）：

```lua
local ui = tern.ui
local details = ui.card("Details", { ui.text("Expandable content") })
local p: { [string]: any } = details.p or {}
p.collapsible = true
p.collapsed = true
details.p = p
return details -- lens view; for a block use { main = ui.col({ details }) }
```

### 参数转换

构建器会检查参数；遇到问题时会抛出 `tern.ui.<builder>: <argument>: <problem>`，并指出参数路径（`cols[2].align`、`rows[3][1]`、`items[1].label`）。常见问题：

| 消息结尾 | 原因 |
| --- | --- |
| `expected a string, got <type>` | 文本位置传入了非字符串（数字会被接受并转换） |
| `expected a number, got <type>` |  |
| `expected an integer in <min>..=<max>, got <n>` | 计数、行或列为小数或超出范围 |
| `expected a boolean, got <type>` |  |
| `expected a list, got <type>` | 列表参数不是表（`nil` 会被视为空列表） |
| `expected a table, got <type>` |  |
| `expected a {a, b} pair, got <type>` | 二元组参数（`kv` 项、数据系列中的点）不是表 |
| ``expected a span (a table with a string `t`)`` | 文本片段列表中的表没有 `t` |
| `expected a span or a string, got <type>` |  |
| `expected a list of nodes, got one node (wrap it in {})` | 子节点位置传入了单个节点 |
| ``expected a node (a table with a string `k`)`` |  |
| `expected a table of props, got <type>` | `node` 的属性不是映射表 |

文本片段列表（`Spans`）可以是按顺序排列的文本片段与字符串列表、单个文本片段表，或单个字符串；`nil` 表示空。字符串会变成无样式的文本片段。

## 文本片段

### `span`

```lua
tern.ui.span: (t: string, s: string?) -> Span
```

一个包含 `t` 的文本片段。`s` 是以空格分隔的样式标记（`"muted"`、`"strong error"`、`"num"`、`"code"`、`"path"`）；省略或设为 `""` 表示普通样式。输出：`{ t = t, s = s }`（普通样式时没有 `s`）。

### `link`

```lua
tern.ui.link: (t: string, href: string, s: string?) -> Span
```

一个包含 `t`、链接到 `href` 的文本片段。输出：`{ t, s?, href }`。点击会经过窗口的链接处理，包括 `tern.route.link`。

### `path`

```lua
tern.ui.path: (p: string, cwd: string?) -> Span
```

一个 `path` 样式的文本片段，显示 `p` 并链接到其绝对 `file://` URL。相对路径 `p` 会根据 `cwd` 解析；未提供 `cwd` 或路径以 `~` 开头时，文本片段不会带链接。输出：`{ t = p, s = "path", href = "file:///…" }`。

```lua
tern.ui.text({ tern.ui.span("see "), tern.ui.path("src/main.rs", run.cwd) })
```

## 布局

| 构建器 | 签名 | 输出 |
| --- | --- | --- |
| `text` | `(spans: Spans) -> Node` | `{k = "text", p = {spans}}` |
| `col` | `(children: { Node }) -> Node` | `{k = "col", p = {gap = "sm"}, c}`：垂直堆叠，间隔较小 |
| `lines` | `(children: { Node }) -> Node` | `{k = "col", p = {gap = "none"}, c}`：同一文本流的多行，行间无间隔 |
| `row` | `(children: { Node }) -> Node` | `{k = "row", p = {gap = "sm"}, c}`：水平排列的一行 |
| `card` | `(head: Spans, children: { Node }, props: CardProps?) -> Node` | `{k = "card", p = {head, …props}, c}`；`props` 接受 `icon`、`meta`、`end` 和任意通用属性 |
| `section` | `(head: Spans, children: { Node }) -> Node` | `{k = "section", p = {head}, c}`：更轻量的可展开分组 |
| `rule` | `(label: Spans) -> Node` | `{k = "rule", p = {label?}}`：分隔线；`label` 非空时带标签（`rule()` 不带标签） |

`gap` 属性会覆盖 `col` 和 `row` 的间距：`none`、`xs`、`sm`、`md`、`lg`。

```lua
tern.ui.card({ tern.ui.span("Build", "strong"), tern.ui.span(" "), tern.ui.span("3 warnings", "warning") }, {
	tern.ui.lines({ tern.ui.text("first line"), tern.ui.text("second line") }),
})
```

标题中带图标、元信息和控件的面板（`end` 通过 ID 指定一个子节点；参见[`card`](../elements/layout.md#card)）：

```lua
tern.ui.card("Services", {
	tern.ui.button("Refresh", { key = "end", icon = "repeat", keys = { "r" }, actions = { click = "refresh" } }),
	services_table,
}, { key = "services", icon = "server", meta = "24 · 2 degraded", ["end"] = "main.services.end" })
```

## 值

### `badge`

```lua
tern.ui.badge: (t: string, tone: string) -> Node
```

胶囊形标签。输出 `{k = "badge", p = {text = t, tone}}`。运行时接受缺省的 `tone`（普通标签）。

### `button`

```lua
tern.ui.button: (text: string?, props: ButtonProps?) -> Node

type ButtonProps = {
	icon: string?,
	keys: { string }?,
	variant: ("default" | "primary" | "quiet" | "danger")?,
	size: ("sm" | "md")?,
	on: boolean?,
	disabled: (boolean | string)?,
	busy: boolean?,
	-- and any common prop: key, actions, title, aria, tone, …
}
```

一个按钮。输出 `{k = "button", p = {text, …props}}`。错误的属性会抛出错误并指出其路径（`tern.ui.button: props.variant: expected one of default, primary, quiet, danger, got "big"`）。参见[`button`](../elements/input.md#button)。

```lua
tern.ui.button("Deploy", { variant = "primary", keys = { "cmd", "enter" }, actions = { click = "deploy" } })
```

### `kv`

```lua
tern.ui.kv: (items: { { Spans } }) -> Node
```

对齐的键值列表。每一项都是一个二元组 `{ keySpans, valueSpans }`。输出 `{k = "kv", p = {items = {{k = spans, v = spans}, …}}}`。

```lua
tern.ui.kv({ { "context", tern.ui.span("prod", "error strong") }, { "namespace", "default" } })
```

### `stats`

```lua
tern.ui.stats: (items: { StatItem }) -> Node

type StatItem = { label: Spans, value: Spans, sub: Spans?, tone: string?, title: string? }
```

一排平铺的统计卡片，供页面标题行正下方使用（不要放在卡片中）。输出 `{k = "stats", p = {items}}`。参见[`stats`](../elements/data.md#stats)。

```lua
tern.ui.stats({
	{ label = "Error rate", value = "0.42%", tone = "warning", sub = "last 15 min" },
	{ label = "p95 latency", value = "182 ms" },
})
```

### `meter`

```lua
tern.ui.meter: (value: number, label: Spans) -> Node
```

值为 `value`、标签为 `label` 的仪表，数值限制在 0–1。输出 `{k = "meter", p = {value, label}}`。

### `progress`

```lua
tern.ui.progress: (value: number?, label: Spans) -> Node
```

值为 `value`（限制在 0–1）的进度条；`nil` 表示不确定进度。输出 `{k = "progress", p = {value, label}}`。

### `bars`、`spark`

```lua
tern.ui.bars: (series: { { any } }) -> Node
tern.ui.spark: (series: { { any } }) -> Node
```

由 `{ label, value }` 二元组构成的柱状图或迷你折线图（`label` 为字符串或数字，`value` 为数字）。输出 `{k = "chart", p = {kind = "bars" | "spark", series = {{value = value, label = label}, …}}}`。

```lua
local series: { { any } } = {}
for i, ms in timings do
	series[i] = { tostring(i), ms }
end
return tern.ui.spark(series)
```

### `test_summary`

```lua
tern.ui.test_summary: (passed: number, failed: number, skipped: number, took: string?) -> Node
```

一行内容，包含堆叠式通过/失败/跳过仪表和计数（`3 passed · 1 failed · 1.2s`）；当 `failed > 0` 时使用 `error` 色调，否则使用 `success`。计数必须是非负整数。

### `overflow`

```lua
tern.ui.overflow: (hidden: number) -> Node
```

一行弱化显示的文本 `… N more (Raw shows everything)`。Lens 只显示部分长输出时使用。

## 表格

### `table`

```lua
tern.ui.table: (cols: { Col }, rows: { { Cell } | TableRow }, opts: TableOpts?) -> Node

type Col = {
	id: string,
	head: string,
	align: ("start" | "center" | "end")?,
	priority: number?,
	grow: number?,
	truncate: ("end" | "start" | "middle")?,
	mono: boolean?,
}

type TableRow = {
	id: string,
	cells: { Cell },
	disabled: (boolean | string)?,
	menu: { string }?,
	title: string?,
}

type TableOpts = { selectable: boolean?, selected: string?, empty: Spans? }

type Cell = Spans | TextCell | BadgeCell | ButtonCell | SparkCell | MeterCell
type TextCell = { text: Spans, icon: string?, dot: string?, tone: string?, title: string? }
type BadgeCell = { badge: { text: string, tone: string?, title: string? } }
type ButtonCell = {
	button: { text: string, act: string, icon: string?, keys: { string }?, variant: string?, disabled: (boolean | string)? },
}
type SparkCell = { spark: { values: { number }, tone: string?, min: number?, max: number?, title: string? } }
```

一行可以是单元格列表，也可以是有自身 `id` 的 `TableRow`（可选择表格需要这种形式）。无论哪种，`cells[j]` 都是 `cols[j]` 对应的单元格；多出的单元格会被忽略，缺少的单元格视为空。单元格表会按原样传递；每种单元格的绘制方式，以及可选择行、按钮单元格和行菜单发送的事件，参见[`table`](../elements/data.md#table)。

| 列字段 | 默认值 | 含义 |
| --- | --- | --- |
| `id` | 必填 | 该行中各单元格所对应的键；后续具有相同 ID 的列会覆盖前列 |
| `head` | 必填 | 标题文本 |
| `align` | `"start"` | 单元格对齐方式；数字使用 `"end"`。其他值会抛出 ``unknown align "<v>" (start\|center\|end)`` |
| `priority` | `0` | 表格较窄时，优先级最低的列最先隐藏（整数） |
| `grow` | `0` | 此列占用的剩余宽度份额 |
| `truncate` | `"end"` | 单元格放不下时从何处截断：`"end"` 保留开头（`abcd…`），`"start"` 保留结尾（`…wxyz`），`"middle"` 保留两端（路径会优先省略目录）。其他值会抛出 ``unknown truncate "<v>" (end\|start\|middle)`` |
| `mono` | `false` | 在无衬线字体区域中以等宽字体显示单元格（ID、版本、大小、时间） |

输出：`{k = "table", p = {cols = {{id, head, align, truncate, priority, grow, mono}, …}, rows = {{id = "r0", cells = {[colId] = cell}}, …}, selectable?, selected?, empty?}}`。以单元格列表形式提供的行会按位置获得 `r0`、`r1`、… 这些 id；`TableRow` 会保留其 `id`、`disabled`、`menu` 和 `title`。

```lua
tern.ui.table({
	{ id = "name", head = "Pod", grow = 1, truncate = "middle" },
	{ id = "cpu", head = "CPU", align = "end", priority = 1 },
	{ id = "mem", head = "Memory", priority = 2 },
}, {
	{ "api-7d9f", "120m", tern.ui.meter_cell(0.42, { 0.7, 0.9 }) },
	{ tern.ui.span("worker-1", "muted"), "15m", tern.ui.meter_cell(0.91, { 0.7, 0.9 }) },
})
```

带有稳定行 id 和丰富单元格的可选择表格：

```lua
tern.ui.table({
	{ id = "name", head = "Service", grow = 1 },
	{ id = "state", head = "State" },
	{ id = "p95", head = "p95", align = "end", mono = true },
	{ id = "act", head = "", align = "end" },
}, {
	{ id = "api", cells = { { text = "api", dot = "success" }, { badge = { text = "live", tone = "success" } }, "182 ms", "" } },
	{ id = "search", menu = { "logs" }, cells = {
		{ text = "search", dot = "pending" },
		{ badge = { text = "waiting", tone = "pending" } },
		"96 ms",
		{ button = { text = "Promote", act = "promote" } },
	} },
}, { selectable = true, selected = state.selected, empty = "No services" })
```

### `meter_cell`

```lua
tern.ui.meter_cell: (value: number, thresholds: { number }?) -> MeterCell
```

值为 `value`（限制在 0–1）的细条单元格。`thresholds` 是二元组 `{ warn, bad }`：填充值达到或超过第一个阈值时着色为 `warn`，达到或超过第二个阈值时着色为 `bad`。

### `meter_parts_cell`

```lua
tern.ui.meter_parts_cell: (parts: { { any } }) -> MeterCell
```

从左侧开始堆叠各部分的细条单元格；每个部分为 `{ value, themeToken }`，其中 `value` 限制在 0–1，`themeToken` 是主题颜色标记（`"success"`、`"error"`、`"toolDiffAdded"`、…）。

```lua
type MeterCell = {
	meter: {
		value: number?,
		thresholds: { warn: number, bad: number }?,
		parts: { { value: number, token: string, label: string?, hatch: boolean? } }?,
		tone: string?,
		title: string?,
	},
}
```

两者都会返回此形状（`meter_cell` 使用 `value` 和 `thresholds`，`meter_parts_cell` 使用 `parts`）。设置 `cell.meter.tone` 可为单元格着色。只要单元格是带 `meter` 字段的表，就会被视作仪表单元格，因此手动构造的 `{ meter = { … } }` 也可用。

## 树与列表

### `tree`

```lua
tern.ui.tree: (nodes: { TreeNode }) -> Node

type TreeNode = {
	label: Spans,
	icon: string?,
	open: boolean?,
	children: { TreeNode }?,
}
```

可展开树。`open`（默认 `false`）表示是否显示节点的子项；只有有子项的节点才会输出此字段。输出 `{k = "tree", p = {nodes = {{id = "t0", label, icon?, open?, children?}, …}}}`；`t0`、`t1`、… 这些 id 按深度优先顺序分配，且在树中唯一。

```lua
tern.ui.tree({
	{ label = "src", icon = "folder", open = true, children = {
		{ label = "main.rs", icon = "file" },
	} },
})
```

### `list`

```lua
tern.ui.list: (items: { Item }) -> Node

type Item = {
	label: Spans,
	detail: Spans?,
	value: Spans?,
	icon: string?,
	tone: string?,
}
```

由多行组成的列表：`label` 后显示次要的 `detail`，右对齐显示 `value`，并可带有命名 `icon` 和行的 `tone`。输出 `{k = "list", c = {{k = "item", p = {label, detail?, value?, icon?, tone?}}, …}}`。

```lua
tern.ui.list({
	{ label = "main", detail = "origin/main", value = tern.ui.span("↑2", "num"), icon = "git-branch" },
	{ label = "fix-login", tone = "warning" },
})
```

## 文本与代码

| 构建器 | 签名 | 输出 |
| --- | --- | --- |
| `code` | `(text: string, lang: string?, start: number?) -> Node` | `{k = "code", p = {text, lang?, start?, numbers?}}`：以 `lang`（文件扩展名或语言名称）进行语法高亮的代码；设置 `start` 时，行号从该值开始显示 |
| `diff` | `(text: string, path: string?) -> Node` | `{k = "diff", p = {text, path?}}`：统一格式差异；`path` 用于选择语法 |
| `md` | `(text: string) -> Node` | `{k = "md", p = {text}}`：Markdown |
| `ansi` | `(text: string) -> Node` | `{k = "ansi", p = {text}}`：将 ANSI 转义序列渲染为迷你终端 |

`text`、`md`、`code` 和 `ansi` 都是文本类型，`math`、`editor`、`input`、`shimmer` 和 `el` 也一样（参见[Elements](../elements/index.md#所有-kind)）：在块中，仅在末尾增加后缀的 `text` 属性会以追加操作发送。参见[Host API](api-host.md#视图模型)。

## 诊断

### `diagnostic`

```lua
tern.ui.diagnostic: (d: Diag, cwd: string?) -> Node

type Diag = {
	severity: ("error" | "warning" | "note" | "help")?,
	code: string?,
	message: string,
	path: string?,
	line: number?,
	col: number?,
	snippet: { any }?,
	notes: { string }?,
	suggestions: { { any } }?,
}
```

以卡片形式呈现编译器或代码检查器的诊断。

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `severity` | `"error"` | 色调：`error` → 错误，`warning` → 警告，`note` → 信息，`help` → 弱化。其他值会抛出 ``unknown severity "<v>" (error\|warning\|note\|help)`` |
| `code` | 无 | 代码检查或错误代码，以代码文本片段显示（`E0308`） |
| `message` | 必填 | 消息内容 |
| `path` | 无 | 打印出的文件路径；位置会链接到此文件，相对路径根据 `cwd` 解析 |
| `line`、`col` | 无 | 从 1 开始计数的位置，以 `:line:col` 显示并附加到链接（`#L12C4`） |
| `snippet` | 无 | `{ firstLine, source }`：带行号的摘录，从 `firstLine` 开始，并以诊断色调标记诊断所在行 |
| `notes` | 无 | 摘录下方弱化显示的文本行 |
| `suggestions` | 无 | `{ { message, firstLine, code }, … }`：每项都是显示在代码摘录上方、弱化显示的消息 |

卡片会采用与严重程度对应的色调，并以 `path:line:col:code` 作为键，因此诊断列表在更新时会保持身份。语法高亮使用 `path` 的扩展名。

```lua
tern.ui.diagnostic({
	severity = "warning",
	code = "unused_variables",
	message = "unused variable: `x`",
	path = "src/lib.rs",
	line = 4,
	col = 9,
	snippet = { 3, "fn f() {\n    let x = 1;\n}" },
	notes = { "if this is intentional, prefix it with an underscore: `_x`" },
}, run.cwd)
```

## 任意节点

### `node`

```lua
tern.ui.node: (kind: string, props: { [string]: any }?, children: { Node }?) -> Node
```

任意 Surface Protocol 节点类型：`{k = kind, p = props, c = children}`；为空时省略 `p` 和 `c`。用于没有对应构建器的类型（带有 `cx:blob` 所提供 `blob` 属性的 `image`、`spacer`、…）。[元素](../elements/index.md) 列出了每种类型及其属性；未知类型会在节点显示时由 Tern 拒绝，而不是由构建器拒绝。

```lua
local id = cx:blob(tern.fs.read("chart.png"), "image/png")
return { main = tern.ui.col({ tern.ui.node("image", { blob = id, alt = "Chart" }) }) }
```

### `el`

```lua
tern.ui.el: (tag: string, props: { [string]: any }?, children: { Node }?) -> Node
```

通用元素：`{k = "el", p = {tag = tag, …props}, c = children}`。支持的标签有 `div span p section header footer nav aside main article figure blockquote ul ol li dl dt dd h1 h2 h3 h4 pre code kbd strong em b i del mark hr table thead tbody tr th td label button form input`。`form` 会绘制为 `div`，并将其中的控件分组。其他任何标签也会绘制为 `div`，且 Tern 会将其作为 `error` 事件报告一次（`unknown el tag <tag>`）。

| 属性 | 含义 |
| --- | --- |
| `class` | 供 CSS 使用、以空格分隔的类名 |
| `attrs` | `data-*`、`aria-*`、`role`、`colspan`、`rowspan` 属性（值为字符串、数字或布尔值）；其他属性会被忽略 |
| `text` | 在子项之前绘制的纯文本 |

通用属性（`role`、`key`、`actions`、`hidden`、`title`、…）与任意节点一样适用。`input` 和 `hr` 不接受子项。

`input` 是仅支持指针操作的控件，`type` 可设为 `"checkbox"` 或 `"radio"`（其他类型均视为未知标签），并可设置 `name`、`value`（默认为 `"on"`）、`checked` 和 `disabled`。点击会切换其状态并发送 `{ev = "change", id, name?, value, checked, values?}`；参见[表单与控件](../guides/views.md#表单与控件)。

```lua
tern.ui.el("label", {}, {
	tern.ui.el("input", { type = "checkbox", name = "all", checked = true }),
	tern.ui.el("span", { text = "Show all" }),
})
```

## 解析器

`tern.parse` 遇到错误参数时会抛出 `tern.parse.<f>: lines: expected a list of strings, got <type>`、`tern.parse.<f>: lines[<i>]: expected a string, got <type>` 或 `tern.parse.<f>: <arg>: expected a string, got <type>`。与 `tern.ui` 不同，它不会接受数字作为字符串。

### `parse.columns`

```lua
tern.parse.columns: (lines: { string }) -> Columns?

type Columns = {
	head: { string },
	rows: { { string } },
}
```

读取按空白对齐的输出（`ps`、`df`、`kubectl get`、`docker ps`）：空行会被跳过，第一行是表头。只有当显示列在每一行中都为空时，才会在该位置拆分列，因此右对齐的列会把其表头前的空隙纳入列宽，多词表头（`CONTAINER ID`、`Mounted on`）也会保留完整。单元格会去除首尾空白。剩余列少于两列，或没有任何两个表头词之间相隔两个空格时（即普通文本），返回 `nil`。

```lua
local t = tern.parse.columns(state.lines)
if t then
	local cols = {}
	for i, h in t.head do
		cols[i] = { id = tostring(i), head = h }
	end
	return tern.ui.table(cols, t.rows)
end
return nil
```

### `parse.packed`

```lua
tern.parse.packed: (lines: { string }) -> { string }
```

读取多列紧凑列表（`ls`、git 的 `column.ui`）中的条目，顺序为先沿每列向下，再从左到右。没有列时，每行都是一个条目。条目中包含的空格会保留，除非每一行都在该处断开。

### `parse.json_tree`

```lua
tern.parse.json_tree: (text: string) -> Node?
```

将 JSON 文档呈现为可折叠树节点；对象和数组默认展开到深度 2。对于文档流（`jq '.[]'`），每个文档显示为一个节点。键使用 `info` 色调，字符串使用 `success`，数字使用 `num`，布尔值和 null 使用 `accent`；超过 5000 个节点后，其余内容会汇总显示。若 `text` 不是 JSON，或文档流中只有标量，则返回 `nil`。

### `parse.location`

```lua
tern.parse.location: (s: string) -> (string?, number?, number?)
```

读取 `s` 开头的 `file:line[:col]`：返回路径、行和列（未提供列时为 `nil`），否则返回单个 `nil`。

```lua
local path, line, col = tern.parse.location("src/main.rs:12:5: error: x")
-- "src/main.rs", 12, 5
```

### `parse.size`

```lua
tern.parse.size: (s: string) -> number?
```

将易读的大小转换为字节数，无法解析时返回 `nil`。裸单位字母（`4.0K`、`1.2G`，如 `ls`、`du` 和 `df` 的输出）以及 `Ki`/`KiB` 表示 1024 的幂；带 `B` 的单位（`kB`、`MB`、`1.2GB`，如 `docker` 和 `pip` 的输出）使用十进制。`"4.0K"` 是 4096；`"1.2GB"` 是 1200000000；`"-"` 和 `""` 返回 `nil`。

## 相关页面

- [构建视图](../guides/views.md)：布局模式。
- [Host API](api-host.md)：块和 Lens 视图的发送方式。
