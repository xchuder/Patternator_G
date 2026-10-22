/** Primary glyph face, then the symbol fallback, then a generic mono. */
export const glyphFontStack = [
  "JetBrains Mono",
  "Noto Sans Symbols 2",
  "monospace",
] as const;

const genericFamilies = new Set([
  "monospace",
  "sans-serif",
  "serif",
  "system-ui",
  "ui-monospace",
]);

export function formatFontStack(stack: readonly string[]): string {
  return stack
    .map((name) => (genericFamilies.has(name) ? name : `"${name}"`))
    .join(", ");
}
