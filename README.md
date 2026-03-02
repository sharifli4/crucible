# Crucible

A Claude Code plugin that pits multiple AI agents against each other in adversarial debate. Agents independently propose solutions, self-critique, then attack and defend across adaptive rounds until they converge on the strongest answer. An arbiter scores every position and synthesizes the final result.

![Crucible Demo](demo/crucible-demo.gif)

## How It Works

```
                    ┌─────────┐   ┌─────────┐   ┌─────────┐
                    │ Agent 1 │   │ Agent 2 │   │ Agent N │
                    └────┬────┘   └────┬────┘   └────┬────┘
                         │             │              │
  Round 1                ▼             ▼              ▼
  Propose           ┌─────────────────────────────────────┐
                    │   Each agent proposes independently  │
                    └──────────────────┬──────────────────┘
                                       │
  Round 1.5                            ▼
  Self-Critique     ┌─────────────────────────────────────┐
                    │  Each agent attacks its own proposal │
                    │  and produces a hardened position    │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────────────────────────────┐
                    │            ADAPTIVE  LOOP                │
                    │                                          │
  Round K           │  ┌────────────────────────────────────┐  │
  Cross-Attack      │  │  Every agent attacks every other   │  │
                    │  │  N×(N-1) critiques in parallel     │  │
                    │  └─────────────────┬──────────────────┘  │
                    │                    │                      │
  Defend            │  ┌─────────────────▼──────────────────┐  │
                    │  │  Every agent defends and refines   │  │
                    │  └─────────────────┬──────────────────┘  │
                    │                    │                      │
  Converge?         │  ┌─────────────────▼──────────────────┐  │
                    │  │  CONVERGED ──────────► exit loop   │  │
                    │  │  DIVERGED ───► focus areas ► loop  │  │
                    │  │  Max rounds ─────────► exit loop   │  │
                    │  └────────────────────────────────────┘  │
                    └──────────────────┬───────────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────┐
                    │              ARBITER                 │
                    │                                     │
                    │  • Reads full transcript             │
                    │  • Scores all agents (/60)           │
                    │  • May send back for 1 more round    │
                    │  • Synthesizes final answer           │
                    └─────────────────────────────────────┘
```

Debaters have access to `Read`, `Grep`, `Glob`, and `WebSearch` to gather evidence. The arbiter always uses Opus.

## Install

In Claude Code, run:

```
/plugin marketplace add sharifli4/crucible
/plugin install crucible@crucible-marketplace
```

Requires [Claude Code](https://claude.ai/code) with a valid Anthropic API key.

## Usage

```bash
/crucible [--agents N] [--model sonnet|opus] [--rounds N] <your task>
```

| Flag | Default | Description |
|------|---------|-------------|
| `--agents` | 2 | Number of debaters (2-5) |
| `--model` | sonnet | Model for debaters (`sonnet` or `opus`) |
| `--rounds` | 5 | Max cross-attack rounds (2-5, exits early on convergence) |

```bash
/crucible implement a thread-safe LRU cache in Python
/crucible --agents 3 should we use event sourcing or CRUD for a high-write system?
/crucible --agents 3 --model opus design a distributed consensus algorithm
```

## Structure

```
crucible/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── commands/crucible.md
├── agents/
│   ├── debater.md
│   └── arbiter.md
└── README.md
```

## License

MIT
