/** Required on first use, so tests and demo screens that never search don't create a client. */
const client = (): (typeof import('./supabase'))['supabase'] =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./supabase').supabase;

/**
 * Call one of the project's Edge Functions (supabase/functions/<name>). Works signed out too: the
 * client sends the anon key when there is no session, so scenario demo sessions can use it.
 */
export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().functions.invoke<T>(name, { body });
  if (error) throw new Error(error.message);
  if (data === null) throw new Error(`${name} returned no data`);
  return data;
}
