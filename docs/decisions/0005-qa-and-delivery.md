# 0005 — QA and delivery for a phone app

**Context.** The workflow was built for web apps: Vercel previews, Playwright QA links and
screenshots. Trip is a native app tested in Expo Go, with batched QA on `main`.

**Decision.**
- Each merge to `main` publishes an EAS Update to the `main` channel. Matthew tests there; there are
  no per-PR previews.
- QA links on tickets are Expo Go deep links into named scenarios.
- QA screenshots come from Maestro flows on an EAS iOS simulator build (no paid Apple account
  needed), run on `main`.
- PR CI runs lint, typecheck and Jest only (fast gate); device flows run on `main`.

**Consequences.**
- EAS free-plan build and update allowances are limited: device flows run on `main`, not on every
  PR.
- `/merge-ticket`'s "open every QA link" check becomes "the Maestro flow for each scenario passed
  and its screenshot is attached".
- Real-phone QA by Matthew stays the QA of record.
