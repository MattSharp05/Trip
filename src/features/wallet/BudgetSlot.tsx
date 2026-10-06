import { StyleSheet, View } from 'react-native';

/** Organize → Budget. Intentionally empty: TR-21 builds the budget here. */
export function BudgetSlot() {
  return <View style={styles.slot} testID="budget-slot" />;
}

const styles = StyleSheet.create({ slot: { flex: 1 } });
