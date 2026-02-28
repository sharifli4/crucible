---
description: Run N debater agents (2–5) that propose, attack each other, and defend their positions across multiple rounds until they converge on the best answer
argument-hint: [--agents N] <task description>
allowed-tools: [Agent, Read, Write, Bash]
---

# Crucible

N debater agents will independently propose solutions, cross-attack every other agent's solution, defend their own positions, and refine across multiple rounds. An arbiter synthesizes the final answer.

Show the user what is happening at every step. Do not wait until the end to reveal results — surface each phase's output immediately after it completes.

**Viewer:** if the file `/tmp/crucible_emit` exists, the Crucible Viewer is running. Emit events by running:
```bash
[ -f /tmp/crucible_emit ] && /tmp/crucible_emit <type> '<json>' [content-file] || true
```
All viewer emit steps below follow this pattern and are silent no-ops if the viewer is not running.

---

## SETUP — Parse Arguments

Arguments received: `$ARGUMENTS`

1. **If** `$ARGUMENTS` starts with `--agents N` (where N is an integer 2–5):
   - Set `NUMBER_OF_AGENTS = N`
   - Set `TASK = $ARGUMENTS` with the leading `--agents N` stripped and trimmed
2. **Otherwise:**
   - Set `NUMBER_OF_AGENTS = 2`
   - Set `TASK = $ARGUMENTS`

Agent name pool (in order): **Alpha, Beta, Gamma, Delta, Epsilon**

Assign `AGENTS = [first NUMBER_OF_AGENTS names from the pool]`. Examples:
- N=2 → [Alpha, Beta]
- N=3 → [Alpha, Beta, Gamma]
- N=4 → [Alpha, Beta, Gamma, Delta]
- N=5 → [Alpha, Beta, Gamma, Delta, Epsilon]

All subsequent steps use `TASK` as the task and `AGENTS` as the list of agent names.

**Viewer — emit `debate_started`:**
```bash
[ -f /tmp/crucible_emit ] && /tmp/crucible_emit debate_started '{"task":"[TASK]","agents":["Alpha","Beta",...real names...],"numAgents":[NUMBER_OF_AGENTS]}' || true
```
(substitute actual agent names and count)

---

## ROUND 1 — Independent Proposals

**Viewer — emit `phase_started`:**
```bash
[ -f /tmp/crucible_emit ] && /tmp/crucible_emit phase_started '{"phase":"proposals","label":"Round 1 — Opening Proposals","round":1}' || true
```

Tell the user:
```
## Crucible started

**Task:** [TASK]
**Agents:** [AGENTS joined by ", "] ([NUMBER_OF_AGENTS] agents)

---

### Round 1 — Opening Proposals
[AGENTS joined by ", "] are independently forming their positions...
```

Launch **all agents in parallel** using the `crucible:debater` agent. For **each agent X** in AGENTS:

**Prompt:**
```
You are Agent [X]. MODE: PROPOSE

Task: [TASK]

Propose your complete solution independently. Do not hold back — this is your opening position.
```

Collect each result as `[AGENT_X_R1]` (e.g., `[AGENT_ALPHA_R1]`, `[AGENT_BETA_R1]`, etc.).

**Viewer — after each proposal:** for each agent X:
1. Use the Write tool to write `[AGENT_X_R1]` to `/tmp/crucible_[X]_r1.txt`
2. Run: `[ -f /tmp/crucible_emit ] && /tmp/crucible_emit proposal '{"agent":"[X]","round":1}' /tmp/crucible_[X]_r1.txt || true`

Immediately show the user each agent's opening position:
```
#### Agent [X]'s Opening Position

[AGENT_X_R1]

---
```
(repeat for each agent X in AGENTS)

---

## ROUND 2 — Cross-Attack

**Viewer — emit `phase_started`:**
```bash
[ -f /tmp/crucible_emit ] && /tmp/crucible_emit phase_started '{"phase":"critiques","label":"Round 2 — Cross-Attack","round":2}' || true
```

Tell the user:
```
### Round 2 — Cross-Attack
Every agent is attacking every other agent's solution. Running [NUMBER_OF_AGENTS * (NUMBER_OF_AGENTS - 1)] critiques in parallel...
```

Launch **all critiques in parallel** using the `crucible:debater` agent. For every **ordered pair (X, Y)** where X ≠ Y in AGENTS (full round-robin):

**Prompt for X attacking Y:**
```
You are Agent [X]. MODE: CRITIQUE

Task: [TASK]

Your own solution (Round 1):
[AGENT_X_R1]

Opponent ([Y]) solution to critique:
[AGENT_Y_R1]

Directly attack [Y]'s solution. Find every flaw. Show why your approach is stronger.
```

Collect each result as `[AGENT_X_ATTACKS_AGENT_Y_R2]` (e.g., `[AGENT_ALPHA_ATTACKS_AGENT_BETA_R2]`).

**Viewer — after each critique:** for each pair (X, Y):
1. Write `[AGENT_X_ATTACKS_AGENT_Y_R2]` to `/tmp/crucible_[X]_[Y]_c2.txt`
2. Run: `[ -f /tmp/crucible_emit ] && /tmp/crucible_emit critique '{"attacker":"[X]","target":"[Y]","round":2}' /tmp/crucible_[X]_[Y]_c2.txt || true`

Immediately show the user each critique:
```
#### [X] attacks [Y]

[AGENT_X_ATTACKS_AGENT_Y_R2]

---
```
(repeat for each ordered pair X → Y)

---

## ROUND 2 — Defense & Refinement

**Viewer — emit `phase_started`:**
```bash
[ -f /tmp/crucible_emit ] && /tmp/crucible_emit phase_started '{"phase":"defenses","label":"Round 2 — Defense","round":2}' || true
```

Tell the user:
```
#### Round 2 — Defense
Each agent is now responding to all attacks and refining their position...
```

Launch **all defenses in parallel** using the `crucible:debater` agent. For **each agent X** in AGENTS:

Build a **critique block** for X by collecting all `[AGENT_Y_ATTACKS_AGENT_X_R2]` for every Y ≠ X, formatted as:
```
[Y]'s attack on your solution:
[AGENT_Y_ATTACKS_AGENT_X_R2]
```
(one section per attacker Y, in order)

**Prompt for agent X:**
```
You are Agent [X]. MODE: DEFEND

Task: [TASK]

Your solution (Round 1):
[AGENT_X_R1]

[critique block for X]

Defend your position against all attacks above. Concede valid points and fix them. Refute invalid attacks. Produce your unified refined solution.
```

Collect each result as `[AGENT_X_R2]`.

**Viewer — after each defense:** for each agent X:
1. Write `[AGENT_X_R2]` to `/tmp/crucible_[X]_d2.txt`
2. Run: `[ -f /tmp/crucible_emit ] && /tmp/crucible_emit defense '{"agent":"[X]","round":2}' /tmp/crucible_[X]_d2.txt || true`

Immediately show the user each defense:
```
#### [X]'s Defense & Refined Position

[AGENT_X_R2]

---
```
(repeat for each agent X)

---

## CONVERGENCE CHECK after Round 2

Tell the user:
```
#### Convergence Check
Checking whether all agents have reached agreement...
```

Launch a **single Haiku agent**:
```
TASK: [TASK]

NUMBER OF AGENTS: [NUMBER_OF_AGENTS]

[For each agent X in AGENTS:]
Agent [X]'s current position:
[AGENT_X_R2]

[end repeat]

Have ALL [NUMBER_OF_AGENTS] agents converged on essentially the same solution? Answer with one word: CONVERGED or DIVERGED.

Then in 2-3 sentences, explain what the remaining core disagreements are (if DIVERGED) or what they all agreed on (if CONVERGED).
```

Collect result as `[CONVERGENCE]`.

**Viewer — emit convergence:**
1. Write `[CONVERGENCE]` to `/tmp/crucible_conv.txt`
2. Run: `[ -f /tmp/crucible_emit ] && /tmp/crucible_emit convergence '{"result":"[first word of CONVERGENCE — CONVERGED or DIVERGED]"}' /tmp/crucible_conv.txt || true`

Immediately show the user:
```
#### Convergence Result

[CONVERGENCE]

---
```

**If CONVERGED**: tell the user `> All agents have converged — skipping to final arbitration.` then jump to FINAL ARBITRATION.
**If DIVERGED**: tell the user `> Agents still disagree — proceeding to Round 3.` then continue to Round 3.

---

## ROUND 3 — Second Cross-Attack

**Viewer — emit `phase_started`:**
```bash
[ -f /tmp/crucible_emit ] && /tmp/crucible_emit phase_started '{"phase":"critiques","label":"Round 3 — Cross-Attack","round":3}' || true
```

Tell the user:
```
### Round 3 — Second Cross-Attack
Every agent is attacking every other agent's refined positions. Running [NUMBER_OF_AGENTS * (NUMBER_OF_AGENTS - 1)] critiques in parallel...
```

Launch **all critiques in parallel** using the `crucible:debater` agent. For every **ordered pair (X, Y)** where X ≠ Y in AGENTS:

**Prompt for X attacking Y:**
```
You are Agent [X]. MODE: CRITIQUE

Task: [TASK]

Your current refined solution (Round 2):
[AGENT_X_R2]

Opponent ([Y]) refined solution to critique:
[AGENT_Y_R2]

[Y] has refined their position. Attack it again. Focus on what still remains weak or wrong. Push for your position to win.
```

Collect each result as `[AGENT_X_ATTACKS_AGENT_Y_R3]`.

**Viewer — after each critique:** for each pair (X, Y):
1. Write `[AGENT_X_ATTACKS_AGENT_Y_R3]` to `/tmp/crucible_[X]_[Y]_c3.txt`
2. Run: `[ -f /tmp/crucible_emit ] && /tmp/crucible_emit critique '{"attacker":"[X]","target":"[Y]","round":3}' /tmp/crucible_[X]_[Y]_c3.txt || true`

Immediately show the user each critique:
```
#### [X] attacks [Y] (Round 3)

[AGENT_X_ATTACKS_AGENT_Y_R3]

---
```
(repeat for each ordered pair X → Y)

---

## ROUND 3 — Final Defense & Refinement

**Viewer — emit `phase_started`:**
```bash
[ -f /tmp/crucible_emit ] && /tmp/crucible_emit phase_started '{"phase":"defenses","label":"Round 3 — Final Defense","round":3}' || true
```

Tell the user:
```
#### Round 3 — Final Defense
Each agent is delivering their final position...
```

Launch **all defenses in parallel** using the `crucible:debater` agent. For **each agent X** in AGENTS:

Build a **critique block** for X from Round 3: collect all `[AGENT_Y_ATTACKS_AGENT_X_R3]` for every Y ≠ X.

**Prompt for agent X:**
```
You are Agent [X]. MODE: DEFEND

Task: [TASK]

Your refined solution (Round 2):
[AGENT_X_R2]

[critique block for X — Round 3 attacks]

This is your final round. Give your definitive, fully-refined position. Concede anything truly wrong. Defend everything that holds.
```

Collect each result as `[AGENT_X_R3]`.

**Viewer — after each defense:** for each agent X:
1. Write `[AGENT_X_R3]` to `/tmp/crucible_[X]_d3.txt`
2. Run: `[ -f /tmp/crucible_emit ] && /tmp/crucible_emit defense '{"agent":"[X]","round":3}' /tmp/crucible_[X]_d3.txt || true`

Immediately show the user each final position:
```
#### [X]'s Final Position

[AGENT_X_R3]

---
```
(repeat for each agent X)

---

## FINAL ARBITRATION

**Viewer — emit `phase_started`:**
```bash
[ -f /tmp/crucible_emit ] && /tmp/crucible_emit phase_started '{"phase":"arbitration","label":"Final Arbitration"}' || true
```

Tell the user:
```
### Final Arbitration
The arbiter is reading the full debate transcript and rendering a verdict...
```

Launch the `crucible:arbiter` agent with the complete debate transcript:

```
TASK: [TASK]
NUMBER OF AGENTS: [NUMBER_OF_AGENTS]
AGENTS: [AGENTS joined by ", "]

=== ROUND 1: INITIAL PROPOSALS ===

[For each agent X in AGENTS:]
Agent [X] (Round 1):
[AGENT_X_R1]

[end repeat]

=== ROUND 2: FIRST ATTACK ROUND ===

[For each ordered pair (X, Y) where X ≠ Y:]
[X] attacks [Y]:
[AGENT_X_ATTACKS_AGENT_Y_R2]

[end repeat]

[For each agent X in AGENTS:]
[X] defends and refines (Round 2):
[AGENT_X_R2]

[end repeat]

=== ROUND 3: SECOND ATTACK ROUND === (include only if Round 3 ran)

[For each ordered pair (X, Y) where X ≠ Y:]
[X] attacks [Y]:
[AGENT_X_ATTACKS_AGENT_Y_R3]

[end repeat]

[For each agent X in AGENTS:]
[X]'s final position (Round 3):
[AGENT_X_R3]

[end repeat]

Read the complete debate transcript above. Score all [NUMBER_OF_AGENTS] agents. Synthesize the definitive final answer.
```

**Viewer — after arbiter output:**
1. Write the arbiter's full output to `/tmp/crucible_final.txt`
2. Run: `[ -f /tmp/crucible_emit ] && /tmp/crucible_emit final_answer '{}' /tmp/crucible_final.txt || true`

Show the arbiter's full output to the user immediately under:
```
### Arbiter's Verdict

[arbiter output]
```
