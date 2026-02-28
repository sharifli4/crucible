# Crucible

A Claude Code plugin that runs two AI agents against each other — they independently propose solutions, directly attack each other's arguments, and defend their own positions across multiple debate rounds until they converge on the most correct answer.

## How It Works

Raw answers go in. Adversarial pressure is applied. Refined answers come out.

```
Round 1   Alpha proposes ──────────────── Beta proposes
               │                               │
Round 2   Alpha attacks Beta's solution        │
               │         Beta attacks Alpha's solution
               │                               │
          Alpha defends + refines         Beta defends + refines
               │                               │
          [Convergence check — stop early if they agree]
               │                               │
Round 3   Alpha attacks Beta's refined position│
               │         Beta attacks Alpha's refined position
               │                               │
          Alpha's final position          Beta's final position
               │                               │
               └──────────── Arbiter ──────────┘
                      Reads full transcript
                      Scores both agents
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
/crucible <your task here>
```

There are no other options or flags — just describe what you want solved and the debate begins automatically.

### What kinds of tasks work best

Crucible is most valuable when a wrong answer would be costly and you want more than one perspective before trusting the result. It works for:

- **Algorithm and data structure problems** — two agents will often pick different implementations, exposing trade-offs you might not have considered
- **Architecture and design decisions** — forces both sides of a trade-off to be argued rigorously before a conclusion is drawn
- **Technical explanations** — if an explanation survives being attacked by another agent, you can trust it is accurate
- **System design** — surfaces edge cases and failure modes that a single agent would miss
- **Any decision where you want a second opinion that genuinely disagrees rather than rubber-stamps**

### Examples

```bash
# Data structures
/crucible implement a thread-safe LRU cache in Python

# Architecture
/crucible should we use event sourcing or traditional CRUD for a high-write orders system?

# Authentication
/crucible compare JWT vs session-based authentication for a mobile app backend

# System design
/crucible design a rate limiter that supports sliding window and token bucket strategies

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

### Round 1 — Opening Proposals
Alpha and Beta are independently forming their positions...

#### Agent Alpha's Opening Position
I'll use OrderedDict with threading.Lock for O(1) get/put...

#### Agent Beta's Opening Position
I'll use a doubly-linked list + hashmap to avoid Python GIL limitations...

### Round 2 — Cross-Attack
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
| `debater` | Claude Sonnet | Proposes solutions, attacks the opponent, defends its own position |
| `arbiter` | Claude Opus | Reads the full debate transcript, scores both agents, synthesizes the final answer |

The same `debater` agent plays all three roles — propose, critique, defend — across all rounds. It switches behavior based on the mode it receives in each prompt. This means Alpha and Beta are not separate specialists — the same agent type argues both sides, which eliminates bias toward one role over another.

The `arbiter` uses Claude Opus, the most capable model, because it has the hardest job: reading the entire debate, judging each position fairly, and producing an answer that is stronger than either agent's final position.

---

## Why It Works

A single AI asked a question will produce a confident answer whether it is right or wrong. There is no internal pressure to find its own mistakes. Crucible changes this by introducing a second agent whose job is specifically to find those mistakes.

- **Blind spots surface** when two agents approach the same problem differently and attack each other's assumptions
- **Errors get caught** when the opponent targets a specific argument rather than giving generic feedback
- **Positions improve each round** as agents are forced to concede valid points and fix real flaws
- **Convergence is meaningful** — when two adversarial agents agree, that agreement is earned through argument, not assumed from the start
- **The arbiter goes further** — it does not just pick a winner but synthesizes an answer stronger than either agent's final position by combining the best elements of both

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

## License

MIT
