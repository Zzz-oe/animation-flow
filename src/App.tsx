import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import ReviewPanel, { type ReviewStatus } from "./ReviewPanel";
import { mockReviewProvider, sceneFingerprint, type ReviewFinding, type ReviewResult } from "./review";
import { mockRevisionProvider, type CandidateRevision } from "./revision";
import { cloneLayers, DEFAULT_LAYERS, drawScene, getResizeHandle, hitTestLayer, type SceneLayer } from "./scene";

const STORAGE_KEY = "scene-pilot:stage-2";
const INTENT_KEY = "scene-pilot:intent";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    film: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 1.2 2.3L22 17l-1.8.7L19 20l-.8-2.3L16 17l2.2-.7L19 14Z"/></>,
    undo: <><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></>, redo: <><path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h2"/></>,
    zoom: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5M10.8 7.5v6.6m-3.3-3.3h6.6"/></>, arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>, chevron: <path d="m9 18 6-6-6-6"/>, check: <path d="m5 12 4 4L19 6"/>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>, trash: <><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13"/><path d="M10 11v5m4-5v5"/></>,
    up: <path d="m6 15 6-6 6 6"/>, down: <path d="m6 9 6 6 6-6"/>, reset: <><path d="M4 4v6h6"/><path d="M5.5 15a8 8 0 1 0 1.2-8.5L4 10"/></>,
  };
  return <svg {...common} aria-hidden="true">{paths[name]}</svg>;
}

function restoreLayers() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return cloneLayers(DEFAULT_LAYERS);
    const parsed = JSON.parse(saved) as SceneLayer[];
    return Array.isArray(parsed) && parsed.length ? parsed : cloneLayers(DEFAULT_LAYERS);
  } catch { return cloneLayers(DEFAULT_LAYERS); }
}

type DragState = { id: string; mode: "move" | "scale"; start: { x: number; y: number }; origin: SceneLayer; before: SceneLayer[] };

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef<SceneLayer[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const reviewAbortRef = useRef<AbortController | null>(null);
  const revisionAbortRef = useRef<AbortController | null>(null);
  const [layers, setLayers] = useState<SceneLayer[]>(restoreLayers);
  const [selectedLayer, setSelectedLayer] = useState<string | null>("hero");
  const [past, setPast] = useState<SceneLayer[][]>([]);
  const [future, setFuture] = useState<SceneLayer[][]>([]);
  const [tab, setTab] = useState<"intent" | "object" | "assistant">("intent");
  const [intent, setIntent] = useState(() => localStorage.getItem(INTENT_KEY) ?? "她在等最后一班车。雨夜要安静、克制，让观众先注意到她，再感受到站台的空旷。人物保持沉默，不要添加额外角色。");
  const [saveState, setSaveState] = useState("已保存");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("idle");
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  const [selectedFindingIds, setSelectedFindingIds] = useState<string[]>([]);
  const [additionalInstruction, setAdditionalInstruction] = useState("");
  const [generationStatus, setGenerationStatus] = useState<"idle" | "loading" | "error">("idle");
  const [generationError, setGenerationError] = useState("");
  const [candidate, setCandidate] = useState<CandidateRevision | null>(null);
  const [previewMode, setPreviewMode] = useState<"original" | "candidate">("original");
  const [restorePoint, setRestorePoint] = useState<SceneLayer[] | null>(null);
  const [decisionHistory, setDecisionHistory] = useState<Array<{ id: string; label: string; detail: string }>>([]);
  const selected = layers.find((layer) => layer.id === selectedLayer) ?? null;
  const activeFinding = reviewResult?.findings.find((finding) => finding.id === activeFindingId) ?? null;
  const activeTarget = activeFinding?.targetIds?.map((id) => layers.find((layer) => layer.id === id)).find(Boolean);
  const reviewRegion = activeFinding?.region ?? (activeTarget ? { x: clamp(activeTarget.x - .08, 0, .84), y: clamp(activeTarget.y - .18, 0, .64), width: .16, height: .36 } : null);
  const reviewIsStale = Boolean(reviewResult && reviewResult.sceneFingerprint !== sceneFingerprint(layers, intent));
  const displayLayers = candidate && previewMode === "candidate" ? candidate.layers : layers;
  layersRef.current = layers;

  useEffect(() => {
    const timer = window.setTimeout(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(layers)); setSaveState("已保存"); }, 180);
    setSaveState("保存中");
    return () => window.clearTimeout(timer);
  }, [layers]);
  useEffect(() => { localStorage.setItem(INTENT_KEY, intent); }, [intent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawScene(context, rect.width, rect.height, displayLayers, candidate && previewMode === "candidate" ? null : selectedLayer);
    };
    render();
    window.addEventListener("resize", render);
    return () => window.removeEventListener("resize", render);
  }, [displayLayers, selectedLayer, candidate, previewMode]);

  const commit = (next: SceneLayer[], before = layersRef.current) => {
    setPast((items) => [...items.slice(-29), cloneLayers(before)]);
    setFuture([]);
    setLayers(cloneLayers(next));
  };
  const updateLayer = (id: string, patch: Partial<SceneLayer>) => commit(layersRef.current.map((layer) => layer.id === id ? { ...layer, ...patch } : layer));
  const undo = () => setPast((items) => {
    const previous = items.at(-1); if (!previous) return items;
    setFuture((redoItems) => [cloneLayers(layersRef.current), ...redoItems.slice(0, 29)]); setLayers(cloneLayers(previous)); return items.slice(0, -1);
  });
  const redo = () => setFuture((items) => {
    const next = items[0]; if (!next) return items;
    setPast((undoItems) => [...undoItems.slice(-29), cloneLayers(layersRef.current)]); setLayers(cloneLayers(next)); return items.slice(1);
  });
  const resetScene = () => { commit(cloneLayers(DEFAULT_LAYERS)); setSelectedLayer("hero"); };
  const toggleVisibility = (id: string) => updateLayer(id, { visible: !layersRef.current.find((layer) => layer.id === id)?.visible });
  const toggleLock = (id: string) => updateLayer(id, { locked: !layersRef.current.find((layer) => layer.id === id)?.locked });
  const moveZ = (id: string, direction: number) => {
    const ordered = [...layersRef.current].sort((a, b) => a.z - b.z);
    const index = ordered.findIndex((layer) => layer.id === id);
    const target = clamp(index + direction, 0, ordered.length - 1);
    if (index === target) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    commit(ordered.map((layer, z) => ({ ...layer, z })));
  };
  const addProp = () => {
    const count = layersRef.current.filter((layer) => layer.id.startsWith("prop-")).length + 1;
    const layer: SceneLayer = { id: `prop-${Date.now()}`, name: `旅行箱 ${count}`, kind: "PROP", tint: "#986f52", visible: true, locked: false, x: 0.48, y: 0.69, scale: 1, rotation: 0, z: Math.max(...layersRef.current.map((item) => item.z)) + 1 };
    commit([...layersRef.current, layer]); setSelectedLayer(layer.id); setTab("object");
  };
  const deleteSelected = () => {
    if (!selected || selected.locked) return;
    commit(layersRef.current.filter((layer) => layer.id !== selected.id));
    setSelectedLayer("hero");
  };

  const runReview = async () => {
    reviewAbortRef.current?.abort();
    const controller = new AbortController();
    reviewAbortRef.current = controller;
    setReviewStatus("loading");
    setReviewError("");
    setActiveFindingId(null);
    setTab("assistant");
    try {
      const result = await mockReviewProvider.review({
        intent,
        shotType: "中景",
        durationSeconds: 4,
        moods: ["克制", "孤独", "期待"],
        constraints: ["人物保持沉默", "不添加额外角色"],
        layers: cloneLayers(layersRef.current),
        canvasSnapshot: canvasRef.current?.toDataURL("image/png"),
      }, controller.signal);
      if (controller.signal.aborted) return;
      setReviewResult(result);
      setActiveFindingId(result.findings[0]?.id ?? null);
      setSelectedFindingIds(result.findings.map((finding) => finding.id));
      setCandidate(null);
      setPreviewMode("original");
      setGenerationStatus("idle");
      setGenerationError("");
      setReviewStatus("success");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setReviewError(error instanceof Error ? error.message : "评审返回了无法识别的错误");
      setReviewStatus("error");
    } finally {
      if (reviewAbortRef.current === controller) reviewAbortRef.current = null;
    }
  };

  const selectFinding = (finding: ReviewFinding) => {
    setActiveFindingId(finding.id);
    const target = finding.targetIds?.map((id) => layersRef.current.find((layer) => layer.id === id)).find(Boolean);
    if (target) setSelectedLayer(target.id);
  };

  const toggleFinding = (id: string) => {
    setSelectedFindingIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
    setCandidate(null);
    setPreviewMode("original");
  };

  const generateCandidate = async () => {
    if (!reviewResult || reviewIsStale) return;
    revisionAbortRef.current?.abort();
    const controller = new AbortController();
    revisionAbortRef.current = controller;
    setGenerationStatus("loading");
    setGenerationError("");
    try {
      const nextCandidate = await mockRevisionProvider.generateRevision({
        intent,
        constraints: ["人物保持沉默", "不添加额外角色", "未选建议对应区域保持不变"],
        additionalInstruction,
        selectedFindings: reviewResult.findings.filter((finding) => selectedFindingIds.includes(finding.id)),
        layers: cloneLayers(layersRef.current),
      }, controller.signal);
      if (controller.signal.aborted) return;
      setCandidate(nextCandidate);
      setPreviewMode("candidate");
      setGenerationStatus("idle");
      setDecisionHistory((items) => [{ id: `generated-${Date.now()}`, label: "生成候选", detail: `${nextCandidate.findingIds.length} 条建议 · ${nextCandidate.changes.length} 处变化 · Mock` }, ...items].slice(0, 12));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setGenerationError(error instanceof Error ? error.message : "候选生成失败；原稿未被修改");
      setGenerationStatus("error");
    } finally {
      if (revisionAbortRef.current === controller) revisionAbortRef.current = null;
    }
  };

  const acceptCandidate = () => {
    if (!candidate) return;
    const before = cloneLayers(layersRef.current);
    setRestorePoint(before);
    commit(candidate.layers, before);
    setDecisionHistory((items) => [{ id: `accepted-${Date.now()}`, label: "接受候选", detail: `${candidate.changes.map((change) => change.layerName).join("、")} 已应用，可恢复` }, ...items].slice(0, 12));
    setCandidate(null);
    setPreviewMode("original");
    setSelectedFindingIds([]);
  };

  const rejectCandidate = () => {
    if (!candidate) return;
    setDecisionHistory((items) => [{ id: `rejected-${Date.now()}`, label: "拒绝候选", detail: "原稿保持不变，可调整建议后再次生成" }, ...items].slice(0, 12));
    setCandidate(null);
    setPreviewMode("original");
  };

  const restoreAccepted = () => {
    if (!restorePoint) return;
    const current = cloneLayers(layersRef.current);
    commit(restorePoint, current);
    setRestorePoint(null);
    setDecisionHistory((items) => [{ id: `restored-${Date.now()}`, label: "恢复原稿", detail: "已回到最近一次接受候选前的版本" }, ...items].slice(0, 12));
  };

  useEffect(() => () => { reviewAbortRef.current?.abort(); revisionAbortRef.current?.abort(); }, []);

  const canvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height };
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event);
    const currentSelected = layersRef.current.find((layer) => layer.id === selectedLayer && layer.visible);
    if (currentSelected && !currentSelected.locked) {
      const handle = getResizeHandle(currentSelected, point.width, point.height);
      if (Math.hypot(point.x - handle.x, point.y - handle.y) < 16) {
        dragRef.current = { id: currentSelected.id, mode: "scale", start: point, origin: { ...currentSelected }, before: cloneLayers(layersRef.current) };
        event.currentTarget.setPointerCapture(event.pointerId); return;
      }
    }
    const hit = hitTestLayer(layersRef.current, point, point.width, point.height);
    setSelectedLayer(hit?.id ?? null);
    if (!hit) return;
    setTab("object");
    if (hit.locked) return;
    dragRef.current = { id: hit.id, mode: "move", start: point, origin: { ...hit }, before: cloneLayers(layersRef.current) };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current; if (!drag) return;
    const point = canvasPoint(event);
    setLayers((current) => current.map((layer) => {
      if (layer.id !== drag.id) return layer;
      if (drag.mode === "move") return { ...layer, x: clamp(drag.origin.x + (point.x - drag.start.x) / point.width, 0.03, 0.97), y: clamp(drag.origin.y + (point.y - drag.start.y) / point.height, 0.05, 0.95) };
      const center = { x: drag.origin.x * point.width, y: drag.origin.y * point.height };
      const startDistance = Math.max(10, Math.hypot(drag.start.x - center.x, drag.start.y - center.y));
      return { ...layer, scale: clamp(drag.origin.scale * Math.hypot(point.x - center.x, point.y - center.y) / startDistance, 0.45, 2.2) };
    }));
  };
  const endPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current; if (!drag) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (JSON.stringify(drag.before) !== JSON.stringify(layersRef.current)) { setPast((items) => [...items.slice(-29), drag.before]); setFuture([]); }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, button")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      if (event.key === "Delete" || event.key === "Backspace") deleteSelected();
      const delta = event.shiftKey ? 0.02 : 0.005;
      if (selected && !selected.locked && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        updateLayer(selected.id, { x: clamp(selected.x + (event.key === "ArrowRight" ? delta : event.key === "ArrowLeft" ? -delta : 0), 0.03, 0.97), y: clamp(selected.y + (event.key === "ArrowDown" ? delta : event.key === "ArrowUp" ? -delta : 0), 0.05, 0.95) });
      }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });

  return <main className="app-shell">
    <header className="topbar"><div className="brand-lockup"><span className="brand-mark">S</span><span className="brand-name">ScenePilot</span><span className="workspace-label">/ WORKSPACE</span></div><nav className="top-nav" aria-label="主导航"><button className="nav-item active"><Icon name="film"/>分镜工作台</button><button className="nav-item"><Icon name="grid"/>项目素材</button></nav><div className="top-actions"><span className="saved-state" role="status" aria-live="polite"><Icon name="check"/>{saveState}</span><button className="avatar" aria-label="用户菜单">L</button></div></header>
    <div className="project-bar"><div className="project-title"><span className="crumb">短片企划</span><Icon name="chevron"/><strong>雨停之前</strong><span className="project-tag">分镜预演</span></div><div className="project-meta"><span>24 fps</span><span className="meta-dot"/><span>16:9</span><span className="meta-dot"/><span>本地恢复已开启</span></div></div>
    <div className="editor-layout">
      <aside className="left-rail"><div className="rail-heading"><div><span className="panel-eyebrow">SEQUENCE</span><h2>镜头列表</h2></div><button className="icon-button"><Icon name="plus"/></button></div><button className="shot-card selected-shot"><span className="shot-thumb"><span className="thumb-scene"/><span className="shot-index">01</span><span className="play-mini">▶</span></span><span className="shot-card-copy"><strong>站台 · 等待</strong><small>中景 · 情绪建立</small></span><span className="shot-duration">4s</span></button><button className="shot-card"><span className="shot-thumb second-thumb"><span className="thumb-scene"/><span className="shot-index">02</span></span><span className="shot-card-copy"><strong>车灯 · 靠近</strong><small>近景 · 视觉转折</small></span><span className="shot-duration">3s</span></button><button className="add-shot"><Icon name="plus"/>添加镜头</button>
        <div className="layer-section"><div className="layer-heading"><div><span className="panel-eyebrow">SCENE STACK</span><h2>场景图层 <span>{layers.length}</span></h2></div><button className="icon-button small-icon" onClick={addProp} aria-label="添加旅行箱道具"><Icon name="plus"/></button></div><div className="layer-list">{[...layers].sort((a,b)=>b.z-a.z).map((layer)=><div className={`layer-row ${selectedLayer===layer.id?"active-layer":""}`} key={layer.id}><button className="layer-main" onClick={()=>{setSelectedLayer(layer.id);setTab("object")}}><span className="layer-swatch" style={{backgroundColor:layer.tint}}/><span className="layer-label"><strong>{layer.name}</strong><small>{layer.kind}{layer.locked?" · LOCKED":""}</small></span></button><button className={`visibility-button ${layer.visible?"":"muted"}`} onClick={()=>toggleVisibility(layer.id)} aria-label={`${layer.visible?"隐藏":"显示"}${layer.name}`}><Icon name="eye"/></button></div>)}</div></div>
        <div className="left-bottom"><span className="project-cover"/><span><strong>雨停之前</strong><small>本地自动保存</small></span><button className="icon-button more-button"><Icon name="more"/></button></div>
      </aside>
      <section className="stage-column"><div className="stage-toolbar"><div className="stage-label"><span className="record-dot"/>镜头 01 <span className="toolbar-divider"/> {selected?`已选择：${selected.name}`:"点击画面选择对象"}</div><div className="tool-group"><button className={`icon-button ${past.length?"":"disabled-tool"}`} onClick={undo} aria-label="撤销" disabled={!past.length}><Icon name="undo"/></button><button className={`icon-button ${future.length?"":"disabled-tool"}`} onClick={redo} aria-label="重做" disabled={!future.length}><Icon name="redo"/></button><span className="toolbar-divider"/><button className="zoom-button"><Icon name="zoom"/> 68%</button><button className="icon-button" onClick={resetScene} aria-label="重置场景"><Icon name="reset"/></button></div></div>
        <div className="stage-wrap"><div className={`stage-canvas ${candidate ? `candidate-preview ${previewMode}` : ""}`}><canvas ref={canvasRef} className={dragRef.current?"dragging":""} onPointerDown={candidate ? undefined : onPointerDown} onPointerMove={candidate ? undefined : onPointerMove} onPointerUp={candidate ? undefined : endPointer} onPointerCancel={candidate ? undefined : endPointer} aria-label={candidate ? `${previewMode === "candidate" ? "候选修正版" : "原稿"}预览` : "雨夜车站分镜画面，可选择和拖动场景对象"}/><div className="safe-frame"/>{candidate && <div className="preview-badge"><b>{previewMode === "candidate" ? "CANDIDATE" : "ORIGINAL"}</b><span>{previewMode === "candidate" ? "隔离候选 · 尚未应用" : "当前原稿 · 未被修改"}</span></div>}{!candidate && tab==="assistant" && reviewStatus==="success" && reviewRegion && <div className="review-region" style={{left:`${reviewRegion.x*100}%`,top:`${reviewRegion.y*100}%`,width:`${reviewRegion.width*100}%`,height:`${reviewRegion.height*100}%`}}/>}<span className="canvas-note">FRAME 01 <span>·</span> 1920 × 1080</span></div></div>
        <div className="stage-footer"><span><i className="keyboard-key">Drag</i> 移动对象</span><span><i className="keyboard-key">Corner</i> 缩放对象</span><span><i className="keyboard-key">⌘Z</i> 撤销</span><span className="footer-spacer"/><button className="timeline-toggle"><Icon name="film"/>时间轴 <span>⌄</span></button></div><div className="timeline"><div className="timeline-ruler"><span>00:00</span><span>00:01</span><span>00:02</span><span>00:03</span><span>00:04</span></div><div className="timeline-track"><span className="playhead"/><span className="clip-block"><i/>站台 · 等待 <small>04:00</small></span><span className="track-end">+</span></div></div>
      </section>
      <aside className="right-panel"><div className="right-tabs"><button className={tab==="intent"?"selected-tab":""} onClick={()=>setTab("intent")}>创作意图</button><button className={tab==="object"?"selected-tab":""} onClick={()=>setTab("object")}>对象属性</button><button className={tab==="assistant"?"selected-tab":""} onClick={()=>setTab("assistant")}><Icon name="spark"/> AI 协作</button></div>
        {tab==="intent"?<div className="intent-panel"><div className="intent-heading"><span className="panel-eyebrow">SHOT DIRECTION</span><h2>这一镜想表达什么？</h2><p>让评审和生成都围绕你的叙事目标展开。</p></div><label className="field-label" htmlFor="intent">导演意图</label><textarea id="intent" value={intent} onChange={(e)=>setIntent(e.target.value)}/><div className="field-row"><label><span className="field-label">镜头类型</span><button className="select-field">中景 <span>⌄</span></button></label><label><span className="field-label">镜头时长</span><button className="select-field">4 秒 <span>⌄</span></button></label></div><div className="field-group"><span className="field-label">情绪基调</span><div className="mood-tags"><button className="mood-tag active-mood">克制</button><button className="mood-tag">孤独</button><button className="mood-tag">期待</button></div></div><div className="field-group"><span className="field-label">不可改变</span><div className="constraint-box"><span className="lock-symbol">◇</span><span>人物保持沉默，不添加额外角色</span></div></div><div className="context-note"><span className="note-line"/><p>场景对象的<strong>位置、缩放和图层关系</strong>会与画面快照一起成为 AI 评审的结构化上下文。</p></div><button className="review-button" onClick={runReview} disabled={reviewStatus==="loading"}><Icon name="spark"/>{reviewStatus==="loading"?"评审中…":"评审这一镜"} <span>→</span></button><div className="mode-caption"><span className="mode-dot"/>Mock 演示模式 <span>·</span> {reviewResult?"已有结构化结论":"无需 API Key"}</div></div>:tab==="object"?<div className="object-panel">{selected?<><div className="object-title"><span className="layer-swatch large-swatch" style={{backgroundColor:selected.tint}}/><div><span className="panel-eyebrow">SELECTED OBJECT</span><h2>{selected.name}</h2><p>{selected.kind} · 图层 {selected.z+1}</p></div></div><div className="object-actions"><button onClick={()=>toggleLock(selected.id)}><Icon name="lock"/>{selected.locked?"解锁":"锁定"}</button><button onClick={()=>moveZ(selected.id,1)}><Icon name="up"/>上移</button><button onClick={()=>moveZ(selected.id,-1)}><Icon name="down"/>下移</button></div><div className="property-grid"><label><span>X</span><input type="number" min="0" max="100" value={Math.round(selected.x*100)} onChange={(e)=>updateLayer(selected.id,{x:clamp(Number(e.target.value)/100,.03,.97)})}/><small>%</small></label><label><span>Y</span><input type="number" min="0" max="100" value={Math.round(selected.y*100)} onChange={(e)=>updateLayer(selected.id,{y:clamp(Number(e.target.value)/100,.05,.95)})}/><small>%</small></label><label><span>缩放</span><input type="number" min="45" max="220" value={Math.round(selected.scale*100)} disabled={selected.locked} onChange={(e)=>updateLayer(selected.id,{scale:clamp(Number(e.target.value)/100,.45,2.2)})}/><small>%</small></label><label><span>旋转</span><input type="number" min="-180" max="180" value={Math.round(selected.rotation)} disabled={selected.locked} onChange={(e)=>updateLayer(selected.id,{rotation:clamp(Number(e.target.value),-180,180)})}/><small>°</small></label></div><div className={`lock-note ${selected.locked?"visible":""}`}><Icon name="lock"/><span>{selected.locked?"该图层已锁定，画布拖动和变换已禁用。":"拖动对象移动；拖动右下角控制点等比缩放。"}</span></div><button className="delete-button" onClick={deleteSelected} disabled={selected.locked}><Icon name="trash"/>删除对象</button></>:<div className="assistant-empty"><h2>没有选中对象</h2><p>点击舞台中的角色、列车或灯箱，查看并调整它的属性。</p></div>}</div>:<ReviewPanel status={reviewStatus} result={reviewResult} error={reviewError} stale={reviewIsStale} activeFindingId={activeFindingId} onSelectFinding={selectFinding} onRunReview={runReview} onBackToIntent={()=>setTab("intent")} selectedFindingIds={selectedFindingIds} onToggleFinding={toggleFinding} additionalInstruction={additionalInstruction} onInstructionChange={(value)=>{setAdditionalInstruction(value);setCandidate(null);setPreviewMode("original")}} generationStatus={generationStatus} generationError={generationError} candidate={candidate} previewMode={previewMode} onPreviewModeChange={setPreviewMode} onGenerate={generateCandidate} onAccept={acceptCandidate} onReject={rejectCandidate} onRestore={restoreAccepted} canRestore={Boolean(restorePoint)} history={decisionHistory}/>}
        <div className="right-bottom"><span className="help-mark">?</span><span>编辑器指南</span><span className="footer-spacer"/><span className="shortcut-label">Delete 删除 · ⇧方向键快移</span></div>
      </aside>
    </div>
  </main>;
}

export default App;
