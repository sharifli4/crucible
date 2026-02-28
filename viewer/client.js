/* ─── Constants ───────────────────────────────────────────────────────────── */

const COLORS = {
  Alpha:   '#4a9eff',
  Beta:    '#ff4f4f',
  Gamma:   '#3effa0',
  Delta:   '#ffaa33',
  Epsilon: '#bf6aff',
};

const AVATARS = {
  Alpha:   '🔵',
  Beta:    '🔴',
  Gamma:   '🟢',
  Delta:   '🟠',
  Epsilon: '🟣',
};

const STATUS = {
  idle:       '● READY',
  thinking:   '◌ THINKING',
  proposing:  '◎ PROPOSING',
  attacking:  '⚡ ATTACKING',
  defending:  '🛡 DEFENDING',
  done:       '✓ DONE',
};

const TAG_STYLES = {
  START:   { bg: '#1a2e4a', fg: '#4a9eff' },
  PHASE:   { bg: '#1a1a2e', fg: '#8888cc' },
  PROPOSE: { bg: '#1a2e1a', fg: '#3effa0' },
  ATTACK:  { bg: '#2e1a1a', fg: '#ff4f4f' },
  DEFEND:  { bg: '#2e2a1a', fg: '#ffaa33' },
  AGREE:   { bg: '#1a2e1a', fg: '#3effa0' },
  SPLIT:   { bg: '#2e1a1a', fg: '#ff4f4f' },
  ARBITER: { bg: '#2e2a00', fg: '#ffd700' },
  CONN:    { bg: '#1c1c2e', fg: '#5a5a9a' },
};

/* ─── State ───────────────────────────────────────────────────────────────── */

let agentNames = [];
let cards = {};      // name → DOM element
let hp = {};         // name → 0-100
let arrowSeq = 0;

/* ─── DOM refs ────────────────────────────────────────────────────────────── */

const arena           = document.getElementById('arena');
const arrowSvg        = document.getElementById('arrows');
const arrowDefs       = document.getElementById('arrow-defs');
const agentsDiv       = document.getElementById('agents');
const roundBadge      = document.getElementById('round-badge');
const convOverlay     = document.getElementById('convergence-overlay');
const phaseLabel      = document.getElementById('phase-label');
const taskLabel       = document.getElementById('task-label');
const speechFrom      = document.getElementById('speech-from');
const speechTag       = document.getElementById('speech-tag');
const speechContent   = document.getElementById('speech-content');
const logEntries      = document.getElementById('log-entries');

/* ─── Agent positioning ───────────────────────────────────────────────────── */

function positions(n) {
  const W = arena.clientWidth;
  const H = arena.clientHeight;
  const cx = W / 2;
  const cy = H / 2;
  const r  = Math.min(cx, cy) * 0.52;
  return Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

function repositionCards() {
  if (!agentNames.length) return;
  const pos = positions(agentNames.length);
  agentNames.forEach((name, i) => {
    const card = cards[name];
    if (!card) return;
    card.style.left = pos[i].x + 'px';
    card.style.top  = pos[i].y + 'px';
  });
}

/* ─── Build arena ─────────────────────────────────────────────────────────── */

function initArena(names) {
  agentNames = names;
  agentsDiv.innerHTML = '';
  cards = {};
  hp = {};
  arrowSvg.querySelectorAll('line,path,circle').forEach(e => e.remove());
  convOverlay.className = '';
  convOverlay.innerHTML = '';

  const pos = positions(names.length);

  names.forEach((name, i) => {
    hp[name] = 100;
    const color = COLORS[name] || '#888';

    const card = document.createElement('div');
    card.className = 'agent-card';
    card.id = `card-${name}`;
    card.style.setProperty('--c', color);
    card.style.left = pos[i].x + 'px';
    card.style.top  = pos[i].y + 'px';
    card.innerHTML = `
      <div class="agent-avatar">${AVATARS[name] || '⚪'}</div>
      <div class="agent-name">${name.toUpperCase()}</div>
      <div class="agent-status" id="st-${name}">${STATUS.idle}</div>
      <div class="hp-track"><div class="hp-fill" id="hp-${name}" style="width:100%"></div></div>
    `;
    agentsDiv.appendChild(card);
    cards[name] = card;
  });

  // Arbiter card (hidden until arbitration)
  const arb = document.createElement('div');
  arb.className = 'arbiter-card';
  arb.id = 'arbiter-card';
  arb.style.left = (arena.clientWidth  / 2) + 'px';
  arb.style.top  = '60px';
  arb.innerHTML = `
    <div class="agent-avatar">⚖️</div>
    <div class="agent-name">ARBITER</div>
    <div class="agent-status" id="st-arbiter">STANDING BY</div>
  `;
  agentsDiv.appendChild(arb);

  roundBadge.textContent = 'ARENA';
}

/* ─── HP helpers ──────────────────────────────────────────────────────────── */

function damageHP(name, pts) {
  hp[name] = Math.max(8, (hp[name] || 100) - pts);
  const el = document.getElementById(`hp-${name}`);
  if (el) el.style.width = hp[name] + '%';
}

function healHP(name, pts) {
  hp[name] = Math.min(100, (hp[name] || 100) + pts);
  const el = document.getElementById(`hp-${name}`);
  if (el) el.style.width = hp[name] + '%';
}

/* ─── Status helpers ──────────────────────────────────────────────────────── */

function setStatus(name, key) {
  const el = document.getElementById(`st-${name}`);
  if (el) el.textContent = STATUS[key] || key;
}

function setAllStatus(key) {
  agentNames.forEach(n => setStatus(n, key));
}

/* ─── Card animations ─────────────────────────────────────────────────────── */

function pulseCard(name, cls) {
  const card = cards[name];
  if (!card) return;
  card.classList.add('glow', cls);
  setTimeout(() => card.classList.remove('glow', cls), 800);
}

/* ─── SVG attack arrow ────────────────────────────────────────────────────── */

function cardCenter(name) {
  const card = cards[name];
  if (!card) return null;
  return {
    x: parseFloat(card.style.left),
    y: parseFloat(card.style.top),
  };
}

function fireArrow(attacker, target) {
  const from = cardCenter(attacker);
  const to   = cardCenter(target);
  if (!from || !to) return;

  const color = COLORS[attacker] || '#888';
  const id    = `m${++arrowSeq}`;
  const dist  = Math.hypot(to.x - from.x, to.y - from.y);

  // Arrowhead marker
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', id);
  marker.setAttribute('markerWidth', '7');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('refX', '5');
  marker.setAttribute('refY', '3');
  marker.setAttribute('orient', 'auto');
  const tri = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  tri.setAttribute('d', 'M0,0 L0,6 L7,3 z');
  tri.setAttribute('fill', color);
  marker.appendChild(tri);
  arrowDefs.appendChild(marker);

  // Animated line
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
  line.setAttribute('x2', to.x);   line.setAttribute('y2', to.y);
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '1.5');
  line.setAttribute('stroke-dasharray', dist);
  line.setAttribute('stroke-dashoffset', dist);
  line.setAttribute('marker-end', `url(#${id})`);
  line.style.transition = 'stroke-dashoffset .7s ease';
  arrowSvg.appendChild(line);

  // Trigger animation
  requestAnimationFrame(() => requestAnimationFrame(() => {
    line.style.strokeDashoffset = '0';
  }));

  // Fade and remove after 2.2 s
  setTimeout(() => {
    line.style.transition = 'opacity .4s';
    line.style.opacity = '0';
    setTimeout(() => { line.remove(); marker.remove(); }, 450);
  }, 2200);

  // Attacker glows, target shakes
  pulseCard(attacker, 'pop');
  setTimeout(() => {
    const tc = cards[target];
    if (tc) { tc.classList.add('shake'); setTimeout(() => tc.classList.remove('shake'), 450); }
  }, 700);
}

/* ─── Speech panel ────────────────────────────────────────────────────────── */

function showSpeech(fromText, tagText, content, color) {
  speechFrom.textContent = fromText;
  speechFrom.style.color = color || '#888';
  speechTag.textContent  = tagText;
  speechContent.textContent = content.length > 1200
    ? content.slice(0, 1200) + '\n\n[… truncated — see Claude Code for full output]'
    : content;
  speechContent.scrollTop = 0;
}

/* ─── Event log ───────────────────────────────────────────────────────────── */

function addLog(text, tagKey, color) {
  const style  = TAG_STYLES[tagKey] || TAG_STYLES.CONN;
  const entry  = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `
    <span class="log-tag" style="background:${style.bg};color:${color || style.fg}">${tagKey}</span>
    <span class="log-text">${text}</span>
  `;
  logEntries.appendChild(entry);
  logEntries.scrollTop = logEntries.scrollHeight;
  while (logEntries.children.length > 120) logEntries.removeChild(logEntries.firstChild);
}

/* ─── Event handlers ──────────────────────────────────────────────────────── */

function handle(evt) {
  switch (evt.type) {

    case 'debate_started': {
      taskLabel.textContent = `Task: ${evt.task}`;
      phaseLabel.textContent = 'Round 1 — Opening Proposals';
      initArena(evt.agents);
      setAllStatus('thinking');
      addLog(`Debate started · ${evt.agents.join(', ')}`, 'START');
      showSpeech('Crucible', 'START', `Task: ${evt.task}\nAgents: ${evt.agents.join(', ')}`, '#ffd700');
      break;
    }

    case 'phase_started': {
      phaseLabel.textContent = evt.label || evt.phase;
      roundBadge.textContent = evt.round ? `ROUND ${evt.round}` : 'ARENA';
      addLog(evt.label || evt.phase, 'PHASE');
      convOverlay.className = '';
      if (evt.phase === 'proposals')   setAllStatus('thinking');
      if (evt.phase === 'critiques')   setAllStatus('idle');
      if (evt.phase === 'defenses')    setAllStatus('idle');
      if (evt.phase === 'arbitration') {
        setAllStatus('done');
        const arb = document.getElementById('arbiter-card');
        if (arb) arb.classList.add('visible');
        setStatus('arbiter', 'thinking');
      }
      break;
    }

    case 'proposal': {
      setStatus(evt.agent, 'proposing');
      pulseCard(evt.agent, 'pop');
      showSpeech(
        `${evt.agent}  ·  Round ${evt.round} Proposal`,
        'PROPOSE',
        evt.content,
        COLORS[evt.agent]
      );
      addLog(`${evt.agent} proposed (R${evt.round})`, 'PROPOSE', COLORS[evt.agent]);
      setTimeout(() => setStatus(evt.agent, 'idle'), 900);
      break;
    }

    case 'critique': {
      setStatus(evt.attacker, 'attacking');
      setStatus(evt.target, 'defending');
      fireArrow(evt.attacker, evt.target);
      damageHP(evt.target, 14);
      showSpeech(
        `${evt.attacker} → ${evt.target}  ·  Round ${evt.round}`,
        'ATTACK',
        evt.content,
        COLORS[evt.attacker]
      );
      addLog(`${evt.attacker} attacked ${evt.target} (R${evt.round})`, 'ATTACK', COLORS[evt.attacker]);
      setTimeout(() => { setStatus(evt.attacker, 'idle'); setStatus(evt.target, 'idle'); }, 1100);
      break;
    }

    case 'defense': {
      setStatus(evt.agent, 'defending');
      healHP(evt.agent, 6);
      pulseCard(evt.agent, 'pop');
      showSpeech(
        `${evt.agent}  ·  Defense Round ${evt.round}`,
        'DEFEND',
        evt.content,
        COLORS[evt.agent]
      );
      addLog(`${evt.agent} defended (R${evt.round})`, 'DEFEND', COLORS[evt.agent]);
      setTimeout(() => setStatus(evt.agent, 'idle'), 900);
      break;
    }

    case 'convergence': {
      const converged = /^CONVERGED/i.test(evt.result || '');
      phaseLabel.textContent = converged ? '✓ CONVERGED' : '≠ DIVERGED — proceeding to Round 3';

      convOverlay.className = 'visible';
      convOverlay.innerHTML = `
        <div class="verdict ${converged ? 'converged' : 'diverged'}">
          ${converged ? '✓ CONVERGED' : '≠ DIVERGED'}
        </div>
        <div class="reason">${(evt.content || '').slice(0, 180)}</div>
      `;
      setTimeout(() => { convOverlay.className = ''; }, 4000);

      if (converged) {
        agentNames.forEach(n => {
          const card = cards[n];
          if (card) { card.style.borderColor = 'var(--gamma)'; card.style.setProperty('--c', 'var(--gamma)'); }
        });
      }

      showSpeech('Convergence Check', converged ? 'AGREE' : 'SPLIT', evt.content || evt.result, converged ? '#3effa0' : '#ff4f4f');
      addLog(`Convergence: ${converged ? 'CONVERGED' : 'DIVERGED'}`, converged ? 'AGREE' : 'SPLIT');
      break;
    }

    case 'scorecard': {
      setStatus('arbiter', 'done');
      showSpeech('Arbiter — Scorecard', 'ARBITER', evt.content, '#ffd700');
      addLog('Arbiter scorecard rendered', 'ARBITER');
      break;
    }

    case 'final_answer': {
      phaseLabel.textContent = '⚖ VERDICT RENDERED';
      const arb = document.getElementById('arbiter-card');
      if (arb) { const s = arb.querySelector('.agent-status'); if (s) s.textContent = '✓ VERDICT'; }
      showSpeech('Arbiter — Final Answer', 'ARBITER', evt.content, '#ffd700');
      addLog('Final answer synthesized', 'ARBITER');
      break;
    }
  }
}

/* ─── WebSocket connection ────────────────────────────────────────────────── */

function connect() {
  const ws = new WebSocket(`ws://${location.host}`);

  ws.onopen = () => {
    phaseLabel.textContent = 'Connected — waiting for debate…';
    addLog('Viewer connected', 'CONN');
  };

  ws.onmessage = msg => {
    try { handle(JSON.parse(msg.data)); } catch { /* ignore bad frames */ }
  };

  ws.onclose = () => {
    phaseLabel.textContent = 'Disconnected — reconnecting…';
    setTimeout(connect, 2000);
  };

  ws.onerror = () => ws.close();
}

/* ─── Responsive repositioning ───────────────────────────────────────────── */
window.addEventListener('resize', repositionCards);

connect();
