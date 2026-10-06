import fs from 'fs';
import path from 'path';

import { ESLint } from 'eslint';

/**
 * TR-20 / ADR 0004: passport and visa data and photos are never sent to AI (Gemini's free tier
 * may use prompts to improve Google's products). Two guards: the lint rule in eslint.config.js,
 * proven to fire here, and a scan of this folder for anything that could reach an Edge Function.
 */

const root = path.join(__dirname, '..', '..', '..');
const probe = path.join(root, 'src', 'features', 'documents', 'probe.ts');

async function lintErrors(code: string): Promise<string[]> {
  // The config is passed in, not looked up: ESLint loads config files with a dynamic import,
  // which Jest's VM doesn't support.
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    overrideConfig: require('../../../eslint.config.js'),
  });
  const [result] = await eslint.lintText(code, { filePath: probe });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports').map((m) => m.message);
}

describe('documents never reach AI', () => {
  it.each([
    "import { invokeFunction } from '@/services/functions';",
    "import { invokeFunction } from '../../services/functions';",
    "import { parseBooking } from '@/services/parse';",
    "import { parseBooking } from '@/services/parseBooking';",
    "import { parseLink } from '@/services/parse-link';",
    "import { schema } from '@/core/parse/schema';",
    "import { review } from '@/features/import/review';",
    "import { smartAdd } from '@/features/smart-add';",
    "import { gemini } from '@/services/gemini';",
    "import { ai } from '@/services/ai';",
  ])(
    'the lint rule rejects %s',
    async (line) => {
      expect(await lintErrors(`${line}\nexport const x = 1;\n`)).not.toEqual([]);
    },
    30_000,
  );

  it('the lint rule allows the data layer, Storage and the picker', async () => {
    const code = [
      "import { useDocuments } from '@/services/data';",
      "import { supabase } from '@/services/supabase';",
      "import * as ImagePicker from 'expo-image-picker';",
      "import { DocumentPhoto } from './DocumentPhoto';",
      'export const x = [useDocuments, supabase, ImagePicker, DocumentPhoto];',
    ].join('\n');
    expect(await lintErrors(code)).toEqual([]);
  }, 30_000);

  it('no file in src/features/documents calls an Edge Function', () => {
    const dir = __dirname;
    const offenders = fs
      .readdirSync(dir)
      .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts'))
      .filter((f) =>
        /functions\.invoke|invokeFunction|parse-booking|parse-link/.test(
          fs.readFileSync(path.join(dir, f), 'utf8'),
        ),
      );
    expect(offenders).toEqual([]);
  });
});
