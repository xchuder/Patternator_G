import { defaults } from "../data/defaults";
import { effects } from "../effects/registry";
import { canvasToPng } from "../export/png";
import { applyPrefilter } from "./prefilter";
import type { FrameRequest, Renderer } from "./types";

export class CpuRenderer implements Renderer {
  readonly backend = "canvas2d" as const;
  readonly maxTextureSize = defaults.image.maxDecodeEdge;
  private readonly scratch: HTMLCanvasElement;
  private readonly scratchCtx: CanvasRenderingContext2D;
  private readonly viewCtx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const viewCtx = canvas.getContext("2d");
    this.scratch = document.createElement("canvas");
    const scratchCtx = this.scratch.getContext("2d", { willReadFrequently: true });
    if (viewCtx === null || scratchCtx === null) {
      throw new Error("Canvas2D is unavailable");
    }
    this.viewCtx = viewCtx;
    this.scratchCtx = scratchCtx;
  }

  setSource(_bitmap: ImageBitmap): void {}

  draw(bitmap: ImageBitmap, frame: FrameRequest): void {
    this.renderInto(this.canvas, this.viewCtx, bitmap, frame.width, frame.height, frame);
  }

  async exportPng(
    bitmap: ImageBitmap,
    frame: Omit<FrameRequest, "width" | "height">,
  ): Promise<Blob> {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("empty-png");
    this.renderInto(canvas, ctx, bitmap, bitmap.width, bitmap.height, {
      ...frame,
      width: bitmap.width,
      height: bitmap.height,
    });
    return canvasToPng(canvas);
  }

  dispose(): void {}

  private renderInto(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    bitmap: ImageBitmap,
    width: number,
    height: number,
    frame: FrameRequest,
  ): void {
    canvas.width = width;
    canvas.height = height;
    this.scratch.width = width;
    this.scratch.height = height;
    this.scratchCtx.imageSmoothingEnabled = true;
    this.scratchCtx.imageSmoothingQuality = "high";
    this.scratchCtx.clearRect(0, 0, width, height);
    this.scratchCtx.drawImage(bitmap, 0, 0, width, height);
    const image = this.scratchCtx.getImageData(0, 0, width, height);
    applyPrefilter(image, frame.prefilter);
    if (frame.effectId === "ascii") {
      effects.ascii.drawCpu(ctx, image, frame.ascii, bitmap.width, bitmap.height);
    } else if (frame.effectId === "dither") {
      effects.dither.drawCpu(ctx, image, frame.dither, bitmap.width, bitmap.height);
    } else {
      effects.pixelate.drawCpu(ctx, image, frame.pixelate, bitmap.width, bitmap.height);
    }
    canvas.dataset.effect = frame.effectId;
    const presented = Number(canvas.dataset.presented ?? "0") + 1;
    canvas.dataset.presented = String(presented);
  }
}
