import { useState } from "preact/hooks";
import { Nav, type Page } from "./components/Nav";
import { Home } from "./pages/Home";
import { Calendar } from "./pages/Calendar";
import { Settings } from "./pages/Settings";

export function App() {
  const [page, setPage] = useState<Page>("home");

  return (
    <div class="layout">
      <header>
        <h1>Scroll Unlock</h1>
        <p>Notice and reduce time on tracked websites.</p>
      </header>

      <Nav page={page} onChange={setPage} />

      <main>
        {page === "home" && <Home />}
        {page === "calendar" && <Calendar />}
        {page === "settings" && <Settings />}
      </main>
    </div>
  );
}
