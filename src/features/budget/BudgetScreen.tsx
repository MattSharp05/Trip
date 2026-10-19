import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { dateRangeLabel } from '@/core/dates';
import { FALLBACK_NAME, memberLabel } from '@/core/members';
import { formatMoney } from '@/core/money';
import { pairBalances } from '@/core/settle';
import { usePreferences } from '@/features/settings';
import { useSaveTripCurrency, useTripData, useTripMembers } from '@/services/data';
import { useRates } from '@/services/rates';
import { useScenarioStore } from '@/stores/scenario';
import { useTripStore } from '@/stores/trip';
import { colors, continuous, radii, screenPadding, spacing } from '@/theme';
import { Button, Icon, ListRow, Segmented, Skeleton, Surface, Text, useTabBarInset } from '@/ui';

import { AddExpenseSheet } from './AddExpenseSheet';
import { toLedger } from './balances';
import { BalancesList } from './BalancesList';
import {
  categoryIcon,
  categoryOf,
  needsLiveRate,
  recentFirst,
  splitLine,
  summarize,
  tripAmount,
  tripCurrencyOf,
  type BudgetSummary,
  type Category,
} from './budget';
import { BudgetTotalSheet } from './BudgetTotalSheet';
import { CurrencySheet } from './CurrencySheet';
import { ExpenseRow } from './ExpenseRow';

type BudgetTab = 'categories' | 'expenses' | 'balances';

const TABS = [
  { value: 'categories', label: 'Categories' },
  { value: 'expenses', label: 'All' },
] as const;

/** On a group trip, a third segment: who owes whom (TR-65). */
const GROUP_TABS = [...TABS, { value: 'balances', label: 'Balances' }] as const;

/**
 * Organize → Expenses for the selected trip, shared by everyone on it (ADR 0030): the total, spent
 * and left with a progress bar, totals per category, and every expense in the currency it was paid
 * in next to the trip currency, with who paid and who it's split with. The trip currency switches
 * from the header, for everyone; stored amounts never change.
 */
export function BudgetScreen() {
  const tabBarInset = useTabBarInset();
  const tripId = useTripStore((s) => s.selectedTripId);
  const tripData = useTripData(tripId);
  const members = useTripMembers(tripId);
  const saveCurrency = useSaveTripCurrency();
  const { preferences } = usePreferences();
  // A scenario can open the expenses in a currency; read once, on mount.
  const [picked, setPicked] = useState<string | null>(
    () => useScenarioStore.getState().view.currency ?? null,
  );
  const display = picked ?? (tripData.data ? tripCurrencyOf(tripData.data.trip) : 'USD');
  const rates = useRates(display);
  // A scenario can open a segment; read once, on mount.
  const [tab, setTab] = useState<BudgetTab>(
    () => useScenarioStore.getState().view.budgetTab ?? 'categories',
  );
  const [filter, setFilter] = useState<Category | null>(null);
  const [sheet, setSheet] = useState<'currency' | 'total' | 'expense' | null>(null);
  const [currencyFailed, setCurrencyFailed] = useState(false);
  const close = () => setSheet(null);

  const data = tripData.data;
  const expenses = data?.expenses;
  const needsRates =
    !!data &&
    ((expenses ?? []).some((e) => needsLiveRate(e, display)) ||
      (!!data.trip.budget && data.trip.budget.currency !== display));
  const summary = useMemo(
    () => (data ? summarize(data.expenses, data.trip.budget, display, rates.data) : null),
    [data, display, rates.data],
  );
  const rows = useMemo(() => recentFirst(expenses ?? []), [expenses]);

  const memberList = members.data;
  const me = memberList?.find((m) => m.isMe)?.id ?? '';
  const nameOf = (id: string) => {
    const member = memberList?.find((m) => m.id === id);
    return member ? memberLabel(member) : FALLBACK_NAME;
  };
  const group = (memberList?.length ?? 0) > 1;
  const balances = useMemo(
    () =>
      expenses && memberList && me
        ? pairBalances(
            toLedger(expenses, me, display, rates.data),
            me,
            memberList.map((m) => m.id),
          )
        : [],
    [expenses, memberList, me, display, rates.data],
  );

  if (tripData.isError || members.isError) {
    return (
      <View style={styles.empty} testID="budget-slot">
        <Text variant="headline">{"Couldn't load the expenses"}</Text>
        <Text variant="subhead" tone="secondary" style={styles.centered}>
          Check your connection and try again.
        </Text>
        <Button
          label="Try again"
          variant="secondary"
          onPress={() => {
            void tripData.refetch();
            void members.refetch();
          }}
          testID="budget-retry"
        />
      </View>
    );
  }

  // No trip selected, or the selected one is gone.
  if (tripId === null || (!tripData.isPending && !data)) {
    return (
      <View style={styles.empty} testID="budget-slot">
        <Text variant="headline">No trip selected</Text>
        <Text variant="subhead" tone="secondary" style={styles.centered}>
          Pick a trip on the Trips tab to see its expenses.
        </Text>
      </View>
    );
  }

  const loading = tripData.isPending || members.isPending || (needsRates && rates.isPending);
  if (loading || !data || !summary || !memberList) {
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
  // Balances only on a group trip (someone may have left since).
  const shownTab = tab === 'balances' && !group ? 'categories' : tab;

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarInset + spacing.lg }]}
        testID="budget-slot"
      >
        <View style={styles.header}>
          <Text variant="subhead" tone="secondary" style={styles.flex} numberOfLines={1}>
            {`${trip.city} · ${dateRangeLabel(trip.startDate, trip.endDate)}`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Trip currency ${display}. Change currency`}
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

        {currencyFailed ? (
          <Text variant="subhead" tone="secondary" testID="budget-currency-error">
            {"Couldn't change the trip currency. Check your connection and try again."}
          </Text>
        ) : null}

        {rates.isError && needsRates ? (
          <Text variant="subhead" tone="secondary" testID="budget-rates-error">
            {`Couldn't load today's exchange rates. Amounts not in ${display} are left out of the totals.`}
          </Text>
        ) : null}

        <Segmented
          segments={group ? GROUP_TABS : TABS}
          value={shownTab}
          onChange={setTab}
          testID="budget-tabs"
        />

        {shownTab === 'balances' ? (
          <BalancesList balances={balances} members={memberList} currency={display} />
        ) : shownTab === 'categories' ? (
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
                    converted={tripAmount(expense, display, rates.data)}
                    who={group ? splitLine(expense, me, nameOf) : null}
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
          close();
          setCurrencyFailed(false);
          if (code === tripCurrencyOf(trip)) {
            setPicked(null);
            return;
          }
          // Shown right away; back to the saved one, with a note, if the change doesn't save.
          setPicked(code);
          saveCurrency
            .mutateAsync({ tripId: trip.id, currency: code })
            .then(() => setPicked(null))
            .catch(() => {
              setPicked(null);
              setCurrencyFailed(true);
            });
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
        data={data}
        members={memberList}
        tripCurrency={tripCurrencyOf(trip)}
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
  content: { gap: spacing.lg, paddingHorizontal: screenPadding },
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
