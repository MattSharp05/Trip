import { StyleSheet, View } from 'react-native';

import { HOME_CURRENCIES } from '@/features/settings';
import { spacing } from '@/theme';
import { Chip, Sheet, Text } from '@/ui';

export interface CurrencySheetProps {
  open: boolean;
  value: string;
  onChange: (currency: string) => void;
  onClose: () => void;
}

/** Pick the currency the budget shows in. Changes the display only; expenses keep theirs. */
export function CurrencySheet({ open, value, onChange, onClose }: CurrencySheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Show amounts in" testID="budget-currency-sheet">
      <View style={styles.grid}>
        {HOME_CURRENCIES.map((c) => (
          <Chip
            key={c.code}
            label={c.code}
            selected={c.code === value}
            onPress={() => onChange(c.code)}
            testID={`budget-currency-${c.code}`}
          />
        ))}
      </View>
      <Text variant="subhead" tone="secondary">
        Each expense keeps the currency it was paid in. Rates come from the European Central Bank,
        updated daily.
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
