-- TR-20: passport and visa details entered by hand. A document can have several photos (a visa
-- page, a residence card's front and back); each path points into the private `originals` bucket
-- under "<uid>/documents/...". `image_path` (one photo) stays for older app builds; new code reads
-- and writes `image_paths` only. Table RLS (owner only) comes from 0001 and covers these columns.
alter table public.documents add column number text;
alter table public.documents add column image_paths text[] not null default '{}';
update public.documents set image_paths = array[image_path] where image_path is not null;
