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
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  let filePath = path.join(root, urlPath);
  // prevent directory traversal
  const realRoot = path.resolve(root);
  const realFile = path.resolve(filePath);
  if (!realFile.startsWith(realRoot + path.sep) && realFile !== realRoot) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  fs.stat(realFile, (err, stat) => {
    if (err || !stat.isFile()) {
      // fallback to index.html for client-style routes (none here, but safe)
      filePath = path.join(root, 'index.html');
      fs.readFile(filePath, (err2, data) => {
        if (err2) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(data);
      });
      return;
    }
    const ext = path.extname(realFile);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    fs.createReadStream(realFile).pipe(res);
  });
});

server.listen(port, () => {
  console.log(`serving ${root} at http://localhost:${port}`);
});
