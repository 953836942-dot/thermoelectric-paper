import { useEffect, useState } from "preact/hooks";
import type { LiteratureApiClient } from "../api/client";
import { ApiClientError } from "../api/client";
import type { LatestReport } from "../api/types";
import { GradeBadge } from "../components/GradeBadge";
import { RunStatus } from "../components/RunStatus";

interface PopupProps {
  api: Pick<LiteratureApiClient, "getLatestReport" | "searchNow">;
  openDashboard: () => void | Promise<void>;
}

function formatMoment(value: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError && error.status === 429) {
    const body = error.body as { retry_after_seconds?: unknown } | null;
    const seconds = Number(body?.retry_after_seconds);
    return Number.isFinite(seconds) && seconds > 0
      ? `Search cooldown: try again in ${Math.ceil(seconds)}s.`
      : "Search cooldown: please try again shortly.";
  }
  if (error instanceof ApiClientError && error.status === 404) return "No report yet. Run your first search.";
  return error instanceof Error ? error.message : "Could not update literature report.";
}

export function Popup({ api, openDashboard }: PopupProps) {
  const [report, setReport] = useState<LatestReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const next = await api.getLatestReport();
      setReport(next);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function runSearch() {
    if (searching) return;
    setSearching(true);
    setError(null);
    try {
      await api.searchNow();
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSearching(false);
    }
  }

  return (
    <main class="popup-shell">
      <header class="popup-header">
        <div>
          <p class="eyebrow">PERSONAL LITERATURE MONITOR</p>
          <h1>This week</h1>
        </div>
        <button class="icon-button" type="button" aria-label="Open full report" onClick={() => void openDashboard()}>↗</button>
      </header>

      {loading && !report ? <p class="muted" role="status">Loading report…</p> : null}

      {report ? (
        <>
          <section class="schedule-card" aria-label="Update schedule">
            <div>
              <span class="meta-label">Last updated</span>
              <strong>{formatMoment(report.lastSuccessfulUpdate)}</strong>
            </div>
            <div class="align-right">
              <span class="meta-label">Next auto update</span>
              <strong>{formatMoment(report.nextRunAt)}</strong>
            </div>
          </section>

          <section class="grade-grid" aria-label="Literature grades">
            <GradeBadge grade="A" count={report.gradeCounts.A} />
            <GradeBadge grade="B" count={report.gradeCounts.B} />
            <GradeBadge grade="C" count={report.gradeCounts.C} />
            <GradeBadge grade="D" count={report.gradeCounts.D} />
          </section>

          <section class="top-section">
            <div class="section-heading">
              <h2>Top papers</h2>
              <span>A · Must read</span>
            </div>
            <div class="paper-list">
              {report.topPapers.slice(0, 3).map(item => (
                <article class="paper-row" data-testid="top-paper" key={item.paperId}>
                  <div class="paper-grade" aria-label="Grade A">A</div>
                  <div class="paper-copy">
                    {item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a> : <strong>{item.title}</strong>}
                    <p>{[item.venue, item.publicationDate].filter(Boolean).join(" · ") || "Publication details unavailable"}</p>
                  </div>
                </article>
              ))}
              {report.topPapers.length === 0 ? <p class="muted">No A-grade papers in the latest scan.</p> : null}
            </div>
          </section>
        </>
      ) : null}

      <RunStatus busy={searching} error={error} />

      <footer class="popup-actions">
        <button class="primary-button" type="button" onClick={() => void runSearch()} disabled={searching}>
          {searching ? "Searching…" : "Search now"}
        </button>
        <button class="secondary-button" type="button" onClick={() => void openDashboard()}>Open full report</button>
      </footer>
    </main>
  );
}
