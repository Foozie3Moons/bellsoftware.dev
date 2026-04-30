---
title: "Site Reliability Engineering on a dime"
description: "The SRE Workbook is excellent. Its assumptions don't always translate."
pubDate: 2026-04-30
---

I've been working on Site Reliability Engineering (SRE) for a majority of my software engineering career and with that I've developed quite a few opinions over the years. The promise of SRE is compelling. Meaningful SLOs that reflect real user experience. Alerting that catches problems before customers notice. Error budgets that force conversations between reliability and velocity. 

And indeed, SRE was rolled out at Getty during my tenure. It has fulfiled its promises on enhancing reliability, reducing incident rates, and reducing time to resolution. It has increased release cadence and confidence. It has been one of the single most important things to be implemented in my opinion, which is why I care so deeply about it.

I've read the SRE Workbook cover to cover. The core concepts work and they make sense. But at a certain scale, things start to break down. Late nights chasing alerts that turned out to be noise. Tuning thresholds for weeks only to find they still don't correlate with actual user-facing issues. Burnout out on alerts that have nothing to action, especially middle of the night. Issues that fall through the cracks. I've noticed this is not a problem specific to my org. So what is the gap?

The SRE Workbook is excellent. But its assumptions don't translate cleanly when the surface area you're responsible for exceeds the headcount available to cover it. When you have more services than SREs, the practices that work for Google's dedicated teams start to break down. This is what I've learned trying to make them work anyway.

## The Workbook's assumptions

The Workbook's alerting guidance divides problems into categories: Critical (page immediately), High Fast (page within minutes), High Slow (page within hours), Low (ticket, don't page), and No SLO (don't alert at all). For latency, it recommends tracking both 90th and 99th percentile thresholds so you catch both broad degradations and tail latency spikes.

This is sound advice. It also assumes two things: that you have proportional staffing to handle alerts at each tier, and that your traffic volume produces enough data for those percentile calculations to be statistically meaningful. When those assumptions hold, the model works. When they don't, you get either alert fatigue or blind spots.

## Where it breaks

Four failure modes show up repeatedly. Each one connects back to the staffing assumption.

### Latency SLO cardinality

Error SLOs scale well. One per service, maybe one per critical endpoint. Errors are binary and don't need tuning.

Latency is different. Controller actions vary wildly in execution time. A dashboard index that renders in 50ms shares a codebase with a report export that legitimately takes 8 seconds. One threshold doesn't fit both. So you need multiple latency SLOs per service, each with its own baseline, each requiring individual tuning.

The math:

- 50 services
- 3 latency tiers per service (fast, medium, slow endpoints)
- 2 percentiles each (p90, p99)

That's 300 latency SLOs to define and maintain. For error SLOs, you might have 50. The cardinality explodes with surface area.

### Unreliable high-percentile data

Low-traffic endpoints produce spiky, noisy data. A single slow request can spike your p99 for hours. A batch job that runs once per day can skew your baseline. The data isn't wrong, but it's not stable enough to alert on.

Tight thresholds on noisy data produce false positives. The SRE book acknowledges this problem for low-level infrastructure services. The same dynamic applies to low-traffic application endpoints.

### Alert fatigue loop

False positives erode trust. Engineers stop treating alerts as urgent. Real alerts get ignored or actioned slowly. Response time degrades. Incidents that should have been caught early become customer-facing outages.

The Workbook warns about this. But the structure it recommends contributes to the problem when you can't staff proportionally. More SLOs means more alerts means more noise means less trust.

### SME bottleneck

Threshold tuning is manual and expertise-dependent. Someone needs to understand the service's behavior, look at the data, and make judgment calls about what's normal and what's degraded.

This creates single points of failure on experienced SRE practitioners. When they leave or get pulled onto incidents, tuning stops. When surface area grows faster than headcount, tuning falls behind. The model requires ongoing human calibration that doesn't scale.

### Burn rate reality check

The Workbook's multi-window burn rate alerting is elegant in theory. Here's what it looks like in practice:

| SLI Error Rate | 1% | 5% | 10% | 25% | 50% | 100% |
|----------------|-----|-----|-----|-----|-----|------|
| Fast Burn | - | - | 2.3h | 21m | 11m | 6m |
| Slow Burn | - | 4.8h | 2.4h | 58m | 29m | 15m |

The table shows time-to-alert for different error rates. At 1% and 5% error rates, the fast burn window doesn't fire at all within the alerting window. You're relying entirely on slow burn detection.

Tighter thresholds sound better. But they don't provide proportional value. A 1% error rate that takes hours to detect isn't necessarily worse than a 10% rate caught in minutes, if the 1% errors are transient and self-resolving. The obsession with catching everything early creates the noise that makes the system untrustworthy.

## What's worked

Four adaptations have made the Workbook's model usable without Google-scale staffing.

### Cap latency SLO targets at 99%

The Workbook mentions 90% and 99% as targets. I tried 99.9%. The data was noise.

At typical traffic volumes, you don't have enough data points to make high-percentile calculations stable. A handful of outliers dominate the signal. Google's Core Web Vitals targets 75%. Even they don't chase extreme percentiles for everything.

Stay at 99% or below. The reliability of your data matters more than the precision of your target.

### Standardize latency buckets

Predefined histogram buckets across all services:

- 5ms
- 10ms
- 25ms
- 50ms
- 100ms
- 250ms
- 500ms
- 1s
- 2.5s
- 5s

This gives you a consistent baseline for comparison. When every service uses the same buckets, you can reason about latency across services without translating between different scales. New services get sensible defaults. Tuning conversations start from a shared frame.

### Priority classification

Not everything needs the same alerting urgency. The Workbook's tiers are sound:

| Tier | Response |
|------|----------|
| **Critical** | Page immediately |
| **High Fast** | Page within minutes |
| **High Slow** | Page within hours |
| **Low** | Ticket, don't page |

The mistake is applying them uniformly. I apply them selectively based on actual business impact. A checkout service gets Critical. An internal admin dashboard gets Low. The classification reflects what actually matters, not what the SLO math says should matter.

### Business alignment on percentiles

This is the one that prevents endless threshold tuning.

Decide what percentage of users you're actually optimizing latency for. Not "as many as possible." A number. 90%? 95%? 99%? This is a business decision, not a technical one. Product and engineering leadership need to own it together.

Once you have that number, you can derive thresholds instead of tuning them. You're no longer in a rabbit hole asking "should this be 200ms or 250ms?" You're asking "what does p95 actually look like for this endpoint, and is that acceptable?" The answer is either yes or no. If no, it's a feature priority conversation, not an alerting configuration problem.

## Looking forward

The problem isn't tooling. We have Thanos, Splunk, PagerDuty, Grafana. The instrumentation exists. The problem is human bandwidth.

Tuning SLOs requires judgment. Triaging alerts requires context. Maintaining thresholds requires ongoing calibration. This work scales with surface area, not headcount. More services means more manual analysis, and there's a ceiling on how much of that any team can absorb.

I've been thinking about where AI fits here. Not shipped products. Early-stage ideas about what might actually help.

### SLO Auditor

An agent that queries actual infrastructure and answers questions humans currently bottleneck on:

- Which SLOs are too noisy?
- Is this threshold meaningful at this traffic volume?
- What services are emitting metrics but have no SLO configured?
- Which burn rate windows are producing alerts that never correlate with real incidents?

The work here isn't technically complex. It's analysis across Thanos, Splunk, and PagerDuty data. But it requires someone with context to sit down and do it. An agent that can query across these systems and surface patterns would automate the analysis currently bottlenecked on SMEs.

### Triage Agent

On-call engineer gets paged. Before they can even think about the problem, they need context:

1. Recent deploys to the affected service
2. Error patterns in logs
3. Current burn rate and trend
4. Service ownership and runbook location
5. Related alerts from the same timeframe

Assembling this takes 15-30 minutes. An agent that pulls this automatically cuts the context-gathering phase to seconds. The value compounds as deploy velocity increases. More deploys means more potential causes means more time spent on context assembly.

```
Alert fires
    ↓
Agent pulls: deploys, errors, burn rate, ownership
    ↓
Engineer starts with full context
```

### Alert Mediator

This sits between the alerting system and PagerDuty:

1. Alert fires from Prometheus/Thanos
2. Agent evaluates: real signal or noise?
3. If real or uncertain: page
4. If noise: create ticket to fix the threshold, suppress the page

The key insight is that noise has a cost. Every false positive erodes trust, burns on-call attention, and contributes to alert fatigue. Currently, humans absorb that cost. An agent that filters noise and creates actionable work items to fix the underlying threshold problems shifts that cost away from human attention.

### The compound effect

These three concepts connect. The auditor can recommend tighter thresholds because the mediator absorbs the false positive load. Tight thresholds become viable when AI handles the noise cost rather than humans.

```
Auditor recommends tighter SLO
    ↓
Tighter threshold produces more alerts
    ↓
Mediator filters noise, tickets fixes
    ↓
On-call only sees real problems
    ↓
Trust in alerting increases
```

I'm not claiming this is solved. The failure modes are obvious: an agent that suppresses real alerts is worse than noise. The judgment calls are hard. But the direction is clear. The bottleneck on SRE practice at scale isn't tooling or methodology. It's human analysis capacity. That's exactly what AI systems should be good at augmenting.

---

*Opinions are my own and do not represent my employer.*
