import fs from 'fs';
import path from 'path';

import { findScenario } from '@/scenarios';

// Static checks on the Maestro flows (TR-41). They only run on main's E2E job, so a mistake here
// shows up after the merge; these catch the ones that can be read from the files.
const maestro = path.join(__dirname, '..', 'maestro');

function flowFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) return flowFiles(file);
    return e.name.endsWith('.yaml') ? [file] : [];
  });
}

/** The keys of an indented `KEY: value` block that starts after `line`. */
function keysUnder(lines: string[], line: number): Record<string, string> {
  const indent = (s: string) => s.length - s.trimStart().length;
  const own = indent(lines[line]);
  const keys: Record<string, string> = {};
  for (let i = line + 1; i < lines.length && indent(lines[i]) > own; i++) {
    const m = /^\s*([A-Z_]+):\s*(.*)$/.exec(lines[i]);
    if (m) keys[m[1]] = m[2];
  }
  return keys;
}

/** The flow's own `env:` defaults (its config, before `---`). */
function defaults(file: string): Record<string, string> {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const end = lines.indexOf('---');
  const env = lines.slice(0, end).findIndex((l) => l === 'env:');
  return env === -1 ? {} : keysUnder(lines, env);
}

/** Every `runFlow` with a `file:` and an `env:` in the flow. */
function subflowCalls(file: string): { file: string; env: Record<string, string> }[] {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const calls: { file: string; env: Record<string, string> }[] = [];
  lines.forEach((line, i) => {
    const target = /^\s*file:\s*(\S+)/.exec(line);
    if (!target || !/^\s*env:\s*$/.test(lines[i + 1] ?? '')) return;
    calls.push({
      file: path.resolve(path.dirname(file), target[1]),
      env: keysUnder(lines, i + 1),
    });
  });
  return calls;
}

const flows = flowFiles(maestro);
const calls = flows.flatMap((f) => subflowCalls(f).map((c) => ({ caller: f, ...c })));

describe('Maestro flows', () => {
  it('finds the flows and their subflow calls', () => {
    expect(flows.length).toBeGreaterThan(5);
    expect(calls.some((c) => c.file.endsWith('scenario.yaml'))).toBe(true);
  });

  // A subflow's own env is applied after the caller's, so a default there replaces the value passed
  // in (every shot used to open vegas-plan-day-2). The same value, like APP_ID, does no harm.
  it.each(calls.map((c) => [path.relative(maestro, c.caller), path.basename(c.file), c] as const))(
    '%s → %s: no subflow default overrides what is passed in',
    (_caller, _file, call) => {
      const own = defaults(call.file);
      for (const [key, value] of Object.entries(call.env)) {
        if (key in own) expect(`${key}: ${own[key]}`).toBe(`${key}: ${value}`);
      }
    },
  );

  it('opens scenarios that exist, each with a READY_ID', () => {
    const scenarioCalls = calls.filter((c) => c.file.endsWith('scenario.yaml'));
    for (const call of scenarioCalls) {
      expect([call.env.SCENARIO, findScenario(call.env.SCENARIO)?.name]).toEqual([
        call.env.SCENARIO,
        call.env.SCENARIO,
      ]);
      expect(call.env.READY_ID).toBeTruthy();
    }
  });
});
