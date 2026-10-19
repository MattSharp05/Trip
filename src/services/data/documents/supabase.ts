import { check, checkRow, client, type Row } from '../shared/supabase';
import type { DocumentsSource, TravelDocument } from './types';

export const toDocument = (
  r: Row<'documents'> & { document_shares?: { trip_id: string }[] },
): TravelDocument => ({
  id: r.id,
  type: r.type === 'visa' ? 'visa' : 'passport',
  country: r.country,
  number: r.number,
  expiresOn: r.expires_on,
  imagePaths: r.image_paths,
  addedBy: r.user_id,
  ...(r.document_shares ? { sharedTripIds: r.document_shares.map((s) => s.trip_id) } : {}),
});

/** The travel documents slice of the Supabase source. */
export const supabaseDocuments: DocumentsSource = {
  async listDocuments() {
    const supabase = client();
    // Yours, plus those others shared with a trip you're on (RLS); with the trips each is shared
    // with that you can see.
    return checkRow(
      await supabase.from('documents').select('*, document_shares(trip_id)').order('created_at'),
    ).map(toDocument);
  },
  async saveDocument(document) {
    const supabase = client();
    const row = checkRow(
      await supabase
        .from('documents')
        .upsert({
          ...(document.id ? { id: document.id } : {}),
          type: document.type,
          country: document.country,
          number: document.number,
          expires_on: document.expiresOn,
          image_paths: document.imagePaths,
        })
        .select()
        .single(),
    );
    return toDocument(row);
  },
  async deleteDocument(id) {
    const supabase = client();
    check(await supabase.from('documents').delete().eq('id', id));
  },
  async setDocumentShared(id, tripId, shared) {
    const supabase = client();
    check(
      shared
        ? await supabase
            .from('document_shares')
            .upsert({ document_id: id, trip_id: tripId }, { ignoreDuplicates: true })
        : await supabase
            .from('document_shares')
            .delete()
            .eq('document_id', id)
            .eq('trip_id', tripId),
    );
  },
};
