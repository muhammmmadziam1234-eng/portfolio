export const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export function tidyText(value) { return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''; }
export function applyCase(text, mode) { return mode === 'lower' ? text.toLowerCase() : mode === 'upper' ? text.toUpperCase() : text; }
// Code-unit order: the same on every machine, unlike localeCompare.
export const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export function sortedObject(map) {
  return Object.fromEntries([...map].sort(([a], [b]) => compareText(a, b)));
}
