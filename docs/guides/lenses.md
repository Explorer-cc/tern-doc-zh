# 命令 Lens

Lens 会将 shell 命令的输出转换为原生视图：表格、图表或诊断列表。插件的 manifest 决定它声明接管哪些命令行，而 Host 端会逐行读取输出并返回视图，同时 Tern 会让原始输出始终只需一次点击即可查看。本页将跟随一条命令，从提示符到视图，再经过重新加载和重启。

## 命令如何获得 Lens

集成了 Tern 的 shell 启动命令时，会报告命令行。随后：

1. Tern 将该行读取为简单命令。不是简单命令的行会保持为普通终端输出。
2. Tern 尝试匹配插件的 `match` glob。匹配后，命令输出会被转入一个由声明该命令的 Lens 读取的块。
3. 否则，Tern 会尝试内置 Lens；如果没有 Lens 接管（或它在 Settings › Lenses 中被关闭），输出就会保持为普通终端输出。

### 读取命令行

如果 shell 报告的是别名展开后的命令行（zsh 会这样做），Tern 就读取展开后的行；否则读取按原样输入的行。它会按照 shell 的拆分方式拆分，包括引号和转义符，然后：

- 跳过开头的 `VAR=value` 赋值；
- 跳过包装程序及其选项：`sudo`、`doas`、`exec`、`time`、`nice`、`nohup`、`env`、`command`、`builtin`、`caffeinate`、`npx`、`bunx`、`pnpx`、`uvx`、`pipx`；
- 去掉程序的目录部分（`/usr/bin/du` 会被读取为 `du`）；
- 从参数中移除 stderr 和 stdin 重定向（`2>&1`、`2>/dev/null`、`< input`）。

有些行永远不会被 Lens 处理，因为屏幕上的输出不只来自该程序：管道（`du -sh * | sort -h`）、命令列表（`clear; du`、`make && du`）、stdout 重定向（`du > sizes.txt`）、子 shell、heredoc，以及表示程序名的词中的命令替换。

| 输入内容 | 匹配内容 |
| --- | --- |
| `du -sh src` | `du -sh src` |
| `sudo -u root du -sh /var` | `du -sh /var` |
| `LC_ALL=C du -sh "my dir"` | `du -sh my dir` |
| `du -sh src 2>/dev/null` | `du -sh src` |
| `du -sh src \| sort -h` | 无：这是管道 |
| `du -sh src > out.txt` | 无：stdout 已重定向 |

### 匹配

模式看到的文本是程序及其参数用单个空格连接后的内容。`match` 模式是对整个文本进行匹配的 glob：`*` 表示任意长度的字符序列（包括空序列），`?` 表示恰好一个字符，其余字符都与自身匹配，且区分大小写。

| 模式 | 匹配 | 不匹配 |
| --- | --- | --- |
| `du *` | `du -sh src`、`du .` | `du`（空格后没有内容） |
| `du` | `du` | `du .` |
| `kubectl get *` | `kubectl get pods` | `kubectl get`、`k get pods` |
| `terraform plan*` | `terraform plan`、`terraform plan -out x` | `terraform apply` |

若要同时接管不带参数的程序和带参数的程序，请同时列出：`match = ["du", "du *"]`。

### 谁会胜出

插件声明的接管优先于内置 Lens。在插件之间，Tern 按 id 顺序选取声明了 Lens 的 Ready 插件，并在第一个匹配模式的插件中，选择 manifest 顺序最靠前的 Lens。每条命令恰好由一个 Lens 接管；即使你的 `view` 随后返回 `nil`，插件的接管也会阻止该命令运行内置 Lens。

| Manifest `[[lenses]]` | 命令行 | Lens |
| --- | --- | --- |
| 插件 `ops`：`get` = `kubectl get *`；`all` = `kubectl *` | `kubectl get pods` | `ops.get` |
| 同上 | `kubectl logs web` | `ops.all` |
| 插件 `aa`：`k` = `kubectl *`，以及上面的插件 `ops` | `kubectl get pods` | `aa.k`（id `aa` 排序在前） |

manifest 中的模式应从具体到宽泛排列，并且应尽可能精确地匹配你确实能读取的输出。

### 为什么接管是声明式的

窗格的每个副本都会基于相同字节运行相同终端：会话守护进程、每个显示该窗格的窗口、iOS app 和 Web 客户端。它们都必须将相同命令转入相同块，但只有 Host 端会运行你的 Lua。因此，接管由每个副本都能获得的数据决定（manifest 的 glob 会发送到窗口中的插件目录），并且发生在 Lua 运行之前。这就是 `open` 无法拒绝命令的原因：它运行时，块已在所有地方创建。如果你无法读取某种形式的命令输出，请缩小 `match` 范围，或从 `view` 返回 `nil` 以显示原始输出。

### 没有 Lens 生效时

Lens 还需要满足以下条件：

- Shell 集成已启用，用于报告命令行；
- Settings › Terminal › **Native command output** (`command_lenses`) 已开启（默认开启）；关闭后，任何命令都不会使用插件或内置 Lens，已显示的块也会切换为原始输出（你手动切换过的块除外）；
- 对于内置 Lens，需在 Settings › **Lenses** 中开启其开关；关闭后，其 id（`git.log`）会加入 `lenses_disabled`，从下次运行起对应命令将保持普通输出，而已显示的块仍保留其视图；
- 窗格位于主屏幕，且没有打开程序 surface。

捕获一旦进入交互模式（备用屏幕、小键盘或鼠标模式、光标位置查询），或超过 16 MiB，就会中止：块会被丢弃，已捕获的所有内容都会重放到终端网格。中止的捕获不会调用 `finish`，其状态也会被丢弃。

## 定义 Lens

在 `plugin.toml` 中声明 Lens，然后在 `host.luau` 中使用 `tern.lens.define(id, def)` 实现：

```toml
[[lenses]]
id = "du"
match = ["du", "du *"]
```

| 字段 | 必需 | 调用时机 |
| --- | --- | --- |
| `open(run, cx) -> state` | 是 | 被接管的命令启动时 |
| `line(state, l)` | 是 | 每一行输出时 |
| `finish(state, status)` | 是 | 命令结束时，附带退出状态 |
| `view(state) -> Node?` | 是 | 输出到达时、结束时，以及每次 `event` 后 |
| `event(state, ev, cx)` | 否 | 有人对视图执行操作时 |

如果 manifest 中声明了 Lens，但 `host.luau` 加载完成时未定义它，插件就会加载失败。`open` 返回的状态会传递给其他每个处理器；请原地修改它。每次调用的 Host 端预算为 2 s。

### `run`

| 字段 | 含义 |
| --- | --- |
| `line` | Tern 读取的命令行（如果 shell 报告了别名展开后的形式，则为展开后的形式） |
| `typed` | 按原样输入的命令行 |
| `cwd` | shell 的工作目录（如果已知） |
| `program` | 去掉包装程序、赋值和目录后的程序名 |
| `args` | 参数；不含引号，以及 stderr 和 stdin 重定向 |

使用 `run.cwd` 解析输出中的相对路径（`tern.ui.path(p, run.cwd)` 会创建可点击路径），并使用 `run.args` 根据标志调整行为。

### 行

每个 `l` 都是输出中的一个逻辑行：

```lua
l = {
	text = "12K\tsrc",
	links = { { from = 5, to = 7, href = "file:///home/me/src" } },
}
```

- `text` 中的转义序列已处理：颜色已移除；进度条用 `\r` 改写的行会以最终显示的内容到达；终端软换行的行会重新拼接。末尾空格会被裁掉。写入 stderr 的输出也会按顺序包含在流中。
- `links` 是程序输出的超链接（OSC 8）；`from` 和 `to` 是链接文本首尾字节的位置，从 1 开始且包含两端，因此 `string.sub(l.text, link.from, link.to)` 就是链接文本。

Tern 会在 8 行的临时屏幕上重放输出，并在某一行滚出屏幕时交出该行，因此最后几行输出会在 `finish` 之前刚好到达。命令如果打印几行后又运行一分钟，这些行要等命令结束才会显示。

`finish` 接收一个数字形式的退出状态。

### 命令运行时的视图

`view` 返回一个节点（参见[构建视图](views.md)）或 `nil`：

- **节点**会替换块中的原始输出。块保留 Native/Raw 切换项，Copy 仍会复制原始文本。
- **`nil`** 会让块显示原始输出，作为已完成的块。内置 Lens 不会再次尝试。

命令运行期间，Tern 对每个块最多每 250 ms 调用一次 `view`，且仅当上次调用后有新行到达时才调用；之后会在结束时调用一次，并在每次 `event` 后调用一次。每个结果都会按位置而不是按键与上一个结果进行 diff（块的 diff 则按键）：同一位置、同一类型的节点只更新发生变化的属性，因此随输出增长的视图只会重绘新增内容，而插入到前部的节点会重写其后的每个节点。让 `line` 保持轻量，并在 `view` 中进行格式化；但要记住，长时间捕获期间 `view` 可能运行很多次。限制显示内容：内置 Lens 最多显示 5,000 行，并以 `tern.ui.overflow(hidden)` 结尾。

## 操作与事件

带有 `actions` 属性的节点可以点击。自定义操作名称会传入 `event`：

```lua
local node = tern.ui.badge("By name", "muted")
local p: { [string]: any } = node.p or {}
p.actions = { click = "sort=name" }
node.p = p
```

```lua
event = function(state, ev, cx)
	if ev.ev == "action" and ev.act == "sort" then
		state.by = ev.value -- "name"
	end
end,
```

点击事件会以 `{ev = "action", id = …, act = "sort", value = "name"}` 的形式到达：包含 `=` 的操作名称会拆分为 `act` 和 `value`；如果按下了修饰键，`mods` 会列出这些键（`"shift"`、`"ctrl"`、`"alt"`、`"meta"`）。`id` 是 Tern 根据节点位置分配的 id；它会随节点前方的节点增删而变化，因此应将被点击的内容放在操作名称中。
[构建视图](views.md#操作与事件)列出了所有事件和内置操作名称。

`event` 会接收 Lens 视图产生的每个事件，因此要检查 `ev.ev`。它之后会运行 `view`，视图便会反映相应变化。

传给 `open` 和 `event` 的 `cx` 有三种方法。它们的效果会应用到显示该窗格的窗口，而非窗格本身：

| 方法 | 效果 |
| --- | --- |
| `cx:toast(level, text, sub?)` | 显示 toast；`level` 为 `"success"`、`"info"` 或 `"error"` |
| `cx:open(target)` | 像点击窗格中的链接一样打开路径或 URL，因此会应用窗口的路由规则 |
| `cx:copy(text)` | 将 `text` 放入剪贴板 |

## 状态、重新加载与重启

Lens 状态保存在插件的 worker 上，绝不会保存在窗格上。每个插件的 worker 会保留最近 256 次捕获的状态，优先丢弃已完成的捕获，再按最近最少使用顺序丢弃。重新加载会启动新的 worker：正在运行的捕获会在旧 worker 上结束，已完成捕获的状态则会消失。

视图本身会在这些情况下保留下来。它属于窗格屏幕，因此重新加载后、稍后才连接的窗口中，以及会话守护进程重启后，视图仍然可见。缺失的是它背后的状态，而点击操作需要该状态。当某个块收到事件但其状态已不存在时，worker 会根据块保留的信息（命令行、工作目录、原始输出和退出状态）重建状态：

1. 它会根据插件当前的 `match` glob 匹配保存的命令行；如果这些模式不再接管该命令，则丢弃事件；
2. 它会使用新的 `cx` 调用 `open`；
3. 它会将保存的原始输出重新按捕获时的宽度拆分，再传给 `line`；
4. 如果命令已结束，则调用 `finish`；
5. 然后运行 `event`，再运行 `view`。

这种重新水合会影响 Lens 的编写方式：

- **状态必须能够从 `run` 和各行数据推导出来。** 其他信息（例如进程获取的数据或时钟读取的值）会变得不同，或完全无法恢复。
- **先前事件做出的选择会丢失。** 重启前选择的排序方式会先恢复为默认值，然后新事件才会生效。此类选择应保持简单，或让每个事件都携带完整选择（`sort=name`，而不是 `toggle_sort`）。
- **`open`、`line` 和 `finish` 可能会再次运行。** 不要在其中显示 toast、写入文件或启动进程。

## 关闭 Lens

| 要停止的范围 | 操作 |
| --- | --- |
| 单个块 | 将其切换到 **Raw** |
| 所有 Lens（内置和插件） | 关闭 Settings › Terminal › **Native command output** |
| 单个内置 Lens | 在 Settings › **Lenses** 中关闭（其 id，例如 `git.log`，会加入 `settings.json` 中的 `lenses_disabled`） |
| 某个插件的所有 Lens | 在 Preferences › Plugins 中关闭该插件（插件 id 会加入 `settings.json` 的 `plugins_disabled`），这会禁用整个插件 |
| 某个插件 Lens | 缩小或移除 manifest 中的 `match` 模式；插件 Lens 没有单独的开关 |

## 示例：将 `du` 显示为表格

`du` 每行打印一个条目，大小在前。此 Lens 会将条目显示为表格，每个条目都有一个表示其占最大值比例的条形，可按大小或名称排序；无法读取的行（例如权限错误）则保留在表格下方。

`plugin.toml`：

```toml
schema = 1
id = "disk"
name = "Disk Usage"
version = "0.1.0"
description = "du output as a sortable table with share bars."
host = "host.luau"

[[lenses]]
id = "du"
match = ["du", "du *"]
```

`host.luau`：

```lua
--!strict
-- `du` as a table: one row per entry, a bar for its share of the largest,
-- sortable by size or name. Works with and without -h: sizes are shown as
-- printed and compared through tern.parse.size.

local ui = tern.ui

local MAX_ROWS = 500

type Row = { size: string, bytes: number, path: string }
type State = {
	cwd: string?,
	rows: { Row },
	other: { string },
	by: string,
}

local function badge(label: string, active: boolean, act: string): Node
	local node = ui.badge(label, if active then "accent" else "muted")
	local p: { [string]: any } = node.p or {}
	p.actions = { click = act }
	node.p = p
	return node
end

local du: LensDef<State> = {
	open = function(run, _cx)
		return { cwd = run.cwd, rows = {}, other = {}, by = "size" }
	end,

	line = function(state, l)
		local size, path = string.match(l.text, "^%s*(%S+)%s+(.+)$")
		local bytes = if size then tern.parse.size(size) else nil
		if size and path and bytes then
			table.insert(state.rows, { size = size, bytes = bytes, path = path })
		elseif l.text ~= "" then
			table.insert(state.other, l.text) -- `du: ...: Permission denied`
		end
	end,

	finish = function(_state, _status) end,

	view = function(state)
		if #state.rows == 0 then
			return nil
		end
		local rows = table.clone(state.rows)
		if state.by == "name" then
			table.sort(rows, function(a, b)
				return a.path < b.path
			end)
		else
			table.sort(rows, function(a, b)
				return a.bytes > b.bytes
			end)
		end
		local largest = 1
		for _, r in rows do
			largest = math.max(largest, r.bytes)
		end
		local cells: { { Cell } } = {}
		for i = 1, math.min(#rows, MAX_ROWS) do
			local r = rows[i]
			cells[i] = {
				{ ui.span(r.size, "num") },
				ui.meter_cell(r.bytes / largest),
				{ ui.path(r.path, state.cwd) },
			}
		end
		local head: { Node } = {
			ui.text({ ui.span(tostring(#rows), "strong num"), ui.span(" entries", "muted") }),
			badge("By size", state.by == "size", "sort=size"),
			badge("By name", state.by == "name", "sort=name"),
		}
		local body: { Node } = {
			ui.row(head),
			ui.table({
				{ id = "size", head = "Size", align = "end" },
				{ id = "share", head = "Share", priority = -1 },
				{ id = "path", head = "Path", grow = 1, truncate = "middle" },
			}, cells),
		}
		if #rows > MAX_ROWS then
			table.insert(body, ui.overflow(#rows - MAX_ROWS))
		end
		for _, text in state.other do
			table.insert(body, ui.text({ ui.span(text, "warning") }))
		end
		return ui.col(body)
	end,

	event = function(state, ev, _cx)
		if ev.ev == "action" and ev.act == "sort" then
			state.by = if ev.value == "name" then "name" else "size"
		end
	end,
}

tern.lens.define("du", du)
```

关于这些选择的说明：

- `match` 同时列出 `du` 和 `du *`，因为 `du *` 至少需要一个参数。
- `line` 只负责解析和追加；排序与构建行的工作在 `view` 中完成，而 `du` 运行期间 `view` 每秒最多运行四次。
- 条形列的 `priority = -1` 会在窗格较窄时优先隐藏该列；`truncate = "middle"` 会保留长路径的首尾部分。
- `ui.path(r.path, state.cwd)` 会将每个路径转换为链接，并根据 `du` 运行时所在目录解析，因此点击后会通过窗口的路由规则打开。
- 视图不显示退出状态徽标：Lens 块本身已经会标记失败的退出状态。
- 排序徽标会发送 `sort=size` 和 `sort=name`。每次点击都携带完整选择，因此即使在重新水合后的状态中（`by` 会重新从 `"size"` 开始），行为也一致。

## 相关页面

- [Host API](../reference/api-host.md#tern-lens-define)：每个字段和消息。
- [构建视图](views.md)：节点、构造器、操作和 CSS。
- [清单参考](../reference/manifest.md)：`[[lenses]]`。
- [架构](../concepts/architecture.md)和[生命周期与重新加载](../concepts/lifecycle.md#lens-重新水合)。
