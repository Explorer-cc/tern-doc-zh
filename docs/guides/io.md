# 文件、进程与存储

两端共享同一套 I/O API：同步文件访问、小型键值存储、带回调的子进程和 HTTP 请求、计时器、JSON、环境变量和日志。每次调用都作用于其上下文运行所在的机器：Host 端作用于其服务窗格所在的机器，Window 端作用于显示该窗口的机器。

```lua
tern.process.run({ "git", "rev-parse", "--abbrev-ref", "HEAD" }, { cwd = "/srv/api" }, function(result, cx)
	if result.status == 0 and cx then
		cx:toast("info", "Branch", (string.gsub(result.stdout, "%s+$", "")))
	end
end)
```

## 哪台机器，哪个线程

| | Host 端 | Window 端 |
| --- | --- | --- |
| 机器 | 窗格运行所在的位置（会话守护进程所在的机器；远程主机窗格则是远程主机）。 | 显示窗口的机器；即使窗格属于远程主机也是如此。 |
| 线程 | 插件的工作线程。 | 窗口的 UI 线程。 |
| 每次调用的预算 | 2 s Lua 执行时间。 | 50 ms Lua 执行时间（chrome 格式化器和 `available` 中为 4 ms）。 |
| 回调 `cx` | 无。 | 一个新的 window `cx`。 |

`tern.fs` 和 `tern.kv` 是同步的：磁盘操作完成后调用才会返回。这段时间属于原生操作，因此不会计入调用处理器的 Lua 预算，只受十倍预算的墙钟时间限制；在 Window 端，它仍然占用 UI 线程，此时窗口不会绘制任何内容。读取小型配置文件没有问题；遍历目录树、读取大文件或访问网络文件系统应放在进程中，或放到 Host 端。绝不要阻塞 UI 线程：如果 `tern.fs.read` 没有设置 `max_bytes`，而读取对象是 FIFO 或挂载点已停止响应的文件，它会一直等到数据到来，预算无法中断它，窗口因此会卡住；对于任何可能不是普通文件的对象，都应传入 `max_bytes`。

## 文件：`tern.fs`

| 函数 | 功能 |
| --- | --- |
| `tern.fs.read(path) -> string` | 文件字节，以 Lua 字符串形式返回。 |
| `tern.fs.write(path, text)` | 写入 `text`，替换文件（非原子操作）。 |
| `tern.fs.list(path) -> {string}` | 目录中的条目名称，按顺序排序。 |
| `tern.fs.exists(path) -> boolean` | 路径是否存在。绝不抛出异常。 |
| `tern.fs.mkdir(path)` | 创建目录及其父目录。 |
| `tern.fs.remove(path)` | 删除文件、符号链接本身，或连同其中所有内容一起删除目录。 |

相对路径相对于插件目录（`tern.plugin.dir`）解析，因此 `tern.fs.read("templates/row.txt")` 会读取随插件一同提供的文件。绝对路径可指向用户有权访问的任何位置。操作失败时会抛出包含操作动词和路径的错误：`tern.fs.read /etc/nope: No such file or directory (os error 2)`。可能失败的调用应使用 `pcall` 包裹。

不要写入插件目录。Tern 会监视该目录，其中每次更改都会触发插件重新加载；而 `tern plugin install --force` 会替换该目录。请改为将状态写入 `tern.plugin.data`。

## 存储：`tern.kv`

`tern.kv.get(key)` 和 `tern.kv.set(key, value)` 按字符串键在 `<data>/kv.json` 中保存 JSON 值，其中 `<data>` 是 `tern.plugin.data`（`<state>/plugin-data/<id>/`，加载时创建）。使用 `nil`（或 `tern.json.null`）调用 `set` 会删除该键。

```lua
local runs = (tern.kv.get("runs") or 0) + 1
tern.kv.set("runs", runs)
tern.kv.set("last", { line = "cargo test", status = 0 })
```

每次 `set` 都会通过临时文件和重命名重写整个文件，因此读取者不会看到半写入的文件。值遵循 [JSON 规则](#json-tern-json)：不能包含函数或循环引用；除非空表被标记为数组，否则存储的空表 `{}` 读回时为空对象。

该文件属于插件所在机器上的插件；一个插件的两端以及所有窗口中的 Window 端都使用同一个文件。每个 VM 都会在内存中保留映射，并在磁盘文件发生变化（修改时间或长度不同）时重新读取，因此 `get` 能看到任一端最近一次 `set` 的内容，而 `set` 会更新当前文件，而不是写回过期副本。两个 VM 同时设置时仍会发生竞争：后完成的重命名会胜出。该存储用于保存少量状态：每次 `set` 都会序列化全部内容。

文件不存在时，存储为空。读取失败或 JSON 无效时会抛出错误，而不会返回缺失的键或覆盖文件。重新加载失败会保留上次成功的缓存，并在下次调用时重试。写入失败时会删除临时文件。

## 机密信息：`tern.secrets`

`kv.json` 是任何以你的身份运行的程序都可以读取的普通文件。Window 端改用系统钥匙串保存凭据（API 密钥、OAuth 令牌），通过 `tern.secrets.get(name)` 和 `tern.secrets.set(name, value)` 操作；传入 `nil` 值会删除机密信息。每个插件只能看到自己的机密信息。钥匙串解锁提示可能会阻塞，因此这两个调用都在 UI 线程之外运行，并返回 awaitable：

```lua
tern.secrets.set("api.token", token):next(function(_, err, cx)
	if err then cx:toast("error", "Keychain", err) end
end)
```

Host 端没有此功能。参见 [`tern.secrets`](../reference/api-window.md#tern-secrets)。

## 进程：`tern.process.run`

```text
tern.process.run(argv, opts?, callback)
tern.process.run(argv, opts?) -> Awaitable<ProcessResult>
```

它会在调用线程之外运行程序，并在程序退出时于所属线程调用 `callback(result, cx?)`。不传回调时，它会改为返回一个 [awaitable](../reference/api-shared.md#awaitable-与-tern-sleep)：程序退出时运行 `:next(function(result, err, cx) … end)`。

| 参数 | 含义 |
| --- | --- |
| `argv` | 程序及其参数，`{program, arg, …}`。不使用 shell：管道和通配符应写成 `{"sh", "-c", line}`。程序会从上下文进程的 `PATH` 中查找。 |
| `opts.cwd` | 工作目录。相对路径相对于插件目录解析，插件目录也是默认值。 |
| `opts.env` | 添加到继承环境中的变量。 |
| `opts.stdin` | 写入进程 stdin 的文本，写入后 stdin 会关闭。不设置时，stdin 会立即关闭。 |
| `opts.timeout_ms` | 经过这么多毫秒后终止进程。 |
| `callback` | 可选。`fn(result, cx?)`；不传回调时调用会返回 awaitable。 |

每个进程还会获得 `TERN_PLUGIN_DATA`，即插件的数据目录。Window 端的进程还会获得 `TERN_WINDOW_KEY`，即插件窗口的键（`cx:window_key()`），因此它们运行的 `tern ls`、`tern split` 和其他 `tern …` 命令会作用于该窗口，而不是第一个窗口。它们的 `TERN_PANE` 和 `TERN_PANE_SOCKET` 为空：即使 Tern 自身是从某个窗格启动的，这些命令也不会因此作用于该窗格所属的窗口。

结果：

| 字段 | 含义 |
| --- | --- |
| `status` | 退出码；进程被终止（超时）或因信号结束时为 `-1`。 |
| `stdout` | 捕获的标准输出，最多 16 MiB（其余内容会读取后丢弃）。 |
| `stderr` | 捕获的标准错误，最多 16 MiB。 |
| `timed_out` | 若进程因 `timeout_ms` 到期而被终止，则为 `true`。 |

无法启动的程序会在调用时抛出错误：`tern.process.run nope: No such file or directory (os error 2)`。空的 `argv` 也会抛出错误。参数形状错误时会抛出 `tern.process.run(argv, opts?, cb): bad arguments`。

在 `tern.process.run` 返回之前，进程会在调用线程上启动；只有等待和读取操作会在其他位置进行。启动通常很快，但 Window 端启动缓慢时（例如环境变量很多，或 Windows 上的杀毒软件扫描），UI 线程会被占用相应时间。这会计入调用的墙钟时间，而非 Lua 预算。

回调会像任意处理器一样在上下文自己的线程上运行，并使用该上下文的预算；它作为 `process` hook 运行（awaitable 的 `:next` 回调则作为 `await` hook 运行）：Window 回调会获得新的 `cx` 和 50 ms；Host 回调不会获得 `cx`，预算为 2 s。重新加载时被丢弃的 VM，其回调不会运行。

iOS 上没有进程：`tern.process.run` 会抛出 `tern.process is not available on iOS`。如果 Window 端也需要在 iPad 上运行，请检查 `tern.runtime.os`。

## 网络：`tern.fetch`

```text
tern.fetch(url, opts?, callback)
tern.fetch(url, opts?) -> Awaitable<FetchResult>
```

它会在调用线程之外发送一个 HTTP 请求，并在完整响应到达或请求失败时，于所属线程调用 `callback(result, cx?)`；不传回调时，它会返回一个 awaitable。使用它与 Web API、webhook 和本地服务器通信，而不必启动 `curl`。与进程不同，它在 iOS 上也可用，因此 iPad 上的 Window 端可通过这种方式访问网络。

请求从上下文所在的机器发出：Host 端从会话守护进程所在的机器发出（远程主机的插件则从该主机发出），Window 端从显示窗口的机器发出。

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

（这是 Window 端入口；在 Host 端入口中，`cx` 为 `nil`。）`opts` 接受 `method`（默认为 `"GET"`）、`headers`、`body` 和 `timeout_ms`（默认为 30 s，适用于整个请求过程）：

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

按以下顺序检查结果：

- 设置了 `error` 表示未收到完整响应：主机不存在、连接被拒绝、TLS 失败、超时、重定向次数过多或响应正文超过 16 MiB。此时 `status` 为 `0`、`headers` 为空、`body` 为 `""`。显示错误文本；不要解析它。
- 若请求因超时而结束，`timed_out` 为 `true`（此时也会设置 `error`）。
- 否则，`status` 就是服务器返回的状态。404 或 500 是响应，不是错误：应检查它。

网络故障绝不会抛出异常。只有调用格式错误时才会抛出异常：参数形状错误、URL 不是绝对的 `http://` 或 `https://` URL，或 URL、方法或标头格式错误。URL 必须已进行百分号编码。重定向最多跟随 10 次；HTTPS 证书会根据系统信任存储进行验证，并遵循上下文进程的代理变量。所有细节请参阅 [共享 API](../reference/api-shared.md#网络)。

回调与进程回调一样，作为 `fetch` hook 运行：Window 回调会获得新的 `cx` 和 50 ms；Host 回调不会获得 `cx`，预算为 2 s。重新加载时被丢弃的 VM，其回调不会运行；请求本身仍会继续，直到结束。

## 计时器与时间

`tern.timer(ms, fn)` 会在从现在起 `ms` 毫秒后调用 `fn` 一次（负数按 0 处理），并返回一个调用 `cancel()` 后可丢弃计时器的句柄；计时器触发后再取消则没有效果。在 Window 端，`fn` 会收到一个新的 `cx`。要创建重复计时器，请在回调中重新安排：

```lua
local function tick(cx: WindowCx?)
	if cx then
		cx:toast("info", "Still here")
	end
	tern.timer(60000, tick)
end
tern.timer(60000, tick)
```

插件的所有计时器回调都作为 `timer` hook 运行，所有进程回调都作为 `process` hook 运行，所有 fetch 回调都作为 `fetch` hook 运行。超出预算的 hook 会暂停（5 s；反复超限时暂停更久），因此一个运行缓慢的计时器回调会让该插件的所有计时器回调都暂停，直到暂停结束；这期间到期的计时器随后会各运行一次。VM 重新加载时，计时器会终止。

`tern.now()` 返回单调递增的毫秒数，带小数部分，从进程中第一次调用时开始计数。用它测量时长；它不是墙上时钟，而且 Host 端与 Window 端（通常是独立进程）不共享起点。

## JSON：`tern.json`

| 函数 | 功能 |
| --- | --- |
| `tern.json.encode(value, pretty?) -> string` | 编码 Lua 值；`pretty` 会启用缩进。 |
| `tern.json.decode(text) -> any` | 解码 JSON 文本；输入无效时会抛出 `tern.json.decode: …`。 |
| `tern.json.array(t?) -> t` | 将 `t`（或新建的表）标记为数组。 |
| `tern.json.null` | 表示 JSON `null` 的值。 |

编码规则：

- 键恰为 `1..n`（n > 0）的表是数组；任何其他非空表都是对象。对象的整数和数字键会转成字符串。
- 空表编码为 `{}`，除非它被标记为数组；标记后编码为 `[]`。可能为空的列表应使用 `tern.json.array` 标记。
- 对象键会排序，因此同一个表始终编码为相同文本。
- ±2^53 范围内的整数会编码为整数。NaN、正负无穷大、函数、userdata、字符串和数字以外的键，以及嵌套深度超过 128 的数据（循环引用）都会抛出错误。
- `nil` 不能放在表中；数组项或成员需要表示 `null` 时，请使用 `tern.json.null`。

解码规则：数组会以数组标记形式返回（重新编码时仍保留 `[]`）；值为 `null` 的数组项会变成 `tern.json.null`，而值为 `null` 的对象成员会从表中省略。

```lua
local doc = tern.json.decode('{"tags": [], "owner": null}')
-- doc.tags is an empty, array-tagged table; doc.owner is nil
tern.json.encode(doc) --> {"tags":[]}
```

## 环境变量与日志

`tern.getenv(name)` 会读取上下文进程的环境变量：Host 端读取会话守护进程（或在没有会话守护进程时运行窗格的窗口）的环境；Window 端读取 Tern 应用的环境。从 Dock 或桌面启动器启动的应用，其环境可能比你的 shell 更精简；不要依赖 shell 配置文件添加的 `PATH` 项。

`tern.log.debug|info|warn|error(...)` 会将内容写入 Tern 日志，目标为 `tern::plugin`，字段为 `plugin = <id>`；参数会经过 `tostring` 转换并以制表符连接。全局 `print` 等同于 `tern.log.info`。除非 `STENCIL_LOG` 要求记录更多内容，否则该目标只记录警告和错误；参见[调试](debugging.md#日志)。

## 绝不阻塞 UI 线程

Window 处理器运行在 UI 线程上，只有它返回后窗口才会绘制。50 ms 预算会阻止处理器失控，但如果某个处理器在每次紧邻按键的事件中都耗时 30 ms，用户已经能明显感觉到卡顿。

- 使用 `tern.process.run` 运行程序；绝不要循环等待文件出现。
- Window 处理器中的 `tern.fs` 调用应限于小型本地文件；网络挂载上的路径可能会卡住数秒。
- 将工作分散到多个 `tern.timer` 回调中，或移至 Host 端；其工作线程只会让自身停滞。
- 缓存格式化器所需的数据：格式化器会在窗口绘制时运行，时间预算不到 4 ms。

## 另请参阅

- [运行时、预算与 JIT](../concepts/runtime.md)：预算及超限后会暂停什么。
- [共享 API](../reference/api-shared.md)：准确签名。
- [信任与安全](../concepts/security.md)：文件和进程访问对用户意味着什么。
- [长时间运行的命令](../examples/longrun.md)：完整插件中的进程和计时器。
