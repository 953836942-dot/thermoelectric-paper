import { useState } from "preact/hooks";
import type { FeedbackAction, FeedbackResponse, PaperView } from "../api/types";

export interface PaperCardProps {
  paper: PaperView;
  summary?: string;
  sendFeedback: (paperId: string, action: FeedbackAction) => Promise<FeedbackResponse>;
  onHidden?: (paperId: string) => void;
}

const ACTIONS: Array<{ action: Exclude<FeedbackAction, "clear">; label: string; symbol: string }> = [
  { action: "must_read", label: "Must read", symbol: "★" },
  { action: "read_later", label: "Read later", symbol: "▤" },
  { action: "not_relevant", label: "Not relevant", symbol: "−" },
  { action: "done", label: "Done", symbol: "✓" }
];

export function PaperCard({ paper, summary, sendFeedback, onHidden }: PaperCardProps) {
  const [feedback, setFeedback] = useState<PaperView["feedbackState"]>(paper.feedbackState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function applyFeedback(action: Exclude<FeedbackAction, "clear">) {
    if (saving) return;
    const previous = feedback;
    const requestAction: FeedbackAction = feedback === action ? "clear" : action;
    const optimistic = requestAction === "clear" ? null : action;
    setFeedback(optimistic);
    setSaving(true);
    setError(null);
    try {
      const response = await sendFeedback(paper.paperId, requestAction);
      setFeedback(response.feedbackState);
      if (response.hidden) onHidden?.(paper.paperId);
    } catch {
      setFeedback(previous);
      setError("Could not save this paper action. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const meta = [paper.venue, paper.publicationDate].filter(Boolean).join(" · ") || "Publication details unavailable";
  const authors = paper.authors.map(author => author.name).filter(Boolean).join(", ") || "Authors unavailable";

  return (
    <article class={`dashboard-paper-card dashboard-grade-${paper.grade.toLowerCase()}`}>
      <div class="paper-card-grade" aria-label={`Grade ${paper.grade}`}>{paper.grade}</div>
      <div class="paper-card-body">
        <div class="paper-card-title-row">
          <div>
            {paper.url ? (
              <a class="dashboard-paper-title" href={paper.url} target="_blank" rel="noreferrer">{paper.title}</a>
            ) : (
              <strong class="dashboard-paper-title">{paper.title}</strong>
            )}
            <p class="dashboard-paper-meta">{meta}</p>
            <p class="dashboard-paper-authors">{authors}</p>
          </div>
          <span class="score-pill">Score {Math.round(paper.score)}</span>
        </div>

        {summary ? (
          <div class="paper-summary">
            <span class="paper-summary-label">Quick summary</span>
            <p>{summary}</p>
          </div>
        ) : null}

        <div class="reason-list" aria-label="Why this paper was ranked here">
          {paper.reasons.slice(0, 3).map(reason => <span key={reason}>{reason}</span>)}
        </div>

        <div class="feedback-bar" aria-label="Paper actions">
          {ACTIONS.map(item => (
            <button
              key={item.action}
              type="button"
              class={feedback === item.action ? "feedback-button active" : "feedback-button"}
              aria-label={item.label}
              aria-pressed={feedback === item.action ? "true" : "false"}
              disabled={saving}
              onClick={() => void applyFeedback(item.action)}
            >
              <span aria-hidden="true">{item.symbol}</span> {item.label}
            </button>
          ))}
        </div>
        {error ? <p class="inline-error" role="alert">{error}</p> : null}
      </div>
    </article>
  );
}
