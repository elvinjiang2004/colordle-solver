import type { ModelLab as Lab } from '../color/colorConversion';
import { deltaE00, distanceInterval } from '../color/colordleScore';
import { hexToLab, rgbToLab, toRgb } from '../color/colorConversion';
import type { ColorEntry, Observation } from '../types';

export interface ContinuousEstimate {
  lab: Lab;
  rms: number;
}

export function constraints(observations: Observation[]) {
  return observations.map(o => ({ lab: hexToLab(o.guessHex), interval: distanceInterval(o.displayedScore) }));
}

export function residual(lab: Lab, constraint: ReturnType<typeof constraints>[number]): number {
  const d = deltaE00(lab, constraint.lab);
  // Only the Osmanyo profile censors zero scores; Ryan uses the nearest branch.
  if (constraint.interval.censored) return Math.max(0, constraint.interval.min - d);
  return constraint.interval.centers.map(center => d - center).reduce((best, next) => Math.abs(next) < Math.abs(best) ? next : best);
}

export function continuousEstimate(observations: Observation[], candidates: ColorEntry[]): ContinuousEstimate | null {
  if (!observations.length) return null;
  const conditions = constraints(observations);
  const objective = (rgb: number[]) => {
    const lab = rgbToLab(rgb[0], rgb[1], rgb[2]);
    return conditions.reduce((sum, c) => sum + residual(lab, c) ** 2, 0);
  };
  const seeds: { rgb: number[]; loss: number }[] = [];
  for (let r = 0; r <= 6; r++) for (let g = 0; g <= 6; g++) for (let b = 0; b <= 6; b++) {
    const rgb = [r / 6, g / 6, b / 6];
    seeds.push({ rgb, loss: objective(rgb) });
  }
  for (const c of candidates.slice(0, 32)) {
    const rgb = toRgb(c.lab)!;
    const point = [rgb.r, rgb.g, rgb.b].map(v => Math.max(0, Math.min(1, v)));
    seeds.push({ rgb: point, loss: objective(point) });
  }
  seeds.sort((a, b) => a.loss - b.loss);
  let best = seeds[0];
  // Bounded multi-start pattern search in RGB keeps every iterate in sRGB.
  // It is a best-fit diagnostic, without a global-optimum guarantee.
  for (const seed of seeds.slice(0, 12)) {
    let point = [...seed.rgb], loss = seed.loss, step = 0.125;
    for (let iteration = 0; iteration < 220 && step > 0.000002; iteration++) {
      let improved = false;
      for (let axis = 0; axis < 3; axis++) for (const direction of [-1, 1]) {
        const trial = [...point];
        trial[axis] = Math.max(0, Math.min(1, trial[axis] + step * direction));
        const trialLoss = objective(trial);
        if (trialLoss + 1e-15 < loss) { point = trial; loss = trialLoss; improved = true; }
      }
      if (!improved) step /= 2;
    }
    if (loss < best.loss) best = { rgb: point, loss };
  }
  const lab = rgbToLab(best.rgb[0], best.rgb[1], best.rgb[2]);
  return { lab, rms: Math.sqrt(best.loss / observations.length) };
}
