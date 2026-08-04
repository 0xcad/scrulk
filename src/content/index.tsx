import { render } from "preact";
import { findMatchingDomain } from "../shared/domain";
import { getSettings, onSettingsChange } from "../shared/storage";
import { Root } from "./Root";

const HOST_ID = "scrulk-root";

let mountedFor: string | null | undefined = undefined;
let shadowRoot: ShadowRoot | null = null;

async function evaluate(): Promise<void> {
  const { trackedSites } = await getSettings();
  const matched = findMatchingDomain(location.hostname, trackedSites);
  if (matched !== mountedFor) {
    mount(matched);
  }
}

function mount(matched: string | null): void {
  if (!shadowRoot) {
    const host = document.createElement("div");
    host.id = HOST_ID;
    // Pin to top layer of the page; never participate in layout. Children
    // opt in to pointer events individually (clocks: yes; breaktime
    // backdrop: yes; everything else inert).
    host.style.cssText =
      "all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;";
    document.documentElement.appendChild(host);
    // The closed root prevents host-page scripts from reaching media objects
    // owned by extension overlays (notably CameraOverlay's remote stream).
    shadowRoot = host.attachShadow({ mode: "closed" });
  }
  mountedFor = matched;
  render(<Root matchedDomain={matched} />, shadowRoot);
}

void evaluate();
onSettingsChange(() => {
  void evaluate();
});
