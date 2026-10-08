import { converter, differenceCiede2000, type Lab65 } from 'culori';
import DeltaE from 'delta-e';
import { hexToLab, type ModelLab } from './colorConversion';
import { gameProfile } from './gameProfile';

const difference = differenceCiede2000();
const toLab65 = converter('lab65');
const converted = new WeakMap<ModelLab, Lab65>();
const deltaLabs = new WeakMap<ModelLab, { L: number; A: number; B: number }>();

function cachedLab65(lab: ModelLab): Lab65 {
  let result = converted.get(lab);
  if (!result) { result = toLab65(lab)!; converted.set(lab, result); }
  return result;
}
function cachedDeltaLab(lab: ModelLab) {
  let result = deltaLabs.get(lab);
  if (!result) {
    result = { L: lab.l, A: lab.a, B: lab.b };
    deltaLabs.set(lab, result);
  }
  return result;
}

export function deltaE00(target: ModelLab, guess: ModelLab): number {
  return gameProfile() === 'ryan'
    ? DeltaE.getDeltaE00(cachedDeltaLab(target), cachedDeltaLab(guess))
    : difference(cachedLab65(target), cachedLab65(guess));
}

export function scoreFromDistance(deltaE: number): number {
  if (gameProfile() === 'ryan') return Number(Math.abs(100 - deltaE).toFixed(2));
  if (Number.isNaN(deltaE)) deltaE = 0;
  return Number(Math.max(0, 100 - deltaE).toFixed(2));
}

/** All exact scores use the active game's unmodified conversion and formula. */
export function colordleScore(target: string | ModelLab, guess: string | ModelLab): number {
  return scoreFromDistance(deltaE00(
    typeof target === 'string' ? hexToLab(target) : target,
    typeof guess === 'string' ? hexToLab(guess) : guess,
  ));
}

export function normalizeScore(value: string | number): number {
  if (typeof value === 'string' && !/^\d+(\.\d+)?$/.test(value.trim())) {
    throw new Error('Enter a percentage between 0 and 100, such as 95.80.');
  }
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error('The score must be between 0 and 100.');
  return Number(score.toFixed(2));
}

/** Approximate geometry only; exact filtering always evaluates the score. */
export function distanceInterval(score: number) {
  const s = normalizeScore(score);
  const censored = gameProfile() === 'osmanyo' && s === 0;
  const center = censored ? 99.995 : 100 - s;
  const centers = gameProfile() === 'ryan' && s > 0 ? [100 - s, 100 + s] : [center];
  return {
    min: censored ? 99.995 : Math.max(0, center - 0.005),
    max: censored ? Infinity : center + 0.005,
    center, centers, censored,
  };
}
