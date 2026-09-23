---
name: grill-me-user-story
description: Interview a loose idea until it is a committed User Story — As a [role], I want [action], so that [value]. Stateless, user-invoked, writes no files.
---

# grill-me-user-story

## What it does

`grill-me-user-story` is [grill-me](https://aihero.dev/skills-grill-me) with a shape to land in. It takes a **loose idea** and interviews you in **rounds** until you can commit to it as a **User Story**:

> **As a** [role], **I want** [action], **so that** [value].

The mechanics are the same. Each round is the whole **frontier** — every question whose prerequisites you have already settled — so you are never asked something that hinges on an answer it hasn't heard yet.

What the User Story adds is a target for the interview, and a trap. The trap is that the template is trivially fillable. "As a user, I want to manage my items, so that I can be productive" has three clauses, one role, and no story in it.

The test is the **role test**: swap the role for a different one. If the story is still true, the role was doing no work — and a story whose role does no work is a task wearing a sentence.

It is **[stateless](https://www.aihero.dev/ai-coding-dictionary/stateless)**. It writes no files and leaves no workspace behind. The only thing it leaves is a story you can state in one sentence, in your own words.

## When to reach for it

You invoke this by typing `/grill-me-user-story`; the [agent](https://www.aihero.dev/ai-coding-dictionary/agent) won't reach for it on its own. Start it in a **fresh conversation**, not on top of a plan you already had an agent write.

Reach for it when you know **who benefits** and are trying to nail down **what value they get**. The audience is named; the deal isn't. That asymmetry is the whole reason this skill exists.

Reach for [grill-me-job-story](https://aihero.dev/skills-grill-me-job-story) instead when you can describe the *situation* but not the person in it. Reach for [grill-me-acceptance-criteria](https://aihero.dev/skills-grill-me-acceptance-criteria) when the story is settled and the question is what would prove it done. Reach for plain `grill-me` when it isn't about users at all.

Which of the grilling skills you want depends on what is in front of you:

- **Anything, anywhere**: `grill-me`. No repo, no files, and the subject doesn't have to be code.
- **A goal you'll answer for**: [grill-me-smart](https://aihero.dev/skills-grill-me-smart). Specific / Measurable / Achievable / Relevant / Time-bound.
- **A known user, a known value**: `grill-me-user-story`. Starts from *who*.
- **A known situation, an unknown user**: [grill-me-job-story](https://aihero.dev/skills-grill-me-job-story). Starts from *when*.
- **A story with no agreed definition of done**: [grill-me-acceptance-criteria](https://aihero.dev/skills-grill-me-acceptance-criteria). Starts from *what would prove it*.
- **A codebase to align against**: [grill-with-docs](https://aihero.dev/skills-grill-with-docs). Stateful: reads your code, keeps what it learns in `CONTEXT.md` and ADRs.
- **Too big for one session**: [wayfinder](https://aihero.dev/skills-wayfinder). Charts the effort as a map and runs grilling sessions inside it.

Leave [plan mode](https://www.aihero.dev/ai-coding-dictionary/agent-mode) off. Plan mode primes the agent to rush toward producing a plan, which is the opposite of staying in inquiry.

## The three clauses

Not phases. Not a form. Three places a User Story goes soft, and the questions that harden each.

**As a** — who specifically, and what do they want that nobody else does? The failure here is the role that names a category instead of a person with a stake: "as a user", "as an admin", "as a customer". Those are seats, not interests. Ask what this role wants that a different role wants *differently* — if nothing, the clause is decoration. Ask which real person you'd call to check.

**I want to** — what are they trying to do, in their words? Not the feature, and not the button. The failure here is solution smuggling: "I want a filter dropdown", "I want a settings page". Ask what they'd be doing if the product didn't exist yet. That answer is the want; the dropdown is one way to serve it.

**So that** — what value do they get? The failure here is a **so that** that restates the **I want to**: "I want to save my work, so that my work is saved." A loop, not a value. Ask what this lets them do next, or avoid, or stop worrying about. If the answer is "nothing they couldn't do before", the story has no reason to exist.

## The three Cs, and the one this skill builds

Ron Jeffries' framing, useful here as a boundary check rather than a script:

- **Card** — the one-sentence story. *This* is what this skill produces.
- **Conversation** — the discussion the card stands in for. That's the grilling itself.
- **Confirmation** — the acceptance criteria. That's [grill-me-acceptance-criteria](https://aihero.dev/skills-grill-me-acceptance-criteria), a different session.

If you find yourself writing Given-When-Then mid-session, stop. You've drifted into Confirmation. Note it, finish the Card, run the criteria session after — usually in the same conversation, while the context is warm.

## The coverage map

A coverage check on the exit, not a script. Six cuts, from Bill Wake's INVEST, in the order they usually fail.

- **Valuable** — does the role actually get something? The most common failure, and the one the **so that** clause exists to expose.
- **Independent** — can this ship without three other stories? If it can't, you have one story split across four cards, and the split is a lie.
- **Small** — can it be done in one sitting? A story you can't finish this week is an epic. Ask what the smallest version is that still delivers the value.
- **Testable** — could a stranger tell whether it's done? A vague story is usually a story with no **so that**.
- **Estimable** — can you say how big it is? If not, the uncertainty is hiding in one of the clauses, and finding it is the next question.
- **Negotiable** — is the *how* still open? A story that dictates the implementation isn't a card, it's a spec, and it will be wrong.

A story is done when each of the six has been asked about — and answered, including "deliberately not applicable, because…".

## Rounds, not phases

Do not run an **As a** round, then an **I want to** round, then a **so that** round. That is a form, and forms produce confident nonsense.

The frontier rules instead, and prerequisites cross clauses constantly. You cannot sharpen the **so that** until you know who the role is and what they're actually after. You cannot judge whether the story is small until the value is clear — and "small" usually means *the smallest thing that still delivers that value*, which is a sentence about the third clause, not the first. So the questions arrive interleaved, and later rounds clearly build on earlier ones — that interleaving is the signal it's working.

Count rounds, not questions. A session that ends in three or four rounds is ordinary.

## The exit

Four conditions, all required:

1. The frontier is empty — every branch visited, nothing left silently assumed.
2. The story states in three clauses, and each clause is doing work the other two don't.
3. It survives the **role test**: swap the role for a different one and the story becomes *false*, not merely vague. If "as a user" → "as an admin" still reads true, the role is decoration.
4. The **so that** clause names a value that isn't a restatement of the **I want to**.
5. The coverage map is complete — each of the six cuts has an answer, including an explicit "not applicable".

Then say the story out loud, once, in the template. Not written down. Saying it is how you find out whether you actually decided anything.

If you can't get it into one sentence, you have more than one story. Split them and grill them separately.

## It's a conversation, not an interview

The skill asks the questions, but **you** own the scope. That is the part people miss, and it separates a session that turns an idea into a decision from one that produces confident nonsense.

The failure mode is **passivity**: answering "agreed, agreed, agreed" for forty questions and coming out with a template you nodded at. It feels productive because it was long and because the sentence looked finished.

User Stories have their own flavour of this, and it is worth naming: **the task in costume**. "As a developer, I want to upgrade the ORM, so that we're on a supported version." Every clause parses. There's a role, an action, a value. The role has a real stake. What's missing is a *user* — nothing in this story changes anything for anyone outside the codebase, and the template is now lending it the legitimacy of a product decision.

The role test doesn't catch this one, because the developer role is doing genuine work. What catches it is asking *who is this for* and noticing the answer is "us". That's sometimes fine — it's just not a User Story, and it shouldn't be prioritised like one.

Being active means steering. Push back on a question pitched beneath the fidelity you need. Say when the scope is drifting. Answer "I don't know" and mean it. This skill is built to aid an engineer, not to replace one: what comes out tracks the quality of your answers, not the number of questions asked.

The opposite error is real but rarer: staying in the interview so long you never reach code.

## Grillable and ungrillable

Some questions can be answered by talking. Others can't, and no amount of grilling will get you there.

"One long form or three pages?" and "how should this interaction feel?" are **ungrillable**: they need something to react to. When you hit one, stop grilling. Build the throwaway version with [prototype](https://aihero.dev/skills-prototype), look at it, then come back and answer in one line.

User Story grilling has its own ungrillable cluster, and it sits in **As a**. You cannot reason your way to what a role actually wants; you find out by asking them, or by watching them work. If the honest answer is "I should check with the support team", stop the session, check, come back. A role you invented in the room is a role whose value you also invented.

The **so that** clause has a version too. Whether the value is *worth building* is a prioritisation question, and prioritisation is about the whole backlog, not this story. Don't settle it here.

Talking your way through an ungrillable question is where sessions balloon. The agent keeps rephrasing, you keep guessing, and the scope grows to fill the uncertainty.

## It's working if

- You disagree with something. A session with no pushback from you is a session you didn't need.
- Questions arrive in a few rounds rather than one long drip, and later rounds clearly build on what you said earlier.
- The role got **more specific**, not more generic. A session that ends with "as a user" didn't get anywhere.
- The **so that** clause is the one you rewrote most. That's where the value lives, and it's usually the last thing anyone thinks about.
- The story is **smaller** than the idea you started with. User Story grilling shrinks; if yours grew, you were speculating, not deciding.
- At the end you could defend each clause to someone who wasn't there.

## Common questions

**How many questions should I expect, and how do I know when it ends?**
Count rounds, not questions. Forty-six questions across four rounds is an ordinary session. It ends when the frontier is empty, the role test passes, and the coverage map is complete — see **The exit**.

**It asked me two hundred questions. What went wrong?**
Usually the idea was an epic, or you had three stories wearing one card. Split it, then grill each piece. Very long sessions also drift into the **[dumb zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone)**, where the [context window](https://www.aihero.dev/ai-coding-dictionary/context-window) is full enough that the questions get worse.

**Can I go back to one question at a time?**
Yes. Add this to your global `CLAUDE.md`:

```
When grilling, ask one question at a time.
```

**What if I genuinely don't know the answer?**
Say so. "I don't know" is a real answer, and for a User Story it usually means *go and ask the person in the role*. Guessing what a user wants is how you build the wrong thing confidently.

**What if I can only name a situation, not a role?**
Then you have a job, not a story. Run [grill-me-job-story](https://aihero.dev/skills-grill-me-job-story) instead: same interview, different exit. Don't force a role out of an audience you haven't met.

**Is "as a developer" ever legitimate?**
Sometimes — but then it's a task, not a User Story, and calling it one distorts your prioritisation. If nobody outside the team gets value, track it as work, not as a story.

**Do I need acceptance criteria too?**
Yes, eventually. This session produces the Card; [grill-me-acceptance-criteria](https://aihero.dev/skills-grill-me-acceptance-criteria) produces the Confirmation. Run them in the same conversation so the context carries.

**Do I start a fresh session before writing the spec?**
No. The value of the session is the [context](https://www.aihero.dev/ai-coding-dictionary/context) you just built. Hand the same conversation straight to [to-spec](https://aihero.dev/skills-to-spec).

**Does the model matter?**
More than for most skills. Grilling leans on the [model](https://www.aihero.dev/ai-coding-dictionary/model)'s own sense of how systems break, and User Story grilling adds a second burden: spotting the role that isn't doing work and the **so that** that isn't saying anything. Give it your best one. Implementation mostly follows context and tolerates a cheaper model.

## Where it fits

`grill-me-user-story` is a **standalone you can run anywhere, on anything** — a sibling of `grill-me`, [grill-me-job-story](https://aihero.dev/skills-grill-me-job-story), [grill-me-smart](https://aihero.dev/skills-grill-me-smart) and [grill-me-acceptance-criteria](https://aihero.dev/skills-grill-me-acceptance-criteria), all sitting on the same [grilling](https://aihero.dev/skills-grilling) primitive. Being stateless is what makes it portable: no repo, no workspace, no setup, and no assumption that the story is even about software.

The difference from `grill-me` is the exit, not the interview. Plain grilling stops when nothing is left silently assumed. This stops when nothing is left silently assumed **and** the story survives the role test.

The difference from [grill-me-job-story](https://aihero.dev/skills-grill-me-job-story) is the axis. That one starts from *when* and asks who turns up. This one starts from *who* and asks what value they get. If you know both, run both — the two sessions will disagree in useful places, and the disagreement is the finding.

The difference from [grill-me-acceptance-criteria](https://aihero.dev/skills-grill-me-acceptance-criteria) is direction. This builds the statement of intent; that builds the test of it. They are usually run in sequence, in the same conversation.

The difference from [grill-with-docs](https://aihero.dev/skills-grill-with-docs) is state. That one reads a codebase to align against and records what it learns as `CONTEXT.md` and ADRs. This one carries nothing with it and leaves nothing behind.

If what you grilled does turn out to be software, hand the same conversation to [to-spec](https://aihero.dev/skills-to-spec) and carry on into the build flow (an option, not the point of the skill). When you're unsure which flow fits, [ask-matt](https://aihero.dev/skills-ask-matt) routes you.