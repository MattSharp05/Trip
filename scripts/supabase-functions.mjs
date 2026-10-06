#!/usr/bin/env node
// Deploys every Edge Function in supabase/functions/<name>/index.ts through the Management API
// (ADR 0003: HTTPS only, no Docker, no Supabase CLI). Each function is one self-contained file;
// the API bundles it server-side. Folders starting with `_` are skipped.
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

async function deploy(name) {
  const source = readFileSync(path.join(functionsDir, name, 'index.ts'), 'utf8');
  const form = new FormData();
  // verify_jwt: callers need the anon key or a user's token; the anon key ships in the app.
  form.append('metadata', JSON.stringify({ name, entrypoint_path: 'index.ts', verify_jwt: true }));
  form.append('file', new Blob([source], { type: 'application/typescript' }), 'index.ts');
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
