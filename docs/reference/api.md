# API 参考

`tern` 模块是完整的插件 API。插件的两端各有一份副本：共享成员在两端都存在，每个上下文还会添加各自的成员。本页按上下文索引该模块，并说明三个成员页面使用的记法。

## 获取模块

入口运行前，`tern` 会作为全局变量安装，`require("tern")` 会返回同一个表。全局 `print` 是 `tern.log.info`。

```lua
print(tern.context, tern.plugin.id, tern.runtime.jit)
```

使用任何其他字符串调用 `require`，都会加载相对于调用文件的 Luau 模块（`require("./util")` 会查找 `util.luau`、`util.lua` 或 `util/init.luau`），且不会离开插件目录；不会读取 `.luaurc` 别名。请参阅[运行时、预算与 JIT](../concepts/runtime.md)。

## luau-lsp 类型

`tern plugin types DIR` 会写入 `DIR/tern.d.luau`，这是运行时随附的定义文件。将其作为定义文件注册到 luau-lsp 后，两个入口都能针对声明的全局变量 `tern` 进行类型检查：

```sh
tern plugin types ~/src/my-plugin
```

```json
{
  "luau-lsp.platform.type": "standard",
  "luau-lsp.sourcemap.enabled": false,
  "luau-lsp.types.definitionFiles": { "@tern": "tern.d.luau" }
}
```

luau-lsp 无法解析 `require("tern")`（会报告未知的 require）；在要进行类型检查的代码中，请使用全局变量 `tern`。将定义标注为 `BlockDef<MyState>` 或 `LensDef<MyState>`，即可为其状态指定类型。定义文件会在文档中将某个上下文的成员标记为 `Host only` 或 `Window only`；它为两个入口声明了同一个 `tern`，因此检查器不会阻止 window 入口调用 host 成员。

## 上下文

在运行 `host.luau` 的 VM 中，`tern.context` 为 `"host"`；在运行 `window.luau` 的 VM 中则为 `"window"`。另一个上下文的成员不存在（值为 `nil`）：使用它会触发 Luau 自身的错误（在 window 入口中使用 `tern.block.define` 会报 `attempt to index nil with 'define'`；在 host 入口中使用 `tern.command` 会报 `attempt to call a nil value`）。如果同一个模块同时服务于两个入口，请根据 `tern.context` 分支处理。

| 成员 | Host | Window | 页面 |
| --- | --- | --- | --- |
| `tern.context`、`tern.plugin`、`tern.runtime` | 是 | 是 | [共享 API](api-shared.md#身份) |
| `tern.log`、`tern.json`、`tern.now`、`tern.getenv`、`tern.timer` | 是 | 是 | [共享 API](api-shared.md) |
| `tern.base64` | 是 | 是 | [共享 API](api-shared.md#base64) |
| `tern.kv`、`tern.fs`、`tern.process` | 是 | 是 | [共享 API](api-shared.md#存储) |
| `tern.secrets` | 否 | 是 | [Window API](api-window.md#tern-secrets) |
| `tern.fetch` | 是 | 是 | [共享 API](api-shared.md#网络) |
| `tern.ui`、`tern.parse` | 是 | 是 | [UI 构建器](ui.md) |
| `tern.block.define` | 是 | 否 | [Host API](api-host.md#tern-block-define) |
| `tern.lens.define` | 是 | 否 | [Host API](api-host.md#tern-lens-define) |
| `tern.pane.write`、`tern.pane.list` | 是 | 否 | [Host API](api-host.md#tern-pane) |
| `tern.on` | host 事件 | window 事件 | [Host API](api-host.md#tern-on)、[Window API](api-window.md#tern-on)、[事件](events.md) |
| `tern.command`、`tern.bind`、`tern.override` | 否 | 是 | [Window API](api-window.md) |
| `tern.route.open`、`tern.route.link` | 否 | 是 | [Window API](api-window.md#tern-route-open) |
| `tern.chrome.tab_title`、`window_title`、`status` | 否 | 是 | [Window API](api-window.md#chrome-格式化器) |
| `tern.chrome.refresh` | 否 | 是 | [Window API](api-window.md#tern-chrome-refresh) |
| `tern.chrome.program_icon` | 否 | 是 | [Window API](api-window.md#tern-chrome-program-icon) |
| `tern.files.button` | 否 | 是 | [Window API](api-window.md#tern-files-button) |
| `tern.css` | 否 | 是 | [Window API](api-window.md#tern-css) |

`tern.on` 在两个上下文中都存在，但事件集不同；如果调用时使用了该上下文不认识的事件名称，就会报错。

处理器上下文 `cx` 会根据调用处理器的对象而有所不同：

| `cx` | 接收方 | 成员 | 页面 |
| --- | --- | --- | --- |
| Effect cx | Lens `open` 和 `event`、host 事件处理器 | `toast`、`open`、`copy` | [Host API](api-host.md#副作用上下文-cx) |
| Block cx | 每个块处理器 | Effect cx，加上 `pane`、`cwd`、`cols`、`rows`、`render`、`save`、`exit`、`frame`、`blob` | [Host API](api-host.md#块上下文-cx) |
| Window cx | 命令、绑定、覆盖项、路由、Files 窗格按钮、window 事件、window 定时器、进程和 fetch 回调 | `session`、`layout`、`run`、`open`、`new_block`、`command`、`toast`、`copy` | [Window API](api-window.md#window-上下文-cx) |

Chrome 格式化器不会接收 `cx`。Host 定时器、进程和 fetch 回调也不会接收 `cx`。

## 记法

- 签名使用 `tern.d.luau` 中声明的 Luau 类型语法。`T?` 表示可选值（`T` 或 `nil`）；写作 `name: T?` 的字段可以不存在。
- 写作 `cx:name(...)` 的方法使用 `:` 调用。
- **Raises** 表示调用会抛出 Lua 错误，错误消息为引述的文本；除非调用处理器用 `pcall` 捕获该错误，否则处理器会失败。
- 处理器失败或超出预算时，会显示提示 `Plugin *name*: *hook* failed` 并记录到日志中；各页面给出的 hook 名称就是此处显示的名称。请参阅[错误](errors.md#处理器失败)。
- 字节偏移、行号和列号从 1 开始。时间单位为毫秒。
- 窗格和标签页 ID 是 Lua 数字。请原样传回；远程 ID 的打包方式请参阅[Window API](api-window.md#窗格和标签页-id)。

## 声明与运行时的差异

运行时具有权威性。如果 `tern.d.luau` 声明的范围更窄或有所不同，成员页面会在备注中说明：

- 对于没有窗格的链接（系统交给 Tern 的 URL），`LinkRequest.pane` 为 `nil`；定义文件声明其类型为 `number`。
- `cx.layout:move` 和 `cx.layout:resize` 会返回布尔值（表示是否发生了移动）；定义文件声明它们不返回任何值。
- `LensDef.finish` 始终会接收一个数字；定义文件允许 `nil`。
- 块的 `cx:exit` 接受可选退出码（默认值为 `0`）。
- `tern.ui.badge` 接受缺失的 `tone`。
- Host 的 `cx:toast` 接受任意级别字符串；请参阅 [副作用上下文（cx）](api-host.md#副作用上下文-cx)。
- window 上下文还会发送 `title` 事件，但定义文件中 `tern.on` 的事件列表未包含该事件。
- `tern.css` 会安装样式表 `plugin:local:<plugin>:<name>`。

## 页面

- [共享 API](api-shared.md)：身份标识、日志、JSON、时间、定时器、键值存储、文件、进程和 HTTP 请求。
- [Host API](api-host.md)：块、Lens、host 事件、窗格及其 `cx` 类型。
- [Window API](api-window.md)：命令、绑定、覆盖项、路由、Chrome、CSS、window 事件，以及包含 `cx.session` 和 `cx.layout` 的 window `cx`。
- [UI 构建器](ui.md)：每个 `tern.ui` 构建器和 `tern.parse` 辅助函数。
- [事件](events.md)：每个 `tern.on` 事件及其载荷。
