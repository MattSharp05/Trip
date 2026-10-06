-- TR-21: a trip's budget and an expense's note. The budget keeps its own currency (integer minor
-- units + ISO code, like expenses); screens convert it to the display currency. Both columns are
-- set together or not at all. Table RLS (owner only) comes from 0001 and covers these columns.
alter table public.trips add column budget_minor bigint;
alter table public.trips add column budget_currency char(3);
alter table public.trips add constraint trips_budget_complete
  check ((budget_minor is null) = (budget_currency is null));
alter table public.trips add constraint trips_budget_positive
  check (budget_minor is null or budget_minor >= 0);

alter table public.expenses add column description text;

-- An expense created from a booking goes with it: deleting the booking deletes its expenses
-- (0001 only cleared the link). Manual expenses (no booking_id) are unaffected.
do $$
declare
  fk text;
begin
  select c.conname into fk
  from pg_constraint c
  where c.conrelid = 'public.expenses'::regclass
    and c.contype = 'f'
    and c.confrelid = 'public.bookings'::regclass;
  if fk is not null then
    execute format('alter table public.expenses drop constraint %I', fk);
  end if;
end;
$$;
alter table public.expenses add constraint expenses_booking_fkey
  foreign key (booking_id, user_id) references public.bookings (id, user_id) on delete cascade;
