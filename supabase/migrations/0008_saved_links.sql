-- TR-30: TikTok and Reel links. A saved link belongs to a trip (its Bucket List) and records who
-- made the video; each bucket item saved from it points back at it, so the row can show "Watch".
-- Table RLS (owner only) comes from 0001 and covers these columns.
alter table public.saved_links add column trip_id uuid;
alter table public.saved_links add column author text;
alter table public.saved_links add constraint saved_links_id_user_key unique (id, user_id);
alter table public.saved_links
  add constraint saved_links_trip_fk foreign key (trip_id, user_id)
  references public.trips (id, user_id) on delete cascade;
create index saved_links_trip_idx on public.saved_links (trip_id);

alter table public.bucket_items add column saved_link_id uuid;
alter table public.bucket_items
  add constraint bucket_items_saved_link_fk foreign key (saved_link_id, user_id)
  references public.saved_links (id, user_id) on delete set null (saved_link_id);
create index bucket_items_saved_link_idx on public.bucket_items (saved_link_id);
