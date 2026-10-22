import { defaults, initialAscii, type AsciiParams } from "../../data/defaults";
import type { ControlSpec, ControlValue, EffectModule } from "../types";
import { drawAtlas, glyphFontsReady, paintGlyph } from "./atlas";
import { glyphIndex, normalizeCharset, relativeLuma } from "./charset";
import { asciiFragmentShader } from "./shader";

export interface AsciiGpu {
  texture: WebGLTexture;
  cols: number;
  rows: number;
  count: number;
  charset: string;
  fontsReady: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  const value = Number.parseInt(raw, 16);
  if (!Number.isFinite(value) || raw.length !== 6) return [1, 1, 1];
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function uploadAtlas(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  charset: string,
): Pick<AsciiGpu, "cols" | "rows" | "count"> {
  const atlas = drawAtlas(charset);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { cols: atlas.cols, rows: atlas.rows, count: atlas.count };
}

export const asciiEffect: EffectModule<"ascii", AsciiParams, AsciiGpu> = {
  id: "ascii",
  label: defaults.effects.ascii.label,
  fragmentShader: asciiFragmentShader,
  defaults: initialAscii,
  controls(): readonly ControlSpec[] {
    const spec = defaults.effects.ascii;
    return [
      {
        key: "charset",
        label: spec.charsetLabel,
        kind: "text",
        presets: spec.presets.map((preset) => ({
          id: preset.id,
          label: preset.label,
          value: preset.charset,
        })),
      },
      {
        key: "cellSize",
        label: spec.cellSize.label,
        kind: "range",
        min: spec.cellSize.min,
        max: spec.cellSize.max,
        step: spec.cellSize.step,
      },
      {
        key: "invert",
        label: spec.invert.label,
        kind: "checkbox",
      },
      {
        key: "colorMode",
        label: spec.colorModeLabel,
        kind: "segment",
        options: spec.colorModes.map((mode) => ({ value: mode.id, label: mode.label })),
      },
      {
        key: "singleColor",
        label: spec.singleColorLabel,
        kind: "color",
        visibleWhen: { key: "colorMode", equals: "single" },
      },
    ];
  },
  withControl(params, key, value): AsciiParams {
    return applyAsciiControl(params, key, value);
  },
  createGpu(gl): AsciiGpu {
    const texture = gl.createTexture();
    if (texture === null) throw new Error("Could not create the glyph atlas texture");
    const charset = normalizeCharset(initialAscii().charset, defaults.limits.maxGlyphs);
    const uploaded = uploadAtlas(gl, texture, charset);
    return {
      texture,
      cols: uploaded.cols,
      rows: uploaded.rows,
      count: uploaded.count,
      charset,
      fontsReady: glyphFontsReady(),
    };
  },
  syncGpu(gl, gpu, params): void {
    const charset = normalizeCharset(params.charset, defaults.limits.maxGlyphs);
    const fontsReady = glyphFontsReady();
    if (gpu.charset === charset && gpu.fontsReady === fontsReady && fontsReady) return;
    const uploaded = uploadAtlas(gl, gpu.texture, charset.length > 0 ? charset : " ");
    gpu.cols = uploaded.cols;
    gpu.rows = uploaded.rows;
    gpu.count = charset.length;
    gpu.charset = charset;
    gpu.fontsReady = fontsReady;
  },
  bindGpu(gl, program, gpu, params, draw): void {
    const image = gl.getUniformLocation(program, "uImage");
    const atlas = gl.getUniformLocation(program, "uAtlas");
    const sourceSize = gl.getUniformLocation(program, "uSourceSize");
    const targetSize = gl.getUniformLocation(program, "uTargetSize");
    const cell = gl.getUniformLocation(program, "uCell");
    const count = gl.getUniformLocation(program, "uCount");
    const grid = gl.getUniformLocation(program, "uGrid");
    const invert = gl.getUniformLocation(program, "uInvert");
    const single = gl.getUniformLocation(program, "uSingle");
    const color = gl.getUniformLocation(program, "uGlyphColor");
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, gpu.texture);
    if (image) gl.uniform1i(image, 0);
    if (atlas) gl.uniform1i(atlas, 1);
    if (sourceSize) gl.uniform2f(sourceSize, draw.sourceWidth, draw.sourceHeight);
    if (targetSize) gl.uniform2f(targetSize, draw.targetWidth, draw.targetHeight);
    if (cell) gl.uniform1f(cell, params.cellSize);
    if (count) gl.uniform1f(count, Math.max(gpu.count, 1));
    if (grid) gl.uniform2f(grid, gpu.cols, gpu.rows);
    if (invert) gl.uniform1f(invert, params.invert ? 1 : 0);
    if (single) gl.uniform1f(single, params.colorMode === "single" ? 1 : 0);
    if (color) {
      const [red, green, blue] = hexToRgb(params.singleColor);
      gl.uniform3f(color, red, green, blue);
    }
  },
  releaseGpu(gl, gpu): void {
    gl.deleteTexture(gpu.texture);
  },
  drawCpu(ctx, source, params, sourceWidth, _sourceHeight): void {
    const charset = normalizeCharset(params.charset, defaults.limits.maxGlyphs);
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
    if (charset.length === 0 || sourceWidth <= 0) return;
    const scale = width / sourceWidth;
    const cell = Math.max(1, params.cellSize * scale);
    const glyphs = [...charset];
    const data = source.data;
    for (let y = 0; y < height; y += cell) {
      for (let x = 0; x < width; x += cell) {
        const cx = Math.min(width - 1, Math.floor(x + cell / 2));
        const cy = Math.min(height - 1, Math.floor(y + cell / 2));
        const index = (cy * width + cx) * 4;
        const red = (data[index] ?? 0) / 255;
        const green = (data[index + 1] ?? 0) / 255;
        const blue = (data[index + 2] ?? 0) / 255;
        const glyph = glyphs[glyphIndex(relativeLuma(red, green, blue), glyphs.length, params.invert)];
        if (glyph === undefined) continue;
        ctx.save();
        if (params.colorMode === "single") ctx.fillStyle = params.singleColor;
        else ctx.fillStyle = `rgb(${data[index] ?? 0}, ${data[index + 1] ?? 0}, ${data[index + 2] ?? 0})`;
        paintGlyph(ctx, glyph, x, y, cell);
        ctx.restore();
      }
    }
  },
};

function applyAsciiControl(params: AsciiParams, key: string, value: ControlValue): AsciiParams {
  switch (key) {
    case "charset":
      return { ...params, charset: String(value) };
    case "cellSize":
      return { ...params, cellSize: Number(value) };
    case "invert":
      return { ...params, invert: Boolean(value) };
    case "colorMode":
      return { ...params, colorMode: value === "single" ? "single" : "image" };
    case "singleColor":
      return { ...params, singleColor: String(value) };
    default:
      return params;
  }
}
