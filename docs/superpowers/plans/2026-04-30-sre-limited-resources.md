# SRE With Limited Resources - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write a personal essay on adapting SRE Workbook principles when surface area exceeds coverage capacity.

**Architecture:** Single markdown file with frontmatter, six sections per spec. Problem/solution structure with forward-looking AI section.

**Tech Stack:** Astro content collection, markdown

**Spec:** `docs/superpowers/specs/2026-04-30-sre-limited-resources-design.md`

---

## File Structure

- Modify: `src/content/writing/sre-with-limited-resources.md` (placeholder exists, will be replaced with full content)

---

### Task 1: Frontmatter and Opening Hook

**Files:**
- Modify: `src/content/writing/sre-with-limited-resources.md`

- [ ] **Step 1: Write frontmatter**

```markdown
---
title: "SRE with limited resources"
description: "The SRE Workbook is excellent. Its assumptions don't always translate."
pubDate: 2026-04-30
---
```

- [ ] **Step 2: Write opening hook (2-3 paragraphs)**

Content requirements:
- The promise of SRE: meaningful SLOs, fast alerting, catching issues before users notice
- Contrast with lived experience: chasing alerts that don't correlate to real problems, tuning thresholds endlessly, burnout
- Thesis: The SRE Workbook is excellent, but its assumptions don't translate cleanly when surface area exceeds SRE headcount
- First person voice
- Do not claim industry-wide knowledge - frame as personal experience

- [ ] **Step 3: Preview in dev server**

Run: `pnpm dev`
Open: `http://localhost:4321/writing/sre-with-limited-resources`
Verify: Post renders, frontmatter displays correctly, opening reads well

- [ ] **Step 4: Commit**

```bash
git add src/content/writing/sre-with-limited-resources.md
git commit -m "Add opening for SRE with limited resources post"
```

---

### Task 2: The Workbook's Assumptions Section

**Files:**
- Modify: `src/content/writing/sre-with-limited-resources.md`

- [ ] **Step 1: Write section**

Content requirements:
- Section heading: `## The Workbook's assumptions`
- Reference alerting categories: Critical, High Fast, High Slow, Low, No SLO
- Reference latency SLO guidance: 90th and 99th percentile thresholds
- Note: these assume proportional staffing and traffic volume that produces statistically reliable data
- Keep this section short - it sets up the problems

- [ ] **Step 2: Preview in browser**

Verify: Section renders, flows from opening

- [ ] **Step 3: Commit**

```bash
git add src/content/writing/sre-with-limited-resources.md
git commit -m "Add Workbook assumptions section"
```

---

### Task 3: Where It Breaks Section

**Files:**
- Modify: `src/content/writing/sre-with-limited-resources.md`

- [ ] **Step 1: Write section with four subsections**

Section heading: `## Where it breaks`

**Subsection: Latency SLO cardinality**
- One error SLO per app works fine
- Latency needs multiple per app because controller actions vary in execution time
- Each needs individual tuning
- Cardinality explodes with surface area

**Subsection: Unreliable high-percentile data**
- Low-traffic endpoints produce spiky, noisy data
- Tight thresholds on noisy data = false positives
- The SRE book acknowledges this for low-level services

**Subsection: Alert fatigue loop**
- False positives erode trust in alerts
- Real alerts get ignored or actioned slowly
- The book warns about this, but the structure it recommends contributes to it when you can't staff proportionally

**Subsection: SME bottleneck**
- Tuning is manual and expertise-dependent
- Doesn't scale with surface area
- Creates single points of failure on experienced SRE practitioners

- [ ] **Step 2: Add burn rate table**

Include this table as a concrete example showing how threshold tightening affects alerting times:

```
SLI Error Rate |  1%   |  5%   |  10%  |  25%  |  50%  |  100%
Fast Burn      |  -    |  -    |  2.3h |  21m  |  11m  |  6m
Slow Burn      |  -    |  4.8h |  2.4h |  58m  |  29m  |  15m
```

Introduce the table with context about what it shows and why tighter thresholds don't always provide proportional value.

- [ ] **Step 3: Preview in browser**

Verify: All subsections render, table displays correctly, this is the meatiest section

- [ ] **Step 4: Commit**

```bash
git add src/content/writing/sre-with-limited-resources.md
git commit -m "Add 'where it breaks' section with problems"
```

---

### Task 4: What's Worked Section

**Files:**
- Modify: `src/content/writing/sre-with-limited-resources.md`

- [ ] **Step 1: Write section with four adaptations**

Section heading: `## What's worked`

**Cap latency SLO targets at 99%**
- The Workbook mentions 90% and 99% as targets
- Going higher produces unreliable data at typical traffic volumes
- Google's Core Web Vitals targets 75% - even they don't chase extreme percentiles for everything

**Standardize latency buckets**
- Predefined buckets: 5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s
- Consistent baseline across services
- Easier to reason about and compare

**Priority classification**
- Not everything needs the same alerting urgency
- Adopt Critical / High Fast / High Slow / Low tiers from the Workbook
- But apply them selectively based on actual business impact

**Business alignment on percentiles**
- Decide what % of users you're actually optimizing latency for
- Otherwise you're in a threshold tuning rabbit hole forever
- This is a business decision, not a technical one

- [ ] **Step 2: Preview in browser**

Verify: Adaptations are clear and actionable, flows from problems section

- [ ] **Step 3: Commit**

```bash
git add src/content/writing/sre-with-limited-resources.md
git commit -m "Add 'what's worked' section with adaptations"
```

---

### Task 5: Looking Forward Section

**Files:**
- Modify: `src/content/writing/sre-with-limited-resources.md`

- [ ] **Step 1: Write section intro**

Section heading: `## Looking forward`

Restate the constraint:
- The problem isn't tooling - it's human bandwidth
- Tuning, triaging, and maintaining SLOs is manual work that scales with surface area, not headcount
- Frame everything that follows as emerging thinking, not shipped product

- [ ] **Step 2: Write three AI concept subsections**

**SLO Auditor concept**
- Queries actual infra (Thanos, Splunk, PagerDuty)
- Answers: "Which SLOs are too noisy?", "Is this threshold meaningful at this traffic volume?"
- Detects coverage gaps: what's emitting metrics but has no SLO configured?
- Automates the analysis work currently bottlenecked on SMEs

**Triage Agent concept**
- On-call gets paged
- Agent instantly pulls recent deploys, error patterns, burn rate, ownership
- Cuts the 15-30 min context-assembly step to seconds
- More valuable as deploy velocity increases

**Alert Mediator concept**
- Sits between alerting system and PagerDuty
- Alert fires, agent evaluates real vs noise
- Pages if real or uncertain
- Creates ticket to fix if noise
- Absorbs noise cost that currently burns out humans

- [ ] **Step 3: Write compound effect closing**

Explain:
- The auditor can recommend tighter thresholds because the mediator absorbs the noise cost
- Tight thresholds become viable when AI handles the false positive load
- This is early thinking - not claiming it's solved, just where it points

- [ ] **Step 4: Preview in browser**

Verify: AI concepts are clearly framed as emerging thinking, not shipped work

- [ ] **Step 5: Commit**

```bash
git add src/content/writing/sre-with-limited-resources.md
git commit -m "Add 'looking forward' section on AI-assisted SRE"
```

---

### Task 6: Disclaimer and Final Review

**Files:**
- Modify: `src/content/writing/sre-with-limited-resources.md`

- [ ] **Step 1: Add disclaimer**

Add to end of post:

```markdown
---

*Opinions are my own and do not represent my employer.*
```

- [ ] **Step 2: Full read-through**

Read entire post in browser. Check:
- Flows logically from hook to conclusion
- First person voice throughout
- Problems framed as personal experience, not industry claims
- AI section clearly framed as emerging thinking
- No company-specific details that could reflect negatively
- Disclaimer present

- [ ] **Step 3: Word count check**

Run: `wc -w src/content/writing/sre-with-limited-resources.md`
Target: 1500-2000 words

- [ ] **Step 4: Final commit**

```bash
git add src/content/writing/sre-with-limited-resources.md
git commit -m "Complete SRE with limited resources post"
```

---

## Pre-Publish Checklist (manual, post-implementation)

- [ ] Infosec review for tool/vendor mentions (Thanos, Splunk, PagerDuty)
- [ ] Disclaimer included
- [ ] No company-specific details that could reflect negatively
