# 画中画

`pip` 命令会在活动标签页中创建并排列悬浮在所属块上的块。你可以用它捕获浏览器卡片、聚焦或展开的视图、堆叠卡片组，或拖动落位，而无需依赖指针坐标。

## 创建和放置卡片

| 命令 | 作用 |
| --- | --- |
| `pip float [<corner>]` | 将聚焦的分屏块悬浮在接管其空间的块上方。 |
| `pip new [<corner>] ["<address>"]` | 在聚焦块上方创建浏览器卡片。省略地址时会打开空白浏览器。 |
| `pip corner [#<n>] <corner>` | 将卡片移动到所属块的另一个角落。 |

角落为 `tl`、`tr`、`bl` 和 `br`。`float` 默认使用最接近该块原中心的所属块角落；`new` 默认使用右下角。浏览器地址可以是 URL 或裸主机名，例如 `example.com`；可选角落之后的所有词都组成地址。

如果聚焦块无法悬浮，`float` 会失败：它需要另一个符合条件的所属块。创建浏览器卡片也需要一个供其悬浮的块。

带有 `[#<n>]` 的命令会在活动标签页的卡片列表中选取从 1 开始的位置：`#1` 是最早的卡片。在脚本中请将它加引号（`"#1"`），以免被视为注释。未指定编号时，命令选择已聚焦卡片，否则选取最近置顶的卡片。`#0` 无法解析；超出最后一张卡片的编号会报错 `no picture in picture to act on`。裸数字不是卡片选择器。

`tern ctl state` 会在 `pips` 中公开活动标签页的卡片：`id`、`owner`、`corner`、`slot` 和 `rect` 描述其位置。

## 聚焦、大小和停靠

| 命令 | 作用 |
| --- | --- |
| `pip focus [#<n>]` | 聚焦卡片，并放大和展平它以便交互。 |
| `pip expand` | 切换聚焦卡片的普通聚焦尺寸与填满其框架的状态。 |
| `pip resize [#<n>] <w> <h>` | 根据卡片当前模式设置其预览尺寸或聚焦尺寸。 |
| `pip dock [left\|right\|up\|down]` | 将聚焦卡片放回所属块旁的分屏；没有聚焦卡片时，会先选择默认卡片。 |

尺寸是非负 CSS 像素整数；显示的卡片会限制在其框架内。预览尺寸和聚焦尺寸分别保存。没有聚焦卡片时，`expand` 不执行任何操作。`dock` 未指定方向时，如果可用则恢复原分屏位置，否则使用朝向卡片角落的一侧。停靠后，卡片会从 `pips` 中移除。

状态字段 `mode`、`size`、`focus_size`、`rect` 和 `stage_frame` 描述尺寸和显示方式。`mode` 为 `glance`、`focus`、`expanded` 或 `hidden`。

## 移动和释放

| 命令 | 作用 |
| --- | --- |
| `pip fling [#<n>] <vx> <vy>` | 将静止卡片抬起，并以指定速度释放。 |
| `pip drag [#<n>] <dx> <dy> [steps <k>]` | 按偏移量移动已抬起的卡片，并保持抬起状态。 |
| `pip release [<vx> <vy>]` | 释放已抬起的卡片；除非同时给出两个分量，否则使用拖动采样的速度。 |

偏移量为整数 CSS 像素，速度为每秒整数 CSS 像素。x 正方向向右，y 正方向向下。拖动默认分 8 步；步数必须为正整数。使用 `pip release 0 0` 可无惯性落位。落位时可能改变角落、将卡片重新绑定到其他所属块、停靠卡片，或将它停放在边缘。

所选卡片未显示时，`drag` 和 `fling` 会失败。没有正在进行的拖动时，`release` 会报错 `no picture in picture is held`。落位会更新 `pips.owner`、`corner`、`stashed` 和 `flying`；`pip_commits` 会统计已提交的落位手势。`pips` 中没有已抬起拖动的字段。

## 暂存、卡组和检查

| 命令 | 作用 |
| --- | --- |
| `pip stash [#<n>] left\|right` | 将卡片隐藏在指定边缘，并留下用于恢复的标签。 |
| `pip unstash [#<n>]` | 恢复已暂存卡片。 |
| `pip stash-all` | 在活动标签页中切换所有卡片的暂存与显示状态。 |
| `pip fan [#<n>]` | 展开所选卡片的角落卡组，并保持指针逻辑上位于其上。 |
| `pip see [#<n>]` | 使预览卡片半透明且可穿透点击，效果如同鼠标悬停时按住 Option。 |
| `pip menu [#<n>]` | 在卡片顶部附近打开其上下文菜单。 |

`see` 仅影响预览卡片。将指针移开或松开 Option 会清除穿透效果。`stash-all` 不要求选择卡片；其他命令若没有可选卡片都会失败。

状态字段 `stashed`、`tab`、`crowded`、`deck`、`slot` 和 `rect` 会公开暂存标签和卡组布局。布局完成后，`deck` 为 `whole`、`peek<n>` 或 `hidden`。穿透状态和已打开菜单没有专用的 `pips` 字段；请检查渲染树，或使用控制端点的 `menus` 命令。

## 计时和解析

这些命令可用于无头场景和受控窗口，不限于无头运行。除 `drag` 稳定处理 50 毫秒并保持卡片抬起外，命令均稳定处理 650 毫秒动画时间。它们不会等待浏览器页面加载，也没有单独的实时超时。如果截图需要特定页面标题或 URL，请使用 `webview` 报告。

命令行必须严格匹配上面的形式：缺少或多出词语、参数无法解析（角落、侧边、方向、卡片编号或超出有符号 32 位整数范围的数字）都会导致错误，并指出有效形式或参数。`new` 后的第一个词如果不是角落，则作为地址的一部分。

## 示例

按 pip-focus 场景的方式聚焦并展开浏览器卡片：

```text
ready
run "git log --oneline -30 --color=always"
split right
run "ls -G"
pip new br "example.com"
webview ".tn-pane.pip .kit-web-page" title "Example Domain"
focus left
wait 500
pip focus
wait 700
shot pip-focus
pip expand
wait 700
shot pip-expanded
```

按 pip-rebind 的方式拖动卡片并将它重新绑定到另一个窗格：

```text
ready
run "ls -G"
split right
run "git log --oneline -12 --color=always"
split down
focus left
pip new br "example.com"
focus left
pip drag 640 -380 steps 12
wait 60
pip release 0 0
wait 700
shot pip-rebind
```

## 另请参阅

- [浏览器块](browser.md)：浏览和检查浏览器卡片。
- [终端和窗格](terminal.md)：拆分并聚焦所属窗格。
- [测试框架命令](harness.md)：浏览器报告和动画截图。
- [控制命令](control.md)：检查状态和菜单。
- [调试](../guides/debugging.md#通过脚本驱动-window)：驱动正在运行的窗口。
