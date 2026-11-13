# SDK

Rust、Python、Go 和 TypeScript 的四个库可以代你处理 TSP。它们位于 [stencil-hq/tern-sdk](https://github.com/stencil-hq/tern-sdk) 仓库中，并且在线路上的字节完全一致。

每个 SDK 都使用带类型的 props 构建所有 kind：[`button`](../elements/input.md#button)、[`stats`](../elements/data.md#stats)、带有文本、徽标、按钮和 sparkline 单元格的可选择 [`table`](../elements/data.md#table)、带控件的 `card` 标题、分段式 `tabs`，以及 `open` 的 `font` 选项。使用它们构建应用之前，请阅读[设计视图](../guides/design.md)：其中说明了应选择哪些组件，让你的程序无需样式表也能呈现 Tern 自有视图的风格。

| 语言 | 包 | 构建器 |
| --- | --- | --- |
| Rust | crate `tern-sdk`（[`rust/`](https://github.com/stencil-hq/tern-sdk/tree/main/rust)） | `ui::card().head("…").child(…)`，处理器使用你的消息类型 |
| Python | `tern-sdk`，`import tern_sdk`（[`python/`](https://github.com/stencil-hq/tern-sdk/tree/main/python)） | `ui.card(…, head="…")`，处理器使用可调用对象 |
| Go | `github.com/stencil-hq/tern-sdk/go/tern`（[`go/tern/`](https://github.com/stencil-hq/tern-sdk/tree/main/go/tern)） | `ui.Card{Head: ui.T("…")}`，处理器使用函数 |
| TypeScript | `@stencil-hq/tern`（[`typescript/`](https://github.com/stencil-hq/tern-sdk/tree/main/typescript)） | TSX：`<card head="…">`，处理器作为 props 传入 |

同一张卡片在 Tern 中会保留于滚动回溯区，在其他任何地方则会打印为纯文本：

```rust
tern_sdk::print(
	ui::card().head("cargo test").status(ui::Status::Done).child(ui::md("All **42** tests pass.")),
	PrintOptions::new(),
)?;
```

```python
tern_sdk.show(ui.card(ui.md("All **42** tests pass."), head="cargo test", status="done"))
```

```go
tern.Print(ctx, tern.Main(ui.Card{
	Head:     ui.T("cargo test"),
	Status:   ui.Done,
	Children: ui.Nodes(ui.Md{Text: "All **42** tests pass."}),
}), tern.PrintOptions{})
```

```tsx
await print(
   <card head="cargo test" status="done">
      <md>{'All **42** tests pass.'}</md>
   </card>
);
```

## 它们能为你做什么

| 协议部分 | SDK 的职责 |
| --- | --- |
| [传输](transport.md) | 为每条消息添加帧，在 Tern 的解析器会完整读取每个片段的 `apc` 限制处对正文分块，并编码 blob，返回用于命名每个 blob 的 SHA-256 ID。其输入解析器会从 pty 输入中拆出 `tsp;r` 和 `tsp;e`（APC 或 OSC 877），并传递按键；方括号括起的粘贴内容中的文本绝不会被读取为 TSP。 |
| [握手](handshake.md) | 将 tty 设为原始模式，随 DA1 发送 `hello`；在 `TERN_TSP=0`、没有 tty、处于 screen 或 zellij 中、DA1 先响应，或一秒内未收到 `hello` 回复时，报告不支持 TSP。在 tmux 中，只有 Tern 绘制该会话时才会探测，并且只发送 `hello`；窗格的 `allow-set-title` 会保持关闭，直到程序停止使用 TSP（[在 tmux 中](handshake.md#在-tmux-中)）。保持 `cols`、`dark` 和 `reduceMotion` 为最新值，并提供 `hour12`（不发送该值的终端会令其为 false）。 |
| [界面表面](surfaces.md) | 打开、设置样式并关闭 surface；关闭时先发送最后一个待处理帧，再发送 `x`，撤销终端模式并排空输入，使回复不会到达 shell。 |
| [文档与帧](documents.md) | 渲染完整视图并仅发送差异；ID 按键生成，与 Tern 的[插件 worker](../guides/blocks.md#区域、节点-id-和键)生成方式完全一致：`main.<key or index>…`。仅在后缀增长的文本会以 `append` 发送。 |
| [输入与事件](input.md) | 解码按键（旧版 xterm、kitty `CSI u`、粘贴），并按 surface 和节点 ID 将每个事件路由给该节点上的处理器；其余事件交给你的循环。 |
| [流量控制](operations.md#流控) | 未确认帧最多保留 `credits` 帧，并将等待期间的每次渲染合并到一帧中。 |
| [调试](operations.md#调试) | `TERN_TSP_RECORD=<file>` 将每条消息记录为 JSONL，供 `surface-play` 使用。 |

两个辅助函数可满足大多数 CLI 的需求：`print`（Python 中为 `show`）会在 `flow` surface 中绘制静态视图，并将其保留为命令输出；`ask` 会显示表单，并返回提交该表单的 action 及其 `values`。`plain` 会将任意视图渲染为纯文本，以便作为回退方案。

每个 SDK 都附带相同的五个示例：`table`（使用 `print` 展示目录列表）、`ask`（[上文会话](index.md#一个完整会话)中的表单）、`progress`（运行中卡片里的流式构建日志）、`chat`（程序通过按键驱动带停靠式编辑器的 inline surface），以及 `dashboard`（一个使用 sans 字体的全屏应用，将[设计指南](../guides/design.md)中的配方组合起来：标题行、扁平统计栏、三个视图的标签页；每个视图都是一张全宽可选择表格，旁边配有包含主要操作的详情卡片；dock 中有确认栏和按键图例，并支持实时更新）。

在 Tern 之外，`plain` 会将每种 kind 输出为文本：`button` 输出为 `[Label]`，`stats` 按每个 tile 输出为 `label: value (sub)`，表格单元格则输出其文本（按钮单元格为 `[Label]`，sparkline 输出为 `▁▂▅` 块）。
