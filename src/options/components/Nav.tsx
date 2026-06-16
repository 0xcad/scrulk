export type Page = "home" | "settings";

interface Props {
  page: Page;
  onChange: (page: Page) => void;
}

const PAGES: { id: Page; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "settings", label: "Settings" },
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
