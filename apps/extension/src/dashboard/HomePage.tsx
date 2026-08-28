import { useEffect, useState } from "preact/hooks";
import type { LiteratureApiClient } from "../api/client";
import type { FeedbackAction, FeedbackResponse, Grade, LatestReport, PaperView } from "../api/types";
import { GradeSection } from "../components/GradeSection";

interface HomePageProps {
  api: Pick<LiteratureApiClient, "getLatestReport" | "getPapers" | "sendFeedback">;
}

type PapersByGrade = Record<Grade, PaperView[]>;

const EMPTY: PapersByGrade = { A: [], B: [], C: [], D: [] };

export function HomePage({ api }: HomePageProps) {
  const [report, setReport] = useState<LatestReport | null>(null);
  const [papers, setPapers] = useState<PapersByGrade>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showD, setShowD] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [latest, a, b, c, d] = await Promise.all([
          api.getLatestReport(),
          api.getPapers({ grade: "A", state: "active" }),
          api.getPapers({ grade: "B", state: "active" }),
          api.getPapers({ grade: "C", state: "active" }),
          api.getPapers({ grade: "D", state: "active" })
        ]);
        if (!active) return;
        setReport(latest);
        setPapers({ A: a.items, B: b.items, C: c.items, D: d.items });
        setError(null);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Could not load your literature report.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [api]);

  function hidePaper(paperId: string) {
    setPapers(current => ({
      A: current.A.filter(item => item.paperId !== paperId),
      B: current.B.filter(item => item.paperId !== paperId),
      C: current.C.filter(item => item.paperId !== paperId),
      D: current.D.filter(item => item.paperId !== paperId)
    }));
  }

  const sendFeedback = (paperId: string, action: FeedbackAction): Promise<FeedbackResponse> => api.sendFeedback(paperId, action);
  const paperSummaries = report?.summary?.paperSummaries ?? {};

  if (loading) return <main class="dashboard-content"><p class="dashboard-status" role="status">Loading your literature report…</p></main>;
  if (error) return <main class="dashboard-content"><p class="dashboard-status error" role="alert">{error}</p></main>;

  return (
    <main class="dashboard-content">
      <section class="dashboard-hero">
        <div>
          <p class="eyebrow">YOUR LITERATURE FEED</p>
          <h1>Latest report</h1>
          <p class="dashboard-subtitle">Priority first. Every grade includes the reason it was ranked there.</p>
        </div>
        {report ? (
          <div class="hero-stats" aria-label="Latest report summary">
            <span><strong>{report.gradeCounts.A}</strong>A</span>
            <span><strong>{report.gradeCounts.B}</strong>B</span>
            <span><strong>{report.gradeCounts.C}</strong>C</span>
            <span><strong>{report.gradeCounts.D}</strong>D</span>
          </div>
        ) : null}
      </section>

      {report?.summary ? (
        <section class="weekly-summary-card" aria-labelledby="weekly-summary-heading">
          <div class="weekly-summary-heading-row">
            <div>
              <p class="grade-kicker">WEEKLY DIGEST</p>
              <h2 id="weekly-summary-heading">This week in brief</h2>
            </div>
            <span class="summary-mode">Local summary</span>
          </div>
          <p class="weekly-summary-text">{report.summary.brief}</p>
          {report.summary.keyThemes.length ? (
            <div class="theme-list" aria-label="Key themes">
              {report.summary.keyThemes.map(theme => <span key={theme}>{theme}</span>)}
            </div>
          ) : null}
        </section>
      ) : null}

      <GradeSection grade="A" papers={papers.A} paperSummaries={paperSummaries} sendFeedback={sendFeedback} onHidden={hidePaper} />
      <GradeSection grade="B" papers={papers.B} paperSummaries={paperSummaries} sendFeedback={sendFeedback} onHidden={hidePaper} />
      <GradeSection grade="C" papers={papers.C} sendFeedback={sendFeedback} onHidden={hidePaper} />
      <GradeSection
        grade="D"
        papers={papers.D}
        sendFeedback={sendFeedback}
        onHidden={hidePaper}
        collapsed={!showD}
        onToggle={() => setShowD(value => !value)}
      />
    </main>
  );
}
