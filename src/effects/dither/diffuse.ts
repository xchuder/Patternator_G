import { defaults, bayerOrder, type DitherParams } from "../../data/defaults";
import { hexToBytes } from "./color";
import { bayerLimit } from "./matrices";

const lumaR = 0.2126;
const lumaG = 0.7152;
const lumaB = 0.0722;

export function cellCount(length: number, cell: number): number {
  return Math.max(1, Math.ceil(length / cell));
}

export function applyDither(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  params: DitherParams,
): Uint8ClampedArray {
  const cell = Math.max(1, Math.round(params.cellScale));
  const cols = cellCount(width, cell);
  const rows = cellCount(height, cell);
  const tone = boxLuma(pixels, width, height, cell, cols, rows);
  const order = bayerOrder(params.method);
  const cutoff = defaults.effects.dither.threshold;
  if (params.method === "floyd") diffuseFloyd(tone, cols, rows, cutoff);
  else if (params.method === "atkinson") diffuseAtkinson(tone, cols, rows, cutoff);
  else if (order === 2 || order === 4 || order === 8) quantizeBayer(tone, cols, rows, order);
  else quantizeThreshold(tone, cutoff);

  const dark = hexToBytes(params.colorA, [0, 0, 0]);
  const light = hexToBytes(params.colorB, [255, 255, 255]);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const row = Math.min(rows - 1, Math.floor(y / cell));
    for (let x = 0; x < width; x += 1) {
      const col = Math.min(cols - 1, Math.floor(x / cell));
      const on = (tone[row * cols + col] ?? 0) >= 0.5;
      const color = on ? light : dark;
      const index = (y * width + x) * 4;
      out[index] = color[0];
      out[index + 1] = color[1];
      out[index + 2] = color[2];
      out[index + 3] = 255;
    }
  }
  return out;
}

function boxLuma(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  cell: number,
  cols: number,
  rows: number,
): Float32Array {
  const sum = new Float64Array(cols * rows);
  const count = new Uint32Array(cols * rows);
  for (let y = 0; y < height; y += 1) {
    const row = Math.min(rows - 1, Math.floor(y / cell));
    for (let x = 0; x < width; x += 1) {
      const col = Math.min(cols - 1, Math.floor(x / cell));
      const cellIndex = row * cols + col;
      const pixel = (y * width + x) * 4;
      const red = pixels[pixel] ?? 0;
      const green = pixels[pixel + 1] ?? 0;
      const blue = pixels[pixel + 2] ?? 0;
      sum[cellIndex] = (sum[cellIndex] ?? 0) + (red * lumaR + green * lumaG + blue * lumaB) / 255;
      count[cellIndex] = (count[cellIndex] ?? 0) + 1;
    }
  }
  const tone = new Float32Array(cols * rows);
  for (let index = 0; index < tone.length; index += 1) {
    const samples = count[index] ?? 0;
    tone[index] = samples > 0 ? (sum[index] ?? 0) / samples : 0;
  }
  return tone;
}

function quantizeThreshold(tone: Float32Array, cutoff: number): void {
  for (let index = 0; index < tone.length; index += 1) {
    tone[index] = (tone[index] ?? 0) >= cutoff ? 1 : 0;
  }
}

function quantizeBayer(tone: Float32Array, cols: number, rows: number, order: 2 | 4 | 8): void {
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const index = y * cols + x;
      const limit = bayerLimit(order, x, y);
      tone[index] = (tone[index] ?? 0) >= limit ? 1 : 0;
    }
  }
}

function diffuseFloyd(tone: Float32Array, cols: number, rows: number, cutoff: number): void {
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const index = y * cols + x;
      const old = clamp01(tone[index] ?? 0);
      const next = old >= cutoff ? 1 : 0;
      tone[index] = next;
      const error = old - next;
      add(tone, cols, rows, x + 1, y, error * (7 / 16));
      add(tone, cols, rows, x - 1, y + 1, error * (3 / 16));
      add(tone, cols, rows, x, y + 1, error * (5 / 16));
      add(tone, cols, rows, x + 1, y + 1, error * (1 / 16));
    }
  }
}

function diffuseAtkinson(tone: Float32Array, cols: number, rows: number, cutoff: number): void {
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const index = y * cols + x;
      const old = clamp01(tone[index] ?? 0);
      const next = old >= cutoff ? 1 : 0;
      tone[index] = next;
      const share = (old - next) / 8;
      add(tone, cols, rows, x + 1, y, share);
      add(tone, cols, rows, x + 2, y, share);
      add(tone, cols, rows, x - 1, y + 1, share);
      add(tone, cols, rows, x, y + 1, share);
      add(tone, cols, rows, x + 1, y + 1, share);
      add(tone, cols, rows, x, y + 2, share);
    }
  }
}

function add(tone: Float32Array, cols: number, rows: number, x: number, y: number, amount: number): void {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return;
  const index = y * cols + x;
  tone[index] = (tone[index] ?? 0) + amount;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
