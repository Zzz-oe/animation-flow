#!/usr/bin/env node
// 统计本机 WorkBuddy 会话记录中的真实 token 用量。
// 数据源：~/.workbuddy/projects/<workspace-slug>/<sessionId>.jsonl
// 该文件由 WorkBuddy 运行时写入，每个 assistant 回合的 usage 字段即 API 返回的真实用量。
//
// 用法：
//   node scripts/token-usage.mjs                    # 自动定位当前工作区最新会话
//   node scripts/token-usage.mjs --all              # 汇总当前工作区全部会话
//   node scripts/token-usage.mjs <session.jsonl>    # 指定某个会话文件
//   node scripts/token-usage.mjs --dir <workspace>  # 指定工作区目录
//   node scripts/token-usage.mjs --out <file.md>    # 直接写成 UTF-8 文件（Windows 终端下推荐）
//
// 输出为 Markdown，便于直接粘贴到 docs/ 的记录里。
//
// 口径（依据 usage 字段实测）：
//   total_tokens = input_tokens + output_tokens
//   cache_read_input_tokens 是 input_tokens 的子集（缓存命中部分），不重复累加。

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PROJECTS_ROOT = path.join(os.homedir(), ".workbuddy", "projects");

function toSlug(dir) {
  return path
    .resolve(dir)
    .replace(/^([A-Za-z]):/, (_, drive) => drive.toLowerCase())
    .replace(/[\\/]+/g, "-")
    .replace(/^-+/, "")
    .toLowerCase();
}

function listSessionFiles(workspaceDir) {
  const folder = path.join(PROJECTS_ROOT, toSlug(workspaceDir));
  if (!fs.existsSync(folder)) return { folder, files: [] };
  const files = fs
    .readdirSync(folder)
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => {
      const full = path.join(folder, name);
      return { path: full, mtimeMs: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return { folder, files };
}

function findUsage(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 8) return null;
  if (
    typeof node.input_tokens === "number" ||
    typeof node.output_tokens === "number" ||
    typeof node.cache_read_input_tokens === "number"
  ) {
    return node;
  }
  for (const key of ["usage", "message", "response", "providerData", "data"]) {
    const hit = findUsage(node[key], depth + 1);
    if (hit) return hit;
  }
  return null;
}

function findModel(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 8) return null;
  if (typeof node.model === "string" && node.model) return node.model;
  for (const key of ["message", "response", "providerData", "data"]) {
    const hit = findModel(node[key], depth + 1);
    if (hit) return hit;
  }
  return null;
}

function collectEvents(file) {
  const raw = fs.readFileSync(file, "utf8");
  const events = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const usage = findUsage(obj);
    if (!usage) continue;
    const id = obj.id ?? obj.messageId ?? obj.requestId ?? null;
    const messageId = obj.messageId ?? null;
    events.push({
      key: id ?? messageId ?? `${events.length}`,
      timestamp: typeof obj.timestamp === "number" ? obj.timestamp : null,
      model: findModel(obj) ?? "unknown",
      input: Number(usage.input_tokens ?? 0),
      output: Number(usage.output_tokens ?? 0),
      cacheRead: Number(usage.cache_read_input_tokens ?? 0),
      cacheWrite: Number(usage.cache_creation_input_tokens ?? 0),
      total: Number(usage.total_tokens ?? 0),
    });
  }
  return events;
}

function dedupe(events) {
  const seen = new Map();
  for (const event of events) {
    const prev = seen.get(event.key);
    if (!prev || event.input + event.output > prev.input + prev.output) {
      seen.set(event.key, event);
    }
  }
  return [...seen.values()];
}

function summarize(events) {
  const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reported: 0, calls: events.length };
  const byModel = new Map();
  let first = null;
  let last = null;
  for (const event of events) {
    totals.input += event.input;
    totals.output += event.output;
    totals.cacheRead += event.cacheRead;
    totals.cacheWrite += event.cacheWrite;
    totals.reported += event.total;
    const bucket = byModel.get(event.model) ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reported: 0, calls: 0 };
    bucket.input += event.input;
    bucket.output += event.output;
    bucket.cacheRead += event.cacheRead;
    bucket.cacheWrite += event.cacheWrite;
    bucket.reported += event.total;
    bucket.calls += 1;
    byModel.set(event.model, bucket);
    if (event.timestamp !== null) {
      if (first === null || event.timestamp < first) first = event.timestamp;
      if (last === null || event.timestamp > last) last = event.timestamp;
    }
  }
  return { totals, byModel, first, last };
}

function formatTimestamp(ms) {
  if (ms === null) return "未知";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function render(file, events) {
  const { totals, byModel, first, last } = summarize(events);
  const lines = [];
  const uncached = totals.input - totals.cacheRead;
  const grand = totals.reported || totals.input + totals.output;
  const cacheRate = totals.input > 0 ? ((totals.cacheRead / totals.input) * 100).toFixed(1) : "0.0";
  lines.push(`### Token 用量（数据源：WorkBuddy 会话记录）`);
  lines.push("");
  lines.push(`- 会话文件：\`${file}\``);
  lines.push(`- 取数时刻：${formatTimestamp(Date.now())}`);
  lines.push(`- 会话时间范围：${formatTimestamp(first)} → ${formatTimestamp(last)}`);
  lines.push(`- 有效 API 回合数：${totals.calls}`);
  lines.push(`- 口径：\`total_tokens = input_tokens + output_tokens\`；\`cache_read_input_tokens\` 是 input_tokens 的子集，不重复累加。`);
  lines.push("");
  lines.push("| 计费项 | Token 数 | 说明 |");
  lines.push("| --- | ---: | --- |");
  lines.push(`| 未缓存输入 | ${uncached} | input_tokens − cache_read，按原价计费 |`);
  lines.push(`| 缓存命中输入 | ${totals.cacheRead} | 占全部输入的 ${cacheRate}% |`);
  lines.push(`| 输入合计 | ${totals.input} | 每次请求都要重发的上下文 |`);
  lines.push(`| 输出 | ${totals.output} | 模型生成 |`);
  lines.push(`| **总计** | **${grand}** | 输入合计 + 输出 |`);
  if (totals.cacheWrite > 0) {
    lines.push("");
    lines.push(`缓存写入 cache_creation_input_tokens：${totals.cacheWrite}`);
  }
  lines.push("");
  lines.push("按模型拆分：");
  lines.push("");
  lines.push("| 模型 | 回合 | 输入 | 输出 | 总计 |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const [model, v] of byModel) {
    lines.push(`| ${model} | ${v.calls} | ${v.input} | ${v.output} | ${v.reported || v.input + v.output} |`);
  }
  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const explicitFile = args.find((a) => a.endsWith(".jsonl"));
  const dirIndex = args.indexOf("--dir");
  const workspace = dirIndex >= 0 ? args[dirIndex + 1] : process.cwd();
  const all = args.includes("--all");
  const outIndex = args.indexOf("--out");
  const outFile = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : null;
  const emit = (text) => {
    if (outFile) fs.writeFileSync(outFile, text, "utf8");
    else process.stdout.write(text);
  };

  if (explicitFile) {
    const abs = path.resolve(explicitFile);
    emit(render(abs, dedupe(collectEvents(abs))));
    return;
  }

  const { folder, files } = listSessionFiles(workspace);
  if (!files.length) {
    console.error(`未找到会话记录：${folder}`);
    process.exitCode = 1;
    return;
  }

  const targets = all ? files : [files[0]];
  const chunks = [];
  for (const target of targets) {
    chunks.push(render(target.path, dedupe(collectEvents(target.path))));
  }
  emit(chunks.join("\n\n"));
}

main();
