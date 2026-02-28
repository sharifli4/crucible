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

server.listen(PORT, () => {
  console.log(`\nCrucible Viewer →  http://localhost:${PORT}\n`);
  console.log('1. Open that URL in your browser');
  console.log('2. Export your emit path:');
  console.log(`   export CRUCIBLE_EMIT="${path.join(DIR, 'emit.js')}"`);
  console.log('3. Run /crucible in Claude Code\n');
});
