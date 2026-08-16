import type { ComponentChildren, JSX } from "preact";

interface RichTextNode {
  type?: unknown;
  text?: unknown;
  content?: unknown;
  marks?: unknown;
}

interface RichTextMark {
  type?: unknown;
  attrs?: unknown;
}

export function WaitingRichText({ content }: { content: unknown }) {
  return <>{renderNode(content)}</>;
}

export function richTextPlainText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!isRecord(content)) return "";
  const node = content as RichTextNode;
  if (node.type === "text") return typeof node.text === "string" ? node.text : "";
  if (!Array.isArray(node.content)) return "";
  return node.content.map(richTextPlainText).join(node.type === "paragraph" ? "" : "");
}

export function richTextStyleForMarks(marks: unknown): JSX.CSSProperties {
  if (!Array.isArray(marks)) return {};
  const style: JSX.CSSProperties = {};
  for (const value of marks) {
    if (!isRecord(value)) continue;
    const mark = value as RichTextMark;
    if (mark.type === "bold") style.fontWeight = 700;
    if (mark.type === "italic") style.fontStyle = "italic";
    if (mark.type === "underline") style.textDecoration = "underline";
    if (mark.type !== "textStyle" || !isRecord(mark.attrs)) continue;
    const { color, fontFamily, fontSize, fontWeight } = mark.attrs;
    if (typeof color === "string") style.color = color;
    if (typeof fontFamily === "string") style.fontFamily = fontFamily;
    if (typeof fontSize === "string" || typeof fontSize === "number") {
      style.fontSize = fontSize;
    }
    if (typeof fontWeight === "string" || typeof fontWeight === "number") {
      style.fontWeight = fontWeight;
    }
  }
  return style;
}

function renderNode(value: unknown): ComponentChildren {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return null;
  const node = value as RichTextNode;
  if (node.type === "text") {
    const text = typeof node.text === "string" ? node.text : "";
    const style = richTextStyleForMarks(node.marks);
    return Object.keys(style).length > 0 ? <span style={style}>{text}</span> : text;
  }

  const children = Array.isArray(node.content)
    ? node.content.map((child) => renderNode(child))
    : null;
  if (node.type === "paragraph") return <p>{children}</p>;
  if (node.type === "hardBreak") return <br />;
  return children;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
