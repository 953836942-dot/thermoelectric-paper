import { useState } from "preact/hooks";
import type { LiteratureApiClient } from "../api/client";
import { HomePage } from "./HomePage";
import { ResearchPage } from "./ResearchPage";

interface DashboardProps {
  api: LiteratureApiClient;
}

type Page = "papers" | "research";

export function Dashboard({ api }: DashboardProps) {
  const [page, setPage] = useState<Page>("papers");

  return (
    <div class="dashboard-shell">
      <header class="dashboard-topbar">
        <div>
          <p class="eyebrow">LITERATURE MONITOR · B-LITE</p>
          <strong class="dashboard-brand">Personal paper digest</strong>
        </div>
        <nav class="dashboard-nav" aria-label="Dashboard sections">
          <button class={`nav-button ${page === "papers" ? "active" : ""}`} type="button" onClick={() => setPage("papers")}>Weekly papers</button>
          <button class={`nav-button ${page === "research" ? "active" : ""}`} type="button" onClick={() => setPage("research")}>Research settings</button>
        </nav>
      </header>
      {page === "papers" ? <HomePage api={api} /> : <ResearchPage api={api} />}
    </div>
  );
}
