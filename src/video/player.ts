import { defaults } from "../data/defaults";
import type { VideoCommand, VideoEvent, VideoInfoMessage } from "./messages";

export interface VideoFrameView {
  bitmap: ImageBitmap;
  index: number;
  frameCount: number;
  time: number;
  rangeStart: number;
  rangeEnd: number;
  fps: number;
}

export interface VideoPlayerOptions {
  onInfo: (info: VideoInfoMessage) => void;
  onFrame: (frame: VideoFrameView) => void;
  onEnded: () => void;
  onError: (message: string) => void;
}

interface HeldFrame {
  bitmap: ImageBitmap;
  time: number;
  index: number;
  frameCount: number;
  rangeStart: number;
  rangeEnd: number;
}

export class VideoPlayer {
  private readonly worker: Worker;
  private readonly options: VideoPlayerOptions;
  private buffer: HeldFrame[] = [];
  private shown: HeldFrame | null = null;
  private mediaTime = 0;
  private rangeEnd = 0;
  private speed: number = defaults.video.defaultSpeed;
  private playing = false;
  private raf = 0;
  private lastNow = 0;
  private unique = 0;
  private windowStart = 0;
  private fps = 0;
  private opened = false;
  private epoch = 0;

  constructor(options: VideoPlayerOptions) {
    this.options = options;
    this.worker = new Worker(new URL("../workers/video.worker.ts", import.meta.url), { type: "module" });
    this.worker.addEventListener("message", (event: MessageEvent<VideoEvent>) => {
      this.onWorker(event.data);
    });
    this.worker.addEventListener("error", () => {
      this.options.onError("read");
    });
  }

  open(file: File, maxWidth: number, maxHeight: number): void {
    this.resetBuffer();
    this.opened = true;
    const command: VideoCommand = {
      type: "open",
      file,
      maxWidth,
      maxHeight,
      maxSeconds: defaults.video.maxSeconds,
      bufferFrames: defaults.video.bufferFrames,
    };
    this.worker.postMessage(command);
  }

  use(start: number, seconds: number): void {
    this.resetBuffer();
    this.playing = false;
    this.epoch += 1;
    this.mediaTime = start;
    this.rangeEnd = start + seconds;
    const command: VideoCommand = { type: "use", start, seconds, epoch: this.epoch };
    this.worker.postMessage(command);
  }

  play(): void {
    if (!this.opened) return;
    this.playing = true;
    this.lastNow = 0;
    this.windowStart = performance.now();
    this.unique = 0;
    const command: VideoCommand = { type: "play", time: this.mediaTime };
    this.worker.postMessage(command);
    if (this.raf === 0) this.raf = requestAnimationFrame(this.tick);
  }

  pause(): void {
    this.playing = false;
    if (this.raf !== 0) cancelAnimationFrame(this.raf);
    this.raf = 0;
    const command: VideoCommand = { type: "pause" };
    this.worker.postMessage(command);
  }

  seek(time: number): void {
    this.resetBuffer();
    this.epoch += 1;
    this.mediaTime = time;
    const command: VideoCommand = { type: "seek", time, epoch: this.epoch };
    this.worker.postMessage(command);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  close(): void {
    this.pause();
    this.resetBuffer();
    this.opened = false;
    const command: VideoCommand = { type: "close" };
    this.worker.postMessage(command);
  }

  dispose(): void {
    this.close();
    this.worker.terminate();
  }

  private tick = (now: number): void => {
    this.raf = 0;
    if (!this.playing) return;
    if (this.buffer.length === 0) {
      this.lastNow = now;
    } else {
      if (this.lastNow === 0) this.lastNow = now;
      const delta = ((now - this.lastNow) / 1000) * this.speed;
      this.lastNow = now;
      this.mediaTime = Math.min(this.rangeEnd, this.mediaTime + delta);
    }
    this.present();
    if (this.mediaTime >= this.rangeEnd - 1e-3) {
      this.playing = false;
      const command: VideoCommand = { type: "pause" };
      this.worker.postMessage(command);
      this.options.onEnded();
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  private onWorker(message: VideoEvent): void {
    if (message.type === "info") {
      this.options.onInfo(message);
      return;
    }
    if (message.type === "error") {
      this.options.onError(message.message);
      return;
    }
    if (message.type === "ended") {
      this.playing = false;
      if (this.raf !== 0) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.options.onEnded();
      return;
    }
    if (message.epoch !== this.epoch) {
      message.bitmap.close();
      this.ack();
      return;
    }
    this.buffer.push({
      bitmap: message.bitmap,
      time: message.time,
      index: message.index,
      frameCount: message.frameCount,
      rangeStart: message.rangeStart,
      rangeEnd: message.rangeEnd,
    });
    this.buffer.sort((a, b) => a.time - b.time);
    this.rangeEnd = message.rangeEnd;
    if (!this.playing) this.mediaTime = message.time;
    this.present();
  }

  private present(): void {
    while (this.buffer.length > 1 && (this.buffer[1]?.time ?? Infinity) <= this.mediaTime) {
      const stale = this.buffer.shift();
      if (stale === undefined) break;
      if (this.shown === stale) this.shown = null;
      stale.bitmap.close();
      this.ack();
    }
    const current = this.buffer[0];
    if (current === undefined || current.time > this.mediaTime + 0.0001) return;
    if (this.shown === current) return;
    this.shown = current;
    this.noteFrame();
    this.options.onFrame({
      bitmap: current.bitmap,
      index: current.index,
      frameCount: current.frameCount,
      time: current.time - current.rangeStart,
      rangeStart: current.rangeStart,
      rangeEnd: current.rangeEnd,
      fps: this.fps,
    });
  }

  private noteFrame(): void {
    const now = performance.now();
    if (this.windowStart === 0) this.windowStart = now;
    this.unique += 1;
    const elapsed = now - this.windowStart;
    if (elapsed < 1000) return;
    this.fps = (this.unique * 1000) / elapsed;
    this.unique = 0;
    this.windowStart = now;
  }

  private ack(): void {
    const command: VideoCommand = { type: "ack" };
    this.worker.postMessage(command);
  }

  private resetBuffer(): void {
    for (const frame of this.buffer) frame.bitmap.close();
    this.buffer = [];
    this.shown = null;
  }
}
