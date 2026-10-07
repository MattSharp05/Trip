#!/usr/bin/env node
// Deploys every Edge Function in supabase/functions/<name>/index.ts through the Management API
// (ADR 0003: HTTPS only, no Docker, no Supabase CLI). The API bundles each function server-side
// from its index.ts plus every file in `_shared/` (code shared between functions and the app, e.g.
// the booking schemas), with an import map for the npm packages they use. Folders starting with
// `_` are not functions themselves.
//
//   SUPABASE_ACCESS_TOKEN=… node scripts/supabase-functions.mjs           deploy all functions
//   SUPABASE_ACCESS_TOKEN=… node scripts/supabase-functions.mjs places    deploy one
//
// Used locally and by CI on main when supabase/** changed (.github/workflows/ci.yml → Supabase).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { projectRef, token } from './supabase-api.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const functionsDir = path.join(root, 'supabase', 'functions');

function functionNames() {
  return readdirSync(functionsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name)
    .filter((name) => existsSync(path.join(functionsDir, name, 'index.ts')))
    .sort();
}

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
/** npm packages shared code may import by bare name, at the app's version. */
const IMPORT_MAP = { imports: { zod: `npm:zod@${pkg.dependencies.zod.replace(/^[^\d]*/, '')}` } };

/** Every file under `_shared/`, as paths relative to supabase/functions. */
function sharedFiles(dir = path.join(functionsDir, '_shared')) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return sharedFiles(full);
    return d.name.endsWith('.ts') && !d.name.endsWith('.test.ts')
      ? [path.relative(functionsDir, full)]
      : [];
  });
}

async function deploy(name) {
  const entry = `${name}/index.ts`;
  const form = new FormData();
  // verify_jwt: callers need the anon key or a user's token; the anon key ships in the app.
  form.append(
    'metadata',
    JSON.stringify({
      name,
      entrypoint_path: entry,
      import_map_path: 'import_map.json',
      verify_jwt: true,
    }),
  );
  for (const file of [entry, ...sharedFiles()]) {
    const source = readFileSync(path.join(functionsDir, file), 'utf8');
    form.append('file', new Blob([source], { type: 'application/typescript' }), file);
  }
  form.append(
    'file',
    new Blob([JSON.stringify(IMPORT_MAP)], { type: 'application/json' }),
    'import_map.json',
  );
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef()}/functions/deploy?slug=${name}`,
    { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: form },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`deploy ${name} → ${res.status}: ${text}`);
  const { version, status } = JSON.parse(text);
  console.log(`deployed ${name} (version ${version}, ${status})`);
}

try {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : functionNames();
  for (const name of names) await deploy(name);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
