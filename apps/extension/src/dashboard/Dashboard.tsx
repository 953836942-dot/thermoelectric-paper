import type { LiteratureApiClient } from "../api/client";
import { HomePage } from "./HomePage";

interface DashboardProps {
  api: LiteratureApiClient;
}

export function Dashboard({ api }: DashboardProps) {
  return (
    <div class="dashboard-shell">
      <header class="dashboard-topbar">
        <div>
          <p class="eyebrow">LITERATURE MONITOR</p>
          <strong class="dashboard-brand">Research dashboard</strong>
        </div>
        <nav class="dashboard-nav" aria-label="Dashboard sections">
          <button class="nav-button active" type="button">Home</button>
          <button class="nav-button" type="button" disabled>Research</button>
          <button class="nav-button" type="button" disabled>Researchers</button>
          <button class="nav-button" type="button" disabled>Settings</button>
        </nav>
      </header>
      <HomePage api={api} />
    </div>
  );
}
