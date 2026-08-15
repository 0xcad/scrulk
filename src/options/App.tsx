import { useState } from "preact/hooks";
import { Nav, type Page } from "./components/Nav";
import { Home } from "./pages/Home";
import { Settings } from "./pages/Settings";
import { Debug } from "./pages/Debug";

export function App() {
  const [page, setPage] = useState<Page>("home");

  return (
    <div class="layout">
      <header>
        <h1 class="scrulk-page-title">Scroll Unlock</h1>
        <p class="scrulk-page-subtitle">What do you want to do with your time?</p>
      </header>

      <Nav page={page} onChange={setPage} />

      <main>
        {page === "home" && <Home />}
        {page === "settings" && <Settings />}
        {page === "debug" && __SCRULK_DEBUG__ && <Debug />}
      </main>
    </div>
  );
}
