export const browserSupport = {
  mp4: "This browser cannot export MP4. Use Chrome, Edge, Firefox desktop, or Safari 26+.",
  insecure:
    "VideoEncoder only works in a secure context (HTTPS). This page is not a secure context.",
  webgl2:
    "WebGL2 is unavailable, so real-time effects will use the Canvas2D fallback.",
} as const;

export const checkLabels = {
  webgl2: "WebGL2",
  videoEncoder: "VideoEncoder",
  videoDecoder: "VideoDecoder",
  secureContext: "isSecureContext",
  h264: "H.264 1080p30",
} as const;

export const statusLabel = {
  pending: "Checking",
  pass: "Pass",
  fail: "Fail",
  unavailable: "Unavailable",
} as const;
