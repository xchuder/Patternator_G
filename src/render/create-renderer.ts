import { CpuRenderer } from "./cpu-renderer";
import { GlRenderer, probeWebGL2 } from "./gl-renderer";
import type { Renderer } from "./types";

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const probe = probeWebGL2();
  if (!probe.ok) return new CpuRenderer(canvas);
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  });
  if (gl === null) return new CpuRenderer(canvas);
  return new GlRenderer(canvas, gl, probe.maxTextureSize);
}
