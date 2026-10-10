import { copy, type DemoStore, upsert } from '../shared/demo';
import type { DocumentsSource, TravelDocument } from './types';

/** The travel documents slice of the demo source. */
export function demoDocuments(store: DemoStore): DocumentsSource {
  return {
    async listDocuments() {
      return copy(store.db.documents);
    },
    async saveDocument(input) {
      const { db } = store;
      const document: TravelDocument = {
        ...copy(input),
        id: input.id ?? `document-${Date.now().toString(36)}-${db.documents.length}`,
      };
      store.db = { ...db, documents: upsert(db.documents, document) };
      return copy(document);
    },
    async deleteDocument(id) {
      store.db = { ...store.db, documents: store.db.documents.filter((d) => d.id !== id) };
    },
  };
}
