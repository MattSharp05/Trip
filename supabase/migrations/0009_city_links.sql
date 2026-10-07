-- TR-34: Discover's "Saved from TikTok & Reels" row. Travellers' saved videos for a city, pooled
-- across everyone, without saying who saved them. saved_links stays owner-only (RLS from 0001);
-- this security-definer function is the one way to read it across users, and it answers only the
-- video's URL, caption, thumbnail and how many places it names: no ids, user ids, author, trip or
-- dates. Only TikTok and Instagram links count, so a hand-written row can't put any other link
-- in front of other travellers. Signed-in users only.
create function public.city_links(p_city text)
returns table (url text, title text, thumbnail_url text, place_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.url,
    (array_agg(l.title order by l.created_at desc) filter (where l.title is not null))[1],
    (array_agg(l.thumbnail_url order by l.created_at desc)
      filter (where l.thumbnail_url like 'https://%'))[1],
    max(cardinality(l.place_ids))::integer
  from public.saved_links l
  join public.trips t on t.id = l.trip_id and t.user_id = l.user_id
  where lower(btrim(t.city)) = lower(btrim(p_city))
    and cardinality(l.place_ids) > 0
    and l.url ~ '^https://(www\.|m\.|vm\.|vt\.)?(tiktok\.com|instagram\.com)/'
  group by l.url
  order by count(distinct l.user_id) desc, max(l.created_at) desc
  limit 30;
$$;

revoke all on function public.city_links(text) from public, anon;
grant execute on function public.city_links(text) to authenticated;
