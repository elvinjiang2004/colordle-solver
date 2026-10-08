import { rgbToLab } from '../color/colorConversion';
import type { Quality } from '../types';

const DENSITIES: Record<Quality, number> = { low: 13, medium: 21, high: 31 };
export interface GamutSamples { positions: Float32Array; rgb: Float32Array }

export function sampleGamut(quality: Quality): GamutSamples {
  const n = DENSITIES[quality], positions: number[] = [], rgb: number[] = [];
  for (let r = 0; r < n; r++) for (let g = 0; g < n; g++) for (let b = 0; b < n; b++) {
    const color = [r / (n - 1), g / (n - 1), b / (n - 1)];
    const lab = rgbToLab(color[0], color[1], color[2]);
    positions.push(lab.a, lab.l, lab.b);
    rgb.push(...color);
  }
  return { positions: new Float32Array(positions), rgb: new Float32Array(rgb) };
}
