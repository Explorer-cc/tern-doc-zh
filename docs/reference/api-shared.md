# 共享 API

这些成员同时存在于 host 和 window 上下文中。除非说明指出涉及哪个上下文的机器、线程或 `cx`，否则它们在两者中的行为相同。视图构建器（`tern.ui`）和解析器（`tern.parse`）也为共享 API，详见其独立页面[界面构建器](ui.md)。

## 身份

### `tern.context`

```lua
tern.context: "host" | "window"
```

此 VM 运行在哪一端：`host` 入口对应 `"host"`，`window` 入口对应 `"window"`。在两个入口都会 `require` 的模块中使用它。

### `tern.plugin`

```lua
tern.plugin: PluginInfo

type PluginInfo = {
	id: string,
	name: string,
	dir: string,
	data: string,
}
```

| 字段 | 值 |
| --- | --- |
| `id` | manifest 的 `id` |
| `name` | manifest 的 `name` |
| `dir` | 包目录的绝对路径（链接包的链接目标） |
| `data` | 插件数据目录的绝对路径 `<state>/plugin-data/<id>`，会在入口运行前创建 |

数据目录归插件所有；`tern.kv` 会将 `kv.json` 保存在那里，由 `tern.process.run` 启动的进程会将其视为 `TERN_PLUGIN_DATA`。

### `tern.runtime`

```lua
tern.runtime: RuntimeInfo

type RuntimeInfo = {
	os: string,
	jit: boolean,
}
```

| 字段 | 值 |
| --- | --- |
| `os` | `"macos"`、`"linux"`、`"windows"` 或 `"ios"` |
| `jit` | 当此 VM 启用 Luau 原生代码生成时为 `true`；在 iOS 和开发构建中始终为 `false` |

参见[运行时、预算与 JIT](../concepts/runtime.md#jit)。

## 日志

### `tern.log`

```lua
tern.log.debug: (...any) -> ()
tern.log.info: (...any) -> ()
tern.log.warn: (...any) -> ()
tern.log.error: (...any) -> ()
```

按指定级别向 Tern 日志写入一条记录，目标为 `tern::plugin`，字段 `plugin` 设置为插件 ID。参数会像 `print` 一样通过 `tostring` 转换，并以制表符连接。全局 `print` 即 `tern.log.info`。

```lua
tern.log.warn("cache miss", key, #entries)
```

不返回任何内容，也不会抛出异常。Tern 的默认日志过滤器为 `warn,stencil=info`，因此只保留来自 `tern::plugin` 的 `warn` 和 `error` 记录；设置 `STENCIL_LOG=warn,stencil=info,tern::plugin=debug` 可保留 `info`（以及 `print`）和 `debug`。日志位置参见[调试](../guides/debugging.md)。

## JSON

相同的转换机制用于传递视图树、块状态、`kv` 值和事件，因此只要 Lua 值转换为 JSON，就适用这些规则。

| Lua | JSON |
| --- | --- |
| `nil`、`tern.json.null` | `null` |
| boolean | boolean |
| integer，或绝对值不超过 2^53 且没有小数部分的 float | integer |
| 其他有限 float | number |
| string | string（无效 UTF-8 会被替换） |
| 键恰为 `1..n` 且 `n > 0` 的 table | array |
| 由 `tern.json.array` 标记或从 `[]` 解码得到的空 table | `[]` |
| 未标记的空 table | `{}` |
| 其他 table | object，键排序；数字键转换为文本 |

函数、userdata（`tern.json.null` 除外）、线程、NaN 和无穷大都无法编码；嵌套超过 128 层的 table（循环引用也会达到此限制）会被拒绝。

### `tern.json.encode`

```lua
tern.json.encode: (value: any, pretty: boolean?) -> string
```

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| `value` | `any` | 要编码的值 |
| `pretty` | `boolean?` | 缩进输出（默认 `false`） |

返回 JSON 文本。

出现以下情况时抛出异常：`cannot encode a <type> as JSON`、`cannot encode a <type> key as JSON`、`cannot encode <n> as JSON`（非有限数字），或 `cannot encode tables nested this deep (or cyclic) as JSON`。

### `tern.json.decode`

```lua
tern.json.decode: (text: string) -> any
```

解码 `text`。数组会作为带有数组标记的 table 返回（因此即使为空，重新编码时仍为数组）；数组中的 `null` 会变为 `tern.json.null`；值为 `null` 的对象成员会被丢弃。整数会作为整数返回。

无效 JSON 会抛出 `tern.json.decode: <parser message>`。

```lua
local cfg = tern.json.decode(tern.fs.read("config.json"))
local port = cfg.port or 8080
```

### `tern.json.array`

```lua
tern.json.array: (<T>(t: T) -> T) & (() -> { any })
```

将 `t`（或新建的空 table）标记为 JSON 数组并返回，因此空数组编码为 `[]` 而不是 `{}`。非空且键为 `1..n` 的 table 无论是否带标记，都会编码为数组。

```lua
tern.json.encode({ items = tern.json.array() })  --> {"items":[]}
```

### `tern.json.null`

```lua
tern.json.null: JsonNull
```

在 Lua `nil` 无法表示 JSON `null` 的位置（数组项、对象中的显式 null）代表 JSON `null` 的值。

## Base64

### `tern.base64`

```lua
tern.base64.encode: (bytes: string, opts: { url: boolean? }?) -> string
tern.base64.decode: (text: string) -> string
```

将二进制字符串与 base64 文本相互转换，可用于 HTTP API、令牌和文件。两端以及 Carly 的 VM 均提供此功能。

| 函数 | 行为 |
| --- | --- |
| `encode(bytes)` | 标准字母表（`+`、`/`），使用 `=` 填充 |
| `encode(bytes, { url = true })` | URL 安全字母表（`-`、`_`），不填充；JWT 和 Gmail 的 `raw` 使用此格式 |
| `decode(text)` | 解码 `text` 所编码的字节，可使用任一字母表（不能在同一文本中混用）；可省略填充；忽略 ASCII 空白（MIME 正文中的换行） |

其他任何情况都会使 `decode` 抛出 `tern.base64.decode: <reason>`：``invalid character `<c>` ``、`invalid byte 0x<hh>`、`misplaced padding`、`truncated input` 或 `nonzero trailing bits`。

```lua
local auth = "Basic " .. tern.base64.encode(user .. ":" .. password)
local body = tern.base64.decode(part.body.data) -- URL-safe, unpadded
```

## 时间与环境

### `tern.now`

```lua
tern.now: () -> number
```

单调时钟上的毫秒数，带小数部分。起点是进程中的首次调用，因此只有差值有意义。

### `tern.getenv`

```lua
tern.getenv: (name: string) -> string?
```

此上下文进程中环境变量 `name` 的值；若未设置或不是有效 Unicode，则为 `nil`。host 上下文读取会话守护进程的环境（没有守护进程运行时则读取窗口的环境）；window 上下文读取 Tern 应用的环境。

### `tern.timer`

```lua
tern.timer: (ms: number, fn: (cx: WindowCx?) -> ()) -> TimerHandle

declare extern type TimerHandle with
	function cancel(self): ()
end
```

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| `ms` | `number` | 延迟毫秒数；负数按 0 处理 |
| `fn` | 函数 | 延迟结束后调用一次 |

返回一个句柄；`handle:cancel()` 会移除计时器，而在计时器已触发或 VM 不存在时不执行任何操作。

回调在拥有 VM 的线程上运行，不会与同一插件及上下文的其他处理器并发；它使用上下文的常规预算，钩子名为 `timer`。在 window 上下文中会收到一个新的 window `cx`；在 host 上下文中不接收参数。Host 端计时器回调失败时，会向每个窗口显示提示。

在 VM 被丢弃后调用（例如从跨越重载的回调中调用）会抛出 `the plugin is gone`。

```lua
local function tick(cx)
	cx:toast("info", "Still here")
	tern.timer(60000, tick)
end
tern.timer(60000, tick)
```

计时器不会重复；要重复执行，请在回调中重新安排。VM 重载时，其所有待处理计时器都会被丢弃。

### Awaitable 与 `tern.sleep`

```lua
type Awaitable<T> = {
	kind: string,
	id: number,
	next: (self: Awaitable<T>, fn: (result: T?, err: string?, cx: WindowCx?) -> ()) -> (),
}
tern.sleep: (ms: number) -> Awaitable<nil>
```

awaitable 保存异步操作在 VM 本地的身份和结果。`a:next(fn)` 会将 `fn(result, err, cx?)` 作为钩子 `await` 排入 VM 所属线程，并遵循常规回调预算。成功时 `err` 为 nil；失败时 `result` 为 nil 且 `err` 是字符串。Window 端回调会收到新的 `cx`。完成后注册的回调仍会排入队列，而不会当场直接调用。多个回调可以观察同一结果。

`tern.sleep(ms)` 会在有限且非负的毫秒数后以 nil 解析。所属 VM 会将其与普通计时器一起调度，不会阻塞 VM。

```lua
tern.sleep(100):next(function(_, err, cx)
	if err then error(err) end
	cx:toast("info", "Finished waiting")
end)
```

Carly 的 `lua` 调用使用 `await(a)` 而非回调。她的 VM 捕获 `print`，内存限制为 64 MiB，并提供 `loadstring`。`require("name")` 会加载已保存的片段；对于任意路径中的源代码，请使用 `tern.fs.read` 和 `loadstring`。她的环境、文件系统、进程和网络 API 具有普通 Window 端插件的能力，异步回调中也不例外。相对文件系统路径相对于她的 VM 工作目录解析；插件注册 API 仍不可用。常规参数验证、操作失败、截止时间和资源预算仍然适用。普通插件全局变量和预算保持不变。

## 存储

### `tern.kv`

```lua
tern.kv.get: (key: string) -> any
tern.kv.set: (key: string, value: any) -> ()
```

持久化的 JSON 值映射，保存在 `<data>/kv.json` 中。这是普通文件：Window 端应将凭据保存在 [`tern.secrets`](api-window.md#tern-secrets) 中。

| 函数 | 行为 |
| --- | --- |
| `get(key)` | `key` 下存储的值，转换自 JSON；若无则为 `nil` |
| `set(key, value)` | 存储 `value`；`nil`（或 `tern.json.null`）会删除该键。整个文件会以原子方式重写（临时文件后重命名），并采用美化格式 |

缺失的存储视为空映射。若无法读取存储或其中包含无效 JSON，`get` 和 `set` 都会抛出异常；这些失败不会静默返回 `nil` 或覆盖文件。最近一次成功加载的缓存会保留，但不会作为成功的回退结果提供：下次调用会重试加载。`set` 还会抛出 [JSON](#json) 下列出的 JSON 转换错误，以及文件无法写入时的 `tern.kv.set: <io error>`。

Host 端与 Window 端，以及每个窗口各自的 Window 端都共用同一个文件。每个 VM 都会在内存中保留映射，并在修改时间或长度变化时重新读取 `kv.json`，因此 `get` 能看到其他 VM 的写入，而 `set` 会修改当前映射，不会将过期副本写回。两个 VM 同时执行 set 时会发生竞争；最后一次重命名获胜。

```lua
local runs = (tern.kv.get("runs") or 0) + 1
tern.kv.set("runs", runs)
```

### `tern.fs`

```lua
tern.fs.read: (path: string, max_bytes: number?) -> string
tern.fs.write: (path: string, text: string) -> ()
tern.fs.list: (path: string) -> { string }
tern.fs.exists: (path: string) -> boolean
tern.fs.mkdir: (path: string) -> ()
tern.fs.remove: (path: string) -> ()
```

在此上下文运行的机器上进行同步文件访问。相对路径相对于插件目录（`tern.plugin.dir`）解析，而不是窗格的工作目录；不会展开 `~`。

| 函数 | 行为 | 抛出 |
| --- | --- | --- |
| `read(path, max_bytes?)` | 原始字节（不检查 UTF-8）；可选的非负整数字节上限要求目标为常规文件且不是符号链接 | `tern.fs.read <path>: <error>` |
| `write(path, text)` | 创建或截断文件并写入 `text`；父目录必须已存在 | `tern.fs.write <path>: <error>` |
| `list(path)` | 目录的条目名称，排序后作为数组返回 | `tern.fs.list <path>: <error>` |
| `exists(path)` | 路径是否存在（会跟随符号链接） | 从不 |
| `mkdir(path)` | 创建目录及缺失的父目录；若目录已存在则无妨 | `tern.fs.mkdir <path>: <error>` |
| `remove(path)` | 删除文件或符号链接，或连同其中所有内容一起删除目录 | `tern.fs.remove <path>: <error>` |

错误中的路径是解析后的绝对路径。

对不可信的小文件，使用 `tern.fs.read(path, 64 * 1024)`。指定上限时，会拒绝目录、FIFO、设备，以及最终路径组件为符号链接/重解析点的情况。检查的是已打开的句柄，而不仅是之前的路径状态：替换竞争无法将读取重定向到会阻塞的 FIFO 或设备。超大文件会在分配或读取其内容前被拒绝；检查后文件变大时，会通过最多 `max_bytes` 的缓冲字节和一次单字节探测检测到。Unix 和 Windows 上均已实现此行为。祖先目录中的符号链接仍会照常解析。不指定上限时，`read` 保持普通文件系统读取语义，包括跟随符号链接和无上限分配。上限不是墙钟期限：在较慢磁盘或网络文件系统上读取常规文件仍可能阻塞。

每次调用都会阻塞上下文线程。在 window 上下文中，这是受 50 ms 预算限制的 UI 线程：请保持读取量较小，并将大规模或耗时的工作移至 `tern.process.run`。

```lua
local notes = tern.plugin.data .. "/notes"
tern.fs.mkdir(notes)
tern.fs.write(notes .. "/today.md", "# Today\n")
```

## 进程

### `tern.process.run`

```lua
tern.process.run: ((argv: { string }, opts: ProcessOptions?, cb: (result: ProcessResult, cx: WindowCx?) -> ()) -> ())
	& ((argv: { string }, cb: (result: ProcessResult, cx: WindowCx?) -> ()) -> ())
	& ((argv: { string }, opts: ProcessOptions?) -> Awaitable<ProcessResult>)

type ProcessOptions = {
	cwd: string?,
	env: { [string]: string }?,
	stdin: string?,
	timeout_ms: number?,
}

type ProcessResult = {
	status: number,
	stdout: string,
	stderr: string,
	timed_out: boolean,
}
```

直接启动 `argv[1]` 并附带参数 `argv[2..]`（不经过 Shell），在此上下文所在机器上运行，并立即返回。进程退出且其输出被读取后，`cb` 会在 VM 线程上作为钩子 `process` 运行。

不提供 `cb` 时，`run(argv, opts?)` 会返回 `Awaitable<ProcessResult>`。在插件中使用 `:next(function(result, err, cx) ... end)`，或在 Carly 的 `lua` 工具中使用 `await(tern.process.run(argv, opts))`。启动失败仍会在调用时抛出；进程失败则由结果的状态表示，而不是 await 错误。

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| `argv` | `{ string }` | 程序和参数；程序通过 `PATH` 查找 |
| `opts` | `ProcessOptions?` | 可完全省略：`run(argv, cb)` |
| `cb` | 函数 | 接收结果；在 window 上下文中还会收到新的 window `cx` |

| 选项 | 默认值 | 含义 |
| --- | --- | --- |
| `cwd` | 插件目录 | 工作目录；相对路径相对于插件目录解析 |
| `env` | 无 | 添加到继承环境中的变量 |
| `stdin` | 空 | 写入 stdin 的字节，之后关闭 stdin |
| `timeout_ms` | 无 | 在此毫秒数后终止进程（值 ≤ 0 表示无超时） |

| 结果字段 | 含义 |
| --- | --- |
| `status` | 退出码；因超时终止或被信号结束时为 `-1` |
| `stdout` | 捕获的标准输出，最多 16 MiB（其余内容仍会读取并丢弃） |
| `stderr` | 捕获的标准错误，最多 16 MiB |
| `timed_out` | 当 `timeout_ms` 已到且进程被终止时为 `true` |

每个进程还会将 `TERN_PLUGIN_DATA` 设置为 `tern.plugin.data`。在 window 上下文中，还会将 `TERN_WINDOW_KEY` 设置为该窗口的窗口键（[`cx:window_key()`](api-window.md#window-上下文-cx)），因此运行的 `tern …` 命令会作用于该窗口的会话；`opts.env` 可以覆盖任一变量。

调用时会抛出：

- 参数不是 `(argv, cb)`、`(argv, opts, cb)` 或 `(argv, nil, cb)` 时，抛出 `tern.process.run(argv, opts?, cb): bad arguments`；
- `argv` 为空时，抛出 `tern.process.run: argv is empty`；
- 程序无法启动（找不到、不可执行、`cwd` 无效）时，抛出 `tern.process.run <program>: <error>`；
- 在任何情况下，只要运行于 iOS，就抛出 `tern.process is not available on iOS`。

非零退出码不算错误：检查 `status`。VM 被丢弃时（例如重新加载时），会丢弃待处理回调；进程本身会继续运行直至结束。Host 端回调失败时，会向每个窗口显示提示。

```lua
local repo = (tern.getenv("HOME") or "") .. "/src/project"
tern.process.run({ "git", "rev-parse", "--abbrev-ref", "HEAD" }, { cwd = repo, timeout_ms = 2000 }, function(r, cx)
	if r.status == 0 then
		cx:toast("info", "On branch " .. r.stdout:gsub("%s+$", ""))
	end
end)
```

（此示例来自 window 入口；在 host 入口中，`cx` 为 `nil`。）

## 网络

### `tern.fetch`

```lua
tern.fetch: ((url: string, opts: FetchOptions?, cb: (result: FetchResult, cx: WindowCx?) -> ()) -> ())
	& ((url: string, cb: (result: FetchResult, cx: WindowCx?) -> ()) -> ())
	& ((url: string, opts: FetchOptions?) -> Awaitable<FetchResult>)

type FetchOptions = {
	method: string?,
	headers: { [string]: string }?,
	body: string?,
	timeout_ms: number?,
}

type FetchResult = {
	status: number,
	headers: { [string]: string },
	body: string,
	error: string?,
	timed_out: boolean,
}
```

从此上下文所在机器的专属线程发送一个 HTTP/1.1 请求，并立即返回（使用回调时不返回内容，否则返回 awaitable）。在 host 上下文中，机器是会话守护进程所在的机器，因此远程主机上的插件会从该主机发起请求；在 window 上下文中，机器是显示该窗口的机器。收到完整响应或请求失败时，`cb` 会在 VM 线程上作为钩子 `fetch` 运行。与 `tern.process.run` 不同，此 API 可在 iOS 上使用。

不提供 `cb` 时，`fetch(url, opts?)` 会返回 `Awaitable<FetchResult>`。网络错误仍会设置 `result.error`；参数格式错误仍会在调用时抛出异常。回调形式保留其现有签名和钩子。

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| `url` | `string` | 绝对的 `http://` 或 `https://` URL，且已进行百分号编码（不会为你编码任何内容） |
| `opts` | `FetchOptions?` | 可完全省略：`fetch(url, cb)` |
| `cb` | 函数 | 接收结果；在 window 上下文中还会收到新的 window `cx` |

| 选项 | 默认值 | 含义 |
| --- | --- | --- |
| `method` | `"GET"` | 任意 HTTP 方法标记，不区分大小写（发送时会转为大写），因此 `"propfind"` 也可用 |
| `headers` | 无 | 请求头，名称 → 值；除非在此设置，否则 `User-Agent` 为 `Tern` |
| `body` | 无 | 请求正文的字节，以 `Content-Length` 发送。不提供 `body` 时不发送正文；`""` 会发送空正文 |
| `timeout_ms` | `30000` | 整个请求过程（连接、TLS、发送、响应头与正文、每次重定向）必须在此时间内完成，否则请求失败并令 `timed_out = true`。值 ≤ 0 表示使用默认值；`math.huge` 表示实际上不设限制 |

| 结果字段 | 含义 |
| --- | --- |
| `status` | HTTP 状态码。任何状态码都表示收到响应：404 或 500 不算错误。若设置了 `error`，则为 `0` |
| `headers` | 响应头，按小写名称返回；重复头的值以 `", "` 连接。若设置了 `error`，则为空 |
| `body` | 响应正文的字节（不检查 UTF-8），最多 16 MiB。若设置了 `error`，则为 `""` |
| `error` | 完整收到响应时为 `nil`；否则说明失败原因（找不到主机、连接被拒绝、TLS 失败、超时、重定向过多、正文超过 16 MiB，…） |
| `timed_out` | 当 `timeout_ms`（或默认的 30 秒）终止请求时为 `true` |

`error` 文本来自 HTTP 客户端（例如 `timeout: global`、`too many redirects`、`io: Connection refused (os error 61)`）；请直接显示，不要解析。

调用时会抛出（网络失败不会抛出；它们会通过 `result.error` 返回）：

- 参数不是 `(url, cb)`、`(url, opts, cb)` 或 `(url, nil, cb)` 时，抛出 `tern.fetch(url, opts?, cb): bad arguments`；
- URL 使用了其他协议、是相对 URL 或没有主机时，抛出 `tern.fetch <url>: not an absolute http or https URL`；
- URL、方法、请求头名称或请求头值格式错误时，抛出 `tern.fetch <url>: <reason>`；`<reason>` 来自 HTTP 库（例如 `invalid uri character`、`invalid HTTP method`、`invalid HTTP header name`、`failed to parse header value`）。

最多跟随 10 次重定向（超过时会以 `error` 失败）。重定向后不会再次发送 `Authorization` 请求头。若带有正文的请求收到 307 或 308 重定向，将以 `error` 失败，而不会重新发送正文。

HTTPS 证书会根据操作系统的信任存储进行验证。此上下文进程的代理环境变量（`ALL_PROXY`、`HTTPS_PROXY`、`HTTP_PROXY`、`NO_PROXY`，大小写均可）会生效。不会请求压缩，也不会在请求之间保留 cookie。连接会保持活动状态，并在同一 VM 的请求之间重复使用。并发请求数没有上限。

VM 被丢弃时（例如重新加载时），会丢弃待处理回调；请求本身会继续运行直至结束。Host 端回调失败时，会向每个窗口显示提示。

```lua
tern.fetch("https://api.github.com/repos/neovim/neovim/releases/latest", {
	headers = { Accept = "application/vnd.github+json" },
	timeout_ms = 10000,
}, function(r, cx)
	if r.error then
		tern.log.warn("release check failed", r.error)
	elseif r.status == 200 then
		cx:toast("info", "Neovim " .. tern.json.decode(r.body).tag_name)
	end
end)
```

（此示例来自 window 入口；在 host 入口中，`cx` 为 `nil`。）

```lua
tern.fetch("https://hooks.example.com/build", {
	method = "POST",
	headers = { ["Content-Type"] = "application/json" },
	body = tern.json.encode({ status = "done" }),
}, function(r)
	if r.error or r.status >= 300 then
		tern.log.warn("webhook failed", r.error or r.status)
	end
end)
```

## 相关页面

- [`tern.ui` 和 `tern.parse` 的界面构建器](ui.md)。
- [文件、进程与存储](../guides/io.md)：基于这些成员的使用模式，包括 `tern.fetch`。
- [限制](limits.md)：此处提到的所有上限。
