import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([
  ".git",
  "dist",
  "github-vscode-theme-main",
  "node_modules",
]);
const errors = [];

function collectMarkdown(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...collectMarkdown(path));
    else if (entry.isFile() && extname(entry.name) === ".md") result.push(path);
  }
  return result;
}

function repositoryPath(path) {
  return relative(root, path).split(sep).join("/");
}

function contentOutsideFences(content) {
  let fenced = false;
  return content
    .split("\n")
    .filter((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        return false;
      }
      return !fenced;
    })
    .join("\n");
}

const markdownFiles = collectMarkdown(root);

for (const file of markdownFiles) {
  const path = repositoryPath(file);
  const content = readFileSync(file, "utf8");
  const visibleContent = contentOutsideFences(content);

  if (!content.endsWith("\n")) errors.push(`${path}: 文件末尾缺少换行`);
  if (content.split("\n").some((line) => /[ \t]+$/.test(line))) {
    errors.push(`${path}: 存在行尾空白`);
  }

  const firstLine = content.split("\n")[0];
  const h1Count = visibleContent.split("\n").filter((line) => /^# /.test(line)).length;
  if (!/^# \S/.test(firstLine)) errors.push(`${path}: 第一行必须是一级标题`);
  if (h1Count !== 1) errors.push(`${path}: 必须且只能包含一个一级标题，实际 ${h1Count}`);

  if (path.startsWith("docs/")) {
    for (const segment of path.slice("docs/".length).split("/")) {
      if (segment === "README.md") continue;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.md)?$/.test(segment)) {
        errors.push(`${path}: 路径片段“${segment}”不是小写 kebab-case`);
      }
    }
  }

  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of visibleContent.matchAll(linkPattern)) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    target = target.split("#", 1)[0].split("?", 1)[0];
    if (!target) continue;
    let decodedTarget;
    try {
      decodedTarget = decodeURIComponent(target);
    } catch {
      errors.push(`${path}: 链接无法解码：${target}`);
      continue;
    }
    const resolvedTarget = resolve(dirname(file), decodedTarget);
    if (!resolvedTarget.startsWith(`${root}${sep}`) && resolvedTarget !== root) {
      errors.push(`${path}: 链接越出仓库：${target}`);
    } else if (!existsSync(resolvedTarget)) {
      errors.push(`${path}: 链接目标不存在：${target}`);
    } else if (statSync(resolvedTarget).isDirectory()) {
      errors.push(`${path}: 链接必须指向具体文件：${target}`);
    }
  }
}

for (const requiredPath of [
  "docs/README.md",
  "docs/contributing/documentation.md",
  "docs/project/status.md",
  "docs/project/roadmap.md",
  "docs/project/cycles/README.md",
  "docs/quality/README.md",
  "docs/quality/issues.md",
]) {
  if (!existsSync(resolve(root, requiredPath))) errors.push(`${requiredPath}: 必需入口不存在`);
}

for (const forbiddenPath of ["TODO.md", "docs/development"]) {
  if (existsSync(resolve(root, forbiddenPath))) errors.push(`${forbiddenPath}: 旧入口应已迁移`);
}

if (errors.length > 0) {
  console.error(`Documentation check failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation check passed (${markdownFiles.length} Markdown files).`);
}
