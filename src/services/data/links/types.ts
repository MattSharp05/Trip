/** A TikTok or Instagram video the traveller saved places from (TR-30). */
export interface SavedLink {
  id: string;
  tripId: string;
  url: string;
  platform: 'tiktok' | 'instagram';
  /** The caption, when the platform shares it. */
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  /** The places saved from it. */
  placeIds: string[];
}

/** What "save a link" takes; without an id it adds a new one. */
export type SavedLinkInput = Omit<SavedLink, 'id'> & { id?: string };

/** The saved links slice of `DataSource`. */
export interface LinksSource {
  /** Adds a saved TikTok or Instagram link (no id) or updates one; returns it with its id. */
  saveLink(link: SavedLinkInput): Promise<SavedLink>;
}
