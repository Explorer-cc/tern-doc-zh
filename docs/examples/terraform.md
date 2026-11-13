# Terraform 计划

`terraform` 会将 `terraform plan` 和 `tofu plan` 的人类可读输出转换为原生视图：摘要徽标、带有源代码摘录的诊断信息，以及按操作分组的计划资源（破坏性分组优先）。点击资源会复制其地址。这是一个带有自有样式表的命令 Lens 示例。

## 演示内容

| 接口 | 端 | 用途 |
| --- | --- | --- |
| `[[lenses]]` `match` glob | Manifest | 声明 `terraform plan`、`tofu plan` 及其 `-chdir=` 形式 |
| 带有 `open`、`line`、`finish`、`view` 的 `tern.lens.define` | Host | 逐行解析计划并绘制视图 |
| `ui.badge`、`ui.section`、`ui.diagnostic`、`ui.overflow` | Host | 摘要、分组、错误与警告、长分组 |
| 节点上的 `actions = { click = … }`、Lens `event` | Host | 点击时复制资源地址 |
| `EffectCx:copy`、`EffectCx:toast` | Host | 剪贴板与确认提示 |
| `role` 属性与 manifest 中的 `styles` | 两端 | 按操作为行着色，标记破坏性计划 |

插件没有 Window 端：Lens 视图及其 CSS 已满足全部需求。每个窗口仍会加载样式表，因为 CSS 属于 Window 端。

## 安装

```sh
tern plugin install github.com/stencil-hq/tern-sdk/plugins/examples/terraform
```

修改期间，可以改为克隆 SDK 并链接该文件夹，这样 Tern 会在每次保存时重新加载：

```sh
git clone https://github.com/stencil-hq/tern-sdk
tern plugin link tern-sdk/plugins/examples/terraform
```

Lens 需要 Shell 集成（它会报告每条命令行）和 `command_lenses` 设置；两者默认均已启用。在项目中运行 `terraform plan`；块的 **Raw** 切换按钮仍会显示原始输出。

## 设计

### 声明处理范围，以及不处理的内容

Lens 通过声明式规则认领命令。窗格的每个副本（守护进程、每个窗口、iOS、Web 客户端）都必须对哪些命令会变成 Lens 块达成一致，但只有 Host 会运行 Lua，因此该决策依据 manifest 中的 `match` glob，对程序名及其参数以单个空格连接后的字符串进行匹配。`open` 无法拒绝 glob 已匹配的命令；要排除命令，只能收窄 glob（参见[命令 Lens](../guides/lenses.md)）。

| 模式 | 匹配内容 |
| --- | --- |
| `terraform plan`、`terraform plan *` | 普通计划，可带或不带选项 |
| `terraform -chdir=* plan`、`terraform -chdir=* plan *` | 其他目录的计划 |
| `tofu …` | OpenTofu 对应的四种形式 |

这里刻意不认领 `terraform apply`。如果没有 `-auto-approve`，它会打印计划，然后停在 `Enter a value:` 等待你输入 `yes`。读取一行不会启用任何会令 Tern 中止 Lens 并重放原始输出的终端模式（备用屏幕、鼠标或键盘模式），因此原生视图会继续遮住它正在提问的问题。计划只会在某个必需变量没有值时提出询问；使用 `-input=false` 会让它直接失败，此时 Lens 会将失败显示为诊断信息。

有些计划并非面向人类：`terraform plan -json` 会以流的形式输出 JSON，而 `terraform plan -help` 会打印用法说明。这两者都不包含解析器可识别的内容，因此 `view` 会返回 `nil`，`nil` 视图会让块显示原始输出。

### 逐行读取计划

命令运行期间，每行输出都会调用一次 `line`，视图最多每 250 ms 重绘一次，因此解析器是一个小型状态机，最多只回看一行：

| 输出 | Lens 记录的内容 |
| --- | --- |
| `<addr>: Refreshing state...` | 显示为“已刷新 N 项”的计数 |
| `Note: Objects have changed outside of Terraform` | 进入漂移分组 |
| `Terraform will perform the following actions:` | 进入操作分组 |
| `  # <addr> will be created`（以及其他后缀） | 带有操作类型的资源 |
| `  # (because …)`、`  # (moved from …)` | 上方资源的注释 |
| `Changes to Outputs:` 和 `  + name` 行 | 输出变更 |
| `Plan: N to add, M to change, K to destroy.` | 摘要 |
| `No changes.` | 无变更状态 |
| `╷`、`│ Error: …`、`│ …`、`╵` | 诊断信息及其正文 |

资源标题会与后缀表匹配（“will be created”、“will be updated in-place”、“must be replaced”、“is tainted, so must be replaced”、“will be read during apply”等）。表中的顺序确保以较长后缀优先匹配，避免被其结尾的较短后缀抢先匹配；`(deposed object …)` 限定语会被拆分到该行的注释中。漂移分组中的标题使用单独的后缀表（“has changed”、“has been deleted”），因为这些资源并不属于计划将要执行的操作。

诊断信息是 Terraform 用 `╷`、`│` 和 `╵` 绘制的框。第一条 `│ Error: title` 或 `│ Warning: title` 行会开启一个诊断；`on main.tf line 12` 提供位置，其下带行号的各行构成代码片段，之后的段落则成为注释。Terraform 打印的是相对于运行目录的路径，因此 `open` 会保留 Shell 的 `cwd`（或 `-chdir=` 目录），而 `ui.diagnostic` 会据此解析路径，使位置成为指向该文件的链接。

`finish` 会记录退出状态。使用 `-detailed-exitcode` 时，有变更的计划会以状态码 2 退出，因此只有状态码不是 0 或 2 时才表示计划失败。

### 视图

顶行以徽标显示摘要，每个徽标的色调与其含义对应：

| 徽标 | 色调 |
| --- | --- |
| “N to import” | `info` |
| “N to add” | `success` |
| “N to change” | `warning` |
| “N to destroy” | `error` |
| “No changes” | `success` |
| 命令运行时显示“Planning”及各操作的进行中计数 | `pending`、`muted` |
| “Plan failed”、“N errors” | `error` |
| “N warnings” | `warning` |

其下是诊断信息，然后是每种操作各自一个可折叠的 `ui.section`。顺序符合审阅者的阅读习惯：Destroy、Replace、Update in place、Create，然后是影响较小的 Import、Move、Forget 和 Read。每个分组都用一个 `key` 标识其操作，因此即使计划流式传输期间上方出现其他分组，其身份也不会改变。Apply 期间才读取的数据源和漂移分组（“Changed outside Terraform”）默认折叠：它们有助于解释计划，但并非计划要执行的变更。一个分组超过 200 行时，会以 `ui.overflow` 结尾；该行显示“… N more”，并指向 Raw。

### 复制地址

每个资源行都是一个文本节点，其 props 中包含点击操作：

```lua
local p: { [string]: any } = node.p or {}
p.actions = { click = "copy-address=" .. r.addr }
node.p = p
```

Lens 的 `event` 处理器会收到如下点击事件：`{ev = "action", act = "copy-address", value = "<addr>"}`。只有第一个 `=` 用于分隔操作名称和值，因此 `terraform_data.item["a=b"]` 这样的地址会完整地传入 `ev.value`。处理器直接使用该值，不会拆分或解码：

```lua
if ev.ev == "action" and ev.act == "copy-address" and type(ev.value) == "string" then
	cx:copy(ev.value)
	cx:toast("success", "Copied resource address", ev.value)
end
```

事件的 `EffectCx` 会将复制操作和 toast 提示发送给显示该窗格的窗口。Lens 状态保存在 Host 工作线程上，每个插件最多保留最近 256 次捕获；点击较早的块时，会先基于保存的输出重新运行 `open`、`line` 和 `finish`，因此即使守护进程重启后，点击操作仍然有效。

### 通过角色设置样式

插件绝不会仅凭位置或 Tern 内部类名来设置样式。每条规则都限定在 Lens 块的角色 `.sf-block[data-role='lens.plugin.terraform.plan']` 内；插件会为要设定样式的节点设置自己的角色：

| 角色 | 节点 | 样式 |
| --- | --- | --- |
| `terraform.plan` | 视图根节点 | 无 |
| `terraform.plan.danger` | 根节点，当有资源将被销毁或替换时 | 左边缘的红色竖线 |
| `terraform.<action>` | 每个资源行 | 将 `--tc` 设为对应操作的色调，用于悬停高亮 |

颜色来自 Tern 的色调变量（`--sf-ok`、`--sf-warn`、`--sf-bad`、`--sf-info`、`--sf-muted`），因此浅色和深色主题都会相应适配。该文件在 manifest 的 `styles` 中列出，并作为全局样式表 `plugin:local:terraform:styles` 安装；参见[Chrome 与样式](../guides/chrome.md)。

## 限制

- 解析器读取 Terraform 的人类可读输出，这并非稳定接口；未来版本若更改标题措辞，该资源就不会被纳入视图（但摘要行仍会计入它）。
- 资源只按操作分组，不按模块分组。
- 如果计划停在 `var.name Enter a value:` 提示处，该提示会被隐藏，直到你切换到 Raw；请使用 `-input=false` 运行计划，或提供 `.tfvars` 文件。
- 某种操作下资源超过 200 个时，计划只显示前 200 个，并提供指向 Raw 的入口。

## 代码

`plugin.toml`：

```toml
schema = 1
id = "terraform"
name = "Terraform"
version = "1.0.0"
description = "Reads terraform and tofu plans as summary badges and resources grouped by action."
icon = "stack"
host = "host.luau"
styles = ["terraform.css"]

[[lenses]]
id = "plan"
match = [
	"terraform plan",
	"terraform plan *",
	"terraform -chdir=* plan",
	"terraform -chdir=* plan *",
	"tofu plan",
	"tofu plan *",
	"tofu -chdir=* plan",
	"tofu -chdir=* plan *",
]
```

`host.luau`：

```lua
--!strict
-- The `plan` lens: Terraform's (and OpenTofu's) human-readable plan output
-- as summary badges, diagnostics and resources grouped by action. Clicking a
-- resource copies its address.

local ui = tern.ui

-- Rows shown per group before the rest fold into "… N more".
local GROUP_ROWS = 200

-- The diagnostic box Terraform draws around errors and warnings.
local BOX_SIDE = "│"
local BOX_END = "╵"

type Resource = { addr: string, action: string, note: string? }
type Output = { sym: string, name: string }
type Diagnostic = {
	severity: string,
	title: string,
	path: string?,
	line: number?,
	snippet: { any }?,
	notes: { string },
	para: string?,
}
type State = {
	base: string?,
	tool: string,
	section: string,
	resources: { Resource },
	drift: { Resource },
	outputs: { Output },
	summary: { [string]: number }?,
	nochanges: boolean,
	refreshed: number,
	diags: { Diagnostic },
	open: Diagnostic?,
	header: boolean,
	status: number?,
}

-- Resource headers (`# <addr> <suffix>`), longest suffix first where one
-- ends another.
local ACTIONS = {
	{ " is tainted, so must be replaced", "replace" },
	{ " will be replaced, as requested", "replace" },
	{ " must be replaced", "replace" },
	{ " will be created", "create" },
	{ " will be updated in-place", "update" },
	{ " will be destroyed", "destroy" },
	{ " will be read during apply", "read" },
	{ " will be imported", "import" },
	{ " will no longer be managed by Terraform", "forget" },
	{ " will no longer be managed by OpenTofu", "forget" },
}

-- Headers of the "Objects have changed outside of Terraform" section.
local DRIFT = {
	{ " has been deleted", "deleted" },
	{ " has changed", "changed" },
}

-- Groups in the order a reviewer reads them: what is lost first.
local GROUPS = {
	{ action = "destroy", title = "Destroy", sym = "-", style = "error" },
	{ action = "replace", title = "Replace", sym = "-/+", style = "warning" },
	{ action = "update", title = "Update in place", sym = "~", style = "warning" },
	{ action = "create", title = "Create", sym = "+", style = "success" },
	{ action = "import", title = "Import", sym = "<-", style = "info" },
	{ action = "move", title = "Move", sym = "->", style = "muted" },
	{ action = "forget", title = "Forget", sym = "/", style = "muted" },
	{ action = "read", title = "Read during apply", sym = "<=", style = "info" },
}

local function starts(s: string, prefix: string): boolean
	return string.sub(s, 1, #prefix) == prefix
end

local function ends(s: string, suffix: string): boolean
	return #s >= #suffix and string.sub(s, -#suffix) == suffix
end

-- The directory relative paths in diagnostics resolve against: the shell's
-- working directory, or the `-chdir=` one.
local function base_dir(run: LensRun): string?
	for _, arg in run.args do
		local dir = string.match(arg, "^%-chdir=(.+)$")
		if dir then
			if starts(dir, "/") or run.cwd == nil then
				return dir
			end
			return run.cwd .. "/" .. dir
		end
	end
	return run.cwd
end

-- The resource a `# …` header line announces, if it is one.
local function header(body: string, section: string): Resource?
	if section == "drift" then
		for _, pair in DRIFT do
			if ends(body, pair[1]) then
				return { addr = string.sub(body, 1, #body - #pair[1]), action = pair[2] }
			end
		end
		return nil
	end
	local from, to = string.match(body, "^(.-) has moved to (.+)$")
	if from and to then
		return { addr = to, action = "move", note = "moved from " .. from }
	end
	for _, pair in ACTIONS do
		if ends(body, pair[1]) then
			local addr = string.sub(body, 1, #body - #pair[1])
			local base, deposed = string.match(addr, "^(.-) %((deposed object %w+)%)$")
			if base and deposed then
				return { addr = base, action = pair[2], note = deposed }
			end
			return { addr = addr, action = pair[2] }
		end
	end
	return nil
end

-- Ends the paragraph a diagnostic is collecting.
local function flush(d: Diagnostic)
	if d.para then
		table.insert(d.notes, d.para)
		d.para = nil
	end
end

-- One line from inside a diagnostic box.
local function absorb(d: Diagnostic, body: string)
	local path, line = string.match(body, "^%s*on (.-) line (%d+)")
	if path and line and d.path == nil then
		d.path = path
		d.line = tonumber(line)
		return
	end
	local num, src = string.match(body, "^%s*(%d+): ?(.*)$")
	if num and src and d.path and #d.notes == 0 and d.para == nil then
		local snippet = d.snippet
		if snippet then
			snippet[2] ..= "\n" .. src
		else
			d.snippet = { tonumber(num) :: any, src }
		end
		return
	end
	local text = string.match(body, "^%s*(.-)%s*$") or ""
	if text == "" then
		flush(d)
	elseif starts(text, "├") then
		return -- the rule above value annotations
	elseif starts(text, BOX_SIDE) then
		flush(d)
		table.insert(d.notes, (string.gsub(string.sub(text, #BOX_SIDE + 1), "^%s+", "")))
	else
		d.para = if d.para then d.para .. " " .. text else text
	end
end

local function close(state: State)
	local open = state.open
	if open then
		flush(open)
		state.open = nil
	end
end

-- A clickable resource row: its symbol, address and note.
local function resource_row(r: Resource, sym: string, style: string): Node
	local spans: { Span | string } = { ui.span(sym, style .. " strong"), " ", ui.span(r.addr, "mono") }
	if r.note then
		table.insert(spans, ui.span("  " .. r.note, "muted"))
	end
	local node = ui.text(spans)
	local p: { [string]: any } = node.p or {}
	p.role = "terraform." .. r.action
	p.title = "Copy address"
	p.actions = { click = "copy-address=" .. r.addr }
	node.p = p
	return node
end

-- A collapsible group of rows, keyed so its collapsed state survives updates.
local function group(key: string, head: Spans, rows: { Node }, total: number, collapsed: boolean): Node
	if total > #rows then
		table.insert(rows, ui.overflow(total - #rows))
	end
	local node = ui.section(head, rows)
	local p: { [string]: any } = node.p or {}
	p.key = key
	p.collapsible = true
	p.collapsed = collapsed
	node.p = p
	return node
end

local function counts(state: State): { [string]: number }
	local n: { [string]: number } = {}
	for _, r in state.resources do
		n[r.action] = (n[r.action] or 0) + 1
	end
	return n
end

local function badges(state: State): { Node }
	local out: { Node } = {}
	local errors, warnings = 0, 0
	for _, d in state.diags do
		if d.severity == "error" then
			errors += 1
		else
			warnings += 1
		end
	end
	local summary = state.summary
	if summary then
		local any = false
		for _, b in
			{
				{ "import", "to import", "info" },
				{ "add", "to add", "success" },
				{ "change", "to change", "warning" },
				{ "destroy", "to destroy", "error" },
				{ "forget", "to forget", "muted" },
			}
		do
			local n = summary[b[1]] or 0
			if n > 0 then
				any = true
				table.insert(out, ui.badge(n .. " " .. b[2], b[3]))
			end
		end
		if not any then
			table.insert(out, ui.badge("No resource changes", "muted"))
		end
	elseif state.nochanges then
		table.insert(out, ui.badge("No changes", "success"))
	elseif state.status == nil then
		table.insert(out, ui.badge("Planning", "pending"))
		local n = counts(state)
		for _, g in GROUPS do
			if n[g.action] then
				table.insert(out, ui.badge(n[g.action] .. " " .. string.lower(g.title), "muted"))
			end
		end
	elseif state.status ~= 0 and state.status ~= 2 then
		-- `-detailed-exitcode` exits 2 for a plan with changes, 1 for an error.
		table.insert(out, ui.badge("Plan failed", "error"))
	end
	if #state.outputs > 0 then
		local label = if #state.outputs == 1 then " output change" else " output changes"
		table.insert(out, ui.badge(#state.outputs .. label, "info"))
	end
	if errors > 0 then
		table.insert(out, ui.badge(errors .. (if errors == 1 then " error" else " errors"), "error"))
	end
	if warnings > 0 then
		table.insert(out, ui.badge(warnings .. (if warnings == 1 then " warning" else " warnings"), "warning"))
	end
	if state.refreshed > 0 then
		table.insert(out, ui.text({ ui.span(state.refreshed .. " refreshed", "muted") }))
	end
	return out
end

local function view(state: State): Node?
	local empty = #state.resources == 0
		and #state.drift == 0
		and #state.outputs == 0
		and #state.diags == 0
		and state.summary == nil
		and not state.nochanges
	if empty then
		return nil -- not a plan we can read (`-json`, `-help`): raw output
	end

	local children: { Node } = { ui.row(badges(state)) }
	for _, d in state.diags do
		table.insert(
			children,
			ui.diagnostic({
				severity = d.severity :: any,
				message = d.title,
				path = d.path,
				line = d.line,
				snippet = d.snippet,
				notes = d.notes,
			}, state.base)
		)
	end

	local danger = false
	for _, g in GROUPS do
		local rows: { Node } = {}
		local total = 0
		for _, r in state.resources do
			if r.action == g.action then
				total += 1
				if total <= GROUP_ROWS then
					table.insert(rows, resource_row(r, g.sym, g.style))
				end
			end
		end
		if total > 0 then
			danger = danger or g.action == "destroy" or g.action == "replace"
			local head = { ui.span(g.title, "strong " .. g.style), ui.span("  " .. total, "muted num") }
			table.insert(children, group(g.action, head, rows, total, g.action == "read"))
		end
	end

	if #state.drift > 0 then
		local rows: { Node } = {}
		for i, r in state.drift do
			if i > GROUP_ROWS then
				break
			end
			table.insert(rows, resource_row(r, "!", "muted"))
		end
		local head = {
			ui.span("Changed outside " .. state.tool, "strong muted"),
			ui.span("  " .. #state.drift, "muted num"),
		}
		table.insert(children, group("drift", head, rows, #state.drift, true))
	end

	if #state.outputs > 0 then
		local rows: { Node } = {}
		for _, o in state.outputs do
			local style = if o.sym == "+" then "success" elseif o.sym == "-" then "error" else "warning"
			local spans: { Span | string } = { ui.span(o.sym, style .. " strong"), " ", ui.span(o.name, "mono") }
			table.insert(rows, ui.text(spans))
		end
		local head = { ui.span("Outputs", "strong"), ui.span("  " .. #state.outputs, "muted num") }
		table.insert(children, group("outputs", head, rows, #state.outputs, false))
	end

	local root = ui.col(children)
	local p: { [string]: any } = root.p or {}
	p.role = if danger then "terraform.plan.danger" else "terraform.plan"
	root.p = p
	return root
end

tern.lens.define("plan", {
	open = function(run: LensRun, _cx: EffectCx): State
		return {
			base = base_dir(run),
			tool = if run.program == "tofu" then "OpenTofu" else "Terraform",
			section = "",
			resources = {},
			drift = {},
			outputs = {},
			summary = nil,
			nochanges = false,
			refreshed = 0,
			diags = {},
			open = nil,
			header = false,
			status = nil,
		}
	end,

	line = function(state: State, l: LensLine)
		local text = l.text

		-- Diagnostics: `╷`, then `│ Error: title` and its body, then `╵`.
		if starts(text, BOX_SIDE) then
			local body = string.gsub(string.sub(text, #BOX_SIDE + 1), "^ ", "")
			local severity, title = string.match(body, "^(%a+): (.+)$")
			if (severity == "Error" or severity == "Warning") and title then
				close(state)
				local d: Diagnostic = { severity = string.lower(severity), title = title, notes = {} }
				table.insert(state.diags, d)
				state.open = d
			elseif state.open then
				absorb(state.open, body)
			end
			return
		end
		if starts(text, BOX_END) then
			close(state)
			return
		end
		local bare_sev, bare_title = string.match(text, "^(%a+): (.+)$")
		if (bare_sev == "Error" or bare_sev == "Warning") and bare_title then
			-- Without the box (older releases): the title alone.
			table.insert(state.diags, { severity = string.lower(bare_sev), title = bare_title, notes = {} })
			return
		end

		-- Section markers.
		if starts(text, "Note: Objects have changed outside of ") then
			state.section = "drift"
		elseif string.find(text, "^%a+ will perform the following actions:") then
			state.section = "actions"
		elseif text == "Changes to Outputs:" then
			state.section = "outputs"
			return
		end

		-- Resource headers and the `# (because …)` notes right under them.
		local body = string.match(text, "^%s*# (.+)$")
		if body then
			local note = string.match(body, "^%((.*)%)$")
			local last = state.resources[#state.resources]
			if note then
				if state.header and last and last.note == nil then
					last.note = note
				end
				return
			end
			local r = header(body, state.section)
			if r then
				table.insert(if state.section == "drift" then state.drift else state.resources, r)
				state.header = state.section ~= "drift"
				return
			end
		end
		state.header = false

		if state.section == "outputs" then
			local sym, name = string.match(text, "^  ([%+~%-]) ([%w_%-]+)")
			if sym and name then
				table.insert(state.outputs, { sym = sym, name = name })
			elseif text ~= "" and not starts(text, " ") then
				state.section = ""
			end
		end

		local plan = string.match(text, "^Plan: (.+)$")
		if plan then
			local summary: { [string]: number } = {}
			for n, what in string.gmatch(plan, "(%d+) to (%a+)") do
				if n and what then
					summary[what] = tonumber(n) or 0
				end
			end
			state.summary = summary
		elseif starts(text, "No changes.") then
			state.nochanges = true
		elseif string.find(text, ": Refreshing state...", 1, true) then
			state.refreshed += 1
		end
	end,

	finish = function(state: State, status: number?)
		close(state)
		state.status = status
	end,

	view = view,

	event = function(_state: State, ev: UiEvent, cx: EffectCx)
		if ev.ev ~= "action" or ev.act ~= "copy-address" or type(ev.value) ~= "string" then
			return
		end
		cx:copy(ev.value)
		cx:toast("success", "Copied resource address", ev.value)
	end,
})
```

`terraform.css`：

```css
/* The terraform plan lens. Every rule is scoped by the lens block's role, so
   the sheet touches nothing else; colors come from Tern's tone variables, so
   light and dark themes both follow. */

/* A plan that destroys or replaces something: a red rule down its view. */
.sf-block[data-role='lens.plugin.terraform.plan'] [data-role='terraform.plan.danger'] {
	box-shadow: inset 2px 0 0 rgb(from var(--sf-bad) r g b/70%);
	padding-left: 10px;
}

/* Resource rows take their action's color as --tc. */
.sf-block[data-role='lens.plugin.terraform.plan'] .sf-text[data-role^='terraform.'] {
	--tc: var(--sf-muted);
	border-radius: 4px;
	padding: 0 4px;
}
.sf-block[data-role='lens.plugin.terraform.plan'] .sf-text[data-role='terraform.create'] {
	--tc: var(--sf-ok);
}
.sf-block[data-role='lens.plugin.terraform.plan'] .sf-text[data-role='terraform.update'],
.sf-block[data-role='lens.plugin.terraform.plan'] .sf-text[data-role='terraform.replace'] {
	--tc: var(--sf-warn);
}
.sf-block[data-role='lens.plugin.terraform.plan'] .sf-text[data-role='terraform.destroy'] {
	--tc: var(--sf-bad);
}
.sf-block[data-role='lens.plugin.terraform.plan'] .sf-text[data-role='terraform.read'],
.sf-block[data-role='lens.plugin.terraform.plan'] .sf-text[data-role='terraform.import'] {
	--tc: var(--sf-info);
}

/* A click copies the address: say so on hover. */
.sf-block[data-role='lens.plugin.terraform.plan'] .sf-text[data-role^='terraform.']:hover {
	background: rgb(from var(--tc) r g b/12%);
	box-shadow: inset 2px 0 0 var(--tc);
}
```