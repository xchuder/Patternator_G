import type { DitherParams } from "../../data/defaults";
import type { DitherRequest, DitherResponse } from "./job";

export interface DitherJob {
  width: number;
  height: number;
  pixels: Uint8Array;
  params: DitherParams;
}

export class DitherWorkerClient {
  private readonly worker: Worker;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (value: Uint8ClampedArray | null) => void; reject: (error: Error) => void }
  >();

  constructor() {
    this.worker = new Worker(new URL("../../workers/dither.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.addEventListener("message", (event: MessageEvent<DitherResponse>) => {
      const message = event.data;
      const slot = this.pending.get(message.id);
      if (slot === undefined) return;
      this.pending.delete(message.id);
      slot.resolve(message.dropped ? null : message.pixels);
    });
    this.worker.addEventListener("error", () => {
      for (const slot of this.pending.values()) slot.reject(new Error("Dither worker failed"));
      this.pending.clear();
    });
  }

  run(job: DitherJob): Promise<Uint8ClampedArray | null> {
    const id = this.nextId;
    this.nextId += 1;
    const payload: DitherRequest = { id, ...job };
    const promise = new Promise<Uint8ClampedArray | null>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.worker.postMessage(payload, [job.pixels.buffer]);
    return promise;
  }

  dispose(): void {
    this.worker.terminate();
    for (const slot of this.pending.values()) slot.reject(new Error("Dither worker stopped"));
    this.pending.clear();
  }
}
