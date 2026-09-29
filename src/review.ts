import type { SceneLayer } from "./scene";

export type Severity = "high" | "medium" | "low";
export type ReviewRegion = { x: number; y: number; width: number; height: number };
export type ReviewDimension = { name: string; score: number; observation: string };
export type ReviewFinding = {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  evidence: string;
  targetIds?: string[];
  region?: ReviewRegion;
  recommendation: string;
  expectedEffect: string;
};
export type ReviewResult = {
  summary: string;
  overallScore: number;
  dimensions: ReviewDimension[];
  findings: ReviewFinding[];
  provider: "mock" | "live";
  analyzedAt: string;
  sceneFingerprint: string;
};
export type ReviewRequest = {
  intent: string;
  shotType: string;
  durationSeconds: number;
  moods: string[];
  constraints: string[];
  layers: SceneLayer[];
  canvasSnapshot?: string;
};

export interface ReviewProvider {
  review(request: ReviewRequest, signal?: AbortSignal): Promise<ReviewResult>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isStringArray = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === "string");
const isRegion = (value: unknown): value is ReviewRegion => isRecord(value) && ["x", "y", "width", "height"].every((key) => isNumber(value[key]));

export function parseReviewResult(value: unknown): ReviewResult {
  if (!isRecord(value)) throw new Error("评审响应不是对象");
  if (typeof value.summary !== "string" || !value.summary.trim()) throw new Error("评审缺少 summary");
  if (!isNumber(value.overallScore) || value.overallScore < 0 || value.overallScore > 100) throw new Error("overallScore 必须在 0–100");
  if (!Array.isArray(value.dimensions) || !value.dimensions.every((item) => isRecord(item) && typeof item.name === "string" && isNumber(item.score) && item.score >= 0 && item.score <= 100 && typeof item.observation === "string")) throw new Error("dimensions 结构无效");
  if (!Array.isArray(value.findings) || !value.findings.every((item) => {
    if (!isRecord(item)) return false;
    return typeof item.id === "string" && ["high", "medium", "low"].includes(String(item.severity)) && typeof item.category === "string" && typeof item.title === "string" && typeof item.evidence === "string" && (item.targetIds === undefined || isStringArray(item.targetIds)) && (item.region === undefined || isRegion(item.region)) && typeof item.recommendation === "string" && typeof item.expectedEffect === "string";
  })) throw new Error("findings 结构无效");
  if (!(["mock", "live"] as const).includes(value.provider as "mock" | "live")) throw new Error("provider 无效");
  if (typeof value.analyzedAt !== "string" || typeof value.sceneFingerprint !== "string") throw new Error("评审元数据缺失");
  return value as unknown as ReviewResult;
}

export function sceneFingerprint(layers: SceneLayer[], intent: string) {
  return JSON.stringify({ intent: intent.trim(), layers: layers.map(({ id, visible, locked, x, y, scale, rotation, z }) => ({ id, visible, locked, x: +x.toFixed(4), y: +y.toFixed(4), scale: +scale.toFixed(3), rotation: +rotation.toFixed(1), z })) });
}

const delay = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(resolve, milliseconds);
  signal?.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("评审已取消", "AbortError")); }, { once: true });
});

function finding(input: ReviewFinding) { return input; }

function createMockReview(request: ReviewRequest): ReviewResult {
  const visible = request.layers.filter((layer) => layer.visible);
  const hero = visible.find((layer) => layer.kind === "CHARACTER");
  const train = visible.find((layer) => layer.id === "train");
  const light = visible.find((layer) => layer.id === "light");
  const rain = visible.find((layer) => layer.id === "rain");
  const findings: ReviewFinding[] = [];

  if (!hero) {
    findings.push(finding({ id: "missing-subject", severity: "high", category: "叙事主体", title: "镜头缺少可辨认的主要角色", evidence: "导演意图以“她在等车”为叙事中心，但当前可见图层中没有角色。", targetIds: ["hero"], region: { x: .2, y: .34, width: .32, height: .45 }, recommendation: "恢复角色图层，并放在画面左侧三分线附近，保留面向列车的视线方向。", expectedEffect: "让观众先建立人物处境，再阅读站台和列车关系。" }));
  } else {
    if (hero.x > .46) findings.push(finding({ id: "subject-center", severity: "medium", category: "构图", title: "人物过于接近画面中心", evidence: `角色中心位于画面 ${(hero.x * 100).toFixed(0)}% 处，接近列车的视觉重量，弱化了左侧留白带来的孤独感。`, targetIds: [hero.id, "train"], region: { x: clamp01(hero.x - .12), y: clamp01(hero.y - .2), width: .24, height: .4 }, recommendation: "将人物向左移动约画面宽度的 8%–12%，同时保持列车不动。", expectedEffect: "恢复“人物—空旷站台—即将到来的列车”的阅读顺序。" }));
    if (hero.x < .27) findings.push(finding({ id: "subject-edge", severity: "medium", category: "安全框", title: "人物太靠近左侧边缘", evidence: `角色中心仅位于画面 ${(hero.x * 100).toFixed(0)}% 处，外套轮廓接近安全框。`, targetIds: [hero.id], region: { x: 0, y: clamp01(hero.y - .2), width: .28, height: .4 }, recommendation: "向右移动人物 5%–8%，确保动作轮廓与安全框之间有呼吸空间。", expectedEffect: "降低画面被截断的压迫感，同时保留孤独感。" }));
    if (hero.scale > 1.35) findings.push(finding({ id: "subject-scale", severity: "high", category: "镜头尺度", title: "角色尺度破坏了中景关系", evidence: `角色缩放为 ${(hero.scale * 100).toFixed(0)}%，已开始遮挡列车与站台的空间信息。`, targetIds: [hero.id], region: { x: clamp01(hero.x - .17), y: clamp01(hero.y - .3), width: .34, height: .58 }, recommendation: "将角色缩放控制在 90%–115%，保持中景可读性。", expectedEffect: "观众能同时读取人物情绪和环境叙事。" }));
    if (Math.abs(hero.rotation) > 8) findings.push(finding({ id: "subject-tilt", severity: "low", category: "动作可读性", title: "角色倾斜与克制情绪不一致", evidence: `角色旋转 ${hero.rotation.toFixed(0)}°，轮廓产生明显动态倾向。`, targetIds: [hero.id], recommendation: "将旋转收敛到 ±5° 以内，除非需要表达失衡或奔跑。", expectedEffect: "让站姿更安静，情绪更符合“等待”和“克制”。" }));
  }

  if (!rain) findings.push(finding({ id: "missing-rain", severity: "medium", category: "气氛", title: "雨夜线索不足", evidence: "雨幕图层当前不可见，但导演意图明确要求雨夜与安静氛围。", targetIds: ["rain"], recommendation: "恢复雨幕与湿地反光；雨线透明度应低于角色轮廓。", expectedEffect: "加强时间和天气信息，同时不抢夺人物焦点。" }));
  if (!train) findings.push(finding({ id: "missing-train", severity: "high", category: "叙事信息", title: "“最后一班车”的视觉信息缺失", evidence: "当前列车图层不可见，观众无法理解角色等待对象。", targetIds: ["train"], region: { x: .48, y: .28, width: .46, height: .45 }, recommendation: "恢复列车图层并保留远近透视，让它作为第二视觉焦点。", expectedEffect: "让镜头的时间压力和叙事目标变得明确。" }));
  if (light && hero && Math.abs(light.x - hero.x) < .09) findings.push(finding({ id: "light-overlap", severity: "low", category: "视觉焦点", title: "灯箱高光与人物轮廓竞争", evidence: "暖色灯箱与人物的水平距离过近，两个暖色区域容易合并为同一形状。", targetIds: [light.id, hero.id], recommendation: "将灯箱向左或向上移动，或降低其亮度，让人物外套成为主要暖色焦点。", expectedEffect: "人物轮廓更清晰，暖色引导更有层次。" }));

  if (findings.length === 0) findings.push(finding({ id: "polish-contrast", severity: "low", category: "精修", title: "可以进一步压低列车窗户对比", evidence: "当前构图与导演意图基本一致；列车窗户是剩余较强的高亮区域。", targetIds: ["train"], recommendation: "轻微压低窗户亮度或减少其中两个高亮窗格。", expectedEffect: "视线更稳定地从人物移动到列车，而不是先被窗户吸引。" }));

  const high = findings.filter((item) => item.severity === "high").length;
  const medium = findings.filter((item) => item.severity === "medium").length;
  const score = Math.max(45, 88 - high * 15 - medium * 7 - Math.max(0, findings.length - high - medium - 1) * 2);
  const subjectScore = hero ? clampScore(92 - (hero.x > .46 || hero.x < .27 ? 13 : 0) - (hero.scale > 1.35 ? 20 : 0)) : 35;
  const compositionScore = clampScore(90 - medium * 8 - high * 7);
  const moodScore = clampScore(92 - (!rain ? 18 : 0) - (light && hero && Math.abs(light.x - hero.x) < .09 ? 7 : 0));
  const constraintsOk = request.constraints.every((constraint) => !/不添加额外角色/.test(constraint) || visible.filter((layer) => layer.kind === "CHARACTER").length <= 1);

  return {
    summary: high ? `发现 ${high} 个需要优先处理的问题。当前镜头的叙事基础仍然清楚，但应先修复主体或关键信息，再进入图像生成。` : medium ? `镜头意图基本成立，建议先处理 ${medium} 个构图/气氛问题，再生成候选修正版。` : "镜头已经较好地表达了安静等待的情绪，可以进行低风险精修。",
    overallScore: score,
    dimensions: [
      { name: "叙事主体", score: subjectScore, observation: hero ? "角色可辨认；主要检查其位置、尺度与导演意图是否一致。" : "缺少与导演意图对应的主要角色。" },
      { name: "构图层级", score: compositionScore, observation: train ? "人物、站台和列车形成两级视觉关系。" : "第二视觉焦点缺失，空间叙事不完整。" },
      { name: "情绪氛围", score: moodScore, observation: rain ? "冷色雨夜与暖色人物形成克制对比。" : "缺少雨夜气氛层，情绪表达减弱。" },
      { name: "约束遵循", score: constraintsOk ? 96 : 58, observation: constraintsOk ? "当前场景未增加额外角色，保持了设定约束。" : "场景对象与不可改变约束存在冲突。" },
    ],
    findings,
    provider: "mock",
    analyzedAt: new Date().toISOString(),
    sceneFingerprint: sceneFingerprint(request.layers, request.intent),
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const clampScore = (value: number) => Math.round(Math.min(100, Math.max(0, value)));

export const mockReviewProvider: ReviewProvider = {
  async review(request, signal) {
    await delay(900, signal);
    if (request.intent.includes("[模拟错误]")) throw new Error("Mock provider 按测试指令返回失败");
    return parseReviewResult(createMockReview(request));
  },
};
