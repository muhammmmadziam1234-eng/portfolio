import {h} from '../util.js';
import {repoUrl} from '../util.js';

/** Shows a project's own page, copied unmodified into demos/<name>, in a frame. */
export default async function embed(root, {project}) {
  const frame = h('iframe', {class: 'frame', src: project.embed, title: `${project.title}, running live`, loading: 'lazy',
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-popups'});
  root.append(
    h('div', {class: 'exhibit-bar'},
      h('span', {class: 'grow'}, 'This is the real app, running here. Nothing is sent anywhere.'),
      h('a', {class: 'btn secondary small', href: project.embed, target: '_blank', rel: 'noopener'}, 'Open on its own page')),
    frame);
  return {destroy() { frame.src = 'about:blank'; }};
}
