import type { DitherParams } from "../../data/defaults";

export interface DitherRequest {
  id: number;
  width: number;
  height: number;
  pixels: Uint8Array;
  params: DitherParams;
}

export type DitherResponse =
  | { id: number; dropped: true }
  | { id: number; dropped: false; width: number; height: number; pixels: Uint8ClampedArray };
