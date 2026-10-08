import './style.css';
import { loadDictionary } from './color/loadDictionary';
import { gameProfile, setGameProfile, type GameProfile } from './color/gameProfile';
import { targetPool } from './color/dictionary';
import { normalizeScore } from './color/colordleScore';
import { filterCandidates } from './solver/filterCandidates';
import type { ContinuousEstimate } from './solver/continuousEstimate';
import { LabScene } from './visualization/scene';
import { renderLayout } from './ui/layout';
import { setupAutocomplete } from './ui/autocomplete';
import { CandidateTable, describeColor } from './ui/candidateTable';
import { renderHistory } from './ui/history';
import { element } from './ui/format';
import { SHELL_COLORS, type ColorEntry, type Observation, type Quality } from './types';

renderLayout(element('app'));
let dictionary = loadDictionary();
let pool = targetPool(dictionary);
const autocomplete = setupAutocomplete(dictionary);
let observations: Observation[] = [], candidates = pool;
let selectedId: number | null = null, editId: number | null = null;
let nextId = 1, geometryVersion = 0, pendingSurfaces = 0;
let quality: Quality = 'medium';
let scene: LabScene | null = null;
const table = new CandidateTable(showCandidate);
const surfaceWorker = new Worker(new URL('./workers/surfaceWorker.ts', import.meta.url), { type: 'module' });

try {
  scene = new LabScene(element('scene'), item => {
    if ('guessHex' in item) selectGuess(item.id);
    else showCandidate(item);
  });
} catch {
  element('scene').insertAdjacentHTML('beforeend', '<p class="webgl-error">3D rendering is unavailable in this browser. The candidate table still works.</p>');
  element('geometry-status').textContent = 'WebGL unavailable';
}
element('scene').addEventListener('scene-error', event => {
  showGeometryError((event as CustomEvent<string>).detail);
});

function showCandidate(entry: ColorEntry) {
  table.select(entry);
  scene?.selectCandidate(entry);
  const tooltip = element('scene-tooltip');
  tooltip.innerHTML = '<button class="tooltip-close" aria-label="Close color details">×</button><div class="tooltip-content">' + describeColor(entry, observations) + '</div>';
  tooltip.hidden = false;
  tooltip.querySelector('button')!.addEventListener('click', () => { tooltip.hidden = true; });
}

function selectGuess(id: number) {
  selectedId = selectedId === id ? null : id;
  scene?.highlight(selectedId);
  renderHistory(observations, selectedId);
}

function resetForm() {
  editId = null;
  element<HTMLInputElement>('guess').value = '';
  element<HTMLInputElement>('score').value = '';
  element('submit-observation').textContent = 'Add observation';
  element('cancel-edit').hidden = true;
  element('form-error').hidden = true;
  autocomplete.reset();
}

function showGeometryError(message: string) {
  const status = element('geometry-status');
  status.className = 'geometry-error';
  status.textContent = message;
}

function requestGeometry() {
  element('geometry-status').className = 'sr-only';
  const ticket = ++geometryVersion;
  scene?.clearSurfaces();
  pendingSurfaces = observations.length;
  if (!observations.length) {
    if (scene) element('geometry-status').textContent = 'sRGB gamut';
    return;
  }
  if (scene) element('geometry-status').textContent = 'Computing distance geometry…';
  surfaceWorker.postMessage({ type: 'estimate', version: ticket, observations, candidates, profile: gameProfile() });
  observations.forEach(o => surfaceWorker.postMessage({ type: 'surface', version: ticket, id: o.id, hex: o.guessHex, score: o.displayedScore, quality, profile: gameProfile() }));
}

function recompute() {
  pool = element<HTMLSelectElement>('target-scope').value === 'all' ? dictionary : targetPool(dictionary);
  scene?.setDictionary(dictionary, pool);
  updateProfileLabels();
  ({ candidates } = filterCandidates(pool, observations));
  renderHistory(observations, selectedId);
  table.setCandidates(candidates, observations);
  element('scene-tooltip').hidden = true;
  scene?.setState(candidates, observations);
  scene?.highlight(selectedId);
  requestGeometry();
}

surfaceWorker.onerror = () => showGeometryError('Geometry worker unavailable');

surfaceWorker.onmessage = ({ data }) => {
  if (data.version !== geometryVersion) return;
  if (data.type === 'surface') {
    const index = observations.findIndex(o => o.id === data.id);
    if (index >= 0) scene?.addSurface(data.id, data.positions, SHELL_COLORS[index % SHELL_COLORS.length]);
    pendingSurfaces--;
    if (!pendingSurfaces && scene) element('geometry-status').textContent = 'Numerical shells · ' + quality + ' quality';
  } else if (data.type === 'estimate') {
    const estimate: ContinuousEstimate | null = data.estimate;
    table.setEstimate(estimate);
  } else if (data.type === 'error') {
    showGeometryError('Geometry could not be computed');
  }
};

element('observation-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const guess = autocomplete.resolve();
    const score = normalizeScore(element<HTMLInputElement>('score').value);
    const observation = { id: editId ?? nextId++, guessHex: guess.hex, guessName: guess.name, displayedScore: score };
    if (editId === null) observations.push(observation);
    else observations = observations.map(o => o.id === editId ? observation : o);
    selectedId = null;
    resetForm(); recompute(); element('guess').focus();
  } catch (error) {
    element('form-error').textContent = error instanceof Error ? error.message : String(error);
    element('form-error').hidden = false;
  }
});
element('cancel-edit').addEventListener('click', resetForm);
element('history').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button) return;
  if (button.dataset.select) selectGuess(Number(button.dataset.select));
  if (button.dataset.remove) {
    const id = Number(button.dataset.remove);
    observations = observations.filter(o => o.id !== id);
    if (selectedId === id) selectedId = null;
    if (editId === id) resetForm();
    recompute();
  }
  if (button.dataset.edit) {
    const observation = observations.find(o => o.id === Number(button.dataset.edit))!;
    editId = observation.id;
    element<HTMLInputElement>('guess').value = observation.guessName ?? observation.guessHex;
    element<HTMLInputElement>('score').value = observation.displayedScore.toFixed(2);
    element('submit-observation').textContent = 'Save change';
    element('cancel-edit').hidden = false;
    autocomplete.preview(); element('score').focus();
  }
});
element('reset').addEventListener('click', () => {
  observations = []; selectedId = null; resetForm(); recompute();
});
element('reset-camera').addEventListener('click', () => scene?.resetCamera());
document.querySelectorAll<HTMLInputElement>('[data-layer]').forEach(input => {
  input.addEventListener('change', () => scene?.setLayer(input.dataset.layer as Parameters<LabScene['setLayer']>[0], input.checked));
});
element('opacity').addEventListener('input', event => scene?.setOpacity(Number((event.target as HTMLInputElement).value)));
element('point-size').addEventListener('input', event => scene?.setPointSize(Number((event.target as HTMLInputElement).value)));
element('quality').addEventListener('change', event => {
  quality = (event.target as HTMLSelectElement).value as Quality;
  scene?.setQuality(quality); requestGeometry();
});
element('game-profile').addEventListener('change', event => {
  setGameProfile((event.target as HTMLSelectElement).value as GameProfile);
  dictionary = loadDictionary();
  observations = []; selectedId = null;
  element<HTMLSelectElement>('target-scope').value = 'eligible';
  autocomplete.setDictionary(dictionary);
  resetForm();
  scene?.setQuality(quality);
  recompute();
});
element('target-scope').addEventListener('change', () => { selectedId = null; recompute(); });

function updateProfileLabels() {
  element<HTMLSelectElement>('target-scope').options[0].textContent = gameProfile() === 'ryan'
    ? 'Daily target pool (all dates)' : 'Curated targets';
}

window.addEventListener('pagehide', () => { surfaceWorker.terminate(); scene?.dispose(); });
recompute();
