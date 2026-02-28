#!/usr/bin/env node
/**
 * Crucible Viewer — PostToolUse hook
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
 *
 * Fires after every Agent tool call. If the agent is a crucible debater or
 * arbiter, it streams the result directly to the viewer server — no temp
 * files, no emit commands in crucible.md.
 */

const http = require('http');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => (raw += d));
process.stdin.on('end', () => {
  try {
    run(JSON.parse(raw));
  } catch {
    process.exit(0);
  }
});

function run(ctx) {
  if (ctx.tool_name !== 'Agent') return done();

  const input    = ctx.tool_input   || {};
  const response = ctx.tool_response || {};
  const subtype  = input.subagent_type || '';

  if (!subtype.startsWith('crucible:')) return done();

  // Extract agent output — handle both string and object responses
  const output = typeof response === 'string'
    ? response
    : (response.output || response.result || JSON.stringify(response));

  const prompt = input.prompt || '';
  const event  = subtype === 'crucible:arbiter'
    ? buildArbiterEvent(output)
    : buildDebaterEvent(prompt, output);

  if (!event) return done();

  post(event);
}

function buildDebaterEvent(prompt, output) {
  // "You are Agent Alpha. MODE: PROPOSE"
  const agentMatch = prompt.match(/You are Agent (\w+)\.\s*MODE:\s*(\w+)/i);
  if (!agentMatch) return null;

  const agent = agentMatch[1];
  const mode  = agentMatch[2].toUpperCase();

  // Detect round from which previous solution is referenced in the prompt
  // Round 2 critique/defense reference "Round 1" solutions
  // Round 3 critique/defense reference "Round 2" solutions
  let round = 1;
  if (mode !== 'PROPOSE') {
    if (/Round 2\b/.test(prompt)) round = 3;
    else round = 2;
  }

  if (mode === 'PROPOSE') {
    return { type: 'proposal', agent, round: 1, content: output };
  }

  if (mode === 'CRITIQUE') {
    // "Opponent (Beta) solution to critique:"
    const targetMatch = prompt.match(/Opponent\s*\((\w+)\)/i);
    const target = targetMatch ? targetMatch[1] : 'Unknown';
    return { type: 'critique', attacker: agent, target, round, content: output };
  }

  if (mode === 'DEFEND') {
    return { type: 'defense', agent, round, content: output };
  }

  return null;
}

function buildArbiterEvent(output) {
  return { type: 'final_answer', content: output };
}

function post(event) {
  event.ts = Date.now();
  const buf = Buffer.from(JSON.stringify(event));

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
    () => done()
  );

  req.on('error', () => done());
  req.setTimeout(1500, () => { req.destroy(); done(); });
  req.write(buf);
  req.end();
}

function done() { process.exit(0); }
