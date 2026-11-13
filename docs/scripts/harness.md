# Harness 命令

测试框架命令驱动窗口本身：输入、视口、时间、捕获以及模拟的系统事件。将它们与 Tern 命令结合使用，以复现用户交互、捕获状态转换，或向无头窗口提供无法从操作系统接收的事件。

## 视口、时间与捕获

| 命令 | 作用 |
| --- | --- |
| `size <W> <H> [scale]` | 设置 CSS 像素单位的视口；可选设置无头设备缩放比例。 |
| `wait <MS>` | 让时间流逝，单位为毫秒。 |
| `freeze-anims` | 停止文档时间线，包括计时器。 |
| `thaw` | 恢复已停止的时间线。 |
| `motion-at <MS>` | 停止时间，并将每个正在运行的动画定位到其自身运行时长中的指定毫秒处。 |
| `shot <name>` | 写入 PNG 以及对应的布局 JSON。 |
| `record start <name> [fps N] [speed X]` | 开始将窗口录制到 `<name>.mp4`。 |
| `record speed <X>` | 从下一帧起以另一速度录制。 |
| `record stop` | 完成视频并报告其路径、帧数、变化帧数（`encoded`）、时长和大小。 |

省略 `scale` 会保留当前缩放比例。它必须为正数；实时窗口会忽略它。`size` 会等待调整大小完成；控制命令 `resize` 不会。无头模式下，`wait` 会推进模拟时间；实时窗口中则等待真实时间。它不是等待 shell、文件或网络结果：这些情况请使用相应类别的 wait 命令。[概览](index.md#计时)中所述的真实工作等待会在 20 秒后失败。

`motion-at` 要求时间非负。如果中间的等待可能导致动画结束，请在启动动画的操作之前使用 `freeze-anims`。冻结时间不会触发动画结束计时器。`shot` 名称只能包含 ASCII 字母、数字、`_`、`.` 和 `-`，且不能为空。捕获文件会写入运行器的输出目录。

`record` 会录制无头运行（`shot`、`serve`），并要求 `PATH` 中有 `ffmpeg`。它按脚本时间每隔 `X × 1000 / N` 毫秒捕获一帧，因此每个 `wait`、按键输入、手势和稳定等待都会按实际经过的过程显示：`fps` 默认为 60（最大 240 的整数），`speed` 默认为 1，即实时速度。较高速度会生成延时效果（`speed 20` 会将 20 秒播放为 1 秒），较低速度则为慢动作（`speed 0.25`）。等待真实工作结果的命令（例如 `run` 后接 `expect`）会按实际速度录制。视频与截图放在一起，命名方式相同（暗色运行时带 `-dark`），并显示焦点文本字段中的插入光标。与前一帧完全相同的帧不会再次编码：屏幕继续显示前一帧，因此静止窗口几乎不增加开销，`.mp4` 使用可变帧率。脚本结束时仍在进行的录制会停止。
在 `serve` 中，命令之间的静默时间会被省略。录制期间调整窗口大小会导致录制失败；同一时间只能进行一次录制。

```text
size 1280 800
ready
record start palette-demo
palette theme
wait 600
key Escape
wait 400
record stop
record start steps fps 30 speed 10
run "for i in $(seq 1 20); do echo step $i; sleep 0.5; done"
expect "step 20"
record stop
```

状态：`viewport` 报告尺寸和缩放比例；`panes` 报告终端尺寸。`melt` 报告正在播放的屏幕效果及其进度。`tern ctl state` 中没有通用的动画时钟或截图字段；时钟信息请使用 `stats`，路径请查看捕获命令的回复。

## 指针与滚动

| 命令 | 作用 |
| --- | --- |
| `move <X> <Y>` | 移动指针，包括按住按钮时。 |
| `down [X Y]` | 按下主按钮，可先移动指针。 |
| `up [X Y]` | 释放主按钮，可先移动指针。 |
| `click <X> <Y> [right\|middle] [ctrl] [meta] [alt] [shift]` | 点击坐标，可选辅助或中键及修饰键。在 Linux 上，若中键点击要求粘贴主选区，则会粘贴该内容；无头模式下则从会话自身的主选区粘贴。 |
| `click <selector> [right\|middle] [ctrl] [meta] [alt] [shift]` | 点击第一个匹配元素的中心。 |
| `dblclick <X> <Y> [right\|middle] [ctrl] [meta] [alt] [shift]` | 连续点击两次，第二次按下会标记为双击。 |
| `dblclick <selector> [right\|middle] [ctrl] [meta] [alt] [shift]` | 双击第一个匹配元素。 |
| `hover <selector>` | 将指针移到第一个匹配元素的中心。 |
| `wheel <DX> <DY> [ctrl] [meta] [alt] [shift] [lines] [phase <phase>] [momentum <phase>]` | 在当前指针位置滚动。 |

坐标单位为视口 CSS 像素。未提供坐标时，`down` 和 `up` 使用当前指针位置。点击修饰键和 `right` 可以按任意顺序放在末尾；若选择器的最后一个词会被当作选项，请将选择器加引号。点击和悬停选择器也可以由多个未加引号的词组成，这些词会以空格连接。选择器不能为空，且必须匹配元素。`hover` 本身不会等待工具提示出现：请接着使用 `wait 700`。

默认情况下，滚轮增量使用精确像素；`lines` 用于选择行增量。两个阶段都默认为 `none`。每个阶段可取 `none`、`began`、`changed`、`ended`、`canceled` 或 `maybegin`；滚轮选项可以按任意顺序出现。输入传递前会先关闭打开的上下文菜单。

状态：`focused_element` 标识 DOM 焦点，`focused.selection` 报告终端选区，`pane_drag` 报告窗格拖动状态。指针位置和滚轮阶段不是状态字段；指针信息请查看 `stats`。

## 键盘与组合输入

| 命令 | 作用 |
| --- | --- |
| `key <combo>` | 按下并释放一个按键组合。 |
| `keydown <combo>` | 仅发送按键按下。 |
| `keyup <combo>` | 仅发送按键释放。 |
| `type <text>` | 在焦点元素中输入文本。 |
| `preedit <text>` | 提供 IME 组合文本，光标位于末尾。 |
| `commit <text> [combo]` | 提交 IME 文本，可选附带结束组合输入的按键。 |
| `window-focus on\|off` | 使窗口获得或失去键窗口焦点。 |

文本和组合键都是单个参数：包含空格的文本请加引号。按键名称格式示例：`Meta+k`、`Shift+Tab`、`Escape`、`ArrowLeft`、`F1` 和 `[`。未知按键或修饰键会导致失败。`preedit ""` 会结束组合输入。使用组合键时，`commit` 会在该按键按下时提交，并继续传递该按键，就像输入法处理 Enter、Tab 或 Escape 一样。`type` 发送字符输入而非 shell 命令；命令及其提示等待由 `run` 处理。

状态：`focused_element`、`focused`、`palette`、`find` 和 `file_blocks` 会反映接收控件的更改。没有独立的 IME 或键窗口焦点字段。

## 手势与触控

| 命令 | 作用 |
| --- | --- |
| `pinch <X> <Y> <scale> [steps N]` | 在指定点锚定并发送分阶段捏合手势。 |
| `rotate <X> <Y> <degrees> [steps N]` | 发送分阶段旋转，正值表示顺时针。 |
| `smart-magnify <X> <Y>` | 发送双指双击。 |
| `swipe left\|right [X Y] [discrete]` | 发送双指导航滚动，或一次离散三指滑动。 |
| `swipe up\|down [X Y] [discrete]` | 发送三指滑动，可选离散模式。 |
| `swipe up\|down [X Y] [fingers] [to P] [hold]` | 将三指一起移动到指定进度。 |
| `swipe left\|right [X Y] fingers [to P] [hold]` | 将三指水平移动到指定进度。 |
| `force-click <X> <Y>` | 按下，依次发送 Force Touch 压力阶段 1、2、1，然后释放。 |
| `force-click <selector>` | 对第一个匹配元素执行强力点击。 |
| `touch down\|up <ID> <X> <Y>` | 放下或抬起触屏手指。 |
| `touch move <ID> <X> <Y> [steps N]` | 通过插值步骤移动按住的手指。 |
| `touch cancel <ID>` | 取消按住的手指。 |

捏合缩放比例必须为正数。捏合和旋转默认有八个变化步骤；触控移动默认一步。`N` 必须是 1 到 4294967295 之间的整数。手势步骤间隔一帧（120 Hz），因此回复会等待手势播放完成，而非使用单独的真实工作超时。

滑动使用当前指针位置，除非提供坐标。水平非离散滚动滑动的距离为视口宽度的 60%；若没有可滚动内容，则会变成导航。手指滑动的默认进度为 1；`P` 必须属于 `(0, 1]`。`hold` 会省略结束事件，以便捕获保持中的手势。`discrete` 不能与 `fingers`、`to` 或 `hold` 同时使用。垂直手指滑动也接受显式的 `fingers` 词。强力点击选择器遵循点击选择器的相同规则，但不接受按钮或修饰键选项。

触控 ID 必须是 0 到 4294967295 之间的整数。第一个按下的手指是主指针。对已按住的 ID 再次执行 `down`，或移动、抬起、取消未按下的 ID，都会失败。长按操作依次为 `touch down`、`wait 600`、`touch up`。

状态：效果取决于接收 surface（例如 `panes`、`pane_drag`、`file_blocks`）。没有手势进度或触控 ID 字段。

## 拖放

| 命令 | 作用 |
| --- | --- |
| `drop <X> <Y> [file PATH]... [text TEXT] [url URL]... [copy\|move\|link] [hold]` | 在指定坐标发送来自系统的拖动。 |
| `drop <selector> [file PATH]... [text TEXT] [url URL]... [copy\|move\|link] [hold]` | 在第一个匹配项的中心发送来自系统的拖动。 |
| `drag-end [copy\|move\|link\|none]` | 结束拖出窗口的拖动。 |

拖放至少要携带一个文件、文本或 URL。文件和 URL 可以重复；文本和操作只能出现一次。载荷选项、操作和 `hold` 可以按任意顺序出现。选择器是单个参数。默认操作允许目标自行选择；指定操作则会将来源限制为该操作。拒绝接收的目标不会收到拖放，且命令会失败。回复会报告 `at` 和所选 `op`；`hold` 还会报告 `held: true` 并保持拖动悬停。下一条 `drop` 命令会移动它。`drag-end` 默认为 `none`（取消）；没有正在进行的拖出窗口拖动时会失败。

状态：打开的文件会出现在 `file_blocks` 中；终端插入内容会显示在接收终端中。没有通用的传入拖放状态字段；`stats` 会报告拖出窗口的拖动。基于 `file-drop-split` golden：

```text
size 1280 800
ready
drop 1230 450 file crates/tern/goldens/fixtures/files/sample.rs hold
wait 300
shot file-drop-split-over
drop 1230 450 file crates/tern/goldens/fixtures/files/sample.rs
file wait
shot file-drop-split
```

## 外观与辅助功能偏好设置

| 命令 | 作用 |
| --- | --- |
| `appearance light\|dark` | 更改模拟的系统外观。 |
| `reduce-motion on\|off` | 使动画和过渡直接跳到结束状态。 |
| `battery on\|off` | 机器使用电池供电（默认关闭）：仅重绘的无限动画（不透明度、颜色、阴影、滤镜）按 50 毫秒节拍推进；动态效果仍保持流畅。实时窗口中，它会覆盖目标窗口的系统电源状态，直到窗口关闭。 |
| `reduce-transparency on\|off` | 更改会话的“减少透明度”偏好设置。 |
| `increase-contrast on\|off` | 更改会话的“增强对比度”偏好设置。 |
| `differentiate-without-color on\|off` | 更改会话的“区分但不依赖颜色”偏好设置。 |

这些设置影响会话，而非全局操作系统设置或已保存的 Tern 偏好设置。无头模式下，外观和辅助功能设置会应用于每个文档；实时输入则发送给目标窗口。状态：`theme` 会反映解析后的 Tern 外观。辅助功能偏好标志没有专用状态字段；请使用 `shot` 或 `dump` 检查渲染结果。

## 文档、菜单与辅助技术

| 命令 | 作用 |
| --- | --- |
| `target <name>` | 将后续输入和检查操作路由到指定文档或实时窗口。 |
| `menu <id>` | 选择已启用的上下文菜单、菜单栏、Dock 或托盘操作。 |
| `menu-close` | 关闭打开的上下文菜单。 |
| `a11y click\|focus\|blur\|scroll-into-view\|scroll-up\|scroll-down\|scroll-left\|scroll-right\|show-context-menu\|expand\|collapse\|increment\|decrement <selector>` | 执行不带值的辅助技术操作。 |
| `a11y set-scroll-offset <selector> <X,Y>` | 设置滚动偏移量。 |
| `a11y set-scroll-offset <selector> <X> <Y>` | 使用分开的数字设置相同的偏移量。 |
| `a11y set-text-selection <selector> <anchor,focus>` | 设置字段中以字符索引表示的选区端点。 |
| `a11y set-text-selection <selector> <anchor> <focus>` | 使用分开的索引设置相同的选区。 |
| `a11y set-value\|replace-selected-text <selector> <text>` | 设置字段值，或替换其选中文本。 |

`main` 是第一个文档。未知目标会失败并列出可用名称；目标必须已存在。菜单 ID 可从 `menus` 获取。未知或禁用的菜单操作会失败；选择上下文操作会关闭对应菜单。若没有打开的上下文菜单，`menu-close` 会失败。

操作的选择器是单个参数。如果匹配项未公开、不支持请求的操作，或无法执行该操作，辅助功能操作就会失败。不带值的操作会拒绝额外值。成对的值可以用逗号或空白分隔，也可以将一对值加引号。文本操作也接受多个未加引号、以空格连接的词；`""` 会清空值。

状态：`focused_element` 及接收功能的字段会反映操作结果。Tern 的 `menu` 字段是应用自身的菜单，并非完整的原生菜单列表；请使用 `menus` 和不带参数的 `a11y` 进行检查。Tern 的应用状态中没有 target 字段。

## 对话框与系统事件

| 命令 | 作用 |
| --- | --- |
| `dialog [ID] open <PATH>...` | 使用一个或多个路径响应待处理的文件选择器。 |
| `dialog [ID] save <PATH>` | 使用一个路径响应待处理的保存对话框。 |
| `dialog [ID] cancel` | 取消待处理的对话框。 |
| `dialog [ID] button <N> [checked\|unchecked]` | 选择消息框按钮，并可选设置复选框状态。 |
| `haptic-reply [ID] submitted` | 确认待处理的触觉请求。 |
| `haptic-reply [ID] unsupported` | 报告不支持触觉反馈。 |
| `haptic-reply [ID] failed <message>` | 报告触觉反馈失败。 |
| `notification-click <ID> [action]` | 点击已发布的通知或其操作按钮。 |
| `global-shortcut <accelerator>` | 按下已注册的全局快捷键。 |
| `open-files <PATH>...` | 发送系统打开文件请求。 |
| `open-url <URL>` | 发送系统打开 URL 请求。 |
| `second-instance [arg...]` | 传递第二次启动时的参数。 |
| `power suspend\|resume\|lock\|unlock` | 发送电源或会话更改事件。 |
| `share-finish [service\|cancel]` | 完成或取消已显示的共享 UI。 |

`dialog`、`haptic-reply` 和 `share-finish` 仅适用于无头模式。实时窗口需要改用其原生对话框、触觉后端或共享 UI。这些命令用于响应已经待处理的请求；它们不会等待请求出现。未提供 `ID` 时，对话框和触觉回复会响应最早的待处理请求。使用 `system` 获取 ID 和待处理请求。对话框按钮索引从零开始。没有请求、回复类型错误、按钮不可用，或为单文件选择器提供的路径过多，都会导致失败。保存待处理的文件保存请求会写入该文件。触觉 `submitted` 回复确认的是已提交，而非已实际传递；只有 `failed` 接受消息。

通知点击遇到未知通知或操作时会失败。全局快捷键使用 `CmdOrCtrl+Shift+K` 这类 accelerator 语法；未注册时会失败。`open-files` 至少需要一个路径。第二实例事件携带接收进程的工作目录；无头模式下的 `--open-url` 和 `--open-file` 参数也会分别产生相应的打开事件。电源更改会传递给所有无头文档。共享完成操作默认为 `cancel`；没有显示共享 UI 时会失败。

状态：系统请求和注册信息不是 `tern ctl state` 字段；对话框、触觉、通知、快捷键和共享状态请使用 `system`。应用效果会出现在相应字段中，例如 `file_blocks` 和 `tabs`。

## Web 视图与拼写

| 命令 | 作用 |
| --- | --- |
| `webview <selector> title <text>` | 报告嵌入页面的标题。 |
| `webview <selector> url <URL>` | 报告其显示的地址。 |
| `webview <selector> loading <P>` | 报告 0 到 1 之间的加载进度。 |
| `webview <selector> failed <message>` | 报告加载失败。 |
| `webview <selector> history <true\|false> <true\|false>` | 报告是否存在后退和前进历史记录。 |
| `webview <selector> focus on\|off` | 报告页面键盘焦点状态。 |
| `webview <selector> new-window <URL>` | 报告页面请求新窗口。 |
| `webview <selector> inspector-page <URL>` | 报告页面的 Web Inspector 在该地址作为页面提供。 |
| `webview <selector> inspector-unavailable <message>` | 报告页面的 Web Inspector 所在位置（而非打开检查器），以供用户查看。 |
| `webview <selector> security-key` | 报告引擎拒绝了页面的安全密钥或通行密钥（WebAuthn）请求。 |
| `webview <selector> media-blocked <hint>` | 报告页面的音频或视频无法在引擎中加载，并说明用户可以采取什么措施。 |
| `spelling [WORD[=GUESS,...]...]` | 将且仅将这些单词标记为拼写错误，并可选提供替换建议。 |
| `spelling off` | 关闭拼写检查。 |

Web 视图选择器是单个参数，且必须匹配带有 Web 视图的元素。文本、URL 和失败载荷都是单个参数。这些命令用于报告页面事件；它们不会导航页面，也不会等待真实页面加载。无头窗口没有页面，因此脚本须通过这种方式提供报告。浏览器报告没有专用的 `tern ctl state` 字段；请使用 `tree` 或 `dump` 检查其工具栏。文件 Web 视图会影响 `file_blocks`。`stats` 会列出嵌入式 Web 视图。

拼写匹配不区分大小写。不带参数时，`spelling` 不会标记任何词。无头会话起始时词典为空；实时窗口会用它取代平台拼写检查器。建议会显示在字段的上下文菜单中。没有拼写词典状态字段；请检查字段或其菜单。基于 `browser-toolbar` golden：

```text
ready
browser open "example.com"
webview ".tn-pane.on .kit-web-page" url "https://example.com/"
webview ".tn-pane.on .kit-web-page" title "Example Domain"
webview ".tn-pane.on .kit-web-page" history true false
webview ".tn-pane.on .kit-web-page" loading 1
browser address
shot browser-toolbar
```

## 另请参阅

- [脚本](index.md)：运行、引号、时序与测试夹具。
- [控制命令](control.md)：检查、时钟与系统状态。
- [终端与窗格](terminal.md)：shell 命令与提示等待。
- [文件块](file.md)：文件编辑与文件就绪状态。
- [浏览器块](browser.md)：打开和控制浏览器块。
- [调试](../guides/debugging.md#通过脚本驱动-window)。
