# 错误

插件作者或用户可能遇到的每条消息，按出现位置分组，并说明原因和修复方法。引号中的文本是精确原文；`<…>` 表示可变部分。大多数消息通过以下五种渠道之一传达给你：

| 渠道 | 接收到的内容 | 查看位置 |
| --- | --- | --- |
| 抛出的错误 | 对 `tern` 的调用拒绝了其参数 | 调用方的处理器失败；`pcall` 会捕获它 |
| 处理器提示 | 处理器抛出错误、超出预算或返回错误值 | “Plugin *name*: *hook* failed”，下方显示错误的首行 |
| 问题 | 文件夹条目不是可用插件 | `tern plugin list`、Preferences › Plugins、“plugins have problems” 提示 |
| 加载失败状态 | 插件条目未能加载 | `tern plugin list`（host）、Preferences、“Plugin *name* failed to load”（window） |
| 日志 | 运行时报告，包含完整错误文本和回溯 | `tern-daemon.log` 或窗口的 `tern.log`；参见[调试](../guides/debugging.md) |

## 处理器失败

处理器抛出错误时，只有该次调用失败，其他部分不会随之失败：插件继续运行，其状态保留处理器在抛出错误前所做的修改。Tern 会记录 `plugin handler failed`（warn），包含插件、hook、完整错误及其回溯，并显示提示：

```text
Plugin Kubernetes: pods.view failed
/Users/me/src/tern-k8s/host.luau:42: attempt to index nil with 'items'
```

第一行指出插件（其 manifest 中的 `name`）和 **hook**；第二行是错误的首行。Hook 名称列于[运行时、预算与 JIT](../concepts/runtime.md#预算超限)。Host 端失败时，涉及窗格所在的窗口会显示提示；计时器、进程和 fetch 回调以及 `spawn` 的失败会在 host 的每个窗口中显示提示。Window 端失败则只在该窗口显示提示。

| 消息 | 原因 | 修复方法 |
| --- | --- | --- |
| `tern: <hook> exceeded <n> ms` | 调用运行时间超过预算：2000（Host）、50（Window）或 4（格式化器、`available`）。该调用中此后的每次中断都会再次抛出错误，因此 `pcall` 无法恢复 | 将工作移至 `tern.process.run`，拆分到多个 `tern.timer` 回调中，或限制输入规模。该 hook 会在此 VM 中暂停，首次暂停 5 秒，重复超限时会更久 |
| `tern: <hook> is paused for <n> s after exceeding its budget` | 某个先前超限且仍处于暂停状态的 hook 被调用；调用会跳过而不运行，记录为 debug，且不会显示提示 | 修复运行缓慢的 hook；暂停结束后它会再次运行，或在执行 `tern plugin reload <id>` 后立即运行 |
| Luau 内存错误 | VM 达到 256 MiB | 少保留状态；释放对大型字符串和表的引用 |
| `cx is already in use` | 对同一个 Window `cx` 的另一次调用仍在运行时，又调用了该 `cx`（例如来自嵌套处理器） | 使用处理器收到的 `cx`，每次只进行一个调用 |
| `the plugin is gone` | VM 已被丢弃后调用了 `tern.timer`（来自一个在重新加载后仍存活的回调） | 无需处理；旧 VM 已不存在 |

块的 `init` 抛出错误也会终止该块：错误和回溯会打印在窗格中，窗格以状态码 1 退出。

## 加载失败

条目加载失败的插件状态为 **Failed**；其他插件照常加载。

| 消息 | 位置 | 原因 | 修复方法 |
| --- | --- | --- | --- |
| 提示“Plugin *name* failed to load”，下方显示错误的首行 | Window | `window.luau` 抛出错误、超出 50 ms 预算或无法读取 | 修复条目；只有失败发生变化时才会再次显示提示 |
| `failed: <first line>`（见 `tern plugin list`），Preferences 中状态为 Failed | Host | `host.luau` 抛出错误或超出 2 s 预算 | 修复条目；重新加载 |
| `block <id> is declared in plugin.toml but not defined with tern.block.define` | Host | manifest 声明了一个入口未定义的块 | 在 `host.luau` 中调用 `tern.block.define("<id>", …)`，或删除 `[[blocks]]` 表 |
| `lens <id> is declared in plugin.toml but not defined with tern.lens.define` | Host | Lens 同上 | 调用 `tern.lens.define`，或删除 `[[lenses]]` 表 |
| `cannot read <path>: <io error>` | 任一端 | 入口文件已消失或无法读取 | 恢复该文件 |
| `the plugin's worker stopped` | Host | 工作线程在报告前结束 | 检查日志中是否有崩溃信息 |
| `cannot start the plugin's worker: <error>` | Host | 操作系统拒绝创建新线程 | 释放资源；重新加载 |
| 提示“1 plugin has problems”或“*N* plugins have problems”，下方显示第一条错误 | Window | Host 的插件清单发生变化，包含问题项或状态为 Failed 的插件 | 运行 `tern plugin list` 查看全部问题 |

这些消息同时会写入日志：`plugin failed to load`（host）、`plugin window entry failed to load`（window）、`not a usable plugin`（每个问题）。

## 插件文件夹问题

不能作为插件的文件夹条目会连同其目录一起列为问题，且不会加载任何内容。修复方法见[清单参考](manifest.md)。

| 消息 | 原因 |
| --- | --- |
| `no plugin.toml` | 顶层没有 manifest 的目录 |
| `cannot read plugin.toml: <io error>` | manifest 无法读取或不是 UTF-8 |
| `plugin.toml is larger than 64 KiB` | |
| `missing schema`, `unsupported schema <n>`, `schema must be an integer` | `schema` 缺失、不是 `1` 或不是整数 |
| `invalid id "<id>" (lowercase letters, digits and -, 1-32 long)` | |
| `name must be 1-64 characters` | |
| `needs a host or window entry` | 既没有 `host`，也没有 `window` |
| `<host\|window\|style> "<path>" must be a relative path inside the plugin` | 路径为绝对路径、包含 `..` 或为空 |
| `<host\|window> "<path>" must be a .luau or .lua file` | |
| `blocks need a host entry`, `lenses need a host entry` | `[[blocks]]` 或 `[[lenses]]` 没有 `host` |
| `invalid block id "<id>"`, `duplicate block id "<id>"` | |
| `invalid lens id "<id>"`, `duplicate lens id "<id>"`, `lens "<id>" needs at least one match pattern` | |
| ``unknown field `<key>`, expected one of …``, ``missing field `<key>` ``, `invalid type: …` | TOML 键和类型（解析器的原始文本） |
| `missing entry <path>` | `host` 或 `window` 文件不存在 |
| `cannot read style <path>: <io error>`, `styles are larger than 256 KiB` | |
| `duplicate id <id>` | 按名称顺序在前面的条目已经使用此 id；删除或重命名其中一个 |
| `too many plugins` | 有效包超过 64 个；按 id 排序后超过第 64 个的包会被排除 |
| `cannot read link: <io error>` | `<name>.path` 文件无法读取 |
| `link target "<text>" is not an absolute path` | `.path` 文件内容是相对路径；使用 `tern plugin link` 重新链接 |
| `link target <dir> is not a directory` | 链接的包已移动或被删除；运行 `tern plugin unlink` 或重新链接 |

## 注册错误

由注册调用抛出，通常发生在条目加载期间（导致插件加载失败）或处理器中。

| 消息 | 原因 |
| --- | --- |
| `tern.block.define: block "<id>" is not declared in plugin.toml` | 先在 `[[blocks]]` 表中声明该块 |
| ``tern.block.define: <id>: `<init\|view>` must be a function`` | 缺少必需的处理器，或其不是函数 |
| `tern.block.define: <id>: unknown font "<x>" (mono, sans)` | `font` 既不是 `"sans"`，也不是 `"mono"` |
| `tern.lens.define: lens "<id>" is not declared in plugin.toml` | 先在 `[[lenses]]` 表中声明该 Lens |
| ``tern.lens.define: <id>: `<open\|line\|finish\|view>` must be a function`` | 缺少必需的处理器，或其不是函数 |
| `tern.on: unknown host event "<name>" (spawn, command_started, command_finished, cwd, title, pane_exited)` | host 上下文不会提供的事件名称（参见[事件](events.md#host-事件)） |
| ``tern.on: unknown window event `<name>` `` | window 上下文不会提供的事件名称（参见[事件](events.md#window-事件)） |
| ``tern.command: bad id `<id>` (letters, digits, `_` and `-`; not `bind`)`` | |
| `tern.bind: the action is a name or a function` | 第二个参数两者都不是 |
| ``tern.override: unknown command `<id>` `` | 不是内置命令 id（参见[内置操作](actions.md#命令)） |
| ``tern.css: bad name `<name>` (letters, digits, `_` and `-`; not `styles`)`` | |
| ``tern.files.button: bad id `<id>` (letters, digits, `_` and `-`)`` | |
| ``attempt to index nil with 'define'``, `attempt to call a nil value` | 使用了另一个上下文的成员：`window.luau` 中的 `tern.block.define`，或 `host.luau` 中的 `tern.command`（参见[上下文](api.md#上下文)） |

`tern.bind` 在调用时不会检查其他内容。重建快捷键映射时，无法解析按键组合或动作的绑定会被排除，并记录 `plugin bind left out` 及原因（``unknown action `<name>` ``、``unknown modifier `<m>` ``）；其按键已被预设绑定的项目会记录为 `plugin bind left out: the preset binds these keys`。

## 返回值

处理器返回的结构不正确时，会像抛出错误一样失败，并归于其 hook 名称下。

| 消息 | 钩子 | 原因 |
| --- | --- | --- |
| `view: expected {main?, dock?, layer?}, got <value>` 和 [视图模型](api-host.md#视图模型) 下列出的节点错误 | `<block>.view` | 块视图格式错误；最后一个有效视图会保留 |
| `spawn must return a spec table or nil, got <type>` | `spawn` | 过滤器返回了字符串、数字或布尔值；其结果会被忽略 |
| `a route returns a decision table or nil` | `route.open`, `route.link` | |
| `a route decision sets block, url, path or handled = true` | `route.open`, `route.link` | 表中没有任何决策键 |
| ``a route decision has an unknown how `<how>` `` | `route.open`, `route.link` | `how` 不是 `default`、`beside`、`below`、`split`、`tab`、`replace`、`over` 或 `preview` |
| `a title formatter returns a string or nil` | `tab_title`, `window_title` | |
| `a status formatter returns a list of segments or nil` | `status` | |

路由处理器失败时会被视为拒绝处理；随后运行下一个处理器，或由 Tern 自行打开。

## API 错误

由 `tern` 成员抛出；各成员页面会在具体上下文中说明。

| 消息 | 抛出方 | 原因 |
| --- | --- | --- |
| `cannot encode a <type> as JSON`, `cannot encode a <type> key as JSON`, `cannot encode <n> as JSON`, `cannot encode tables nested this deep (or cyclic) as JSON` | `tern.json.encode`、`tern.kv.set`、任何发送 Lua 值的接口（视图、`save`、`spawn`） | 函数、userdata、非字符串键、NaN 或无穷值、循环引用或超过 128 层的嵌套 |
| `tern.json.decode: <parser message>` | `tern.json.decode` | JSON 无效 |
| `tern.base64.decode: <reason>` | `tern.base64.decode` | 不是 base64：``invalid character `<c>` ``（包括与文本开头所用字母表不同的字符）、`invalid byte 0x<hh>`、`misplaced padding`、`truncated input` 或 `nonzero trailing bits` |
| ``tern.secrets.get: bad name `<name>` …``, ``tern.secrets.set: bad name `<name>` …`` | `tern.secrets.get`、`set`（awaitable 失败） | 名称不匹配 `[a-z0-9][a-z0-9._-]{0,63}` |
| `tern.secrets.set: the value is <n> bytes, more than 65536` | `tern.secrets.set`（awaitable 失败） | 值超过 64 KiB |
| `tern.secrets.get: <store error>`, `tern.secrets.set: <store error>` | `tern.secrets.get`、`set`（awaitable 失败） | 系统钥匙串不可用，或已锁定且用户拒绝解锁 |
| `tern.kv.set: <io error>` | `tern.kv.set` | 无法写入 `kv.json` |
| `tern.fs.<verb> <path>: <io error>` | `tern.fs.read`、`write`、`list`、`mkdir`、`remove` | 操作失败 |
| `tern.process.run: argv is empty` | `tern.process.run` | |
| `tern.process.run <program>: <io error>` | `tern.process.run` | 程序无法启动（不存在或不可执行） |
| `tern.process.run(argv, opts?, cb): bad arguments` | `tern.process.run` | `argv` 后的参数不是 `cb` 或 `opts, cb` |
| `tern.process is not available on iOS` | `tern.process.run` | iOS 禁止启动进程；根据 `tern.runtime.os` 分支处理 |
| `tern.fetch(url, opts?, cb): bad arguments` | `tern.fetch` | 参数不是 `(url, cb)`、`(url, opts, cb)` 或 `(url, nil, cb)` |
| `tern.fetch <url>: not an absolute http or https URL` | `tern.fetch` | 使用了其他 URL 协议、相对 URL 或没有主机部分 |
| `tern.fetch <url>: <reason>` | `tern.fetch` | URL、方法、标头名称或标头值格式错误；`<reason>` 来自 HTTP 库（`invalid uri character`、`invalid HTTP method`、`invalid HTTP header name`、`failed to parse header value`）。网络故障不会抛出错误；它们会出现在 `result.error` 中 |
| `tern.ui.<builder>: <argument>: <problem>` | `tern.ui.*` | 参见[参数转换](ui.md#参数转换) |
| `tern.parse.<f>: lines…: expected …` | `tern.parse.*` | 参见[解析器](ui.md#解析器) |
| `cx:frame: ops must be a list` | Block `cx:frame` | |
| `no program runs in that pane` | Window `cx:run` | 窗格中没有正在运行的终端 |
| ``unknown command `<id>` `` | Window `cx:command` | 不是内置命令 id |
| ``unknown toast level `<level>` (success, info or error)`` | Window `cx:toast` | Host `cx:toast` 接受任意级别 |
| ``unknown how `<how>` `` | Window `cx:open`、`cx:new_block` | |
| ``unknown direction `<dir>` (right, down, left or up)`` | `cx.layout` 方法 | |
| `tern.chrome.refresh: not from a formatter` | `tern.chrome.refresh` | 在 Chrome 格式化器运行时调用；应从定时器、事件或命令调用 |
| ``tern.chrome.program_icon: unknown icon `<name>` `` | `tern.chrome.program_icon` | Tern 中没有该名称的图标；参见[图标名称](../elements/data.md#图标名称) |
| `tern.chrome.program_icon: empty program` | `tern.chrome.program_icon` | 程序名为空 |

## 无法启动的块

| 消息 | 原因 | 修复方法 |
| --- | --- | --- |
| 提示“Could not start the block” / `no block type <kind> on this host` | 块窗格所在的 Host 没有定义此类型的 Ready 插件：会话守护进程（或没有守护进程时的窗口）被要求启动该块。窗格会显示内容相同、带 Retry 的“Could not start the block”卡片 | 在运行该窗格的 Host 上安装或启用插件；检查其状态 |
| 提示“Could not open the block” / `No plugin on <host> defines block type <kind>` | `tern.route.open` 或 `tern.route.link` 的决策指定了某种类型，但文件所在 Host（或链接窗格所在 Host）上没有 Ready 插件定义它；没有打开任何内容 | 在该 Host 上安装插件，或仅在 Host 有该插件时返回此决策（`req.host`） |
| 窗格中打印 `no block type <kind> on this host`，退出状态码为 1 | 重新加载后块所属插件或类型已不存在 | 恢复插件，然后重新启动该块 |
| ``could not start block `<kind>` ``，这是 `cx.layout:tab` 返回的第二个值（不会抛出错误或显示提示） | 工作区的一个叶节点指定了某种类型，但 Host 上没有 Ready 插件定义它。第一个叶节点：不会打开任何标签页（ID 为 `nil`）。后续叶节点：该节点及其子树会被排除，其余内容仍会构建并命名。多个错误以逗号分隔 | 在该 Host 上安装插件，或修正类型 |

块类型属于运行窗格的 Host：远程 Host 需要在该处安装插件。iOS 不运行 Host 端，因此插件块只能运行在 iOS 设备连接到的 Host 上。

## 仅记录到日志的消息

这些消息会以 warn 级别写入日志，且从不显示提示：

| 消息 | 含义 |
| --- | --- |
| `plugin spawn filter took over 50 ms; skipped` | 插件的 `spawn` 答复来得太晚，已被丢弃 |
| `plugin keeps re-rendering; requests dropped` | 经过 8 轮后 `cx` 请求仍在队列中（某个 `view` 调用了 `cx:render`） |
| `plugin hook exceeded its budget; paused` | 预算超限（也会显示一次提示），并带有 `paused_ms` |
| `plugin hook resumed after its pause` | 超限 hook 的暂停已结束 |
| `plugin style sheet has errors` | `styles` 或 `tern.css` 中的 CSS 解析不完整；有效规则仍会生效 |
| `plugin worker didn't retire in time` | 重新加载等待旧工作线程 3 秒后仍未结束 |
| `cannot create the plugin data directory` | 无法创建 `<state>/plugin-data/<id>`；`tern.kv` 写入会失败 |
| `cannot hand a process result to Lua` | 已结束进程的输出无法转换为 Lua 表 |

## 命令行

`tern plugin` 会将错误以 `tern plugin: <message>` 的形式打印到标准错误。用法错误以状态码 2 退出并打印用法信息；其他错误以状态码 1 退出，若守护进程未及时响应则以 124 退出。

| 消息 | 动词 | 原因 |
| --- | --- | --- |
| `plugin takes other arguments` | 任意 | 缺少动词、动词未知或单词数量不正确 |
| `unknown flag --<name>` | 任意 | |
| `--window takes a value` | 任意 | |
| `no daemon running` | `reload` | 启动 Tern，或使用 `list` |
| `the session daemon did not answer` | `reload` | 60 秒后以状态码 124 退出；Host 入口可能加载缓慢 |
| `no config directory for plugins` | `dir`、`install`、`remove`、`link`、`unlink` | 机器没有配置目录 |
| `<id> is already installed (<dir>); --force replaces it` | `install` | |
| `<id> is linked (<dir>); use unlink first` | `install` | 有无 `--force` 均如此 |
| `<id> is already installed (<dir>)` | `link` | 已安装的副本使用了此 id |
| `<id> is linked; use unlink` | `remove` | |
| `<id> is installed, not linked; use remove` | `unlink` | |
| `no plugin <id> in <dir>` | `remove`、`unlink` | |
| `no plugin id <id>` | `remove`、`unlink` | 为空、以 `.` 开头或包含路径分隔符 |
| `no directory <path>: <io error>`, `<path> is not a directory` | `install`、`link` | |
| `<dir> is not a plugin: <why>` | `install`、`link` | `no plugin.toml` 或加载器报告的任何[文件夹问题](#插件文件夹问题)（`missing entry <path>`、`cannot read style <path>: <io error>`、…） |
| `<dir> is not UTF-8` | `link` | |
| `installing from git needs git` | `install` | |
| `git clone <url> failed: <git's message>` | `install` | |

成功更改后，输出中可能会接着出现以下消息（启用 `--json` 时写入标准错误），但不会改变退出码：`no daemon running; changes apply at next start`、`the daemon did not reload its plugins: <error>`，以及 `list` 输出中的 Failed 插件和问题行。参见[命令行](cli.md)。

## 相关页面

- [调试](../guides/debugging.md)：阅读日志并复现失败。
- [运行时、预算与 JIT](../concepts/runtime.md#故障与提示消息)。
- [限制](limits.md)。
