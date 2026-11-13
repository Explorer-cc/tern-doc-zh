# Notebook 块

`notebook` 命令可打开和编辑 Jupyter 笔记本，使用真实内核运行其中的单元格，并操作搜索、补全和笔记本面板。使用这些命令来测试笔记本编辑，或捕获实际执行结果。它们仅在桌面版中可用，iOS 和 Web 版不可用。

## 打开与选择

| 命令 | 作用 |
| --- | --- |
| `notebook fixture <name>` | 将笔记本测试夹具中的 `<name>.ipynb` 复制到临时文件夹，并在当前焦点窗格旁打开。 |
| `notebook new` | 在新的临时文件夹中创建笔记本。 |
| `notebook open <path>` | 使用常规打开位置打开现有笔记本。 |
| `notebook select <n>` | 仅选择单元格 `<n>` 并进入命令模式。 |
| `notebook edit` | 在活动单元格中进入编辑模式。 |
| `notebook command` | 返回命令模式。 |
| `notebook type <text>` | 在正在编辑的单元格各插入点处插入文本；`\n` 会转换为换行符。 |

单元格编号从零开始。选择超出范围的单元格会失败，并显示笔记本的单元格数量。除非正在编辑单元格，否则输入文本会失败。除打开命令和 `wait` 外，命令都要求焦点位于笔记本块；否则会失败并提示 `no notebook block has focus`。

测试夹具来自 `crates/tern/goldens/fixtures/notebook`。每次都会重新复制夹具，并移除临时检查点；编辑副本不会更改已提交到仓库的夹具。缺少夹具或发生文件系统错误时，命令会失败。`new` 会重新创建该进程专属的临时目录，因此不能用来保留先前的工作。

打开命令会等待笔记本工作稳定，然后为绘制留出 300 ms 的应用时间。检查 `tern ctl state` → `notebook_blocks[]` 中的 `path`、`phase`、`focused`、`mode`、`active`、`selected` 和 `editing`。加载失败会显示在 `phase` 中；稳定本身并不代表加载成功。若笔记本尚未加载，选择操作会失败。

## 编辑单元格

| 命令 | 作用 |
| --- | --- |
| `notebook insert above\|below [code\|markdown\|raw]` | 在所选内容上方或下方插入单元格；默认类型为 `code`。 |
| `notebook kind code\|markdown\|raw` | 更改所选单元格的类型。 |
| `notebook delete` | 删除所选单元格。 |
| `notebook undo` | 撤销笔记本编辑。 |
| `notebook redo` | 重做已撤销的编辑。 |
| `notebook move up\|down` | 将所选单元格上移或下移。 |
| `notebook merge` | 合并所选单元格；如果只选择了一个单元格，则将活动单元格与下一个单元格合并。 |
| `notebook split` | 在插入点或选择边界处分割正在编辑的单元格；分割后继续编辑最后一部分。 |
| `notebook collapse input\|output` | 切换所选单元格的输入或输出可见性。 |
| `notebook clear [all]` | 清除所选单元格的输出；指定 `all` 时清除所有单元格的输出。 |
| `notebook save` | 保存笔记本。 |

在编辑模式之外，`split` 不会执行任何操作。若没有后续单元格，合并也不会执行任何操作。这些编辑命令会等待 300 ms 的应用时间稳定；它们不会等待内核执行完成。

检查 `notebook_blocks[].dirty`、`can_undo`、`can_redo` 和 `cells`。每个单元格都会报告其 `index`、`kind`、`source`（前 80 个字符）、`lines`、`edited`、`outputs`、`input_hidden` 和 `output_hidden`。保存状态会反映在 `dirty` 中。

## 执行与内核

| 命令 | 作用 |
| --- | --- |
| `notebook run [all\|<n>]` | 默认运行所选单元格；指定 `all` 时运行所有单元格，指定 `<n>` 时运行该单元格。 |
| `notebook interrupt` | 中断内核。 |
| `notebook restart` | 重启内核，不提示确认。 |
| `notebook wait` | 等待所有笔记本的加载、执行、内核启动和待处理面板工作稳定。 |

执行使用真实内核及其已安装环境，而非预设输出。若单元格不存在，`run <n>` 会失败。`run`、`interrupt` 和 `restart` 在分派后只允许 300 ms 的应用时间；在断言结果或截取执行完成后的画面前，请接着运行 `notebook wait`。

`wait` 不要求焦点位于笔记本。打开命令也会使用相同的等待机制：它涵盖所有笔记本块，而不只是当前焦点所在的块，并会在真实时间 20 秒后放弃等待。它不要求内核已启动，也不会等待补全、工具提示或帮助请求；这些请求由各自的命令等待。

状态会公开 `notebook_blocks[].python` 和 `kernel`，以及每个单元格的 `state`（`idle`、`queued` 或 `running`）、`count`、`prompt`、`outputs` 和 `took_ms`。命令稳定并不意味着已执行代码成功；请检查输出。

## 查找与替换

| 命令 | 作用 |
| --- | --- |
| `notebook find <text> [replace <text>]` | 打开笔记本搜索，并可选择设置替换文本。 |
| `notebook find-next` | 移至下一个匹配项。 |
| `notebook find-previous` | 移至上一个匹配项。 |
| `notebook replace [all]` | 替换当前匹配项；指定 `all` 时替换所有匹配项。 |
| `notebook find-close` | 关闭查找栏。 |
| `notebook find-option case\|word\|regex\|outputs` | 切换大小写敏感、全字匹配、正则表达式或搜索输出的选项。 |

搜索和替换文本都支持用 `\n` 表示换行符。每项都作为一个单词传递：包含空格的文本要加引号（`notebook find "total population" replace count`）；`replace ""` 会将替换文本设为空。选项是切换状态，而非设置值。这些命令会等待 300 ms 的应用时间稳定。

`notebook_blocks` 中没有专用的查找栏字段。请通过可见的查找栏检查搜索状态；替换内容会反映在 `dirty` 和 `cells[].source` 中。

## 面板与内核辅助功能

| 命令 | 作用 |
| --- | --- |
| `notebook sheet contents\|properties\|variables\|help\|none` | 显示笔记本面板；指定 `none` 时隐藏面板。 |
| `notebook complete` | 在正在编辑的代码单元格插入点请求内核补全，并等待结果。 |
| `notebook accept` | 接受已打开补全列表中选中的条目。 |
| `notebook inspect` | 在正在编辑的代码单元格中请求内核检查；重复执行会展开工具提示。 |
| `notebook help <name>` | 打开指定名称的帮助面板，并等待内核帮助结果。 |

如果按 Tab 会缩进，`complete` 就会失败：请先在插入点前有文本的代码单元格中编辑。若没有打开补全列表，`accept` 会失败。若未在编辑代码单元格，`inspect` 会失败。

`complete`、`inspect` 和 `help` 会等待所有笔记本稳定，并等待待处理的补全、检查和帮助请求完成，然后为绘制留出 300 ms 的应用时间。真实时间等待会在 20 秒后失败。`sheet` 和 `accept` 只等待 300 ms 的稳定；打开 Variables 面板后，如果内核工作结果很重要，请运行 `notebook wait`。

状态会公开 `notebook_blocks[].sheet`、`completion`、`tooltip` 和 `help`。

## 示例

运行已提交到仓库的执行测试夹具并捕获结果，如 `notebook-run` 场景所示：

```text
size 1200 800
ready
notebook fixture run
zoom
notebook run all
notebook wait
shot notebook-run
```

使用 `notebook-find` 中的命令序列搜索 tour 测试夹具，切换正则匹配，然后关闭搜索：

```text
ready
notebook fixture tour
zoom
notebook find df replace frame
notebook find-next
shot notebook-find
notebook find-option regex
notebook find (unclosed
shot notebook-find-regex
notebook find-option regex
notebook find-close
notebook select 0
notebook find kernel
shot notebook-find-markdown
```

## 另请参阅

- [脚本](index.md)：语法、测试夹具和时序。
- [测试框架命令](harness.md)：键盘输入和截图。
- [会话与块](sessions.md)：聚焦和排列块。
- [调试](../guides/debugging.md#通过脚本驱动-window)：驱动运行中的窗口。
