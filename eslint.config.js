// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

// Raw colours (#RGB, #RRGGBB, #RRGGBBAA) belong in src/theme only (docs/design.md tokens).
const HEX = '/#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/';
// Emoji are never used in the UI (docs/design.md → Never); use SF Symbols instead.
const EMOJI = '/\\p{Extended_Pictographic}/u';

const hexRules = [
  { selector: `Literal[value=${HEX}]`, message: 'Raw hex colour: use a token from @/theme.' },
  {
    selector: `TemplateElement[value.raw=${HEX}]`,
    message: 'Raw hex colour: use a token from @/theme.',
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
    // The tokens themselves; emoji stay banned here too.
    files: ['src/theme/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...emojiRules] },
  },
]);
