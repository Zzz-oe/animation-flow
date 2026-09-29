import { useEffect, useRef, useState } from "react";

type Layer = { id: string; name: string; kind: string; tint: string; visible: boolean };

const initialLayers: Layer[] = [
  { id: "rain", name: "雨幕与玻璃反光", kind: "ATMOSPHERE", tint: "#6d9da3", visible: true },
  { id: "station", name: "站台结构", kind: "BACKGROUND", tint: "#d6b789", visible: true },
  { id: "train", name: "末班列车", kind: "PROP", tint: "#d9e1dc", visible: true },
  { id: "hero", name: "林 · 等待中", kind: "CHARACTER", tint: "#db7658", visible: true },
  { id: "light", name: "暖色灯箱", kind: "LIGHT", tint: "#edc57b", visible: true },
];

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    film: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 1.2 2.3L22 17l-1.8.7L19 20l-.8-2.3L16 17l2.2-.7L19 14Z"/></>,
    undo: <><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></>,
    redo: <><path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h2"/></>,
    zoom: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5M10.8 7.5v6.6m-3.3-3.3h6.6"/></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg {...common} aria-hidden="true">{paths[name]}</svg>;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layers, setLayers] = useState(initialLayers);
  const [selectedLayer, setSelectedLayer] = useState("hero");
  const [tab, setTab] = useState("intent");
  const [intent, setIntent] = useState("她在等最后一班车。雨夜要安静、克制，让观众先注意到她，再感受到站台的空旷。人物保持沉默，不要添加额外角色。");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const box = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);
    ctx.scale(ratio, ratio);
    const w = box.width;
    const h = box.height;
    const horizon = h * 0.69;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#26383f");
    sky.addColorStop(0.48, "#526b70");
    sky.addColorStop(1, "#bd9270");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const paint = (id: string, draw: () => void) => {
      if (layers.find((layer) => layer.id === id)?.visible) draw();
    };
    paint("station", () => {
      ctx.fillStyle = "#35464a";
      ctx.fillRect(0, h * 0.12, w, h * 0.055);
      ctx.fillStyle = "#c59b70";
      ctx.fillRect(w * 0.09, h * 0.17, w * 0.018, h * 0.5);
      ctx.fillRect(w * 0.91, h * 0.17, w * 0.018, h * 0.5);
      ctx.fillStyle = "#718286";
      ctx.fillRect(w * 0.13, h * 0.25, w * 0.18, h * 0.31);
      ctx.fillRect(w * 0.68, h * 0.22, w * 0.21, h * 0.36);
      ctx.fillStyle = "#b4b7a4";
      for (let i = 0; i < 5; i++) ctx.fillRect(w * (0.15 + i * 0.035), h * 0.28, w * 0.018, h * 0.24);
      ctx.fillStyle = "#334247";
      ctx.fillRect(0, horizon, w, h - horizon);
    });
    paint("train", () => {
      ctx.fillStyle = "#d7d8c9";
      ctx.beginPath();
      ctx.moveTo(w * 0.48, h * 0.31);
      ctx.lineTo(w * 0.91, h * 0.39);
      ctx.lineTo(w * 0.91, horizon * 0.99);
      ctx.lineTo(w * 0.48, horizon * 0.94);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#718589";
      for (let i = 0; i < 5; i++) {
        const x = w * (0.55 + i * 0.071);
        ctx.beginPath();
        ctx.moveTo(x, h * (0.36 + i * 0.012));
        ctx.lineTo(x + w * 0.048, h * (0.37 + i * 0.012));
        ctx.lineTo(x + w * 0.048, h * (0.49 + i * 0.012));
        ctx.lineTo(x, h * (0.485 + i * 0.012));
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "#e8c888";
      ctx.fillRect(w * 0.88, h * 0.61, w * 0.02, h * 0.018);
    });
    paint("light", () => {
      ctx.save();
      ctx.shadowColor = "#f0bb73";
      ctx.shadowBlur = 36;
      ctx.fillStyle = "#f3d39a";
      ctx.fillRect(w * 0.19, h * 0.2, w * 0.006, h * 0.19);
      ctx.restore();
      ctx.fillStyle = "#e7c892";
      ctx.fillRect(w * 0.185, h * 0.195, w * 0.016, h * 0.012);
    });
    paint("hero", () => {
      const x = w * 0.355;
      const y = h * 0.57;
      ctx.fillStyle = "#20292c";
      ctx.beginPath();
      ctx.ellipse(x, y + h * 0.132, w * 0.047, h * 0.014, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c99a78";
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.022, h * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#282f34";
      ctx.beginPath();
      ctx.arc(x, y - h * 0.013, w * 0.023, Math.PI, Math.PI * 2);
      ctx.lineTo(x + w * 0.022, y + h * 0.023);
      ctx.quadraticCurveTo(x, y + h * 0.048, x - w * 0.023, y + h * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#b45443";
      ctx.beginPath();
      ctx.moveTo(x - w * 0.031, y + h * 0.036);
      ctx.quadraticCurveTo(x, y + h * 0.022, x + w * 0.032, y + h * 0.039);
      ctx.lineTo(x + w * 0.045, y + h * 0.133);
      ctx.lineTo(x - w * 0.041, y + h * 0.133);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#d79a79";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.023, y + h * 0.061);
      ctx.lineTo(x - w * 0.034, y + h * 0.1);
      ctx.moveTo(x + w * 0.025, y + h * 0.061);
      ctx.lineTo(x + w * 0.039, y + h * 0.092);
      ctx.stroke();
    });
    paint("rain", () => {
      ctx.strokeStyle = "#c9dadd55";
      ctx.lineWidth = 1;
      for (let i = 0; i < 210; i++) {
        const x = (i * 83) % w;
        const y = (i * 47) % (h * 0.83);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4, y + 13 + (i % 12));
        ctx.stroke();
      }
      const reflection = ctx.createLinearGradient(0, horizon, 0, h);
      reflection.addColorStop(0, "#e2b47c55");
      reflection.addColorStop(1, "#e2b47c00");
      ctx.fillStyle = reflection;
      ctx.fillRect(w * 0.16, horizon, w * 0.58, h - horizon);
    });
    ctx.fillStyle = "#f2e8d8";
    ctx.font = "500 11px 'DM Sans', sans-serif";
    ctx.fillText("01   /   PLATFORM 03", w * 0.055, h * 0.92);
    ctx.fillStyle = "#f2e8d8aa";
    ctx.fillText("LAST TRAIN · 23:47", w * 0.81, h * 0.92);
  }, [layers]);

  const toggleVisibility = (id: string) => setLayers((current) => current.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer));

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark">S</span><span className="brand-name">ScenePilot</span><span className="workspace-label">/ WORKSPACE</span></div>
        <nav className="top-nav" aria-label="主导航"><button className="nav-item active"><Icon name="film"/>分镜工作台</button><button className="nav-item"><Icon name="grid"/>项目素材</button></nav>
        <div className="top-actions"><span className="saved-state"><Icon name="check"/>已保存</span><button className="avatar" aria-label="用户菜单">L</button></div>
      </header>
      <div className="project-bar"><div className="project-title"><span className="crumb">短片企划</span><Icon name="chevron"/><strong>雨停之前</strong><span className="project-tag">分镜预演</span></div><div className="project-meta"><span>24 fps</span><span className="meta-dot"/><span>16:9</span><span className="meta-dot"/><span>自动保存</span></div></div>
      <div className="editor-layout">
        <aside className="left-rail">
          <div className="rail-heading"><div><span className="panel-eyebrow">SEQUENCE</span><h2>镜头列表</h2></div><button className="icon-button" aria-label="添加镜头"><Icon name="plus"/></button></div>
          <button className="shot-card selected-shot"><span className="shot-thumb"><span className="thumb-scene"/><span className="shot-index">01</span><span className="play-mini">▶</span></span><span className="shot-card-copy"><strong>站台 · 等待</strong><small>中景 · 情绪建立</small></span><span className="shot-duration">4s</span></button>
          <button className="shot-card"><span className="shot-thumb second-thumb"><span className="thumb-scene"/><span className="shot-index">02</span></span><span className="shot-card-copy"><strong>车灯 · 靠近</strong><small>近景 · 视觉转折</small></span><span className="shot-duration">3s</span></button>
          <button className="add-shot"><Icon name="plus"/>添加镜头</button>
          <div className="layer-section"><div className="layer-heading"><div><span className="panel-eyebrow">SCENE STACK</span><h2>场景图层 <span>{layers.length}</span></h2></div><button className="icon-button small-icon" aria-label="添加图层"><Icon name="plus"/></button></div>
            <div className="layer-list">{[...layers].reverse().map((layer) => <div className={`layer-row ${selectedLayer === layer.id ? "active-layer" : ""}`} key={layer.id}><button className="layer-main" onClick={() => setSelectedLayer(layer.id)}><span className="layer-swatch" style={{ backgroundColor: layer.tint }}/><span className="layer-label"><strong>{layer.name}</strong><small>{layer.kind}</small></span></button><button className={`visibility-button ${layer.visible ? "" : "muted"}`} onClick={() => toggleVisibility(layer.id)} aria-label={`${layer.visible ? "隐藏" : "显示"}${layer.name}`}><Icon name="eye"/></button></div>)}</div>
          </div>
          <div className="left-bottom"><span className="project-cover"/><span><strong>雨停之前</strong><small>更新于刚刚</small></span><button className="icon-button more-button" aria-label="更多项目操作"><Icon name="more"/></button></div>
        </aside>
        <section className="stage-column" aria-label="分镜舞台">
          <div className="stage-toolbar"><div className="stage-label"><span className="record-dot"/>镜头 01 <span className="toolbar-divider"/> 站台 · 等待</div><div className="tool-group"><button className="icon-button" aria-label="撤销"><Icon name="undo"/></button><button className="icon-button disabled-tool" aria-label="重做"><Icon name="redo"/></button><span className="toolbar-divider"/><button className="zoom-button"><Icon name="zoom"/> 68%</button><button className="icon-button" aria-label="更多舞台工具"><Icon name="more"/></button></div></div>
          <div className="stage-wrap"><div className="stage-canvas"><canvas ref={canvasRef} aria-label="雨夜车站分镜画面"/><div className="safe-frame"/><span className="canvas-note">FRAME 01 <span>·</span> 1920 × 1080</span><span className="focus-marker"><i/></span></div></div>
          <div className="stage-footer"><span><i className="keyboard-key">V</i> 选择工具</span><span><i className="keyboard-key">Space</i> 平移画布</span><span className="footer-spacer"/><button className="timeline-toggle"><Icon name="film"/>时间轴 <span>⌄</span></button></div>
          <div className="timeline"><div className="timeline-ruler"><span>00:00</span><span>00:01</span><span>00:02</span><span>00:03</span><span>00:04</span></div><div className="timeline-track"><span className="playhead"/><span className="clip-block"><i/>站台 · 等待 <small>04:00</small></span><span className="track-end">+</span></div></div>
        </section>
        <aside className="right-panel"><div className="right-tabs" role="tablist" aria-label="工作面板"><button className={tab === "intent" ? "selected-tab" : ""} onClick={() => setTab("intent")} role="tab" aria-selected={tab === "intent"}>创作意图</button><button className={tab === "assistant" ? "selected-tab" : ""} onClick={() => setTab("assistant")} role="tab" aria-selected={tab === "assistant"}><Icon name="spark"/> AI 协作</button></div>
          {tab === "intent" ? <div className="intent-panel"><div className="intent-heading"><span className="panel-eyebrow">SHOT DIRECTION</span><h2>这一镜想表达什么？</h2><p>让评审和生成都围绕你的叙事目标展开。</p></div><label className="field-label" htmlFor="intent">导演意图</label><textarea id="intent" value={intent} onChange={(event) => setIntent(event.target.value)}/><div className="field-row"><label><span className="field-label">镜头类型</span><button className="select-field">中景 <span>⌄</span></button></label><label><span className="field-label">镜头时长</span><button className="select-field">4 秒 <span>⌄</span></button></label></div><div className="field-group"><span className="field-label">情绪基调</span><div className="mood-tags"><button className="mood-tag active-mood">克制</button><button className="mood-tag">孤独</button><button className="mood-tag">期待</button><button className="mood-add" aria-label="添加情绪标签"><Icon name="plus"/></button></div></div><div className="field-group"><span className="field-label">不可改变</span><div className="constraint-box"><span className="lock-symbol">◇</span><span>人物保持沉默，不添加额外角色</span><button aria-label="编辑不可改变约束"><Icon name="more"/></button></div></div><div className="context-note"><span className="note-line"/><p>这些上下文会随画面一同交给 AI，帮助它理解<strong>叙事意图</strong>，而不只看像素。</p></div><button className="review-button"><Icon name="spark"/>评审这一镜 <span>→</span></button><div className="mode-caption"><span className="mode-dot"/>演示模式 <span>·</span> AI 评审尚未运行</div></div> : <div className="assistant-empty"><span className="assistant-icon"><Icon name="spark"/></span><h2>先听听 AI 怎么看</h2><p>运行一次镜头评审后，建议会出现在这里。你可以选择要采纳的方向，再生成独立候选稿。</p><button onClick={() => setTab("intent")}>返回创作意图 <Icon name="arrow"/></button></div>}
          <div className="right-bottom"><span className="help-mark">?</span><span>工作流指南</span><span className="footer-spacer"/><span className="shortcut-label">⌘ Enter 运行评审</span></div>
        </aside>
      </div>
    </main>
  );
}

export default App;
