-- TR-26 (ADR 0017): the `flight-status` Edge Function's 10-minute cache and its monthly call
-- counter. Only the function reads or writes them, with the service role key: RLS is on with no
-- policies, and the app's roles have no grants, so users and anonymous clients can't see or touch
-- them.
create table public.flight_status_cache (
  -- `<flight number>:<local departure date>:<departure airport>`, e.g. `AA2410:2026-11-12:TPA`.
  key text primary key,
  -- The FlightStatus JSON (_shared/flightStatus/schema.ts); null when the provider didn't know it.
  status jsonb,
  fetched_at timestamptz not null default now()
);

create table public.flight_status_usage (
  -- UTC month, `YYYY-MM`.
  month text primary key check (month ~ '^\d{4}-\d{2}$'),
  -- Provider units used this month (AeroDataBox counts 2 per status lookup).
  units integer not null default 0 check (units >= 0)
);

alter table public.flight_status_cache enable row level security;
alter table public.flight_status_usage enable row level security;
revoke all on public.flight_status_cache, public.flight_status_usage from anon, authenticated;

-- Adds `p_units` to the month's count unless that would pass `p_limit` (90% of the allowance);
-- true when the units were reserved and the call may go ahead. One statement, so two calls at the
-- same moment can't both squeeze past the limit.
create function public.reserve_flight_status_units(p_month text, p_units integer, p_limit integer)
returns boolean
language sql
set search_path = ''
as $$
  with reserved as (
    insert into public.flight_status_usage as u (month, units)
    select p_month, p_units
    where p_units <= p_limit
    on conflict (month) do update
      set units = u.units + excluded.units
      where u.units + excluded.units <= p_limit
    returning 1
  )
  select exists (select 1 from reserved);
$$;

revoke all on function public.reserve_flight_status_units(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_flight_status_units(text, integer, integer)
  to service_role;
