import {
  bayerOrder,
  defaults,
  initialDither,
  isDitherMethod,
  type DitherParams,
} from "../../data/defaults";
import type { ControlSpec, EffectModule } from "../types";
import { bytesToUnit, hexToBytes } from "./color";
import { applyDither } from "./diffuse";
import { bayer2, bayer4, bayer8 } from "./matrices";
import { ditherFragmentShader } from "./shader";

export type DitherGpu = Record<string, never>;

export const ditherEffect: EffectModule<"dither", DitherParams, DitherGpu> = {
  id: "dither",
  label: defaults.effects.dither.label,
  fragmentShader: ditherFragmentShader,
  defaults: initialDither,
  controls(): readonly ControlSpec[] {
    const spec = defaults.effects.dither;
    return [
      {
        key: "method",
        label: spec.methodLabel,
        kind: "segment",
        hint: spec.diffusionHint,
        options: spec.methods.map((method) => ({ value: method.id, label: method.label })),
      },
      {
        key: "cellScale",
        label: spec.cellScale.label,
        kind: "range",
        min: spec.cellScale.min,
        max: spec.cellScale.max,
        step: spec.cellScale.step,
      },
      { key: "colorA", label: spec.colorALabel, kind: "color" },
      { key: "colorB", label: spec.colorBLabel, kind: "color" },
    ];
  },
  withControl(params, key, value): DitherParams {
    if (key === "method" && typeof value === "string" && isDitherMethod(value)) {
      return { ...params, method: value };
    }
    if (key === "cellScale") return { ...params, cellScale: Number(value) };
    if (key === "colorA" && typeof value === "string") return { ...params, colorA: value };
    if (key === "colorB" && typeof value === "string") return { ...params, colorB: value };
    return params;
  },
  createGpu(): DitherGpu {
    return {};
  },
  syncGpu(): void {},
  bindGpu(gl, program, _gpu, params, draw): void {
    const cell = Math.max(1, Math.round(params.cellScale));
    const cols = Math.max(1, Math.ceil(draw.sourceWidth / cell));
    const rows = Math.max(1, Math.ceil(draw.sourceHeight / cell));
    const dark = bytesToUnit(hexToBytes(params.colorA, [0, 0, 0]));
    const light = bytesToUnit(hexToBytes(params.colorB, [255, 255, 255]));
    uniform1i(gl, program, "uImage", 0);
    uniform2f(gl, program, "uSourceSize", draw.sourceWidth, draw.sourceHeight);
    uniform2f(gl, program, "uGridSize", cols, rows);
    uniform1f(gl, program, "uCell", cell);
    uniform1f(gl, program, "uThreshold", defaults.effects.dither.threshold);
    uniform1f(gl, program, "uBayer", bayerOrder(params.method));
    uniform1f(gl, program, "uDirect", cell === 1 ? 1 : 0);
    uniform3f(gl, program, "uColorA", dark[0], dark[1], dark[2]);
    uniform3f(gl, program, "uColorB", light[0], light[1], light[2]);
    uniformArray(gl, program, "uBayer2", bayer2);
    uniformArray(gl, program, "uBayer4", bayer4);
    uniformArray(gl, program, "uBayer8", bayer8);
  },
  releaseGpu(): void {},
  drawCpu(ctx, source, params): void {
    const out = applyDither(source.data, source.width, source.height, params);
    const image = ctx.createImageData(source.width, source.height);
    image.data.set(out);
    ctx.putImageData(image, 0, 0);
  },
};

function uniform1i(gl: WebGL2RenderingContext, program: WebGLProgram, name: string, value: number): void {
  const location = gl.getUniformLocation(program, name);
  if (location) gl.uniform1i(location, value);
}

function uniform1f(gl: WebGL2RenderingContext, program: WebGLProgram, name: string, value: number): void {
  const location = gl.getUniformLocation(program, name);
  if (location) gl.uniform1f(location, value);
}

function uniform2f(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  x: number,
  y: number,
): void {
  const location = gl.getUniformLocation(program, name);
  if (location) gl.uniform2f(location, x, y);
}

function uniform3f(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  x: number,
  y: number,
  z: number,
): void {
  const location = gl.getUniformLocation(program, name);
  if (location) gl.uniform3f(location, x, y, z);
}

function uniformArray(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  values: readonly number[],
): void {
  const location = gl.getUniformLocation(program, name);
  if (location) gl.uniform1fv(location, new Float32Array(values));
}
