/**
 * Reads the cmap of the woff files referenced by src/fonts.css and writes
 * src/data/glyph-coverage.json. Run from the repo root after npm ci:
 *   node scripts/extract-glyph-coverage.mjs
 */
import fs from "node:fs";
import zlib from "node:zlib";

const faces = [
  {
    id: "jetbrains-mono",
    family: "JetBrains Mono",
    file: "jetbrains-mono-latin-400-normal.woff",
    path: "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff",
  },
  {
    id: "noto-sans-symbols-2",
    family: "Noto Sans Symbols 2",
    file: "noto-sans-symbols-2-symbols-400-normal.woff",
    path: "node_modules/@fontsource/noto-sans-symbols-2/files/noto-sans-symbols-2-symbols-400-normal.woff",
  },
];

function readWoffCmap(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString("ascii", 0, 4) !== "wOFF") {
    throw new Error(`Not a wOFF file: ${file}`);
  }
  const numTables = buf.readUInt16BE(12);
  let cmap = null;
  let offset = 44;
  for (let i = 0; i < numTables; i += 1) {
    const tag = buf.toString("ascii", offset, offset + 4);
    const tableOff = buf.readUInt32BE(offset + 4);
    const compLength = buf.readUInt32BE(offset + 8);
    const origLength = buf.readUInt32BE(offset + 12);
    offset += 20;
    if (tag !== "cmap") continue;
    const slice = buf.subarray(tableOff, tableOff + compLength);
    cmap = compLength < origLength ? zlib.inflateSync(slice) : slice;
  }
  if (cmap === null) throw new Error(`No cmap table in ${file}`);

  const points = new Set();
  const numEnc = cmap.readUInt16BE(2);
  for (let i = 0; i < numEnc; i += 1) {
    const rec = 4 + i * 8;
    const tableOffset = cmap.readUInt32BE(rec + 4);
    const format = cmap.readUInt16BE(tableOffset);
    if (format === 4) readFormat4(cmap, tableOffset, points);
    else if (format === 12) readFormat12(cmap, tableOffset, points);
  }
  return points;
}

function readFormat4(cmap, tableOffset, points) {
  const segCount = cmap.readUInt16BE(tableOffset + 6) / 2;
  const endBase = tableOffset + 14;
  const startBase = endBase + segCount * 2 + 2;
  const deltaBase = startBase + segCount * 2;
  const offsetBase = deltaBase + segCount * 2;
  for (let s = 0; s < segCount; s += 1) {
    const end = cmap.readUInt16BE(endBase + s * 2);
    const start = cmap.readUInt16BE(startBase + s * 2);
    const delta = cmap.readInt16BE(deltaBase + s * 2);
    const rangeOff = cmap.readUInt16BE(offsetBase + s * 2);
    if (start === 0xffff) continue;
    for (let code = start; code <= end; code += 1) {
      let glyph = 0;
      if (rangeOff === 0) glyph = (code + delta) & 0xffff;
      else {
        const glyphPos = offsetBase + s * 2 + rangeOff + (code - start) * 2;
        glyph = cmap.readUInt16BE(glyphPos);
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) points.add(code);
    }
  }
}

function readFormat12(cmap, tableOffset, points) {
  const groups = cmap.readUInt32BE(tableOffset + 12);
  let cursor = tableOffset + 16;
  for (let g = 0; g < groups; g += 1) {
    const start = cmap.readUInt32BE(cursor);
    const end = cmap.readUInt32BE(cursor + 4);
    const startGlyph = cmap.readUInt32BE(cursor + 8);
    cursor += 12;
    for (let code = start; code <= end; code += 1) {
      if (startGlyph + (code - start) !== 0) points.add(code);
    }
  }
}

function toRanges(points) {
  const sorted = [...points].sort((a, b) => a - b);
  const ranges = [];
  if (sorted.length === 0) return ranges;
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const code = sorted[i];
    if (code === prev + 1) {
      prev = code;
      continue;
    }
    ranges.push([start, prev]);
    start = code;
    prev = code;
  }
  ranges.push([start, prev]);
  return ranges;
}

const payload = {
  source:
    "cmap of the woff files loaded in src/fonts.css. Regenerate with scripts/extract-glyph-coverage.mjs.",
  faces: faces.map((face) => {
    const points = readWoffCmap(face.path);
    return {
      id: face.id,
      family: face.family,
      file: face.file,
      glyphCount: points.size,
      ranges: toRanges(points),
    };
  }),
};

fs.writeFileSync("src/data/glyph-coverage.json", `${JSON.stringify(payload, null, 2)}\n`);
for (const face of payload.faces) {
  console.log(`${face.id}: ${face.glyphCount} glyphs, ${face.ranges.length} ranges`);
}
