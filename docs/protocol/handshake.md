# 握手

程序通过一次查询即可确定其终端是否支持 TSP，以及支持哪些功能。

## 检测

发送 `hello` 查询，后跟 DA1 请求（`ESC [ c`），每个终端都会对此作出响应：

```text
ESC _ tsp;q;{"q":"hello","v":[1],"app":"omp","ver":"14.2.0","features":["edit","undo","send"]} ESC \  ESC [ c
```

支持 TSP 的终端会在 DA1 回复之前，通过类似任何终端报告的输入回复查询。若 DA1 回复之前没有 `tsp;r`，则表示不支持 TSP：继续使用你自己的渲染器。

| 字段 | 含义 |
| --- | --- |
| `v` | 你支持的协议版本。Tern 仅支持 `1`：如果查询列表中没有该版本，则完全不会回复，因此应视为不支持 TSP。 |
| `app` | 你的程序名称。当你的某个 surface 打开并正在监听时，Tern 会将该程序显示为窗格正在运行的程序（其图标会显示在标签页和命令面板中），即使命令启动后才连接的窗口也是如此。 |
| `ver` | 你的程序版本。Tern 不使用此字段。 |
| `features` | 你在 v1 之外处理的功能（见下文）。未知名称会被忽略。 |

每次 `hello` 都会替换上一次声明的内容：后续的 `hello` 若未包含 `app` 或 `features`，就会清除它们。程序退出后（Shell 出现下一个提示符、窗格进程退出或终端重置时），Tern 会忘记这两项；并且仅在你的某个 surface 打开且正在监听时应用它们。

程序功能：

| 功能 | 含义 |
| --- | --- |
| `edit` | 你会应用 `edit` 事件，因此 Tern 可以在你的编辑器中保留原生选择（[原生编辑](input.md#原生编辑)）。 |
| `undo` | 你会应用 `undo` 事件，因此 Tern 可以在其中接管撤销快捷键。 |
| `send` | 你会通过 composer 的常规提交路径提交 `send` 事件提供的文本。这是一项能力，并不代表已就绪：目标字段还必须报告 `sendable:true`。 |

快照会先重放 hello，因此窗口重启后 `app` 名称和功能仍会保留。

### 在 tmux 中

tmux 会立即自行从其窗格回复 DA1，并且默认将每个 APC 正文用作窗格标题，因此上面的探测在其中无法工作。Tern 会绘制在 Tern 窗格中运行的普通 tmux 的 TSP 程序，并在此期间设置 tmux 会话选项 `@tern-tsp`。在 tmux 内（已设置 `TMUX`）：

1. 运行 `tmux show-options -qv @tern-tsp`。没有输出或命令失败，表示不支持 TSP：Tern 不会绘制此会话。
2. 在发送第一个 TSP 字节之前，运行 `tmux set-option -p -t "$TMUX_PANE" allow-set-title off`。
3. 发送 `hello`，不要附带 `ESC [ c`，并等待最多一秒以获取回复；没有回复则表示不支持 TSP。
4. 停止使用 TSP 时（退出时或没有收到回复时），恢复窗格标题设置：`tmux set-option -pu -t "$TMUX_PANE" allow-set-title`。

## 回复

```json
{"r":"hello","v":1,"term":"tern","ver":"0.4.3",
 "kinds":["col","row","card","section","rule","spacer","text","md","code","diff","ansi","math",
  "image","media","kv","stats","table","tree","json","badge","kbd","icon","spinner","shimmer","elapsed","progress",
  "rate","list","item","tabs","editor","input","button","status","seg","overlay","toast","rows","picker","prefs",
  "tool","checklist","agent","chart","meter","block","effort","select","switch","slider","field","otp",
  "buttons","avatar","avatars","breadcrumb","pager","empty","skeleton","calendar","date","menu","menubar",
  "nav","split","scroll","carousel","message","attachment","trace","stacktrace","suggestions","questions","el"],
 "features":["blobs","settle","adopt","dock","reduce-motion","aside","scroll","styles","flow","font"],
 "apc":65536,"credits":2,
 "cols":120,"cell":{"w":8,"h":17},"dark":true,"reduceMotion":false,"hour12":false}
```

| 字段 | 含义 |
| --- | --- |
| `v` | 终端从你的列表中选定的版本（`1`）。 |
| `term`, `ver` | 终端及其版本：`tern`，以及与 `TERM_PROGRAM_VERSION` 相同的版本。 |
| `kinds` | 终端绘制的所有节点类型（[元素](../elements/index.md)）。按类型回退：未列出的类型可以用其他方式描述，也可以用预渲染的 `rows` 表示。 |
| `features` | 单靠节点类型无法体现的行为（见下文）。 |
| `apc` | 单条消息可发送的最大正文长度（65536 字节）；更大的正文需[分块](transport.md#分块)。 |
| `credits` | 允许有多少帧尚未确认（2；[流量控制](operations.md#流控)）。 |
| `cols`, `cell` | 窗格的列宽和单元格像素尺寸。仅在使用 `rows` 回退和判断 ANSI 宽度时需要；`resize` 事件会更新它们。 |
| `dark` | 终端是否显示深色外观（`theme` 事件会更新此值）。 |
| `reduceMotion` | 是否启用了减少动态效果（Reduce Motion）（`motion` 事件会更新此值）。启用时，你可以省略仅用于动态效果的节点。 |
| `hour12` | 用户的系统是否使用 12 小时制（`3:05 PM`），而不是 24 小时制（`15:05`）：该值取自窗口的区域设置（macOS 的“24 小时制”、Windows 的短时间格式、GNOME 或 Cinnamon 的时钟格式；否则在 Linux 上取自 `LC_TIME`），即使你的程序运行在另一台机器上也是如此。请据此格式化显示的时间（在 JavaScript 中使用 `toLocaleTimeString` 的 `hour12`）；你自己的进程区域设置可能无法反映这一设置。 |

终端功能：

| 功能 | 含义 |
| --- | --- |
| `blobs` | `b` 动词和 `blobs` 查询。 |
| `settle` | `settle` 操作（[帧操作](documents.md#帧-ops)）是一个有用的提示。 |
| `adopt` | `o` 搭配 `adopt:true` 可重新打开已关闭的 surface（[Surface](surfaces.md#打开与关闭)）。 |
| `dock` | `dock` 区域固定在窗格底部（[区域](surfaces.md#区域)）。 |
| `reduce-motion` | 会报告 `reduceMotion` 字段和 `motion` 事件。 |
| `aside` | 内联 surface 的 `layer` 中的 `prefs` 节点会停靠在窗格旁边（[区域](surfaces.md#区域)）。 |
| `scroll` | `scroll` 操作（[帧操作](documents.md#帧-ops)）。 |
| `styles` | `s` 动词（[样式表](theme.md#样式表)）。 |
| `flow` | `mode:"flow"` surfaces（[模式](surfaces.md#模式)）和 `listen:false`（[打开与关闭](surfaces.md#打开与关闭)）。 |
| `font` | `o` 可接受 `font:"sans"`，以 UI 字体绘制 surface（[打开与关闭](surfaces.md#打开与关闭)）。不具备此功能的 Tern 会以等宽字体绘制所有 surface。 |

## 其他查询

`blobs` 用于询问 Tern 已持有哪些 blob，以便程序重启后只重新发送缺失的内容：

```text
→ ESC _ tsp;q;{"q":"blobs","ids":["9f86d0…","2c26b4…"]} ESC \
← ESC _ tsp;r;{"r":"blobs","have":["9f86d0…"]} ESC \
```

`ids` 是 blob 的 ID，即每个 blob 字节的 SHA-256 小写十六进制值（[Blob](transport.md#blob)）。`have` 按你请求的顺序列出 Tern 持有的 blob：它们可能在内存中，也可能在磁盘的 blob 缓存中；若在缓存中，Tern 会随后加载。请求即视为使用：Tern 清除未被引用的 blob 时会按最近最少使用优先，因此刚刚请求的 blob 会最后被清除。

Tern 不会回复其他查询：未知的 `q` 不会得到回复。正文不是有效 JSON 的 `q`（或任何消息）会产生 `error` 事件，例如 `{"ev":"error","msg":"malformed q body: …"}`。

## 不等待回复即启动

等待回复会因一次往返而延迟首次绘制。当环境变量表明正在使用 Tern（`TERM_PROGRAM=tern`），且你不在多路复用器内（包括 tmux）时，可以基于假定的 v1 能力同时发送 `o` 和首个 `f`：支持所有类型，`apc` 为 65536，`credits` 为 2，`cols` 取自终端尺寸，`reduceMotion` 和 `hour12` 为 false。查询发出前先将 tty 切换为原始输入模式，以免 Tern 的事件被规范模式的 tty 回显。回复到达后仍以其内容为准：其 `kinds`、`apc`、`credits` 和外观设置会替换上述假设。如果 DA1 已回复但没有 TSP 回复，或者一秒内未收到回复，则关闭 surface（`x` 搭配 `keep:false`），并使用你自己的渲染器绘制。omp 采用这种启动方式。

## 环境与退出选项

- Tern 会为每个窗格设置 `TERM_PROGRAM=tern` 和 `TERM_PROGRAM_VERSION`：无论窗格位于窗口、会话守护进程中，还是位于通过 `tern remote` 访问的守护进程中，都是如此。环境变量不会通过 ssh 传递；查询可以，因此握手才是判断依据。
- Tern 的“Native program surfaces”设置会关闭 TSP：此时 Tern 永远不会回复 `hello`，并会忽略所有 TSP 消息。插件块和画布由 Tern 自身管理，仍会继续绘制。
- `TERN_BLOB_DIR` 指定 Tern blob 缓存目录的位置，该目录位于程序运行的机器上，可用于不经 pty 传递 blob（[通过 Tern 的 blob 缓存](transport.md#通过-tern-的-blob-缓存)）。
- screen 和 zellij 会吞掉 APC 字符串。在其中运行时，不要进行探测。
- 在 tmux 内，仅当会话设置了 `@tern-tsp` 选项时才进行探测（[在 tmux 中](#在-tmux-中)）。
- 为用户提供独立开关，以强制使用你自己的 ANSI 渲染器（omp 使用 `PI_TUI_NATIVE=0`）。
