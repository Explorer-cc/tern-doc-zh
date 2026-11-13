# Git 块

`git` 命令可操作仓库的图结构、变更、差异视图和 Git 表单。你可以用它们为 Git UI 截图准备状态，或从控制端点检查仓库。这些命令仅在桌面构建中运行，包括桌面无头运行；不受支持的平台会跳过这些命令并发出警告。

## 打开与等待

| 命令 | 作用 |
| --- | --- |
| `git open [fixture\|media\|"<dir>"]` | 打开某目录所属的仓库，或生成的测试夹具仓库。若当前标签页中已存在该仓库的块，则聚焦该块。 |
| `git wait` | 等待仓库、所选项详情和打开的文件完成加载。 |
| `git loading` | 清空仓库快照、清除所选项并将其标记为未读，以便截取加载状态。 |

`git open` 的默认值是 `fixture`。相对目录采用与其他测试夹具路径相同的解析方式；目录必须属于某个 Git 仓库。如果找不到仓库或无法构建测试夹具，打开操作可能失败。

生成的仓库需要 Git 和可写的临时目录，不需要 `crates/tern/goldens/fixtures` 中的文件。它们使用固定的身份信息和日期，并忽略用户的 Git 配置：

- `fixture` 会构建 **orbit**，这是一个小型 Rust 库，其中 `feature/lanes` 已合并，`fix/long-subjects` 尚未合并，包含标签 `v0.1.0` 和 `v0.2.0`、一个 `origin` 远程仓库、领先 `origin/main` 两个提交的 `main` 分支，以及一个 stash。`src/lib.rs` 已暂存，`src/graph.rs` 有未暂存的变更（包括仅格式调整的差异块），`src/palette.rs` 未跟踪。
- `media` 会构建 **brand-kit**，其中 `assets/badge.png` 和 `icons/mark.svg` 已更改，可用于图像比较。

每个测试夹具在每个进程的临时存储中只构建一次。同一进程中的脚本共享它；其他进程会获得自己的副本。

除 `open` 外，每条命令都作用于当前聚焦的 Git 块，或当前标签页中最新的可见 Git 块。若不存在此类块，命令会失败并提示 `no git block (git open first)`。

`open`、`wait`、选择、搜索、差异、上下文、偏好设置和提交 AI 面板会等待实际仓库工作完成，然后静置 450 ms。它们会在 20 秒后超时。加载过程包括所选项详情、语法高亮和图像显示。打开仓库或加载文件失败也会结束等待：仅仅完成并不能证明加载成功。其他命令会静置 450 ms，但不会等待仓库工作。

`tern ctl state` 将这组状态作为 `git_blocks` 对象（而非数组）公开：`git_blocks.blocks[]` 中包含每个块的 `id`、`focused`、`repo`、`editor` 和 `media`。打开或加载时请检查 `repo.path`、`repo.name`、`repo.ready`、`repo.head` 和仓库计数；`repo.open.error` 会报告打开文件时的错误。仓库打开前，`repo` 可能为 null。

## 图结构与选择

| 命令 | 作用 |
| --- | --- |
| `git select wip` | 选择工作树，并显示 Files 窗格的 Changes 标签。 |
| `git select none` | 清除选择。 |
| `git select <n>` | 选择图中的第 `n` 行并滚动到该行，行号从零开始。 |
| `git select <a>..<b>` | 选择图中两行之间的范围。 |
| `git select "<rev>"` | 选择 `HEAD`、分支、标签、`stash@{n}` 或十六进制提交 ID/前缀。 |
| `git search ["<query>"]` | 关闭打开的文件，打开并聚焦图搜索，并设置查询内容。省略查询内容则打开空搜索。 |

行必须存在于已加载的图中。修订版本从已加载仓库的分支、标签和 stashes 中解析，不接受任意 Git 修订表达式。即使加了引号，数字形式的词也会被视为行号；十六进制 ID/前缀必须至少包含一个字母，才会被视为修订版本。缺少行或无法解析修订版本都会导致失败。stash 会被检查，而不会在图中定位。

这些命令反映在 `git_blocks.blocks[].repo.selection`（`kind` 为 `none`、`wip` 或 `commits`，并带有提交 `ids`）和 `repo.search` 中。选择工作树还会将 `git_blocks.files_tab` 改为 `changes`。

## 差异与文件

| 命令 | 作用 |
| --- | --- |
| `git diff ["<path>"] [file\|history]` | 将已更改文件作为差异视图（默认）、完整文件（`file`）或文件历史（`history`）打开。 |
| `git find ["<query>"]` | 在当前差异视图或完整文件编辑器中打开查找并设置查询内容；省略查询内容时使用空查询。 |
| `git pick <n>` | 选取前 `n` 个已更改的差异行。 |
| `git context more` | 显示当前差异块周围未更改的行。 |
| `git context all` | 显示所有未更改的行，或再次折叠它们。 |

未指定路径时，`diff` 会先选择第一个已更改的工作树文件，然后选择所选提交或范围中的第一个文件。指定路径时，它会按相同优先级查找该精确的仓库相对路径。工作树文件会选择工作树；未暂存的变更优先于已暂存的变更。`file` 和 `history` 是末尾的模式词，不是独立命令。

如果没有匹配的变更或所选提交中的文件，`diff` 会失败。`find` 要求有打开的文件；`pick` 要求差异视图已加载；`context` 要求差异视图处于打开状态。

`n` 必须是非负整数：零表示不选取任何行；若数字大于已更改行数，则会选取所有可用的已更改行。

检查 `git_blocks.blocks[].repo.open` 中的 `path`、`scope`（`staged`、`unstaged`、`commit:<id>` 或 `range`）、`mode`、`loaded`、`error` 和 `picked`。完整文件编辑器和图像比较状态位于该块的 `editor` 和 `media` 中。差异查找和展开的上下文没有专用状态字段。

```text
ready
git open fixture
zoom
git diff "src/graph.rs"
git context more
shot git-context
```

## 差异偏好设置

| 命令 | 作用 |
| --- | --- |
| `git set split on\|off` | 切换并排差异视图。 |
| `git set hunk on\|off` | 切换差异块视图。 |
| `git set wrap on\|off` | 切换自动换行。 |
| `git set tree on\|off` | 在树形和列表视图之间切换文件列表。 |
| `git whitespace exact\|ignore-space\|ignore-formatting` | 设置空白字符比较方式。 |

这些设置会更改窗口级 Git 偏好设置，而不只是所选文件，并会在普通窗口中保存设置。无头模式下不会保存设置。使用这些命令仍然需要 Git 块。`git_blocks` 没有专用的偏好设置字段；请通过 `tree` 或截图检查生成的界面。

## 文件与引用

| 命令 | 作用 |
| --- | --- |
| `git tab files\|changes\|refs` | 显示 Files 窗格中的相应标签。 |
| `git refs fold branches\|remotes\|tags\|stashes\|worktrees\|submodules` | 折叠 Refs 中的一个部分。 |
| `git refs unfold branches\|remotes\|tags\|stashes\|worktrees\|submodules` | 展开 Refs 中的一个部分。 |
| `git refs filter ["<text>"]` | 设置 Refs 筛选条件；省略文本会清除筛选条件。 |

未知标签或部分会导致错误。状态会通过 `git_blocks.files_tab` 公开当前标签，并通过 `git_blocks.refs` 公开 Refs 视图。

## 示例 AI 面板

| 命令 | 作用 |
| --- | --- |
| `git ai explain` | 选择 `HEAD` 并显示预设的提交说明。 |
| `git ai message` | 选择 `HEAD` 并显示预设的提交消息建议。 |
| `git ai staging` | 选择工作树并显示正在运行的 AI 暂存横幅。 |
| `git ai staged` | 选择工作树并显示已完成的 AI 暂存横幅。 |

这些命令只会呈现示例 UI，不会发出真实的 AI 请求，也不会执行暂存操作。如果 `HEAD` 没有提交，`explain` 和 `message` 会失败。`staging` 和 `staged` 也会显示 Changes 标签。状态会反映所选项和 `git_blocks.files_tab`，但不会公开示例 AI 答案或横幅。

## 对话框、菜单与预览

| 命令 | 作用 |
| --- | --- |
| `git dialog branch\|rename\|tag\|message\|remote\|remote-url\|init\|clone\|patch\|stash\|confirm\|discard\|ai-stage` | 打开一个部分填充的 Git 表单示例。 |
| `git menu commit\|branch\|tag\|stash\|file\|rows` | 打开上下文菜单，目标依次为所选提交（否则为 `HEAD`）、当前分支、第一个标签、最新 stash、第一个已更改文件或选取的差异行。 |
| `git peek` | 打开所选提交的预览；若没有，则回退到 `HEAD`。 |

对话框表单不会提交任何操作。`branch` 会故意填入无效名称以展示验证效果；`remote` 会选择 GitHub，而 `remote-url` 使用 URL。未知表单会导致失败，包括 `git dialog open`。

如果菜单目标不存在，菜单命令会失败：没有提交、`HEAD` 处于分离状态、没有标签、没有 stash、没有已更改文件，或没有选取的行。使用 `git menu rows` 前，请先运行 `git pick`。预览要求对应提交的图中行已绘制且其内容已加载；否则会失败。

状态会将 `git_blocks.dialog` 和 `git_blocks.peek` 报告为布尔值。菜单可通过 `tern ctl menus` 获取，没有专用的 `git_blocks` 字段。

```text
ready
git open media
zoom
git diff "assets/badge.png"
shot git-image
```

## 另请参阅

- [脚本](index.md)：语法、运行脚本和时序。
- [Files 窗格](files.md)：Files 窗格控件。
- [偏好设置](prefs.md)：窗口设置。
- [控制命令](control.md)：状态、菜单和检查。
- [调试](../guides/debugging.md)：从脚本驱动窗口。
