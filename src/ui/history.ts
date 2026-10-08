import { SHELL_COLORS, type Observation } from '../types';
import { element, escapeHtml, swatch } from './format';

export function renderHistory(observations: Observation[], selectedId: number | null) {
  element('history').innerHTML = observations.map((observation, i) =>
    '<div class="history-item ' + (observation.id === selectedId ? 'selected' : '') + '" style="--shell-color:' + SHELL_COLORS[i % SHELL_COLORS.length] + '">' +
      '<button class="history-select" data-select="' + observation.id + '" aria-pressed="' + (observation.id === selectedId) + '">' +
      '<span class="guess-index">' + (i + 1) + '</span>' + swatch(observation.guessHex) + '<span class="guess-description"><strong>' + escapeHtml(observation.guessName ?? observation.guessHex.toUpperCase()) + '</strong></span><b>' + observation.displayedScore.toFixed(2) + '%</b></button>' +
      '<div class="history-bottom"><button class="text-button" data-edit="' + observation.id + '" aria-label="Edit guess ' + (i + 1) + '">Edit</button><button class="text-button" data-remove="' + observation.id + '" aria-label="Remove guess ' + (i + 1) + '">Remove</button></div></div>'
  ).join('');
}
