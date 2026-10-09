#!/usr/bin/env node
// Booking-import accuracy on the golden set (TR-28, ADR 0004/0020): reads each made-up booking in
// supabase/functions/parse-booking/golden/, compares the parser's answer with `<name>.expected.json`
// field by field and writes docs/parse-accuracy.md. The PRD target is ≥ 90% overall.
//
//   node scripts/parse-accuracy.mjs --provider fixture      canned answers (golden/recorded/), no
//                                                           network; Jest runs this on every PR
//   SUPABASE_ACCESS_TOKEN=… node scripts/parse-accuracy.mjs live: the deployed `parse-booking`
//                                                           function (Gemini; needs its
//                                                           GEMINI_API_KEY function secret)
// Options: --out <file> (default docs/parse-accuracy.md), --min <percent> (exit 1 below it),
// --only <name,…>, --record (live: save the answers to golden/recorded/), --golden <dir>,
// --delay <ms> between live calls (default 6000, the free tier allows ~10 a minute), --json.
//
// Scoring (ADR 0020): every non-null field of the expected booking counts once (coordinates are
// the geocoder's, not the model's, so they're left out). A field is right when the answer has the
// same value after normalising (case, accents, punctuation and spacing for text; HH:MM for times;
// digits for phone numbers; no scheme or www. for websites; numbers to the cent). A field the
// answer fills in that the booking doesn't have (expected null or absent) is an extra and counts
// as a miss too: accuracy = right / (expected fields + extras). A failed parse gets 0. An address
// counts as right when it is the expected street with or without the rest of the address after it.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const GOLDEN_DIR = join(ROOT, 'supabase/functions/parse-booking/golden');
const DEFAULT_OUT = join(ROOT, 'docs/parse-accuracy.md');

export const TYPE_LABELS = {
  flight: 'Flights',
  hotel: 'Hotels',
  car: 'Car rentals',
  ticket: 'Event tickets',
  reservation: 'Restaurant reservations',
};

const MIME = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg' };
const SKIPPED_KEYS = new Set(['lat', 'lng']);

// ---------------------------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------------------------

/** Text without case, accents, punctuation or spaces ("Pensão Azul" → "pensaoazul"). */
function plain(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll('&', 'and')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** "8:25", "08:25:00" and "8:25 AM" → "08:25"; "8:25 PM" → "20:25". */
function normaliseTime(value) {
  const m = /^\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?m?\.?\s*$/i.exec(String(value));
  if (!m) return plain(value);
  let hours = Number(m[1]) % (m[3] ? 12 : 24);
  if (m[3]?.toLowerCase() === 'p') hours += 12;
  return `${String(hours).padStart(2, '0')}:${m[2]}`;
}

/** Normalised form of one field, chosen by its name (the last part of its path). */
export function normalise(path, value) {
  if (typeof value === 'number') return Math.round(value * 100) / 100;
  if (typeof value === 'boolean') return value;
  const key = path.split('.').pop();
  const text = String(value).trim();
  if (key === 'date') return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : plain(text);
  if (key === 'time') return normaliseTime(text);
  if (key === 'phone') return text.replace(/\D/g, '');
  if (key === 'website') {
    return text
      .toLowerCase()
      .replace(/^[a-z]+:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '');
  }
  if (key === 'email') return text.toLowerCase();
  if (/^-?\d+(\.\d+)?$/.test(text) && (key === 'amount' || key === 'partySize')) {
    return Math.round(Number(text) * 100) / 100;
  }
  return plain(text);
}

/** Every non-empty leaf of a booking as `path → value` (`legs.1.seat`), coordinates left out. */
export function flatten(value, prefix = '', out = new Map()) {
  if (value === null || value === undefined) return out;
  if (typeof value === 'string' && value.trim() === '') return out;
  if (Array.isArray(value)) {
    value.forEach((item, i) => flatten(item, prefix ? `${prefix}.${i}` : String(i), out));
  } else if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (SKIPPED_KEYS.has(key)) continue;
      flatten(item, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.set(prefix, value);
  }
  return out;
}

/**
 * Addresses match when one is the other with more of the same address after it: "410 Example
 * Street" and "410 Example Street, San Diego, CA 92101" are the same street, and the city and
 * country are scored in their own fields (TR-49, ADR 0026).
 */
function sameAddress(expected, actual) {
  const parts = (value) =>
    String(value)
      .split(',')
      .map((part) => plain(part))
      .filter(Boolean);
  const [a, b] = [parts(expected), parts(actual)];
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length > 0 && short.every((part, i) => part === long[i]);
}

/** Scores one answer against the expected booking. `actual` is null when the parse failed. */
export function scoreBooking(expected, actual) {
  const want = flatten(expected);
  const got = actual ? flatten(actual) : new Map();
  const misses = [];
  let right = 0;
  for (const [path, value] of want) {
    const answer = got.get(path);
    const same =
      answer !== undefined &&
      (path.endsWith('.address')
        ? sameAddress(value, answer)
        : normalise(path, answer) === normalise(path, value));
    if (same) right += 1;
    else misses.push({ path, expected: value, actual: answer ?? null });
  }
  const extras = [...got].filter(([path]) => !want.has(path));
  for (const [path, value] of extras) misses.push({ path, expected: null, actual: value });
  return { right, total: want.size + extras.length, fields: want.size, misses };
}

const percent = (right, total) => (total === 0 ? 0 : Math.round((right / total) * 1000) / 10);

/** Per-type and overall accuracy (each field weighs the same, whatever booking it's in). */
export function summarise(results) {
  const byType = {};
  for (const r of results) {
    const t = (byType[r.type] ??= { type: r.type, bookings: 0, right: 0, total: 0 });
    t.bookings += 1;
    t.right += r.right;
    t.total += r.total;
  }
  const types = Object.keys(TYPE_LABELS)
    .filter((type) => byType[type])
    .map((type) => ({ ...byType[type], percent: percent(byType[type].right, byType[type].total) }));
  const right = results.reduce((sum, r) => sum + r.right, 0);
  const total = results.reduce((sum, r) => sum + r.total, 0);
  return { types, right, total, percent: percent(right, total) };
}

// ---------------------------------------------------------------------------------------------
// Golden set and providers
// ---------------------------------------------------------------------------------------------

/** The golden bookings in `dir`: every `<name>.expected.json` with its PDF or image. */
export function loadGolden(dir = GOLDEN_DIR) {
  const files = readdirSync(dir);
  return files
    .filter((f) => f.endsWith('.expected.json'))
    .sort()
    .map((f) => {
      const name = f.slice(0, -'.expected.json'.length);
      const file = files.find((g) => g.startsWith(`${name}.`) && MIME[extname(g).toLowerCase()]);
      const expected = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      return { name, expected, file: file ? join(dir, file) : null };
    });
}

function fixtureProvider(dir) {
  return {
    label: 'fixture (canned answers in golden/recorded/, not model output)',
    async parse(item) {
      try {
        const answer = JSON.parse(readFileSync(join(dir, 'recorded', `${item.name}.json`), 'utf8'));
        return { booking: answer.booking ?? null };
      } catch (error) {
        return { booking: null, error: `no recorded answer (${error.code ?? error.message})` };
      }
    },
  };
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** The deployed `parse-booking` function, called as a throwaway signed-in user. */
async function liveProvider({ delay }) {
  const { randomUUID } = await import('node:crypto');
  const { createClient } = await import('@supabase/supabase-js');
  const { apiKeys, projectUrl } = await import('./supabase-api.mjs');
  const url = projectUrl();
  const { anon, service_role: serviceRole } = await apiKeys();
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, serviceRole, options);
  const email = `parse-accuracy-${randomUUID()}@example.com`;
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const uid = created.data.user.id;
  const client = createClient(url, anon, options);
  const paths = [];
  let calls = 0;
  try {
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    const token = signIn.data.session.access_token;
    return {
      label: 'live (deployed parse-booking function)',
      async parse(item) {
        if (!item.file) return { booking: null, error: 'no PDF or image' };
        const ext = extname(item.file).toLowerCase();
        const path = `${uid}/imports/golden-${item.name}${ext}`;
        const up = await client.storage
          .from('originals')
          .upload(path, readFileSync(item.file), { contentType: MIME[ext], upsert: true });
        if (up.error) return { booking: null, error: `upload: ${up.error.message}` };
        paths.push(path);
        for (let attempt = 0; attempt < 4; attempt += 1) {
          if (calls++ > 0) await sleep(delay);
          const res = await fetch(`${url}/functions/v1/parse-booking`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              apikey: anon,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path }),
          });
          const body = await res.json().catch(() => ({}));
          if (body.result) return { booking: body.result.booking, answer: body.result };
          if (body.error === 'not_configured') {
            throw new Error(
              'parse-booking has no GEMINI_API_KEY: GEMINI_API_KEY=… npm run db:secrets, then rerun.',
            );
          }
          if (body.error === 'rate_limited') {
            console.log(`  rate limited on ${item.name}; waiting a minute`);
            await sleep(60_000);
            continue;
          }
          const issues = Array.isArray(body.issues) ? ` (${body.issues.join('; ')})` : '';
          return {
            booking: null,
            error: `${res.status} ${body.error ?? ''} ${body.message ?? ''}${issues}`,
          };
        }
        return { booking: null, error: 'still rate limited after 4 tries' };
      },
      async close() {
        if (paths.length) await client.storage.from('originals').remove(paths);
        await admin.auth.admin.deleteUser(uid);
      },
    };
  } catch (error) {
    await admin.auth.admin.deleteUser(uid);
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------

const show = (value) => (value === null ? '—' : `\`${String(value).replaceAll('|', '\\|')}\``);

export function renderReport({ mode, label, results, summary, date }) {
  const headline =
    mode === 'live'
      ? `**Live baseline: ${summary.percent}%** (${summary.right} of ${summary.total} fields), ` +
        `${label}, ${date}. Target ≥ 90%.`
      : `**Fixture mode: ${summary.percent}% (scorer check); live baseline pending GEMINI_API_KEY.** ` +
        `The canned answers are not model output, so this number only proves the scorer works. ` +
        `Target ≥ 90% on a live run.`;
  const lines = [
    '# Booking import accuracy',
    '',
    'Written by `scripts/parse-accuracy.mjs` (TR-28; scoring rules in ADR 0020). The golden set is',
    '12 made-up bookings in `supabase/functions/parse-booking/golden/` (made by `make-golden.py`).',
    'Live run: GitHub → Actions → Parse accuracy → Run workflow.',
    '',
    headline,
    '',
    '| Type | Bookings | Right | Fields | Accuracy |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...summary.types.map(
      (t) => `| ${TYPE_LABELS[t.type]} | ${t.bookings} | ${t.right} | ${t.total} | ${t.percent}% |`,
    ),
    `| **Overall** | ${results.length} | ${summary.right} | ${summary.total} | **${summary.percent}%** |`,
    '',
    '## Per booking',
    '',
    '| Booking | Accuracy | Misses (field: expected → got) |',
    '| --- | ---: | --- |',
    ...results.map((r) => {
      const misses = r.error
        ? `parse failed: ${r.error}`
        : r.misses.map((m) => `${m.path}: ${show(m.expected)} → ${show(m.actual)}`).join('<br>');
      return `| ${r.name} | ${percent(r.right, r.total)}% | ${misses || '—'} |`;
    }),
    '',
    `Mode: ${label}. Run: ${date}.`,
    '',
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    provider: 'live',
    out: DEFAULT_OUT,
    golden: GOLDEN_DIR,
    min: null,
    only: null,
    delay: 6000,
    record: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${flag} needs a value`);
      return value;
    };
    if (flag === '--provider') args.provider = next();
    else if (flag === '--out') args.out = resolve(next());
    else if (flag === '--min') args.min = Number(next());
    else if (flag === '--only') args.only = next().split(',');
    else if (flag === '--golden') args.golden = resolve(next());
    else if (flag === '--delay') args.delay = Number(next());
    else if (flag === '--record') args.record = true;
    else if (flag === '--json') args.json = true;
    else throw new Error(`Unknown option ${flag}`);
  }
  if (!['fixture', 'live'].includes(args.provider)) {
    throw new Error('--provider is fixture or live');
  }
  return args;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  let golden = loadGolden(args.golden);
  if (args.only) golden = golden.filter((g) => args.only.includes(g.name));
  if (golden.length === 0) throw new Error(`No golden bookings in ${args.golden}`);

  const provider =
    args.provider === 'fixture'
      ? fixtureProvider(args.golden)
      : await liveProvider({ delay: args.delay });
  const results = [];
  try {
    for (const item of golden) {
      const { booking, error, answer } = await provider.parse(item);
      const score = scoreBooking(item.expected, booking);
      results.push({ name: item.name, type: item.expected.type, error, ...score });
      if (!args.json) {
        console.log(
          `${item.name}: ${percent(score.right, score.total)}%${error ? ` (${error})` : ''}`,
        );
      }
      if (args.record && answer) {
        const file = join(args.golden, 'recorded', `${item.name}.json`);
        writeFileSync(file, `${JSON.stringify(answer, null, 2)}\n`);
      }
    }
  } finally {
    await provider.close?.();
  }

  const summary = summarise(results);
  const date = new Date().toISOString().slice(0, 10);
  const report = renderReport({
    mode: args.provider,
    label: provider.label,
    results,
    summary,
    date,
  });
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, report);

  if (args.json) {
    console.log(JSON.stringify({ summary, results }, null, 2));
  } else {
    for (const t of summary.types) console.log(`${TYPE_LABELS[t.type]}: ${t.percent}%`);
    console.log(`Overall: ${summary.percent}% (${summary.right}/${summary.total} fields)`);
    console.log(`Report: ${relative(process.cwd(), args.out) || args.out}`);
  }
  if (args.min !== null && summary.percent < args.min) {
    console.error(`Below the ${args.min}% target.`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
