import { defaults } from "../data/defaults";

export type ImageLoadReason = "type" | "decode" | "too-large" | "empty";

export class ImageLoadError extends Error {
  readonly reason: ImageLoadReason;

  constructor(reason: ImageLoadReason) {
    super(reason);
    this.name = "ImageLoadError";
    this.reason = reason;
  }
}

export function isAcceptedImage(file: File): boolean {
  if (defaults.image.accept.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return defaults.image.extensions.some((extension) => name.endsWith(extension));
}

export async function decodeImage(file: File): Promise<ImageBitmap> {
  if (!isAcceptedImage(file)) throw new ImageLoadError("type");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageLoadError("decode");
  }
  if (bitmap.width < 1 || bitmap.height < 1) {
    bitmap.close();
    throw new ImageLoadError("empty");
  }
  const edge = defaults.image.maxDecodeEdge;
  if (bitmap.width > edge || bitmap.height > edge) {
    bitmap.close();
    throw new ImageLoadError("too-large");
  }
  return bitmap;
}
