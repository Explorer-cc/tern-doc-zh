# 内置操作

窗口插件可传给 [`tern.override`](api-window.md#tern-override)、[`cx:command`](api-window.md#window-上下文-cx) 和 [`tern.bind`](api-window.md#tern-bind) 的所有名称。命令是命令面板中的行；操作是按键映射可运行的更广泛名称集合，其中包含所有命令。

## 名称一览

| 名称形式 | 示例 | `tern.bind` | `tern.override` / `cx:command` |
| --- | --- | --- | --- |
| 命令 ID | `new_tab`, `layout:rail` | 是 | 是 |
| 仅限按键映射的操作 | `palette`, `goto_tab:3`, `text:\e` | 是 | 否 |
| 视图按键组合 | `editor.toggle_comment`, `sqlite.write`, `browser.back` | 是 | 否 |
| 插件命令 | `plugin.hello.say_hi` | 是 | 否 |
| 插件函数绑定 | `plugin.hello.bind.0` | 由 `tern.bind` 生成 | 否 |

`tern.override` 和 `cx:command` 只接受下方的[命令 id](#命令)：两者都会在 Tern 的命令列表中查找该 id。其他所有操作名称，包括其他插件的 `plugin.*` 命令，都会被拒绝。

`cx:action(name)` 会立即运行上述所有形式的操作名称，而不只是命令。
视图操作应用于当前聚焦的视图。未知插件操作会引发错误，而不是
静默无操作。Carly 拥有与已加载窗口插件相同的操作能力：内置命令、
仅限按键映射的操作、聚焦视图操作，以及所有已加载插件的命令。

## 命令

Tern 有 174 个内置命令。`tern.override`、`cx:command`、`tern.bind` 和 `settings.json` 中的 `keybinds` 使用 id；命令面板行显示的是标签。带有 `:` 的 id 按值分别对应一个命令（`layout:rail`、`layout:float`、…）；每个值都是独立 id，单独的前缀（`layout`）不是命令。

```lua
tern.override("split_right", function(cx)
	cx:toast("info", "Splitting")
	cx:command("split_right") -- runs the built-in; overrides are out of reach
	return true
end)
```

**Apple** 和 **PC** 两列分别是 Tern 在 Apple 键盘和 PC 键盘（Windows 和 Linux；Linux 上 Win 读取为 Super）上的默认按键。`keymap` 预设或你的 `keybinds` 可以更改这些按键（[按键映射分层](../guides/commands.md#按键映射分层)），Settings › Keyboard 会显示当前生效的按键。如果一个按键会运行多个操作，按下时会运行最先适用于所在位置的操作：⌘L 会聚焦浏览器块的地址栏，并在代码视图中选择行。在 PC 上，Ctrl+Shift+PgUp 和 Ctrl+Shift+PgDn 会滚动终端；普通 PgUp 和 PgDn 则交给终端中的程序。

每个命令都可以覆盖。命令运行开始时会先查询覆盖处理器，因此无论命令如何启动都会生效：从命令面板、按键、菜单、工具栏按钮或 Tern 的其他部分启动都一样。即使命令在当前上下文中无操作（例如没有聚焦文件块时执行 `save`），也仍会先进入覆盖处理器。

### 标签页、窗口和会话

| Id | 命令面板标签 | Apple | PC | 说明 |
| --- | --- | --- | --- | --- |
| `new_tab` | New tab（新建标签页） | ⌘T | Ctrl+Shift+T | |
| `new_window` | New window（新建窗口） | ⌘N | Ctrl+Shift+N | |
| `switch_session` | Switch session…（切换会话…） | ⌃⌘K | Ctrl+Shift+Space | 切换器聚焦时再次按下会将其关闭 |
| `new_session` | New session（新建会话） | | | |
| `rename_session` | Rename session…（重命名会话…） | | | |
| `lock_session` | Lock session（锁定会话） | | | 会话锁定期间，此命令显示为当前选中状态 |
| `close_session` | Close session（关闭会话） | | | 有破坏性 |
| `move_session_up` | Move session up（上移会话） | | | 在所属 Host 的会话间循环移动；在垂直标签列表的会话名称上按 ⌥↑ |
| `move_session_down` | Move session down（下移会话） | | | 在所属 Host 的会话间循环移动；在垂直标签列表的会话名称上按 ⌥↓ |
| `collapse_all_sessions` | Collapse all sessions（折叠全部会话） | | | 折叠垂直标签列表中的所有会话；折叠状态与窗口一同保存 |
| `expand_all_sessions` | Expand all sessions（展开全部会话） | | | 展开垂直标签列表中的所有会话 |
| `close_tab` | Close tab（关闭标签页） | ⌥⌘W | Ctrl+Shift+Q, Ctrl+Alt+Shift+W | 有破坏性 |
| `next_tab` | Next tab（下一个标签页） | ⇧⌘] | Ctrl+Shift+→ | |
| `previous_tab` | Previous tab（上一个标签页） | ⇧⌘[ | Ctrl+Shift+← | |
| `next_tab_across_sessions` | Next tab across sessions（跨会话切换到下一个标签页） | | | 越过某会话的最后一个标签页后，切换到下一个会话的第一个标签页 |
| `previous_tab_across_sessions` | Previous tab across sessions（跨会话切换到上一个标签页） | | | |
| `move_tab_right` | Move tab right（将标签页右移） | | Ctrl+Shift+. | |
| `move_tab_left` | Move tab left（将标签页左移） | | Ctrl+Shift+, | |
| `rename_tab` | Rename tab…（重命名标签页…） | ⇧⌘R | Ctrl+Alt+Shift+T | |
| `show_previous_tab` | Show previous tab（显示上一个标签页） | ⌃⇧Tab | Ctrl+Shift+Tab | |
| `tidy_tab_title` | Tidy tab title（整理标签页标题） | | | |
| `focus_tabs` | Focus tab list（聚焦标签列表） | | | |
| `peek` | Peek at tabs（预览标签页） | ⌃⌥↓ | Ctrl+Alt+↓ | |
| `mission_control` | Mission Control（任务控制） | ⌃⌥↑ | Ctrl+Alt+↑ | 在 Mission Control 和标签页预览中，方向键或 h/j/k/l 移动选择，Home/End 选择第一张或最后一张卡片，⏎ 或 Space 打开卡片，Esc 关闭 |
| `park_pane` | Park pane（暂存窗格） | ⌃⇧↓ | Ctrl+Shift+↓ | 将聚焦窗格从其标签页移出，放入会话的暂存窗格中；其中的程序会继续运行。打开暂存窗格后再次执行会关闭它们 |
| `parked_panes` | Parked panes（暂存窗格） | ⌃⇧↑ | Ctrl+Shift+↑ | 打开会话的暂存窗格并选中第一张卡片；已打开时，会将所选窗格恢复到聚焦窗格旁边 |
| `inbox` | Show needs-attention inbox（显示需关注收件箱） | ⇧⌘I | Ctrl+Shift+I | |
| `clear_inbox` | Clear needs-attention inbox（清空需关注收件箱） | | | |

### 块和窗格

| Id | 命令面板标签 | Apple | PC | 说明 |
| --- | --- | --- | --- | --- |
| `new_shell_block` | New shell block（新建 Shell 块） | ⇧⌘T | ``Ctrl+Shift+` `` | |
| `new_agent_block` | New agent block（新建代理块） | ⇧⌘A | Ctrl+Shift+A | |
| `new_browser_block` | New browser block…（新建浏览器块…） | ⇧⌘B | Ctrl+Shift+B | |
| `new_task_manager_block` | New task-manager block（新建任务管理器块） | | | |
| `profile_process` | Profile process（分析进程性能） | | | |
| `new_screen_block` | New screen block（新建屏幕块） | | | |
| `release_screen` | Stop controlling the screen（停止控制屏幕） | ⌃⌥Esc | Ctrl+Alt+Esc | 当前聚焦的屏幕块切换为仅查看模式（⌃⌥⎋，PC 上为 Ctrl+Alt+Esc）。半秒内再次按下此按键组合，会重新启用控制，并将该按键组合发送到屏幕所在的 Host |
| `new_git_block` | New git block（新建 Git 块） | ⌥⌘G | Ctrl+Alt+Shift+G | |
| `new_board_block` | New board block（新建看板块） | ⌥⌘K | Ctrl+Alt+Shift+K | |
| `open_board` | Open board…（打开看板…） | | | |
| `open_as_board` | Open as board（打开为看板） | | | |
| `new_canvas_block` | New canvas block（新建画布块） | ⌥⌘E | Ctrl+Alt+Shift+E | |
| `open_canvas` | Open canvas file…（打开画布文件…） | | | |
| `open_url_in_split` | Open URL in split（在分屏中打开 URL） | | | |
| `focus_address` | Focus address field（聚焦地址栏） | ⌘L | Ctrl+Shift+L | |
| `inspect_page` | Inspect page（检查页面） | ⌥⌘I, F12 | F12 | |
| `split_right` | Split right（向右分屏） | ⌘D | Ctrl+Shift+Enter, Ctrl+Shift+D | |
| `split_down` | Split down（向下分屏） | ⇧⌘D | Ctrl+Shift+O | |
| `close_pane` | Close block（关闭块） | ⌘W | Ctrl+Shift+W | 有破坏性（命令面板会以颜色标示） |
| `zoom` | Zoom block（放大块） | ⇧⌘⏎ | Ctrl+Shift+R | |
| `equalize` | Even out splits（平均分配分屏） | ⌃⌘= | Alt+Shift+= | |
| `next_pane` | Next block（下一个块） | ⌘] | Ctrl+Shift+] | 在浏览器块中，⌘] 改为前进到下一页（[`browser.forward`](#浏览器块-browser)） |
| `previous_pane` | Previous block（上一个块） | ⌘[ | Ctrl+Shift+[ | 在浏览器块中，⌘[ 改为返回上一页（[`browser.back`](#浏览器块-browser)） |
| `move_pane:left` | Move pane left（向左移动窗格） | ⌥⇧⌘← | Ctrl+Alt+Shift+Home | |
| `move_pane:right` | Move pane right（向右移动窗格） | ⌥⇧⌘→ | Ctrl+Alt+Shift+End | |
| `move_pane:up` | Move pane up（向上移动窗格） | ⌥⇧⌘↑ | Ctrl+Alt+Shift+PgUp | |
| `move_pane:down` | Move pane down（向下移动窗格） | ⌥⇧⌘↓ | Ctrl+Alt+Shift+PgDn | |
| `move_pane_to_tab` | Move pane to tab…（移动窗格至标签页…） | | | |
| `move_pane_to_session` | Move pane to session…（移动窗格至会话…） | | | |

### 画中画

| Id | 命令面板标签 | Apple | PC | 说明 |
| --- | --- | --- | --- | --- |
| `pip` | Picture in picture（画中画） | ⌃⌘P | Ctrl+Alt+Shift+P | |
| `pip_dock:left` | Dock picture in picture left（向左停靠画中画） | | | |
| `pip_dock:right` | Dock picture in picture right（向右停靠画中画） | | | |
| `pip_dock:up` | Dock picture in picture up（向上停靠画中画） | | | |
| `pip_dock:down` | Dock picture in picture down（向下停靠画中画） | | | |
| `pip_corner:top_left` | Move picture in picture to top left（将画中画移到左上角） | | | |
| `pip_corner:top_right` | Move picture in picture to top right（将画中画移到右上角） | | | |
| `pip_corner:bottom_left` | Move picture in picture to bottom left（将画中画移到左下角） | | | |
| `pip_corner:bottom_right` | Move picture in picture to bottom right（将画中画移到右下角） | | | |
| `pip_stash_all` | Hide pictures in picture（隐藏画中画） | ⌃⌥⌘P | Ctrl+Shift+; | |
| `pip_over` | Picture in picture over…（将画中画悬浮于指定块上方…） | | | |
| `new_browser_pip` | New browser picture in picture（新建浏览器画中画） | ⌥⇧⌘B | Ctrl+Alt+Shift+B | |
| `open_url_in_pip` | Open URL in picture in picture（在画中画中打开 URL） | | | |

### 终端

| Id | 命令面板标签 | Apple | PC | 说明 |
| --- | --- | --- | --- | --- |
| `copy` | Copy（复制） | ⌘C | Ctrl+Shift+C, Ctrl+Insert | 在 Apple 键盘上，⌘C 也由网格和文本字段原生处理 |
| `paste` | Paste（粘贴） | ⌘V | Ctrl+Shift+V, Shift+Insert | 在 Apple 键盘上，⌘V 也由原生功能处理 |
| `paste_selection` | Paste selection（粘贴选区） | | Ctrl+Shift+S | |
| `find` | Find in scrollback（在回滚区中查找） | ⌘F | Ctrl+Shift+F | |
| `scroll_line_up` | Scroll up a line（向上滚动一行） | | | |
| `scroll_line_down` | Scroll down a line（向下滚动一行） | | | |
| `scroll_page_up` | Scroll up a page（向上滚动一页） | ⌘PgUp | Ctrl+Shift+PgUp | |
| `scroll_page_down` | Scroll down a page（向下滚动一页） | ⌘PgDn | Ctrl+Shift+PgDn | |
| `scroll_top` | Scroll to top（滚动到顶部） | ⌘Home | Ctrl+Shift+Home | |
| `scroll_bottom` | Scroll to bottom（滚动到底部） | ⌘End | Ctrl+Shift+End | |
| `previous_prompt` | Jump to previous prompt（跳转到上一个提示符） | ⌘↑ | Ctrl+Shift+Z | |
| `next_prompt` | Jump to next prompt（跳转到下一个提示符） | ⌘↓ | Ctrl+Shift+X | |
| `reply_start` | Jump to start of reply（跳转到回复开头） | ⌘↑ | Ctrl+Shift+Z | 在聊天（如 omp）中：视图上方回复的开头；在那里按 ⌘↑ / Ctrl+Shift+Z |
| `open_scrollback` | Open scrollback in editor（在编辑器中打开回滚区） | | Ctrl+Shift+H | |
| `toggle_output_fold` | Fold or unfold long output（折叠或展开较长输出） | | | 离当前视图最近的较长命令输出；点击其 `▸ N more lines` 标记也会执行相同操作 |
| `clear` | Clear screen and scrollback（清除屏幕和回滚区） | ⇧⌘K | Ctrl+Shift+K | |
| `restart` | Restart shell（重启 Shell） | | | |
| `goto_directory` | Go to directory…（转到目录…） | ⇧⌘G | Ctrl+Shift+G | |
| `insert_path` | Insert path…（插入路径…） | ⌥⌘P | Ctrl+Shift+/ | |

### Carly

| Id | 命令面板标签 | Apple | PC | 说明 |
| --- | --- | --- | --- | --- |
| `carly` | Ask Carly…（询问 Carly…） | ⌘ 连按两次 | Ctrl 连按两次 | |
| `carly_new_conversation` | Carly: New conversation（Carly：新建对话） | | | |
| `carly_tasks` | Carly: Scheduled tasks（Carly：计划任务） | | | 打开 Settings › Carly › Scheduled |
| `new_carly_block` | New Carly block（新建 Carly 块） | | | 在聚焦块旁以聊天方式打开与 Carly 的对话 |

### 数据库和 Notebook

| Id | 命令面板标签 | Apple | PC | 说明 |
| --- | --- | --- | --- | --- |
| `new_database` | New database…（新建数据库…） | | | |
| `new_memory_database` | New in-memory database（新建内存数据库） | | | |
| `open_database` | Open database…（打开数据库…） | | | |
| `open_database_read_only` | Open database read-only…（以只读方式打开数据库…） | ⇧⌘O | Ctrl+Alt+Shift+O | |
| `open_recent_database` | Open recent database（打开最近使用的数据库） | | | |
| `new_notebook` | New notebook（新建笔记本） | | | |
| `open_notebook` | Open notebook…（打开笔记本…） | | | |

### 文件和笔记

| Id | 命令面板标签 | Apple | PC | 说明 |
| --- | --- | --- | --- | --- |
| `open_file` | Open file…（打开文件…） | ⌘O, ⌘P | Ctrl+F12 | |
| `new_note` | New note（新建笔记） | ⌥⌘N | Ctrl+Alt+Shift+N | |
| `session_note` | Session note（会话笔记） | | | |
| `pane_note` | Block note（块笔记） | | | |
| `reopen_note` | Reopen closed note（重新打开已关闭的笔记） | ⌘Z | Ctrl+Shift+Z | |
| `save` | Save（保存） | ⌘S | Ctrl+S | |
| `save_as` | Save as…（保存为…） | ⌥⇧⌘S | Ctrl+Alt+Shift+S | |
| `revert` | Revert to saved（还原到已保存版本） | | | |
| `toggle_source` | Toggle Markdown source（切换 Markdown 源代码） | ⌘E | Ctrl+E | |
| `go_to_line` | Go to line…（转到行…） | ⌃G | Ctrl+G | |
| `toggle_wrap` | Wrap lines（自动换行） | ⌥Z | Alt+Z | |
| `next_change` | Next change（下一个更改） | ⌥F5 | Alt+F5 | |
| `previous_change` | Previous change（上一个更改） | ⌥⇧F5 | Alt+Shift+F5 | |
| `fold_all` | Fold all（全部折叠） | | | 代码视图（编辑器快捷键为 ⇧⌥⌘[） |
| `unfold_all` | Unfold all（全部展开） | | | 代码视图（编辑器快捷键为 ⇧⌥⌘]） |
| `reopen_with_encoding` | Reopen with encoding…（使用指定编码重新打开…） | | | |
| `line_endings` | Convert line endings…（转换换行符…） | | | |
| `browse_folder` | Browse folder…（浏览文件夹…） | | | 显示聚焦文件所在目录中的文件，与点击工具栏中文件名的效果相同 |
| `reveal_file` | Reveal file in Finder（在 Finder 中显示文件） | | | |
| `open_file_outside` | Open file in default app（在默认应用中打开文件） | | | |
| `copy_file_path` | Copy file path（复制文件路径） | | | |

### 文件窗格

| Id | 命令面板标签 | Apple | PC | 说明 |
| --- | --- | --- | --- | --- |
| `files` | Show/hide files（显示/隐藏文件） | ⌃⌘E | Ctrl+Shift+E | |
| `focus_files` | Focus Files（聚焦 Files） | ⇧⌘E | Ctrl+0 | |
| `reveal_active_file` | Files: Reveal active file（文件：显示当前文件） | | | |
| `reveal_cwd` | Files: Reveal directory（文件：显示目录） | | | |
| `files_pin` | Files: Pin folder / Follow block（文件：固定文件夹 / 跟随块） | | | |
| `open_folder` | Files: Open folder…（文件：打开文件夹…） | | | |
| `files_filter` | Files: Filter…（文件：筛选…） | | | |
| `files_collapse_all` | Files: Collapse all（文件：全部折叠） | | | |
| `files_toggle_hidden` | Files: Show/hide hidden files（文件：显示/隐藏隐藏文件） | | | |

### 外观和布局

| Id | 命令面板标签 | Apple | PC | 说明 |
| --- | --- | --- | --- | --- |
| `increase_font_size` | Increase font size（增大字号） | ⌘=, ⇧⌘= | Ctrl+Shift+= | |
| `decrease_font_size` | Decrease font size（减小字号） | ⌘- | Ctrl+Shift+- | |
| `reset_font_size` | Reset font size（重置字号） | ⌘0 | Ctrl+Shift+Backspace | |
| `theme` | Change theme…（更改主题…） | ⌃⌘T | Ctrl+Shift+M | |
| `opacity` | Change opacity…（更改不透明度…） | | | |
| `blur` | Change blur…（更改模糊度…） | | | |
| `appearance:system` | System appearance（系统外观） | | | |
| `appearance:light` | Light appearance（浅色外观） | | | |
| `appearance:dark` | Dark appearance（深色外观） | | | |
| `copy_on_select` | Copy on select（选中时复制） | | | |
| `contrast` | Automatic contrast correction（自动对比度校正） | | | |
| `native_surfaces` | Native program surfaces（原生程序 surface） | | | |
| `surface_headings:auto` | Markdown headings: Automatic（Markdown 标题：自动） | | | |
| `surface_headings:annotated` | Markdown headings: Annotated（Markdown 标题：带注释） | | | |
| `surface_headings:sized` | Markdown headings: Sized（Markdown 标题：调整大小） | | | |
| `surface_diffs` | Edits: inline or split（编辑：行内或分屏） | | | |
| `surface_fold` | Fold tool calls（折叠工具调用） | | | |
| `expand_thoughts` | Expand thoughts（展开思考内容） | | | |
| `composer_text` | Composer: plain text or Markdown（撰写器：纯文本或 Markdown） | | | |
| `chat:reader` | Chat style: Reader（聊天样式：阅读） | | | |
| `chat:spine` | Chat style: Spine（聊天样式：脊柱） | | | |
| `chat:console` | Chat style: Console（聊天样式：控制台） | | | |
| `native_prompt` | Native prompt（原生提示符） | | | |
| `prompt_style` | Prompt style…（提示符样式…） | | | |
| `prompt_part:palette` | Prompt: next colors（提示符：下一个配色） | | | |
| `prompt_part:fill` | Prompt: next fill（提示符：下一个填充） | | | |
| `prompt_part:shape` | Prompt: next shape（提示符：下一个形状） | | | |
| `prompt_part:frame` | Prompt: next frame（提示符：下一个边框） | | | |
| `prompt_part:line_end` | Prompt: frame line end on or off（提示符：切换边框线条结尾） | | | |
| `prompt_part:gap` | Prompt: next gap（提示符：下一个间距） | | | |
| `prompt_part:char` | Prompt: next prompt character（提示符：下一个字符） | | | |
| `prompt_part:separator` | Prompt: next separators（提示符：下一个分隔符） | | | |
| `prompt_part:git` | Prompt: next git format（提示符：下一个 Git 格式） | | | |
| `prompt_part:dir` | Prompt: next directory format（提示符：下一个目录格式） | | | |
| `prompt_part:icons` | Prompt: icons on or off（提示符：切换图标） | | | |
| `prompt_part:clock` | Prompt: next clock（提示符：下一个时钟格式） | | | |
| `prompt_segments` | Prompt segments…（提示符片段…） | | | |
| `prompt_collapse` | Collapse past prompts（折叠较早的提示符） | | | |
| `next_layout` | Next layout（下一个布局） | ⌃⌘L | Ctrl+Shift+L | |
| `layout:rail` | Layout: Rail（布局：Rail） | | | |
| `layout:float` | Layout: Float（布局：Float） | | | |
| `layout:tiles` | Layout: Tiles（布局：Tiles） | | | |
| `layout:studio` | Layout: Studio（布局：Studio） | | | |
| `toggle_tab_orientation` | Toggle tab orientation（切换标签方向） | ⇧⌘S | Ctrl+Shift+\ | |
| `tabs:horizontal` | Horizontal tabs（水平标签页） | | | |
| `tabs:vertical` | Vertical tabs（垂直标签页） | | | |
| `toggle_sidebar` | Show/hide sidebar（显示/隐藏侧边栏） | ⌘B | Ctrl+Alt+Shift+\ | |
| `pane_headers:never` | Pane headers: Never（窗格标题：从不显示） | | | |
| `pane_headers:split` | Pane headers: When split（窗格标题：分屏时显示） | | | |
| `pane_headers:always` | Pane headers: Always（窗格标题：始终显示） | | | |
| `status_bar` | Show status line（显示状态行） | | | |
| `interface_style` | Change interface style…（更改界面样式…） | | | |

### 远程主机

| Id | 命令面板标签 | Apple | PC | 说明 |
| --- | --- | --- | --- | --- |
| `switch_host` | Switch host…（切换主机…） | ⌃⌘H | Ctrl+Shift+J | |
| `add_remote_host` | Add remote host…（添加远程主机…） | ⌃⌘N | Ctrl+Shift+Y | |
| `new_session_on_host` | New session on host…（在主机上新建会话…） | | | |
| `disconnect_host` | Disconnect from host…（断开主机连接…） | | | |
| `update_remote_host` | Update remote host…（更新远程主机…） | | | 连接的主机运行旧版 Tern 时显示 |

### 应用

| Id | 命令面板标签 | Apple | PC | 说明 |
| --- | --- | --- | --- | --- |
| `preferences` | Settings…（设置…） | ⌘, | Ctrl+, | 设置聚焦时再次按下会将其关闭；设置已打开但未聚焦时，会将焦点移至设置 |
| `secure_keyboard_entry` | Toggle Secure Keyboard Entry（切换安全键盘输入） | | | 仅限 macOS |
| `open_config` | Open settings.json（打开 settings.json） | | Ctrl+Shift+F2 | |
| `reload_config` | Reload settings（重新加载设置） | | Ctrl+Shift+F5 | |
| `reload_plugins` | Reload plugins（重新加载插件） | | | |
| `open_logs` | Open logs and app state（打开日志和应用状态） | | | |
| `open_app_data` | Open app data folder（打开应用数据文件夹） | | | |
| `quit` | Quit Tern（退出 Tern） | ⌘Q | Alt+F4 | 有破坏性 |
| `restart_tern` | Restart Tern（重启 Tern） | | | |
| `fps` | Debug: Show FPS（调试：显示 FPS） | | | |
| `devtools` | Toggle developer tools（切换开发者工具） | ⌥⌘I, F12 | F12 | 在浏览器块中，这些按键改为检查其页面（`inspect_page`） |
| `screenshot` | Screenshot（截图） | | | |
| `show_commands` | Show all commands（显示所有命令） | ⇧⌘P | Ctrl+Shift+F1 | 命令面板聚焦且列出命令时，再次按下会将其关闭 |
| `sign_out` | Sign out of Stencil（退出 Stencil） | | | |
| `check_for_updates` | Check for updates（检查更新） | | | |
| `release_notes` | What's new: release notes（更新内容：发行说明） | | | |
| `help` | Help & documentation（帮助和文档） | | | 打开 docs.stencil.so/tern |
| `restart_to_update` | Restart to update（重启以更新） | | | |
| `restart_session_daemon` | Restart session daemon（重启会话守护进程） | | | |
| `install_omp` | Install omp（安装 omp） | | | 桌面版；直到 Tern 管理 omp 为止 |
| `check_omp_updates` | Check for omp updates（检查 omp 更新） | | | Tern 管理 omp 期间 |
| `stop_managing_omp` | Stop managing omp（停止管理 omp） | | | Tern 管理 omp 期间 |


### 覆盖的运行方式

1. 命令启动。如果没有已加载的插件为该 id 注册覆盖处理器，就运行内置命令。
2. 否则，按插件顺序（插件按 id 排序加载）运行每个插件针对该 id 的覆盖处理器；每个处理器都会收到新的窗口 `cx`，钩子为 `override <id>`。
3. 第一个返回真值的覆盖处理器会阻止其余处理器运行，并跳过内置命令。引发错误或超出预算的处理器视为 `false`；失败会以 toast 提示。
4. 如果没有处理器返回真值，就运行内置命令。

任何插件处理器运行期间，窗口中的插件都会暂时移出窗口，因此处理器内的 `cx:command(id)` 会直接运行内置命令：不会再次运行覆盖处理器，也不会递归。

## 按键映射操作

`tern.bind(chord, action)` 可接受本节中的任意名称、任意[命令 id](#命令)或[插件操作](#插件操作)。重建按键映射时会使用与 `settings.json` 中 `keybinds` 相同的解析器解析该名称。

| 操作 | 功能 | Apple | PC | 说明 |
| --- | --- | --- | --- | --- |
| `palette` | 打开命令面板 | ⌘K | Ctrl+Shift+P | 命令面板聚焦并显示 All 时，再次按下会将其关闭 |
| `goto_tab:N` | 激活会话的标签页 `N` | ⌘1 … ⌘9, ⌥1 … ⌥9 | Ctrl+Shift+1 … Ctrl+Shift+9, Ctrl+Shift+0 (tab 10), Alt+1 … Alt+9 | 从 1 开始；`goto_tab:0` 和非数字值无法解析 |
| `last_tab` | 激活会话的最后一个标签页 | | | |
| `focus_pane:DIR` | 聚焦 `DIR` 方向上的窗格 | ⌥⌘ 和方向键 | Ctrl+Alt+Shift 和方向键 | `left`, `right`, `up`, `down` |
| `resize_split:DIR` | 移动最近的分隔线 | ⌃⌘ 和方向键 | Alt+Shift 和方向键 | `left`, `right`, `up`, `down` |
| `find_older` | 切换到较早的查找匹配项 | ⌘G | F3, Ctrl+Shift+G | 查找栏打开时 |
| `find_newer` | 切换到较新的查找匹配项 | ⇧⌘G | Shift+F3 | 查找栏打开时 |
| `scroll_top_at_shell` | 滚动到顶部 | | | 在终端中，且未处于全屏程序内时 |
| `scroll_bottom_at_shell` | 滚动到底部 | | | 在终端中，且未处于全屏程序内时 |
| `text:BYTES` | 将 `BYTES` 写入当前聚焦终端中的程序 | | | 支持转义 `\e`, `\r`, `\n`, `\t`, `\\`, `\xHH`；其他转义无法解析 |

`unbind`（以及 `[]`）是 `settings.json` 中 `keybinds` 专用的特殊值，不是操作名称，因此 `tern.bind(chord, "unbind")` 不会纳入。

```lua
tern.bind("ctrl+alt+1", "goto_tab:1")
tern.bind("ctrl+alt+c", "text:\x03") -- send ^C
tern.bind("ctrl+a>%", "split_right")
```

### 文本编辑：`edit.*`

适用于当前聚焦的编辑器或文本字段，不适用于终端（按键会交给终端中的程序）。

| 操作 | 功能  |
| --- | --- |
| edit.select_all | 选择全部 |
| edit.copy | 复制 |
| edit.cut | 剪切 |
| edit.paste | 粘贴 |
| edit.undo | 撤销 |
| edit.redo | 重做 |

### 代码和十六进制视图：`editor.*`

由当前聚焦的代码视图或十六进制视图运行。每个操作只接受一个按键组合：在 `settings.json` 中，序列上的 `editor.*` 操作会被拒绝。

| 操作 | 功能 | Apple | PC |
| --- | --- | --- | --- |
| editor.move_lines_up | 上移所选行 | ⌥↑ | Alt+↑ |
| editor.move_lines_down | 下移所选行 | ⌥↓ | Alt+↓ |
| editor.duplicate_lines_up | 复制所选行（选区位于上方副本） | ⌥⇧↑ | Alt+Shift+↑ |
| editor.duplicate_lines_down | 复制所选行（选区位于下方副本） | ⌥⇧↓ | Alt+Shift+↓ |
| editor.add_caret_above | 在上一行添加插入符 | ⌃⇧↑ | Win+Shift+↑ |
| editor.add_caret_below | 在下一行添加插入符 | ⌃⇧↓ | Win+Shift+↓ |
| editor.add_next_occurrence | 选择单词，然后添加其下一处匹配 | ⌘D | Ctrl+Shift+D, Ctrl+D |
| editor.skip_occurrence | 跳到下一处匹配 | ⌥⌘D | Ctrl+Alt+D |
| editor.select_all_occurrences | 选择所有匹配项 | ⇧⌘L | Ctrl+F2, Ctrl+Shift+L |
| editor.select_line | 选择插入符所在的整行，包括换行符；再次执行会多选一行（Tern 在 PC 上使用 Ctrl+L） | ⌘L | Ctrl+L |
| editor.carets_at_line_ends | 在选区每行的末尾添加插入符 | ⌥⇧I | Alt+Shift+I |
| editor.toggle_comment | 切换行注释 | ⌘/ | Ctrl+/ |
| editor.indent | 增加缩进 | Tab | Tab |
| editor.outdent | 减少缩进 | ⇧Tab | Shift+Tab |
| editor.undo | 撤销 | ⌘Z | Ctrl+Z |
| editor.redo | 重做 | ⇧⌘Z | Ctrl+Shift+Z |
| editor.escape | 退出一层：查找栏、额外插入符、选区、行内块 | Esc | Esc |
| editor.leave_inline_block | 离开行内代码块（Markdown）；在块视图中，该键会在下方打开一行 | ⌘⏎ | Ctrl+Enter |
| editor.newline_below | 在每个插入符所在行的下方新建一行，不拆分该行；缩进方式与在行末按 ⏎ 相同（文件代码视图） | ⌘⏎ | Ctrl+Enter |
| editor.newline_above | 在每个插入符所在行的上方新建一行，并保留其缩进（闭合符前会多缩进一级） | ⌥⌘⏎ | Ctrl+Alt+Enter |
| editor.toggle_wrap | 切换软换行 | ⌥Z | Alt+Z |
| editor.find | 查找 | ⌘F | Ctrl+F |
| editor.find_replace | 查找和替换 | ⌥⌘F | Ctrl+Alt+F |
| editor.go_to_line | 转到行（十六进制视图中转到偏移量） | ⌃G | Win+G |
| editor.find_next | 下一个匹配项 | ⌘G | F3, Ctrl+G |
| editor.find_previous | 上一个匹配项 | ⇧⌘G | Shift+F3, Ctrl+Shift+G |
| editor.use_selection_for_find | 使用选区进行查找 | ⌘E | Ctrl+E |
| editor.delete_to_line_end | 删除到行尾（若已在行尾，则删除换行符）并放入剪切缓冲区。该缓冲区独立于剪贴板，由所有代码视图共享；连续按下且期间没有其他编辑或插入符移动时，会将内容追加到缓冲区 | ⌃K | Win+K |
| editor.yank | 在每个插入符处插入剪切缓冲区内容（若插入符数量与剪切时相同，则每个插入符插入一段内容） | ⌃Y | Win+Y |
| editor.join_lines | 合并每个选区所包含的行（插入符所在行与下一行也算）：每个换行符及其周围空白替换为一个空格；`)`、`]`、`}` 或空行之前不插入空格（Tern 在 PC 上使用 Ctrl+J） | ⌃J | Ctrl+J, Win+J |
| editor.next_change | 下一个 Git 更改（循环） | ⌥F5 | Alt+F5 |
| editor.previous_change | 上一个 Git 更改（循环） | ⇧⌥F5 | Alt+Shift+F5 |
| editor.subword_left | 移至上一个子词的开头（camelCase 分界、大写缩写、数字、`snake_case` 和 `kebab-case` 部分；PC：Ctrl+Alt+←） | ⌃⌥← | Ctrl+Alt+←, Win+Alt+← |
| editor.subword_right | 移至下一个子词的末尾（PC：Ctrl+Alt+→） | ⌃⌥→ | Ctrl+Alt+→, Win+Alt+→ |
| editor.select_subword_left | 扩展选区到上一个子词的开头 | ⌃⌥⇧← | Win+Alt+Shift+← |
| editor.select_subword_right | 扩展选区到下一个子词的末尾 | ⌃⌥⇧→ | Win+Alt+Shift+→ |
| editor.delete_subword_backward | 删除到上一个子词的开头（PC：Ctrl+Alt+Backspace） | ⌃⌥⌫ | Ctrl+Alt+Backspace, Win+Alt+Backspace |
| editor.delete_subword_forward | 删除到下一个子词的末尾 | ⌃⌥⌦ | Win+Alt+Delete |
| editor.expand_selection | 扩展每个选区：子词、单词、字符串内容、字符串、括号内内容、括号本身（向外）、整行、整个文档（PC：Alt+Shift+→） | ⌃⇧→ | Alt+Shift+→, Win+Shift+→ |
| editor.shrink_selection | 恢复上次扩展替换前的选区（PC：Alt+Shift+←） | ⌃⇧← | Alt+Shift+←, Win+Shift+← |
| editor.fold | 折叠每个插入符周围最内层的范围，或多行选区中每个起始于选区的范围 | ⌥⌘[ | Ctrl+Alt+[ |
| editor.unfold | 展开选区所在行的折叠内容 | ⌥⌘] | Ctrl+Alt+] |
| editor.toggle_fold | 在主插入符处折叠或展开 | ⌥⌘\ | Ctrl+Alt+\ |
| editor.fold_all | 折叠所有范围（包括嵌套范围） | ⇧⌥⌘[ | Ctrl+Alt+Shift+[ |
| editor.unfold_all | 展开所有内容 | ⇧⌥⌘] | Ctrl+Alt+Shift+] |

### 渲染后的 Markdown：`markdown.*`

由当前聚焦的渲染后 Markdown 视图运行；与 `editor.*` 一样，只接受一个按键组合。

| 操作 | 功能 | Apple | PC |
| --- | --- | --- | --- |
| markdown.bold | 粗体：为选区添加或移除粗体 | ⌘B | Ctrl+B |
| markdown.italic | 斜体 | ⌘I | Ctrl+I |
| markdown.strikethrough | 删除线 | ⇧⌘X | Ctrl+Shift+X |
| markdown.link | 链接卡片 | ⇧⌘K | Ctrl+Shift+K |
| markdown.move_block_up | 上移块 | ⌥↑ | Alt+↑ |
| markdown.move_block_down | 下移块 | ⌥↓ | Alt+↓ |
| markdown.duplicate_block | 复制块（块选区） | ⌘D | Ctrl+Shift+D, Ctrl+D |
| markdown.outdent | 提升列表项 / 移至上一个表格单元格 | ⇧Tab | Shift+Tab |
| markdown.hard_break | 硬换行 | ⇧⏎ | Shift+Enter |
| markdown.extend_blocks_up | 向上扩展块选区 | ⇧↑ | Shift+↑ |
| markdown.extend_blocks_down | 向下扩展块选区 | ⇧↓ | Shift+↓ |

### 浏览器块：`browser.*`

当焦点位于浏览器块、其页面或地址栏中时适用（在地址栏输入时，Alt+← 和 Alt+→ 仍由地址栏处理）。在 Apple 键盘上，⌘[ 和 ⌘] 会优先于 `previous_pane` 和 `next_pane`，与 Safari 一样，因此会为侧键发送 ⌘[ / ⌘] 的鼠标工具也会在此返回和前进；其他位置的 ⌘[ 和 ⌘] 仍用于切换块。绑定 ⌘[ 或 ⌘] 的 `keymap` 预设（Ghostty、cmux 的预设）会让它们保持优先。无论按键映射如何设置，鼠标自身的后退和前进按钮都会切换页面。

| 操作 | 功能  | Apple | PC |
| --- | --- | --- | --- |
| browser.back | 返回上一页 | ⌘[ | Alt+← |
| browser.forward | 前进到下一页 | ⌘] | Alt+→ |

### Git：`git.*`

焦点位于 git 块或 Files 窗格的 Changes 或 Refs 标签时适用；文件在差异视图中打开时，差异快捷键也适用。iOS 和 Web 版本不可用。

| 操作 | 功能 |
| --- | --- |
| git.find | 在已打开的差异中查找，否则搜索提交图 |
| git.new_branch | 新建分支表单 |
| git.undo | 撤销最近一次操作（文本字段内除外） |
| git.redo | 重做最近一次撤销的操作（文本字段内除外） |
| git.back | 在选择项和已打开的差异间后退（文本字段内除外） |
| git.forward | 在选择项和已打开的差异间前进（文本字段内除外） |
| git.next_commit | 选择下一个提交（未打开差异时） |
| git.previous_commit | 选择上一个提交（未打开差异时） |
| git.peek | 预览所选提交，或关闭预览 |
| git.select_working_tree | 选择工作树（未打开差异时） |
| git.commit_message | 提交撰写器的摘要字段 |
| git.refresh | 重新读取仓库 |
| git.filter_refs | Refs 标签页的筛选器 |
| git.next_hunk | 已打开差异中的下一个区块（整文件视图中为下一个更改） |
| git.previous_hunk | 已打开差异中的上一个区块 |
| git.next_file | 下一个有更改的文件 |
| git.previous_file | 上一个有更改的文件 |
| git.toggle_wrap | 长差异行自动换行 |
| git.cycle_whitespace | 空白字符：精确 → 忽略空白字符 → 忽略格式 |
| git.toggle_hunk_view | 一次显示一个区块 |
| git.expand_context | 显示当前区块上下各 20 行未更改内容 |
| git.toggle_all_context | 显示已打开差异中的所有未更改行，或再次折叠它们 |
| git.edit_file | 在文件块中编辑已打开的工作树文件 |
| git.stage | 暂存/取消暂存所选行；否则在区块视图中操作该区块；再否则操作整个文件 |
| git.discard_lines | 丢弃所选行；否则在区块视图中丢弃区块（会先确认） |
| git.discard_file | 丢弃已打开文件尚未暂存的更改（会先确认） |

### SQLite 块：`sqlite.*`

在当前聚焦的 SQLite 块中运行，聚焦时也会列在命令面板中。显示相应区域时，会列出该区域的操作（`sqlite.structure.*`、`sqlite.browse.*`、`sqlite.execute.*`、`sqlite.pragmas.*`）。适用于整个块的操作默认快捷键：⌘S `write`、⌘Z `undo`、⌥⌘1–⌥⌘4 切换四个区域、⌘E / ⌥⌘D / ⌘I 打开单元格、绘图和架构工作表、⌘L `log`。

| 操作 | 标签 |
| --- | --- |
| sqlite.write | Write changes（写入更改） |
| sqlite.revert | Revert changes…（还原更改…） |
| sqlite.undo | Undo last change（撤销上次更改） |
| sqlite.area.structure | Show database structure（显示数据库结构） |
| sqlite.area.browse | Browse data（浏览数据） |
| sqlite.area.execute | Execute SQL（执行 SQL） |
| sqlite.area.pragmas | Edit pragmas（编辑 pragma） |
| sqlite.sheet.cell | Edit cell sheet（编辑单元格工作表） |
| sqlite.sheet.plot | Plot sheet（绘图工作表） |
| sqlite.sheet.schema | Schema sheet（架构工作表） |
| sqlite.log | SQL log（SQL 日志） |
| sqlite.read_only | Reopen read-only / writable（以只读/可写模式重新打开） |
| sqlite.close | Close database（关闭数据库） |
| sqlite.structure.refresh | Refresh structure（刷新结构） |
| sqlite.structure.browse | Browse selected table（浏览所选表） |
| sqlite.structure.modify | Modify selected object…（修改所选对象…） |
| sqlite.structure.delete | Delete selected object…（删除所选对象…） |
| sqlite.structure.copy_create | Copy create statement（复制创建语句） |
| sqlite.structure.copy_name | Copy name（复制名称） |
| sqlite.structure.copy_drop | Copy for the SQL editor（复制到 SQL 编辑器） |
| sqlite.structure.menu | Selected object's menu（所选对象的菜单） |
| sqlite.structure.row_counts | Show row counts in the structure（在结构视图中显示行数） |
| sqlite.structure.unfold_all | Unfold all objects（展开所有对象） |
| sqlite.structure.fold_all | Fold all objects（折叠所有对象） |
| sqlite.browse.refresh | Refresh（刷新） |
| sqlite.browse.previous_table | Previous table（上一个表） |
| sqlite.browse.next_table | Next table（下一个表） |
| sqlite.browse.new_tab | New data browser（新建数据浏览器） |
| sqlite.browse.rename_tab | Rename data browser…（重命名数据浏览器…） |
| sqlite.browse.close_tab | Close data browser（关闭数据浏览器） |
| sqlite.browse.new_record | New record（新建记录） |
| sqlite.browse.insert_values | Insert values…（插入值…） |
| sqlite.browse.delete_records | Delete records（删除记录） |
| sqlite.browse.duplicate_record | Duplicate records（复制记录） |
| sqlite.browse.copy_above | Copy cell above（复制上方单元格） |
| sqlite.browse.set_null | Set to NULL（设为 NULL） |
| sqlite.browse.clear_cells | Empty cells（清空单元格） |
| sqlite.browse.delete | Delete records or empty cells（删除记录或清空单元格） |
| sqlite.browse.cut | Cut（剪切） |
| sqlite.browse.copy_headers | Copy with headers（连同表头一起复制） |
| sqlite.browse.copy_sql | Copy as SQL（复制为 SQL） |
| sqlite.browse.select_all | Select all（选择全部） |
| sqlite.browse.edit_cell | Edit cell…（编辑单元格…） |
| sqlite.browse.find | Find…（查找…） |
| sqlite.browse.replace | Find and replace…（查找和替换…） |
| sqlite.browse.find_next | Find next（查找下一个） |
| sqlite.browse.find_previous | Find previous（查找上一个） |
| sqlite.browse.replace_next | Replace（替换） |
| sqlite.browse.replace_all | Replace all（全部替换） |
| sqlite.browse.adjust_rows | Adjust rows to contents（根据内容调整行高） |
| sqlite.browse.first_page | First page（第一页） |
| sqlite.browse.previous_page | Previous page（上一页） |
| sqlite.browse.next_page | Next page（下一页） |
| sqlite.browse.last_page | Last page（最后一页） |
| sqlite.browse.goto_row | Go to row…（转到行…） |
| sqlite.browse.clear_filters | Clear filters（清除筛选器） |
| sqlite.browse.clear_sorting | Clear sorting（清除排序） |
| sqlite.browse.focus_filter | Filter this column（筛选此列） |
| sqlite.browse.global_filter | Filter in any column（在任意列中筛选） |
| sqlite.browse.find_column | Find column…（查找列…） |
| sqlite.browse.show_rowid | Show rowid column（显示 rowid 列） |
| sqlite.browse.freeze_columns | Freeze columns up to this one（冻结到此列为止的所有列） |
| sqlite.browse.hide_columns | Hide columns（隐藏列） |
| sqlite.browse.show_all_columns | Show all columns（显示所有列） |
| sqlite.browse.select_column | Select column（选择列） |
| sqlite.browse.unlock_view | Unlock view editing…（解锁视图编辑…） |
| sqlite.browse.display_format | Edit display format…（编辑显示格式…） |
| sqlite.browse.encoding | Set encoding…（设置编码…） |
| sqlite.browse.encoding_all | Set encoding for all tables…（为所有表设置编码…） |
| sqlite.browse.copy_column_name | Copy column name（复制列名） |
| sqlite.browse.cond_formats | Edit conditional formats…（编辑条件格式…） |
| sqlite.browse.format_toolbar | Format toolbar（格式工具栏） |
| sqlite.browse.bold | Bold（粗体） |
| sqlite.browse.italic | Italic（斜体） |
| sqlite.browse.underline | Underline（下划线） |
| sqlite.browse.align_left | Align left（左对齐） |
| sqlite.browse.align_center | Align center（居中对齐） |
| sqlite.browse.align_right | Align right（右对齐） |
| sqlite.browse.align_justify | Justify（两端对齐） |
| sqlite.browse.clear_format | Clear format（清除格式） |
| sqlite.browse.save_as_view | Save current filter as view…（将当前筛选器保存为视图…） |
| sqlite.browse.export_csv | Export filtered data as CSV…（将筛选后的数据导出为 CSV…） |
| sqlite.browse.export_json | Export filtered data as JSON…（将筛选后的数据导出为 JSON…） |
| sqlite.execute.execute | Execute all/selected SQL（执行全部/所选 SQL） |
| sqlite.execute.execute_line | Execute current line（执行当前行） |
| sqlite.execute.stop | Stop SQL execution（停止执行 SQL） |
| sqlite.execute.new_tab | New SQL tab（新建 SQL 标签页） |
| sqlite.execute.open_file | Open SQL file…（打开 SQL 文件…） |
| sqlite.execute.save_file | Save SQL file（保存 SQL 文件） |
| sqlite.execute.save_file_as | Save SQL file as…（另存 SQL 文件为…） |
| sqlite.execute.close_tab | Close SQL tab（关闭 SQL 标签页） |
| sqlite.execute.rename_tab | Rename SQL tab…（重命名 SQL 标签页…） |
| sqlite.execute.duplicate_tab | Duplicate SQL tab（复制 SQL 标签页） |
| sqlite.execute.next_tab | Next SQL tab（下一个 SQL 标签页） |
| sqlite.execute.previous_tab | Previous SQL tab（上一个 SQL 标签页） |
| sqlite.execute.focus_editor | Focus SQL editor（聚焦 SQL 编辑器） |
| sqlite.execute.focus_results | Focus SQL results（聚焦 SQL 结果） |
| sqlite.execute.complete | Complete SQL（补全 SQL） |
| sqlite.execute.zoom_in | Zoom SQL editor in（放大 SQL 编辑器） |
| sqlite.execute.zoom_out | Zoom SQL editor out（缩小 SQL 编辑器） |
| sqlite.execute.zoom_reset | Reset SQL editor zoom（重置 SQL 编辑器缩放） |
| sqlite.execute.copy_with_headers | Copy results with headers（连同表头一起复制结果） |
| sqlite.execute.copy_as_sql | Copy results as SQL（将结果复制为 SQL） |
| sqlite.execute.export_csv | Export results to CSV…（将结果导出为 CSV…） |
| sqlite.execute.export_json | Export results to JSON…（将结果导出为 JSON…） |
| sqlite.execute.save_as_view | Save results as view…（将结果保存为视图…） |
| sqlite.execute.toggle_tiling | Results beside the editor（结果显示在编辑器旁边） |
| sqlite.pragmas.save | Save pragmas（保存 pragma） |
| sqlite.pragmas.reset | Reset pragma edits（重置 pragma 编辑） |
| sqlite.pragmas.refresh | Reload pragmas（重新加载 pragma） |
| sqlite.cell.apply | Edit cell: Apply（编辑单元格：应用） |
| sqlite.cell.discard | Edit cell: Discard edits（编辑单元格：放弃更改） |
| sqlite.cell.set_null | Edit cell: Set as NULL（编辑单元格：设为 NULL） |
| sqlite.cell.import | Edit cell: Import from file…（编辑单元格：从文件导入…） |
| sqlite.cell.import_reference | Edit cell: Save file reference…（编辑单元格：保存文件引用…） |
| sqlite.cell.export | Edit cell: Export to file…（编辑单元格：导出到文件…） |
| sqlite.cell.export_dump | Edit cell: Export hex dump…（编辑单元格：导出十六进制转储…） |
| sqlite.cell.open_external | Edit cell: Open in external application（编辑单元格：在外部应用中打开） |
| sqlite.cell.open_default | Edit cell: Open in default application or browser（编辑单元格：在默认应用或浏览器中打开） |
| sqlite.cell.copy_hex_ascii | Edit cell: Copy Hex and ASCII（编辑单元格：复制十六进制和 ASCII） |
| sqlite.cell.overwrite | Edit cell: Overwrite mode（编辑单元格：覆盖模式） |
| sqlite.cell.word_wrap | Edit cell: Word wrap（编辑单元格：自动换行） |
| sqlite.cell.auto_format | Edit cell: Auto-format（编辑单元格：自动格式化） |
| sqlite.cell.sort_keys | Edit cell: Sort keys（编辑单元格：排序键） |
| sqlite.cell.auto_switch | Edit cell: Auto-switch mode（编辑单元格：自动切换模式） |
| sqlite.cell.focus | Edit cell: Focus the editor（编辑单元格：聚焦编辑器） |
| sqlite.cell.mode.text | Edit cell: Text mode（编辑单元格：文本模式） |
| sqlite.cell.mode.rtl | Edit cell: RTL Text mode（编辑单元格：RTL 文本模式） |
| sqlite.cell.mode.binary | Edit cell: Binary mode（编辑单元格：二进制模式） |
| sqlite.cell.mode.image | Edit cell: Image mode（编辑单元格：图像模式） |
| sqlite.cell.mode.json | Edit cell: JSON mode（编辑单元格：JSON 模式） |
| sqlite.cell.mode.xml | Edit cell: XML mode（编辑单元格：XML 模式） |
| sqlite.cell.mode.svg | Edit cell: SVG mode（编辑单元格：SVG 模式） |
| sqlite.cell.mode.evaluation | Edit cell: Evaluation mode（编辑单元格：求值模式） |
| sqlite.plot.copy | Plot: copy image（绘图：复制图像） |
| sqlite.plot.save | Plot: save as PNG, JPG or SVG…（绘图：另存为 PNG、JPG 或 SVG…） |
| sqlite.plot.load_all | Plot: load all data（绘图：加载所有数据） |
| sqlite.plot.reset | Plot: reset view（绘图：重置视图） |
| sqlite.plot.legend | Plot: show legend（绘图：显示图例） |
| sqlite.plot.stacked | Plot: stacked bars（绘图：堆叠柱状图） |
| sqlite.plot.fixed | Plot: fixed number format（绘图：固定数字格式） |
| sqlite.plot.log_x | Plot: logarithmic scale (X)（绘图：对数刻度（X）） |
| sqlite.plot.log_y | Plot: logarithmic scale (Y)（绘图：对数刻度（Y）） |
| sqlite.dialogs.create_table | Create table…（创建表…） |
| sqlite.dialogs.modify_table | Modify table…（修改表…） |
| sqlite.dialogs.create_index | Create index…（创建索引…） |
| sqlite.dialogs.import_csv | Import table from CSV file…（从 CSV 文件导入表…） |
| sqlite.dialogs.import_csv_clipboard | Import table from CSV data in clipboard…（从剪贴板中的 CSV 数据导入表…） |
| sqlite.dialogs.import_sql | Import database from SQL file…（从 SQL 文件导入数据库…） |
| sqlite.dialogs.export_csv | Export table(s) as CSV file…（将表导出为 CSV 文件…） |
| sqlite.dialogs.export_json | Export table(s) to JSON…（将表导出为 JSON…） |
| sqlite.dialogs.export_sql | Export database to SQL file…（将数据库导出为 SQL 文件…） |
| sqlite.dialogs.set_null | Set value to NULL（将值设为 NULL） |
| sqlite.tools.compact | Compact database…（压缩数据库…） |
| sqlite.tools.integrity_check | Integrity check（完整性检查） |
| sqlite.tools.quick_check | Quick integrity check（快速完整性检查） |
| sqlite.tools.foreign_key_check | Foreign-key check（外键检查） |
| sqlite.tools.optimize | Optimize database（优化数据库） |
| sqlite.tools.row_counts | Show row counts in a SQL tab（在 SQL 标签页中显示行数） |
| sqlite.tools.load_extension | Load extension…（加载扩展…） |
| sqlite.tools.attach | Attach database…（附加数据库…） |
| sqlite.tools.detach | Detach database…（分离数据库…） |
| sqlite.tools.open_project | Open project…（打开项目…） |
| sqlite.tools.save_project | Save project（保存项目） |
| sqlite.tools.save_project_as | Save project as…（将项目另存为…） |
| sqlite.tools.save_all | Save all（全部保存） |
| sqlite.tools.close_project | Close project（关闭项目） |
| sqlite.tools.save_database_as | Save database as…（将数据库另存为…） |
| sqlite.tools.drop_select | Schema drops: SELECT statement（架构拖放：SELECT 语句） |
| sqlite.tools.drop_insert | Schema drops: INSERT statement（架构拖放：INSERT 语句） |
| sqlite.tools.drop_names | Schema drops: just names（架构拖放：仅名称） |
| sqlite.tools.drop_qualified | Schema drops: qualified names（架构拖放：限定名称） |
| sqlite.tools.drop_quoted | Schema drops: quoted names（架构拖放：带引号的名称） |
| sqlite.tools.recent_1 | Open recent database 1（打开最近使用的数据库 1） |
| sqlite.tools.recent_2 | Open recent database 2（打开最近使用的数据库 2） |
| sqlite.tools.recent_3 | Open recent database 3（打开最近使用的数据库 3） |
| sqlite.tools.recent_4 | Open recent database 4（打开最近使用的数据库 4） |
| sqlite.tools.recent_5 | Open recent database 5（打开最近使用的数据库 5） |
| sqlite.tools.recent_6 | Open recent database 6（打开最近使用的数据库 6） |
| sqlite.tools.recent_7 | Open recent database 7（打开最近使用的数据库 7） |
| sqlite.tools.recent_8 | Open recent database 8（打开最近使用的数据库 8） |
| sqlite.tools.recent_9 | Open recent database 9（打开最近使用的数据库 9） |
| sqlite.tools.recent_flipped_1 | Open recent database 1, read-only inverted（打开最近使用的数据库 1，并反转其只读状态） |
| sqlite.tools.recent_flipped_2 | Open recent database 2, read-only inverted（打开最近使用的数据库 2，并反转其只读状态） |
| sqlite.tools.recent_flipped_3 | Open recent database 3, read-only inverted（打开最近使用的数据库 3，并反转其只读状态） |
| sqlite.tools.recent_flipped_4 | Open recent database 4, read-only inverted（打开最近使用的数据库 4，并反转其只读状态） |
| sqlite.tools.recent_flipped_5 | Open recent database 5, read-only inverted（打开最近使用的数据库 5，并反转其只读状态） |
| sqlite.tools.recent_flipped_6 | Open recent database 6, read-only inverted（打开最近使用的数据库 6，并反转其只读状态） |
| sqlite.tools.recent_flipped_7 | Open recent database 7, read-only inverted（打开最近使用的数据库 7，并反转其只读状态） |
| sqlite.tools.recent_flipped_8 | Open recent database 8, read-only inverted（打开最近使用的数据库 8，并反转其只读状态） |
| sqlite.tools.recent_flipped_9 | Open recent database 9, read-only inverted（打开最近使用的数据库 9，并反转其只读状态） |

### Notebook 块：`notebook.*`

在当前聚焦的笔记本块中运行。

| 操作 | 标签 |
| --- | --- |
| notebook.edit | Edit cell（编辑单元格） |
| notebook.command | Leave cell editor（退出单元格编辑器） |
| notebook.run_select_below | Run cell, select below（运行单元格并选择下方单元格） |
| notebook.run | Run selected cells（运行所选单元格） |
| notebook.run_insert_below | Run cell, insert below（运行单元格并在下方插入单元格） |
| notebook.run_all | Run all cells（运行所有单元格） |
| notebook.run_above | Run cells above（运行上方单元格） |
| notebook.run_below | Run selected cell and below（运行所选单元格及其下方单元格） |
| notebook.insert_above | Insert cell above（在上方插入单元格） |
| notebook.insert_below | Insert cell below（在下方插入单元格） |
| notebook.cut | Cut cells（剪切单元格） |
| notebook.copy | Copy cells（复制单元格） |
| notebook.paste_below | Paste cells below（在下方粘贴单元格） |
| notebook.paste_above | Paste cells above（在上方粘贴单元格） |
| notebook.duplicate | Duplicate cells（复制单元格） |
| notebook.delete | Delete cells（删除单元格） |
| notebook.twice.delete | Delete cells (press twice)（删除单元格（按两次）） |
| notebook.twice.interrupt | Interrupt kernel (press twice)（中断内核（按两次）） |
| notebook.twice.restart | Restart kernel (press twice)（重启内核（按两次）） |
| notebook.undo | Undo cell operation（撤销单元格操作） |
| notebook.redo | Redo cell operation（重做单元格操作） |
| notebook.to_code | Change to code（更改为代码） |
| notebook.to_markdown | Change to markdown（更改为 Markdown） |
| notebook.to_raw | Change to raw（更改为原始格式） |
| notebook.heading.1 | Heading 1（标题 1） |
| notebook.heading.2 | Heading 2（标题 2） |
| notebook.heading.3 | Heading 3（标题 3） |
| notebook.heading.4 | Heading 4（标题 4） |
| notebook.heading.5 | Heading 5（标题 5） |
| notebook.heading.6 | Heading 6（标题 6） |
| notebook.select_above | Select cell above（选择上方单元格） |
| notebook.select_below | Select cell below（选择下方单元格） |
| notebook.extend_above | Extend selection above（向上扩展选区） |
| notebook.extend_below | Extend selection below（向下扩展选区） |
| notebook.select_all | Select all cells（选择所有单元格） |
| notebook.move_up | Move cells up（上移单元格） |
| notebook.move_down | Move cells down（下移单元格） |
| notebook.merge | Merge selected cells（合并所选单元格） |
| notebook.merge_above | Merge cell above（与上方单元格合并） |
| notebook.merge_below | Merge cell below（与下方单元格合并） |
| notebook.split | Split cell（拆分单元格） |
| notebook.collapse_input | Collapse input（折叠输入） |
| notebook.collapse_output | Collapse output（折叠输出） |
| notebook.scroll_output | Scroll output（滚动输出） |
| notebook.line_numbers | Line numbers（显示行号） |
| notebook.all_line_numbers | Line numbers in all cells（在所有单元格中显示行号） |
| notebook.clear_output | Clear cell output（清除单元格输出） |
| notebook.clear_all | Clear all outputs（清除所有输出） |
| notebook.interrupt | Interrupt kernel（中断内核） |
| notebook.restart | Restart kernel…（重启内核…） |
| notebook.restart_clear | Restart kernel and clear outputs…（重启内核并清除输出…） |
| notebook.restart_run_all | Restart kernel and run all…（重启内核并运行所有单元格…） |
| notebook.shutdown | Shut down kernel（关闭内核） |
| notebook.interpreter | Change interpreter…（更改解释器…） |
| notebook.save | Save notebook（保存笔记本） |
| notebook.save_key | Save notebook (command mode)（保存笔记本（命令模式）） |
| notebook.save_as | Save notebook as…（笔记本另存为…） |
| notebook.rename | Rename notebook…（重命名笔记本…） |
| notebook.revert_checkpoint | Revert notebook to checkpoint…（将笔记本还原到检查点…） |
| notebook.reload | Reload notebook from disk（从磁盘重新加载笔记本） |
| notebook.export_python | Export notebook as Python…（将笔记本导出为 Python…） |
| notebook.export_markdown | Export notebook as Markdown…（将笔记本导出为 Markdown…） |
| notebook.export_html | Export notebook as HTML…（将笔记本导出为 HTML…） |
| notebook.scroll_down | Scroll notebook down（向下滚动笔记本） |
| notebook.scroll_up | Scroll notebook up（向上滚动笔记本） |
| notebook.zoom_in | Zoom notebook in（放大笔记本） |
| notebook.zoom_out | Zoom notebook out（缩小笔记本） |
| notebook.zoom_reset | Reset notebook zoom（重置笔记本缩放） |
| notebook.sheet.contents | Table of contents（目录） |
| notebook.sheet.properties | Cell properties（单元格属性） |
| notebook.sheet.variables | Variables（变量） |
| notebook.sheet.help | Contextual help（上下文帮助） |
| notebook.shortcuts | Notebook keyboard shortcuts（笔记本键盘快捷键） |
| notebook.find_replace | Find and replace in notebook（在笔记本中查找和替换） |
| notebook.apply_metadata | Apply metadata（应用元数据） |
| notebook.complete | Complete（补全） |
| notebook.inspect | Show inspection tooltip（显示检查提示） |

### 看板块：`board.*`

在当前聚焦的看板块中运行，文本字段内除外。

| 操作 | 标签 |
| --- | --- |
| board.up | Select card above（选择上方的卡片） |
| board.down | Select card below（选择下方的卡片） |
| board.left | Select card in the previous lane（选择上一泳道中的卡片） |
| board.right | Select card in the next lane（选择下一泳道中的卡片） |
| board.first | Select first card（选择第一张卡片） |
| board.last | Select last card（选择最后一张卡片） |
| board.move_up | Move card up（上移卡片） |
| board.move_down | Move card down（下移卡片） |
| board.move_left | Move card to the previous lane（将卡片移至上一泳道） |
| board.move_right | Move card to the next lane（将卡片移至下一泳道） |
| board.toggle | Mark done or open（标记为已完成或未完成） |
| board.edit | Edit card title（编辑卡片标题） |
| board.new_below | New card below（在下方新建卡片） |
| board.new_above | New card above（在上方新建卡片） |
| board.delete | Delete card（删除卡片） |
| board.undo | Undo board change（撤销看板更改） |
| board.redo | Redo board change（重做看板更改） |
| board.details | Card details（卡片详情） |
| board.filter | Filter cards（筛选卡片） |
| board.switch_view | Switch board/list view（切换看板/列表视图） |
| board.hide_done | Hide done cards（隐藏已完成的卡片） |
| board.clear | Clear selection（清除选区） |
| board.new_lane | New lane（新建泳道） |
| board.rename_lane | Rename lane…（重命名泳道…） |
| board.move_lane_left | Move lane left（将泳道左移） |
| board.move_lane_right | Move lane right（将泳道右移） |
| board.delete_lane | Delete lane（删除泳道） |
| board.done_lane | Done lane（已完成泳道） |
| board.open_markdown | Open as Markdown（作为 Markdown 打开） |

### 画布块：`canvas.*`

画布持有按键焦点时，在当前聚焦的画布块中运行；文本编辑器内除外。仅当有可撤销或重做的操作时，撤销和重做才会生效；仅当有选区时，复制和剪切才会生效。

| 操作 | 标签 |
| --- | --- |
| canvas.tool_select | Select tool（选择工具） |
| canvas.tool_lasso | Lasso tool（套索工具） |
| canvas.tool_hand | Hand tool（抓手工具） |
| canvas.tool_draw | Draw tool（绘图工具） |
| canvas.tool_highlight | Highlighter（荧光笔） |
| canvas.tool_eraser | Eraser（橡皮擦） |
| canvas.tool_laser | Laser pointer（激光笔） |
| canvas.tool_arrow | Arrow（箭头） |
| canvas.tool_line | Line（直线） |
| canvas.tool_rect | Rectangle（矩形） |
| canvas.tool_ellipse | Ellipse（椭圆） |
| canvas.tool_diamond | Diamond（菱形） |
| canvas.tool_triangle | Triangle（三角形） |
| canvas.tool_hexagon | Hexagon（六边形） |
| canvas.tool_parallelogram | Parallelogram（平行四边形） |
| canvas.tool_star | Star（星形） |
| canvas.tool_cylinder | Cylinder（圆柱体） |
| canvas.tool_pill | Pill（药丸形） |
| canvas.tool_bracket | Bracket（方括号） |
| canvas.tool_brace | Brace（大括号） |
| canvas.tool_polygon | Polygon（多边形） |
| canvas.tool_curve | Curve（曲线） |
| canvas.tool_text | Text tool（文本工具） |
| canvas.toggle_tool_lock | Keep tool selected（保持工具选中） |
| canvas.undo | Undo（撤销） |
| canvas.redo | Redo（重做） |
| canvas.cut | Cut（剪切） |
| canvas.copy | Copy（复制） |
| canvas.paste | Paste（粘贴） |
| canvas.delete | Delete（删除） |
| canvas.duplicate | Duplicate（复制） |
| canvas.select_all | Select all（全选） |
| canvas.deselect | Deselect（取消选择） |
| canvas.group | Group（编组） |
| canvas.ungroup | Ungroup（取消编组） |
| canvas.toggle_lock | Lock（锁定） |
| canvas.copy_style | Copy style（复制样式） |
| canvas.paste_style | Paste style（粘贴样式） |
| canvas.bring_to_front | Bring to front（移到最前） |
| canvas.bring_forward | Bring forward（前移一层） |
| canvas.send_backward | Send backward（后移一层） |
| canvas.send_to_back | Send to back（移到最后） |
| canvas.align_left | Align left（左对齐） |
| canvas.align_center | Align centers（中心对齐） |
| canvas.align_right | Align right（右对齐） |
| canvas.align_top | Align top（顶部对齐） |
| canvas.align_middle | Align middles（垂直居中） |
| canvas.align_bottom | Align bottom（底部对齐） |
| canvas.distribute_horizontally | Distribute horizontally（水平分布） |
| canvas.distribute_vertically | Distribute vertically（垂直分布） |
| canvas.flip_horizontally | Flip horizontally（水平翻转） |
| canvas.flip_vertically | Flip vertically（垂直翻转） |
| canvas.edit_text | Edit text（编辑文本） |
| canvas.crop | Crop（裁剪） |
| canvas.reset_crop | Reset crop（重置裁剪） |
| canvas.insert_image | Insert image…（插入图像…） |
| canvas.zoom_in | Zoom in（放大） |
| canvas.zoom_out | Zoom out（缩小） |
| canvas.zoom_to_fit | Zoom to fit（缩放至适合） |
| canvas.zoom_to_selection | Zoom to selection（缩放至选区） |
| canvas.zoom_reset | Zoom to 100%（缩放至 100%） |
| canvas.look_clean | Clean look（简洁外观） |
| canvas.look_mono | Mono look（单色外观） |
| canvas.look_sketch | Hand-drawn look（手绘外观） |
| canvas.paper_dots | Dotted paper（点阵纸） |
| canvas.paper_grid | Grid paper（网格纸） |
| canvas.paper_lines | Lined paper（横线纸） |
| canvas.paper_none | Plain paper（空白纸） |
| canvas.fill_none | No fill（无填充） |
| canvas.fill_semi | Semi fill（半透明填充） |
| canvas.fill_solid | Solid fill（纯色填充） |
| canvas.fill_pattern | Pattern fill（图案填充） |

## 插件操作

窗口插件中 id 为 `say_hi`、属于插件 `hello` 的 [`tern.command`](api-window.md#tern-command) 会成为操作 `plugin.hello.say_hi`。命令面板会在其 `group`（默认值为插件名称）中显示它的 `title`。任何插件都可以用 `tern.bind` 绑定此操作名称，也可以在 `settings.json` 的 `keybinds` 中绑定，或将其指定为状态栏片段的 `command`。它不是内置命令，因此 `tern.override` 和 `cx:command` 会拒绝它。

传给 `tern.bind` 的函数会获得操作名称 `plugin.<plugin>.bind.<n>`，其中 `n` 从 0 开始统计该插件的函数绑定。这就是不允许将 `bind` 用作命令 id 的原因。

只要 `plugin.<a>.<b>` 的两部分都非空，它就能通过解析，无论插件是否存在。按键运行此操作时，Tern 会查找已加载的插件 `<a>` 及其命令 `<b>`（或函数绑定 `<n>`）；如果找不到，就不会运行任何内容。

```lua
tern.command({
	id = "say_hi",
	title = "Say hi",
	run = function(cx)
		cx:toast("info", "hi")
	end,
})
tern.bind("ctrl+alt+shift+h", "plugin." .. tern.plugin.id .. ".say_hi")
```

请参阅[命令、按键和覆盖](../guides/commands.md)了解完整演练。

## 按键组合

`tern.bind` 的按键组合写法与 `settings.json` 中 `keybinds` 的写法相同：

- 用 `+` 连接修饰键 `ctrl`、`alt`（或 `opt`）、`shift`、`cmd`（或 `super`），后接一个按键。
- 按键可以是键盘布局输入的字符（`ctrl+shift+2`、`cmd+plus`）、命名按键、`f1`–`f20`，或物理按键（`cmd+digit_1`、`ctrl+key_a`、`alt+bracket_left`）。
- 序列使用 `>` 连接按键组合：`ctrl+a>c` 表示先按 ⌃A，再按 C。最后一个组合之前的组合均为前缀。
- 单独的修饰键（`cmd`、`shift`、…）表示轻按该键：按下后立即松开，期间不按其他键。轻按只能组成轻按序列，每次轻按必须在前一次后的半秒内：`shift>shift` 表示连续按两次 Shift（Tern 将 `cmd>cmd`，即连续按两次 ⌘，绑定到 `carly`）。按下任何其他键或点击都会结束该序列。
- 在 Windows 和 Linux 上（以及启用了 `swap_ctrl_cmd` 的 macOS 上），`ctrl` 表示 Ctrl 键，`cmd`/`super` 表示 Windows 键或 Super 键。

插件绑定的优先级高于 Tern 默认设置和键盘预设，但低于用户的 `keybinds`。插件只能添加按键：如果某个绑定使用了默认设置或预设已绑定的按键，或者与其中某个序列有前缀关系，则会被忽略。

## 错误

| 调用 | 错误输入 | 结果 |
| --- | --- | --- |
| `tern.override(id, fn)` | `id` 不是命令 id | 引发 ``tern.override: unknown command `<id>` `` |
| `cx:command(id)` | `id` 不是命令 id | 引发 ``unknown command `<id>` `` |
| `tern.command(def)` | `id` 不是字母、数字、`_`、`-`，或为 `bind` | 引发 ``tern.command: bad id `<id>` (letters, digits, `_` and `-`; not `bind`)`` |
| `tern.bind(chord, action)` | `action` 既不是字符串也不是函数 | 引发 `tern.bind: the action is a name or a function` |
| `tern.bind(chord, action)` | 无法解析的按键组合或操作名称 | 调用时不报错。重建按键映射时会忽略该绑定，并在日志中记录警告 `plugin bind left out` 及解析错误（对于名称，错误为 ``unknown action `<name>` ``） |
| `tern.bind(chord, action)` | 默认设置或预设已绑定的按键 | 忽略；日志警告为 `plugin bind left out: the preset binds these keys` |

`tern.bind` 不会检查 `plugin.*` 操作是否存在；未知操作仍可通过解析，但按下时不会执行任何操作。
