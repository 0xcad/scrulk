import { Editor, defaultValueCtx, rootCtx } from "@milkdown/kit/core";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { useEffect, useRef } from "preact/hooks";
import "@milkdown/kit/prose/view/style/prosemirror.css";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onDone: () => void;
}

export function MarkdownEditor({ value, onChange, onDone }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let disposed = false;
    let editor: Editor | null = null;
    void Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, value);
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          onChangeRef.current(markdown);
        });
      })
      .use(commonmark)
      .use(history)
      .use(listener)
      .create()
      .then((created) => {
        if (disposed) created.destroy();
        else editor = created;
      });
    return () => {
      disposed = true;
      void editor?.destroy();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      class="waiting-markdown-editor"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onDone();
        }
      }}
    />
  );
}
