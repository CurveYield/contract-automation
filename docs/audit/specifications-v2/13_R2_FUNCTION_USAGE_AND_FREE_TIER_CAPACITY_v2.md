# R2 Function Usage and Free-Tier Capacity v2

## Pricing snapshot

As of July 31, 2026, Cloudflare R2 Standard includes monthly:

- 10 GB-month storage;
- 1,000,000 Class A operations;
- 10,000,000 Class B operations;
- free egress.

Standard pricing above the allowance is $0.015/GB-month, $4.50/million Class A, and $0.36/million Class B. Cloudflare rounds billable usage up to the next billing unit. Official source: `https://developers.cloudflare.com/r2/pricing/` (updated May 28, 2026).

## Calculation method

```text
storage GB-month per use = typical stored MB / 1000 * retention days / 30
free uses by storage = floor(10 / storage GB-month per use)
free uses by Class A = floor(1,000,000 / Class A per use)
free uses by Class B = floor(10,000,000 / Class B per use)
```

The table below uses typical sizes. The CSV also includes maximum-size capacities.

| Function | A/use | B/use | Typical MB | Retention days | Conservative free uses | Limiting dimension |
|---|---:|---:|---:|---:|---:|---|
| Upload source archive | 1 | 0 | 10 | 30 | 1000 | storage (typical) |
| Seal workspace from uploaded archive | 3 | 1 | 0.5 | 30 | 20000 | storage (typical) |
| Upload and attach generated layer | 4 | 1 | 5.25 | 30 | 1904 | storage (typical) |
| Submit audit job | 5 | 3 | 0.128 | 30 | 78125 | storage (typical) |
| One heartbeat/status update | 1 | 0 | 0 | 0 | 1000000 | Class A |
| One immutable event batch | 1 | 0 | 0.256 | 30 | 39062 | storage (typical) |
| One log chunk | 1 | 0 | 1.0 | 7 | 42857 | storage (typical) |
| Publish raw artifact bundle | 2 | 0 | 15.0 | 7 | 2857 | storage (typical) |
| Validate and accept evidence bundle | 4 | 1 | 10.0 | 30 | 1000 | storage (typical) |
| Publish report bundle | 3 | 0 | 1.0 | 30 | 10000 | storage (typical) |
| Upload one fork checkpoint | 3 | 1 | 250.0 | 1 | 1200 | storage (typical) |
| Controlled clean-room merge | 4 | 4 | 2.0 | 90 | 1666 | storage (typical) |
| Current Lite uploaded job plus one status/summary/result/report read | 9 | 11 | 11.0 | 30 | 909 | storage (typical) |

## Aggregate usage

| Scenario | Class A | Class B | GB-month | Conservative free-tier scenarios/month | Limiting dimension |
|---|---:|---:|---:|---:|---|
| Conservative 30-minute audit job; new workspace, one layer, one campaign | 75 | 46 | 0.034117 | 293 | storage |
| 30-minute job reusing workspace, layer, and campaign | 64 | 42 | 0.018367 | 544 | storage |
| Conservative audit job under 90-day source/evidence policy | 75 | 46 | 0.10925 | 91 | storage |
| One active fork with eight 250 MB checkpoints retained 24 hours | 27 | 10 | 0.066667 | 150 | storage |
| One active fork with eight 250 MB checkpoints retained seven days | 27 | 10 | 0.466667 | 21 | storage |

## Primary conclusion

Storage retention expires the free allowance far earlier than operation counts in normal use. A conservative new-workspace audit job fits about **293 times per month** under the free-development retention profile. Reusing an existing workspace/layer/campaign raises the estimate to about **544 jobs per month**. Extending source/evidence retention to 90 days lowers the conservative capacity to about **91 jobs per month**.

These numbers assume Audit has the whole R2 allowance. If Lite shares the same Cloudflare account, subtract Lite storage and operations first.

## Maximum-size warning

A maximum-size 250 MiB source upload retained 30 days consumes roughly 0.262 GB-month. Only about **38** such source objects fit inside 10 GB-month. A maximum live Lite job can retain approximately 287 MB and therefore only about **34** maximum-size jobs fit if nothing else consumes R2.

## Operational safeguards

- expose current estimated A/B/storage consumption in the Audit admin page;
- warn at 50%, 75%, and 90% of the configured monthly allowance;
- block new maximum-size uploads before the reserved storage budget is exceeded;
- expire ingress after one day, logs/raw artifacts after seven days, and active checkpoints after one day in free-development mode;
- require an explicit paid-retention acknowledgement for 90/365-day policies.
