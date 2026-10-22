export const pixelateFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D uImage;
uniform vec2 uSourceSize;
uniform vec2 uTargetSize;
uniform float uBlock;

in vec2 vUv;
out vec4 outColor;

void main() {
  float block = max(uBlock * uTargetSize.x / uSourceSize.x, 1.0);
  vec2 down = vec2(vUv.x, 1.0 - vUv.y);
  vec2 px = down * uTargetSize;
  vec2 centerDown = (floor(px / block) + 0.5) * block;
  vec2 sampleUv = clamp(
    vec2(centerDown.x / uTargetSize.x, 1.0 - centerDown.y / uTargetSize.y),
    0.0,
    1.0
  );
  outColor = texture(uImage, sampleUv);
}
`;
