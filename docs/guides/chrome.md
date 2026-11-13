# Chrome 与样式

插件的 Window 端可以重命名标签页和窗口、向状态栏添加片段、选择程序显示的图标，并添加全局 CSS。标题和片段由 chrome 格式化器生成：它们是纯函数，接收一个小型输入表。Tern 在绘制时调用它们，因此它们必须在严格的时间预算内运行，结果也会缓存。
样式来自 manifest 的 `styles` 文件以及 `tern.css`。

```lua
tern.chrome.tab_title(function(tab)
	if tab.name then
		return nil -- keep names the user gave
	end
	return string.match(tab.cwd or "", "([^/]+)/*$")
end)
```

## 格式化器

| 格式化器 | 调用对象 | 结果 | 多个插件时 |
| --- | --- | --- | --- |
| `tern.chrome.tab_title(fn)` | 当前会话的每个标签页。 | 标题字符串，或表示使用 Tern 自带标题的 `nil`。 | 按 id 顺序，第一个提供标题的插件胜出。 |
| `tern.chrome.window_title(fn)` | 窗口。 | 标题字符串，或表示使用 Tern 自带标题的 `nil`。 | 第一个提供标题的插件胜出。 |
| `tern.chrome.status(fn)` | 聚焦的窗格。 | 片段列表，或表示没有片段的 `nil`。 | 所有插件的片段都会显示，顺序按插件 id 排列。 |

每个插件在每个槽位上只能注册一个格式化器；再次注册会替换原有格式化器。空字符串等同于 `nil`。即使用户重命名了标签页，格式化器返回的标题也会替换 Tern 的标题；如果应优先使用用户命名，请检查 `tab.name`。

格式化器是纯函数：

- **没有 `cx`。** 格式化器只接收其输入表。它可以读取 `tern.kv`、`tern.fs` 和上值，但无法操作窗口。
- **4 ms 时间预算。** 格式化器运行超时会触发 `tern: tab_title exceeded 4 ms`（或 `window_title`、`status`）错误，显示提示并暂停执行：首次暂停 5 s，之后若持续超时，暂停时间会更长。
- **按输入缓存。** 每个不同的输入表只格式化一次；输入变化前，Tern 会复用结果。每个格式化器最多缓存 256 个输入；插件重载或注册任何内容（命令、绑定或格式化器）时，以及调用 `tern.chrome.refresh()` 时，缓存都会被丢弃。

如果发生错误、返回类型错误或超出时间预算，触发错误的帧结束后会显示 `Plugin <name>: <slot> failed` 提示；该帧会使用 Tern 自带的标题，或不显示片段。

## 刷新

会话发生变化（焦点、标题、目录、命令开始或结束）以及窗格输出内容时，Tern 都会重绘 chrome。如果格式化器的结果依赖其输入以外的数据（时钟、文件、进程结果），那么在上述事件发生前，它会一直显示第一次得到的结果。将这些数据保存在上值中，并在数据变化后调用 `tern.chrome.refresh()`：

- 丢弃此窗口中所有格式化器（标签页标题、窗口标题、状态片段）的缓存结果。
- 唤醒窗口，并在下一帧重绘标签页、状态栏和标题，让每个格式化器都使用当前输入重新运行。

只有该窗口会刷新；每个窗口都有自己的 Window 端。在格式化器中调用 `refresh` 会触发 `tern.chrome.refresh: not from a formatter` 错误（否则每一帧都会再次运行格式化器）：请从计时器、进程或 fetch 回调、事件处理器或命令中调用它。

每秒更新一次的片段会在有内容需要计数时，通过 `tern.timer` 调用它；没有内容时则停止计时器，因此空闲窗口不会运行 Lua。[长时间运行的命令](../examples/longrun.md)以此显示聚焦窗格的运行时长。下面的[由进程提供数据的片段](#由进程提供数据的片段)会在每次轮询后刷新。

## 输入

`tab_title(tab)` 接收：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | `number` | 标签页 id。 |
| `name` | `string?` | 用户为标签页设置的名称。 |
| `cwd` | `string` | 聚焦窗格的目录；未知时为 `""`。 |
| `program` | `string` | 聚焦窗格中的程序。 |
| `title` | `string` | 聚焦窗格的标题。 |
| `panes` | `number` | 标签页中的窗格数。 |
| `busy` | `boolean` | 其中是否有窗格正在运行命令。 |

`window_title(win)` 接收：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `space` | `string` | 当前会话的名称（Tern 自带的窗口标题）。 |
| `tab` | `string?` | 当前活动标签页的标题。 |
| `pane` | `number?` | 聚焦窗格的 id。 |
| `cwd` | `string?` | 聚焦窗格的目录。 |
| `tabs` | `number` | 当前会话中的标签页数。 |

`status(pane)` 接收聚焦窗格：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `pane` | `number` | 窗格 id。 |
| `cwd` | `string` | 窗格目录；未知时为 `""`。 |
| `program` | `string` | 窗格中的程序。 |
| `title` | `string` | 窗格标题。 |

`cx.session:tabs()` 和 `cx.session:panes()` 返回的表，其结构分别与 `tab_title` 和 `status` 接收的表相同。远程主机上的窗格会报告该主机上的目录；`tern.fs` 读取的是窗口所在机器上的文件。

## 状态片段

状态格式化器返回片段表列表：

| 字段 | 必需 | 含义 |
| --- | --- | --- |
| `text` | 是 | 片段文本。 |
| `icon` | 否 | 显示在文本前的 Tern 图标名称；名称未知时不显示图标。 |
| `tone` | 否 | 颜色：`accent`、`muted`、`ok`、`warn`、`error`（或 `bad`）使用 Tern 样式；其他值只作为供 CSS 使用的属性值。 |
| `command` | 否 | 点击时运行的操作名称（`"new_tab"`、`"plugin.<plugin>.<id>"`）。 |

片段缺少 `text`，或列表项不是表，都会导致格式化器失败。`command` 会在片段被点击时解析；若无法解析，会显示 `A status segment's command is unknown` 提示。

片段会渲染在状态栏末尾、窗格尺寸之后：

```html
<footer id="statusline">
	…
	<span class="sl-plugins">
		<span class="sl-plugin" data-plugin="ID" data-tone="TONE">ICON TEXT</span>
		<span class="sl-plugin on" data-plugin="ID" role="button" title="COMMAND">…</span>
	</span>
</footer>
```

只有片段设置了 `tone` 时才会出现 `data-tone`。带有 `command` 的片段会获得 `on` 类、`role="button"` 以及作为工具提示的操作名称。只有状态栏处于开启状态时（通过 `status_bar` 命令），状态栏才会显示。

## Files 窗格按钮

`tern.files.button` 会在 Files 窗格的标题栏中、其自带工具旁边添加按钮；点击时会调用处理器，并传入窗格当前显示的文件夹及其选中项。它不像格式化器那样是纯函数：处理器会像命令一样接收 `cx`。参见[窗口 API](../reference/api-window.md#tern-files-button)。

```lua
tern.files.button({
	id = "copy-paths",
	title = "Copy selected paths",
	icon = "copy",
	run = function(files, cx)
		if #files.selection > 0 then
			cx:copy(table.concat(files.selection, "\n"))
		end
	end,
})
```

```html
<header class="ft-head">
	…
	<div class="ft-tools">
		…
		<span class="ft-plugins on">
			<button class="icon-btn ft-hb ft-rv ft-plugin" data-plugin="ID" data-id="BUTTON" title="TITLE">ICON</button>
		</span>
		<button class="icon-btn ft-hb ft-rv" title="More">…</button>
		…
	</div>
</header>
```

## 程序图标

每个标签页会为其中的每个窗格显示其所运行程序的图标：带图标的标签页显示应用图块，纯文本标签页、命令面板的窗格行和停放卡片显示扁平符号。`tern.chrome.program_icon(program, icon)` 可以为程序选择其他图标；用户也可以通过 `program_icons` 设置执行相同操作：

```lua
-- Codex tabs wear OpenAI's mark instead of Codex's tile.
tern.chrome.program_icon("codex", "provider-openai")
-- Neovim (not Vim) wears a sparkle; `nil` takes a choice back.
tern.chrome.program_icon("nvim", "sparkle")
```

```json
{ "program_icons": { "codex": "provider-openai", "nvim": "sparkle" } }
```

`program`（或设置中的键）是程序键或命令名称，匹配时不区分大小写。程序键是 Tern 从命令行、程序标题，或 surface 程序发送 `hello` 时使用的名称中检测到的值；每个图标也会携带该值作为 `data-program`。命令名称是正在运行的命令去掉目录后的首个词（`nvim`、`npm`；在 shell 提示符处则是 shell 名称，例如 `zsh`），即 `tab.program` 提供的值；不运行终端的块（files、git、browser）没有此值。程序键如下：

| 键 | 程序 |
| --- | --- |
| `shell` | shell 提示符处的 shell |
| `vim`、`helix`、`emacs`、`editor` | Vim 和 Neovim；Helix；Emacs；nano、micro、kakoune 及其他编辑器 |
| `btop`、`htop`、`top`、`monitor` | btop；htop；top；glances、k9s 等监控程序，以及任务管理器块 |
| `git`、`lazygit` | git、gh、tig 和 git 块；lazygit、gitui |
| `claude`、`codex`、`omp`、`hermes`、`gemini`、`copilot`、`cursor-agent`、`opencode`、`agent` | 编程代理；`agent` 用于其他代理（aider、amp、goose） |
| `cargo`、`node`、`bun`、`deno`、`python`、`ruby`、`java`、`go`、`lua`、`php`、`elixir`、`haskell`、`swift`、`zig`、`julia` | 语言、运行时及其工具（`node` 包含 npm、pnpm、vite；`python` 包含 pip、uv 和 notebook 块） |
| `docker`、`kubernetes`、`terraform`、`nix`、`packages` | 容器、集群、基础设施、Nix、系统包管理器 |
| `tmux`、`make`、`build`、`ssh`、`pager`、`database` | 多路复用器；make 和 just；其他构建工具；远程登录；分页器和 man；数据库 shell 和 SQLite 块 |
| `file`、`screen`、`board`、`carly` | 文件、screen、board 和 Carly 块 |
| `other` | 任何其他程序 |

窗格图标的选择顺序为：会话自己的图标（omp 的会话会设置图标）；第一个插件（按 id 排序）为其命令名称选择的图标；第一个插件为其程序键选择的图标；设置中为命令名称选择的图标；设置中为程序键选择的图标；最后是 Tern 自带图标。`icon` 可以是任意 Tern 图标名称（[图标名称](../elements/data.md#图标名称)），也可以是形如 `provider:<id>` 的提供商徽标。应用图块（`tile-*`）会替代卡片本身；其他图标会绘制在空白卡片上，并在纯文本标签页中以扁平符号显示。`program_icon` 遇到未知名称会报错；设置中的未知名称则会被跳过。Settings › Appearance › Program icons 可通过逗号分隔的 `program=icon` 对编辑此设置。

窗格的每个图标（`.tn-dk-c` 图块、`.tn-face` 扁平符号）都带有包含程序键的 `data-program`；如果图标由插件或设置选择，还会带有包含所选图标名称的 `data-icon`，因此 CSS 可以为某个程序的图标单独设置样式，无论图标以何种方式绘制：

```css
.tn-dk-c[data-program='codex'] { opacity: 0.6; }
```

## 全局 CSS

有两种来源会将样式表安装到机器上的每个窗口：

| 来源 | 样式表名称 | 时机 |
| --- | --- | --- |
| manifest `styles` | `plugin:local:<id>:styles` | 加载时，在窗口入口运行前。文件按顺序拼接（总大小最多 256 KiB）。没有窗口入口也能生效；即使窗口入口加载失败，也会保留。 |
| `tern.css(name, source)` | `plugin:local:<id>:<name>` | 创建该样式表的调用返回时：入口加载完成后，或调用它的处理器执行后。 |

`name` 只能包含 ASCII 字母、数字、`_` 和 `-`，且不能是 `styles`；否则会触发 `tern.css: bad name`。再次使用相同名称调用 `tern.css` 会原位替换该样式表，因此插件可以在运行时（从命令、事件或计时器中）重新设置样式。

远程主机上的插件也会为你的窗口添加样式：已连接主机上的每个 Ready 插件，只要其 manifest 含有 `styles`，就会以 `plugin:<slot>:<id>:styles` 的名称安装；其中 `<slot>` 是该主机在窗口中的编号。只有 manifest 样式会传输：`tern.css` 属于 Window 端，远程主机的 Window 端不会在你的窗口中运行。参见[分发](distribution.md#远程主机)。

Web 标签页不运行 Lua，因此 `tern.css` 样式表不会应用到其中。它会安装为其提供服务的守护进程所管理的 Ready 插件的 manifest `styles`，名称为 `plugin:0:<id>:styles`；该守护进程的插件重载时也会重新安装。

### 层叠顺序

插件样式表位于 Tern 自带样式表之后，因此特异性相同的规则会覆盖 Tern 的规则。样式表首次安装时会排在末尾；替换时则保留原有位置。重载时会移除所有 `plugin:local:*` 样式表并重新安装，先安装 manifest 样式，再安装 `tern.css` 样式表。插件之间（以及本地与远程主机的样式表之间）的顺序会随重载而变化；不要依赖此顺序，两个插件为相同元素设置样式时应使用特异性。用户的 [CSS 主题](themes.md#css-主题)排在所有插件样式表之后，会覆盖它们。

CSS 解析错误不会引发异常：系统会记录 `plugin style sheet has errors`，并附上样式表名称。

### 实用选择器

| 目标 | 选择器 |
| --- | --- |
| 插件的状态片段 | `#statusline .sl-plugin[data-plugin='<id>']`，以及 `[data-tone='…']` 和 `.on` |
| 插件的 Files 窗格按钮 | `.ft-head .ft-plugin[data-plugin='<id>']`，用 `[data-id='<button>']` 区分各个按钮 |
| 标签页、窗格行和停放卡片上的窗格程序图标 | `.tn-dk-c`（应用图块）和 `.tn-face`（扁平符号），以及 `[data-program='<key>']`（[程序图标](#程序图标)）、选择图标时出现的 `[data-icon='<name>']`、`[data-pane='<id>']` 和 `[data-st='waiting'\|'failed'\|'working'\|'done'\|'bell']` |
| 插件块的区域 | `.sf-main[data-surface='plugin.<plugin>.<block>']`，同理适用于 `.sf-dock` 和 `.sf-layer` |
| 块或 Lens 视图的节点 | `.sf-<kind>`（`.sf-table`、`.sf-badge`、`.sf-card` 等）；来自节点 `role` 属性的 `[data-role='…']` |
| Lens 块 | `.sf-block[data-role='lens.plugin.<plugin>.<lens>']`，以及 `[data-state='running']` 或 `[data-state='done']`；退出失败后还会有 `.failed` |

插件块的类型在 CSS 中表现为其区域元素的 `data-surface` 属性，而不是 `data-role`：`data-role` 属于内部节点，这些节点各自带有 `role` 属性。

为自己的节点设置 `role`（任何节点都可设置），然后按它设置样式：role 名称由你决定，`[data-role='myplugin.row']` 不会与 Tern 的样式冲突。Tern 的样式表通过 `--accent`、`--t1` 至 `--t4`（文本颜色由强到弱）、`--ok`、`--warn` 和 `--bad` 等变量设置颜色；使用这些变量可以让插件样式在浅色和深色主题中都保持协调。在 `--accent-fill` 上绘制白色文本或字形；该变量会将主题强调色加深，直到白色在其上清晰可读；`--accent` 本身则用于轮廓环、浅色填充和边框。

### 图片：`url()`

全局样式表中的 `url()` 指定插件内的文件：路径相对于插件目录（即存放 `plugin.toml` 的目录，不论规则位于哪个 `styles` 文件中），例如 `url(icons/ts.svg)` 或 `url('./icons/ts.svg')`。Tern 会在安装样式表时解析路径；manifest `styles` 和 `tern.css` 样式表都适用。无论有多少规则和行使用同一图片，每张图片只加载一次。

- `background-image` 可以绘制 SVG、PNG、JPEG、GIF、WebP、BMP、ICO 和 TIFF 文件（动画只显示首帧），每边最多 4096 px。SVG 会按显示比例栅格化；栅格图像的 CSS 尺寸等于其像素尺寸。`background-size`、`-position` 和 `-repeat` 照常生效。
- `data:` URL（`data:image/svg+xml,…`，可使用 base64 或百分号编码）可在任何地方使用，也可用于远程主机的样式表；`url(#id)` 过滤器引用会保持原样。
- 以下 URL 会被拒绝，并按 URL 记录一次 `plugin style sheet url() …`，同时附上插件 id：绝对路径、其他方案（`https:`、`file:`）、`..`、指向插件目录以外的链接、缺失文件，以及远程主机样式表中的任何文件 `url()`（文件位于远程主机上）。被拒绝的 `url()` 不会绘制内容；该规则的其余部分仍然生效。
- 路径按字面处理：不会进行百分号解码，且会忽略 `?query` 或 `#fragment`。
- `url()` 也可用于自定义属性（例如 `--icon: url(a.svg)`，然后使用 `background-image: var(--icon)`）：解析位置为声明该属性的位置。
- `mask-image` 仅接受渐变：其中的 `url()` 虽能解析，但不会产生遮罩；因此，需要为单色图标着色时，应直接提供已着色的图标。

### 文件图标

Files 窗格的行会标明其条目名称，因此样式表可以像 VS Code 图标主题一样，为每个条目设置专属图标。每一行 `.ft-row` 及其图标框 `.ft-ic`（14×14 px，包含内置的 `svg.ico`：Tern 为该条目提供的图标；Material Icon Theme 的字形则使用行文本颜色）都带有：

| 属性 | 值 |
| --- | --- |
| `data-name` | 条目名称，转换为小写：`cargo.lock`、`.env`、`foo.test.ts`。紧凑文件夹链行（`crates/tern/src`）使用链中最后一个文件夹的名称。 |
| `data-ext` | 名称最后一个点之后的文本，转换为小写且不含点：`lock`、`ts`、`gz`（`archive.tar.gz`）。文件夹、`.env` 等点文件、无扩展名的名称（`justfile`）以及以点结尾的名称，其值为空。 |
| `data-kind` | `dir` 或 `file`（链接按其指向的对象计算）。 |
| `data-open` | 仅文件夹有此属性：展开时为 `true`，折叠时为 `false`。 |

本地和远程根目录都符合上述规则，滚动时属性也会随行移动。`.ft-ic` 的 `background-repeat: no-repeat`、`background-position: center` 和 `background-size: contain` 已设置好，因此主题只需设置 `background-image` 并隐藏内置字形：

```css
/* every file without a better match */
.ft-ic[data-kind='file'] { background-image: url(icons/file.svg); }
/* by extension */
.ft-ic[data-kind='file'][data-ext='ts'] { background-image: url(icons/typescript.svg); }
/* by a multi-part extension: a suffix match */
.ft-ic[data-kind='file'][data-name$='.test.ts'] { background-image: url(icons/test-ts.svg); }
/* by exact name */
.ft-ic[data-kind='file'][data-name='cargo.lock'] { background-image: url(icons/lock.svg); }
/* folders, collapsed and expanded, by name */
.ft-ic[data-kind='dir'] { background-image: url(icons/folder.svg); }
.ft-ic[data-kind='dir'][data-open='true'] { background-image: url(icons/folder-open.svg); }
.ft-ic[data-kind='dir'][data-name='src'] { background-image: url(icons/folder-src.svg); }
.ft-ic[data-kind='dir'][data-name='src'][data-open='true'] { background-image: url(icons/folder-src-open.svg); }
/* hide the stock glyph wherever the theme paints */
.ft-ic[data-kind] > svg.ico { display: none; }
```

匹配到多条规则时由特异性决定结果，因此主题应像上例那样由通用到具体排列，与 VS Code 的解析方式相同：先精确名称（`fileNames`、`folderNames` / `folderNamesExpanded`），再匹配最长后缀（`data-name` 上的 `$=`），然后匹配扩展名（`fileExtensions`），最后匹配默认项（`file`、`folder` / `folderExpanded`）。每个属性都会增加相同的特异性，因此可以给更具体的规则增加一个属性（`[data-kind='file']`），或将其放在样式表靠后的位置。匹配名称时使用小写形式，因为属性值均为小写。根据图标主题的 JSON 生成样式表，只需遍历其中的映射；即使主题包含一千条规则，也只会加载可见行所使用的图标。

## 示例

### 标签页和窗口标题

```lua
local function basename(path: string): string
	return string.match(path, "([^/]+)/*$") or path
end

tern.chrome.tab_title(function(tab)
	if tab.name then
		return nil
	end
	local cwd = tab.cwd or ""
	local dir = if cwd == "" then "~" else basename(cwd)
	local label = if tab.program == "" then dir else dir .. " · " .. tab.program
	if tab.panes > 1 then
		label ..= string.format(" (%d)", tab.panes)
	end
	return label
end)

tern.chrome.window_title(function(win)
	if win.tab == nil then
		return nil
	end
	return win.space .. " — " .. win.tab
end)
```

### 显示聚焦目录的片段

片段只依赖 `pane.cwd`，而它属于输入，因此缓存方式恰到好处：每个目录只读取一次文件。

```lua
local function first_word(path: string): string?
	if not tern.fs.exists(path) then
		return nil
	end
	local ok, text = pcall(tern.fs.read, path)
	if not ok then
		return nil
	end
	return string.match(text, "^%s*(%S+)")
end

tern.chrome.status(function(pane)
	local cwd = pane.cwd
	if cwd == nil or cwd == "" then
		return nil
	end
	local version = first_word(cwd .. "/.nvmrc")
	if version == nil then
		return nil
	end
	return { { text = "node " .. version, tone = "muted" } }
end)
```

### 由进程提供数据的片段

此插件每分钟调用一次 `gh`，查询等待审核的拉取请求数量；每次收到结果后调用 `tern.chrome.refresh()`，让片段显示最新数量。点击片段会运行插件的命令。

```lua
local pending: number? = nil

local function segments(_pane: PaneInfo): { StatusSegment }?
	if pending == nil or pending == 0 then
		return nil
	end
	return {
		{ text = tostring(pending) .. " to review", icon = "branch", tone = "accent", command = "plugin.reviews.open" },
	}
end

local function poll()
	tern.process.run({ "gh", "search", "prs", "--review-requested=@me", "--state=open", "--json", "number" }, { timeout_ms = 15000 }, function(result, _cx)
		if result.status == 0 then
			local ok, list = pcall(tern.json.decode, result.stdout)
			if ok then
				pending = #list
				tern.chrome.refresh() -- drops the cached segments and redraws
			end
		end
		tern.timer(60000, poll)
	end)
end

tern.chrome.status(segments)
tern.command({
	id = "open",
	title = "Open review queue",
	run = function(cx)
		cx:open("https://github.com/pulls/review-requested")
	end,
})
poll()
```

在 iOS 上调用 `tern.process.run` 会引发错误；面向 iPad 的插件应先检查 `tern.runtime.os`。参见[文件、进程与存储](io.md)。

### 设置片段和块的样式

`plugin.toml`：

```toml
styles = ["reviews.css"]
```

`reviews.css`：

```css
#statusline .sl-plugin[data-plugin='reviews'] {
	padding: 0 6px;
	border-radius: 4px;
	background: var(--accent-fill);
	color: white;
}

.sf-main[data-surface='plugin.reviews.queue'] [data-role='reviews.stale'] {
	color: var(--t4);
}
```

Window 端还可以在运行时切换样式表：

```lua
local compact = false

tern.command({
	id = "compact",
	title = "Toggle compact review rows",
	run = function(_cx)
		compact = not compact
		tern.css("density", if compact then ".sf-main[data-surface='plugin.reviews.queue'] .sf-item { min-height: var(--sf-lh); }" else "")
	end,
})
```

## 另请参阅

- [构建视图](views.md)：节点类型、`role` 和 `tone` 属性。
- [设置视图样式](../styles/index.md)：视图节点的钩子、[CSS 变量](../styles/variables.md)和[支持的 CSS](../styles/css.md)。
- [命令、按键与覆盖](commands.md#动作名称)：片段 `command` 使用的操作名称。
- [窗口 API](../reference/api-window.md)：`TabInfo`、`PaneInfo`、`StatusSegment`。
- [限制](../reference/limits.md)：时间预算和样式大小限制。
- [自定义主题](themes.md)：使用 CSS 文件而非插件，为 Tern（包括其终端调色板）重新着色和设置样式。
