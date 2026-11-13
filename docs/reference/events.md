# 事件

`tern.on(name, fn)` 将处理器订阅到某个事件。两种上下文拥有不同的事件集合：Host 事件描述在一台机器上运行的窗格，由该机器上的 Host 端接收；Window 事件描述一个 Tern 窗口所显示的内容，由该窗口中的 Window 端接收。本页列出每个事件及其载荷、触发时机和顺序。

注册调用本身参见 [Host API](api-host.md#tern-on) 和 [Window API](api-window.md#tern-on)。

## 选择一端

有些事件在两种上下文中都存在，且名称相同。它们从不同位置描述同一件事：

| | Host 事件 | Window 事件 |
| --- | --- | --- |
| 接收方 | 运行窗格的机器上的 Host 端 | 每个显示该窗格的窗口中的 Window 端 |
| 覆盖的窗格 | 该 Host 上的每个窗格，无论由哪些窗口显示，或当前没有窗口显示 | 该窗口会话中的每个窗格，无论位于哪台 Host |
| 没有打开窗口时是否触发 | 是（守护进程会继续运行） | 否 |
| 运行位置 | 插件的工作线程，预算 2 s | 窗口的 UI 线程，预算 50 ms |
| `cx` | [副作用上下文（cx）](api-host.md#副作用上下文-cx)：向显示该窗格的窗口发送提示、打开内容、复制内容 | [Window 上下文（cx）](api-window.md#window-上下文-cx)：会话、布局、命令 |
| 窗格 ID | Host 自身的 ID，`tern.pane.write` 使用这些 ID | 窗口的 ID，带有远程 Host 的标签（[窗格和标签 ID](api-window.md#窗格和标签页-id)） |

对于与机器相关的工作（记录命令历史、向窗格写入内容、运行本地工具），使用 Host 事件；对于与用户所见内容相关的工作（重排窗格、修改标题、仅在此窗口显示提示），使用 Window 事件。若同时打开两个窗口，Window 端会在每个窗口中分别接收一次该窗口的事件。

## Host 事件

| 事件 | 处理器 | 载荷 |
| --- | --- | --- |
| `command_started` | `(ev, cx)` | `{pane: number, line: string, cwd: string?}` |
| `command_finished` | `(ev, cx)` | `{pane: number, line: string, status: number, took_ms: number}` |
| `cwd` | `(ev, cx)` | `{pane: number, path: string}` |
| `title` | `(ev, cx)` | `{pane: number, title: string}` |
| `pane_exited` | `(ev, cx)` | `{pane: number, status: number}` |
| `spawn` | `(spec) -> spec?` | 见[启动过滤器](#启动过滤器) |

任何其他名称都会引发 `tern.on: unknown host event "<name>" (spawn, command_started, command_finished, cwd, title, pane_exited)`。

### `command_started`

此 Host 上某个窗格中的 shell 开始运行一条命令行：shell 集成报告了 OSC 133;C。没有 shell 集成的窗格不会触发此事件。

| 字段 | 含义 |
| --- | --- |
| `pane` | 窗格 |
| `line` | shell 报告的命令行 |
| `cwd` | 当时窗格的工作目录，取自其最近一次 OSC 7 报告；如果 shell 从未报告过，则为 `nil` |

### `command_finished`

命令行结束（OSC 133;D）。仅当同一窗格此前触发过 `command_started` 时才会触发；没有开始事件的结束事件会被忽略。

| 字段 | 含义 |
| --- | --- |
| `pane` | 窗格 |
| `line` | 命令行，与 `command_started` 中相同 |
| `status` | shell 报告的退出状态 |
| `took_ms` | 从开始报告到结束报告经过的毫秒数，由 Host 计时 |

### `cwd`

窗格的 shell 报告了新的工作目录（OSC 7）。重复报告相同目录不会触发；报告中没有可用路径也不会触发。若窗格正在运行的命令所用 shell 不报告目录（agent 块），则改为跟踪其程序：Tern 每隔几秒以及程序设置标题时读取其工作目录，并在目录发生变化时触发 `cwd`（macOS 和 Linux）。

| 字段 | 含义 |
| --- | --- |
| `pane` | 窗格 |
| `path` | 新目录的绝对路径 |

### `title`

窗格中的程序设置了标题（OSC 0 或 2），或图标标题（OSC 1）。重复设置相同标题不会触发。只有图标标题变化时，也会触发此事件，但 `title` 保持不变。

| 字段 | 含义 |
| --- | --- |
| `pane` | 窗格 |
| `title` | 变化后的窗格标题（可能是 `""`） |

### `pane_exited`

此 Host 上窗格中的程序已退出：可能是 shell、窗格运行的命令，或已结束的插件块。Host 注意到退出时，每个窗格触发一次。

| 字段 | 含义 |
| --- | --- |
| `pane` | 窗格 |
| `status` | 退出状态（插件块的 `cx:exit` 退出码；失败时为 `1`） |

### 传递与顺序

- Host 将每个事件发送给每个插件的工作线程；没有注册该事件处理器的插件会忽略它。每个工作线程按顺序处理队列，因此插件看到同一窗格的事件时，顺序与事件发生顺序一致。
- 各工作线程并行运行。不同插件的处理器会并发运行，彼此之间没有确定的顺序。
- 在同一个插件内，事件处理器按注册顺序运行。它们收到相同的载荷表和相同的 `cx`：某个处理器修改的字段对下一个处理器可见。
- 处理器抛出错误时，显示该窗格的窗口会报告 “Plugin *name*: *event* failed”，但仍会运行下一个处理器。处理器超出预算时，该插件对此事件注册的处理器会被禁用，直到下次重新加载（[运行时](../concepts/runtime.md#预算超限)）。
- 事件在发往工作线程的其他请求之间处理：块收到按键，以及在它之前排队的 `command_finished`，会按到达顺序处理。
- 事件由窗格所在位置决定发出方：会话守护进程为其窗格发出事件；未使用守护进程运行窗格的窗口则自行发出其本地窗格的事件。iOS 不运行 Host 端，因此不会在那里触发 Host 事件。

## 启动过滤器

```lua
tern.on("spawn", function(spec)
	spec.env.EDITOR = "nvim"
	return spec
end)
```

`spawn` 不是通知，而是对此 Host 即将启动的每个进程窗格（shell，以及使用命令启动的窗格）同步执行的过滤器。插件块不会经过过滤。处理器接收一个 `SpawnSpec`，并返回要使用的 spec，或返回 `nil` 以保持不变。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `program` | `string` | 要运行的程序 |
| `args` | `{ string }` | 程序参数 |
| `cwd` | `string?` | 工作目录 |
| `env` | `{ [string]: string }` | Tern 在继承的环境变量之上设置的变量 |

返回的表会逐字段读取：

| 返回的字段 | 效果 |
| --- | --- |
| `program`, `args` | 替换原值；字段缺失时保留原值 |
| `cwd` | 当路径指向现有目录时替换目录（开头的 `~` 会展开）；字段缺失或路径不是目录时，保留窗格原目录 |
| `env` | 完整的变量集合：不在其中的变量会被移除，已存在的变量保留原位置，新变量按排序顺序追加。字段缺失时会全部移除 |

请修改并返回收到的表，而不是另行构造一个不完整的表。

语义：

- 只有注册了 `spawn` 处理器的插件才会收到请求。插件按 ID 顺序运行；每个插件看到前一个插件返回的 spec。
- 在同一个插件内，其 `spawn` 处理器按注册顺序运行，每个处理器接收前一个处理器的结果。
- 对每个插件，窗格最多等待其答复 50 ms。请求会排在该插件工作线程当前正在处理的工作之后，因此忙碌的工作线程可能错过时限。迟到的答复会被丢弃，spec 保持该插件处理前的值，并且 Host 会记录 `plugin spawn filter took over 50 ms; skipped`。处理器本身仍会在 2 s 预算内运行至完成。
- 处理器返回表或 `nil` 以外的值时，会报告 `spawn must return a spec table or nil, got <type>`；字段类型不正确的表会报告转换错误。两种情况下都会忽略该处理器的结果。`spawn` 失败会在 Host 的每个窗口中显示提示。

参见 [Host 钩子与 Spawn 过滤器](../guides/hooks.md)。

## Window 事件

| 事件 | 处理器 | 载荷 |
| --- | --- | --- |
| `window_start` | `(cx)` | 无 |
| `focus` | `(ev, cx)` | `{pane: number, tab: number}` |
| `pane_created` | `(ev, cx)` | `{pane: number}` |
| `pane_closed` | `(ev, cx)` | `{pane: number}` |
| `tab_created` | `(ev, cx)` | `{tab: number}` |
| `tab_closed` | `(ev, cx)` | `{tab: number}` |
| `command_started` | `(ev, cx)` | `{pane: number, line: string}` |
| `command_finished` | `(ev, cx)` | `{pane: number, line: string, status: number, took_ms: number}` |
| `cwd` | `(ev, cx)` | `{pane: number, path: string}` |
| `title` | `(ev, cx)` | `{pane: number, title: string}` |
| `agent_state` | `(ev, cx)` | `{pane: number, old: string?, new: string}` |
| `agent_finished` | `(ev, cx)` | `{pane: number, result: "done" \| "failed" \| "exited" \| "closed"}` |
| `float_moved` | `(ev, cx)` | `{pane: number, tab: number, over: number, corner: string?, stashed: string?, docked: string?}` |
| `session_ended` | `(ev, cx)` | `{session: number, name: string, shown: boolean}` |
| `budget` | `(ev, cx)` | `{hook: string, state: "paused" \| "resumed", ms: number?, paused_ms: number?}` |
| `canvas_action` | `(ev, cx) -> boolean?` | `CanvasAction`: `{pane, owner, act, node, value?, mods?, text?, title?, about?}` |

任何其他名称都会引发 ``tern.on: unknown window event `<name>` ``。

### `window_start`

每个插件在每个窗口中运行一次，在窗口的会话稳定之后：保存的标签页已恢复，或第一个标签页已启动。适合在此进行工作区设置，以便在向现有标签页添加内容前先查看这些标签页。对于已在此窗口运行过该事件的插件，重新加载不会再次运行；此后安装或启用的插件则会运行。事件只接收 `cx`。参见 [布局与工作区](../guides/layout.md#启动时打开工作区)。

### `focus`

窗口活动标签页的焦点窗格发生变化：例如点击、按键、切换标签页或会话、分割、关闭。此事件按窗格去重：仅当窗格不同于上次 `focus` 指定的窗格时才触发，因此再次聚焦已经聚焦的窗格不会触发；将其移到另一个仍保持焦点的标签页也不会触发（不比较 `tab`）。窗口没有活动标签页时不会触发；下一个获得焦点的窗格会再次触发，即使它就是上次指定的窗格。

| 字段 | 含义 |
| --- | --- |
| `pane` | 新获得焦点的窗格 |
| `tab` | 该窗格所在的标签页 |

窗口获得或失去系统焦点不是 `focus` 事件。

### `pane_created`, `pane_closed`

当此窗口添加任何种类的窗格时，触发 `pane_created`：新标签页、分割、从命令面板启动的窗格、插件块、通过 `cx.layout` 创建的窗格，以及每种原生块（浏览器，包括 `tern browser` 打开的画中画，以及文件、Git、数据库、笔记本、看板、画布、进程、屏幕、性能分析和 Carly 块）。

此窗口关闭每个窗格时会触发 `pane_closed`，包括已关闭标签页中的每个窗格。由守护进程传来的窗格和标签页（窗口连接时恢复，或由同一会话中的另一个窗口创建）不会触发 `pane_created` 或 `tab_created`。

| 字段 | 含义 |
| --- | --- |
| `pane` | 窗格 |

### `tab_created`, `tab_closed`

此窗口中打开或消失一个标签页时触发，包括将窗格移入独立标签页而创建的标签页，以及唯一窗格移出后消失的标签页。关闭标签页时，会先触发 `tab_closed`，然后才触发其中窗格的 `pane_closed`。

| 字段 | 含义 |
| --- | --- |
| `tab` | 标签页 |

### `command_started`, `command_finished`

与同名 Host 事件相同，适用于此窗口会话中的每个窗格，无论本地还是远程；但 `command_started` 中不包含 `cwd`。需要时可通过 `cx.session:panes()` 读取窗格目录。`took_ms` 由 Window 计时，从它收到开始报告到收到结束报告。

### `cwd`, `title`

与同名 Host 事件相同，适用于此窗口会话中的每个窗格。远程窗格的 `path` 是其 Host 上的路径。

### `agent_state`

agent 块的状态发生变化，状态值与 `cx.agents:list()` 报告的相同：`working`、`waiting_input`（问题或权限提示正在等待回应，或提示无法送达）、`idle` 或 `exited`。窗口中每个会话里的 agent 每次状态变化都会触发一次。只有插件正在监听时，窗口才会在渲染后比较状态，最多每 250 ms 一次；加载后的首次比较只记录状态，若状态在下一次查看前恢复则不会触发。自上次查看后新出现的 agent 会以 `old` 为 `nil` 触发。已关闭的 agent 则触发 `agent_finished`。

| 字段 | 含义 |
| --- | --- |
| `pane` | agent 的窗格 |
| `old` | 上次查看时的状态（`nil`：此后新出现） |
| `new` | 当前状态 |

### `agent_finished`

agent 块中的一轮结束，或 agent 本身结束。若一轮结束时仍有提示等待 agent 处理，则不会报告。

| 字段 | 含义 |
| --- | --- |
| `pane` | agent 的窗格 |
| `result` | agent 报告的 `"done"` 或 `"failed"`；其程序退出时为 `"exited"`；程序仍在运行而块关闭时为 `"closed"` |

### `float_moved`

用户放开一个拖动或抛出的浮动块（画中画）时触发，无论它是否移动：每次释放触发一次，在 Tern 将其吸附到位后发送。浮动块总会落在其所覆盖块的某个角、滑出边缘成为边缘标签页，或停靠到分割树中。使用键盘、菜单或 `cx.layout:float` 移动浮动块不会触发此事件；使用控制柄调整大小也不会触发。

| 字段 | 含义 |
| --- | --- |
| `pane` | 浮动块 |
| `tab` | 其标签页 |
| `over` | 当前被覆盖的块，或停靠时旁边的块 |
| `corner` | 吸附到 `over` 的角：`"tl"`、`"tr"`、`"bl"` 或 `"br"`；停靠时为 `nil` |
| `stashed` | 滑出该边缘时为 `"left"` 或 `"right"`（保留 `corner` 以便返回）；否则为 `nil` |
| `docked` | 停靠到 `over` 一侧并不再浮动时为 `"left"`、`"right"`、`"up"` 或 `"down"`；否则为 `nil` |

### `session_ended`

此窗口中的会话消失：在此窗口中关闭（Close session、`cx.sessions:close`）、由使用 `--end-on-success` 启动且以状态 0 退出的块结束，或由同一会话中的另一个窗口或 `tern kill session` 关闭。若在此窗口中关闭，会在其中内容的 `tab_closed` 和 `pane_closed` 事件之后触发。关闭会话的最后一个标签页会留下空会话，不会触发此事件；关闭窗口唯一的会话也不会触发；Host 断开连接也不会结束其会话。

若结束的是窗口当前显示的会话，窗口会切换到它之前显示且仍存在的最近会话，否则切换到列表中的下一个会话；处理器运行时，`cx.sessions:current()` 已返回该会话。

| 字段 | 含义 |
| --- | --- |
| `session` | 会话 ID，与 `cx.session:sessions()` 返回的一致 |
| `name` | 会话名称 |
| `shown` | 会话结束时窗口是否正在显示它 |

### `budget`

此插件自己的某个 hook 超出预算而暂停，或暂停结束（[运行时、预算与 JIT](../concepts/runtime.md#预算超限)）。只有拥有该 hook 的插件会在发生超限的窗口中接收到事件。Host 端的暂停不会在此处传递；可通过 `tern plugin list` 查看。

| 字段 | 含义 |
| --- | --- |
| `hook` | hook（`timer`、`command <id>`、`status`、…） |
| `state` | `"paused"` 或 `"resumed"` |
| `ms` | 超出的预算（仅 `paused` 时） |
| `paused_ms` | 暂停时长（仅 `paused` 时） |

### `canvas_action`

仅在发生点击的窗口中，点击此插件拥有的画布中带有自定义 `actions` 名称的节点时触发（[画布上下文（cx）](api-window.md#画布上下文-cx)）。只有拥有者的处理器会运行，按注册顺序执行；第一个返回真值的处理器会消费点击；若没有处理器消费，窗口会显示提示：`Nothing handles “<act>” here`。`cx.session:event(pane, {ev = "action", id = node, act = name})` 可在没有指针操作时投递相同的动作，并在调用处理器返回后送达；`id` 是点击报告的节点 ID，`text`、`title` 和 `about` 按该调用结束时画布的状态读取，包含调用前刚刚完成的更新。切换、选择以及 Tern 自带的动作（`copy`、`open`、`zoom`）不会送达；但若没有可折叠、打开或缩放的内容，`toggle`、`open` 或 `zoom` 会作为自定义动作送达。

| 字段 | 含义 |
| --- | --- |
| `pane` | 画布窗格 |
| `owner` | 打开它的插件 ID |
| `act`, `value` | 动作名称（截至第一个 `=`）及其余部分 |
| `node` | 点击节点的 ID |
| `mods` | 按下的修饰键（若有） |
| `text` | 点击节点的文本 |
| `title`, `about` | 画布的标题和用途 |

### 传递与顺序

- 会话按事件发生顺序将其排入队列。每次渲染后，窗口会将队列交给插件：按事件顺序处理，每个事件依插件 ID 顺序交给所有插件，并在每个插件内按处理器注册顺序执行。每个处理器都会获得一个新的 `cx`。
- 处理器引发的事件（例如通过 `cx.layout` 分割，或通过 `cx:command` 关闭标签页）会排队，并在当前批次之后的下一轮传递；处理器不会在另一个处理器内部被重入。
- 窗口没有加载 Window 端时发生的事件会被丢弃，不会留待之后处理。
- 处理器抛出错误时，此窗口会显示 “Plugin *name*: *event* failed”；下一个处理器仍会运行。超出 50 ms 预算会暂停该插件在此窗口中对此事件注册的处理器（5 s；若持续超限则更久）；暂停期间的事件会被跳过。
- Web 客户端不运行 Lua；其 Window 端不会收到任何事件。

## 相关页面

- [Host 钩子与 Spawn 过滤器](../guides/hooks.md)：Host 端示例。
- [布局与工作区](../guides/layout.md#窗口事件)：Window 端示例。
- [限制](limits.md)：预算与等待时限。
