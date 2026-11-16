import {h} from '../util.js';
import {repoUrl} from '../util.js';

/** Shows a project's own page, copied unmodified into demos/<name>, in a frame. */
export default async function embed(root, {project}) {
  // The page inside is this project's own code, served from this site, so it needs no sandbox (and a sandbox that allows scripts
  // and the same origin protects nothing). It keeps its own Content-Security-Policy.
  const frame = h('iframe', {class: 'frame', src: project.embed, title: `${project.title}, running live`});
  root.append(
    h('div', {class: 'exhibit-bar'},
      h('span', {class: 'grow'}, h('strong', {}, project.tryShort), ' This is the real app, running here. Nothing is sent anywhere.'),
      h('a', {class: 'btn secondary small', href: project.embed, target: '_blank', rel: 'noopener'}, 'Open on its own page')),
    frame);
  return {destroy() { frame.src = 'about:blank'; }};
}
