# 远程主机

`remote` 用于驱动主机连接、“添加远程主机”对话框、主机弹出框以及远程 Shell 链路条件。无需远程机器即可用它测试远程 UI：环回主机会在本地运行真实的会话守护进程，而连接状态、SSH 设置进度和在线状态都可以预先设定。

## 主机与连接

| 命令 | 作用 |
| --- | --- |
| `remote loopback <address>` | 将进程内守护进程作为主机附加，显示其会话，并将其第一个 Shell 切换到先前获得焦点的窗格目录。 |
| `remote state <name> connected\|connecting\|stalled` | 直接设置主机的连接状态。 |
| `remote state <name> reconnecting [<message>...]` | 将状态设为正在重连，尝试次数为 2。 |
| `remote state <name> failed [<message>...]` | 将连接状态设为失败。 |
| `remote state <name> verify <fingerprint>` | 将主机设为等待验证主机密钥的状态。 |
| `remote identity <name> <principal> local\|ssh-key\|tailscale <from> <user>` | 将主机的身份链替换为一个跃点：主体、认证方法、来源机器和当前操作用户。 |
| `remote service <name> <version>\|old [system]` | 预设主机的 Tern 服务版本及更新能力。 |
| `remote switch <name>` | 切换到指定主机。 |
| `remote disconnect <name>` | 断开指定主机。 |
| `remote pair-refused <address>` | 添加一个主机，效果如同扫描 Connect from mobile 连接码；随后将其设为失败，模拟电脑拒绝该连接码，并显示拒绝提示。 |

主机名匹配时不区分 ASCII 大小写；未知名称会失败。设置状态前，先使用 `remote loopback` 或 `remote stage` 创建主机。无效地址会失败。像 `can@devbox` 这样的环回地址会创建名为 `devbox` 的主机。

环回命令最多等待三秒以获取守护进程响应，然后等待 Shell 就绪，整个过程受脚本 20 秒的实际时间超时限制。本组其他命令等待 450 ms 后即结束；仅设置 `connected` 本身并不会建立可用连接。

默认的正在重连消息为 `the network went away`；默认的失败消息为 `the connection timed out`。只有这两种状态接受消息。消息取剩余的单词，并以空格连接。脚本解析后，远程参数会再次按空白字符拆分，因此引号无法让主机名或身份参数包含空格。

`service` 接受版本字符串而不验证其格式。普通版本会预设一个可通过链路接受更新的用户服务；`system` 会预设一个不具备此能力的系统服务。`old` 表示尚不支持版本报告的旧服务，并会忽略 `system`。较旧的服务可在“偏好设置 › 主机”中显示“更新”选项。

在 `tern ctl state` 中检查 `hosts.current` 和 `hosts.hosts[]`。每个主机条目都包含 `name`、`address`、`state`、`sessions`、`identity`、`tern`（报告的版本）和 `update`（提供的更新或其进度）。

## 对话框与主机选择

| 命令 | 作用 |
| --- | --- |
| `remote add [<address>]` | 打开“添加远程主机”对话框，可选填入地址。 |
| `remote stage <address> [<fingerprint>]` | 预设一个正在连接或等待密钥验证的主机，并在对话框中跟踪该主机。 |
| `remote peers [<name>...]` | 替换对话框中的 tailnet 对等设备列表。 |
| `remote ssh-hosts [<alias>...]` | 替换对话框中的 SSH 配置主机列表。 |
| `remote popover [<name>]` | 打开主机弹出框；默认为当前主机。 |
| `remote hosts` | 打开命令面板的“主机”范围，以便切换主机。 |

不带地址的 `add` 会显示空字段。若对话框尚未打开，`stage` 会打开它；地址必须能够解析。指纹会显示出来以供验证，但不会与真实远程密钥核对。将当前跟踪的主机设为 `connected` 后，对话框会关闭。

对等设备和 SSH 主机列表可以为空，这会清空预设列表。tailnet 对等设备会获得合成的在线 Linux 详情和端口为 8376 的地址；`ssh-hosts` 提供的是别名，不会读取 `~/.ssh/config`。这些命令预设发现结果，而不是执行网络发现。本组所有命令等待 450 ms 后结束。

状态中的 `hosts.popover` 提供弹出框主机。对话框关闭时，`hosts.dialog` 为 null；否则其中包含 `address`、待处理的 `host` 和 `state`、`peers` 和 `ssh` 计数、`primary` 按钮标签及 `setup`。`hosts` 中没有命令面板专用字段；请使用 `tree` 检查。

## SSH 设置

| 命令 | 作用 |
| --- | --- |
| `remote setup <destination>` | 如有需要则打开对话框，并预设 SSH 设置流程，但不启动 SSH 引擎。 |
| `remote setup-step login\|inspect\|install\|service\|route [<note>...]` | 将预设设置流程推进到指定步骤，可选提供进度说明。 |
| `remote setup-fail login\|inspect\|install\|service\|route <error>... [terminal]` | 在指定步骤让设置失败；末尾的 `terminal` 表示失败需要交互式终端。 |
| `remote setup-offer <name>` | 将预设主机标记为符合 SSH 设置条件，并在对话框中跟踪该主机。 |

这四种形式仅适用于桌面端，iOS 不可用。它们只会预设 UI 进度；不会安装 Tern，也不会通过 SSH 登录。发送进度或失败事件前，先使用 `setup`。若要显示设置选项，请先预设主机、将其状态设为 `failed`，然后使用 `setup-offer`。

未知步骤会导致解析失败。说明和错误信息会取剩余单词，并以空格连接。必须提供错误信息。只有在它前面至少有一个错误单词时，末尾的 `terminal` 才是标志；若单独出现，则会被视为错误文本。命令等待 450 ms 后结束，不会等待真实的 SSH 操作。

检查 `hosts.dialog.setup`：其中包含 `destination`、`step`、`note`、`failed`、`needs_terminal` 和 `done`。`step` 使用 `Install` 这样的首字母大写名称。

```text
ready
remote add
remote peers devbox
remote ssh-hosts spark build-01 gpu-box pi-garage
shot remote-setup-hosts
remote setup spark
remote setup-step login
remote setup-step inspect
remote setup-step install Downloading Tern 0.5.1 for linux-arm64 on spark…
shot remote-setup-install
```

## 链路条件与在线状态

| 命令 | 作用 |
| --- | --- |
| `remote rtt <name> <ms>\|off` | 覆盖链路的往返时间估计，或恢复为其自身估计值。 |
| `remote hold <name>` | 让正在传输的输出送达，然后暂停后续主机输出。 |
| `remote release <name>` | 释放暂存的输出，并应用等待期间收到的内容。 |
| `remote peer-join <name> <identity>` | 在当前主机上预设来自 `<name>` 机器的另一个客户端。 |
| `remote peer-leave <name>` | 从当前主机移除来自该机器的预设客户端。 |

`rtt` 接受以毫秒为单位的非负整数。预测回显会在超过 30 ms 时开始猜测，并对超过 80 ms 的猜测加下划线。此命令会改变窗格所见的估计值，不会改变网络的实际延迟。

`hold` 会留出 300 ms 实际时间让在途输出送达，然后暂停其余输出。待暂停生效后，它会再等待 100 ms；通常的 20 秒实际时间等待超时仍适用。`release`、`rtt` 和在线状态命令等待 450 ms 后结束。

在线状态命令中的 `<name>` 指另一客户端的来源机器，而非要查找的主机。预设身份使用 tailnet 认证和当前主机的当前操作用户；如果主机没有身份链，则使用 `<identity>` 中 `@` 之前的部分。若该机器没有任何客户端连接，`peer-leave` 会失败。

`tern ctl state` 没有专用的 RTT、输出暂停或对等设备在线状态字段。请使用窗格输出和 `shot` 检查预测回显；打开主机弹出框检查在线状态。`hosts.current` 标识在线状态命令作用的主机。

```text
ready
remote loopback can@devbox
agent-command "env -i HOME=$HOME TERM=$TERM PS1='devbox$ ' /bin/sh -i"
block agent
zoom
ready
remote rtt devbox 400
type "e"
remote hold devbox
type "cho hello"
shot remote-echo
remote release devbox
shot remote-echo-landed
```

## 另请参阅

- [脚本](index.md)：运行命令、语法与时序。
- [终端与窗格](terminal.md)：Shell 就绪、输入和输出。
- [偏好设置](prefs.md)：主机设置与更新选项。
- [控制命令](control.md)：状态与 UI 检查。
- [调试](../guides/debugging.md)：驱动运行中的窗口。
