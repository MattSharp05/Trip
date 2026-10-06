-- TR-10: photographer credit for a trip's cover photo (Unsplash asks for "Photo by <name> on
-- Unsplash" with links). Shape: { source, photographer, photographerUrl, photoUrl }.
alter table public.trips add column cover_photo_credit jsonb;
