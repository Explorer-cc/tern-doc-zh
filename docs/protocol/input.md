# 输入与事件

按键仍像以往一样通过 pty 作为输入到达程序。surface 中指针执行的操作，以及窗格中发生的更改，都会以事件形式返回。

## 按键

按键以 pty 输入的形式到达程序：kitty 键盘协议、括号括起的粘贴。聚焦的 `editor` 或 `input`（通过 `focus` op）会显示 Tern 的插入光标，但文本模型由你负责：你应使用 `text` 或 `splice` ops 和新的 `cursor` 响应按键。IME 组合输入发生在 Tern 的隐藏文本区域中，会在字段插入光标处绘制为预编辑文本，并作为键入文本提交到 pty。

以下情况除外：下文所述作用于 Tern 选区的按键会变为 `edit` 事件，撤销键会变为 `undo` 事件。此外，在 inline surface 中，当焦点位于 `dock` 中的 `editor`（聊天的撰写框）且其插入光标处没有锚定 `overlay` 时，普通 PgUp 和 PgDn 会翻阅窗格页面，就像聊天应用的消息字段翻阅历史记录一样：`main` 会随窗格滚动，因此这些按键不会到达你这里。带有 `typeahead` 的字段会暂存输入，直到你能够读取它（[预输入](#预输入)）。

## 原生编辑

如果你在 `hello` 中启用了 `edit` 程序功能，Tern 会在 `editor` 和 `input` 字段中维护自己的选区，就像 GUI 文本字段一样，除非字段带有 `mode`（Vim 模式）或为 `readonly`。用户可以在 Settings › Terminal › Native composer editing 中关闭此功能。对于未启用 `edit` 的程序，每个按键仍归程序处理，因为作用于 Tern 选区的按键会以事件形式到达程序，而程序会丢弃该事件。

- ⇧ 加方向键（⇧⌥ 或 ⇧⌃ ←/→ 选择单词，⇧⌘ ←/→ 或 ⇧Home/End 选择行，⇧⌘ ↑/↓ 选择文本），或拖动、双击、三击，均可选择文本；⌘A 全选。在 PC 键盘上，Ctrl 相当于文本字段中的 ⌘（Ctrl+A、Ctrl+C、Ctrl+X、Ctrl+V、Ctrl+⇧←/→、Ctrl+⇧Home/End）；Alt 和 Windows/Super 组合键仍由你和应用处理。
- 在文本更改之前，Tern 会绘制自己的选区，而不是你的 `cursor` 和 `anchor`。有选区时，键入、粘贴、IME 提交、⌫、⌦（及其单词和行版本）以及 ⌘X 或 ⌃X 会替换选区，⌘C 会在本地复制选区，普通方向键会取消选区。没有选区时，只有选择按键和下文所述的绘制行移动由 Tern 处理：⌘C、⌘X、⌃X、删除键以及 PC 键盘上的 Ctrl+V 仍由你处理。空字段没有可选内容，因此其中每个按键仍由你处理（撤销除外）。
- 在聚焦字段中单击会放置插入光标：发送一个 `edit` 事件，其中 `from == to`，且仅当插入光标发生移动时发送。在未聚焦字段中单击则发送 `focus`（[事件](#事件)）。
- 只有 Tern 知道文本的软换行位置，因此普通 ↑ 或 ↓ 会将插入光标移至绘制行的上一行或下一行（位置在这一串按键开始时的 x 坐标处）；⌘← 或 ⌘→（Home、End）则移至绘制行的开头或结尾。这些操作各自作为一个 `edit` 事件发送给你，不会作为按键发送。
- 其他情况下，所有按键仍像以前一样由你处理：在绘制的第一行按 ↑、在最后一行按 ↓（你的历史记录），以及在插入光标处锚定的 `overlay` 打开时按 ↑ 和 ↓（其列表）。在 PC 键盘上，没有选区时，Ctrl+Home/End（文本开头或结尾）和 Ctrl+Backspace/Delete 也仍由你处理。
- 在带有 `typo` 装饰的拼写错误上打开上下文菜单时，菜单首先列出平台拼写检查器的建议；选择一项会发送 `edit`。

**撤销。**如果同时启用了 `undo` 功能，在原生编辑字段中按 ⌘Z 或 ⌃Z（PC 键盘上的 Ctrl+Z）会作为一个 `undo` 事件而不是按键发送给你，无论是否有选区，也无论字段是否为空，因此清空的草稿也可以恢复。历史记录由你管理，每个 `edit` 事件算作一步。在 Vim 模式、关闭原生编辑或未启用 `undo` 时，⌃Z 仍作为你的按键。

**发送。**启用 `send` 功能后，Tern 可以原子地将提示提交到你的撰写框（例如发送给代理的初始提示，或 Carly 向它提出的问题）：发送的是 `send` 事件，而不是先粘贴再按 Enter。字段只有在报告 `sendable:true` 时才接受发送（且不能为 `readonly`、`disabled` 或 `hidden`）；这表示它的所有者、提交处理器及其依赖项都已就绪。可写文本和焦点是分开的：程序启动时，字段可以处于聚焦且可编辑状态，但仍为 `sendable:false`。就绪后发送一帧，将 `sendable:true` 设上，即使没有其他更改也如此；在此之前，Tern 会暂存提示。

**回复。**当聚焦的 `editor` 位于 `dock`（聊天的撰写框）中时，在窗格选区上打开上下文菜单会显示“Reply with Selection”。它会像任何粘贴一样将选中的文本作为 Markdown 引用粘贴（每行前加 `> `，空行单独加 `>`，随后再加一个空行）：粘贴内容以括号括起的形式到达，或以 mode 5522 的 paste event 到达。不会发送任何内容；引用是供你编辑和撤销的草稿，并且窗格会接收按键，以便用户在其下方输入回复。

## 预输入

尚不能读取输入的程序（仍在启动，或事件循环正忙）可以在聚焦的 `editor` 或 `input` 上设置 `typeahead: true`，就像终端的行规程会在程序读取前回显输入一样。设置期间，Tern 会将键入的内容保留在字段中，而不是写入 pty，并在你的 `cursor` 位置绘制这些内容，仿佛文本已包含它们：不带换行或其他控制字符的键入文本和 IME 提交，以及对所保留文本执行的 ⌫。当你再次开始读取按键时，清除此属性：Tern 会将保留的内容作为键入文本写入 pty，并继续绘制这些内容，直到某一帧更改字段的 `text`。

其他任何按键（Enter、方向键、快捷键、粘贴）都会像往常一样发送到 pty，且位于已保留内容之后：你会按键入顺序读取二者。该按键可能会消耗文本（Enter 发送草稿）并保持 `text` 原样，因此先于按键发送的文本会继续绘制，直到某一帧更改 `text` 或清除此属性。
原生编辑在 Tern 暂存保留文本期间会让出处理权。带有 `mode` 或 `readonly` 的字段不会保留任何内容；节点或 surface 消失时，字段所保留的内容也会丢失。不支持 typeahead 的 Tern 会忽略该属性：按键会按键入内容直接到达 pty。

## 指针操作

通用的 `actions` 属性用于指定指针在节点上的操作。它是一个对象，为每种手势指定一个操作，`{"click": act, "dblclick": act, "menu": [act…]}`，所有键都是可选的：

```json
{"id": "row", "k": "text", "p": {"text": "build.log",
  "actions": {"click": "open-log", "dblclick": "copy", "menu": ["rerun", "sort=name"]}}}
```

| 操作 | 执行方 | 事件 |
| --- | --- | --- |
| `toggle` | Tern 立即折叠或展开节点（可折叠的 `card`、`section`、`tool`、`agent`、`checklist`） | `{"ev":"toggle","id","collapsed","key?"}` |
| `copy` | Tern 复制节点的文本（`md` 的 Markdown 源文本，`code`、`ansi` 和 `text` 的原始文本，`block` 的原始输出；若有 `href` 则复制该值），闪烁显示节点并显示 Copied | 无 |
| `open` | Tern 打开节点的 `href` 或 `path` | 无 |
| `zoom` | Tern 在查看器中放大显示 `image`，并可逐张浏览其旁边的图像 | 无 |
| `select` | 程序 | `{"ev":"select","id","item","values?"}` |
| `activate` | 程序 | `{"ev":"activate","id","item","values?"}` |
| 其他任意名称 | 程序 | `{"ev":"action","id","act","value?","item?","mods?","checked?","values?"}` |

- `click` 和 `dblclick` 会为节点添加 `.sf-act` 类，并显示指针手形光标。打开链接的单击（⌘-单击，或在 Settings › General › Links 设置为普通单击即可打开链接时单击 inline 链接）会直接打开链接，而不会执行 `click`。
- `menu` 列出上下文菜单项，标签根据操作名称生成（`open-file` 显示为 Open file）；除非列表中包含 `copy`，否则 Tern 会附加 Copy 项。菜单项也可以是 `"-"`（分隔线）、`{"header"}`（分区标题），或者包含 [`menu`](../elements/lists.md#menu) 行字段的项目对象：`id`（操作）、`label`、`icon`、`keys`、`detail`、`checked`、`radio`、`disabled`、`danger` 和 `items`（子菜单）。选择菜单项会像执行单击一样运行操作，但不会带上 `mods`；复选框或单选框行的操作还会带上 `checked` 及其新状态。
- `toggle` 的 `key` 仍是节点自身的 `key` 属性（如果有）；事件不会用父节点限定它。Tern 会根据同级节点中的该键记住局部折叠状态，而不是按整个 surface 记忆。在同一父节点下使用新节点 id 和相同 key 执行 `del` 后再 `add` 会保留折叠状态；其他父节点下的相同 key 则具有独立状态。没有 key 时，局部状态使用节点的 id。
- 对 `list` 中的 `item` 执行 `select` 和 `activate` 时，`id` 是列表，`item` 是列表项；对 `table` 行执行时，`id` 是表格，`item` 是行的 `id`；对下文其他会选择内容的 kind（nav 项、crumb、preset、frame、suggestion、question）执行时，`id` 是节点，`item` 是所选内容；在任何其他节点上执行时，二者都是节点的 id。
- `action` 中的 `item` 表示执行按钮单元格或行 `menu` 项的表格行、选择某行的 `menubar` 菜单，或 `questions` 步骤离开的 question；其他操作均没有此字段。
- 带 `=` 的自定义名称会拆分为 `act` 和 `value`（`"sort=name"`）。`mods` 按 `shift`、`ctrl`、`alt`、`meta` 的顺序列出按下的修饰键（⌘ 是 `meta`）；没有修饰键时不包含该字段。
- 当节点位于 `el` `form` 中时，事件会包含 `values`（[表单值](#表单值)）。

悬停、滚动、文本选择、工具提示和上下文菜单均由 Tern 自行处理。有些 kind 无需 `actions` 属性也会发送自己的事件：

| 种类 | 事件 |
| --- | --- |
| `list` 项 | 单击时发送 `select`，双击时发送 `activate`，`id` 为列表（[列表](../elements/lists.md#item)）；列表项自身的 `click` 或 `dblclick` 操作会替代对应操作 |
| 带 `selectable` 的 `table` | 单击行时发送 `select`，双击时发送 `activate`，`id` 为表格，`item` 为行（[数据](../elements/data.md#table)） |
| 带 `sortable` 的 `table` | 单击表头时发送 `action` `sort`，`value` 为 `{"col","dir"}`（[数据](../elements/data.md#table)） |
| 带 `multi` 的 `table` | 发送 `change`，`value` 为所选行 id；其 `bar` 按钮发送 `action`，`value` 为所选 id（[数据](../elements/data.md#table)） |
| `table` 按钮单元格、行 `menu` | 发送 `action`，`act` 为单元格的 `act` 或菜单项，`item` 为行 |
| `button` | 发送 `action`，`act` 为其 `actions.click`，若未设置则为 `"click"`（[输入与按钮](../elements/input.md#button)） |
| `select` | 选择选项时发送 `change`，`value` 为所选选项；指针打开或关闭菜单时发送带 `open` 的 `toggle`（[输入与按钮](../elements/input.md#select)） |
| `switch` | 发送 `change`，`value` 为新状态 `true` 或 `false`（[输入与按钮](../elements/input.md#switch)） |
| `slider` | 松开时发送 `change`，`value` 为数字，或范围值 `[lo, hi]`（[输入与按钮](../elements/input.md#slider)） |
| `otp` | 插入光标移动到单元格时发送 `action` `focus`，`value` 为该单元格（[输入与按钮](../elements/input.md#otp)） |
| `calendar` | 发送 `change`，`value` 为 `"YYYY-MM-DD"` 日期或 `[from, to]` 范围；选择预设时发送 `select`，`item` 为预设 id；发送 `action` `month`，`value` 为 `"YYYY-MM"`（[输入与按钮](../elements/input.md#calendar)） |
| `date` | 发送带 `collapsed` 的 `toggle`（打开时为 `false`），然后像 `calendar` 一样发送 `change` 和 `action` `month`（[输入与按钮](../elements/input.md#date)） |
| `tabs` | 发送 `select`，`item` 为标签 id（[标签页](../elements/lists.md#tabs)） |
| `menu` | 发送 `action`，`act` 为行的 id；复选框或单选框行还带有 `checked`；发送带 `open` 的 `toggle`（[菜单](../elements/lists.md#menu)） |
| `menubar` | 发送 `action`，`act` 为行的 id，`item` 为菜单 id，可选带有 `checked`；发送 `toggle`，`item` 为菜单 id，且带有 `open`（[菜单](../elements/lists.md#menubar)） |
| `nav` | 发送 `select`，`item` 为项目或子项目（[导航](../elements/lists.md#nav)） |
| `breadcrumb` | 发送 `select`，`item` 为 crumb（[导航](../elements/lists.md#breadcrumb)） |
| `pager` | 发送 `change`，`value` 为页码（从 1 开始）；发送 `action` `more`（[导航](../elements/lists.md#pager)） |
| `tree` | 发送 `toggle`，`key` 为项目（[数据](../elements/data.md#tree)） |
| `split` | 松开时发送 `change`，`value` 为每个窗格所占比例，总和为 1（[布局](../elements/layout.md#split)） |
| `carousel` | 发送 `change`，`value` 为当前显示幻灯片的索引（[数据](../elements/data.md#carousel)） |
| `attachment` | 发送 `action`，`act` 为 `remove`、`retry` 或其某个 `actions`（[数据](../elements/data.md#attachment)） |
| `picker` | 发送 `select`、`activate` 和 `action`（[Picker 事件](../elements/lists.md#事件)） |
| `prefs` | 发送 `select`、`activate`、`action`、`focus` 和 `change`，并带有 `item` 和 `value`（[prefs](../elements/work.md#prefs)） |
| `checklist`（hud） | 其 pill 打开或关闭时发送 `activate`，`item` 为 `"hud"`（[checklist](../elements/work.md#checklist)） |
| 带 `confirm` 的 `tool` | 发送 `action` `allow`、`deny` 或 `always`，若有范围则 `value` 为该范围（[tool](../elements/work.md#tool)） |
| `trace` | 发送 `toggle`，带有 `open`，`item` 为行的 id（标题行不带 `item`）（[trace](../elements/work.md#trace)） |
| `message` | 发送 `change`，`value` 为 reaction chip 的文本并带有 `on`；操作按钮发送 `action`（[message](../elements/work.md#message)） |
| `suggestions` | 发送 `activate`，`item` 为项目的 `id`，若没有则为其文本（[suggestions](../elements/work.md#suggestions)） |
| `questions` | 发送 `change`，`item` 为 question，`value` 为答案；发送 `action` `next`、`back` 或 `skip` 并带有 `item`，发送 `action` `submit` 并带有所有答案组成的 `value`；在 `list` 中选择时发送 `select`，并带有 `item`（[questions](../elements/work.md#questions)） |
| `stacktrace` | 发送 `select` 和 `activate`，`item` 为 frame 的索引（[stacktrace](../elements/work.md#stacktrace)） |
| `el` checkbox、radio | 发送 `change`（[HTML 元素](../elements/el.md#change-事件)） |
| `editor`、`input` | 发送 `focus`、`edit`、`undo`（见上文） |
| `input` 附加项 | 发送 `action` `clear`、`inc` 或 `dec`，或附加按钮的 act（[输入与按钮](../elements/input.md#附加控件)） |

## 事件

每条从终端发往程序的消息都是一个 `e` 事件，格式为 `ESC _ tsp;e;{…} ESC \`（Windows ConPTY 使用 OSC 877，见[传输](transport.md#windows)）。关于某个 surface 的事件会携带其 id，字段名为 `sf`：除 `theme`、`motion` 以及响应 `adopt` 的 `gone` 外，下表中的所有事件均如此；若被拒绝的消息指定了 surface，`error` 也会带有该字段。

| 事件 | 载荷 | 时机 |
| --- | --- | --- |
| `ack` | `s` | 已应用并绘制的最高帧；每个已显示帧最多发送一次（[流控](operations.md#流控)）。 |
| `resize` | `cols`、`cell`（`{"w","h"}`）、`visible` | 窗格的 live surface 首次绘制时，或窗格的列宽或 cell 大小改变时。显示在多个窗口（另一台计算机、手机、浏览器）中的窗格只有一个宽度，即用户最近操作的窗口宽度，且只报告该宽度；首次报告可能仅随更改到达，在此之前使用 `hello` 回复中的 `cols`。仅在需要 `rows` 和 ANSI 宽度判断时使用。 |
| `theme` | `dark` | 外观切换时。 |
| `motion` | `reduce` | Reduce Motion 设置切换时。 |
| `visible` | `visible` | 窗格被隐藏（切换到其他标签页）或再次显示时：暂停耗费资源的工作。 |
| `toggle`、`select`、`activate`、`action` | 见上文（列表项、标签页、表格行及上文所列 kind 选择的内容会带有 `item`；复选框或单选框菜单行会带有 `checked`；来自 `select`、`menu`、`menubar` 或 `trace` 的 `toggle` 会带有 `open` 而不是 `collapsed`） | 用户操作时。 |
| `change` | `id`、`value`、`checked`、`name?`、`values?`；来自 `prefs`：`id`、`item`、`value`；来自上文其他 kind：`id`、`value`（`questions` 带有 `item`，`message` 带有 `on`） | 用户切换 `el` checkbox 或 radio（[HTML 元素](../elements/el.md#change-事件)）、更改 `prefs` 行的值，或更改控件 kind 的值（select、switch、slider、calendar 或 date、pager 的页码、split 的大小、carousel 的幻灯片、`multi` table 的选择项、reaction、answer）时。 |
| `focus` | `id` | 单击请求接收按键时：在未聚焦且非 `readonly` 的 `editor` 或 `input` 中单击，或焦点位于 `prefs` 节点以外的字段中时单击该 `prefs` 节点。将焦点移至该处（并通过 `focus` op 响应），或忽略该事件：模态 overlay 会保留按键。 |
| `edit` | `id`、`from`、`to`、`text`、`cursor`、`len` | 原生编辑：将字段 `id` 文本中的 UTF-16 `[from, to)` 替换为 `text`（一次撤销步骤），然后将插入光标置于 `cursor`。`from == to` 且 `text` 为空时仅移动插入光标。`len` 是 Tern 看到的文本长度：若你的文本在此期间已改变（按键仍在传输中），则忽略此事件。仅在启用 `edit` 功能时出现。 |
| `undo` | `id` | 通过你自己的历史记录撤销对字段 `id` 的最后一次更改；没有可撤销内容时不执行任何操作。按顺序与前后按键一同发送。仅在启用 `undo` 功能时出现。 |
| `send` | `id`、`text` | 通过撰写框 `id` 的正常提交路径提交 `text`，保留多行文本、命令和附件。仅发送给报告 `sendable:true` 的 live、可编辑字段，且程序启用了 `send` 功能；其他情况一律丢弃。 |
| `error` | `s`、`op`、`msg`；或 `msg`（已知时带有 `s`）；或 `sheet`、`msg`；或 `id`、`msg` | 帧 `s` 中被拒绝的 op（`op` 是其索引）；被拒绝的消息或丢弃的分块；来自视图的样式表解析错误（`sheet`，多条消息以 `; ` 合并），或带有未知标签的 `el`（`id`）。 |
| `gone` | `ids` | Tern 根据保留预算丢弃了这些节点；丢弃了锚定行已离开时的 surface（滚出回滚区、清空回滚区或离开备用屏幕），此时 `ids` 是 surface 自身的 id；或 `adopt` 未找到任何内容。不要再引用这些对象。 |

## 表单值

节点位于 `el` `form` 中时，其 `action`、`select`、`activate` 或 `change` 事件会携带 `values`：表示该时刻表单中每个已启用且带名称控件的值。单选按钮组提供已选单选按钮的 `value`（未选时为 `null`）；单个 checkbox 提供 `true` 或 `false`；共享名称的多个 checkbox 提供按文档顺序排列的已选项值数组。提交表单的单击事件会携带已选内容，因此你无需另行查询：

```json
{"ev":"action","sf":"pick","id":"go","act":"submit","values":{"size":"l","notify":true,"tags":["a","c"]}}
```

带完整示例的算法见[HTML 元素](../elements/el.md#表单值)。

## 仅发送给正在监听的程序

终端写入 pty 的任何内容都会作为键入文本发送给 shell，因此 Tern 只会发送程序能够读取的内容：

- Tern 生成的事件（`ack`、`resize`、`visible`、`theme`、`motion`、指针和视图事件）仅在窗格中至少有一个 surface 打开时发送；带有 surface 名称的事件仅在该 surface 打开时发送。
- 以 `listen:false` 打开的 surface 不会收到任何内容：不会收到 ack、关于它的事件或错误；发送其 `o` 后，在你下一个 `q` 或启用监听的 `o` 之前，不会收到任何回复。
- 除非程序已知不再运行，否则针对你发送内容的回复（对 `q` 的回复、`error`、`gone`）仍会发送；程序在 shell 提示符出现、窗格进程退出或 RIS 后即视为不再运行，直到有内容发起请求（`q`）或打开 surface（`o`）。延迟到达的 `f`，或针对提示符已丢弃的 surface 发出的 `x`，都不会得到回复。程序用 `x` 关闭自身的 surface 后仍会收到错误通知，因为它可能仍在读取（[离开](surfaces.md#打开与关闭)）。