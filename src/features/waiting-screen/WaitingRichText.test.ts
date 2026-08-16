import { describe, expect, it } from "vitest";
import { richTextPlainText, richTextStyleForMarks } from "./WaitingRichText";

describe("waiting rich text", () => {
  it("extracts text from strings and DGM rich-text documents", () => {
    expect(richTextPlainText("plain prompt")).toBe("plain prompt");
    expect(richTextPlainText({
      type: "doc",
      content: [{
        type: "paragraph",
        content: [
          { type: "text", text: "bold " },
          { type: "text", text: "prompt", marks: [{ type: "bold" }] },
        ],
      }],
    })).toBe("bold prompt");
  });

  it("maps the supported DGM marks to safe inline styles", () => {
    expect(richTextStyleForMarks([
      { type: "bold" },
      { type: "italic" },
      { type: "textStyle", attrs: { fontSize: "32px", color: "#123456" } },
    ])).toEqual({
      color: "#123456",
      fontSize: "32px",
      fontStyle: "italic",
      fontWeight: 700,
    });
    expect(richTextStyleForMarks(null)).toEqual({});
  });
});
