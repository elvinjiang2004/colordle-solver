import { colordleScore, normalizeScore } from '../color/colordleScore';
import { hexToLab } from '../color/colorConversion';
import type { ColorEntry, Observation } from '../types';

export function filterCandidates(pool: ColorEntry[], observations: Observation[]) {
  let candidates = pool;
  for (const observation of observations) {
    const lab = hexToLab(observation.guessHex);
    const score = normalizeScore(observation.displayedScore);
    candidates = candidates.filter(c => colordleScore(c.lab, lab) === score);
  }
  return { candidates };
}
