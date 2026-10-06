import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { dateRangeLabel } from '@/core/dates';
import { convert, formatMoney } from '@/core/money';
import { usePreferences } from '@/features/settings';
import { useTripData } from '@/services/data';
import { useRates } from '@/services/rates';
import { useScenarioStore } from '@/stores/scenario';
import { useTripStore } from '@/stores/trip';
import { colors, continuous, radii, screenPadding, spacing } from '@/theme';
import { Button, Icon, ListRow, Segmented, Skeleton, Surface, Text } from '@/ui';

import { AddExpenseSheet } from './AddExpenseSheet';
import {
  categoryIcon,
  categoryOf,
  recentFirst,
  summarize,
  type BudgetSummary,
  type Category,
} from './budget';
import { BudgetTotalSheet } from './BudgetTotalSheet';
import { CurrencySheet } from './CurrencySheet';
import { ExpenseRow } from './ExpenseRow';

type BudgetTab = 'categories' | 'expenses';

const TABS = [
  { value: 'categories', label: 'Categories' },
  { value: 'expenses', label: 'Expenses' },
] as const;

/**
 * Organize → Budget for the selected trip: the total, spent and left with a progress bar, totals
 * per category, and every expense in its original currency next to the display currency. The
 * display currency starts at the home currency (or the scenario's) and switches from the header;
 * stored amounts never change.
 */
export function BudgetScreen() {
  const tripId = useTripStore((s) => s.selectedTripId);
  const tripData = useTripData(tripId);
  const { preferences } = usePreferences();
  // A scenario can open the budget in a currency; read once, on mount.
  const [picked, setPicked] = useState<string | null>(
    () => useScenarioStore.getState().view.currency ?? null,
  );
  const display = picked ?? preferences.homeCurrency;
  const rates = useRates(display);
  const [tab, setTab] = useState<BudgetTab>('categories');
  const [filter, setFilter] = useState<Category | null>(null);
  const [sheet, setSheet] = useState<'currency' | 'total' | 'expense' | null>(null);
  const close = () => setSheet(null);

  const data = tripData.data;
  const expenses = data?.expenses;
  const needsRates =
    !!data &&
    [...(expenses ?? []), ...(data.trip.budget ? [data.trip.budget] : [])].some(
      (m) => m.currency !== display,
    );
  const summary = useMemo(
    () => (data ? summarize(data.expenses, data.trip.budget, display, rates.data) : null),
    [data, display, rates.data],
  );
  const rows = useMemo(() => recentFirst(expenses ?? []), [expenses]);

  if (tripData.isError) {
    return (
      <View style={styles.empty} testID="budget-slot">
        <Text variant="headline">{"Couldn't load the budget"}</Text>
        <Text variant="subhead" tone="secondary" style={styles.centered}>
          Check your connection and try again.
        </Text>
      </View>
    );
  }

  // No trip selected, or the selected one is gone.
  if (tripId === null || (!tripData.isPending && !data)) {
    return (
      <View style={styles.empty} testID="budget-slot">
        <Text variant="headline">No trip selected</Text>
        <Text variant="subhead" tone="secondary" style={styles.centered}>
          Pick a trip on the Trips tab to see its budget.
        </Text>
      </View>
    );
  }

  const loading = tripData.isPending || (needsRates && rates.isPending);
  if (loading || !data || !summary) {
    return (
      <View style={styles.content} testID="budget-slot">
        <Skeleton height={130} radius="card" />
        <Skeleton height={30} radius="card" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={56} radius="card" />
        ))}
      </View>
    );
  }

  const trip = data.trip;
  const shown = filter ? rows.filter((e) => categoryOf(e) === filter) : rows;

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} testID="budget-slot">
        <View style={styles.header}>
          <Text variant="subhead" tone="secondary" style={styles.flex} numberOfLines={1}>
            {`${trip.city} · ${dateRangeLabel(trip.startDate, trip.endDate)}`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Show amounts in ${display}. Change currency`}
            onPress={() => setSheet('currency')}
            style={({ pressed }) => [styles.currency, pressed && styles.pressed]}
            testID="budget-currency"
          >
            <Text variant="subhead" style={styles.currencyLabel}>
              {display}
            </Text>
            <Icon name="chevron.down" size="sm" tone="secondary" />
          </Pressable>
        </View>

        <SummaryCard summary={summary} onEdit={() => setSheet('total')} />

        {rates.isError && needsRates ? (
          <Text variant="subhead" tone="secondary" testID="budget-rates-error">
            {`Couldn't load today's exchange rates. Amounts not in ${display} are left out of the totals.`}
          </Text>
        ) : null}

        <Segmented segments={TABS} value={tab} onChange={setTab} testID="budget-tabs" />

        {tab === 'categories' ? (
          <Surface padding="none" testID="budget-categories">
            {summary.categories.map((c, i) => (
              <ListRow
                key={c.category}
                icon={categoryIcon(c.category)}
                title={c.category}
                value={formatMoney(c.total, { whole: true })}
                onPress={() => {
                  setFilter(c.category);
                  setTab('expenses');
                }}
                separator={i < summary.categories.length - 1}
                testID={`budget-category-${c.category}`}
              />
            ))}
          </Surface>
        ) : (
          <View style={styles.expenses}>
            {filter ? (
              <View style={styles.filterRow}>
                <Text variant="headline">{filter}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setFilter(null)}
                  hitSlop={spacing.sm}
                  testID="budget-filter-clear"
                >
                  <Text variant="subhead" tone="accent">
                    Show all
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {shown.length === 0 ? (
              <View style={styles.empty} testID="budget-expenses-empty">
                <Text variant="headline">No expenses yet</Text>
                <Text variant="subhead" tone="secondary" style={styles.centered}>
                  Add what you pay for on this trip, in any currency.
                </Text>
              </View>
            ) : (
              <Surface padding="none" testID="budget-expenses">
                {shown.map((expense, i) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    converted={convert(expense, display, rates.data)}
                    timezone={trip.timezone}
                    separator={i < shown.length - 1}
                  />
                ))}
              </Surface>
            )}
          </View>
        )}

        <Button
          label="Add expense"
          icon="plus"
          onPress={() => setSheet('expense')}
          testID="budget-add-expense"
        />
      </ScrollView>

      <CurrencySheet
        open={sheet === 'currency'}
        value={display}
        onChange={(code) => {
          setPicked(code);
          close();
        }}
        onClose={close}
      />
      <BudgetTotalSheet
        open={sheet === 'total'}
        onClose={close}
        tripId={trip.id}
        budget={trip.budget ?? null}
        currency={display}
      />
      <AddExpenseSheet
        open={sheet === 'expense'}
        onClose={close}
        trip={trip}
        homeCurrency={preferences.homeCurrency}
        onSaved={() => {
          setFilter(null);
          setTab('expenses');
        }}
      />
    </>
  );
}

function SummaryCard({ summary, onEdit }: { summary: BudgetSummary; onEdit: () => void }) {
  const { total, spent, left, progress } = summary;
  const over = left !== null && left.amountMinor < 0;
  return (
    <Surface testID="budget-summary">
      <View style={styles.summaryTop}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Change the total budget"
          onPress={onEdit}
          style={styles.flex}
          testID="budget-total"
        >
          <Text variant="subhead" tone="secondary">
            Total budget
          </Text>
          {total ? (
            <Text variant="largeTitle" testID="budget-total-amount">
              {formatMoney(total, { whole: true })}
            </Text>
          ) : (
            <Text variant="title" tone="accent" style={styles.setBudget}>
              Set a budget
            </Text>
          )}
        </Pressable>
        <View style={styles.summaryRight}>
          <Text variant="subhead" testID="budget-spent">
            {`${formatMoney(spent, { whole: true })} spent`}
          </Text>
          {left ? (
            <Text variant="subhead" tone="secondary" testID="budget-left">
              {over
                ? `${formatMoney({ ...left, amountMinor: -left.amountMinor }, { whole: true })} over`
                : `${formatMoney(left, { whole: true })} left`}
            </Text>
          ) : null}
        </View>
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        testID="budget-progress"
      >
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingHorizontal: screenPadding, paddingBottom: spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  currency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  currencyLabel: { fontWeight: '600' },
  pressed: { backgroundColor: colors.fill },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  summaryRight: { alignItems: 'flex-end', gap: spacing.xxs, paddingBottom: spacing.xs },
  setBudget: { paddingVertical: spacing.xs },
  track: {
    height: 8,
    marginTop: spacing.lg,
    borderRadius: radii.pill,
    ...continuous,
    backgroundColor: colors.raised,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.accent },
  expenses: { gap: spacing.md },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xxxl },
  centered: { textAlign: 'center' },
});
