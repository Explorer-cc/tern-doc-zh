# Window API

Window 上下文会在本机的每个 Tern 窗口中运行 `window.luau`，每个窗口都会在自己的 UI 线程上为每个插件创建一个独立 VM。它负责命令面板命令、快捷键绑定、内置命令覆盖、文件打开与链接点击的路由、窗口装饰栏格式化器、全局 CSS、窗口事件和布局脚本。由于它与 UI 线程共享资源，因此预算很短：每次调用 50 ms（包括加载时运行入口），窗口装饰栏格式化器和 `available` 检查为 4 ms。参见[运行时、预算与 JIT](../concepts/runtime.md)。

Web 客户端不运行 Lua，因此不存在 Window 端。iOS 上则以解释执行方式运行。

## Carly 的 Lua 工具

桌面版 Carly 为每段对话使用单独的 Luau VM，但它使用相同的 window `cx`。`lua` 调用会保留全局变量，直到 `/new` 或每日轮换；重新加载插件不会重置这些变量。这里没有 Window 端注册 API 和 `tern.secrets`；但可以使用 `loadstring` 以及常规的环境、文件系统、进程、网络和窗口 API。
使用 `help("cx.session")` 或 `help("tern.process")` 可查看共享声明。

```lua
local pane = cx.session:focused()
cx:run(pane, "pwd\r")
return await(cx.session:settle(pane, 30000))
```

`cx.session:settle(pane, ms?) -> Awaitable<string>` 会等待 Shell 命令完成（OSC 133）或达到截止时间，并返回最后几行输出。默认等待 30000 ms，最多 120000 ms；如果窗格关闭，则 awaitable 会失败。插件通过 `:next(function(text, err, cx) … end)` 使用同一个 awaitable；回调会收到新的上下文。Carly 使用 `await` 或 `await_all({a, b})`。Carly 的 `cx` 及其 `session`、`layout`、`canvas` 和 `browser` 对象在抢占和 await 期间仍然有效；保存的引用会解析到当前正在运行的调用。在有效调用之外使用这些对象会报错。插件上下文仍会在处理器返回时失效。

打印内容和返回值会成为 Carly 的工具答案；`_` 和 `_out` 保留第一个完整返回值及打印文本。已保存的工作区 `snippets/*.luau` 模块必须通过 `require("name")` 显式加载，不会自动加载。无头模式下，`carly lua "<code>"` 会将原始答案存入 `state.carly.last_tool`；其卡片会以围栏代码块显示内容，以保留打印输出和错误回溯的换行。面向模型的工具答案仍为纯文本。
Carly 拥有常规 Window 端插件 API 能力：读取环境变量、读写文件系统、运行进程、发起网络请求、向任意指定窗格输入内容，以及操作窗口。相对文件路径根据 Carly VM 的工作目录解析；该目录并非写入范围的边界。参数校验、操作错误、截止时间和资源预算仍然适用。

## Carly 导出项与请求上下文

`tern.carly` 安装在桌面 Window 端插件 VM 中（不包括 Host 端、Web 或 iOS）。参见[扩展 Carly](../guides/carly.md)，了解功能与示例。

| 注册项 | 约定 |
| --- | --- |
| `tern.carly.export(name, {sig, doc}, fn)` | 注册或替换有文档说明的导出项；名称符合 `[a-z][a-z0-9_]{0,23}`，最多 16 项，`sig`/`doc` 各为 1–1024 字节 |
| `tern.carly.context(fn)` | 替换请求上下文提供器；`fn(cx) -> string?`，预算 4 ms，每个插件最多 400 个字符，总计最多 1600 个字符 |

默认情况下，所有已加载本地 Window 端插件注册的导出项和上下文都会提供给 Carly。`help()` 会列出导出项，`help("plugins.<id>")` 会显示其签名和文档。

Carly 会调用 `await(plugins[id][name](...))`。参数以 JSON 值传递；函数会收到这些位置参数，后跟新的常规 Window 端插件 `cx` 和一个 `ExportCall`。该函数使用正常的 50 ms 插件预算。同步返回值会立即使 awaitable 完成；多个返回值会组成数组。既没有返回值也没有回复时，会立即报错。

`ExportCall` 在定时器、进程和网络请求回调中仍然有效：

- `call:reply(value) -> boolean`：使用 JSON 安全值回复一次。
- `call:fail(message) -> boolean`：失败一次。
- `return call:wait(ms?)`：等待回调，默认 30000 ms，最多 120000 ms。
- `call.cancelled`：完成、取消、过期或重新加载后为 true。

迟到的回复会返回 false。参数和答案的编码 JSON 上限为 1 MiB：超出上限的字符串答案（回复或单个返回值）会在 UTF-8 字符边界截断，以适应限制，并以 `[… N bytes cut]` 结尾，其中 N 是省略的字节数；其他超限值会失败。`call:fail` 消息上限为 16 KiB。函数、userdata、线程、循环引用和非有限数字会报错，并指出出问题的路径。重新加载时，待处理调用会以 `plugin <id> reloaded before answering` 失败。Carly 侧缓存的导出函数会在调用时查找新实现。

上下文会追加 **Plugins** 部分，并公布所有已加载本地 Window 端插件注册的导出项。提供器报错或超出预算都不会阻塞提问。导出处理器及后续回调拥有常规插件 API 能力。

## 注册

每个注册成员（`tern.command`、`tern.bind`、`tern.override`、`tern.route.*`、`tern.chrome.*`、`tern.files.button`、`tern.css`、`tern.on`、`tern.carly.export`、`tern.carly.context`）都可以在入口加载时或之后由任意处理器调用。调用期间进行的注册会在调用返回时生效：命令面板行、按键映射的插件层、Files 窗格按钮和格式化器都会重新读取，并安装新样式表。重新加载会连同 VM 一起移除所有注册，然后再次运行入口。

插件按 id 排序。下文所说的“插件顺序”指该顺序；同一插件内则按注册顺序排列。

## 窗格和标签页 ID

窗格和标签页 ID 是 Lua 数字。本机 ID 与 `tern ls` 显示的一致。远程主机上的窗格会携带一个主机标签，Tern 会将它与 ID 打包，使供 Lua 使用的结果小于 2<sup>53</sup>，因此 ID 能在双精度浮点数中精确表示。请将 ID 原样传回（来自 `cx.session`、事件载荷或 `cx.layout` 结果），不要对它们进行计算，也不要跨窗口比较。

## `tern.command`

```lua
tern.command: (def: CommandDef) -> ()

type CommandDef = {
	id: string,
	title: string,
	icon: string?,
	group: string?,
	keys: { string }?,
	available: ((cx: WindowCx) -> boolean)?,
	run: (cx: WindowCx) -> (),
}
```


添加命令面板行和操作 `plugin.<plugin>.<id>`；快捷键绑定（`tern.bind`、`settings.json` 中的 `keybinds`）和状态栏片段都可以引用此操作。

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `id` | 是 | ASCII 字母、数字、`_` 和 `-`；不能是 `bind` |
| `title` | 是 | 命令面板标签 |
| `icon` | 否 | Tern 图标名称；未知或未设置时显示 `puzzle` |
| `group` | 否 | 命令面板分组（默认是插件的 `name`） |
| `keys` | 否 | 默认快捷键；每个快捷键都会像 `tern.bind` 一样绑定到该操作（`"cmd+shift+h"`，序列为 `"ctrl+a>c"`） |
| `available` | 否 | 命令面板每次列出行时调用；返回假值会隐藏该行。预算 4 ms，钩子名为 `available plugin.<plugin>.<id>`；出错时隐藏该行 |
| `run` | 是 | 运行命令，钩子名 `command <id>`，预算 50 ms |

若 id 不合法，会抛出 ``tern.command: bad id `<id>` (letters, digits, `_` and `-`; not `bind`)``；`title` 不是字符串或 `run` 不是函数时，会产生类型转换错误。

再次注册同一个 `id` 会替换该行；新的 `keys` 会追加到已注册的绑定中。

```lua
tern.command({
	id = "scratch",
	title = "Open scratch file",
	icon = "file",
	keys = { "cmd+alt+j" },
	run = function(cx)
		cx:open(tern.plugin.data .. "/scratch.md", "beside")
	end,
})
```

## `tern.bind`

```lua
tern.bind: (chord: string, action: string | ((cx: WindowCx) -> ())) -> ()
```

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| `chord` | `string` | 按 `settings.json` 中 `keybinds` 的写法指定按键：修饰键用 `+` 连接（`ctrl`、`alt`/`opt`、`shift`、`cmd`/`super），后接按键；序列用 `>` 连接 |
| `action` | `string` 或函数 | 操作名称（[内置操作](actions.md)）或函数 |

函数会获得操作名称 `plugin.<plugin>.bind.<n>`，其中 `n` 是此插件按注册顺序计数的函数绑定编号（从 0 开始）；函数会以新的 `cx` 作为钩子 `bind <n>` 运行。

会抛出 `tern.bind: the action is a name or a function`。调用时不会进行其他检查：按键映射重建时会读取绑定；如果快捷键或操作名称无法解析，或者 Tern 默认绑定或键盘预设已经绑定该快捷键、它的某个起始序列，或以它开头的某个序列，则会忽略绑定并记录 `plugin bind left out`。用户对相同按键设置的 `keybinds` 会覆盖插件绑定。

按键映射层从低到高依次为：Tern 默认绑定和键盘预设、插件绑定、用户的 `keybinds`。参见[命令、快捷键与覆盖](../guides/commands.md#按键映射分层)。

```lua
tern.bind("ctrl+alt+shift+h", "plugin.hello.say_hi")
tern.bind("ctrl+alt+shift+t", function(cx)
	local pane = cx.session:focused()
	if pane then
		cx:run(pane, "cargo test\r")
	end
end)
```

## `tern.override`

```lua
tern.override: (command_id: string, fn: (cx: WindowCx) -> boolean?) -> ()
```

每次内置命令 `command_id` 运行时，都会先运行 `fn`，无论命令来自命令面板、快捷键、菜单还是 Tern 的其他部分。覆盖按插件顺序运行；第一个返回真值的处理器会阻止其余处理器运行，并跳过内置命令。处理器抛出错误时按 `false` 处理。钩子名为 `override <command_id>`。

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| `command_id` | `string` | 内置命令 ID（[内置操作](actions.md#命令)） |
| `fn` | 函数 | 返回 `true` 以替代内置命令 |

会抛出 ``tern.override: unknown command `<id>` ``。只有命令面板命令可以被覆盖；其他操作名称（`palette`、`goto_tab:N`、`edit.*` 等）都不是命令。

当任意插件处理器运行时，Window 端插件不会被再次调用：从处理器中调用的内置功能（`cx:command`、`cx:open`、`cx.layout:new_tab`）会直接运行 Tern 自身行为，不触发覆盖和路由。因此，覆盖处理器可以调用自己的命令，不会递归：

```lua
tern.override("new_tab", function(cx)
	cx:toast("info", "New tab")
	cx:command("new_tab")
	return true
end)
```

## `tern.route.open`

```lua
tern.route.open: (fn: (req: OpenRequest, cx: WindowCx) -> RouteDecision?) -> ()

type OpenRequest = {
	path: string,
	line: number?,
	col: number?,
	host: string,
	how: How,
	origin: Origin,
}

type How = "default" | "beside" | "below" | "split" | "tab" | "replace" | "over" | "preview"
type Origin = "palette" | "files" | "drop" | "link" | "system" | "cli" | "carly"
```

为用户发起的文件打开请求注册处理器。处理器按插件顺序运行，直到其中一个返回决策；若没有处理器做出决策，Tern 会自行打开文件。钩子名为 `route.open`。

| 字段 | 含义 |
| --- | --- |
| `path` | 绝对路径；文件存在时为规范路径（已解析符号链接和 `..`） |
| `line`、`col` | 请求指定位置时要显示的位置，从 1 开始 |
| `host` | 文件所在主机的名称 |
| `how` | 文件打开位置：`default`、`beside`、`below`、`split`、`tab`、`replace`（替换当前聚焦块）、`over`（占据当前聚焦窗格的位置，直到关闭）或 `preview` |
| `origin` | 请求来源：`palette`、`files`（Files 窗格）、`drop`、`link`（窗格或文件块中的文件链接）、`system`（Finder 的“Open With”、Dock）、`cli`（`tern open`）或 `carly`（Carly 的 window 上下文） |

守护进程窗格中的 `tern open` 会转发给接受打开请求的窗口，并由该路由处理。Tern 自己发起的打开操作（恢复状态、Git 和看板视图、Files 预览）不会经过路由。

```lua
tern.route.open(function(req, _cx)
	if req.path:sub(-5) == ".json" and req.how ~= "replace" then
		return { block = "jsonx.viewer", args = { req.path } }
	end
	return nil
end)
```

## `tern.route.link`

```lua
tern.route.link: (fn: (link: LinkRequest, cx: WindowCx) -> RouteDecision?) -> ()

type LinkRequest = {
	url: string,
	pane: number?,
	mods: { cmd: boolean, alt: boolean, shift: boolean, ctrl: boolean },
}
```

为窗格中的链接点击、链接菜单中的“Open link”条目、Host 端插件和 surface 请求的打开操作，以及系统交给 Tern 的 URL 注册处理器。它会在所有内置处理之前运行，因此可拦截自定义协议和不存在的路径。钩子名为 `route.link`。

| 字段 | 含义 |
| --- | --- |
| `url` | 被点击的链接（`https://…`、`file://…`、路径或自定义协议） |
| `pane` | 链接所在窗格；没有窗格时为 `nil`（声明中为 `number`） |
| `mods` | 按下的修饰键：`cmd`（⌘，PC 上为 Super）、`alt`、`shift`、`ctrl` |

```lua
tern.route.link(function(link, cx)
	local ticket = link.url:match("^jira://(%u+%-%d+)$")
	if ticket then
		cx:open("https://example.atlassian.net/browse/" .. ticket)
		return { handled = true }
	end
	return nil
end)
```

## 路由决策

```lua
type RouteDecision = {
	block: string?,
	args: { string }?,
	url: string?,
	path: string?,
	how: How?,
	handled: boolean?,
}
```

处理器返回 `nil` 表示继续传递，也可以返回一个表。按下表顺序检查第一个存在的字段并据此处理；其余字段会被忽略。

| 决策 | 来自 `route.open` | 来自 `route.link` |
| --- | --- | --- |
| `nil` | 下一个处理器，然后是内置打开操作 | 下一个处理器，然后是内置处理 |
| `{ block = "<plugin>.<id>", args = {…} }` | 在文件所在主机（`req.host`）和目录中，以 `args` 为参数打开该插件块，并按请求的 `how` 放置 | 在被点击窗格所在的主机和目录中打开该块；按住 ⌥ 时放在该窗格旁边 |
| `{ url = "…" }` | 将 URL 视为被点击的链接：链接路由会看到它一次，然后交给内置处理 | 使用该 URL 的内置链接处理（不会再次运行路由） |
| `{ path = "…", how = … }` | 替换路径（设置 `how` 时也替换放置方式），然后执行内置打开 | 在窗格所在主机的文件块中打开路径，并按 `how` 放置（默认：按住 ⌥ 时放旁边，否则使用默认位置） |
| `{ handled = true }` | 不再运行其他处理 | 不再运行其他处理 |

如果 `block` 指向的类型未由该主机上的任何 Ready 插件定义，则不会打开内容，并会显示错误提示“Could not open the block”，下方为 `No plugin on <host> defines block type <kind>`（同时记录 `no plugin block type for a route decision`）。该决策仍然有效：内置打开操作不会运行。

路由返回无效结果时，会报告为路由钩子失败，并视为 `nil`：

- `a route returns a decision table or nil`；
- ``a route decision has an unknown how `<how>` ``；
- `a route decision sets block, url, path or handled = true`。

## Chrome 格式化器

格式化器是针对小型输入表的纯函数：没有 `cx`，预算 4 ms，钩子名为 `tab_title`、`window_title` 和 `status`。每个插件对每种类型各有一个格式化器（后续调用会替换它）。结果按不同输入缓存（每种最多 256 个输入，之后清空重建）；插件注册发生变化或调用 [`tern.chrome.refresh`](#tern-chrome-refresh) 时会清除缓存。因此，除非输入变化，否则格式化器不会再次运行。格式化器失败时会在窗口下次轮询时显示提示；运行超过 4 ms 时会暂停 5 秒，若持续超时则暂停更久。

### `tern.chrome.tab_title`

```lua
tern.chrome.tab_title: (fn: (tab: TabInfo) -> string?) -> ()

type TabInfo = {
	id: number,
	name: string?,
	cwd: string?,
	program: string,
	title: string,
	panes: number,
	busy: boolean,
}
```

标签页标题取自第一个返回非空字符串的插件格式化器；返回 `nil` 或 `""` 时保留 Tern 的标题。

| 字段 | 含义 |
| --- | --- |
| `id` | 标签页 ID |
| `name` | 用户为标签页指定的名称（如果有） |
| `cwd` | 当前聚焦窗格的工作目录（未知时为 `""`） |
| `program` | 当前聚焦窗格中的程序 |
| `title` | 当前聚焦窗格的标题 |
| `panes` | 标签页中的窗格数 |
| `busy` | 是否有命令正在任意窗格中运行 |

返回值不是字符串或 `nil` 时会以 `a title formatter returns a string or nil` 失败。

### `tern.chrome.window_title`

```lua
tern.chrome.window_title: (fn: (win: WindowInfo) -> string?) -> ()

type WindowInfo = { [string]: any }
```

窗口标题取自第一个返回非空字符串的插件格式化器。运行时会传入以下字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `space` | `string` | 当前会话的名称 |
| `tab` | `string?` | 当前活动标签页的标题 |
| `pane` | `number?` | 当前聚焦的窗格 |
| `cwd` | `string?` | 当前聚焦窗格的工作目录 |
| `tabs` | `number` | 当前会话中的标签页数 |

### `tern.chrome.status`

```lua
tern.chrome.status: (fn: (pane: StatusPaneInfo) -> { StatusSegment }?) -> ()

type StatusPaneInfo = {
	pane: number,
	cwd: string?,
	program: string,
	title: string,
	busy: boolean,
}

type StatusSegment = {
	text: string,
	icon: string?,
	tone: string?,
	command: string?,
}
```

当前聚焦窗格的状态栏片段。每个插件的片段都会按插件顺序显示；`nil` 表示不添加片段。声明中 `cwd` 是可选字段；窗口总会设置它，目录未知时值为 `""`。

Shell 集成报告有命令运行时，`busy` 为 true；命令结束或窗格程序退出后则为 false。它是格式化器缓存键的一部分；对于未使用 Shell 集成的程序，不会据此推断活动状态。

| 片段字段 | 含义 |
| --- | --- |
| `text` | 片段文本（必填） |
| `icon` | Tern 图标名称，显示在文本前 |
| `tone` | 设置 `data-tone`（`"accent"`、`"muted"`、`"error"` 等） |
| `command` | 点击时运行的任意操作名称（[内置操作](actions.md)） |

片段在状态栏中渲染为 `<span class="sl-plugin" data-plugin="<id>">`；设置 `data-tone` 时会带上该属性，可点击时会带上 `on` 类和 `role="button"`。如果 `command` 无法解析，点击时会提示“A status segment's command is unknown”。结果不是列表或 `nil` 时，会以 `a status formatter returns a list of segments or nil` 失败。

```lua
tern.chrome.status(function(pane)
	if pane.program == "kubectl" then
		return { { text = "k8s", icon = "box", tone = "accent", command = "plugin.k8s.contexts" } }
	end
	return nil
end)
```

### `tern.chrome.program_icon`

```lua
tern.chrome.program_icon: (program: string, icon: string?) -> ()
```

为 `program` 选择程序图标，供标签页、命令面板的窗格行、已停放卡片以及其他显示窗格程序图标的位置使用，以取代 Tern 自带图标。这是注册项而非格式化器：执行注册的调用返回时即会读取它，与命令或绑定相同。

| 参数 | 含义 |
| --- | --- |
| `program` | 程序键，按图标的 `data-program` 属性拼写（`codex`、`claude`、Vim 和 Neovim 的 `vim`、`node`、`shell`、`other`；[Chrome 与样式](../guides/chrome.md#程序图标)列出这些值）；也可以是命令名称（`nvim`、`npm`、`aider`，即 `TabInfo.program` 提供的值）。匹配时不区分大小写。 |
| `icon` | Tern 图标名称（[图标名称](../elements/data.md#图标名称)），如 `provider-openai`、`provider:openai`（模型提供商标志）、`sparkle`，或 `tile-omp` 之类的应用图块。设为 `nil` 会移除此插件对 `program` 的选择。 |

窗格图标的优先级从高到低为：会话自己的图标（即 omp 会话设置的图标）；第一个插件按命令名称选择的图标（插件按 id 排序），再按程序键选择；`program_icons` 设置按命令名称选择的图标，再按程序键选择；最后是 Tern 自带图标。应用图块（`tile-*`）会直接替换标签页卡片；其他图标则绘制在空白卡片上。纯文本标签页会以标签页文本颜色平面绘制图标。

图标不存在时会抛出 ``tern.chrome.program_icon: unknown icon `<name>` ``；程序名为空时会抛出 `tern.chrome.program_icon: empty program`。

```lua
-- Codex tabs wear OpenAI's mark instead of Codex's tile.
tern.chrome.program_icon("codex", "provider-openai")
```

### `tern.chrome.refresh`

```lua
tern.chrome.refresh: () -> ()
```

清除当前窗口所有格式化器的缓存结果并唤醒窗口；窗口会在下一帧重绘标签页、状态栏和标题，并使用当前输入重新运行每个格式化器。当格式化器读取的输入之外的数据发生变化时（例如由定时器、进程或事件更新的上值），请调用此方法。其他窗口的缓存不受影响；每个窗口会运行各自的 Window 端。

从格式化器中调用时会抛出 `tern.chrome.refresh: not from a formatter`。只有存在需要计数的内容时，计时状态栏片段才会通过定时器刷新：

```lua
local started: { [number]: number } = {}
local tick: TimerHandle? = nil

local function schedule()
	if tick == nil and next(started) ~= nil then
		tick = tern.timer(1000, function()
			tick = nil
			tern.chrome.refresh()
			schedule()
		end)
	end
end

tern.on("command_started", function(ev, _cx)
	started[ev.pane] = tern.now()
	schedule()
end)
tern.on("command_finished", function(ev, _cx)
	started[ev.pane] = nil
	tern.chrome.refresh()
end)

tern.chrome.status(function(pane)
	local since = started[pane.pane]
	if since == nil then
		return nil
	end
	return { { text = string.format("%ds", (tern.now() - since) // 1000), icon = "clock" } }
end)
```

## `tern.files.button`

```lua
tern.files.button: (def: FilesButtonDef) -> ()

type FilesButtonDef = {
	id: string,
	title: string,
	icon: string?,
	run: (files: FilesInfo, cx: WindowCx) -> (),
}

type FilesInfo = {
	root: string?,
	host: string,
	selection: { string },
	tab: "files" | "changes" | "refs",
}
```

在 Files 窗格标题栏中的 More 前添加按钮（[Chrome 与样式](../guides/chrome.md#files-窗格按钮)）。所有插件按钮都会按插件顺序显示。与标题栏自带工具一样，指针悬停在窗格上时按钮会淡入，有键盘焦点时会显示一个按钮。不同之处在于，这些按钮在 Changes 和 Refs 标签页以及窄窗格中也会保留。

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `id` | 是 | ASCII 字母、数字、`_` 和 `-` |
| `title` | 是 | 工具提示及无障碍名称 |
| `icon` | 否 | Tern 图标名称；未知或未设置时显示 `puzzle` |
| `run` | 是 | 点击时使用该窗格和新的 `cx` 运行，钩子名为 `files button <id>`，预算 50 ms |

| `files` 字段 | 含义 |
| --- | --- |
| `root` | 窗格显示的文件夹，是其主机上的绝对路径；未显示文件夹时为 `nil` |
| `host` | 文件夹所在主机的名称；未显示文件夹时为 `""` |
| `selection` | 所选行的绝对路径；选中的文件夹代表其所有选中后代项。没有选中内容时，使用光标所在行的路径；可能为空 |
| `tab` | 窗格当前显示的标签页 |

若 id 不合法，会抛出 ``tern.files.button: bad id `<id>` (letters, digits, `_` and `-`)``；`title` 不是字符串或 `run` 不是函数时，会产生类型转换错误。再次注册同一个 `id` 会在原位置替换按钮。处理器出错时会像其他钩子一样显示提示。

按钮在标题栏 `.ft-tools` 中的 `.ft-plugins` 内渲染为 `<button class="icon-btn ft-hb ft-rv ft-plugin" data-plugin="<plugin>" data-id="<id>">`，因此可由 `tern.css` 设置样式。

```lua
tern.files.button({
	id = "butler",
	title = "Open in Butler",
	icon = "sparkle",
	run = function(files, cx)
		local target = files.selection[1] or files.root
		if target then
			cx:open(target, "beside")
		end
	end,
})
```

## `tern.css`

```lua
tern.css: (name: string, source: string) -> ()
```

将 `source` 安装为全局样式表 `plugin:local:<plugin>:<name>`，放在 Tern 自己的样式表之后；如果同名样式表已存在，则替换它。manifest 中的 `styles` 对应样式表 `plugin:local:<plugin>:styles`。

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| `name` | `string` | ASCII 字母、数字、`_` 和 `-`；不能是 `styles` |
| `source` | `string` | CSS |

若名称不合法，会抛出 ``tern.css: bad name `<name>` (letters, digits, `_` and `-`; not `styles`)``。CSS 解析错误不会抛出；错误会记录为 `plugin style sheet has errors`。重新加载会移除每个插件样式表并重新安装。（`tern.d.luau` 中的样式表名称是 `plugin:<plugin>:<name>`；运行时使用此处所示的 `local` 段。）Web 标签页不会运行 Window 端入口，因此 `tern.css` 样式表不会应用到其中；它会从插件目录安装其守护进程中 Ready 插件的清单 `styles`。

插件块的区域元素（`.sf-main`、`.sf-dock`、`.sf-layer`）带有 `data-surface="plugin.<plugin>.<id>"`；Lens 块带有 `.sf-block[data-role="lens.plugin.<plugin>.<id>"]`。参见[Chrome 与样式](../guides/chrome.md)。

```lua
tern.css("status", [[
#statusline .sl-plugin[data-plugin="k8s"] { color: var(--accent); }
]])
```

## `tern.on`

```lua
tern.on: (name: string, fn: (...any) -> ...any) -> ()
```

订阅窗口事件 `name`。除 `window_start` 只接收 `cx` 外，处理器会收到事件载荷和新的 `cx`。

| 事件 | 处理器 |
| --- | --- |
| `window_start` | `(cx)` |
| `focus` | `({pane, tab}, cx)` |
| `pane_created`、`pane_closed` | `({pane}, cx)` |
| `tab_created`、`tab_closed` | `({tab}, cx)` |
| `command_started` | `({pane, line}, cx)` |
| `command_finished` | `({pane, line, status, took_ms}, cx)` |
| `cwd` | `({pane, path}, cx)` |
| `title` | `({pane, title}, cx)` |
| `agent_state` | `({pane, old, new}, cx)`：由 `cx.agents:list()` 返回的 agent 状态（`working`、`waiting_input`、`idle`、`exited`）发生变化；对于自上次查看后新出现的 agent，`old` 为 `nil` |
| `agent_finished` | `({pane, result}, cx)`：agent 的一轮任务结束（`result` 是它报告的 `done` 或 `failed`），或者 agent 退出（`exited`；随其块关闭时为 `closed`） |
| `float_moved` | `({pane, tab, over, corner?, stashed?, docked?}, cx)`：用户放开拖动或甩出的浮动窗格后，它会吸附到 `over` 的 `corner` 角、从 `stashed` 边缘滑出，或停靠到 `over` 的 `docked` 侧 |
| `session_ended` | `({session, name, shown}, cx)`：会话结束（在此处或其他位置关闭、通过 `tern kill session` 关闭，或由退出码为 0 的 `--end-on-success` 块结束）；若它是当前显示的会话（`shown`），窗口已经切回之前显示的会话 |
| `budget` | `({hook, state, ms?, paused_ms?}, cx)`：此插件的某个钩子因超出预算而暂停（`state = "paused"`，预算 `ms`，暂停时间 `paused_ms`），或恢复运行（`state = "resumed"`） |
| `canvas_action` | `(ev: CanvasAction, cx) -> boolean?`，仅适用于由此插件拥有的 canvas |

未知的窗口事件会抛出 ``tern.on: unknown window event `<name>` ``。钩子名与事件名称相同。[事件](events.md#window-事件)介绍各事件的触发时机和顺序。

## `tern.secrets`

```lua
tern.secrets.get: (name: string) -> Awaitable<string?>
tern.secrets.set: (name: string, value: string?) -> Awaitable<nil>
```

将插件凭据（API 密钥、OAuth 令牌）保存在系统安全存储中，而非普通文件：macOS 使用登录钥匙串，Windows 使用 Credential Manager，Linux 使用 Secret Service；如果系统存储不可用，则回退到 Tern 状态目录中仅所有者可访问的文件。开发版只将凭据保存在这些文件中；无头会话（`tern shot`、`serve`、测试）则将其保存在内存中，每次启动时重置。

| 函数 | 行为 |
| --- | --- |
| `get(name)` | 以 `name` 下存储的机密信息（任意字节）为结果完成；不存在时结果为 `nil` |
| `set(name, value)` | 将 `value`（任意字节，最多 64 KiB）存储在 `name` 下，替换现有值，并以 `nil` 完成；`nil` 值会删除它 |

每项机密信息都存储在账户 `plugin.<plugin id>.<name>` 下，因此插件只能读写自己的机密信息。名称必须符合 `[a-z0-9][a-z0-9._-]{0,63}`。

系统可能会请求解锁钥匙串，导致存储操作阻塞；因此这两个调用会在 UI 线程之外运行并返回 awaitable：插件使用 `:next(function(value, err, cx) … end)`。名称无效、值超过 64 KiB（在访问存储前检查）或存储失败时，awaitable 会以 `tern.secrets.get: <reason>` 或 `tern.secrets.set: <reason>` 失败；除了参数不是字符串外，调用本身不会抛出错误。若用户关闭解锁提示，导致钥匙串仍处于锁定状态，`get` 会失败而不是返回 `nil`：机密信息确实存在，只是目前无法访问。

只有插件的 Window 端有 `tern.secrets`；Host 端和 Carly 自己的 Lua VM 都没有。Carly 只能通过插件导出项访问插件凭据。

```lua
tern.secrets.get("api.token"):next(function(token, err, cx)
	if err then
		cx:toast("error", "Keychain", err)
	elseif not token then
		cx:toast("info", "Sign in first")
	else
		tern.fetch("https://api.example.com/me", {
			headers = { Authorization = "Bearer " .. token },
		}, function(result, cx) … end)
	end
end)
```

## Window 上下文（cx）

Carly 使用与已加载 Window 端插件相同的窗口方法和能力：向任意指定窗格输入内容、显示提示和剪贴板操作、修改布局、创建/聚焦/显示/关闭窗格，以及运行所有命令或操作。聚焦和显示使用常规插件默认行为；关闭窗格使用原始会话操作，不会弹出 Carly 专属确认提示。参数校验、未知目标和底层操作失败仍然适用。

插件打开操作仍不会经过路由。Carly 打开文件时使用来源 `carly`；打开 URL 时会查询链接路由。

```lua
declare extern type WindowCx with
	session: SessionCx
	layout: LayoutCx
	canvas: CanvasCx
	docs: DocsCx
	board: BoardCx
	browser: BrowserCx
	db: DbCx
	settings: SettingsCx
	git: GitCx
	notebook: NotebookCx
	actions: ActionsCx
	agents: AgentsCx
	procs: ProcsCx
	screen: ScreenCx
	function run(self, pane: number, text: string): ()
	function open(self, target: string, how: How?, reveal: Reveal?): ()
	function new_block(self, kind: string, args: { string }?, how: How?, opts: BlockOpts?): number?
	function command(self, id: string): ()
	function action(self, name: string): ()
	function ask_carly(self, text: string): ()
	function pick(self, opts: PickOptions): Awaitable<PickItem?>
	function prompt(self, opts: PromptOptions?): Awaitable<string?>
	function toast(self, level: ToastLevel, text: string, sub: string?): ()
	function copy(self, text: string): ()
	function window_key(self): string
end

type ToastLevel = "success" | "info" | "error"
type BlockOpts = { focus: boolean?, target: number?, dir: Dir?, ratio: number? }
```

会执行操作的 Window 端处理器都会获得 `cx`：命令、绑定、覆盖、路由、`available` 检查、窗口事件，以及 Window 端的定时器、进程和网络请求回调。`cx` 仅在收到它的调用期间有效；之后使用已保存的 `cx` 会报错。定时器、进程和网络请求回调会获得新的 `cx`。当某个 `cx` 调用尚未结束时，通过它发起其他调用会报错 `cx is already in use`。

| 成员 | 行为 | 抛出错误 |
| --- | --- | --- |
| `cx.session` | [会话上下文（cx）](#会话上下文-cx) | |
| `cx.sessions` | 会话的列出/当前/创建/切换/重命名/关闭/锁定/解锁操作 | 会话未知或名称为空 |
| `cx.hosts` | 主机的列出/当前/添加/切换/信任/断开连接/打开终端操作 | 主机未知或已断开连接；指纹不匹配 |
| `cx.board` | [看板上下文（cx）](#看板上下文-cx)（桌面版） | 卡片或泳道未知/过期；元数据无效；磁盘错误 |
| `cx.browser` | [浏览器上下文（cx）](#浏览器上下文-cx) | |
| `cx.db` | [数据库上下文（cx）](#数据库上下文-cx)（桌面版） | |
| `cx.settings` | [设置上下文（cx）](#设置上下文-cx) | 键/类型/枚举未知或快捷键无效 |
| `cx.git` | [Git 上下文（cx）](#git-上下文-cx) | 桌面版 |
| `cx.notebook` | [笔记本上下文（cx）](#笔记本上下文-cx) | |
| `cx.actions` | [操作上下文（cx）](#操作上下文-cx) | |
| `cx.agents` | [Agent 上下文（cx）](#agent-上下文-cx) | |
| `cx.procs` | [进程上下文（cx）](#进程上下文-cx)，仅本地桌面版 | |
| `cx.layout` | [布局上下文（cx）](#布局上下文-cx) | |
| `cx.canvas` | [画布上下文（cx）](#画布上下文-cx) | |
| `cx.whiteboard` | [白板上下文（cx）](#白板上下文-cx)（桌面版） | |
| `cx.docs` | [文档上下文（cx）](#文档上下文-cx)（桌面版） | |
| `cx:run(pane, text)` | 向窗格中的程序输入 `text`；Shell 命令末尾加 `"\r"` 以执行 | ``no program runs in that pane`` |
| `cx:open(target, how?)` | 使用 Tern 自身的打开操作（不经过路由）。若指定 `how`，则将路径（绝对路径、`file://` 或相对于聚焦窗格目录的路径）放在指定位置的文件块中。不指定 `how` 或 `target` 不是路径时，会像在聚焦窗格中点击链接一样打开 `target`：文件在文件块中打开，文件夹在 Files 窗格中打开，网页链接在浏览器块或浏览器中打开，其他内容通过系统打开 | ``unknown how `<how>` `` |
| `cx:new_block(kind, args?, how?, opts?)` | 在窗口当前主机上，以 `args` 为参数打开 `kind`（`"<plugin>.<id>"`）对应的插件块，按 `how` 放置（默认 `default`），然后聚焦它（`opts.focus = false` 可保留当前显示的焦点）。`opts.target`、`opts.dir` 和 `opts.ratio` 可用于[指定位置和大小](#按已保存尺寸打开)，方式与 `cx.canvas:open` 相同。返回窗格 ID；若该主机上没有 Ready 插件定义此 `kind`，则返回 `nil`（不会显示提示，由调用方决定如何处理） | ``unknown how `<how>` ``；`target`、`dir` 或 `ratio` 无效 |
| `cx:command(id)` | 运行内置命令 `id`；不会运行覆盖 | ``unknown command `<id>` `` |
| `cx:action(name)` | 运行任意按键映射操作，包括 `plugin.<id>.<command>`；Carly 也拥有常规 Window 端插件能力 | 未知操作或插件处理器 |
| `cx:ask_carly(text)` | 从任意 Window 端插件上下文（包括回调、导出项和 Carly 自身）打开 Carly，并提出一个会显示给用户的问题 | 问题为空 |
| `cx:pick(opts)` | 在聚焦窗格上方打开选择器，[请用户](#向用户提问)从 `opts.items` 中选择一项；选中项作为结果，关闭时为 `nil` | `cx:pick: items is missing`、`cx:pick: items is empty`、`cx:pick: item <n> is not a table`、`cx:pick: item <n> has no label` |
| `cx:prompt(opts?)` | 在聚焦窗格上方打开输入框，[请用户](#向用户提问)输入一行文本；返回文本，关闭时为 `nil` | |
| `cx:toast(level, text, sub?)` | 在此窗口显示提示；`sub` 为第二行 | ``unknown toast level `<level>` (success, info or error)`` |
| `cx:copy(text)` | 将 `text` 放入剪贴板 | |
| `cx:window_key()` | 当前窗口的窗口键：`tern … --window KEY` 使用的值，也是 `tern inspect` 中每个客户端 `conn` 旁列出的值（第一个窗口为 `""`，其他窗口为 `"2"`、`"3"` 等）。从 window 上下文调用 `tern.process.run` 启动的进程会通过 `TERN_WINDOW_KEY` 获得该值，因此它运行的 `tern …` 命令无需 `--window` 也能连接到当前窗口 | |

`how` 的值包括：`default`、`beside`、`split`（与 `beside` 相同）、`below`、`tab`、`replace`（替换当前聚焦块；没有聚焦块时使用 `default`）、`over`（见下文）和 `preview`。`replace` 和 `preview` 用于放置文件：`cx:new_block` 在除 `below`、`tab` 和 `over` 以外的所有情况下，都会将插件块放在聚焦块旁边；只有 `over` 会占据另一个块的位置。

`over` 会在聚焦窗格的位置打开任意类型的新块（如果 `cx:new_block` 的 `opts` 或 `cx.canvas:open` 的规格指定了 `target`，则使用该目标窗格的位置），效果相当于在该窗格中运行程序。原窗格会从视野中消失，停放在其会话的卡组中，但程序仍在运行。新块关闭时（通过 `cx:exit`、⌘W 或程序退出），窗格会以原 ID 返回同一位置并获得焦点。如果没有聚焦内容，`over` 等同于 `default`；如果聚焦在浮动窗格上，则新块会打开在它所浮动于其上的窗格旁边。若窗格在此期间已从卡组取出，则会留在取出后的位置，新块只会关闭；如果新块之后被停放或浮动，也一样。只有打开新块的窗口会放回窗格：该窗口重启后，或新块在会话的其他窗口中关闭时，窗格会留在卡组中。

布局和会话变化会同步到该会话的其他窗口；焦点仍由当前窗口独立管理。

### 向用户提问

`cx:pick` 和 `cx:prompt` 会在 Tern 自己的选择器中向当前窗口的用户提问，选择器绘制在聚焦窗格上方，但不会压暗窗口其他部分（若没有显示窗格，则在整扇压暗的窗口中央显示）。它们会立即返回一个 [awaitable](api-shared.md#awaitable-与-tern-sleep)；答案会在 `:next(function(answer, err, cx) … end)` 中送达，并附带新的 `cx`；Carly 的 Lua 则可通过 `await` 获取答案。

```lua
type PickItem = {
	label: string, detail: string?, group: string?, icon: string?, current: boolean?,
	[string]: any,
}
type PickOptions = { items: { PickItem }, placeholder: string?, icon: string?, action: string? }
type PromptOptions = { value: string?, placeholder: string?, icon: string?, action: string? }
```

| 选项 | 含义 |
| --- | --- |
| `items` | 仅供 `cx:pick` 使用，必填：按此顺序排列的行。输入内容会按 `label` 过滤；最多显示前 200 个匹配项 |
| `value` | 仅供 `cx:prompt` 使用：输入框的初始文本，会被选中，以便输入时替换 |
| `placeholder` | 输入框为空时显示的提示，同时也是选择器的无障碍名称 |
| `icon` | 输入框的 Tern 图标；未知或未设置时显示 `puzzle` |
| `action` | ↵ 执行的操作，会显示在快捷键图例中；未指定时，选择器默认为 `select`，输入框默认为 `confirm` |

| 项目字段 | 含义 |
| --- | --- |
| `label` | 行中显示的文本 |
| `detail` | 标签后显示的暗色文本 |
| `group` | 一组连续相同 `group` 值的项目上方显示的标题 |
| `icon` | 该行的 Tern 图标（默认使用输入框图标） |
| `current` | 显示勾号，标记当前选项 |

↑/↓ 移动，↵ 确认答案，Esc 或点击选择器之外的区域会关闭它。
`cx:pick` 返回选中的项目，即传入的原始表格；该表格中携带的其他字段（例如路径、ID）也会随之返回。
`cx:prompt` 返回用户输入的文本，可能为空。用户关闭选择器，或它被另一个选择器、命令面板或其他插件的问题取代时，两者都会返回 `nil`：同一时间只显示一个问题。awaitable 不会失败。

```lua
local function quote(s: string): string
	return "'" .. s:gsub("'", "'\\''") .. "'"
end

tern.command({
	id = "branch",
	title = "New branch…",
	icon = "branch",
	run = function(cx)
		local pane = cx.session:focused()
		cx:prompt({ placeholder = "Branch name", icon = "branch", action = "create branch" })
			:next(function(name, _err, cx)
				if name and name ~= "" and pane and cx then
					cx:run(pane, "git switch -c " .. quote(name) .. "\r")
				end
			end)
	end,
})

tern.command({
	id = "deploy",
	title = "Deploy to…",
	run = function(cx)
		cx:pick({
			placeholder = "Deploy to…",
			action = "deploy",
			items = {
				{ label = "staging", detail = "eu-west-1", group = "Pre-production", url = "https://staging.example.com" },
				{ label = "production", detail = "eu-west-1", group = "Live", url = "https://example.com" },
			},
		}):next(function(target, _err, cx)
			if target and cx then
				cx:toast("info", "Deploying to " .. target.label, target.url)
			end
		end)
	end,
})
```

### 文档上下文（cx）

桌面版 `cx.docs` 操作的是文档本身，而非编辑器小组件。`open(path, {how?, line?})` 会返回一个窗格；`new_note(title, markdown)` 会通过 Tern 的预置笔记创建流程，创建属于会话的笔记，内容为 `# title` 加上 Markdown 正文。

其他所有方法都会返回 awaitable，在 Carly 中通过 `await` 使用，在插件中通过 `:next` 使用：

| 方法 | 结果 |
| --- | --- |
| `read(path, {from?, lines?})` | 精确文本，包括尚未保存的缓冲区编辑；默认读取整个文档 |
| `outline(path)` | 解析出的 Markdown 标题 `{title, level, line}`（不包括代码围栏中的标题） |
| `search(path, query)` | 区分大小写的字面匹配 `{line, column, text}` |
| `write(path, text)` | 整体替换；父目录存在时会创建缺失文件 |
| `edit(path, {find, replace, all?})` | 替换第一个匹配项，或替换所有不重叠的匹配项 |
| `edit(path, {line, insert})` | 在从 1 开始计数的指定行前插入精确文本；EOF 时可以指定下一行 |
| `edit(path, {heading, append})` | 在指定章节末尾（包括其子章节之后）追加文本 |
| `append(path, text)` | 在文件末尾追加精确文本 |
| `save(path)` | 确认缓冲区保存后返回 true；已关闭且存在的文件不需要保存 |

编辑操作返回 `{from, to}`，表示从 1 开始计数的变更行范围（含首尾）。标题文本是渲染后的纯文本；标题不存在或重复时会失败且不执行编辑。找不到 `find` 字符串时也会失败。行号和 Unicode 字符列号从 1 开始。相对路径根据聚焦窗格目录解析。

已打开的文档使用共享缓冲区、撤销记录、脏状态和自动保存。已关闭的文件使用同目录原子写入，并保留编码和权限。若编辑所基于的缓冲区期间发生变化，则会安全失败；请基于新文本重试。操作在 30 秒后超时。

```lua
local pane = cx.docs:open("/tmp/plan.md", {how = "beside"})
await(cx.docs:edit("/tmp/plan.md", {heading = "Next", append = "- Ship\n"}))
return await(cx.docs:outline("/tmp/plan.md"))
```

### 画布上下文（cx）

Canvas 是原生块类型 `tern.canvas`：由 Window 端 Lua 提供的持久化、可复制内容，不需要 Host 端入口。包 ID `tern` 为保留值。它的 surface 角色是 `plugin.tern.canvas`。Canvas 显示 UI 节点，不包含图形：白板（画布块，类型为 `canvas`）属于 [`cx.whiteboard`](#白板上下文-cx)，对其调用 `set` 会报错并说明原因。

```lua
declare extern type CanvasCx with
	function open(self, spec: CanvasSpec): (number?, string?)
	function set(self, pane: number, change: CanvasChange): ()
	function get(self, pane: number): CanvasInfo?
	function list(self): { CanvasInfo }
end

type CanvasSpec = {
	title: string, about: string?, view: Node?, md: string?, dock: Node?,
	how: How?, focus: boolean?, target: number?, dir: Dir?, ratio: number?,
}
type CanvasChange = {
	title: string?, about: string?, view: Node?, md: string?, dock: Node?,
	set: { [string]: Node | false }?,
}
type CanvasInfo = {
	pane: number, owner: string, title: string, about: string,
	view: Node?, dock: Node?,
}
type CanvasAction = {
	pane: number, owner: string, act: string, node: string,
	value: string?, mods: { string }?,
	text: string?, title: string?, about: string?,
}
```

`open` 接受使用 `tern.ui` 构建的 `view` 树，或 Markdown `md`，但不能两者兼用。默认位置为 `"beside"`；对于插件和 Carly，会聚焦新窗格。`target`、`dir` 和 `ratio` 可用于[按已保存尺寸打开](#按已保存尺寸打开)。不支持 canvas 的主机会返回 `nil, err`。视图根节点会被绘制；`dock` 固定在底部。视图根键 `__canvas` 为隐藏元数据保留，使用时会同步报错。其他键（包括根键 `"0"`）都会保留。`get` 读取此窗口的副本；如果不是 canvas，或状态尚未到达，则返回 `nil`。`list` 不返回 `view`/`dock` 树。

`set` 会替换提供的字段。其 `set` 映射会修补 view 根节点下的路径：有键子节点使用各自的键；无键子节点使用从零开始的索引（例如 `"jobs.build"` 或 `"0"`）。`false` 会移除节点。在现有父节点下新增键会追加；未知父节点会报错。插件更新必须指定自身 ID；Carly 可以更新任意 canvas。创建者的插件 ID 或 `"carly"` 会一直保存在其中。任何调用方都能读取 canvas。

每个编码变更最多 256 KiB，最多 2000 个节点，深度最多 32，标题最多 80 个字符，`about` 最多 2000 个字符。无效树和路径会在发送前报错，未声明的字段（包括 `owner`）以及没有任何字段的 `set` 也会报错。输入/编辑器节点会被拒绝（canvas 不接收按键），图片也会被拒绝（没有 blob 传输）。状态会在守护进程重启后保留；重新加载插件不会重置其 canvas。

只有在点击窗口中，`action` 事件才会发送给所有者。插件应注册 `tern.on("canvas_action", function(ev, cx) ... end)`。第一个真值返回会消费此次点击；没有处理器或所有处理器都返回假值时，会提示 `Nothing handles “<act>” here`。开关和选择状态为本地状态。`cx.session:event(pane, {ev = "action", id = node, act = name})` 会在调用处理器返回后发送相同操作，不需要指针操作，例如可从测试命令调用。

Carly 在其对话 VM 中通过 `tern.carly.on_canvas(fn)` 注册处理器，收到相同的事件载荷、新的常规能力上下文，并使用 50 ms 预算。在处理器内部应使用异步 `:next` 后续回调，而不是仅限根调用使用的 `await`。对话重置时会移除处理器。未处理的点击会成为显示给用户的一轮 agent 任务，其中引用操作、节点文本、标题和持久化的 `about`，以 JSON 数据形式描述按钮用途。回复使用常规标签条和卡片行为；卡片关闭时会显示提示。iOS 上没有 Carly 回退；Web 没有 Window 端 Lua。

```lua
tern.on("canvas_action", function(ev, cx)
	if ev.act ~= "refresh" then return false end
	cx.canvas:set(ev.pane, { md = "Refreshed" })
	return true
end)
```

[SDK](../index.md#the-sdk) 中完整的 window 专属 Canvas Dashboard 包含一个命令面板命令，可在重新加载后找到已有的所属 canvas，并提供键控状态更新处理器。运行以下命令安装：

```sh
tern plugin install github.com/stencil-hq/tern-sdk/plugins/examples/canvas
```

在无头环境中查看时，`carly last` 会显示最后一次工具结果或排队中的 canvas Action 提示；`carly last "<contains>"` 还会断言答案包含给定文本。相同文本位于 `state.carly.last_tool.text`。

#### 按已保存尺寸打开

`target`、`dir` 和 `ratio`（位于 `CanvasSpec` 或 `cx:new_block` 的 `opts` 中）可在同一次调用中放置新块并设置大小，因此它的第一帧就具有最终宽度：不会先以默认的一半宽度显示一帧，再调整大小。

- `target` 是要分割的窗格（默认是聚焦窗格），`dir` 是新块所在方向：`right`（默认）、`down`、`left` 或 `up`。其中任意一项都会将放置方式指定为分割该窗格，因此 `how` 只能为 `default`、`beside` 或 `split`；`how` 为 `tab` 或 `below` 时会报错，`target` 不属于任何标签页时也会报错。
- `ratio` 是新块在其所在分割区域中的占比，必须大于 0 且小于 1；拖动分隔线时会确保它不小于窗格最小尺寸。未指定 `target` 或 `dir` 时，它会调整 `how` 所建立分割区域的大小；如果块单独在一个标签页中打开，则忽略该值。

若要按用户上次保留的宽度重新打开侧栏，请在关闭前从 `cx.session:layout(tab)` 读取其占比：`TabTree` 分割节点的 `ratio` 是第一个子节点的占比，因此左侧侧栏的占比就是其分割的 `ratio`，右侧侧栏则为 `1 - ratio`。相邻窗格仍会通过常规分割动画让位；`reduce_motion` 会关闭此动画。

```lua
local pane, err = cx.canvas:open({
	title = "Outline", md = outline, focus = false,
	target = terminal, dir = "left", ratio = saved_share or 0.25,
})
```

### 白板上下文（cx）

白板是 canvas 块（kind `canvas`）：它们提供无限画布，包含用户也可以绘制的形状、箭头、文本和笔迹。`cx.whiteboard` 可像 Carly 的 `canvas_read` 和 `canvas_edit` 工具一样读取和编辑白板；单位为页面单位（100% 时一个视图像素），形状以 16 位十六进制 ID 命名。仅桌面版支持。

```lua
declare extern type WhiteboardCx with
	function open(self, opts: { how: How?, focus: boolean? }?): Awaitable<number>
	function read(self, pane: (number | string)?, query: WhiteboardQuery?): WhiteboardState
	function edit(self, pane: (number | string)?, edits: { WhiteboardEdit }): WhiteboardResult
end
```

`open` 会放置空白白板（`how` 默认为 `"beside"`），并在白板可读写时以其窗格 ID 为结果完成；如果该块始终没有出现，则在 10 秒后失败。`pane` 为 nil 时，使用当前聚焦的白板，若没有聚焦白板则使用唯一打开的白板；指定 `cx.canvas` 面板或其他块类型会报错。

`read` 会从后到前列出形状，每个分组均位于其内部内容之前；每项包括 `id`、`type`、其框架的页面边界框（`x`、`y`、`w`、`h`）、文本和样式（省略默认值），以及 `view`：用户当前可见的页面区域和 `zoom`。可用 `ids`（包含内部内容）、`area`（`{x, y, w, h}`）和 `max_shapes`（默认 200，最多 2000）筛选。

`edit` 会依次应用所提供编辑，作为单个可撤销步骤供用户撤销。每项编辑包含 `op` 和该操作对应的字段；提供其他字段会指出对应编辑并报错，所有修改都不会应用。`add` 会在 canvas 当前样式下添加 `type`（`rect`、`ellipse`、`diamond`、`triangle`、`hexagon`、`parallelogram`、`star`、`cylinder`、`pill`、`bracket`、`brace`、`text`、`arrow`、`line`、`polygon`、`curve`、`ink`、`highlight`、`image`）形状，供后续同一调用中的编辑通过 `ref` 引用。`bracket`（`[`）或 `brace`（`{`）会向右打开，不接受文本或箭头；可以通过 `rotate` 和 `flip` 转向。其他操作包括 `move`、`resize`、`rotate`、`text`、`style`、`delete`、`lock`、`unlock`、`group`、`ungroup`、`duplicate`、`order`、`align`、`distribute`、`layout`、`flip`、`look`、`paper` 和 `show`；Carly VM 中的 `help('WhiteboardEdit')` 会列出相应字段。

`layout` 可无需计算就放置形状：通过 `ids`（每个形状单独处理）或 `groups`（每组 ID 作为整体移动）指定项目，彼此间隔 `gap`（默认 40），从左上角 `x`、`y` 开始（默认采用其当前位置）。`axis` 会沿其方向排列成行或列，并在垂直于该轴的方向上按 `edge` 对齐（默认居中）；`cols` 会逐行填充网格，并将每个形状居中放入单元格。使用 `distribute` 和 `gap` 会沿轴保持第一个形状的位置，并让其他形状间距恰好为 `gap`。结果包含引用、受影响的形状、移除的形状和 `notes`；`notes` 会标记所连接的两个形状相接的箭头（箭头显示会很短，或完全不显示）。

```lua
local pane = await(cx.whiteboard:open())
local edits = {}
local function box(name)
	table.insert(edits, {op = 'add', type = 'rect', x = 0, y = 0, w = 160, h = 60, text = name, ref = name})
end
local services = {'Auth', 'Orders', 'Search'}
box('CDN')
for _, name in services do box(name) end
-- The services in a row, then the CDN centered 100 above it.
table.insert(edits, {op = 'layout', ids = services, axis = 'horizontal', gap = 60})
table.insert(edits, {op = 'layout', groups = {{'CDN'}, services}, axis = 'vertical', gap = 100})
for _, name in services do
	table.insert(edits, {op = 'add', type = 'arrow', from_shape = 'CDN', to_shape = name})
end
cx.whiteboard:edit(pane, edits)
return cx.whiteboard:read(pane).view
```

### 会话上下文（cx）

```lua
declare extern type SessionCx with
	function sessions(self): { SessionInfo }
	function layout(self, tab: number): TabLayout?
	function find_tab(self, spec: string, session: number?): number?
	function find_session(self, spec: string): number?
	function tab_of(self, pane: number): number?
	function pane(self, pane: number | string): PaneInfo?
	function read(self, pane: number | string, opts: ReadOpts?): (BlockRead | string)?
	function selection(self, pane: (number | string)?, opts: { max_chars: number? }?): BlockSelection?
	function surface(self, pane: number | string, opts: SurfaceOpts?): (SurfaceTree | string)?
	function view(self, pane: number | string, opts: SurfaceOpts?): (ViewNode | string)?
	function event(self, pane: number | string, ev: { [string]: any }): ()
	function panes(self): { PaneInfo }
	function tabs(self): { TabInfo }
	function focused(self): number?
	function resolve(self, spec: string): number?
	function block_types(self): { BlockTypeInfo }
end
```

| 方法 | 返回值 |
| --- | --- |
| `panes()` | 窗口的所有窗格，包括标签页内和已停放的窗格，类型为 [`PaneInfo`](#tern-chrome-status)（此处的 `cwd` 总是字符串） |
| `tabs()` | 窗口所有 session 中的全部标签页，类型为 [`TabInfo`](#tern-chrome-tab-title) |
| `focused()` | 当前聚焦窗格的 ID；没有时为 `nil` |
| `resolve(spec)` | `spec` 所指的 pane；无法解析时为 `nil`。匹配顺序：`"@focused"`、pane ID、完全匹配的标题、不区分大小写匹配的标题、程序名称；包含已停放窗格。匹配多个时，优先返回活动标签页中的窗格，然后是其他标签页中的窗格，最后是已停放窗格 |
| `block_types()` | 当前 host 上可打开的块类型，返回 `{kind, title, icon, palette}`：先是原生 canvas，然后是该处所有 Ready 插件的块（`kind` 为 `"<plugin>.<block>"`；`palette` 表示命令面板是否提供该块） |

```lua
local pane = cx.session:resolve("nvim")
if pane then
	cx.layout:focus(pane)
end
```

#### 会话与分屏树

`sessions()` 会返回每个会话的 `{id, name, current, locked, tabs}`。`find_session` 依次按 ID、完全匹配的名称、不区分大小写匹配的名称查找。`find_tab` 会在指定会话（默认当前会话）中按从 1 开始的位置或标题关键词查找；`tab_of` 会包含浮动块。未找到匹配项时返回 `nil`。`TabInfo` 还包含 `session`、`color`、从 1 开始的 `position` 和聚焦的 `pane`；这四项都会参与窗口装饰栏缓存的失效判定。

`layout(tab)` 会返回 `{tab, root, floats, zoomed, focus}` 或 `nil`。`TabTree` 叶节点为 `{pane}`；分割节点为 `{split = "right"|"down", ratio, [1] = left_or_top, [2] = right_or_bottom}`。每个浮动窗格为 `{pane, over, corner = "tl"|"tr"|"bl"|"br"}`。这些是分屏树，不是 `surface` 返回的 TSP 树。

#### 窗格读取与树结构

`pane` 和 `panes` 包含仅 Window 端提供的 `kind`/`tab`/`focused`/`floating`/`parked`/`busy`/`at_prompt`、当前 `running = {line, ms}`、`last = {line, status, took_ms}`、`exited`/`error`/`alert`、浏览器 URL、原生路径和插件块类型。Host 端的 `tern.pane.list` 保持不变。检查结果只会为 `kind = "terminal" | "agent"` 提供 `program`、`busy`、`at_prompt`、`running`、`last` 和 `exited`；其他类型（包括原生块和插件块）均不包含这些字段。`tern.chrome.status` 保留原有 `StatusPaneInfo` 载荷，其中所有类型都带有底层 `program` 和 `busy`。

`read` 会根据每个块的实际模型返回 `{kind, info, ...}`：终端行（包括 TSP surface）、插件文本、浏览器 URL/标题/加载状态/历史记录、文件文本和未保存的编辑、Git 状态/提交、SQLite 数据库结构/行/SQL、笔记本单元格/输出、看板泳道/卡片、进程、性能分析函数或屏幕信息。它不会运行浏览器 JavaScript，也不会改变焦点。状态未加载时会如实报告。

`ReadOpts` 接受 `as = "table" | "text"`（默认 table）、`lines`（默认 60，最多 2000）、`rows`（默认 25，最多 500）、`max_chars`（默认 8000，最多 64000）、终端 `scrollback`（true），以及从 1 开始的文件 `from`（默认跟随视图）。

| `kind` | 除 `kind` 和 `info` 之外的表格字段 |
| --- | --- |
| `terminal`、`agent` | `lines`、`more`、`surface` |
| `plugin` | `title`、`text`（主区域、底部停靠区和浮层） |
| `browser` | `url`、`title`、`loading`、`progress`、`error`、`back`、`forward`、`driven` |
| `file` | `path`、`host`、`file_kind`、`mode`、`dirty`、`load`、`first`、`total`、`lines`、`caret`、`selection`；媒体/十六进制数据：`size`、`image`、`hex` |
| `git` | `root`、`ready`、`provisional`、`head`、`upstream`、`operation`、`staged`、`unstaged`、`conflicts`、`selection`、`open`、`commits`、`stashes`、`running` |
| `database` | `path`、`memory`、`phase`、`read_only`、`dirty`、`area`、`schema`、`browse`、`execute`；缓存的查询行保留 SQL NULL，并标记尚未加载的行 |
| `notebook` | `path`、`phase`、`kernel`、`dirty`、`active`、`cells`，其中包含源代码、输出、标签、索引、类型、执行计数和状态 |
| `board` | `path`、`phase`、`view`、`filter`、`hide_done`、`lanes`，其中包含标题、完成/折叠状态以及含有文本、完成状态、标签、截止日期、子任务和光标的卡片 |
| `canvas` | `canvas`、`phase`、`shapes`、`selected`、`tool`、`look`、`paper`；失败时还包括 `error` |
| `procs` | `sampled`、`totals`、`sort`、`descending`、`tree`、`filter`、`rows`、`selected` |
| `profile` | `process`、`pid`、`take`（主机的会话守护进程负责采样时，录制带有 `hosted = true`）、`show`、`samples`、包含名称/自身/总计样本数的 `functions`、`focus`、`thread`、`query` |
| `screen` | `host`、`display`、`phase`、`failure`、`control`、`frame = {w, h}`；像素不是文本 |

超出上限的行列表会带有 `more`（或 `<list>_more`）；支持时，`first`/`total` 会描述选取的数据范围。`as = "text"` 会在省略标记中写明上限。当前版本不支持的类型字段不会返回。SQL NULL 单元格和未缓存的整行占位符是 `tern.json.null`；已加载行始终为表，即使所有单元格都是 NULL。空数组仍带有数组标签。

`selection(pane?, {max_chars?})` 会返回用户在块中选取的文本，格式为 `{pane, kind, text, chars_clipped?}`；没有选中内容时返回 `nil`。返回内容与复制操作一致：终端选择的单元格；或者从块内部开始的窗口选区（例如 omp 聊天记录、Carly 或块 UI 等 TSP surface），并保留 Markdown 列表标记和段落分隔。`kind` 是块的 `read` 类型。未指定 `pane` 时，先检查聚焦窗格，再取第一个持有选区的其他窗格。`max_chars` 默认 8000，最大 64000；若文本被截断，则 `chars_clipped = true`。文件块会改为通过 `read` 范围报告其选区。该方法不会聚焦或滚动任何内容。

```lua
local sel = cx.session:selection()
if sel then
	return ("%s %d:\n> %s"):format(sel.kind, sel.pane, (sel.text:gsub("\n", "\n> ")))
end
```

`surface` 返回 `{surface = {id, title?, role?, mode}, main?, dock?, layer?, more?}`。它会选择当前活动的 surface，否则选择最新保留的行内 surface。整体省略的区域会计入顶层 `more` 数量。
节点使用 TSP 传输格式 `{id, k, p?, c?, more?}`；`more` 统计省略的后代节点数。
`SurfaceOpts` 接受 `as`、`root`（节点 ID）、`nodes`（默认 500，最多 5000）、`depth`（默认全部，最多 64）和 `max_chars`。`view` 使用相同上限，并返回 Tern 无障碍子树 `{role, name?, value?, states?, children?, more?}`，不包含 ID 或边界。隐藏或尚未挂载的块返回 `nil`。
`event` 可供插件和 Carly 向窗格中的程序发送 TSP 事件。Canvas 没有程序：只能在其上发送 `action` 事件（其他事件都会报错），并且会在调用处理器返回后将其作为对节点 `id` 的点击传送（[画布上下文（cx）](#画布上下文-cx)）。

```lua
return cx.session:read("@focused", {as = "text", rows = 10})
```

### 屏幕上下文（cx）

`cx.screen:displays()` 返回一个 awaitable，其结果为本地显示器列表，各项包括 `id`、`name`、`width`、`height`、`scale` 和 `primary`。使用 `cx.screen:share(id, {how = "view"})` 共享显示器；`"control"` 会转发键盘/指针输入，nil 或 `"main"` 会选择主显示器。返回的窗格 ID 可传给 `status(pane)`（阶段、主机、显示器、控制状态、画面尺寸、失败信息）和 `stop(pane)`（停止共享）。这两个方法也接受会话窗格解析规则所支持的目标描述。

### 进程上下文（cx）

`cx.procs` 始终访问本地桌面机器，而非当前聚焦的远程主机。`list(options?)`、`find(name_or_pid)` 和 `children(pid)` 会通过 Carly 的 `processes`/`inspect processes` 共用的后台采样器返回 awaitable。Carly 使用 `await(...)`；插件使用 `:next(function(result, err, cx) ... end)`。

`list` 返回 `{local, sample, total, more, processes}`。选项包括 `sort`（`name`、`pid`、`user`、`cpu`、`memory`、`gpu`、`threads`、`disk`）、`descending`、`name`、`user`、`cwd`、`limit`（默认 100，范围 1–5000）和 `tree`（默认 false）。文本过滤器以 AND 组合，并匹配不区分大小写的子串。名称、PID 和用户默认升序；用量列按降序排列。树形输出是先序列表，包含 `depth` 和 `context`（为提供上下文而保留的不匹配祖先）。详细信息包括命令、可执行文件、父进程、工作目录、用户、状态和用量；工作目录和其他未知操作系统详情为 nil。`find` 返回名称匹配中最繁忙的进程或确切 PID；不存在时为 nil。`children` 返回直接子进程，最多 5000 项。不会返回端口，也不支持端口过滤：采样器不会收集套接字；将套接字映射到所属进程需要额外扫描整台机器。

`signal(pid, signal)` 接受 `terminate`、`kill`、`interrupt`、`hangup`、`stop` 和 `continue`；成功时返回 `{pid, signal, signaled=true}`。它会直接向单个正数本地 PID 发送信号；错误会抛出通用机器可读 `{kind, message, pid, signal}` 封装。

`open()` 会在当前窗格旁边打开并聚焦 Processes 块，然后返回窗格 ID；当前无窗格时会打开新标签页。`profile(pid, {seconds=20})` 会打开性能分析块，并返回一个 awaitable，在采样和符号解析完成后以 `{pane, pid, process, samples, functions, ...}` 为结果完成。采样时长为 1–3600 秒。前 25 个函数包含 `name`、`self` 和 `total` 样本计数；操作系统分析器失败时 awaitable 会拒绝。若性能分析块关闭，awaitable 也会拒绝。

```lua
local rows = await(cx.procs:list({name = "rust", sort = "memory", tree = true}))
local p = await(cx.procs:find("rustc"))
if p then
	local report = await(cx.procs:profile(p.pid, {seconds = 2}))
	print(report.pane, report.functions)
end
```

## 操作上下文（cx）

`cx.actions:list(query?)` 会返回内置及插件命令面板操作，包含 `id`、`label`、`group`、`keys`（以字符串写出的有效快捷键）、`available` 和可选的 `plugin` ID。即使命令不可用，仍然可以查到。查询关键词会匹配 ID、标签和分组。`describe(id)` 会按完全匹配返回一项，否则报错。`keys()` 会将有效快捷键映射到操作 ID 数组，并保留焦点解析优先顺序。

`cx.actions:run(id_or_exact_label)` 会返回与 Carly 的 `actions` 工具相同的成功消息；未知或有歧义的标签会报错。`cx:action(name)` 是同一分发机制的快捷入口。关闭操作无需交互，与 Carly 的工具行为一致。

### 笔记本上下文（cx）

`cx.notebook` 使用笔记本块中加载的同一批单元格、撤销历史记录和 Python 内核。笔记本 ID 是窗格 ID。单元格 ID 是 `cells` 中稳定的数字键，并非行索引；重新加载笔记本后会替换这些键。

| 方法 | 结果 |
| --- | --- |
| `open(path)` | 在聚焦窗格旁打开笔记本，并返回其窗格 ID |
| `cells(nb)` | 文档顺序中的全部单元格，包括完整源代码和输出 |
| `run(nb, {cell = id})` 或 `run(nb, {all = true})` | `Awaitable<{NotebookCell}>`，按运行顺序返回输出快照 |
| `add(nb, {kind, source, after?})` | 新单元格 ID；可撤销；默认追加，`after = 0` 表示插入开头 |
| `edit(nb, cell, source)` | 可撤销地替换源代码，保留输出 |
| `kernel_status(nb)` | `NotebookKernel`，当前解释器和执行/输入/失败详情 |
| `kernel_restart(nb)` | `Awaitable<NotebookKernel>`，无需确认便重启，新内核进入空闲状态后完成 |

单元格类型为 `"code"`、`"markdown"` 和 `"raw"`。每个 `NotebookCell` 包含 `id`、`nbformat_id`、`kind`、`source`、`count`、`state`（`idle`、`queued`、`running`）和 `outputs`。输出保留流文本、以 MIME 为键的 `data` 和 `metadata`、执行结果 `count`、显示 ID 和完整错误回溯。Python 异常属于普通错误输出，不会导致 await 失败。可空返回值使用 `tern.json.null`。

内核状态包括 `status`（`not_started`、`starting`、`idle`、`busy`、`dead`）、`label`、`python`、`version`、`implementation`、`env`、`pid`、`waiting`、`running`、`input = {prompt, password}` 和 `dead`（失败消息）。执行和解释器启动会在 UI 线程之外运行。await 不设置执行超时；交互式输入使用笔记本 UI。已在排队或运行的目标单元格不能通过此 API 运行或替换。内核丢失、笔记本关闭，或正在等待的单元格被替换/移除时，await 会失败；重置 Lua VM 会取消 await，但不会停止用户的内核。

```lua
local nb = cx.notebook:open("/tmp/analysis.ipynb")
local id = cx.notebook:add(nb, {kind = "code", source = "print(6 * 7)"})
cx.notebook:run(nb, {cell = id}):next(function(cells, err, cx)
	if err then error(err) end
	cx:toast("success", cells[1].outputs[1].text)
end)
```

Carly 使用 `await(cx.notebook:run(nb, {all = true}))`，而非 `:next`。
对仍在加载或已失败的笔记本执行操作时，会抛出实际的加载/文件错误。

### Agent 上下文（cx）

`cx.agents:list()` 会返回所有会话中的 agent：agent 块，以及在提示符中运行 omp 的 Shell（其 `command` 为 `tern.json.null`）；这两者的 `kind` 均为 `"agent"`：`{pane, command, model, cwd, state, last_message}`。未知元数据为 `tern.json.null`。目标可以是窗格 ID，也可以是 `"@focused"` 或 agent 标题等解析目标描述。

- `start({prompt, cwd, command?, how?}) -> pane`：像 New agent block 一样打开块；未指定命令和放置方式时使用设置。`how` 可以是 `"split"`、`"tab"` 或 `"replace_if_alone"`。即使发起启动的 VM 已重置，窗口仍会在输入就绪后提交一次提示。
- `ask(agent, text)`：粘贴一条提示并按 Enter；要求输入已就绪。
- 桌面版 `wait(agent, {timeout?}) -> Awaitable<string?>`：等待至空闲并返回最近一条助手文本。超时单位为毫秒（默认 30000）。agent 消失、退出或超时会导致拒绝。已排队/提交的输入不会被误判为空闲。
- `transcript(agent, {last?})`：返回按时间顺序排列的 `{role, text, tools}`，内容来自 omp TSP 聊天记录。角色为 `"user"`/`"assistant"`；不包含思考/装饰栏内容，但保留工具调用元数据/输出。默认 `last=50`，最多 1000；0 表示空。非 omp agent 没有结构化聊天记录。
- `interrupt(agent)`：发送 Ctrl-C，但保留块。
- `stop(agent)`：关闭块并结束其程序，不需要确认。

工作/空闲状态来自进度 OSC 9;4；暂停进度或显示询问覆层时为 `waiting_input`。插件在等待时使用 `:next(function(message, err, cx) ... end)`；Carly 使用 `await(...)`：

```lua
local pane = cx.agents:start({prompt = "Explain the failing tests", cwd = "/work/app"})
local answer = await(cx.agents:wait(pane, {timeout = 120000}))
return {answer = answer, messages = cx.agents:transcript(pane, {last = 4})}
```

### Git 上下文（cx）

`cx.git` 通过与 Git 块相同的已配置引擎操作本地仓库。目标可以是 `repo` 返回的描述符、路径、本地窗格 ID，或类似 `cx.session:resolve` 的目标描述（例如 `"@focused"`）。所有方法都会返回 awaitable：Carly 使用 `await(...)`；插件使用 `:next(function(result, err, cx) ... end)`。失败时会以 Git 错误拒绝；重置 VM 会丢弃迟到的答案。

| 方法 | 结果/含义 |
| --- | --- |
| `repo(target)` | 根目录、分支、HEAD、上游、领先/落后情况以及正在执行的操作 |
| `status(repo)` | 已暂存、未暂存和冲突文件列表，含重命名来源和行数 |
| `log(repo, {limit?, path?})` | 跨引用的 Git 图形历史记录；默认 50，最多 100000；path 会跟随 HEAD 中的文件重命名 |
| `diff(repo, {path?, staged?, rev?})` | 统一格式文本；默认为未暂存差异，也可查看暂存索引或某一版本的提交补丁 |
| `stage(repo, paths)` / `unstage(repo, paths)` | 只修改索引；路径相对于仓库，按字面处理；空列表不会改变内容 |
| `commit(repo, message, {amend?})` | 使用完整消息提交索引，可选择修订 HEAD |
| `branches(repo)` | 本地和远程分支目标、跟踪状态及当前状态 |
| `checkout(repo, name, {detached?})` | 切换分支、创建本地跟踪分支，或在某个版本分离检出 |
| `create_branch(repo, name, {at?})` | 在 HEAD 或指定版本创建并检出分支 |
| `stash_push(repo, {message?})` | 贮藏已跟踪和未跟踪的变更 |
| `stash_pop(repo, {index?})` | 应用并删除贮藏；按从新到旧排列，`index` 从 0 开始且默认是 0 |
| `open(repo, {how?})` | 返回 Git 窗格 ID；使用原生放置方式，默认复用标签页中的块 |

`diff` 不可同时指定 `staged = true` 和 `rev`。变更操作共用 Git 块的串行工作任务和撤销日志，并刷新该根目录下所有已打开的块。

```lua
local repo = await(cx.git:repo("@focused"))
local changes = await(cx.git:status(repo))
await(cx.git:stage(repo, {"src/main.rs"}))
local patch = await(cx.git:diff(repo, {staged = true}))
local pane = await(cx.git:open(repo, {how = "tab"}))
```

### 设置上下文（cx）

通过 `cx.settings` 可以访问 `settings.json` 中所有可设置的偏好项，包括默认值（文件只保留修改过的项目）。根字段名是规范名称；`terminal.font_size` 是 `font_size` 的别名。点分路径可以表示嵌套字段（`carly.model`、`sqlite.drop.quoted`）；`get` 也可以读取整个子树。

| 方法 | 结果 |
| --- | --- |
| `get(key)` | 当前值或子树 |
| `set(key, value)` | 经过常规范围限制并保存后的有效值 |
| `set_many(table)` | 原子地应用点分键或嵌套补丁；返回所有叶字段的值 |
| `list(prefix?)` | 点分叶键映射到当前值 |
| `describe(key)` | 根据 Settings 派生出的 `{type, enum, range, default, nullable, doc}` |
| `themes()` | 已安装的主题名称 |
| `keybinds()` | 用户快捷键覆盖，而非有效按键映射 |
| `bind(chord, action_or_actions)` | 绑定操作或按优先级排列的操作数组 |
| `unbind(chord)` | 写入空覆盖，让按键由程序接收 |

未知键、无效类型/枚举及重叠路径会失败，且不会改变偏好设置。嵌套对象补丁会合并；`keybinds` 会替换整个覆盖映射。符合其存储类型的数值会经过现有设置范围限制。Null/nil 会清除可选偏好；`get` 对这些项返回 nil。`list` 会保留未设置的键，并将其值表示为 `tern.json.null`。无头会话中的设置仍是临时的。若要恢复某快捷键的默认绑定，请从替换后的 `keybinds` 映射中移除该快捷键；`cx.actions:keys()` 会显示有效绑定。

```lua
cx.settings:set_many({["carly.model"] = "@smol", notebook = {start_on_open = true}})
cx.settings:bind("cmd+shift+h", "new_tab")
local font = cx.settings:describe("terminal.font_size")
```

## 会话与主机上下文（cx）

`cx.sessions:list()` 会返回所有具名会话（`id`、`name`、`host`、`current`、`locked`、`note`、标签页数）。`:current()` 返回当前显示的会话。`:create({name?, cwd?})` 会在当前主机上创建并显示会话，并在 `cwd` 中打开首个标签页。`:switch(spec?)`、`:rename(spec, name)`、`:close(spec?)`、`:lock(spec?)` 和 `:unlock(spec?)` 接受完全匹配的名称或 ID；nil 和 `"@current"` 指当前显示的会话。空名称会报错。关闭操作会结束程序，无需交互式确认，也不受锁定保护限制；关闭最后一个会话时，会将其保留为空会话。

`cx.hosts:list()` 和 `:current()` 会返回机器信息，包括身份链、连接状态和详情、测量所得 `rtt_ms`（无法获取时为 null），以及会话/窗格 ID。ID 会原样传给会话和布局命名空间。主机目标描述可以是槽位、不区分大小写的名称、地址、`"local"` 或 `"@current"`。

桌面版 `:add(address)` 会返回 `Awaitable<ManagedHost>`；Carly 使用 `await`，插件使用 `:next(function(host, err, cx) ... end)`。连接成功后才会完成；连接失败或主机断开时会失败。首次连接时仍使用 Tern 的常规密钥验证：检查 `detail.fingerprint`，独立核实后再调用 `:trust(host, fingerprint)` 或使用主机对话框。若指纹不匹配，会报错而不接受该密钥。

`:switch(host)` 会显示该已连接主机的最近一个会话。`:terminal(host, {cwd?, command?})` 会在该主机上打开 Shell 标签页并聚焦它，然后返回窗格 ID。`:disconnect(host)` 会断开并遗忘远程机器；其上的程序仍会继续运行。本地主机不能断开。

```lua
local session = cx.sessions:create({name = "Build", cwd = "/tmp"})
local pane = cx.hosts:terminal("local", {cwd = "/tmp", command = "printf hello"})
cx.sessions:switch(session.id)
```

### 看板上下文（cx）

桌面版 `cx.board` 会在卡片/泳道层级编辑 Markdown 任务看板。`open(path, {how = "beside"})` 会返回看板窗格；其他方法都会返回 awaitable（Carly 使用 `await(...)`，插件使用 `:next(function(result, err, cx) ... end)`）。看板参数可以是本地路径或看板窗格 ID；相对路径相对于聚焦的本地窗格工作目录解析。`how` 还接受 `default`、`below`、`tab`、`pip` 和 `preview`。

| 方法 | 行为 |
| --- | --- |
| `boards()` | 已打开的看板，以及本地窗格工作目录和检出根目录中的 Markdown 任务/看板文件 |
| `read(board, {rows?, from?, max_chars?})` | 读取通用块读取器中的泳道/卡片；默认 25 行，最多 500；`from` 是从 1 开始的首个泳道；`more` 表示省略的数据 |
| `add(board, {lane, text, tags?, due?, subtasks?})` | 添加卡片；返回不透明 ID；子任务可以是字符串或 `{text, done?}` |
| `move(card, lane, {position?})` | 按卡片 ID 将卡片移到泳道标题/ID；`position` 从 1 开始且不计入该卡片，默认追加 |
| `check(card, done)` | 使用看板引擎的完成泳道移动逻辑勾选/重新打开卡片 |
| `edit(card, {text?, tags?, due?})` | 仅替换提供的字段；`tags={}`/`due=false` 会清除对应字段；保留备注/子任务 |
| `remove(card)` | 移除卡片及其备注、子任务 |
| `add_lane(board, {title, position?})` | 插入泳道，默认追加；返回不透明 ID |
| `rename_lane(board, lane, title)` | 按完全匹配标题或 ID 重命名泳道 |
| `remove_lane(board, lane)` | 移除泳道及其中所有卡片 |

标签不包含 `#`；日期格式为 `YYYY-MM-DD`。卡片/泳道需使用 `read`（或插入操作）返回的 `id`，不能使用行位置。其 ID 在模型编辑和撤销操作期间保持稳定，但从外部重新加载文件或重新打开会使其失效；之后请重新读取。泳道标题重复时必须使用 ID。移入 Done 会勾选卡片；移出则会重新打开。已打开看板共用实时模型、撤销、渲染和自动保存。已关闭文件上的操作会在磁盘内容未变时保留模型身份，并使用相同引擎，在窗口线程外执行原子写入。自动保存失败时会拒绝操作，但保留已打开看板的内存编辑和撤销记录。

```lua
local pane = cx.board:open("/repo/TODO.md")
local card = await(cx.board:add(pane, {lane = "Doing", text = "Write docs",
	tags = {"docs"}, subtasks = {"Draft", "Review"}}))
await(cx.board:check(card, true))
local board = await(cx.board:read(pane, {rows = 500}))
```

### 数据库上下文（cx）

桌面版 `cx.db` 可打开现有本地 SQLite 数据库，但不会创建窗格。每次操作都会在引擎的有序工作任务上运行并返回 awaitable；插件使用 `:next(function(result, err, cx) ... end)`，Carly 使用 `await`。

| 方法 | await 的结果 |
| --- | --- |
| `open(path, {read_only = true}?)` | 不透明数字连接 ID，由当前 Lua VM 所有 |
| `tables(db)` | 主数据库中的用户表和视图名称，按顺序排列 |
| `schema(db, table)` | 存储的 CREATE SQL；名称未知时失败 |
| `query(db, sql, {limit = 1000}?)` | `{columns = {string}, rows = {{DbCell}}}` |
| `exec(db, sql)` | 成功时为 `tern.json.null` |

相对路径根据聚焦窗格的工作目录解析；没有窗格时使用主目录。连接会一直保留，直到丢弃 Lua VM。默认使用 SQLite 实际只读打开标志。仅 `open(path, {read_only = false})` 允许执行 `exec`；除非 SQL 显式开始事务，否则写入会自动提交。即使句柄可写，`query` 仍然要求传入一条只读且会返回行的语句。它不会重写 SQL。`limit` 会限制返回行数；为 0 时仅返回列。

行会保留各值原有位置：SQL NULL 为 `tern.json.null`；文本和有限数值为普通字符串/数字。超出 Luau 精确数值范围的整数会表示为 `{integer = decimal_string}`，Blob 为 `{blob = {byte, ...}}`，非有限实数为 `{real = "inf" | "-inf"}`。空数组仍保留数组标签。SQLite 失败时 awaitable 会失败；插件和 Carly 之间没有权限隔离。

```lua
cx.db:open("/tmp/catalog.sqlite"):next(function(db, err, cx)
	if err then error(err) end
	cx.db:query(db, "SELECT * FROM products", {limit = 20}):next(function(result, err, cx)
		if err then error(err) end
		cx:toast("success", tostring(#result.rows) .. " rows")
	end)
end)
```

### 浏览器上下文（cx）

`cx.browser:call(op) -> Awaitable<BrowserResult>` 会执行 `tern browser` 支持的操作。插件使用 `:next(function(result, err, cx) ... end)`，Carly 使用 `await`。答案为 `{ok = answer}` 或 `{error = {kind, message}}`。重置对话会丢弃 Carly 尚未完成的答案。macOS、Linux 和 Windows 上都可以驱动浏览器块。

`blocks` 会列出窗口中的所有浏览器块，包括用户的块，格式为 `{block, url, title, owner, shown, driven}`：`owner` 是画中画浮动其上的块（停靠时为 `nil`），`shown` 表示块是否显示在屏幕上，`driven` 表示是否由脚本驱动。凡接受 `block` 的操作都可以使用其中任意块。受驱动页面离开视野后仍会以页面尺寸保持运行；`release` 会将块交还给用户（脚本为页面设置的配置会重置，但块仍然保留）。

`open` 接受 `owner`（浮动其上的块）、可选的 `url`（默认为 `about:blank`）、`corner = "tl" | "tr" | "bl" | "br"`（默认 `"br"`）、`width` 和 `height`（页面 CSS px 尺寸，默认 1280 × 800）、`profile`（网站数据存储名称，默认 `"agent"`；默认存储为 `tern.json.null`），以及 `show`（默认 `true`）；也可以指定 `how = "beside" | "below" | "over"`，在 `owner` 旁边停靠块，而非浮动：分割到其右边或下方，或 `over` 并占据其位置（owner 会被停放，程序继续运行），直到页面关闭。停靠块会获得焦点，并按自身尺寸布局页面；`how` 与 `corner` 或 `show = false` 同时使用时会返回 `invalid`。
页面开始接受调用后会返回 `{block, url}`。`show = false` 时，块会以停放状态打开在 session 卡组中，而不是浮动显示：它不会出现在屏幕上，也不会获得焦点；页面按 `width` × `height` 运行，所有操作都像对显示块一样有效（`state` 会报告该尺寸，`viewport` 可改变尺寸，`shown` 保持为 `false`）。取出卡片即可显示它。

`snapshot` 接受 `block`、可选的 `root`（引用或 CSS 选择器）、`depth`、`nodes`（默认 400，最多 3000）、`mode = "outline" | "text"` 和 `format = "tree" | "text"`。它会返回 URL/标题、树或文本、省略节点及 iframe 元数据。交互元素会获得隔离世界中稳定的引用；密码值会被掩码处理，隐藏节点会省略。它不会启用 Tern 的受驱动页面/对话框策略，但在原生页面上求值时会安装平台的驱动委托。

`act` 接受 `block`、`ref`、`action = "click" | "fill" | "press" | "select" | "check" | "uncheck" | "hover" | "scroll"`、可选 `text`、`keys`（快捷键字符串或数组）、`dx` 和 `dy`。可行时会使用受信任输入；过期引用会以 `not_found` 失败。Carly 可在普通 Window 端插件能力下使用所有浏览器操作。

`pick` 接受 `block` 并将对应页面置于元素选择模式：指针下方的元素会显示轮廓，点击后会选中该元素（页面不会收到点击），Escape 会取消。返回 `{picked, url, title}`；`picked` 为 `{ref, selector, tag, role, name?, text?, value?, box = {x, y, width, height}}`（`box` 使用视口 CSS px，密码值会被掩码处理），或 `{cancelled = true, url, title}`。`ref` 是快照引用，因此 `act` 可使用它。页面上的新 `pick` 会取消正在等待的操作；导航会使它以 `failed` 结束。与 `snapshot` 一样，它不会将块设置为受驱动状态。
无头快照会以 `failed: a headless session shows no pages` 失败；同步的 `session:read` 仍会提供 URL/标题。

```lua
local page = await(cx.browser:call({op = "snapshot", block = pane}))
if page.error then error(page.error.message) end
return page.ok
```

### 布局上下文（cx）

```lua
declare extern type LayoutCx with
	function new_tab(self, launch: Launch?, reveal: Reveal?): number?
	function split(self, target: number, dir: Dir, launch: Launch?, reveal: Reveal?): number?
	function focus(self, pane: number): ()
	function close(self, pane: number): ()
	function move(self, pane: number, target: number, dir: Dir | "swap", reveal: Reveal?): boolean
	function resize(self, pane: number, dir: Dir, cells: number): boolean
	function tab(self, spec: TabSpec, reveal: Reveal?): (number?, string?)
	function move_to_tab(self, pane: number, tab: number, reveal: Reveal?): (boolean, string?)
	function move_to_new_tab(self, pane: number, session: number?, reveal: Reveal?): (number?, string?)
	function float(self, pane: number, over: number?, corner: Corner?, opts: FloatOpts?): (boolean, string?)
	function dock(self, pane: number, target: number?, dir: Dir?, reveal: Reveal?): (boolean, string?)
	function park(self, pane: number): (boolean, string?)
	function unpark(self, pane: number, reveal: Reveal?): (boolean, string?)
	function even(self, tab: number): ()
	function name_tab(self, tab: number, name: string?): ()
	function color_tab(self, tab: number, color: TabColor?): ()
	function order_tab(self, tab: number, position: number): ()
	function rename_session(self, session: number, name: string): (boolean, string?)
	function snapshot(self): LayoutSnapshot
	function restore(self, snap: LayoutSnapshot): (boolean, string?)
	function arrange(self, spec: Arrange): ({ TabArrangement }?, string?)
end

type Dir = "right" | "down" | "left" | "up"
type Corner = "tl" | "tr" | "bl" | "br"
type TabColor = "red" | "orange" | "yellow" | "green" | "teal" | "blue" | "purple" | "pink"
type Reveal = { focus: boolean? }
type FloatOpts = { focus: boolean?, size: { number }? }
```

| 方法 | 行为 | 返回值 |
| --- | --- | --- |
| `new_tab(launch?)` | 在当前会话中打开运行 `launch` 的标签页，并将其设为活动标签页 | 新窗格；若 `launch.block` 指向主机不支持的类型，则返回 `nil` |
| `split(target, dir, launch?)` | 将窗格 `target` 分割，并在 `dir` 侧创建新窗格；新窗格位于 `target` 所在主机，工作目录默认与 `target` 相同，除非指定 `launch.cwd`；新窗格会获得所在标签页的焦点 | 新窗格；`target` 不属于任何标签页或块类型缺失时返回 `nil` |
| `focus(pane)` | 聚焦窗格（仅限当前窗口） | 无 |
| `close(pane)` | 插件和 Carly 使用的原始会话关闭操作 | 无 |
| `move(pane, target, dir, reveal?)` | 将窗格移到目标边缘，或在 `dir = "swap"` 时交换位置；插件和 Carly 默认会显示它 | 移动成功返回 `true`，拒绝时返回 `false` |
| `resize(pane, dir, cells)` | 将窗格最近的分隔线沿 `dir` 方向移动约 `cells`；负值表示反向移动 | 分隔线有移动时返回 `true`，否则为 `false` |
| `tab(spec)` | 构建工作区标签页并为其命名 | 标签页 ID（首个窗格无法启动时为 `nil`），若某窗格无法启动，则另返回错误字符串（[工作区](#工作区)） |

`split`、`move` 和 `resize` 遇到未知方向时会抛出 ``unknown direction `<dir>` (right, down, left or up)``。`move` 不允许将窗格移到其他主机（返回 `false`）。

`Reveal` 的类型是 `{focus = boolean}`。插件和 Carly 使用相同默认行为：创建窗格时像以往一样显示；`move` 会聚焦被移动的块；默认的 `split` 会将目标标签页的焦点移交给新块，但不会切换标签页。显式设为 true 会显示结果；设为 false 则保留当前显示焦点。

`move_to_tab` 会将块放到目标标签页聚焦叶节点的旁边；`move_to_new_tab` 会在该块所属或指定会话的末尾创建标签页。跨主机移动会被拒绝。`float` 默认浮动在接替原区域的叶节点上，并取其最近的角；也可以重新放置已浮动窗格。`dock` 默认返回原分割位置（如果仍然有效），否则放在其所依附的窗格旁边。

`float` 的选项为 `Reveal`，以及浮动窗格收起显示时的 `size = {w, h}`（聚焦它时仍会放大，和其他浮动窗格一样）。每个不超过 1 的值表示相对浮动位置所在框架的比例（`{0.4, 0.3}`）；大于 1 时，则表示大约多少个终端单元格（`{80, 24}`：宽度为列数，高度为浮动窗格标题条下的行数）。两个值可以混用。尺寸会根据调用时的窗口计算，并像用户拖动设置的尺寸一样保留，同时受布局限制：最小为 240 × 150 px，最大不超过框架占比。浮动窗格仍会吸附到角落，不支持自由定位。尺寸不是两个正数时，会抛出 ``size must be {w, h}: …``。若浮动窗格已成功放置但暂时无法计算尺寸（窗口尚未布局，或尚无终端测量过单元格尺寸），`float` 会返回 `true`，并说明未能应用尺寸的原因。对浮动窗格调用 `float(pane, nil, nil, {size = …})` 会在原位置调整其大小。[`float_moved`](events.md#float-moved) 事件会说明用户放开被拖动浮动窗格的位置。

`park` 会像 **Park pane**（⌃⇧↓）一样，将块从标签页移到 session 已停放窗格卡组中，同时保留正在运行的程序：分割区会折叠；若标签页只有这一个块，则关闭标签页。对未知或已停放块返回 `false, why`。`unpark` 会像 **Parked panes** 一样，将已停放块放到当前标签页的聚焦块旁边；若块未停放，则返回 `false, why`。若想将已停放块放到其他位置，`move`、`move_to_tab`、`move_to_new_tab`、带 `over` 的 `float`、`arrange` 和 `focus` 都可以直接从卡组中取出它。已停放块具有 `parked = true`，且没有 `tab`。

`even` 会按标签页 ID 平衡分割区。`name_tab` 的名称为 nil/空白时会清除显式标题；`color_tab` 为 nil 时会清除颜色；`order_tab` 使用从 1 开始的会话位置。`rename_session` 会拒绝空名称和未知会话。`snapshot` 会捕获树、浮动窗格、名称、颜色、顺序和已停放窗格，但不包含程序。
如果有块在快照保存后打开/关闭，或保存的会话消失，`restore` 会返回 `false, why`；否则会还原布局，但不会夺取当前显示的焦点。

Carly 在每轮对话中的首次变更会捕获一次布局快照。如果布局发生变化，会在该轮结束时显示一次 **Carly rearranged your workspace** 提示，并附带 **Undo**。若块不再匹配，撤销会安全拒绝。恢复的标签页标题和选中状态的填充色会立即显示，不会播放新标签页进入动画。

#### 单次调用分组

`arrange` 会以原子方式重新分组会话：

```lua
local tabs, err = cx.layout:arrange({
	tabs = {
		{name = "Build", color = "teal", blocks = {"cargo"}, split = "rows"},
		{tab = "2", name = "Logs", blocks = {}}, -- rename-only
	},
	rest = "keep",
})
```

`session` 可以是 ID 或名称（默认当前会话）。`tab` 可以是 ID 或 `find_tab` 目标描述；`blocks` 可以是 ID 或 `"@focused"` 之类的 `resolve` 目标描述。若未指定标签页，则复用包含该组中最多块的标签页（数量相同时取第一个），否则新建标签页。`blocks` 为空时不会向标签页移动内容，因此可仅用于重命名。组会按提供顺序排列在标签页列表前方；未修改的标签页保持相对顺序。省略 `split` 时保留目标树，并追加移入块；使用 `columns`、`rows` 或平衡的 `grid` 会重建布局。未提及的块会留在原处（`rest = "keep"`），或收集到最后一个 **Other** 标签页（`"last"`）；被组指定的已停放块会从卡组移入该组标签页。空标签页会关闭，但不会结束程序。

在任何变更发生前会校验参数；未知、重复或跨主机的块会导致拒绝。结果会为会话中每个标签页返回 `{id, position, name, blocks}`。焦点仍保持在同一块，并随之切换标签页。

Carly 的直接 `arrange` 工具接受等价 JSON，并返回每个请求上下文中同样有上限的窗口概览，包括分割树。Carly 会用该概览确定位置，并使用共享 Lua API 完成聚焦、标签页切换、打开文件/URL 和创建终端。

### `Launch`

```lua
type Launch = {
	cwd: string?,
	command: string?,
	block: string?,
	args: { string }?,
}
```

| 字段 | 含义 |
| --- | --- |
| `cwd` | 工作目录（默认是新标签页或分割区的起始位置） |
| `command` | 窗格登录 Shell 要运行的命令行，取代交互式 Shell |
| `block` | 插件块类型（`"<plugin>.<id>"`）；窗格会运行该块而不运行命令 |
| `args` | 块的启动参数 |

不传 `launch`（或传空对象）会运行 Shell。

Carly 的 `new_tab`、`split` 和工作区 `tab` 启动操作会使用锚点块的机器和目录，并忽略新标签页的 Home 偏好设置；`split` 使用目标作为锚点。`~` 和 `~/…` 会在该机器上展开。由 OSC 7 报告的 SSH 跳转目录必须属于已连接主机，否则启动会在窗口发生变化前失败。目录所在主机与分割目标不同时，Carly 会在该主机上打开标签页，而不会在本地使用远程路径。常规插件启动默认行为不变。

### 工作区

```lua
type TabSpec = {
	cwd: string?,
	name: string?,
	split: Dir?,
	ratio: number?,
	launch: Launch?,
	[number]: TabSpec,
}
```

`cx.layout:tab(spec)` 会根据树构建标签页。具有 `[1]` 和 `[2]` 的节点表示沿 `split`（默认为 `"right"`）方向分割，`ratio` 可设置第一侧的占比（默认为一半）；没有这两个字段的节点是运行其 `launch` 的叶节点。`cwd` 会向下继承，直到某个节点指定自己的值；叶节点的 `launch.cwd` 优先于两者。根节点的 `name` 会命名标签页，无论构建结束时该标签页是否活动。带有子节点的节点若设置了 `launch`，则忽略它。

最左侧叶节点会创建标签页；随后通过分割逐步填充整棵树，每层都先处理 `[1]` 再处理 `[2]`。`tab` 会返回两个值：标签页 ID，以及窗格无法启动时的错误字符串（全部成功时错误为 `nil`）。

- 最左侧叶节点无法启动（其 `launch.block` 指向主机上没有任何 Ready 插件定义的类型）时，不会打开标签页：``nil, "could not start block `<kind>`"``。
- 分割的新一侧无法启动时，该侧及其下方所有内容都会省略；其余树仍会构建，并为标签页命名：``<id>, "could not start block `<kind>`"``。若有多项错误，会以逗号分隔；`command` 叶节点显示为 `` `<command>` ``。

不会自动显示提示；请由插件决定如何报告错误：

```lua
local tab, err = cx.layout:tab(spec)
if err then
	cx:toast("error", if tab then "Workspace opened incomplete" else "Workspace not opened", err)
end
```

```lua
tern.on("window_start", function(cx)
	cx.layout:tab({
		name = "stencil",
		cwd = (tern.getenv("HOME") or "") .. "/work/stencil",
		split = "right",
		{ launch = { command = "nvim" } },
		{
			split = "down",
			{ launch = { command = "cargo watch -x check" } },
			{},
		},
	})
end)
```

## 相关页面

- [命令、快捷键与覆盖](../guides/commands.md)、[路由打开操作与链接](../guides/routing.md)、[Chrome 与样式](../guides/chrome.md)、[布局与工作区](../guides/layout.md)。
- [内置操作](actions.md)：命令 ID 和操作名称。
- [事件](events.md)：窗口事件载荷与触发顺序。
