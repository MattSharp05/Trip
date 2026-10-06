# 0006 — Smart Add is a deterministic planner, not an AI call

**Context.** Smart Add must place a saved item in the best day and time automatically (PRD), never
overlap a fixed-time item, and keep travel low. It must be predictable and cost nothing.

**Decision.** A pure TypeScript planner in `src/core/smartAdd`. For each trip day it tries every gap
between items and computes the earliest start after the previous item plus travel. It keeps only
slots inside the item's window (opening hours or event time) that end before the next item minus
travel. It picks the slot that adds the least travel distance (tie-break: emptier day, then
earlier). Fixed-time events go on their own date and time. "Plan my bucket list" runs it greedily,
largest constraint first. Travel is estimated from distance (see the TDD risks).

**Consequences.**
- Fully unit-testable with fixtures; same result every time.
- No routing or AI costs. Quality depends on the travel estimate, which can be upgraded later
  without changing the planner.
