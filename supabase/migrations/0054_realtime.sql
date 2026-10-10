-- TR-54 (ADR 0028): live updates. The trip-scoped tables join the `supabase_realtime`
-- publication, so a member's app hears about other members' changes through Realtime
-- `postgres_changes`, which applies each table's RLS: a non-member never receives a row.
--
-- Rule for later v2 tickets: a new trip-scoped table (bucket likes, opt-outs, expense shares,
-- payments…) is added to the publication, with `replica identity full` and the
-- `<table>_touch_trip` trigger below, by the ticket's own migration.

alter publication supabase_realtime add table
  public.trips,
  public.trip_members,
  public.itinerary_items,
  public.bucket_items,
  public.bookings,
  public.expenses,
  public.places;

-- The whole old row in the WAL, so updates carry the previous values too.
alter table public.trips replica identity full;
alter table public.trip_members replica identity full;
alter table public.itinerary_items replica identity full;
alter table public.bucket_items replica identity full;
alter table public.bookings replica identity full;
alter table public.expenses replica identity full;
alter table public.places replica identity full;

-- Realtime can't filter delete events (and on RLS tables sends only the primary key), so a
-- `trip_id=eq.<id>` subscription never hears about a delete. Instead, deleting rows touches their
-- trip's `updated_at`: members subscribed to `trips` with `id=eq.<id>` receive that update (RLS
-- applies) and refetch. Statement-level, so a bulk delete touches each trip once. When the trip
-- itself is being deleted, its row is already gone and nothing is updated.
create function internal.touch_trips_after_delete() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.trips
     set updated_at = now()
   where id in (select distinct trip_id from deleted_rows where trip_id is not null);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['trip_members', 'itinerary_items', 'bucket_items', 'bookings',
                           'expenses', 'places'] loop
    execute format(
      'create trigger %1$s_touch_trip after delete on public.%1$I
         referencing old table as deleted_rows
         for each statement execute function internal.touch_trips_after_delete()', t);
  end loop;
end;
$$;
