# Tern 文档翻译规范

本文档用于把 `https://docs.stencil.so/tern/` 的官方 Markdown 页面完整翻译到本仓库 `docs/` 的同路径中文页面。技术事实只以 Tern 官方文档为准；`aieguu/omp-docs-cn` 只作为站点组织、同步和验证方式的参考。

## 翻译要求

- 完整翻译页面标题、段落、列表、表格、提示、图注和页面内说明；不删节、不摘要、不新增上游没有的产品行为。
- 保持上游章节层级、顺序、表格行列、HTML/Markdown 结构和示例数量。保留页面已有 frontmatter 并仅翻译面向读者的文案。
- 保持所有 fenced code、命令、输出、API 符号、类型、配置键、文件名/路径、快捷键、协议报文、产品/库名称和 URL 原样；不翻译可复制执行的代码和数据。
- 技术词语首次出现时可补充英文原词，后续遵循下表；新增术语先更新本规范再继续翻译。
- 以「你」称呼读者，中文表达自然、准确、简练。保留原文的限制条件、时序、权限、安全警告和错误语义，不弱化程度。

## Tern 术语表

| English | 简体中文 | 使用说明 |
| --- | --- | --- |
| Tern | Tern | 产品名，不翻译 |
| plugin | 插件 | Tern 扩展包 |
| Host half / host context | Host 端 / host 上下文 | 保留 Host 大写以对应运行上下文 |
| Window half / window context | Window 端 / window 上下文 | 保留 Window 大写以对应运行上下文 |
| pane | 窗格 | Tern 的终端窗格 |
| block | 块 | Tern 插件定义的 pane/block 概念；API 符号 `block` 不翻译 |
| command lens | 命令 Lens（命令透镜） | 首次可加英文，之后统一“命令 Lens” |
| lens | Lens / 透镜 | API、ID 和类型名保留 Lens；一般叙述可用“透镜” |
| view | 视图 | 与 Tern 的 UI view 一致 |
| node | 节点 | Surface/Elements 树中的节点 |
| element | 元素 | Element kind 与 HTML element 语境按上下文翻译 |
| surface | surface（界面表面） | 协议术语保留 surface；一般 UI 描述可译“界面” |
| Surface Protocol / TSP | Surface Protocol / TSP | 协议专名不翻译，首次可说明“原生界面协议” |
| manifest | manifest（清单） | 文件名/字段不翻译，概念说明用“清单” |
| session daemon | 会话守护进程 | 不与用户会话混淆 |
| session | 会话 | Tern 会话 |
| shell integration | Shell 集成 | Shell 保持英文 |
| stylesheet | 样式表 | CSS 语境 |
| theme | 主题 | Tern 配色主题 |
| runtime | 运行时 | 运行时环境 |
| handler | 处理器 | 插件事件回调语境 |
| callback | 回调 | — |
| event | 事件 | API event 及用户交互事件 |
| key bind / key binding | 按键绑定 / 快捷键绑定 | 名词使用“快捷键”或“按键绑定”按语境统一 |
| command palette | 命令面板 | — |
| secret | 机密信息 | 通用凭据或敏感值；不笼统译为加密“密钥”；`tern.secrets` 保留原名 |
| keychain | 系统钥匙串 | `tern.secrets` 的系统存储语境 |
| CLI | CLI | 首次可解释为命令行界面 |
| Luau | Luau | 语言名称，不翻译 |
| SDK | SDK | 首次可译“软件开发工具包” |
| API | API | 不翻译 |
| muted / dim | 弱化显示 / 低对比度 | 描述相对强调程度，不固定译为“暗色”；API、class 或 tone 值保持原样 |
| faded / dimmed | 淡化 | 按上下文描述可见度，不因浅深主题的颜色差异推断禁用或加载状态 |
| spinner | 加载指示器 | 不与数值输入的 stepper（步进器）混淆 |
| split button | 分离式按钮 | 沿用输入页 split 变体的用语，与 joined 连体按钮区分 |

## 链接与静态资源

- 页面目录与上游保持一致：上游 `guides/foo.md` 对应 `docs/guides/foo.md`，其余目录同理；上游 `index.md` 对应 `docs/index.md`。
- 所有指向 Tern 文档站页面的相对/绝对链接，改写成中文页面相对 Markdown 链接；本地链接目标必须在 `upstream-pages.json` 映射中。外部 GitHub、Luau 等链接保持原 URL。
- 锚点保留前先确认目标中文标题生成的锚点；不确定或已失配时重写链接锚点，不能让 VitePress 死链。
- 图片以官方站点资源 URL 为来源，运行 `npm run sync:assets` 原样下载到 `docs/assets/`，保留 `/tern/` 后的目录和文件名（当前为 `figures/*.png`）。正文使用相对于 Markdown 页的本地路径，官方来源 URL 保留在 `upstream-pages.json`；保留 `alt` 语义并翻译图注。本地保存不表示已获得再发布授权，许可状态仍须单独确认。
- 保留 HTML 图示结构、CSS class、`srcset`、宽高、加载属性等实现属性；只翻译读者可见的 alt、figcaption 和相邻说明。
- PNG 等上游图片按原样沿用，检查来源、资源完整性、引用和浅深色显示即可，不把细节能否辨认列为验收条件。Mermaid 仍须检查实际渲染与完整标签。
- 替代文本和图注忠实翻译上游说明；不因图片细节不清晰要求补图、重绘或进一步调查，不根据截图推断或修改 SDK 行为。
- `image-review.json` 仅作本轮历史校对记录，不作为后续同步、构建或部署的前置条件。上游更新时同步原图和对应译文即可。

## VitePress 安全与校验

- 表格代码 span 中的 `|` 必须转义成 `\|`，避免表格被拆列。
- 围栏和行内代码保留原文，VitePress 配置会为行内代码添加 `v-pre`。HTML 中直接写出的 `<code>` 若包含 `{{…}}`，仍须添加 `v-pre`，防止 Vue 将其当作插值。
- 原生 HTML `<figcaption>` 中使用 `<code>…</code>`，不要用不会被解析的 Markdown 反引号；检查实际渲染后的代码节点和可见图注，而不只检查源码。代码包含 `{{…}}` 时同样须加 `v-pre`。
- `<...>` 若是示意占位符，放在行内代码中，避免被解析为 HTML 标签。
- HTML 图示与后续 Markdown 之间留空行，核对 `<figure>` 开闭标签；否则标题可能被当成 HTML 文本而无法生成锚点。浅色与深色图片只显示当前主题对应的一张。
- 翻译提交前，对照抓取快照检查章节数和顺序、表格结构、代码块、图片、站内链接和锚点。
- 上游更新后先运行 `npm run sync:check` 查看 `NEW`、`CHANGED`、`REMOVED`；只翻译差异，不覆盖既有中文页。运行 `npm run sync:assets` 更新本地原图，新增或更名的图示须同步更新正文引用；图片文件与译文一并提交。翻译和验证完成后才运行 `npm run sync:accept` 更新 `upstream-baseline.json`。
