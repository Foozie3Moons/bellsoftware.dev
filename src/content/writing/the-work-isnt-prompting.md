---
title: "The work isn't prompting"
description: "Six weeks building a household AI assistant from scratch, and what I expected to be prompt engineering turned out to be org design."
pubDate: 2026-04-29
---

I've been using agentic coding tools for a few months now, long enough to feel comfortable with how they work. Six weeks ago I set out to build a household AI assistant. I'd seen a lot online about OpenClaw and personal AI assistants, but I'm also very aware of the security issues it and others like it have had. So I decided to do what any developer with limited free time would do and build the whole thing myself from the ground up.

I assumed the move was the same one I'd been using: find a capable generalist agent and get good at prompting it. Give it good context, give it good instructions, get good code back. The work would be in the prompt.

That isn't how it played out.

## The generalist problem

The generalist worked, technically. It produced code. The code compiled. Some of it was even good. But the more I asked it to do, the less it felt like building software and the more it felt like managing someone who was trying very hard to do five jobs at once. Decisions in one part of the codebase contradicted decisions in another. Patterns I'd established got quietly relitigated. The output was always plausible, which made it worse, because plausible-but-wrong is harder to catch than obviously-wrong.

Here's the git log from the first two and a half weeks:

```
Mar 28  feat: add dev agent for code changes via Telegram
Mar 29  fix: make dev agent work in deployed Docker environment
Mar 29  refactor: switch production container from tsc build to tsx
Mar 29  Revert "refactor: switch production container from tsc build to tsx"
Mar 29  Revert "fix: make dev agent work in deployed Docker environment"
Mar 29  Revert "feat: add dev agent for code changes via Telegram"
```

Three commits building a feature. Three commits deleting it. Complete waste. No explanation needed because I know exactly what happened: the agent made locally reasonable decisions that didn't survive contact with reality. The fix didn't work, the infrastructure change caused problems, so I reverted everything. This pattern repeated constantly.

PII detection took seven fixes in three days. The initial implementation looked good but redacted `"Apple"` and `"the"` as personal names. Each fix was a patch rather than stepping back to rethink the approach.

The dashboard got rewritten four times in two weeks. Each commit message used words like "rebuild," "redesign," "modernize." One of them mentioned "consistent patterns" as if that were new, after two weeks of dashboard work.

Code written on day one was called **legacy** by day four.

An auth implementation shipped and got replaced with a completely different approach the same day. The first version never should have been committed.

Some of this is on me. I was reviewing fast, trusting the agent to hold the line on conventions it had already been told. I had guardrails in place: coding style rules, conventions documented in project files. They weren't working. The agent read them, sometimes followed them, and sometimes didn't. "Told once" doesn't hold. Conventions need machinery behind them, not just instructions.

The breaking point came at 1 AM on a work night. I sat down and wrote seven specialist agents in one commit. Five minutes later I kicked off the first orchestrated task. The specialists went into production within five minutes of being created because I couldn't afford to keep working the way I had been.

The fleet:

| Agent | Role |
|-------|------|
| **Orchestrator** | Dispatches work to the right specialist, tracks progress |
| **Architect** | Runs discovery, produces specs, never writes code |
| **Decomposer** | Breaks specs into tasks, never implements |
| **Domain Engineer** | Owns backend business logic |
| **Infra Engineer** | Owns infrastructure, deployment, observability |
| **LLM Engineer** | Owns the AI/LLM integration layer |
| **Skill Author** | Writes and maintains the household assistant's skills |

The first task I gave them was to clean up the mess: "I don't know what's current or legacy." That wasn't confusion. That was an accurate description of what the generalist had produced. The plausible decisions at every fork hadn't cohered into anything I could reason about.

## The fix: specialists and machinery

The fix wasn't a single shift. It was iterative. Each failure mode got its own machinery.

### Specialists

I carved work into specialized agents with tight **system prompts** and narrow **tool surfaces**. One that only thinks about architecture. One that only writes specs. One that only does dashboard work. Each with their own constraints, their own scope.

Here's a real example. This is the agent definition for the architect specialist:

```markdown
You are the architect. Your job is to take a fuzzy problem statement 
and produce a precise architecture spec through discovery conversation. 
You do not write code. You do not decompose into tasks. You do not 
dispatch other agents. Your only output is a spec document.

# Things you do not do

- You do not write code.
- You do not decompose specs into tasks (decomposer's job).
- You do not dispatch implementation agents (orchestrator's job).
- You do not produce a spec without running discovery first.
```

The key is what's excluded. The architect doesn't know how to write a React component because it doesn't have the tools or the scope. It can't drift into implementation because implementation isn't in its world. Compare that to the **dashboard engineer**, which owns specific files across specific layers and explicitly does NOT touch agent management or chat features. Each specialist has walls, not just guidance.

### Observability

I added dispatch logging so I could see what was happening. Every time an agent spawns a subagent, a `hook` logs it:

```python
if event_name == "PreToolUse":
    entry = {"event": "dispatch_start", "agent": agent, "task": task, "ts": ts}
elif event_name == "PostToolUse":
    entry = {
        "event": "dispatch_end",
        "agent": agent,
        "task": task,
        "tokens": response.get("totalTokens"),
        "tool_uses": response.get("totalToolUseCount"),
    }
```

Now I can see:

- Which agents are getting called
- What they're being asked to do
- How many tokens they burn
- Whether they're being used as intended

Before this I was flying blind. The only way to gauge whether the fleet was working was vibes.

### Mechanical enforcement

I added `hooks` that block mistakes before they're written. Here's one that stops migrations from landing in the wrong directory.

The codebase has two directories that look like migration directories: `src/backend/core/database/migrations/` (test fixtures) and `migrations/orchestrator/` (the real one). The Nest app only reads from the second. An agent sees the first, thinks "that's where migrations go," writes the file, runs the tests. Tests pass because the fixtures work fine. Then Nest crashes at boot: `no such table`.

```bash
# Block writes to *.sql under src/backend/core/database/migrations/
if printf '%s' "$FILE_PATH" | grep -qE '/src/backend/core/database/migrations/'; then
  cat >&2 <<EOF
BLOCKED: writing $basename to src/backend/core/database/migrations/

This directory contains test fixtures only. The Nest app reads ONLY from
migrations/orchestrator/. Write your migration there instead.
EOF
  exit 2
fi
```

This happened about ten times. Each time I corrected the agent. Each time it happened again. Eventually I got fed up and added the `hook`. The solution wasn't better instructions. It was a gate that makes the mistake impossible. I'd forgotten this was even a problem until I went looking for examples for this post.

## What changed

The first time I ran the specialist setup I expected marginal improvement. What I got was a different category of output.

I also got a clear view of the damage that had already been done. A few weeks after implementing specialists, I was fine-tuning some CSS and kept running into trouble getting small things right. I inspected the page, started editing the HTML directly, and noticed the layout was broken in ways that didn't make sense. A `page` element had `position: absolute`, which obviously breaks relationships with other elements. I went looking for the source in the CSS Modules. Couldn't find it. Looked at the component itself.

**Inline styles**. Everywhere.

I audited the codebase. 461 **inline style** calls across 74 files. The convention was `CSS Modules`. None of the **inline styles** were genuinely dynamic. Every single one was drift from the generalist phase: locally reasonable decisions that had accumulated into incoherence. The chat layout had been reimplemented four times because no approach was locked. This damage was already baked in before I implemented specialists. I just hadn't seen it until I started looking closely.

But the new code was different. The code was more consistent. The decisions stayed coherent across the codebase. The agents stopped second-guessing things I'd already decided, because they didn't have the context to second-guess. They just did what they were built to do.

What I didn't expect was how much of the work moved upstream. Specialists are only as good as the seams between them, and drawing those seams turns out to be most of the job.

- Where does the architect stop and the implementer start?
- What does the spec-writer hand off, and in what shape?
- Which decisions belong to me and which can I delegate?

These are the same questions you ask when designing a team of humans, and the answers matter more, not less, when the team is made of agents.

## What I actually do now

The work I'm doing now looks less like prompting and more like org design.

- I write specs.
- I define interfaces between specialists.
- I curate context.
- I codify recurring corrections into reusable **skills** so the fleet stays aligned with my taste without me having to be in the loop on every decision.

The actual coding, the part I assumed would be the whole game, is the smallest part of how I spend my time. As a soon-to-be dad of two, that's exactly what I need.

The role this rewards isn't prompt engineer. It's someone who knows how to design and implement complex systems but lacks the time to do it all end-to-end. The agents give me leverage. I decide what good looks like, encode it well enough that the fleet can execute against it, and ship what I couldn't ship alone. The work is familiar. Systems thinking. Clear interfaces. Knowing what good looks like.

Six weeks and 93k lines later, this is what's working. The problems aren't unique to solo work. Neither are the fixes.
