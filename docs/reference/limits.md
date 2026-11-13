# 限制

插件运行时施加的每一项固定上限、超时和默认值，以及其数值和触及边界时的行为。它们均不可配置。概念页面会解释每项限制存在的原因；本页是供查阅的速查表。

## 软件包与清单

| 限制 | 数值 | 达到限制时 |
| --- | --- | --- |
| `plugin.toml` 大小 | 64 KiB | 问题 `plugin.toml is larger than 64 KiB` |
| 清单 schema | `1` | 问题 `unsupported schema N` |
| 插件、块和 lens ID | `^[a-z][a-z0-9-]{0,31}$`（1–32 字节） | 问题 `invalid id …`、`invalid block id …`、`invalid lens id …` |
| 插件 `name` | 1–64 个 Unicode 字符 | 问题 `name must be 1-64 characters` |
| Lens `match` 模式 | 每个 Lens 至少 1 个 | 问题 `lens "x" needs at least one match pattern` |
| `styles` 总大小 | 合并后 256 KiB | 问题 `styles are larger than 256 KiB` |
| 每个 host 的插件数 | 按 ID 计，最多 64 个有效软件包 | 第 64 个之后的每个插件都会出现问题 `too many plugins` |
| `tern.command` ID、`tern.css` 名称 | ASCII 字母、数字、`_`、`-`；不能为空；不能是 `bind` / `styles` | 调用时抛出错误 |
| 默认图标 | `puzzle` | 用于未知或缺失的图标 |

参见[清单参考](manifest.md)。

## VM 与预算

| 限制 | 数值 | 达到限制时 |
| --- | --- | --- |
| 每个 VM 的内存 | 256 MiB | 分配内存的调用抛出 Luau 内存错误 |
| Host 调用预算 | 每次调用 2 s Lua 时间，包括运行 `host.luau` | 抛出 `tern: <hook> exceeded 2000 ms`；该 VM 中的 hook 暂停 |
| Window 调用预算 | 每次调用 50 ms Lua 时间，包括运行 `window.luau` | 抛出 `tern: <hook> exceeded 50 ms`；hook 暂停 |
| Chrome 格式化器和 `available` | 每次调用 4 ms Lua 时间 | 抛出 `tern: <hook> exceeded 4 ms`；hook 暂停 |
| 每次调用的墙钟时间（包括原生调用） | 预算的 10 倍（20 s、500 ms、40 ms） | 抛出 `tern: <hook> exceeded <n> ms, native calls included`；hook 暂停 |
| 嵌套调用 | 外层调用的截止时间（如果更早） | |
| 暂停的 hook | 首次触发后 5 s；若在上次暂停结束后的 10 min 内再次触发，则时长翻倍，最多 5 min；连续 10 min 未触发后恢复为 5 s。重新加载会结束暂停 | 跳过调用：`tern: <hook> is paused for <n> s after exceeding its budget`，并以 debug 级别记录；暂停结束后会运行到期的 timer、process、fetch 和 await 回调 |

Lua 时间不包括原生调用（Tern 的 API、`tern.fs`、`tern.kv`、启动进程、编译模块、耗时的内置函数）和等待 CPU 的时间。预算在 Luau 中断点（函数调用、返回和循环迭代）处检查：原生调用会在检查前完成，而永不返回的调用（例如对 FIFO 执行不设上限的 `tern.fs.read`）会挂起其线程。参见[运行时、预算与 JIT](../concepts/runtime.md#预算)。

## Host 工作线程

| 限制 | 数值 | 达到限制时 |
| --- | --- | --- |
| `spawn` 过滤器等待时间 | 每个插件 50 ms | 丢弃该插件的回答；记录 `plugin spawn filter took over 50 ms; skipped` |
| 重新加载时等待工作线程退出 | 3 s 以释放其块 | 记录 `plugin worker didn't retire in time`；重新加载继续进行 |
| 单次调用之后的 `cx` 请求轮数 | 8 | 丢弃仍排队的请求（例如调用 `cx:render` 的 `view`）；记录 `plugin keeps re-rendering; requests dropped` |
| 每个插件的 Lens 捕获状态数 | 256 | 优先丢弃已完成的捕获，按最近最少使用顺序；下次收到事件时，会根据块的输出重建被丢弃的捕获 |
| Host 记住其插件的 Lens 块数 | 4096 | 忘记最早的块；通过重新认领该块的命令来路由其事件 |
| `tern plugin reload` 等待时间 | 60 s | `the session daemon did not answer`，退出码 124 |

## Lens

| 限制 | 数值 | 达到限制时 |
| --- | --- | --- |
| 命令运行期间的视图 tick | 每个块每 250 ms 一个 `view`，且仅在有新行时触发 | 行会累积到下一次 tick；`finish` 始终会触发最终的 `view` |
| 每条命令捕获的输出 | 16 MiB | 放弃捕获；输出保留为普通终端文本 |
| Lens 视图等待其块的时间 | 5 s | 如果视图先于窗口显示其 Lens 块而到达窗口，则会重试直至块出现；5 s 后或窗格消失时丢弃 |
| `tern.parse.json_tree` 节点 | 5000 | 其余内容由一条溢出行汇总 |

Tern 内置的 Lens 也会在 5000 行处停止，并添加 `tern.ui.overflow(n)` 行；`tern.ui.table` 等插件构建器不会截断内容，因此请自行限制较长视图的长度。

## 块

| 限制 | 数值 | 达到限制时 |
| --- | --- | --- |
| 帧消息大小 | 64 KiB | 更大的帧会拆分为多个分块，由 Surface Protocol 重新组装 |
| 来自窗格的待处理输入 | 16 MiB | 超过此大小的不完整序列会被丢弃 |
| CSI 或 SS3 按键序列 | 64 字节 | 更长的序列会被丢弃 |

## Window 端

| 限制 | 数值 | 达到限制时 |
| --- | --- | --- |
| Chrome 格式化器缓存 | 每个格式化器 256 个输入 | 清空缓存并重新填充 |
| Lua 中的窗格和标签页 ID | 2^44 以下的位存放 Host 自身的 ID；更高位存放远程 Host 的标签 | ID 在 Lua 数值中保持精确 |
| Carly 导出参数和回答 | 1 MiB 编码后的 JSON | 更长的字符串回答会被截断，并以 `[… N bytes cut]` 结尾；其他类型的回答会失败 |
| `call:fail` 消息 | 16 KiB | 其余部分会被丢弃 |
| `tern.secrets` 值 | 64 KiB | awaitable 失败 |
| `tern.secrets` 名称 | `[a-z0-9][a-z0-9._-]{0,63}` | awaitable 失败 |

## 共享 API

| 限制 | 数值 | 达到限制时 |
| --- | --- | --- |
| `tern.process.run` 输出 | 每个流 16 MiB | 读取并丢弃其余内容 |
| `tern.process.run` 超时 | 除非提供 `timeout_ms`，否则无 | 进程被终止，`timed_out = true`，`status = -1` |
| `tern.fetch` 响应正文 | 16 MiB | 请求以 `error` 失败（不会截断内容） |
| `tern.fetch` 超时 | 除非提供 `timeout_ms`，否则为 30 s | 请求以 `timed_out = true` 失败 |
| `tern.fetch` 重定向 | 10 | 请求以 `error` 失败 |
| `tern.json.encode` 嵌套 | 128 层 | 抛出 `cannot encode tables nested this deep (or cyclic) as JSON` |
| JSON 中的整数 | 精确到 2^53 | 更大的整数会编码为浮点数 |
| iOS 上的 `tern.process` | 不可用 | 抛出 `tern.process is not available on iOS` |

定时器、进程、进行中的请求、`tern.kv` 键和 `tern.fs` 读取本身没有数量或大小上限；它们受 VM 内存上限和调用预算约束。

## 监视与重新加载

| 限制 | 数值 | 含义 |
| --- | --- | --- |
| 更改批处理 | 300 ms | 此时间窗口内的更改会触发一次重新加载 |
| 后备轮询间隔 | 2 s | 没有原生监视运行时使用（iOS、网络卷、inotify 耗尽） |
| 轮询指纹深度 | 8 个目录层级 | 不会注意到更深层级的更改 |
| 轮询指纹大小 | 10,000 个条目 | 不会注意到超出此数量的条目 |

参见[生命周期与重新加载](../concepts/lifecycle.md#监视)。

## 日志

| 限制 | 数值 | 含义 |
| --- | --- | --- |
| 默认过滤器 | `warn,stencil=info` | 除非 `STENCIL_LOG` 启用 `tern::plugin`，否则丢弃 `tern.log.info`、`debug` 和 `print` |
| 日志文件轮转 | 每个文件 16 MiB，保留两个旧文件 | 适用于插件写入的整个 Tern 日志 |

参见[运行时、预算与 JIT](../concepts/runtime.md#日志)。

## 相关页面

- [运行时、预算与 JIT](../concepts/runtime.md)
- [错误](errors.md)，了解这些限制会产生的消息。
