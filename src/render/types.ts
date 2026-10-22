import type {
  AsciiParams,
  DitherParams,
  EffectId,
  PixelateParams,
  PrefilterParams,
} from "../data/defaults";

export interface FrameRequest {
  effectId: EffectId;
  prefilter: PrefilterParams;
  ascii: AsciiParams;
  pixelate: PixelateParams;
  dither: DitherParams;
  width: number;
  height: number;
}

export interface Renderer {
  readonly backend: "webgl2" | "canvas2d";
  readonly maxTextureSize: number;
  setSource(bitmap: ImageBitmap): void;
  draw(bitmap: ImageBitmap, frame: FrameRequest): void;
  exportPng(bitmap: ImageBitmap, frame: Omit<FrameRequest, "width" | "height">): Promise<Blob>;
  dispose(): void;
}
