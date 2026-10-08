export const escapeHtml = (value: string | number) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const number = (value: number) => value.toLocaleString('en-US');
export const swatch = (hex: string, extraClass = '') => '<span class="swatch ' + extraClass + '" style="background:' + escapeHtml(hex) + '" aria-hidden="true"></span>';
export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error('Missing element: ' + id);
  return node as T;
}
