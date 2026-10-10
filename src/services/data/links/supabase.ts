import { checkRow, client, type Row } from '../shared/supabase';
import type { LinksSource, SavedLink } from './types';

export const toLink = (r: Row<'saved_links'>): SavedLink => ({
  id: r.id,
  tripId: r.trip_id ?? '',
  url: r.url,
  platform: r.platform === 'instagram' ? 'instagram' : 'tiktok',
  title: r.title,
  author: r.author,
  thumbnailUrl: r.thumbnail_url,
  placeIds: r.place_ids,
});

/** The saved links slice of the Supabase source. */
export const supabaseLinks: LinksSource = {
  async saveLink(link) {
    const supabase = client();
    const row = checkRow(
      await supabase
        .from('saved_links')
        .upsert({
          ...(link.id ? { id: link.id } : {}),
          trip_id: link.tripId,
          url: link.url,
          platform: link.platform,
          title: link.title,
          author: link.author,
          thumbnail_url: link.thumbnailUrl,
          place_ids: link.placeIds,
        })
        .select()
        .single(),
    );
    return toLink(row);
  },
};
