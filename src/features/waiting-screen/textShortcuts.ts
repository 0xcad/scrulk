import { InputRule, inputRulesPlugin, type Editor as TiptapEditor } from "@tiptap/core";

const HEADING_SCALES = [2, 1.5, 1.25] as const;

export function headingLevelForPrefix(prefix: string): 1 | 2 | 3 | null {
  if (prefix === "#") return 1;
  if (prefix === "##") return 2;
  if (prefix === "###") return 3;
  return null;
}

export function waitingHeadingFontSize(baseFontSize: number, level: 1 | 2 | 3): number {
  return baseFontSize * HEADING_SCALES[level - 1]!;
}

export function installWaitingHeadingShortcuts(
  editor: TiptapEditor,
  getBaseFontSize: () => number,
): () => void {
  const rule = new InputRule({
    find: /^(#{1,3})\s$/,
    handler: ({ state, range, match }) => {
      const level = headingLevelForPrefix(match[1] ?? "");
      const bold = state.schema.marks["bold"];
      const textStyle = state.schema.marks["textStyle"];
      if (!level || !bold || !textStyle) return null;
      state.tr
        .delete(range.from, range.to)
        .addStoredMark(bold.create())
        .addStoredMark(textStyle.create({
          fontSize: `${waitingHeadingFontSize(getBaseFontSize(), level)}px`,
        }));
    },
  });
  const plugin = inputRulesPlugin({ editor, rules: [rule] });
  editor.registerPlugin(plugin, (next, current) => [next, ...current]);

  const resetHeadingAfterEnter = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || !isHeadingActive(editor, getBaseFontSize())) return;
    queueMicrotask(() => {
      if (editor.isDestroyed) return;
      const bold = editor.state.schema.marks["bold"];
      const textStyle = editor.state.schema.marks["textStyle"];
      if (!bold || !textStyle) return;
      editor.view.dispatch(editor.state.tr
        .removeStoredMark(bold)
        .removeStoredMark(textStyle));
    });
  };
  editor.view.dom.addEventListener("keydown", resetHeadingAfterEnter);

  return () => {
    editor.view.dom.removeEventListener("keydown", resetHeadingAfterEnter);
    if (!editor.isDestroyed) {
      editor.unregisterPlugin((plugin as unknown as { key: string }).key);
    }
  };
}

function isHeadingActive(editor: TiptapEditor, baseFontSize: number): boolean {
  const fontSize = editor.getAttributes("textStyle")["fontSize"];
  return typeof fontSize === "string" && HEADING_SCALES.some(
    (scale) => fontSize === `${baseFontSize * scale}px`,
  );
}
