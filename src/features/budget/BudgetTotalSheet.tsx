import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatAmountInput, parseAmount, type Money } from '@/core/money';
import { useSaveTripBudget } from '@/services/data';
import { spacing } from '@/theme';
import { Button, Sheet } from '@/ui';

import { SheetField } from './SheetField';
import { useOpenCount } from './useOpenCount';

export interface BudgetTotalSheetProps {
  open: boolean;
  onClose: () => void;
  tripId: string;
  /** The current budget, edited in its own currency so saving never drifts it. */
  budget: Money | null;
  /** The currency a new budget is set in. */
  currency: string;
}

/** Set or change the trip's total budget. */
export function BudgetTotalSheet({
  open,
  onClose,
  tripId,
  budget,
  currency,
}: BudgetTotalSheetProps) {
  const session = useOpenCount(open);
  return (
    <Sheet open={open} onClose={onClose} title="Total budget" testID="budget-total-sheet">
      <BudgetTotalForm
        key={session}
        tripId={tripId}
        currency={budget?.currency ?? currency}
        initial={budget ? formatAmountInput(budget) : ''}
        onDone={onClose}
      />
    </Sheet>
  );
}

function BudgetTotalForm({
  tripId,
  currency,
  initial,
  onDone,
}: {
  tripId: string;
  currency: string;
  initial: string;
  onDone: () => void;
}) {
  const save = useSaveTripBudget();
  const [amount, setAmount] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const amountMinor = parseAmount(amount, currency);
    if (amountMinor === null) {
      setError('Enter an amount, like 2500.');
      return;
    }
    try {
      await save.mutateAsync({ tripId, budget: { amountMinor, currency } });
      onDone();
    } catch {
      setError("Couldn't save the budget. Check your connection and try again.");
    }
  };

  return (
    <View style={styles.form}>
      <SheetField
        label={`Amount (${currency})`}
        value={amount}
        onChangeText={(text) => {
          setAmount(text);
          setError(null);
        }}
        keyboardType="decimal-pad"
        placeholder="2500"
        error={error}
        testID="budget-total-input"
      />
      <Button
        label="Save budget"
        onPress={submit}
        disabled={save.isPending}
        testID="budget-total-save"
      />
    </View>
  );
}

const styles = StyleSheet.create({ form: { gap: spacing.md } });
