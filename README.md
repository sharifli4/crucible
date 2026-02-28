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

## Installation

**Load for a single session:**
```bash
claude --plugin-dir /path/to/crucible
```

**Install permanently:**
```bash
/plugin install sharifli4/crucible
```

## Usage

```bash
/crucible <task>
```

**Examples:**

```bash
# Algorithms & data structures
/crucible implement a thread-safe LRU cache in Python

# Architecture decisions
/crucible should we use event sourcing or traditional CRUD for a high-write orders system?

# Trade-off analysis
/crucible compare JWT vs session-based authentication for a mobile app backend

# System design
/crucible design a rate limiter that supports sliding window and token bucket strategies

# Explanations
/crucible explain why consistent hashing is used in distributed caches
```

## What You See

The debate streams to your screen as it happens:

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

## Agents

| Agent | Model | Role |
|-------|-------|------|
| `debater` | Claude Sonnet | Proposes solutions, attacks the opponent, defends its own position |
| `arbiter` | Claude Opus | Reads the full debate transcript, scores both agents, synthesizes the final answer |

The same `debater` agent plays all three roles — propose, critique, defend — across all rounds. It switches behavior based on the mode it receives in each prompt.

## Why It Works

A single AI asked a question will produce a confident answer whether it is right or wrong. Crucible forces that answer through adversarial pressure:

- **Blind spots surface** when two agents approach the same problem differently
- **Errors get caught** when the opponent attacks a specific argument rather than giving generic feedback
- **Positions improve** across rounds as agents concede valid points and fix real flaws
- **Convergence is meaningful** — when two adversarial agents agree, that agreement is earned, not assumed
- **The arbiter goes further** — it synthesizes an answer stronger than either agent's final position

## Plugin Structure

```
crucible/
├── .claude-plugin/
│   └── plugin.json        # Plugin metadata
├── commands/
│   └── crucible.md        # /crucible slash command
├── agents/
│   ├── debater.md         # Debater agent (propose / critique / defend)
│   └── arbiter.md         # Arbiter agent (final verdict + synthesis)
└── README.md
```

## License

MIT
