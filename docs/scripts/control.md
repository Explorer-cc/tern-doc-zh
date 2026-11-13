# 控制命令

控制命令通过 `tern ctl` 检查并驱动正在运行的 Tern 窗口或无头服务器。你可以用它们检查插件 UI、查看应用状态、无需重新构建即可调整窗口样式，或测量渲染性能。与普通场景命令不同，大多数检查会立即回复，而不是等待动画稳定。

## 连接与回复

| 命令 | 作用 |
| --- | --- |
| `tern serve [--control <endpoint>] [--out <dir>]` | 启动无头控制服务器。 |
| `tern --control <endpoint> [ARGS]` | 打开带有控制端点的桌面窗口。 |
| `tern ctl [--control <endpoint>] <command...>` | 发送一行命令并打印其 JSON 回复。 |
| `tern ctl [--control <endpoint>] --file <scenario>` | 在一个连接上逐行发送每条非空、非注释行，并等待其回复后再发送下一行。 |

端点是套接字路径，或 `127.0.0.1` 上的数字 TCP 端口。端口 `0` 会要求服务器选择一个空闲端口。默认值在 Unix 上是 `/tmp/tern.sock`，在 Windows 上是用户临时目录中的 `tern.sock`。Windows 套接字端点要求 Windows 10 1803 或更高版本。可以有多个客户端连接；命令逐个运行。

在 Tern 窗格中，不带 `--control` 的 `tern ctl` 不需要端点：会话守护进程会将每一行中继给本机显示该窗格的 Tern 窗口，由该窗口自行运行命令（包括 `state`、world 命令和 `quit`），并像端点一样回复。如果没有这样的窗口（窗格只由另一台机器上的窗口显示，或其窗口已关闭），回复为 `{"ok":false,"error":"…"}`。在窗格中运行 `tern ctl --control <endpoint>` 仍会发送到该端点。

线路协议是一行命令，后跟一行 JSON 回复：

- 无结果：`{"ok":true}`。
- 对象结果：其字段合并到 `{"ok":true,...}` 中。
- 其他任何结果：`{"ok":true,"value":...}`。
- 失败：`{"ok":false,"error":"..."}`。

`--file` 会打印每条命令及其回复的前 400 个字符，并在第一条不成功的回复处停止。底层回复不会截断。测试框架的等待和应用命令的稳定等待会控制文件的发送节奏；检查命令不会增加等待。`tern shot` 不接受仅限控制的命令。

控制语法不同于[场景语法](index.md#语法)：`dump`、`tree` 和 `webreports` 将剩余整行作为选择器，不会去掉引号。`webcall` 将第一个 `{` 之前的所有内容作为选择器，并将其余部分解析为 JSON。`css` 将第一个词作为样式表名称，并将该行余下内容作为路径，路径可以包含空格。不要为这些参数添加脚本引号或尾随注释。

## 检查窗口

| 命令 | 作用 |
| --- | --- |
| `dump [<selector>]` | 返回屏幕截图布局 JSON：元素路径、框和计算后的几何信息；提供选择器时，结果仅包含具有几何信息的匹配项。 |
| `tree [<selector>]` | 返回可见元素树，或返回带有文本、值、焦点以及 Web 视图地址/标题的可见匹配项。 |
| `pick <x> <y>` | 返回视口坐标点上的元素及其几何信息和相关样式。 |
| `state` | 返回 Tern 的应用状态。 |
| `stats` | 返回时钟、帧、文档大小、视口/缩放、指针、解析后的光标、动画、插入符、下一个计时器、传出拖动和 Web 视图。 |
| `layers` | 按绘制顺序返回 `count` 和 `layers`，其中包含深度、边界、不透明度、变换、裁剪、遮罩、滤镜和背景效果。 |
| `a11y` | 返回以窗口为根节点的无障碍树。 |
| `menus` | 返回原生菜单栏、Dock、托盘和打开的上下文菜单行。 |
| `system` | 返回系统集成状态和近期的一次性请求。 |

坐标和无障碍边界使用视口 CSS 像素。`pick` 必须且只能接收两个数字。无效的选择器会导致回复失败。不带参数的命令会拒绝参数；带参数的 `a11y` 则会执行测试框架的无障碍操作，详见[测试框架命令](harness.md)。

无障碍节点包含 `id`、`role`，以及可选的 `name`、`description`、`value`、`placeholder`、`states`、`level`、`posinset`、`setsize`、`bounds`、`actions` 和 `children`。空字段和文本字段的文本片段会省略。菜单操作包含 id、标签、启用/选中状态和快捷键；子菜单包含 `items`。`system` 包含对话框、通知、徽章、进度、标题、已编辑/所代表的文档、近期文档、快捷键、睡眠、安全输入、强调色、显示器、机密信息和请求日志。无头模式下的系统集成是模拟的；检查它们不会应答对话框。

这些快照描述 UI 和 host 状态，而不是单独的 Tern `state` 字段。例如，使用 `stats` 查看指针或传出拖动，使用 `menus` 查看原生菜单，使用 `system` 查看待处理的对话框。

### Tern 状态字段

`state` 会将以下顶层字段合并到成功回复中。关闭或非活动的功能可能为 `null` 或空值。

| 字段 | 描述 |
| --- | --- |
| `tabs`, `focused`, `panes`, `sessions`, `decks`, `tabs_out` | 标签页、聚焦的终端、窗格网格尺寸以及会话/导航布局。 |
| `palette`, `palette_scope`, `find`, `menu`, `picker`, `pane_drag`, `focused_element` | 已打开的导航 UI、搜索和元素焦点。 |
| `theme_dark`, `theme_light`, `theme_preview`, `theme` | 所选主题和预览。 |
| `layout`, `tab_orientation`, `tab_badges`, `status_bar`, `pane_headers` | 窗格和标签页的呈现方式。 |
| `material`, `opacity`, `blur`, `glass_hud`, `density`, `viewport`, `csd` | 窗口外观、视口和装饰。 |
| `font`, `ui_font`, `font_family`, `face`, `faces` | 终端和界面字体大小、请求的字体系列，以及按样式解析出的字体。 |
| `inbox`, `hosts`, `prefs`, `peek`, `pips`, `pip_commits`, `files` | 特定功能的状态。 |
| `file_blocks`, `task_manager_blocks`, `screen_blocks`, `sqlite_blocks`, `board_blocks`, `profile_blocks` | 特定块的状态。 |
| `quicklook`, `lightbox`, `term_link`, `gate`, `melt` | 预览、链接、账户门禁和屏幕效果状态。 |
| `git_blocks`, `notebook_blocks`, `carly` | 仅桌面版的块和助手状态；Web 和 iOS 上不存在。 |
| `update` | 更新状态；iOS 上不存在。 |

`focused` 包含窗格 id、标签、工作目录、git 状态、运行中的命令、忙碌状态、上一个命令/状态、退出/错误状态、提示符就绪状态和选中的终端文本。`viewport` 反映调整大小；CSS 补丁、性能分析和 web 调用没有专用的 Tern 状态字段。

## CSS 补丁

| 命令 | 作用 |
| --- | --- |
| `css` | 按级联顺序列出包含 `name` 和 `rules` 的 `sheets`。 |
| `css <name> <path>` | 读取 CSS 文件并替换指定样式表，或追加一个新补丁。 |
| `css <name>` | 删除所有同名样式表，包括内置样式表。 |
| `css reload [<dir>]` | 重新读取每个样式表的文件，并替换其中发生更改的样式表。 |

`tern ctl` 会发送绝对路径（相对于其运行目录解析）；通过原始连接发送时，相对路径则相对于正在运行的应用工作目录解析。`css reload` 会从 `<dir>` 或某个父目录查找内置样式表文件（只有开发者构建会记录其在 Tern 源代码树中的路径），因此请在检出目录中运行 `tern ctl css reload`。它会返回 `reloaded`（每个样式表及其 `errors`）、`failed`（无法读取的文件）和 `unchanged` 数量。

替换样式表会保留其级联位置；新样式表会排在最后，并在特异性相同时覆盖之前的规则。加载时会回复 `sheet`、`rules` 和 `errors`（`file`、`line`、`column`、`message`）。无效 CSS 规则会被丢弃，但其余规则仍会生效：解析错误不会导致回复失败；无法读取文件则会失败。删除时会回复 `dropped`。成功应用补丁会安排一个实时帧或绘制一个无头帧；它不会等待动画结束。请检查 `css` 或 `dump`，而不是 `state`，以确认补丁。

## 测量帧与跟踪

| 命令 | 作用 |
| --- | --- |
| `perf` | 返回自上次重置以来的帧计时数据。 |
| `perf on` | 开始新一轮采集；如果可用，会采集 GPU 时间戳。 |
| `perf off` | 停止无头计时；桌面窗口仍会保留 CPU 计时。 |
| `perf reset` | 重新开始现有采集。 |
| `perf mark` | 开始为后续帧计数，以供 `perf since` 使用。 |
| `perf since` | 返回标记之后的计时数据，包括 `settled`。 |
| `trace` | 返回 `recording` 字段，其值为跟踪文件路径或 `null`。 |
| `trace start [<directives>]` | 开始进程范围的 Chrome 跟踪并返回 `path`。 |
| `trace stop` | 完成跟踪并返回 `path`、`events` 和 `bytes`。 |

无头计时必须先通过 `perf on` 启用，之后才能使用 `perf`、`perf mark` 或 `perf since`；`perf reset` 不会启用它。实时模式下，`on`、`off` 和 `reset` 会重置采集并回复 `gpuTiming`；`off` 会禁用 GPU 计时。没有标记时，`perf since` 会失败。帧不再请求新帧之前，`settled` 为 `null`；此后它会报告截至该帧累计的帧数、时间和工作量。它会观察稳定状态，但不会等待稳定。

跟踪指令用于筛选记录的 span/事件；不提供指令时，默认记录 Stencil span、粗粒度 git span 和依赖警告。例如：`trace start stencil_ui=trace,warn`。
在 `ui.perfetto.dev` 中打开生成的跟踪。已在录制时再次启动、指令无效或文件出错都会失败；未录制时停止也会失败。这些测量通过单独回复返回，不属于 Tern 状态。

## 视口与生命周期

| 命令 | 作用 |
| --- | --- |
| `resize <width> <height>` | 设置无头视口或实时窗口内容尺寸，不等待稳定。 |
| `thaw` | 恢复被 `freeze-anims` 或 `motion-at` 停止的文档时间线。 |
| `quit` | 停止无头服务器或关闭实时应用。 |

`resize` 必须且只能接收两个数字，且两者都至少为 1 个 CSS 像素。无头模式下调整大小会保留设备缩放并绘制一帧。在控制端点上，它表示调整窗口大小，而不是 Tern 的窗格调整大小命令。`thaw` 是测试框架命令，不是仅限控制的检查命令；它不接收参数。使用 `stats` 查看时间线/帧活动，使用 `state.viewport` 查看视口尺寸。

以下序列对应 bell-ripple golden；通过 `ctl --file` 发送它，以捕获一个保持中的效果及其静止帧：

```text
ready
freeze-anims
feed "goldens/fixtures/bell.txt"
motion-at 120
shot bell-held
thaw
wait 1300
shot bell-rest
stats
```

## 驱动网页

| 命令 | 作用 |
| --- | --- |
| `webcall <selector> <json>` | 调用第一个匹配且嵌入 Web 视图的元素中的页面；回复其答案。 |
| `webreports <selector>` | 在 `reports` 中按从旧到新的顺序返回近期驱动页面的报告。 |

这两个命令都要求实时窗口；无头会话会失败并提示“a headless session shows no pages”。找不到页面或选择器无效都会失败。`webcall` 会实时等待原生页面的答案，并遵循 Tern 的 20 秒条件超时；答案只会发送给控制客户端。`webreports` 会跨页面保留最近几百条报告。报告包括消息、帧、对话框、选择器、下载、响应、已提交/已加载的导航和被阻止的请求。请使用这些回复而不是 `state` 来检查调用。

JSON 对象必须包含 `op`。除非另有说明，可选字段可以缺失或为 `null`。未知操作、无效名称、缺少必需字段或字段类型错误都会失败。以下列出了所有可接受的操作；括号内的字段为可选项。

| 命令 | 作用 |
| --- | --- |
| `webcall <selector> {"op":"eval","function":<string>}` | 计算函数表达式；可选 `args` 数组（默认 `[]`）、`world`（`page\|isolated`，默认 `page`）和 `frame` 字符串。回复 `value`；如果 JavaScript 返回 `undefined`，则不带值。 |
| `webcall <selector> {"op":"capture"}` | 捕获图像；可选 `rect`（`x`、`y`、`width`、`height`）、`full`（false）、`scale`（1）、`format`（`png\|jpeg\|jpg`，默认 `png`）和 `quality`（80）。JPEG 质量值会四舍五入并限制在 1–100。回复 base64 `data`、`mime`、`width`、`height`。 |
| `webcall <selector> {"op":"pdf"}` | 回复 base64 `data` 和 `mime`。 |
| `webcall <selector> {"op":"input","events":<array>}` | 使用下方列出的事件形式注入页面输入。 |
| `webcall <selector> {"op":"edit","action":<copy\|cut\|paste\|selectAll\|undo\|redo>}` | 执行页面编辑操作。 |
| `webcall <selector> {"op":"cookies"}` | 回复 `cookies` 数组。 |
| `webcall <selector> {"op":"setCookie","cookie":<object>}` | 设置 Cookie；必须提供 `name`、`value`、`domain`；可选 `path`（`/`）、`expires`（Unix 秒）、`httpOnly`（false）、`secure`（false）和 `sameSite` 字符串。 |
| `webcall <selector> {"op":"deleteCookie","name":<string>,"domain":<string>}` | 删除 Cookie；可选 `path`，默认值为 `/`。 |
| `webcall <selector> {"op":"scripts","scripts":<array>}` | 替换注入脚本：每个脚本都必须有 `source`；可选 `world`（`page\|isolated`，默认 `page`）、`frames`（`main\|all`，默认 `main`）和 `at`（`start\|end`，默认 `start`）。 |
| `webcall <selector> {"op":"agent"[,"value":<string\|null>]}` | 覆盖用户代理，或清除覆盖值。 |
| `webcall <selector> {"op":"media"[,"value":<string\|null>]}` | 覆盖媒体设置，或清除覆盖值。 |
| `webcall <selector> {"op":"appearance"[,"value":<dark\|light\|null>]}` | 覆盖页面外观，或清除覆盖值。 |
| `webcall <selector> {"op":"dialogs","report":<bool>}` | 启用或禁用对话框报告。 |
| `webcall <selector> {"op":"dialog","accept":<bool>}` | 回答页面对话框；可选 `text` 用于提供提示文本。 |
| `webcall <selector> {"op":"files"[,"paths":<array\|null>]}` | 提供文件选择器路径，或取消操作。 |
| `webcall <selector> {"op":"downloads"[,"dir":<string\|null>]}` | 设置或清除下载目录。 |
| `webcall <selector> {"op":"allow"[,"hosts":<array\|null>]}` | 设置或清除允许的主机列表。 |
| `webcall <selector> {"op":"credentials"[,"username":<string>,"password":<string>]}` | 设置身份验证凭据；两者均缺失/为 null 时会清除凭据，只提供其中一个则会失败。 |
| `webcall <selector> {"op":"insecure","value":<bool>}` | 更改不安全连接许可。 |

没有列出结果的操作只返回成功。页面输入接受以下形式：

- `{"type":"mouse","action":"move|down|up","x":N,"y":N}`；可选 `button` 为 `left|right|middle`（默认 `left`），`clicks` 在 move 时默认为 0，其他情况下默认为 1，并限制/截断到 0–16。
- `{"type":"wheel","x":N,"y":N}`，可选 `dx`、`dy`（均默认为 0）。
- `{"type":"key","action":"down|up","key":"..."}`，可选字符串 `code` 和 `text`。
- `{"type":"text","text":"..."}`。

鼠标、滚轮和按键事件接受 `mods`，这是一个包含 `shift`、`ctrl|control`、`alt|option` 和 `meta|cmd|command` 的数组（默认为空）。原生页面能力因平台而异；成功解析调用并不保证宿主支持它。macOS、Linux 和 Windows 上都可以驱动页面。在 Windows（WebView2）上，另一进程渲染的框架（例如跨站框架）无法访问：对其使用 `frame` 的 `eval` 会失败，且不会报告其消息；`credentials` 只响应 HTTP 基本身份验证。这里不接受 `snapshot` 和 `act` 等 Tern 浏览器操作；请使用[浏览器块](browser.md)。

## 另请参阅

- [脚本](index.md)：运行、测试夹具和计时。
- [测试框架命令](harness.md)：输入、屏幕截图和时间线控制。
- [浏览器块](browser.md)：Tern 专用的浏览器驱动程序。
- [调试](../guides/debugging.md#通过脚本驱动-window)：插件 UI 工作流程。
