import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { Surface, Text } from '@/ui';

/** One labelled value; a null value hides it (no empty labels). */
export interface Fact {
  label: string;
  value: string | null;
  /** A grey line under the value, e.g. the pickup place. */
  detail?: string | null;
}

/** A row of one to three facts side by side (Check-in | Check-out, Section | Row | Seats). */
export type FactRow = readonly Fact[];

/** The rows that still have something to show, each without its empty facts. */
export function visibleRows(rows: readonly FactRow[]): Fact[][] {
  return rows.map((row) => row.filter((fact) => Boolean(fact.value))).filter((r) => r.length > 0);
}

/** A card of labelled booking facts; rows and facts without a value don't render. */
export function Facts({ rows, testID }: { rows: readonly FactRow[]; testID?: string }) {
  const visible = visibleRows(rows);
  if (visible.length === 0) return null;
  return (
    <Surface padding="none" testID={testID}>
      {visible.map((row, r) => (
        <View key={row.map((f) => f.label).join('|')} style={[styles.row, r > 0 && styles.divider]}>
          {row.map((fact) => (
            <View key={fact.label} style={styles.fact}>
              <Text variant="caption" tone="secondary">
                {fact.label}
              </Text>
              <Text variant="body" style={styles.value}>
                {fact.value}
              </Text>
              {fact.detail ? (
                <Text variant="subhead" tone="secondary">
                  {fact.detail}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </Surface>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  fact: { flex: 1, gap: spacing.xxs },
  value: { fontWeight: '500' },
});
