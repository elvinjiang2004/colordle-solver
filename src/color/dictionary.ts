import { hexToLab } from './colorConversion';
import type { ColorEntry } from '../types';

export function parseDictionary(csv: string): ColorEntry[] {
  const result: ColorEntry[] = [];
  for (const raw of csv.split('\n').slice(1)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 2) continue;
    const hex = parts[1].trim();
    result.push({
      id: result.length, name: parts[0].trim().replace(/"/g, ''),
      hex, isGood: Boolean(parts[2] && parts[2].trim().toLowerCase() === 'x'), lab: hexToLab(hex),
    });
  }
  return result;
}

export function parseRyanDictionary(entries: { name: string; hex: string; isGood: boolean }[]): ColorEntry[] {
  const seen = new Set<string>(), result: ColorEntry[] = [];
  for (const entry of entries) {
    const key = entry.name.toLowerCase().replace(/ /g, '');
    // Ryan's name lookup returns the first match, including in custom games.
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...entry, id: result.length, lab: hexToLab(entry.hex) });
  }
  return result;
}

export function targetPool(dictionary: ColorEntry[]): ColorEntry[] {
  const good = dictionary.filter(c => c.isGood);
  return good.length ? good : dictionary;
}
