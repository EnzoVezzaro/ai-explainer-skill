import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || path.join(process.cwd(), 'apps', 'web');
const port = Number(process.argv[3] || 5173);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let urlPath = (req.url || '/').split('?')[0];
  try { urlPath = decodeURIComponent(urlPath); } catch {}
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const filePath = path.join(root, urlPath);
  const realRoot = path.resolve(root);
  const realFile = path.resolve(filePath);
  if (!realFile.startsWith(realRoot + path.sep) && realFile !== realRoot) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  fs.stat(realFile, (err, stat) => {
    let candidate = realFile;
    if (!err && stat.isDirectory()) candidate = path.join(realFile, 'index.html');
    fs.stat(candidate, (err2, stat2) => {
      if (err2 || !stat2.isFile()) {
        const notFound = path.join(realRoot, '404.html');
        fs.readFile(notFound, (err3, data) => {
          if (!err3) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(data); return; }
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found');
        });
        return;
      }
      const ext = path.extname(candidate);
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      fs.createReadStream(candidate).pipe(res);
    });
  });
});

server.listen(port, () => {
  console.log(`serving ${root} at http://localhost:${port}`);
});
