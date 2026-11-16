#!/usr/bin/env node
// A small static server for local viewing and for the tests. No dependencies.
// usage: node scripts/serve.mjs [port]      (port 0 picks a free one; the chosen port is printed)
import {createServer} from 'node:http';
import {createReadStream, statSync, existsSync} from 'node:fs';
import {dirname, extname, join, normalize, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json'};

export function serve(port = 0) {
  const server = createServer((req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = normalize(join(root, path));
      if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end('Forbidden'); return; }
      // A folder asked for without its slash (p/atlas) is sent to p/atlas/, as GitHub Pages does.
      if (existsSync(file) && statSync(file).isDirectory()) { res.writeHead(301, {location: `${path}/`}).end(); return; }
      if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404, {'content-type': 'text/plain'}).end('Not found'); return; }
      const size = statSync(file).size, type = types[extname(file)] ?? 'application/octet-stream';
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
      if (range) {
        const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
        res.writeHead(206, {'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1});
        createReadStream(file, {start, end}).pipe(res);
      } else {
        res.writeHead(200, {'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-cache'});
        createReadStream(file).pipe(res);
      }
    } catch { res.writeHead(400).end('Bad request'); }
  });
  return new Promise(done => server.listen(port, '127.0.0.1', () => done(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await serve(Number(process.argv[2] ?? 8080));
  console.log(`http://127.0.0.1:${server.address().port}/`);
}
