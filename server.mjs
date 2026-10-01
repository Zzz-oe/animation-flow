import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]])
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

const port = Number(process.env.API_PORT || 8787);
const baseUrl = (
  process.env.OPENAI_BASE_URL ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1"
).replace(/\/$/, "");
const reviewModel = process.env.REVIEW_MODEL || "qwen3.8-flash";
const requestTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 45_000);
const imageBaseUrl = (
  process.env.IMAGE_BASE_URL || "https://dashscope.aliyuncs.com/api/v1"
).replace(/\/$/, "");

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "overallScore", "dimensions", "findings"],
  properties: {
    summary: { type: "string" },
    overallScore: { type: "number", minimum: 0, maximum: 100 },
    dimensions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "score", "observation"],
        properties: {
          name: { type: "string" },
          score: { type: "number", minimum: 0, maximum: 100 },
          observation: { type: "string" },
        },
      },
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "severity",
          "category",
          "title",
          "evidence",
          "targetIds",
          "region",
          "recommendation",
          "expectedEffect",
        ],
        properties: {
          id: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          category: { type: "string" },
          title: { type: "string" },
          evidence: { type: "string" },
          targetIds: { type: "array", items: { type: "string" } },
          region: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                additionalProperties: false,
                required: ["x", "y", "width", "height"],
                properties: {
                  x: { type: "number", minimum: 0, maximum: 1 },
                  y: { type: "number", minimum: 0, maximum: 1 },
                  width: { type: "number", minimum: 0, maximum: 1 },
                  height: { type: "number", minimum: 0, maximum: 1 },
                },
              },
            ],
          },
          recommendation: { type: "string" },
          expectedEffect: { type: "string" },
        },
      },
    },
  },
};

const readBody = (request) =>
  new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8_000_000) {
        reject(new Error("请求体过大"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });

const send = (response, status, payload) => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
};

function outputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string")
        return content.text;
    }
  }
  return "";
}

async function callOpenAI(pathname, body) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!apiKey)
    throw new Error("服务端缺少 OPENAI_API_KEY 或 DASHSCOPE_API_KEY");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(
        payload?.error?.message || `模型服务 HTTP ${response.status}`,
      );
    return payload;
  } catch (error) {
    if (error?.name === "AbortError")
      throw new Error(
        `模型服务超过 ${Math.round(requestTimeoutMs / 1000)} 秒未响应`,
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function review(request) {
  if (
    !request ||
    !Array.isArray(request.layers) ||
    typeof request.intent !== "string"
  )
    throw new Error("评审请求结构无效");

  const sceneContext = {
    intent: request.intent,
    shotType: request.shotType,
    durationSeconds: request.durationSeconds,
    moods: request.moods,
    constraints: request.constraints,
    layers: request.layers,
  };
  const content = [
    {
      type: "input_text",
      text: `你是动画分镜评审员。根据当前画面与结构化场景，评价构图、视觉焦点、遮挡、空间关系、动作可读性、情绪表达、风格一致性和约束遵循。建议必须具体、可执行，并尽量绑定已有图层 id；region 使用 0–1 归一化坐标，没有可靠区域时返回 null。不要建议增加约束禁止的角色或对象。只返回一个 JSON object，必须严格包含以下结构，不得改名或省略顶层字段：${JSON.stringify(reviewSchema)}\n\n场景上下文：${JSON.stringify(sceneContext)}`,
    },
  ];
  if (
    typeof request.canvasSnapshot === "string" &&
    (request.canvasSnapshot.startsWith("data:image/") ||
      /^https?:\/\//.test(request.canvasSnapshot))
  ) {
    content.push({
      type: "input_image",
      image_url: request.canvasSnapshot,
      detail: "high",
    });
  }

  const isDashScope =
    /dashscope|maas\.aliyuncs\.com/i.test(baseUrl) ||
    /^qwen/i.test(reviewModel);
  const payload = isDashScope
    ? await callOpenAI("/chat/completions", {
        model: reviewModel,
        enable_thinking: false,
        messages: [
          {
            role: "system",
            content:
              "只返回 JSON object，不要 Markdown。字段必须符合提示中的评审结构。",
          },
          {
            role: "user",
            content: content.map((item) =>
              item.type === "input_text"
                ? { type: "text", text: item.text }
                : { type: "image_url", image_url: { url: item.image_url } },
            ),
          },
        ],
        response_format: { type: "json_object" },
      })
    : await callOpenAI("/responses", {
        model: reviewModel,
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "scene_pilot_review",
            strict: true,
            schema: reviewSchema,
          },
        },
      });
  const text = isDashScope
    ? payload?.choices?.[0]?.message?.content
    : outputText(payload);
  if (!text) throw new Error("模型响应缺少结构化评审文本");
  const result = JSON.parse(text);
  if (
    typeof result.summary !== "string" ||
    typeof result.overallScore !== "number" ||
    !Array.isArray(result.dimensions) ||
    !Array.isArray(result.findings)
  ) {
    throw new Error("模型返回 JSON，但不符合 ScenePilot 评审结构");
  }
  for (const finding of result.findings || []) {
    if (finding.region === null) delete finding.region;
  }
  return {
    ...result,
    provider: "live",
    analyzedAt: new Date().toISOString(),
    sceneFingerprint: JSON.stringify({
      intent: request.intent.trim(),
      layers: request.layers.map(
        ({ id, visible, locked, x, y, scale, rotation, z }) => ({
          id,
          visible,
          locked,
          x: +Number(x).toFixed(4),
          y: +Number(y).toFixed(4),
          scale: +Number(scale).toFixed(3),
          rotation: +Number(rotation).toFixed(1),
          z,
        }),
      ),
    }),
  };
}

function findImageUrl(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.url === "string" && /^https?:\/\//.test(value.url))
    return value.url;
  if (
    typeof value.image === "string" &&
    /^(https?:\/\/|data:image\/)/.test(value.image)
  )
    return value.image;
  for (const key of ["result_url", "image_url", "output_url"]) {
    if (
      typeof value[key] === "string" &&
      /^(https?:\/\/|data:image\/)/.test(value[key])
    )
      return value[key];
  }
  if (value.image_url && typeof value.image_url.url === "string")
    return value.image_url.url;
  if (typeof value.b64_json === "string")
    return `data:image/png;base64,${value.b64_json}`;
  for (const child of Object.values(value)) {
    const found = findImageUrl(child);
    if (found) return found;
  }
  return null;
}

async function revision(request) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!apiKey)
    throw new Error("服务端缺少 OPENAI_API_KEY 或 DASHSCOPE_API_KEY");
  if (
    !request ||
    !Array.isArray(request.layers) ||
    !Array.isArray(request.selectedFindings)
  )
    throw new Error("生成请求结构无效");
  const snapshot =
    typeof request.canvasSnapshot === "string" &&
    (request.canvasSnapshot.startsWith("data:image/") ||
      /^https?:\/\//.test(request.canvasSnapshot))
      ? request.canvasSnapshot
      : null;
  if (!snapshot)
    throw new Error("真实候选需要有效的 Canvas 图片快照；原稿未被修改");
  const prompt = `请基于输入分镜图生成一个候选修正版。导演意图：${request.intent}。选中的建议：${request.selectedFindings.map((item) => `${item.title}：${item.recommendation}`).join("；")}。补充指令：${request.additionalInstruction || "无"}。保护项：${(request.constraints || []).join("、")}。保持人物身份、镜头构图和未选区域，不添加额外角色。只输出图像。`;
  const response = await fetch(
    `${imageBaseUrl}/services/aigc/multimodal-generation/generation`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.REVISION_MODEL || "qwen-image-2.0-pro",
        input: {
          messages: [
            { role: "user", content: [{ image: snapshot }, { text: prompt }] },
          ],
        },
        parameters: {
          prompt_extend: true,
          n: 1,
          watermark: false,
          negative_prompt: "新增角色、改变人物身份、改变镜头比例",
        },
      }),
      signal: AbortSignal.timeout(Math.max(requestTimeoutMs, 90_000)),
    },
  );
  let payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      payload?.message ||
        payload?.error?.message ||
        `图像生成服务 HTTP ${response.status}`,
    );
  const taskId = payload?.output?.task_id || payload?.task_id;
  if (!findImageUrl(payload) && taskId) {
    const deadline =
      Date.now() + Math.min(Math.max(requestTimeoutMs, 90_000), 180_000);
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const poll = await fetch(
        `${imageBaseUrl}/tasks/${encodeURIComponent(taskId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      const next = await poll.json().catch(() => null);
      if (!poll.ok)
        throw new Error(next?.message || `图像任务查询 HTTP ${poll.status}`);
      payload = next;
      const status = next?.output?.task_status || next?.task_status;
      if (findImageUrl(next) || status === "FAILED" || status === "CANCELED")
        break;
    }
  }
  const imageUrl = findImageUrl(payload);
  if (!imageUrl)
    throw new Error("图像生成响应中没有可显示的图片；原稿未被修改");
  return {
    id: `candidate-live-${Date.now()}`,
    provider: "live",
    createdAt: new Date().toISOString(),
    baseLayers: request.layers,
    layers: request.layers,
    findingIds: request.selectedFindings.map((item) => item.id),
    changes: request.selectedFindings.map((item) => ({
      layerId: item.targetIds?.[0] || "scene",
      layerName: item.category,
      summary: item.recommendation,
    })),
    promptSummary: prompt,
    candidateImageUrl: imageUrl,
  };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/api/health") {
    return send(response, 200, {
      status: "ok",
      review: {
        configured: Boolean(
          process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY,
        ),
        model: reviewModel,
        multimodal: true,
        structuredOutput: true,
      },
      revision: {
        configured: Boolean(
          process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY,
        ),
        model: process.env.REVISION_MODEL || "qwen-image-2.0-pro",
      },
    });
  }
  if (
    request.method !== "POST" ||
    !["/api/review", "/api/revision"].includes(request.url)
  )
    return send(response, 404, { error: "API 路径不存在" });
  try {
    const body = JSON.parse(await readBody(request));
    return send(
      response,
      200,
      request.url === "/api/revision"
        ? await revision(body)
        : await review(body),
    );
  } catch (error) {
    return send(response, 502, {
      error: error instanceof Error ? error.message : "真实 AI 请求失败",
    });
  }
});

server.listen(port, "127.0.0.1", () =>
  console.log(`ScenePilot API proxy listening on http://127.0.0.1:${port}`),
);
