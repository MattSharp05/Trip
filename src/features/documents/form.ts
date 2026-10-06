import type { DocumentInput, TravelDocument } from '@/services/data/types';

/** The add/edit form's state (TR-20). Text fields are kept as typed until save. */
export interface DocumentForm {
  type: TravelDocument['type'];
  country: string;
  number: string;
  /** `YYYY-MM-DD`, or null until the user picks one. */
  expiresOn: string | null;
  imagePaths: string[];
}

export const MAX_PHOTOS = 4;

export function emptyForm(): DocumentForm {
  return { type: 'passport', country: '', number: '', expiresOn: null, imagePaths: [] };
}

export function formFrom(document: TravelDocument): DocumentForm {
  return {
    type: document.type,
    country: document.country ?? '',
    number: document.number ?? '',
    expiresOn: document.expiresOn,
    imagePaths: [...document.imagePaths],
  };
}

/** What's missing before the form can save, or null. Country and expiry are required. */
export function formError(form: DocumentForm): string | null {
  if (!form.country.trim()) return 'Add the issuing country.';
  if (!form.expiresOn) return 'Add the expiry date.';
  return null;
}

/** The form as a save request; `id` updates that document, without it a new one is added. */
export function toInput(form: DocumentForm, id?: string): DocumentInput {
  const number = form.number.trim().replace(/\s+/g, ' ');
  return {
    ...(id ? { id } : {}),
    type: form.type,
    country: form.country.trim(),
    number: number || null,
    expiresOn: form.expiresOn,
    imagePaths: form.imagePaths.slice(0, MAX_PHOTOS),
  };
}

/** The document's name in the app: `Passport`, `Visa`. */
export const documentName = (type: TravelDocument['type']) =>
  type === 'passport' ? 'Passport' : 'Visa';
