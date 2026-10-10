-- TR-50 code review fixes on top of 0050_group_trips.sql (applied, so not edited):
-- 1. A member reads a shared file in `originals` only when it sits in the folder of the booking's
--    or document's owner: a row can't point at someone else's file to unlock it.
-- 2. Only a row's owner moves it to another trip; members edit it where it is.
-- 3. A place joins a trip only when the person writing created it (no claiming someone else's
--    off-trip place through their row), and flights' airport places (`from` / `to`) count too.
-- 4. A private booking's places aren't claimed onto the trip until the booking is shared.
-- 5. Linking an item or expense to a booking needs a booking the writer can see.
-- 6. Places are only re-checked (and locked) when a reference actually changed.

-- Every place a booking's JSON names: hotel and ticket `placeId`, car pickup and return, and a
-- flight's departure and arrival airports.
create function internal.booking_place_ids(data jsonb) returns uuid[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(lower(v)::uuid), '{}')
  from unnest(array[
    data ->> 'placeId', data ->> 'pickupPlaceId', data ->> 'returnPlaceId',
    data -> 'from' ->> 'placeId', data -> 'to' ->> 'placeId'
  ]) v
  where v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

-- `row_owner` only stands in when nobody is signed in (service role, migrations).
create or replace function internal.claim_place(place uuid, trip uuid, row_owner uuid,
                                                strict boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
begin
  if place is null then
    return;
  end if;
  select id, trip_id, user_id into p from public.places where id = place for update;
  if not found or p.trip_id is not distinct from trip then
    return;
  end if;
  if p.trip_id is null and p.user_id = coalesce((select auth.uid()), row_owner) then
    update public.places set trip_id = trip where id = place;
  elsif strict then
    raise exception 'place % is not on trip %', place, trip using errcode = '23503';
  end if;
end;
$$;

create or replace function internal.check_same_trip() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  place uuid;
  me uuid := coalesce((select auth.uid()), new.user_id);
  moved boolean := tg_op = 'UPDATE' and new.trip_id is distinct from old.trip_id;
begin
  -- Nested ifs: plpgsql can't read a column the table doesn't have, even behind an `and`.
  if tg_table_name in ('itinerary_items', 'bucket_items') then
    if tg_op = 'INSERT' or moved or new.place_id is distinct from old.place_id then
      perform internal.claim_place(new.place_id, new.trip_id, new.user_id, true);
    end if;
  end if;
  if tg_table_name in ('itinerary_items', 'expenses') then
    if new.booking_id is not null
       and (tg_op = 'INSERT' or moved or new.booking_id is distinct from old.booking_id)
       and not exists (
         select 1 from public.bookings b
         where b.id = new.booking_id and b.trip_id = new.trip_id
           and (b.visibility = 'shared' or b.user_id = me)
       ) then
      raise exception 'booking % is not on trip %', new.booking_id, new.trip_id
        using errcode = '23503';
    end if;
  end if;
  if tg_table_name = 'itinerary_items' then
    new.added_by := coalesce(new.added_by, new.user_id);
    -- Checked when set, so an item stays editable after its adder leaves the trip.
    if tg_op = 'INSERT' or moved or new.added_by is distinct from old.added_by then
      if new.added_by <> new.user_id and not exists (
        select 1 from public.trip_members m
        where m.trip_id = new.trip_id and m.user_id = new.added_by
      ) then
        raise exception 'added_by % is not on trip %', new.added_by, new.trip_id
          using errcode = '23503';
      end if;
    end if;
  end if;
  if tg_table_name = 'bucket_items' then
    if new.saved_link_id is not null
       and (tg_op = 'INSERT' or moved or new.saved_link_id is distinct from old.saved_link_id)
       and not exists (
         select 1 from public.saved_links l
         where l.id = new.saved_link_id and l.trip_id = new.trip_id
       ) then
      raise exception 'saved link % is not on trip %', new.saved_link_id, new.trip_id
        using errcode = '23503';
    end if;
  end if;
  if tg_table_name = 'saved_links' then
    if new.trip_id is not null
       and (tg_op = 'INSERT' or moved or new.place_ids is distinct from old.place_ids) then
      foreach place in array new.place_ids loop
        perform internal.claim_place(place, new.trip_id, new.user_id, false);
      end loop;
    end if;
  end if;
  if tg_table_name = 'bookings' then
    if new.visibility = 'shared'
       and (tg_op = 'INSERT' or moved or new.data is distinct from old.data
            or new.visibility is distinct from old.visibility) then
      foreach place in array internal.booking_place_ids(new.data) loop
        perform internal.claim_place(place, new.trip_id, new.user_id, false);
      end loop;
    end if;
  end if;
  return new;
end;
$$;

-- check_same_trip reads `visibility`, so on bookings it must run after the visibility default
-- (triggers fire by name: bookings_same_trip < bookings_visibility).
drop trigger bookings_same_trip on public.bookings;
create trigger bookings_z_same_trip before insert or update on public.bookings
  for each row execute function internal.check_same_trip();

-- Only a row's owner moves it to another trip.
create function internal.keep_trip_id() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.trip_id is distinct from old.trip_id
     and old.trip_id is not null
     and (select auth.uid()) is not null
     and (select auth.uid()) <> old.user_id then
    raise exception 'only the row''s owner can move it to another trip' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'places', 'itinerary_items', 'bucket_items', 'expenses', 'saved_links', 'bookings'
  ] loop
    execute format(
      'create trigger %1$s_keep_trip_id before update on public.%1$I
         for each row execute function internal.keep_trip_id()', t);
  end loop;
end;
$$;

-- Shared files must be in the owner's own folder.
create or replace function public.can_read_original(path text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
    join public.trip_members m on m.trip_id = b.trip_id and m.user_id = (select auth.uid())
    where b.original_path = path and b.visibility = 'shared'
      and split_part(path, '/', 1) = b.user_id::text
  ) or exists (
    select 1 from public.documents d
    join public.document_shares s on s.document_id = d.id
    join public.trip_members m on m.trip_id = s.trip_id and m.user_id = (select auth.uid())
    where (path = any (d.image_paths) or d.image_path = path)
      and split_part(path, '/', 1) = d.user_id::text
  );
$$;

-- Shared bookings' airport places (missed by 0050's backfill) join their trip.
update public.places p
set trip_id = b.trip_id
from public.bookings b
where b.visibility = 'shared'
  and p.trip_id is null
  and p.user_id = b.user_id
  and p.id = any (internal.booking_place_ids(b.data));
