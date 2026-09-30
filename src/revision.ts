import type { ReviewFinding } from "./review";
import { cloneLayers, type SceneLayer } from "./scene";

export type RevisionChange = {
  layerId: string;
  layerName: string;
  property: "位置" | "缩放" | "旋转" | "可见性";
  before: string;
  after: string;
  reason: string;
};

export type CandidateRevision = {
  id: string;
  provider: "mock" | "live";
  generatedAt: string;
  sourceFingerprint: string;
  selectedFindingIds: string[];
  instruction: string;
  promptSummary: string;
  layers: SceneLayer[];
  changes: RevisionChange[];
};

export type RevisionRequest = {
  intent: string;
  sourceFingerprint: string;
  layers: SceneLayer[];
  findings: ReviewFinding[];
  instruction: string;
};

export interface RevisionProvider {
  generateRevision(request: RevisionRequest, signal?: AbortSignal): Promise<CandidateRevision>;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const delay = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(resolve, milliseconds);
  signal?.addEventListener("abort", () => {
    window.clearTimeout(timer);
    reject(new DOMException("候选生成已取消", "AbortError"));
  }, { once: true });
});

function patchLayer(layers: SceneLayer[], id: string, patch: Partial<SceneLayer>) {
  return layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer);
}

function applyFinding(layers: SceneLayer[], finding: ReviewFinding) {
  const hero = layers.find((layer) => layer.id === "hero");
  const light = layers.find((layer) => layer.id === "light");
  const train = layers.find((layer) => layer.id === "train");
  switch (finding.id) {
    case "missing-subject": return patchLayer(layers, "hero", { visible: true, x: .355, y: .635, scale: 1, rotation: 0 });
    case "subject-center": return hero ? patchLayer(layers, hero.id, { x: clamp(hero.x - .1, .3, .42) }) : layers;
    case "subject-edge": return hero ? patchLayer(layers, hero.id, { x: clamp(hero.x + .07, .3, .4) }) : layers;
    case "subject-scale": return hero ? patchLayer(layers, hero.id, { scale: 1.05 }) : layers;
    case "subject-tilt": return hero ? patchLayer(layers, hero.id, { rotation: 0 }) : layers;
    case "missing-rain": return patchLayer(layers, "rain", { visible: true });
    case "missing-train": return patchLayer(layers, "train", { visible: true, x: .695, y: .5, scale: 1 });
    case "light-overlap": return light && hero ? patchLayer(layers, light.id, { x: clamp(hero.x - .16, .12, .28), y: clamp(light.y - .04, .16, .42) }) : layers;
    case "polish-contrast": return train ? patchLayer(layers, train.id, { x: clamp(train.x + .025, .62, .82), scale: clamp(train.scale * .96, .82, 1.1) }) : layers;
    default: return layers;
  }
}

function formatValue(property: RevisionChange["property"], layer: SceneLayer) {
  if (property === "位置") return `X ${Math.round(layer.x * 100)}% · Y ${Math.round(layer.y * 100)}%`;
  if (property === "缩放") return `${Math.round(layer.scale * 100)}%`;
  if (property === "旋转") return `${Math.round(layer.rotation)}°`;
  return layer.visible ? "显示" : "隐藏";
}

function describeChanges(before: SceneLayer[], after: SceneLayer[], findings: ReviewFinding[]) {
  const reasonByTarget = new Map<string, string>();
  findings.forEach((finding) => finding.targetIds?.forEach((id) => reasonByTarget.set(id, finding.title)));
  const changes: RevisionChange[] = [];
  after.forEach((next) => {
    const previous = before.find((layer) => layer.id === next.id);
    if (!previous) return;
    const reason = reasonByTarget.get(next.id) ?? "根据所选建议调整";
    if (previous.x !== next.x || previous.y !== next.y) changes.push({ layerId: next.id, layerName: next.name, property: "位置", before: formatValue("位置", previous), after: formatValue("位置", next), reason });
    if (previous.scale !== next.scale) changes.push({ layerId: next.id, layerName: next.name, property: "缩放", before: formatValue("缩放", previous), after: formatValue("缩放", next), reason });
    if (previous.rotation !== next.rotation) changes.push({ layerId: next.id, layerName: next.name, property: "旋转", before: formatValue("旋转", previous), after: formatValue("旋转", next), reason });
    if (previous.visible !== next.visible) changes.push({ layerId: next.id, layerName: next.name, property: "可见性", before: formatValue("可见性", previous), after: formatValue("可见性", next), reason });
  });
  return changes;
}

export const mockRevisionProvider: RevisionProvider = {
  async generateRevision(request, signal) {
    await delay(1050, signal);
    if (request.instruction.includes("[模拟生成错误]")) throw new Error("Mock provider 按测试指令返回生成失败");
    const layers = request.findings.reduce((current, finding) => applyFinding(current, finding), cloneLayers(request.layers));
    return {
      id: `candidate-${Date.now()}`,
      provider: "mock",
      generatedAt: new Date().toISOString(),
      sourceFingerprint: request.sourceFingerprint,
      selectedFindingIds: request.findings.map((finding) => finding.id),
      instruction: request.instruction,
      promptSummary: `保持人物身份、雨夜色调和未选中图层不变；仅处理 ${request.findings.map((finding) => finding.title).join("、")}。${request.instruction.trim() || "不增加新角色。"}`,
      layers,
      changes: describeChanges(request.layers, layers, request.findings),
    };
  },
};

export type RevisionHistoryEntry = {
  id: string;
  action: "accepted" | "rejected" | "restored";
  label: string;
  createdAt: string;
  beforeLayers?: SceneLayer[];
  afterLayers?: SceneLayer[];
};
