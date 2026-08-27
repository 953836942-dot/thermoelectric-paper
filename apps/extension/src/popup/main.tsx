import { render } from "preact";
import { createLocalLiteratureClient } from "../local/client";
import { Popup } from "./Popup";
import "../styles/tokens.css";

interface RuntimeLike {
  openOptionsPage(): Promise<void> | void;
}

function runtime(): RuntimeLike {
  const value = (globalThis as typeof globalThis & { chrome?: { runtime?: RuntimeLike } }).chrome?.runtime;
  if (!value) throw new Error("Extension runtime is unavailable");
  return value;
}

const root = document.getElementById("app");
if (!root) throw new Error("Popup mount node not found");
const mount = root;
const api = createLocalLiteratureClient();
render(<Popup api={api} openDashboard={() => runtime().openOptionsPage()} />, mount);
