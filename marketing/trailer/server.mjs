// Local helper for the trailer: serves this folder and saves uploads (recordings, renders) into it.
import { createServer } from 'node:http';
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
const root = dirname(new URL(import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webm': 'video/webm', '.mp4': 'video/mp4', '.json': 'application/json', '.css': 'text/css' };
createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', '*'); res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.end();
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/upload') {
    const rel = normalize(url.searchParams.get('path') ?? '').replace(/^(\.\.[/\\])+/, '');
    if (!/^(clips|stills|out)\/[\w.-]+$/.test(rel)) { res.statusCode = 400; return res.end('bad path'); }
    const file = join(root, rel); mkdirSync(dirname(file), { recursive: true });
    const w = createWriteStream(file); req.pipe(w); w.on('finish', () => res.end(JSON.stringify({ ok: true, bytes: statSync(file).size })));
    return;
  }
  const file = join(root, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream');
  res.setHeader('accept-ranges', 'bytes'); res.setHeader('cache-control', 'no-store');
  const size = statSync(file).size, m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (m) {
    const start = m[1] ? Number(m[1]) : size - Number(m[2]), end = m[1] && m[2] ? Number(m[2]) : size - 1;
    res.statusCode = 206; res.setHeader('content-range', `bytes ${start}-${end}/${size}`); res.setHeader('content-length', end - start + 1);
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.setHeader('content-length', size);
  createReadStream(file).pipe(res);
}).listen(4300, '127.0.0.1', () => console.log('trailer server on 4300'));
