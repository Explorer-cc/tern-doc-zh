# 标签页与导航

这些命令用于排列标签页和窗格、更改其界面外观，并操作样式和路径选择器。可用它们设置工作区、捕获导航状态，或在不通过菜单点击的情况下移动窗格。

## 标签页与界面外观

| 命令 | 作用 |
| --- | --- |
| `tabs [horizontal\|vertical\|toggle]` | 设置标签页方向；省略时切换方向。 |
| `tabs autohide on\|off` | 隐藏或保留窗口边缘的垂直标签栏。 |
| `filter ["<query>"]` | 设置垂直标签列表的筛选条件；省略查询可清除筛选。 |
| `status-bar [on\|off]` | 显示或隐藏状态栏；省略时切换显示状态。 |
| `pane-headers never\|split\|always` | 不显示窗格标题、仅在拆分标签页中显示标题，或在每个窗格中显示标题。 |
| `style rail\|float\|tiles\|studio\|glass\|clear\|solid\|islands\|compact` | 固定布局、材质或密度选项。 |
| `cross-session-click switch\|stay` | 在其他会话的标签页上单击一次时，切换到该会话或留在当前会话。 |

`tabs` 会等待 900 ms，包括标签页移动所需时间。其他命令会等待 450 ms。`style` 选项不区分大小写，且只更改所选类别。使用 `cross-session-click stay` 时，双击或明确选择仍会切换会话。

状态会公开 `tab_orientation`、`status_bar`、`pane_headers`、`layout`、`material` 和 `density`。`pane_headers` 使用标签 `Never`、`When split` 和 `Always`。筛选器、自动隐藏或跨会话单击设置没有专用状态字段；请使用 `tree` 或 `dump` 检查可见列表，并使用 `sessions` 检查会话选择。

## 选择器与路径

| 命令 | 作用 |
| --- | --- |
| `interface-style` | 打开 Change interface style。 |
| `picker up\|down [<n>]` | 按行数移动已打开选择器中的高亮项，并预览样式选项。 |
| `picker enter` | 选择高亮行；在插件的 `cx:prompt` 中，用字段文本作答。 |
| `picker split` | 使用拆分操作进行选择，效果类似 Command–Enter。 |
| `picker esc` | 取消选择器，并还原尚未提交的样式预览；插件的问题会以 `nil` 作答。 |
| `goto ["<path/query>"]` | 在焦点窗格所在目录打开 Go to directory。 |
| `insert-path ["<path/query>"]` | 在焦点窗格所在目录打开 Insert path。 |

计数默认为 1。它是有符号整数：负数会反转方向，零则保持高亮项不动。逐行移动会循环。若没有打开的选择器，`picker` 会失败；如果没有匹配的行，选择操作不会执行任何操作。

在路径查询中，斜杠分隔的各段会逐层进入目录，效果与键入 `/` 相同；最后一段是模糊查询。省略查询时会从空筛选条件开始。`goto` 会列出目录；选择目录后，会在焦点窗格所在的主机上打开新标签页，或使用 `picker split` 拆分打开。`insert-path` 还会列出文件，并将选定路径插入原窗格的光标处。选择父目录行会向上一级，而不是关闭选择器。

如果没有窗格获得焦点，这两个路径命令都会失败。它们会实时等待目录列表和后台遍历完成，然后等待 450 ms。脚本的 20 秒实际工作超时限制仍然适用。其他选择器命令会等待 450 ms；选择目录本身不会等待 Shell 提示符，因此在新 Shell 中运行命令前请使用 `ready`。这些命令也可以浏览远程主机，并非仅限桌面端。

关闭时，状态中的 `picker` 为 null。打开时，它会报告 `mode`、`query`、`dir`、`rows`、`walked` 和 `selected`。样式选择器使用模式 `style`；路径选择器使用 `goto` 和 `insert`；插件的 `cx:pick` 和 `cx:prompt` 使用 `pick` 和 `prompt`。样式预览也会反映在 `layout`、`material` 和 `density` 中。

```text
ready
goto ""
shot goto-dir
goto "crates/tern/"
shot goto-dir-descend
goto "crates/tern/srcview"
shot goto-dir-fuzzy
picker esc
insert-path "crates/tern/sessrs"
shot insert-path
picker enter
shot insert-path-typed
```

这是从检出目录根目录运行的 `goto-dir` golden 中的导航序列。

## 移动窗格

| 命令 | 作用 |
| --- | --- |
| `drag-pane <n> [<m> left\|right\|up\|down\|center\|tl\|tr\|bl\|br]` | 开始拖动窗格 `n`，可选将鼠标悬停在窗格 `m` 的放置区域上。 |
| `move-pane left\|right\|up\|down` | 朝指定方向移动焦点窗格。 |
| `move-pane tab <n> ["<session>"]` | 将焦点窗格移至当前会话或指定会话中的编号标签页。 |
| `move-pane new-tab` | 将焦点窗格移至新标签页。 |
| `move-pane session "<session>"` | 将焦点窗格移至该会话中的新标签页。 |

窗格编号按活动标签页中的阅读顺序从 1 开始。标签页编号在目标会话内从 1 开始；会话名称不区分大小写。`center` 会交换窗格；`tl`、`tr`、`bl` 和 `br` 会将窗格悬浮在目标窗格的左上、右上、左下或右下角。`drag-pane` 只会开始拖动并设置悬停叠层。使用测试框架的 `drop <x> <y> text "tern-pane:<id>" move` 完成拖放，其中窗格 ID 取自状态；也可使用 `drag-end` 取消。

窗格、标签页或指定会话不存在时，操作会失败。若窗格已位于目标标签页，或属于另一个主机，移至标签页会失败。若窗格已在目标会话中，且是其所在标签页的唯一窗格，或目标会话位于另一个主机，移至会话会失败。若标签页只包含此窗格，移至新标签页会失败。三种标签页/会话形式都要求窗格获得焦点，并会在移动后继续保持焦点。方向移动没有此类明确的失败结果。所有这些命令都会等待 450 ms。

状态中的 `pane_drag` 会报告被拖动的 `pane` ID 和 `over` 目标/区域；没有正在进行的拖动时则为 null。移动会更改 `tabs`、`panes`、`focused`；跨会话移动时还会更改 `sessions`。

## 运行中程序标签与标签页历史

| 命令 | 作用 |
| --- | --- |
| `running "<command line>"` | 让焦点窗格报告某个命令正在运行，但不启动该命令。 |
| `tidy` | 根据活动标签页中各窗格的程序名称命名标签页，并优先使用焦点窗格的程序名称。 |
| `previous-tab` | 显示上一个查看过的标签页；必要时切换会话。 |

`running` 适用于捕获无法通过无头运行启动的程序。它要求命令行非空且有窗格获得焦点。它会更改窗格的运行/忙碌状态，而不更改终端输出。`tidy` 最多使用两个不同的程序标签，并以 ` · ` 连接；重命名标签页会替换该名称。若没有仍然打开的上一个标签页，`previous-tab` 会失败；再次执行会返回刚离开的标签页。这些命令会等待 450 ms。

状态会在 `focused.running`、`focused.busy` 和 `tabs`（`title`、`busy`、`active`）中反映这些变化；切换会话时，`sessions[].current` 也会反映变化。没有单独的标签页历史字段。

```text
ready
running "btop"
tab new
running "claude"
split right
tab new
running "nvim notes.md"
split down
running "lazygit"
shot deck
tabs vertical
shot deck-vertical
```

此示例使用 `deck` golden 中的程序标签和窗格设置。

## 另请参阅

- [终端与窗格](terminal.md)：创建标签页、拆分窗格和运行 Shell 命令。
- [会话与块](sessions.md)：创建和选择会话。
- [测试框架命令](harness.md)：输入、放置和截图。
- [控制命令](control.md)：检查状态和可见树。
- [调试](../guides/debugging.md#通过脚本驱动-window)：通过脚本驱动窗口。
