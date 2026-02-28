---
description: Run two debater agents that propose, attack each other, and defend their positions across multiple rounds until they converge on the best answer
argument-hint: <task description>
allowed-tools: [Agent, Read, Write, Bash]
---

# Crucible

Two agents — Alpha and Beta — will independently propose solutions to the task, then directly argue with each other across multiple rounds. Each round, they critique the opponent's latest position and defend their own. The debate continues until they converge or reach the round limit (3 rounds). An arbiter then synthesizes the final answer from the full debate transcript.

Show the user what is happening at every step. Do not wait until the end to reveal results — surface each phase's output immediately after it completes.

## Task

> $ARGUMENTS

---

## ROUND 1 — Independent Proposals

Tell the user:
```
## Crucible started

**Task:** $ARGUMENTS

---

### Round 1 — Opening Proposals
Alpha and Beta are independently forming their positions...
```

Launch **Alpha and Beta in parallel** using the `crucible:debater` agent:

**Alpha prompt:**
```
You are Agent Alpha. MODE: PROPOSE

Task: $ARGUMENTS

Propose your complete solution independently. Do not hold back — this is your opening position.
```

**Beta prompt:**
```
You are Agent Beta. MODE: PROPOSE

Task: $ARGUMENTS

Propose your complete solution independently. Do not hold back — this is your opening position.
```

Collect results as `[ALPHA_R1]` and `[BETA_R1]`.

Immediately show the user:
```
#### Agent Alpha's Opening Position

[ALPHA_R1]

---

#### Agent Beta's Opening Position

[BETA_R1]

---
```

---

## ROUND 2 — First Cross-Attack

Tell the user:
```
### Round 2 — Cross-Attack
Alpha is attacking Beta's solution. Beta is attacking Alpha's solution. Running in parallel...
```

Launch **Alpha and Beta in parallel** using the `crucible:debater` agent:

**Alpha critiques Beta:**
```
You are Agent Alpha. MODE: CRITIQUE

Task: $ARGUMENTS

Your own solution (Round 1):
[ALPHA_R1]

Opponent (Beta) solution to critique:
[BETA_R1]

Directly attack Beta's solution. Find every flaw. Show why your approach is stronger.
```

**Beta critiques Alpha:**
```
You are Agent Beta. MODE: CRITIQUE

Task: $ARGUMENTS

Your own solution (Round 1):
[BETA_R1]

Opponent (Alpha) solution to critique:
[ALPHA_R1]

Directly attack Alpha's solution. Find every flaw. Show why your approach is stronger.
```

Collect results as `[ALPHA_ATTACKS_BETA_R2]` and `[BETA_ATTACKS_ALPHA_R2]`.

Immediately show the user:
```
#### Alpha attacks Beta

[ALPHA_ATTACKS_BETA_R2]

---

#### Beta attacks Alpha

[BETA_ATTACKS_ALPHA_R2]

---
```

---

## ROUND 2 — Defense & Refinement

Tell the user:
```
#### Round 2 — Defense
Each agent is now responding to the attack and refining their position...
```

Launch **Alpha and Beta in parallel** using the `crucible:debater` agent:

**Alpha defends:**
```
You are Agent Alpha. MODE: DEFEND

Task: $ARGUMENTS

Your solution (Round 1):
[ALPHA_R1]

Beta's attack on your solution:
[BETA_ATTACKS_ALPHA_R2]

Defend your position. Concede valid points and fix them. Refute invalid attacks. Produce your refined solution.
```

**Beta defends:**
```
You are Agent Beta. MODE: DEFEND

Task: $ARGUMENTS

Your solution (Round 1):
[BETA_R1]

Alpha's attack on your solution:
[ALPHA_ATTACKS_BETA_R2]

Defend your position. Concede valid points and fix them. Refute invalid attacks. Produce your refined solution.
```

Collect results as `[ALPHA_R2]` and `[BETA_R2]`.

Immediately show the user:
```
#### Alpha's Defense & Refined Position

[ALPHA_R2]

---

#### Beta's Defense & Refined Position

[BETA_R2]

---
```

---

## CONVERGENCE CHECK after Round 2

Tell the user:
```
#### Convergence Check
Checking whether Alpha and Beta have reached agreement...
```

Launch a **single Haiku agent**:

```
TASK: $ARGUMENTS

Agent Alpha's current position:
[ALPHA_R2]

Agent Beta's current position:
[BETA_R2]

Have these two agents converged on essentially the same solution? Answer with one word: CONVERGED or DIVERGED.

Then in 2-3 sentences, explain what the remaining core disagreement is (if DIVERGED) or what they agreed on (if CONVERGED).
```

Collect result as `[CONVERGENCE]`.

Immediately show the user:
```
#### Convergence Result

[CONVERGENCE]

---
```

**If CONVERGED**: tell the user `> Agents have converged — skipping to final arbitration.` then jump to FINAL ARBITRATION.
**If DIVERGED**: tell the user `> Agents still disagree — proceeding to Round 3.` then continue to Round 3.

---

## ROUND 3 — Second Cross-Attack

Tell the user:
```
### Round 3 — Second Cross-Attack
Alpha and Beta are attacking each other's refined positions...
```

Launch **Alpha and Beta in parallel** using the `crucible:debater` agent:

**Alpha critiques Beta's refined position:**
```
You are Agent Alpha. MODE: CRITIQUE

Task: $ARGUMENTS

Your current refined solution (Round 2):
[ALPHA_R2]

Opponent (Beta) refined solution to critique:
[BETA_R2]

Beta has refined their position. Attack it again. Focus on what still remains weak or wrong. Push for your position to win.
```

**Beta critiques Alpha's refined position:**
```
You are Agent Beta. MODE: CRITIQUE

Task: $ARGUMENTS

Your current refined solution (Round 2):
[BETA_R2]

Opponent (Alpha) refined solution to critique:
[ALPHA_R2]

Alpha has refined their position. Attack it again. Focus on what still remains weak or wrong. Push for your position to win.
```

Collect results as `[ALPHA_ATTACKS_BETA_R3]` and `[BETA_ATTACKS_ALPHA_R3]`.

Immediately show the user:
```
#### Alpha attacks Beta (Round 3)

[ALPHA_ATTACKS_BETA_R3]

---

#### Beta attacks Alpha (Round 3)

[BETA_ATTACKS_ALPHA_R3]

---
```

---

## ROUND 3 — Final Defense & Refinement

Tell the user:
```
#### Round 3 — Final Defense
Each agent is delivering their final position...
```

Launch **Alpha and Beta in parallel** using the `crucible:debater` agent:

**Alpha's final defense:**
```
You are Agent Alpha. MODE: DEFEND

Task: $ARGUMENTS

Your refined solution (Round 2):
[ALPHA_R2]

Beta's latest attack:
[BETA_ATTACKS_ALPHA_R3]

This is your final round. Give your definitive, fully-refined position. Concede anything truly wrong. Defend everything that holds.
```

**Beta's final defense:**
```
You are Agent Beta. MODE: DEFEND

Task: $ARGUMENTS

Your refined solution (Round 2):
[BETA_R2]

Alpha's latest attack:
[ALPHA_ATTACKS_BETA_R3]

This is your final round. Give your definitive, fully-refined position. Concede anything truly wrong. Defend everything that holds.
```

Collect results as `[ALPHA_R3]` and `[BETA_R3]`.

Immediately show the user:
```
#### Alpha's Final Position

[ALPHA_R3]

---

#### Beta's Final Position

[BETA_R3]

---
```

---

## FINAL ARBITRATION

Tell the user:
```
### Final Arbitration
The arbiter is reading the full debate transcript and rendering a verdict...
```

Launch the `crucible:arbiter` agent with the complete debate transcript:

```
TASK: $ARGUMENTS

=== ROUND 1: INITIAL PROPOSALS ===

Agent Alpha (Round 1):
[ALPHA_R1]

Agent Beta (Round 1):
[BETA_R1]

=== ROUND 2: FIRST ATTACK ROUND ===

Alpha attacks Beta:
[ALPHA_ATTACKS_BETA_R2]

Beta attacks Alpha:
[BETA_ATTACKS_ALPHA_R2]

Alpha defends and refines (Round 2):
[ALPHA_R2]

Beta defends and refines (Round 2):
[BETA_R2]

=== ROUND 3: SECOND ATTACK ROUND === (include only if Round 3 ran)

Alpha attacks Beta:
[ALPHA_ATTACKS_BETA_R3]

Beta attacks Alpha:
[BETA_ATTACKS_ALPHA_R3]

Alpha's final position (Round 3):
[ALPHA_R3]

Beta's final position (Round 3):
[BETA_R3]

Read the complete debate transcript above. Score both agents. Synthesize the definitive final answer.
```

Show the arbiter's full output to the user immediately under:
```
### Arbiter's Verdict

[arbiter output]
```
