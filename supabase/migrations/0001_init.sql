-- TR-4: initial schema (TDD → Data & state, ADR 0003).
-- Every table is owned by one user: user_id defaults to auth.uid() and RLS allows only that user.
-- Times are local wall-clock plus an IANA timezone; money is integer minor units.
-- Cross-table references are composite (id, user_id) foreign keys, so a row can only point at
-- the same user's trip, place or booking.

create or replace function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  city text not null,
  country text,
  lat double precision,
  lng double precision,
  timezone text not null,
  start_date date not null,
  end_date date not null,
  cover_photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_dates_ordered check (end_date >= start_date),
  unique (id, user_id)
);
create index trips_user_start_idx on public.trips (user_id, start_date);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  kind text,
  photo_url text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index places_user_idx on public.places (user_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null,
  type text not null check (type in ('flight', 'hotel', 'car', 'ticket', 'reservation')),
  data jsonb not null default '{}'::jsonb,
  original_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (trip_id, user_id) references public.trips (id, user_id) on delete cascade
);
create index bookings_user_idx on public.bookings (user_id);
create index bookings_trip_idx on public.bookings (trip_id);

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null,
  day date not null,
  start_time time,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  place_id uuid,
  kind text not null,
  booking_id uuid,
  fixed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_id, user_id) references public.trips (id, user_id) on delete cascade,
  foreign key (place_id, user_id) references public.places (id, user_id) on delete set null (place_id),
  foreign key (booking_id, user_id) references public.bookings (id, user_id)
    on delete set null (booking_id)
);
create index itinerary_items_user_idx on public.itinerary_items (user_id);
create index itinerary_items_trip_day_idx on public.itinerary_items (trip_id, day, start_time);
create index itinerary_items_place_idx on public.itinerary_items (place_id);
create index itinerary_items_booking_idx on public.itinerary_items (booking_id);

-- Passports and visas: not trip-scoped, never parsed by AI.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('passport', 'visa')),
  country text,
  expires_on date,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_user_idx on public.documents (user_id);

create table public.bucket_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null,
  place_id uuid,
  window_start time,
  window_end time,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  source text,
  fixed_date date,
  fixed_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_id, user_id) references public.trips (id, user_id) on delete cascade,
  foreign key (place_id, user_id) references public.places (id, user_id) on delete set null (place_id)
);
create index bucket_items_user_idx on public.bucket_items (user_id);
create index bucket_items_trip_idx on public.bucket_items (trip_id);
create index bucket_items_place_idx on public.bucket_items (place_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null,
  amount_minor bigint not null,
  currency char(3) not null,
  category text,
  booking_id uuid,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_id, user_id) references public.trips (id, user_id) on delete cascade,
  foreign key (booking_id, user_id) references public.bookings (id, user_id)
    on delete set null (booking_id)
);
create index expenses_user_idx on public.expenses (user_id);
create index expenses_trip_idx on public.expenses (trip_id);
create index expenses_booking_idx on public.expenses (booking_id);

create table public.saved_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url text not null,
  platform text,
  title text,
  thumbnail_url text,
  place_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_links_user_idx on public.saved_links (user_id, created_at desc);

-- updated_at triggers and owner-only RLS on every table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'trips', 'places', 'itinerary_items', 'bookings',
    'documents', 'bucket_items', 'expenses', 'saved_links'
  ] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s: owner select" on public.%1$I for select to authenticated
         using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s: owner insert" on public.%1$I for insert to authenticated
         with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s: owner update" on public.%1$I for update to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s: owner delete" on public.%1$I for delete to authenticated
         using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Storage: private buckets; each user reads and writes only under "<uid>/...".
insert into storage.buckets (id, name, public)
values ('originals', 'originals', false), ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "originals, photos: owner select" on storage.objects for select to authenticated
  using (bucket_id in ('originals', 'photos')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "originals, photos: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('originals', 'photos')
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "originals, photos: owner update" on storage.objects for update to authenticated
  using (bucket_id in ('originals', 'photos')
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('originals', 'photos')
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "originals, photos: owner delete" on storage.objects for delete to authenticated
  using (bucket_id in ('originals', 'photos')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
