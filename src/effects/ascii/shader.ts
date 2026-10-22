/** Samples the prefiltered image. vUv is GL-style, y-up. The atlas canvas is y-down and is uploaded without UNPACK_FLIP_Y, so local y is flipped before the atlas lookup. */
export const asciiFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D uImage;
uniform sampler2D uAtlas;
uniform vec2 uSourceSize;
uniform vec2 uTargetSize;
uniform float uCell;
uniform float uCount;
uniform vec2 uGrid;
uniform float uInvert;
uniform float uSingle;
uniform vec3 uGlyphColor;

in vec2 vUv;
out vec4 outColor;

void main() {
  float cell = max(uCell * uTargetSize.x / uSourceSize.x, 1.0);
  vec2 down = vec2(vUv.x, 1.0 - vUv.y);
  vec2 px = down * uTargetSize;
  vec2 cellId = floor(px / cell);
  vec2 local = (px - cellId * cell) / cell;
  vec2 centerDown = (cellId + 0.5) * cell;
  vec2 sampleUv = clamp(
    vec2(centerDown.x / uTargetSize.x, 1.0 - centerDown.y / uTargetSize.y),
    0.0,
    1.0
  );
  vec3 imageColor = texture(uImage, sampleUv).rgb;
  float luma = dot(imageColor, vec3(0.2126, 0.7152, 0.0722));
  float value = clamp(mix(luma, 1.0 - luma, uInvert), 0.0, 1.0);
  float idx = min(floor(value * uCount), max(uCount - 1.0, 0.0));
  float col = mod(idx, uGrid.x);
  float row = floor(idx / uGrid.x);
  vec2 atlasUv = (vec2(col, row) + local) / uGrid;
  float mask = texture(uAtlas, atlasUv).a;
  vec3 glyph = mix(imageColor, uGlyphColor, uSingle);
  outColor = vec4(glyph * mask, 1.0);
}
`;
