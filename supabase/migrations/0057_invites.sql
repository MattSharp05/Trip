-- TR-57 (ADR 0029): invite links. A trip has at most one active link; anyone signed in who has it
-- can see a short preview of the trip and join it. "Reset link" revokes it and makes a new one.
-- The table is reached only through the security definer RPCs below (RLS on, no policies).

create table public.trip_invites (
  token text primary key check (token ~ '^[A-Za-z0-9_-]{22}$'),
  trip_id uuid not null references public.trips (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
-- One active link per trip.
create unique index trip_invites_one_active_idx on public.trip_invites (trip_id)
  where revoked_at is null;

alter table public.trip_invites enable row level security;
revoke all on public.trip_invites from anon, authenticated;

-- 22 random URL-safe characters (16 random bytes, base64url).
create function internal.new_invite_token() returns text
language sql
volatile
set search_path = ''
as $$
  select left(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), 22);
$$;

-- The trip's active link, made on first use. Members only.
create function public.create_invite(trip uuid) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_token text;
begin
  if not public.is_trip_member(trip) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  insert into public.trip_invites (token, trip_id, created_by)
  values (internal.new_invite_token(), trip, (select auth.uid()))
  on conflict (trip_id) where revoked_at is null do nothing;
  select i.token into active_token
  from public.trip_invites i
  where i.trip_id = trip and i.revoked_at is null;
  return active_token;
end;
$$;

-- Revokes the trip's active link (the old one then says "no longer active") and makes a new one.
create function public.reset_invite(trip uuid) returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_trip_member(trip) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  update public.trip_invites set revoked_at = now() where trip_id = trip and revoked_at is null;
  return public.create_invite(trip);
end;
$$;

-- What the invite screen shows before Join, and nothing else of the trip.
create function public.invite_preview(invite text)
returns table (
  trip_id uuid,
  city text,
  start_date date,
  end_date date,
  cover_photo_url text,
  inviter_name text,
  member_count int,
  already_member boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select t.id, t.city, t.start_date, t.end_date, t.cover_photo_url, p.display_name,
         (select count(*)::int from public.trip_members m where m.trip_id = t.id),
         public.is_trip_member(t.id)
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  left join public.profiles p on p.id = i.created_by
  where i.token = invite and i.revoked_at is null;
  if not found then
    raise exception 'invite_inactive' using errcode = 'P0002';
  end if;
end;
$$;

-- Joins the trip as a member (already on it: nothing changes) and returns its id.
create function public.accept_invite(invite text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip uuid;
begin
  select i.trip_id into trip
  from public.trip_invites i
  where i.token = invite and i.revoked_at is null;
  if trip is null then
    raise exception 'invite_inactive' using errcode = 'P0002';
  end if;
  insert into public.trip_members (trip_id, user_id, role)
  values (trip, (select auth.uid()), 'member')
  on conflict (trip_id, user_id) do nothing;
  return trip;
end;
$$;

revoke all on function internal.new_invite_token() from public;
revoke all on function public.create_invite(uuid) from public, anon;
revoke all on function public.reset_invite(uuid) from public, anon;
revoke all on function public.invite_preview(text) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.reset_invite(uuid) to authenticated;
grant execute on function public.invite_preview(text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
