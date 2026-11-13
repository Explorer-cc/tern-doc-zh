# Carly

Carly 命令可让脚本和截图中的助手进入对话、工具、语音和定时任务等状态，也可以运行她的真实 Tern 工具。你可以使用模拟轮次在不启动 omp 的情况下测试她的 UI，也可以在没有代理的情况下通过工具调用检查或更改窗口。此命令系列仅适用于桌面端；无头窗口绝不会启动 omp。

## 打开和附件

| 命令 | 作用 |
| --- | --- |
| `carly open` | 按照 Carly 的常规打开行为打开她。 |
| `carly close` | 关闭 Carly。 |
| `carly new` | 开始新对话，并重置其 Lua 环境和画布处理器。 |
| `carly paste text "<text>"` | 将剪贴板文本粘贴到她的输入框。 |
| `carly paste image <width> <height>` | 粘贴给定像素尺寸的纯灰色位图。 |
| `carly paste file "<path>"` | 从给定的剪贴板路径粘贴文件附件。 |

如果 Carly 的输入框尚未接受粘贴，粘贴操作会先打开 Carly。图像尺寸是无符号 32 位整数；文本和文件路径不能为空。文件形式提供的是剪贴板路径，而不是打开文件块。重置对话不会移除持久画布。

检查 `state.carly.open`、`peek`、`target`、`field` 和 `attachments`，查看呈现结果和输入。

## 对话和步骤

| 命令 | 作用 |
| --- | --- |
| `carly ask "<text>"` | 提交问题并标记该轮已开始。 |
| `carly queue "<text>"` | 提交问题，但不模拟其开始。 |
| `carly stream "<markdown>"` | 提供进行中轮次截至目前的回答。 |
| `carly reply "<markdown>"` | 开始并结束一个用户轮次，并提供最终回答。 |
| `carly fail "<message>"` | 以错误结束用户轮次，包括正在等待的问题。 |
| `carly step run\|ok\|bad ["<label>"]` | 记录正在运行、已完成或失败的工具步骤。 |
| `carly command run\|ok\|bad ["<command line>"]` | 记录相同的步骤状态，并以 shell 命令形式显示。 |
| `carly history "<file>"` | 提供 omp 在此窗口打开前保留的内容：一个 JSON 数组，包含 omp 的消息，与其 RPC `get_messages` 的回答相同。 |

这些命令提供对话事件；`command` 不会执行其命令行。重复步骤标签会更新该步骤。`ask`、`queue`、`stream`、`reply` 和 `fail` 的文本必须包含非空白字符；步骤标签可以为空。在真实窗口中，提交问题也可能到达正在运行的代理；模拟不会等待代理回答。

`state.carly.phase` 描述当前活动。`turns` 按从旧到新的顺序保存完整对话，每个轮次包含 `kind`（`asked`、`spoken`、`task`、`alert` 或 `flush`）、`past`（表示它来自 `history`）、`started`、`task`、`asked`、`steps`、`unfolded`、`answer`、`error` 和 `done`。步骤状态值为 `running`、`done` 和 `failed`。`state.carly.past` 的值为 `unasked`、`loading`、`loaded` 或 `{ "failed": … }`：表示 Carly 块（通过命令面板中的 New Carly block 打开）是否已取得此窗口打开前的对话。无头窗口不会向 omp 请求对话：显示 Carly 块时即将其标记为已加载，而 `history` 则会提供对话。

```text
ready
carly open
carly ask "what sessions did I close today?"
carly step ok "Find session actions"
carly command run "ls -la ~/Library/Application Support/Tern"
shot carly-working
carly command ok "ls -la ~/Library/Application Support/Tern"
carly reply "You closed **3 sessions** today."
shot carly-answer
```

这演示了 `carly-steps` golden 中的对话和步骤进展。`carly-block` golden 展示了 Carly 块中的对话，其中较早的部分来自 `carly history "goldens/fixtures/carly-history.json"`。

## 真实工具和断言

| 命令 | 作用 |
| --- | --- |
| `carly tool <name> [<json>]` | 运行真实 Tern 工具并保存其回答。 |
| `carly lua "<code>"` | 运行 `lua` 工具，并在对话轮次中显示其原样输出。 |
| `carly context` | 保存此时提出问题会携带的上下文。 |
| `carly last ["<contains>"]` | 显示最近一次工具回答或排队的画布请求，可选择断言其中包含指定子串。 |
| `carly ok` | 断言最近一次工具回答存在且不是错误。 |

工具参数默认为 `{}`。无效 JSON 会使命令失败。未知工具名称和工具执行错误会产生错误回答，而不会使脚本失败：使用 `carly ok` 将它们作为断言。Lua 代码不能为空；其环境会持续存在，直到执行 `carly new`。

可用工具名称如下：

| 工具 | 作用 |
| --- | --- |
| `inspect` | 读取结构化的窗口、会话、主机、标签页、窗格、代理、设置、进程或块数据，不改变焦点。 |
| `configure` | 通过常规保存路径应用经过验证的设置补丁。 |
| `actions` | 查找内置和插件操作，或按 id 或精确标签运行操作。 |
| `processes` | 列出此机器采样到的进程，或向正数 PID 发送信号。 |
| `session` | 列出、切换、创建、重命名或关闭会话。 |
| `arrange` | 重命名、更改颜色、重新排序并重新分组标签页和块。 |
| `read_block` | 读取块的可见内容，包括未保存的文件文本和原生块数据。 |
| `send_input` | 向终端发送按键、文本以及可选的 Enter，并可选择等待输出。 |
| `run_command` | 通过常规处理器按 id 运行 Tern 命令。 |
| `canvas_read` | 列出画布块中的形状（id、页面框、文本、样式）、视图、选中项和步骤计数。 |
| `canvas_shot` | 将画布区域（默认是块所显示的区域）渲染为模型可见的 PNG。 |
| `canvas_edit` | 按 id 添加、移动、调整大小、旋转、更改样式、重新输入文本、分组、排列或删除形状，作为一个撤销步骤；编辑失败时不会应用任何更改。 |
| `canvas_history` | 列出、撤销或重做画布块的步骤。 |
| `lua` | 使用 Carly 的 Tern API 和已注册的插件导出项运行 Lua。 |

这些都是真实操作，不是模拟的工具步骤。关闭会话会结束其中的程序；在普通窗口中，设置可能会持久保存。进程工具针对本地机器，而非远程主机；Windows 仅支持 terminate 和 kill 信号。

脚本继续执行前，待处理工具会先完成并稳定，计时使用真实经过时间。进程检查最多等待 10 秒以获取首次采样。`send_input` 的 `wait_ms` 默认为零，上限为 120000；提交的命令收到 Shell 命令完成事件后可以提前结束等待，但至少等待 250 ms。截止时间到达时会返回终端最后几行，可能报告命令仍在运行，而不会将到达截止时间视为错误。目标已关闭时会返回错误回答。对于待处理命令，脚本运行器的通用 20 秒稳定等待超时仍然适用。

`state.carly.last_tool` 保存 `{ "text": …, "error": … }`。`context` 使用 Carly 的目标块，若不存在则回退到聚焦块。如果没有回答，或回答文本不包含指定子串，`last` 会失败；它可以显示错误回答。若回答缺失或为错误回答，`ok` 会失败。

```text
ready
carly open
carly lua "scratch = 41; print('hello', 'Lua'); return {answer = scratch + 1, ok = true}"
carly ok
carly lua "scratch += 1; return scratch"
carly last "42"
shot carly-lua-persistence
carly new
carly lua "return scratch == nil"
carly ok
```

这使用了 `carly-lua` 中测试的持久 Lua 状态和重置行为。有关 Carly 的 Lua API，请参阅[扩展 Carly](../guides/carly.md)。

## 语音

| 命令 | 作用 |
| --- | --- |
| `carly voice connecting\|listening\|speaking\|working\|muted\|error\|off [<level>]` | 设置语音呈现状态和电平；`off` 会清除语音状态。 |
| `carly heard "<text>"` | 提供最终识别出的语音转录文本。 |
| `carly said "<text>"` | 提供最终的语音回答文本。 |

这些命令模拟语音事件，不会连接麦克风或语音服务。电平默认为 `0.0`，即使参数不是数字也是如此。视觉电平表的上限为 `1.0`；`state.carly.voice.level` 会保留提供的值。关闭时 `state.carly.voice` 为 null，否则包含 `phase` 和 `level`；语音对话事件也会影响 `turns`。`heard` 和 `said` 要求文本包含非空白字符。

## 定时任务

| 命令 | 作用 |
| --- | --- |
| `carly task add <json>` | 根据调度 API 的 JSON 规范验证并添加任务，并将任务归属设为用户。 |
| `carly task fire <id>` | 立即触发任务的检查或模型轮次。 |
| `carly task run <id> ["<text>"]` | 模拟成功完成该任务的轮次；如有需要，会先启动该轮次。 |
| `carly task fail <id> ["<message>"]` | 模拟任务轮次失败；如有需要，会先启动该轮次。 |
| `carly task event command_finished <pane> <status> ["<line>"]` | 向定时任务检查传递模拟的 shell 完成事件。 |

任务 id 是无符号 32 位整数；`0` 是内置心跳任务。窗格 id 是无符号 64 位整数，退出状态是有符号 32 位整数。完成文本、错误消息和命令行可以为空。模拟的完成事件时长固定为 1200 ms；它不会运行 shell 命令。

`add` 规范要求包含字符串 `title`，并且必须提供 `when` 或 `on` 之一，不能同时提供二者。它接受 `id`、`check`、`prompt`、`pane`、`once`、`paused` 和事件字段 `expires`。对于单次触发和事件触发，`once` 默认为 true；其他情况下默认为 false；`paused` 默认为 false。事件过期时间默认为 `12h`，且必须在未来七天内。不能通过这种方式添加或替换任务 id `0`。无效规范和检查会使命令失败；检查会在任务保存前编译并进行试运行。新 id 会在 `state.carly.last_tool.text` 中返回。

如果 Carly 正忙，`fire` 会保留重试行为；它不会等待模型回答。`run` 和 `fail` 会将完成事件路由到指定任务，而不是排队中的用户问题。`HEARTBEAT_OK` 表示静默完成。成功的单次任务会完成其计划；失败则会记录失败结果。普通窗口会持久保存计划；临时无头会话则不会。查看 `state.carly.tasks`、`peek` 和带任务标签的 `turns` 获取结果；调度规范请参阅[扩展 Carly](../guides/carly.md)。

## 另请参阅

- [脚本](index.md)：运行、语法和稳定等待规则。
- [扩展 Carly](../guides/carly.md)：工具、Lua 和定时检查。
- [会话和块](sessions.md)：Carly 操作的块。
- [测试框架命令](harness.md)：输入和截图。
