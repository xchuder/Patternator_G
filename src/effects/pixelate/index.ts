import { defaults, initialPixelate, type PixelateParams } from "../../data/defaults";
import type { ControlSpec, EffectModule } from "../types";
import { pixelateFragmentShader } from "./shader";

export type PixelateGpu = Record<string, never>;

export const pixelateEffect: EffectModule<"pixelate", PixelateParams, PixelateGpu> = {
  id: "pixelate",
  label: defaults.effects.pixelate.label,
  fragmentShader: pixelateFragmentShader,
  defaults: initialPixelate,
  controls(): readonly ControlSpec[] {
    const spec = defaults.effects.pixelate.blockSize;
    return [
      {
        key: "blockSize",
        label: spec.label,
        kind: "range",
        min: spec.min,
        max: spec.max,
        step: spec.step,
      },
    ];
  },
  withControl(params, key, value): PixelateParams {
    if (key === "blockSize") return { blockSize: Number(value) };
    return params;
  },
  createGpu(): PixelateGpu {
    return {};
  },
  syncGpu(): void {},
  bindGpu(gl, program, _gpu, params, draw): void {
    const image = gl.getUniformLocation(program, "uImage");
    const sourceSize = gl.getUniformLocation(program, "uSourceSize");
    const targetSize = gl.getUniformLocation(program, "uTargetSize");
    const block = gl.getUniformLocation(program, "uBlock");
    if (image) gl.uniform1i(image, 0);
    if (sourceSize) gl.uniform2f(sourceSize, draw.sourceWidth, draw.sourceHeight);
    if (targetSize) gl.uniform2f(targetSize, draw.targetWidth, draw.targetHeight);
    if (block) gl.uniform1f(block, params.blockSize);
  },
  releaseGpu(): void {},
  drawCpu(ctx, source, params, sourceWidth, _sourceHeight): void {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const scale = sourceWidth > 0 ? width / sourceWidth : 1;
    const block = Math.max(1, Math.round(params.blockSize * scale));
    const data = source.data;
    for (let y = 0; y < height; y += block) {
      for (let x = 0; x < width; x += block) {
        const cx = Math.min(width - 1, x + Math.floor(block / 2));
        const cy = Math.min(height - 1, y + Math.floor(block / 2));
        const index = (cy * width + cx) * 4;
        const red = data[index] ?? 0;
        const green = data[index + 1] ?? 0;
        const blue = data[index + 2] ?? 0;
        ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        ctx.fillRect(x, y, block, block);
      }
    }
  },
};
