export type Page = "home" | "waiting" | "settings" | "debug";

interface Props {
  page: Page;
  onChange: (page: Page) => void;
}

const PAGES: { id: Page; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "waiting", label: "Waiting" },
  { id: "settings", label: "Settings" },
  ...(__SCRULK_DEBUG__ ? [{ id: "debug" as const, label: "Debug" }] : []),
];

export function Nav({ page, onChange }: Props) {
  return (
    <nav>
      {PAGES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-current={page === id ? "page" : undefined}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
