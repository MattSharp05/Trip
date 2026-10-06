#!/usr/bin/env node
// Downloads the screenshots of the latest E2E run on main (.github/workflows/e2e.yml) into
// qa-shots/, so /submit-ticket can attach them to a Notion ticket. Needs the GitHub CLI (`gh`),
// signed in (cloud sessions are).
//
//   node scripts/qa-shots.mjs                  latest successful run on main
//   node scripts/qa-shots.mjs --run <id>       a given run (e.g. a failed one, to see where it stopped)
//   node scripts/qa-shots.mjs --out <dir>      somewhere other than qa-shots/

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'MattSharp05/Trip';
const WORKFLOW = 'e2e.yml';
const ARTIFACT = 'e2e-screenshots';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function gh(endpoint, { binary = false } = {}) {
  try {
    const out = execFileSync('gh', ['api', endpoint], {
      cwd: root,
      maxBuffer: 256 * 1024 * 1024,
      encoding: binary ? 'buffer' : 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return binary ? out : JSON.parse(out);
  } catch (error) {
    return fail(`gh api ${endpoint} failed: ${String(error.stderr ?? error.message).trim()}`);
  }
}

function latestRunId() {
  const { workflow_runs: runs } = gh(
    `repos/${REPO}/actions/workflows/${WORKFLOW}/runs?branch=main&status=success&per_page=1`,
  );
  if (!runs.length) fail(`No successful ${WORKFLOW} run on main yet.`);
  console.log(`Run ${runs[0].id} (${runs[0].head_sha.slice(0, 7)}, ${runs[0].created_at})`);
  return runs[0].id;
}

const runId = arg('--run') ?? latestRunId();
const outDir = path.resolve(root, arg('--out') ?? 'qa-shots');

const { artifacts } = gh(`repos/${REPO}/actions/runs/${runId}/artifacts`);
const artifact = artifacts.find((a) => a.name === ARTIFACT);
if (!artifact) fail(`Run ${runId} has no ${ARTIFACT} artifact.`);
if (artifact.expired) fail(`The ${ARTIFACT} artifact of run ${runId} has expired.`);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const zip = path.join(outDir, `${ARTIFACT}.zip`);
writeFileSync(zip, gh(`repos/${REPO}/actions/artifacts/${artifact.id}/zip`, { binary: true }));
execFileSync('unzip', ['-q', '-o', zip, '-d', outDir]);
rmSync(zip);

for (const file of readdirSync(outDir).sort()) console.log(path.join(outDir, file));
