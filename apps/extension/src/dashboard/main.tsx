import { render } from "preact";
import { createLocalLiteratureClient } from "../local/client";
import { Dashboard } from "./Dashboard";
import "../styles/tokens.css";

function mountNode(): HTMLElement {
  const node = document.getElementById("app");
  if (!node) throw new Error("Dashboard mount node not found");
  return node;
}

const api = createLocalLiteratureClient();
render(<Dashboard api={api} />, mountNode());
