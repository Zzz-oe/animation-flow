export type LayerKind = "ATMOSPHERE" | "BACKGROUND" | "PROP" | "CHARACTER" | "LIGHT";

export type SceneLayer = {
  id: string;
  name: string;
  kind: LayerKind;
  tint: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z: number;
};

export const DEFAULT_LAYERS: SceneLayer[] = [
  { id: "station", name: "站台结构", kind: "BACKGROUND", tint: "#d6b789", visible: true, locked: true, x: 0.5, y: 0.44, scale: 1, rotation: 0, z: 0 },
  { id: "train", name: "末班列车", kind: "PROP", tint: "#d9e1dc", visible: true, locked: false, x: 0.695, y: 0.5, scale: 1, rotation: 0, z: 1 },
  { id: "light", name: "暖色灯箱", kind: "LIGHT", tint: "#edc57b", visible: true, locked: false, x: 0.193, y: 0.295, scale: 1, rotation: 0, z: 2 },
  { id: "hero", name: "林 · 等待中", kind: "CHARACTER", tint: "#db7658", visible: true, locked: false, x: 0.355, y: 0.635, scale: 1, rotation: 0, z: 3 },
  { id: "rain", name: "雨幕与玻璃反光", kind: "ATMOSPHERE", tint: "#6d9da3", visible: true, locked: true, x: 0.5, y: 0.42, scale: 1, rotation: 0, z: 4 },
];

type Size = { width: number; height: number };
type Point = { x: number; y: number };

const OBJECT_SIZES: Record<LayerKind, Size> = {
  BACKGROUND: { width: 1, height: 0.72 },
  PROP: { width: 0.44, height: 0.38 },
  LIGHT: { width: 0.055, height: 0.25 },
  CHARACTER: { width: 0.1, height: 0.24 },
  ATMOSPHERE: { width: 1, height: 0.86 },
};

export const cloneLayers = (layers: SceneLayer[]) => layers.map((layer) => ({ ...layer }));

export function getObjectSize(layer: SceneLayer, width: number, height: number) {
  if (layer.id.startsWith("prop-")) return { width: width * 0.08, height: height * 0.1 };
  const size = OBJECT_SIZES[layer.kind];
  return { width: size.width * width, height: size.height * height };
}

export function toObjectSpace(layer: SceneLayer, point: Point, width: number, height: number) {
  const centerX = layer.x * width;
  const centerY = layer.y * height;
  const radians = (-layer.rotation * Math.PI) / 180;
  const dx = point.x - centerX;
  const dy = point.y - centerY;
  return {
    x: (dx * Math.cos(radians) - dy * Math.sin(radians)) / layer.scale,
    y: (dx * Math.sin(radians) + dy * Math.cos(radians)) / layer.scale,
  };
}

export function hitTestLayer(layers: SceneLayer[], point: Point, width: number, height: number) {
  return [...layers]
    .filter((layer) => layer.visible && !layer.locked)
    .sort((a, b) => b.z - a.z)
    .find((layer) => {
      const local = toObjectSpace(layer, point, width, height);
      const size = getObjectSize(layer, width, height);
      return Math.abs(local.x) <= size.width / 2 && Math.abs(local.y) <= size.height / 2;
    });
}

export function getResizeHandle(layer: SceneLayer, width: number, height: number) {
  const size = getObjectSize(layer, width, height);
  const localX = (size.width / 2) * layer.scale;
  const localY = (size.height / 2) * layer.scale;
  const radians = (layer.rotation * Math.PI) / 180;
  return {
    x: layer.x * width + localX * Math.cos(radians) - localY * Math.sin(radians),
    y: layer.y * height + localX * Math.sin(radians) + localY * Math.cos(radians),
  };
}

function withLayerTransform(context: CanvasRenderingContext2D, layer: SceneLayer, width: number, height: number, draw: (size: Size) => void) {
  const size = getObjectSize(layer, width, height);
  context.save();
  context.translate(layer.x * width, layer.y * height);
  context.rotate((layer.rotation * Math.PI) / 180);
  context.scale(layer.scale, layer.scale);
  draw(size);
  context.restore();
}

function drawStation(context: CanvasRenderingContext2D, size: Size) {
  const x = -size.width / 2;
  const y = -size.height / 2;
  context.fillStyle = "#35464a";
  context.fillRect(x, y + size.height * 0.06, size.width, size.height * 0.075);
  context.fillStyle = "#c59b70";
  context.fillRect(x + size.width * 0.09, y + size.height * 0.13, size.width * 0.018, size.height * 0.7);
  context.fillRect(x + size.width * 0.91, y + size.height * 0.13, size.width * 0.018, size.height * 0.7);
  context.fillStyle = "#718286";
  context.fillRect(x + size.width * 0.13, y + size.height * 0.24, size.width * 0.18, size.height * 0.43);
  context.fillRect(x + size.width * 0.68, y + size.height * 0.2, size.width * 0.21, size.height * 0.5);
  context.fillStyle = "#b4b7a4";
  for (let i = 0; i < 5; i++) context.fillRect(x + size.width * (0.15 + i * 0.035), y + size.height * 0.28, size.width * 0.018, size.height * 0.34);
  context.fillStyle = "#334247";
  context.fillRect(x, y + size.height * 0.79, size.width, size.height * 0.37);
}

function drawTrain(context: CanvasRenderingContext2D, size: Size) {
  const x = -size.width / 2;
  const y = -size.height / 2;
  context.fillStyle = "#d7d8c9";
  context.beginPath();
  context.moveTo(x, y + size.height * 0.05);
  context.lineTo(x + size.width, y + size.height * 0.27);
  context.lineTo(x + size.width, y + size.height);
  context.lineTo(x, y + size.height * 0.88);
  context.closePath();
  context.fill();
  context.fillStyle = "#718589";
  for (let i = 0; i < 5; i++) {
    const windowX = x + size.width * (0.17 + i * 0.17);
    context.fillRect(windowX, y + size.height * (0.22 + i * 0.025), size.width * 0.115, size.height * 0.34);
  }
  context.fillStyle = "#e8c888";
  context.fillRect(x + size.width * 0.92, y + size.height * 0.76, size.width * 0.045, size.height * 0.05);
}

function drawProp(context: CanvasRenderingContext2D, size: Size) {
  const x = -size.width / 2;
  const y = -size.height / 2;
  context.fillStyle = "#875e46";
  context.fillRect(x, y + size.height * 0.18, size.width, size.height * 0.76);
  context.strokeStyle = "#d7b891";
  context.lineWidth = 2;
  context.strokeRect(x + size.width * 0.08, y + size.height * 0.26, size.width * 0.84, size.height * 0.6);
  context.beginPath();
  context.arc(0, y + size.height * 0.18, size.width * 0.2, Math.PI, Math.PI * 2);
  context.stroke();
}

function drawLight(context: CanvasRenderingContext2D, size: Size) {
  const x = -size.width / 2;
  const y = -size.height / 2;
  context.save();
  context.shadowColor = "#f0bb73";
  context.shadowBlur = 36;
  context.fillStyle = "#f3d39a";
  context.fillRect(x + size.width * 0.42, y + size.height * 0.08, size.width * 0.15, size.height * 0.82);
  context.restore();
  context.fillStyle = "#e7c892";
  context.fillRect(x + size.width * 0.28, y, size.width * 0.44, size.height * 0.07);
}

function drawHero(context: CanvasRenderingContext2D, size: Size) {
  const headY = -size.height * 0.28;
  context.fillStyle = "#20292c";
  context.beginPath();
  context.ellipse(0, size.height * 0.44, size.width * 0.47, size.height * 0.065, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#c99a78";
  context.beginPath();
  context.ellipse(0, headY, size.width * 0.22, size.height * 0.19, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#282f34";
  context.beginPath();
  context.arc(0, headY - size.height * 0.055, size.width * 0.23, Math.PI, Math.PI * 2);
  context.lineTo(size.width * 0.22, headY + size.height * 0.1);
  context.quadraticCurveTo(0, headY + size.height * 0.2, -size.width * 0.23, headY + size.height * 0.08);
  context.closePath();
  context.fill();
  context.fillStyle = "#b45443";
  context.beginPath();
  context.moveTo(-size.width * 0.31, -size.height * 0.08);
  context.quadraticCurveTo(0, -size.height * 0.14, size.width * 0.32, -size.height * 0.07);
  context.lineTo(size.width * 0.45, size.height * 0.44);
  context.lineTo(-size.width * 0.41, size.height * 0.44);
  context.closePath();
  context.fill();
  context.strokeStyle = "#d79a79";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-size.width * 0.23, size.height * 0.02);
  context.lineTo(-size.width * 0.34, size.height * 0.27);
  context.moveTo(size.width * 0.25, size.height * 0.02);
  context.lineTo(size.width * 0.39, size.height * 0.23);
  context.stroke();
}

function drawRain(context: CanvasRenderingContext2D, size: Size) {
  const x = -size.width / 2;
  const y = -size.height / 2;
  context.strokeStyle = "#c9dadd55";
  context.lineWidth = 1;
  for (let i = 0; i < 210; i++) {
    const rainX = x + ((i * 83) % size.width);
    const rainY = y + ((i * 47) % size.height);
    context.beginPath();
    context.moveTo(rainX, rainY);
    context.lineTo(rainX - 4, rainY + 13 + (i % 12));
    context.stroke();
  }
  const reflection = context.createLinearGradient(0, y + size.height * 0.72, 0, y + size.height);
  reflection.addColorStop(0, "#e2b47c55");
  reflection.addColorStop(1, "#e2b47c00");
  context.fillStyle = reflection;
  context.fillRect(x + size.width * 0.16, y + size.height * 0.72, size.width * 0.58, size.height * 0.28);
}

export function drawScene(context: CanvasRenderingContext2D, width: number, height: number, layers: SceneLayer[], selectedId: string | null) {
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#26383f");
  sky.addColorStop(0.48, "#526b70");
  sky.addColorStop(1, "#bd9270");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  [...layers].sort((a, b) => a.z - b.z).forEach((layer) => {
    if (!layer.visible) return;
    withLayerTransform(context, layer, width, height, (size) => {
      if (layer.kind === "BACKGROUND") drawStation(context, size);
      if (layer.kind === "PROP") layer.id === "train" ? drawTrain(context, size) : drawProp(context, size);
      if (layer.kind === "LIGHT") drawLight(context, size);
      if (layer.kind === "CHARACTER") drawHero(context, size);
      if (layer.kind === "ATMOSPHERE") drawRain(context, size);
    });
  });

  const selected = layers.find((layer) => layer.id === selectedId && layer.visible);
  if (selected) {
    withLayerTransform(context, selected, width, height, (size) => {
      context.strokeStyle = selected.locked ? "#d5b47b" : "#96dcc2";
      context.lineWidth = 1.5 / selected.scale;
      context.setLineDash(selected.locked ? [5 / selected.scale, 4 / selected.scale] : []);
      context.strokeRect(-size.width / 2, -size.height / 2, size.width, size.height);
      context.setLineDash([]);
      const handleSize = 8 / selected.scale;
      context.fillStyle = selected.locked ? "#d5b47b" : "#b7ead6";
      context.fillRect(size.width / 2 - handleSize / 2, size.height / 2 - handleSize / 2, handleSize, handleSize);
    });
  }

  context.fillStyle = "#f2e8d8";
  context.font = "500 11px 'DM Sans', sans-serif";
  context.fillText("01   /   PLATFORM 03", width * 0.055, height * 0.92);
  context.fillStyle = "#f2e8d8aa";
  context.fillText("LAST TRAIN · 23:47", width * 0.81, height * 0.92);
}
