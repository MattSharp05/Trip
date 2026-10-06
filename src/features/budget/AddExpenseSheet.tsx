import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { now } from '@/core/clock';
import { dayIn } from '@/core/dates';
import { currencyDecimals } from '@/core/money';
import { HOME_CURRENCIES } from '@/features/settings';
import { useSaveExpense, type Trip } from '@/services/data';
import { colors, spacing } from '@/theme';
import { Button, Chip, Sheet, Text } from '@/ui';

import { CATEGORIES, type Category } from './budget';
import { buildExpense, defaultExpenseCurrency } from './expenseForm';
import { SheetField } from './SheetField';
import { useOpenCount } from './useOpenCount';

const CONVERTIBLE = HOME_CURRENCIES.map((c) => c.code);

export interface AddExpenseSheetProps {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  homeCurrency: string;
  /** Called after a save, before the sheet closes. */
  onSaved?: () => void;
}

/** Add an expense: amount, currency, category, note, date. It keeps the currency it was paid in. */
export function AddExpenseSheet({
  open,
  onClose,
  trip,
  homeCurrency,
  onSaved,
}: AddExpenseSheetProps) {
  const session = useOpenCount(open);
  return (
    <Sheet open={open} onClose={onClose} title="Add expense" testID="add-expense-sheet">
      <ExpenseForm
        key={session}
        trip={trip}
        homeCurrency={homeCurrency}
        onDone={() => {
          onSaved?.();
          onClose();
        }}
      />
    </Sheet>
  );
}

function ExpenseForm({
  trip,
  homeCurrency,
  onDone,
}: {
  trip: Trip;
  homeCurrency: string;
  onDone: () => void;
}) {
  const save = useSaveExpense();
  const initialCurrency = defaultExpenseCurrency(trip, homeCurrency, CONVERTIBLE);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(initialCurrency);
  const [category, setCategory] = useState<Category>('Food & Drinks');
  const [note, setNote] = useState('');
  const [day, setDay] = useState(() => dayIn(trip.timezone, now()));
  const [error, setError] = useState<string | null>(null);

  // The likely currencies first (the trip's, then home), then the rest.
  const currencies = useMemo(() => {
    const first = [...new Set([initialCurrency, homeCurrency])];
    return [...first, ...CONVERTIBLE.filter((c) => !first.includes(c))];
  }, [initialCurrency, homeCurrency]);

  const submit = async () => {
    const result = buildExpense({ amount, currency, category, note, day }, trip);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    try {
      await save.mutateAsync(result.expense);
      onDone();
    } catch {
      setError("Couldn't save the expense. Check your connection and try again.");
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
        placeholder={currencyDecimals(currency) === 0 ? '8400' : '12.50'}
        error={error}
        testID="expense-amount"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
        testID="expense-currencies"
      >
        {currencies.map((code) => (
          <Chip
            key={code}
            label={code}
            selected={code === currency}
            onPress={() => {
              setCurrency(code);
              setError(null);
            }}
            testID={`expense-currency-${code}`}
          />
        ))}
      </ScrollView>
      <View style={styles.wrap}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c.name}
            label={c.name}
            selected={c.name === category}
            onPress={() => setCategory(c.name)}
            testID={`expense-category-${c.name}`}
          />
        ))}
      </View>
      <SheetField
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="Dinner at Carbone"
        returnKeyType="done"
        testID="expense-note"
      />
      <View style={styles.dateRow}>
        <Text variant="body">Date</Text>
        <DateTimePicker
          value={parseISO(day)}
          mode="date"
          display="compact"
          themeVariant="dark"
          accentColor={colors.accent}
          onChange={(_event, date) => {
            if (date) setDay(format(date, 'yyyy-MM-dd'));
          }}
          accessibilityLabel="Date"
          testID="expense-date"
        />
      </View>
      <Button
        label="Add expense"
        onPress={submit}
        disabled={save.isPending}
        testID="expense-save"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  chips: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
