import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import { HOME_CURRENCIES } from './preferences';
import { SettingsGroup, SettingsScroll } from './SettingsList';
import { usePreferences } from './usePreferences';

/** Pick the home currency: one row per ISO code, the current one ticked in orange. */
export function CurrencyScreen() {
  const router = useRouter();
  const { preferences, setPreference } = usePreferences();

  const choose = (code: string) => {
    void setPreference('homeCurrency', code);
    router.back();
  };

  return (
    <SettingsScroll testID="currency-list">
      <SettingsGroup footer="Rates come from the European Central Bank, updated daily.">
        {HOME_CURRENCIES.map((c, i) => {
          const selected = c.code === preferences.homeCurrency;
          return (
            <Pressable
              key={c.code}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${c.name}, ${c.code}`}
              onPress={() => choose(c.code)}
              testID={`currency-${c.code}`}
              style={({ pressed }) => [
                styles.row,
                i < HOME_CURRENCIES.length - 1 && styles.separator,
                pressed && styles.pressed,
              ]}
            >
              <Text variant="body" style={styles.code}>
                {c.code}
              </Text>
              <Text variant="body" tone="secondary" style={styles.name} numberOfLines={1}>
                {c.name}
              </Text>
              <View style={styles.check}>
                {selected ? <Icon name="checkmark" size="sm" selected /> : null}
              </View>
            </Pressable>
          );
        })}
      </SettingsGroup>
    </SettingsScroll>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  pressed: { backgroundColor: colors.fill },
  code: { width: 48, fontWeight: '500' },
  name: { flex: 1 },
  check: { width: 20, alignItems: 'center' },
});
