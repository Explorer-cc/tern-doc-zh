# Canvas 块

`canvas` 命令会打开画布块并在其上绘制：墨迹、形状、箭头和文本，并可使用任意画布快捷键。你可以用它们创建画布以供截图，或检查编辑是否已同步到画布所在的主机及其其他块。

## 打开并等待

| 命令 | 功能 |
| --- | --- |
| `canvas new` | 在当前主机上、聚焦块旁打开一个新的空画布。 |
| `canvas second` | 在聚焦块所属的画布上，紧邻该块打开另一个块。 |
| `canvas wait` | 等待每个画布块都显示其画布，并等待其主机接收所有编辑。 |

`new` 和 `second` 会等待新块的画布打开（或打开失败），然后再等待 350 ms；`wait` 会等待主机的确认，超时时间为脚本的 20 秒。

## 绘制

| 命令 | 功能 |
| --- | --- |
| `canvas tool <name>` | 选择工具：`select`、`hand`、`draw`、`highlight`、`eraser`、`arrow`、`line`、`rect`、`ellipse`、`diamond`、`triangle`、`hexagon`、`parallelogram`、`star`、`cylinder`、`pill`、`bracket`、`brace`、`polygon`、`curve` 或 `text`。 |
| `canvas draw <x,y> <x,y> …` | 在第一个点按下，并使用当前工具拖过其余各点。 |
| `canvas rect <x> <y> <w> <h>` | 绘制矩形（先选矩形工具，再拖动）。 |
| `canvas text <x> <y> "<text>"` | 使用文本工具点击并输入文本。 |
| `canvas key <chord>` | 按 ID 执行画布快捷键（`undo`、`group`、`copy`、`zoom_to_fit`；参见 [`canvas.*`](../reference/actions.md#画布块-canvas)），或按下画布自身接收的按键：`escape`、`delete`、`enter`、`space`、`tab`、`left`、`right`、`up`、`down`。 |
| `canvas select-all` | 选择所有形状。 |
| `canvas look clean\|mono\|sketch` | 设置画布外观。 |

坐标点是画布左上角起算的视图像素；画布初始以 100% 显示其原点，因此坐标也是页面单位。拖动最多每 6 px 移动一步，每 8 ms 采样一次，且不会停顿，因此墨迹不会吸附成形状。这些命令作用于当前聚焦的画布块，并等待 350 ms；未聚焦画布块时会失败。

## 状态

`tern ctl state` 会在 `canvas_blocks[]` 中报告每个块：`id`、`canvas`（`canvas:<id>`）、`phase`（`loading`、`ready` 或 `failed`，并带有 `error`）、`synced`（主机已接收所有编辑）、`focused`、`saved_camera`，以及编辑器的 `tool`、`toolLocked`、`selection`、`focus`、`camera`、`shapes`、`canUndo`、`canRedo`、`editing`、`look` 和 `paper`。
