-- TR-62 code review fix on top of 0062_shared_expenses.sql (applied, so not edited): the payer
-- check in internal.check_expense was too strict in two cases.
-- 1. Deleting the payer's account sets `paid_by` to null (on delete set null); the trigger turned
--    that null back into the adder and then required them on the trip, so the deletion could fail.
--    Now `paid_by` only defaults on insert, and null (payer gone) is allowed.
-- 2. An upsert fires the insert trigger even when the row exists, so re-saving an expense whose
--    payer has since left the trip failed. An unchanged payer on an existing row isn't checked.
create or replace function internal.check_expense() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.paid_by := coalesce(new.paid_by, new.user_id, (select auth.uid()));
  end if;
  if new.paid_by is not null
     and (tg_op = 'INSERT' or new.paid_by is distinct from old.paid_by)
     and not exists (
       select 1 from public.expenses e
       where tg_op = 'INSERT' and e.id = new.id and e.paid_by = new.paid_by
     )
     and not exists (
       select 1 from public.trip_members m
       where m.trip_id = new.trip_id and m.user_id = new.paid_by
     ) then
    raise exception 'paid_by % is not on trip %', new.paid_by, new.trip_id
      using errcode = '23503';
  end if;
  if new.itinerary_item_id is not null and not exists (
    select 1 from public.itinerary_items i
    where i.id = new.itinerary_item_id and i.trip_id = new.trip_id
  ) then
    raise exception 'itinerary item % is not on trip %', new.itinerary_item_id, new.trip_id
      using errcode = '23503';
  end if;
  return new;
end;
$$;
