import raw from "./defaults.json" with { type: "json" };

export interface SliderSpec {
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  off?: number;
  hint?: string;
}

export interface ToggleSpec {
  label: string;
  default: boolean;
}

export interface Defaults {
  image: {
    accept: readonly string[];
    extensions: readonly string[];
    maxDecodeEdge: number;
  };
  limits: {
    previewMaxEdge: number;
    maxDpr: number;
    desktopVideoMaxEdge: number;
    mobileVideoMaxEdge: number;
    atlasCell: number;
    maxGlyphs: number;
  };
  view: {
    minPercent: number;
    maxPercent: number;
    buttonStep: number;
    wheelStep: number;
    panMargin: number;
    zoomLabel: string;
    zoomInLabel: string;
    zoomOutLabel: string;
    fitLabel: string;
    actualLabel: string;
  };
  prefilter: {
    brightness: SliderSpec;
    contrast: SliderSpec;
    gamma: SliderSpec;
    threshold: SliderSpec & { off: number };
    invert: ToggleSpec;
  };
  effects: {
    defaultId: string;
    ascii: {
      label: string;
      charset: string;
      charsetLabel: string;
      presets: readonly { id: string; label: string; charset: string }[];
      cellSize: SliderSpec;
      invert: ToggleSpec;
      colorMode: string;
      colorModeLabel: string;
      colorModes: readonly { id: string; label: string }[];
      singleColor: string;
      singleColorLabel: string;
    };
    pixelate: {
      label: string;
      blockSize: SliderSpec;
    };
    dither: {
      label: string;
      method: string;
      methodLabel: string;
      methods: readonly { id: string; label: string }[];
      threshold: number;
      cellScale: SliderSpec;
      colorA: string;
      colorALabel: string;
      colorB: string;
      colorBLabel: string;
      diffusionHint: string;
    };
  };
}

export const defaults: Defaults = raw;

export interface PrefilterParams {
  brightness: number;
  contrast: number;
  gamma: number;
  threshold: number;
  invert: boolean;
}

export type AsciiColorMode = "image" | "single";

export interface AsciiParams {
  charset: string;
  cellSize: number;
  invert: boolean;
  colorMode: AsciiColorMode;
  singleColor: string;
}

export interface PixelateParams {
  blockSize: number;
}

export const ditherMethods = [
  "threshold",
  "floyd",
  "atkinson",
  "bayer2",
  "bayer4",
  "bayer8",
] as const;

export type DitherMethod = (typeof ditherMethods)[number];

export interface DitherParams {
  method: DitherMethod;
  cellScale: number;
  colorA: string;
  colorB: string;
}

export type EffectId = "ascii" | "pixelate" | "dither";

export function isDitherMethod(value: string): value is DitherMethod {
  return (ditherMethods as readonly string[]).includes(value);
}

export function isDiffusionMethod(method: DitherMethod): method is "floyd" | "atkinson" {
  return method === "floyd" || method === "atkinson";
}

export function bayerOrder(method: DitherMethod): 0 | 2 | 4 | 8 {
  if (method === "bayer2") return 2;
  if (method === "bayer4") return 4;
  if (method === "bayer8") return 8;
  return 0;
}

export function initialEffectId(): EffectId {
  const id = defaults.effects.defaultId;
  if (id === "pixelate" || id === "dither") return id;
  return "ascii";
}

export function initialPrefilter(): PrefilterParams {
  const spec = defaults.prefilter;
  return {
    brightness: spec.brightness.default,
    contrast: spec.contrast.default,
    gamma: spec.gamma.default,
    threshold: spec.threshold.default,
    invert: spec.invert.default,
  };
}

export function initialAscii(): AsciiParams {
  const spec = defaults.effects.ascii;
  return {
    charset: spec.charset,
    cellSize: spec.cellSize.default,
    invert: spec.invert.default,
    colorMode: spec.colorMode === "single" ? "single" : "image",
    singleColor: spec.singleColor,
  };
}

export function initialPixelate(): PixelateParams {
  return { blockSize: defaults.effects.pixelate.blockSize.default };
}

export function initialDither(): DitherParams {
  const spec = defaults.effects.dither;
  return {
    method: isDitherMethod(spec.method) ? spec.method : "floyd",
    cellScale: spec.cellScale.default,
    colorA: spec.colorA,
    colorB: spec.colorB,
  };
}
