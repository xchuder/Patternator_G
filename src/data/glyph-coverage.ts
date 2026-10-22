import raw from "./glyph-coverage.json" with { type: "json" };

export interface GlyphFace {
  id: string;
  family: string;
  file: string;
  glyphCount: number;
  ranges: readonly (readonly number[])[];
}

export interface GlyphCoverage {
  source: string;
  faces: readonly GlyphFace[];
}

export const glyphCoverage: GlyphCoverage = raw;

export function faceCovers(face: GlyphFace, codePoint: number): boolean {
  const ranges = face.ranges;
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const range = ranges[mid];
    if (range === undefined) return false;
    const start = range[0];
    const end = range[1];
    if (start === undefined || end === undefined) return false;
    if (codePoint < start) hi = mid - 1;
    else if (codePoint > end) lo = mid + 1;
    else return true;
  }
  return false;
}

/** JetBrains Mono when the shipped file has the glyph, otherwise Noto, otherwise null. */
export function fontFamilyForCodePoint(codePoint: number): string | null {
  for (const face of glyphCoverage.faces) {
    if (faceCovers(face, codePoint)) return face.family;
  }
  return null;
}

export function fontCssForChar(char: string, fallbackStack: string): string {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) return fallbackStack;
  const family = fontFamilyForCodePoint(codePoint);
  return family === null ? fallbackStack : `"${family}"`;
}

export function missingGlyphs(charset: string): string[] {
  const missing: string[] = [];
  for (const char of charset) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) continue;
    if (fontFamilyForCodePoint(codePoint) === null) missing.push(char);
  }
  return missing;
}

export function coverageFaceNames(): string {
  return glyphCoverage.faces.map((face) => face.family).join(" or ");
}
