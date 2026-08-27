import { render } from "preact";
import { createApiClient } from "../api/client";
import { getSession } from "../storage/session";
import { Dashboard } from "./Dashboard";
import "../styles/tokens.css";

function mountNode(): HTMLElement {
  const node = document.getElementById("app");
  if (!node) throw new Error("Dashboard mount node not found");
  return node;
}

const root = mountNode();

async function boot() {
  const session = await getSession();
  if (!session) {
    render(
      <main class="onboarding-placeholder">
        <p class="eyebrow">LITERATURE MONITOR</p>
        <h1>Set up your private literature profile</h1>
        <p>The guided setup and recovery screen arrives next. Your cloud backend is already ready.</p>
      </main>,
      root
    );
    return;
  }

  const api = createApiClient(session.apiBaseUrl, session.recoveryKey);
  render(<Dashboard api={api} />, root);
}

void boot();
