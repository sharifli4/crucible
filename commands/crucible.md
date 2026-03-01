---
description: Run N debater agents (2–5) that propose, self-critique, cross-attack, and defend across adaptive rounds until they converge on the best answer
argument-hint: [--agents N] [--model sonnet|opus] [--rounds N] <task description>
allowed-tools: [Agent, Read, Write, Bash]
---

# Crucible

N debater agents will independently propose solutions, self-critique to harden their positions, then cross-attack every other agent's solution, defend their own positions, and refine across adaptive rounds. An arbiter synthesizes the final answer — and may send it back for one more targeted round if needed.

Show the user what is happening at every step. Do not wait until the end to reveal results — surface each phase's output immediately after it completes.

---

## SETUP — Parse Arguments

Arguments received: `$ARGUMENTS`

1. Extract optional flags from `$ARGUMENTS`:
   - **If** `--agents N` is present (where N is an integer 2–5): set `NUMBER_OF_AGENTS = N` and remove it from the arguments
   - **Otherwise:** set `NUMBER_OF_AGENTS = 2`
   - **If** `--model MODEL` is present (where MODEL is `sonnet` or `opus`): set `DEBATER_MODEL = MODEL` and remove it from the arguments
   - **Otherwise:** set `DEBATER_MODEL = sonnet`
   - **If** `--rounds N` is present (where N is an integer 2–5): set `MAX_ROUNDS = N` and remove it from the arguments
   - **Otherwise:** set `MAX_ROUNDS = 5`
2. Set `TASK` = remaining arguments after all flags are stripped and trimmed

Agent name pool (in order): **Alpha, Beta, Gamma, Delta, Epsilon**

Assign `AGENTS = [first NUMBER_OF_AGENTS names from the pool]`. Examples:
- N=2 → [Alpha, Beta]
- N=3 → [Alpha, Beta, Gamma]
- N=4 → [Alpha, Beta, Gamma, Delta]
- N=5 → [Alpha, Beta, Gamma, Delta, Epsilon]

Initialize tracking variables:
- `CURRENT_ROUND = 1`
- `CONVERGED = false`
- `SEND_BACK_USED = false`
- `FOCUS_AREAS = []` (empty initially)
- For each agent X: `AGENT_X_LATEST = ""` (will hold most recent position)

All subsequent steps use `TASK` as the task and `AGENTS` as the list of agent names.

---

## ROUND 1 — Independent Proposals

Tell the user:
```
## Crucible started

**Task:** [TASK]
**Agents:** [AGENTS joined by ", "] ([NUMBER_OF_AGENTS] agents)
**Debater model:** [DEBATER_MODEL]
**Max rounds:** [MAX_ROUNDS]

---

### Round 1 — Opening Proposals
[AGENTS joined by ", "] are independently forming their positions...
```

Launch **all agents in parallel** using the `crucible:debater` agent with `model = DEBATER_MODEL`. For **each agent X** in AGENTS:

**Prompt:**
```
You are Agent [X]. MODE: PROPOSE

Task: [TASK]

Propose your complete solution independently. Do not hold back — this is your opening position.
```

Collect each result as `[AGENT_X_R1]`. Set `AGENT_X_LATEST = AGENT_X_R1` for each agent.

Immediately show the user each agent's opening position:
```
#### Agent [X]'s Opening Position

[AGENT_X_R1]

---
```
(repeat for each agent X in AGENTS)

---

## ROUND 1.5 — Self-Critique

Tell the user:
```
### Round 1.5 — Self-Critique
Each agent is attacking their own proposal to find and fix weaknesses before opponents see it...
```

Launch **all agents in parallel** using the `crucible:debater` agent with `model = DEBATER_MODEL`. For **each agent X** in AGENTS:

**Prompt:**
```
You are Agent [X]. MODE: SELF_CRITIQUE

Task: [TASK]

Your proposal (Round 1):
[AGENT_X_R1]

Attack your own solution. Find every weakness — assume an expert opponent will find them if you don't. Fix what you can and produce a hardened version.
```

Collect each result as `[AGENT_X_SELF_CRITIQUE]`. Set `AGENT_X_LATEST = AGENT_X_SELF_CRITIQUE` for each agent.

**Extract Self-Critique Digests:** For each agent X, extract the `### What Changed` and `### Remaining Risks` sections from `[AGENT_X_SELF_CRITIQUE]` and store their combined text as `[AGENT_X_SELF_CRITIQUE_DIGEST]`.

Immediately show the user each self-critique:
```
#### [X]'s Self-Critique & Hardened Position

[AGENT_X_SELF_CRITIQUE]

---
```
(repeat for each agent X in AGENTS)

---

## ADAPTIVE LOOP — Rounds 2 through MAX_ROUNDS

Set `CURRENT_ROUND = 2`.

**Repeat the following while `CURRENT_ROUND <= MAX_ROUNDS` and `CONVERGED == false`:**

### Cross-Attack Phase

Tell the user:
```
### Round [CURRENT_ROUND] — Cross-Attack
Every agent is attacking every other agent's position. Running [NUMBER_OF_AGENTS * (NUMBER_OF_AGENTS - 1)] critiques in parallel...
```

Launch **all critiques in parallel** using the `crucible:debater` agent with `model = DEBATER_MODEL`. For every **ordered pair (X, Y)** where X ≠ Y in AGENTS (full round-robin):

**Prompt for X attacking Y:**
```
You are Agent [X]. MODE: CRITIQUE

Task: [TASK]

Your current position:
[AGENT_X_LATEST]

Opponent ([Y]) position to critique:
[AGENT_Y_LATEST]

[If FOCUS_AREAS is non-empty:]
The convergence check identified these specific unresolved disagreements. Focus your attack on these areas:
[For each area in FOCUS_AREAS:]
- [area]
[end repeat]
[End if]

Attack [Y]'s solution. Find every flaw. Show why your approach is stronger.[If CURRENT_ROUND > 2:] Focus on what still remains weak or wrong.[End if]
```

Collect each result as `[AGENT_X_ATTACKS_AGENT_Y_R{CURRENT_ROUND}]`.

Immediately show the user each critique:
```
#### [X] attacks [Y] (Round [CURRENT_ROUND])

[AGENT_X_ATTACKS_AGENT_Y_R{CURRENT_ROUND}]

---
```
(repeat for each ordered pair X → Y)

### Defense Phase

Tell the user:
```
#### Round [CURRENT_ROUND] — Defense
Each agent is now responding to all attacks and refining their position...
```

Launch **all defenses in parallel** using the `crucible:debater` agent with `model = DEBATER_MODEL`. For **each agent X** in AGENTS:

Build a **critique block** for X by collecting all `[AGENT_Y_ATTACKS_AGENT_X_R{CURRENT_ROUND}]` for every Y ≠ X, formatted as:
```
[Y]'s attack on your solution:
[AGENT_Y_ATTACKS_AGENT_X_R{CURRENT_ROUND}]
```
(one section per attacker Y, in order)

**Prompt for agent X:**
```
You are Agent [X]. MODE: DEFEND

Task: [TASK]

Your current position:
[AGENT_X_LATEST]

[critique block for X]

[If CURRENT_ROUND == MAX_ROUNDS:]This is your final round. Give your definitive, fully-refined position. Concede anything truly wrong. Defend everything that holds.[Else:]Defend your position against all attacks above. Concede valid points and fix them. Refute invalid attacks. Produce your unified refined solution.[End if]
```

Collect each result as `[AGENT_X_R{CURRENT_ROUND}]`. Set `AGENT_X_LATEST = AGENT_X_R{CURRENT_ROUND}` for each agent.

**Extract Round Digests:** For each agent X, extract the `### Round Digest` section from `[AGENT_X_R{CURRENT_ROUND}]` and store it as `[AGENT_X_DIGEST_R{CURRENT_ROUND}]`. This is everything from `### Round Digest` up to (but not including) the next `###` heading or end of output.

Immediately show the user each defense:
```
#### [X]'s Defense & Refined Position (Round [CURRENT_ROUND])

[AGENT_X_R{CURRENT_ROUND}]

---
```
(repeat for each agent X)

### Convergence Check

Tell the user:
```
#### Convergence Check (Round [CURRENT_ROUND])
Checking whether all agents have reached agreement...
```

Launch a **single Haiku agent**:
```
TASK: [TASK]

NUMBER OF AGENTS: [NUMBER_OF_AGENTS]

[For each agent X in AGENTS:]
Agent [X]'s current position:
[AGENT_X_LATEST]

[end repeat]

Have ALL [NUMBER_OF_AGENTS] agents converged on essentially the same solution? Answer with one word on the first line: CONVERGED or DIVERGED.

If DIVERGED, on the following lines list the top 2-3 specific unresolved disagreements, one per line, each prefixed with "FOCUS:". These should be concrete technical points, not vague summaries.

Then in 2-3 sentences, explain what the remaining core disagreements are (if DIVERGED) or what they all agreed on (if CONVERGED).
```

Collect result as `[CONVERGENCE]`.

**Parse the result:**
- If the first word is `CONVERGED`: set `CONVERGED = true`
- If the first word is `DIVERGED`: set `CONVERGED = false`. Extract all lines starting with `FOCUS:` and store them (without the `FOCUS:` prefix) in `FOCUS_AREAS`.

Immediately show the user:
```
#### Convergence Result (Round [CURRENT_ROUND])

[CONVERGENCE]

---
```

**If CONVERGED**: tell the user `> All agents have converged — skipping to final arbitration.`
**If DIVERGED and CURRENT_ROUND < MAX_ROUNDS**: tell the user `> Agents still disagree — proceeding to Round [CURRENT_ROUND + 1]. Focus areas: [FOCUS_AREAS joined by "; "]`
**If DIVERGED and CURRENT_ROUND == MAX_ROUNDS**: tell the user `> Max rounds reached — proceeding to final arbitration.`

Set `CURRENT_ROUND = CURRENT_ROUND + 1`.

**End of adaptive loop.**

---

## FINAL ARBITRATION

Tell the user:
```
### Final Arbitration
The arbiter is reading the full debate transcript and rendering a verdict...
```

Build the arbiter transcript dynamically from however many rounds actually ran. Let `LAST_ROUND` = `CURRENT_ROUND - 1` (the last round that actually ran).

**Progressive summarization rules** — to keep the arbiter transcript within context limits:
- **Round 1 proposals**: full text (foundational, relatively small)
- **Round 1.5 self-critiques**: digest only (`[AGENT_X_SELF_CRITIQUE_DIGEST]`)
- **Rounds 2 to LAST_ROUND - 1** (if any): digest only from defenses (`[AGENT_X_DIGEST_R{R}]`), attacks omitted entirely
- **Round LAST_ROUND** (final round): full detail — all attacks and full defense text

Launch the `crucible:arbiter` agent:

```
TASK: [TASK]
NUMBER OF AGENTS: [NUMBER_OF_AGENTS]
AGENTS: [AGENTS joined by ", "]

=== ROUND 1: INITIAL PROPOSALS ===

[For each agent X in AGENTS:]
Agent [X] (Round 1):
[AGENT_X_R1]

[end repeat]

=== ROUND 1.5: SELF-CRITIQUE (Digest) ===

[For each agent X in AGENTS:]
Agent [X] self-critique digest:
[AGENT_X_SELF_CRITIQUE_DIGEST]

[end repeat]

[For each round R from 2 to LAST_ROUND - 1 (i.e., non-final rounds only):]

=== ROUND [R]: DIGEST ONLY ===

[For each agent X in AGENTS:]
Agent [X] digest (Round [R]):
[AGENT_X_DIGEST_R{R}]

[end repeat]

[end round loop]

[If LAST_ROUND >= 2:]

=== ROUND [LAST_ROUND]: CROSS-ATTACK & DEFENSE (Full Detail) ===

[For each ordered pair (X, Y) where X ≠ Y:]
[X] attacks [Y]:
[AGENT_X_ATTACKS_AGENT_Y_R{LAST_ROUND}]

[end repeat]

[For each agent X in AGENTS:]
[X] defends and refines (Round [LAST_ROUND]):
[AGENT_X_R{LAST_ROUND}]

[end repeat]

[End if]

Read the complete debate transcript above. Early rounds are provided as structured digests; the final round is in full detail. Score all [NUMBER_OF_AGENTS] agents. Synthesize the definitive final answer.
```

Collect result as `[ARBITER_OUTPUT]`.

---

## SEND-BACK CHECK

**Parse `[ARBITER_OUTPUT]`:** check if it starts with `SEND_BACK` (on the first line).

**If `SEND_BACK` is found AND `SEND_BACK_USED == false`:**

1. Set `SEND_BACK_USED = true`
2. Extract `FOCUS:` lines from the arbiter output into `SEND_BACK_FOCUS_AREAS`
3. Extract `REASON:` line from the arbiter output

Tell the user:
```
### Arbiter Sends It Back

The arbiter wants one more targeted round before rendering a final verdict.

**Reason:** [REASON]
**Focus areas:**
[For each area in SEND_BACK_FOCUS_AREAS:]
- [area]
[end repeat]

Running targeted attack + defense round...
```

**Run one targeted round:**

Launch **all critiques in parallel** for every ordered pair (X, Y) where X ≠ Y:

**Prompt for X attacking Y:**
```
You are Agent [X]. MODE: CRITIQUE

Task: [TASK]

Your current position:
[AGENT_X_LATEST]

Opponent ([Y]) position to critique:
[AGENT_Y_LATEST]

The arbiter has sent this back for one more round. Focus ONLY on these specific areas:
[For each area in SEND_BACK_FOCUS_AREAS:]
- [area]
[end repeat]

Attack [Y]'s solution on these specific points. Be precise and targeted.
```

Collect results. Show critiques to user.

Launch **all defenses in parallel** for each agent X:

**Prompt for agent X:**
```
You are Agent [X]. MODE: DEFEND

Task: [TASK]

Your current position:
[AGENT_X_LATEST]

[critique block for X from the send-back attacks]

The arbiter sent this back for one final round. This is your absolute last chance to refine. Give your definitive position.
```

Collect results. Set `AGENT_X_LATEST` to each agent's response. Show defenses to user.

**Extract send-back digests:** For each agent X, extract the `### Round Digest` section from the send-back defense output and store as `[AGENT_X_DIGEST_SENDBACK]`.

**Re-arbitrate.** Launch the `crucible:arbiter` agent. Use the same progressive summarization, but now the **previous final round becomes a digest too** and the **send-back round is shown in full detail**:

```
TASK: [TASK]
NUMBER OF AGENTS: [NUMBER_OF_AGENTS]
AGENTS: [AGENTS joined by ", "]

=== ROUND 1: INITIAL PROPOSALS ===

[For each agent X in AGENTS:]
Agent [X] (Round 1):
[AGENT_X_R1]

[end repeat]

=== ROUND 1.5: SELF-CRITIQUE (Digest) ===

[For each agent X in AGENTS:]
Agent [X] self-critique digest:
[AGENT_X_SELF_CRITIQUE_DIGEST]

[end repeat]

[For each round R from 2 to LAST_ROUND (i.e., ALL prior debate rounds as digests):]

=== ROUND [R]: DIGEST ONLY ===

[For each agent X in AGENTS:]
Agent [X] digest (Round [R]):
[AGENT_X_DIGEST_R{R}]

[end repeat]

[end round loop]

=== SEND-BACK ROUND (Arbiter-requested, Full Detail) ===

[For each ordered pair (X, Y) where X ≠ Y:]
[X] attacks [Y]:
[send-back attack result]

[end repeat]

[For each agent X in AGENTS:]
[X] final position (send-back round):
[AGENT_X_LATEST]

[end repeat]

You previously sent this back for one more round on these focus areas: [SEND_BACK_FOCUS_AREAS joined by "; "]. The agents have now addressed them. You may NOT send this back again. Early rounds are provided as structured digests; the send-back round is in full detail. Read the complete transcript and render your final verdict.
```

Collect result as `[ARBITER_OUTPUT]`.

**If `SEND_BACK` is NOT found OR `SEND_BACK_USED == true`:**

(Continue to output below.)

---

## OUTPUT

Show the arbiter's full output to the user:
```
### Arbiter's Verdict

[ARBITER_OUTPUT]
```
