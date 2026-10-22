import { asciiEffect } from "./ascii/index";
import { pixelateEffect } from "./pixelate/index";

export const effects = {
  ascii: asciiEffect,
  pixelate: pixelateEffect,
} as const;

export const effectOrder = [effects.ascii, effects.pixelate] as const;
