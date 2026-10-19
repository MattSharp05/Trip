-- TR-59: Bucket List together. Members like each other's Bucket List items; Popular sorts by
-- likes. One row per (item, member); you add and remove only your own.

-- `trip_id` is copied from the item (by trigger) so RLS and Realtime can filter on it.
create table public.bucket_likes (
  bucket_item_id uuid not null references public.bucket_items (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (bucket_item_id, user_id)
);
create index bucket_likes_trip_idx on public.bucket_likes (trip_id);

create function internal.bucket_like_trip() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select b.trip_id into new.trip_id from public.bucket_items b where b.id = new.bucket_item_id;
  if new.trip_id is null then
    raise exception 'bucket item % not found', new.bucket_item_id using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger bucket_likes_trip before insert or update on public.bucket_likes
  for each row execute function internal.bucket_like_trip();

-- An item moved to another trip takes its likes along.
create function internal.bucket_item_moved() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bucket_likes set trip_id = new.trip_id where bucket_item_id = new.id;
  return null;
end;
$$;
create trigger bucket_items_moved after update of trip_id on public.bucket_items
  for each row when (old.trip_id is distinct from new.trip_id)
  execute function internal.bucket_item_moved();

-- The trip's members read every like; each member adds and removes only their own.
alter table public.bucket_likes enable row level security;
create policy "bucket_likes: member select" on public.bucket_likes for select
  to authenticated using (public.is_trip_member(trip_id));
create policy "bucket_likes: member insert own" on public.bucket_likes for insert
  to authenticated
  with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id));
create policy "bucket_likes: delete own" on public.bucket_likes for delete
  to authenticated using (user_id = (select auth.uid()));

-- ── Realtime (rule from 0054_realtime.sql) ────────────────────────────────────────────────────
alter publication supabase_realtime add table public.bucket_likes;
alter table public.bucket_likes replica identity full;
create trigger bucket_likes_touch_trip after delete on public.bucket_likes
  referencing old table as deleted_rows
  for each statement execute function internal.touch_trips_after_delete();
