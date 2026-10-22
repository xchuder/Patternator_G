/**
 * H.264 High Profile, Level 4.0. That level covers 1920×1080 at 30fps.
 * `avc` matches the avc1 (length-prefixed) codec string.
 */
export const h264Probe = {
  codec: "avc1.640028",
  width: 1920,
  height: 1080,
  bitrate: 8_000_000,
  framerate: 30,
  avc: { format: "avc" },
} as const satisfies VideoEncoderConfig;

export function formatProbeLabel(config: {
  codec: string;
  width: number;
  height: number;
  framerate?: number;
}): string {
  const parts = [config.codec, `${config.width}×${config.height}`];
  if (config.framerate !== undefined) {
    parts.push(`${config.framerate}fps`);
  }
  return parts.join(" · ");
}
