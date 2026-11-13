# 会话和块

这些命令将标签页归入命名会话、在会话间切换、防止工作被关闭，并选择新终端块的运行方式。你可以用它们设置工作区，或让脚本中的代理块执行可预测的命令。

## 会话

| 命令 | 作用 |
| --- | --- |
| `session new [<name>]` | 创建会话，切换到该会话并打开其第一个标签页。 |
| `session switch <name>` | 切换到第一个名称匹配的会话，匹配时忽略 ASCII 字母大小写。 |
| `session rename <name>` | 重命名当前会话。 |
| `session close` | 请求关闭当前会话及其标签页中的程序。 |
| `session lock` | 切换当前会话的锁定状态。 |
| `session end-on-success` | 使聚焦块在程序以状态 0 退出后结束其会话，行为与 `tern new … --end-on-success` 启动的会话相同。 |
| `sessions [<query>]` | 打开命令面板的 Sessions 范围，并填入查询内容。 |

名称和查询包含空格时请加引号。省略新会话名称或名称为空时，会生成唯一的随机双词名称。新会话默认未锁定；其首个标签页使用新标签页目录和 `new-blocks` 设置。显式指定的名称不必唯一。切换到未知名称会报错 `no session named …`；切换和重命名要求名称非空。未知的 `session` 子命令会报错。`session close`、`session lock` 和 `session end-on-success` 不接受参数，不过解析器会忽略其后的词。当前会话没有标签页时，`session end-on-success` 会报错 `no focused block`。标记为成功退出后结束会话的块若以其他状态退出，则仍会保留并显示其状态；在锁定会话中，成功退出只会关闭该块。

关闭当前会话后会返回窗口之前显示的会话；如果之前的会话都已关闭，则选择下一个会话，若没有下一个则选择前一个。关闭唯一会话时，会话仍保留但不含标签页。锁定会话会阻止关闭会话、标签页及其块，并显示提示，而不会令脚本失败。再次切换锁定状态即可解锁。确认提示和未保存数据问题可能导致会话仍然打开；命令成功回复并不表示会话已关闭。

`session close` 和 `sessions` 稳定处理 450 毫秒，但不会等待问题得到答复或命令面板中的选择。其他命令会实时等待可见程序窗格到达提示符或结束，然后稳定处理 450 毫秒。适用通常的 20 秒超时；繁忙的会话可能导致切换超时。

在 `tern ctl state` 中，`sessions` 会列出每个会话的 `name`、标签页数和 `current` 标志。`tabs`、`panes` 和 `focused` 会显示生成的工作区。状态中不会公开锁定状态。`palette` 包含切换器查询，`palette_scope` 标识其范围。

## 关闭策略

| 命令 | 作用 |
| --- | --- |
| `confirm-close never\|running\|always` | 设置关闭块、标签页、会话或窗口时何时要求确认。 |

默认值为 `running`：如果关闭会结束空闲 shell 以外的程序（包括正在运行的命令、编辑器或正在处理轮次的代理），则询问确认。空闲 shell 和处于轮次间歇的代理无需确认即可关闭。`always` 表示每次都询问；`never` 表示跳过此确认。值缺失或无效都会报错。

这不会绕过锁定，也不会绕过关于未保存数据库或笔记本数据的问题。无头运行时，使用测试框架的 `dialog` 命令回答问题。退出时也应用此策略。它不会显示在 `tern ctl state` 中；回答后观察受影响的 `sessions` 和 `tabs`。设置此项使用与上述相同的提示符等待和 450 毫秒稳定处理。

## Shell 块和 agent 块

| 命令 | 作用 |
| --- | --- |
| `block shell\|agent` | 打开明确指定类型的块并将其聚焦。 |
| `agent-command <command>` | 设置之后创建的代理块通过登录 shell 运行的命令。 |
| `new-blocks shell\|agent` | 选择新标签页和分屏打开的块类型。 |

Shell 块会在聚焦窗格旁边、同一目录中打开；如果没有打开的标签页，则为它单独创建标签页。代理块遵循代理放置偏好设置：默认在右侧分屏，也可以选择新标签页，或替换标签页中唯一的空闲 shell。显式的 `block` 命令不受 `new-blocks` 影响。

新标签页和分屏默认使用 `shell`。默认代理命令为 `omp`；制作截图时请设置确定性的命令，不要依赖已安装的代理。更改 `agent-command` 不会重启现有块。命令必须为非空文本。`block` 和 `new-blocks` 只接受 `shell` 或 `agent`；缺少、额外或无效的词都会报错。

这些命令会实时等待可见程序窗格到达提示符或结束，然后稳定处理 450 毫秒，并适用通常的 20 秒超时。持续令程序处于繁忙状态的命令可能因此超时。此命令族不局限于桌面版或无头运行。

状态会在 `tabs[].panes`、`panes` 和 `focused` 中显示新块（包括其 `label`、`running`、`prompt` 和 `error`）。`tern ctl state` 不会直接公开已配置的代理命令或新块类型。

## 示例

按 sessions golden 中的方式创建会话并筛选切换器：

```text
ready
session rename "tern"
tab new
session new "website"
tab new
tab new
session new
run "printf 'deploying…\\n'"
session switch "website"
shot sessions-tabs
sessions "web"
shot sessions-filter
```

使用 blocks golden 中的确定性命令打开 shell 块和代理块：

```text
ready
agent-command "printf '\\033[1m✻ Agent\\033[0m ready in %s\\n\\n> ' \"$PWD\"; sleep 600"
block shell
block agent
ready
shot blocks
```

## 另请参阅

- [终端和窗格](terminal.md)：标签页、分屏和提示符等待。
- [标签页和导航](navigation.md)：显示和导航会话标签页。
- [测试框架命令](harness.md)：回答对话框并截屏。
- [脚本](index.md)：语法、计时和控制端点。
- [调试](../guides/debugging.md)：通过脚本驱动窗口。
