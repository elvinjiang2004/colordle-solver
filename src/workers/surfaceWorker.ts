import { setGameProfile } from '../color/gameProfile';
import { generateDistanceSurface, surfaceKey } from '../visualization/distanceSurface';
import { continuousEstimate } from '../solver/continuousEstimate';

const cache = new Map<string, Float32Array>();
self.onmessage = ({ data }) => {
  const { type, version } = data;
  try {
    setGameProfile(data.profile);
    if (type === 'surface') {
      const key = surfaceKey(data.hex, data.score, data.quality);
      let positions = cache.get(key);
      if (!positions) {
        positions = generateDistanceSurface(data.hex, data.score, data.quality);
        if (cache.size >= 18) cache.delete(cache.keys().next().value!);
        cache.set(key, positions);
      }
      const copy = positions.slice();
      self.postMessage({ type, version, id: data.id, key, positions: copy }, { transfer: [copy.buffer] });
    } else if (type === 'estimate') {
      const estimate = continuousEstimate(data.observations, data.candidates);
      self.postMessage({ type, version, estimate });
    }
  } catch (error) {
    self.postMessage({ type: 'error', version, message: String(error) });
  }
};
