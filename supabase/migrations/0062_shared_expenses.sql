-- TR-62 (ADR 0030): shared expenses. The v1 budget becomes the group's expenses: each one records
-- who paid, who it's split with (`expense_shares`, one row per participant, the source of truth),
-- the activity it belongs to, and the rate to the trip currency captured when it was saved.
-- Additive: the app on main keeps working (`paid_by` defaults to the adder, and an expense with no
-- shares reads as one share for its payer).

-- ── Trip currency ─────────────────────────────────────────────────────────────────────────────
-- What balances are shown in; any member can change it.
alter table public.trips add column currency char(3);
update public.trips set currency = coalesce(budget_currency, 'USD');
alter table public.trips alter column currency set default 'USD';
alter table public.trips alter column currency set not null;

-- ── Expenses ──────────────────────────────────────────────────────────────────────────────────
alter table public.expenses
  add column paid_by uuid references public.profiles (id) on delete set null,
  add column itinerary_item_id uuid references public.itinerary_items (id) on delete set null,
  add column rate_to_trip numeric check (rate_to_trip > 0),
  add column trip_currency char(3);
update public.expenses set paid_by = user_id;
create index expenses_item_idx on public.expenses (itinerary_item_id);

-- `paid_by` defaults to whoever adds it and must be on the trip when set (so an expense stays
-- editable after its payer leaves); the activity must be on the same trip.
create function internal.check_expense() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.paid_by := coalesce(new.paid_by, new.user_id, (select auth.uid()));
  if tg_op = 'INSERT' or new.paid_by is distinct from old.paid_by then
    if not exists (
      select 1 from public.trip_members m where m.trip_id = new.trip_id and m.user_id = new.paid_by
    ) then
      raise exception 'paid_by % is not on trip %', new.paid_by, new.trip_id
        using errcode = '23503';
    end if;
  end if;
  if new.itinerary_item_id is not null and not exists (
    select 1 from public.itinerary_items i
    where i.id = new.itinerary_item_id and i.trip_id = new.trip_id
  ) then
    raise exception 'itinerary item % is not on trip %', new.itinerary_item_id, new.trip_id
      using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger expenses_check_expense before insert or update on public.expenses
  for each row execute function internal.check_expense();

-- ── Shares ────────────────────────────────────────────────────────────────────────────────────
-- `trip_id` is copied from the expense (by trigger) so RLS and Realtime can filter on it.
create table public.expense_shares (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  share_minor bigint not null check (share_minor >= 0),
  created_at timestamptz not null default now(),
  primary key (expense_id, user_id)
);
create index expense_shares_trip_idx on public.expense_shares (trip_id);

create function internal.expense_share_trip() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select e.trip_id into new.trip_id from public.expenses e where e.id = new.expense_id;
  if new.trip_id is null then
    raise exception 'expense % not found', new.expense_id using errcode = '23503';
  end if;
  if tg_op = 'INSERT' or new.user_id is distinct from old.user_id then
    if not exists (
      select 1 from public.trip_members m where m.trip_id = new.trip_id and m.user_id = new.user_id
    ) then
      raise exception 'user % is not on trip %', new.user_id, new.trip_id using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;
create trigger expense_shares_trip before insert or update on public.expense_shares
  for each row execute function internal.expense_share_trip();

-- An expense moved to another trip takes its shares along.
create function internal.expense_moved() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.expense_shares set trip_id = new.trip_id where expense_id = new.id;
  return null;
end;
$$;
create trigger expenses_moved after update of trip_id on public.expenses
  for each row when (old.trip_id is distinct from new.trip_id)
  execute function internal.expense_moved();

alter table public.expense_shares enable row level security;
create policy "expense_shares: member select" on public.expense_shares for select
  to authenticated using (public.is_trip_member(trip_id));
create policy "expense_shares: member insert" on public.expense_shares for insert
  to authenticated with check (public.is_trip_member(trip_id));
create policy "expense_shares: member update" on public.expense_shares for update
  to authenticated using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));
create policy "expense_shares: member delete" on public.expense_shares for delete
  to authenticated using (public.is_trip_member(trip_id));

-- v1 expenses: one share for the person who added it.
insert into public.expense_shares (expense_id, user_id, trip_id, share_minor)
select e.id, e.user_id, e.trip_id, e.amount_minor
from public.expenses e
where exists (select 1 from public.profiles p where p.id = e.user_id)
on conflict do nothing;

-- Replaces an expense's shares in one transaction; they must add up to its amount. Runs as the
-- caller, so RLS applies: only the trip's members can call it with effect.
create function public.set_expense_shares(expense uuid, shares jsonb) returns void
language plpgsql
set search_path = ''
as $$
declare
  amount bigint;
begin
  select e.amount_minor into amount from public.expenses e where e.id = expense;
  if amount is null then
    raise exception 'expense % not found', expense using errcode = '23503';
  end if;
  delete from public.expense_shares where expense_id = expense;
  insert into public.expense_shares (expense_id, user_id, share_minor)
  select expense, (s ->> 'user_id')::uuid, (s ->> 'share_minor')::bigint
  from jsonb_array_elements(shares) s;
  if (select coalesce(sum(share_minor), 0) from public.expense_shares where expense_id = expense)
     <> amount then
    raise exception 'shares must add up to the amount' using errcode = '23514';
  end if;
end;
$$;
revoke all on function public.set_expense_shares(uuid, jsonb) from public, anon;
grant execute on function public.set_expense_shares(uuid, jsonb) to authenticated;

-- ── Realtime (rule from 0054_realtime.sql) ────────────────────────────────────────────────────
alter publication supabase_realtime add table public.expense_shares;
alter table public.expense_shares replica identity full;
create trigger expense_shares_touch_trip after delete on public.expense_shares
  referencing old table as deleted_rows
  for each statement execute function internal.touch_trips_after_delete();
