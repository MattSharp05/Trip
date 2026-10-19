import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { now } from '@/core/clock';
import { dayIn } from '@/core/dates';
import { memberLabel } from '@/core/members';
import { currencyDecimals } from '@/core/money';
import { itemTitle } from '@/features/plan/edit/edits';
import { HOME_CURRENCIES } from '@/features/settings';
import { useDataSource, useSaveExpense, type Member, type TripData } from '@/services/data';
import { colors, spacing } from '@/theme';
import { Button, Chip, Sheet, Text } from '@/ui';

import { CATEGORIES, type Category } from './budget';
import { buildExpense, defaultExpenseCurrency } from './expenseForm';
import { SheetField } from './SheetField';
import { withTripRate } from './tripRate';
import { useOpenCount } from './useOpenCount';

const CONVERTIBLE = HOME_CURRENCIES.map((c) => c.code);

export interface AddExpenseSheetProps {
  open: boolean;
  onClose: () => void;
  /** The trip, with its itinerary for the activity picker. */
  data: TripData;
  /** Everyone on the trip, you included (you first). */
  members: Member[];
  /** What the rate stored on the expense converts to. */
  tripCurrency: string;
  homeCurrency: string;
  /** Called after a save, before the sheet closes. */
  onSaved?: () => void;
}

/**
 * Add an expense: amount, currency, category, note, date and, on a group trip, who paid and who
 * it's split with (equally), plus the activity it was for. It keeps the currency it was paid in.
 */
export function AddExpenseSheet({
  open,
  onClose,
  data,
  members,
  tripCurrency,
  homeCurrency,
  onSaved,
}: AddExpenseSheetProps) {
  const session = useOpenCount(open);
  return (
    <Sheet open={open} onClose={onClose} title="Add expense" testID="add-expense-sheet">
      <ExpenseForm
        key={session}
        data={data}
        members={members}
        tripCurrency={tripCurrency}
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
  data,
  members,
  tripCurrency,
  homeCurrency,
  onDone,
}: {
  data: TripData;
  members: Member[];
  tripCurrency: string;
  homeCurrency: string;
  onDone: () => void;
}) {
  const trip = data.trip;
  const save = useSaveExpense();
  const demo = useDataSource().kind === 'demo';
  const me = members.find((m) => m.isMe) ?? members[0];
  const group = members.length > 1;
  const initialCurrency = defaultExpenseCurrency(trip, homeCurrency, CONVERTIBLE);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(initialCurrency);
  const [category, setCategory] = useState<Category>('Food & Drinks');
  const [note, setNote] = useState('');
  const [day, setDay] = useState(() => dayIn(trip.timezone, now()));
  const [error, setError] = useState<string | null>(null);
  const [paidBy, setPaidBy] = useState(me?.id ?? '');
  // Everyone (null), or the travellers picked one by one.
  const [picked, setPicked] = useState<string[] | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const everyone = members.map((m) => m.id);
  const participants = picked ?? everyone;
  const togglePerson = (id: string) => {
    const current = picked ?? [];
    const next = current.includes(id) ? current.filter((p) => p !== id) : [...current, id];
    // Nobody, or all of them, is Everyone again.
    setPicked(next.length === 0 || next.length === everyone.length ? null : next);
    setError(null);
  };

  // The trip's activities in plan order, for "what was it for".
  const activities = useMemo(
    () =>
      [...data.items]
        .sort(
          (a, b) =>
            a.day.localeCompare(b.day) || (a.startTime ?? '').localeCompare(b.startTime ?? ''),
        )
        .map((item) => ({
          id: item.id,
          label: `${format(parseISO(item.day), 'MMM d')} · ${itemTitle(data, item)}`,
        })),
    [data],
  );

  // The likely currencies first (the trip's, then home), then the rest.
  const currencies = useMemo(() => {
    const first = [...new Set([initialCurrency, homeCurrency])];
    return [...first, ...CONVERTIBLE.filter((c) => !first.includes(c))];
  }, [initialCurrency, homeCurrency]);

  const submit = async () => {
    const result = buildExpense(
      {
        amount,
        currency,
        category,
        note,
        day,
        paidBy,
        participants: group ? participants : [paidBy],
        itineraryItemId: itemId,
      },
      trip,
    );
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setSaving(true);
    try {
      const expense = await withTripRate(result.expense, tripCurrency, day, { demo });
      await save.mutateAsync(expense);
      onDone();
    } catch {
      setError("Couldn't save the expense. Check your connection and try again.");
    } finally {
      setSaving(false);
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
      {group ? (
        <>
          <ChipRow label="Paid by" testID="expense-paid-by">
            {members.map((m) => (
              <Chip
                key={m.id}
                label={memberLabel(m)}
                selected={m.id === paidBy}
                onPress={() => setPaidBy(m.id)}
                testID={`expense-paid-by-${m.id}`}
              />
            ))}
          </ChipRow>
          <ChipRow label="Split" testID="expense-split">
            <Chip
              label="Everyone"
              selected={picked === null}
              onPress={() => {
                setPicked(null);
                setError(null);
              }}
              testID="expense-split-everyone"
            />
            {members.map((m) => (
              <Chip
                key={m.id}
                label={memberLabel(m)}
                selected={picked?.includes(m.id) ?? false}
                onPress={() => togglePerson(m.id)}
                testID={`expense-split-${m.id}`}
              />
            ))}
          </ChipRow>
        </>
      ) : null}
      {activities.length > 0 ? (
        <ChipRow label="Activity" testID="expense-activity">
          <Chip
            label="None"
            selected={itemId === null}
            onPress={() => setItemId(null)}
            testID="expense-activity-none"
          />
          {activities.map((a) => (
            <Chip
              key={a.id}
              label={a.label}
              selected={a.id === itemId}
              onPress={() => setItemId(a.id)}
              testID={`expense-activity-${a.id}`}
            />
          ))}
        </ChipRow>
      ) : null}
      <Button
        label="Add expense"
        onPress={submit}
        disabled={saving || save.isPending}
        testID="expense-save"
      />
    </View>
  );
}

/** A labelled row of chips that scrolls sideways. */
function ChipRow({
  label,
  children,
  testID,
}: {
  label: string;
  children: ReactNode;
  testID: string;
}) {
  return (
    <View style={styles.chipRow}>
      <Text variant="subhead" tone="secondary">
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
        testID={testID}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  chipRow: { gap: spacing.xs },
  chips: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
