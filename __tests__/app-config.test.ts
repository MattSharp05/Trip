import appJson from '../app.json';

// ADR 0005: every merge publishes an EAS Update that Expo Go opens from the `main` channel.
// Expo Go only loads updates whose runtime version is the SDK version.
describe('EAS Update config', () => {
  const { expo } = appJson;

  it('uses the sdkVersion runtime policy so Expo Go can load updates', () => {
    expect(expo.runtimeVersion).toEqual({ policy: 'sdkVersion' });
  });

  it('points updates at this EAS project', () => {
    expect(expo.updates.url).toBe(`https://u.expo.dev/${expo.extra.eas.projectId}`);
  });
});
