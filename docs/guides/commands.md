# 命令、按键与覆盖

插件的 Window 端可以向命令面板添加条目、将按键序列绑定到操作，并接管 Tern 的内置命令。这三者都只在 Window 端运行：它们在窗口的 UI 线程上、插件的 Window 端 VM 中执行，每次调用都会获得一个新的 Window 端 `cx`。

```lua
tern.command({
	id = "scratch",
	title = "Open scratch file",
	icon = "file",
	keys = { "ctrl+alt+shift+s" },
	run = function(cx)
		cx:open(tern.plugin.data .. "/scratch.md", "beside")
	end,
})
```

## 命令

`tern.command(def)` 会添加一个命令面板条目和一个执行相应操作的动作。该条目显示在 `group` 下；从命令面板选中、通过已绑定的按键序列触发、作为状态栏片段点击，或在用户的 `keybinds` 中指定时，都会运行 `run(cx)`。

| 字段 | 必需 | 含义 |
| --- | --- | --- |
| `id` | 是 | ASCII 字母、数字、`_` 和 `-`；不能是 `bind`。动作名称为 `plugin.<plugin>.<id>`。 |
| `title` | 是 | 命令面板中的标签。 |
| `icon` | 否 | Tern 图标名称（`file`、`terminal`、`sparkle`、`branch`、…）。未提供或未知时使用 `puzzle`。 |
| `group` | 否 | 命令面板分组。默认值：manifest 的 `name`。 |
| `keys` | 否 | 默认按键序列，添加到插件绑定层，方式与 `tern.bind` 添加按键相同。 |
| `available` | 否 | `fn(cx) -> boolean`：该条目当前是否显示。 |
| `run` | 是 | `fn(cx)`：命令执行的操作。 |

无效的 `id` 会在调用时抛出 `tern.command: bad id`。如果注册的 id 已由该插件注册，则会替换原条目；先前注册时 `keys` 指定的按键序列仍保持绑定。

每当命令面板列出该插件的条目时，都会运行 `available`，使用格式化器的 4 ms 预算。任何不是 `nil` 或 `false` 的值都会显示该条目。发生错误或运行超出预算时，条目会隐藏并显示错误 toast；超出预算的检查会暂停（首次暂停 5 s，之后若持续超时则时间更长），且条目会一直隐藏到暂停结束。请将它限制在少量表查找操作：每次打开命令面板都会运行它。

`run` 使用普通的 50 ms Window 端预算。它失败时会显示 `Plugin <name>: command <id> failed` toast；`available` 失败时会显示 `available plugin.<plugin>.<id>`。参见[运行时、预算与 JIT](../concepts/runtime.md)。

## 动作名称

动作名称是按键序列、状态栏片段的 `command` 或 `keybinds` 条目所运行的名称。插件可以像指定自己的动作一样，自由指定内置动作和其他插件的动作。

| 形式 | 执行内容 |
| --- | --- |
| 命令 id：`new_tab`、`split_right`、`close_pane`、`layout:rail`、`move_pane:left`、… | 内置命令面板命令。 |
| `palette`、`goto_tab:N`、`last_tab`、`focus_pane:DIR`、`resize_split:DIR`、`find_older`、`find_newer`、`scroll_top_at_shell`、`scroll_bottom_at_shell` | 不属于命令面板命令的内置动作。 |
| `text:BYTES` | 向当前聚焦终端的程序写入字节（转义序列为 `\e`、`\r`、`\n`、`\t`、`\\`）。 |
| `edit.*`、`editor.*`、`markdown.*`、`git.*`、`sqlite.*`、`notebook.*`、`board.*` | 接受这些动作的视图的按键序列。 |
| `plugin.<plugin>.<id>` | 插件的 `tern.command`。 |
| `plugin.<plugin>.bind.<n>` | 插件的第 `n` 个函数绑定。 |

[内置动作](../reference/actions.md)列出了所有名称。插件动作只有在运行时才会检查：如果 `plugin.<plugin>.<id>` 指定的插件或命令尚未加载，解析仍会成功；按下时会显示 `No plugin has this action` toast。

## 绑定

`tern.bind(chord, action)` 将按键序列绑定到动作名称或函数。

```lua
tern.bind("ctrl+alt+shift+n", "new_tab")
tern.bind("ctrl+alt+shift+j", "plugin.scratch.scratch")
tern.bind("ctrl+alt+shift+y", function(cx)
	local pane = cx.session:focused()
	if pane then
		cx:run(pane, "git status\r")
	end
end)
```

按键序列的写法与 `settings.json` 中 `keybinds` 的写法相同：修饰键（`ctrl`、`alt` 或 `opt`、`shift`、`cmd` 或 `super`）以 `+` 连接，后接一个按键；序列中的按键以 `>` 连接（`ctrl+a>c`）。单独使用修饰键时，它就是被轻按的按键，且只能用于连续轻按的序列（`shift>shift`：在半秒内按两次 Shift；Tern 的 `cmd>cmd` 会询问 Carly）。在 PC 键盘上（Windows、Linux，以及启用了 `swap_ctrl_cmd` 的 macOS），`cmd` 表示 Windows 或 Super 键，与 `keybinds` 中的含义相同。

函数绑定的动作名称为 `plugin.<plugin>.bind.<n>`，编号从 0 开始，按插件创建函数绑定的顺序排列。插件添加或重新排序绑定时，编号会变化，因此插件外部不应指定该名称；如果希望用户可以重新绑定该动作，请注册 `tern.command`。

只有当 `action` 既不是字符串也不是函数时，`tern.bind` 才会抛出错误。无法解析的按键序列或动作名称不会加入按键映射，日志中会出现 `plugin bind left out` 警告。

## 按键映射分层

按键映射由多个层组成，每层都会优先占用下层的按键：

| 层（由低到高） | 来源 |
| --- | --- |
| 默认值 | Tern 的内置按键映射。 |
| 预设 | `settings.json` 中的 `keymap`（另一个终端的默认设置，例如 `tmux`）和 `keymap_prefix`。 |
| 插件绑定 | 每个插件的 `tern.bind` 和命令 `keys`，按插件 id 排序。 |
| 用户 | `settings.json` 中的 `keybinds`。 |

插件只能添加按键。如果默认设置或预设已绑定相同按键、以插件按键开头的序列，或作为插件按键序列前缀的按键组合，则插件绑定会被排除，并在日志中记录警告 `plugin bind left out: the preset binds these keys`（例如，预设单独绑定了 `ctrl+b`，就会排除插件的 `ctrl+b>x`）。只要对应的完整序列尚未使用，插件就可以在预设前缀下添加新序列。两个插件绑定相同按键时会共享该绑定：两个动作都会按插件顺序保留，按下时运行第一个适用的动作。

用户层始终优先。`keybinds` 条目会替换其按键的所有绑定，包括插件绑定；`"unbind"` 或 `[]` 则会移除插件的按键序列，而不替换它。

请选择默认设置中尚未占用的按键序列：hello 测试样例使用 `ctrl+alt+shift+h`。每次重新加载，以及插件在运行时注册绑定或命令时，都会重建绑定。

## `settings.json` 中的插件动作

用户绑定插件动作的方式与绑定内置动作相同；用户条目位于所有插件之上：

```json
{
	"keybinds": {
		"cmd+shift+j": "plugin.scratch.scratch",
		"ctrl+alt+shift+h": "unbind"
	}
}
```

条目也可以是按优先级排列的动作名称列表；按下时会运行当前焦点位置适用的第一个动作。Preferences 的 Keyboard 页面会列出当前生效的插件动作，描述为 "A plugin's action."。

## 覆盖

`tern.override(command_id, fn)` 会在内置命令 `command_id` 之前运行 `fn(cx)`。返回 `true`（任何不是 `nil` 或 `false` 的值）都会跳过内置命令。

```lua
tern.override("new_tab", function(cx)
	cx:toast("info", "Opening a tab")
	cx:command("new_tab") -- Tern's own new_tab; this override doesn't run again
	return true
end)
```

`command_id` 可以是任意内置命令 id：即上方动作表第一行中的名称，例如 `new_tab`、`split_right`、`close_pane`、`reload_config` 或 `move_pane:left`。未知 id 会抛出 `tern.override: unknown command`。不属于命令面板命令的动作（`palette`、`goto_tab:N`、`focus_pane:DIR`、`edit.*` 系列等）无法覆盖。

无论命令如何启动，覆盖都会运行：通过命令面板、按键序列、菜单栏或工具栏按钮启动均可。每个插件对该命令注册的覆盖会按插件 id 顺序运行；同一插件内则按注册顺序运行，直到其中一个返回 true。覆盖失败时会显示 toast，并视为返回 `false`，因此接下来仍会运行下一个覆盖，然后运行内置命令。

## 递归保护

任何插件处理器运行期间，窗口的整个插件运行时都会从窗口中取出，并在处理器返回时放回。处理器执行过程中，任何会查询插件的操作都无法找到插件：

- `cx:command(id)` 会运行 Tern 自己的命令。它不会运行任何覆盖，无论是调用插件注册的还是其他插件注册的。
- `cx:open(target)` 会执行 Tern 自己的打开操作，不会触发 `tern.route.open` 或 `tern.route.link` 处理器。
- 处理器运行的内置命令若会打开文件或链接，也会跳过路由。

因此，覆盖 `new_tab` 时可以调用 `cx:command("new_tab")` 而不会递归，路由处理器也可以对传入的路径调用 `cx:open`。这也意味着处理器无法触发其他插件的覆盖或路由。

由此会产生两点影响。`cx:command` 只接受内置命令 id：调用期间插件动作不可用，因此 `cx:command("plugin.other.thing")` 会抛出 `unknown command`。此外，处理器运行期间所做的注册（运行时注册的 `tern.command`、`tern.bind`、`tern.css` 或界面框架格式化器）会在处理器返回时生效；处理器运行期间请求的重新加载也会在处理器结束后执行。

## Window 端的 `cx`

每个 Window 端处理器都会收到一个只在本次调用期间有效的 `cx`（参见[布局与工作区](layout.md#窗口-cx)）。它提供以下操作：

| 成员 | 效果 |
| --- | --- |
| `cx:run(pane, text)` | 将 `text` 键入窗格中的程序；末尾加上 `"\r"` 可执行一行命令。若该窗格没有运行程序，则抛出 `no program runs in that pane`。 |
| `cx:open(target, how?)` | 由 Tern 自行打开路径或 URL；不运行路由。指定 `how` 时，路径会作为文件块打开，并按 `how` 指定的位置放置。不指定时，目标的打开方式与在当前聚焦窗格中点击链接相同。 |
| `cx:new_block(kind, args?, how?, opts?)` | 在当前 host 上打开插件块 `kind`（`"<plugin>.<block>"`）；返回其窗格。如果该处没有 Ready 插件定义此 kind，则返回 `nil`。`opts` 可接受 `focus`，以及用于[按保存的尺寸打开](../reference/api-window.md#按已保存尺寸打开)的 `target`、`dir` 和 `ratio`。 |
| `cx:command(id)` | 按 id 运行内置命令；不会运行覆盖。 |
| `cx:pick(opts)` | 在当前聚焦窗格上方请用户从 `opts.items` 中选择一项；返回一个 awaitable，其结果为所选项目，用户取消时结果为 `nil`（[请用户选择](../reference/api-window.md#向用户提问)）。 |
| `cx:prompt(opts?)` | 在当前聚焦窗格上方请用户输入一行；返回一个 awaitable，其结果为输入文本，用户取消时结果为 `nil`。 |
| `cx:toast(level, text, sub?)` | 显示 toast；`level` 为 `"success"`、`"info"` 或 `"error"`。 |
| `cx:copy(text)` | 将 `text` 放入剪贴板。 |
| `cx.session` | 窗口的窗格和标签页（[布局与工作区](layout.md#读取会话)）。 |
| `cx.layout` | 分屏、标签页、焦点和工作区（[布局与工作区](layout.md#排列窗格)）。 |

`how` 可取 `default`、`beside`、`below`、`split`、`tab`、`replace`、`over` 或 `preview`；其他值会抛出 `unknown how`。`over` 会将新块放到当前聚焦窗格的位置，并在新块关闭时放回原窗格（[how 值](../reference/api-window.md#window-上下文-cx)）。参见[打开与链接路由](routing.md#打开请求)。

## 示例

### 仅在适用时显示的命令

```lua
local function focused_pane(cx)
	local id = cx.session:focused()
	if id == nil then
		return nil
	end
	for _, pane in cx.session:panes() do
		if pane.pane == id then
			return pane
		end
	end
	return nil
end

tern.command({
	id = "cargo_test",
	title = "Run cargo test",
	icon = "terminal",
	group = "Rust",
	keys = { "ctrl+alt+shift+t" },
	available = function(cx)
		local pane = focused_pane(cx)
		return pane ~= nil and pane.cwd ~= "" and tern.fs.exists(pane.cwd .. "/Cargo.toml")
	end,
	run = function(cx)
		local pane = focused_pane(cx)
		if pane then
			cx:run(pane.pane, "cargo test\r")
		end
	end,
})
```

`available` 会读取窗口所在机器的磁盘。对于远程 host 上的窗格，`pane.cwd` 指向该 host 上的目录，因此检查的却是错误的机器；应改为依据窗口知道的信息进行判断，或接受该条目在远程窗格中也会显示。

### 复制当前聚焦目录

```lua
tern.bind("ctrl+alt+shift+c", function(cx)
	local id = cx.session:focused()
	for _, pane in cx.session:panes() do
		local cwd = pane.cwd
		if pane.pane == id and cwd and cwd ~= "" then
			cx:copy(cwd)
			cx:toast("success", "Copied directory", cwd)
			return
		end
	end
end)
```

### 在仓库根目录中新建标签页

该覆盖会在当前聚焦窗格所属 git 仓库的根目录中新建标签页，其余情况则交给内置命令处理：

```lua
local function repo_root(dir: string): string?
	local at = dir
	while at ~= "" and at ~= "/" do
		if tern.fs.exists(at .. "/.git") then
			return at
		end
		at = string.match(at, "^(.*)/[^/]*$") or ""
	end
	return nil
end

tern.override("new_tab", function(cx)
	local id = cx.session:focused()
	for _, pane in cx.session:panes() do
		local cwd = pane.cwd
		if pane.pane == id and cwd and cwd ~= "" then
			local root = repo_root(cwd)
			if root then
				cx.layout:new_tab({ cwd = root })
				return true
			end
		end
	end
	return false -- Tern's own new_tab runs
end)
```

返回 `false` 会将命令交还给内置命令。调用 `cx:command("new_tab")` 并返回 `true` 也会得到相同结果，但可以在操作前后执行其他逻辑。

### 先询问名称，再询问远程端

需要输入的命令会直接在原处、作用窗格上方询问，而不是打开分屏来读取输入。`cx:prompt` 和 `cx:pick` 会返回 awaitable；每个回答都会伴随一个新的 `cx` 到达，`nil` 表示用户取消了问题：

```lua
local function quote(s: string): string
	return "'" .. s:gsub("'", "'\\''") .. "'"
end

tern.command({
	id = "push_branch",
	title = "Push a new branch…",
	icon = "branch",
	run = function(cx)
		local pane = cx.session:focused()
		if not pane then
			return
		end
		cx:prompt({ placeholder = "Branch name", icon = "branch", action = "next" })
			:next(function(name, _err, cx)
				if not name or name == "" or not cx then
					return
				end
				cx:pick({
					placeholder = "Push " .. name .. " to…",
					icon = "branch",
					action = "push",
					items = {
						{ label = "origin", detail = "your fork", remote = "origin" },
						{ label = "upstream", detail = "the main repository", remote = "upstream" },
					},
				}):next(function(item, _err, cx)
					if item and cx then
						cx:run(pane, "git switch -c " .. quote(name) .. " && git push -u "
							.. item.remote .. " HEAD\r")
					end
				end)
			end)
	end,
})
```

第二个问题会在第一个问题的回答到达后打开：选择器会先关闭，再收到回答，因此连续提问看起来像一个连贯流程。

## 另请参阅

- [内置动作](../reference/actions.md)：所有动作和命令 id。
- [Window API](../reference/api-window.md)：`tern.command`、`tern.bind`、`tern.override` 和 `cx` 类型。
- [Chrome 与样式](chrome.md#状态片段)：点击后运行动作的状态栏片段。
- [调试](debugging.md)：查找被排除的绑定和失败的处理器。
