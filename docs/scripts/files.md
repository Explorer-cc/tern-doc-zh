# 文件窗格

`files` 用于驱动 Tern 块旁边的目录树：包括其根目录、展开的文件夹、选择项、筛选器和实时更新。你可以用它浏览实际文件夹，也可以将窗格设置为可重复的状态，以便截图、展示加载状态和测量大型目录树。

## 窗格和根目录

| 命令 | 作用 |
| --- | --- |
| `files show` | 打开 Files 窗格。 |
| `files hide` | 关闭 Files 窗格。 |
| `files toggle` | 在打开和关闭窗格之间切换。 |
| `files focus` | 将键盘焦点移至 Files 窗格。 |
| `files root <path>` | 打开窗格，并将当前标签页的根目录固定到本地路径。 |
| `files follow` | 移除当前标签页的固定设置，使根目录再次跟随获得焦点的块。 |
| `files width <px>` | 以像素为单位设置窗格宽度。 |

包含空格的路径要加引号。`root` 不要求目录可读：不可读或不存在的根目录会显示为窗格错误，而不会导致命令失败。宽度接受 0 到 65535 的整数；缺失或无效的值会导致解析失败。固定设置按标签页分别生效。

除行列表和筛选文本外，命令只使用所示参数；多余的尾随单词会被忽略。缺少必需路径会导致解析失败。

`tern ctl state` 会在 `files` 下报告这些更改：`shown`、`focused`、`width`、`root`、`host`、`pinned` 和 `error`。没有根目录时，此条目仅包含 `shown` 和 `root: null`。

## 行与筛选

| 命令 | 作用 |
| --- | --- |
| `files expand [<rel> …]` | 打开指定文件夹，包括其目录列表尚未到达的祖先文件夹。 |
| `files collapse [<rel> …]` | 关闭指定文件夹。 |
| `files select [<rel> …]` | 将选择替换为第一行，然后逐个切换其余各行的选中状态。 |
| `files cursor [<rel> …]` | 依次单独选择每个指定行；最后一行成为光标所在行和唯一选中项。 |
| `files reveal <rel>` | 打开窗格，显示相对路径并聚焦行列表。 |
| `files filter [<query> …]` | 打开筛选器并设置文本；不带单词或使用 `""` 可清除筛选器。 |

路径相对于显示的根目录。`expand` 可以请求尚未列出的路径，并安排在目录列表到达后将其展开。若路径未列出，其他行命令会失败；若行当前未显示（例如位于折叠的文件夹内），`select` 和 `cursor` 也会失败。非空行操作需要根目录。空参数列表有效，并保持选择不变。选择命令在实际选择了内容时会聚焦行列表。

筛选器会用空格连接各单词，因此 `files filter "view rows"` 和 `files filter view rows` 会设置相同的查询。

通过 `files.visible`、`rows` 和 `loaded` 检查目录树，通过 `cursor` 和 `selected` 检查选择状态。`visible` 最多包含 200 行，深度以缩进显示；`selected` 最多包含 64 条路径。`files.filter` 会报告查询、匹配数和索引数、完成标志及耗时。存在行池时，`files.pool` 会报告可见行范围、滚动位置和延后处理的工作。

## 生成的测试夹具与性能

这些夹具会在临时目录中构建，而不是从源代码树的夹具文件夹读取。每次构建都会使用自己的目录。夹具会打开窗格、更改获得焦点的块的工作目录，并在该块有 shell 时向其发送 `cd`。如果没有获得焦点的块，或夹具创建失败，命令就会失败。固定的根目录仍具有优先权；必要时先使用 `files follow`。如果下一步需要 shell 提示符，请随后使用 `ready`。

| 命令 | 作用 |
| --- | --- |
| `files fixture small` | 构建包含多种文件类型、点文件、紧凑文件夹链的目录；在 Unix 上还会包含目录符号链接。 |
| `files fixture git` | 构建包含已修改、已暂存、未跟踪、冲突和已忽略文件的仓库，并固定提交日期。 |
| `files fixture wide` | 在 `wide` 中构建 10000 个文件，并在根目录放置一个 README。 |
| `files fixture deep` | 构建嵌套的紧凑文件夹链，以及适用于三级粘性标题栏堆叠的文件夹。 |
| `files fixture denied` | 构建小型目录树及 `locked/secret.txt`；在 Unix 上移除访问 `locked` 的权限。 |
| `files fixture empty` | 构建空目录。 |
| `files fixture synth [<n>]` | 构建平衡目录树，文件夹包含 32 个条目，文件夹最多三层，之后为文件。 |
| `files model <n>` | 将根目录的内存目录列表替换为合成的已展开文件夹和文件，不写入磁盘。 |

`synth` 接受可选的非负计数。缺失或无法解析的计数会变为 0，构建器至少使用 1。其他夹具名称也接受可选计数，但不会使用该计数。未知的夹具名称会导致失败。Git 夹具要求 `git` 可执行文件正常工作。拒绝访问夹具中的权限更改和小型夹具中的符号链接仅适用于 Unix；权限操作是否失败取决于运行 Tern 的用户。

`model` 需要根目录和非负整数计数。它会创建 `min(100, max(1, n))` 个名为 `dir000`、`dir001`、… 的文件夹，每个文件夹包含 `n / folder-count` 个文件，向下取整。每第七个文件使用 `.md`，其余使用 `.rs`。所有文件夹都会展开，选择会被清除；计数为 0 时会生成一个空文件夹。之后，磁盘目录列表可以替换这个合成目录树。

夹具结果会显示在 `files.root`、`repo`、`error`、`visible` 和 `loaded` 中。对于大型目录树，请同时检查 `files.mem`、`firstRowsMs`、`lastListMs`、`status`、`filter` 和 `pool`，以及 `rows` 和 `loaded`。

## 磁盘更改与实时更新

| 命令 | 作用 |
| --- | --- |
| `files touch <rel>` | 创建父目录并写入空文件；若文件已存在则截断。 |
| `files rm <rel>` | 删除文件或递归删除目录。 |
| `files storm <n>` | 在根目录下创建 `storm/f0` 至 `storm/f<n-1>`。 |
| `files hold` | 暂停目录列表响应，以便保持加载状态可见。 |
| `files release` | 释放已暂停的响应并处理可用回复。 |
| `files poll` | 从监视切换为轮询，显示“非实时”状态。 |
| `files watch` | 再次启用监视。 |
| `files wait` | 等待，直到没有待处理的目录列表、状态、筛选或操作工作。 |

**磁盘命令会更改当前根目录下的真实文件。** 测试这些命令时请使用生成的夹具。它们需要根目录，遇到文件系统错误时会失败；若路径不存在，`rm` 会失败。`storm` 接受非负整数计数，且不会移除先前 `storm` 操作留下的文件。即使窗格显示的是远程根目录，这些命令仍执行本地文件系统操作；它们用于本地夹具。

命令会等待待处理的 Files 工作结束，然后将脚本时间推进 350 ms。`touch` 和 `rm` 使用 600 ms；`storm` 使用 1000 ms。等待实际工作时，脚本超时为 20 秒。即使仍有工作，已暂停的窗格也会视为已稳定，因此 `files wait` 不会释放已暂停的响应，也不会因这些响应而阻塞。`release` 会恢复正常的等待流程。这组命令没有仅限桌面或仅限无头模式的限制。

`files.pending` 反映进行中的工作；即使已暂停，它也可能仍为 true。`files.live` 反映是否正在监视。`events` 和 `relists` 分别统计监视器事件和重新列出次数，而 `lastListMs` 记录目录列表耗时。没有单独的状态字段表示暂停标志。

## 示例

Files 布局场景中使用的 Git 夹具，包含嵌套文件夹和一个已选中的更改文件：

```text
ready
files fixture git
ready
files expand src src/view
files select src/view/rows.rs
files wait
shot files-git-selection
```

来自 Files 筛选场景的筛选示例：先显示有匹配项的筛选，再显示无匹配项的筛选：

```text
ready
files fixture small
ready
files filter "vfr"
files wait
shot files-filter
files filter "zzqx"
files wait
shot files-filter-none
```

## 另请参阅

- [脚本](index.md)：语法、时序和运行脚本。
- [文件块](file.md)：在块中打开和编辑文件。
- [远程主机](remote.md)：浏览已连接的主机。
- [测试框架命令](harness.md)：键盘输入和截图。
- [调试](../guides/debugging.md)：通过脚本驱动窗口。