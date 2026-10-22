import { defaults, isDiffusionMethod, type DitherParams, type PrefilterParams } from "../data/defaults";
import { normalizeCharset } from "../effects/ascii/charset";
import { DitherWorkerClient } from "../effects/dither/client";
import { applyDither } from "../effects/dither/diffuse";
import { blitFragmentShader, downsampleFragmentShader } from "../effects/dither/shader";
import { effects } from "../effects/registry";
import type { DrawSize } from "../effects/types";
import { pixelsToPng } from "../export/png";
import {
  compileProgram,
  createFilterTarget,
  createQuad,
  resizeFilterTarget,
  setTextureParams,
  type FilterTarget,
} from "./gl-program";
import { prefilterFragmentShader } from "./prefilter";
import type { FrameRequest, Renderer } from "./types";

export function probeWebGL2(): { ok: boolean; maxTextureSize: number } {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (gl === null) return { ok: false, maxTextureSize: 0 };
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const limit = typeof max === "number" ? max : 0;
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose !== null) lose.loseContext();
    return { ok: limit > 0, maxTextureSize: limit };
  } catch {
    return { ok: false, maxTextureSize: 0 };
  }
}

export class GlRenderer implements Renderer {
  readonly backend = "webgl2" as const;
  readonly maxTextureSize: number;
  private readonly source: WebGLTexture;
  private readonly filtered: FilterTarget;
  private readonly exported: FilterTarget;
  private readonly grid: FilterTarget;
  private readonly diffusion: WebGLTexture;
  private readonly vao: WebGLVertexArrayObject;
  private readonly preProgram: WebGLProgram;
  private readonly downProgram: WebGLProgram;
  private readonly blitProgram: WebGLProgram;
  private readonly programs = new Map<string, WebGLProgram>();
  private readonly asciiGpu: ReturnType<typeof effects.ascii.createGpu>;
  private readonly pixelGpu: ReturnType<typeof effects.pixelate.createGpu>;
  private readonly ditherGpu: ReturnType<typeof effects.dither.createGpu>;
  private readonly ditherWorker: DitherWorkerClient | null;
  private sourceWidth = 0;
  private sourceHeight = 0;
  private diffusionToken = 0;
  private presented = 0;
  private busy = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    maxTextureSize: number,
  ) {
    this.maxTextureSize = maxTextureSize;
    const source = gl.createTexture();
    const diffusion = gl.createTexture();
    if (source === null || diffusion === null) throw new Error("Could not create the source texture");
    this.source = source;
    this.diffusion = diffusion;
    gl.bindTexture(gl.TEXTURE_2D, diffusion);
    setTextureParams(gl);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.filtered = createFilterTarget(gl);
    this.exported = createFilterTarget(gl);
    this.grid = createFilterTarget(gl);
    this.vao = createQuad(gl);
    this.preProgram = compileProgram(gl, prefilterFragmentShader);
    this.downProgram = compileProgram(gl, downsampleFragmentShader);
    this.blitProgram = compileProgram(gl, blitFragmentShader);
    this.programs.set("ascii", compileProgram(gl, effects.ascii.fragmentShader));
    this.programs.set("pixelate", compileProgram(gl, effects.pixelate.fragmentShader));
    this.programs.set("dither", compileProgram(gl, effects.dither.fragmentShader));
    this.asciiGpu = effects.ascii.createGpu(gl);
    this.pixelGpu = effects.pixelate.createGpu(gl);
    this.ditherGpu = effects.dither.createGpu(gl);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    try {
      this.ditherWorker = new DitherWorkerClient();
    } catch {
      this.ditherWorker = null;
    }
  }

  setSource(bitmap: ImageBitmap): void {
    const gl = this.gl;
    this.sourceWidth = bitmap.width;
    this.sourceHeight = bitmap.height;
    gl.bindTexture(gl.TEXTURE_2D, this.source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    setTextureParams(gl);
  }

  draw(_bitmap: ImageBitmap, frame: FrameRequest): void {
    if (this.sourceWidth === 0 || this.busy) return;
    this.resizeCanvas(frame.width, frame.height);
    if (frame.effectId === "dither" && isDiffusionMethod(frame.dither.method)) {
      const token = this.bumpToken();
      void this.diffuseTo(frame, frame.width, frame.height, null, token)
        .then((shown) => {
          if (shown) this.markPresented(frame.effectId);
        })
        .catch((error: unknown) => {
          this.fault(error);
        });
      return;
    }
    this.bumpToken();
    this.render(frame, frame.width, frame.height, null);
    this.markPresented(frame.effectId);
  }

  async exportPng(_bitmap: ImageBitmap, frame: Omit<FrameRequest, "width" | "height">): Promise<Blob> {
    const width = this.sourceWidth;
    const height = this.sourceHeight;
    this.busy = true;
    const token = this.bumpToken();
    try {
      resizeFilterTarget(this.gl, this.exported, width, height);
      const full = { ...frame, width, height };
      if (frame.effectId === "dither" && isDiffusionMethod(frame.dither.method)) {
        const shown = await this.diffuseTo(full, width, height, this.exported.framebuffer, token);
        if (!shown) throw new Error("Dither was interrupted");
      } else {
        this.render(full, width, height, this.exported.framebuffer);
      }
      const gl = this.gl;
      const pixels = new Uint8Array(width * height * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.exported.framebuffer);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixelsToPng(pixels, width, height);
    } finally {
      this.busy = false;
    }
  }

  dispose(): void {
    const gl = this.gl;
    this.bumpToken();
    this.ditherWorker?.dispose();
    effects.ascii.releaseGpu(gl, this.asciiGpu);
    effects.pixelate.releaseGpu(gl, this.pixelGpu);
    effects.dither.releaseGpu(gl, this.ditherGpu);
    gl.deleteTexture(this.source);
    gl.deleteTexture(this.diffusion);
    gl.deleteTexture(this.filtered.texture);
    gl.deleteTexture(this.exported.texture);
    gl.deleteTexture(this.grid.texture);
    gl.deleteFramebuffer(this.filtered.framebuffer);
    gl.deleteFramebuffer(this.exported.framebuffer);
    gl.deleteFramebuffer(this.grid.framebuffer);
    gl.deleteProgram(this.preProgram);
    gl.deleteProgram(this.downProgram);
    gl.deleteProgram(this.blitProgram);
    for (const program of this.programs.values()) gl.deleteProgram(program);
    gl.deleteVertexArray(this.vao);
  }

  private resizeCanvas(width: number, height: number): void {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  private bumpToken(): number {
    this.diffusionToken += 1;
    return this.diffusionToken;
  }

  private markPresented(effectId: string): void {
    this.presented += 1;
    this.canvas.dataset.presented = String(this.presented);
    this.canvas.dataset.effect = effectId;
  }

  private fault(error: unknown): void {
    const message = error instanceof Error ? error.message : "Dither failed";
    this.canvas.dispatchEvent(new CustomEvent("render-fault", { detail: message }));
  }

  private async diffuseTo(
    frame: FrameRequest,
    width: number,
    height: number,
    target: WebGLFramebuffer | null,
    token: number,
  ): Promise<boolean> {
    this.renderPrefilter(frame.prefilter, width, height);
    const pixels = this.readFilteredTopDown(width, height);
    const output = await this.runDiffusion(pixels, width, height, frame.dither);
    if (output === null || token !== this.diffusionToken) return false;
    this.blitPixels(output, width, height, target);
    return true;
  }

  private async runDiffusion(
    pixels: Uint8Array,
    width: number,
    height: number,
    params: DitherParams,
  ): Promise<Uint8ClampedArray | null> {
    const worker = this.ditherWorker;
    if (worker === null) return applyDither(pixels, width, height, params);
    return worker.run({ width, height, pixels, params });
  }

  private readFilteredTopDown(width: number, height: number): Uint8Array {
    const gl = this.gl;
    const raw = new Uint8Array(width * height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.filtered.framebuffer);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const row = width * 4;
    const flipped = new Uint8Array(raw.length);
    for (let y = 0; y < height; y += 1) {
      const from = (height - 1 - y) * row;
      flipped.set(raw.subarray(from, from + row), y * row);
    }
    return flipped;
  }

  private blitPixels(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    target: WebGLFramebuffer | null,
  ): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.diffusion);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.blitProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.diffusion);
    const image = gl.getUniformLocation(this.blitProgram, "uImage");
    if (image) gl.uniform1i(image, 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private render(
    frame: FrameRequest,
    width: number,
    height: number,
    target: WebGLFramebuffer | null,
  ): void {
    const gl = this.gl;
    const draw: DrawSize = {
      sourceWidth: this.sourceWidth,
      sourceHeight: this.sourceHeight,
      targetWidth: width,
      targetHeight: height,
    };
    this.renderPrefilter(frame.prefilter, width, height);
    if (frame.effectId === "ascii") {
      const charset = normalizeCharset(frame.ascii.charset, defaults.limits.maxGlyphs);
      if (charset.length === 0) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }
    }
    if (frame.effectId === "dither") {
      const cell = Math.max(1, Math.round(frame.dither.cellScale));
      if (cell > 1) this.downsample(cell, draw.sourceWidth, draw.sourceHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target);
      gl.viewport(0, 0, width, height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, cell > 1 ? this.grid.texture : this.filtered.texture);
      const program = this.programFor("dither");
      gl.useProgram(program);
      effects.dither.syncGpu(gl, this.ditherGpu, frame.dither);
      effects.dither.bindGpu(gl, program, this.ditherGpu, frame.dither, draw);
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.filtered.texture);
    if (frame.effectId === "ascii") {
      const program = this.programFor("ascii");
      gl.useProgram(program);
      effects.ascii.syncGpu(gl, this.asciiGpu, frame.ascii);
      effects.ascii.bindGpu(gl, program, this.asciiGpu, frame.ascii, draw);
    } else {
      const program = this.programFor("pixelate");
      gl.useProgram(program);
      effects.pixelate.syncGpu(gl, this.pixelGpu, frame.pixelate);
      effects.pixelate.bindGpu(gl, program, this.pixelGpu, frame.pixelate, draw);
    }
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private downsample(cell: number, sourceWidth: number, sourceHeight: number): void {
    const gl = this.gl;
    const cols = Math.max(1, Math.ceil(sourceWidth / cell));
    const rows = Math.max(1, Math.ceil(sourceHeight / cell));
    resizeFilterTarget(gl, this.grid, cols, rows);
    gl.bindTexture(gl.TEXTURE_2D, this.grid.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.grid.framebuffer);
    gl.viewport(0, 0, cols, rows);
    gl.useProgram(this.downProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.filtered.texture);
    const image = gl.getUniformLocation(this.downProgram, "uImage");
    const sourceSize = gl.getUniformLocation(this.downProgram, "uSourceSize");
    const gridSize = gl.getUniformLocation(this.downProgram, "uGridSize");
    const cellSize = gl.getUniformLocation(this.downProgram, "uCell");
    if (image) gl.uniform1i(image, 0);
    if (sourceSize) gl.uniform2f(sourceSize, sourceWidth, sourceHeight);
    if (gridSize) gl.uniform2f(gridSize, cols, rows);
    if (cellSize) gl.uniform1f(cellSize, cell);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private renderPrefilter(params: PrefilterParams, width: number, height: number): void {
    const gl = this.gl;
    resizeFilterTarget(gl, this.filtered, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.filtered.framebuffer);
    gl.viewport(0, 0, width, height);
    this.drawPrefilter(params);
  }

  private drawPrefilter(params: PrefilterParams): void {
    const gl = this.gl;
    gl.useProgram(this.preProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.source);
    const source = gl.getUniformLocation(this.preProgram, "uSource");
    const brightness = gl.getUniformLocation(this.preProgram, "uBrightness");
    const contrast = gl.getUniformLocation(this.preProgram, "uContrast");
    const gamma = gl.getUniformLocation(this.preProgram, "uGamma");
    const threshold = gl.getUniformLocation(this.preProgram, "uThreshold");
    const thresholdOff = gl.getUniformLocation(this.preProgram, "uThresholdOff");
    const invert = gl.getUniformLocation(this.preProgram, "uInvert");
    if (source) gl.uniform1i(source, 0);
    if (brightness) gl.uniform1f(brightness, params.brightness);
    if (contrast) gl.uniform1f(contrast, params.contrast);
    if (gamma) gl.uniform1f(gamma, params.gamma);
    if (threshold) gl.uniform1f(threshold, params.threshold);
    if (thresholdOff) gl.uniform1f(thresholdOff, defaults.prefilter.threshold.off);
    if (invert) gl.uniform1f(invert, params.invert ? 1 : 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private programFor(id: string): WebGLProgram {
    const program = this.programs.get(id);
    if (program === undefined) throw new Error(`Missing program ${id}`);
    return program;
  }
}
