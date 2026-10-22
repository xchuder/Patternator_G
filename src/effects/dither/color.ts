export function hexToBytes(hex: string, fallback: [number, number, number]): [number, number, number] {
  const raw = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return fallback;
  const value = Number.parseInt(raw, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function bytesToUnit(bytes: readonly [number, number, number]): [number, number, number] {
  return [bytes[0] / 255, bytes[1] / 255, bytes[2] / 255];
}
