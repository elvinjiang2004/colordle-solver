import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRyanDictionary, targetPool } from '../src/color/dictionary';
import { setGameProfile, normalizeName } from '../src/color/gameProfile';
import { colordleScore, deltaE00, distanceInterval, scoreFromDistance } from '../src/color/colordleScore';
import { hexToLab, rgbToLab, toRgb, inGamut } from '../src/color/colorConversion';
import { filterCandidates } from '../src/solver/filterCandidates';
import { constraints, residual, continuousEstimate } from '../src/solver/continuousEstimate';
import { surfaceKey, generateDistanceSurface } from '../src/visualization/distanceSurface';
import type { Observation } from '../src/types';

setGameProfile('ryan');
const raw = JSON.parse(readFileSync(new URL('../src/data/ryan-colornames.json', import.meta.url), 'utf8'));
const dictionary = parseRyanDictionary(raw);
const pool = targetPool(dictionary);
const fixtures: { target: string; guess: string; score: number }[] = JSON.parse(readFileSync(new URL('./ryan-score-fixtures.json', import.meta.url), 'utf8'));

test('reported Silver/Green and Pig Pink/Aurora regressions preserve the true targets exactly', () => {
  for (const [targetName, guessName, score] of [['Silver', 'Green', 66.87], ['Pig Pink', 'Aurora', 60.33]] as const) {
    const target = pool.find(c => c.name === targetName)!;
    const guess = dictionary.find(c => c.name === guessName)!;
    assert.ok(target && guess);
    assert.equal(colordleScore(target.lab, guess.lab), score);
    assert.ok(filterCandidates(pool, [{ id: 1, guessHex: guess.hex, displayedScore: score }]).candidates.some(c => c.id === target.id));
    assert.ok(!filterCandidates(pool, [{ id: 1, guessHex: guess.hex, displayedScore: score + 0.01 }]).candidates.some(c => c.id === target.id));
  }
});

test('2,000 independent fixtures from the deployed source match the Ryan profile', () => {
  assert.equal(fixtures.length, 2000);
  for (const pair of fixtures) assert.equal(colordleScore(pair.target, pair.guess), pair.score, pair.target + ' / ' + pair.guess);
});

test('Ryan name lookup ignores spaces and retains the first normalized-name match', () => {
  assert.equal(raw.length, 31900);
  assert.equal(normalizeName(' Pig Pink '), 'pigpink');
  const aliases = parseRyanDictionary([
    { name: 'Pig Pink', hex: '#fdd7e4', isGood: true },
    { name: 'PigPink', hex: '#ffffff', isGood: true },
  ]);
  assert.equal(aliases.length, 1);
  assert.equal(aliases[0].hex, '#fdd7e4');
  assert.ok(pool.every(c => c.isGood));
});

test('Ryan uses absolute value and two distance branches rather than censoring at zero', () => {
  assert.equal(scoreFromDistance(120), 20);
  assert.equal(scoreFromDistance(80), 20);
  assert.deepEqual(distanceInterval(20).centers, [80, 120]);
  assert.equal(distanceInterval(0).censored, false);
  assert.equal(distanceInterval(0).max, 100.005);
  const condition = constraints([{ id: 1, guessHex: '#00ff00', displayedScore: 0 }])[0];
  const far = hexToLab('#ff00ff');
  assert.ok(deltaE00(far, condition.lab) > 100);
  assert.ok(Math.abs(residual(far, condition)) > 1);
  const reflected = colordleScore(far, condition.lab);
  const branch = constraints([{ id: 1, guessHex: '#00ff00', displayedScore: reflected }])[0];
  assert.ok(Math.abs(residual(far, branch)) < 0.0051);
});

test('valid observations narrow the Ryan pool and never discard synthetic targets', () => {
  for (let trial = 0; trial < 16; trial++) {
    const target = pool[(trial * 53) % pool.length], observations: Observation[] = [];
    let previous = new Set(pool.map(c => c.id));
    for (let j = 0; j < 4; j++) {
      const guess = dictionary[(trial * 731 + j * 4999) % dictionary.length];
      observations.push({ id: j, guessHex: guess.hex, displayedScore: colordleScore(target.lab, guess.lab) });
      const result = filterCandidates(pool, observations).candidates;
      assert.ok(result.some(c => c.id === target.id));
      assert.ok(result.every(c => previous.has(c.id)));
      previous = new Set(result.map(c => c.id));
    }
  }
});

test('Ryan geometry inverse returns original RGB, including low-light colors', () => {
  for (const original of [[0, 0, 0], [1, 1, 1], [0, 1, 0], [0.002, 0.004, 0.008], [0.2, 0.5, 0.9]]) {
    const lab = rgbToLab(original[0], original[1], original[2]);
    assert.ok(inGamut(lab));
    const rgb = toRgb(lab);
    [rgb.r, rgb.g, rgb.b].forEach((v, i) => assert.ok(Math.abs(v - original[i]) < 1e-5));
  }
});

test('Ryan zero-score mesh is a thin central constraint and its fit stays in gamut', () => {
  assert.ok(generateDistanceSurface('#00ff00', 0, 'low').length > 0);
  const fit = continuousEstimate([{ id: 1, guessHex: '#ffffff', displayedScore: 0 }], []);
  assert.ok(fit && inGamut(fit.lab));
  assert.ok(fit.rms < 0.01);
});

test('surface caches cannot collide between versions', () => {
  const key = surfaceKey('#00ff00', 66.87, 'low');
  setGameProfile('osmanyo');
  assert.notEqual(surfaceKey('#00ff00', 66.87, 'low'), key);
  assert.equal(colordleScore('#c0c0c0', '#00ff00'), 66.89);
  assert.equal(scoreFromDistance(120), 0);
  setGameProfile('ryan');
  assert.equal(colordleScore('#c0c0c0', '#00ff00'), 66.87);
});
