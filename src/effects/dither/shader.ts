import { defaults } from "../../data/defaults";

const maxCell = Math.round(defaults.effects.dither.cellScale.max);

export const downsampleFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D uImage;
uniform vec2 uSourceSize;
uniform vec2 uGridSize;
uniform float uCell;

out vec4 outColor;

void main() {
  float col = floor(gl_FragCoord.x);
  float rowDown = uGridSize.y - 1.0 - floor(gl_FragCoord.y);
  vec2 origin = vec2(col, rowDown) * uCell;
  vec3 sum = vec3(0.0);
  float count = 0.0;
  for (int y = 0; y < ${maxCell}; y++) {
    if (float(y) >= uCell) break;
    for (int x = 0; x < ${maxCell}; x++) {
      if (float(x) >= uCell) break;
      vec2 src = origin + vec2(float(x), float(y)) + 0.5;
      if (src.x < uSourceSize.x && src.y < uSourceSize.y) {
        vec2 uv = vec2(src.x / uSourceSize.x, 1.0 - src.y / uSourceSize.y);
        sum += texture(uImage, uv).rgb;
        count += 1.0;
      }
    }
  }
  outColor = vec4(sum / max(count, 1.0), 1.0);
}
`;

export const ditherFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D uImage;
uniform vec2 uSourceSize;
uniform vec2 uGridSize;
uniform float uCell;
uniform float uThreshold;
uniform float uBayer;
uniform float uDirect;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uBayer2[4];
uniform float uBayer4[16];
uniform float uBayer8[64];

in vec2 vUv;
out vec4 outColor;

float bayerAt(int x, int y) {
  if (uBayer < 3.0) return uBayer2[(y & 1) * 2 + (x & 1)];
  if (uBayer < 6.0) return uBayer4[(y & 3) * 4 + (x & 3)];
  return uBayer8[(y & 7) * 8 + (x & 7)];
}

void main() {
  vec2 src = vec2(vUv.x, 1.0 - vUv.y) * uSourceSize;
  float cell = max(uCell, 1.0);
  int col = int(floor(src.x / cell));
  int row = int(floor(src.y / cell));
  vec3 rgb;
  if (uDirect > 0.5) {
    vec2 px = floor(src) + 0.5;
    vec2 uv = vec2(px.x / uSourceSize.x, 1.0 - px.y / uSourceSize.y);
    rgb = texture(uImage, clamp(uv, 0.0, 1.0)).rgb;
  } else {
    vec2 uv = vec2((float(col) + 0.5) / uGridSize.x, (uGridSize.y - float(row) - 0.5) / uGridSize.y);
    rgb = texture(uImage, clamp(uv, 0.0, 1.0)).rgb;
  }
  float limit = uThreshold;
  if (uBayer > 1.5) limit = (bayerAt(col, row) + 0.5) / (uBayer * uBayer);
  float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  float on = step(limit, luma);
  outColor = vec4(mix(uColorA, uColorB, on), 1.0);
}
`;

export const blitFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D uImage;
in vec2 vUv;
out vec4 outColor;

void main() {
  outColor = texture(uImage, vUv);
}
`;
