# 路由打开与链接

路由让插件的 Window 端决定有人打开文件或跟随链接时会发生什么：改为打开插件块、重定向到另一个 URL 或路径，或完全自行处理。路由在 Tern 内置处理之前运行，因此可以接管不存在的路径以及 Tern 不认识的 URL 方案。

```lua
tern.route.open(function(req, _cx)
	if string.match(req.path, "%.tfplan$") then
		return { block = "terraform.plan", args = { req.path } }
	end
	return nil
end)
```

## 两种路由

| 路由 | 询问内容 | 处理器 |
| --- | --- | --- |
| `tern.route.open(fn)` | 用户请求打开的文件。 | `fn(req, cx) -> decision?` |
| `tern.route.link(fn)` | 在窗格和块中跟随的链接，以及系统交给 Tern 的 URL。 | `fn(link, cx) -> decision?` |

两者都只能在 Window 端使用。插件可以分别注册多个处理器。处理器先按插件 ID 顺序运行，再按插件内的注册顺序运行，直到有一个返回决策；`nil` 会交给下一个处理器。所有处理器都放行后，Tern 才执行内置处理。

每次调用处理器的时间预算为 50 ms，并会获得一个全新的 `cx`。处理器出错（或返回表和 `nil` 以外的值）时，会显示提示 `Plugin <name>: route.open failed`（或 `route.link`），并按 `nil` 处理；随后运行下一个处理器。

## 打开请求

`req` 描述一个即将打开的文件：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `path` | `string` | 绝对路径；文件存在时为规范路径（符号链接和 `..` 均已解析）。 |
| `line` | `number?` | 要显示的行号，从 1 开始。 |
| `col` | `number?` | 该行中的列号，从 1 开始。 |
| `host` | `string` | 文件所在主机的名称。 |
| `how` | `string` | 文件原本会以何种方式打开（见下文）。 |
| `origin` | `string` | 发起请求的来源（见下文）。 |

`how` 表示内置打开操作会将文件放置在何处：

| `how` | 放置位置 |
| --- | --- |
| `default` | Tern 的常规位置：若已有块显示该文件，则使用该块；否则根据打开操作的上下文新建块。 |
| `beside` | 在焦点窗格旁边拆分。 |
| `below` | 在其下方拆分。 |
| `split` | 手势选择的拆分位置（拖放到窗格边缘）。在决策中，`split` 表示 `beside`。 |
| `tab` | 新建标签页。 |
| `replace` | 替换来源块（文件块中的链接或 peek）。 |
| `over` | 在焦点窗格的槽位中新建块；该窗格会暂时停放，待块关闭后再放回原位。Tern 自己的打开操作不会请求此方式；`path` 决策的 `how` 可以使用它。 |
| `preview` | 标签页的预览块。 |

`origin` 表示 UI 中的请求来源：

| `origin` | 来源 |
| --- | --- |
| `palette` | 从命令面板打开文件（Open file…）。 |
| `files` | 从 Files 窗格打开文件。 |
| `drop` | 将文件拖放到窗口。 |
| `link` | 在终端中点击文件路径；点击未被任何 `tern.route.link` 处理器接管的窗格内文件链接；点击文件块中的链接；打开 peek 的文件。 |
| `system` | 系统操作：Finder 的 Open With、拖到 Dock 图标上、`--open-file`、第二次启动。 |
| `cli` | 在窗格中运行 `tern open`（见[下文](#在窗格中运行-tern-open)）。 |
| `carly` | 由 Carly 的 window 上下文打开文件；打开 URL 时会先查询 `tern.route.link`。 |

终端中打印的路径会直接交给 `tern.route.open`（来源为 `link`）；它是路径而不是 URL，因此 `tern.route.link` 不会收到它。`file://` URL 或指向文件的超链接则属于链接：`tern.route.link` 会先收到它；若没有处理器接管该链接，`tern.route.open` 才会收到该文件。

Tern 自行发起的打开操作不会经过路由：Files 窗格的预览、git 和 board 块打开文件、Open logs 和应用状态、“Open with”菜单项、`tern db`，以及插件处理器发起的每个 `cx:open`。

## 链接请求

`link` 描述一个正在跟随的链接：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `url` | `string` | 按原样书写的 URL：`https://…`、`file://…`、自定义方案，或链接所指的路径。 |
| `pane` | `number?` | 链接所在的窗格；若链接并非来自窗格，则为 `nil`。 |
| `mods` | table | 按住的修饰键：`cmd`（⌘；PC 上为 Super）、`alt`、`shift`、`ctrl`，每项均为布尔值。 |

以下情况会查询 `tern.route.link`：

- 终端窗格中的链接点击（URL 和 OSC 8 超链接）；
- 窗格链接菜单中的“Open file”、“Open link”和“Open link in browser”项（“Open link in Tern”会直接打开浏览器块）；
- 文件块和其他 surface 中的 URL 链接；
- Host 端通过其副作用 `cx:open(target)` 请求打开的内容；
- 系统交给 Tern 的 URL（使用已注册给 Tern 的方案的链接）；
- `tern.route.open` 决策中的 `url`。

## 决策

决策是一个设置了 `block`、`url`、`path` 或 `handled` 之一的表。如果同时设置多个字段，则按此顺序采用第一个。表中这些字段一个都未设置时会报错：`a route decision sets block, url, path or handled = true`。

| 决策 | 来自 `tern.route.open` | 来自 `tern.route.link` |
| --- | --- | --- |
| `nil` | 交给下一个处理器，然后交给内置打开处理。 | 交给下一个处理器，然后交给内置链接处理。 |
| `{block = "<plugin>.<block>", args = {…}}` | 在文件所在主机（`req.host`）上打开该插件块，并传入 `args`（默认为 `{}`）；块会放在焦点窗格旁边（若 `req.how` 为 `tab` 或 `below`，则分别放在新标签页或下方），起始目录为文件所在文件夹。 | 在链接所在窗格的主机上打开该插件块，并传入 `args`；块会放在该窗格旁边，起始目录为其所在目录。 |
| `{url = "…"}` | 改为跟随该 URL：`tern.route.link` 处理器会看到它一次，然后交给内置链接处理；内置处理不会将文件 URL 再次路由回 `tern.route.open`。 | 使用内置处理跟随该 URL；不会再次交给任何路由。 |
| `{path = "…", how? = …}` | 使用内置打开处理打开该路径；若提供 `how` 则据此放置，否则使用 `req.how`。 | 在窗格所在主机的文件块中打开该路径；若提供 `how` 则据此放置，否则放在默认位置（按住 ⌥ 时位于窗格旁边）。 |
| `{handled = true}` | 不再运行其他处理。 | 不再运行其他处理。 |

决策中的 `how` 若不是七个名称之一，就会报错。`block` 类型必须是目标主机上某个 Ready 插件定义的块类型；对于 `tern.route.open`，目标主机是文件所在主机；对于 `tern.route.link`，则是链接所在窗格的主机。远程主机上的文件会在该主机上打开块，因此插件的 Host 端必须安装在那台机器上。如果该主机上没有 Ready 插件定义此类型，则不会打开任何内容（也不会运行内置处理），并会显示错误提示“Could not open the block”，下方说明为 `No plugin on <host> defines block type <kind>`。

`handled` 表示插件已完成打开操作所需的处理，通常会通过 `cx` 完成。它必须恰好为 `true`；`{handled = false}` 会报错，而不是放行。

## “Open with”菜单

manifest 中声明了 `files` glob 的块类型，会在文件块的 ⋯ 菜单以及 Files 窗格中匹配文件的上下文菜单里显示“Open with `<title>`”项，但不会接管所有打开操作：

```toml
[[blocks]]
id = "plan"
title = "Terraform Plan"
files = ["*.tfplan", "*.plan.json"]
```

Glob 只匹配文件名，支持 `*` 和 `?`，并且不区分 ASCII 大小写。菜单项会列出当前会话主机上 Ready 插件的块类型，且仅对该主机上的文件显示。选择一项后，会在焦点窗格旁边打开该块，起始目录为文件所在文件夹，并传入 `args = {<absolute
path>}`。这些打开操作不会经过 `tern.route.open`。

如果块是查看文件的多种方式之一，优先使用 `files`；如果插件的视图应成为默认方式，则使用路由。

## 在窗格中运行 `tern open`

在窗格中运行 `tern open PATH`，会在显示该窗格的 Tern 窗口中打开文件，并经过路由：

- 在会话守护进程的窗格中（通常情况），命令会与该守护进程通信；守护进程会将请求转发给一个接收打开请求的窗口：若当前焦点窗口显示此会话，则选择该窗口，否则选择最近连接的窗口。该窗口会以来源 `cli` 打开每个文件，先运行路由，再向命令返回结果。
- 在不使用守护进程运行的窗口中的窗格内，命令会与窗口自身的 socket 通信，结果相同。
- 如果没有窗口接收守护进程的打开请求，守护进程会自行打开文件，将会话布局作为编辑内容更新，所有已连接窗口都会采用该布局（若没有窗口显示该守护进程，则会为其启动一个窗口）。不会运行任何 window 端，因此没有路由会收到请求。

该命令会报告已打开的块；`--wait` 会等待这些块关闭。返回 `{block = …}` 的路由会将该块交给命令以便等待。返回 `{url = …}` 或 `{handled = true}` 的路由不会留下块，因此命令会失败并显示 `PATH cannot open in a file block`。由于 Tern 使用 `EDITOR='tern open --wait'` 编辑提交消息，因此除非插件为其打开块，否则应让 `origin == "cli"` 的打开操作保持原样。

## 递归

路由处理器运行期间，所有插件的路由和覆盖处理器都不会生效（[递归保护](commands.md#递归保护)）。处理器可以调用 `cx:open(req.path)`，在该路径上运行内置打开处理；也可以调用 `cx:open(other, "beside")` 打开另一个文件；这两种操作的结果都不会再次经过自身路由。处理器通过 `cx:command` 发起的打开操作也一样。

## 示例详解

### 将文件类型作为块处理，除非用户请求以文本方式打开

```lua
local claimed = { files = true, palette = true, link = true, system = true }

tern.route.open(function(req, _cx)
	if not string.match(req.path, "%.ipynb$") then
		return nil
	end
	if not claimed[req.origin] or req.how == "replace" then
		return nil -- `tern open`, drops and in-place opens stay text
	end
	return { block = "nb.viewer", args = { req.path } }
end)
```

### 重定向并接管链接

```lua
tern.route.link(function(link, cx)
	-- Shift-click copies a web link instead of following it.
	if link.mods.shift and string.match(link.url, "^https?://") then
		cx:copy(link.url)
		cx:toast("success", "Link copied", link.url)
		return { handled = true }
	end
	-- A private scheme: ticket://PROJ-123 opens the tracker.
	local key = string.match(link.url, "^ticket://(%u+%-%d+)$")
	if key then
		return { url = "https://tracker.example.com/browse/" .. key }
	end
	return nil
end)
```

程序可以将任意 URL（包括自定义方案）标记为 OSC 8 超链接；点击后会像其他链接一样查询 `tern.route.link`。

### 打开源文件，而不是构建输出

```lua
tern.route.open(function(req, _cx)
	local root, rest = string.match(req.path, "^(.*)/dist/(.-)%.js$")
	if root == nil or rest == nil then
		return nil
	end
	local source = root .. "/src/" .. rest .. ".ts"
	if tern.fs.exists(source) then
		return { path = source, how = "beside" }
	end
	return nil
end)
```

`tern.fs` 读取运行窗口的那台机器上的磁盘。若请求中的 `host` 指向远程主机，则请求涉及的是远程主机上的文件，因此此检查会针对错误的机器作出判断。

## 另请参阅

- [块](blocks.md)：定义路由打开的块类型。
- [命令、按键与覆盖](commands.md)：window `cx` 和递归保护。
- [Window API](../reference/api-window.md)：`OpenRequest`、`LinkRequest` 和 `RouteDecision`。
- [清单参考](../reference/manifest.md)：`[[blocks]] files`。
