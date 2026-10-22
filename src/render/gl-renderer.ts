import { defaults, type PrefilterParams } from "../data/defaults";
import { normalizeCharset } from "../effects/ascii/charset";
import { effects } from "../effects/registry";
import type { DrawSize } from "../effects/types";
import { pixelsToPng } from "../export/png";
import {
  compileProgram,
  createFilterTarget,
  createQuad,
  resizeFilterTarget,
  setTextureParams,
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
  private readonly filtered: ReturnType<typeof createFilterTarget>;
  private readonly exported: ReturnType<typeof createFilterTarget>;
  private readonly vao: WebGLVertexArrayObject;
  private readonly preProgram: WebGLProgram;
  private readonly programs = new Map<string, WebGLProgram>();
  private readonly asciiGpu: ReturnType<typeof effects.ascii.createGpu>;
  private readonly pixelGpu: ReturnType<typeof effects.pixelate.createGpu>;
  private sourceWidth = 0;
  private sourceHeight = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    maxTextureSize: number,
  ) {
    this.maxTextureSize = maxTextureSize;
    const source = gl.createTexture();
    if (source === null) throw new Error("Could not create the source texture");
    this.source = source;
    this.filtered = createFilterTarget(gl);
    this.exported = createFilterTarget(gl);
    this.vao = createQuad(gl);
    this.preProgram = compileProgram(gl, prefilterFragmentShader);
    this.programs.set("ascii", compileProgram(gl, effects.ascii.fragmentShader));
    this.programs.set("pixelate", compileProgram(gl, effects.pixelate.fragmentShader));
    this.asciiGpu = effects.ascii.createGpu(gl);
    this.pixelGpu = effects.pixelate.createGpu(gl);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
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
    if (this.sourceWidth === 0) return;
    if (this.canvas.width !== frame.width || this.canvas.height !== frame.height) {
      this.canvas.width = frame.width;
      this.canvas.height = frame.height;
    }
    this.render(frame, frame.width, frame.height, null);
  }

  async exportPng(_bitmap: ImageBitmap, frame: Omit<FrameRequest, "width" | "height">): Promise<Blob> {
    const width = this.sourceWidth;
    const height = this.sourceHeight;
    resizeFilterTarget(this.gl, this.exported, width, height);
    this.render({ ...frame, width, height }, width, height, this.exported.framebuffer);
    const gl = this.gl;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixelsToPng(pixels, width, height);
  }

  dispose(): void {
    const gl = this.gl;
    effects.ascii.releaseGpu(gl, this.asciiGpu);
    effects.pixelate.releaseGpu(gl, this.pixelGpu);
    gl.deleteTexture(this.source);
    gl.deleteTexture(this.filtered.texture);
    gl.deleteTexture(this.exported.texture);
    gl.deleteFramebuffer(this.filtered.framebuffer);
    gl.deleteFramebuffer(this.exported.framebuffer);
    gl.deleteProgram(this.preProgram);
    for (const program of this.programs.values()) gl.deleteProgram(program);
    gl.deleteVertexArray(this.vao);
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
    resizeFilterTarget(gl, this.filtered, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.filtered.framebuffer);
    gl.viewport(0, 0, width, height);
    this.drawPrefilter(frame.prefilter);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, width, height);
    if (frame.effectId === "ascii") {
      const charset = normalizeCharset(frame.ascii.charset, defaults.limits.maxGlyphs);
      if (charset.length === 0) {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }
    }
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
