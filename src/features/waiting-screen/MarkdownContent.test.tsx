import { describe, expect, it } from "vitest";
import { MarkdownContent } from "./MarkdownContent";

describe("waiting Markdown rendering", () => {
  it("renders prose formatting without interactive links, images, or HTML", () => {
    const output = MarkdownContent({
      markdown: "# Heading\n\n**bold** [label](https://example.com) ![alt](image.png) <button>unsafe</button>",
    });
    const tags = new Set<string>();
    const text: string[] = [];
    visit(output, tags, text);
    expect(tags).toContain("h1");
    expect(tags).toContain("strong");
    expect(tags).not.toContain("a");
    expect(tags).not.toContain("img");
    expect(tags).not.toContain("button");
    expect(text.join(" ")).toContain("label");
    expect(text.join(" ")).toContain("alt");
    expect(text.join(" ")).toContain("<button>");
    expect(text.join(" ")).toContain("unsafe");
    expect(text.join(" ")).toContain("</button>");
  });
});

function visit(value: unknown, tags: Set<string>, text: string[]): void {
  if (typeof value === "string") {
    text.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child) => visit(child, tags, text));
    return;
  }
  if (value === null || typeof value !== "object") return;
  const vnode = value as { type?: unknown; props?: { children?: unknown } };
  if (typeof vnode.type === "string") tags.add(vnode.type);
  visit(vnode.props?.children, tags, text);
}
