# 包与清单

插件是一个目录，其中包含 `plugin.toml` 清单、最多两个 Luau 入口文件，以及这些文件使用的模块和样式表。本页介绍包的布局、清单、包及其数据的存放位置、插件内容的命名方式，以及如何报告不可用作插件的文件夹。逐项键规则请参阅[清单参考](../reference/manifest.md)。

## 包布局

```text
k8s/
  plugin.toml      -- the manifest (schema 1)
  host.luau        -- host half: blocks, lenses, pane hooks
  window.luau      -- window half: commands, keys, routes, chrome, layout
  k8s.css          -- global styles, listed in `styles`
  lib/
    pods.luau      -- require("./lib/pods")
```

只要求提供 `plugin.toml` 及其指定的入口文件。入口和样式路径相对于包目录，且不能越出该目录。除非入口调用 `require`，或处理器通过 `tern.fs` 读取，否则不会读取文件夹中的其他内容。

## 清单

`plugin.toml` 使用 schema 1。顶层以及每个表中的未知键都会导致错误，因此拼写错误会使包失败，而不会被忽略。

```toml
schema = 1
id = "k8s"
name = "Kubernetes"
version = "0.1.0"
description = "Pods as a block, kubectl get as a table."
icon = "box"
host = "host.luau"
window = "window.luau"
styles = ["k8s.css"]

[[blocks]]
id = "pods"
title = "Pods"
files = ["*.yaml"]

[[lenses]]
id = "get"
match = ["kubectl get *", "k get *"]
```

| 键 | 用途 |
| --- | --- |
| `schema` | 必须是整数 `1`。 |
| `id` | 插件在本机上的标识；插件命名的所有内容都以它为前缀。 |
| `name` | 显示名称：命令面板分组、提示消息、Preferences。 |
| `version` | 任意字符串；显示在 `tern plugin list` 和 Preferences 中。 |
| `description`, `icon` | 可选；未知或缺失的图标会变为 `puzzle`。 |
| `host`, `window` | 两个入口；至少需要一个。每个都是相对 `.luau` 或 `.lua` 路径。 |
| `styles` | 合并为一个全局样式表的 CSS 文件，总大小最多为 256 KiB。 |
| `[[blocks]]` | 块类型；每个都需要在 `host` 入口中调用 `tern.block.define`。 |
| `[[lenses]]` | 命令 Lens 及其认领命令的 glob；每个都需要在 `host` 入口中调用 `tern.lens.define`。 |

块和 Lens 在清单中声明，在 Lua 中定义，两者必须一致。每个副本都能从插件目录中获知清单部分的内容（块标题和图标、Lens 命令认领规则），而无需运行 Lua；Lua 部分则由 Host 端运行。定义未声明的 id 会在入口中触发错误（`tern.block.define: block "x" is not declared in plugin.toml`）；入口完成后，若入口从未定义某个已声明的 id，插件也会失败（`block x is declared in plugin.toml but not defined with tern.block.define`）。因此，`[[blocks]]` 和 `[[lenses]]` 都要求存在 `host` 入口。

## 目录

这些文档中的路径使用两个占位符。`<config>` 是 Tern 的配置目录，`<state>` 是其状态目录：

| 平台 | `<config>` | `<state>` |
| --- | --- | --- |
| macOS | `~/Library/Application Support/Tern` | `~/Library/Application Support/Tern` |
| Linux | `$XDG_CONFIG_HOME/tern` (`~/.config/tern`) | `$XDG_STATE_HOME/tern` (`~/.local/state/tern`) |
| Windows | `%APPDATA%\Tern` | `%LOCALAPPDATA%\Tern` |
| 任意平台，设置了 `TERN_CONFIG_DIR` | `$TERN_CONFIG_DIR` | `$TERN_CONFIG_DIR` |

### plugins 文件夹

包存放在 `<config>/plugins/`；`tern plugin dir` 会打印该路径。在 iOS 上，该文件夹是应用的 `Documents/Plugins`，Files 应用中显示为“在我的 iPhone（或 iPad）上 › Tern › Plugins”。iOS 没有命令行或 `git`：请将包文件夹复制到那里。

Tern 按名称顺序读取 plugins 文件夹中的条目：

| 条目 | 处理方式 |
| --- | --- |
| 目录（或指向目录的符号链接） | 一个包；其 `plugin.toml` 必须直接位于其中。 |
| 文件 `<name>.path` | 一个链接包：文件去除首尾空白后的内容必须是指向包目录的绝对路径。`tern plugin link DIR` 会写入 `<id>.path`。 |
| 以 `.` 开头的名称 | 跳过。`tern plugin` 会在名称以点开头的同级文件夹中暂存更改。 |
| 其他文件 | 忽略。 |

已安装的包是 `<config>/plugins/<id>` 下的副本（`tern plugin install`）；链接包保留在原位置并从那里加载，这正适合开发时使用。参见[分发](../guides/distribution.md)和[命令行](../reference/cli.md)。

### 数据文件夹

每个插件都会获得 `<state>/plugin-data/<id>/`，并在其某个 VM 启动时创建。Lua 可通过 `tern.plugin.data` 看到该目录的绝对路径。通过 `tern.process.run` 运行的程序会通过 `TERN_PLUGIN_DATA` 环境变量获得该路径。`tern.kv` 将值保存在其中的 `kv.json`，每次 `tern.kv.set` 都会通过临时文件和重命名来重写该文件。

插件的两端以及每个窗口中的 Window 端共享此文件夹和同一个 `tern.kv` 存储：每个 VM 都会在文件修改时间或长度变化时重新读取 `kv.json`，因此 `get` 可以看到其他 VM 的写入，而 `set` 不会写回过期副本。两个同时发生的 `set` 仍会竞争，最后一次重命名会胜出。参见[文件、进程与存储](../guides/io.md)。

## 设置

`<config>/settings.json` 中的两个键决定加载哪些插件。每台机器读取自己的设置；主机之间不会同步。

| 键 | 默认值 | 效果 |
| --- | --- | --- |
| `plugins` | `true` | 设为 `false` 时不加载任何插件。 |
| `plugins_disabled` | `[]` | 保持不加载的插件 id（状态为 Disabled）。 |

Preferences › Plugins 可编辑这两个键；任一键发生变化时，会重新加载会话和窗口的插件。两端都会在每次加载和重新加载时再次读取 `settings.json`（守护进程、窗口，以及守护进程未运行时窗口自身的 Host 运行时），因此手动编辑会在下次重新加载时在各处生效。无头运行（`tern shot`、`tern serve`）只有在使用 `plugins fixtures` 场景命令时才会加载插件，该命令也会从 `settings.json` 读取这两个键。

## ID 与名称

插件、块和 Lens 的 id 都匹配 `^[a-z][a-z0-9-]{0,31}$`：以小写字母开头，后接最多 31 个小写字母、数字或 `-`。块和 Lens 的 id 在各自插件内唯一。插件贡献的所有内容都以其 id 命名：

| 内容 | 名称 | 用途 |
| --- | --- | --- |
| 块类型（kind） | `<plugin>.<block>` | `cx:new_block`、`launch.block`、路由决策 `{block = …}` |
| 块 surface 角色 | `plugin.<plugin>.<block>` | CSS `[data-surface='plugin.k8s.pods']`，设置在块的区域元素上 |
| Lens id | `plugin.<plugin>.<lens>` | Lens 块：块的角色是 `lens.` 后接其 Lens id |
| Lens 块角色 | `lens.plugin.<plugin>.<lens>` | CSS `.sf-block[data-role='lens.plugin.k8s.get']` |
| 命令操作 | `plugin.<plugin>.<id>` | `tern.bind`、`settings.json` 中的 `keybinds`、状态栏片段的 `command` |
| 函数绑定操作 | `plugin.<plugin>.bind.<n>` | 传给 `tern.bind` 的第 n 个函数，从 0 开始计数 |
| 清单样式表 | `plugin:local:<plugin>:styles` | 样式级联，位于 Tern 自身样式表之后 |
| `tern.css` 样式表 | `plugin:local:<plugin>:<name>` | 样式级联 |
| 远程主机的样式表 | `plugin:<host>:<plugin>:styles` | 样式层叠 |
| 数据文件夹 | `<state>/plugin-data/<plugin>` | `tern.plugin.data`、`TERN_PLUGIN_DATA` |

命令 id（`tern.command`）和样式表名称（`tern.css`）的限制较宽：仅允许 ASCII 字母、数字、`_` 和 `-`。命令不能命名为 `bind`，样式表不能命名为 `styles`。

## 模块与 `require`

`require("tern")` 返回 `tern` 表，它也就是全局变量 `tern`。其他任何字符串都是相对于调用 `require` 的文件的路径：

| 调用 | 加载内容 |
| --- | --- |
| `require("./util")` | 调用文件所在目录下的 `util.luau`、`util.lua`、`util/init.luau` 或 `util/init.lua` |
| `require("./lib/pods")` | `lib/pods.luau`（或其他三种形式） |
| `require("../shared")` | 上一级目录中的文件，前提是仍位于包内 |

如果某个路径解析到上述多个文件，就会报错；如果路径越出包目录，也会报错。不会读取 `.luaurc` 文件和 `@alias` 路径。模块会在每个 VM 内按解析后的文件缓存，因此两端都会各自只加载一次共享模块。参见[运行时、预算与 JIT](runtime.md#模块)。

## 样式

加载包时会读取 `styles` 中列出的文件，将其用换行符合并，总大小上限为 256 KiB；文件缺失或总大小超限都会导致包出问题。在本机上，对于设置允许加载的每个插件，窗口运行时都会将这些文件安装为全局样式表 `plugin:local:<id>:styles`，位于 Tern 自身样式表之后，不论插件是否有 `window` 入口，并且会在该入口运行之前完成安装。远程主机上 Ready 插件的样式会随其目录一起到达，并安装为 `plugin:<host>:<id>:styles`。Window 端可在运行时通过 `tern.css` 添加更多样式表。参见[Chrome 与样式](../guides/chrome.md)。

## 问题与状态

无法作为插件使用的文件夹属于一个**问题**：它会连同错误一起列出，且不会加载任何内容。有效包则具有一个**状态**。

| 问题 | 原因 |
| --- | --- |
| `no plugin.toml` | 目录中没有清单。 |
| `plugin.toml is larger than 64 KiB` | 清单过大。 |
| 清单规则错误，例如 `unsupported schema 2`、`invalid id "X"`、`needs a host or window entry`、`blocks need a host entry` | 清单违反 schema-1 规则（[清单参考](../reference/manifest.md)）。 |
| `missing entry host.luau` | 指定的入口文件不存在。 |
| `cannot read style k8s.css: …`、`styles are larger than 256 KiB` | 样式表不可读，或总大小超限。 |
| `link target … is not an absolute path`、`link target … is not a directory` | `.path` 文件指定了不可用的目标。 |
| `duplicate id k8s` | 名称排序中更早的条目已经使用了此 id。 |
| `too many plugins` | 有效包超过 64 个；包按 id 排序，第 64 个之后的包会被排除。 |

| 状态 | 含义 |
| --- | --- |
| Ready | 已加载；其入口已运行。 |
| Disabled | 由 `plugins` 或 `plugins_disabled` 关闭。 |
| Failed | 入口加载时触发错误，或未定义已声明的块或 Lens；错误会被保留。 |

问题和状态会显示在 `tern plugin list`、Preferences › Plugins 中，并会在 Host 的目录发生变化时以提示消息形式显示。关于两端状态的来源，参见[生命周期与重新加载](lifecycle.md#目录与状态)。

## 相关页面

- [清单参考](../reference/manifest.md)：所有键及其规则。
- [生命周期与重新加载](lifecycle.md)：包何时会重新读取。
- [限制](../reference/limits.md)：大小和数量汇总于一张表中。
