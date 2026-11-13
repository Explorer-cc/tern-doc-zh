# 项目工作区

`workspaces` 会打开项目在 `.tern/workspace.json` 中描述的标签页：命名标签页、分屏窗格，以及每个窗格对应的目录和命令。这是一个仅在窗口端运行的插件，也是 `cx.layout:tab`、内置命令覆盖，以及一个在反映插件所更改状态时仍保持纯粹的状态格式化器的示例。

## 演示内容

| 接口 | 用途 |
| --- | --- |
| `tern.command`, `tern.bind` | “Open workspace”和“Edit workspace file” |
| `cx.session:focused()`, `cx.session:panes()` | 焦点窗格的目录 |
| `tern.fs.exists`, `tern.fs.read`, `tern.json.decode` | 查找并读取工作区文件 |
| `cx.layout:tab(spec)` | 根据分屏树构建每个标签页，并报告无法启动的窗格 |
| `tern.on("window_start")`, `tern.getenv`, `cx.session:tabs()` | 启动时打开 `TERN_WORKSPACE`，接管恢复的标签页 |
| `tern.on("tab_closed")` | 工作区最后一个标签页关闭时清除该工作区 |
| `tern.override("new_tab", fn)` | 在工作区根目录创建新标签页 |
| `cx.layout:new_tab`, `cx:open` | 覆盖处理器创建的标签页；打开文件 |
| `tern.chrome.status`, `tern.chrome.refresh` | 在状态栏显示工作区名称，并在工作区打开或关闭时重绘 |
| manifest 中的 `styles` | 为插件自己的状态栏片段设置样式 |

## 安装

```sh
tern plugin install github.com/stencil-hq/tern-sdk/plugins/examples/workspaces
```

修改期间，请改为克隆 SDK 并链接该目录，以便 Tern 在每次保存时重新加载它：

```sh
git clone https://github.com/stencil-hq/tern-sdk
tern plugin link tern-sdk/plugins/examples/workspaces
```

然后在包含 `.tern/workspace.json` 的项目中打开 shell（插件目录中有一个示例文件），并从命令面板运行 **Open workspace**，或使用 `cmd+alt+shift+o`（非 macOS 系统使用 `ctrl+alt+shift+o`）。若要在 Tern 启动时打开工作区，请将 `TERN_WORKSPACE` 设为项目根目录或其 `workspace.json`，然后启动 Tern：

```sh
TERN_WORKSPACE=~/src/webapp tern
```

## 工作区文件

```json
{
  "name": "webapp",
  "tabs": [
    {
      "name": "code",
      "split": "right",
      "panes": [
        { "command": "nvim ." },
        {
          "split": "down",
          "panes": [
            { "cwd": "web", "command": "npm run dev" },
            { "cwd": "api", "command": "cargo watch -x run" }
          ]
        }
      ]
    },
    {
      "name": "shell",
      "panes": [{}, { "block": "longrun.slow" }]
    },
    {
      "name": "infra",
      "cwd": "infra"
    }
  ]
}
```

| 字段 | 位置 | 含义 |
| --- | --- | --- |
| `name` | 顶层 | 显示在提示消息和状态栏中；默认值：根目录名称 |
| `tabs` | 顶层 | 按顺序打开的非空标签页数组 |
| `name` | 标签页 | 标签页名称 |
| `cwd` | 标签页、组、窗格 | 相对于外层目录（顶层时为根目录）的目录；支持绝对路径和 `~/` 路径 |
| `split` | 标签页、组 | `right`（默认值）、`down`、`left` 或 `up`：`panes` 的分割方式 |
| `panes` | 标签页、组 | 窗格和组的数组；没有 `panes` 的标签页包含一个 shell |
| `command` | 窗格 | 由登录 shell（`$SHELL -l -c`）运行的命令行 |
| `block` | 窗格 | 插件块 kind，例如 `longrun.slow` |
| `args` | 窗格 | 块的启动参数（字符串）；仅与 `block` 一起使用 |

既没有 `command` 也没有 `block` 的窗格是一个 shell。命令窗格的行为与任何程序结束的窗格相同：命令成功退出后，窗格会关闭。

## 设计

### 从窗格列表到分屏树

`cx.layout:tab` 接受一个 `TabSpec`，即一棵二叉树：叶节点有 `launch`，内部节点有 `split` 和两个子节点 `[1]`、`[2]`，而 `cwd` 会向下继承。人们通常会把标签页想成“这三个窗格并排放置”，因此文件使用列表，再由 `workspace.luau` 转换。`group` 将列表分成两半并递归处理，较小的一半在前：

```text
panes: [a, b, c], split: right

        right
       /     \
      a      right
            /     \
           b       c
```

`a` 占据标签页的一半，`b` 和 `c` 共用另一半；这适合编辑器旁边放两个工具的常见布局。`panes` 内的组（自身带有 `panes` 的条目）会按自己的方式分割其区域，就像示例中的 `code` 使用 `split: "down"` 一样。

转换时，每个目录都会解析为绝对路径，因此构建规范时不依赖焦点窗格所在的位置。Tern 会将第一个叶节点创建为新标签页，然后针对每个内部节点进行一次分割；如果规范包含 `name`，则会为标签页命名。

### 指向出错行的错误

用户编辑文件时，格式错误的文件很常见，因此 `workspace.load` 会在转换时验证文件，并抛出指出具体字段的消息：`tabs[1].panes[2].cwd: must be a string`。它以级别 `0` 抛出错误，从而省略 Lua 的文件和行号前缀；窗口端使用 `pcall` 捕获错误并在提示消息中显示。在整个文件转换完成之前，不会构建任何内容，因此第三个标签页中的错误不会导致前两个标签页残留。

### 查找根目录

“Open workspace”会获取焦点窗格的目录，并使用 `tern.fs.exists` 向上逐级查找 `.tern/workspace.json`，方式与 `git` 查找 `.git` 相同。窗口端在你的机器上运行，因此此过程无需往返会话守护进程，只需少量 `stat` 调用。

### 记住已打开的内容

窗口端会维护 `opened`，这是一个从根目录映射到工作区名称及其所建标签页 ID 的表。每个窗口都有自己的 VM，因此也有自己的表；插件重新加载时，该表会清空。`tab_closed` 会移除标签页 ID；当该工作区的最后一个标签页关闭时，也会移除工作区。若工作区已打开，再次打开时只会显示提示消息，不会重复打开其标签页。

### 启动时打开

`window_start` 会在窗口的会话恢复后，为每个窗口中的每个插件运行一次。它会从窗口进程的环境中读取 `TERN_WORKSPACE`，接受根目录或其 `workspace.json` 的路径；若路径是相对路径则拒绝，因为窗口进程的工作目录无法表明用户的意图。

恢复的会话可能已经包含上次工作区的标签页。构建之前，处理器会查找名称与文件中某个标签页匹配、且目录位于根目录之内的标签页，并将其接管到 `opened`，而不是再打开一套。

### 在根目录创建新标签页

无论内置 New Tab 命令来自命令面板、菜单还是快捷键，`tern.override("new_tab", fn)` 都会在它运行之前执行。当焦点窗格位于已打开的工作区内时（工作区嵌套时，以最深层的根目录为准），覆盖处理器会通过 `cx.layout:new_tab` 在根目录打开一个 shell，并返回 `true`，这样内置操作就不会执行。在其他位置则返回 `false`，由 Tern 打开常规标签页。参见[命令、快捷键与覆盖](../guides/commands.md)。

### 纯状态栏区段

对于位于已打开根目录内的窗格，状态格式化器会返回工作区名称。它只读取内存中的 `opened` 表，不会访问磁盘：Tern 绘制期间会运行格式化器，时间预算为 4 ms；Tern 会按输入（`{pane, cwd, program, title, busy}`）缓存每个结果，直到插件重新加载、注册某项内容或调用 `tern.chrome.refresh()`。

`opened` 不属于这些输入，因此工作区打开前已存在于根目录内的窗格会继续使用缓存结果，状态栏中不会出现区段。因此每次 `opened` 发生更改（构建工作区、启动时接管恢复的标签页、工作区最后一个标签页关闭）时，都会调用 `tern.chrome.refresh()`，清除缓存结果并根据当前的 `opened` 重绘状态栏。

点击该区段会运行“Edit workspace file”。manifest 中的 `workspaces.css` 会将该区段设为粗体；Tern 会将其作为样式表 `plugin:local:workspaces:styles` 安装，而选择器 `#statusline .sl-plugin[data-plugin="workspaces"]` 只会影响此插件的区段。参见[界面与样式](../guides/chrome.md)。

## 限制

- **每个窗口都会运行 `window_start`。** 稍后通过 New Window 打开的窗口不会包含工作区标签页，因此如果设置了 `TERN_WORKSPACE`，它也会打开该工作区。
- **本地文件。** 查找和读取操作使用窗口所在机器。对于远程主机上的窗格，目录名表示远程路径，只有同一路径也存在于本地时才能找到工作区。
- **目录不存在。** 若 `cwd` 不存在，窗格会在主目录中启动。
- **块不存在。** 如果某个分屏的新侧将启动的块 kind 未由任何已加载插件定义，`cx.layout:tab` 会省略该分屏及其下的所有内容，并构建其余部分；若标签页的第一个窗格就是这种块，则不会打开该标签页。无论哪种情况，它都会将错误作为第二个返回值，而 `build` 会将这些错误汇总到“Opened *name* incomplete”提示消息中。
- **纯 JSON。** 不支持注释或尾随逗号。

## 代码

`plugin.toml`：

```toml
schema = 1
id = "workspaces"
name = "Project Workspaces"
version = "0.1.0"
description = "Opens the tabs a project's .tern/workspace.json describes."
icon = "folder"
window = "window.luau"
styles = ["workspaces.css"]
```

`workspace.luau`：

```lua
--!strict
-- Finds and reads `.tern/workspace.json`, turning it into the tab specs
-- `cx.layout:tab` builds.
--
-- {
--   "name": "webapp",                      -- default: the root's folder name
--   "tabs": [{
--     "name": "dev",                       -- tab name
--     "cwd": "web",                        -- relative to the root (default: the root)
--     "split": "right",                    -- how `panes` divide (default "right")
--     "panes": [                           -- default: one shell
--       {"command": "npm run dev"},        -- a login shell runs it with -c
--       {"block": "longrun.slow", "args": []},
--       {"cwd": "api"},                    -- a shell, relative to the tab's cwd
--       {"split": "down", "panes": [...]}  -- a group, divided its own way
--     ]
--   }]
-- }

local workspace = {}

local FILE = ".tern/workspace.json"
local HOME = tern.getenv("HOME")
local SIDES: { [string]: boolean } = { right = true, down = true, left = true, up = true }

export type Workspace = {
	name: string,
	root: string,
	tabs: { TabSpec },
	-- The tab names, to recognize a restored session's tabs.
	names: { string },
}

-- `path` without trailing slashes.
local function trim(path: string): string
	local out = string.gsub(path, "(.)/+$", "%1")
	return out
end

-- `path` made absolute against `base`; `~` is the home directory.
function workspace.resolve(base: string, path: string): string
	if path == "~" or string.sub(path, 1, 2) == "~/" then
		if HOME == nil then
			error("HOME is not set, so " .. path .. " can't be resolved", 0)
		end
		return trim(HOME .. string.sub(path, 2))
	end
	if string.sub(path, 1, 1) == "/" then
		return trim(path)
	end
	path = string.gsub(path, "^%./", "")
	if path == "" or path == "." then
		return base
	end
	return trim(if base == "/" then "/" .. path else base .. "/" .. path)
end

-- The nearest directory at or above `dir` holding `.tern/workspace.json`.
function workspace.find(dir: string): string?
	local at: string? = trim(dir)
	while at do
		local candidate = if at == "/" then "/" .. FILE else at .. "/" .. FILE
		if tern.fs.exists(candidate) then
			return at
		end
		if at == "/" then
			return nil
		end
		local up = string.match(at, "^(.*)/[^/]*$")
		at = if up == nil or up == "" then "/" else up
	end
	return nil
end

-- Raises `where: message` (no Lua position: the toast shows it as is).
local function fail(where: string, message: string): never
	error(string.format("%s: %s", where, message), 0)
end

local function optional_string(value: any, where: string): string?
	if value ~= nil and type(value) ~= "string" then
		fail(where, "must be a string")
	end
	return value
end

local function side(value: any, where: string): Dir
	local name = optional_string(value, where) or "right"
	if not SIDES[name] then
		fail(where, "must be right, down, left or up")
	end
	return name :: Dir
end

local node: (entry: any, cwd: string, where: string) -> TabSpec

-- `list` divided `split`-wise: the first half on one side, the rest on the
-- other, recursively. With an odd count the first side holds fewer panes,
-- so the first pane (often an editor) gets the most room.
local function group(list: { any }, split: Dir, cwd: string, where: string): TabSpec
	if #list == 0 then
		return {}
	end
	local function range(from: number, to: number): TabSpec
		if from == to then
			return node(list[from], cwd, string.format("%s[%d]", where, from))
		end
		local middle = from + (to - from + 1) // 2 - 1
		return { split = split, range(from, middle), range(middle + 1, to) }
	end
	return range(1, #list)
end

-- One `panes` entry: a group (it has `panes`) or a leaf.
node = function(entry: any, cwd: string, where: string): TabSpec
	if type(entry) ~= "table" then
		fail(where, "must be an object")
	end
	local own = optional_string(entry.cwd, where .. ".cwd")
	local here = if own then workspace.resolve(cwd, own) else cwd
	if entry.panes ~= nil then
		if type(entry.panes) ~= "table" then
			fail(where .. ".panes", "must be an array")
		end
		local spec = group(entry.panes, side(entry.split, where .. ".split"), here, where .. ".panes")
		spec.cwd = spec.cwd or here
		return spec
	end
	local command = optional_string(entry.command, where .. ".command")
	local block = optional_string(entry.block, where .. ".block")
	if command and block then
		fail(where, "has both command and block")
	end
	local args: { string }? = nil
	if entry.args ~= nil then
		if block == nil then
			fail(where .. ".args", "only blocks take args")
		end
		if type(entry.args) ~= "table" then
			fail(where .. ".args", "must be an array of strings")
		end
		args = {}
		for i, arg in entry.args do
			table.insert(args :: { string }, optional_string(arg, string.format("%s.args[%d]", where, i)) :: string)
		end
	end
	return { cwd = here, launch = { command = command, block = block, args = args } }
end

-- The workspace at `root`; raises a readable message when the file is
-- missing or malformed.
function workspace.load(root: string): Workspace
	local path = root .. "/" .. FILE
	local ok, text = pcall(tern.fs.read, path)
	if not ok then
		fail(path, "can't be read")
	end
	local decoded, data = pcall(tern.json.decode, text)
	if not decoded then
		fail(path, "isn't valid JSON (" .. tostring(data) .. ")")
	end
	if type(data) ~= "table" then
		fail(path, "must hold an object")
	end
	local folder = string.match(root, "([^/]+)$") or root
	local name = optional_string(data.name, "name") or folder
	if type(data.tabs) ~= "table" or #data.tabs == 0 then
		fail("tabs", "must be a non-empty array")
	end
	local tabs: { TabSpec } = {}
	local names: { string } = {}
	for i, tab in data.tabs do
		local where = string.format("tabs[%d]", i)
		if type(tab) ~= "table" then
			fail(where, "must be an object")
		end
		local cwd = workspace.resolve(root, optional_string(tab.cwd, where .. ".cwd") or ".")
		local panes = tab.panes or {}
		if type(panes) ~= "table" then
			fail(where .. ".panes", "must be an array")
		end
		local spec = group(panes, side(tab.split, where .. ".split"), cwd, where .. ".panes")
		spec.cwd = spec.cwd or cwd
		spec.name = optional_string(tab.name, where .. ".name")
		if spec.name then
			table.insert(names, spec.name :: string)
		end
		table.insert(tabs, spec)
	end
	return { name = name, root = root, tabs = tabs, names = names }
end

return workspace
```

`window.luau`：

```lua
--!strict
-- workspaces, window half: opens the tabs a project's
-- `.tern/workspace.json` describes, from the palette or at launch
-- (`TERN_WORKSPACE`), starts new tabs at the root of the workspace the
-- focused pane is in, and names that workspace in the status line.

local workspace = require("./workspace")

local OPEN = "plugin.workspaces.open"
local EDIT = "plugin.workspaces.edit"
local HOME = tern.getenv("HOME")

-- A workspace this window opened (or found restored), and its tab ids.
type Opened = {
	name: string,
	root: string,
	tabs: { [number]: boolean },
}

-- Opened workspaces by root. Only this window's VM sees it, and a plugin
-- reload starts it empty.
local opened: { [string]: Opened } = {}

local function tilde(path: string): string
	if HOME and string.sub(path, 1, #HOME + 1) == HOME .. "/" then
		return "~" .. string.sub(path, #HOME + 1)
	end
	return path
end

local function inside(path: string, root: string): boolean
	return path == root or string.sub(path, 1, #root + 1) == root .. "/" or root == "/"
end

-- The opened workspace holding `path`; the deepest root wins when
-- workspaces nest.
local function owner(path: string?): Opened?
	if path == nil then
		return nil
	end
	local best: Opened? = nil
	for root, entry in opened do
		if inside(path, root) and (best == nil or #root > #best.root) then
			best = entry
		end
	end
	return best
end

local function focused_cwd(cx: WindowCx): string?
	local id = cx.session:focused()
	for _, pane in cx.session:panes() do
		if pane.pane == id then
			return pane.cwd
		end
	end
	return nil
end

-- Builds `w`'s tabs and remembers them.
local function build(cx: WindowCx, w: workspace.Workspace)
	local entry: Opened = { name = w.name, root = w.root, tabs = {} }
	local count = 0
	-- What couldn't start: a tab whose first pane failed is missing, a
	-- split whose new side failed is left out of its tab.
	local problems: { string } = {}
	for _, spec in w.tabs do
		local tab, err = cx.layout:tab(spec)
		if tab then
			entry.tabs[tab] = true
			count += 1
		end
		if err then
			table.insert(problems, err)
		end
	end
	if count == 0 then
		local why = if #problems > 0 then table.concat(problems, "; ") else tilde(w.root)
		cx:toast("error", "Workspace " .. w.name .. " opened no tabs", why)
		return
	end
	opened[w.root] = entry
	-- Panes already inside the root get the segment too.
	tern.chrome.refresh()
	if #problems > 0 then
		cx:toast("error", "Opened " .. w.name .. " incomplete", table.concat(problems, "; "))
	else
		cx:toast("success", "Opened " .. w.name, string.format("%d tabs · %s", count, tilde(w.root)))
	end
end

-- Reads the workspace at `root`, toasting the problem when it doesn't load.
local function read(cx: WindowCx, root: string): workspace.Workspace?
	local ok, result = pcall(workspace.load, root)
	if not ok then
		cx:toast("error", "Workspace not opened", tostring(result))
		return nil
	end
	return result
end

local function open_at(cx: WindowCx, root: string)
	local current = opened[root]
	if current then
		cx:toast("info", current.name .. " is already open", tilde(root))
		return
	end
	local w = read(cx, root)
	if w then
		build(cx, w)
	end
end

tern.command({
	id = "open",
	title = "Open workspace",
	icon = "folder",
	run = function(cx: WindowCx)
		local cwd = focused_cwd(cx)
		local root = if cwd then workspace.find(cwd) else nil
		if root == nil then
			cx:toast("error", "No workspace here", "No .tern/workspace.json above " .. tilde(cwd or "this pane"))
			return
		end
		open_at(cx, root)
	end,
})

tern.command({
	id = "edit",
	title = "Edit workspace file",
	icon = "folder",
	run = function(cx: WindowCx)
		local cwd = focused_cwd(cx)
		local root = if cwd then workspace.find(cwd) else nil
		if root == nil then
			cx:toast("error", "No workspace here", "No .tern/workspace.json above " .. tilde(cwd or "this pane"))
			return
		end
		cx:open(root .. "/.tern/workspace.json", "beside")
	end,
})

tern.bind(if tern.runtime.os == "macos" then "cmd+alt+shift+o" else "ctrl+alt+shift+o", OPEN)

-- At launch: the workspace TERN_WORKSPACE names (its root, or its
-- workspace.json). A restored session already has its tabs, so tabs named
-- like the workspace's and inside its root are adopted instead of opened
-- twice.
tern.on("window_start", function(cx: WindowCx)
	local target = tern.getenv("TERN_WORKSPACE")
	if target == nil or target == "" then
		return
	end
	local first = string.sub(target, 1, 1)
	if first ~= "/" and first ~= "~" then
		cx:toast("error", "TERN_WORKSPACE must be an absolute path", target)
		return
	end
	local root = workspace.resolve("/", target)
	root = string.gsub(root, "/%.tern/workspace%.json$", "")
	local w = read(cx, root)
	if w == nil then
		return
	end
	local names: { [string]: boolean } = {}
	for _, name in w.names do
		names[name] = true
	end
	local restored: Opened = { name = w.name, root = root, tabs = {} }
	for _, tab in cx.session:tabs() do
		if tab.name and names[tab.name] and tab.cwd and inside(tab.cwd, root) then
			restored.tabs[tab.id] = true
		end
	end
	if next(restored.tabs) then
		opened[root] = restored
		tern.chrome.refresh()
	else
		build(cx, w)
	end
end)

tern.on("tab_closed", function(ev: TabEvent, _cx: WindowCx)
	for root, entry in opened do
		if entry.tabs[ev.tab] then
			entry.tabs[ev.tab] = nil
			if next(entry.tabs) == nil then
				opened[root] = nil -- the last of its tabs closed
				tern.chrome.refresh()
			end
		end
	end
end)

-- A new tab from a pane inside an opened workspace starts at its root;
-- anywhere else the built-in runs (returning false).
tern.override("new_tab", function(cx: WindowCx): boolean
	local entry = owner(focused_cwd(cx))
	if entry == nil then
		return false
	end
	return cx.layout:new_tab({ cwd = entry.root }) ~= nil
end)

-- Pure: reads only `opened`, never the disk. Tern caches the answer per
-- pane input, so every change to `opened` calls `tern.chrome.refresh()`.
tern.chrome.status(function(pane: PaneInfo): { StatusSegment }?
	local entry = owner(pane.cwd)
	if entry == nil then
		return nil
	end
	return { { text = entry.name, icon = "folder", command = EDIT } }
end)
```

`workspaces.css`：

```css
/* The workspace's status segment reads as a label, not a hint. */
#statusline .sl-plugin[data-plugin="workspaces"] {
	font-weight: 600;
}
```