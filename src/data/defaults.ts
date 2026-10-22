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

export type EffectId = "ascii" | "pixelate";

export function initialEffectId(): EffectId {
  return defaults.effects.defaultId === "pixelate" ? "pixelate" : "ascii";
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
