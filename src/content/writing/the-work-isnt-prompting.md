---
title: "The work isn't prompting"
description: "Six weeks building a household AI assistant from scratch, and what I expected to be prompt engineering turned out to be org design."
pubDate: 2026-04-30
---

I've been using agentic coding tools for a few months now, long enough to feel comfortable with how they work. Six weeks ago I set out to build a household AI assistant. I'd seen a lot online about OpenClaw and personal AI assistants, but I'm also very aware of the security issues it and others like it have had. So I decided to do what any developer with limited free time would do and build the whole thing myself from the ground up.

I assumed I'd do what I'd been doing: find a capable generalist agent and get good at prompting it. Good context and good instructions would get me good code back.

## The generalist problem

The generalist worked, technically. It produced code that compiled, and some of it was even good. But the more I asked it to do, the less it felt like building software and the more it felt like managing someone who was trying very hard to do five jobs at once. Decisions in one part of the codebase contradicted decisions in another. Patterns I'd established got quietly relitigated. The output was always plausible, which made it worse. Plausible but wrong is harder to catch than obviously wrong.

This is the git log from the first two and a half weeks:

```
Mar 28  feat: add dev agent for code changes via Telegram
Mar 29  fix: make dev agent work in deployed Docker environment
Mar 29  refactor: switch production container from tsc build to tsx
Mar 29  Revert "refactor: switch production container from tsc build to tsx"
Mar 29  Revert "fix: make dev agent work in deployed Docker environment"
Mar 29  Revert "feat: add dev agent for code changes via Telegram"
```

That's three commits building a feature and three commits deleting it. The agent made locally reasonable decisions that fell apart once they were deployed. The fix didn't work and the infrastructure change caused problems, so I reverted everything. That kept happening.

PII detection took seven fixes in three days. The initial implementation looked good but redacted `"Apple"` and `"the"` as personal names. Each fix patched the last one instead of stepping back to rethink the approach.

The dashboard got rewritten four times in two weeks. Each commit message used words like "rebuild," "redesign," and "modernize." One of them mentioned "consistent patterns" as if that were new, after two weeks of dashboard work.

Code written on day one was called **legacy** by day four.

An auth implementation shipped and got replaced with a completely different approach the same day. The first version never should have been committed.

Some of this is on me. I was reviewing fast, trusting the agent to hold the line on conventions it had already been told. I had guardrails in place: coding style rules, conventions documented in project files. They weren't working. The agent read them, sometimes followed them, and sometimes didn't. Telling it once wasn't enough. Conventions needed machinery behind them.

The breaking point came at 1 AM on a work night. I sat down and wrote seven specialist agents in one commit. Five minutes later I kicked off the first orchestrated task, because I couldn't afford to keep working the way I had been.

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

The first task I gave them was to clean up the mess: "I don't know what's current or legacy." That was an accurate description of what the generalist had produced. All those plausible decisions hadn't added up to anything I could reason about.

## The fix: specialists and machinery

There wasn't one fix. Each failure mode got its own machinery as I ran into it.

### Specialists

I carved work into specialized agents with tight system prompts and narrow tool surfaces. One only thinks about architecture, one only writes specs, and one only does dashboard work. Each has its own constraints and its own scope.

This is the real agent definition for the architect:

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

Most of the definition is about what it doesn't do. The architect doesn't know how to write a React component because it doesn't have the tools or the scope. It can't drift into implementation because implementation isn't part of its job. Compare that to the dashboard engineer, which owns specific files across specific layers and explicitly does NOT touch agent management or chat features. Each specialist has hard limits on what it can touch.

### Observability

I added dispatch logging so I could see what was happening. Every time an agent spawns a subagent, a hook logs it:

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

Before this I had no idea what was going on. The only way to judge whether the fleet was working was vibes. It's not perfect, but at least now I have something to go on.

### Mechanical enforcement

I added hooks that block mistakes before they're written. One of them stops migrations from landing in the wrong directory.

The codebase has two directories that look like migration directories:

- `src/backend/core/database/migrations/` (test fixtures)
- `migrations/orchestrator/` (the real one)

The Nest app only reads from the second. An agent sees the first, thinks "that's where migrations go," writes the file, runs the tests. Tests pass because the fixtures work fine. Then Nest crashes at boot: `no such table`.

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

This happened about ten times. Each time I corrected the agent. Each time it happened again. Eventually I got fed up and added the hook. Now the mistake can't happen at all. I'd forgotten this was even a problem until I went looking for examples for this post.

## What changed

The first time I ran the specialist setup I expected a small improvement. It was a lot better than that.

I also got a clear view of the damage that had already been done. A few weeks after implementing specialists, I was fine-tuning some CSS and kept running into trouble getting small things right. I inspected the page, started editing the HTML directly, and noticed the layout was broken in ways that didn't make sense. A `page` element had `position: absolute`, which obviously breaks relationships with other elements. I went looking for the source in the CSS Modules. I couldn't find it, so I looked at the component itself. It was full of inline styles.

I audited the codebase. 461 inline style calls across 74 files. The convention was CSS Modules. None of the inline styles were actually dynamic. Every single one was drift from the generalist phase: locally reasonable decisions that had piled up into a mess. The chat layout had been reimplemented four times because no approach was locked. This damage was already baked in before I implemented specialists. I just hadn't seen it until I started looking closely.

The new code was different though. It was more consistent. The decisions stayed coherent across the codebase. The agents stopped second-guessing things I'd already decided, because they didn't have the context to second-guess.

I didn't expect how much of the work would move upstream. Specialists are only as good as the hand-offs between them. Deciding where one stops and the next starts turns out to be most of the job.

- Where does the architect stop and the implementer start?
- What does the spec-writer hand off, and in what shape?
- Which decisions belong to me and which can I delegate?

These are the same questions I'd ask designing a team of people. The answers matter even more when the team is made of agents.

## What I actually do now

The work I'm doing now looks less like prompting and more like org design.

- I write specs.
- I define interfaces between specialists.
- I curate context.
- I codify recurring corrections into reusable skills so the fleet stays aligned with my taste without me having to be in the loop on every decision.

Six weeks and 93k lines later, the prompting is the smallest part of the work. As a soon-to-be dad of two, that's exactly what I need.
