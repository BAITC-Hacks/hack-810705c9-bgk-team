---
name: task-readiness-checklist
description: Find concrete missing information in a task snapshot, with grounded observations. No numeric rating or persistent state.
---

# Task clarification checklist

Review context and need, data and materials, expected result, acceptance criteria,
constraints, users, and business contact. Quote supplied text for observations;
ask a concrete question for missing information. Do not infer confirmation from text.

Numeric score, level, fit, history and decisions are exclusively BFF code (ADR-005).
Never output points, weights, ranking, readiness levels, score deltas or recalculations.
The caller supplies the current snapshot; no previous evaluation is remembered.

## The quality bar (from the grill-me skills)

A statement is concrete when it would survive the tests the interview skills were built on:

- **Specific / context** (`grill-me-smart`) — a verb doing no work ("improve", "optimize", "make better") needs clarification. The text must say what becomes true, for a named someone, instead of what.
- **Measurable** (`grill-me-smart`) — success criteria need a **baseline** as well as a target, or an observable event. A target without a baseline is a wish with a decimal point.
- **Time-bound / constraints** (`grill-me-smart`) — "soon", "ASAP", "Q3" are not deadlines. Look for dates, checkpoints, named technologies, required access, budget or other explicit boundaries.
- **Role test** (`grill-me-user-story`) — if the stated users could be swapped for any other role and the sentence still holds, the Users field is not really filled. "Users", "everyone", "staff" without a job in that sentence = vague.
- **Swap test** (`grill-me-job-story`) — the situation must be specific: if the "when" clause can be replaced by "when I am a user" without loss, context/users are wearing each other's clothes.
- **Falsification test** (`grill-me-acceptance-criteria`) — a success criterion that cannot fail ("the system works correctly", "the user is satisfied", "it handles edge cases") needs an observable acceptance condition. A stranger must be able to point at the thing that proves acceptance.
- **Coverage** (`grill-me-acceptance-criteria`) — measurable signs should cover happy path, boundary and error cases, not only the happy path.
- **Grilling shrinks the task** — a concrete, narrow task is easier to clarify than one that promises to solve everything. An inflated catch-all is too broad to verify.

## Output

Return raw JSON with `observations` (objects with `topic`, exact `evidence`, `note`)
and `missing` (answerable questions). No numeric assessment. If no task is supplied,
return `{"error":"no_task","message":"<ask for task text>"}`.
