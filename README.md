# Tern 中文文档

Tern 官方文档的非官方简体中文翻译，按页面完整翻译并尽量保持上游结构。

- 在线文档：[Tern 中文文档](https://explorer-cc.github.io/tern-doc-zh/)
- 上游文档：[docs.stencil.so/tern](https://docs.stencil.so/tern/)
- Tern SDK：[stencil-hq/tern-sdk](https://github.com/stencil-hq/tern-sdk)
- 参考实现：[Aieguu/omp-docs-cn](https://github.com/aieguu/omp-docs-cn)

## 本地开发

```sh
npm ci
npm run docs:dev
```

首页自定义样式位于 `docs/.vitepress/theme/style.css`，功能卡片与正文之间保留 32px 间距，仅作用于首页。

## 构建和预览

```sh
npm run sync:check
npm run sync:assets
npm run docs:verify
npm run docs:build
npm run docs:preview
```

## 同步上游 Markdown

```sh
npm run sync:check
```

抓取结果和哈希清单写入 `.cache/tern-upstream/`，不会覆盖中文译文。`upstream-baseline.json` 保存已经翻译并验收的上游页面哈希。`sync:check` 发现新增、修改或删除页面时会输出 `NEW`、`CHANGED`、`REMOVED`，并以非零状态退出；这是等待译文同步的信号，不应跳过检查或直接接受新基线。抓取先沿页面正文链接进行，再补抓上游侧边栏 `toc.html` 列出的全部页面，因此只出现在侧边栏中的页面也会进入清单。

更新步骤：

1. 运行 `npm run sync:check`，查看页面差异。
2. 如需分段阅读原文，运行 `npm run sync:export-source`。临时目录 `translation-source/` 带生成标记，可在完成后删除；它不属于中文发布内容。
3. 按 `.cache/tern-upstream/snapshot/` 中的原文更新 `docs/` 对应页面。新增或删除页面时一并调整映射、导航和入链；图示使用指向 `docs/assets/` 的相对路径。
4. 运行 `npm run sync:assets`，按当前来源清单下载官方原图，原样覆盖本地同名图片。此命令不会改写中文正文，新增或更名的图片引用需随译文更新。
5. 运行 `npm run docs:verify` 和 `npm run docs:build`，再通过预览检查修改过的页面。
6. 全部通过后运行 `npm run sync:accept`，将译文、本地图片、页面清单和新基线一起提交。

GitHub Actions 在 `main` 更新后构建并发布到 GitHub Pages。首次部署前，在 GitHub 仓库的 **Settings → Pages** 中将发布源设为 **GitHub Actions**。VitePress 会从 Actions 的 `GITHUB_REPOSITORY` 推导项目站点 `base`；若发布路径不同，可设置 `PAGES_BASE`。

## 翻译状态

来源核对日期：**2026-11-23**。上游没有可确认的文档版本标签，不能将该日期当作 Tern 的发布版本。

2026-11-23 复核：85 个上游 Markdown 页面与已接受基线逐页哈希一致，站点全部文件的 `Last-Modified` 为 2026-10-31，`print.html` 的 1030 个标题与抓取快照逐条对应，372 张图片重新下载后无变化，上游内容没有更新。此前只跟随正文链接的抓取漏掉了只出现在侧边栏中的 `reference/glossary.md`（术语表，69 条术语）；该页已补译，`sync:check` 现在同时抓取侧边栏 `toc.html` 列出的页面。

`upstream-pages.json` 当前记录 **85 个页面**，均有对应中文译文：

| 分类 | 页数 |
| --- | ---: |
| 首页 | 1 |
| 概念与架构 | 6 |
| 插件开发指南 | 15 |
| Surface Protocol | 9 |
| 界面元素 | 10 |
| 样式参考 | 3 |
| 脚本参考 | 22 |
| 示例插件 | 7 |
| API 参考 | 12 |

已完成 2026-11-13 核对时全部 84 页非代码说明的一轮源译逐段技术审校，修正了漏段、截断的表格说明、条件与主客体错译、图片位置说明和残留解释性英文；2026-11-23 补译的术语表页尚未经过同等审校。代码、命令、API 标识符、协议值及需要对应实际界面的原始标签不作机械逐词翻译。这是一轮审校记录，不是“逐字一致”或零漏译、零错译保证。

`docs:verify` 已对照上游检查全部 85 页和 710 个代码块，包括章节顺序、表格行列、站内链接、实际标题锚点及图示引用；生产构建通过。浏览器已检查导航、API 代码字面量、中文搜索、Mermaid、修改后的数字上标和图片显示。结构检查不代替技术审校；上游 CSS 说明中的已知矛盾见 `TODO.md`，未擅自判定哪种说法代表实际实现。

## 图示与发布边界

- 372 张 PNG（186 组浅深色图示）已原样保存到 `docs/assets/figures/`，保留官方文件名；正文的 `src`、`srcset` 使用本地相对路径，官方来源 URL 保留在 `upstream-pages.json`。全部文件的 SHA-256 与既有官方原图记录一致。
- 图片本地化已通过 84 页、710 个代码块的文档校验及生产构建；本地生产预览和 GitHub Pages 均完成 18 页 × 2 主题检查，372 张图片均可解码。开发预览曾临时预打包 `fastdom` 及其 `fastdom-promised.js` 子入口以绕过开发模式导出错误，未修改项目依赖或生产配置。
- 历史逐图观察及资源哈希保存在 [image-review.json](image-review.json)，不作为后续图片同步的前置条件；正文中的额外本站图片校对说明已删除。
- 修复了 19 处 HTML 图注中反引号直接显示的问题；API 名称现以真正的行内代码渲染。架构 Mermaid 也已在两种主题下检查实际节点、连线和完整标签，而非只检查 SVG 是否存在。
- 图片原样沿用上游，不修改图内文字或布局，不额外要求辨认细节、补图或重绘。
- 后续同步先运行 `npm run sync:check` 更新来源清单，再运行 `npm run sync:assets` 更新原图，并同步对应译文和图片引用。只检查来源、资源完整性、引用和浅深色显示，不增加图片内容辨认要求；图片文件与正文一并提交。
- 官方文档及图示的翻译、再发布许可仍待确认；SDK 仓库的开源状态不能作为文档资源已获授权的依据。
- 源码仓库为 [Explorer-cc/tern-doc-zh](https://github.com/Explorer-cc/tern-doc-zh)，默认分支为 `main`。已通过 [GitHub Actions 构建与部署](https://github.com/Explorer-cc/tern-doc-zh/actions/runs/43379809943)，线上地址为 [explorer-cc.github.io/tern-doc-zh](https://explorer-cc.github.io/tern-doc-zh/)；84 条页面路由、深层页刷新、站内导航、本地图片和两种主题下的架构 Mermaid 均已实际验收。
- 2026-11-23 推送 `f6c1d6c` 后的[部署](https://github.com/Explorer-cc/tern-doc-zh/actions/runs/45201253704) build、deploy 均成功，`sync:check`、`docs:verify` 和生产构建在 Actions 内通过。线上验收：85 条路由全部返回 200，标题和页脚核对日期正确（5 个分类首页以带斜杠的地址提供，不带斜杠时 301 跳转）；页面引用的 504 个资源全部可达，其中 372 张图片、CSS 和字体的大小与本地构建一致；浏览器实测首页完成水合，经导航栏和侧边栏到达术语表页，表内 56 个链接目标全部可达，架构页 Mermaid 渲染出 5 个节点、4 条连线，列表页当前主题的 21 张图片在浅、深两种主题下均解码成功，无控制台错误。站点未声明 favicon，浏览器回退请求的 `/favicon.ico` 返回 404，属既有现象，与本次改动无关。
- Mermaid 依赖使部分构建分块超过 Vite 的 500 kB 提示阈值；当前构建成功，未关闭该提示。

## 许可证

本站原创站点代码、配置和维护脚本采用 [MIT License](LICENSE)，版权署名为 `tern-docs-zh contributors`。许可证选择参考 [aieguu/omp-docs-cn 的 MIT License](https://github.com/Aieguu/omp-docs-cn/blob/main/LICENSE)，不沿用其作者署名。

Tern 官方文档原文、对应中文译文、上游示例代码及 `docs/assets/` 中的官方图片不纳入本站 MIT 授权范围，相关权利仍归原权利人，并按各自适用的许可处理。官方文档和图示的翻译、再发布授权尚未确认；本站的 MIT 声明不构成对这些内容的重新授权，也不表示已经取得公开再发布许可。第三方依赖保留各自许可证。
