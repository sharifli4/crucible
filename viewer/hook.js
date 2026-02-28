#!/usr/bin/env node
/**
 * Crucible Viewer — PostToolUse hook
 *
 * Fires after every Agent tool call. Detects crucible:debater and
 * crucible:arbiter completions, infers phase transitions, and streams
 * events directly to the viewer server — no temp files, no bash commands
 * in crucible.md at all.
 *
 * Install in ~/.claude/settings.json:
 * {
 *   "hooks": {
 *     "PostToolUse": [{
 *       "matcher": "Agent",
 *       "hooks": [{ "type": "command", "command": "node /path/to/crucible/viewer/hook.js" }]
 *     }]
 *   }
 * }
 */

const http = require('http');
const fs   = require('fs');

const STATE = '/tmp/crucible_hook_state.json';

// ── Read / write state across parallel hook invocations ───────────────────
function readState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); }
  catch { return { task: null, phase: null, round: 0 }; }
}
function writeState(s) {
  try { fs.writeFileSync(STATE, JSON.stringify(s)); } catch {}
}

// ── Entry point ────────────────────────────────────────────────────────────
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => (raw += d));
process.stdin.on('end', () => {
  try { run(JSON.parse(raw)); } catch { process.exit(0); }
});

function run(ctx) {
  if (ctx.tool_name !== 'Agent') return done();

  const input   = ctx.tool_input || {};
  const subtype = input.subagent_type || '';
  if (!subtype.startsWith('crucible:')) return done();

  const prompt = input.prompt || '';
  const output = extractOutput(ctx.tool_response);
  const task   = extractTask(prompt);

  const state = readState();

  // ── Detect new debate (task changed) ──────────────────────────────────
  const isNewDebate = task && task !== state.task;
  if (isNewDebate) {
    writeState({ task, phase: null, round: 0 });
  }

  if (subtype === 'crucible:arbiter') {
    emitPhaseIfNew(state, 'arbitration', 0, { label: 'Final Arbitration' });
    post({ type: 'final_answer', content: output });
    return;
  }

  // ── Parse debater mode ─────────────────────────────────────────────────
  const modeMatch = prompt.match(/You are Agent (\w+)\.\s*MODE:\s*(\w+)/i);
  if (!modeMatch) return done();

  const agent = modeMatch[1];
  const mode  = modeMatch[2].toUpperCase();
  const round = inferRound(prompt, mode);

  if (mode === 'PROPOSE') {
    emitPhaseIfNew(state, 'proposals', 1, { label: 'Round 1 — Opening Proposals' });
    post({ type: 'proposal', agent, round: 1, task, content: output });

  } else if (mode === 'CRITIQUE') {
    const targetMatch = prompt.match(/Opponent\s*\((\w+)\)/i);
    const target = targetMatch ? targetMatch[1] : 'Unknown';
    const label = round === 2 ? 'Round 2 — Cross-Attack' : 'Round 3 — Cross-Attack';
    emitPhaseIfNew(state, 'critiques', round, { label });
    post({ type: 'critique', attacker: agent, target, round, content: output });

  } else if (mode === 'DEFEND') {
    const label = round === 2 ? 'Round 2 — Defense' : 'Round 3 — Final Defense';
    emitPhaseIfNew(state, 'defenses', round, { label });
    post({ type: 'defense', agent, round, content: output });
  }
}

// ── Emit phase_started only on the first event of each (phase, round) ─────
function emitPhaseIfNew(state, phase, round, extra) {
  if (state.phase === phase && state.round === round) return;
  // Update persisted state immediately to prevent duplicate emits from
  // parallel hook processes hitting the same (phase, round) transition.
  const updated = readState();
  if (updated.phase === phase && updated.round === round) return;
  writeState({ ...updated, phase, round });
  post({ type: 'phase_started', phase, round, ...extra });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function inferRound(prompt, mode) {
  if (mode === 'PROPOSE') return 1;
  // Round 3 critique/defend prompts reference "Round 2" solutions
  if (/Round 2\b/.test(prompt)) return 3;
  return 2;
}

function extractTask(prompt) {
  const m = prompt.match(/^Task:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

function extractOutput(response) {
  if (!response) return '';
  if (typeof response === 'string') return response;
  return (response.output || response.result || JSON.stringify(response)).toString();
}

function post(event) {
  event.ts = Date.now();
  const buf = Buffer.from(JSON.stringify(event));
  const req = http.request(
    { hostname: 'localhost', port: 3141, path: '/event', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length } },
    () => done()
  );
  req.on('error', () => done());
  req.setTimeout(1500, () => { req.destroy(); done(); });
  req.write(buf);
  req.end();
}

function done() { process.exit(0); }
