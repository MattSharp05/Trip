import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { findScenario, loadScenario, scenariosEnabled, TAB_HREF } from '@/scenarios';
import { useScenarioStore } from '@/stores/scenario';
import { colors, spacing } from '@/theme';
import { Button, Text } from '@/ui';

/**
 * Deep link into a scenario: `exp://u.expo.dev/<project>/--/scenario/<name>?runtime-version=exposdk:57.0.0&channel-name=main`
 * (Expo Go) or `trip://scenario/<name>`. Loads the demo session, then opens the scenario's tab.
 */
export default function ScenarioRoute() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const enabled = scenariosEnabled();
  const scenario = findScenario(name);
  const active = useScenarioStore((s) => s.active);

  useEffect(() => {
    if (enabled && scenario) loadScenario(scenario.name);
  }, [enabled, scenario]);

  if (!enabled) return <Redirect href="/trips" />;
  if (scenario && active === scenario.name) return <Redirect href={TAB_HREF[scenario.tab]} />;
  return (
    <View style={styles.screen}>
      {scenario ? null : (
        <>
          <Text variant="headline">Unknown scenario</Text>
          <Text variant="body" tone="secondary">
            {name}
          </Text>
          <Link href="/dev" asChild>
            <Button label="All scenarios" variant="secondary" />
          </Link>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
});
