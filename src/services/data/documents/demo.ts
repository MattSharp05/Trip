import { copy, type DemoStore, upsert } from '../shared/demo';
import type { DocumentsSource, TravelDocument } from './types';

/** The travel documents slice of the demo source. */
export function demoDocuments(store: DemoStore): DocumentsSource {
  return {
    async listDocuments() {
      // As RLS: yours, and others' shared with a trip you're on.
      const { db } = store;
      const myTrips = new Set(db.members.filter((m) => m.userId === db.me).map((m) => m.tripId));
      return copy(
        db.documents.filter(
          (d) =>
            (d.addedBy ?? db.me) === db.me || (d.sharedTripIds ?? []).some((t) => myTrips.has(t)),
        ),
      );
    },
    async saveDocument(input) {
      const { db } = store;
      const before = input.id ? db.documents.find((d) => d.id === input.id) : undefined;
      const document: TravelDocument = {
        ...copy(input),
        id: input.id ?? `document-${Date.now().toString(36)}-${db.documents.length}`,
        // Editing never changes whose it is or where it's shared.
        ...(before?.addedBy ? { addedBy: before.addedBy } : {}),
        ...(before?.sharedTripIds ? { sharedTripIds: before.sharedTripIds } : {}),
      };
      store.db = { ...db, documents: upsert(db.documents, document) };
      return copy(document);
    },
    async deleteDocument(id) {
      store.db = { ...store.db, documents: store.db.documents.filter((d) => d.id !== id) };
    },
    async setDocumentShared(id, tripId, shared) {
      const { db } = store;
      const document = db.documents.find((d) => d.id === id);
      if (!document || (document.addedBy ?? db.me) !== db.me) {
        throw new Error("Only the document's owner shares it");
      }
      if (shared && !db.members.some((m) => m.tripId === tripId && m.userId === db.me)) {
        throw new Error('Not a member of that trip');
      }
      const others = (document.sharedTripIds ?? []).filter((t) => t !== tripId);
      const next = { ...document, sharedTripIds: shared ? [...others, tripId] : others };
      store.db = { ...db, documents: upsert(db.documents, next) };
    },
  };
}
