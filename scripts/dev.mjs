import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { makeHandler } from '../server/core.mjs';
try { process.loadEnvFile('.env'); } catch {}
const handler = makeHandler();
const root = resolve('public');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:4173');
    if (url.pathname === '/api/portal') {
      const request = new Request(url, { method: req.method, headers: req.headers, ...(!['GET', 'HEAD'].includes(req.method) ? { body: req, duplex: 'half' } : {}) });
      const response = await handler(request); res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    const path = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    if (!path.startsWith(root + '/') || !(await stat(path)).isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' }); res.end(await readFile(path));
  } catch { res.writeHead(500); res.end('Request failed'); }
});
server.listen(4173, '127.0.0.1', () => console.log('Local portal: http://127.0.0.1:4173. Configure .env for live services.'));
