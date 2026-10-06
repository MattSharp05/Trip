import { Redirect, useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadScenario, SCENARIOS, scenariosEnabled, TAB_HREF } from '@/scenarios';
import { colors, screenPadding, spacing } from '@/theme';
import { ListRow, Surface, Text } from '@/ui';

const TOOLS: { title: string; href: Href }[] = [
  { title: 'Design gallery', href: '/dev/gallery' },
  // TR-5 spike; TR-13 removes it.
  { title: 'Map spike', href: '/dev/map-spike' },
];

/** Developer index: every scenario (tap to load it) and the developer screens. */
export default function DevIndexScreen() {
  return scenariosEnabled() ? <DevIndex /> : <Redirect href="/trips" />;
}

function DevIndex() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const open = (name: string) => {
    const tab = loadScenario(name);
    if (tab) router.replace(TAB_HREF[tab]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
      ]}
    >
      <Text variant="largeTitle" accessibilityRole="header">
        Developer
      </Text>

      <Text variant="subhead" tone="secondary" style={styles.sectionTitle}>
        SCENARIOS
      </Text>
      <Surface padding="none" style={styles.card}>
        {SCENARIOS.map((s, i) => (
          <ListRow
            key={s.name}
            title={s.name}
            subtitle={s.description}
            onPress={() => open(s.name)}
            separator={i < SCENARIOS.length - 1}
          />
        ))}
      </Surface>

      <Text variant="subhead" tone="secondary" style={styles.sectionTitle}>
        SCREENS
      </Text>
      <Surface padding="none" style={styles.card}>
        {TOOLS.map((t, i) => (
          <ListRow
            key={t.title}
            title={t.title}
            onPress={() => router.push(t.href)}
            separator={i < TOOLS.length - 1}
          />
        ))}
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, gap: spacing.sm },
  sectionTitle: { marginTop: spacing.lg },
  card: { overflow: 'hidden' },
});
