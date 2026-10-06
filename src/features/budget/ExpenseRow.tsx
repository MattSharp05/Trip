import { StyleSheet, View } from 'react-native';

import { dayIn, dayLabel } from '@/core/dates';
import { formatMoney, type Money } from '@/core/money';
import type { Expense } from '@/services/data';
import { colors, continuous, radii, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import { categoryIcon, categoryOf, expenseTitle } from './budget';

export interface ExpenseRowProps {
  expense: Expense;
  /** The amount in the display currency; null when rates can't convert it. */
  converted: Money | null;
  /** The trip's timezone, for the day it was paid. */
  timezone: string;
  separator?: boolean;
}

/**
 * One expense: what and when on the left; on the right the amount in the display currency and,
 * when it was paid in another one, the original amount underneath.
 */
export function ExpenseRow({ expense, converted, timezone, separator = false }: ExpenseRowProps) {
  const category = categoryOf(expense);
  const original = formatMoney(expense);
  const foreign = expense.currency !== converted?.currency;
  const when = expense.paidAt ? dayLabel(dayIn(timezone, new Date(expense.paidAt))) : null;

  return (
    <View
      style={[styles.row, separator && styles.separator]}
      testID={`expense-row-${expense.id}`}
      accessible
      accessibilityLabel={[
        expenseTitle(expense),
        category,
        when,
        converted ? formatMoney(converted) : null,
        foreign ? `paid ${original}` : null,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      <View style={styles.tile}>
        <Icon name={categoryIcon(category)} size="md" />
      </View>
      <View style={styles.text}>
        <Text variant="body" style={styles.title} numberOfLines={1}>
          {expenseTitle(expense)}
        </Text>
        <Text variant="subhead" tone="secondary" numberOfLines={1}>
          {when ? `${category} · ${when}` : category}
        </Text>
      </View>
      <View style={styles.amounts}>
        <Text variant="body" testID={`expense-row-${expense.id}-amount`}>
          {converted ? formatMoney(converted) : original}
        </Text>
        {foreign && converted ? (
          <Text variant="subhead" tone="secondary" testID={`expense-row-${expense.id}-original`}>
            {original}
          </Text>
        ) : null}
        {!converted ? (
          <Text variant="subhead" tone="secondary">
            No rate
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    ...continuous,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  text: { flex: 1, gap: spacing.xxs },
  title: { fontWeight: '500' },
  amounts: { alignItems: 'flex-end', gap: spacing.xxs },
});
