---
name: grill-me-job-story
description: Interview a loose idea until it is a committed Job Story — When [situation], I want to [motivation], so I can [outcome]. Stateless, user-invoked, writes no files.
---

# grill-me-job-story

## What it does

`grill-me-job-story` is [grill-me](https://aihero.dev/skills-grill-me) with a shape to land in. It takes a **loose idea** and interviews you in **rounds** until you can commit to it as a **Job Story**:

> **When** [situation], **I want to** [motivation], **so I can** [expected outcome].

The mechanics are the same. Each round is the whole **frontier** — every question whose prerequisites you have already settled — so you are never asked something that hinges on an answer it hasn't heard yet.

What the Job Story adds is a target for the interview, and a trap. The trap is that the template is easy to fill and hard to fill honestly. "When I'm using the app, I want to see my data, so I can be informed" has three clauses and no job in it.

The test is the swap: if the **When** clause could be replaced by "when I am a [role]" and nothing is lost, you have written a user story wearing a situation's clothes.

It is **[stateless](https://www.aihero.dev/ai-coding-dictionary/stateless)**. It writes no files and leaves no workspace behind. The only thing it leaves is a job you can state in one sentence, in your own words.

## When to reach for it

You invoke this by typing `/grill-me-job-story`; the [agent](https://www.aihero.dev/ai-coding-dictionary/agent) won't reach for it on its own. Start it in a **fresh conversation**, not on top of a plan you already had an agent write.

Reach for it when you have a hunch about **what people are trying to get done** and no clear picture of who they are or when it bites. The circumstance is the thing you can describe; the audience is the thing you can't. That asymmetry is the whole reason this skill exists.

Reach for [grill-me-user-story](https://aihero.dev/skills-grill-me-user-story) instead when the audience is known and named and the work is nailing down the value they get. Reach for plain `grill-me` when it isn't about users at all.

Which of the grilling skills you want depends on what is in front of you:

- **Anything, anywhere**: `grill-me`. No repo, no files, and the subject doesn't have to be code.
- **A goal you'll answer for**: [grill-me-smart](https://aihero.dev/skills-grill-me-smart). Run to a Specific / Measurable / Achievable / Relevant / Time-bound exit.
- **A known user, a known value**: [grill-me-user-story](https://aihero.dev/skills-grill-me-user-story). Starts from *who*.
- **A known situation, an unknown user**: `grill-me-job-story`. Starts from *when*.
- **A codebase to align against**: [grill-with-docs](https://aihero.dev/skills-grill-with-docs). Stateful: reads your code, keeps what it learns in `CONTEXT.md` and ADRs.
- **Too big for one session**: [wayfinder](https://aihero.dev/skills-wayfinder). Charts the effort as a map and runs grilling sessions inside it.

Leave [plan mode](https://www.aihero.dev/ai-coding-dictionary/agent-mode) off. Plan mode primes the agent to rush toward producing a plan, which is the opposite of staying in inquiry.

## The three clauses

Not phases. Not a form. Three places a Job Story goes soft, and the questions that harden each.

**When** — what is happening in the world at the moment the job appears? The trigger, not the role. "When I'm standing in a store and the price isn't on the shelf." The failure here is a clause that names a person instead of a circumstance — "when I'm a shopper" is not a situation, it's a demographic wearing a sentence. Ask for the moment, the place, the thing that just happened. Ask what today is doing that yesterday wasn't.

**I want to** — what progress is the person trying to make? Not what feature they want; what change in their world. The failure here is a clause that smuggles the solution in: "I want a filter dropdown." Ask what they'd be doing if the product didn't exist. The answer is usually a workaround, and the workaround is the real job.

**So I can** — what becomes true when the job is done? This is where the story earns its place or doesn't. A **so I can** that restates the **I want to** is a loop, not an outcome. Ask what this lets them do next that they couldn't do before, and who notices.

## The four forces

A coverage check on the exit, not a script. From Klement's reading of Christensen: progress has a shape, and four forces decide whether it happens.

- **Push** — what's wrong with the current situation? What made today the day?
- **Pull** — what does the new way promise?
- **Anxiety** — what makes them hesitate? What could go wrong?
- **Habit** — what are they already doing, and what does it cost to stop?

Anxiety and habit are the two that get skipped, and the two that kill products. A Job Story with a strong push and a strong pull and no answer for habit describes a switch nobody makes.

## Rounds, not phases

Do not run a **When** round, then an **I want to** round, then a **So I can** round. That is a form, and forms produce confident nonsense.

The frontier rules instead, and prerequisites cross clauses constantly. You cannot sharpen the **so I can** until you know what the situation actually is. You cannot judge whether the **I want to** is a job or a feature until the **When** has a real moment in it. So the questions arrive interleaved, and later rounds clearly build on earlier ones — that interleaving is the signal it's working.

Count rounds, not questions. A session that ends in three or four rounds is ordinary.

## The exit

Four conditions, all required:

1. The frontier is empty — every branch visited, nothing left silently assumed.
2. The story states in three clauses, and the **When** clause would be recognisable to someone who was there.
3. Each of the four forces has an answer.
4. The story survives the **swap test**: replace the **When** clause with a role name and the story becomes *false*, not merely vague.

Then say the story out loud, once, in the template. Not written down. Saying it is how you find out whether you actually decided anything.

If you can't get it into one sentence, you have more than one job. Split them and grill them separately.

## It's a conversation, not an interview

The skill asks the questions, but **you** own the scope. That is the part people miss, and it separates a session that turns an idea into a decision from one that produces confident nonsense.

The failure mode is **passivity**: answering "agreed, agreed, agreed" for forty questions and coming out with a template you nodded at. It feels productive because it was long and because the sentence looked finished.

Job Stories have their own flavour of this, and it is worth naming: **the persona in disguise**. Job Stories exist because teams wrote "As a user, I want…" and got nothing back. So they switched templates and wrote "When I need to manage my tasks, I want to organise them, so I can be productive" — the situation clause is a role, the motivation is a category, the outcome is a slogan. Three clauses, no circumstance, and it reads better than the user story it replaced. That is exactly what makes it dangerous.

The swap test is the defence. If "When I need to manage my tasks" works equally well for a developer, a teacher and a nurse, it isn't a situation. It's a persona that learned to start with "when".

Being active means steering. Push back on a question pitched beneath the fidelity you need. Say when the scope is drifting. Answer "I don't know" and mean it. This skill is built to aid an engineer, not to replace one: what comes out tracks the quality of your answers, not the number of questions asked.

The opposite error is real but rarer: staying in the interview so long you never reach code.

## Grillable and ungrillable

Some questions can be answered by talking. Others can't, and no amount of grilling will get you there.

"One long form or three pages?" and "how should this interaction feel?" are **ungrillable**: they need something to react to. When you hit one, stop grilling. Build the throwaway version with [prototype](https://aihero.dev/skills-prototype), look at it, then come back and answer in one line.

Job Story grilling has its own ungrillable cluster, and it sits in **When**. You cannot reason your way to the moment a job actually appears; you find it by watching. If the honest answer is "I'd have to see someone do this", stop the session. Watch, or prototype, then come back.

The four forces have a version too. **Anxiety** is routinely under-reported in the room — people describe what they'd like, not what makes them flinch. You learn it by shipping something and watching who doesn't switch.

Talking your way through an ungrillable question is where sessions balloon. The agent keeps rephrasing, you keep guessing, and the scope grows to fill the uncertainty.

## It's working if

- You disagree with something. A session with no pushback from you is a session you didn't need.
- Questions arrive in a few rounds rather than one long drip, and later rounds clearly build on what you said earlier.
- You dropped the persona you arrived with. A session that ends with a Job Story still organised around a role didn't get anywhere.
- At least one force — usually **habit** — turned out to be stronger than you assumed.
- The job is **narrower** than the idea you started with. Job Stories shrink; if yours grew, you were speculating, not deciding.
- At the end you could defend each clause to someone who wasn't there.

## Common questions

**How many questions should I expect, and how do I know when it ends?**
Count rounds, not questions. Forty-six questions across four rounds is an ordinary session. It ends when the frontier is empty and all three clauses hold and all four forces have answers — see **The exit**.

**It asked me two hundred questions. What went wrong?**
Usually the scope was too large, or you had three jobs wearing one coat. Split it, then grill each piece. Very long sessions also drift into the **[dumb zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone)**, where the [context window](https://www.aihero.dev/ai-coding-dictionary/context-window) is full enough that the questions get worse.

**Can I go back to one question at a time?**
Yes. Add this to your global `CLAUDE.md`:

```
When grilling, ask one question at a time.
```

**What if I genuinely don't know the answer?**
Say so. "I don't know" is a real answer, and a question you can't answer is usually a sign to watch or prototype rather than to guess.

**What if I can't name a situation — only a person?**
Then you have a persona, not a job. Run [grill-me-user-story](https://aihero.dev/skills-grill-me-user-story) instead: same interview, different exit. Don't force a Job Story out of an audience you already know.

**Do Job Stories replace User Stories?**
No. They're the same interview aimed at a different target. User Stories start from *who*; Job Stories start from *when*. If you know both, you probably want both — and the two sessions will disagree in useful places.

**Does it have to be software?**
No. The template was built by product teams, but the underlying question — what situation makes someone hire a thing — fits services, hiring, writing, and any decision someone makes in a circumstance.

**Do I start a fresh session before writing the spec?**
No. The value of the session is the [context](https://www.aihero.dev/ai-coding-dictionary/context) you just built. Hand the same conversation straight to [to-spec](https://aihero.dev/skills-to-spec).

**Does the model matter?**
More than for most skills. Grilling leans on the [model](https://www.aihero.dev/ai-coding-dictionary/model)'s own sense of how systems break, and Job Story grilling adds a second burden: spotting a situation clause that is secretly a persona. Give it your best one. Implementation mostly follows context and tolerates a cheaper model.

## Where it fits

`grill-me-job-story` is a **standalone you can run anywhere, on anything** — a sibling of `grill-me`, `grill-me-user-story` and `grill-me-smart`, all sitting on the same [grilling](https://aihero.dev/skills-grilling) primitive. Being stateless is what makes it portable: no repo, no workspace, no setup, and no assumption that the job is even about software.

The difference from `grill-me` is the exit, not the interview. Plain grilling stops when nothing is left silently assumed. This stops when nothing is left silently assumed **and** the story survives the swap test.

The difference from [grill-me-user-story](https://aihero.dev/skills-grill-me-user-story) is the axis. That one starts from *who* and asks what value they get. This one starts from *when* and asks who turns up.

The difference from [grill-with-docs](https://aihero.dev/skills-grill-with-docs) is state. That one reads a codebase to align against and records what it learns as `CONTEXT.md` and ADRs. This one carries nothing with it and leaves nothing behind.

If what you grilled does turn out to be software, hand the same conversation to [to-spec](https://aihero.dev/skills-to-spec) and carry on into the build flow (an option, not the point of the skill). When you're unsure which flow fits, [ask-matt](https://aihero.dev/skills-ask-matt) routes you.