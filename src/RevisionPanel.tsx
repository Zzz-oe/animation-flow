import type { CandidateRevision, RevisionHistoryEntry } from "./revision";

type Props = {
  candidate: CandidateRevision;
  view: "current" | "candidate";
  history: RevisionHistoryEntry[];
  onView: (view: "current" | "candidate") => void;
  onAccept: () => void;
  onReject: () => void;
  onRestore: (entry: RevisionHistoryEntry) => void;
};

const actionLabel = { accepted: "已接受候选", rejected: "已拒绝候选", restored: "已恢复原稿" } as const;

export function HistoryList({ history, onRestore }: { history: RevisionHistoryEntry[]; onRestore: (entry: RevisionHistoryEntry) => void }) {
  if (!history.length) return null;
  return <div className="revision-history"><div className="history-heading"><span className="panel-eyebrow">DECISION LOG</span><strong>AI 操作记录</strong></div>{history.slice(0, 4).map((entry) => <div className="history-row" key={entry.id}><span className={`history-dot ${entry.action}`}/><span><strong>{actionLabel[entry.action]}</strong><small>{entry.label}</small></span>{entry.action === "accepted" && entry.beforeLayers && <button onClick={() => onRestore(entry)}>恢复</button>}</div>)}</div>;
}

export default function RevisionPanel({ candidate, view, history, onView, onAccept, onReject, onRestore }: Props) {
  return <div className="revision-panel">
    <div className="revision-hero"><div><span className="panel-eyebrow">CANDIDATE REVISION · MOCK</span><h2>候选修正版已生成</h2><p>它与当前稿分离，接受前不会改动你的场景。</p></div><span className="candidate-badge">V2</span></div>
    <div className="compare-switch" aria-label="画面对比模式"><button className={view === "current" ? "active" : ""} onClick={() => onView("current")}>当前原稿</button><button className={view === "candidate" ? "active" : ""} onClick={() => onView("candidate")}>候选修正版</button></div>
    <div className="revision-prompt"><span>生成依据</span><p>{candidate.promptSummary}</p></div>
    <div className="change-heading"><div><span className="panel-eyebrow">SCOPED CHANGES</span><h3>变更明细</h3></div><span>{candidate.changes.length} 项</span></div>
    <div className="change-list">{candidate.changes.length ? candidate.changes.map((change, index) => <div className="change-row" key={`${change.layerId}-${change.property}`}><span className="change-index">{String(index + 1).padStart(2, "0")}</span><div><strong>{change.layerName} · {change.property}</strong><small>{change.before} → {change.after}</small><p>{change.reason}</p></div></div>) : <div className="no-change">所选建议没有产生结构化变更，请拒绝候选并调整选择。</div>}</div>
    <HistoryList history={history} onRestore={onRestore}/>
    <div className="revision-actions"><button className="reject-revision" onClick={onReject}>拒绝候选</button><button className="accept-revision" onClick={onAccept} disabled={!candidate.changes.length}>接受并应用 {candidate.changes.length} 项修改</button></div>
  </div>;
}
