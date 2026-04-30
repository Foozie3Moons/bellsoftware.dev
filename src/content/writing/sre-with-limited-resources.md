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
