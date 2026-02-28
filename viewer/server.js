const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = 3141;
const DIR = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

// Event history — new clients get a full replay on connect
const history = [];
const clients = new Set();

function broadcast(event) {
  const msg = JSON.stringify(event);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

const server = http.createServer((req, res) => {
  // POST /event — receive an event from emit.js
  if (req.method === 'POST' && req.url === '/event') {
    let body = '';
    req.on('data', d => (body += d));
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        history.push(event);
        broadcast(event);
        res.writeHead(200);
        res.end('ok');
      } catch {
        res.writeHead(400);
        res.end('invalid json');
      }
    });
    return;
  }

  // POST /reset — clear history (called at debate_started)
  if (req.method === 'POST' && req.url === '/reset') {
    history.length = 0;
    res.writeHead(200);
    res.end('ok');
    return;
  }

  // Serve static files
  const filePath = path.join(DIR, req.url === '/' ? 'index.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  clients.add(ws);
  // Replay full history so late-joiners see everything
  for (const event of history) {
    ws.send(JSON.stringify(event));
  }
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

const EMIT_PATH = path.join(DIR, 'emit.js');
const LOCK_FILE = '/tmp/crucible_emit_path';

server.listen(PORT, () => {
  // Write emit path to a well-known file so crucible.md needs no env var
  fs.writeFileSync(LOCK_FILE, EMIT_PATH, 'utf8');

  console.log(`\nCrucible Viewer →  http://localhost:${PORT}`);
  console.log(`Emit path written to ${LOCK_FILE}`);
  console.log('Open the URL in your browser, then run /crucible\n');
});

// Clean up lock file on exit
process.on('exit',    () => { try { fs.unlinkSync(LOCK_FILE); } catch {} });
process.on('SIGINT',  () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
