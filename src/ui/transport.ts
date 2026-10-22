import { defaults } from "../data/defaults";
import { studioCopy, videoFrameMessage, videoSpeedLabel } from "../data/studio-copy";

export interface TransportHandle {
  readonly element: HTMLElement;
  setVisible(visible: boolean): void;
  setPlaying(playing: boolean): void;
  setTimeline(duration: number, time: number): void;
  setFrame(index: number, frameCount: number, seconds: number): void;
  setFps(fps: number): void;
}

export function mountTransport(
  parent: HTMLElement,
  handlers: {
    onToggle: (playing: boolean) => void;
    onSeek: (time: number) => void;
    onSpeed: (speed: number) => void;
  },
): TransportHandle {
  const root = document.createElement("div");
  root.className = "transport";
  root.dataset.viewChrome = "true";
  root.hidden = true;

  const play = document.createElement("button");
  play.type = "button";
  play.className = "button";
  play.textContent = studioCopy.play;
  play.setAttribute("aria-pressed", "false");

  const timeline = document.createElement("input");
  timeline.type = "range";
  timeline.className = "transport-timeline";
  timeline.min = "0";
  timeline.max = "1";
  timeline.step = "0.01";
  timeline.value = "0";
  timeline.setAttribute("aria-label", "Timeline");

  const frame = document.createElement("span");
  frame.className = "transport-frame";
  frame.dataset.videoFrame = "0";

  const speeds = document.createElement("div");
  speeds.className = "segment transport-speeds";
  speeds.setAttribute("role", "group");
  speeds.setAttribute("aria-label", "Playback speed");
  const speedButtons: HTMLButtonElement[] = [];
  for (const speed of defaults.video.speeds) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button segment-button";
    button.textContent = videoSpeedLabel(speed);
    button.dataset.speed = String(speed);
    button.setAttribute("aria-pressed", speed === defaults.video.defaultSpeed ? "true" : "false");
    button.addEventListener("click", () => {
      for (const other of speedButtons) {
        other.setAttribute("aria-pressed", other === button ? "true" : "false");
      }
      handlers.onSpeed(speed);
    });
    speedButtons.push(button);
    speeds.append(button);
  }

  let playing = false;
  play.addEventListener("click", () => {
    playing = !playing;
    paintPlay();
    handlers.onToggle(playing);
  });

  let scrubTimer = 0;
  timeline.addEventListener("input", () => {
    window.clearTimeout(scrubTimer);
    scrubTimer = window.setTimeout(() => {
      handlers.onSeek(Number(timeline.value));
    }, defaults.video.scrubMs);
  });

  root.append(play, timeline, frame, speeds);
  parent.append(root);

  const paintPlay = (): void => {
    play.textContent = playing ? studioCopy.pause : studioCopy.play;
    play.setAttribute("aria-pressed", playing ? "true" : "false");
    root.dataset.videoState = playing ? "playing" : "paused";
  };

  return {
    element: root,
    setVisible(visible: boolean): void {
      root.hidden = !visible;
    },
    setPlaying(next: boolean): void {
      playing = next;
      paintPlay();
    },
    setTimeline(duration: number, time: number): void {
      timeline.max = String(Math.max(0, duration));
      if (document.activeElement !== timeline) timeline.value = String(time);
    },
    setFrame(index: number, frameCount: number, seconds: number): void {
      frame.textContent = videoFrameMessage(index, frameCount, seconds);
      frame.dataset.videoFrame = String(index);
    },
    setFps(fps: number): void {
      root.dataset.videoFps = fps.toFixed(1);
    },
  };
}
