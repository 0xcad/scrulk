import {
  FillStyle,
  HorzAlign,
  type Freehand,
  type Rectangle,
  type Shape,
  type ShapeProps,
  type Text,
} from "@dgmjs/core";
import type { WaitingToolId } from "./dgm";
import {
  paletteKinds,
  paletteTargets,
  type EditorPaletteDefaults,
  type PaletteKind,
} from "./editorPalette";

const TOOL_ITEMS: ReadonlyArray<{
  id: WaitingToolId;
  emoji: string;
  label: string;
}> = [
  { id: "Select", emoji: "👆", label: "Select" },
  { id: "Hand", emoji: "✊", label: "Hand" },
  { id: "Eraser", emoji: "🧼", label: "Eraser" },
  { id: "Rectangle", emoji: "█", label: "Rectangle" },
  { id: "Text", emoji: "🔤", label: "Text" },
  { id: "Image", emoji: "🖼️", label: "Image" },
  { id: "Freehand", emoji: "✏️", label: "Freehand" },
  { id: "Highlighter", emoji: "🟡", label: "Highlighter" },
];

interface ToolbarProps {
  activeTool: WaitingToolId;
  disabled: boolean;
  onActivate: (tool: WaitingToolId) => void;
}

export function WaitingEditorToolbar({ activeTool, disabled, onActivate }: ToolbarProps) {
  return (
    <div class="waiting-editor-toolbar" role="toolbar" aria-label="Waiting screen tools">
      {TOOL_ITEMS.map(({ id, emoji, label }) => (
        <button
          type="button"
          key={id}
          class="waiting-editor-tool"
          title={label}
          aria-label={label}
          aria-pressed={activeTool === id}
          disabled={disabled}
          onClick={() => onActivate(id)}
        >
          <span aria-hidden="true">{emoji}</span>
        </button>
      ))}
    </div>
  );
}

interface PaletteProps {
  activeTool: WaitingToolId;
  defaults: EditorPaletteDefaults;
  selections: Shape[];
  onChange: (kind: PaletteKind, props: ShapeProps) => void;
}

export function WaitingEditorPalette({
  activeTool,
  defaults,
  selections,
  onChange,
}: PaletteProps) {
  const kinds = paletteKinds(activeTool, selections);
  if (kinds.length === 0) return null;

  const selectedValue = (kind: PaletteKind) => paletteTargets(kind, selections)[0];
  const rectangle = selectedValue("rectangle") as Rectangle | undefined;
  const text = selectedValue("text") as Text | undefined;
  const freehand = selectedValue("freehand") as Freehand | undefined;

  return (
    <aside class="waiting-editor-palette" aria-label="Tool properties">
      {kinds.includes("rectangle") && (
        <fieldset>
          <legend>shape</legend>
          <div class="waiting-palette-button-row">
            <PaletteButton
              label="Empty fill"
              active={(rectangle?.fillStyle ?? defaults.rectangle.fillStyle) === FillStyle.NONE}
              onClick={() => onChange("rectangle", { fillStyle: FillStyle.NONE })}
            >
              empty
            </PaletteButton>
            <PaletteButton
              label="Solid fill"
              active={(rectangle?.fillStyle ?? defaults.rectangle.fillStyle) === FillStyle.SOLID}
              onClick={() => onChange("rectangle", { fillStyle: FillStyle.SOLID })}
            >
              fill
            </PaletteButton>
          </div>
          <ColorControl
            label="Background"
            value={rectangle?.fillColor ?? defaults.rectangle.fillColor}
            fallback={defaults.rectangle.fillColor}
            onChange={(fillColor) => onChange("rectangle", { fillColor })}
          />
        </fieldset>
      )}

      {kinds.includes("text") && (
        <fieldset>
          <legend>text</legend>
          <ColorControl
            label="Color"
            value={text?.fontColor ?? defaults.text.fontColor}
            fallback={defaults.text.fontColor}
            onChange={(fontColor) => onChange("text", { fontColor })}
          />
          <label class="waiting-palette-control">
            <span>font</span>
            <select
              value={fontOption(text?.fontFamily ?? defaults.text.fontFamily)}
              onChange={(event) => onChange("text", {
                fontFamily: (event.currentTarget as HTMLSelectElement).value,
              })}
            >
              <option value="monospace">monospace</option>
              <option value="serif">serif</option>
              <option value="sans-serif">sans</option>
            </select>
          </label>
          <div class="waiting-palette-button-row" aria-label="Text alignment">
            {([
              [HorzAlign.LEFT, "left", "L"],
              [HorzAlign.CENTER, "center", "C"],
              [HorzAlign.RIGHT, "right", "R"],
            ] as const).map(([alignment, label, glyph]) => (
              <PaletteButton
                key={alignment}
                label={`${label} align`}
                active={(text?.horzAlign ?? defaults.text.horzAlign) === alignment}
                onClick={() => onChange("text", { horzAlign: alignment })}
              >
                {glyph}
              </PaletteButton>
            ))}
          </div>
        </fieldset>
      )}

      {kinds.includes("freehand") && (
        <fieldset>
          <legend>freehand</legend>
          <ColorControl
            label="Stroke"
            value={freehand?.strokeColor ?? defaults.freehand.strokeColor}
            fallback={defaults.freehand.strokeColor}
            onChange={(strokeColor) => onChange("freehand", { strokeColor })}
          />
          <label class="waiting-palette-control waiting-palette-range">
            <span>width</span>
            <input
              type="range"
              min="1"
              max="32"
              step="1"
              value={freehand?.strokeWidth ?? defaults.freehand.strokeWidth}
              onInput={(event) => onChange("freehand", {
                strokeWidth: Number((event.currentTarget as HTMLInputElement).value),
              })}
            />
            <output>{freehand?.strokeWidth ?? defaults.freehand.strokeWidth}</output>
          </label>
        </fieldset>
      )}
    </aside>
  );
}

function PaletteButton({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean;
  children: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ColorControl({
  fallback,
  label,
  value,
  onChange,
}: {
  fallback: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label class="waiting-palette-control">
      <span>{label}</span>
      <input
        type="color"
        value={asInputColor(value, fallback)}
        onInput={(event) => onChange((event.currentTarget as HTMLInputElement).value)}
      />
    </label>
  );
}

function asInputColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function fontOption(value: string): string {
  if (value === "monospace" || value === "serif" || value === "sans-serif") return value;
  return "sans-serif";
}
