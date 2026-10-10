import type { Database } from '../../database.types';

type Tables = Database['public']['Tables'];
export type Row<T extends keyof Tables> = Tables[T]['Row'];

/** Required on first use, so demo sessions and tests never create a Supabase client. */
export const client = (): (typeof import('../../supabase'))['supabase'] =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../supabase').supabase;

/** Postgres `time` comes back as `HH:MM:SS`; the app uses `HH:MM`. */
export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

type Result = { data: unknown; error: { message: string } | null };

/** The query's data, or throw its error. */
export function check<R extends Result>({ data, error }: R): R['data'] {
  if (error) throw new Error(error.message);
  return data;
}

/** Like `check`, for lists and `.single()`, whose data is never null on success. */
export function checkRow<R extends Result>(result: R): NonNullable<R['data']> {
  return check(result) as NonNullable<R['data']>;
}
