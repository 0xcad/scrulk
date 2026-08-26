import { useState } from "preact/hooks";
import { Nav, type Page } from "./components/Nav";
import { Home } from "./pages/Home";
import { Settings } from "./pages/Settings";
import { Debug } from "./pages/Debug";
import { WaitingEditor } from "../features/waiting-screen/WaitingEditor";
import { Focus } from "./pages/Focus";

export function App() {
  const [page, setPage] = useState<Page>("home");
  const [waitingDirty, setWaitingDirty] = useState(false);
  const changePage = (next: Page) => {
    if (next === page) return;
    if (page === "waiting" && waitingDirty && !window.confirm("Discard your unsaved waiting-screen changes?")) return;
    setPage(next);
  };

  return (
    <div class={`layout${page === "waiting" ? " layout--waiting" : ""}`}>
      <header>
        <h1 class="scrulk-page-title">Scroll Unlock</h1>
        <p class="scrulk-page-subtitle">What do you want to do with your time?</p>
      </header>

      <Nav page={page} onChange={changePage} />

      <main>
        {page === "home" && <Home />}
        {page === "waiting" && <WaitingEditor onDirtyChange={setWaitingDirty} />}
        {page === "settings" && <Settings />}
        {page === "focus" && <Focus />}
        {page === "debug" && __SCRULK_DEBUG__ && <Debug />}
      </main>
    </div>
  );
}
