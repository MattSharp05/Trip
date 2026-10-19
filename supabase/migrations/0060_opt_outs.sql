-- TR-60: shared itinerary opt-outs. Everyone on a trip is going to every stop unless they opt out
-- of it: one row per (stop, traveller) who is out. Going = the trip's members minus these rows.
-- Additive: the app on main ignores the table.

-- `trip_id` is copied from the stop (by trigger) so RLS and Realtime can filter on it.
create table public.item_opt_outs (
  itinerary_item_id uuid not null references public.itinerary_items (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (itinerary_item_id, user_id)
);
create index item_opt_outs_trip_idx on public.item_opt_outs (trip_id);

create function internal.item_opt_out_trip() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select i.trip_id into new.trip_id from public.itinerary_items i
  where i.id = new.itinerary_item_id;
  if new.trip_id is null then
    raise exception 'itinerary item % not found', new.itinerary_item_id using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger item_opt_outs_trip before insert or update on public.item_opt_outs
  for each row execute function internal.item_opt_out_trip();

-- A stop moved to another trip takes its opt-outs along.
create function internal.itinerary_item_moved() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.item_opt_outs set trip_id = new.trip_id where itinerary_item_id = new.id;
  return null;
end;
$$;
create trigger itinerary_items_moved_opt_outs after update of trip_id on public.itinerary_items
  for each row when (old.trip_id is distinct from new.trip_id)
  execute function internal.itinerary_item_moved();

-- The trip's members read who is out; each traveller opts only themselves out and back in.
alter table public.item_opt_outs enable row level security;
create policy "item_opt_outs: member select" on public.item_opt_outs for select
  to authenticated using (public.is_trip_member(trip_id));
create policy "item_opt_outs: own insert" on public.item_opt_outs for insert
  to authenticated with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id));
create policy "item_opt_outs: own delete" on public.item_opt_outs for delete
  to authenticated using (user_id = (select auth.uid()));

-- ── Realtime (rule from 0054_realtime.sql) ────────────────────────────────────────────────────
alter publication supabase_realtime add table public.item_opt_outs;
alter table public.item_opt_outs replica identity full;
create trigger item_opt_outs_touch_trip after delete on public.item_opt_outs
  referencing old table as deleted_rows
  for each statement execute function internal.touch_trips_after_delete();
