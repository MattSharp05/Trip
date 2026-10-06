// Shared helpers for the Supabase Management API (ADR 0003: cloud sessions and CI reach Supabase
// over HTTPS only, so migrations, config and types all go through api.supabase.com).

const API = 'https://api.supabase.com/v1';

export function projectRef() {
  return process.env.SUPABASE_PROJECT_REF || 'wghftsubdrkxfzysovou';
}

export function token() {
  const value = process.env.SUPABASE_ACCESS_TOKEN;
  if (!value) {
    console.error(
      'SUPABASE_ACCESS_TOKEN is not set. Create a personal access token at ' +
        'supabase.com/dashboard/account/tokens and export it (in CI: the SUPABASE_ACCESS_TOKEN ' +
        'repository secret).',
    );
    process.exit(1);
  }
  return value;
}

export async function api(method, path, body) {
  const res = await fetch(`${API}/projects/${projectRef()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

/** Runs SQL as the postgres role and returns the rows of the last statement. */
export function sql(query) {
  return api('POST', '/database/query', { query });
}

/** Single-quoted SQL literal. */
export function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

/** The project's API keys by name ('anon', 'service_role'). Never print the service key. */
export async function apiKeys() {
  const keys = await api('GET', '/api-keys?reveal=true');
  return Object.fromEntries(
    keys.filter((k) => k.type === 'legacy').map((k) => [k.name, k.api_key]),
  );
}

export function projectUrl() {
  return `https://${projectRef()}.supabase.co`;
}
