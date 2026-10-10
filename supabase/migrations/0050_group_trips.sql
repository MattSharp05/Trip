-- TR-50 (ADR 0027): group trips. Trips get members; every trip-scoped table moves from
-- "owner only" to "members of the trip". Additive: the v1 app on main keeps working, because every
-- existing trip gets its creator as `owner`, `user_id` still defaults to auth.uid() and insert
-- policies still require it, and places the v1 app creates without a trip join the trip of the
-- first item, bucket item, booking or saved link that points at them.

-- ── Profiles ──────────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (btrim(display_name) <> ''),
  venmo text,
  cashapp text,
  zelle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Until they set one, a traveller's name is their email's local part.
create function public.create_profile() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(btrim(split_part(new.email, '@', 1)), ''), 'Traveller'))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.create_profile();

insert into public.profiles (id, display_name)
select u.id, coalesce(nullif(btrim(split_part(u.email, '@', 1)), ''), 'Traveller')
from auth.users u
on conflict (id) do nothing;

-- ── Membership ────────────────────────────────────────────────────────────────────────────────
create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index trip_members_user_trip_idx on public.trip_members (user_id, trip_id);
-- One owner per trip.
create unique index trip_members_one_owner_idx on public.trip_members (trip_id)
  where role = 'owner';

insert into public.trip_members (trip_id, user_id, role, joined_at)
select t.id, t.user_id, 'owner', t.created_at from public.trips t;

create function public.add_trip_owner() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id, role) values (new.id, new.user_id, 'owner');
  return new;
end;
$$;
create trigger trips_add_owner after insert on public.trips
  for each row execute function public.add_trip_owner();

-- Policies call these instead of reading trip_members themselves (no recursive RLS).
create function public.is_trip_member(trip uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m where m.trip_id = trip and m.user_id = (select auth.uid())
  );
$$;

create function public.is_trip_owner(trip uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = trip and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

-- True when the signed-in user and `other` are on at least one trip together.
create function public.is_co_member(other uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members me
    join public.trip_members them on them.trip_id = me.trip_id
    where me.user_id = (select auth.uid()) and them.user_id = other
  );
$$;

-- ── Columns ───────────────────────────────────────────────────────────────────────────────────
-- A place belongs to one trip, so members see the places their trip's rows point at. Places with
-- no trip (not used by any trip yet) stay their creator's alone.
alter table public.places add column trip_id uuid references public.trips (id) on delete cascade;
create index places_trip_idx on public.places (trip_id);

-- Who put an itinerary item on the plan; copied from the bucket item when one is planned.
alter table public.itinerary_items
  add column added_by uuid references public.profiles (id) on delete set null;
update public.itinerary_items set added_by = user_id;

-- Mine / Shared: flights default to private, everything else to shared.
alter table public.bookings add column visibility text;
update public.bookings
set visibility = case when type = 'flight' then 'private' else 'shared' end;
alter table public.bookings alter column visibility set not null;
alter table public.bookings
  add constraint bookings_visibility_check check (visibility in ('shared', 'private'));

-- A passport or visa shared with one trip.
create table public.document_shares (
  document_id uuid not null references public.documents (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, trip_id)
);
create index document_shares_trip_idx on public.document_shares (trip_id);

-- ── Places: backfill trip_id ──────────────────────────────────────────────────────────────────
-- Every trip that references a place, through a column, a saved link's place_ids or a booking's
-- JSON (hotel and ticket `placeId`, car `pickupPlaceId` / `returnPlaceId`).
create temporary table place_refs on commit drop as
select distinct place_id, trip_id from (
  select place_id, trip_id from public.itinerary_items where place_id is not null
  union all
  select place_id, trip_id from public.bucket_items where place_id is not null
  union all
  select unnest(place_ids), trip_id from public.saved_links where trip_id is not null
  union all
  select (b.data ->> k)::uuid, b.trip_id
  from public.bookings b, unnest(array['placeId', 'pickupPlaceId', 'returnPlaceId']) k
  where b.data ->> k ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
) r
where exists (select 1 from public.places p where p.id = r.place_id);

-- A place used by several trips keeps the first (by trip id) and is copied for each other one.
do $$
declare
  ref record;
  copy_id uuid;
begin
  for ref in
    select r.place_id, r.trip_id
    from place_refs r
    where r.trip_id <> (select min(r2.trip_id::text)::uuid from place_refs r2
                        where r2.place_id = r.place_id)
  loop
    copy_id := gen_random_uuid();
    insert into public.places (id, user_id, trip_id, name, address, lat, lng, kind, photo_url,
                               source_url, created_at)
    select copy_id, p.user_id, ref.trip_id, p.name, p.address, p.lat, p.lng, p.kind, p.photo_url,
           p.source_url, p.created_at
    from public.places p where p.id = ref.place_id;
    update public.itinerary_items set place_id = copy_id
      where place_id = ref.place_id and trip_id = ref.trip_id;
    update public.bucket_items set place_id = copy_id
      where place_id = ref.place_id and trip_id = ref.trip_id;
    update public.saved_links set place_ids = array_replace(place_ids, ref.place_id, copy_id)
      where trip_id = ref.trip_id and ref.place_id = any (place_ids);
    update public.bookings
      set data = replace(data::text, ref.place_id::text, copy_id::text)::jsonb
      where trip_id = ref.trip_id and data::text like '%' || ref.place_id::text || '%';
  end loop;
end;
$$;

update public.places p
set trip_id = (select min(r.trip_id::text)::uuid from place_refs r where r.place_id = p.id)
where exists (select 1 from place_refs r where r.place_id = p.id);

-- ── Plain foreign keys instead of composite (x_id, user_id) ones ──────────────────────────────
-- Members point at each other's rows; the same-trip triggers below keep them on one trip.
do $$
declare
  fk record;
begin
  for fk in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    where c.contype = 'f'
      and c.conrelid in ('public.bookings'::regclass, 'public.itinerary_items'::regclass,
                         'public.bucket_items'::regclass, 'public.expenses'::regclass,
                         'public.saved_links'::regclass)
      and c.confrelid in ('public.trips'::regclass, 'public.places'::regclass,
                          'public.bookings'::regclass, 'public.saved_links'::regclass)
      and cardinality(c.conkey) = 2
  loop
    execute format('alter table %s drop constraint %I', fk.tbl, fk.conname);
  end loop;
end;
$$;

alter table public.bookings add constraint bookings_trip_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;
alter table public.itinerary_items add constraint itinerary_items_trip_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;
alter table public.itinerary_items add constraint itinerary_items_place_fkey
  foreign key (place_id) references public.places (id) on delete set null;
alter table public.itinerary_items add constraint itinerary_items_booking_fkey
  foreign key (booking_id) references public.bookings (id) on delete set null;
alter table public.bucket_items add constraint bucket_items_trip_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;
alter table public.bucket_items add constraint bucket_items_place_fkey
  foreign key (place_id) references public.places (id) on delete set null;
alter table public.bucket_items add constraint bucket_items_saved_link_fkey
  foreign key (saved_link_id) references public.saved_links (id) on delete set null;
alter table public.expenses add constraint expenses_trip_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;
alter table public.expenses add constraint expenses_booking_fkey
  foreign key (booking_id) references public.bookings (id) on delete cascade;
alter table public.saved_links add constraint saved_links_trip_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;

-- ── Same-trip triggers ────────────────────────────────────────────────────────────────────────
create schema if not exists internal;
revoke all on schema internal from public, anon, authenticated;

-- A place on `trip` is fine. A place with no trip yet joins `trip` when its creator is the one
-- writing (or owns the referencing row): that is how the v1 app's places become trip places.
-- `strict` raises for a place on another trip; JSON and array references only claim.
create function internal.claim_place(place uuid, trip uuid, row_owner uuid, strict boolean)
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
  if p.trip_id is null and p.user_id in ((select auth.uid()), row_owner) then
    update public.places set trip_id = trip where id = place;
  elsif strict then
    raise exception 'place % is not on trip %', place, trip using errcode = '23503';
  end if;
end;
$$;

create function internal.check_same_trip() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  place uuid;
begin
  -- Nested ifs: plpgsql can't read a column the table doesn't have, even behind an `and`.
  if tg_table_name in ('itinerary_items', 'bucket_items') then
    perform internal.claim_place(new.place_id, new.trip_id, new.user_id, true);
  end if;
  if tg_table_name in ('itinerary_items', 'expenses') then
    if new.booking_id is not null and not exists (
      select 1 from public.bookings b where b.id = new.booking_id and b.trip_id = new.trip_id
    ) then
      raise exception 'booking % is not on trip %', new.booking_id, new.trip_id
        using errcode = '23503';
    end if;
  end if;
  if tg_table_name = 'itinerary_items' then
    new.added_by := coalesce(new.added_by, new.user_id);
    -- Checked when set, so an item stays editable after its adder leaves the trip.
    if tg_op = 'INSERT' or new.added_by is distinct from old.added_by then
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
    if new.saved_link_id is not null and not exists (
      select 1 from public.saved_links l where l.id = new.saved_link_id and l.trip_id = new.trip_id
    ) then
      raise exception 'saved link % is not on trip %', new.saved_link_id, new.trip_id
        using errcode = '23503';
    end if;
  end if;
  if tg_table_name = 'saved_links' then
    if new.trip_id is not null then
      foreach place in array new.place_ids loop
        perform internal.claim_place(place, new.trip_id, new.user_id, false);
      end loop;
    end if;
  end if;
  if tg_table_name = 'bookings' then
    foreach k in array array['placeId', 'pickupPlaceId', 'returnPlaceId'] loop
      if new.data ->> k ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        perform internal.claim_place((new.data ->> k)::uuid, new.trip_id, new.user_id, false);
      end if;
    end loop;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['itinerary_items', 'bucket_items', 'expenses', 'saved_links', 'bookings']
  loop
    execute format(
      'create trigger %1$s_same_trip before insert or update on public.%1$I
         for each row execute function internal.check_same_trip()', t);
  end loop;
end;
$$;

-- `user_id` means "added by" and never changes, whoever edits the row.
create function internal.keep_user_id() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := old.user_id;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'trips', 'places', 'itinerary_items', 'bucket_items', 'expenses', 'saved_links', 'bookings'
  ] loop
    execute format(
      'create trigger %1$s_keep_user_id before update on public.%1$I
         for each row execute function internal.keep_user_id()', t);
  end loop;
end;
$$;

-- Bookings: visibility defaults by type, and only the booking's owner may change it.
create function internal.booking_visibility() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.visibility := coalesce(new.visibility,
                               case when new.type = 'flight' then 'private' else 'shared' end);
  elsif new.visibility is distinct from old.visibility
        and (select auth.uid()) is not null
        and (select auth.uid()) <> old.user_id then
    raise exception 'only the booking''s owner can change its visibility'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger bookings_visibility before insert or update on public.bookings
  for each row execute function internal.booking_visibility();

-- Leaving a trip takes your private bookings and document shares off it; your other rows stay.
create function internal.member_left() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.bookings
  where trip_id = old.trip_id and user_id = old.user_id and visibility = 'private';
  delete from public.document_shares s
  using public.documents d
  where s.document_id = d.id and s.trip_id = old.trip_id and d.user_id = old.user_id;
  return old;
end;
$$;
create trigger trip_members_left after delete on public.trip_members
  for each row execute function internal.member_left();

-- ── Row-level security ────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.trip_members enable row level security;
alter table public.document_shares enable row level security;

create policy "profiles: self or co-member select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_co_member(id));
create policy "profiles: self update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Rows are added by the owner trigger (and the invite RPC, later). Leave: delete your own row.
-- Remove: the owner deletes another row. The owner row is never deleted (only with the trip).
create policy "trip_members: member select" on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "trip_members: leave or remove" on public.trip_members for delete to authenticated
  using (role <> 'owner'
         and (user_id = (select auth.uid()) or public.is_trip_owner(trip_id)));

do $$
declare
  t text;
begin
  foreach t in array array[
    'trips', 'itinerary_items', 'bucket_items', 'expenses', 'saved_links', 'bookings', 'places'
  ] loop
    execute format('drop policy "%1$s: owner select" on public.%1$I', t);
    execute format('drop policy "%1$s: owner insert" on public.%1$I', t);
    execute format('drop policy "%1$s: owner update" on public.%1$I', t);
    execute format('drop policy "%1$s: owner delete" on public.%1$I', t);
  end loop;
end;
$$;

-- Trips: the creator sees the row they just inserted (the owner row is added after it).
create policy "trips: member select" on public.trips for select to authenticated
  using (user_id = (select auth.uid()) or public.is_trip_member(id));
create policy "trips: insert own" on public.trips for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "trips: member update" on public.trips for update to authenticated
  using (public.is_trip_member(id)) with check (public.is_trip_member(id));
create policy "trips: owner delete" on public.trips for delete to authenticated
  using (public.is_trip_owner(id));

do $$
declare
  t text;
begin
  foreach t in array array['itinerary_items', 'bucket_items', 'expenses'] loop
    execute format(
      'create policy "%1$s: member select" on public.%1$I for select to authenticated
         using (public.is_trip_member(trip_id))', t);
    execute format(
      'create policy "%1$s: member insert" on public.%1$I for insert to authenticated
         with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id))', t);
    execute format(
      'create policy "%1$s: member update" on public.%1$I for update to authenticated
         using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id))', t);
    execute format(
      'create policy "%1$s: member delete" on public.%1$I for delete to authenticated
         using (public.is_trip_member(trip_id))', t);
  end loop;

  -- Places and saved links without a trip stay their creator's.
  foreach t in array array['places', 'saved_links'] loop
    execute format(
      'create policy "%1$s: member select" on public.%1$I for select to authenticated
         using (case when trip_id is null then user_id = (select auth.uid())
                     else public.is_trip_member(trip_id) end)', t);
    execute format(
      'create policy "%1$s: member insert" on public.%1$I for insert to authenticated
         with check (user_id = (select auth.uid())
                     and (trip_id is null or public.is_trip_member(trip_id)))', t);
    execute format(
      'create policy "%1$s: member update" on public.%1$I for update to authenticated
         using (case when trip_id is null then user_id = (select auth.uid())
                     else public.is_trip_member(trip_id) end)
         with check (case when trip_id is null then user_id = (select auth.uid())
                          else public.is_trip_member(trip_id) end)', t);
    execute format(
      'create policy "%1$s: member delete" on public.%1$I for delete to authenticated
         using (case when trip_id is null then user_id = (select auth.uid())
                     else public.is_trip_member(trip_id) end)', t);
  end loop;
end;
$$;

-- Bookings: shared ones belong to the group, private ones to whoever added them.
create policy "bookings: member select" on public.bookings for select to authenticated
  using (public.is_trip_member(trip_id)
         and (visibility = 'shared' or user_id = (select auth.uid())));
create policy "bookings: member insert" on public.bookings for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id));
create policy "bookings: member update" on public.bookings for update to authenticated
  using (public.is_trip_member(trip_id)
         and (visibility = 'shared' or user_id = (select auth.uid())))
  with check (public.is_trip_member(trip_id)
              and (visibility = 'shared' or user_id = (select auth.uid())));
create policy "bookings: member delete" on public.bookings for delete to authenticated
  using (public.is_trip_member(trip_id)
         and (visibility = 'shared' or user_id = (select auth.uid())));

-- Documents stay owner-only to write; sharing one with a trip lets that trip's members read it.
create function public.owns_document(document uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.documents d where d.id = document and d.user_id = (select auth.uid())
  );
$$;

create function public.is_document_shared_with_me(document uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.document_shares s
    join public.trip_members m on m.trip_id = s.trip_id
    where s.document_id = document and m.user_id = (select auth.uid())
  );
$$;

create policy "documents: shared select" on public.documents for select to authenticated
  using (public.is_document_shared_with_me(id));

create policy "document_shares: owner or member select" on public.document_shares
  for select to authenticated
  using (public.owns_document(document_id) or public.is_trip_member(trip_id));
create policy "document_shares: owner insert" on public.document_shares
  for insert to authenticated
  with check (public.owns_document(document_id) and public.is_trip_member(trip_id));
create policy "document_shares: owner delete" on public.document_shares
  for delete to authenticated
  using (public.owns_document(document_id));

-- Storage: members read a file in `originals` that a shared booking or a shared document on one
-- of their trips points at. Writes stay with the uploader (0001).
create function public.can_read_original(path text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
    join public.trip_members m on m.trip_id = b.trip_id and m.user_id = (select auth.uid())
    where b.original_path = path and b.visibility = 'shared'
  ) or exists (
    select 1 from public.documents d
    join public.document_shares s on s.document_id = d.id
    join public.trip_members m on m.trip_id = s.trip_id and m.user_id = (select auth.uid())
    where path = any (d.image_paths) or d.image_path = path
  );
$$;

create policy "originals: shared select" on storage.objects for select to authenticated
  using (bucket_id = 'originals' and public.can_read_original(name));

revoke all on function public.is_trip_member(uuid), public.is_trip_owner(uuid),
  public.is_co_member(uuid), public.owns_document(uuid), public.is_document_shared_with_me(uuid),
  public.can_read_original(text)
  from public, anon;
grant execute on function public.is_trip_member(uuid), public.is_trip_owner(uuid),
  public.is_co_member(uuid), public.owns_document(uuid), public.is_document_shared_with_me(uuid),
  public.can_read_original(text)
  to authenticated;
revoke all on function public.create_profile(), public.add_trip_owner()
  from public, anon, authenticated;

-- ── city_links (ADR 0023) ─────────────────────────────────────────────────────────────────────
-- A saved link counts for its trip's city whoever on the trip saved it (was: the trip's creator).
create or replace function public.city_links(p_city text)
returns table (url text, title text, thumbnail_url text, place_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.url,
    (array_agg(l.title order by l.created_at desc) filter (where l.title is not null))[1],
    (array_agg(l.thumbnail_url order by l.created_at desc)
      filter (where l.thumbnail_url like 'https://%'))[1],
    max(cardinality(l.place_ids))::integer
  from public.saved_links l
  join public.trips t on t.id = l.trip_id
  where lower(btrim(t.city)) = lower(btrim(p_city))
    and cardinality(l.place_ids) > 0
    and l.url ~ '^https://(www\.|m\.|vm\.|vt\.)?(tiktok\.com|instagram\.com)/'
  group by l.url
  order by count(distinct l.user_id) desc, max(l.created_at) desc
  limit 30;
$$;
