import { readFile, readdir, stat } from "node:fs/promises";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { createMarkdownRenderer } from "vitepress";

const ROOT = new URL("../", import.meta.url);
const pathFromRoot = (path) => fileURLToPath(new URL(path, ROOT));
const pageMap = JSON.parse(await readFile(pathFromRoot("upstream-pages.json"), "utf8"));
const sourceRoot = pathFromRoot(".cache/tern-upstream/snapshot/");
const docsRoot = pathFromRoot("docs/");
const markdown = await createMarkdownRenderer(docsRoot);
const errors = [];
const pages = new Map();
let codeBlocks = 0;

function inspect(text) {
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, (frontmatter) =>
    frontmatter.replace(/[^\r\n]/g, ""));
  const tokens = markdown.parse(body, {});
  const headings = tokens.filter((token) => token.type === "heading_open");
  const code = tokens
    .filter((token) => token.type === "fence" || token.type === "code_block")
    .map((token) => ({ info: token.info.trim(), content: token.content }));
  const rows = [];
  const links = [];
  const images = [];
  const addImage = (src, srcset) => {
    if (src) images.push(src);
    if (srcset) {
      for (const candidate of srcset.split(",")) images.push(candidate.trim().split(/\s+/)[0]);
    }
  };
  const anchors = new Set(headings.map((token) => token.attrGet("id")));
  for (const token of tokens) {
    if (token.type === "tr_open") rows.push(0);
    if (token.type === "th_open" || token.type === "td_open") rows[rows.length - 1]++;
    for (const child of token.children ?? []) {
      if (child.type === "image") addImage(child.attrGet("src"), child.attrGet("srcset"));
      if (child.type === "link_open" && child.attrGet("class") !== "header-anchor") {
        links.push(child.attrGet("href"));
      }
    }
    if (token.type === "html_block" || token.type === "inline") {
      const html = token.type === "html_block" ? token.content :
        (token.children ?? []).filter((child) => child.type === "html_inline").map((child) => child.content).join("");
      for (const match of html.matchAll(/\bid=["']([^"']+)["']/g)) anchors.add(match[1]);
      for (const match of html.matchAll(/\bhref=["']([^"']+)["']/g)) links.push(match[1]);
      const visibleHtml = html.replace(/<!--[\s\S]*?-->/g, "");
      for (const match of visibleHtml.matchAll(/<img\b[^>]*>/gi)) {
        const attributes = new Map();
        for (const attribute of match[0].matchAll(/\b(src|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
          attributes.set(attribute[1].toLowerCase(), attribute[2] ?? attribute[3] ?? attribute[4]);
        }
        addImage(attributes.get("src"), attributes.get("srcset"));
      }
    }
  }
  return { code, headings: headings.map((token) => token.tag), rows, links, anchors, images };
}

function localTarget(page, href) {
  const url = new URL(href, `https://docs.stencil.so/tern/${page}`);
  if (url.origin !== "https://docs.stencil.so" || !url.pathname.startsWith("/tern/")) return null;
  let path = decodeURIComponent(url.pathname.slice("/tern/".length));
  if (!path || path.endsWith("/")) path += "index.md";
  else if (path.endsWith(".html")) path = `${path.slice(0, -5)}.md`;
  else if (!path.endsWith(".md")) path += ".md";
  return { path, anchor: decodeURIComponent(url.hash.slice(1)) };
}

for (const [page, entry] of Object.entries(pageMap)) {
  const [source, target] = await Promise.all([
    readFile(join(sourceRoot, page), "utf8").catch(() => null),
    readFile(join(docsRoot, page), "utf8").catch(() => null),
  ]);
  if (source === null) errors.push(`Missing upstream snapshot: ${page}`);
  if (target === null) errors.push(`Missing Chinese page: ${page}`);
  if (source === null || target === null) continue;
  const original = inspect(source);
  const translated = inspect(target);
  pages.set(page, translated);
  codeBlocks += original.code.length;
  if (JSON.stringify(original.code) !== JSON.stringify(translated.code)) {
    errors.push(`Code blocks differ from upstream: ${page} (${original.code.length} source, ${translated.code.length} translated)`);
  }
  if (JSON.stringify(original.headings) !== JSON.stringify(translated.headings)) {
    errors.push(`Heading order/levels differ from upstream: ${page}`);
  }
  if (JSON.stringify(original.rows) !== JSON.stringify(translated.rows)) {
    errors.push(`Rendered table row/column counts differ from upstream: ${page}`);
  }
  const localAssets = new Map((entry.assets ?? []).map((asset) => {
    const assetPath = decodeURIComponent(new URL(asset).pathname.slice("/tern/".length));
    return [asset, posix.relative(posix.dirname(page), `assets/${assetPath}`)];
  }));
  const expectedImages = original.images.map((asset) =>
    localAssets.get(new URL(asset, `https://docs.stencil.so/tern/${page}`).href) ?? asset);
  if (JSON.stringify(expectedImages) !== JSON.stringify(translated.images)) {
    errors.push(`Rendered image src/srcset references differ from local upstream figures: ${page}`);
  }
  for (const [asset, local] of localAssets) {
    if (!translated.images.includes(local)) {
      errors.push(`Missing local figure reference in ${page}: ${local} (${asset})`);
    }
    const file = await stat(join(docsRoot, posix.dirname(page), local)).catch(() => null);
    if (!file?.isFile() || file.size === 0) {
      errors.push(`Missing or empty local figure in ${page}: ${local}`);
    }
  }
}

for (const [page, parsed] of pages) {
  for (const href of parsed.links) {
    const target = localTarget(page, href);
    if (!target) continue;
    if (/^https?:\/\//.test(href)) errors.push(`Internal link still points upstream in ${page}: ${href}`);
    if (!(target.path in pageMap)) {
      errors.push(`Unmapped internal link in ${page}: ${href} -> ${target.path}`);
    } else if (target.anchor && !pages.get(target.path)?.anchors.has(target.anchor)) {
      errors.push(`Missing anchor in ${page}: ${href} -> ${target.path}#${target.anchor}`);
    }
  }
}

async function checkExtraPages(dir, prefix = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await checkExtraPages(path, relative);
    else if (entry.name.endsWith(".md") && !(relative in pageMap)) {
      errors.push(`No upstream page mapping for docs/${relative}`);
    }
  }
}
await checkExtraPages(docsRoot);

console.log(`Checked ${pages.size}/${Object.keys(pageMap).length} translated pages and ${codeBlocks} code blocks.`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else {
  console.log("Page coverage, heading order, rendered tables, code blocks, links, anchors, and figure references match.");
}
