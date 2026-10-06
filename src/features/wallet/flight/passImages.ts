import type { ImageSourcePropType } from 'react-native';

const FIXTURE = 'fixture:';

/** Scenario samples, bundled with the app (synthetic; see assets/sample/CREDITS.md). */
const FIXTURES: Record<string, number> = {
  'boarding-pass-aa2410': require('../../../../assets/sample/boarding-pass-aa2410.png'),
};

/** A bundled sample's module, for `fixture:<name>`; undefined for anything else. */
export function fixtureModule(uri: string): number | undefined {
  return uri.startsWith(FIXTURE) ? FIXTURES[uri.slice(FIXTURE.length)] : undefined;
}

/** What an Image draws for a pass image's `uri`: a bundled sample or a local file. */
export function passImageSource(uri: string): ImageSourcePropType {
  return fixtureModule(uri) ?? { uri };
}
