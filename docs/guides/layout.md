# 布局与工作区

插件的 Window 端可以跟踪窗口中发生的情况（焦点移动、窗格和标签页的增删、命令运行），并安排窗口本身的布局：打开标签页、拆分窗格、移动、调整大小和关闭窗格，以及构建完整的工作区。这两者都通过 window `cx` 完成。

```lua
tern.on("window_start", function(cx)
	local pane = cx.layout:new_tab({ cwd = "/tmp" })
	if pane then
		cx.layout:split(pane, "down", { command = "htop" })
	end
end)
```

## 窗口事件

Window 端的 `tern.on(name, fn)` 用于订阅窗口事件。未知名称会触发 `tern.on: unknown window event`。

| 事件 | 处理器 | 触发时机 |
| --- | --- | --- |
| `window_start` | `fn(cx)` | 每个窗口和插件触发一次，在窗口的会话稳定下来之后（恢复会话或全新启动）。 |
| `focus` | `fn({pane, tab}, cx)` | 焦点窗格发生变化。 |
| `pane_created` | `fn({pane}, cx)` | 添加了任意类型的窗格（包括浏览器块）。 |
| `pane_closed` | `fn({pane}, cx)` | 窗格已关闭。 |
| `tab_created` | `fn({tab}, cx)` | 打开了标签页。 |
| `tab_closed` | `fn({tab}, cx)` | 标签页已关闭。 |
| `command_started` | `fn({pane, line}, cx)` | Shell 开始运行一条命令行。 |
| `command_finished` | `fn({pane, line, status, took_ms}, cx)` | 命令行结束，退出状态为 `status`，耗时 `took_ms` 毫秒。 |
| `cwd` | `fn({pane, path}, cx)` | 窗格的工作目录发生变化。 |
| `title` | `fn({pane, title}, cx)` | 窗格中的程序设置了标题。 |

事件描述此窗口的会话所观察到的情况，也包括远程主机的窗格；每个窗口都会单独派发自己的事件。事件会随着会话变化排队，并在窗口绘制完成后派发，绝不会在会话变化过程中派发；每个事件会按照插件 ID 顺序发送给每个插件的处理器。`command_started` 和 `command_finished` 需要 Shell 能报告其命令行，Tern 的 Shell 集成就支持这一点。

与同名的[主机钩子](hooks.md)不同，Window 端的 `command_started` 不包含 `cwd`；请从 `cx.session:panes()` 或 `cwd` 事件读取目录。Host 端在窗格运行所在的位置看到一次相同的 Shell 事件；显示该会话的每个窗口中，Window 端都会看到这些事件。

每个插件在每个窗口中都会运行一次 `window_start`。重新加载不会让已在该窗口运行过此事件的插件再次运行，但会让之后新增的插件运行（例如刚安装或刚启用的插件）。打开第二个窗口时，也会在该窗口运行。处理器若响应事件而更改会话，就会引发更多事件：处理 `focus` 的处理器若聚焦另一个窗格，就会在下一次派发时再次收到 `focus`，因此要防止循环。

## 窗口 `cx`

每个窗口处理器都会将 `cx` 作为最后一个参数接收，包括事件处理器、命令、按键绑定、覆盖、路由和 `available` 检查。它只在接收它的调用期间有效。将 `cx` 保存在上值（upvalue）中并在之后使用会触发错误。

计时器、进程和 fetch 回调不会继承启动它们的调用中的 `cx`；它们会收到一个全新的 `cx`：

```lua
tern.on("window_start", function(_cx)
	tern.timer(2000, function(cx)
		if cx then
			cx:toast("info", "Two seconds in")
		end
	end)
end)
```

计时器的 `cx` 参数类型标记为可选，因为 Host 端计时器不会收到它；在 Window 端它始终有值。参见[文件、进程与存储](io.md#计时器与时间)。

## 读取会话

`cx.session` 用于读取窗口的窗格和标签页：

| 方法 | 返回值 |
| --- | --- |
| `cx.session:panes()` | 每个标签页中的所有窗格：每个窗格包含 `{pane, cwd, program, title, busy}`（未知时 `cwd` 为 `""`；`busy` 表示有由 Shell 集成识别的命令正在运行）。 |
| `cx.session:tabs()` | 所有标签页：`{id, name?, cwd, program, title, panes, busy}`，描述每个标签页中获得焦点的窗格。 |
| `cx.session:focused()` | 获得焦点的窗格 ID；若没有则为 `nil`。 |
| `cx.session:resolve(spec)` | `spec` 指定的窗格；若没有则为 `nil`。 |

`resolve` 按照 `tern` 脚本命名块的方式查找窗格：`"@focused"`、以字符串形式书写的窗格 ID、完全匹配的标题、不区分大小写的标题，最后是程序名称。匹配项有多个时，活动标签页中的匹配项优先。

### ID

窗格和标签页 ID 是 Lua 数字。远程主机的窗格 ID 高位包含主机信息；Tern 会在传给 Lua 前将该标记移至较低位，使 ID 在双精度数中仍保持精确。将 ID 原样传回 `cx`，不要跨窗口比较 ID，也不要将它们与 Host 端或 `tern` 脚本中的 ID 比较：远程窗格的 ID 在那些地方的写法不同。

## 排列窗格

`cx.layout` 用于更改窗口布局：

| 方法 | 效果 |
| --- | --- |
| `cx.layout:new_tab(launch?)` | 在当前会话中打开一个运行 `launch` 的标签页，将其设为活动标签页，并返回其窗格。 |
| `cx.layout:split(target, dir, launch?)` | 拆分窗格 `target`，在 `dir` 方向创建并运行 `launch` 的新窗格；新窗格会获得其标签页的焦点。返回新窗格。 |
| `cx.layout:focus(pane)` | 在此窗口中聚焦窗格。 |
| `cx.layout:close(pane)` | 关闭窗格。 |
| `cx.layout:move(pane, target, dir)` | 将 `pane` 移到 `target` 的 `dir` 方向。当任一窗格不存在或它们位于不同主机时，返回 `false`。 |
| `cx.layout:resize(pane, dir, cells)` | 将窗格最近的分隔线沿 `dir` 方向移动，距离约为该窗格 `cells` 个单元格的尺寸；负数会使其反向移动。当该方向没有拆分时，返回 `false`。 |
| `cx.layout:tab(spec)` | 构建工作区标签页（见下文）；返回其标签页 ID。 |

`dir` 为 `"right"`、`"down"`、`"left"` 或 `"up"`；其他值都会触发 `unknown direction`。

如果 `launch` 指定了主机上不存在的块类型，`new_tab` 和 `split` 会返回 `nil`；如果 `target` 不在任何标签页中，`split` 也会返回 `nil`。新标签页在当前会话的主机上启动，目录为新标签页通常使用的目录（由 `new_tabs` 设置决定），除非 `launch` 指定了目录。拆分窗格在 `target` 所在主机上启动，目录默认为 `target` 的目录，除非 `launch` 指定了目录。

布局变化属于会话变化：会同步到显示此会话的每个窗口。焦点是例外。`cx.layout:focus` 只移动此窗口的焦点，其他窗口保留各自的焦点。

### 启动表

`launch` 表用于指定新窗格运行什么：

| 字段 | 含义 |
| --- | --- |
| `cwd` | 窗格启动时所在的目录。 |
| `command` | 窗格通过登录 Shell 运行的命令行，用于替代交互式 Shell。 |
| `block` | 插件块类型，格式为 `"<plugin>.<block>"`，用于替代 Shell 打开。 |
| `args` | 传给块 `init` 的启动参数（字符串）。 |

未提供 `launch` 或提供空表时，窗格会运行交互式 Shell。`block` 必须是窗格所在主机上某个 Ready 插件的块类型。参见[块](blocks.md)。

## 工作区

`cx.layout:tab(spec)` 通过一次调用，从拆分树构建标签页：

| 字段 | 含义 |
| --- | --- |
| `cwd` | 此节点的目录，并由其下所有节点继承。 |
| `name` | 标签页名称（仅限顶层）。 |
| `split` | `[1]` 和 `[2]` 之间的拆分方向：`"right"`（默认）、`"down"`、`"left"` 或 `"up"`。 |
| `[1]`, `[2]` | 拆分的两侧，各自为一个 spec。 |
| `launch` | 叶节点（不含 `[1]` 和 `[2]` 的 spec）运行的内容；默认为 Shell。 |

标签页首先打开最左侧叶节点的窗格，然后每次拆分都会添加第二侧。树中更深层的 `cwd` 会覆盖上层的值，而叶节点的 `launch.cwd` 会覆盖这两者。`tab` 返回标签页 ID；即使构建完成时另一个标签页已处于活动状态，它仍会为自己构建的标签页命名。

第二个返回值会报告无法启动的窗格。如果第一个窗格无法打开，则不会打开标签页，`tab` 会返回 `nil` 和错误。如果之后某次拆分的新侧无法启动，例如 `launch.block` 未由主机上的任何 Ready 插件定义，Tern 会略过该侧及其子树，构建并命名其余部分，并返回标签页 ID 和类似 ``could not start block `<kind>` `` 的错误。Tern 不会弹出提示，因此请检查错误：

```lua
local tab, err = cx.layout:tab(spec)
if err then
	cx:toast("error", "Workspace opened incomplete", err)
end
```

```lua
tern.command({
	id = "api",
	title = "Open the api workspace",
	run = function(cx)
		cx.layout:tab({
			name = "api",
			cwd = "/srv/api",
			split = "right",
			{ launch = { command = "nvim" } },
			{
				split = "down",
				{ launch = { command = "cargo watch -x test" } },
				{},
			},
		})
	end,
})
```

从命令面板运行时，这会打开一个名为 `api` 的标签页：左侧运行 `nvim`；右侧上方运行 `cargo watch`，下方是交互式 Shell，所有窗格都位于 `/srv/api`。

## 启动时打开工作区

Window 端可以在每次窗口启动时打开项目工作区，除非会话中已经存在该工作区（恢复的会话会还原其标签页）：

```lua
local ROOT = (tern.getenv("HOME") or "") .. "/work/stencil"

tern.on("window_start", function(cx)
	for _, tab in cx.session:tabs() do
		if tab.name == "stencil" then
			return
		end
	end
	if not tern.fs.exists(ROOT) then
		return
	end
	cx.layout:tab({
		name = "stencil",
		cwd = ROOT,
		split = "right",
		{ launch = { command = "nvim" } },
		{ launch = { command = "cargo watch -x check" } },
	})
end)
```

`window_start` 会在每个窗口中运行，因此这个检查很重要：否则每个新窗口都会在会话中再添加一个工作区标签页。

### 在构建窗格旁保留日志窗格

事件和布局调用可以组合使用。此插件会在命令失败的窗格下方打开一个窗格，在相同目录中运行 Shell，并且每个窗格最多打开一个：

```lua
local opened: { [number]: boolean } = {}

tern.on("command_finished", function(ev, cx)
	if ev.status == 0 or opened[ev.pane] then
		return
	end
	opened[ev.pane] = true
	cx.layout:split(ev.pane, "down")
	cx.layout:focus(ev.pane)
end)

tern.on("pane_closed", function(ev, _cx)
	opened[ev.pane] = nil
end)
```

`split` 会让新窗格获得焦点；`focus` 调用则将焦点交还给运行命令的窗格。

## 另请参阅

- [命令、按键与覆盖](commands.md)：例如 `cx:run` 和 `cx:new_block` 这样的 `cx` 操作。
- [主机钩子与 Spawn Filter](hooks.md)：Host 端对相同 Shell 的观察方式。
- [事件](../reference/events.md)：两端的所有事件及其载荷。
- [项目工作区](../examples/workspaces.md)：完整的工作区插件。
