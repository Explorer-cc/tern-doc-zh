# 自定义主题

Tern 使用 omp 的主题，你也可以用 CSS 编写自己的主题。每个主题要么是浅色，要么是深色；Tern 会各选一个：窗口为深色时使用深色主题，为浅色时使用浅色主题（Settings › Appearance › Appearance）。添加主题后，可通过 **Change theme…**（macOS 上按 ⌃⌘T，其他平台按 Ctrl+Shift+M）或在 Settings › Appearance › Theme 中选择。

```css
@import "dark-gruvbox";

:root {
	--tv-bg: #1d2021;
	--accent: #fe8019;
	--omp-mdHeading: #fabd2f;
}

[role='tab'][aria-selected='true'] {
	font-weight: 600;
}
```

将其保存为 `<config>/themes/campfire.css`，选择器中就会出现名为 `campfire` 的深色主题：gruvbox 配上更暗的终端、橙色强调色、omp 聊天中的黄色标题，以及加粗的当前标签页。

## CSS 主题

CSS 主题以另一个主题为基础，并在其上叠加自己的规则。

- **基础主题。** 开头的 `@import "<theme>";` 指定其基础主题：可以是内置主题、omp 的主题，也可以是另一个 CSS 主题，名称使用选择器中显示的名称。如果没有指定，主题将以对应外观的 omp 默认主题为基础（深色为 `titanium`，浅色为 `light`）。
- **浅色或深色。** 在 `:root` 规则中设置 `color-scheme: light` 或 `color-scheme: dark`，即可指定主题外观；如果未设置，则沿用基础主题的外观；若两者都没有，则使用深色外观。`light-dark(<light>, <dark>)` 值会根据当前外观选择对应一侧。
- **每条规则都优先。** 每个声明都视为带有 `!important`，并且样式表排在 Tern 和所有插件的样式表之后，因此任何特异性级别的规则都优先于它们。只有行内的 `!important` 能覆盖它。
- **要设置什么。** 在 `:root` 上设置 Tern 用于绘制界面的变量：终端的 `--tv-bg`、`--tv-fg`、`--tv-cur` 和 `--ansi0` … `--ansi15`，界面的 `--page`、`--accent`、`--ink`、`--t1` … `--t4`、`--ok`、`--bad` 和 `--warn`，高亮代码的 `--tk-*`，以及 omp 聊天的颜色 `--omp-<token>`。[CSS 变量](../styles/variables.md) 列出了所有变量。面板使用 `--tv-bg`，细线和小标签的填充使用 `--ink`。其他任何规则都会重新设置其选中的内容样式。
- **CSS 之外。** 主题选择器的色样，以及程序向终端查询颜色（OSC 4、10、11 和 12）时获取的颜色，来自主题在 `@media` 之外直接定义于 `:root` 的规则：`--tv-bg`、`--tv-fg`、`--tv-cur`、`--tv-cur-ink`、`--accent` 和 `--ansi0` … `--ansi15`。这些值可以是颜色、`light-dark()`，也可以是其他变量的 `var()`。Tern 会按原样使用它们，不会像处理 omp 主题那样调整可读性。
- **主题链。** 以另一个 CSS 主题为基础的主题会同时加载两个样式表，先加载基础主题，并且可以使用基础主题的 `:root` 变量。

## 主题存放位置

| 文件夹 | 内容 | 读取时机 |
| --- | --- | --- |
| `<config>/themes/`，与 `settings.json` 同级 | Tern 的 CSS 主题，`<name>.css` | 始终读取。 |
| Tern 应用存储中的 `Documents/Themes`，与 `Plugins` 同级（在 iOS 上，位于 Files app 的 On My iPhone 或 iPad › Tern › Themes） | Tern 的 CSS 主题 | 在 iOS 和 Android 上读取，以替代 `<config>/themes/`。 |
| omp 的 `themes/`：`~/.omp/agent/themes/`，或命名 omp 配置文件对应的 `~/.omp/profiles/<name>/agent/themes/` | omp 的主题，`<name>.json` | 此计算机已设置 omp 时读取。 |

`<config>` 是 Tern 的配置目录（[目录](../concepts/packages.md#目录)）；Settings › Advanced 会显示这两个文件夹。Tern 不会创建自己的 `themes` 文件夹，因此添加第一个主题前，请先创建该文件夹。

连接到主机的手机或平板会从自己的文件夹读取主题，而不是从主机读取。若要在设备上使用电脑中的主题，请将其文件复制到 Files app 中的 `Themes` 文件夹，并同时复制它所基于的 CSS 主题。

- **名称。** 文件名去掉扩展名后就是主题名称。若文件名与内置主题同名（`titanium.css`），则会像在 omp 中一样跳过该文件。如果两个文件夹中都有同名主题，Tern 会使用自己的主题。
- **实时编辑。** Tern 会监视这两个文件夹。新增、修改或删除的文件会在约一秒内显示，因此你可以在主题正在显示时编辑它。
- **无效文件。** 如果 CSS 主题的 `@import` 不是由引号括起的名称并以 `;` 结尾，或引用了不存在的主题、形成了循环引用，Tern 就会忽略该主题。omp 主题若不是有效 JSON、包含非对象的区段，或 `ansi` 列表的长度不恰好为 16，也会被忽略。Tern 无法解析的 CSS 声明会被丢弃，其余声明仍会生效。[日志](debugging.md#日志文件) 会说明原因，并提供行号和列号。
- **选择主题。** 在 Tern 中选择主题后，Tern 会将其保存到 `settings.json`（`theme_dark` 或 `theme_light`）。在你选择主题之前，Tern 会遵循 omp 的 `config.yml` 中的 `theme.dark` 和 `theme.light` 设置，这些设置可以指定任一文件夹中的主题。在 Settings › Appearance 中选择 **Follow omp**，即可清除你的选择，让 Tern 再次遵循 omp。

## omp 的主题

omp 主题是采用 omp 格式的 JSON 对象，Tern 会将其中所有部分都视为可选：

| 键 | 内容 |
| --- | --- |
| `vars` | 其他区段可引用的命名颜色。 |
| `colors` | omp 的颜色 token（`accent`、`success`、`muted`、`syntaxString`，…）。 |
| `export` | omp HTML 导出的颜色：`pageBg`、`cardBg`。 |
| `terminal` | 该主题适用的终端：`background`、`foreground`、`chrome`、`widget` 和包含 16 种颜色的 `ansi` 列表。 |
| `$schema` | Tern 会忽略此项；编辑器会用它提供补全。 |

omp 只会加载 `colors` 包含其全部 token 的主题；Tern 只读取其中少数几个，并自行推导其余颜色。若要在编辑器中根据 omp 的主题格式要求验证主题，请添加
`"$schema": "https://raw.githubusercontent.com/can1357/oh-my-pi/main/packages/coding-agent/theme-schema.json"`。

### 颜色值

`vars`、`colors`、`export` 和 `terminal` 中的每个值都属于以下类型之一：

| 值 | 含义 |
| --- | --- |
| `"#rrggbb"` 或 `"#rgb"` | 对应颜色。Alpha 数字（`#rrggbbaa`）会被忽略。 |
| 数字，`0`–`255` | xterm 256 色表中对应的条目。 |
| `"name"` 或 `"$name"` | 名为 `name` 的 var，或同名的 `colors` token。最多会沿链解析 8 个名称。 |
| `""` | 未设置：Tern 使用自己的颜色，效果与省略该键相同。 |

Tern 无法解析的值（例如拼写错误的名称）会视为未设置。

### Tern 读取的内容

| 键 | Tern 的用途 | 缺失时 |
| --- | --- | --- |
| `terminal.background` | 终端背景。背景较暗时，主题会被视为深色主题。 | 依次使用 `export.pageBg`、`colors.statusLineBg`，否则使用近黑色。 |
| `terminal.foreground` | 程序未着色的文本。 | 使用 `colors.text`，否则使用与背景色调相近的中性色。 |
| `terminal.chrome` | 侧边栏、标签栏和标题栏。 | 使用比背景更暗一级的颜色。 |
| `terminal.widget` | 凸起的行和按钮。 | 如果 `export.cardBg` 的明度接近背景，则使用它；否则使用背景与文本的混合色。 |
| `terminal.ansi` | ANSI 颜色 0–15，按顺序列出全部 16 种。 | Tern 根据主题的其他颜色生成这些颜色。 |
| `colors.accent` | 选中项、焦点、光标和高亮控件。 | 使用 `colors.borderAccent`，否则使用文本颜色。 |
| `colors.borderAccent`、`colors.border` | 强调色渐变中的第二种颜色。 | 使用强调色。 |
| `colors.success`、`colors.error`、`colors.warning` | 完成、失败和警告标记；没有 `ansi` 列表时，也分别用作 ANSI 绿色、红色和黄色。 | 使用文本颜色。 |
| `colors.muted`、`colors.dim` | 次要和弱化的界面文本；`dim` 也用作 ANSI 亮黑色。 | 使用文本与背景的混合色。 |
| `colors` 中的所有其他文本 token（`mdHeading`、`mdLink`、`mdCode`、`mdQuote`、`syntaxKeyword`、`toolDiffAdded`、`toolTitle`、`thinkingText`、`statusLineModel`，…） | omp 在窗格中的聊天和其他原生视图里为其着色的内容：标题、链接、引用、高亮代码、差异、工具标题。 | 使用 Tern 为相应类型文本指定的颜色。 |

其他以 `Bg` 结尾的 token（`userMessageBg`、`toolErrorBg`，…）会被忽略：卡片和选中项仍使用 Tern 的填充色。

除非 `ansi` 列表的全部 16 个条目都是可解析的颜色，否则 Tern 会忽略该列表。若没有列表，Tern 会自行构建颜色表：当色相合适时，红色、绿色和黄色分别取自 `error`、`success` 和 `warning`；蓝色、品红色和青色则取自主题中最接近这些色相的颜色。亮色是普通颜色的较亮版本。Tern 会在 `vars` 和 `colors` 中的所有颜色里查找这些色相，但会排除以 `Bg` 结尾的 token。同样的颜色还会用于主题的橙色，该颜色表示正在运行的工作。

程序也能看到主题：程序向终端查询颜色（OSC 4、10、11 和 12）时，会获取主题的 ANSI 颜色、背景色、前景色和光标颜色。

### 可读性

Tern 会调整 omp 主题中在背景上难以阅读的颜色：

- 终端文本的对比度至少为 4.5:1。
- ANSI 颜色的对比度至少为 3:1。深色主题中的黑色和浅色主题中的白色保持不变，因为程序会将它们用作填充色。
- 强调色和次要界面文本在各自显示的每个表面上，对比度分别至少为 3:1 和 4.5:1。
- omp 聊天使用的 token 颜色在背景、代码块和弹出层上的对比度至少为 4.5:1；注释、边框、分隔线、`muted` 和 `dim` 的对比度至少为 3:1。

已经足够清晰的颜色会保持你设置的样子。不够清晰的颜色会在自身色相内变亮或变暗，直到文本可读为止，因此文件中非常暗淡的颜色在 Tern 中可能会显得更亮。

## 完整示例

一个自带完整 ANSI 颜色表、以 omp 默认浅色主题为基础的浅色主题：

```css
:root {
	color-scheme: light;
	--paper: #fbf8f1;
	--ink: #1f2328;

	--tv-bg: var(--paper);
	--tv-fg: var(--ink);
	--tv-cur: #2f5f9e;
	--tv-cur-ink: var(--paper);
	--accent: #2f5f9e;
	--ok: #4d7a35;
	--bad: #b0412e;
	--warn: #9a6a00;

	--ansi0: #1f2328;
	--ansi1: #b0412e;
	--ansi2: #4d7a35;
	--ansi3: #9a6a00;
	--ansi4: #2f5f9e;
	--ansi5: #8a3f8f;
	--ansi6: #1f7a7a;
	--ansi7: #d8d2c4;
	--ansi8: #6b6459;
	--ansi9: #c4513c;
	--ansi10: #5e9142;
	--ansi11: #b07d0a;
	--ansi12: #3d72b8;
	--ansi13: #a04ea6;
	--ansi14: #2a9090;
	--ansi15: var(--paper);

	--omp-mdHeading: #8a3f8f;
	--tk-keyword: #b0412e;
	--tk-string: #4d7a35;
}

#statusline {
	letter-spacing: 0.01em;
}
```

## 另请参阅

- [CSS 变量](../styles/variables.md)：主题可以设置的所有变量。
- [Chrome 与样式](chrome.md)：通过插件中的 CSS 重新设置 Tern 窗口的样式。
