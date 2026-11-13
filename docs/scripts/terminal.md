# 终端与窗格

这些命令用于驱动 Shell、窗格拆分、标签页和终端外观。
你可以用它们安排窗口、等待输出、触发注意提示，或重放插件界面，而无需运行生成该界面的程序。

## Shell 与等待

| 命令 | 作用 |
| --- | --- |
| `ready` | 等待活动标签页中每个可见程序窗格到达 Shell 提示符或退出。 |
| `git-read` | 等待焦点窗格的目录完成 Git 信息读取。 |
| `link-read` | 等待指针下方路径完成存在性检查。 |
| `run "<command>"` | 将命令和 Enter 写入焦点 Shell。将所有 `{fixtures}` 替换为文件测试夹具目录。 |
| `expect "<text>"` | 等待焦点窗格中某个可见终端行包含指定子串。 |
| `completing` | 等待补全弹出框打开。 |

`run` 会让输出运行 1.2 秒的实际时间，然后静置 100 ms；它不会等待命令结束。需要确认命令完成时，请接着使用 `expect` 或 `ready`。`expect` 不会跨行搜索，也不会搜索屏幕外的回滚内容。没有正在运行的 Shell 时，`run` 会失败；没有焦点终端时，`expect` 会失败。空的活动标签页满足 `ready` 条件，没有焦点窗格时 `git-read` 也满足条件。实际工作等待超过 20 秒会失败。

状态：`focused.prompt`、`focused.running`、`focused.last`、`focused.exited` 和 `focused.git` 描述 Shell；`term_link` 描述悬停的链接。没有单独的补全状态或待处理等待字段。

## 窗格、标签页和菜单

| 命令 | 作用 |
| --- | --- |
| `split right\|down` | 水平或垂直拆分焦点窗格。 |
| `close` | 关闭焦点窗格。 |
| `zoom` | 切换焦点窗格的缩放状态。 |
| `equalize` | 均衡活动标签页的拆分区域。 |
| `focus left\|right\|up\|down\|next\|prev` | 聚焦相邻窗格，或循环切换窗格。 |
| `resize-pane left\|right\|up\|down` | 移动拆分边界以调整焦点窗格大小。 |
| `tab new\|next\|prev\|close\|<n>` | 创建、循环切换、关闭或选择标签页；`<n>` 是从 1 开始的正整数。 |
| `rename "<name>"` | 重命名活动标签页。 |
| `palette [<query>...]` | 打开命令面板；若提供查询，则按该行其余内容筛选（`palette reload settings`）。 |
| `find "<query>"` | 在焦点窗格的回滚内容中打开搜索。 |
| `context pane\|tab` | 打开焦点窗格的菜单或活动标签页的菜单。 |
| `layout rail\|float\|tiles\|studio` | 切换窗口布局。 |

布局名称不区分大小写。窗格和标签页操作会等待可见 Shell 提示符就绪后才完成；因此，新打开的 Shell 可能会延迟下一条命令。这里的 `resize` 调整的是窗格，而不是窗口视口：参见[控制命令](control.md)中的 `tern ctl resize W H`。

状态：`panes` 提供终端尺寸，`focused.id` 标识焦点，`tabs` 提供标题、窗格数量、活动和缩放标志，`decks` 描述排列。`layout`、`palette`、`palette_scope`、`find` 和 `menu` 反映相应 UI。

```text
ready
split right
run "git status"
expect "On branch"
focus left
run "ls"
shot split-status
```

## 字体与窗口控件

| 命令 | 作用 |
| --- | --- |
| `font <px>` | 将终端字体大小设为非负整数，并限制在支持范围内；未设置 `ui-font-size` 的跟随界面也会跟随此值。 |
| `ui-font-size [<px>]` | 设置界面字体大小，限制方式与 `font` 相同；不带参数时，界面重新跟随终端字体大小。 |
| `font-family ["<families>"]` | 设置常规终端字体系列；不带参数或提供空字符串时，恢复内置字体。 |
| `font-family bold\|italic\|bold-italic "<families>"` | 设置样式化的终端字体；空字符串会继承常规字体系列。 |
| `font-weight <n>` | 设置终端字重，限制在 100–900。 |
| `adjust-cell-height <px>\|<n>%` | 为终端行高增加整数像素或有限百分比。 |
| `adjust-cell-height ""` | 重置行高调整值。 |
| `adjust-cell-width <px>\|<n>%` | 为终端单元格宽度增加整数像素或有限百分比；字形大小保持不变。`""` 可重置此值。 |
| `font-thicken on\|off [<strength>]` | 开启或关闭文本加粗（macOS）；提供强度时，以 0 到 255 的强度开启。 |
| `padding <x> [<y>]` | 设置终端文本与其块边缘之间的间距，包括横向和纵向（整数像素，最多 40）；只给一个值时两个方向相同。 |
| `ui-font ["<families>"]` | 设置 UI 字体系列；不带参数或提供空字符串时，恢复内置字体。 |
| `code-font ["<families>"]` | 设置代码字体系列；不带参数或提供空字符串时，恢复内置字体。 |
| `program-icon <program> [<icon>]` | 让 Program icons 设置（`program_icons`）为程序键或命令名（`codex`、`nvim`）指定图标（`provider-openai`）；不提供图标会移除此条目。 |
| `decorations system\|lights\|buttons` | 选择系统窗口控件、Tern 交通灯样式控件或标题栏按钮。 |
| `glass <opacity>` | 设置窗口玻璃层的不透明度（0–100 %），并让无头截图中的页面保持半透明，使 PNG 保留在桌面环境中本应透出桌面背景的 alpha 透明度。 |

将字体系列列表作为一个参数引用，例如 `font-family "A, B"`。
样式化形式必须同时提供样式和字体字符串。像素调整值可带正负号（`+3`、`-1`）；百分比也接受小数（`-12.5%`）。
计算后的行高会四舍五入，并限制在未调整高度的二分之一到三倍之间。字体大小和字重必须是无符号整数。

无头帧除此之外是不透明的，后面没有桌面背景；将 `glass` 截图合成到壁纸上，即可呈现桌面中的窗口效果。

状态：`font`、`ui_font`、`font_family`、`face` 和 `faces` 提供终端与界面的大小，以及请求和解析后的字体系列。`csd` 表示客户端装饰，但不会区分交通灯控件与按钮。`opacity` 是玻璃层的不透明度。
字重、行高调整以及 UI/代码字体系列设置没有专用的顶层状态字段。

## 主题、滚动与复制

| 命令 | 作用 |
| --- | --- |
| `theme [dark\|light] "<name>"` | 为指定名称的主题所属的外观模式，或明确指定的外观模式，保存该主题选择。 |
| `themes ["<name>"]` | 打开主题选择器；若提供名称，则预览该主题。 |
| `scroll <lines>` | 将焦点终端向回滚方向滚动指定的有符号整数行数；负值向实时末尾移动。 |
| `copy` | 复制焦点窗格的选区并显示复制反馈。 |

`theme` 只有一个参数时，该参数始终视为名称，即使是 `dark` 或 `light` 也一样。
更改一种外观的主题会保留另一种外观的选择。未知主题名称会失败。`themes` 有多个参数时会打开选择器但不选择名称；`copy` 会忽略参数。

内联 surface 会随终端滚动。对于独立滚动的 surface 覆盖层或叠加列表，请先使用 `move X Y`，再使用 `wheel DX DY`。
没有焦点窗格时，`scroll` 会失败；没有终端的窗格不会滚动。没有焦点时，`copy` 不执行任何操作。

状态：`theme_dark`、`theme_light`、`theme_preview` 和 `theme` 显示主题选项及预览。`focused.selection` 提供所选终端文本；没有顶层滚动位置或剪贴板字段。

## 注意提示与概览

| 命令 | 作用 |
| --- | --- |
| `alert bell ["<detail>"]` | 在焦点窗格记录响铃；省略或提供空 detail 时使用其标签。 |
| `alert done <status> "<command>" [<seconds>]` | 记录命令完成情况，包含有符号退出状态和可选的非负整数秒数。 |
| `alert exited <status>` | 记录程序退出及其有符号状态。 |
| `alert waiting "<message>"` | 记录注意请求。 |
| `alert agent-done` | 使用焦点窗格的标签记录代理完成。 |
| `inbox` | 打开注意事项收件箱。 |
| `inbox go` | 跳转到所选条目的窗格。 |
| `inbox clear` | 清除所有条目。 |
| `inbox close` | 关闭收件箱。 |
| `peek [strip\|mission\|close]` | 打开标签页条或 Mission Control，或返回终端。默认值为 `strip`。 |
| `park` | 将焦点窗格停放到当前会话的已停放窗格中。 |
| `park hand` | 打开静置状态的已停放窗格，并选中第一张卡片。 |
| `park pick <n>` | 选择已打开的已停放窗格中的第 `n` 张卡片，编号从 1 开始。 |
| `park deal` | 将所选卡片放回焦点窗格旁边（若已停放窗格已关闭，则使用第一张卡片）。 |
| `park close` | 关闭静置状态的已停放窗格。 |
| `park at <percent>` | 将叠放区静置，使其中心位于底边从左到右的 `percent`% 处（50 为中间），效果等同于将其滑到那里。 |
| `park size <percent>` | 将叠放区大小设为自身大小的 `percent`%（50 到 200），效果等同于用次要按钮上下拖动卡片。 |
| `melt [<progress>]` | 关闭当前会话，并播放进度为 0–1 的关闭效果。默认值为 1。 |

`alert` 需要焦点窗格，但不会运行所命名的命令，也不会退出其程序。收件箱关闭或没有选中项时，`inbox go` 会失败。
`peek` 会静止打开，不播放过渡动画，并等待概览截图准备就绪。没有焦点窗格时 `park` 会失败；没有已停放窗格时 `park hand` 和 `park deal` 会失败；`park pick` 超过最后一张卡片、`park at` 超过 100、`park size` 超出 50 到 200 范围时也会失败；这些命令都会等待卡片图像完成捕获。`melt 0` 仍会关闭会话；参数只控制效果时间轴。进度会四舍五入到千分位，启用减少动态效果时会使用淡出而非融化效果。

当窗口失去焦点（`window-focus off`）时，`alert waiting` 条目也会发布 id 为 `pane:<id>` 的系统通知；启用 `agents.notify_turn_finished` 后（Settings › Agents › Notifications），`alert finished` 和 `alert failed` 也会发布通知。`system` 会在 `notifications` 中列出它。`notification-click pane:<id>` 会将 Tern 切换到前台并聚焦该窗格：`system` 日志会显示 `activate-app`，而 `focused` 是该窗格。

状态：`inbox` 提供条目和选择状态，`tabs[].alert` 提供标签页注意提示，`peek` 描述概览层级和卡片，`park` 列出已停放卡片及其叠放关系和状态、叠放区位置、大小（`size`，相对于自身大小的倍数，0.5–2）、显示的卡片数量（`cards`，最多六张）、未显示数量（`more`）以及展开的卡片组。`melt` 提供活动效果及进度。`sessions` 反映已关闭的会话。

## 输出与 surface 重放

| 命令 | 作用 |
| --- | --- |
| `feed "<path>"` | 将文本测试夹具作为终端输出打印到焦点窗格。 |
| `surface-play "<path>" [from <frame>] [until <frame>] [paced [<times>]]` | 重放 JSON-lines surface 录制，可按帧限定范围，或按录制时的节奏播放。 |

这些命令会直接读取现有路径，否则在测试夹具根目录下解析路径。`feed` 读取 UTF-8，将换行符转换为 CR LF，移除最后一个换行符，并将字面量 `\e` 和 `\a` 展开为 Escape 和 Bell。必要时，这两个命令都会用静默重放程序重启焦点窗格，然后等待程序开始监听；没有焦点或文件无法读取时会失败。WebAssembly 构建版本不提供重放功能。

帧可以是无符号序列号（`3`），也可以是 surface ID 加序列号（`chat#3`）。`from` 不包含指定帧，并要求焦点窗格中已有重放；`until` 包含指定帧。选项可以按任意顺序出现，重复选项会替换之前的值。录制 JSON 无效时会报告行号并失败。

不使用 `paced` 时，重放会一次性输入所有输出。`paced` 默认倍率为 1×；`paced 2` 会以两倍速度播放。倍率必须是有限正数。按节奏播放的重放启动后不会等待最后一条消息：使用 `wait MS` 推进文档时间。同一窗格中若已有录制正在播放，再启动第二个按节奏播放的录制会失败；关闭其窗格会停止播放。

状态会通过 `focused` 和 `panes` 暴露结果窗格，但没有录制进度字段。使用 `tree` 或 `dump` 检查已渲染的 surface。

```text
ready
surface-play "goldens/fixtures/omp-chat.jsonl" until 3
wait 300
shot chat
```

## 测试夹具插件

| 命令 | 作用 |
| --- | --- |
| `plugins fixtures` | 加载源代码树的测试插件，并重新加载其 host 和 window 入口。 |
| `plugins run <action>` | 运行指定名称的键映射操作，包括插件操作，例如 `plugin.hello.ask`。 |
| `plugins expect "<text>"` | 等待属于焦点终端的 surface 中出现指定文本。 |

测试夹具插件位于 `crates/plugins/fixtures`。加载需要测试夹具根目录；当窗口连接到会话守护进程时会失败，因为其插件由独立机制管理。即使在无头运行中，该命令也会从已保存设置恢复插件启用/禁用选项。无效操作语法会失败。`plugins expect` 等待的是 surface 内容，而不是终端行；如果文本始终未出现，20 秒后超时。

没有专用的插件状态字段。使用 `tree` 或 `dump` 检查已渲染的 surface，并用 `plugins expect` 等待其内容。

## 另请参阅

- [脚本](index.md)：运行、引用、测试夹具和时序。
- [测试框架命令](harness.md)：输入、截图和文档时间。
- [标签页与导航](navigation.md)：导航和窗格排列。
- [会话与块](sessions.md)：会话和块操作。
- [调试](../guides/debugging.md)：通过脚本驱动插件。
- [命令行](../reference/cli.md)：管理已安装的插件。
