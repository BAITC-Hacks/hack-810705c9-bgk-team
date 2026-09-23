---
name: grill-me-smart
description: Interview a loose idea until it is a committed SMART goal — Specific, Measurable, Achievable, Relevant, Time-bound. Stateless, user-invoked, writes no files.
---

# grill-me-smart

## What it does

`grill-me-smart` is [grill-me](https://aihero.dev/skills-grill-me) with an exit criterion. It takes a **loose idea** and interviews you in **rounds** until you can commit to it as a **SMART goal**: Specific, Measurable, Achievable, Relevant, Time-bound.

The mechanics are the same. Each round is the whole **frontier** — every question whose prerequisites you have already settled — so you are never asked something that hinges on an answer it hasn't heard yet.

What SMART adds is the definition of done. With plain grilling, the frontier can empty out while the idea is still a wish. Here the session ends when the frontier is empty **and** all five criteria hold.

It is **[stateless](https://www.aihero.dev/ai-coding-dictionary/stateless)**. It writes no files and leaves no workspace behind. The only thing it leaves is a goal you can state in one breath, in your own words.

## When to reach for it

You invoke this by typing `/grill-me-smart`; the [agent](https://www.aihero.dev/ai-coding-dictionary/agent) won't reach for it on its own. Start it in a **fresh conversation**, not on top of a plan you already had an agent write.

Reach for it when the idea is something **you will be held to**: a target, a commitment, a deadline, a number you've promised someone. Reach for plain `grill-me` when the idea is exploratory and has no owner yet — a piece of writing, a product direction, a business call you're still circling.

The dividing line is simple: if nobody could tell whether you failed, you want SMART. If nobody needs to, you don't.

Which of the three grilling skills you want depends on what is in front of you:

- **Anything, anywhere**: `grill-me`. No repo, no files, and the subject doesn't have to be code.
- **A goal you'll answer for**: `grill-me-smart`. The same interview, run to a SMART exit.
- **A codebase to align against**: [grill-with-docs](https://aihero.dev/skills-grill-with-docs). The same interview, but [stateful](https://www.aihero.dev/ai-coding-dictionary/stateful): it reads your code and keeps what it learns in `CONTEXT.md` and ADRs.
- **Too big for one session**: [wayfinder](https://aihero.dev/skills-wayfinder). It charts the effort as a map and runs grilling sessions inside it.

Leave [plan mode](https://www.aihero.dev/ai-coding-dictionary/agent-mode) off. Plan mode primes the agent to rush toward producing a plan, which is the opposite of staying in inquiry.

## The five lenses

Not phases. Not a form. Five places a goal goes soft, and the questions that harden each one.

**Specific** — What exactly becomes true, for whom, and instead of what? The failure here is a verb doing no work: "improve", "explore", "get better at". Ask what is different for a named someone the day after this lands.

**Measurable** — What number, artifact, or observable event tells you it happened? Push for a **baseline** as well as a target. A target without a baseline is a wish with a decimal point.

**Achievable** — What makes this doable with the time, people, and money you actually have? Not "possible in principle". The useful question is usually what the smallest real version is, and what you are deliberately not doing.

**Relevant** — Why this, why now, in service of what? A goal that can't name what it's for is one you abandon the first time it gets expensive. Ask what you are saying no to by saying yes to this.

**Time-bound** — By when, and what checkpoint comes before that? "Soon" and "Q3" are not answers. Ask for the date you would be embarrassed to miss.

The five lenses are a **coverage check on the exit**, not a script. They tell you what still has no answer; they don't tell you what to ask next.

## Rounds, not phases

Do not run an S round, then an M round, then an A round. That is a form, and forms produce confident nonsense.

The frontier rules instead, and prerequisites cross lenses constantly. You cannot ask what the target number is until you've settled what the thing is. You cannot ask whether it's achievable until you know what it's for. So the questions arrive interleaved, and later rounds clearly build on earlier ones — that interleaving is the signal it's working.

Count rounds, not questions. A SMART session that ends in three or four rounds is ordinary.

## The exit

Two conditions, both required:

1. The frontier is empty — every branch visited, nothing left silently assumed.
2. Each of the five lenses has an answer you could defend to someone who wasn't there.

Then say the goal out loud, in one breath. Not written down. Saying it is how you find out whether you actually decided anything.

If you can't get it into one breath, you have more than one goal. Split it and grill them separately.

## It's a conversation, not an interview

The skill asks the questions, but **you** own the scope. That is the part people miss, and it separates a session that turns an idea into a commitment from one that produces confident nonsense.

The failure mode is **passivity**: answering "agreed, agreed, agreed" for forty questions and coming out with five neatly filled fields you nodded at. It feels productive because it was long and because the headings looked complete. Nothing was actually decided.

SMART has its own flavour of this failure, and it is worth naming: **the unfalsifiable form**. Specific: "improve onboarding". Measurable: "better metrics". Time-bound: "next quarter". Five boxes, all of them soft, and the shape of the framework hides it. The test is not whether you have an answer for each lens. It's whether each answer would let a stranger tell, later, that you missed.

Being active means steering. Push back on a question pitched beneath the fidelity you need. Say when the scope is drifting. Answer "I don't know" and mean it. This skill is built to aid an engineer, not to replace one: what comes out tracks the quality of your answers, not the number of questions asked.

The opposite error is real but rarer: staying in the interview so long you never reach code.

## Grillable and ungrillable

Some questions can be answered by talking. Others can't, and no amount of grilling will get you there.

"One long form or three pages?" and "how should this interaction feel?" are **ungrillable**: they need something to react to. When you hit one, stop grilling. Build the throwaway version with [prototype](https://aihero.dev/skills-prototype), look at it, then come back and answer in one line.

SMART has its own ungrillable questions, and they cluster in **Measurable**. "What's the baseline?" is often a measurement, not a discussion — you find out by looking, not by talking. When the honest answer is "I'd have to go and count", stop the session, go and count, come back. Guessing a baseline is how a SMART goal becomes a fake one.

Talking your way through an ungrillable question is where sessions balloon. The agent keeps rephrasing, you keep guessing, and the scope grows to fill the uncertainty.

## It's working if

- You disagree with something. A session with no pushback from you is a session you didn't need.
- Questions arrive in a few rounds rather than one long drip, and later rounds clearly build on what you said earlier.
- At least one lens forced a decision you had been making implicitly — usually Measurable or Relevant.
- The goal you end with is **smaller** than the idea you started with. SMART grilling shrinks; if yours grew, you were speculating, not deciding.
- At the end you could defend each choice to someone who wasn't there.

## Common questions

**How many questions should I expect, and how do I know when it ends?**
Count rounds, not questions. Forty-six questions across four rounds is an ordinary session. It ends when the frontier is empty and all five lenses hold — see **The exit**.

**It asked me two hundred questions. What went wrong?**
Usually the scope was too large, or the idea was actually three goals wearing one coat. Split it, then grill each piece. Very long sessions also drift into the **[dumb zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone)**, where the [context window](https://www.aihero.dev/ai-coding-dictionary/context-window) is full enough that the questions get worse.

**Can I go back to one question at a time?**
Yes. Add this to your global `CLAUDE.md`:

```
When grilling, ask one question at a time.
```

**What if I genuinely don't know the answer?**
Say so. "I don't know" is a real answer, and a question you can't answer is usually a sign to prototype or to go and measure, rather than to guess.

**What if I can't answer Relevant — I can't say what this is for?**
Then it isn't a goal yet. It's a curiosity. Grill it with plain `grill-me`, or drop it. Don't manufacture a reason to justify the work you've already put into the session.

**Does the goal have to be software?**
No. Specific, Measurable, Achievable, Relevant and Time-bound were borrowed from management for a reason: they fit hiring plans, revenue targets and books as well as they fit features.

**Do I start a fresh session before writing the spec?**
No. The value of the session is the [context](https://www.aihero.dev/ai-coding-dictionary/context) you just built. Hand the same conversation straight to [to-spec](https://aihero.dev/skills-to-spec).

**Does the model matter?**
More than for most skills. Grilling leans on the [model](https://www.aihero.dev/ai-coding-dictionary/model)'s own sense of how systems break, and SMART adds a second burden: spotting the answer that sounds like a commitment but isn't. Give it your best one. Implementation mostly follows context and tolerates a cheaper model.

## Where it fits

`grill-me-smart` is a **standalone you can run anywhere, on anything** — a sibling of `grill-me`, sitting on the same [grilling](https://aihero.dev/skills-grilling) primitive. Being stateless is what makes it portable: no repo, no workspace, no setup, and no assumption that the goal is even about software.

The difference from `grill-me` is the exit, not the interview. Plain grilling stops when nothing is left silently assumed. SMART grilling stops when nothing is left silently assumed **and** a stranger could tell, later, whether you hit it.

The difference from [grill-with-docs](https://aihero.dev/skills-grill-with-docs) is state. That one reads a codebase to align against and records what it learns as `CONTEXT.md` and ADRs. This one carries nothing with it and leaves nothing behind.

If what you grilled does turn out to be software, hand the same conversation to [to-spec](https://aihero.dev/skills-to-spec) and carry on into the build flow (an option, not the point of the skill). When you're unsure which flow fits, [ask-matt](https://aihero.dev/skills-ask-matt) routes you.