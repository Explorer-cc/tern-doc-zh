# 脚本

Tern 可以由脚本驱动：脚本是纯文本命令文件，可用于打开窗格、在 shell 中输入内容、单击、按键、将功能置于指定状态并截屏。相同命令也可以逐条通过控制端点发送到正在运行的窗口。Tern 自己的屏幕截图和回归场景（`crates/tern/goldens/*.txt`）也是脚本。

```text
# A split with git status beside a listing.
size 1280 800
ready
split right
run "git status"
expect "On branch"
focus left
run "ls"
shot split-status
```

## 运行脚本

| 命令 | 作用 |
| --- | --- |
| `tern shot [SCENARIO...] [--out DIR] [--size WxH[@S]] [--scale S] [--theme light\|dark\|both] [--flat]` | 在屏幕外运行场景，并为每个 `shot` 命令写入 PNG 及其布局 JSON，保存到 `DIR/<scenario>/`（默认为 `target/shots/tern`）。`SCENARIO` 可以是 `.txt` 文件、包含此类文件的目录，或 Tern golden 的名称。 |
| `tern serve [--control EP] [--out DIR]` | 在控制端点上启动无头窗口，直到收到 `quit`。 |
| `tern --control EP [ARGS]` | 启动普通窗口，同时监听控制端点。 |
| `tern ctl [--control EP] COMMAND...` | 向 `serve` 或窗口发送一条命令，并打印其 JSON 回复。在 Tern 窗格中，如果没有 `--control`，则发送给显示该窗格的窗口。 |
| `tern ctl [--control EP] --file SCENARIO` | 逐条发送脚本命令，每条都在上一条收到回复后发送。 |

`EP` 是 Unix 域套接字路径，或 127.0.0.1 上的 TCP 端口（`0` 表示任意空闲端口）；`serve` 默认为 `/tmp/tern.sock`（Windows 上为临时目录中的 `tern.sock`），在 Tern 窗格外运行的 `ctl` 也使用相同默认值。`tern help dev` 会打印相同摘要，并列出所有命令族。每条回复占一行 JSON：`{"ok":true,…}` 或 `{"ok":false,"error":"…"}`。

无头运行（`shot`、`serve`）具有确定性：使用不会保存的默认设置、固定时钟、不恢复会话、不加载插件（除非 `plugins fixtures` 加载 Tern 的测试插件），并以合成测试图案代替真实屏幕。

## 语法

- 每行一条命令。`#` 开始注释；空行会跳过。
- 参数以空格分隔。双引号字符串可以包含空格，并支持转义符 `\"`、`\\`、`\n` 和 `\t`。
- 脚本选择器（`click`、`a11y`、`webview` 等）是单个参数；包含空格的选择器要加引号。
- `ctl` 会将输入的单词拼接成一行命令，因此如果脚本解析器需要带引号的文本，必须在 shell 引号内提供这些引号：`tern ctl expect '"On branch"'`。

## 计时

每条命令都会在下一条运行前完成稳定处理：动画会结束，或命令会等待其启动的工作（shell 提示符、git 读取、数据库查询）。依赖实际工作的等待最多持续 20 秒，超时后脚本失败。`wait MS` 手动推进时间；`freeze-anims` 和 `motion-at MS` 会停止时间，以便在动画过程中截取画面。

当前平台无法运行的命令会附带警告并跳过。如果前置条件不成立，有些命令会停止脚本剩余部分，但不会令脚本失败。

## 测试夹具

打开测试夹具的命令（`file fixture`、`sqlite fixture`、`board fixture`、`run` 中的 `{fixtures}` 等）会从 Tern 源码树读取：开发构建中的 `crates/tern/goldens/fixtures`。已发布的 Tern 必须设置 `STENCIL_FIXTURE_ROOT`，指向某个检出目录中的 `crates/tern`，才能使用这些测试夹具；使用你自己的路径的命令不需要此设置。

## 状态

`tern ctl state` 会将 Tern 状态打印为 JSON：窗格、标签页、会话、设置，以及每种块各自的条目（`file_blocks`、`git_blocks`、`sqlite_blocks`、`carly` 等）。脚本用它检查命令的效果；下方每个页面都会说明该命令族会填充哪些部分。

## 命令族

脚本混合使用三类命令：所有 Stencil 应用共享的测试框架输入和捕获命令、只有控制端点会响应的控制命令，以及按驱动对象分组的 Tern 自有命令。

| 命令族 | 命令 | 页面 |
| --- | --- | --- |
| 测试框架 | `size`、`wait`、`move`、`down`、`up`、`click`、`dblclick`、`hover`、`key`、`type`、`wheel`、`swipe`、`touch`、`drop`、`shot`、`record`、`freeze-anims`、`motion-at`、`appearance`、`menu`、`a11y`、`dialog`、`webview`、`spelling`、… | [测试框架命令](harness.md) |
| 控制 | `dump`、`tree`、`pick`、`state`、`stats`、`layers`、`a11y`、`menus`、`system`、`css`、`perf`、`trace`、`resize`、`quit`、`webcall`、`webreports` | [控制命令](control.md) |
| 终端和窗格 | `ready`、`git-read`、`link-read`、`run`、`expect`、`completing`、`split`、`close`、`zoom`、`equalize`、`focus`、`resize`、`tab`、`rename`、`palette`、`find`、`context`、`font`、`ui-font-size`、`font-family`、`font-weight`、`adjust-cell-height`、`adjust-cell-width`、`font-thicken`、`padding`、`ui-font`、`code-font`、`program-icon`、`decorations`、`layout`、`theme`、`themes`、`scroll`、`copy`、`alert`、`inbox`、`peek`、`melt`、`feed`、`surface-play`、`plugins` | [终端和窗格](terminal.md) |
| 标签页和导航 | `tabs`、`filter`、`status-bar`、`pane-headers`、`style`、`interface-style`、`picker`、`goto`、`insert-path`、`running`、`drag-pane`、`move-pane`、`tidy`、`previous-tab`、`cross-session-click` | [标签页和导航](navigation.md) |
| 会话和块 | `session`、`sessions`、`block`、`agent-command`、`new-blocks`、`confirm-close` | [会话和块](sessions.md) |
| 远程主机 | `remote` | [远程主机](remote.md) |
| 偏好设置 | `prefs` | [偏好设置](prefs.md) |
| 浏览器块 | `browser` | [浏览器块](browser.md) |
| 画中画 | `pip` | [画中画](pip.md) |
| 文件窗格 | `files` | [文件窗格](files.md) |
| 文件块 | `file` | [文件块](file.md) |
| 任务管理器 | `procs` | [任务管理器](procs.md) |
| 屏幕块 | `screen` | [屏幕块](screen.md) |
| Git 块 | `git` | [Git 块](git.md) |
| SQLite 块 | `sqlite` | [SQLite 块](sqlite.md) |
| Notebook 块 | `notebook` | [Notebook 块](notebook.md) |
| Board 块 | `board` | [Board 块](board.md) |
| Canvas 块 | `canvas` | [Canvas 块](canvas.md) |
| Profile 块 | `profile` | [Profile 块](profile.md) |
| 账户、更新和云端 | `account`、`update`、`kickoff` | [账户、更新和 Kickoff](status.md) |
| Carly | `carly` | [Carly](carly.md) |

Git、notebook、Carly 和 kickoff 命令仅在桌面版运行。

## 另请参阅

- [调试](../guides/debugging.md#通过脚本驱动-window)：从脚本测试插件。
- [命令行](../reference/cli.md)：`tern plugin` 命令。
