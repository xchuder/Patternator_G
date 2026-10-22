import { ALL_FORMATS, BlobSource, Input, VideoSampleSink, type InputVideoTrack, type VideoSample } from "mediabunny";
import { fitVideoSize } from "../video/fit";
import type { VideoCommand, VideoEvent, VideoFrameMessage } from "../video/messages";

interface WorkerScope {
  addEventListener(type: "message", listener: (event: MessageEvent<VideoCommand>) => void): void;
  postMessage(message: VideoEvent, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

let input: Input | null = null;
let track: InputVideoTrack | null = null;
let sink: VideoSampleSink | null = null;
let generation = 0;
let paused = true;
let queueDepth = 0;
let bufferFrames = 3;
let frameRate = 30;
let outWidth = 1;
let outHeight = 1;
let rangeStart = 0;
let rangeEnd = 0;
let resumeTime = 0;
let epoch = 0;
let iterator: AsyncGenerator<VideoSample, void, unknown> | null = null;
let notify: (() => void) | null = null;

scope.addEventListener("message", (event: MessageEvent<VideoCommand>) => {
  const command = event.data;
  if (command.type === "open") {
    bufferFrames = Math.max(1, command.bufferFrames);
    void openFile(command.file, command.maxWidth, command.maxHeight, command.maxSeconds);
  } else if (command.type === "use") void useRange(command.start, command.seconds, command.epoch);
  else if (command.type === "play") {
    paused = false;
    resumeTime = command.time;
    poke();
    void ensureLoop();
  } else if (command.type === "pause") {
    paused = true;
    poke();
  } else if (command.type === "seek") void seek(command.time, command.epoch);
  else if (command.type === "ack") {
    queueDepth = Math.max(0, queueDepth - 1);
    poke();
  } else if (command.type === "close") {
    stop();
  }
});

async function openFile(file: File, maxWidth: number, maxHeight: number, maxSeconds: number): Promise<void> {
  stop();
  try {
    const next = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    input = next;
    const primary = await next.getPrimaryVideoTrack();
    if (primary === null) {
      post({ type: "error", message: "no-video-track" });
      next.dispose();
      input = null;
      return;
    }
    track = primary;
    const duration = await next.computeDuration();
    const displayWidth = await primary.getDisplayWidth();
    const displayHeight = await primary.getDisplayHeight();
    const fitted = fitVideoSize(displayWidth, displayHeight, maxWidth, maxHeight);
    outWidth = fitted.width;
    outHeight = fitted.height;
    try {
      const stats = await primary.computePacketStats(90);
      frameRate = stats.averagePacketRate > 1 ? stats.averagePacketRate : 30;
    } catch {
      frameRate = 30;
    }
    const slack = 1 / frameRate;
    const info: VideoEvent = {
      type: "info",
      duration,
      displayWidth,
      displayHeight,
      frameRate,
      tooLong: duration > maxSeconds + slack,
    };
    post(info);
  } catch {
    post({ type: "error", message: "read" });
    stop();
  }
}

async function useRange(start: number, seconds: number, nextEpoch: number): Promise<void> {
  if (track === null) return;
  epoch = nextEpoch;
  generation += 1;
  const token = generation;
  queueDepth = 0;
  paused = true;
  await cancelIterator();
  rangeStart = Math.max(0, start);
  rangeEnd = rangeStart + Math.max(0, seconds);
  resumeTime = rangeStart;
  sink = new VideoSampleSink(track);
  await showOne(rangeStart, token);
}

async function seek(time: number, nextEpoch: number): Promise<void> {
  if (sink === null) return;
  epoch = nextEpoch;
  generation += 1;
  const token = generation;
  queueDepth = 0;
  await cancelIterator();
  const clamped = Math.min(Math.max(time, rangeStart), Math.max(rangeStart, rangeEnd - 1e-3));
  resumeTime = clamped;
  await showOne(clamped, token);
  if (!paused) void ensureLoop();
}

async function ensureLoop(): Promise<void> {
  if (sink === null || paused || iterator !== null) return;
  const token = generation;
  const gen = sink.samples(resumeTime, rangeEnd);
  iterator = gen;
  try {
    for await (const sample of gen) {
      if (token !== generation) {
        sample.close();
        return;
      }
      await waitUntil(() => token !== generation || (!paused && queueDepth < bufferFrames));
      if (token !== generation) {
        sample.close();
        return;
      }
      const stamp = sample.timestamp;
      const frameDuration = sample.duration;
      const published = await publish(sample, token);
      if (!published) return;
      resumeTime = stamp + frameDuration;
    }
    if (token === generation) post({ type: "ended" });
  } catch {
    if (token === generation) post({ type: "error", message: "decode" });
  } finally {
    if (iterator === gen) iterator = null;
  }
}

async function showOne(time: number, token: number): Promise<void> {
  if (sink === null) return;
  const sample = await sink.getSample(time);
  if (sample === null) return;
  if (token !== generation) {
    sample.close();
    return;
  }
  await publish(sample, token);
}

async function publish(sample: VideoSample, token: number): Promise<boolean> {
  const frame = sample.toVideoFrame();
  try {
    if (token !== generation) return false;
    const bitmap = await createImageBitmap(frame, {
      resizeWidth: outWidth,
      resizeHeight: outHeight,
      resizeQuality: "low",
    });
    if (token !== generation) {
      bitmap.close();
      return false;
    }
    const span = Math.max(0, rangeEnd - rangeStart);
    const frameCount = Math.max(1, Math.round(span * frameRate));
    const index = Math.min(frameCount, Math.max(1, Math.round((sample.timestamp - rangeStart) * frameRate) + 1));
    const message: VideoFrameMessage = {
      type: "frame",
      bitmap,
      time: sample.timestamp,
      index,
      rangeStart,
      rangeEnd,
      frameCount,
      epoch,
    };
    queueDepth += 1;
    scope.postMessage(message, [bitmap]);
    return true;
  } finally {
    frame.close();
    sample.close();
  }
}

function waitUntil(ready: () => boolean): Promise<void> {
  if (ready()) return Promise.resolve();
  return new Promise((resolve) => {
    const check = (): void => {
      if (ready()) resolve();
      else notify = check;
    };
    notify = check;
  });
}

function poke(): void {
  const pending = notify;
  notify = null;
  pending?.();
}

async function cancelIterator(): Promise<void> {
  const current = iterator;
  iterator = null;
  if (current !== null) await current.return(undefined);
}

function stop(): void {
  generation += 1;
  paused = true;
  queueDepth = 0;
  poke();
  void cancelIterator();
  sink = null;
  track = null;
  input?.dispose();
  input = null;
}

function post(message: VideoEvent): void {
  scope.postMessage(message);
}
