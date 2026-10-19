-- TR-58 (ADR 0027): everyone's flight times. A flight booking is private to the traveller who
-- added it (boarding pass, seat, confirmation), but the group sees each leg's route and local
-- times so they can plan pickups. Members call this; a non-member gets no rows.

create function public.trip_flights(trip uuid)
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
