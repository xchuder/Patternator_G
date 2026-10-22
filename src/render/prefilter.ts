import { defaults, type PrefilterParams } from "../data/defaults";

export const prefilterFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D uSource;
uniform float uBrightness;
uniform float uContrast;
uniform float uGamma;
uniform float uThreshold;
uniform float uThresholdOff;
uniform float uInvert;

in vec2 vUv;
out vec4 outColor;

void main() {
  vec3 rgb = texture(uSource, vUv).rgb;
  rgb += uBrightness;
  rgb = (rgb - 0.5) * uContrast + 0.5;
  rgb = pow(max(rgb, vec3(0.0)), vec3(uGamma));
  rgb = clamp(rgb, 0.0, 1.0);
  if (uThreshold > uThresholdOff) {
    float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    rgb = vec3(step(uThreshold, luma));
  }
  if (uInvert > 0.5) {
    rgb = vec3(1.0) - rgb;
  }
  outColor = vec4(rgb, 1.0);
}
`;

export function applyPrefilter(image: ImageData, params: PrefilterParams): void {
  const data = image.data;
  const off = defaults.prefilter.threshold.off;
  const gamma = params.gamma;
  for (let index = 0; index < data.length; index += 4) {
    let red = (data[index] ?? 0) / 255;
    let green = (data[index + 1] ?? 0) / 255;
    let blue = (data[index + 2] ?? 0) / 255;
    red += params.brightness;
    green += params.brightness;
    blue += params.brightness;
    red = (red - 0.5) * params.contrast + 0.5;
    green = (green - 0.5) * params.contrast + 0.5;
    blue = (blue - 0.5) * params.contrast + 0.5;
    red = Math.pow(Math.max(red, 0), gamma);
    green = Math.pow(Math.max(green, 0), gamma);
    blue = Math.pow(Math.max(blue, 0), gamma);
    red = clamp01(red);
    green = clamp01(green);
    blue = clamp01(blue);
    if (params.threshold > off) {
      const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      const tone = luma >= params.threshold ? 1 : 0;
      red = tone;
      green = tone;
      blue = tone;
    }
    if (params.invert) {
      red = 1 - red;
      green = 1 - green;
      blue = 1 - blue;
    }
    data[index] = Math.round(clamp01(red) * 255);
    data[index + 1] = Math.round(clamp01(green) * 255);
    data[index + 2] = Math.round(clamp01(blue) * 255);
    data[index + 3] = 255;
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
