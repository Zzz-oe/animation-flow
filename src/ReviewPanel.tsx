import type { ReviewFinding, ReviewResult } from "./review";

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
};

const severityLabel = { high: "优先", medium: "建议", low: "精修" } as const;

export default function ReviewPanel({ status, result, error, stale, activeFindingId, onSelectFinding, onRunReview, onBackToIntent }: ReviewPanelProps) {
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
    {result.findings.length ? <div className="finding-list">{result.findings.map((finding, index) => <button className={`finding-card severity-${finding.severity} ${activeFindingId === finding.id ? "active-finding" : ""}`} key={finding.id} onClick={() => onSelectFinding(finding)} aria-pressed={activeFindingId === finding.id}>
      <span className="finding-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="finding-copy"><span className="finding-meta"><i>{severityLabel[finding.severity]}</i><em>{finding.category}</em></span><strong>{finding.title}</strong><small>{finding.evidence}</small><span className="finding-action"><b>建议</b>{finding.recommendation}</span><span className="finding-effect">预期：{finding.expectedEffect}</span></span>
    </button>)}</div> : <div className="review-no-findings"><strong>未发现需要修改的问题</strong><span>当前画面与创作意图一致，可以继续进入候选生成。</span></div>}
    <div className="review-footer"><span>点击建议可在画布定位</span><button onClick={onRunReview} disabled={stale}>再次评审</button></div>
  </div>;
}
