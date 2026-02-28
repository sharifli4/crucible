#!/usr/bin/env node
// Usage: node emit.js <type> '<json-metadata>' [content-file]
// Fails silently — never blocks the debate if the viewer is not running.

const http = require('http');
const fs = require('fs');

const [, , type, metaStr, contentFile] = process.argv;
if (!type) process.exit(0);

let meta = {};
try { meta = JSON.parse(metaStr || '{}'); } catch { /* ignore */ }

let content = '';
if (contentFile) {
  try { content = fs.readFileSync(contentFile, 'utf8').trim(); } catch { /* ignore */ }
}

const payload = JSON.stringify({ type, ...meta, content, ts: Date.now() });
const buf = Buffer.from(payload);

const req = http.request(
  {
    hostname: 'localhost',
    port: 3141,
    path: '/event',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': buf.length,
    },
  },
  () => process.exit(0)
);

req.on('error', () => process.exit(0)); // viewer not running — that's fine
req.setTimeout(1000, () => { req.destroy(); process.exit(0); });
req.write(buf);
req.end();
