import { Stack } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { dayIn, monthDayLabel } from '@/core/dates';
import { FALLBACK_NAME, memberLabel } from '@/core/members';
import { formatMoney } from '@/core/money';
import { history, pairBalances } from '@/core/settle';
import { MemberAvatar } from '@/features/members';
import { useTripData, useTripMembers } from '@/services/data';
import { useRates } from '@/services/rates';
import { useTripStore } from '@/stores/trip';
import { colors, screenPadding, spacing } from '@/theme';
import { LoadError, Skeleton, Surface, Text, useTabBarInset } from '@/ui';

import { historyShare, personHeadline, toLedger } from './balances';
import { needsLiveRate, tripCurrencyOf } from './budget';

/**
 * A traveller's balance with you (TR-65): what you owe them or they owe you, then every expense
 * (and, later, payment) between you two, newest first: when, what, who paid and whose share.
 */
export function PersonBalanceScreen({ id }: { id: string }) {
  const tabBarInset = useTabBarInset();
  const tripId = useTripStore((s) => s.selectedTripId);
  const tripData = useTripData(tripId);
  const members = useTripMembers(tripId);
  const data = tripData.data;
  const currency = data ? tripCurrencyOf(data.trip) : 'USD';
  const rates = useRates(currency);
  const memberList = members.data;
  const me = memberList?.find((m) => m.isMe)?.id ?? '';
  const member = memberList?.find((m) => m.id === id);

  const ledger = useMemo(
    () => (data && me ? toLedger(data.expenses, me, currency, rates.data) : null),
    [data, me, currency, rates.data],
  );
  const balance = ledger ? pairBalances(ledger, me, [id])[0] : null;
  const lines = useMemo(() => (ledger ? history(me, id, ledger) : []), [ledger, me, id]);
  const nameOf = (userId: string) => {
    const m = memberList?.find((x) => x.id === userId);
    return m ? memberLabel(m) : FALLBACK_NAME;
  };

  const needsRates = !!data && data.expenses.some((e) => needsLiveRate(e, currency));
  const loading =
    tripData.isPending || members.isPending || (needsRates && rates.isPending && !rates.isError);
  const name = member?.name ?? '';

  let body: ReactNode;
  if (tripData.isError || members.isError) {
    body = (
      <LoadError
        message="Couldn't load the expenses. Check your connection."
        onRetry={() => {
          void tripData.refetch();
          void members.refetch();
        }}
      />
    );
  } else if (loading) {
    body = (
      <>
        <Skeleton height={110} radius="card" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={56} radius="card" />
        ))}
      </>
    );
  } else if (!member || !balance || !data) {
    body = (
      <View style={styles.missing}>
        <Text variant="headline">This traveller is no longer on the trip</Text>
      </View>
    );
  } else {
    body = (
      <>
        <Surface testID="person-balance">
          <View style={styles.balanceTop}>
            <MemberAvatar member={member} size={40} />
            <Text variant="subhead" tone="secondary" style={styles.flex}>
              {personHeadline(balance, name)}
            </Text>
          </View>
          {balance.direction !== 'settled' ? (
            <Text variant="largeTitle" style={styles.amount} testID="person-balance-amount">
              {formatMoney({ amountMinor: balance.amountMinor, currency })}
            </Text>
          ) : null}
        </Surface>

        <Text variant="headline">History</Text>
        {lines.length === 0 ? (
          <Text variant="subhead" tone="secondary" testID="person-history-empty">
            {`No shared expenses with ${name} yet.`}
          </Text>
        ) : (
          <Surface padding="none" testID="person-history">
            {lines.map((line, i) => {
              const share = historyShare(line, me, nameOf);
              const when = line.date
                ? monthDayLabel(dayIn(data.trip.timezone, new Date(line.date)))
                : null;
              const who =
                line.kind === 'payment'
                  ? `${nameOf(line.paidBy)} sent`
                  : `${nameOf(line.paidBy)} paid`;
              const converted =
                share.amount.currency !== currency
                  ? formatMoney({ amountMinor: Math.abs(line.effectMinor), currency })
                  : null;
              return (
                <View
                  key={`${line.kind}-${line.id}`}
                  style={[styles.row, i < lines.length - 1 && styles.separator]}
                  accessible
                  accessibilityLabel={[
                    line.title || share.label,
                    when,
                    who,
                    share.label,
                    formatMoney(share.amount),
                    converted,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  testID={`person-history-${line.id}`}
                >
                  <View style={styles.flex}>
                    <Text variant="body" style={styles.title} numberOfLines={1}>
                      {line.title || share.label}
                    </Text>
                    <Text
                      variant="subhead"
                      tone="secondary"
                      numberOfLines={1}
                      testID={`person-history-${line.id}-who`}
                    >
                      {[when, who].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <View style={styles.amounts}>
                    <Text variant="body" testID={`person-history-${line.id}-share`}>
                      {formatMoney(share.amount)}
                    </Text>
                    <Text
                      variant="subhead"
                      tone="secondary"
                      testID={`person-history-${line.id}-label`}
                    >
                      {converted ? `${share.label} · ${converted}` : share.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Surface>
        )}
      </>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarInset + spacing.lg }]}
      testID="person-balance-screen"
    >
      <Stack.Screen options={{ headerShown: true, title: name, headerBackTitle: 'Expenses' }} />
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.md, padding: screenPadding },
  flex: { flex: 1 },
  balanceTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  amount: { marginTop: spacing.md },
  missing: { alignItems: 'center', paddingTop: spacing.xxxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  title: { fontWeight: '500' },
  amounts: { alignItems: 'flex-end', gap: spacing.xxs },
});
