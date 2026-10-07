import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The accuracy script (TR-28) runs as plain Node; these tests run it the way CI's live workflow
// does, against the canned answers (`--provider fixture`), so no model or network is involved.

const SCRIPT = join(__dirname, 'parse-accuracy.mjs');
const GOLDEN = join(__dirname, '../supabase/functions/parse-booking/golden');

interface Run {
  summary: { percent: number; right: number; total: number; types: { type: string }[] };
  results: {
    name: string;
    right: number;
    total: number;
    error?: string;
    misses: { path: string }[];
  }[];
}

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'parse-accuracy-'));
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

function run(args: string[]): Run {
  const out = execFileSync(
    process.execPath,
    [SCRIPT, '--provider', 'fixture', '--json', '--out', join(tmp, 'report.md'), ...args],
    { encoding: 'utf8' },
  );
  return JSON.parse(out);
}

/** A one-off golden set: expected bookings and the canned answers to score against them. */
function goldenSet(cases: Record<string, { expected: unknown; answer?: unknown }>): string {
  const dir = join(tmp, 'golden');
  mkdirSync(join(dir, 'recorded'), { recursive: true });
  for (const [name, { expected, answer }] of Object.entries(cases)) {
    writeFileSync(join(dir, `${name}.expected.json`), JSON.stringify(expected));
    writeFileSync(join(dir, `${name}.png`), '');
    if (answer !== undefined) {
      writeFileSync(join(dir, 'recorded', `${name}.json`), JSON.stringify({ booking: answer }));
    }
  }
  return dir;
}

const reservation = {
  type: 'reservation',
  venue: { name: 'Ember & Oak', address: null, city: 'San Diego', country: null },
  starts: { date: '2026-06-15', time: '19:30' },
  partySize: 4,
  confirmation: null,
  price: { amount: 40.5, currency: 'USD' },
};

describe('parse-accuracy', () => {
  it('scores the golden set: 12 bookings of all five types, and writes the report', () => {
    const { summary, results } = run([]);
    expect(results).toHaveLength(12);
    expect(summary.types.map((t) => t.type)).toEqual([
      'flight',
      'hotel',
      'car',
      'ticket',
      'reservation',
    ]);
    // The canned answers carry 7 deliberate slips (see golden/make-golden.py).
    expect(summary.total - summary.right).toBe(7);
    expect(summary.percent).toBe(96.4);
    expect(results.every((r) => !r.error)).toBe(true);
    const report = readFileSync(join(tmp, 'report.md'), 'utf8');
    expect(report).toContain('Fixture mode: 96.4% (scorer check); live baseline pending');
    expect(report).toContain('| **Overall** | 12 | 186 | 193 | **96.4%** |');
  });

  it('has a PDF or image and a canned answer for every golden booking', () => {
    for (const { name } of run([]).results) {
      const file = ['pdf', 'png'].some((ext) => existsSync(join(GOLDEN, `${name}.${ext}`)));
      expect(file).toBe(true);
      expect(existsSync(join(GOLDEN, 'recorded', `${name}.json`))).toBe(true);
    }
  });

  it('accepts the same value written differently', () => {
    const golden = goldenSet({
      r: {
        expected: reservation,
        answer: {
          ...reservation,
          venue: { name: 'EMBER AND OAK', city: ' san diego ', lat: 32.7, lng: -117.1 },
          starts: { date: '2026-06-15T19:30:00', time: '7:30 PM' },
          partySize: '4',
          price: { amount: 40.499, currency: 'usd' },
        },
      },
    });
    const { results } = run(['--golden', golden]);
    expect(results[0]).toMatchObject({ right: 8, total: 8, misses: [] });
  });

  it('counts wrong values, missing values and extra fields as misses', () => {
    const golden = goldenSet({
      r: {
        expected: reservation,
        answer: {
          ...reservation,
          starts: { date: '2026-06-16', time: '19:30' },
          partySize: null,
          confirmation: 'R-1',
        },
      },
    });
    const { results } = run(['--golden', golden]);
    expect(results[0]).toMatchObject({ right: 6, total: 9 });
    expect(results[0].misses.map((m) => m.path)).toEqual([
      'starts.date',
      'partySize',
      'confirmation',
    ]);
  });

  it('scores a booking with no answer as 0 and fails under --min', () => {
    const golden = goldenSet({ r: { expected: reservation } });
    const { results } = run(['--golden', golden]);
    expect(results[0]).toMatchObject({ right: 0, total: 8 });
    expect(results[0].error).toMatch(/no recorded answer/);
    const plain = ['--provider', 'fixture', '--golden', golden, '--out', join(tmp, 'r.md')];
    const exec = (args: string[]) =>
      execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', stdio: 'pipe' });
    expect(() => exec(plain)).not.toThrow();
    expect(() => exec([...plain, '--min', '90'])).toThrow();
  });
});
