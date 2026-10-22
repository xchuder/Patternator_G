import { applyDither } from "../effects/dither/diffuse";
import type { DitherRequest, DitherResponse } from "../effects/dither/job";

interface WorkerScope {
  addEventListener(type: "message", listener: (event: MessageEvent<DitherRequest>) => void): void;
  postMessage(message: DitherResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

let running = false;
let queued: DitherRequest | null = null;

scope.addEventListener("message", (event: MessageEvent<DitherRequest>) => {
  if (queued !== null) {
    const dropped: DitherResponse = { id: queued.id, dropped: true };
    scope.postMessage(dropped);
  }
  queued = event.data;
  pump();
});

function pump(): void {
  if (running || queued === null) return;
  const job = queued;
  queued = null;
  running = true;
  const pixels = applyDither(job.pixels, job.width, job.height, job.params);
  running = false;
  const done: DitherResponse = {
    id: job.id,
    dropped: false,
    width: job.width,
    height: job.height,
    pixels,
  };
  const buffer = pixels.buffer;
  if (!(buffer instanceof ArrayBuffer)) throw new Error("Expected an ArrayBuffer");
  scope.postMessage(done, [buffer]);
  pump();
}
