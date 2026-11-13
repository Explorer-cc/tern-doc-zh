# 性能分析块

`profile` 会将采样的调用栈作为火焰图打开，记录任务管理器块中选定的进程，并驱动图表及其函数面板。你可以使用已录制的测试夹具获取可重复的截图，也可以记录实时进程，以检查其时间花在何处。

## 打开和记录

| 命令 | 作用 |
| --- | --- |
| `profile fixture <name>` | 在当前聚焦窗格旁的新块中打开名为 `<name>`、已提交到仓库的性能分析记录。 |
| `profile open <path>` | 在当前主机的新性能分析块中打开采样报告、折叠栈文件或 Chrome/V8 `.cpuprofile`。 |
| `profile record` | 打开一个新块，记录当前聚焦的任务管理器块中选定的进程。 |
| `profile stop` | 提前结束聚焦性能分析块的记录并保留样本。 |

测试夹具位于 `crates/tern/goldens/fixtures/profile`。名称不包含扩展名：Tern 会先尝试 `<name>.sample.txt`，再尝试 `<name>.folded`。未知测试夹具会导致命令失败。已发布构建请参见[测试夹具设置](index.md#测试夹具)。包含空格的路径或名称需要加引号。

Chrome 和 V8 `.cpuprofile` 文件也可以通过常规文件打开方式在分析器中打开，包括 Files 窗格、`tern open` 和系统的“打开方式”操作。远程主机上的文件会在其所在主机读取。报告按钮会打开性能分析记录的源文件；导入的性能分析记录无法再次录制。如果存在时间差值，图表和函数占比会按经过的时间加权；否则显示样本数。

`record` 要求聚焦的任务管理器块中选中了一个进程，否则会失败。该块会在任务管理器所在的主机上打开。记录最长持续 20 秒实际时间。启动后会等待 1,500 ms 以使状态稳定，而不是等待整个记录过程结束。采样使用平台对应的记录器：macOS 上使用 `sample`，Linux 上使用 `perf`，Windows 上使用原生采样器。权限和可用的采样工具可能导致记录无法进行。如果 Tern 没有缓存目录来保存记录，会显示提示，而不是打开块。

`fixture`、`open` 和 `stop` 会等待聚焦块显示图表或错误，然后再等待 400 ms 使状态稳定。实际工作等待超过 20 秒会超时并失败。在块中显示的文件或记录错误会结束等待，但本身不算命令失败。`stop` 要求聚焦性能分析块；如果记录已经结束，则无需调用。

这些命令可用于无头运行和原生窗口；Web 客户端不运行脚本。与文件块一样，性能分析块通过其主机的文件中心读取文件，因此浏览器标签页会显示由提供该页面的机器上的桌面窗口录制的性能分析图表。超过 256 MiB 的文件会显示错误，而不是图表。

桌面窗口会自行采样本机进程。其他主机上的进程（远程主机的进程，或浏览器标签页所连接服务机器上的进程）由该主机的会话守护进程采样，并将性能分析记录写入其自身缓存。记录属于守护进程：即使连接中断、标签页重新加载或窗口关闭，记录仍会继续；所有显示该块的窗口都会跟随记录，并可停止它。运行的 Tern 版本过旧、无法录制性能分析的主机会打开块并提示更新；如果主机在记录完成前重启，则会显示记录已中断。

## 导航和高亮

| 命令 | 作用 |
| --- | --- |
| `profile zoom <function>\|root` | 放大到该函数权重最大的方框；`root` 显示整个性能分析记录。 |
| `profile select <function>` | 显示并选中该函数权重最大的方框。 |
| `profile hover <function>` | 显示该函数权重最大的方框，并将指针移到其上方。 |
| `profile pick <function>\|none` | 高亮该函数的所有调用；`none` 清除选中的函数。 |
| `profile find [<text>]` | 搜索性能分析记录并高亮匹配的函数；不提供文本或使用 `""` 会清除搜索。 |

以下所有显示命令以及这些命令，都会作用于聚焦的性能分析块。未聚焦性能分析块时命令会失败。函数查找要求图表已加载，并会依次尝试完整函数名、缩短后的名称，以及包含所提供文本的名称。匹配多个函数时，会选择总样本数最多的函数。找不到匹配函数，或用于 `zoom`、`select`、`hover` 的函数没有对应图表方框，都会导致命令失败。包含空格的函数名需要加引号。

搜索文本会以小写形式存储。`pick` 会高亮所有调用，而 `select` 和 `hover` 只针对一个方框。`root` 和 `none` 分别是对应命令的保留值。每条命令都会等待 400 ms 使状态稳定。

## 显示和函数面板

| 命令 | 作用 |
| --- | --- |
| `profile invert on\|off` | 显示自底向上的调用栈（`on`）或自顶向下的调用栈（`off`）。 |
| `profile idle on\|off` | 显示或隐藏处于空闲等待状态时采集的样本。 |
| `profile thread <name>\|all` | 显示指定名称的线程，或显示所有线程。 |
| `profile sort self\|total` | 按自身耗时或总耗时排列函数面板。 |

新块默认使用自顶向下布局、隐藏空闲样本、显示所有线程、搜索内容为空，并按自身耗时排列函数面板。线程名必须完全匹配；未知线程会导致命令失败。`all` 会恢复显示所有线程。切换命令必须指定 `on` 或 `off`；排序命令必须指定 `self` 或 `total`。这些命令都会等待 400 ms 使状态稳定。

## 状态

`tern ctl state` 会在 `profile_blocks.blocks` 中报告性能分析块。每个条目包含 `id`、`process`、`pid` 和 `show`。`show` 可以是 `blank`、`sampling`、`reading`、`elsewhere`、`interrupted`、`failed` 或 `ready`。打开或停止记录后请检查此状态，因为显示的失败也会结束这些命令的等待。

图表命令会更新 `focus`（缩放）、`selected`、`picked` 和 `query`。在根视图中，`focus` 为 null。显示命令会更新 `inverted`、`show_idle`、`thread`（所有线程时为 null）和 `sort`。条目还会报告 `samples`、`hidden`、`nodes`、`depth`、`threads`、`span`、`functions` 和 `side`。`weight_unit` 的值为 `samples` 或 `microseconds`：`samples` 和 `hidden` 中保存的权重使用该单位。

## 示例

打开已提交到仓库的 Tern 性能分析记录，放大其样式刷新函数，并显示匹配函数的悬停卡片：

```text
ready
profile fixture tern
zoom
profile zoom "<stencil_ui::tree::Document>::flush"
profile find "stencil_ui::style"
profile hover "stencil_ui::style::visit_children"
wait 300
shot profile-zoom
```

记录任务管理器块中选定的 Tern 进程，然后提前停止：

```text
ready
procs open
wait 2500
procs select "tern"
profile record
shot profile-record
profile stop
shot profile-recorded
```

## 另请参阅

- [任务管理器](procs.md)：选择要记录的进程。
- [终端和窗格](terminal.md)：窗格聚焦和窗格缩放。
- [测试框架命令](harness.md)：指针输入和截图。
- [脚本](index.md)：语法、计时和测试夹具设置。
- [调试](../guides/debugging.md)：驱动正在运行的窗口。
