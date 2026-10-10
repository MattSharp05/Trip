-- TR-54 code review fix on top of 0054_realtime.sql (applied, so not edited): Realtime checks the
-- `trip_id=eq.<id>` filter and RLS against the new row only, so two updates never reached the
-- members who should hear them:
-- 1. a row moved to another trip (its owner may move it): the old trip's members;
-- 2. a booking made private: every other member (they can't read the new row).
-- Both now touch the old trip's `updated_at`, like a delete does.
create function internal.touch_trips_after_move() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.trips
     set updated_at = now()
   where id in (select o.trip_id
                  from old_rows o
                  join new_rows n on n.id = o.id
                 where o.trip_id is distinct from n.trip_id);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['itinerary_items', 'bucket_items', 'expenses', 'places'] loop
    execute format(
      'create trigger %1$s_touch_trip_on_move after update on public.%1$I
         referencing old table as old_rows new table as new_rows
         for each statement execute function internal.touch_trips_after_move()', t);
  end loop;
end;
$$;

create function internal.touch_trips_after_booking_hidden() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.trips
     set updated_at = now()
   where id in (select o.trip_id
                  from old_rows o
                  join new_rows n on n.id = o.id
                 where o.trip_id is distinct from n.trip_id
                    or (o.visibility = 'shared' and n.visibility = 'private'));
  return null;
end;
$$;

create trigger bookings_touch_trip_on_move after update on public.bookings
  referencing old table as old_rows new table as new_rows
  for each statement execute function internal.touch_trips_after_booking_hidden();
