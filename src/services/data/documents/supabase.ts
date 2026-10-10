import { check, checkRow, client, type Row } from '../shared/supabase';
import type { DocumentsSource, TravelDocument } from './types';

export const toDocument = (r: Row<'documents'>): TravelDocument => ({
  id: r.id,
  type: r.type === 'visa' ? 'visa' : 'passport',
  country: r.country,
  number: r.number,
  expiresOn: r.expires_on,
  imagePaths: r.image_paths,
});

/** The travel documents slice of the Supabase source. */
export const supabaseDocuments: DocumentsSource = {
  async listDocuments() {
    const supabase = client();
    return checkRow(await supabase.from('documents').select('*').order('created_at')).map(
      toDocument,
    );
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
};
