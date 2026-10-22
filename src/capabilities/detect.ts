import { formatProbeLabel, h264Probe } from "../data/encoder-probe";
import type { checkLabels, statusLabel } from "../data/browser-support";

export type CheckId = keyof typeof checkLabels;
export type CheckStatus = keyof typeof statusLabel;

export interface CheckState {
  status: CheckStatus;
  detail: string;
}

export function readImmediateChecks(): Record<Exclude<CheckId, "h264">, CheckState> {
  return {
    webgl2: { status: detectWebGL2(), detail: "" },
    videoEncoder: {
      status: typeof VideoEncoder === "undefined" ? "fail" : "pass",
      detail: "",
    },
    videoDecoder: {
      status: typeof VideoDecoder === "undefined" ? "fail" : "pass",
      detail: "",
    },
    secureContext: {
      status: window.isSecureContext ? "pass" : "fail",
      detail: "",
    },
  };
}

export function pendingH264Check(): CheckState {
  return { status: "pending", detail: formatProbeLabel(h264Probe) };
}

export async function readH264Check(): Promise<CheckState> {
  const detail = formatProbeLabel(h264Probe);
  if (
    typeof VideoEncoder === "undefined" ||
    typeof VideoEncoder.isConfigSupported !== "function"
  ) {
    return { status: "unavailable", detail };
  }

  try {
    const result = await VideoEncoder.isConfigSupported(h264Probe);
    return {
      status: result.supported === true ? "pass" : "fail",
      detail,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Probe failed";
    return { status: "fail", detail: `${detail} — ${message}` };
  }
}

function detectWebGL2(): CheckStatus {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (gl === null) {
      return "fail";
    }
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose !== null) {
      lose.loseContext();
    }
    return "pass";
  } catch {
    return "fail";
  }
}
