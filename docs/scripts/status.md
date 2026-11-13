# 账户、更新和云端启动

这些命令可将账户门控、更新界面和云端 Kickoff 进度置于已知状态，而无需登录、下载构建或配置机器。你可以在脚本中或通过 `tern ctl` 捕获账户界面、更新偏好设置和进度提示。

## 账户

| 命令 | 作用 |
| --- | --- |
| `account signed-out` | 显示登录门控，并清除账户句柄和图片。 |
| `account waiting` | 显示等待浏览器登录的状态。 |
| `account waitlisted [<username>]` | 显示候补名单门控，可选指定账户名称。 |
| `account failed <message>` | 显示登录失败门控，并附上所给消息。 |
| `account signed-in [<username>] [picture <file>]` | 隐藏门控、显示账户头像并提供退出登录操作。 |

每种形式都会使门控生效，即使无头窗口通常不受门控也一样。它会取消任何待处理的登录等待，但不会验证账户，也不会等待浏览器或网络回复。每条命令都会稳定处理 450 毫秒。

用户名和失败消息可以是带引号的字符串，也可以由多个词组成；这些词会以空格连接。句柄前会加一个 `@`。未提供名称时登录使用 `@ada`，候补名单账户未提供名称时则没有句柄。`failed` 要求消息非空白。`picture` 后必须恰好跟一个文件参数，并且必须位于可选名称之后。它使用本地图片：绝对路径或存在的相对路径会直接使用；否则会在 Tern 测试夹具根目录下解析。解析测试夹具根目录可能失败。`account signed-out` 和 `account waiting` 会忽略多余词。

`tern ctl state` 会在 `gate` 中反映这些命令：`applies`、`phase`、`signed_in`、`handle` 和 `error`。登录会将 `phase` 设为 `off`；失败会将 `error` 设为相应消息。等待和失败不会清除之前的句柄或图片。状态中不包括图片本身。

```text
ready
account signed-out
shot account-signed-out
account waiting
shot account-waiting
account waitlisted "ada"
shot account-waitlisted
account failed "The sign-in server answered 500 (server_error)"
shot account-failed
account signed-in "ada" picture "goldens/fixtures/account-picture.png"
wait 300
shot account-picture
```

## 更新

| 命令 | 作用 |
| --- | --- |
| `update idle` | 显示已是最新状态，检查时间为刚刚。 |
| `update checking` | 显示正在检查。 |
| `update downloading <percent>[%]` | 显示 0 到 100% 的下载进度。 |
| `update preparing <percent>[%]` | 显示正在为已下载的构建做就绪准备，进度为 0 到 100%。 |
| `update waiting` | 显示较新构建正在等待构建服务提供补丁。 |
| `update ready` | 显示已下载的构建可供安装。 |
| `update installed` | 显示其他窗口已安装的构建。 |
| `update failed <message>` | 显示更新失败。 |
| `update unsupported <message>` | 显示更新不可用的原因。 |

这些命令在 iOS 上不可用。它们会替换显示的状态，但不会检查网络，也不会下载或安装任何内容。每条命令都会稳定处理 450 毫秒，并非等待真实更新。`checking`、`downloading` 和 `preparing` 会保持该状态，直到提供另一状态。

示例发布版本为 `0.2.0 (abcdef0)`，下载大小为 48,000,000 字节。下载和准备进度必须是 0 到 100 的整数，可选跟随 `%`；缺失、非数字或超出范围的进度会报错。`failed` 和 `unsupported` 要求非空白消息，并将余下的词以空格连接。`idle`、`checking`、`waiting`、`ready` 和 `installed` 会忽略多余词。

新待处理版本会显示“Update ready”提示，并公开“Restart to update”胶囊按钮和命令面板操作。账户门控显示期间会隐藏该按钮。在 `ready` 或 `installed` 后设置 `checking`、`downloading` 或 `preparing`，会使版本继续保持待处理状态，按钮也继续显示，直到另一状态确定下来。重复提供相同示例版本不会再次提示，除非是在响应用户请求的检查。在没有真实更新器的无头窗口中，单击 Restart 只会报告更新已关闭；不会重启或安装示例构建。

`tern ctl state` 会公开 `update.status`、`release`、`received`、`total` 和 `message`。`asked` 表示有待处理的用户请求检查；`announced` 表示已通知的版本 ID。下载和准备状态会填写字节数（`received` 是已下载或写入的字节数）；失败和不支持状态会填写 `message`。尚无状态或更新器之前，`status` 为 `off`。

```text
ready
update idle
prefs general
prefs search "update"
shot update-prefs-idle
update failed "Could not reach https://build.stencil.so: connection refused"
shot update-prefs-failed
update waiting
shot update-prefs-waiting
update downloading 42
shot update-prefs-downloading
update ready
wait 7000
shot update-prefs-ready
```

## 云端启动（Kickoff）

| 命令 | 作用 |
| --- | --- |
| `kickoff packing` | 显示“Packing stencil…”。 |
| `kickoff starting` | 显示“Starting a cloud machine…”。 |
| `kickoff installing` | 显示“Installing Tern…”。 |
| `kickoff connecting` | 显示“Connecting…”。 |
| `kickoff uploading <sent> <total>` | 显示已上传和总计兆字节数。 |
| `kickoff setting-up <line>` | 显示“Setting up stencil ·”以及提供的行。 |
| `kickoff off` | 结束模拟任务并隐藏进度胶囊。 |

Kickoff 命令仅桌面版可用。它们会显示名为 `stencil` 的模拟检出目录的进度，不需要 `TERN_KICKOFF` 功能标志、已登录账户、检出目录或云端连接。它们不会启动机器、上传文件或打开远程会话。每条命令都会稳定处理 450 毫秒；步骤不会等待实际工作，也不会自动推进。账户门控显示期间会隐藏胶囊。

`uploading` 要求恰好两个十进制 MB 的无符号整数大小（1 MB = 1,000,000 字节），不能是百分比或字节数。`sent` 不必小于或等于 `total`。`setting-up` 要求恰好一个参数：包含空格的行要加引号。其他步骤不接受参数；缺少或多余参数以及未知步骤都会报错。

`tern ctl state` 中没有 Kickoff 字段。使用 `tree` 检查可见进度胶囊，或用 `shot` 截屏；使用 `kickoff off` 清除模拟进度。

## 另请参阅

- [脚本](index.md)：运行命令、语法和测试夹具路径。
- [偏好设置](prefs.md)：打开 Updates 设置区。
- [测试框架命令](harness.md)：截屏和动画计时。
- [控制命令](control.md)：检查状态和可见树。
- [远程主机](remote.md)：驱动真实远程连接。
- [调试](../guides/debugging.md#通过脚本驱动-window)：驱动正在运行的窗口。
