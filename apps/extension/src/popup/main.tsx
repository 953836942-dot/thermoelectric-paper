import { render } from "preact";
import { createApiClient } from "../api/client";
import { getSession } from "../storage/session";
import { Popup } from "./Popup";
import "../styles/tokens.css";

interface RuntimeLike {
  openOptionsPage(): Promise<void> | void;
}

function extensionRuntime(): RuntimeLike {
  const runtime = (globalThis as typeof globalThis & { chrome?: { runtime?: RuntimeLike } }).chrome?.runtime;
  if (!runtime) throw new Error("Extension runtime is unavailable");
  return runtime;
}

const root = document.getElementById("app");
if (!root) throw new Error("Popup mount node not found");

async function boot() {
  const session = await getSession();
  if (!session) {
    render(
      <main class="popup-shell setup-shell">
        <p class="eyebrow">PERSONAL LITERATURE MONITOR</p>
        <h1>Setup needed</h1>
        <p class="muted">Open the dashboard to create or restore your private literature profile.</p>
        <button class="primary-button" type="button" onClick={() => void extensionRuntime().openOptionsPage()}>Open setup</button>
      </main>,
      root
    );
    return;
  }

  const api = createApiClient(session.apiBaseUrl, session.recoveryKey);
  render(<Popup api={api} openDashboard={() => extensionRuntime().openOptionsPage()} />, root);
}

void boot();
