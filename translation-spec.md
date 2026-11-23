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
| action | 操作 | 按键映射可运行的名称；命令是其中的子集 |
| budget | 预算 | 一次 Lua 调用的时间上限；超出称“预算超限” |
| hook | 钩子 | 进入 Lua 的一次调用的名称，如 `pods.view`、`timer`；行文不保留英文 hook |
| catalog | 目录 | 主机构建并发送给窗口的插件数据；与文件系统的“目录”按上下文区分 |
| claim | 认领 | Lens 接管命令行的声明式决定；叙述动作时可用“接管” |
| replica | 副本 | 窗格屏幕的一份拷贝 |
| rehydration | 重新水合 | 重建 Lens 块丢失的状态 |
| worker | 工作线程 | 运行插件 Host 端的线程；行文不保留英文 worker |
| effect | 副作用 | Host 端经 `cx` 向窗口提出的请求（`toast`、`open`、`copy`）；泛指的视觉效果仍写“效果” |
| formatter | 格式化器 | 计算 chrome 文本的纯窗口函数 |
| spawn filter | `spawn` 过滤器 | 事件名保留代码格式；不写“启动过滤器” |
| host | 主机 / Host 端 | 机器意义写“主机”；插件运行的一侧写“Host 端”；事件族写“Host 事件”；`"host"` 上下文名保持小写 |
| half | 部分 | 插件的两个部分；具体指一半时写 Host 端 / Window 端 |
| plugins folder | 插件文件夹 | `<config>/plugins/`；不写“plugins 文件夹” |
| data folder | 数据文件夹 | `<state>/plugin-data/<id>/` |
| entry | 入口 | 清单的 `host` 或 `window` 指定的 Luau 文件 |
| problem | 问题 | 插件文件夹中不可用作插件的条目 |
| status segment | 状态栏片段 | `tern.chrome.status` 返回的一个条目 |
| span | 文本片段 | 节点中的一段带样式文本；代码中的 `span` 保留 |
| chord | 按键组合 | `tern.bind` 与 `keybinds` 的写法；不写“组合键” |
| toast | 提示 | `cx:toast` 等代码保留；行文写“提示”或“提示消息” |
| window key | 窗口键 | 守护进程中标识一个窗口全部会话的键 |

术语表页（`reference/glossary.md`）的术语列写作“中文（English）”，按英文原词排序；站内没有定型中文译名的术语行只保留英文。

站内既有译法尚未全部统一，新增或修改译文时按上表书写。仍是少数写法的有：英文 hook（`reference/errors.md`、`guides/debugging.md`、`guides/io.md` 等 9 个页面）、英文 worker（`guides/blocks.md`、`guides/lenses.md` 等 6 个页面）、作为 `cx` 请求的“效果”（`guides/hooks.md`、`concepts/architecture.md`）、“启动过滤器”（`reference/events.md`）、“plugins 文件夹”（`concepts/packages.md`、`guides/distribution.md`），以及机器意义的小写 host（`concepts/architecture.md` 等 18 个页面）。

## 审校

新译或更新的页面在 `npm run docs:verify` 和生产构建通过后，还要做一轮内容审校：

- 机械比对：以上游快照为准，逐行比对代码段、数字与单位、链接数量与目标章节（按标题序号对应上游锚点）、链接文本与目标页 H1，以及全角标点和中英文间空格。
- 逐句对照：核对漏译、增译、条件、否定、数量、单位、主体与数据流向。
- 术语核对：译名、正文用词和链接文本与本表及目标页的写法一致；站内用法不一致时取多数用法，并在本表和 `TODO.md` 中记录。
- 上游措辞压缩而有歧义时，只按它链接到的详细页面澄清，并在审校记录中注明依据；不补充上游没有的行为。
- 每轮审校在 `README.md` 和 `TODO.md` 中记录范围、修正和保留的取舍；审校记录不是零漏译、零错译保证。

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
- 上游更新后先运行 `npm run sync:check` 查看 `NEW`、`CHANGED`、`REMOVED`；只翻译差异，不覆盖既有中文页。运行 `npm run sync:assets` 更新本地原图，新增或更名的图示须同步更新正文引用；图片文件与译文一并提交。翻译和验证完成后才运行 `npm run sync:accept` 更新 `upstream-baseline.json`。随后提交并推送；推送 `main` 会触发部署，部署后检查线上地址的首页、深层页面、静态资源和站内导航。
