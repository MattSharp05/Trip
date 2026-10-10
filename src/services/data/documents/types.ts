/**
 * A passport or visa, entered by hand and never sent to AI (ADR 0004). It belongs to the account,
 * so it shows on every trip.
 */
export interface TravelDocument {
  id: string;
  type: 'passport' | 'visa';
  country: string | null;
  number: string | null;
  expiresOn: string | null;
  /**
   * Photos: Storage paths in the private `originals` bucket (`<uid>/documents/…`) for an account,
   * or local file URIs in a demo session.
   */
  imagePaths: string[];
}

/** What "save a document" takes; without an id it adds a new one. */
export type DocumentInput = Omit<TravelDocument, 'id'> & { id?: string };

/** The travel documents slice of `DataSource`. */
export interface DocumentsSource {
  listDocuments(): Promise<TravelDocument[]>;
  saveDocument(document: DocumentInput): Promise<TravelDocument>;
  deleteDocument(id: string): Promise<void>;
}
