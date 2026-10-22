import { defaults } from "../data/defaults";

export function isAcceptedVideo(file: File): boolean {
  if (defaults.video.accept.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return defaults.video.extensions.some((extension) => name.endsWith(extension));
}

export function activeVideoLimits(): { maxWidth: number; maxHeight: number } {
  const spec = defaults.video;
  const mobile = window.matchMedia(spec.mobileQuery).matches;
  if (mobile) return { maxWidth: spec.mobileMaxWidth, maxHeight: spec.mobileMaxHeight };
  return { maxWidth: spec.desktopMaxWidth, maxHeight: spec.desktopMaxHeight };
}
