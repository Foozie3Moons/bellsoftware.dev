# SRE With Limited Resources - Blog Post Spec

## Overview

Personal essay on adapting SRE Workbook principles when surface area exceeds coverage capacity. Problem/solution structure with a forward-looking section on AI-assisted SRE.

## Audience

General tech audience. Not a prescriptive guide - sharing personal thoughts and opinions.

## Structure

### 1. Opening Hook (2-3 paragraphs)

- The promise of SRE: meaningful SLOs, fast alerting, catching issues before users notice
- Contrast with lived experience: chasing alerts that don't correlate to real problems, tuning thresholds endlessly, burnout
- Thesis: The SRE Workbook is excellent, but its assumptions don't translate cleanly when surface area exceeds SRE headcount

### 2. The Workbook's Assumptions (short section)

- Reference alerting categories: Critical, High Fast, High Slow, Low, No SLO
- Reference latency SLO guidance: 90th and 99th percentile thresholds
- Note: these assume proportional staffing and traffic volume that produces statistically reliable data

### 3. Where It Breaks (the meat)

**Latency SLO cardinality**
- One error SLO per app works fine
- Latency needs multiple per app because controller actions vary in execution time
- Each needs individual tuning
- Cardinality explodes with surface area

**Unreliable high-percentile data**
- Low-traffic endpoints produce spiky, noisy data
- Tight thresholds on noisy data = false positives
- The SRE book acknowledges this for low-level services

**Alert fatigue loop**
- False positives erode trust in alerts
- Real alerts get ignored or actioned slowly
- The book warns about this, but the structure it recommends contributes to it when you can't staff proportionally

**SME bottleneck**
- Tuning is manual and expertise-dependent
- Doesn't scale with surface area
- Creates single points of failure on experienced SRE practitioners

Include burn rate table as concrete example:

```
SLI Error Rate |  1%   |  5%   |  10%  |  25%  |  50%  |  100%
Fast Burn      |  -    |  -    |  2.3h |  21m  |  11m  |  6m
Slow Burn      |  -    |  4.8h |  2.4h |  58m  |  29m  |  15m
```

### 4. What's Worked (practical adaptations)

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

### 5. Looking Forward: AI-Assisted SRE

Frame as emerging thinking, not shipped product.

**The constraint restated**
- The problem isn't tooling - it's human bandwidth
- Tuning, triaging, and maintaining SLOs is manual work that scales with surface area, not headcount

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

**Compound effect**
- The auditor can recommend tighter thresholds because the mediator absorbs the noise cost
- Tight thresholds become viable when AI handles the false positive load

### 6. Footer

Standard disclaimer: "Opinions are my own and do not represent my employer."

## Tone & Style

- Personal essay voice matching "The work isn't prompting"
- First person throughout
- Problems framed as personal experience with acknowledgment they likely exist elsewhere ("I can see this type of problem existing in many mid-size organisations")
- Reference SRE Workbook directly with specific citations
- Name tools where it adds specificity (Thanos, Splunk, PagerDuty) - infosec review before publish
- AI section clearly framed as emerging thinking
- Estimated length: 1500-2000 words

## Pre-publish Checklist

- [ ] Infosec review for tool/vendor mentions
- [ ] Disclaimer included
- [ ] No company-specific details that could reflect negatively

## References

- The Site Reliability Workbook (O'Reilly, 2018)
- Author's internal notes (2024-2025)
