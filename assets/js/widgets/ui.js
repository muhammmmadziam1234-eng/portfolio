import {h} from '../util.js';

let tabCounter = 0;

/** Accessible tabs: arrow keys, Home and End move between tabs; panels are hidden, not removed. */
export function makeTabs(items, {label = 'Views'} = {}) {
  const id = `tabs${++tabCounter}`;
  const list = h('div', {class: 'tabs', role: 'tablist', 'aria-label': label});
  const wrap = h('div', {}, list);
  const buttons = [], panels = [];
  const select = (index, focus = false) => {
    buttons.forEach((b, i) => { b.setAttribute('aria-selected', String(i === index)); b.tabIndex = i === index ? 0 : -1; panels[i].hidden = i !== index; });
    if (focus) buttons[index].focus();
    items[index].onShow?.();
  };
  items.forEach((item, i) => {
    const button = h('button', {type: 'button', role: 'tab', id: `${id}-t${i}`, 'aria-controls': `${id}-p${i}`, onclick: () => select(i)}, item.label);
    button.addEventListener('keydown', e => {
      const keys = {ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: items.length - 1};
      if (!(e.key in keys)) return;
      e.preventDefault();
      select((keys[e.key] + items.length) % items.length, true);
    });
    const panel = h('div', {role: 'tabpanel', id: `${id}-p${i}`, 'aria-labelledby': `${id}-t${i}`, tabindex: '-1'}, item.panel);
    buttons.push(button); panels.push(panel);
    list.append(button); wrap.append(panel);
  });
  select(0);
  return {element: wrap, select};
}
