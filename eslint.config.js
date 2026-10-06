// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

// Raw colours belong in src/theme only (docs/design.md tokens): a string that is a hex, rgb() or
// hsl() colour, or a hex inside a CSS function. Copy such as "Gate #123" or "Ref #ABC123" passes.
const HEX = '#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})';
const COLOR = `/^\\s*(${HEX}|(rgba?|hsla?)\\(.*)\\s*$|[(,]\\s*${HEX}\\b/`;
// Emoji are never used in the UI (docs/design.md → Never); use SF Symbols instead. Text symbols
// such as © ® ™ → stay allowed; their emoji forms (with the U+FE0F selector) don't.
const EMOJI = '/\\p{Emoji_Presentation}|\\uFE0F/u';

const hexRules = [
  { selector: `Literal[value=${COLOR}]`, message: 'Raw colour: use a token from @/theme.' },
  {
    selector: `TemplateElement[value.raw=${COLOR}]`,
    message: 'Raw colour: use a token from @/theme.',
  },
];
const emojiRules = [
  { selector: `Literal[value=${EMOJI}]`, message: 'No emoji in the app: use an SF Symbol.' },
  {
    selector: `TemplateElement[value.raw=${EMOJI}]`,
    message: 'No emoji in the app: use an SF Symbol.',
  },
  { selector: `JSXText[value=${EMOJI}]`, message: 'No emoji in the app: use an SF Symbol.' },
];

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'expo-env.d.ts'],
  },
  {
    // Named exports only outside Expo Router's app/ (TDD → Conventions).
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'import/no-default-export': 'error',
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...hexRules, ...emojiRules] },
  },
  {
    // Passport and visa data never reaches AI (ADR 0004, TR-20): the documents feature can't import
    // the Edge Function caller or any parse/import/AI module. Checked by noAi.test.ts.
    files: ['src/features/documents/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)(services/functions|features/(import|smart-?add|discover))(/|$)',
              message: 'Documents never go to AI: no Edge Function or import pipeline here.',
            },
            {
              regex:
                '(^|/)([^/]*([Pp]arse|[Gg]emini|[Cc]laude|[Aa]nthropic|[Oo]pen[Aa][Ii])[^/]*|ai([-_.][^/]*)?)(/|$)',
              message: 'Documents never go to AI: no parse or AI modules here.',
            },
          ],
        },
      ],
    },
  },
  {
    // The tokens themselves; emoji stay banned here too.
    files: ['src/theme/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...emojiRules] },
  },
]);
