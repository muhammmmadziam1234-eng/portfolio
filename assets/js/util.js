import config from '../../site.config.js';

export const $ = (selector, root = document) => root.querySelector(selector);

/** Tiny element builder: h('a', {href: '#/', class: 'x'}, 'text', childNode). */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export const svg = (tag, props = {}, ...children) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(props)) if (value !== null && value !== undefined) el.setAttribute(key, value);
  for (const child of children.flat(Infinity)) if (child) el.append(child);
  return el;
};

/** Polite screen-reader announcement. */
export function announce(text) {
  const live = $('#live');
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 40);
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const repoUrl = (repo, path = '') => `https://github.com/${config.githubUser}/${repo}${path ? `/blob/main/${path}` : ''}`;
export const assetUrl = path => new URL(path, document.baseURI).href;

/** Download text as a file. */
export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], {type}));
  const link = h('a', {href: url, download: name});
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
