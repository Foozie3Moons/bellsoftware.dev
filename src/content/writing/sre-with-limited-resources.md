---
title: "Site Reliability Engineering on a dime"
description: "Our SRE practice is built on the SRE Workbook. Here's where it breaks with a small team, and what Google's second edition changes."
pubDate: 2026-04-30
draft: true
---

I've worked on site reliability engineering (SRE) for most of my career, and I've developed quite a few opinions along the way. The promise of SRE is compelling: meaningful SLOs that reflect real user experience, alerting that catches problems before customers notice, and error budgets that force conversations between reliability and velocity.

SRE was rolled out at the large multinational I work for during my tenure, and it has delivered on its promises. Reliability is better, incidents are fewer, and they get resolved faster. Releases are more frequent and more confident. In my opinion it's one of the most important things we've implemented, which is why I care about it so much.

I've read the [SRE Workbook](https://sre.google/workbook/table-of-contents/) cover to cover, and our SLOs and alerting are built on it. The core concepts work and they make sense. At a certain scale though, things start to break down. I've had late nights chasing alerts that turned out to be noise. I've tuned thresholds for weeks only to find they still didn't line up with real user-facing issues. I've burned out on alerts with nothing to action (especially in the middle of the night) and watched issues fall through the cracks. This isn't specific to my org either.

The Workbook's assumptions don't translate cleanly when a team's surface area outgrows the headcount available to cover it. Practices that work for Google's dedicated teams start to fail at smaller scale.

In October 2026 Google released a [second edition](https://cloud.google.com/blog/products/devops-sre/sre-book-second-edition) of the original SRE book. It's a full rewrite, and unlike the first edition it isn't free to read online. It admits that SRE books, "including ours," make SRE look like it needs a large team, and that SRE "typically comprises a small fraction of the organization's developers." We haven't implemented any of it yet. This post walks through what we run today, where it breaks, and what the second edition says about each problem.

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

It's sound advice that assumes two things: staffing in proportion to the alerts at each tier, and enough traffic for those percentile calculations to be statistically meaningful. When those assumptions hold, the model works. When they don't, the result is alert fatigue or blind spots.

The staffing assumption used to be explicit. In Google's original engagement model, each newly supported service came with headcount transferred from the development organization to SRE, and the more complex the service, the more headcount. The second edition moves away from that model, but its replacement still assumes leaders can move headcount between SRE and development.

## Where it breaks

Six failure modes come out of those two assumptions. Three come from staffing: latency SLO cardinality, alert fatigue, and the SME bottleneck. The other three come from traffic: noisy high-percentile data, slow burn-rate detection, and low traffic breaking the math.

We hit most of them early. Looking back at the first alerts we set up:

> A lot of the initial alerts set up when [we] started [our] SRE work were bad SLOs. It took a while to figure out a standard for latency SLOs specifically

> they often had thresholds that were very low and would never alert under a SLO burn rate calculation, had ad-hoc buckets which made it impossible to maintain, or were too spikey to have a meaningful threshold

### Latency SLO cardinality

Error SLOs scale well. A team needs one per service, maybe one per critical endpoint, and errors are binary so they don't need tuning.

Latency doesn't work that way. Controller actions vary wildly in execution time. A dashboard index that renders in 50ms shares a codebase with a report export that legitimately takes 8 seconds, so one threshold doesn't fit both. Each service needs several latency SLOs, each with its own baseline and its own tuning. For a modest setup that looks like:

- 50 services
- 3 latency tiers per service (fast, medium, slow endpoints)
- 2 percentiles each (`p90`, `p99`)

That's 300 latency SLOs to define and maintain, against about 50 error SLOs.

The second edition suggests fewer than five SLOs per service and lifecycle tags to retire old ones, but it counts per service. Its automation chapter warns that toil which scales "per machine, per customer, or even per feature can quickly overwhelm a small SRE team," and a latency threshold per endpoint scales per feature.

### Unreliable high-percentile data

Low-traffic endpoints produce spiky, noisy data. A single slow request can spike the `p99` for hours, and a batch job that runs once a day can skew the baseline. The data is accurate. It just isn't stable enough to alert on.

Tight thresholds on noisy data produce false positives. The Workbook [acknowledges this problem](https://sre.google/workbook/alerting-on-slos/#low-traffic-services-and-error-budget-alerting) for low-level infrastructure services, and the same thing happens on low-traffic application endpoints. The second edition avoids some of it by defining latency SLOs as a ratio (the share of requests under a threshold) instead of a percentile.

### Alert fatigue loop

False positives erode trust, so engineers stop treating alerts as urgent. Real alerts get ignored or handled slowly, and incidents that should have been caught early become customer-facing outages.

The on-call investigations I've seen bear this out. In one archive of 53, 11 found no impact or nothing to fix, and 7 were events affecting one or two users. In the same archive, a real 503 problem "had been missed all afternoon."

The Workbook warns about this, but the structure it recommends adds to the problem when a team can't staff proportionally. More SLOs means more alerts means more noise means less trust.

Google now puts a number on sustainable on-call: no more than two incidents per shift, assuming each takes 4 to 6 hours. Past that, the book says, comes alert fatigue and shallower investigation. It also describes an annoyance factor, where a five-minute task that wakes the on-caller counts for more than its five minutes.

### SME bottleneck

Threshold tuning is manual and depends on expertise. Someone needs to understand the service's behavior, look at the data, and decide what's normal and what's degraded.

That makes experienced SRE practitioners single points of failure. When they leave or get pulled onto incidents, tuning stops. When surface area grows faster than headcount, tuning falls behind.

Our alert auditing and new alert work ran through a volunteer guild that peaked at five people. Each team had its own SRE expert for its domain, and the platform SRE team was about two developers. The book describes people like our guild as developers with a reliability focus who "may not even hold the title of SRE," and it warns that a designated toil expert becomes a single point of failure and burns out.

### Slow burn-rate detection

The Workbook's [multi-window burn rate](https://sre.google/workbook/alerting-on-slos/#6-multiwindow-multi-burn-rate-alerts) alerting looks good on paper. In practice, time-to-alert looks like this:

| SLI Error Rate | 1% | 5% | 10% | 25% | 50% | 100% |
|----------------|-----|-----|-----|-----|-----|------|
| Fast Burn | - | - | 2.3h | 21m | 11m | 6m |
| Slow Burn | - | 4.8h | 2.4h | 58m | 29m | 15m |

At 1% and 5% error rates the fast burn window doesn't fire at all, so detection relies entirely on the slow burn window.

Tighter thresholds sound better, but they don't add proportional value. A 1% error rate that takes hours to detect isn't necessarily worse than a 10% rate caught in minutes, if the 1% errors are transient and self-resolving. Trying to catch everything early creates the noise that makes the system untrustworthy. The book makes a related point from the other direction: a very loose SLO can make a fast-burn page impossible.

### Low traffic breaks the math

Burn rates assume there are enough requests to make the math meaningful:

```
error_rate = errors / total_requests
```

At 10 requests per hour, a single error is a 10% error rate and two errors is 20%. The burn rate calculation turns that noise into alerts that don't reflect actual system health.

Some of our lowest-traffic services are also the most critical. The purchase path handles fewer requests than the homepage, but every one of those requests represents revenue. A payment endpoint might process 50 transactions per hour during off-peak. Standard SLO math falls apart at that volume, but we can't just ignore it because it's "low traffic."

In practice that looks like a checkout payment SLO paging for a single user's retry loop, and another firing for two users double-submitting an order. On some days the denominator is a literal handful of orders.

The Workbook's [answer is synthetic traffic](https://sre.google/workbook/alerting-on-slos/#low-traffic-services-and-error-budget-alerting): simulate load to generate enough data points. I don't buy it. Synthetic traffic adds infrastructure complexity, doesn't reflect real user behavior, and creates its own failure modes. It solves a measurement problem by adding more things that can break.

This is where the second edition changes the most. Its SLO chapter handles services under about 100 requests an hour with a Wilson score lower bound instead of fixed burn thresholds, so a handful of errors on a quiet endpoint no longer reads as an outage. Its monitoring chapter gates pages the same way, paging only when a confidence interval's lower bound crosses the SLO. It also suggests a synthetic probe for each critical user journey, which is much smaller than generating load. At Google all of this comes from a centralized alert configuration service.

## What's worked

Five adaptations have made the Workbook's model usable without Google-scale staffing, and the second edition agrees with most of them.

### Cap latency SLO targets at 99%

The Workbook [mentions `p90` and `p99`](https://sre.google/workbook/implementing-slos/#slis-for-different-types-of-services) as targets. I tried `p99.9` and the data was noise.

At typical traffic volumes there aren't enough data points to make high-percentile calculations stable, so a handful of outliers dominate the signal. Google's Core Web Vitals targets `p75`, so extreme percentiles aren't the norm even there.

I stay at `p99` or below, because reliable data matters more than a precise target.

### Standardize latency buckets

Predefined histogram buckets across all services:

```
[5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s]
```

This gives a consistent baseline. When every service uses the same buckets, latency can be compared across services without translating between scales. New services get sensible defaults, and tuning conversations start from a shared frame.

The second edition doesn't name buckets, but its golden paths are the same idea: self-service templates for things like monitoring and alerting, so new services start out reliable by default.

### Priority classification

Not everything needs the same alerting urgency, and the Workbook's tiers are sound:

| Tier | Response |
|------|----------|
| **Critical** | Page immediately |
| **High Fast** | Page within minutes |
| **High Slow** | Page within hours |
| **Low** | Ticket, don't page |

The mistake is applying them uniformly. I apply them based on actual business impact, so a checkout service gets Critical and an internal admin dashboard gets Low. The classification reflects what actually matters, not what the SLO math says should matter.

The book makes the same argument. Assurance should match consequence, and "systems needing more nines should get more investment."

### Business alignment on percentiles

This adaptation is the one that prevents endless threshold tuning. Decide what percentage of users to optimize latency for, as an actual number (`p90`, `p95`, or `p99`) rather than "as many as possible." That's a business decision, and product and engineering leadership need to own it together.

With that number, thresholds can be derived instead of tuned. The question stops being "should this be 200ms or 250ms?" and becomes "what does `p95` look like for this endpoint, and is that acceptable?" If it isn't, that's a feature priority conversation.

In the second edition, where latency SLOs are ratios, a `p95` target means 95% of requests under the threshold.

### Custom alerting for low-traffic critical paths

For services where burn rate math breaks down but the business impact is high, we've moved to custom alerting that doesn't depend on statistical volume.

Payment processing is the clearest example. Rather than aggregate error rates, we alert by payment method with thresholds scaled to volume:

| Volume | Threshold |
|--------|-----------|
| High | Tighter windows, error counts |
| Medium | Wider windows, allow transients |
| Low | Any failure pages |

Each alert is a rule like "less than N transactions of this payment type in this time window," tuned to that payment type's own traffic. We run them for 12 payment types. Each payment method is a critical user journey in the book's terms, and it recommends keeping SLOs focused on those.

Lower volume means each failure represents a larger share of transactions. A single failure on the lowest-volume payment method might be 5% of that hour's traffic, and standard burn rates would never catch it.

The tradeoff is maintenance cost. These custom alerts take domain knowledge to set up and tune, but for mission-critical, low-traffic paths that cost is worth it. The alternative is either constant noise from oversensitive SLOs or blind spots on the most important transactions.

## Looking forward

We have Thanos, Splunk, PagerDuty, and Grafana, and the instrumentation exists. The problem is human bandwidth.

Tuning SLOs, triaging alerts, and keeping thresholds calibrated all take judgment and context. That work scales with surface area, not headcount, and there's a ceiling on how much of it any team can absorb.

I've been thinking about where AI fits here. These are early-stage ideas, not shipped products. The second edition has a chapter on AI for SRE, and where it covers the same ground I've followed its approach.

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

In my experience, assembling this takes 15 to 30 minutes. An agent that pulls it automatically would cut that to seconds. The value compounds as deploy velocity increases. More deploys means more potential causes means more time spent on context assembly.

A colleague has a Claude skill that does part of this. During their on-call shifts it polls PagerDuty for new incidents, investigates each one read-only through Splunk, and writes up what it found. Several of the numbers in this post come from the team's archive of on-call investigations. In the book's terms it's a level 1, or assisted, agent. It investigates and summarizes, and a human decides what to do. The book calls detection and triage a relatively safe place to start with AI, because the main risk is overescalation.

```
Alert fires
    ↓
Agent pulls: deploys, errors, burn rate, ownership
    ↓
Engineer starts with full context
```

### Alert Mediator

This sits between the alerting system and PagerDuty. The book's rule for agents is that they only take an action they know how to undo. A suppressed page can't be undone, so the mediator labels pages instead of suppressing them:

1. Alert fires from Prometheus or Thanos
2. Agent evaluates: real signal or noise?
3. The page fires either way, labelled with the agent's verdict, its reasoning, and its confidence
4. If it judged the alert as noise, it creates a ticket to fix the threshold
5. If the agent can't reach its data, the page fires unlabelled

Noise has a cost. Every false positive erodes trust, burns on-call attention, and contributes to alert fatigue. Currently, humans absorb that cost. An agent that flags noise and creates actionable work items to fix the underlying threshold problems shifts some of that cost away from human attention.

The investigation archive makes the case for this one too. One threshold review was recommended by four separate investigations and still hadn't been actioned.

The book's automation chapter has a case that shows why the page always fires. A team kept a human trigger on database recovery, and shortly afterward a monitoring glitch fired every alert. Fully automated recovery would have run an unnecessary restore and lost recent user writes. A mediator reading the same monitoring would have inherited the same glitch. The chapter also warns against automating over a broken foundation, which is what the threshold tickets are for.

The book also sets out how an agent earns more autonomy: test coverage, a rollback path, an error budget, and a track record at its current level. It demotes the agent automatically when the agent uses up its safety budget. A mediator that holds or suppresses pages would have to earn that, and the book is clear that not every system should get there.

### The compound effect

These three concepts connect. The auditor can recommend tighter thresholds because the mediator turns the extra noise into threshold tickets. On-call still sees every page, but knows which ones the agent thinks are noise and why.

```
Auditor recommends tighter SLO
    ↓
Tighter threshold produces more alerts
    ↓
Mediator labels likely noise, tickets threshold fixes
    ↓
Thresholds get fixed instead of ignored
    ↓
Trust in alerting increases
```

The measure for that last step is the share of pages that are actionable.

This isn't solved, and the judgment calls are hard. The automation chapter's warning applies to every agent here: automation that handles 99% of cases leaves people without the skills or awareness for the other 1%. The second edition doesn't expect AI to shrink SRE teams either. It expects the reliability bar to rise and the portfolio each team covers to grow. The bottleneck on SRE at scale is human analysis capacity, and that's what AI should be good at augmenting.

---

*Opinions are my own and do not represent my employer.*
