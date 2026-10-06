/** Required on first use, so demo sessions and tests never create a Supabase client. */
const client = (): (typeof import('./supabase'))['supabase'] =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./supabase').supabase;

/** A short-lived link to an imported original (PDF, screenshot) in the private `originals` bucket. */
export async function originalUrl(path: string): Promise<string> {
  const { data, error } = await client().storage.from('originals').createSignedUrl(path, 600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
