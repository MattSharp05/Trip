import fs from 'fs';
import path from 'path';

import bundledNativeModules from 'expo/bundledNativeModules.json';

import pkg from '../package.json';

// ADR 0001: until Phase B, every dependency with native code must ship inside Expo Go,
// i.e. be on the SDK's bundled-module list. Pure-JS packages are fine.
function hasNativeCode(name: string): boolean {
  const dir = path.join(__dirname, '..', 'node_modules', name);
  const entries = fs.readdirSync(dir);
  return (
    entries.includes('ios') ||
    entries.includes('expo-module.config.json') ||
    entries.some((f: string) => f.endsWith('.podspec'))
  );
}

describe('Expo Go compatibility', () => {
  it('has no native dependency outside the Expo SDK bundle', () => {
    const offenders = Object.keys(pkg.dependencies).filter(
      (name) => name !== 'expo' && hasNativeCode(name) && !(name in bundledNativeModules),
    );
    expect(offenders).toEqual([]);
  });
});
