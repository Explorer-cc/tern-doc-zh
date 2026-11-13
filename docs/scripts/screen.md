# 屏幕块

`screen` 用于打开主机显示器视图，并驱动其显示器选择、尺寸模式和主机输入。你可以用它捕获屏幕共享布局，或在不通过工具栏查找控件的情况下测试远程输入。

## 打开和显示模式

| 命令 | 作用 |
| --- | --- |
| `screen open` | 在聚焦窗格旁打开屏幕块并聚焦；没有打开标签页时会单独创建标签页。 |
| `screen display <id>\|main` | 共享指定显示器或主机的主显示器。 |
| `screen fit` | 将显示器缩放后放入块内，只缩小、不放大。 |
| `screen actual` | 以一个帧像素对应一个设备像素显示，并允许滚动。 |
| `screen control on\|off` | 启用主机输入，或将块设为仅查看。 |

新块默认共享当前主机的主显示器、使用适配模式并启用控制。除 `open` 外，所有命令都要求聚焦屏幕块；否则会报错 `no screen block has focus`。显示器 ID 来自 `tern ctl state` → `screen_blocks[].displays`。`main` 表示默认显示器，而不是字面上的显示器 ID。显示器选择和模式会在查看同一块的窗口间共享。

`open` 会实时等待首帧显示 250 毫秒，或直到共享失败，然后稳定处理 300 毫秒应用时间。`display`、`fit` 和 `actual` 会按照下方输入等待规则等到主机下一帧。`control` 只稳定处理 300 毫秒应用时间；它不会等待帧或权限批准。

在 `screen_blocks` 中，`chosen` 记录所请求的显示器（`main` 对应 `null`）；`display` 和 `display_name` 描述实际显示器。`actual` 和 `control` 记录所选模式。`frame` 和 `fit` 报告帧和适配尺寸，`frames` 统计已显示的帧数。

## 主机输入和等待

| 命令 | 作用 |
| --- | --- |
| `screen click <x> <y>` | 在显示器自身像素坐标中发送主按钮单击，坐标为浮点数。 |
| `screen key <name>` | 按下并释放一个支持的按键，不带修饰键。 |
| `screen type ["<text>"]` | 以输入法提交方式发送文本；省略文本会发送空字符串。 |
| `screen wait` | 等待主机绘制最近发送的输入。 |

按键名称为小写 `a`–`z`、`0`–`9`、`enter`、`escape`、`backspace`、`tab`、`space`、`left`、`right`、`up` 和 `down`。其他名称会解析失败；`screen key` 不支持修饰键组合。坐标是显示器像素，不是窗口坐标，在 Fit 模式下含义也不变。`type` 会将余下的词作为文本；包含空格的文本请加引号。其他命令会读取所需参数并忽略多余词。缺少显示器 ID、控制值无效或单击坐标不是数字/缺失时，解析会失败。

`click`、`key` 和 `type` 要求存在启用了控制的实时共享连接；否则会报错 `the screen block isn't sharing with control`。这些命令和 `wait` 会等到最后一次输入之后出现新帧，并且实际时间过去 250 毫秒仍没有新帧显示。主机没有绘制时，会在实时等待两秒后结束。共享失败也会结束等待。如果没有待处理输入，`wait` 使用首帧规则。每次帧等待后会再稳定处理 300 毫秒应用时间；测试框架的 20 秒超时仍然适用。等待完成并不能证明捕获或输入成功：请检查 `screen_blocks[].failure` 和 `input_refused`。`connected` 表示实时连接，`cursor` 表示主机是否提供了光标形状。

## 无头运行和主机权限

无头运行使用合成测试图案，不会捕获或驱动真实桌面。图案包含编辑器、滚动器和照片窗口，并会标记截图中的输入。若要在无头以外使用，请在屏幕主机的环境中设置 `STENCIL_SCREEN_SOURCE=synthetic`。对于本地守护进程，此变量必须在守护进程启动时设置，而不是只设置在已连接窗口的环境中。

macOS、Windows 和 Linux 支持真实屏幕托管；iOS 和 Web 查看器可以查看远程主机屏幕，但不能托管自己的屏幕。macOS 要求守护进程应用具有屏幕录制权限才能捕获、具有辅助功能权限才能输入。Wayland 每个会话都会通过桌面 portal 请求权限；portal 选择显示器并允许远程控制。X11 不请求权限。Windows 无法向高完整性窗口（例如提升权限的程序）注入输入。捕获失败会显示在 `failure` 中；即使控制已启用，输入被拒也会显示在 `input_refused` 中。

此示例遵循 screen-input golden：单击合成编辑器，在共享画布中输入，再提交文本后截屏。

```text
ready
screen open
screen click 300 200
click .sc-canvas
type hello
screen type "!"
screen wait
shot screen-input
```

## 另请参阅

- [脚本](index.md)：语法、运行脚本和计时。
- [远程主机](remote.md)：连接共享屏幕的主机。
- [测试框架命令](harness.md)：窗口输入和截图。
- [控制命令](control.md)：检查 `state`。
- [调试](../guides/debugging.md)：驱动正在运行的窗口。
