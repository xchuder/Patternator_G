import { asciiEffect } from "./ascii/index";
import { ditherEffect } from "./dither/index";
import { pixelateEffect } from "./pixelate/index";

export const effects = {
  ascii: asciiEffect,
  pixelate: pixelateEffect,
  dither: ditherEffect,
} as const;

export const effectOrder = [effects.ascii, effects.pixelate, effects.dither] as const;
