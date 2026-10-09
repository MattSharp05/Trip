# 0030 — Shared expenses, splits, currency and balances

**Context.** PRD v2 replaces the v1 budget (TR-21) with shared expenses: any member records who
paid, splits with everyone or selected travelers, each expense keeps the currency it was paid in,
and balances show in one trip currency at that day's rate, with debts between two people offset
("You owe Blake $4"). Matthew's decisions 4, 5 and 7.

**Decision.**
- `expenses` gains `paid_by uuid` (a member; defaults to `user_id`), `itinerary_item_id` (the
  activity it belongs to, optional), `rate_to_trip numeric` and `trip_currency char(3)` captured
  at save. `expense_shares (expense_id, user_id, share_minor)` holds one row per participant.
  `trips.currency` (defaults to the creator's home currency; anyone can change it, which recomputes
  balances from each expense's original amount using rates for each expense date).
- **Equal split** in v2 (custom amounts later): `share = floor(amount / n)`, and the remainder's
  minor units go one each to participants ordered by user id, so every device computes the same
  shares. Stored shares are the source of truth.
- **Rate:** Frankfurter's daily ECB rate for the expense's date
  (`https://api.frankfurter.dev/v1/<date>?base=<cur>&symbols=<trip cur>`, free, no key, already
  used in v1 and reachable from the cloud). Weekends and holidays return the previous working day.
  The rate is stored on the expense so all members see the same numbers. Same currency → 1.
- **Balances** (pure, `src/core/settle.ts`): for each expense, every participant other than the
  payer owes the payer `share × rate`; recorded payments (`payments (trip_id, from_user, to_user,
  amount_minor, currency, method, created_at)`) reduce the debt. Debts are **offset per pair**
  (`net = a→b − b→a`), matching Matthew's example; no group-wide simplification. Amounts are integer
  minor units in the trip currency, rounded half-up once per expense share.
- **Opt-out → split:** a new expense linked to an activity defaults its participants to the members
  not opted out of that activity; changing an opt-out later updates that activity's expenses'
  shares (decision 4). Bookings imported with a price create an expense paid by the importer and
  split with everyone (shared booking) or only the importer (private booking).
- v1 budget data migrates in place: existing expenses get `paid_by = user_id` and one share for
  the owner. The trip budget total (`budget_minor`) stays as an optional "group budget" line.

**Consequences.**
- No server-side money logic; the algorithm is unit-tested in `core/` with Matthew's examples.
- Old expenses keep the rate captured when they're first opened in v2 (no history to recover).
