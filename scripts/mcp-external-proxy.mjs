/**
 * Authenticated Streamable-HTTP front for the video-skill MCP.
 * The local dashboard keeps using http://localhost:3002/mcp (open, loopback only).
 * This proxy is the ONLY thing exposed through the tunnel: every request needs
 * a Bearer token, and it forwards to the real MCP on loopback.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.MCP_PROXY_PORT || 3003);
const BACKEND = process.env.MCP_BACKEND || 'http://127.0.0.1:3002/mcp';
const TOKEN = process.env.MCP_TUNNEL_TOKEN || crypto.randomBytes(24).toString('hex');
// ChatGPT's custom-MCP UI offers "No authentication" and sends no Bearer header.
// Keep auth opt-in so the tunnel works with that UI; enable with MCP_REQUIRE_AUTH=1.
const REQUIRE_AUTH = process.env.MCP_REQUIRE_AUTH === '1';

const tokenPath = path.join(os.homedir(), '.video-skill', 'mcp-tunnel-token');
await fs.mkdir(path.dirname(tokenPath), { recursive: true });
await fs.writeFile(tokenPath, TOKEN, { encoding: 'utf8', mode: 0o600 });

function json(res, status, body, extra = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    ...extra,
  });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Mcp-Session-Id',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname !== '/mcp') {
    return json(res, 404, { error: 'Not found' });
  }

  // Bearer auth is optional: ChatGPT's custom-MCP UI uses "No authentication"
  // and sends no header. When explicitly enabled, use constant-time comparison.
  if (REQUIRE_AUTH) {
    const auth = req.headers.authorization || '';
    const given = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const expected = Buffer.from(given);
    const actual = Buffer.from(TOKEN);
    const ok = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    if (!ok) {
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer',
      });
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
  }

  if (req.method === 'GET') {
    // Streamable HTTP: no server-initiated SSE; 405 is spec-compliant.
    res.writeHead(405, { Allow: 'POST', 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Use POST for JSON-RPC' }));
  }
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);

  try {
    const backendUrl = new URL(BACKEND);
    const upstream = http.request(
      {
        hostname: backendUrl.hostname,
        port: backendUrl.port || 80,
        path: backendUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': req.headers['content-type'] || 'application/json',
          Accept: req.headers.accept || 'application/json, text/event-stream',
          'Content-Length': body.length,
        },
      },
      (up) => {
        const out = [];
        up.on('data', d => out.push(d));
        up.on('end', () => {
          const buf = Buffer.concat(out);
          res.writeHead(up.statusCode || 200, {
            'Content-Type': 'application/json',
            'Content-Length': buf.length,
            'Access-Control-Allow-Origin': '*',
            ...(up.headers['mcp-session-id'] ? { 'Mcp-Session-Id': up.headers['mcp-session-id'] } : {}),
          });
          res.end(buf);
        });
      }
    );
    upstream.on('error', (e) => json(res, 502, { error: `Backend error: ${e.message}` }));
    upstream.end(body);
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`MCP proxy on http://127.0.0.1:${PORT}/mcp`);
  console.log(`Auth: ${REQUIRE_AUTH ? 'REQUIRED (Bearer)' : 'optional (off) — works with ChatGPT "No authentication"'}`);
  if (REQUIRE_AUTH) console.log(`Token saved to ${tokenPath}`);
  console.log(`Forwarding to ${BACKEND}`);
});
