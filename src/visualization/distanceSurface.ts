import { gameProfile } from '../color/gameProfile';
import type { ModelLab as Lab } from '../color/colorConversion';
import { deltaE00, distanceInterval } from '../color/colordleScore';
import { hexToLab, inGamut, labPoint } from '../color/colorConversion';
import type { Quality } from '../types';

export const RESOLUTIONS: Record<Quality, number> = { low: 20, medium: 30, high: 44 };
export type Point3 = [number, number, number];
// World coordinates are (a*, L*, b*); these bounds enclose both profiles' sRGB gamuts.
export const BOUNDS: [Point3, Point3] = [[-90, 0, -115], [105, 100, 105]];
const tetrahedra = [[0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6], [0, 5, 1, 6]];
const corners: Point3[] = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];

/** Marching tetrahedra: a zero-level extractor on a regular Lab scalar grid. */
export function extractIsosurface(
  field: (point: Point3) => number, resolution: number,
  bounds = BOUNDS, keep: (point: Point3) => boolean = () => true,
): Float32Array {
  const n = resolution, stride = n + 1;
  const index = (x: number, y: number, z: number) => x + stride * (y + stride * z);
  const coord = (x: number, y: number, z: number): Point3 => [x, y, z].map((v, axis) =>
    bounds[0][axis] + v / n * (bounds[1][axis] - bounds[0][axis])) as Point3;
  const values = new Float64Array(stride ** 3);
  for (let z = 0; z <= n; z++) for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) {
    values[index(x, y, z)] = field(coord(x, y, z));
  }
  const vertices: number[] = [];
  const emit = (a: Point3, b: Point3, c: Point3) => {
    const center = a.map((v, i) => (v + b[i] + c[i]) / 3) as Point3;
    if (keep(center)) vertices.push(...a, ...b, ...c);
  };
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const positions = corners.map(([dx, dy, dz]) => coord(x + dx, y + dy, z + dz));
    const cell = corners.map(([dx, dy, dz]) => values[index(x + dx, y + dy, z + dz)]);
    if (cell.every(v => v >= 0) || cell.every(v => v < 0)) continue;
    for (const tet of tetrahedra) {
      const inside = tet.filter(i => cell[i] < 0), outside = tet.filter(i => cell[i] >= 0);
      if (!inside.length || !outside.length) continue;
      const cross = (a: number, b: number): Point3 => {
        const t = cell[a] / (cell[a] - cell[b]);
        return positions[a].map((v, axis) => v + t * (positions[b][axis] - v)) as Point3;
      };
      if (inside.length === 1) {
        emit(cross(inside[0], outside[0]), cross(inside[0], outside[1]), cross(inside[0], outside[2]));
      } else if (outside.length === 1) {
        emit(cross(outside[0], inside[0]), cross(outside[0], inside[2]), cross(outside[0], inside[1]));
      } else {
        const a = cross(inside[0], outside[0]), b = cross(inside[0], outside[1]);
        const c = cross(inside[1], outside[0]), d = cross(inside[1], outside[1]);
        emit(a, b, c); emit(b, d, c);
      }
    }
  }
  return new Float32Array(vertices);
}

export function generateDistanceSurface(hex: string, score: number, quality: Quality): Float32Array {
  const guess = hexToLab(hex), interval = distanceInterval(score);
  const lab = ([a, l, b]: Point3): Lab => labPoint(l, a, b);
  // Ryan's absolute-value score can have two distance branches. Extract each.
  const surfaces = interval.centers.filter(d => d > 0).map(distance => extractIsosurface(
    p => deltaE00(lab(p), guess) - distance, RESOLUTIONS[quality], BOUNDS,
    p => inGamut(lab(p), 0.035),
  ));
  const positions = new Float32Array(surfaces.reduce((size, surface) => size + surface.length, 0));
  let offset = 0;
  for (const surface of surfaces) { positions.set(surface, offset); offset += surface.length; }
  return positions;
}

export function surfaceKey(hex: string, score: number, quality: Quality): string {
  return gameProfile() + ':' + hex.toLowerCase() + ':' + score.toFixed(2) + ':' + RESOLUTIONS[quality];
}