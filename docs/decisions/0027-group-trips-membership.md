# 0027 — Group trips: membership, RLS by membership, and attribution

**Context.** v1 trips have one owner. Every table carries `user_id` with RLS
`user_id = auth.uid()`, cross-table foreign keys are composite `(x_id, user_id)` so a row can only
point at the same user's rows, and Storage paths start with the uploader's uid. v2 (PRD → "v2:
Group trips") lets friends join a trip and edit it equally, while passports, visas and boarding
passes stay private unless their owner shares them.

**Decision.**
- New tables: `profiles` (id = `auth.users.id`, `display_name`, optional `venmo`, `cashapp`,
  `zelle`), `trip_members` (`trip_id`, `user_id`, `role` `owner` | `member`, `joined_at`; primary
  key `(trip_id, user_id)`). A trigger adds the creator as `owner` when a trip is inserted; the
  migration backfills one `owner` row per existing trip and one profile per existing user (name
  from the email's local part until they set one).
- `public.is_trip_member(trip uuid)`: `security definer`, `stable`, `set search_path = ''`, true
  when `auth.uid()` has a `trip_members` row. Policies call it, which avoids recursive RLS on
  `trip_members`.
- **Trip-scoped tables** (`trips`, `itinerary_items`, `bucket_items`, `expenses`, `saved_links`,
  `bookings`, and `places` via a new `places.trip_id`) get policies by membership:
  select/insert/update/delete when `is_trip_member(trip_id)`. Exceptions: deleting a trip and
  removing another member are `owner` only; anyone can delete their own `trip_members` row
  (leave).
- **Mine / Shared:** `bookings.visibility` `shared` | `private`. Defaults by type (decision 3):
  `flight` → private; `hotel`, `car`, `ticket`, `reservation` → shared. A private booking is
  visible to its `user_id` only; only its `user_id` can flip it. A private flight's **times and
  route** are still visible to the group through `trip_flights(trip)`, a `security definer`
  function returning airline, flight number, airports, local times and the traveler, never the
  confirmation code, seat or boarding pass.
- **`user_id` now means "added by"** and stays `default auth.uid()`; insert policies still require
  `user_id = auth.uid()` (no spoofing). Attribution that must survive a move (a Bucket List item
  planned by someone else) uses an explicit `added_by uuid` on `itinerary_items`, copied from the
  bucket item; it defaults to `user_id`.
- Composite `(x_id, user_id)` foreign keys are replaced by plain `(x_id)` foreign keys plus a
  `before insert or update` trigger per table that checks the referenced row has the same
  `trip_id` (a member can attach a stop to someone else's place on the same trip, never across
  trips).
- **Documents** (passport, visa) stay account-wide and private. Sharing one with a trip is a
  `document_shares (document_id, trip_id)` row, created only by the document's owner; members of
  that trip can then read it.
- **Storage:** paths keep the uploader's uid prefix. New select policies on `originals` let a
  member read an object when a shared booking (or a shared document's `image_paths`) on one of
  their trips references that path. Writes stay owner-only.
- **Leaving / removal:** a member's own rows stay on the trip (attributed to them) when they leave;
  their private bookings and document shares for that trip are deleted. Deleting an account
  cascades as today.
- **Migration naming for v2:** `supabase/migrations/<ticket number, 4 digits>_<slug>.sql` (e.g.
  `0050_group_trips.sql`), so parallel branches never pick the same number. Every v2 migration is
  additive and works with the app that is live on `main` at that moment, because builders apply
  to the one Supabase project from their branch.
- `npm run db:test-rls` grows a third user: owner, member and non-member, plus private items.

**Consequences.**
- One extra function call per row in RLS; trips are small, and `trip_members` is indexed on
  `(user_id, trip_id)`.
- Code that assumed "my rows" (seedAccount, city_links' author join) is reviewed in TR-50.
- `src/services/database.types.ts` changes with every migration ticket; conflicts are resolved by
  regenerating it (`npm run db:types`), never by hand-merging.
