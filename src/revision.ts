import type { ReviewFinding } from "./review";
import { cloneLayers, type SceneLayer } from "./scene";

export type RevisionChange = { layerId: string; layerName: string; summary: string };
export type RevisionRequest = {
  intent: string;
  constraints: string[];
  additionalInstruction: string;
  selectedFindings: ReviewFinding[];
  layers: SceneLayer[];
};
export type CandidateRevision = {
  id: string;
  provider: "mock" | "live";
  createdAt: string;
  baseLayers: SceneLayer[];
  layers: SceneLayer[];
  findingIds: string[];
  changes: RevisionChange[];
  promptSummary: string;
};

export interface RevisionProvider {
  generateRevision(request: RevisionRequest, signal?: AbortSignal): Promise<CandidateRevision>;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const delay = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(resolve, milliseconds);
  signal?.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("生成已取消", "AbortError")); }, { once: true });
});

function applyFinding(layers: SceneLayer[], finding: ReviewFinding, changes: RevisionChange[]) {
  const update = (id: string, patch: Partial<SceneLayer>, summary: string) => {
    const index = layers.findIndex((layer) => layer.id === id);
    if (index < 0) return;
    const previous = layers[index];
    layers[index] = { ...previous, ...patch };
    changes.push({ layerId: id, layerName: previous.name, summary });
  };

  if (finding.id === "missing-subject") update("hero", { visible: true, x: .36, y: .64, scale: 1, rotation: 0 }, "恢复人物并放回左侧三分线附近");
  if (finding.id === "subject-center") {
    const hero = layers.find((layer) => layer.id === "hero");
    if (hero) update("hero", { x: clamp(hero.x - .1, .29, .4) }, "人物向左移动，恢复人物—站台—列车的阅读顺序");
  }
  if (finding.id === "subject-edge") {
    const hero = layers.find((layer) => layer.id === "hero");
    if (hero) update("hero", { x: clamp(hero.x + .07, .3, .4) }, "人物向安全框内移动，保留轮廓呼吸空间");
  }
  if (finding.id === "subject-scale") update("hero", { scale: 1.05 }, "角色缩放收敛至 105%，恢复中景空间关系");
  if (finding.id === "subject-tilt") update("hero", { rotation: 0 }, "角色站姿恢复水平，强化安静等待感");
  if (finding.id === "missing-rain") update("rain", { visible: true }, "恢复低对比雨幕与湿地反光");
  if (finding.id === "missing-train") update("train", { visible: true }, "恢复末班列车作为第二视觉焦点");
  if (finding.id === "light-overlap") {
    const light = layers.find((layer) => layer.id === "light");
    if (light) update("light", { x: clamp(light.x - .1, .12, .3), y: clamp(light.y - .04, .12, .42) }, "灯箱远离人物轮廓，减少暖色区域竞争");
  }
  if (finding.id === "polish-contrast") update("train", { tint: "#adb7b1" }, "降低列车高亮对比，稳定人物到列车的视线移动");
}

export const mockRevisionProvider: RevisionProvider = {
  async generateRevision(request, signal) {
    await delay(1050, signal);
    if (request.additionalInstruction.includes("[模拟错误]")) throw new Error("Mock provider 按测试指令返回生成失败；原稿未被修改");
    if (!request.selectedFindings.length) throw new Error("请至少选择一条建议后再生成候选");
    const next = cloneLayers(request.layers);
    const changes: RevisionChange[] = [];
    request.selectedFindings.forEach((finding) => applyFinding(next, finding, changes));
    return {
      id: `candidate-${Date.now()}`,
      provider: "mock",
      createdAt: new Date().toISOString(),
      baseLayers: cloneLayers(request.layers),
      layers: next,
      findingIds: request.selectedFindings.map((finding) => finding.id),
      changes,
      promptSummary: `保持${request.constraints.join("、")}；执行 ${request.selectedFindings.map((finding) => finding.title).join("、")}${request.additionalInstruction.trim() ? `；补充：${request.additionalInstruction.trim()}` : ""}`,
    };
  },
};
