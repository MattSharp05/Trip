-- TR-50: `bookings.visibility` needs a column default, or the generated types make every insert
-- name it and the v1 app (which doesn't) stops type-checking. The default 'by-type' never
-- persists: the before-insert trigger turns it into private (flights) or shared (the rest) before
-- the check constraint runs. An explicit 'shared' or 'private' is kept.
create or replace function internal.booking_visibility() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.visibility is null or new.visibility = 'by-type' then
      new.visibility := case when new.type = 'flight' then 'private' else 'shared' end;
    end if;
  elsif new.visibility is distinct from old.visibility
        and (select auth.uid()) is not null
        and (select auth.uid()) <> old.user_id then
    raise exception 'only the booking''s owner can change its visibility'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

alter table public.bookings alter column visibility set default 'by-type';
