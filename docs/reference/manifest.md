# Manifest 参考

`plugin.toml` 声明一个软件包：其身份、入口、样式表，以及其 Host 端定义的块类型和命令 Lens。每个 Host 副本无需运行任何 Lua，便可从插件清单获知这些声明，因此 manifest 决定插件认领哪些命令，以及命令面板提供哪些块类型。

本页列出每个键的类型、默认值和验证规则，以及每条规则失败时的确切文本。相关概念请参见[软件包与 Manifest](../concepts/packages.md)。

## 示例

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

[[blocks]]
id = "logs"
title = "Logs"
icon = "file"
palette = false

[[lenses]]
id = "get"
match = ["kubectl get *", "k get *"]
```

## 如何读取 manifest

manifest 分两步检查：

1. **文本规则**，只需文件本身：大小、TOML 语法、schema、键名和类型、ID、名称长度、入口和样式路径，以及 `[[blocks]]`/`[[lenses]]` 规则。`tern plugin install` 和 `tern plugin link` 会在操作插件文件夹之前应用这些规则。
2. **软件包规则**，需要软件包目录：具名入口文件存在，且样式表可读取并符合大小上限。加载器每次扫描插件文件夹时都会应用这些规则。

只报告第一个违反的规则。违反规则的软件包属于**问题项**，会连同消息列在 `tern plugin list`、Preferences › Plugins 和“plugins have problems”提示中；它不会加载任何内容。下文消息按加载器报告的文本引用；`tern plugin install` 和 `link` 会在前面加上 `<dir> is not a plugin: `（参见[命令行](cli.md#错误)）。

顶层以及每个 `[[blocks]]` 和 `[[lenses]]` 表中的未知键都会报错。键名拼错会导致软件包验证失败，而不是被忽略。

## 顶层键

| 键 | 类型 | 必填 | 默认值 | 规则 |
| --- | --- | --- | --- | --- |
| `schema` | integer | 是 | | 必须为 `1` |
| `id` | string | 是 | | `^[a-z][a-z0-9-]{0,31}$`；已安装软件包之间必须唯一 |
| `name` | string | 是 | | 1–64 个字符 |
| `version` | string | 是 | | 任意格式 |
| `description` | string | 否 | `""` | 任意格式，单行 |
| `icon` | string | 否 | `"puzzle"` | Tern 图标名；未知名称会变成 `puzzle` |
| `host` | string | `host`、`window` 中至少一个 | 缺省 | 软件包内的相对路径，以 `.luau` 或 `.lua` 结尾 |
| `window` | string | `host`、`window` 中至少一个 | 缺省 | 软件包内的相对路径，以 `.luau` 或 `.lua` 结尾 |
| `styles` | 字符串数组 | 否 | `[]` | 每项均为软件包内的相对路径；总计 256 KiB |
| `blocks` | 表数组（`[[blocks]]`） | 否 | `[]` | 需要 `host` |
| `lenses` | 表数组（`[[lenses]]`） | 否 | `[]` | 需要 `host` |

### `schema`

manifest 格式版本。目前仅存在 `1`。此检查会在读取其他键之前运行，因此未来版本的 schema 会给出明确消息，而不是一串未知键错误。

| 清单 | 消息 |
| --- | --- |
| 没有 `schema` 键 | `missing schema` |
| `schema = 2` | `unsupported schema 2` |
| `schema = "1"` | `schema must be an integer` |

### `id`

插件在本机上的身份。它用于命名插件贡献的所有内容：块种类 `<id>.<block>`、Lens ID `plugin.<id>.<lens>`、操作 `plugin.<id>.<command>`、样式表 `plugin:local:<id>:…`，以及数据文件夹 `<state>/plugin-data/<id>`。参见[软件包与 Manifest](../concepts/packages.md#id-与名称)。

ID 必须为 1–32 字节：以小写 ASCII 字母开头，后接小写字母、数字或 `-`。

| 清单 | 消息 |
| --- | --- |
| `id = "K8s"`、`id = "1x"`、33 字符的 ID | `invalid id "K8s" (lowercase letters, digits and -, 1-32 long)` |
| 按名称顺序排在前面的另一个软件包具有相同 ID | `duplicate id k8s`（针对后面的目录报告） |

目录名无需与 ID 匹配；`tern plugin install` 会使用 ID 作为副本名称。

### `name`

显示名称：命令面板中的插件命令分组、提示的首行（“Plugin *name*: *hook* failed”）、Preferences，以及 `tern plugin list`。长度按 Unicode 字符而非字节计算。

| 清单 | 消息 |
| --- | --- |
| `name = ""`，或超过 64 个字符 | `name must be 1-64 characters` |

### `version`、`description`

可自由填写的字符串，会显示在 `tern plugin list`（仅版本）和 Preferences 中。Tern 从不比较版本。

### `icon`

Tern 图标集中的图标（[图标名称](../elements/data.md#图标名称)：`box`、`sparkle`、`terminal`、`chev-r`、…），或者 Tern 为 omp 接受的别名（`success`、`git-branch`）。最后一个 `.` 之前的内容都会忽略，因此 `icon.folder` 等同于 `folder`。未知或缺省的名称会变成 `puzzle`；这不会报错。插件清单中保存解析后的名称。

### `host`、`window`

两个入口。至少必须提供一个。每个入口都是相对于软件包目录的路径，只能由普通路径组件和 `.` 组成（不能含 `..`、根路径或盘符），并以 `.luau` 或 `.lua` 结尾。

| 清单 | 消息 |
| --- | --- |
| 两个键均缺失 | `needs a host or window entry` |
| `host = "../h.luau"`、`host = "/abs/h.luau"`、`host = ""` | `host "../h.luau" must be a relative path inside the plugin` |
| `window = "w.js"` | `window "w.js" must be a .luau or .lua file` |
| 文件不存在 | `missing entry host.luau` |

`host` 在 Host 上下文中运行，即负责管理块、Lens、Host 事件以及 `spawn` 过滤器的工作线程。`window` 在每个 Tern 窗口中运行。参见[架构](../concepts/architecture.md#两个部分)。

### `styles`

CSS 文件，每项都是软件包内的相对路径（与入口规则相同，可使用任意扩展名）。文件按顺序读取，文件之间以换行符连接，并在每个允许该插件的窗口中安装为一个全局样式表 `plugin:local:<id>:styles`；安装发生在其 window 入口运行之前，无论是否存在该入口。参见[窗口装饰与样式](../guides/chrome.md)。

| 清单 | 消息 |
| --- | --- |
| `styles = ["../x.css"]` | `style "../x.css" must be a relative path inside the plugin` |
| 文件无法读取 | `cannot read style k8s.css: <io error>` |
| 连接后的文本超过 256 KiB | `styles are larger than 256 KiB` |

CSS 解析错误不属于 manifest 错误：样式表仍会安装，窗口会记录 `plugin style sheet has errors`。

## `[[blocks]]`

每个表声明一种块类型，种类为 `<plugin>.<id>`。Host 入口必须通过 [`tern.block.define`](api-host.md#tern-block-define) 定义它；每个副本上的命令面板、“Open with”菜单和路由决策所见的，正是这项声明。

| 键 | 类型 | 必填 | 默认值 | 规则与含义 |
| --- | --- | --- | --- | --- |
| `id` | string | 是 | | `^[a-z][a-z0-9-]{0,31}$`，在此插件的块中必须唯一 |
| `title` | string | 是 | | 命令面板行“New *title* block”、“Open with *title*”，以及块的 `title` 处理器返回名称之前的窗格标题 |
| `icon` | string | 否 | 插件图标 | 图标名，规则同顶层 `icon`；未知名称变为 `puzzle`（而非插件图标） |
| `files` | 字符串数组 | 否 | `[]` | 文件名 glob；匹配文件会提供“Open with *title*” |
| `palette` | boolean | 否 | `true` | 命令面板是否提供“New *title* block” |

`files` glob 仅与文件名匹配（不包括目录），且忽略 ASCII 大小写：`*.yaml` 会匹配 `Deploy.YAML`。“Open with *title*”会在焦点窗格旁边、文件所在文件夹中启动该块，并将文件路径作为唯一参数。菜单只列出当前会话所运行的 Host 上 Ready 插件的块类型。

| 清单 | 消息 |
| --- | --- |
| 有 `[[blocks]]`，但没有 `host` | `blocks need a host entry` |
| `id = "Pods"` | `invalid block id "Pods"` |
| 两个表具有相同的 `id` | `duplicate block id "pods"` |
| 缺少 `title` | ``missing field `title` `` |
| 未知键 | ``unknown field `shape`, expected one of `id`, `title`, `icon`, `files`, `palette` `` |

插件入口必须与声明一致；以下情况会导致插件（状态为 Failed）失败，而非软件包失败：

| 入口 | 错误 |
| --- | --- |
| 对未声明的 ID 调用 `tern.block.define("x", …)` | `tern.block.define: block "x" is not declared in plugin.toml`（在入口中引发） |
| 声明的 ID 从未定义 | `block x is declared in plugin.toml but not defined with tern.block.define` |

## `[[lenses]]`

每个表声明一个命令 Lens，ID 为 `plugin.<plugin>.<id>`，并声明其认领的命令行 glob。Host 入口必须通过 [`tern.lens.define`](api-host.md#tern-lens-define) 定义它。

| 键 | 类型 | 必填 | 默认值 | 规则与含义 |
| --- | --- | --- | --- | --- |
| `id` | string | 是 | | `^[a-z][a-z0-9-]{0,31}$`，在此插件的 Lens 中必须唯一 |
| `match` | 字符串数组 | 是 | | 至少一个匹配 `program args…` 的 glob |

### 匹配模式

Shell 报告的命令（OSC 133）首先会作为简单命令读取：

- 跳过前导 `VAR=value` 赋值；
- 跳过包装程序及其选项：`sudo`、`doas`、`exec`、`time`、`nice`、`nohup`、`env`、`command`、`builtin`、`caffeinate`、`npx`、`bunx`、`pnpx`、`uvx`、`pipx`；
- 移除程序路径中的目录（`/usr/bin/git` 即 `git`）；
- 去掉引号和转义，并丢弃重定向；
- 对于输出并非来自单个程序的命令行，绝不认领：包括管道、列表（`;`、`&&`、`||`）、标准输出重定向、子 Shell、heredoc，以及程序词中的命令替换。

程序及其参数以单个空格连接，每个模式必须匹配整段文本。`*` 匹配任意长度的字符（包括零个），`?` 恰好匹配一个字符，其他字符均按其自身匹配。匹配区分大小写。

| 模式 | 命令行 | 是否认领 |
| --- | --- | --- |
| `kubectl get *` | `kubectl get pods` | 是 |
| `kubectl get *` | `FOO=1 sudo kubectl get pods -A` | 是 |
| `kubectl get *` | `kubectl get` | 否（空格必须存在） |
| `kubectl get *` | `kubectl get pods \| grep x` | 否（管道） |
| `kubectl get *` | `Kubectl get pods` | 否（大小写） |
| `kubectl *` | `kubectl logs x` | 是 |

指向 Shell 别名的模式无法穿透别名：匹配使用 Shell 报告的命令行。请将别名形式作为额外模式列出（`"k get *"`）。

### 认领顺序

多个 Lens 匹配时，按 ID 排序的第一个 Ready 插件胜出；在该插件内，则由 manifest 顺序中第一个模式匹配的 Lens 胜出。Disabled 和 Failed 插件不会认领任何内容。插件的认领优先于 Tern 内置 Lens。Lens 应按从最具体到最宽泛的顺序排列。

| 清单 | 消息 |
| --- | --- |
| 有 `[[lenses]]`，但没有 `host` | `lenses need a host entry` |
| `id = "Get"` | `invalid lens id "Get"` |
| 两个表具有相同的 `id` | `duplicate lens id "get"` |
| `match = []` | `lens "get" needs at least one match pattern` |
| 缺少 `match` | ``missing field `match` `` |

| 入口 | 错误 |
| --- | --- |
| 对未声明的 ID 调用 `tern.lens.define("x", …)` | `tern.lens.define: lens "x" is not declared in plugin.toml`（在入口中引发） |
| 声明的 ID 从未定义 | `lens x is declared in plugin.toml but not defined with tern.lens.define` |

## TOML 与类型错误

语法和类型错误会携带 TOML 解析器的消息，但不包含位置：

| 清单 | 消息 |
| --- | --- |
| `name =`（没有值） | `string values must be quoted, expected literal string` |
| 一行 `not toml =` | ``key with no value, expected `=` `` |
| `id = 5` | ``invalid type: integer `5`, expected a string`` |
| `palette = "no"` | `invalid type: string "no", expected a boolean` |
| 缺少 `version` | ``missing field `version` `` |
| `color = "red"` | ``unknown field `color`, expected one of `schema`, `id`, `name`, `version`, `description`, `icon`, `host`, `window`, `styles`, `blocks`, `lenses` `` |

## 文件与文件夹规则

| 规则 | 消息 |
| --- | --- |
| `plugin.toml` 大于 64 KiB | `plugin.toml is larger than 64 KiB` |
| 目录中没有 `plugin.toml` | `no plugin.toml` |
| `plugin.toml` 无法读取（权限不足、非 UTF-8） | `cannot read plugin.toml: <io error>` |
| 有效软件包超过 64 个 | 按 ID 排序后，每个超过第 64 个的软件包均报告 `too many plugins` |

插件文件夹中的 `<name>.path` 文件可链接到保存在其他位置的软件包；其自身的消息（`cannot read link: …`、`link target "x" is not an absolute path`、`link target /x is not a directory`）列于[错误](errors.md#插件文件夹问题)。

## 相关页面

- [软件包与 Manifest](../concepts/packages.md)：布局、文件夹和设置。
- [限制](limits.md)：所有大小和数量限制。
- [命令行](cli.md)：安装和链接软件包。
