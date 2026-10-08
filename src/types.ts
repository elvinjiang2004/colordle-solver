import type { ModelLab as Lab } from './color/colorConversion';

export interface ColorEntry {
  id: number;
  name: string;
  hex: string;
  isGood: boolean;
  lab: Lab;
}

export interface Observation {
  id: number;
  guessName?: string;
  guessHex: string;
  displayedScore: number;
}

export type Quality = 'low' | 'medium' | 'high';
export const SHELL_COLORS = ['#8dbbff', '#ffc080', '#c9a3ff', '#70dfcd', '#ff91b0', '#e3df8d'];
