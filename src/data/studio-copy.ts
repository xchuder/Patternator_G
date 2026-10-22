export const studioCopy = {
  phase: "Phase 2",
  dropTitle: "Drop an image or a video",
  dropNote: "PNG, JPG, WebP, MP4, or WebM",
  choose: "Choose file",
  replace: "Replace image",
  sourceTab: "Source",
  filterTab: "Filter",
  effectTab: "Effect",
  exportTab: "Export",
  download: "Download PNG",
  preparing: "Preparing PNG…",
  privacy:
    "This file stays in this browser. Nothing is uploaded.",
  browserLink: "Browser check",
  noImage: "No image yet",
  readError: "Could not read that image.",
  typeError: "Use a PNG, JPG, WebP, MP4, or WebM file.",
  videoReadError: "Could not read that video.",
  noVideoTrack: "That file has no video track.",
  webCodecsMissing:
    "This browser has no WebCodecs video decoder, so video preview stays off. Still images still work. Chrome, Edge, Firefox desktop, or Safari 26+ can play the preview.",
  leaveClip: "Left that clip out.",
  play: "Play",
  pause: "Pause",
  exportFailed: "Could not create the PNG.",
  emptyCharset: "Add at least one character.",
  webgl2: "WebGL2",
  canvas2d: "Canvas2D",
  effectLabel: "Effect",
} as const;

export function tooLargeMessage(edge: number): string {
  return `Images must be ${edge}px or smaller on each side.`;
}

export function textureLimitMessage(edge: number): string {
  return `This image is larger than the GPU texture limit (${edge}px).`;
}

export function savedMessage(name: string): string {
  return `Saved ${name}`;
}

export function truncatedMessage(max: number): string {
  return `Only the first ${max} characters are used.`;
}

export function missingGlyphMessage(names: string, chars: string): string {
  return `Not in ${names}: ${chars}`;
}

export function exportSizeMessage(width: number, height: number): string {
  return `PNG exports at ${width}×${height}, the original size.`;
}

export function videoLimitMessage(desktop: number, mobile: number): string {
  return `Video export, in a later phase, caps at ${desktop}p on desktop and ${mobile}p on phones. Images are not capped.`;
}

export function videoTooLongMessage(duration: number, maxSeconds: number): string {
  return `This clip is ${duration.toFixed(1)}s. Use ${maxSeconds} seconds from the start time below, or leave it out.`;
}

export function videoFrameMessage(index: number, frameCount: number, seconds: number): string {
  return `Frame ${index} / ${frameCount} · ${seconds.toFixed(2)}s`;
}

export function videoExportMessage(): string {
  return "PNG saves the current frame. MP4 export is a later phase.";
}

export function videoSpeedLabel(speed: number): string {
  return `${speed}×`;
}

export function fileMeta(name: string, width: number, height: number, backend: string): string {
  return `${name} · ${width}×${height} · ${backend}`;
}
