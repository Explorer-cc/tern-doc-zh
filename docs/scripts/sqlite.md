# SQLite 块

`sqlite` 用于打开数据库并操作其 Structure、Browse、Execute 和 Pragmas 区域、单元格与绘图面板，以及数据库对话框和工具。使用它可以复现数据库工作流、检查查询结果，或在不通过窗口点击操作的情况下捕获 SQLite 块。

## 数据库和视图

| 命令 | 功能 |
| --- | --- |
| `sqlite fixture <name> [ro]` | 从已提交到仓库的 SQL 测试夹具创建全新数据库，并在当前聚焦窗格旁打开。 |
| `sqlite open <path> [ro]` | 打开数据库或项目文件。 |
| `sqlite new <path>` | 在当前聚焦窗格旁创建数据库，并替换该路径上已有的文件。 |
| `sqlite memory` | 打开内存数据库。 |
| `sqlite area structure\|browse\|execute\|pragmas` | 显示指定区域。 |
| `sqlite sheet cell\|plot\|schema\|off` | 显示侧边面板，或将其关闭。 |
| `sqlite log on\|off` | 显示或隐藏 SQL Log。 |
| `sqlite write` | 写入待处理的数据库更改。 |
| `sqlite revert` | 撤销待处理更改前先询问确认。 |
| `sqlite undo` | 撤销最近一次可撤销的数据库操作。 |
| `sqlite exec <sql>` | 在可撤销的保存点中运行 SQL 语句。 |
| `sqlite close` | 通过关闭保护关闭当前聚焦的 SQLite 块。 |

除了四个打开命令外，其余命令都需要有聚焦的 SQLite 块；否则会以 `no SQLite block has focus` 失败。`exec` 需要可写数据库。数据库错误可能显示在块中，而不是作为失败的命令回复：打开数据库或运行 SQL 后请检查其状态。

`ro` 以只读方式打开。测试夹具来自 `crates/tern/goldens/fixtures/sqlite/<name>.sql`；每次调用都会用全新副本替换临时数据库。`new` 也会替换已有文件：请使用可丢弃的路径。还原和关闭有未保存更改的块时可能会询问确认；请使用测试框架的 `dialog button <n>` 命令作答。

SQLite 命令会实时等待窗口中的**每个 SQLite 块**完成打开且没有待处理任务，然后将应用时间推进 300 ms 以进行绘制。共享的 20 秒超时会在任务始终未完成时使命令失败。确认对话框不算尚未完成的数据库任务，因此脚本下一行可以回答它。这些命令并非仅限无头模式；脚本运行器在原生构建中可用，浏览器构建中不可用。打开默认应用或系统文件选择器需要相应的系统集成；无头运行只会记录这些请求。

`tern ctl state` 将 SQLite 状态存储在 `sqlite_blocks` 中：其 `blocks[]` 包含 `id`、`name`、`path`、`memory`、`project`、`phase`、`dirty`、`can_undo`、`read_only`、`busy`、`area`、`sheet`、`log`、`schema_seq` 和 `data_seq`。`sqlite_blocks.recent` 列出最近使用的路径及其只读标记；`sqlite_blocks.asking` 统计待处理的数据库问题。下文的 `block` 指 `sqlite_blocks.blocks[]` 中的一个条目。

## 结构（Structure）

| 命令 | 功能 |
| --- | --- |
| `sqlite structure [sheet] open <name>` | 在 Structure 区域展开一个数据库模式或对象。 |
| `sqlite structure [sheet] fold <name>` | 在 Structure 区域折叠一个数据库模式或对象。 |
| `sqlite structure [sheet] select <name>[/<field>]` | 选择一个列表行。 |
| `sqlite structure [sheet] pick <name>[/<field>]` | 切换某行是否属于选中项。 |
| `sqlite structure [sheet] menu` | 打开当前行的上下文菜单。 |
| `sqlite structure [sheet] browse` | 浏览选中的表或视图。 |
| `sqlite structure [sheet] modify` | 打开选中对象的编辑器。 |
| `sqlite structure [sheet] delete` | 通过确认流程删除选中的对象。 |
| `sqlite structure [sheet] copy-create` | 复制选中对象的 CREATE SQL。 |
| `sqlite structure [sheet] copy-name` | 复制选中的名称。 |
| `sqlite structure [sheet] copy-drop` | 使用当前拖放选项复制文本。 |
| `sqlite structure [sheet] refresh` | 重新加载数据库模式。 |
| `sqlite structure [sheet] counts` | 切换行数显示。 |
| `sqlite structure [sheet] unfold-all` | 展开整个列表。 |
| `sqlite structure [sheet] fold-all` | 折叠整个列表。 |
| `sqlite structure [sheet] menu-key` | 执行列表的键盘菜单操作。 |
| `sqlite structure [sheet] drop-sql <sql>` | 运行拖放到 Structure 区域的 SQL 文本。 |

将 `sheet` 放在操作**之前** 可将目标设为 Schema 面板。解析器也接受在 `open`、`fold` 和 `drop-sql` 之前使用它，但这三项仍作用于 Structure 区域。可以使用裸对象名称或带数据库模式限定的名称。字段行必须已显示：先展开其对象。缺少行、`menu` 时没有选中项，或操作不可用，都会使命令失败。`pick` 会切换成员关系，而不是始终添加。

检查 `block.structure.area` 和 `.sheet` 中的 `open`、`shut`、`selected`、`picked` 和 `rows`。`.objects` 列出数据库模式对象，`.counts` 包含计数状态和行数，`.tools` 保存工具状态。

## 浏览（Browse）

| 命令 | 功能 |
| --- | --- |
| `sqlite browse table <name>` | 显示一个表或视图。 |
| `sqlite browse select <row>:<column> [<row>:<column>]` | 选择单元格或矩形区域。 |
| `sqlite browse rows <first> <last>` | 选择包含首尾行的整条记录范围。 |
| `sqlite browse edit <row>:<column> [<text>]` | 打开行内编辑器，可选地使用替换文本。 |
| `sqlite browse commit` | 提交打开的行内编辑器。 |
| `sqlite browse set <row>:<column> [<text>]` | 直接写入单元格；省略文本时使用空文本。 |
| `sqlite browse key <id>` | 执行 Browse 键盘操作。 |
| `sqlite browse copy [headers\|sql]` | 复制选区，默认为纯文本。 |
| `sqlite browse paste [<text>]` | 将以制表符/换行符分隔的文本粘贴到网格。 |
| `sqlite browse find <text> [case] [whole] [regex]` | 打开查找并搜索。 |
| `sqlite browse replace <replacement> [all]` | 替换当前匹配项，或替换当前查找搜索中的所有匹配项。 |
| `sqlite browse menu <row>:<column>` | 选择单元格并打开其上下文菜单。 |
| `sqlite browse menu row <n>` | 选择一条记录并打开其标题菜单。 |
| `sqlite browse tab new\|close\|<n>` | 创建、关闭或选择一个 Data Browser 标签页。 |
| `sqlite browse goto <n>` | 滚动到一条记录。 |
| `sqlite browse jump <row>:<column>` | 跟随单元格的外键链接。 |

行、数字列和 Browse 标签页均从 1 开始；行或标签页为 `0` 时按 `1` 处理。列可以是列名、从 1 开始的数据列编号，或表示首列的 `rowid`。表名可以带数据库模式限定。`edit`、`set` 和 `paste` 中的文本接受 `\t` 和 `\n`。查找文本含空格时请加引号；标志的顺序不限。`replace` 只接受替换文本，不能另带搜索词。表缺失、列缺失、操作 ID 未知，或复制空选区，都会使命令失败。

以下每个操作 ID 都可在 `sqlite browse key` 后使用：

| 命令 | 功能 |
| --- | --- |
| `refresh` | 重新读取行。 |
| `previous_table`, `next_table` | 浏览上一个或下一个表，到末尾后循环。 |
| `new_tab`, `rename_tab`, `close_tab` | 创建 Data Browser 标签页、请求输入新名称，或关闭标签页。 |
| `new_record` | 使用默认值插入一条记录。 |
| `insert_values` | 打开 Add Record。 |
| `delete_records`, `duplicate_record` | 删除或复制选中的记录。 |
| `copy_above` | 使用上方单元格的值开始编辑。 |
| `set_null`, `clear_cells` | 将选中单元格设为 NULL，或清空其内容。 |
| `delete` | 删除选中的整条记录；否则清空选中的单元格。 |
| `cut`, `copy_headers`, `copy_sql` | 剪切或复制选区。 |
| `select_all` | 加载并选择每个单元格。 |
| `edit_cell` | 在单元格面板中打开当前单元格。 |
| `find`, `replace` | 打开查找或查找与替换。 |
| `find_next`, `find_previous` | 在匹配项之间移动。 |
| `replace_next`, `replace_all` | 使用查找栏替换一个或所有匹配项。 |
| `adjust_rows` | 切换较高且自动换行的行。 |
| `first_page`, `previous_page`, `next_page`, `last_page` | 翻页。 |
| `goto_row` | 请求输入记录编号。 |

下一张表中的列操作 ID 也可在 `key` 后使用。列设置、筛选器和格式属于 Browse，不是单独的命令前缀：

| 命令 | 功能 |
| --- | --- |
| `sqlite browse filter <column> [<text>]` | 设置或清除列筛选器。 |
| `sqlite browse global [<text>]` | 设置或清除全局筛选器。 |
| `sqlite browse sort <column> [add]` | 循环切换列排序；`add` 会保留其他排序列。 |
| `sqlite browse hide <column>` | 隐藏一列。 |
| `sqlite browse show-all` | 显示所有隐藏列。 |
| `sqlite browse rowid [on\|off]` | 显示 rowid 列；使用 `off` 隐藏。 |
| `sqlite browse freeze <column>\|off` | 冻结到指定列，或取消冻结。 |
| `sqlite browse width <column> <px>` | 设置列宽，单位为像素。 |
| `sqlite browse format <column> [<preset-or-expression>]` | 设置显示预设，或打开自定义表达式编辑器并检查表达式。 |
| `sqlite browse format-dialog <column>` | 打开显示格式对话框。 |
| `sqlite browse condformat <column> [<filter>]` | 根据筛选器添加条件格式。 |
| `sqlite browse condformats <column>` | 打开条件格式管理器。 |
| `sqlite browse condformats-add` | 在管理器中按 Add。 |
| `sqlite browse condformats-save` | 保存管理器中的更改。 |
| `sqlite browse fmt bold\|italic\|underline\|left\|center\|right\|justify\|clear` | 更改选区的格式。 |
| `sqlite browse fmt fg\|bg [<hex>]` | 设置前景色或背景色。 |
| `sqlite browse fmt font [<name>]` | 设置格式字体。 |
| `sqlite browse fmt size <n>` | 设置格式字体大小。 |
| `sqlite browse select-col <column>` | 选择整列。 |
| `sqlite browse findcol [<text>]` | 打开列搜索并查找列名。 |
| `sqlite browse findcol-next`, `sqlite browse findcol-prev` | 在匹配列之间移动。 |
| `sqlite browse unlock [<column>[,<column>...]]` | 为视图编辑检查伪主键；空列表会锁定视图。 |
| `sqlite browse lock` | 锁定视图编辑。 |
| `sqlite browse encoding [all] [<name>]` | 设置此表或所有表的文本编码。 |
| `sqlite browse saveview [<name>]` | 将筛选并排序后的查询保存为视图。 |
| `sqlite browse header-menu <column>` | 打开列标题菜单。 |
| `sqlite browse filter-menu <column>` | 打开筛选字段的菜单。 |
| `sqlite browse filter-help` | 打开筛选语法帮助。 |

`width` 接受 0 到 65535 之间的无符号整数。`rowid` 默认为 on；只有 `off` 会将其隐藏。`format ... default` 会删除已存储的显示格式。预设键区分大小写：`decimal`、`exponent`、`hexblob`、`hex`、`octal`、`round`、`appleDate`、`javaEpoch`、`dotNetTicks`、`julian`、`epoch`、`epochLocalTime`、`webkitEpoch`、`webkitEpochLocalTime`、`winDate`、`ddmmyyyyDate`、`lower`、`upper`、`guid`、`geomToSVG` 和 `json`。其他文本按自定义表达式处理。显示格式要求数据列，不能用于 `rowid`。

这些列操作 ID 也可直接作为 `sqlite browse <id>`（不带参数）运行，或通过 `sqlite browse key <id>` 运行：

| 命令 | 功能 |
| --- | --- |
| `clear_filters`, `clear_sorting` | 清除筛选器或排序顺序。 |
| `focus_filter`, `global_filter` | 聚焦当前列筛选器或全局筛选器。 |
| `find_column` | 打开列搜索。 |
| `show_rowid`, `freeze_columns` | 切换 rowid 可见性，或冻结到当前列。 |
| `hide_columns`, `show_all_columns` | 隐藏选中列或显示所有列。 |
| `select_column` | 选择当前列。 |
| `unlock_view` | 打开伪键提示，或锁定已解锁的视图。 |
| `display_format`, `cond_formats` | 打开当前列的格式对话框。 |
| `encoding_all` | 请求为所有表指定编码。 |
| `copy_column_name` | 复制当前列名。 |
| `format_toolbar` | 切换格式工具栏。 |
| `bold`, `italic`, `underline` | 切换选区的文本样式。 |
| `align_left`, `align_center`, `align_right`, `align_justify` | 设置选区对齐方式。 |
| `clear_format` | 清除选区格式。 |
| `save_as_view` | 请求输入视图名称。 |
| `export_csv`, `export_json` | 打开筛选并排序后行的导出功能。 |
| `sqlite browse key encoding` | 请求指定此表的编码；直接使用 `encoding` 是上面的设置命令。 |

当前不可用的直接列操作会以 `can't run now` 失败；编辑仍遵循网格的只读和选区规则。检查 `block.browse` 中的 `tabs`、`current`、`table`、`sql`、`count`、`loaded`、`selection`、`cell`、`editing`、`find` 和 `error`。`.columns` 包含 `filters`、`global`、`where`、`sort`、`hidden`、`frozen`、`show_rowid`、`widths`、`display_formats`、`cond_formats`、`row_id_formats`、`encoding`、`pseudo_pk`、`editable`、`toolbar`、`find_column`、`dialog` 和 `cond_editor`。

```text
ready
sqlite fixture sample
sqlite area browse
sqlite browse table tracks
sqlite browse filter milliseconds 200000~400000
sqlite browse filter name e
sqlite browse global o
sqlite browse sort price
sqlite browse sort name add
sqlite browse freeze name
sqlite browse condformat price >1
sqlite browse select 2:5
shot sqlite-browse-filters
```

## 执行（Execute）

| 命令 | 功能 |
| --- | --- |
| `sqlite execute new [<title>]` | 创建 SQL 标签页。 |
| `sqlite execute text [<text>]` | 替换当前标签页的 SQL，并将插入光标留在末尾。 |
| `sqlite execute type <text>` | 在插入光标处输入文本，像键入时一样触发补全。 |
| `sqlite execute caret <n>` | 将插入光标放在字节偏移处。 |
| `sqlite execute select <from> <to>` | 选择一个字节范围。 |
| `sqlite execute run` | 执行全部 SQL 或选区内容。 |
| `sqlite execute line` | 执行插入光标所在行的语句。 |
| `sqlite execute stop` | 停止执行。 |
| `sqlite execute tab <n>` | 选择 SQL 标签页。 |
| `sqlite execute close` | 关闭当前标签页，必要时会询问确认。 |
| `sqlite execute rename <title>` | 重命名当前标签页。 |
| `sqlite execute duplicate` | 复制当前标签页。 |
| `sqlite execute move <from> <to>` | 重新排列 SQL 标签页。 |
| `sqlite execute complete` | 在插入光标处打开补全。 |
| `sqlite execute accept` | 插入选中的补全项。 |
| `sqlite execute pick <n>` | 选择一行补全项。 |
| `sqlite execute open <path>` | 将 SQL 文件打开到标签页中。 |
| `sqlite execute save <path>` | 将当前标签页的 SQL 保存到文件。 |
| `sqlite execute view <name>` | 将结果查询保存为视图。 |
| `sqlite execute cell <row> <column>` | 选择结果单元格。 |
| `sqlite execute copy [plain\|headers\|sql]` | 复制选中的结果，默认为纯文本。 |
| `sqlite execute tiling on\|off` | 将结果放在编辑器旁边或下方。 |
| `sqlite execute zoom in\|out\|reset` | 更改编辑器缩放。 |
| `sqlite execute focus editor\|results` | 移动键盘焦点。 |
| `sqlite execute chord <id>` | 执行 Execute 键盘操作。 |
| `sqlite execute log-source user\|app\|error` | 选择 SQL Log 的来源。 |
| `sqlite execute log-find <query>` | 搜索已打开的 SQL Log。 |

与 Browse 不同，标签页、补全行、结果行和结果列均从 **0** 开始。插入光标和选区偏移按字节计数。`text` 和 `type` 接受 `\n` 和 `\t`。所有 Execute 命令都需要打开的数据库；需要当前 SQL 标签页的命令在没有此标签页时会失败。标签页未知、未选择结果却尝试复制，或搜索已关闭的 SQL Log，也都会失败。查询失败会显示在标签页的消息和诊断信息中。与其他 SQLite 命令一样，执行会等待任务完成；如果前一条 `run` 仍在等待，后续顺序执行的 `stop` 行无法中断它。

| 命令 | 功能 |
| --- | --- |
| `execute`, `execute_line`, `stop` | 运行全部/选中的 SQL、运行当前行，或停止。 |
| `new_tab`, `open_file` | 创建标签页或请求选择 SQL 文件。 |
| `save_file`, `save_file_as` | 保存 SQL，必要时请求路径。 |
| `close_tab`, `rename_tab`, `duplicate_tab` | 关闭、请求重命名或复制标签页。 |
| `next_tab`, `previous_tab` | 切换当前 SQL 标签页。 |
| `focus_editor`, `focus_results` | 移动焦点。 |
| `complete` | 打开补全。 |
| `zoom_in`, `zoom_out`, `zoom_reset` | 更改编辑器缩放。 |
| `copy_with_headers`, `copy_as_sql` | 复制选中的结果。 |
| `export_csv`, `export_json` | 打开结果导出。 |
| `save_as_view` | 请求输入视图名称。 |
| `toggle_tiling` | 切换结果是否放在编辑器旁边。 |

检查 `block.execute.tabs[]` 中的 SQL 文本、文件、修改状态、插入光标、消息、错误、结果和诊断信息；`.current`、`.running`、`.zoom`、`.completion` 和 `.log` 描述该区域的其余状态。`block.log` 报告日志是否打开。平铺是已保存的偏好设置，不是专用状态字段。

```text
ready
sqlite fixture sample
sqlite area execute
sqlite execute text SELECT a.title, ar.name AS artist, a.released\nFROM albums a\nJOIN artists ar ON ar.id = a.artist_id\nORDER BY a.released;
sqlite execute run
sqlite execute cell 0 0
sqlite execute tiling on
sqlite log on
shot sqlite-execute-tiled
sqlite execute log-find albums
shot sqlite-execute-log-find
```

## 数据库设置（Pragmas）

| 命令 | 功能 |
| --- | --- |
| `sqlite pragmas set <name> <value>` | 在表单中编辑 pragma。 |
| `sqlite pragmas save` | 应用编辑后的 pragma 值。 |
| `sqlite pragmas reset` | 丢弃表单编辑。 |
| `sqlite pragmas refresh` | 重新读取 pragma 值。 |

`set` 要求数据库可写，且名称必须是表单提供的选项：`page_size`、`auto_vacuum`、`max_page_count`、`temp_store`、`secure_delete`、`journal_mode`、`journal_size_limit`、`wal_autocheckpoint`、`synchronous`、`locking_mode`、`fullfsync`、`checkpoint_fullfsync`、`foreign_keys`、`recursive_triggers`、`ignore_check_constraints`、`case_sensitive_like`、`automatic_index` 或 `user_version`。

选项值可使用存储值或显示标签，且不区分大小写：

- `auto_vacuum`：`0`/`None`、`1`/`Full`、`2`/`Incremental`。
- `journal_mode`：`Delete`、`Truncate`、`Persist`、`Memory`、`WAL`、`Off`。
- `locking_mode`：`Normal`、`Exclusive`。
- `page_size`：`512`、`1024`、`2048`、`4096`、`8192`、`16384`、`32768`、`65536`，或其标签（`512 bytes`、`1 KiB` 至 `64 KiB`）。
- `synchronous`：`0`/`Off`、`1`/`Normal`、`2`/`Full`、`3`/`Extra`。
- `temp_store`：`0`/`Default`、`1`/`File`、`2`/`Memory`。

复选框值只有在文本恰好为 `1`、`on` 或 `true` 时才表示开启；其他任何值均表示关闭。数字表单值会传给表单进行验证。`fullfsync` 和 `checkpoint_fullfsync` 会影响 macOS 同步。检查 `block.pragmas.values`、`.edits`、`.read`、`.reading` 和 `.error`。

## 单元格

| 命令 | 功能 |
| --- | --- |
| `sqlite cell load <table> <rowid> <column>` | 从 `main` 中的表加载单元格，并打开 Edit Cell 面板。 |
| `sqlite cell mode text\|rtl\|binary\|image\|json\|xml\|svg\|evaluation` | 更改编辑器模式。 |
| `sqlite cell type [<text>]` | 替换文本编辑器的内容。 |
| `sqlite cell hex-goto <offset>` | 移动十六进制插入光标；接受十进制和 `0x` 十六进制。 |
| `sqlite cell hex-type <digits>` | 在二进制编辑器中输入十六进制数字。 |
| `sqlite cell apply` | 应用缓冲值。 |
| `sqlite cell null` | 将缓冲值设为 NULL。 |
| `sqlite cell discard` | 丢弃缓冲编辑。 |
| `sqlite cell import <path>` | 将文件内容导入缓冲区。 |
| `sqlite cell import-ref <path>` | 导入文件引用。 |
| `sqlite cell export <path>` | 导出单元格内容。 |
| `sqlite cell export-dump <path>` | 导出十六进制/ASCII 转储。 |
| `sqlite cell external` | 写入临时文件、打开其默认应用并监视更改。 |
| `sqlite cell external-apply` | 读取外部文件内容、应用并移除该文件。 |
| `sqlite cell external-cancel` | 停止监视并移除临时文件。 |
| `sqlite cell open-default` | 在默认应用中打开值对应的 URL 或现有文件。 |
| `sqlite cell copy-hex` | 复制十六进制/ASCII 表示。 |
| `sqlite cell auto-switch on\|off` | 设置自动模式选择。 |
| `sqlite cell wrap on\|off` | 设置编辑器自动换行。 |
| `sqlite cell format on\|off` | 设置结构化文本格式化。 |
| `sqlite cell sort-keys on\|off` | 设置 JSON 键排序。 |
| `sqlite cell overwrite on\|off` | 设置二进制覆盖模式。 |

除 `load` 外，每个命令都需要已加载单元格。rowid 是数据库中的实际有符号 rowid，而不是 Browse 中显示的行号。`type` 需要可编辑的文本模式；`hex-type` 需要可编辑的二进制模式。应用时可能会询问如何处理无效结构化文本或待处理编辑；请使用 `dialog button <n>` 回答随后出现的系统对话框。外部文件更改每经过一秒应用时间检查一次；`external` 不会等待另一个应用完成编辑。未监视文件时，`external-apply` 和 `external-cancel` 不会执行任何操作。

检查 `block.cell.cell` 中的来源、表、行、列、键和值类别；`.mode`、`.read_only`、`.why`、`.modified`、`.null`、`.text`、`.invalid`、`.diagnostics`、`.hex`、`.overwrite`、`.evaluating`、`.external` 和 `.asking` 描述编辑器状态。状态文本最多 4000 个字符。四项编辑器偏好设置没有专用状态字段。

## 绘图

| 命令 | 功能 |
| --- | --- |
| `sqlite plot x <column>` | 设置 X 列；`Row #` 使用行号。 |
| `sqlite plot y1\|y2 <column>` | 在左侧或右侧 Y 轴上切换某列。 |
| `sqlite plot color y1\|y2 <hex> <column>` | 设置数据系列颜色。 |
| `sqlite plot line <style>` | 设置线条样式。 |
| `sqlite plot point <shape>` | 设置点形状。 |
| `sqlite plot legend on\|off` | 设置图例可见性。 |
| `sqlite plot stacked on\|off` | 设置堆叠柱状图。 |
| `sqlite plot fixed on\|off` | 设置固定数字格式。 |
| `sqlite plot log-x on\|off` | 设置 X 轴对数刻度。 |
| `sqlite plot log-y on\|off` | 设置 Y 轴对数刻度。 |
| `sqlite plot load-all` | 加载所有源行用于绘图。 |
| `sqlite plot hover <row>` | 显示源行中第一个有限值数据点的读数。 |
| `sqlite plot pick <row>` | 在网格中选择该数据点对应的源行。 |
| `sqlite plot zoom <percent>` | 缩放当前范围；低于 100 时放大。 |
| `sqlite plot reset` | 重置绘图缩放。 |
| `sqlite plot save <path>` | 写入图像，并根据扩展名选择格式。 |
| `sqlite plot copy` | 复制绘图图像。 |

选择 Browse 表或 Execute 结果后，使用 `sqlite sheet plot` 打开绘图。列名必须已存在于绘图中。`hover` 和 `pick` 的源行号从 **0** 开始；没有已绘制有限值数据点的行会导致失败。`zoom` 需要正整数百分比。无效颜色、样式和形状会在解析期间失败。

样式（不区分大小写）：`None`、`Line`、`StepLeft`、`StepRight`、`StepCenter`、`Impulse`。形状（不区分大小写）：`None`、`Cross`、`Plus`、`Circle`、`Disc`、`Square`、`Diamond`、`Star`、`Triangle`、`TriangleInverted`、`CrossSquare`、`PlusSquare`、`CrossCircle`、`PlusCircle`、`Peace`。`Dot` 不是可选脚本形状。除非偏好设置覆盖默认值，默认样式为 Line，标记为 Disc。保存支持 PNG、BMP、JPG/JPEG、SVG 和 PDF；扩展名未知或缺失时会追加 `.png`。

检查 `block.plot.source`、`.columns`、`.x`、`.y1`、`.y2`、`.options`、`.rows`、`.loaded`、`.total`、`.bars`、`.sorted`、`.x_type`、`.drawn`、`.x_ticks`、`.zoomed`、`.selected`、`.line`、`.point` 和 `.hover`。

## 对话框

| 命令 | 功能 |
| --- | --- |
| `sqlite dialogs create-table` | 打开 Create Table。 |
| `sqlite dialogs edit-table <name>` | 打开 Edit Table。 |
| `sqlite dialogs create-index [<table>]` | 打开 Create Index，可选地指定表。 |
| `sqlite dialogs edit-index <name>` | 打开 Edit Index。 |
| `sqlite dialogs add-record <table>` | 打开 Add Record。 |
| `sqlite dialogs import-csv <path>...` | 打开 CSV 导入，可指定一个或多个文件。 |
| `sqlite dialogs import-csv-text <text>` | 打开 CSV 导入，以剪贴板风格文本为输入。 |
| `sqlite dialogs import-sql <path> [new <database-path>]` | 将 SQL 文件导入此数据库或新数据库。 |
| `sqlite dialogs export-csv [<table>...]` | 打开 CSV 导出。 |
| `sqlite dialogs export-json [<table>...]` | 打开 JSON 导出。 |
| `sqlite dialogs export-query csv\|json <sql>` | 打开 SQL 查询的导出功能。 |
| `sqlite dialogs export-sql [<table>...]` | 打开 SQL 导出。 |
| `sqlite dialogs accept [<path>]` | 按下打开对话框的主要操作；导出时可提供目标路径而无需询问。 |
| `sqlite dialogs cancel` | 关闭打开的对话框。 |

`sqlite dialogs` 后的其他单词会传给当前打开的对话框。以下各表都使用相同前缀；它们并非嵌套在 `edit-table`、`import-csv` 等命令下。对话框不匹配、对象缺失、行号越界或缺少对话框都会导致失败。对话框行号从 1 开始，且必须对应已存在的行。此区域的布尔参数接受 `on|yes|true` 或 `off|no|false`。

路径、名称、CSV 文本和含空格的 SQL 都应加引号；打开命令将每个参数作为单个参数处理。省略导出表列表时会打开选择器，而不是要求脚本提供列表。验证或数据库错误可能导致 accept 后对话框仍保持打开；导入操作可能会询问如何处理已有表。继续之前请检查对话框。

### 创建和编辑表

| 命令 | 功能 |
| --- | --- |
| `sqlite dialogs name [<name>]` | 设置表名。 |
| `sqlite dialogs schema <name>` | 选择可用的数据库模式。 |
| `sqlite dialogs without-rowid on\|off` | 设置 WITHOUT ROWID。 |
| `sqlite dialogs strict on\|off` | 设置 STRICT 模式。 |
| `sqlite dialogs conflict none\|rollback\|abort\|fail\|ignore\|replace` | 设置主键冲突操作。 |
| `sqlite dialogs tab fields\|constraints` | 显示字段或表约束。 |
| `sqlite dialogs add-field` | 添加字段。 |
| `sqlite dialogs remove-field <n>` | 移除字段。 |
| `sqlite dialogs move-field <n> up\|down\|top\|bottom` | 重新排列字段。 |
| `sqlite dialogs select <n>` | 选择字段行。 |
| `sqlite dialogs field <n> name\|type\|default\|check\|collation [<text>]` | 编辑字段属性。 |
| `sqlite dialogs field <n> nn\|pk\|ai\|unique on\|off` | 设置非空、主键、自增或唯一约束。 |
| `sqlite dialogs field <n> fk [none\|<table> [<column> [<clauses>...]]]` | 清除或设置内联外键目标。 |
| `sqlite dialogs add-pk` | 添加主键约束。 |
| `sqlite dialogs add-unique` | 添加唯一约束。 |
| `sqlite dialogs add-fk` | 添加外键约束。 |
| `sqlite dialogs add-check` | 添加 CHECK 约束。 |
| `sqlite dialogs key <n> columns <column>[,<column>...]` | 设置键的列。 |
| `sqlite dialogs key <n> kind pk\|unique` | 更改键的类型；除 `pk` 外，任何词都会选择 unique。 |
| `sqlite dialogs key\|fk\|check <n> name [<text>]` | 为约束命名。 |
| `sqlite dialogs fk <n> columns <column>[,<column>...]` | 设置外键源列。 |
| `sqlite dialogs fk <n> references [none\|<table> [<column> [<clauses>...]]]` | 清除或设置外键目标。 |
| `sqlite dialogs check <n> expr [<expression>]` | 设置 CHECK 表达式。 |
| `sqlite dialogs remove-key\|remove-fk\|remove-check <n>` | 移除此类型的约束。 |
| `sqlite dialogs popover key\|fk-columns\|fk\|field-fk <n>` | 在已显示的行上打开列或外键选择器。 |
| `sqlite dialogs columns <column>[,<column>...]` | 在打开的列选择器中应用列。 |

键、外键和检查约束分别编号。空列列表参数会清空列表。省略外键目标即会清除它。目标列之后可使用 `ON DELETE CASCADE` 等子句。选择器行必须显示在当前标签页上。只有 `constraints` 会选择约束标签页；其他单词都会选择字段。重复字段、无效主键排列，以及对被引用列进行禁止的更改，可能立即失败；无效的表定义也会在接受时报告。

### 创建和编辑索引

| 命令 | 功能 |
| --- | --- |
| `sqlite dialogs name [<name>]` | 设置索引名称。 |
| `sqlite dialogs table [<name>]` | 选择一个可选表。 |
| `sqlite dialogs unique on\|off` | 设置唯一性。 |
| `sqlite dialogs where [<expression>]` | 设置或清除部分索引条件。 |
| `sqlite dialogs add <column>` | 添加可用的表列。 |
| `sqlite dialogs add-expr [<expression>]` | 添加表达式行。 |
| `sqlite dialogs remove <n>` | 移除索引行。 |
| `sqlite dialogs order <n> asc\|desc\|none` | 设置或清除行的排序顺序；空字符串也会清除它。 |
| `sqlite dialogs expr <n> [<expression>]` | 编辑表达式行。 |
| `sqlite dialogs up\|down <n>` | 重新排列行。 |

表名和列名匹配不区分大小写。对普通列行使用 `expr` 会失败。要接受更改，必须提供有效的名称、表和索引内容。

### 添加记录

| 命令 | 功能 |
| --- | --- |
| `sqlite dialogs value <n> [<text>]` | 设置列值；空文本会恢复默认值。 |
| `sqlite dialogs null <n>` | 将列设为 NULL。 |
| `sqlite dialogs empty <n>` | 设置显式空字符串。 |
| `sqlite dialogs default <n>` | 恢复列的默认值。 |
| `sqlite dialogs restore` | 恢复所有默认值。 |

不能为生成列赋值。约束失败时，对话框会保持打开，以便修正值后再次接受。

### 导入 CSV

| 命令 | 功能 |
| --- | --- |
| `sqlite dialogs header\|trim\|separate\|no-types\|local\|fail-missing\|ignore-defaults\|sanitize on\|off` | 设置对应的导入选项。 |
| `sqlite dialogs advanced on\|off` | 显示或隐藏高级选项。 |
| `sqlite dialogs separator comma\|semicolon\|tab\|pipe\|<character>` | 设置字段分隔符。 |
| `sqlite dialogs separator other <character>` | 使用自定义分隔符。 |
| `sqlite dialogs separator code <n>` | 使用字符码；0 表示没有分隔符。 |
| `sqlite dialogs quote double\|single\|none\|<character>` | 设置引号字符。 |
| `sqlite dialogs quote other <character>` | 使用自定义引号字符。 |
| `sqlite dialogs quote code <n>` | 使用字符码；0 表示无引号字符。 |
| `sqlite dialogs encoding <name>` | 选择 UTF-8、UTF-16、ISO-8859-1 或其他指定编码。 |
| `sqlite dialogs conflict abort\|ignore\|replace` | 设置冲突记录的处理方式。 |
| `sqlite dialogs table <name>` | 设置目标名称，或在单独表模式下设置当前文件名称。 |
| `sqlite dialogs file <n>` | 选择用于预览的文件。 |
| `sqlite dialogs file <n> table <name>` | 设置一个文件的目标表。 |
| `sqlite dialogs file <n> on\|off` | 包含或排除一个文件。 |
| `sqlite dialogs all on\|off` | 包含或排除所有文件。 |
| `sqlite dialogs match-similar` | 选择结构相似的文件。 |
| `sqlite dialogs answer yes\|no\|all\|cancel` | 回答当前的已有表问题。 |

字面分隔符和引号必须是单个字符。字符码是无符号十进制数。自定义 `other` 值可以为空，表示无。无效编码名称会显示在预览中。没有待回答的问题时，`answer` 会失败；`all` 会对剩余所有问题回答 Yes。

### 导出 CSV 和 JSON

| 命令 | 功能 |
| --- | --- |
| `sqlite dialogs select <name> on\|off` | 包含或排除列出的表。 |
| `sqlite dialogs all`, `sqlite dialogs none` | 选择所有表或不选任何表。 |
| `sqlite dialogs header on\|off` | 设置 CSV 列标题。 |
| `sqlite dialogs separator ,\|;\|tab` | 设置 CSV 分隔符。 |
| `sqlite dialogs separator "\|"` | 使用字面管道符作为 CSV 分隔符。 |
| `sqlite dialogs separator other [<character>]` | 设置自定义 CSV 分隔符。 |
| `sqlite dialogs quote "\|'\|none` | 设置 CSV 引号字符；将字面双引号作为脚本字符串引用。 |
| `sqlite dialogs quote other [<character>]` | 设置自定义 CSV 引号字符。 |
| `sqlite dialogs newline crlf\|lf` | 设置 CSV 换行符。 |
| `sqlite dialogs newline other [<text>]` | 设置自定义 CSV 换行符。 |
| `sqlite dialogs pretty on\|off` | 设置 JSON 美化输出。 |

对 JSON 导出使用 CSV 控件会失败，对 CSV 使用 `pretty` 也会失败。查询导出没有表选择器，因此在此情况下 `select`、`all` 和 `none` 都会失败。

### 导出 SQL

| 命令 | 功能 |
| --- | --- |
| `sqlite dialogs select <name> on\|off` | 包含或排除列出的表。 |
| `sqlite dialogs all`, `sqlite dialogs none` | 选择所有表或不选任何表。 |
| `sqlite dialogs what everything\|schema\|data` | 选择转储内容。 |
| `sqlite dialogs column-names on\|off` | 在 INSERT 语句中包含列名。 |
| `sqlite dialogs multi-row on\|off` | 在多行 INSERT 语句中合并记录。 |
| `sqlite dialogs keep-original on\|off` | 保留原始 CREATE SQL。 |
| `sqlite dialogs keep-schema on\|off` | 保留原始数据库模式名称。 |

`block.dialogs.open` 标识对话框；`.dialog` 包含其字段、选项、预览、选区和验证状态。`.job` 报告进度，`.popover` 描述打开的选择器。对于导入操作，请在发送答复前检查对话框中的问题和剩余文件。

## 工具

| 命令 | 功能 |
| --- | --- |
| `sqlite tools compact` | 打开 Compact 对话框。 |
| `sqlite tools integrity` | 运行完整性全面检查。 |
| `sqlite tools quick-check` | 运行快速完整性检查。 |
| `sqlite tools fk-check` | 检查外键。 |
| `sqlite tools optimize` | 运行 SQLite 优化。 |
| `sqlite tools row-counts` | 在新的 Execute 标签页中运行查询，统计表和视图的行数。 |
| `sqlite tools save-project` | 保存项目，必要时请求路径。 |
| `sqlite tools save-all` | 保存数据库和项目。 |
| `sqlite tools close-project` | 关闭关联的项目。 |
| `sqlite tools detach-menu` | 分离唯一连接的数据库；如果有多个，则打开菜单。 |
| `sqlite tools save-project-as-dialog` | 请求新的项目目标路径。 |
| `sqlite tools save-database-as-dialog` | 请求数据库副本目标路径。 |
| `sqlite tools pick <schema> on\|off` | 在 Compact 中设置数据库模式复选框。 |
| `sqlite tools alias <name>` | 设置 Attach 对话框的别名。 |
| `sqlite tools ok` | 执行打开的 Compact 或 Attach 对话框。 |
| `sqlite tools cancel` | 关闭工具对话框。 |
| `sqlite tools load-extension <path>` | 加载 SQLite 扩展。 |
| `sqlite tools attach <path>` | 为该数据库文件打开 Attach；`:memory:` 会连接内存数据库。 |
| `sqlite tools detach <name>` | 分离数据库别名。 |
| `sqlite tools open-project <path>` | 打开项目文件。 |
| `sqlite tools save-project-as <path>` | 将项目保存到指定路径；必要时添加项目扩展名。 |
| `sqlite tools save-database-as <path>` | 将数据库复制到新文件。 |
| `sqlite tools drop select\|insert\|names` | 选择拖放数据库模式对象时生成的文本。 |
| `sqlite tools drop qualified\|quoted` | 切换生成的拖放文本中是否限定数据库模式或为名称加引号。 |

Compact 需要可写数据库。检查、优化和行数统计需要打开的数据库。保存项目需要已打开且基于文件的数据库；关闭项目则要求存在关联的项目文件。有未写入的更改时，Save Database As 不可用。操作不可用时会以 `can't run now` 失败。没有对应对话框时，`pick`、`alias` 和 `ok` 会失败。Tools 的 `pick` 只接受 `on` 或 `off`，与数据库对话框的布尔别名不同。没有工具对话框时，`cancel` 不会造成影响。

检查 `block.structure.tools.tasks`、`.compact` 和 `.attach` 中的工作和对话框；`.compact` 列出 Compact 提供的数据库模式，而不只是已勾选的数据库模式。`block.project`、`.path`、`.dirty` 和 `.structure.objects` 反映项目、文件和附加操作。检查、优化和 `row-counts` 会打开 Execute 标签页；请检查 `block.execute.tabs[].results` 获取其输出。拖放文本偏好设置没有专用状态字段。

## 另请参阅

- [脚本](index.md)：运行、计时、测试夹具和通用语法。
- [测试框架命令](harness.md)：确认对话框、输入和捕获。
- [控制命令](control.md)：检查状态、树和布局。
- [文件窗格](files.md)：从列表中打开数据库文件。
- [调试](../guides/debugging.md)：通过脚本驱动窗口。
