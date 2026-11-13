# 命令行

`tern plugin` 管理此机器插件文件夹中的包，并要求会话守护进程重新加载它们。它只处理文件和正在运行的守护进程；绝不会运行插件 Lua 本身。iOS 没有命令行：请改为将包复制到“文件”App 的 Tern › Plugins 文件夹。

## 用法概要

```sh
tern plugin list [--json]
tern plugin reload [ID] [--json]
tern plugin dir [--json]
tern plugin install SRC [--force] [--json]
tern plugin remove ID [--json]
tern plugin link DIR [--json]
tern plugin unlink ID [--json]
tern plugin types DIR [--json]
tern plugin --help
```

## 常见行为

| 标志 | 含义 |
| --- | --- |
| `--json` | 以美化格式的 JSON 而非文本打印结果 |
| `--window KEY` | 每个 `tern` 命令都接受此标志（使用其守护进程连接的窗口：优先使用 `--window`，否则使用运行此命令的窗格所在窗口，再否则使用第一个窗口）。每位用户只有一个守护进程，因此它不会改变某个动词能看到哪些插件 |
| `--help`、`-h` | 打印下方用法并以 0 退出 |

标志可以放在这些词之前或之后；对于 `--window`，`--name=value` 也有效。其他任何标志都会导致用法错误。插件文件夹属于机器，而非窗口，因此 `tern plugin --help` 不会提及窗口。

“守护进程”指此机器套接字上的会话守护进程（`$TERN_DAEMON_SOCKET`，否则为运行时或设置目录中的 `daemon.sock`）。`tern plugin` 绝不会启动守护进程。

### 退出码

| 代码 | 条件 |
| --- | --- |
| `0` | 成功，包括变更动词的后续重新加载报告问题的情况 |
| `1` | 动词失败（消息输出到标准错误）；当新插件清单中有 Failed 插件或存在问题时，`reload` 也以 1 退出 |
| `2` | 用法错误：未知标志、缺少或多出词语。消息后会附上用法文本 |
| `124` | 守护进程在 60 秒内未响应 `reload` |

错误会以 `tern plugin: <message>` 的形式输出到标准错误。

### 变更后重新加载

`install`、`remove`、`link` 和 `unlink` 会更改插件文件夹，然后要求守护进程重新加载每个插件，并等待新插件清单最多 60 秒。它们在各自输出行之后打印的内容如下：

| 结果 | 文本模式（标准输出） | `--json`（标准错误） |
| --- | --- | --- |
| 没有正在运行的守护进程 | `no daemon running; changes apply at next start` | 同左 |
| 重新加载成功且所有内容均已加载 | 无 | 无 |
| 插件加载失败或文件夹存在问题 | 每个 Failed 插件各打印一行 `list`，然后打印 `problem …` 行 | 同左 |
| 重新加载请求失败 | `the daemon did not reload its plugins: <error>` | 同左 |

以上情况都不会改变退出码。文件夹变更时，窗口会重新加载各自的 Window 端；参见[生命周期与重新加载](../concepts/lifecycle.md#监视)。

## `tern plugin list`

打印正在运行的守护进程在命令连接时的插件清单：每个已安装插件及其状态，然后是文件夹问题。若没有守护进程，它会直接读取插件文件夹和设置，不运行任何 Lua：设置允许的每个有效包状态均为 `ready`。某个 Window 入口若加载失败，此处绝不会显示为失败，因为 Host 的插件清单不知道该情况。

文本输出：每个插件一行，然后每个问题一行：

```text
hello 0.1.0 Hello — 1 blocks, 1 lenses, window  ready
k8s 0.3.0 Kubernetes — 2 blocks, 1 lenses  disabled
jsonx 1.0.0 JSON Explorer — 0 blocks, 1 lenses  failed: lens tree is declared in plugin.toml but not defined with tern.lens.define
problem /Users/me/Library/Application Support/Tern/plugins/broken: no plugin.toml
```

| 部分 | 含义 |
| --- | --- |
| `ID VERSION NAME` | 来自 manifest |
| `— N blocks, M lenses` | `[[blocks]]` 和 `[[lenses]]` 的计数 |
| `, window` | manifest 包含 `window` 条目时出现 |
| 状态（两个空格之后） | `ready`、`disabled` 或 `failed: ` 加错误的第一行；若 ready 插件的 host 端钩子因超出预算运行而暂停，则会附加 `, paused over budget: ` 和钩子名称（`ready, paused over budget: timer`） |
| `problem DIR: ERROR` | 无法用作插件的文件夹条目 |

文件夹为空时会打印 `no plugins`。退出码为 0。

`--json` 会打印插件清单：

```json
{
  "plugins": [
    {
      "id": "hello",
      "name": "Hello",
      "version": "0.1.0",
      "description": "The plugin fixture: a greeting lens, a counter block and a few hooks.",
      "icon": "sparkle",
      "css": "…",
      "blocks": [
        { "id": "counter", "title": "Counter", "icon": "sparkle", "files": ["*.json"], "palette": true }
      ],
      "lenses": [{ "id": "greet", "patterns": ["tern-hello *"] }],
      "host": true,
      "window": true,
      "status": "ready"
    }
  ],
  "problems": [{ "dir": "/…/plugins/broken", "error": "no plugin.toml" }],
  "jit": false
}
```

| 字段 | 含义 |
| --- | --- |
| `plugins[]` | 已安装插件，按 id 排序 |
| `.icon`、`.blocks[].icon` | 解析后的图标名称（未知时为 `puzzle`） |
| `.css` | 拼接后的 manifest `styles` |
| `.lenses[].patterns` | manifest 的 `match` glob |
| `.host`、`.window` | 对应条目是否存在 |
| `.status` | `"ready"`、`"disabled"` 或 `{"failed": "<full error>"}` |
| `.paused` | 当前因运行超出预算而暂停的 host 端钩子；若没有则省略 |
| `problems[]` | 每个不可用文件夹条目对应的 `{dir, error}` |
| `jit` | 守护进程是否以本机代码生成运行 Luau；无守护进程时始终为 `false` |

## `tern plugin reload`

要求守护进程重新读取 `settings.json` 和插件文件夹，并重新加载每个插件；若提供了 `ID`，则只重新加载该插件，然后像 `list` 一样打印新的插件清单。此机器上的窗口也会以相同方式重新加载：全部 Window 端，或仅重新加载 `ID` 的 Window 端。重新加载插件中正在运行的块会从上次保存的状态重新启动；其他插件保持运行，不受影响。早于此版本的守护进程即使提供了 `ID`，也会重新加载每个插件。参见[生命周期与重新加载](../concepts/lifecycle.md#重新加载)。

若有插件处于 Failed 状态或文件夹存在问题，则打印插件清单后以 1 退出；这样脚本和 CI 可以检查包：

```sh
tern plugin link . && tern plugin reload
tern plugin reload hello   # only the plugin you're working on
```

| 错误 | 退出码 |
| --- | --- |
| `no daemon running` | 1 |
| `the session daemon did not answer`（已过 60 秒） | 124 |

## `tern plugin dir`

打印插件文件夹：`<config>/plugins`；若设置了 `$TERN_CONFIG_DIR`，则为 `$TERN_CONFIG_DIR/plugins`。`--json` 会打印 `{"dir": "<path>"}`。该文件夹可能尚不存在；`install` 和 `link` 会创建它。若机器没有配置目录，则失败并提示 `no config directory for plugins`。

## `tern plugin install`

```sh
tern plugin install ./my-plugin
tern plugin install github.com/me/tern-k8s
tern plugin install github.com/stencil-hq/tern-sdk/plugins/examples/jsonx
tern plugin install https://example.com/me/tern-k8s.git --force
```

将包复制到插件文件夹中的 `<plugins>/<id>`，并以 manifest id 命名，然后重新加载。

若 `SRC` 以 `https://`、`http://`、`git@` 或 `ssh://` 开头，或格式为 `github.com/OWNER/REPO[/PATH]`（会克隆 `https://github.com/OWNER/REPO`，包位于其 `PATH` 目录），则 `SRC` 是 git 源。Git 源会通过 `git clone --depth 1 --quiet` 克隆到临时目录，并设置 `GIT_TERMINAL_PROMPT=0`，因此私有仓库会直接失败，而不会提示输入密码。其他内容都视为本地目录，相对于当前目录；前导 `~` 或 `~/` 表示主目录（因此带引号的 `~/src/plugin`，或在 Preferences（偏好设置）中输入的路径，都可正常使用）。包必须位于源目录或 `PATH` 的根目录。

复制任何内容之前，会使用加载器自身的检查来验证源：manifest 通过所有[文本规则](manifest.md#如何读取-manifest)，其中列出的条目均存在，且其中列出的样式表可读取并符合大小限制。复制时会跟随符号链接、排除 `.git`，先暂存到加载器会跳过的点号命名同级目录，再重命名到目标位置；替换已有副本时，会先将旧副本移到一旁，若重命名失败则将其放回。

| 标志 | 含义 |
| --- | --- |
| `--force` | 替换具有相同 id 的已安装包。若该包在插件文件夹内的目录名称不同，则新副本就位后会删除旧目录 |

输出：`installed ID VERSION → DIR`。`--json` 会打印 `{"id", "version", "dir"}`。

| 错误 | 原因 |
| --- | --- |
| `ID is already installed (DIR); --force replaces it` | 已存在此 id 的包，或名为 `<id>` 的文件或文件夹 |
| `ID is linked (DIR); use unlink first` | 此 id 是已链接的包；`--force` 绝不会替换链接 |
| `no directory SRC: <io error>` | 本地源不存在 |
| `SRC is not a directory` | 本地源是文件 |
| `DIR is not a plugin: no plugin.toml` | 源的根目录中没有 manifest |
| `DIR is not a plugin: <manifest message>` | 某条 [manifest 规则](manifest.md)失败，或 `plugin.toml is larger than 64 KiB` |
| `DIR is not a plugin: missing entry FILE` | manifest 中列出的条目不存在 |
| `DIR is not a plugin: cannot read style FILE: <io error>` | manifest 中列出的样式表不存在或不可读 |
| `DIR is not a plugin: styles are larger than 256 KiB` | 样式表总大小超过限制 |
| `installing from git needs git` | `git` 不在 `PATH` 中 |
| `git clone URL failed: <git's stderr>` | 克隆失败 |
| `no directory PATH in URL` | 克隆内容中没有 `PATH` |
| `PATH is not a directory in URL` | `PATH` 是文件，或经由 `..` 或符号链接指向克隆目录之外 |

## `tern plugin remove`

删除 manifest id 为 `ID` 的已安装包（其位于插件文件夹内的目录，无论该目录名称为何；若是符号链接，则只删除链接本身，不删除目标），然后重新加载。如果没有该 id 的有效包，则改为删除插件文件夹中名称恰好为 `ID` 的文件或文件夹，以清除损坏的包。

输出：`removed ID (DIR)`。`--json` 会打印 `{"removed": "<path>"}`。

| 错误 | 原因 |
| --- | --- |
| `ID is linked; use unlink` | 此 id 属于已链接的包 |
| `no plugin ID in DIR` | 按该 id 或名称均未找到内容 |
| `no plugin id ID` | `ID` 为空、以 `.` 开头，或包含 `/` 或 `\` |

## `tern plugin link`

```sh
tern plugin link ~/src/tern-k8s
```

在原位置使用包：写入 `<plugins>/<id>.path`，其内容为包的绝对规范路径并以换行符结尾，然后重新加载。Tern 会从该目录加载并监视包，因此编辑后无需复制即可重新加载。这是开发环境的设置方式；参见[开始使用](../guides/getting-started.md)。

目录会按 `install` 的方式检查。若该 ID 已经链接，则会更新链接目标。

输出：`linked ID VERSION → DIR`。`--json` 会打印 `{"id", "version", "dir"}`。

| 错误 | 原因 |
| --- | --- |
| `ID is already installed (DIR)` | 存在此 id 的已安装副本（非链接）；请先 `remove` |
| `DIR is not UTF-8` | 无法将包路径写入 `.path` 文件 |
| `no directory …`、`… is not a directory`、`… is not a plugin: …` | 同 `install` |

## `tern plugin unlink`

删除链接 `ID` 的 `.path` 文件（通常为 `<id>.path`，也可能是指向该包目录的其他 `.path` 文件），然后重新加载。包目录本身不会更改。

输出：`unlinked ID (FILE)`。`--json` 会打印 `{"removed": "<path>"}`。

| 错误 | 原因 |
| --- | --- |
| `ID is installed, not linked; use remove` | 此 id 属于插件文件夹中的副本 |
| `no plugin ID in DIR` | 未找到该 id |
| `no plugin id ID` | `ID` 为空、以 `.` 开头，或包含 `/` 或 `\` |

## `tern plugin types`

```sh
tern plugin types .
```

写入 `DIR/tern.d.luau`，即此 Tern 随附的 `tern` 模块 Luau 定义文件；若需要，则创建 `DIR`（相对于当前目录）。若文件已存在则覆盖。输出：`wrote FILE`；`--json` 会打印 `{"file": "<path>"}`。它不会触碰插件文件夹或守护进程。有关 luau-lsp 设置，请参见 [API 参考](api.md#luau-lsp-类型)。

## 错误

用法错误以 2 退出，并打印消息及用法：

| 消息 | 原因 |
| --- | --- |
| `tern plugin: plugin takes other arguments` | 没有动词、动词未知，或词语数量不正确（例如 `tern plugin install` 缺少 `SRC`） |
| `tern plugin: unknown flag --NAME` | 此动词不接受该标志（`--force` 是 `install` 唯一的标志） |
| `tern plugin: --window takes a value` | `--window` 位于行末 |

其他所有失败均以 1 退出（超时则为 124），并输出 `tern plugin: <message>`；具体消息见上方各子命令的表格及[错误](errors.md#命令行)。

## 相关页面

- [发布](../guides/distribution.md)：发布包。
- [包与清单](../concepts/packages.md#plugins-文件夹)：文件夹布局和 `.path` 链接。
- [清单参考](manifest.md)：`install` 和 `link` 检查的规则。
