import { fromMarkdown } from "mdast-util-from-markdown";
import type { Nodes, Parent, RootContent } from "mdast";
import type { ComponentChildren } from "preact";

interface Props {
  markdown: string;
}

export function MarkdownContent({ markdown }: Props) {
  const tree = fromMarkdown(markdown);
  return <>{renderChildren(tree, "root")}</>;
}

function renderChildren(parent: Parent, key: string): ComponentChildren {
  return parent.children.map((child, index) => renderNode(child, `${key}-${index}`));
}

function renderNode(node: RootContent, key: string): ComponentChildren {
  switch (node.type) {
    case "text": return node.value;
    case "paragraph": return <p key={key}>{renderChildren(node, key)}</p>;
    case "heading": {
      const Tag = `h${node.depth}` as keyof HTMLElementTagNameMap;
      return <Tag key={key}>{renderChildren(node, key)}</Tag>;
    }
    case "emphasis": return <em key={key}>{renderChildren(node, key)}</em>;
    case "strong": return <strong key={key}>{renderChildren(node, key)}</strong>;
    case "blockquote": return <blockquote key={key}>{renderChildren(node, key)}</blockquote>;
    case "list": {
      const Tag = node.ordered ? "ol" : "ul";
      return <Tag key={key} start={node.ordered ? node.start ?? undefined : undefined}>{renderChildren(node, key)}</Tag>;
    }
    case "listItem": return <li key={key}>{renderChildren(node, key)}</li>;
    case "inlineCode": return <code key={key}>{node.value}</code>;
    case "code": return <pre key={key}><code>{node.value}</code></pre>;
    case "break": return <br key={key} />;
    case "thematicBreak": return <hr key={key} />;
    // Links and images are deliberately flattened to non-interactive text.
    case "link": return <span key={key}>{renderChildren(node, key)}</span>;
    case "image": return node.alt ?? "";
    case "html": return node.value;
    default: return unsupportedNodeText(node);
  }
}

function unsupportedNodeText(node: Nodes): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node) {
    return node.children.map((child) => unsupportedNodeText(child)).join("");
  }
  return "";
}
