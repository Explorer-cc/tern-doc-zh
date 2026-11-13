# 分发

插件以一个目录的形式交付，根目录中包含 `plugin.toml`，通常该目录是一个 git 仓库。用户通过 `tern plugin install` 安装插件；该命令会将插件复制到 plugins 文件夹中。开发期间，`tern plugin link` 会从插件所在位置加载它。本页介绍如何组织仓库、所有会更改文件夹的 `tern plugin` 子命令、如何启用和停用插件、版本管理、iOS 和远程主机上的安装位置，以及如何查找和分享插件。

```sh
tern plugin install github.com/you/tern-k8s
```

## 打包仓库

`install` 从源目录的根目录获取软件包：仓库根目录（或指定的目录）必须包含 `plugin.toml`。git URL 始终从仓库根目录安装；若要从一个 GitHub 仓库分发多个插件，请为每个插件单独建一个目录，并通过 `github.com/OWNER/REPO/PATH` 安装（见[安装](#安装)）。

```text
tern-k8s/
  plugin.toml
  host.luau
  window.luau
  lib/
    pods.luau
  k8s.css
  README.md
  LICENSE
```

除 `.git` 目录外，源目录中的所有内容都会被复制，因此安装后的软件包也会包含 README、测试和截图。加载器只读取 `plugin.toml`、入口文件、这些入口文件 `require` 的模块、`styles` 文件，以及处理器通过 `tern.fs` 读取的内容；其余文件只会占用空间。不要将大型资源和构建输出放进仓库：软件包目录会受到变更监视，在 Linux 和 iOS 上，大型目录树会增加监视和轮询开销（见[生命周期与重新加载](../concepts/lifecycle.md#监视)）。

插件在运行时写入的文件必须放在 `tern.plugin.data` 中，绝不能放在软件包内：安装会替换软件包目录，而其中的任何变更都会导致插件重新加载。

如果提交 `tern plugin types` 写入的 `tern.d.luau`，它也会随其他文件一同复制；运行时不会读取它。许多作者会忽略该文件，让每位贡献者针对自己使用的 Tern 版本生成它。

## 安装

```sh
tern plugin install SRC [--force]
```

`SRC` 是 git URL 或本地目录：

| SRC | 解释为 |
| --- | --- |
| 以 `https://`、`http://`、`git@` 或 `ssh://` 开头 | git URL，按原样克隆。 |
| 以 `github.com/` 开头 | `github.com/OWNER/REPO`，从 `https://github.com/OWNER/REPO` 克隆；`REPO` 之后的部分是其中的软件包目录（`github.com/stencil-hq/tern-sdk/plugins/examples/jsonx`）。 |
| 其他任何形式 | 相对于当前目录的目录。 |

git 源会从默认分支浅克隆（`--depth 1`）到临时目录，之后临时目录会被删除。安装需要在 `PATH` 上有 `git`（否则会提示 `installing from git needs git`）。git 运行时会关闭终端提示，因此需要密码的仓库会直接失败，而不会询问密码；私有仓库请使用已加载密钥的 SSH URL 或凭据助手。克隆失败时会报告 `git clone URL failed:` 和 git 的错误消息。要安装默认分支以外的标签或分支，请自行克隆，然后安装该目录。

复制之前，`install` 会在不运行任何 Lua 代码的情况下检查软件包：`plugin.toml` 必须能按 schema 1 成功解析，且 `host`、`window` 入口文件以及所有 `styles` 文件都必须存在。检查失败时会报告 `DIR is not a plugin: WHY`。Lua 错误只有在插件加载后才会显示，因此请查看命令在复制后打印的内容。

软件包会安装为 `<plugins>/<id>`，目录名取自其 manifest `id`，与源目录名称无关：

1. 源目录会被复制到目标旁边一个以点开头的暂存目录中；复制时会跟随符号链接并排除 `.git`（加载器会跳过以点开头的名称，因此未完成的复制绝不会被加载）。
2. 已有副本会移到另一个以点开头的目录，新副本会重命名到目标位置，然后旧副本会被删除。如果重命名失败，旧副本会移回原处。

若安装的 id 已经安装，命令会失败并显示 `ID is already installed (DIR); --force replaces it`。使用 `--force` 时，新副本会替换旧副本；如果旧副本位于名称不同的目录中，该目录也会被删除。已链接的软件包绝不会被替换：无论是否使用 `--force`，`install` 都会失败并显示 `ID is linked (DIR); use unlink first`。

```text
$ tern plugin install ~/src/tern-k8s
installed k8s 0.3.0 → /Users/me/Library/Application Support/Tern/plugins/k8s
```

发生变更后，命令会让会话守护进程重新加载插件，并打印加载失败的插件和文件夹中的任何问题。如果没有运行中的守护进程，则会打印 `no daemon running; changes apply at next start`。机器上的窗口会通过各自对该文件夹的监视，重新加载其 Window 端。见[生命周期与重新加载](../concepts/lifecycle.md#重新加载)。

Preferences › Plugins 页面中的 **Install…** 与此安装方式相同：指定目录或 git URL，然后将其复制到 plugins 文件夹。它不会替换已安装的副本（没有 `--force`）。目录路径开头的 `~` 表示主目录；命令行中也一样。

## 开发期间链接

```sh
tern plugin link ~/src/tern-k8s
```

`link DIR` 会像 `install` 一样验证软件包，然后写入 `<plugins>/<id>.path`，其中保存该目录的绝对路径。Tern 会从该路径加载软件包并监视该目录，因此保存文件后插件会重新加载。使用另一个目录再次链接会移动该链接。如果另一个不同的软件包已安装该 id，链接会失败（`ID is already installed (DIR)`）。

`tern plugin unlink ID` 会移除 `.path` 文件，并保留你的目录。若安装的是普通副本而非链接，则命令会失败（`ID is installed, not linked; use remove`）。

## 移除

`tern plugin remove ID` 会删除已安装的副本并触发重新加载，行为与 `install` 相同。它会拒绝移除已链接的软件包（`ID is linked; use unlink`）。插件的数据文件夹 `<state>/plugin-data/<id>/` 及其中的 `kv.json` 会保留，因此重新安装后仍能找到原有状态；如需从头开始，请手动删除该文件夹。

主机重新加载后，被移除插件所定义类型的块会结束，并显示 `no block type KIND on this host`。

## 文件夹位置

`tern plugin dir` 会打印 plugins 文件夹（`<config>/plugins`；见[软件包与清单](../concepts/packages.md#目录)）。每个 `tern plugin` 子命令都接受 `--json` 和 `--window KEY`。

| 子命令 | 打印内容 |
| --- | --- |
| `dir` | 文件夹。 |
| `install SRC [--force]` | `installed ID VERSION → DIR` |
| `link DIR` | `linked ID VERSION → DIR` |
| `unlink ID` | `unlinked ID (FILE)` |
| `remove ID` | `removed ID (DIR)` |

所有子命令及其输出见[命令行](../reference/cli.md)。

## 启用和停用插件

两个设置决定机器上会加载哪些内容：

```json
{
	"plugins": true,
	"plugins_disabled": ["k8s"]
}
```

`plugins = false` 表示不加载任何插件。`plugins_disabled` 中的 id 会保持安装状态但不加载：在 `tern plugin list` 中状态为 `disabled`，在偏好设置中显示为 Off。已停用的插件不会运行任何 Lua，不会安装样式，其块类型也会从该主机上移除。

Preferences › Plugins 页面为总开关和每个插件分别提供开关；切换任一开关都会保存设置，并重新加载该窗口和其守护进程中的插件。手动编辑 `settings.json` 后，请从命令面板依次运行 **Reload settings** 和 **Reload plugins**：守护进程会在每次重新加载时读取文件，但窗口会继续使用当前持有的设置，直到被告知重新读取。

设置按机器分别保存。在笔记本电脑上关闭插件，不会使其在远程主机上也关闭。

## 版本管理

manifest 中的 `version` 是自由格式文本。Tern 会在 `tern plugin list`、偏好设置和安装输出中显示它，但从不进行版本比较：没有更新命令，也不进行依赖解析。用户可以通过再次使用 `--force` 安装，或在已链接的检出目录中运行 `git pull` 来更新。

实用规则：

- 每次发布都递增 `version`，方便用户和错误报告说明运行的版本。
- 确保默认分支始终可安装：`install` 会克隆该分支的最新提交。为希望固定版本的用户标记发布标签。
- `schema = 1` 表示 manifest 格式，不是你的版本；请保持不变。
- 插件 API 没有版本号。Tern 新版本添加的成员在旧版本中不存在，因此依赖新功能时，应使用 `if tern.chrome then … end` 这样的检查。
- 确保保存的状态在不同版本间仍可读取。安装会重新加载主机，运行中的块会在新代码下重启，并使用旧代码的 `save` 返回的状态。`tern.kv` 中的数据和数据文件夹也会保留；如果数据格式可能变化，请在旁边保存格式编号。

## iOS

iPhone 和 iPad 上的 Tern 没有命令行，也没有 `git`。其插件文件夹是应用的 `Documents/Plugins`，可在“文件”App 中通过 On My iPhone（或 iPad）› Tern › Plugins 找到；Preferences › Plugins 会显示该位置。使用“文件”App 将软件包文件夹复制到那里（来源可以是 iCloud Drive、共享内容或 AirDrop），然后使用页面上的 Reload 按钮或命令面板中的 **Reload plugins**；该文件夹也会每两秒轮询一次变更。

iOS 只运行 Window 端，并以解释方式运行（无 JIT）。Host 入口会被跳过：块和 Lens 来自应用所连接的主机，只要这些主机安装了插件，它们就会显示。`tern.process.run` 在 iOS 上会引发错误，因此要同时适用于 iOS 和其他平台的 Window 端代码应先检查：

```lua
if tern.runtime.os ~= "ios" then
	tern.process.run({ "git", "status", "--short" }, nil, function(result, _cx)
		tern.log.warn("git status", result.status)
	end)
end
```

见[支持矩阵](../concepts/support-matrix.md)。

## 远程主机

每个端都在其上下文所在的位置运行，因此要在运行该端的机器上安装它：

| 端 | 安装位置 |
| --- | --- |
| Host 端（块、Lens、钩子、`spawn` 过滤器） | 所服务的窗格所在的机器。对于远程主机，就是该主机。 |
| Window 端（命令、按键、路由、chrome、布局） | 显示这些窗口的机器。它适用于其中的每个窗格，包括远程窗格。 |
| manifest `styles` | 任一端均可。远程主机上处于 Ready 状态的插件会在你的窗口中安装其 manifest 样式。 |

要安装到远程主机，请在该主机的窗格中运行 `tern plugin install`：该机器上的 `tern` 会将插件安装到本机的 plugins 文件夹，并重新加载该主机的守护进程。若插件包含两端，且你希望它在远程窗格中可用，则需在两台机器上都安装。远程主机上的插件会以只读形式显示在 Preferences › Plugins 页面中对应主机名称下；命令面板中的 **Reload plugins** 会重新加载所有已连接的主机。

远程主机的 Window 端不会在你的窗口中运行，其 `tern.css` 样式表也不会传到这些窗口；只有其 manifest 样式会传递过来。见[架构](../concepts/architecture.md#每个部分的运行位置)和[Chrome 与样式](chrome.md#全局-css)。

## 查找和分享插件

Tern 没有官方插件注册表，应用中也没有插件库：Preferences › Plugins 只会安装你指定来源的插件。其他人编写的插件列在 [Awesome Tern](https://github.com/theblazehen/awesome-tern) 中；这是一个收录 Tern 插件、Surface Protocol 应用和工具的社区目录，其中类型为 `plugin` 的条目是 Luau 插件。Stencil 不运营或审核该目录。许多作者还会在其仓库中添加 [`tern-plugin`](https://github.com/topics/tern-plugin) GitHub 主题标签。

若要从 GitHub 仓库安装插件，请通过其路径指定；如果软件包不在仓库根目录，则在路径中添加文件夹：

```sh
tern plugin install github.com/OWNER/REPO
tern plugin install github.com/OWNER/REPO/PATH
```

该文件夹必须包含 `plugin.toml`；若仓库在子文件夹中存放多个插件，则需要指定相应子文件夹。GitHub 网页视图中的子文件夹链接 `https://github.com/OWNER/REPO/tree/BRANCH/PATH` 应写作 `github.com/OWNER/REPO/PATH` 安装：去掉 `https://` 和 `tree/BRANCH`，因为安装始终使用默认分支（见[安装](#安装)）。同一个来源也可用于 Preferences › Plugins › **Install…**。对于其他 git 托管平台，请提供完整 git URL；该方式会从仓库根目录安装。

分享插件：

1. 将其发布为可通过 `tern plugin install` 安装的公开 git 仓库，并在根目录或单独文件夹中放置 `plugin.toml`（见[打包仓库](#打包仓库)）。
2. 在 README 中写明准确的安装命令、需要在 `PATH` 上可用的程序，以及插件包含哪些端（见[远程主机](#远程主机)）。
3. 为仓库添加 `tern-plugin` 主题标签。
4. 按照其[贡献指南](https://github.com/theblazehen/awesome-tern/blob/main/CONTRIBUTING.md)，通过拉取请求向目录的 `list.yml` 添加条目，提议将插件收录其中。

## 信任

安装插件会使其代码获得与你的账户相同的访问权限：`tern.fs` 和 `tern.process` 可以访问你能够访问的任何内容。安装前请阅读插件，并优先选择你能够在所安装提交版本上审查的来源。见[信任与安全](../concepts/security.md)。

## 另请参阅

- [包与清单](../concepts/packages.md)：包布局和清单。
- [命令行](../reference/cli.md)：完整介绍 `tern plugin`。
- [调试](debugging.md)：查看安装命令打印的内容。
- [Awesome Tern](https://github.com/theblazehen/awesome-tern)：社区插件目录。
