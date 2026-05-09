import { render } from "preact";
import { findMatchingDomain } from "../shared/domain";
import { getSettings, onSettingsChange } from "../shared/storage";
import { Root } from "./Root";

const HOST_ID = "scrulk-root";

let mountedFor: string | null = null;
let shadowRoot: ShadowRoot | null = null;

async function evaluate(): Promise<void> {
  const { trackedSites } = await getSettings();
  const matched = findMatchingDomain(location.hostname, trackedSites);
  if (matched && matched !== mountedFor) {
    mount(matched);
  } else if (!matched && mountedFor) {
    unmount();
  }
}

function mount(matchedDomain: string): void {
  if (!shadowRoot) {
    const host = document.createElement("div");
    host.id = HOST_ID;
    // Pin to top layer of the page; never participate in layout. Children
    // opt in to pointer events individually (clock pill: yes; breaktime
    // backdrop: yes; everything else inert).
    host.style.cssText =
      "all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;";
    document.documentElement.appendChild(host);
    shadowRoot = host.attachShadow({ mode: "open" });
  }
  mountedFor = matchedDomain;
  render(<Root matchedDomain={matchedDomain} />, shadowRoot);
}

function unmount(): void {
  mountedFor = null;
  if (shadowRoot) render(null, shadowRoot);
}

void evaluate();
onSettingsChange(() => {
  void evaluate();
});
