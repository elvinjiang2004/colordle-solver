import type { ColorEntry, Observation } from '../types';
import type { ContinuousEstimate } from '../solver/continuousEstimate';
import { colordleScore, deltaE00 } from '../color/colordleScore';
import { hexToLab } from '../color/colorConversion';
import { element, escapeHtml, number, swatch } from './format';

export function describeColor(entry: ColorEntry, observations: Observation[]) {
  const scores = observations.map((o, i) => '#' + (i + 1) + ': ' + colordleScore(entry.lab, hexToLab(o.guessHex)).toFixed(2) + '%').join(' · ');
  return swatch(entry.hex, 'detail-swatch') + '<div><strong>' + escapeHtml(entry.name) + '</strong><span class="mono">' + entry.hex.toUpperCase() + '</span><p>L* ' + entry.lab.l.toFixed(2) + ' · a* ' + entry.lab.a.toFixed(2) + ' · b* ' + entry.lab.b.toFixed(2) + '</p>' + (scores ? '<p>Predicted scores ' + scores + '</p>' : '') + '</div>';
}

export class CandidateTable {
  private candidates: ColorEntry[] = [];
  private observations: Observation[] = [];
  private estimate: ContinuousEstimate | null = null;
  private page = 0;
  private pageSize = 12;
  constructor(private onSelect: (entry: ColorEntry) => void) {
    element('candidate-sort').addEventListener('change', () => { this.page = 0; this.render(); });
    element('previous-page').addEventListener('click', () => { this.page--; this.render(); });
    element('next-page').addEventListener('click', () => { this.page++; this.render(); });
    element('candidate-body').addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-candidate]');
      if (!button) return;
      const entry = this.candidates.find(c => c.id === Number(button.dataset.candidate));
      if (entry) this.onSelect(entry);
    });
  }
  setCandidates(candidates: ColorEntry[], observations: Observation[]) {
    this.candidates = candidates; this.observations = observations; this.estimate = null; this.page = 0;
    element('candidate-detail').hidden = true; this.render();
  }
  setEstimate(estimate: ContinuousEstimate | null) {
    this.estimate = estimate;
    if (element<HTMLSelectElement>('candidate-sort').value === 'estimate') this.render();
  }
  select(entry: ColorEntry) {
    const box = element('candidate-detail');
    box.innerHTML = describeColor(entry, this.observations); box.hidden = false;
  }
  private render() {
    const sort = element<HTMLSelectElement>('candidate-sort').value;
    const latest = this.observations.at(-1);
    const lab = sort === 'estimate' ? this.estimate?.lab : sort === 'latest' && latest ? hexToLab(latest.guessHex) : null;
    const sorted = this.candidates.map(c => ({ c, distance: lab ? deltaE00(c.lab, lab) : 0 }))
      .sort((a, b) => a.distance - b.distance || a.c.name.localeCompare(b.c.name));
    this.page = Math.max(0, Math.min(this.page, Math.ceil(sorted.length / this.pageSize) - 1));
    const start = this.page * this.pageSize;
    const guesses = this.observations.map(o => hexToLab(o.guessHex));
    element('candidate-total').textContent = number(sorted.length);
    element('candidate-head').innerHTML = '<tr><th scope="col">Color / name</th><th scope="col">Hex</th>' +
      this.observations.map((o, i) => '<th scope="col" title="' + escapeHtml(o.guessName ?? o.guessHex) + '">Guess ' + (i + 1) + '</th>').join('') +
      (lab ? '<th scope="col">ΔE00</th>' : '') + '</tr>';
    element('candidate-body').innerHTML = sorted.length ? sorted.slice(start, start + this.pageSize).map(({ c, distance }) =>
      '<tr><td><button class="candidate-name" data-candidate="' + c.id + '">' + swatch(c.hex) + escapeHtml(c.name) + '</button></td><td class="mono">' + c.hex.toUpperCase() + '</td>' +
      guesses.map(guess => '<td class="score-cell">' + colordleScore(c.lab, guess).toFixed(2) + '%</td>').join('') +
      (lab ? '<td class="mono">' + distance.toFixed(3) + '</td>' : '') + '</tr>').join('') :
      '<tr><td colspan="' + (2 + guesses.length + Number(Boolean(lab))) + '" class="empty-table">No eligible target matches these observations. Check the scores, guess hex values, and the selected Colordle version and target pool.</td></tr>';
    element('page-label').textContent = sorted.length ? number(start + 1) + '–' + number(Math.min(start + this.pageSize, sorted.length)) + ' of ' + number(sorted.length) : '0 candidates';
    element<HTMLButtonElement>('previous-page').disabled = this.page === 0;
    element<HTMLButtonElement>('next-page').disabled = start + this.pageSize >= sorted.length;
  }
}
