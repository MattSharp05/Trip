import { SAMPLE_PARSES, sampleFor } from '../../../supabase/functions/_shared/parse/fixtures';
import type { ParseResult } from '../../../supabase/functions/_shared/parse/schema';
import type { DataSource } from '@/services/data';
import {
  IMPORT_COPY,
  ImportError,
  parseStoredBooking,
  uploadOriginal,
  type PickedFile,
} from '@/services/parseBooking';

export interface ReadBooking {
  result: ParseResult;
  /** Where the original was stored; null in a demo session, which keeps nothing. */
  originalPath: string | null;
}

/** How long a demo session "reads", so the skeleton shows as it would for real. */
export const DEMO_READ_MS = 600;

/**
 * Reads a picked booking. An account uploads the original and asks the `parse-booking` function;
 * a demo session (scenarios) uses the fixture parses instead, picked by file name, and never
 * touches the network. A demo file named `not-configured…` shows the "not set up yet" state.
 */
export async function readBooking(source: DataSource, file: PickedFile): Promise<ReadBooking> {
  if (source.kind === 'demo') {
    await new Promise((resolve) => setTimeout(resolve, DEMO_READ_MS));
    if (file.name.startsWith('not-configured')) {
      throw new ImportError('not_configured', IMPORT_COPY.not_configured);
    }
    const result = JSON.parse(JSON.stringify(SAMPLE_PARSES[sampleFor(file.name)])) as ParseResult;
    return { result, originalPath: null };
  }
  // "Try again" after a failed read reuses the upload instead of storing the file again.
  const originalPath = uploads.get(file.uri) ?? (await uploadOriginal(file));
  uploads.set(file.uri, originalPath);
  return { result: await parseStoredBooking(originalPath), originalPath };
}

/** Picked file URI → its Storage path, for retries. */
const uploads = new Map<string, string>();

/** The copy for anything that stopped a read. */
export function importErrorMessage(error: unknown): string {
  return error instanceof ImportError ? error.message : IMPORT_COPY.failed;
}
