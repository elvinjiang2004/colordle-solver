import { normalizeName } from '../color/gameProfile';
import type { ColorEntry } from '../types';
import { normalizeHex } from '../color/colorConversion';
import { element, escapeHtml, swatch } from './format';

export function setupAutocomplete(dictionary: ColorEntry[]) {
  const input = element<HTMLInputElement>('guess'), list = element('suggestions'), chip = element('input-swatch');
  let indexed = dictionary.map(entry => ({ entry, normalized: normalizeName(entry.name) }));
  let names = new Map(indexed.map(({ entry, normalized }) => [normalized, entry]));
  let matches: ColorEntry[] = [], active = -1;
  function resolve(): { hex: string; name?: string } {
    const named = names.get(normalizeName(input.value));
    if (named) return { hex: named.hex, name: named.name };
    return { hex: normalizeHex(input.value) };
  }
  function close() { active = -1; list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); }
  function preview() {
    try { chip.style.background = resolve().hex; } catch { chip.style.background = 'repeating-conic-gradient(#d3d9df 0% 25%, #fff 0% 50%) 50% / 10px 10px'; }
  }
  function choose(index: number) {
    if (!matches[index]) return;
    input.value = matches[index].name; preview(); close(); element('score').focus();
  }
  function render() {
    const query = normalizeName(input.value);
    preview(); active = -1;
    input.removeAttribute('aria-activedescendant');
    if (query.length < 2 || query.startsWith('#')) { close(); return; }
    const starts = indexed.filter(c => c.normalized.startsWith(query)).slice(0, 7);
    const included = new Set(starts.map(c => c.entry.id));
    matches = [...starts, ...indexed.filter(c => c.normalized.includes(query) && !included.has(c.entry.id)).slice(0, 7 - starts.length)].map(c => c.entry);
    list.innerHTML = matches.map((entry, i) => '<li id="suggestion-' + i + '" role="option" aria-selected="false" data-index="' + i + '">' + swatch(entry.hex) + '<span>' + escapeHtml(entry.name) + '</span></li>').join('');
    list.hidden = matches.length === 0;
    input.setAttribute('aria-expanded', String(!list.hidden));
  }
  input.addEventListener('input', render);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { close(); return; }
    if (list.hidden) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      active = active < 0 ? (event.key === 'ArrowDown' ? 0 : matches.length - 1)
        : (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
      list.querySelectorAll('[role=option]').forEach((node, i) => node.setAttribute('aria-selected', String(i === active)));
      input.setAttribute('aria-activedescendant', 'suggestion-' + active);
    } else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); choose(active); }
  });
  list.addEventListener('pointerdown', event => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('[data-index]');
    if (item) { event.preventDefault(); choose(Number(item.dataset.index)); }
  });
  input.addEventListener('blur', close);
  return { resolve, preview, reset() { close(); preview(); }, setDictionary(entries: ColorEntry[]) {
    indexed = entries.map(entry => ({ entry, normalized: normalizeName(entry.name) }));
    names = new Map(indexed.map(({ entry, normalized }) => [normalized, entry]));
    matches = []; active = -1; close(); preview();
  } };
}
