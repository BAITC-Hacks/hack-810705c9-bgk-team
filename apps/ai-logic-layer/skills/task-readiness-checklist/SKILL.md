---
name: task-readiness-checklist
description: Score how ready a task card is for students to work on — rubric 0–100 with per-criterion breakdown, missing-information list and recalculation after edits. User-invoked, writes no files.
---

# task-readiness-checklist

## What it does

Takes a **finished task card** (any language, any format) and scores how ready it is to be worked on by students **without further clarification**. The score reflects **the task**, not the fame of the company. What it leaves behind is a rating: the number, the breakdown of how it was earned, and the list of what is still missing.

A low rating is legitimate information — it tells students how real starting work is without extra questions. It never hides a task and never blocks a response.

## The rubric (100 points)

| # | Criterion | Max | How to count |
|---|----------|----:|--------------|
| 1 | Context and need | 20 | It is clear what is happening now and what must change. |
| 2 | Data and materials | 20 | Available data, examples or sources are named. |
| 3 | Expected result | 15 | The concrete deliverable of the team is described. |
| 4 | Success criteria | 15 | Measurable signs that the decision/solution is accepted exist. |
| 5 | Constraints | 10 | Deadlines, technologies, access or other boundaries are stated. |
| 6 | Users | 10 | It is clear for whom the solution is built. |
| 7 | Business connection | 10 | There is a contact, a consultation format and a feedback procedure. |

## Scoring rules

- Award points **ONLY** for fields that are actually filled in and confirmed by the task text — never for what the company presumably has.
- Partial credit is proportional to how complete and concrete the field is; missing or vague = 0 for that field.
- Each criterion gets an **integer** number of points within its maximum; the final score **equals the sum** of the seven awarded numbers.
- Do not inflate a weak task to be polite; do not deflate a genuinely complete one. The rating is recalculated from scratch after every confirmed addition.

## The quality bar (from the grill-me skills)

A field only counts when it would survive the tests the interview skills were built on:

- **Specific / context** (`grill-me-smart`) — a verb doing no work ("improve", "optimize", "make better") earns little. The text must say what becomes true, for a named someone, instead of what.
- **Measurable** (`grill-me-smart`) — success criteria need a **baseline** as well as a target, or an observable event. A target without a baseline is a wish with a decimal point.
- **Time-bound / constraints** (`grill-me-smart`) — "soon", "ASAP", "Q3" are not deadlines. Look for dates, checkpoints, named technologies, required access, budget or other explicit boundaries.
- **Role test** (`grill-me-user-story`) — if the stated users could be swapped for any other role and the sentence still holds, the Users field is not really filled. "Users", "everyone", "staff" without a job in that sentence = vague.
- **Swap test** (`grill-me-job-story`) — the situation must be specific: if the "when" clause can be replaced by "when I am a user" without loss, context/users are wearing each other's clothes.
- **Falsification test** (`grill-me-acceptance-criteria`) — a success criterion that cannot fail ("the system works correctly", "the user is satisfied", "it handles edge cases") checks nothing → little or no points for Success criteria. A stranger must be able to point at the thing that proves acceptance.
- **Coverage** (`grill-me-acceptance-criteria`) — measurable signs should cover happy path, boundary and error cases, not only the happy path.
- **Grilling shrinks the task** — a concrete, narrow task scores higher than one that promises to solve everything. An inflated catch-all is a draft, not a priority.

## Readiness levels (calibration anchors — never invent others)

| Score | Level | Meaning |
|------:|-------|---------|
| 0–39 | draft (черновик) | Visible in the catalog, marked as needing clarification. |
| 40–69 | working (рабочая) | Students can respond; the system is allowed to recommend the task. |
| 70–89 | ready (готовая) | The task gets a raised position in the catalog. |
| 90–100 | priority (приоритетная) | Fully ready for work; highlighted in the catalog. |

Never round a score up across a level boundary to "unlock" a level — the level is a consequence of the sum, not a target.

## Missing information

For **every** criterion scored below its maximum, list concretely what to add to earn the missing points. Each item must be an answerable question or instruction for the company, not a paraphrase of the rubric:

- Bad: "нужны критерии успеха" (repeats the rubric).
- Good: "какое наблюдаемое число (например, доля заявок с ручной обработкой) покажет, что решение принято: baseline и target?"

If nothing is missing (100/100), output "—" in that section.

## Recalculation after edits

The rating is recalculated **after every confirmed addition**. When the user sends an edited version of a task that was already scored earlier in the same thread:

1. Rescore the new text **from scratch** with the same rubric — never adjust the old number incrementally.
2. Report the recalculation: previous score → new score, the delta, which missing items were closed, and which remain open.
3. If the score dropped, say so plainly — an edit can remove confirmed detail.

On the first evaluation in a thread, the recalculation section states that this is the first rating and a recalculation will appear once an edited version is sent.

## The exit

The exit is a **raw JSON object** (no fences, no prose) with exactly these keys: `score`, `level`, `verdict`, `breakdown`, `missing`, `recalculation` (shape fixed by the `RatingReport` zod schema). It is complete when: the score equals the sum of `awarded` over 7 breakdown rows; all seven criteria have an integer and a one-line justification; every shortfall is a concrete question in `missing`; and `recalculation` is present (firstEvaluation with nulls, or previousScore→score with delta and closedItems). Nothing outside the JSON.
