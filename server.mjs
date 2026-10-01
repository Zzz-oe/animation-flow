import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

const port = Number(process.env.API_PORT || 8787);
const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const model = process.env.REVIEW_MODEL || "gpt-5.5";
const readBody = (request) => new Promise((resolve, reject) => {
  let body = "";
  request.on("data", (chunk) => { body += chunk; if (body.length > 8_000_000) reject(new Error("请求体过大")); });
  request.on("end", () => resolve(body));
  request.on("error", reject);
});
const send = (response, status, payload) => { response.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }); response.end(JSON.stringify(payload)); };

async function review(request) {
  if (!process.env.OPENAI_API_KEY) throw new Error("服务端缺少 OPENAI_API_KEY");
  const snapshot = request.canvasSnapshot ? `\n画面快照 data URL：${request.canvasSnapshot}` : "";
  const instruction = `你是动画分镜评审员。只返回 JSON，不要 Markdown。严格使用以下 schema：{"summary":string,"overallScore":number,"dimensions":[{"name":string,"score":number,"observation":string}],"findings":[{"id":string,"severity":"high|medium|low","category":string,"title":string,"evidence":string,"targetIds":string[],"recommendation":string,"expectedEffect":string}],"provider":"live","analyzedAt":string,"sceneFingerprint":string}。基于导演意图、约束和结构化图层评审，建议必须具体、可执行并绑定 targetIds。请求：${JSON.stringify(request)}${snapshot}`;
  const response = await fetch(`${baseUrl}/responses`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model, input: instruction, text: { format: { type: "json_object" } } }) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `模型服务 HTTP ${response.status}`);
  const text = payload?.output_text || payload?.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("模型响应缺少 output_text");
  return JSON.parse(text);
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return send(response, 204, {});
  if (request.method !== "POST" || request.url !== "/api/review") return send(response, 404, { error: "API 路径不存在" });
  try { return send(response, 200, await review(JSON.parse(await readBody(request)))); }
  catch (error) { return send(response, 502, { error: error instanceof Error ? error.message : "真实评审失败" }); }
});
server.listen(port, () => console.log(`ScenePilot API proxy listening on http://127.0.0.1:${port}`));
