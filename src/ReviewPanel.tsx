import type { ReviewFinding, ReviewResult } from "./review";
import type { CandidateRevision } from "./revision";

export type ReviewStatus = "idle" | "loading" | "success" | "error";

type ReviewPanelProps = {
  status: ReviewStatus;
  result: ReviewResult | null;
  error: string;
  stale: boolean;
  activeFindingId: string | null;
  onSelectFinding: (finding: ReviewFinding) => void;
  onRunReview: () => void;
  onBackToIntent: () => void;
  selectedFindingIds: string[];
  onToggleFinding: (id: string) => void;
  additionalInstruction: string;
  onInstructionChange: (value: string) => void;
  generationStatus: "idle" | "loading" | "error";
  generationError: string;
  candidate: CandidateRevision | null;
  previewMode: "original" | "candidate";
  onPreviewModeChange: (mode: "original" | "candidate") => void;
  onGenerate: () => void;
  onAccept: () => void;
  onReject: () => void;
  onRestore: () => void;
  canRestore: boolean;
  history: Array<{ id: string; label: string; detail: string }>;
};

const severityLabel = { high: "优先", medium: "建议", low: "精修" } as const;

export default function ReviewPanel({ status, result, error, stale, activeFindingId, onSelectFinding, onRunReview, onBackToIntent, selectedFindingIds, onToggleFinding, additionalInstruction, onInstructionChange, generationStatus, generationError, candidate, previewMode, onPreviewModeChange, onGenerate, onAccept, onReject, onRestore, canRestore, history }: ReviewPanelProps) {
  if (status === "idle") return <div className="assistant-empty review-empty"><span className="assistant-icon" aria-hidden="true">✦</span><h2>先听听 AI 怎么看</h2><p>评审会读取画面快照、对象关系和导演意图，给出可定位、可执行的建议。</p><button onClick={onBackToIntent}>返回创作意图 <span aria-hidden="true">→</span></button></div>;

  if (status === "loading") return <div className="review-loading" role="status" aria-live="polite"><span className="review-orbit" aria-hidden="true"><i/><i/><i/></span><span className="panel-eyebrow">MOCK REVIEW</span><h2>正在读这一镜</h2><p>分析叙事主体、构图层级、情绪氛围与不可改变约束…</p><div className="review-loading-steps"><span className="done">画面快照</span><span className="active">场景关系</span><span>结构化建议</span></div></div>;

  if (status === "error") return <div className="review-error" role="alert"><span className="review-error-mark">!</span><span className="panel-eyebrow">REVIEW INTERRUPTED</span><h2>这次评审没有完成</h2><p>{error || "评审服务暂时不可用。原稿和编辑记录没有受到影响。"}</p><div className="review-error-actions"><button className="review-retry" onClick={onRunReview}>重新评审</button><button onClick={onBackToIntent}>检查创作意图</button></div></div>;

  if (!result) return null;

  return <div className="review-panel">
    <div className="review-summary">
      <div className="score-ring" aria-label={`综合评分 ${result.overallScore} 分`}><strong>{result.overallScore}</strong><small>/ 100</small></div>
      <div><div className="review-kicker"><span>镜头评审</span><i>MOCK</i></div><p>{result.summary}</p></div>
    </div>
    {stale && <div className="stale-review" role="status"><strong>画面已改变</strong><span>下方结论对应上一次评审。重新运行可避免根据旧画面做决定。</span><button onClick={onRunReview}>重新评审</button></div>}
    <div className="dimension-grid" aria-label="评审维度">
      {result.dimensions.map((dimension) => <div className="dimension-row" key={dimension.name} title={dimension.observation}><span>{dimension.name}</span><div><i style={{ width: `${dimension.score}%` }}/></div><strong>{dimension.score}</strong></div>)}
    </div>
    <div className="findings-heading"><div><span className="panel-eyebrow">ACTIONABLE NOTES</span><h3>可执行建议</h3></div><span>{result.findings.length} 项</span></div>
    {result.findings.length ? <div className="finding-list">{result.findings.map((finding, index) => <div className={`finding-card severity-${finding.severity} ${activeFindingId === finding.id ? "active-finding" : ""}`} key={finding.id} onClick={() => onSelectFinding(finding)}>
      <span className="finding-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="finding-copy"><span className="finding-meta"><i>{severityLabel[finding.severity]}</i><em>{finding.category}</em><label className="finding-select" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedFindingIds.includes(finding.id)} onChange={() => onToggleFinding(finding.id)}/>执行</label></span><strong>{finding.title}</strong><small>{finding.evidence}</small><span className="finding-action"><b>建议</b>{finding.recommendation}</span><span className="finding-effect">预期：{finding.expectedEffect}</span></span>
    </div>)}</div> : <div className="review-no-findings"><strong>未发现需要修改的问题</strong><span>当前画面与创作意图一致，可以继续进入候选生成。</span></div>}
    {!stale && <section className="revision-workflow" aria-label="候选修正">
      <div className="revision-heading"><div><span className="panel-eyebrow">HUMAN APPROVAL</span><h3>确认修改范围</h3></div><span>{selectedFindingIds.length} 项已选</span></div>
      <label className="revision-instruction"><span>补充指令（可选）</span><textarea value={additionalInstruction} onChange={(event) => onInstructionChange(event.target.value)} placeholder="例如：人物位置只做轻微调整，保留当前留白。"/></label>
      <div className="protection-note"><b>保护项</b><span>人物保持沉默 · 不增加角色 · 未选建议对应区域保持不变</span></div>
      {generationError && <div className="generation-error" role="alert">{generationError}</div>}
      {!candidate ? <button className="generate-button" onClick={onGenerate} disabled={!selectedFindingIds.length || generationStatus === "loading"}>{generationStatus === "loading" ? "正在生成隔离候选…" : "生成候选修正版"}<span>→</span></button> : <div className="candidate-card">
        <div className="candidate-title"><div><strong>候选修正版</strong><small>MOCK · 尚未应用到原稿</small></div><span>{candidate.changes.length} 处变化</span></div>
        <div className="compare-toggle"><button className={previewMode === "original" ? "active" : ""} onClick={() => onPreviewModeChange("original")}>原稿</button><button className={previewMode === "candidate" ? "active" : ""} onClick={() => onPreviewModeChange("candidate")}>候选</button></div>
        <ul>{candidate.changes.map((change) => <li key={`${change.layerId}-${change.summary}`}><b>{change.layerName}</b>{change.summary}</li>)}</ul>
        <details><summary>查看生成依据</summary><p>{candidate.promptSummary}</p></details>
        <div className="candidate-actions"><button className="reject-button" onClick={onReject}>拒绝候选</button><button className="accept-button" onClick={onAccept}>接受并应用</button></div>
      </div>}
    </section>}
    {(history.length > 0 || canRestore) && <section className="revision-history"><div className="revision-heading"><div><span className="panel-eyebrow">DECISION LOG</span><h3>协作历史</h3></div>{canRestore && <button onClick={onRestore}>恢复接受前版本</button>}</div><ol>{history.slice(0, 5).map((item) => <li key={item.id}><i/><span><b>{item.label}</b><small>{item.detail}</small></span></li>)}</ol></section>}
    <div className="review-footer"><span>建议由你选择，候选不会自动覆盖原稿</span><button onClick={onRunReview}>再次评审</button></div>
  </div>;
}
