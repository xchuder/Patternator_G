import { defaults } from "../../data/defaults";
import { fontCssForChar } from "../../data/glyph-coverage";
import { formatFontStack, glyphFontStack } from "../../data/typography";

const fallbackStack = formatFontStack(glyphFontStack);

export function loadGlyphFonts(): Promise<void> {
  return Promise.all([
    document.fonts.load('64px "JetBrains Mono"'),
    document.fonts.load('64px "Noto Sans Symbols 2"'),
    document.fonts.ready,
  ]).then(() => undefined);
}

export function glyphFontsReady(): boolean {
  return (
    document.fonts.check('16px "JetBrains Mono"') &&
    document.fonts.check('16px "Noto Sans Symbols 2"')
  );
}

export interface AtlasDraw {
  canvas: HTMLCanvasElement;
  cols: number;
  rows: number;
  count: number;
}

export function paintGlyph(
  ctx: CanvasRenderingContext2D,
  char: string,
  originX: number,
  originY: number,
  cell: number,
): void {
  if (char.trim() === "") return;
  const cssFamily = fontCssForChar(char, fallbackStack);
  const maxInk = cell * 0.82;
  let size = Math.floor(cell * 0.78);
  const applyFont = (px: number): void => {
    ctx.font = `${px}px ${cssFamily}`;
  };
  applyFont(size);
  let metrics = ctx.measureText(char);
  let inkW = metrics.width;
  let ascent = metrics.actualBoundingBoxAscent;
  let descent = metrics.actualBoundingBoxDescent;
  let inkH = ascent + descent;
  if (inkW > maxInk || inkH > maxInk) {
    const fit = Math.min(maxInk / Math.max(inkW, 1), maxInk / Math.max(inkH, 1));
    size = Math.max(1, Math.floor(size * fit));
    applyFont(size);
    metrics = ctx.measureText(char);
    inkW = metrics.width;
    ascent = metrics.actualBoundingBoxAscent;
    descent = metrics.actualBoundingBoxDescent;
    inkH = ascent + descent;
  }
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const x = originX + (cell - inkW) / 2;
  const y = originY + (cell - inkH) / 2 + ascent;
  ctx.fillText(char, x, y);
}

export function drawAtlas(charset: string): AtlasDraw {
  const cell = defaults.limits.atlasCell;
  const glyphs = [...charset];
  const count = Math.max(glyphs.length, 1);
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (ctx === null) throw new Error("Could not draw the glyph atlas");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  glyphs.forEach((char, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    paintGlyph(ctx, char, col * cell, row * cell, cell);
  });
  return { canvas, cols, rows, count: glyphs.length };
}
