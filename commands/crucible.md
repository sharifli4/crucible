---
description: Run N debater agents (2–5) that propose, self-critique, cross-attack, and defend across adaptive rounds until they converge on the best answer
argument-hint: "[--agents N] [--model sonnet|opus|haiku] [--rounds N] <task description>"
allowed-tools: [Agent, Read, Write, Bash]
---

# Crucible

N debater agents will independently propose solutions, self-critique to harden their positions, then cross-attack every other agent's solution, defend their own positions, and refine across adaptive rounds. An arbiter synthesizes the final answer — and may send it back for one more targeted round if needed.

Show the user what is happening at every step. Do not wait until the end to reveal results — surface each phase's output immediately after it completes.

---

## SETUP — Parse Arguments

Arguments received: `$ARGUMENTS`

1. Extract optional flags from `$ARGUMENTS`:
   - **If** `--agents N` is present (where N is an integer 2–5): set `NUMBER_OF_AGENTS = N`, set `AGENTS_EXPLICIT = true`, and remove it from the arguments
   - **Otherwise:** set `NUMBER_OF_AGENTS = 2`, set `AGENTS_EXPLICIT = false`
   - **If** `--model MODEL` is present (where MODEL is `sonnet`, `opus`, or `haiku`): set `DEBATER_MODEL = MODEL`, set `MODEL_EXPLICIT = true`, and remove it from the arguments
   - **Otherwise:** set `MODEL_EXPLICIT = false`
   - **If** `--rounds N` is present (where N is an integer 2–5): set `MAX_ROUNDS = N` and remove it from the arguments
   - **Otherwise:** set `MAX_ROUNDS = 5`
2. Set `TASK` = remaining arguments after all flags are stripped and trimmed

Agent name pool (in order): **Alpha, Beta, Gamma, Delta, Epsilon**

Each agent has a **persona** that forces a distinct reasoning lens. Assign personas in order:

| Agent   | Persona | Lens | Default Model |
|---------|---------|------|:-------------:|
| Alpha   | Correctness-First | Prioritize being provably correct. Favor well-tested, standards-compliant approaches. Willing to sacrifice elegance for reliability. | opus |
| Beta    | Simplicity-First | Prioritize the simplest solution that works. Favor minimal dependencies, fewer moving parts, less code. Challenge unnecessary complexity. | sonnet |
| Gamma   | Devil's Advocate | Challenge the obvious answer. Look for non-obvious failure modes, adversarial inputs, and hidden assumptions. Propose alternatives others wouldn't consider. | opus |
| Delta   | Pragmatist | Prioritize real-world production concerns: maintainability, performance at scale, operational cost, team familiarity. Favor battle-tested over novel. | sonnet |
| Epsilon | Innovator | Prioritize modern best practices and novel approaches. Challenge legacy patterns. Favor cutting-edge solutions when they offer genuine advantages. | opus |

Assign `AGENTS = [first NUMBER_OF_AGENTS names from the pool]`. Examples:
- N=2 → [Alpha, Beta]
- N=3 → [Alpha, Beta, Gamma]
- N=4 → [Alpha, Beta, Gamma, Delta]
- N=5 → [Alpha, Beta, Gamma, Delta, Epsilon]

For each agent X, store `AGENT_X_PERSONA` = the Lens text from the table above.

For each agent X:
- If `MODEL_EXPLICIT == true`: set `AGENT_X_MODEL = DEBATER_MODEL`
- Else: set `AGENT_X_MODEL` = the Default Model from the table above

Mixed models are the default because different models have different reasoning patterns and blind spots. A debate between opus and sonnet surfaces flaws that two instances of the same model would both miss. Use `--model` to override this when you want uniform models (e.g., `--model haiku` for cost savings).

Initialize tracking variables:
- `CURRENT_ROUND = 1`
- `CONVERGED = false`
- `SEND_BACK_USED = false`
- `FOCUS_AREAS = []` (empty initially)
- `SHARED_EVIDENCE = []` (accumulates all `[EVIDENCE]` citations from every agent across every phase — used to build the shared evidence board so agents don't talk past each other on factual matters)
- For each agent X: `AGENT_X_LATEST = ""` (will hold most recent position)

All subsequent steps use `TASK` as the task and `AGENTS` as the list of agent names.

---

## PRE-DEBATE — Task Clarification & Complexity Assessment

Before launching agents, check whether the task has ambiguities that would cause agents to waste rounds debating interpretation rather than substance. Also assess task complexity to recommend an appropriate agent count.

Launch a **single Sonnet agent** (using `model = sonnet`, `max_turns = 2`):

```
Analyze this task for critical ambiguities and assess its complexity.

Task: [TASK]

## Part 1: Ambiguity Check

Rules:
- Only flag ambiguities that would cause DIFFERENT SOLUTIONS, not minor details agents can reasonably decide themselves.
- Do NOT flag things like coding style, variable naming, or minor design preferences.
- Do NOT flag things the debate process itself is designed to resolve (e.g., "which algorithm is best").
- DO flag: missing constraints (language? scale? environment?), contradictory requirements, unclear scope (build from scratch vs. use existing?), critical unstated assumptions.

## Part 2: Complexity Assessment

Recommend how many debater agents (2-5) this task warrants based on:
- **2 agents**: Focused questions with a clear correct answer, bug fixes, single-function implementations, factual lookups
- **3 agents**: Design decisions with 2-3 valid approaches, moderate architecture choices, tasks where a devil's advocate adds value
- **4 agents**: Complex system design, tasks with multiple competing concerns (correctness vs. performance vs. simplicity vs. operability), cross-cutting architectural decisions
- **5 agents**: High-stakes decisions with many valid perspectives, large-scale architecture, tasks where missing a single concern is costly

## Output Format

First line: CLEAR or AMBIGUOUS

If AMBIGUOUS, list 1-3 questions, one per line, each prefixed with "Q:". Each question should be specific, actionable, and offer 2-3 concrete options where possible.

Last line (always): AGENTS: N (where N is 2-5) followed by a short reason in parentheses.
Example: AGENTS: 3 (design trade-off with multiple valid approaches)
```

Collect result as `[CLARIFICATION_CHECK]`.

**Parse the result:**
- Extract ambiguity: if the first word is `CLEAR` or `AMBIGUOUS`
- Extract agent recommendation: find the line starting with `AGENTS:`, parse the number as `RECOMMENDED_AGENTS` and the parenthetical as `RECOMMENDATION_REASON`

**If AMBIGUOUS:** extract all lines starting with `Q:` (without the prefix) as clarification questions. Present the questions to the user using `AskUserQuestion`. For each extracted question, create a question entry. Use the user's answers to refine the task:

Set `TASK` = original TASK + the following appended block:
```

Clarifications:
[For each question-answer pair:]
- [question] → [user's answer]
[end repeat]
```

Tell the user:
```
> Task clarified.
```

**If `AGENTS_EXPLICIT == false` AND `RECOMMENDED_AGENTS != NUMBER_OF_AGENTS`:**

Set `NUMBER_OF_AGENTS = RECOMMENDED_AGENTS`. Re-assign `AGENTS` from the name pool using the new count. Re-assign `AGENT_X_PERSONA` for each agent.

Tell the user:
```
> Auto-selected [NUMBER_OF_AGENTS] agents ([RECOMMENDATION_REASON]).
```

---

## ROUND 1 — Independent Proposals

Tell the user:
```
## Crucible started

**Task:** [TASK]
**Agents:** [For each agent X: "[X] ([AGENT_X_MODEL])"] joined by ", "
**Model strategy:** [If MODEL_EXPLICIT: "[DEBATER_MODEL] (uniform)" | Else: "mixed (opus + sonnet for model diversity)"]
**Max rounds:** [MAX_ROUNDS]

---

### Round 1 — Opening Proposals
[AGENTS joined by ", "] are independently forming their positions...
```

Launch **all agents in parallel** using the `crucible:debater` agent. For **each agent X** in AGENTS, set `model = AGENT_X_MODEL`:

**Prompt:**
```
You are Agent [X]. MODE: PROPOSE

Your persona: [AGENT_X_PERSONA]

Task: [TASK]

Propose your complete solution independently. Let your persona shape your approach — it should influence which trade-offs you prioritize and which risks you weight most heavily. Do not hold back — this is your opening position.
```

Collect each result as `[AGENT_X_R1]`. Set `AGENT_X_LATEST = AGENT_X_R1` for each agent.

**Extract Evidence:** For each agent X, scan `[AGENT_X_R1]` for sentences containing `[EVIDENCE]`. For each found, append to `SHARED_EVIDENCE`: `- [X, Round 1, PROPOSE]: <the full evidence sentence including source citation>`. Skip exact duplicates.

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

Launch **all agents in parallel** using the `crucible:debater` agent. For **each agent X** in AGENTS, set `model = AGENT_X_MODEL`:

**Prompt:**
```
You are Agent [X]. MODE: SELF_CRITIQUE

Your persona: [AGENT_X_PERSONA]

Task: [TASK]

Your proposal (Round 1):
[AGENT_X_R1]

Attack your own solution. Find every weakness — assume an expert opponent will find them if you don't. Fix what you can and produce a hardened version.
```

Collect each result as `[AGENT_X_SELF_CRITIQUE]`. Set `AGENT_X_LATEST = AGENT_X_SELF_CRITIQUE` for each agent.

**Extract Evidence:** For each agent X, scan `[AGENT_X_SELF_CRITIQUE]` for sentences containing `[EVIDENCE]`. For each found, append to `SHARED_EVIDENCE`: `- [X, Round 1.5, SELF_CRITIQUE]: <the full evidence sentence including source citation>`. Skip exact duplicates.

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

Launch **all critiques in parallel** using the `crucible:debater` agent. For every **ordered pair (X, Y)** where X ≠ Y in AGENTS (full round-robin), set `model = AGENT_X_MODEL` (the attacker's model):

**Prompt for X attacking Y:**
```
You are Agent [X]. MODE: CRITIQUE

Your persona: [AGENT_X_PERSONA]

Task: [TASK]

Your current position:
[AGENT_X_LATEST]

Opponent ([Y]) position to critique:
[AGENT_Y_LATEST]

[If SHARED_EVIDENCE is non-empty:]
=== SHARED EVIDENCE BOARD ===
The following evidence has been gathered by all agents across prior rounds. Do not repeat tool calls for evidence already listed here — build on it or challenge it instead.
[For each entry in SHARED_EVIDENCE:]
[entry]
[end repeat]
=== END EVIDENCE BOARD ===
[End if]

[If FOCUS_AREAS is non-empty:]
The convergence check identified these specific unresolved disagreements. Focus your attack on these areas:
[For each area in FOCUS_AREAS:]
- [area]
[end repeat]
[End if]

Attack [Y]'s solution through your persona's lens. Find every flaw. Show why your approach is stronger.[If CURRENT_ROUND > 2:] Focus on what still remains weak or wrong.[End if]
```

Collect each result as `[AGENT_X_ATTACKS_AGENT_Y_R{CURRENT_ROUND}]`.

**Extract Evidence:** For each attack output, scan for sentences containing `[EVIDENCE]`. For each found, append to `SHARED_EVIDENCE`: `- [X, Round {CURRENT_ROUND}, CRITIQUE of Y]: <the full evidence sentence including source citation>`. Skip exact duplicates.

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

Launch **all defenses in parallel** using the `crucible:debater` agent. For **each agent X** in AGENTS, set `model = AGENT_X_MODEL`:

Build a **critique block** for X by collecting all `[AGENT_Y_ATTACKS_AGENT_X_R{CURRENT_ROUND}]` for every Y ≠ X, formatted as:
```
[Y]'s attack on your solution:
[AGENT_Y_ATTACKS_AGENT_X_R{CURRENT_ROUND}]
```
(one section per attacker Y, in order)

**Prompt for agent X:**
```
You are Agent [X]. MODE: DEFEND

Your persona: [AGENT_X_PERSONA]

Task: [TASK]

Your current position:
[AGENT_X_LATEST]

[critique block for X]

[If SHARED_EVIDENCE is non-empty:]
=== SHARED EVIDENCE BOARD ===
The following evidence has been gathered by all agents across prior rounds. Do not repeat tool calls for evidence already listed here — build on it or challenge it instead.
[For each entry in SHARED_EVIDENCE:]
[entry]
[end repeat]
=== END EVIDENCE BOARD ===
[End if]

[If CURRENT_ROUND == MAX_ROUNDS:]This is your final round. Give your definitive, fully-refined position. Concede anything truly wrong. Defend everything that holds.[Else:]Defend your position against all attacks above. Concede valid points and fix them. Refute invalid attacks. Produce your unified refined solution.[End if]
```

Collect each result as `[AGENT_X_R{CURRENT_ROUND}]`. Set `AGENT_X_LATEST = AGENT_X_R{CURRENT_ROUND}` for each agent.

**Extract Evidence:** For each defense output, scan for sentences containing `[EVIDENCE]`. For each found, append to `SHARED_EVIDENCE`: `- [X, Round {CURRENT_ROUND}, DEFEND]: <the full evidence sentence including source citation>`. Skip exact duplicates.

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

Launch a **single Sonnet agent** (using `model = sonnet`):
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

Launch **all critiques in parallel** using the `crucible:debater` agent. For every ordered pair (X, Y) where X ≠ Y, set `model = AGENT_X_MODEL`:

**Prompt for X attacking Y:**
```
You are Agent [X]. MODE: CRITIQUE

Your persona: [AGENT_X_PERSONA]

Task: [TASK]

Your current position:
[AGENT_X_LATEST]

Opponent ([Y]) position to critique:
[AGENT_Y_LATEST]

The arbiter has sent this back for one more round. Focus ONLY on these specific areas:
[For each area in SEND_BACK_FOCUS_AREAS:]
- [area]
[end repeat]

[If SHARED_EVIDENCE is non-empty:]
=== SHARED EVIDENCE BOARD ===
The following evidence has been gathered by all agents across prior rounds. Do not repeat tool calls for evidence already listed here — build on it or challenge it instead.
[For each entry in SHARED_EVIDENCE:]
[entry]
[end repeat]
=== END EVIDENCE BOARD ===
[End if]

Attack [Y]'s solution on these specific points through your persona's lens. Be precise and targeted.
```

Collect results. Show critiques to user.

**Extract Evidence:** For each attack output, scan for sentences containing `[EVIDENCE]`. For each found, append to `SHARED_EVIDENCE`: `- [X, Send-back, CRITIQUE of Y]: <the full evidence sentence including source citation>`. Skip exact duplicates.

Launch **all defenses in parallel** using the `crucible:debater` agent. For each agent X, set `model = AGENT_X_MODEL`:

**Prompt for agent X:**
```
You are Agent [X]. MODE: DEFEND

Your persona: [AGENT_X_PERSONA]

Task: [TASK]

Your current position:
[AGENT_X_LATEST]

[critique block for X from the send-back attacks]

[If SHARED_EVIDENCE is non-empty:]
=== SHARED EVIDENCE BOARD ===
The following evidence has been gathered by all agents across prior rounds. Do not repeat tool calls for evidence already listed here — build on it or challenge it instead.
[For each entry in SHARED_EVIDENCE:]
[entry]
[end repeat]
=== END EVIDENCE BOARD ===
[End if]

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

## ARBITER AUDIT

Before showing the verdict, run a lightweight cross-check to catch unsupported arbiter claims.

Launch a **single Sonnet agent** (using `model = sonnet`, `max_turns = 2`):

```
You are an auditor. Compare the arbiter's final answer against the agents' final positions to check for accountability issues.

TASK: [TASK]

AGENTS' FINAL POSITIONS:
[For each agent X in AGENTS:]
Agent [X]:
[AGENT_X_LATEST]

[end repeat]

ARBITER'S VERDICT:
[ARBITER_OUTPUT]

Check for these issues:

1. **Unsupported additions**: Claims in the Final Answer that no agent proposed, defended, or debated — AND that the arbiter did not tag as [ARBITER ADDITION] with justification in the Provenance Map.
2. **Unverified shared-bias overrides**: Any [SHARED-BIAS OVERRIDE] in the Provenance Map where the arbiter did not cite tool-verified evidence.
3. **Unjustified contested rulings**: Any [CONTESTED → ruling] where the arbiter's reasoning is circular, missing, or doesn't engage with the losing agent's argument.
4. **Missing provenance**: Elements of the Final Answer that appear in neither the agents' positions nor the Provenance Map.

For each issue found, output one line:
FLAG: <category> — <specific element> — <why this is a problem>

If no issues found, output exactly: CLEAN

Be strict but fair. Do NOT flag:
- The arbiter choosing one agent's approach over another (that's the arbiter's job)
- Minor wording differences between the final answer and agent positions
- The arbiter combining elements from multiple agents (that's expected)
```

Collect result as `[AUDIT_RESULT]`.

**Parse the result:**
- If the first word is `CLEAN`: proceed to output with no flags.
- Otherwise: extract all lines starting with `FLAG:` as `AUDIT_FLAGS`.

---

## OUTPUT

Show the arbiter's full output to the user:
```
### Arbiter's Verdict

[ARBITER_OUTPUT]
```

**If `AUDIT_FLAGS` is non-empty**, append:
```

---

### Audit Flags

The following elements of the arbiter's verdict could not be fully traced to the debate record:

[For each flag in AUDIT_FLAGS:]
- [flag]
[end repeat]

> These flags highlight areas where the arbiter's reasoning may warrant closer review. They do not necessarily indicate errors.
```
