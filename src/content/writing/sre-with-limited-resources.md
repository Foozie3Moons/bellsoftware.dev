---
title: "SRE with limited resources"
description: "The SRE Workbook is excellent. Its assumptions don't always translate."
pubDate: 2026-04-30
---

The promise of SRE is compelling. Meaningful SLOs that reflect real user experience. Alerting that catches problems before customers notice. Error budgets that force conversations between reliability and velocity. I've read the SRE Workbook cover to cover. I've implemented pieces of it. The model makes sense.

The lived experience has been different. I've spent late nights chasing alerts that turned out to be noise. I've tuned thresholds for weeks only to find they still don't correlate with actual user-facing issues. I've burned out on pager rotations where most of what woke me up didn't matter, and what did matter sometimes slipped through anyway. I can see this type of problem existing in many mid-size organisations, not just mine.

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
