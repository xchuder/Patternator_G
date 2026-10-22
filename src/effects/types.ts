import type { EffectId } from "../data/defaults";

/**
 * One effect module behind this shape. Later phases add dither, halftone,
 * banding, mask, overlay, HUD, palette, and SVG as new modules — the pipeline
 * stays pre-filter, then the active effect. CPU-only effects (Floyd–Steinberg)
 * belong in src/workers and can implement drawCpu without a fragment shader.
 */
export interface DrawSize {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
}

export type ControlValue = number | boolean | string;

export interface ControlSpec {
  key: string;
  label: string;
  kind: "range" | "checkbox" | "text" | "color" | "segment";
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  options?: readonly { value: string; label: string }[];
  presets?: readonly { id: string; label: string; value: string }[];
  visibleWhen?: { key: string; equals: string };
}

export interface EffectModule<TId extends EffectId, TParams extends object, TGpu> {
  readonly id: TId;
  readonly label: string;
  readonly fragmentShader: string;
  defaults(): TParams;
  controls(): readonly ControlSpec[];
  withControl(params: TParams, key: string, value: ControlValue): TParams;
  createGpu(gl: WebGL2RenderingContext): TGpu;
  syncGpu(gl: WebGL2RenderingContext, gpu: TGpu, params: TParams): void;
  bindGpu(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    gpu: TGpu,
    params: TParams,
    draw: DrawSize,
  ): void;
  releaseGpu(gl: WebGL2RenderingContext, gpu: TGpu): void;
  drawCpu(
    ctx: CanvasRenderingContext2D,
    source: ImageData,
    params: TParams,
    sourceWidth: number,
    sourceHeight: number,
  ): void;
}
