import { StyleSheet, View } from 'react-native';

import { dayIn, dayLabel } from '@/core/dates';
import { formatMoney, type Money } from '@/core/money';
import type { Expense } from '@/services/data';
import { colors, continuous, radii, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import { categoryIcon, categoryOf, expenseTitle } from './budget';

export interface ExpenseRowProps {
  expense: Expense;
  /** The amount in the trip currency; null when no rate converts it. */
  converted: Money | null;
  /** On a group trip, who paid and who it's split with ("Blake paid · split 3 ways"). */
  who?: string | null;
  /** The trip's timezone, for the day it was paid. */
  timezone: string;
  separator?: boolean;
}

/**
 * One expense: what it was and, on a group trip, who paid and who shares it (else its category and
 * day) on the left; on the right the amount in the currency it was paid in and, when that isn't
 * the trip currency, the trip-currency amount underneath.
 */
export function ExpenseRow({
  expense,
  converted,
  who = null,
  timezone,
  separator = false,
}: ExpenseRowProps) {
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
        who ?? category,
        who ? null : when,
        original,
        foreign && converted ? formatMoney(converted) : null,
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
        <Text
          variant="subhead"
          tone="secondary"
          numberOfLines={1}
          testID={`expense-row-${expense.id}-who`}
        >
          {who ?? (when ? `${category} · ${when}` : category)}
        </Text>
      </View>
      <View style={styles.amounts}>
        <Text variant="body" testID={`expense-row-${expense.id}-amount`}>
          {original}
        </Text>
        {foreign && converted ? (
          <Text variant="subhead" tone="secondary" testID={`expense-row-${expense.id}-converted`}>
            {formatMoney(converted)}
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
