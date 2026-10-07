-- TR-24: an itinerary item's own title and notes, edited in the item's detail sheet. Without a
-- title, screens show the place's name. Table RLS (owner only) comes from 0001 and covers these.
alter table public.itinerary_items add column title text;
alter table public.itinerary_items add column notes text;
