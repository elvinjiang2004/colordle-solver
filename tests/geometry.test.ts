import { setGameProfile } from '../src/color/gameProfile';
setGameProfile('osmanyo');
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractIsosurface, generateDistanceSurface, BOUNDS } from '../src/visualization/distanceSurface';
import { deltaE00 } from '../src/color/colordleScore';
import { hexToLab, inGamut } from '../src/color/colorConversion';
import { continuousEstimate } from '../src/solver/continuousEstimate';

test('tetrahedra correctly interpolate an oblique plane', () => {
  const vertices = extractIsosurface(([x, y, z]) => x + 2 * y - z, 5, [[-1, -1, -1], [1, 1, 1]]);
  assert.ok(vertices.length > 0 && vertices.length % 9 === 0);
  for (let i = 0; i < vertices.length; i += 3) {
    assert.ok(Math.abs(vertices[i] + 2 * vertices[i + 1] - vertices[i + 2]) < 1e-6);
  }
});

test('generated shell approximates the actual Culori scalar field and is not a Lab sphere', () => {
  const guess = hexToLab('#c93f38');
  const positions = generateDistanceSurface('#c93f38', 80, 'high');
  assert.ok(positions.length > 100);
  const errors: number[] = [], radii: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const lab = { mode: 'lab' as const, a: positions[i], l: positions[i + 1], b: positions[i + 2] };
    errors.push(Math.abs(deltaE00(lab, guess) - 20));
    radii.push(Math.hypot(lab.a - guess.a, lab.l - guess.l, lab.b - guess.b));
    assert.ok(lab.l >= BOUNDS[0][1] && lab.l <= BOUNDS[1][1]);
  }
  errors.sort((a, b) => a - b);
  assert.ok(errors[Math.floor(errors.length * 0.95)] < 0.3);
  assert.ok(Math.max(...radii) - Math.min(...radii) > 10);
  assert.equal(generateDistanceSurface('#c93f38', 100, 'low').length, 0);
});

test('continuous estimate stays in gamut and treats zero as a one-sided constraint', () => {
  const fit = continuousEstimate([{ id: 1, guessHex: '#ffffff', displayedScore: 0 }], []);
  assert.ok(fit && inGamut(fit.lab));
  assert.ok(fit.rms < 0.01);
  assert.equal(continuousEstimate([], []), null);
});
