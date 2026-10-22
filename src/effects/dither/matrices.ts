/** Ordered Bayer matrices, row-major, threshold index 0 … n²−1. */
export const bayer2 = [0, 2, 3, 1] as const;

export const bayer4 = [
  0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5,
] as const;

export const bayer8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60,
  28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47,
  7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
] as const;

const matrices = { 2: bayer2, 4: bayer4, 8: bayer8 } as const;

export function bayerValue(order: 2 | 4 | 8, x: number, y: number): number {
  const matrix = matrices[order];
  const mask = order - 1;
  return matrix[(y & mask) * order + (x & mask)] ?? 0;
}

export function bayerLimit(order: 2 | 4 | 8, x: number, y: number): number {
  return (bayerValue(order, x, y) + 0.5) / (order * order);
}
