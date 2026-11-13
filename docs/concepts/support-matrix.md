# 支持矩阵

插件可在 macOS、Linux 和 Windows 桌面端完整运行。iOS 客户端仅运行 Window 端，Web 标签页则完全不运行 Lua；但两者仍会显示其主机上的插件生成的块和 Lens 视图。本页按功能详细说明支持情况。

## 各平台支持的功能

| 功能 | macOS | Linux | Windows | iOS | Web 标签页 |
| --- | --- | --- | --- | --- | --- |
| Host 端（`host` 入口） | 是，在守护进程中运行 | 是，在守护进程中运行 | 是，在守护进程中运行 | 否；跳过 Host 入口 | 否 |
| Window 端（`window` 入口） | 是 | 是 | 是 | 是 | 否 |
| 原生代码生成（`tern.runtime.jit`） | 是，适用于 Luau 代码生成器支持的 CPU | 同上 | 同上 | 否；始终使用解释器 | 不适用 |
| `tern.process.run` | 是 | 是 | 是 | 抛出 `tern.process is not available on iOS` | 不适用 |
| `tern.fetch` | 是 | 是 | 是 | 是 | 不适用 |
| 插件块可见 | 是 | 是 | 是 | 是，来自已连接的主机 | 是，来自提供页面服务的主机 |
| Lens 视图可见 | 是 | 是 | 是 | 是，来自已连接的主机 | 是，来自提供页面服务的主机 |
| 插件 CSS | 本地包和已连接的远程主机 | 同上 | 同上 | Files 应用中的包和已连接的主机 | 提供页面服务的主机的 manifest `styles`；没有 `tern.css` |
| `tern plugin` CLI | 是 | 是 | 是 | 否 | 否 |
| 插件目录监视 | FSEvents | inotify | `ReadDirectoryChangesW` | 每 2 秒轮询 | 不适用 |
| `tern.runtime.os` | `"macos"` | `"linux"` | `"windows"` | `"ios"` | 不适用 |

## 说明

**桌面端。** 在所有三种桌面平台上，会话守护进程都会运行 Host 端，每个插件使用一个工作线程；每个窗口则在自己的 UI 线程上运行 Window 端（[架构](architecture.md)）。如果某个窗口不通过守护进程运行其窗格，则会在自己的进程中运行 Host 端。在 macOS 和 Linux 上，守护进程通过 Unix socket 访问；在 Windows 上则通过命名管道访问，插件不会察觉区别。原地升级守护进程可以让 shell 继续运行，但仅 Unix 支持此功能；在所有平台上，守护进程重启后，插件块都会从保存的状态恢复（[生命周期与重新加载](lifecycle.md#守护进程重启与升级)）。

**JIT。** 桌面发布版本包含 Luau 的原生代码生成器，并会在 CPU 受支持时使用它；否则会使用解释器。macOS 应用使用 `com.apple.security.cs.allow-jit` 签名，使强化运行时允许其所需的可执行内存。`tern.runtime.jit` 和 `tern plugin list --json` 的 `jit` 字段会报告此状态。无论采用哪种方式，插件代码的行为都相同。请参阅[运行时、预算与 JIT](runtime.md#jit)。

**iOS。** iOS 上的 Tern 是一个客户端：它的 shell 和 Host 端运行在它所连接的主机上。Window 端从应用的 `Documents/Plugins` 文件夹（Files 应用：On My iPhone or iPad › Tern › Plugins）加载，并在解释器中运行。iOS 没有命令行，也没有 `git`：请将包文件夹复制到该文件夹，然后使用 Preferences › Plugins 或命令面板中的 Reload plugins。由于无法原生监视该文件夹，Tern 每 2 秒轮询一次。`tern.fs` 在 iOS 允许应用访问的范围内可用，`tern.process.run` 会抛出错误，而 `tern.fetch` 可正常使用。iOS 上的 Window 端仍会作用于窗口中的所有窗格，这些窗格都属于远程主机。

**Web 标签页。** Web 标签页（`tern web serve`）只有一个主机，也就是提供页面服务的机器，并且不会加载自己的插件。它会接收该主机的插件目录，因此可以像其他副本一样打开相同的 Lens 块，并显示插件块、Lens 视图和效果（提示消息、剪贴板、打开操作）。它还会将该目录中 Ready 插件的 manifest `styles` 安装为 `plugin:0:<id>:styles` 样式表，使插件块和 Lens 视图呈现为桌面窗口中的样式；主机重新加载插件时也会重新安装这些样式。Window 端通过 `tern.css` 添加的样式表不会应用到 Web 标签页，因为那里没有运行 Window 端。

**插件 CSS。** 窗口会将自身插件文件夹中、设置允许加载的每个包的 manifest `styles` 安装为 `plugin:local:<id>:styles` 样式表，并安装其 Window 端通过 `tern.css` 添加的样式表。每个已连接远程主机的 Ready 插件也会通过该主机的插件目录提供 `plugin:<host>:<id>:styles`；Web 标签页没有窗口运行时，但也会以相同方式安装其提供服务的主机的样式。请参阅[Chrome 与样式](../guides/chrome.md)。

**监视。** 如果原生监视无法覆盖整个目录树（例如网络卷，或 Linux 的 inotify 监视数已用尽），桌面版本会回退到与 iOS 相同的每 2 秒轮询。请参阅[生命周期与重新加载](lifecycle.md#监视)。

## 相关页面

- [架构](architecture.md)：说明每个端运行的位置及原因。
- [信任与安全](security.md)：说明每个端在各台机器上可以访问的内容。
- [限制](../reference/limits.md)：说明各平台相同的预算与大小限制。
