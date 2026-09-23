---
name: grill-me-acceptance-criteria
description: Interview a story or spec until it has committed acceptance criteria — Given-When-Then scenarios a stranger could run. Stateless, user-invoked, writes no files.
---

# grill-me-acceptance-criteria

## What it does

`grill-me-acceptance-criteria` is [grill-me](https://aihero.dev/skills-grill-me) with a checklist to land in. It takes a **story, a job, or a spec** and interviews you in **rounds** until it has acceptance criteria you could hand to someone who wasn't in the room:

> **Given** [precondition], **When** [trigger], **Then** [observable outcome].

The mechanics are the same. Each round is the whole **frontier** — every question whose prerequisites you have already settled — so you are never asked something that hinges on an answer it hasn't heard yet.

What acceptance criteria add is falsifiability. A story says what you intend. Criteria say what a stranger could check, and how they would know you missed. The whole value is in the second thing, and it is the thing that gets skipped.

The trap has a name: **a criterion that cannot fail**. "Then the user has a good experience." "Then the system handles it correctly." These read like criteria, sit in a list like criteria, and check nothing. The falsification test catches them — see **The exit**.

This skill needs something to write criteria **of**. It does not grill an idea into a story; it grills a story into a test. If the frontier keeps asking "what are we building?", you are in the wrong skill — go to `grill-me`, [grill-me-job-story](https://aihero.dev/skills-grill-me-job-story) or [grill-me-user-story](https://aihero.dev/skills-grill-me-user-story) first, then come back.

It is **[stateless](https://www.aihero.dev/ai-coding-dictionary/stateless)**. It writes no files and leaves no workspace behind. The only thing it leaves is a list you can defend, in your own words.

## When to reach for it

You invoke this by typing `/grill-me-acceptance-criteria`; the [agent](https://www.aihero.dev/ai-coding-dictionary/agent) won't reach for it on its own. Start it in a **fresh conversation**, or — better — carry on in the one where you just built the story. Criteria are cheap when the context is still warm and expensive when it isn't.

Reach for it the moment you have something you intend to build and no agreed way to tell whether you built it. The trigger is usually a sentence like "and it should handle edge cases" — that sentence is the whole job of this session, said out loud and left undone.

Reach for plain `grill-me` when the idea is still loose. Reach for [grill-me-smart](https://aihero.dev/skills-grill-me-smart) when the thing is a goal you'll be held to rather than a piece of work. Reach for [grill-me-job-story](https://aihero.dev/skills-grill-me-job-story) when the *situation* is the unknown.

Which of the grilling skills you want depends on what is in front of you:

- **Anything, anywhere**: `grill-me`. No repo, no files, and the subject doesn't have to be code.
- **A goal you'll answer for**: [grill-me-smart](https://aihero.dev/skills-grill-me-smart). Specific / Measurable / Achievable / Relevant / Time-bound.
- **A known user, a known value**: [grill-me-user-story](https://aihero.dev/skills-grill-me-user-story). Starts from *who*.
- **A known situation, an unknown user**: [grill-me-job-story](https://aihero.dev/skills-grill-me-job-story). Starts from *when*.
- **A story with no agreed definition of done**: `grill-me-acceptance-criteria`. Starts from *what would prove it*.
- **A codebase to align against**: [grill-with-docs](https://aihero.dev/skills-grill-with-docs). Stateful: reads your code, keeps what it learns in `CONTEXT.md` and ADRs.
- **Too big for one session**: [wayfinder](https://aihero.dev/skills-wayfinder). Charts the effort as a map and runs grilling sessions inside it.

Leave [plan mode](https://www.aihero.dev/ai-coding-dictionary/agent-mode) off. Plan mode primes the agent to rush toward producing a plan, which is the opposite of staying in inquiry.

## The three clauses

Not phases. Not a form. Three places a criterion goes soft, and the questions that harden each.

**Given** — what is already true when this starts? The world state, not the setup steps. "Given a logged-in user with an empty cart." The failure here is a **Given** that describes the test rather than the situation: "Given I open the page and click the button" is an action, not a precondition, and it belongs in **When**. Ask what is true before anything happens, and how it got that way.

**When** — what is the one trigger this criterion is about? Singular. The failure here is a **When** with an "and" in it: "when the user submits and the network is slow." That is two scenarios wearing one coat, and they have different outcomes. Split them. Ask what would have to be true for this trigger to never fire at all.

**Then** — what is observable, by whom, and how would you know it didn't happen? The failure here is the whole reason this skill exists: a **Then** that names a feeling, an intention, or an internal state. "Then the request succeeds." Succeeds how — what does someone see, read, or measure? Ask for the thing a stranger could point at.

## The coverage map

A coverage check on the exit, not a script. Five places a set of criteria is routinely incomplete, and the questions that find the gaps.

- **Happy path** — the ordinary case. Usually the only one written, and usually the least interesting.
- **Boundary** — zero, one, many; empty, full, exactly at the limit; the largest and smallest real value. Where "it works" stops working.
- **Error** — what happens when it doesn't. Not "it handles the error" — what the person sees, and what state the world is left in.
- **Rule** — the business rules hiding inside the story. The discount doesn't stack. The second approval is required above a threshold. These are the criteria people forget they agreed to.
- **Non-functional** — the things true at all times: it stays under a second, it doesn't lose data, it works on the phone. Rarely written, always assumed, and the source of most "but that's not what we meant".

A set of criteria is done when each of the five has been asked about — and answered, including "deliberately not applicable, because…".

## Rounds, not phases

Do not run a **Given** round, then a **When** round, then a **Then** round. That is a form, and forms produce confident nonsense.

The frontier rules instead, and prerequisites cross clauses constantly. You cannot write a **Then** until you know which trigger you're answering, and you can't find the trigger until you know what the story is really about. Coverage gaps surface late — you finish the happy path, and only then does the boundary question make sense. So the questions arrive interleaved, and later rounds clearly build on earlier ones — that interleaving is the signal it's working.

Count rounds, not questions. A session that ends in three or four rounds is ordinary.

## The exit

Four conditions, all required:

1. The frontier is empty — every branch visited, nothing left silently assumed.
2. Every criterion is written as Given-When-Then, with one trigger per criterion.
3. Every **Then** survives the **falsification test**: you can name the observation that would prove it false. If nothing would, it isn't a criterion — cut it or sharpen it.
4. The coverage map is complete — each of the five cuts has an answer, including an explicit "not applicable".

Then read the list out loud, once. Not written down. Reading it is how you find out whether it covers what you meant.

If the list runs past a dozen criteria for one story, the story is too large. Split it and write criteria for each piece.

## It's a conversation, not an interview

The skill asks the questions, but **you** own the scope. That is the part people miss, and it separates a session that turns a story into a contract from one that produces confident nonsense.

The failure mode is **passivity**: answering "agreed, agreed, agreed" for forty questions and coming out with a tidy Given-When-Then list you nodded at. It feels productive because it was long and because the list looked finished. Nothing was actually agreed.

Acceptance criteria have their own flavour of this, and it is worth naming: **the criteria that describe the implementation**. "Given the cache is warm, when the request arrives, then the handler returns the cached object." Every clause is checkable, every clause is true, and none of it is what the person asking for the feature cares about. It reads like rigour and functions like a lock — it commits you to a design in the same breath as committing you to a behaviour.

The falsification test is the partial defence; the rest is asking *who benefits from this clause* for each one. If the answer is "nobody outside the codebase", it's a test, not a criterion, and it belongs somewhere else.

Being active means steering. Push back on a question pitched beneath the fidelity you need. Say when the scope is drifting. Answer "I don't know" and mean it. This skill is built to aid an engineer, not to replace one: what comes out tracks the quality of your answers, not the number of questions asked.

The opposite error is real but rarer: staying in the interview so long you never reach code.

## Grillable and ungrillable

Some questions can be answered by talking. Others can't, and no amount of grilling will get you there.

"One long form or three pages?" and "how should this interaction feel?" are **ungrillable**: they need something to react to. When you hit one, stop grilling. Build the throwaway version with [prototype](https://aihero.dev/skills-prototype), look at it, then come back and answer in one line.

Acceptance criteria have their own ungrillable cluster, and it is the biggest one of any of these skills. **You cannot reason your way to edge cases.** You find them by writing the implementation, or by watching someone use it, or by reading the code that already touches this path. When the honest answer is "I'd have to look", stop the session, look, come back. Criteria invented in the room are criteria for the system you imagined.

The **non-functional** cut has a version too. "How fast is fast enough?" is a measurement of what people tolerate, not a preference you hold. Prototype it or measure the current one.

Talking your way through an ungrillable question is where sessions balloon. The agent keeps rephrasing, you keep guessing, and the scope grows to fill the uncertainty.

## It's working if

- You disagree with something. A session with no pushback from you is a session you didn't need.
- Questions arrive in a few rounds rather than one long drip, and later rounds clearly build on what you said earlier.
- At least one criterion turned out to contradict something you assumed the story meant.
- **An error case or a boundary** came up that you had not thought about. If every criterion is a happy path, the session didn't do its job.
- The list is **shorter** than you expected and each item is **harder** than you expected. That is the shape of criteria that will actually be run.
- At the end you could defend each criterion to someone who wasn't there.

## Common questions

**How many questions should I expect, and how do I know when it ends?**
Count rounds, not questions. Forty-six questions across four rounds is an ordinary session. It ends when the frontier is empty, every **Then** is falsifiable, and the coverage map is complete — see **The exit**.

**It asked me two hundred questions. What went wrong?**
Usually the story was too large, or you were writing criteria for three stories at once. Split it, then grill each piece. Very long sessions also drift into the **[dumb zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone)**, where the [context window](https://www.aihero.dev/ai-coding-dictionary/context-window) is full enough that the questions get worse.

**Can I go back to one question at a time?**
Yes. Add this to your global `CLAUDE.md`:

```
When grilling, ask one question at a time.
```

**What if I genuinely don't know the answer?**
Say so. "I don't know" is a real answer, and for criteria it usually means *go and read the code*, or *go and watch someone*. Guessing an edge case is how you get criteria for a system nobody has.

**How is this different from writing tests?**
Criteria say *what must be true*. Tests say *how you check it*, and they're allowed to be more detailed and more brittle. Keeping the two separate is what lets you change the implementation without renegotiating the deal.

**Does every story need all five cuts?**
No. It needs an answer for each, and "not applicable, because this is a pure copy change" is an answer. What you can't do is skip the question.

**Do I start a fresh session before writing the spec?**
No. The value of the session is the [context](https://www.aihero.dev/ai-coding-dictionary/context) you just built. Hand the same conversation straight to [to-spec](https://aihero.dev/skills-to-spec) — the criteria are the part of the spec that keeps everyone honest.

**Does the model matter?**
More than for most skills. Grilling leans on the [model](https://www.aihero.dev/ai-coding-dictionary/model)'s own sense of how systems break, and for criteria that sense **is** the deliverable: the boundary you missed, the error you assumed away, the rule you forgot you agreed to. Give it your best one. Implementation mostly follows context and tolerates a cheaper model.

## Where it fits

`grill-me-acceptance-criteria` is a **standalone you can run anywhere, on anything** — a sibling of `grill-me`, [grill-me-user-story](https://aihero.dev/skills-grill-me-user-story), [grill-me-job-story](https://aihero.dev/skills-grill-me-job-story) and [grill-me-smart](https://aihero.dev/skills-grill-me-smart), all sitting on the same [grilling](https://aihero.dev/skills-grilling) primitive. Being stateless is what makes it portable: no repo, no workspace, no setup, and no assumption that the criteria are even about software.

The difference from `grill-me` is the exit, not the interview. Plain grilling stops when nothing is left silently assumed. This stops when nothing is left silently assumed **and** every claim on the list would let a stranger tell, later, that you missed.

The difference from [grill-me-user-story](https://aihero.dev/skills-grill-me-user-story) and [grill-me-job-story](https://aihero.dev/skills-grill-me-job-story) is direction. Those build the statement of intent; this builds the test of it. They are usually run in sequence, in the same conversation.

The difference from [grill-with-docs](https://aihero.dev/skills-grill-with-docs) is state. That one reads a codebase to align against and records what it learns as `CONTEXT.md` and ADRs. This one carries nothing with it and leaves nothing behind — though "go and read the code" is one of its most common answers.

If what you grilled does turn out to be software, hand the same conversation to [to-spec](https://aihero.dev/skills-to-spec) and carry on into the build flow (an option, not the point of the skill). When you're unsure which flow fits, [ask-matt](https://aihero.dev/skills-ask-matt) routes you.