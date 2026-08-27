import type { FeedbackAction, FeedbackResponse, Grade, PaperView } from "../api/types";
import { PaperCard } from "./PaperCard";

const LABELS: Record<Grade, string> = {
  A: "Must read",
  B: "Strong match",
  C: "Related",
  D: "Filtered"
};

interface GradeSectionProps {
  grade: Grade;
  papers: PaperView[];
  sendFeedback: (paperId: string, action: FeedbackAction) => Promise<FeedbackResponse>;
  onHidden?: (paperId: string) => void;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function GradeSection({ grade, papers, sendFeedback, onHidden, collapsed = false, onToggle }: GradeSectionProps) {
  if (collapsed) {
    return (
      <section class="grade-section collapsed-grade">
        <button class="collapsed-grade-button" type="button" onClick={onToggle} aria-expanded="false">
          <span><strong>{grade}</strong> · {LABELS[grade]}</span>
          <span>Show filtered ({papers.length})</span>
        </button>
      </section>
    );
  }

  return (
    <section class="grade-section" aria-labelledby={`grade-${grade}`}>
      <div class="grade-section-heading">
        <div>
          <p class="grade-kicker">GRADE {grade}</p>
          <h2 id={`grade-${grade}`}>{grade} · {LABELS[grade]}</h2>
        </div>
        <span class="grade-count">{papers.length} paper{papers.length === 1 ? "" : "s"}</span>
      </div>
      <div class="dashboard-paper-list">
        {papers.map(paper => (
          <PaperCard key={paper.paperId} paper={paper} sendFeedback={sendFeedback} onHidden={onHidden} />
        ))}
        {papers.length === 0 ? <p class="empty-state">No active papers in this grade.</p> : null}
      </div>
      {grade === "D" && onToggle ? (
        <button class="text-button" type="button" onClick={onToggle} aria-expanded="true">Hide filtered papers</button>
      ) : null}
    </section>
  );
}
