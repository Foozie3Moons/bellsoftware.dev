---
title: "The work isn't prompting"
description: "Six weeks building a household AI assistant from scratch, and what I expected to be prompt engineering turned out to be org design."
pubDate: 2026-04-29
---

I've been using agentic coding tools for a few months now, long enough to feel comfortable with how they work. Six weeks ago I set out to build a household AI assistant. I'd seen a lot online about OpenClaw and personal AI assistants, but I'm also very aware of the security issues it and others like it have had. So I decided to do what any developer with limited free time would do and build the whole thing myself from the ground up.

I assumed the move was the same one I'd been using: find a capable generalist agent and get good at prompting it. Give it good context, give it good instructions, get good code back. The work would be in the prompt.

That isn't how it played out.

The generalist worked, technically. It produced code. The code compiled. Some of it was even good. But the more I asked it to do, the less it felt like building software and the more it felt like managing someone who was trying very hard to do five jobs at once. Decisions in one part of the codebase contradicted decisions in another. Patterns I'd established got quietly relitigated. The output was always plausible, which made it worse, because plausible-but-wrong is harder to catch than obviously-wrong.

At one point I found 461 inline style calls across 74 files when the convention was CSS Modules. None were genuinely dynamic. Every single one was drift: the agent making locally reasonable decisions that accumulated into incoherence. The chat layout got reimplemented four times because no approach was locked. Some of this is on me. I was reviewing fast, trusting the fleet to hold the line on conventions it had already been told. The point is that "told once" doesn't hold. Conventions need machinery behind them, not just instructions.

The fix wasn't a single shift. It was iterative. Each failure mode got its own machinery. Week 3, I carved work into specialized agents with tight system prompts and narrow tool surfaces. One that only thinks about architecture. One that only writes specs. One that only does dashboard work. Each with their own constraints, their own scope. Week 4, I added dispatch logging so I could see what was happening. Week 5, I added hooks that mechanically block mistakes before they're written. When an agent tries to write a migration to the wrong directory, it gets stopped, not corrected after the fact.

The first time I ran the specialist setup I expected marginal improvement. What I got was a different category of output. The code was more consistent. The decisions stayed coherent across the codebase. The agents stopped second-guessing things I'd already decided, because they didn't have the context to second-guess. They just did what they were built to do.

What I didn't expect was how much of the work moved upstream. Specialists are only as good as the seams between them, and drawing those seams turns out to be most of the job. Where does the architect stop and the implementer start? What does the spec-writer hand off, and in what shape? Which decisions belong to me and which can I delegate? These are the same questions you ask when designing a team of humans, and the answers matter more, not less, when the team is made of agents.

The work I'm doing now looks less like prompting and more like org design. I write specs. I define interfaces between specialists. I curate context. I codify recurring corrections into reusable skills so the fleet stays aligned with my taste without me having to be in the loop on every decision. The actual coding, the part I assumed would be the whole game, is the smallest part of how I spend my time.

The role this rewards isn't prompt engineer. It's closer to tech lead for a team that doesn't exist: someone who decides what good looks like and encodes it well enough that other actors can execute against it. The skills that compound are the ones senior engineers already have. Systems thinking. Clear interfaces. Knowing what good looks like.

To be clear: these are the findings of a solo dev working on a personal project with limited free time. But the problems (drift, context rot, plausible-but-wrong output) aren't unique to solo work. Neither are the fixes. Six weeks and 93k lines later, this is what's working for me.
