# 偏好设置

`prefs` 用于驱动设置面板：打开页面、搜索设置、预览窗口主题或指定固定主机密钥。你可以用它捕获设置界面，并通过测试框架的单击和键盘命令访问控件。

## 打开和关闭

| 命令 | 作用 |
| --- | --- |
| `prefs [<page>]` | 打开指定页面并聚焦搜索框。不提供页面时，使用上次选中的页面；若从未选过，则使用 General。 |
| `prefs close` | 关闭面板、保存待处理编辑并将焦点返回终端。如果面板已关闭则不执行任何操作。 |

页面名称为小写，且区分大小写：

| 页面 | 设置内容 |
| --- | --- |
| `general` | Shell、代理命令、标签页和选择。 |
| `appearance` | 主题、外观和界面样式。 |
| `terminal` | 程序 surface 和内置配置文件。 |
| `lenses` | 每个内置命令 Lens 的开关。 |
| `databases` | SQLite 块。 |
| `notebooks` | Notebook 内核、编辑、运行、输出和保存。仅桌面版。 |
| `carly` | 模型、记忆、语音和心跳。仅桌面版。 |
| `keyboard` | 快捷键。 |
| `git` | Git 块和聚焦的仓库。仅桌面版。 |
| `plugins` | 插件加载、重新加载和安装。 |
| `sessions` | 会话守护进程和启动。 |
| `hosts` | 远程主机和固定密钥。 |
| `advanced` | 文件和一次性选项提示。 |

未知页面或子命令会报错并列出可用页面名称。iOS 和 Web 构建中，`notebooks`、`carly` 和 `git` 不是有效页面名称。有效页面或 `close` 后面的额外参数会被忽略。

`tern ctl state` 会在 `prefs.page` 中报告选中的页面。关闭时，`prefs` 为 `null`。关闭面板也会结束临时主题和提示预览。

## 搜索和预览

| 命令 | 作用 |
| --- | --- |
| `prefs search [<query>]` | 设置搜索查询；如果面板尚未打开则打开它。省略查询或传入 `""` 会清除搜索。 |
| `prefs preview <theme>` | 预览主题目录中的主题，效果如同鼠标悬停在图库磁贴上，作用于整个窗口。 |

搜索会查找所有页面中的设置，而不仅是当前选中的页面。搜索和预览会用空格连接剩余的所有词；多词文本加上引号可明确其边界。预览要求主题名称非空；主题不在目录中时会报错 `no theme called …`。它不会打开面板或保存主题；先打开 `prefs appearance` 才能显示其图库磁贴。关闭面板会恢复已保存主题。

`tern ctl state` 会公开 `prefs.query` 和 `prefs.preview`（正在预览的主题名称，或 `null`）。`prefs.prompt_preview` 描述通过 Terminal 页控件控制的提示符预览；`prefs` 没有对应子命令。

此示例遵循 Appearance golden：

```text
ready
prefs appearance
prefs preview "dark-nord"
shot prefs-appearance
prefs close
```

Keyboard golden 会搜索快捷键行和提及分屏的设置：

```text
ready
prefs keyboard
shot prefs-keyboard-table
prefs search "split"
shot prefs-keyboard
prefs search
prefs close
```

## 固定主机密钥

| 命令 | 作用 |
| --- | --- |
| `prefs known-hosts <file>` | 使 Hosts 页面从此文件读取固定密钥，而不是使用 Tern 通常的 `known_hosts` 文件，并刷新面板。 |

文件参数必填；其余所有词会拼接成路径。绝对路径按原样使用。若相对路径在当前目录存在，则使用该路径；否则相对于测试夹具根目录解析（参阅[测试夹具](index.md#测试夹具)）。解析该根目录可能失败。此命令不要求解析后的文件存在，也不会打开 Hosts 页面。

Hosts golden 使用 `prefs known-hosts "goldens/fixtures/known_hosts"`，然后执行 `prefs hosts`。无头运行默认没有固定密钥文件；普通窗口使用 Tern 通常的文件。提供的路径不会包含在 `tern ctl state` 中，仅更改路径不会选择页面或更改 `prefs.page`。

## 计时

每条成功的 `prefs` 命令都会稳定处理 450 毫秒的动画时间。没有命令会等待 shell、连接或其他实时操作，也没有命令专属的实时超时。这些命令可在无头运行和普通窗口中使用；页面可用性仍受上述限制。

## 另请参阅

- [脚本](index.md)：语法、运行脚本和测试夹具。
- [测试框架命令](harness.md)：单击设置并截屏。
- [终端和窗格](terminal.md)：直接设置字体和主题。
- [远程主机](remote.md)：为 Hosts 页面准备主机。
- [调试](../guides/debugging.md)：在 Preferences 中查看插件状态。
