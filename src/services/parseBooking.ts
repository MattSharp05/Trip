import {
  PARSE_ERROR_COPY,
  readParseResult,
  type ParseErrorCode,
  type ParseResult,
} from '../../supabase/functions/_shared/parse/schema';

/** Required on first use, so demo sessions and tests never create a Supabase client. */
const client = (): (typeof import('./supabase'))['supabase'] =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./supabase').supabase;

const BUCKET = 'originals';

/** A file the traveller picked to import. */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

/** Why an import stopped, with the copy to show (from the `parse-booking` function). */
export class ImportError extends Error {
  constructor(
    readonly code: ParseErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const IMPORT_COPY = PARSE_ERROR_COPY;

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/heic': 'heic',
  'image/webp': 'webp',
};

/** `<timestamp>-<name>.<ext>`: a readable, safe Storage file name whose extension matches the type. */
export function storageName(file: Pick<PickedFile, 'name' | 'mimeType'>, stamp: string): string {
  const stem =
    file.name
      .replace(/\.[^.]*$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'booking';
  return `${stamp}-${stem}.${EXTENSIONS[file.mimeType] ?? 'jpg'}`;
}

/** Uploads the original under the signed-in user's folder (`<uid>/imports/…`); returns its path. */
export async function uploadOriginal(file: PickedFile): Promise<string> {
  const supabase = client();
  const { data, error } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (error || !uid) throw new ImportError('failed', 'Sign in to import bookings.');
  const path = `${uid}/imports/${storageName(file, Date.now().toString(36))}`;
  const body = await (await fetch(file.uri)).arrayBuffer();
  const upload = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: file.mimeType });
  if (upload.error) throw new ImportError('failed', IMPORT_COPY.failed);
  return path;
}

const CODES: readonly ParseErrorCode[] = ['not_configured', 'rate_limited', 'unreadable', 'failed'];

/** Asks `parse-booking` to read an uploaded original; the answer is checked against the schema. */
export async function parseStoredBooking(path: string): Promise<ParseResult> {
  const { data, error } = await client().functions.invoke<unknown>('parse-booking', {
    body: { path },
  });
  if (error) {
    // A non-2xx answer carries `{ error, message }`; anything else is a network failure.
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    const body = (await context?.json?.().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    const code = CODES.find((c) => c === body?.error) ?? 'failed';
    throw new ImportError(code, IMPORT_COPY[code]);
  }
  const read = readParseResult((data as { result?: unknown } | null)?.result);
  if (!read.ok) throw new ImportError('unreadable', IMPORT_COPY.unreadable);
  return read.result;
}
