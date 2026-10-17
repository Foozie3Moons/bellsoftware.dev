---
title: "Site Reliability Engineering on a dime"
description: "The SRE Workbook is excellent. Its assumptions don't always translate."
pubDate: 2026-04-30
draft: true
---

I've worked on site reliability engineering (SRE) for most of my career, and I've developed quite a few opinions along the way. The promise of SRE is compelling: meaningful SLOs that reflect real user experience, alerting that catches problems before customers notice, and error budgets that force conversations between reliability and velocity.

SRE was rolled out at Getty during my tenure, and it has delivered on its promises. Reliability is better, incidents are fewer, and they get resolved faster. Releases are more frequent and more confident. In my opinion it's one of the most important things we've implemented, which is why I care about it so much.

I've read the [SRE Workbook](https://sre.google/workbook/table-of-contents/) cover to cover. The core concepts work and they make sense. At a certain scale though, things start to break down. I've had late nights chasing alerts that turned out to be noise. I've tuned thresholds for weeks only to find they still didn't line up with real user-facing issues. I've burned out on alerts with nothing to action (especially in the middle of the night) and watched issues fall through the cracks. This isn't specific to my org either.

The Workbook is excellent, but its assumptions don't translate cleanly when a team's surface area outgrows the headcount available to cover it. Practices that work for Google's dedicated teams start to fail at smaller scale.

A [second edition](https://www.oreilly.com/library/view/site-reliability-engineering/9798341607675/), scheduled for October 2026, explicitly addresses how SRE applies beyond Google's scale. This post is what I've learned trying to make the first edition work in the meantime.

## The Workbook's assumptions

The Workbook's [alerting guidance](https://sre.google/workbook/alerting-on-slos/) divides problems into categories:

| Category | Response |
|----------|----------|
| **Critical** | Page immediately |
| **High Fast** | Page within minutes |
| **High Slow** | Page within hours |
| **Low** | Ticket, don't page |
| **No SLO** | Don't alert at all |

For latency, it recommends tracking both `p90` and `p99` thresholds so a team catches both broad slowdowns and tail latency spikes.

This is sound advice. It also assumes two things. The first is staffing in proportion to the alerts at each tier. The second is enough traffic for those percentile calculations to be statistically meaningful. When those assumptions hold, the model works. When they don't, the result is alert fatigue or blind spots.

## Where it breaks

Six failure modes show up again and again. Each one ties back to one of those two assumptions.

### Latency SLO cardinality

Error SLOs scale well. A team needs one per service, maybe one per critical endpoint. Errors are binary and don't need tuning.

Latency is different. Controller actions vary wildly in execution time. A dashboard index that renders in `50ms` shares a codebase with a report export that legitimately takes `8 seconds`. One threshold doesn't fit both. So each service needs several latency SLOs, each with its own baseline and its own tuning.

The math:

- 50 services
- 3 latency tiers per service (fast, medium, slow endpoints)
- 2 percentiles each (`p90`, `p99`)

That's 300 latency SLOs to define and maintain. For error SLOs, you might have 50. The cardinality explodes with surface area.

### Unreliable high-percentile data

Low-traffic endpoints produce spiky, noisy data. A single slow request can spike the `p99` for hours. A batch job that runs once per day can skew your baseline. The data isn't wrong, but it's not stable enough to alert on.

Tight thresholds on noisy data produce false positives. The SRE book [acknowledges this problem](https://sre.google/workbook/alerting-on-slos/#low-traffic-services-and-error-budget-alerting) for low-level infrastructure services. The same dynamic applies to low-traffic application endpoints.

### Alert fatigue loop

False positives erode trust, so engineers stop treating alerts as urgent. Real alerts get ignored or handled slowly, and response times degrade. Incidents that should have been caught early become customer-facing outages.

The Workbook warns about this. But the structure it recommends contributes to the problem when you can't staff proportionally. More SLOs means more alerts means more noise means less trust.

### SME bottleneck

Threshold tuning is manual and expertise-dependent. Someone needs to understand the service's behavior, look at the data, and make judgment calls about what's normal and what's degraded.

This creates single points of failure on experienced SRE practitioners. When they leave or get pulled onto incidents, tuning stops. When surface area grows faster than headcount, tuning falls behind. The model requires ongoing human calibration that doesn't scale.

### Burn rate reality check

The Workbook's [multi-window burn rate](https://sre.google/workbook/alerting-on-slos/#6-multiwindow-multi-burn-rate-alerts) alerting looks good on paper. This is what it looks like in practice:

| SLI Error Rate | 1% | 5% | 10% | 25% | 50% | 100% |
|----------------|-----|-----|-----|-----|-----|------|
| Fast Burn | - | - | 2.3h | 21m | 11m | 6m |
| Slow Burn | - | 4.8h | 2.4h | 58m | 29m | 15m |

The table shows time-to-alert for different error rates. At 1% and 5% error rates, the fast burn window doesn't fire at all within the alerting window. Detection relies entirely on the slow burn window.

Tighter thresholds sound better, but they don't add proportional value. A 1% error rate that takes hours to detect isn't necessarily worse than a 10% rate caught in minutes, if the 1% errors are transient and self-resolving. The obsession with catching everything early creates the noise that makes the system untrustworthy.

### Low traffic breaks the math

Burn rates depend on a fundamental assumption: enough requests to make the math meaningful. The formula is straightforward:

```
error_rate = errors / total_requests
```

At 10 requests per hour, a single error is a 10% error rate. Two errors and you're at 20%. The burn rate calculation amplifies this noise into alerts that don't reflect actual system health.

Some of our lowest-traffic services are also the most critical. The purchase path handles fewer requests than the homepage, but every one of those requests represents revenue. A payment endpoint might process 50 transactions per hour during off-peak. Standard SLO math falls apart at that volume, but we can't just ignore it because it's "low traffic."

The Workbook's [answer is synthetic traffic](https://sre.google/workbook/alerting-on-slos/#low-traffic-services-and-error-budget-alerting): simulate load to generate enough data points. I don't buy it. Synthetic traffic adds infrastructure complexity, doesn't reflect real user behavior, and creates its own failure modes. It solves a measurement problem by adding more things that can break.

## What's worked

Five adaptations have made the Workbook's model usable without Google-scale staffing.

### Cap latency SLO targets at 99%

The Workbook [mentions `p90` and `p99`](https://sre.google/workbook/implementing-slos/#slis-for-different-types-of-services) as targets. I tried `p99.9`. The data was noise.

At typical traffic volumes there aren't enough data points to make high-percentile calculations stable. A handful of outliers dominate the signal. Google's Core Web Vitals targets `p75`. Even they don't chase extreme percentiles for everything.

I stay at `p99` or below. Reliable data matters more than a precise target.

### Standardize latency buckets

Predefined histogram buckets across all services:
```
[5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s]
```

This gives a consistent baseline for comparison. When every service uses the same buckets, latency can be compared across services without translating between scales. New services get sensible defaults. Tuning conversations start from a shared frame.

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

Decide what percentage of users to optimize latency for, as an actual number (`p90`, `p95`, or `p99`) rather than "as many as possible." That's a business decision. Product and engineering leadership need to own it together.

With that number, thresholds can be derived instead of tuned. The question stops being "should this be 200ms or 250ms?" and becomes "what does `p95` look like for this endpoint, and is that acceptable?" The answer is yes or no. If it's no, that's a feature priority conversation.

### Custom alerting for low-traffic critical paths

For services where burn rate math breaks down but the business impact is high, we've moved to custom alerting that doesn't depend on statistical volume.

Payment processing is the clearest example. Rather than aggregate error rates, we alert by payment method with thresholds scaled to volume:

| Volume | Threshold |
|--------|-----------|
| High | Tighter windows, error counts |
| Medium | Wider windows, allow transients |
| Low | Any failure pages |

Lower volume means each failure represents a larger share of transactions. A single failure on the lowest-volume payment method might be 5% of that hour's traffic. Standard burn rates would never catch it.

The tradeoff is maintenance cost. These custom alerts require domain knowledge to set up and tune. But for mission-critical, low-traffic paths, that cost is worth it. The alternative is either constant noise from oversensitive SLOs or blind spots on the most important transactions.

## Looking forward

Tooling isn't the problem. We have Thanos, Splunk, PagerDuty, and Grafana, and the instrumentation exists. The problem is human bandwidth.

Tuning SLOs requires judgment. Triaging alerts requires context. Maintaining thresholds requires ongoing calibration. This work scales with surface area, not headcount. More services means more manual analysis, and there's a ceiling on how much of that any team can absorb.

I've been thinking about where AI fits here. These are early-stage ideas, not shipped products.

### SLO Auditor

An agent that queries actual infrastructure and answers questions humans currently bottleneck on:

- Which SLOs are too noisy?
- Is this threshold meaningful at this traffic volume?
- What services are emitting metrics but have no SLO configured?
- Which burn rate windows are producing alerts that never correlate with real incidents?

The work isn't technically complex. It's analysis across Thanos, Splunk, and PagerDuty data, but it needs someone with context to sit down and do it. An agent that can query across these systems and surface patterns would automate the analysis currently bottlenecked on SMEs.

### Triage Agent

When an on-call engineer gets paged, they need context before they can even think about the problem:

1. Recent deploys to the affected service
2. Error patterns in logs
3. Current burn rate and trend
4. Service ownership and runbook location
5. Related alerts from the same timeframe

Assembling this takes 15 to 30 minutes. An agent that pulls it automatically would cut that to seconds. The value compounds as deploy velocity increases. More deploys means more potential causes means more time spent on context assembly.

```
Alert fires
    ↓
Agent pulls: deploys, errors, burn rate, ownership
    ↓
Engineer starts with full context
```

### Alert Mediator

This sits between the alerting system and PagerDuty:

1. Alert fires from Prometheus or Thanos
2. Agent evaluates: real signal or noise?
3. If real or uncertain: page
4. If noise: create ticket to fix the threshold, suppress the page

Noise has a cost. Every false positive erodes trust, burns on-call attention, and contributes to alert fatigue. Currently, humans absorb that cost. An agent that filters noise and creates actionable work items to fix the underlying threshold problems shifts that cost away from human attention.

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

This isn't solved. The obvious failure mode is an agent that suppresses real alerts, which is worse than noise, and the judgment calls are hard. The bottleneck on SRE at scale is human analysis capacity though, and that's what AI should be good at augmenting.

---

*Opinions are my own and do not represent my employer.*
