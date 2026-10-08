import { setGameProfile } from '../src/color/gameProfile';
setGameProfile('osmanyo');
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { converter, differenceCiede2000, parse } from 'culori';
import { colordleScore, deltaE00, distanceInterval, normalizeScore, scoreFromDistance } from '../src/color/colordleScore';
import { hexToLab, normalizeHex } from '../src/color/colorConversion';
import { parseDictionary, targetPool } from '../src/color/dictionary';
import { filterCandidates } from '../src/solver/filterCandidates';
import type { Observation } from '../src/types';

const csv = readFileSync(new URL('../src/data/colornames.csv', import.meta.url), 'utf8');
const all = parseDictionary(csv);
const pool = targetPool(all);

test('CSV entries and target eligibility match the upstream parser exactly', () => {
  const upstream = csv.split('\n').slice(1).map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split(',');
    return { name: parts[0].trim().replace(/"/g, ''), hex: parts[1].trim(), isGood: Boolean(parts[2] && parts[2].trim().toLowerCase() === 'x') };
  });
  assert.deepEqual(all.map(({ name, hex, isGood }) => ({ name, hex, isGood })), upstream);
  assert.equal(all.length, 30020);
  assert.equal(pool.length, 4736);
  assert.equal(createHash('sha256').update(csv).digest('hex'), '26b4dd64ac4778ece55777e82450d63f2aa021a8fd91f331c293b45029e774d7');
  assert.ok(pool.length > 0 && pool.length < all.length);
  assert.ok(pool.every(c => c.isGood));
  const uncurated = all.slice(0, 2).map(c => ({ ...c, isGood: false }));
  assert.deepEqual(targetPool(uncurated), uncurated);
});

test('2,000 color pairs reproduce Colordle formatting with the pinned Culori functions', () => {
  const convert = converter('lab');
  const difference = differenceCiede2000();
  for (let i = 0; i < 2000; i++) {
    const a = all[(i * 137) % all.length];
    const b = all[(i * 971 + 19) % all.length];
    let distance = difference(convert(parse(a.hex)!)!, convert(parse(b.hex)!)!);
    if (isNaN(distance)) distance = 0;
    const expected = Number(Math.max(0, 100 - distance).toFixed(2));
    assert.equal(deltaE00(a.lab, b.lab), distance);
    assert.equal(colordleScore(a.hex, b.hex), expected);
    assert.equal(colordleScore(a.lab, b.lab), expected);
    assert.ok(Math.abs(deltaE00(a.lab, b.lab) - deltaE00(b.lab, a.lab)) < 1e-10);
  }
});

test('CIEDE2000 agrees with an independent published Sharma test pair', () => {
  const a = { mode: 'lab65' as const, l: 50, a: 2.6772, b: -79.7751 };
  const b = { mode: 'lab65' as const, l: 50, a: 0, b: -82.7485 };
  assert.ok(Math.abs(deltaE00(a, b) - 2.0425) < 0.00005);
});

test('true hidden targets survive and information is monotone across observations', () => {
  for (let trial = 0; trial < 24; trial++) {
    const target = pool[(trial * 233) % pool.length];
    const observations: Observation[] = [];
    let previous = new Set(pool.map(c => c.id));
    for (let j = 0; j < 4; j++) {
      const guess = all[(trial * 733 + j * 4171) % all.length];
      observations.push({ id: j, guessHex: guess.hex, displayedScore: colordleScore(target.lab, guess.lab) });
      const { candidates } = filterCandidates(pool, observations);
      assert.ok(candidates.some(c => c.id === target.id));
      assert.ok(candidates.every(c => previous.has(c.id)));
      previous = new Set(candidates.map(c => c.id));
    }
  }
});

test('identical targets score 100 and aliases remain separate named candidates', () => {
  const target = pool[57];
  assert.equal(colordleScore(target.lab, target.lab), 100);
  const aliases = [target, { ...target, id: -1, name: 'Same hex, different name' }];
  assert.equal(filterCandidates(aliases, [{ id: 1, guessHex: target.hex, displayedScore: 100 }]).candidates.length, 2);
});

test('JS .005 boundaries and zero censoring are preserved', () => {
  assert.equal(scoreFromDistance(4.005 - 1e-10), 96);
  assert.equal(scoreFromDistance(4.005 + 1e-10), 95.99);
  assert.equal(scoreFromDistance(99.995 - 1e-10), 0.01);
  assert.equal(scoreFromDistance(99.995 + 1e-10), 0);
  for (const d of [0.005, 4.005, 12.345, 99.995, 100, 120]) {
    assert.equal(scoreFromDistance(d), Number(Math.max(0, 100 - d).toFixed(2)));
  }
  assert.equal(scoreFromDistance(NaN), 100);
  assert.equal(distanceInterval(0).max, Infinity);
  assert.equal(distanceInterval(100).min, 0);
  assert.equal(colordleScore('#000000', '#ffffff'), 0);
  const zero = filterCandidates(all, [{ id: 1, guessHex: '#00ff00', displayedScore: 0 }]);
  assert.ok(zero.candidates.length > 0);
  assert.ok(zero.candidates.every(c => colordleScore(c.lab, hexToLab('#00ff00')) === 0));
});

test('input scores and hex colors normalize; invalid values are rejected', () => {
  for (const input of ['95.8', '95.80', 95.8]) assert.equal(normalizeScore(input), 95.8);
  assert.equal(normalizeScore('95'), 95);
  for (const input of ['', ' ', '-1', '101', 'NaN', '1e2', Infinity]) assert.throws(() => normalizeScore(input));
  assert.equal(normalizeHex('#aBc'), '#AABBCC');
  assert.throws(() => normalizeHex('#abcd'));
});

test('editing/removing observations recomputes from the whole target pool', () => {
  const target = pool[3];
  const obs = { id: 1, guessHex: target.hex, displayedScore: 100 };
  assert.ok(filterCandidates(pool, [obs]).candidates.length < pool.length);
  assert.equal(filterCandidates(pool, []).candidates.length, pool.length);
  assert.equal(filterCandidates(pool, [obs, { ...obs, id: 2, displayedScore: 0 }]).candidates.length, 0);
});
