# Board 块

`board` 命令用于打开 Markdown 任务看板，并操作其中的卡片、泳道、内联编辑器和菜单。你可以用它们测试看板工作流、截取看板或列表视图，并检查看板如何重新加载文件中的更改。

## 打开和重新加载

| 命令 | 作用 |
| --- | --- |
| `board fixture <name>` | 将一个看板测试夹具复制到新的临时项目，并在当前聚焦窗格旁打开。 |
| `board new` | 打开一个没有任务文件的新临时项目。 |
| `board open <path>` | 在当前聚焦窗格旁打开一个任务文件。 |
| `board write "<markdown>"` | 在磁盘上替换当前聚焦看板的文件，然后等待看板重新加载该内容。 |
| `board wait` | 等待当前聚焦看板读取其文件。 |

测试夹具来自 `crates/tern/goldens/fixtures/board/<name>.md`。每个测试夹具都会复制到一个以夹具命名的临时项目中的 `TODO.md`；再次打开会重置该副本。`board new` 也会重置其临时项目。它会以 Todo、Doing 和 Done 泳道启动；提交第一张卡片时会创建 `TODO.md`。新打开的看板使用看板视图，并显示已完成的卡片。

打开、`write` 和 `wait` 会等待实际文件操作，使用脚本的 20 秒超时，然后再等待 350 ms。`wait` 检查初次读取是否完成，而不是检查之后的外部编辑是否已到达。`write` 会检查显示的磁盘内容是否与当前文件一致，或者看板是否在内联编辑或拖动期间看到更改（该操作结束后会与编辑内容一并显示）。在其 Markdown 参数中使用 `\n` 表示换行。测试夹具复制和文件写入错误会使命令失败；若读取始终未达到所需状态，则会超时。

`tern ctl state` 会在 `board_blocks[]` 中报告每个看板：包括 `path`、`phase`（`loading`、`ready` 或 `failed`）、`exists`、`open` 和 `done`，以及其泳道和卡片。新的未保存看板具有 `exists: false`。

## 视图、选择和菜单

| 命令 | 作用 |
| --- | --- |
| `board view board\|list` | 设置卡片列视图或分区列表视图。 |
| `board hide-done on\|off` | 隐藏或显示已完成的卡片。 |
| `board select "<text>"` | 选择标题中包含该文本的第一张卡片。 |
| `board lane <n>` | 选择一个泳道，并清除所选卡片。 |
| `board filter ["<text>"]` | 设置筛选条件；不提供文本则清除筛选条件。 |
| `board fold <n>` | 在列表视图中切换泳道分区的折叠状态。 |
| `board menu` | 打开所选卡片的菜单。 |
| `board menu lane` | 打开当前泳道的菜单。 |

泳道编号从零开始。选择时会按文件顺序搜索泳道和卡片，并使用区分大小写的子串匹配，而不只搜索当前显示的卡片。找不到匹配项、不存在的泳道，或未选择卡片时打开卡片菜单，都会导致失败。即使当前处于看板视图，`fold` 也会保存折叠状态。

这些命令针对当前聚焦的看板，并等待 350 ms。除打开命令外，如果没有聚焦的看板，命令都会失败；如果缺少看板视图，命令也会失败。这组命令没有仅限桌面或仅限无头模式的限制。

状态字段包括 `view`、`hide_done`、`cursor`（所选标题）、`lane`、`filter` 和 `lanes[].folded`。每个泳道还会报告 `title`、`complete`、`shown` 和 `cards`（每张卡片的 `text` 和 `done`）。可以使用控制命令 `menus` 检查菜单内容。

## 内联编辑和拖动

| 命令 | 作用 |
| --- | --- |
| `board type ["<text>"]` | 替换当前内联编辑器中的文本；不提供文本则清空编辑器。 |
| `board commit` | 提交当前内联编辑，效果相当于按 Enter。 |
| `board drag <lane> <slot> [hold] "<card>"` | 将标题中包含该文本的第一张卡片拖到目标泳道和位置。 |

使用下方的看板操作开始内联编辑。没有正在进行的内联编辑时，`type` 和 `commit` 会失败；它们等待 350 ms，而不是等待独立的磁盘读取条件。

拖动时泳道和位置的编号从零开始。位置按目标泳道当前显示的卡片计数，不包括正在拖动的卡片。位置超过最后一张卡片时，会将卡片追加到末尾。不使用 `hold` 时，拖动会放下卡片；使用 `hold` 时，卡片会保持悬起状态，以便截图。找不到卡片、卡片未渲染或泳道不存在，都会导致失败。拖动后会等待 350 ms。移入或移出已完成泳道时，会更新卡片的完成状态。

状态会公开 `editing`、`dragging`、操作后得到的 `lanes[].cards`，以及 `can_undo` / `can_redo`。

## 看板操作

`board key <id>` 会直接调用一个操作：请使用下表中的标识符，而不是物理按键名称或 `board.` 前缀。未知标识符会导致失败。操作后会等待 350 ms。通常需要选中卡片的操作在未选择卡片时不会执行；无法撤销/重做，或在边界处移动时，也不会执行任何操作。

| 命令 | 作用 |
| --- | --- |
| `board key up\|down` | 选择上方或下方的卡片。 |
| `board key left\|right` | 选择前一个或后一个泳道中的卡片。 |
| `board key first\|last` | 选择第一张或最后一张卡片。 |
| `board key move_up\|move_down` | 在当前泳道中移动所选卡片。 |
| `board key move_left\|move_right` | 将所选卡片移至前一个或后一个泳道。 |
| `board key toggle` | 将所选卡片标记为已完成，或重新标记为未完成。 |
| `board key edit` | 开始编辑所选卡片的标题。 |
| `board key new_below\|new_above` | 在所选卡片下方或上方开始新卡片；若未选择卡片，则在当前泳道中开始新卡片。 |
| `board key delete` | 删除所选卡片。 |
| `board key undo\|redo` | 撤销或重做看板更改。 |
| `board key details` | 切换所选卡片的备注和子任务面板。 |
| `board key filter` | 聚焦筛选字段。 |
| `board key switch_view` | 切换看板视图和列表视图。 |
| `board key hide_done` | 切换是否隐藏已完成的卡片。 |
| `board key clear` | 清除详情、筛选条件或选择。 |
| `board key new_lane` | 在当前泳道之后开始新泳道。 |
| `board key rename_lane` | 开始编辑当前泳道的标题。 |
| `board key move_lane_left\|move_lane_right` | 将当前泳道向左或向右移动。 |
| `board key delete_lane` | 删除当前泳道。 |
| `board key done_lane` | 切换当前泳道是否为已完成泳道。 |
| `board key open_markdown` | 在看板旁边的文件块中打开看板文件。 |

创建或重命名卡片、泳道后，使用 `board type` 和 `board commit`。操作结果会显示在 `board_blocks[]` 的 `cursor`、`lane`、`editing`、`details`、`view`、`hide_done`、`filter`、`done_lane`、`lanes`、`can_undo` 和 `can_redo` 字段中。`open_markdown` 会聚焦文件块；继续发送看板命令前，请重新聚焦看板。

## 示例

在新项目中创建第一个任务：

```text
ready
board new
zoom
shot board-new
board key new_below
board type "Sketch the onboarding flow"
board commit
shot board-new-created
```

将一个测试夹具显示为列表，折叠 Backlog，然后隐藏已完成的任务：

```text
ready
board fixture launch
zoom
board view list
board fold 0
board select "Notarize"
shot board-list
board hide-done on
shot board-list-hide
```

## 另请参阅

- [脚本](index.md)：运行脚本、计时和测试夹具设置。
- [文件块](file.md)：操作从看板打开的 Markdown 文件。
- [控制命令](control.md)：检查状态和菜单。
- [测试框架命令](harness.md)：指针输入和截图。
- [调试](../guides/debugging.md)：通过脚本驱动窗口。
