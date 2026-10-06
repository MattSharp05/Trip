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
  it('rejects raw hex colours outside src/theme', async () => {
    expect(await restricted(`export const c = '#FF6B22';`, 'src/ui/Probe.ts')).toEqual([
      expect.stringContaining('Raw hex colour'),
    ]);
    expect(await restricted('export const c = `color: #fff`;', 'app/probe.tsx')).toHaveLength(1);
  });

  it('allows hex colours in src/theme', async () => {
    expect(await restricted(`export const c = '#FF6B22';`, 'src/theme/probe.ts')).toEqual([]);
  });

  it('does not mistake other # strings for colours', async () => {
    expect(await restricted(`export const c = 'Gate #12, Day #3';`, 'src/ui/Probe.ts')).toEqual([]);
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

  it('passes on arrows and en dashes used in copy', async () => {
    expect(
      await restricted(`export const r = 'JFK → LHR · Nov 12 – 16';`, 'src/ui/Probe.ts'),
    ).toEqual([]);
  });
});
