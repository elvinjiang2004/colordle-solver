declare module 'color-space/rgb.js' {
  const rgb: { xyz(value: number[]): number[] };
  export default rgb;
}
declare module 'color-space/xyz.js' {
  const xyz: { lab(value: number[]): number[] };
  export default xyz;
}
declare module 'color-space/lab.js';
declare module 'delta-e' {
  interface DeltaLab { L: number; A: number; B: number }
  const DeltaE: { getDeltaE00(a: DeltaLab, b: DeltaLab): number };
  export default DeltaE;
}
