import { readFileSync } from "node:fs";
import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
const repository = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = process.env.PAGES_BASE ?? (
  repository && !repository.endsWith(".github.io") ? `/${repository}/` : "/"
);

const pageMap = JSON.parse(readFileSync(new URL("../../upstream-pages.json", import.meta.url), "utf8"));
const groups = [
  ["concepts", "概念与架构"],
  ["guides", "插件开发指南"],
  ["protocol", "Surface Protocol"],
  ["elements", "界面元素"],
  ["styles", "样式参考"],
  ["scripts", "脚本参考"],
  ["examples", "示例插件"],
  ["reference", "API 参考"],
];

function pageTitle(path, fallback) {
  const localPath = new URL(`../../docs/${path}`, import.meta.url);
  try {
    const source = readFileSync(localPath, "utf8");
    return source.match(/^#\s+(.+)$/m)?.[1].replace(/\s*\{#[^}]+\}\s*$/, "") ?? fallback;
  } catch {
    return fallback;
  }
}

function pageLink(path) {
  const route = path.replace(/\.md$/, "").replace(/\/index$/, "/");
  return `/${route}`;
}

const sidebar = Object.fromEntries(groups.map(([prefix, label]) => {
  const items = Object.entries(pageMap)
    .filter(([path]) => path.startsWith(`${prefix}/`))
    .map(([path, page]) => ({
      text: pageTitle(path, page.title),
      link: pageLink(path),
    }));
  return [`/${prefix}/`, [{ text: label, items }]];
}));

export default withMermaid(defineConfig({
  lang: "zh-CN",
  title: "Tern 中文文档",
  description: "Tern Plugin SDK 与 Surface Protocol 中文文档",
  base,
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    siteTitle: "Tern 中文文档",
    docFooter: { prev: "上一页", next: "下一页" },
    outline: { label: "本页目录" },
    lastUpdated: { text: "最后更新于" },
    returnToTopLabel: "回到顶部",
    sidebarMenuLabel: "菜单",
    darkModeSwitchLabel: "主题",
    lightModeSwitchTitle: "切换到浅色模式",
    darkModeSwitchTitle: "切换到深色模式",
    skipToContentLabel: "跳转到内容",
    notFound: {
      title: "页面未找到",
      quote: "请检查链接，或从首页重新查找文档。",
      linkLabel: "前往首页",
      linkText: "返回首页",
    },
    nav: [
      { text: "指南", link: "/guides/getting-started" },
      { text: "Surface Protocol", link: "/protocol/" },
      { text: "API 参考", link: "/reference/api" },
      { text: "上游文档", link: "https://docs.stencil.so/tern/" },
      { text: "源码", link: "https://github.com/stencil-hq/tern-sdk" }
    ],
    sidebar,
    search: {
      provider: "local",
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: "搜索", buttonAriaLabel: "搜索" },
              modal: {
                displayDetails: "显示详细列表",
                resetButtonTitle: "重置搜索",
                backButtonTitle: "关闭搜索",
                noResultsText: "没有找到相关结果",
                footer: {
                  selectText: "选择",
                  selectKeyAriaLabel: "回车",
                  navigateText: "切换",
                  navigateUpKeyAriaLabel: "上箭头",
                  navigateDownKeyAriaLabel: "下箭头",
                  closeText: "关闭",
                  closeKeyAriaLabel: "Esc",
                },
              },
            },
          },
        },
      },
    },
    footer: {
      message: "非官方简体中文翻译 · 上游文档版本未确认 · 来源核对日期：2026-11-24",
    },
  },
  mermaid: {
    htmlLabels: false,
  },
  markdown: {
    codeCopyButtonTitle: "复制代码",
    config(md) {
      const renderInlineCode = md.renderer.rules.code_inline!;
      md.renderer.rules.code_inline = (tokens, index, options, env, renderer) => {
        tokens[index].attrSet("v-pre", "");
        return renderInlineCode(tokens, index, options, env, renderer);
      };
    },
    image: {
      lazyLoading: true
    }
  }
}));
