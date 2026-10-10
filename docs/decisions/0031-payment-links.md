# 0031 — Settle-up payment links

**Context.** Decision 6 (PRD v2): Venmo and Cash App get prefilled payment links; Zelle has no
public link format, so we show the person's Zelle email or phone. Trip never moves money.

**Decision.**
- Handles live on `profiles` (`venmo`, `cashapp`, `zelle`), optional, set in Settings → Payment
  info, readable by co-members only.
- Links are plain HTTPS universal links opened with `Linking.openURL` (no new dependency, no
  `LSApplicationQueriesSchemes` needed): Venmo
  `https://venmo.com/<username>?txn=pay&amount=<12.34>&note=<Trip: Las Vegas>`, Cash App
  `https://cash.app/$<cashtag>/<12.34>`. If the app is installed iOS opens it, otherwise the
  website. Amounts are only prefilled for USD balances; other currencies open the profile without
  an amount and show the amount in Trip.
- Zelle: a row with the email/phone and a Copy button.
- "Mark as paid" records a `payments` row (ADR 0030); either person can undo it.
- Builders verify the link formats against each service's current public docs when building and
  record what they found in the ticket.

**Consequences.** Prefill depends on Venmo / Cash App keeping these URL formats; the fallback is
the profile page, which still works.
