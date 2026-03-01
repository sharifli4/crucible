# Crucible

A Claude Code plugin that runs multiple AI agents against each other — they independently propose solutions, harden them through self-critique, then directly attack every other agent's arguments and defend their own positions across adaptive debate rounds until they converge on the most correct answer. Run 2–5 agents depending on how much cross-critique coverage you want.

## How It Works

Raw answers go in. Adversarial pressure is applied. Refined answers come out.

```
Round 1     Agent 1 proposes ─── Agent 2 proposes ─── … Agent N proposes
                  │                     │                      │
Round 1.5   Each agent self-critiques and hardens its own proposal
                  │                     │                      │
            ┌─────┴─────────────────────┴──────────────────────┴─────┐
            │                    ADAPTIVE LOOP                       │
            │  Round K   Every agent attacks every other agent       │
            │            (N×(N-1) critiques, focused on FOCUS_AREAS) │
            │                │                                       │
            │            Every agent defends against all attacks     │
            │                │                                       │
            │            Convergence check (haiku)                   │
            │            → CONVERGED? exit loop                      │
            │            → DIVERGED? extract focus areas, loop       │
            │            → Max rounds? exit loop                     │
            └────────────────────────────────────────────────────────┘
                  │
                  └──────────────── Arbiter ──────────────────┐
                                Reads full transcript          │
                                Scores all N agents (/60)      │
                                May SEND_BACK for 1 more round │
                                Synthesizes final answer       │
                                ───────────────────────────────┘
```

Each step is shown to the user in real time as the debate unfolds.

---

## Features

### Adaptive Rounds

Instead of a fixed 2–3 round structure, Crucible now runs an adaptive loop that continues until agents converge or hit the max round cap (default 5, configurable with `--rounds`). Simple problems resolve in 2 rounds; complex disagreements get the extra rounds they need.

### Self-Critique (Round 1.5)

After initial proposals, each agent attacks its own solution before any opponent sees it. This produces hardened positions that are harder to dismantle — opponents must find genuinely novel weaknesses rather than obvious ones the proposer already caught.

### Targeted Critique

When the convergence check finds agents still disagree, it extracts specific `FOCUS:` areas — the top 2–3 unresolved technical points. Subsequent attack rounds inject these focus areas so agents concentrate on what actually matters rather than re-litigating settled points.

### Evidence Gathering

Debater agents have access to tools (`Read`, `Grep`, `Glob`, `WebSearch`) and are instructed to back their arguments with real evidence. Claims sourced from tools are marked with `[EVIDENCE]` tags. The arbiter scores evidence usage as part of the scorecard.

### Arbiter Send-Back

The arbiter can send the debate back for one more targeted round if it identifies a specific fixable gap. It provides `FOCUS:` lines and a `REASON:`, the agents run one more attack+defense cycle on those points, and the arbiter re-arbitrates. Capped at one send-back to prevent infinite loops.

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
/crucible [--agents N] [--model sonnet|opus] [--rounds N] <your task here>
```

All flags are optional. Defaults: 2 agents, sonnet model, 5 max rounds.

### `--agents N`

Set how many debater agents participate. N can be 2, 3, 4, or 5.

```bash
/crucible --agents 3 design a rate limiter
```

### `--model sonnet|opus`

Set the model used for debater agents. Defaults to `sonnet`. Use `opus` for tasks that require deeper reasoning — the adversarial structure compensates for most of Sonnet's gaps, but complex problems benefit from stronger individual proposals.

```bash
/crucible --model opus design a distributed consensus algorithm
/crucible --agents 3 --model opus should we use CRDTs or OT for collaborative editing?
```

The arbiter always uses Opus regardless of this flag.

### `--rounds N`

Set the maximum number of cross-attack rounds (2–5). Defaults to 5. The loop exits early if agents converge, so this is a cap, not a fixed count.

```bash
/crucible --rounds 3 implement a thread-safe LRU cache in Python
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

# Limit rounds for faster results
/crucible --rounds 2 compare JWT vs session-based authentication for a mobile app backend

# System design with extra scrutiny
/crucible --agents 4 design a rate limiter that supports sliding window and token bucket strategies

# Maximum depth — opus model, more agents
/crucible --agents 3 --model opus --rounds 4 design a distributed consensus algorithm
```

### What you will see

The debate streams to your screen in real time as each phase completes. You do not wait until the end — you watch the argument unfold:

```
## Crucible started
Task: implement a thread-safe LRU cache in Python
Agents: Alpha, Beta (2 agents)
Debater model: sonnet
Max rounds: 5

### Round 1 — Opening Proposals
Alpha, Beta are independently forming their positions...

#### Agent Alpha's Opening Position
I'll use OrderedDict with threading.Lock for O(1) get/put...
[EVIDENCE] Python docs confirm OrderedDict.move_to_end() is O(1)

#### Agent Beta's Opening Position
I'll use a doubly-linked list + hashmap to avoid Python GIL limitations...

### Round 1.5 — Self-Critique
Each agent is attacking their own proposal...

#### Alpha's Self-Critique & Hardened Position
[MAJOR] threading.Lock is too coarse — switching to RLock with finer scope...

#### Beta's Self-Critique & Hardened Position
[MAJOR] Custom linked list adds complexity — simplifying node management...

### Round 2 — Cross-Attack
Running 2 critiques in parallel...
#### Alpha attacks Beta
[FATAL] Your linked list has a race condition on concurrent eviction...

#### Beta attacks Alpha
[MAJOR] RLock still causes contention under high load...

#### Round 2 — Defense
...

#### Convergence Check (Round 2)
DIVERGED
FOCUS: Lock granularity strategy (coarse RLock vs fine-grained per-node locks)
FOCUS: Whether custom linked list is justified over OrderedDict

### Round 3 — Cross-Attack
(focused on lock strategy and data structure choice)
...

#### Convergence Check (Round 3)
CONVERGED — both agents now agree on OrderedDict + RLock with read-write separation.

### Arbiter's Verdict
| Criterion                          | Alpha | Beta |
|------------------------------------|-------|------|
| Correctness                        |  8/10 | 7/10 |
| Intellectual Honesty               |  9/10 | 8/10 |
| Attack Quality                     |  8/10 | 9/10 |
| Evidence Usage                     |  7/10 | 6/10 |
| Improvement Across Rounds          |  9/10 | 8/10 |
| Final Position Trustworthiness     |  9/10 | 7/10 |
| Total                              | 50/60 | 45/60 |

**Final Answer:** [synthesized definitive solution]
**Confidence:** HIGH
```

---

## Agents

| Agent | Default Model | Role |
|-------|---------------|------|
| `debater` | Claude Sonnet (configurable via `--model`) | Proposes solutions, self-critiques, attacks every opponent, defends its own position, gathers evidence with tools |
| `arbiter` | Claude Opus | Reads the full debate transcript, scores all agents (/60), may send back for one more round, synthesizes the final answer |

The same `debater` agent plays all four roles — propose, self-critique, critique, defend — across all rounds. It switches behavior based on the mode it receives in each prompt. All N debaters use the same agent type, which eliminates bias toward any particular role or position. The debater model can be set to `opus` with `--model opus` for tasks that need stronger individual reasoning.

Debater agents have access to `Read`, `Grep`, `Glob`, and `WebSearch` tools to gather evidence during their arguments. Evidence-backed claims are marked with `[EVIDENCE]` tags and scored by the arbiter.

The `arbiter` always uses Claude Opus, the most capable model, because it has the hardest job: reading the entire debate, judging every position fairly, and producing an answer that is stronger than any individual agent's final position. The arbiter may also send the debate back for one more targeted round if it identifies a specific gap that more debate would resolve.

---

## Why It Works

A single AI asked a question will produce a confident answer whether it is right or wrong. There is no internal pressure to find its own mistakes. Crucible changes this by introducing a second agent whose job is specifically to find those mistakes.

- **Self-critique hardens proposals** before opponents even see them — easy weaknesses are fixed first, forcing deeper critique
- **Blind spots surface** when two agents approach the same problem differently and attack each other's assumptions
- **Errors get caught** when the opponent targets a specific argument rather than giving generic feedback
- **Evidence grounds arguments** — agents back claims with tool-sourced data, not just assertions
- **Targeted rounds focus debate** — after each round, the convergence check identifies specific unresolved points so agents stop re-litigating settled issues
- **Adaptive depth** — simple problems converge fast; complex problems get the rounds they need
- **Positions improve each round** as agents are forced to concede valid points and fix real flaws
- **Convergence is meaningful** — when adversarial agents agree, that agreement is earned through argument, not assumed from the start
- **More agents, more coverage** — running 3–5 agents surfaces blind spots that a two-agent debate might miss, at the cost of more API calls
- **The arbiter goes further** — it does not just pick a winner but synthesizes an answer stronger than any agent's final position by combining the best elements of all
- **Send-back catches gaps** — if the arbiter sees a fixable issue, it sends agents back for one more focused round rather than settling for an incomplete answer

---

## Plugin Structure

```
crucible/
├── .claude-plugin/
│   └── plugin.json        # Plugin metadata
├── commands/
│   └── crucible.md        # /crucible slash command — orchestrates the full debate
├── agents/
│   ├── debater.md         # Debater agent (propose / self-critique / critique / defend modes)
│   └── arbiter.md         # Arbiter agent (final verdict + synthesis + optional send-back)
└── README.md
```

---

## License

MIT
