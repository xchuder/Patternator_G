import { defaults } from "../../data/defaults";
import { coverageFaceNames, missingGlyphs } from "../../data/glyph-coverage";
import { missingGlyphMessage, studioCopy, truncatedMessage } from "../../data/studio-copy";

export function normalizeCharset(input: string, maxGlyphs: number): string {
  const seen = new Set<string>();
  let out = "";
  for (const char of input) {
    if (char === "\n" || char === "\r" || char === "\t") continue;
    if (seen.has(char)) continue;
    seen.add(char);
    out += char;
    if (out.length >= maxGlyphs) break;
  }
  return out;
}

export function charsetWarnings(raw: string): string[] {
  const maxGlyphs = defaults.limits.maxGlyphs;
  const normalized = normalizeCharset(raw, maxGlyphs);
  if (normalized.length === 0) return [studioCopy.emptyCharset];

  const messages: string[] = [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const char of raw) {
    if (char === "\n" || char === "\r" || char === "\t") continue;
    if (seen.has(char)) continue;
    seen.add(char);
    unique.push(char);
  }
  if (unique.length > maxGlyphs) messages.push(truncatedMessage(maxGlyphs));

  const missing = missingGlyphs(normalized);
  if (missing.length > 0) {
    messages.push(missingGlyphMessage(coverageFaceNames(), missing.join(" ")));
  }
  return messages;
}

export function glyphIndex(luma: number, count: number, invert: boolean): number {
  if (count <= 0) return 0;
  const value = invert ? 1 - luma : luma;
  const clamped = Math.min(1, Math.max(0, value));
  return Math.min(count - 1, Math.floor(clamped * count));
}

export function relativeLuma(red: number, green: number, blue: number): number {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}
