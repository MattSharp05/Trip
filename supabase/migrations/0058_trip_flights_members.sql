-- TR-58 review: a shared flight booking stays on the trip when its traveller leaves (only
-- private ones go, 0050), so trip_flights lists only the legs of people still on the trip.

create or replace function public.trip_flights(trip uuid)
returns table (
  booking_id uuid,
  traveler_id uuid,
  airline text,
  flight_number text,
  from_code text,
  from_city text,
  from_place_id text,
  to_code text,
  to_city text,
  to_place_id text,
  departs_date text,
  departs_time text,
  departs_timezone text,
  arrives_date text,
  arrives_time text,
  arrives_timezone text
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Only these keys of `bookings.data`: never the seat, confirmation, passenger or pass.
  select b.id, b.user_id,
         b.data ->> 'airline', b.data ->> 'flightNumber',
         b.data -> 'from' ->> 'code', b.data -> 'from' ->> 'city', b.data -> 'from' ->> 'placeId',
         b.data -> 'to' ->> 'code', b.data -> 'to' ->> 'city', b.data -> 'to' ->> 'placeId',
         b.data -> 'departs' ->> 'date', b.data -> 'departs' ->> 'time',
         b.data -> 'departs' ->> 'timezone',
         b.data -> 'arrives' ->> 'date', b.data -> 'arrives' ->> 'time',
         b.data -> 'arrives' ->> 'timezone'
  from public.bookings b
  join public.trip_members m on m.trip_id = b.trip_id and m.user_id = b.user_id
  where b.trip_id = trip
    and b.type = 'flight'
    and public.is_trip_member(trip)
    -- A leg the app can place in time: an import always fills both ends.
    and b.data -> 'departs' ->> 'date' is not null
    and b.data -> 'arrives' ->> 'date' is not null
  order by b.data -> 'departs' ->> 'date', b.data -> 'departs' ->> 'time', b.id;
$$;

revoke all on function public.trip_flights(uuid) from public, anon;
grant execute on function public.trip_flights(uuid) to authenticated;
