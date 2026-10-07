-- TR-31: a bucket item saved from Discover keeps the event's name ("Fred again..") while its place
-- is the venue (XS Nightclub). Null for places saved by search, pin or link: screens show the
-- place's name then.
alter table public.bucket_items add column title text;
