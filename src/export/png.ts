export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error("empty-png"));
      else resolve(blob);
    }, "image/png");
  });
}

export function pixelsToPng(pixels: Uint8Array, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return Promise.reject(new Error("empty-png"));
  const image = ctx.createImageData(width, height);
  const row = width * 4;
  for (let y = 0; y < height; y += 1) {
    const source = (height - 1 - y) * row;
    image.data.set(pixels.subarray(source, source + row), y * row);
  }
  ctx.putImageData(image, 0, 0);
  return canvasToPng(canvas);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportFilename(originalName: string, effectId: string): string {
  const stripped = originalName.replace(/\.[^.]+$/, "");
  const safe = stripped.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  const base = safe.length > 0 ? safe.slice(0, 80) : "image";
  return `${base}-${effectId}.png`;
}
