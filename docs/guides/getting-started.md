# 快速开始

本页将带你从空文件夹开始，构建一个可用的插件，其中包含两端：一个 Host 端 Lens，它将 `seq` 的输出转换为摘要和迷你折线图；以及一个 Window 端命令面板命令，用于显示 toast。过程中还会配置类型检查、重新加载，以及查看错误的位置。

你需要在窗格中启用 Shell 集成（默认已启用）的 Tern；要进行类型检查，还需要 [luau-lsp](https://github.com/JohnnyMorganz/luau-lsp)。

## 创建软件包

插件是一个文件夹，其中包含 `plugin.toml` 及其指定的 Luau 文件。可以在任意位置创建；不必放在 Tern 的插件文件夹中：

```sh
mkdir -p ~/src/first
cd ~/src/first
```

`plugin.toml` 声明插件以及 Tern 在运行任何 Lua 之前必须了解的所有信息：其 id、两个入口文件，以及它声明负责处理命令行的 Lens。

```toml
schema = 1
id = "first"
name = "First"
version = "0.1.0"
description = "A seq lens and a hello command."
host = "host.luau"
window = "window.luau"

[[lenses]]
id = "seq"
match = ["seq *"]
```

`id` 由小写字母、数字和 `-` 组成，必须以字母开头，最多 32 个字符。`match` 是一个 glob 列表，用于匹配命令的程序及参数；`seq *` 可匹配 `seq 12` 和 `seq 1 2 10`，但不匹配单独的 `seq`。[软件包与 Manifest](../concepts/packages.md) 列出了所有键。

`host.luau` 是 Host 端。它在窗格运行的位置执行（通常是 Tern 的会话守护进程），并实现 Lens：

```lua
--!strict
-- The host half: a lens that reads `seq` output as numbers.

type State = { values: { number } }

local ui = tern.ui

local seq: LensDef<State> = {
	open = function(_run, _cx)
		return { values = {} }
	end,
	line = function(state, l)
		local n = tonumber(l.text)
		if n then
			table.insert(state.values, n)
		end
	end,
	finish = function(_state, _status) end,
	view = function(state)
		if #state.values == 0 then
			return nil -- not numbers: keep the raw output
		end
		local sum = 0
		local series: { { any } } = {}
		for i, n in state.values do
			sum += n
			series[i] = { tostring(i), n }
		end
		return ui.col({
			ui.text({
				ui.span(tostring(#state.values), "strong num"),
				ui.span(" numbers, sum "),
				ui.span(tostring(sum), "num"),
			}),
			ui.spark(series),
		})
	end,
}

tern.lens.define("seq", seq)
```

`window.luau` 是 Window 端。它在这台机器上的每个 Tern 窗口中运行，并添加一个命令面板命令：

```lua
--!strict
-- The window half: a palette command.

tern.command({
	id = "hello",
	title = "Say hello",
	icon = "sparkle",
	run = function(cx)
		local how = if tern.runtime.jit then "native code" else "the interpreter"
		cx:toast("info", "Hello from " .. tern.plugin.name, "running on " .. how)
	end,
})
```

API 是全局变量 `tern`。运行时 `require("tern")` 会返回同一个表，但 luau-lsp 会将其报告为未知 require，因此这些示例使用全局变量。哪些成员在哪一端可用，见 [API 参考](../reference/api.md#上下文)；两端的划分本身详见[架构](../concepts/architecture.md)。

## 链接插件

`tern plugin link` 会注册该文件夹所在的位置，因此你可以直接在原地编辑：

```sh
tern plugin link ~/src/first
```

```text
linked first 0.1.0 → /Users/you/src/first
```

链接操作会将 `first.path` 写入插件文件夹（运行 `tern plugin dir` 可查看其位置）。如果 Tern 的守护进程正在运行，它会重新加载插件，然后命令会打印加载失败的插件以及存在问题的文件夹。如果没有守护进程，命令会打印 `no daemon running; changes apply at next start`。

`tern plugin list` 会显示已加载的内容：

```text
first 0.1.0 First — 0 blocks, 1 lenses, window  ready
```

没有守护进程运行时，`list` 会在不运行任何 Lua 的情况下读取文件夹，因此其中的 `ready` 仅表示 manifest 解析成功。

## 配置类型检查

`tern plugin types` 会将 API 的类型定义写入文件夹：

```sh
tern plugin types ~/src/first
```

```text
wrote /Users/you/src/first/tern.d.luau
```

将 luau-lsp 指向该文件，并将其用作定义文件。在 VS Code 中，将以下内容放入工作区的 `.vscode/settings.json`：

```json
{
	"luau-lsp.platform.type": "standard",
	"luau-lsp.sourcemap.enabled": false,
	"luau-lsp.types.definitionFiles": { "@tern": "tern.d.luau" }
}
```

`definitionFiles` 将名称映射到路径。`platform.type = "standard"` 会关闭 Roblox 的全局变量，而 sourcemap 设置会阻止 luau-lsp 查找 Rojo 项目。无需 `.luaurc`。在 Shell 中进行相同检查的命令是：

```sh
luau-lsp analyze --platform=standard --definitions=@tern=tern.d.luau host.luau window.luau
```

使用 `LensDef<State>` 和 `BlockDef<State>` 为定义添加注解，以对处理器共享的状态进行类型检查；并在文件开头使用 `--!strict`，启用完整检查。升级 Tern 后，重新生成 `tern.d.luau`。

## 重新加载

Tern 会监视插件文件夹和所有已链接的文件夹。保存文件后，插件两端会在约 300 ms 内重新加载，因此大多数时候只需保存即可。手动重新加载的方法如下：

- `tern plugin reload` 会重新加载守护进程中的插件，打印与 `list` 相同的行；如果有插件加载失败或文件夹存在问题，则以状态码 1 退出。当守护进程发送新的插件目录清单时，这台机器上的窗口会重新加载各自的插件端。
- 在命令面板中选择 **Reload plugins**，或在 Preferences › Plugins 中选择 **Reload**，会让该窗口所连接的所有 host（你的守护进程以及任何远程守护进程）重新加载，然后重新加载窗口自身的插件端。

重新加载会保留和重启哪些内容，详见[生命周期与重新加载](../concepts/lifecycle.md)。

## 查看效果

在任意 Tern 窗格中运行：

```sh
seq 12
```

输出会变成一个块，显示“12 numbers, sum 78”和一张迷你折线图。该块的 **Raw** 开关可显示原始输出，Tern 始终会保留它。运行 `seq 3 x`：`seq` 会输出错误而不是数字，`view` 返回 `nil`，块便会显示原始输出。

Lens 只会看到 Shell 集成报告的命令行，而且仅限简单命令：`seq 12 | tail -3` 或 `clear; seq 12` 仍会作为普通终端输出。[命令 Lens](lenses.md) 介绍相关规则。

打开命令面板并输入“Say hello”。该行位于以插件命名的分组中；选择后会显示 toast“Hello from First”，下方附有“running on native code”（或“the interpreter”）。

## 出现问题时

| 失败情况 | 显示位置 |
| --- | --- |
| `plugin.toml` 无法解析或违反规则 | `tern plugin list`：`problem DIR: <error>`（例如 ``unknown field `bogus`, expected one of …``）；插件不会加载 |
| 入口文件加载时抛出异常 | `tern plugin list`：`failed: <first line>`，例如 `failed: runtime error: …/host.luau:2: attempt to index nil with 'y'`；完整回溯见日志 |
| 重新加载后出现上述任一问题 | 窗口中会显示 toast：“1 plugin has problems” |
| Window 端加载失败 | toast“Plugin First failed to load”，下方显示错误 |
| 处理器抛出异常或超出预算 | toast“Plugin First: seq.view failed”（hook 名称可能不同），显示错误的第一行；日志中会出现 `plugin handler failed` |

处理器失败只会丢弃这次调用；插件仍会继续运行。处理器超出预算时会暂停：其 hook 将被跳过 5 s；如果持续触发，暂停时间会更长。

`print` 和 `tern.log` 会将内容写入目标为 `tern::plugin` 的 Tern 日志；默认日志过滤器会丢弃这些内容。启动 Tern（或守护进程）时，将 `STENCIL_LOG=warn,stencil=info,tern::plugin=debug` 设为环境变量即可查看。[调试](debugging.md)介绍日志、预算和常见错误。

## 后续步骤

- [命令 Lens](lenses.md)：声明负责处理的命令、行形态、实时视图和重新水合。
- [块](blocks.md)：以你的 Lua 代码作为程序的窗格。
- [构建视图](views.md)：节点模型、构建器、操作和样式。
- [Host 钩子与 Spawn 过滤器](hooks.md)：响应命令并塑造新 Shell。
- Window 端请参阅[命令、按键与覆盖](commands.md)和[路由打开操作与链接](routing.md)。
- 插件准备好供他人使用时，请参阅[分发](distribution.md)。
