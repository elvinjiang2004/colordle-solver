import csv from '../data/colornames.csv?raw';
import ryanDictionary from '../data/ryan-colornames.json';
import { gameProfile } from './gameProfile';
import { parseDictionary, parseRyanDictionary } from './dictionary';

export function loadDictionary() {
  return gameProfile() === 'ryan' ? parseRyanDictionary(ryanDictionary) : parseDictionary(csv);
}
