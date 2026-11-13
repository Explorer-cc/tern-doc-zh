# 浏览器块

浏览器命令会在终端旁打开网页并聚焦其地址栏。你可以在无头脚本中配合 `webview` 报告来设置页面标题、加载状态和导航控件，而无需获取真实网站。

## 打开和地址

| 命令 | 作用 |
| --- | --- |
| `browser open [<address or search>...]` | 在聚焦窗格旁打开浏览器块。不提供输入时会打开空白页并聚焦地址栏。 |
| `browser address` | 聚焦当前浏览器块的地址栏并选中其文本，类似 ⌘L。 |

`open` 会将余下所有词以空格连接。为明确起见，包含空格的地址或搜索内容请加引号。开头和结尾的空白字符会去掉；空白输入会打开空白页。显式指定的协议方案会保留，带点的主机名会添加 `https://`，`localhost` 或 IP 地址会添加 `http://`。其他文本会作为网页搜索。

如果聚焦窗格不是浏览器块，`address` 不执行任何操作。其解析器也接受并忽略额外的词，这些词不起作用。两条命令都会稳定处理 450 毫秒。这不是等待网页实际加载：此命令族没有浏览器就绪命令或网络超时。它们不限于桌面构建，但不会在 Web 客户端运行。

## 报告页面状态

无头运行显示页面卡片，而非原生 Web 视图。`webview` 会发送原生页面本应报告的事件；它不会加载网站或执行其 JavaScript。此命令也可在实时窗口中使用。

| 命令 | 作用 |
| --- | --- |
| `webview <selector> title <text>` | 报告页面标题。 |
| `webview <selector> url <text>` | 报告当前地址，例如重定向后的地址。 |
| `webview <selector> loading <progress>` | 报告 `0` 到 `1` 的加载进度；`1` 表示加载完成。 |
| `webview <selector> failed <message>` | 报告加载失败并结束加载。 |
| `webview <selector> history <true\|false> <true\|false>` | 按顺序设置后退和前进是否可用。 |
| `webview <selector> focus <on\|off>` | 报告页面是否具有键盘焦点。 |
| `webview <selector> new-window <url>` | 报告打开另一个页面的请求；通常会在此页面旁打开浏览器块。 |
| `webview <selector> inspector-page <url>` | 将页面 Web Inspector 报告为此地址上的页面（WPE WebKit 的检查器服务器）；在旁边打开其浏览器块。 |
| `webview <selector> inspector-unavailable <message>` | 报告页面 Web Inspector 无法在 Tern 中打开；以提示形式显示消息。 |
| `webview <selector> security-key` | 报告页面请求安全密钥或通行密钥（WebAuthn），但引擎拒绝了请求；在工具栏下方显示提供 **Open in default browser** 的说明。 |
| `webview <selector> media-blocked <hint>` | 报告页面尝试播放引擎无法加载的音频或视频（Linux 上的 WebKitGTK）；在工具栏下方显示提示，并提供 **Open in default browser**。 |

选择器会定位第一个包含 Web 视图的匹配元素。要定位聚焦的浏览器块，请使用 `".tn-pane.on .kit-web-page"`；要定位浮动浏览器，请使用 `".tn-pane.pip .kit-web-page"`。选择器格式错误或没有匹配的 Web 视图时，命令会失败。文本形式要求恰好一个参数，因此标题、消息和 URL 中包含空格时请加引号。进度超出 `0`–`1`、缺少参数和无效标志也会导致失败。

报告会直接应用，不会等待真实页面加载。空 URL 或 `about:blank` 报告不会更改已存地址。小于 `1` 的进度报告会开始或继续加载；如果加载已结束后重新开始，则会清除之前的错误。标题、URL、进度、失败和历史报告会更新会话页面，因此同一会话的其他窗口也能看到。对于由浏览器自动化驱动的浏览器，`new-window` 只会记录为报告，不会打开块。

## 安全密钥和通行密钥

在 macOS 上，WebKit 只向 Apple 授予浏览器公钥凭证权限的浏览器提供安全密钥（YubiKey 和其他 FIDO 密钥）和通行密钥；Tern 没有此权限。如果页面的安全密钥或通行密钥请求被拒绝，浏览器块会在工具栏下方显示说明和 **Open in default browser** 按钮；该按钮会在系统浏览器中打开页面，你可以在那里使用密钥登录。单击 ✕ 按钮会关闭说明；页面再次加载时说明也会消失。静默通行密钥自动填充请求（`mediation: "conditional"`）以及页面自行中止的请求不会显示说明。Linux 和 Windows 浏览器块不会显示该说明。

## 状态和示例

`tern ctl state` 会通过 `focused.id`、`focused.label`、`panes` 和标签页的窗格数显示新块。`focused_element` 表示地址栏是否聚焦。`state` 中没有专用的浏览器页面条目；使用 `tern ctl stats` 的 `webviews` 条目检查报告的地址、标题和原生页面焦点。页面错误和导航控件会显示在块中。

此工具栏场景遵循 Tern goldens 中的 `browser-toolbar.txt`：

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

- [测试框架命令](harness.md)：页面报告、输入和截图。
- [控制命令](control.md)：使用 `stats` 检查 Web 视图。
- [画中画](pip.md)：浮动浏览器块。
- [调试](../guides/debugging.md)：通过脚本驱动窗口。
