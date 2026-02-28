# Crucible

A Claude Code plugin that runs multiple AI agents against each other — they independently propose solutions, directly attack every other agent's arguments, and defend their own positions across multiple debate rounds until they converge on the most correct answer. Run 2–5 agents depending on how much cross-critique coverage you want.

## How It Works

Raw answers go in. Adversarial pressure is applied. Refined answers come out.

```
Round 1   Agent 1 proposes ─── Agent 2 proposes ─── … Agent N proposes
                │                     │                      │
Round 2   Every agent attacks every other agent (N×(N-1) critiques in parallel)
                │                     │                      │
          Every agent defends against all attacks directed at it
                │                     │                      │
          [Convergence check — stop early if all N agents agree]
                │                     │                      │
Round 3   Same cross-attack and defense structure (if still diverged)
                │                     │                      │
                └──────────────── Arbiter ──────────────────┘
                           Reads full transcript
                           Scores all N agents
                           Synthesizes final answer
```

Each step is shown to the user in real time as the debate unfolds.

---

## Installation

### Requirements

- [Claude Code](https://claude.ai/code) installed and configured
- A valid Anthropic API key set up in Claude Code

### Step 1 — Clone the repository

```bash
git clone git@github.com:sharifli4/crucible.git
```

Or with HTTPS if you don't have SSH configured:

```bash
git clone https://github.com/sharifli4/crucible.git
```

This creates a `crucible/` directory on your machine containing the plugin files.

### Step 2 — Choose how to load it

There are two ways to use the plugin. Pick the one that suits you.

---

#### Option A — Load for a single session (quickest way to try it)

Pass the plugin directory when starting Claude Code:

```bash
claude --plugin-dir /path/to/crucible
```

Replace `/path/to/crucible` with the actual path where you cloned the repo. For example:

```bash
claude --plugin-dir ~/projects/crucible
```

The `/crucible` command will be available for the duration of that session only. When you close the session, the plugin is no longer loaded.

---

#### Option B — Install permanently (recommended)

To have Crucible available in every Claude Code session without passing a flag each time, add it to your Claude settings file.

Open `~/.claude/settings.json` in any text editor. If the file does not exist yet, create it. Add the `pluginDirectories` field with the path to your cloned repo:

```json
{
  "pluginDirectories": ["/path/to/crucible"]
}
```

If you already have other settings in the file, just add the `pluginDirectories` line alongside them:

```json
{
  "model": "sonnet",
  "pluginDirectories": ["/path/to/crucible"]
}
```

Save the file. From now on, every time you start Claude Code, the `/crucible` command will be available automatically — no flags needed.

### Step 3 — Verify installation

Start Claude Code and run:

```bash
/help
```

You should see `crucible` listed under available commands. If it appears, the plugin loaded correctly and you are ready to use it.

---

## Usage

Run `/crucible` followed by any task, question, or problem you want stress-tested:

```bash
/crucible [--agents N] <your task here>
```

The `--agents` flag is optional. If omitted, two agents (Alpha and Beta) run by default — identical to previous behaviour.

### `--agents N`

Set how many debater agents participate. N can be 2, 3, 4, or 5.

```bash
/crucible --agents 3 design a rate limiter
```

Agent names are assigned in order from the pool: **Alpha, Beta, Gamma, Delta, Epsilon**.

| N | Agents | Critiques per round |
|---|--------|---------------------|
| 2 | Alpha, Beta | 2 |
| 3 | Alpha, Beta, Gamma | 6 |
| 4 | Alpha, Beta, Gamma, Delta | 12 |
| 5 | Alpha, Beta, Gamma, Delta, Epsilon | 20 |

More agents means broader cross-critique coverage but more API calls. Start with 2 (the default) and increase when you want additional perspectives on a high-stakes problem.

### What kinds of tasks work best

Crucible is most valuable when a wrong answer would be costly and you want more than one perspective before trusting the result. It works for:

- **Algorithm and data structure problems** — two agents will often pick different implementations, exposing trade-offs you might not have considered
- **Architecture and design decisions** — forces both sides of a trade-off to be argued rigorously before a conclusion is drawn
- **Technical explanations** — if an explanation survives being attacked by another agent, you can trust it is accurate
- **System design** — surfaces edge cases and failure modes that a single agent would miss
- **Any decision where you want a second opinion that genuinely disagrees rather than rubber-stamps**

### Examples

```bash
# Default (2 agents)
/crucible implement a thread-safe LRU cache in Python

# 3 agents for broader coverage
/crucible --agents 3 should we use event sourcing or traditional CRUD for a high-write orders system?

# Authentication
/crucible compare JWT vs session-based authentication for a mobile app backend

# System design with extra scrutiny
/crucible --agents 4 design a rate limiter that supports sliding window and token bucket strategies

# Distributed systems
/crucible explain why consistent hashing is used in distributed caches

# Language choice
/crucible should I write this CLI tool in Go or Rust?
```

### What you will see

The debate streams to your screen in real time as each phase completes. You do not wait until the end — you watch the argument unfold:

```
## Crucible started
Task: implement a thread-safe LRU cache in Python
Agents: Alpha, Beta (2 agents)

### Round 1 — Opening Proposals
Alpha, Beta are independently forming their positions...

#### Agent Alpha's Opening Position
I'll use OrderedDict with threading.Lock for O(1) get/put...

#### Agent Beta's Opening Position
I'll use a doubly-linked list + hashmap to avoid Python GIL limitations...

### Round 2 — Cross-Attack
Running 2 critiques in parallel...
#### Alpha attacks Beta
[FATAL] Your linked list has a race condition on concurrent eviction...
[MAJOR] The complexity is unnecessary — OrderedDict already handles ordering...

#### Beta attacks Alpha
[MAJOR] threading.Lock is too coarse — causes contention under high load...
[MINOR] OrderedDict.move_to_end() is O(1) but not documented as thread-safe...

#### Round 2 — Defense
#### Alpha's Defense & Refined Position
Conceding the lock granularity point — switching to RLock with finer scope...

#### Beta's Defense & Refined Position
Conceding the complexity point — simplifying to collections.deque + dict...

#### Convergence Result
DIVERGED — core disagreement on lock strategy remains.

### Round 3 — Second Cross-Attack
...

### Arbiter's Verdict
| Criterion                  | Alpha | Beta |
|----------------------------|-------|------|
| Correctness                |  8/10 | 7/10 |
| Intellectual Honesty       |  9/10 | 8/10 |
| Attack Quality             |  8/10 | 9/10 |
| Improvement Across Rounds  |  9/10 | 8/10 |
| Final Position             |  9/10 | 7/10 |
| Total                      | 43/50 | 39/50 |

**Final Answer:** [synthesized definitive solution]
**Confidence:** HIGH
```

---

## Agents

| Agent | Model | Role |
|-------|-------|------|
| `debater` | Claude Sonnet | Proposes solutions, attacks every opponent, defends its own position |
| `arbiter` | Claude Opus | Reads the full debate transcript, scores all agents, synthesizes the final answer |

The same `debater` agent plays all three roles — propose, critique, defend — across all rounds. It switches behavior based on the mode it receives in each prompt. All N debaters use the same agent type, which eliminates bias toward any particular role or position.

The `arbiter` uses Claude Opus, the most capable model, because it has the hardest job: reading the entire debate, judging every position fairly, and producing an answer that is stronger than any individual agent's final position.

---

## Why It Works

A single AI asked a question will produce a confident answer whether it is right or wrong. There is no internal pressure to find its own mistakes. Crucible changes this by introducing a second agent whose job is specifically to find those mistakes.

- **Blind spots surface** when two agents approach the same problem differently and attack each other's assumptions
- **Errors get caught** when the opponent targets a specific argument rather than giving generic feedback
- **Positions improve each round** as agents are forced to concede valid points and fix real flaws
- **Convergence is meaningful** — when adversarial agents agree, that agreement is earned through argument, not assumed from the start
- **More agents, more coverage** — running 3–5 agents surfaces blind spots that a two-agent debate might miss, at the cost of more API calls
- **The arbiter goes further** — it does not just pick a winner but synthesizes an answer stronger than any agent's final position by combining the best elements of all

---

## Plugin Structure

```
crucible/
├── .claude-plugin/
│   └── plugin.json        # Plugin metadata
├── commands/
│   └── crucible.md        # /crucible slash command — orchestrates the full debate
├── agents/
│   ├── debater.md         # Debater agent (propose / critique / defend modes)
│   └── arbiter.md         # Arbiter agent (final verdict + synthesis)
└── README.md
```

---

## Live Viewer (optional)

The Viewer is a real-time game-like UI that shows the debate as it unfolds — agents as player cards arranged in an arena, animated attack arrows flying between them, HP bars that drain on valid hits, and a live speech panel showing each agent's current statement.

```
┌─────────────────────────────────────────────────────────┐
│  ⚔ CRUCIBLE  ·  Round 2 — Cross-Attack                 │
│  Task: design a rate limiter                            │
├────────────────────────────────┬────────────────────────┤
│                                │ Alpha → Beta  ATTACK   │
│      🔵 ALPHA                  │ [FATAL] Your token      │
│      ⚡ ATTACKING               │ bucket has a race       │
│      ████████░░                │ condition on the        │
│        ↘                       │ refill thread…          │
│         [  ARENA  ]            ├────────────────────────┤
│        ↗                       │ LOG                     │
│      🔴 BETA                   │ ATTACK  Alpha→Beta      │
│      🛡 DEFENDING               │ DEFEND  Beta (R2)       │
│      ██████░░░░                │ PHASE   Round 3         │
└────────────────────────────────┴────────────────────────┘
```

### Setup

**1. Install dependencies and start the server**

```bash
cd crucible/viewer
npm install
node server.js
```

Open `http://localhost:3141` in your browser.

**2. Register the hook** (one-time, enables automatic streaming)

Add to `~/.claude/settings.json` — replace the path with your actual clone location:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Agent",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/crucible/viewer/hook.js"
      }]
    }]
  }
}
```

The hook fires automatically after every Agent tool call. It detects crucible debater and arbiter results, parses the agent name/mode/round from the prompt, and streams the content directly to the server — no temp files, no emit commands inside the debate.

**3. Run `/crucible` as normal.** Everything streams via the hook automatically — no bash commands inside the debate, no temp files, no permission prompts.

### What you see

| Element | Meaning |
|---------|---------|
| Agent card border glow | Agent is currently active |
| Animated arrow X → Y | X is attacking Y right now |
| HP bar dropping | Agent absorbing a critique |
| HP bar recovering | Agent successfully defended |
| CONVERGED / DIVERGED overlay | Convergence check result |
| ⚖️ Arbiter card appears | Final arbitration in progress |

---

## License

MIT
