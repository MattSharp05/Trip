import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { memberLabel } from '@/core/members';
import { overallNet, type PairBalance } from '@/core/settle';
import { MemberAvatar } from '@/features/members';
import type { Member } from '@/services/data';
import { colors, spacing } from '@/theme';
import { Icon, Surface, Text } from '@/ui';

import { balanceParts, overallLine } from './balances';

export interface BalancesListProps {
  balances: readonly PairBalance[];
  members: readonly Member[];
  /** The trip currency every amount is in. */
  currency: string;
}

/**
 * Organize → Expenses → Balances (TR-65): what you owe each traveller, or they owe you, after
 * offsetting your debts with them, and the overall line on top. No red or green: the amount is
 * white, the label secondary. Tapping a traveller opens their history.
 */
export function BalancesList({ balances, members, currency }: BalancesListProps) {
  const router = useRouter();
  const rows = balances.flatMap((balance) => {
    const member = members.find((m) => m.id === balance.memberId);
    return member ? [{ balance, member }] : [];
  });

  if (rows.length === 0) {
    return (
      <View style={styles.empty} testID="balances-empty">
        <Text variant="headline">Just you on this trip</Text>
        <Text variant="subhead" tone="secondary" style={styles.centered}>
          Invite friends to split expenses and see who owes whom.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <Text variant="headline" testID="balances-overall">
        {overallLine(overallNet(balances), currency)}
      </Text>
      <Surface padding="none" testID="balances">
        {rows.map(({ balance, member }, i) => {
          const { label, amount } = balanceParts(balance, currency);
          const name = memberLabel(member);
          return (
            <Pressable
              key={member.id}
              accessibilityRole="button"
              accessibilityLabel={[name, label, amount].filter(Boolean).join(', ')}
              accessibilityHint="Shows your expenses with them"
              onPress={() => router.push(`/organize/person/${member.id}`)}
              style={({ pressed }) => [
                styles.row,
                i < rows.length - 1 && styles.separator,
                pressed && styles.pressed,
              ]}
              testID={`balance-row-${member.id}`}
            >
              <MemberAvatar member={member} size={32} />
              <Text variant="body" style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <Text variant="body" tone="secondary" testID={`balance-row-${member.id}-label`}>
                {label}
                {amount ? (
                  <Text variant="body" testID={`balance-row-${member.id}-amount`}>
                    {` ${amount}`}
                  </Text>
                ) : null}
              </Text>
              <Icon name="chevron.right" size="sm" tone="secondary" />
            </Pressable>
          );
        })}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  pressed: { backgroundColor: colors.fill },
  name: { flex: 1, fontWeight: '500' },
  empty: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xxxl },
  centered: { textAlign: 'center' },
});
