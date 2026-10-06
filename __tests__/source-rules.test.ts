import { ESLint } from 'eslint';
import path from 'path';

// The lint rules behind docs/design.md: colours only from src/theme, no emoji anywhere.
const root = path.join(__dirname, '..');
// Pass the config in directly: ESLint's own config-file loader needs dynamic import(), which Jest lacks.
const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: require('../eslint.config.js'),
});

async function restricted(code: string, file: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, file) });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-syntax').map((m) => m.message);
}

describe('source rules (ESLint)', () => {
  it('rejects raw colours outside src/theme', async () => {
    expect(await restricted(`export const c = '#FF6B22';`, 'src/ui/Probe.ts')).toEqual([
      expect.stringContaining('Raw colour'),
    ]);
    expect(
      await restricted('export const c = `linear-gradient(#fff, ${x})`;', 'app/probe.tsx'),
    ).toHaveLength(1);
    expect(
      await restricted(`export const c = 'rgba(0, 0, 0, 0.5)';`, 'src/ui/Probe.ts'),
    ).toHaveLength(1);
  });

  it('allows hex colours in src/theme', async () => {
    expect(await restricted(`export const c = '#FF6B22';`, 'src/theme/probe.ts')).toEqual([]);
  });

  it('does not mistake other # strings for colours', async () => {
    for (const copy of ['Gate #123', 'Room #4521', 'Confirmation #ABC123', '#cafe in Paris']) {
      expect(await restricted(`export const c = '${copy}';`, 'src/ui/Probe.ts')).toEqual([]);
    }
  });

  it('rejects emoji in strings and JSX text, theme included', async () => {
    expect(await restricted(`export const w = 'Sunny ☀️';`, 'src/core/probe.ts')).toEqual([
      expect.stringContaining('No emoji'),
    ]);
    expect(
      await restricted(`export const P = () => <Text>Trip ✈️</Text>;`, 'app/probe.tsx'),
    ).toEqual([expect.stringContaining('No emoji')]);
    expect(await restricted(`export const w = '\u{1F30D}';`, 'src/theme/probe.ts')).toHaveLength(1);
  });

  it('passes on text symbols used in copy', async () => {
    expect(
      await restricted(
        `export const r = 'JFK → LHR ↔ CDG · Nov 12 – 16 · Bonvoy® · Honors™ · © 2026';`,
        'src/ui/Probe.ts',
      ),
    ).toEqual([]);
  });
});
