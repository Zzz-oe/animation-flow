import type { ReviewFinding, ReviewResult } from "./review";
import { HistoryList } from "./RevisionPanel";
import type { RevisionHistoryEntry } from "./revision";

export type ReviewStatus = "idle" | "loading" | "success" | "error";

type ReviewPanelProps = {
  status: ReviewStatus;
  result: ReviewResult | null;
  error: string;
  stale: boolean;
  activeFindingId: string | null;
  selectedFindingIds: string[];
  instruction: string;
  generationStatus: "idle" | "loading" | "error";
  generationError: string;
  history: RevisionHistoryEntry[];
  onSelectFinding: (finding: ReviewFinding) => void;
  onToggleFinding: (finding: ReviewFinding) => void;
  onInstructionChange: (value: string) => void;
  onGenerate: () => void;
  onRestore: (entry: RevisionHistoryEntry) => void;
  onRunReview: () => void;
  onBackToIntent: () => void;
};

const severityLabel = { high: "优先", medium: "建议", low: "精修" } as const;

export default function ReviewPanel({ status, result, error, stale, activeFindingId, selectedFindingIds, instruction, generationStatus, generationError, history, onSelectFinding, onToggleFinding, onInstructionChange, onGenerate, onRestore, onRunReview, onBackToIntent }: ReviewPanelProps) {
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
    {result.findings.length ? <div className="finding-list">{result.findings.map((finding, index) => <button className={`finding-card severity-${finding.severity} ${activeFindingId === finding.id ? "active-finding" : ""} ${selectedFindingIds.includes(finding.id) ? "selected-finding" : ""}`} key={finding.id} onClick={() => { onSelectFinding(finding); onToggleFinding(finding); }} aria-pressed={selectedFindingIds.includes(finding.id)}>
      <span className="finding-index">{selectedFindingIds.includes(finding.id) ? "✓" : String(index + 1).padStart(2, "0")}</span>
      <span className="finding-copy"><span className="finding-meta"><i>{severityLabel[finding.severity]}</i><em>{finding.category}</em></span><strong>{finding.title}</strong><small>{finding.evidence}</small><span className="finding-action"><b>建议</b>{finding.recommendation}</span><span className="finding-effect">预期：{finding.expectedEffect}</span></span>
    </button>)}</div> : <div className="review-no-findings"><strong>未发现需要修改的问题</strong><span>当前画面与创作意图一致，可以继续进入候选生成。</span></div>}
    <div className="revision-builder">
      <div className="revision-selection"><span>{selectedFindingIds.length} 项建议已选择</span><small>点击卡片选择或取消；AI 只修改确认范围。</small></div>
      <label htmlFor="revision-instruction">补充修改要求（可选）</label>
      <textarea id="revision-instruction" value={instruction} onChange={(event) => onInstructionChange(event.target.value)} placeholder="例如：保持人物大小，只调整位置；不要改变暖色灯箱。"/>
      {generationStatus === "error" && <div className="generation-error" role="alert"><strong>候选生成失败</strong><span>{generationError}</span><button onClick={onGenerate}>重试生成</button></div>}
      {generationStatus === "loading" ? <div className="generation-loading" role="status"><span className="review-orbit" aria-hidden="true"><i/><i/><i/></span><h2>正在生成隔离候选</h2><p>根据所选建议调整结构化场景；当前原稿保持不变。</p></div> : <button className="generate-revision" onClick={onGenerate} disabled={stale || selectedFindingIds.length === 0}>生成候选修正版 <span>→</span></button>}
    </div>
    <HistoryList history={history} onRestore={onRestore}/>
    <div className="review-footer"><span>点击建议可定位并选择</span><button onClick={onRunReview}>再次评审</button></div>
  </div>;
}
