# Crucible

A Claude Code plugin that pits multiple AI agents against each other in adversarial debate. Agents independently propose solutions, self-critique, then attack and defend across adaptive rounds until they converge on the strongest answer. An arbiter scores every position and synthesizes the final result.

![Crucible Demo](demo/crucible-demo.gif)

## How It Works

```mermaid
flowchart TD
    A1([Agent 1]):::agent --> P
    A2([Agent 2]):::agent --> P
    AN([Agent N]):::agent --> P

    P["<b>Round 1 — Propose</b><br/>Each agent proposes independently"]:::propose
    P --> SC

    SC["<b>Round 1.5 — Self-Critique</b><br/>Each agent attacks its own proposal<br/>and produces a hardened position"]:::critique
    SC --> LOOP

    subgraph LOOP ["ADAPTIVE LOOP"]
        ATK["<b>Cross-Attack</b><br/>Every agent attacks every other<br/>N×(N-1) critiques in parallel"]:::attack
        DEF["<b>Defend</b><br/>Every agent defends and refines"]:::defend
        CHK{"Converged?"}:::check

        ATK --> DEF --> CHK
        CHK -- "DIVERGED<br/>extract focus areas" --> ATK
    end

    CHK -- "CONVERGED /<br/>max rounds" --> ARB

    ARB["<b>ARBITER</b><br/>Reads full transcript · Scores all agents (/60)<br/>May send back for 1 more round<br/>Synthesizes final answer"]:::arbiter

    classDef agent fill:#6366f1,stroke:#4f46e5,color:#fff,font-weight:bold
    classDef propose fill:#3b82f6,stroke:#2563eb,color:#fff
    classDef critique fill:#f59e0b,stroke:#d97706,color:#fff
    classDef attack fill:#ef4444,stroke:#dc2626,color:#fff
    classDef defend fill:#22c55e,stroke:#16a34a,color:#fff
    classDef check fill:#a855f7,stroke:#9333ea,color:#fff,font-weight:bold
    classDef arbiter fill:#0ea5e9,stroke:#0284c7,color:#fff,font-weight:bold
```

Debaters have access to `Read`, `Grep`, `Glob`, and `WebSearch` to gather evidence. The arbiter always uses Opus.

## Install

```bash
git clone https://github.com/sharifli4/crucible.git
```

Add to `~/.claude/settings.json`:

```json
{
  "pluginDirectories": ["/path/to/crucible"]
}
```

Or load for a single session:

```bash
claude --plugin-dir /path/to/crucible
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
├── .claude-plugin/plugin.json
├── commands/crucible.md
├── agents/
│   ├── debater.md
│   └── arbiter.md
└── README.md
```

## License

MIT
