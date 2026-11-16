import {h, repoUrl} from '../util.js';
import {makeTabs} from './ui.js';

const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/**
 * The service desk needs a server, so it is shown as a recording of the real app, made by scripts/record-tracker.mjs,
 * with a step list that jumps to each part, and a second tab with the API it was driven through.
 */
export default async function recording(root, {project}) {
  const [{steps, seconds}, api, curl] = await Promise.all([
    fetch('data/tracker-steps.json').then(r => r.json()),
    fetch('data/tracker-api.json').then(r => r.json()),
    fetch('data/tracker-curl.txt').then(r => r.text())
  ]);

  const video = h('video', {controls: true, preload: 'metadata', playsinline: true, muted: true, poster: 'assets/media/tracker/poster.jpg', 'aria-describedby': 'rec-steps'},
    h('source', {src: 'assets/media/tracker/walkthrough.mp4', type: 'video/mp4'}));
  const buttons = steps.map(step => h('button', {type: 'button', class: 'chip', onclick: () => { video.currentTime = step.at; video.play().catch(() => {}); }}, h('span', {class: 'num'}, clock(step.at)), ' ', step.text));
  const list = h('ol', {id: 'rec-steps', class: 'steps', 'aria-label': 'What the recording shows. Choose a step to jump to it.'}, buttons.map(b => h('li', {}, b)));
  const onTime = () => {
    const now = video.currentTime;
    const index = steps.reduce((best, step, i) => step.at <= now + 0.05 ? i : best, 0);
    buttons.forEach((b, i) => b.setAttribute('aria-current', i === index && now > 0 ? 'step' : 'false'));
  };
  video.addEventListener('timeupdate', onTime);

  const watch = h('div', {},
    h('div', {class: 'rec'}, video),
    list,
    h('p', {class: 'caption'}, `The real app, ${clock(seconds)} long, recorded by a script (scripts/record-tracker.mjs) against a throwaway database. It is silent: the captions are in the picture and the steps above say the same. The accounts shown are the demo accounts published in the project's README.`));

  const table = h('div', {class: 'issues', tabindex: '0', role: 'region', 'aria-label': 'API operations'},
    h('table', {},
      h('caption', {class: 'sr'}, `Operations in the ${api.title} API, version ${api.version}`),
      h('thead', {}, h('tr', {}, ['Method', 'Path', 'What it does', 'Needs'].map(t => h('th', {scope: 'col'}, t)))),
      h('tbody', {}, api.operations.map(o => h('tr', {}, h('td', {}, h('code', {}, o.method)), h('td', {}, h('code', {}, o.path)), h('td', {}, o.summary), h('td', {}, o.needs))))));
  const session = h('pre', {class: 'code', tabindex: '0', 'aria-label': 'A real session with the API, as commands and their output'}, curl.trim());
  const contract = h('div', {},
    h('div', {class: 'exhibit-bar'}, h('span', {class: 'grow'}, `OpenAPI ${api.openapi}. The file is the contract; tests call the running server and check every answer against it.`),
      h('a', {class: 'btn secondary small', href: repoUrl(project.repo, 'openapi.json'), target: '_blank', rel: 'noopener'}, 'Open openapi.json')),
    table,
    h('div', {class: 'exhibit-bar'}, h('strong', {}, 'A real session'), h('span', {class: 'caption'}, 'These are the commands from the README and their actual output. The CSRF token is replaced.')),
    session);

  const tabs = makeTabs([
    {label: 'Watch the app', panel: watch},
    {label: 'API contract', panel: contract, onShow: () => video.pause()}
  ], {label: 'Ways to look at the service desk'});
  root.append(tabs.element);
  return {destroy() { video.pause(); }};
}
