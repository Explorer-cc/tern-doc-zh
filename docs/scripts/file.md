# 文件块

`file` 用于打开文件，并驱动其文本、图像、3D 模型（OBJ、PLY、VRML）和十六进制视图。使用它可以捕获加载、编辑、磁盘冲突和 git 更改，而无需通过文件选择器导航。命令针对当前聚焦的文件块，或当前标签页中最近聚焦的文件块；需要文件块的命令在不存在文件块时会以 `no file block` 失败。

## 打开文件

| 命令 | 功能 |
| --- | --- |
| `file open <path> [split\|beside\|tab\|preview] [<line>[:<col>]] [nowait]` | 打开路径，可选地定位到文本位置。 |
| `file scratch <name> [split\|beside\|tab\|preview] [nowait]` | 将一个已提交到仓库的测试夹具复制到新的临时目录，并打开副本。 |
| `file fixture large\|longline\|mdlong\|huge\|bin4g\|git\|gitmd\|editorconfig\|readonly [split\|beside\|tab\|preview] [nowait]` | 生成临时测试夹具并打开。 |

未指定位置时，打开操作遵循 Tern 的常规放置策略。`split` 和 `beside` 是同义词；`tab` 会在标签页中打开，`preview` 则请求预览块。放置方式、位置和 `nowait` 可在路径之后按任意顺序排列。如果给出多个放置方式，以最后一个为准。

通常，打开操作会等待当前标签页的文件块完成加载、高亮和 git 更改更新，然后再静置 350 ms。`nowait` 会跳过这段等待。打开失败时命令会失败。行和列从 1 开始；省略列时表示行首。

相对路径会先匹配 `crates/tern/goldens/fixtures/files` 下的现有测试夹具，否则使用[脚本](index.md#测试夹具)中描述的常规测试夹具/路径解析方式。绝对路径会直接使用。`scratch` 接受文件名，而不是包含 `/` 的路径；在编辑、保存、覆盖或删除已提交的测试夹具之前，应先使用它。

已提交到仓库的测试夹具位于该目录中，名称为：`anim.gif`、`blob.bin`、`crlf.txt`、`icon.svg`、`latin1.txt`、`links.txt`、`mixed-eol.txt`、`notes.md`、`photo.jpg`、`report.pdf`、`sample.rs` 和 `wide.png`。

生成的测试夹具：

| 名称 | 内容 |
| --- | --- |
| `large` | 一百万行类似 Rust 的代码，约 42 MB。 |
| `longline` | 一行 5 MB 的压缩 JavaScript。 |
| `mdlong` | 一份包含正文、列表、代码和表格的长 Markdown 文档。 |
| `huge` | 一个 600 MiB 的日志，超过可编辑大小限制后为只读。 |
| `bin4g` | 一个稀疏的 4 GiB 二进制文件，以十六进制分页显示；每隔 256 MiB 及文件末尾都有标记记录。 |
| `git` | 仓库中的 `sample.rs`，包含新增、更改和删除的行。 |
| `gitmd` | 仓库中的 `notes.md`，包含更改的正文和表格行、已删除的列表项以及新增的任务。 |
| `editorconfig` | 一个受 `.editorconfig` 约束的文件，该配置要求使用两个空格缩进。 |
| `readonly` | 一个没有写入权限的文件。 |

大型生成测试夹具会缓存在系统临时目录中。创建或复制测试夹具出错时，命令会失败。打开操作会反映在 `state.file_blocks[]` 中的 `path`、`host`、`kind`、`mode`、`preview` 和 `load` 字段。`load` 的值为 `opening`、进度 `{done,total}`、`ready` 或 `failed`。

## 视图、位置和搜索

| 命令 | 功能 |
| --- | --- |
| `file mode rendered\|source\|hex\|image\|model\|text` | 更改文件的显示模式。 |
| `file goto <line>[:<col>]` | 移动到从 1 开始的文本位置；列默认为 1。 |
| `file offset <byte>` | 将十六进制视图移动到十进制或 `0x` 十六进制字节偏移。 |
| `file select <a> <b> [<a> <b> …]` | 按十进制字节偏移设置文本选区；最后一对为主选区。端点相同时表示插入光标。 |
| `file zoom fit\|100\|actual\|<pct>[%] [<x> <y>]` | 设置图像缩放，可选地以视口中的某点为锚点。 |
| `file find "<query>" [regex] [case]` | 在文本或十六进制视图中打开搜索。 |
| `file peek <line>:<col>` | 在从 1 开始的文本位置预览链接或路径，效果如同强力点击。 |

`select` 至少需要一组完整的端点，并会将偏移限制在文本长度内。`offset` 需要十六进制视图；`select` 和文本搜索需要代码视图；`zoom` 需要图像视图。不支持的视图会导致相应命令失败。数值缩放百分比必须为正数；如果提供任一锚点坐标，就必须同时提供两个坐标。搜索默认使用不区分大小写的字面匹配。`regex` 和 `case` 可按任意顺序出现；十六进制搜索使用 `case`，但忽略 `regex`。使用 `file wait` 等待十六进制搜索完成计数。

如果该处没有链接或路径，或者无法查看任何内容，`peek` 会失败。它会实时等待要查看的文本完成加载和高亮。本组中的其他命令会静置 350 ms。

状态会报告 `mode`、文本 `caret` 和 `selections`、图像 `zoom`，以及十六进制视图的 `hex.selection`、`hex.matches`、`hex.counted` 和 `hex.current`。文件块状态中没有 peek 或文本搜索查询对应的字段。

## 保存和磁盘更改

| 命令 | 功能 |
| --- | --- |
| `file save` | 请求保存目标块。 |
| `file disk "<text>"` | 覆盖磁盘上的目标文件，使其监视器可以重新加载文件或显示冲突。 |
| `file delete-on-disk` | 删除磁盘上的目标文件。 |
| `file autosave off\|focus\|<ms>` | 禁用自动保存、在焦点更改时保存，或设置以毫秒为单位的延迟。 |

`save` 会静置 350 ms，不一定等到保存完成；结果重要时，应接着使用 `file wait saved`。`disk` 和 `delete-on-disk` 在文件系统出错时会失败，并为监视器实时等待 1.5 秒。这是固定延迟，并不检查重新加载或冲突是否已经出现。自动保存会更改已保存的文件偏好设置，而不仅仅是目标块，并且不要求打开文件块。

检查 `state.file_blocks[].dirty` 和 `bar`，以查看未保存更改以及冲突、文件已删除或其他通知。这些行中没有自动保存设置。

## 菜单和 git 更改

| 命令 | 功能 |
| --- | --- |
| `file menu more` | 打开文件块的更多菜单。 |
| `file choose <action>` | 直接执行文件菜单操作，无需先打开菜单。 |
| `file change <n> hover\|toggle\|revert\|stage` | 显示 git 更改的悬停控件，在行内切换显示其旧行，将其还原为一次可撤销的编辑，或暂存它。 |

操作名称包括 `compare`、`keep-mine`、`use-disk`、`recreate`、`close`、`discard`、`reveal`、`open-outside`、`retry`、`save-as`、`view-hex`、`view-text`、`save`、`revert`、`wrap`、`copy-path`、`copy-relative-path`、`create-folders` 和 `copy-markdown`。也接受以下参数形式：

| 命令 | 功能 |
| --- | --- |
| `file choose mode:rendered\|mode:source\|mode:hex\|mode:image\|mode:model\|mode:text` | 选择显示模式。 |
| `file choose eol:lf\|eol:crlf\|eol:cr` | 转换文档的行尾。 |
| `file choose reopen:<encoding>` | 使用指定的编码标签重新打开。 |

编码标签包括 `utf-8`、`utf-16le`、`utf-16be`、`windows-1252`、`iso-8859-1`、`iso-8859-15`、`macintosh`、`windows-1250`、`windows-1251`、`koi8-r`、`windows-1253`、`windows-1254`、`windows-1255`、`windows-1256`、`shift_jis`、`euc-jp`、`euc-kr`、`gbk`、`gb18030` 和 `big5`。

菜单操作取决于文件状态和视图。操作名称未知时，脚本会失败并列出有效名称。没有文件视图时，`menu more` 会失败。操作请求的原生对话框或外部应用程序取决于平台；`file` 命令组本身不受仅限桌面或仅限无头环境的限制。

Git 更改索引从 0 开始。更改操作需要代码视图和有效的更改索引；如果更改无法暂存，暂存操作也会失败。还原和暂存会等待加载、高亮及当前 git 更改完成；悬停和切换操作会静置 350 ms。状态会公开结果中的 `dirty`、`bar` 和 `mode`，但不会公开菜单可见性、换行设置或 git 差异块详情。

## 等待

| 命令 | 功能 |
| --- | --- |
| `file wait` | 等待当前标签页中的每个文件块完成加载、高亮、十六进制搜索计数以及 git 更改更新。 |
| `file wait loaded` | 等待当前标签页中的每个文件块加载完成或失败，然后运行一帧，不等待高亮。 |
| `file wait saved` | 等待没有正在进行的保存，并且没有待处理的自动保存延迟。 |

当前标签页没有文件块时，`wait` 和 `wait loaded` 会失败。`wait saved` 不要求存在文件块。这些等待操作使用实际时间，并受脚本 20 秒超时限制；`wait` 和 `wait saved` 还会静置 350 ms。加载失败也算作完成，因此不要把等待完成视为文件已正确加载的证明；应检查 `state.file_blocks[].load`。`wait loaded` 之后的屏幕截图仍可能等待视口高亮。

## 示例

如 file-conflict 场景所示，编辑临时副本并捕获外部写入冲突：

```text
ready
file scratch sample.rs split
file select 0 0
type "// mine\n"
file disk "// theirs\n"
shot file-conflict
```

如 file-code-find 场景所示，捕获正则搜索：

```text
ready
file open sample.rs split
file find "Task::\\w+" regex
shot file-code-find
```

## 另请参阅

- [脚本](index.md)：运行命令、计时和测试夹具根目录。
- [文件窗格](files.md)：打开文件前浏览目录。
- [Git 块](git.md)：处理仓库更改。
- [测试框架命令](harness.md)：输入文本、按键、对话框和屏幕截图。
- [调试](../guides/debugging.md)：通过脚本驱动窗口。
