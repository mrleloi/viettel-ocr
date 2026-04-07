# Drift Signals

> Architecture violations detected by drift-check script or manual review.
> Updated after each `/drift-check` run.

## Last Check
- **Date**: Not yet run (pre-implementation)
- **Result**: N/A

## Active Signals

| # | Signal | Severity | Location | Status |
|---|--------|----------|----------|--------|
| — | No signals yet | — | — | — |

## Signal Definitions

| Code | Signal | Severity | Meaning |
|------|--------|----------|---------|
| FD1 | @nestjs in domain/ | 🔴 CRITICAL | Framework leaked into domain layer |
| FD2 | :any in domain/ | 🔴 CRITICAL | Type safety violation in business logic |
| FD3 | infrastructure import in domain/ | 🔴 CRITICAL | Layer boundary violation |
| FD4 | console.log in production | 🟡 HIGH | Debug code in production path |
| FD5 | Controller >100 LOC | 🟡 HIGH | Business logic likely in controller |
| FD6 | Repo interface without impl | 🟡 HIGH | Domain contract not fulfilled |
| FD7 | Domain file without test | 🟠 MEDIUM | Missing test coverage |
| FD8 | Use case without integration test | 🟠 MEDIUM | Missing integration coverage |
| FD9 | Progress tracker out of sync | 🟠 MEDIUM | Dashboard doesn't match reality |
| FD10 | TODO without context | 🔵 LOW | Deferred work without explanation |

## Resolution Log

| Date | Signal | Resolution |
|------|--------|-----------|
| — | — | — |
